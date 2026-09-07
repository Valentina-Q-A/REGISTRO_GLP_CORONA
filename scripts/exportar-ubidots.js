"use strict";

// ============================================================
// EXPORTADOR GENERICO DE HISTORICO UBIDOTS
// ============================================================
//
// Nombre recomendado:
//   scripts/exportar-ubidots.js
//
// Propósito:
//   - Consultar variables de Ubidots en modo solo lectura.
//   - Recorrer todas las páginas mediante data.next.
//   - Reconstruir registros mediante timestamp exacto.
//   - Conservar registros repetidos por Fecha + Hora operacional.
//   - Generar una instantánea JSON reproducible.
//   - Generar un Excel compatible con auditoría y conciliación.
//   - Generar un reporte técnico de exportación.
//   - No mostrar ni guardar el token.
//   - No modificar datos en Ubidots.
//
// Requisitos:
//   - Node.js 18 o superior.
//   - Paquete xlsx instalado.
//   - UBIDOTS_TOKEN en .env o en el entorno.
//   - Archivo de configuración JavaScript.
//
// Uso:
//   node scripts/exportar-ubidots.js \
//     --config=scripts/config-ubidots-glp.js
//
// Opciones:
//   --config=<archivo.js>       Obligatorio
//   --env=<archivo>             Predeterminado: .env
//   --json=<archivo.json>       Ruta de la instantánea JSON
//   --excel=<archivo.xlsx>      Ruta del Excel exportado
//   --reporte=<archivo.xlsx>    Ruta del reporte técnico
//   --hoja=<nombre>             Hoja principal; predeterminado: Registros
//   --page-size=<n>             Sobrescribe config.pageSize
//   --concurrencia=<n>          Consultas paralelas
//   --timeout-ms=<n>            Tiempo máximo por solicitud
//   --max-paginas=<n>           Protección contra ciclos; 0 = sin límite
//   --consola=resumen|completo|ninguno
//   --limite=<n>                Límite de listas en consola; 0 = sin límite
//   --simular                   Consulta y valida, pero no escribe archivos
//   --ayuda
//
// El exportador NO depura ni elimina registros.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const MODOS_CONSOLA = new Set([
    "resumen",
    "completo",
    "ninguno"
]);

function leerArgumentos(argumentos) {
    const opciones = {};

    for (const argumento of argumentos) {
        if (!argumento.startsWith("--")) continue;

        const contenido = argumento.slice(2);
        const posicionIgual = contenido.indexOf("=");
        const clave = posicionIgual === -1
            ? contenido
            : contenido.slice(0, posicionIgual);
        const valor = posicionIgual === -1
            ? "true"
            : contenido.slice(posicionIgual + 1);

        opciones[clave.toLowerCase()] = valor;
    }

    return opciones;
}

function mostrarAyuda() {
    console.log(`
Exportador de histórico Ubidots

Uso:
  node scripts/exportar-ubidots.js --config=<archivo.js> [opciones]

Opciones:
  --config=<archivo.js>       Configuración de variables y conexión
  --env=<archivo>             Archivo .env; predeterminado: .env
  --json=<archivo.json>       Instantánea JSON
  --excel=<archivo.xlsx>      Excel de registros reconstruidos
  --reporte=<archivo.xlsx>    Reporte técnico
  --hoja=<nombre>             Hoja principal; predeterminado: Registros
  --page-size=<n>             Tamaño de página
  --concurrencia=<n>          Variables consultadas simultáneamente
  --timeout-ms=<n>            Tiempo máximo por solicitud
  --max-paginas=<n>           Protección contra ciclos; 0 = sin límite
  --consola=resumen           Resumen, predeterminado
  --consola=completo          Incluye hallazgos limitados
  --consola=ninguno           No imprime JSON
  --limite=<n>                Máximo por lista; 0 = sin límite
  --simular                   No escribe archivos
  --ayuda                     Muestra esta ayuda

Ejemplo:
  node scripts/exportar-ubidots.js --config=scripts/config-ubidots-glp.js
`);
}

function terminarConError(mensaje, detalle = null) {
    console.error(`ERROR: ${mensaje}`);
    if (detalle) console.error(detalle);
    process.exit(1);
}

function entero(valor, nombre, permiteCero = false) {
    const numero = Number(valor);
    const minimo = permiteCero ? 0 : 1;

    if (!Number.isInteger(numero) || numero < minimo) {
        terminarConError(
            `${nombre} debe ser un entero mayor o igual a ${minimo}.`
        );
    }

    return numero;
}

function cargarEnv(rutaEnv) {
    if (!fs.existsSync(rutaEnv)) return;

    const contenido = fs.readFileSync(rutaEnv, "utf8");

    for (const lineaOriginal of contenido.split(/\r?\n/)) {
        const linea = lineaOriginal.trim();
        if (!linea || linea.startsWith("#")) continue;

        const posicionIgual = linea.indexOf("=");
        if (posicionIgual <= 0) continue;

        const clave = linea.slice(0, posicionIgual).trim();
        let valor = linea.slice(posicionIgual + 1).trim();

        if (
            (valor.startsWith('"') && valor.endsWith('"')) ||
            (valor.startsWith("'") && valor.endsWith("'"))
        ) {
            valor = valor.slice(1, -1);
        }

        if (process.env[clave] === undefined) {
            process.env[clave] = valor;
        }
    }
}

function nombreFechaArchivo(fecha = new Date()) {
    return fecha
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z")
        .replace(/:/g, "-");
}

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda === "true" || opciones.help === "true") {
    mostrarAyuda();
    process.exit(0);
}

if (!opciones.config) {
    mostrarAyuda();
    terminarConError("Debes indicar --config.");
}

if (typeof fetch !== "function") {
    terminarConError("Se requiere Node.js 18 o superior.");
}

const archivoConfig = path.resolve(process.cwd(), opciones.config);
const archivoEnv = path.resolve(process.cwd(), opciones.env || ".env");

if (!fs.existsSync(archivoConfig)) {
    terminarConError(`No existe la configuración: ${archivoConfig}`);
}

cargarEnv(archivoEnv);

let config;

try {
    delete require.cache[require.resolve(archivoConfig)];
    config = require(archivoConfig);
} catch (error) {
    terminarConError(
        "No se pudo cargar la configuración.",
        error.message
    );
}

if (!config || typeof config !== "object" || Array.isArray(config)) {
    terminarConError("La configuración debe exportar un objeto.");
}

const variables = config.variables;

if (
    !variables ||
    typeof variables !== "object" ||
    Array.isArray(variables) ||
    Object.keys(variables).length === 0
) {
    terminarConError("config.variables debe contener variables.");
}

const tokenEnv = config.tokenEnv || "UBIDOTS_TOKEN";
const token = process.env[tokenEnv];

if (!token) {
    terminarConError(
        `No se encontró ${tokenEnv} en ${archivoEnv} ni en el entorno.`
    );
}

const fechaEjecucion = new Date();
const sufijo = nombreFechaArchivo(fechaEjecucion);
const prefijo = config.prefijoExportacion || "exportacion-ubidots";
const archivoJSON = path.resolve(
    process.cwd(),
    opciones.json || `${prefijo}-${sufijo}.json`
);
const archivoExcel = path.resolve(
    process.cwd(),
    opciones.excel || `${prefijo}-${sufijo}.xlsx`
);
const archivoReporte = path.resolve(
    process.cwd(),
    opciones.reporte || `reporte-${prefijo}-${sufijo}.xlsx`
);
const nombreHoja = opciones.hoja || config.hojaExportacion || "Registros";
const baseUrl = String(
    config.baseUrl ||
    "https://industrial.api.ubidots.com/api/v1.6"
).replace(/\/$/, "");
const pageSize = entero(
    opciones["page-size"] ?? config.pageSize ?? 100,
    "--page-size"
);
const concurrencia = entero(
    opciones.concurrencia ?? config.concurrencia ?? 2,
    "--concurrencia"
);
const timeoutMs = entero(
    opciones["timeout-ms"] ?? config.timeoutMs ?? 30000,
    "--timeout-ms"
);
const maxPaginas = entero(
    opciones["max-paginas"] ?? config.maxPaginas ?? 10000,
    "--max-paginas",
    true
);
const limiteConsola = entero(
    opciones.limite ?? 20,
    "--limite",
    true
);
const modoConsola = String(
    opciones.consola || "resumen"
).toLowerCase();
const simular = opciones.simular === "true";
const zonaHoraria = config.zonaHoraria || "America/Bogota";
const camposContexto = {
    fecha: config.camposContexto?.fecha || "Fecha",
    hora: config.camposContexto?.hora || "Hora"
};

if (!MODOS_CONSOLA.has(modoConsola)) {
    terminarConError(
        "--consola debe ser resumen, completo o ninguno."
    );
}

const rutasSalida = [archivoJSON, archivoExcel, archivoReporte]
    .map(ruta => path.normalize(ruta).toLowerCase());

if (new Set(rutasSalida).size !== rutasSalida.length) {
    terminarConError("Las tres rutas de salida deben ser diferentes.");
}

function esVacio(valor) {
    return valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function timestampValido(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0;
}

function fechaDesdeTimestamp(valor) {
    if (!timestampValido(valor)) return null;

    const numero = Number(valor);
    const fecha = new Date(
        numero < 100000000000
            ? numero * 1000
            : numero
    );

    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaISO(valor) {
    const fecha = fechaDesdeTimestamp(valor);
    return fecha ? fecha.toISOString() : null;
}

function fechaLocal(valor) {
    const fecha = fechaDesdeTimestamp(valor);
    if (!fecha) return null;

    return new Intl.DateTimeFormat("es-CO", {
        timeZone: zonaHoraria,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(fecha);
}

function normalizarFecha(valor) {
    if (esVacio(valor)) return null;

    const texto = String(valor).trim();
    let coincidencia = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (coincidencia) {
        return [
            coincidencia[1],
            coincidencia[2].padStart(2, "0"),
            coincidencia[3].padStart(2, "0")
        ].join("-");
    }

    coincidencia = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);

    if (coincidencia) {
        return [
            coincidencia[3],
            coincidencia[2].padStart(2, "0"),
            coincidencia[1].padStart(2, "0")
        ].join("-");
    }

    return texto;
}

function normalizarHora(valor) {
    if (esVacio(valor)) return null;

    const texto = String(valor).trim();
    const doceHoras = texto.match(
        /^(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*(am|pm)$/i
    );

    if (doceHoras) {
        let horas = Number(doceHoras[1]);
        const minutos = Number(doceHoras[2]);
        const segundos = Number(doceHoras[3] || 0);
        const periodo = doceHoras[4].toLowerCase();

        if (periodo === "am" && horas === 12) horas = 0;
        if (periodo === "pm" && horas !== 12) horas += 12;

        return [horas, minutos, segundos]
            .map(numero => String(numero).padStart(2, "0"))
            .join(":");
    }

    const coincidencia = texto.match(
        /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
    );

    if (!coincidencia) return texto;

    return [
        coincidencia[1].padStart(2, "0"),
        coincidencia[2].padStart(2, "0"),
        String(coincidencia[3] || 0).padStart(2, "0")
    ].join(":");
}

function obtenerTemporalContexto(contexto) {
    const fecha = normalizarFecha(
        contexto?.[camposContexto.fecha]
    );
    const hora = normalizarHora(
        contexto?.[camposContexto.hora]
    );

    return {
        fecha,
        hora,
        clave: fecha && hora ? `${fecha}|${hora}` : null
    };
}

function diferenciaMinutos(timestamp, fecha, hora) {
    if (!fecha || !hora) return null;

    const fechaContexto = new Date(`${fecha}T${hora}-05:00`);
    const fechaRecepcion = fechaDesdeTimestamp(timestamp);

    if (
        Number.isNaN(fechaContexto.getTime()) ||
        !fechaRecepcion
    ) {
        return null;
    }

    return Math.round(
        (fechaRecepcion.getTime() - fechaContexto.getTime()) / 60000
    );
}

function sha256(valor) {
    return crypto
        .createHash("sha256")
        .update(valor)
        .digest("hex");
}

function construirURLInicial(variableId) {
    const url = new URL(
        `${baseUrl}/variables/${encodeURIComponent(variableId)}/values`
    );

    url.searchParams.set("page_size", String(pageSize));

    for (const [clave, valor] of Object.entries(config.parametros || {})) {
        if (!esVacio(valor)) {
            url.searchParams.set(clave, String(valor));
        }
    }

    return url.toString();
}

async function solicitarJSON(url, etiqueta, pagina) {
    const controlador = new AbortController();
    const temporizador = setTimeout(
        () => controlador.abort(),
        timeoutMs
    );

    let respuesta;

    try {
        respuesta = await fetch(url, {
            method: "GET",
            headers: {
                "X-Auth-Token": token,
                "Accept": "application/json"
            },
            signal: controlador.signal
        });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                `${etiqueta}, página ${pagina}: timeout de ${timeoutMs} ms.`
            );
        }

        throw new Error(
            `${etiqueta}, página ${pagina}: ${error.message}`
        );
    } finally {
        clearTimeout(temporizador);
    }

    if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
            throw new Error(
                `${etiqueta}: autenticación rechazada ` +
                `(HTTP ${respuesta.status}). Verifica ${tokenEnv}.`
            );
        }

        const cuerpo = await respuesta.text().catch(() => "");

        throw new Error(
            `${etiqueta}, página ${pagina}: HTTP ${respuesta.status}. ` +
            cuerpo.slice(0, 300)
        );
    }

    return respuesta.json();
}

async function consultarVariable(etiqueta, variableId) {
    let url = construirURLInicial(variableId);
    let numeroPagina = 0;
    const valores = [];
    const paginas = [];
    const visitadas = new Set();

    while (url) {
        numeroPagina++;

        if (maxPaginas > 0 && numeroPagina > maxPaginas) {
            throw new Error(
                `${etiqueta}: se superó maxPaginas=${maxPaginas}.`
            );
        }

        if (visitadas.has(url)) {
            throw new Error(
                `${etiqueta}: ciclo detectado en la paginación.`
            );
        }

        visitadas.add(url);

        const contenido = await solicitarJSON(
            url,
            etiqueta,
            numeroPagina
        );
        const resultados = Array.isArray(contenido)
            ? contenido
            : contenido.results;

        if (!Array.isArray(resultados)) {
            throw new Error(
                `${etiqueta}: respuesta sin arreglo results.`
            );
        }

        valores.push(...resultados);

        const timestamps = resultados
            .map(item => Number(item.timestamp))
            .filter(timestampValido)
            .sort((a, b) => a - b);

        paginas.push({
            Variable: etiqueta,
            Pagina: numeroPagina,
            Cantidad: resultados.length,
            Acumulado: valores.length,
            TimestampMinimo: timestamps[0] ?? null,
            FechaMinimaLocal: fechaLocal(timestamps[0]),
            TimestampMaximo: timestamps.at(-1) ?? null,
            FechaMaximaLocal: fechaLocal(timestamps.at(-1))
        });

        console.log(
            `[${etiqueta}] página ${numeroPagina}: ` +
            `${resultados.length} valores, acumulado ${valores.length}`
        );

        url = Array.isArray(contenido)
            ? null
            : contenido.next || null;
    }

    const timestamps = valores
        .map(item => Number(item.timestamp))
        .filter(timestampValido)
        .sort((a, b) => a - b);

    return {
        etiqueta,
        variableId,
        valores,
        paginas,
        resumen: {
            Variable: etiqueta,
            VariableId: variableId,
            Paginas: paginas.length,
            Valores: valores.length,
            SinTimestamp: valores.filter(
                item => !timestampValido(item.timestamp)
            ).length,
            TimestampsUnicos: new Set(timestamps).size,
            TimestampMasAntiguo: timestamps[0] ?? null,
            FechaMasAntiguaUTC: fechaISO(timestamps[0]),
            FechaMasAntiguaLocal: fechaLocal(timestamps[0]),
            TimestampMasReciente: timestamps.at(-1) ?? null,
            FechaMasRecienteUTC: fechaISO(timestamps.at(-1)),
            FechaMasRecienteLocal: fechaLocal(timestamps.at(-1))
        }
    };
}

async function mapConConcurrencia(entradas, limite, tarea) {
    const resultados = new Array(entradas.length);
    let indiceSiguiente = 0;

    async function trabajador() {
        while (true) {
            const indice = indiceSiguiente++;
            if (indice >= entradas.length) return;
            resultados[indice] = await tarea(entradas[indice]);
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(limite, entradas.length) },
            () => trabajador()
        )
    );

    return resultados;
}

function reconstruir(resultadosVariables) {
    const mapa = new Map();
    const conflictosContexto = [];

    for (const resultado of resultadosVariables) {
        for (const punto of resultado.valores) {
            if (!timestampValido(punto.timestamp)) continue;

            const timestamp = Number(punto.timestamp);

            if (!mapa.has(timestamp)) {
                mapa.set(timestamp, {
                    timestamp,
                    context: {},
                    variablesPresentes: [],
                    origenContexto: {}
                });
            }

            const registro = mapa.get(timestamp);
            const contexto = punto.context || {};

            for (const [campo, valor] of Object.entries(contexto)) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        registro.context,
                        campo
                    ) &&
                    JSON.stringify(registro.context[campo]) !==
                        JSON.stringify(valor)
                ) {
                    conflictosContexto.push({
                        TimestampUbidots: timestamp,
                        FechaRecepcionLocal: fechaLocal(timestamp),
                        Campo: campo,
                        ValorExistente: registro.context[campo],
                        ValorNuevo: valor,
                        VariableExistente: registro.origenContexto[campo],
                        VariableNueva: resultado.etiqueta
                    });
                }

                registro.context[campo] = valor;
                registro.origenContexto[campo] = resultado.etiqueta;
            }

            registro[resultado.etiqueta] = punto.value;
            registro.variablesPresentes.push(resultado.etiqueta);
        }
    }

    return {
        registros: [...mapa.values()].sort(
            (a, b) => a.timestamp - b.timestamp
        ),
        conflictosContexto
    };
}

function construirRegistroPlano(registro) {
    const temporal = obtenerTemporalContexto(registro.context);
    const mapeo = config.mapeoSalida || {};
    const fila = {};

    for (const [etiqueta] of Object.entries(variables)) {
        const columna = mapeo[etiqueta] || etiqueta;
        fila[columna] = Object.prototype.hasOwnProperty.call(
            registro,
            etiqueta
        )
            ? registro[etiqueta]
            : null;
    }

    const contextoSalida = config.contextoSalida || {};

    for (const [campoContexto, columnaSalida] of Object.entries(
        contextoSalida
    )) {
        fila[columnaSalida] = registro.context?.[campoContexto] ?? null;
    }

    fila.Fecha = temporal.fecha;
    fila.Hora = temporal.hora;
    fila.TimestampUbidots = registro.timestamp;
    fila.FechaRecepcionUbidotsUTC = fechaISO(registro.timestamp);
    fila.FechaRecepcionUbidotsColombia = fechaLocal(registro.timestamp);
    fila.DiferenciaRecepcionMinutos = diferenciaMinutos(
        registro.timestamp,
        temporal.fecha,
        temporal.hora
    );
    fila.VariablesPresentes = registro.variablesPresentes.length;
    fila.VariablesEsperadas = Object.keys(variables).length;
    fila.ContextoCompletoJSON = JSON.stringify(registro.context || {});

    return fila;
}

function analizar(registrosReconstruidos, filas) {
    const esperadas = Object.keys(variables);
    const incompletos = [];
    const gruposFechaHora = new Map();
    const desfases = [];

    registrosReconstruidos.forEach((registro, indice) => {
        const faltantes = esperadas.filter(
            etiqueta => !Object.prototype.hasOwnProperty.call(
                registro,
                etiqueta
            )
        );

        if (faltantes.length > 0) {
            incompletos.push({
                FilaExportada: indice + 2,
                TimestampUbidots: registro.timestamp,
                FechaRecepcionLocal: fechaLocal(registro.timestamp),
                VariablesPresentes: esperadas.length - faltantes.length,
                VariablesEsperadas: esperadas.length,
                VariablesFaltantes: faltantes.join("; ")
            });
        }

        const temporal = obtenerTemporalContexto(registro.context);

        if (temporal.clave) {
            if (!gruposFechaHora.has(temporal.clave)) {
                gruposFechaHora.set(temporal.clave, []);
            }

            gruposFechaHora.get(temporal.clave).push({
                fila: indice + 2,
                timestamp: registro.timestamp,
                registro: filas[indice]
            });
        }

        const diferencia = filas[indice].DiferenciaRecepcionMinutos;

        if (diferencia !== null) {
            desfases.push({
                FilaExportada: indice + 2,
                Fecha: filas[indice].Fecha,
                Hora: filas[indice].Hora,
                TimestampUbidots: registro.timestamp,
                FechaRecepcionUbidotsColombia:
                    filas[indice].FechaRecepcionUbidotsColombia,
                DiferenciaRecepcionMinutos: diferencia,
                ValorAbsolutoMinutos: Math.abs(diferencia)
            });
        }
    });

    const duplicados = [];
    const diferenciasDuplicados = [];
    let grupoNumero = 0;

    for (const [clave, grupo] of gruposFechaHora.entries()) {
        if (grupo.length < 2) continue;
        grupoNumero++;
        const idGrupo = `DUP-${String(grupoNumero).padStart(4, "0")}`;

        for (const item of grupo) {
            duplicados.push({
                Grupo: idGrupo,
                FechaHora: clave,
                Cantidad: grupo.length,
                FilaExportada: item.fila,
                TimestampUbidots: item.timestamp,
                FechaRecepcionUbidotsColombia:
                    item.registro.FechaRecepcionUbidotsColombia
            });
        }

        const referencia = grupo[0];

        for (const comparado of grupo.slice(1)) {
            const columnas = Object.keys(referencia.registro).filter(
                columna => ![
                    "TimestampUbidots",
                    "FechaRecepcionUbidotsUTC",
                    "FechaRecepcionUbidotsColombia",
                    "DiferenciaRecepcionMinutos",
                    "ContextoCompletoJSON"
                ].includes(columna)
            );

            for (const columna of columnas) {
                const valorA = referencia.registro[columna];
                const valorB = comparado.registro[columna];

                if (JSON.stringify(valorA) !== JSON.stringify(valorB)) {
                    diferenciasDuplicados.push({
                        Grupo: idGrupo,
                        FechaHora: clave,
                        FilaReferencia: referencia.fila,
                        FilaComparada: comparado.fila,
                        Campo: columna,
                        ValorReferencia: valorA,
                        ValorComparado: valorB
                    });
                }
            }
        }
    }

    desfases.sort(
        (a, b) => b.ValorAbsolutoMinutos - a.ValorAbsolutoMinutos
    );

    return {
        incompletos,
        duplicados,
        diferenciasDuplicados,
        desfases,
        gruposFechaHoraUnicos: gruposFechaHora.size,
        gruposDuplicados: grupoNumero
    };
}

function crearHoja(libro, nombre, datos, encabezados = null) {
    const filas = Array.isArray(datos) && datos.length > 0
        ? datos
        : [{ Resultado: "Sin registros" }];

    const hoja = XLSX.utils.json_to_sheet(
        filas,
        encabezados ? { header: encabezados } : undefined
    );

    const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1:A1");
    hoja["!cols"] = [];

    for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
        let ancho = 12;

        for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
            const celda = hoja[
                XLSX.utils.encode_cell({ r: fila, c: columna })
            ];

            if (celda) {
                ancho = Math.max(ancho, String(celda.v ?? "").length + 2);
            }
        }

        hoja["!cols"].push({ wch: Math.min(ancho, 60) });
    }

    if (rango.e.r >= 1) {
        hoja["!autofilter"] = { ref: hoja["!ref"] };
    }

    XLSX.utils.book_append_sheet(libro, hoja, nombre);
}

function limitarLista(lista, limite) {
    if (!Array.isArray(lista) || limite === 0 || lista.length <= limite) {
        return lista;
    }

    return {
        total: lista.length,
        mostrados: limite,
        omitidos: lista.length - limite,
        elementos: lista.slice(0, limite)
    };
}

function limitarRecursivamente(valor, limite) {
    if (Array.isArray(valor)) return limitarLista(valor, limite);
    if (!valor || typeof valor !== "object") return valor;

    return Object.fromEntries(
        Object.entries(valor).map(([clave, contenido]) => [
            clave,
            limitarRecursivamente(contenido, limite)
        ])
    );
}

async function main() {
    const inicio = Date.now();
    const entradas = Object.entries(variables);

    console.log("\n============================================================");
    console.log(" EXPORTACIÓN DEL HISTÓRICO UBIDOTS");
    console.log("============================================================");
    console.log(`Configuración: ${config.nombre || path.basename(archivoConfig)}`);
    console.log(`Variables: ${entradas.length}`);
    console.log(`Tamaño de página: ${pageSize}`);
    console.log(`Concurrencia: ${concurrencia}`);
    console.log(`Token: cargado desde ${tokenEnv}; valor oculto`);
    console.log(`Simulación: ${simular ? "Sí" : "No"}`);
    console.log("");

    let resultadosVariables;

    try {
        resultadosVariables = await mapConConcurrencia(
            entradas,
            concurrencia,
            ([etiqueta, variableId]) =>
                consultarVariable(etiqueta, variableId)
        );
    } catch (error) {
        terminarConError("La exportación no pudo completarse.", error.message);
    }

    const reconstruccion = reconstruir(resultadosVariables);
    const filas = reconstruccion.registros.map(construirRegistroPlano);
    const analisis = analizar(reconstruccion.registros, filas);
    const timestamps = reconstruccion.registros
        .map(registro => registro.timestamp)
        .sort((a, b) => a - b);
    const clavesContexto = filas
        .filter(fila => fila.Fecha && fila.Hora)
        .map(fila => `${fila.Fecha}|${fila.Hora}`)
        .sort();
    const totalPaginas = resultadosVariables.reduce(
        (suma, resultado) => suma + resultado.paginas.length,
        0
    );
    const totalValores = resultadosVariables.reduce(
        (suma, resultado) => suma + resultado.valores.length,
        0
    );

    const resumen = {
        Configuracion: config.nombre || path.basename(archivoConfig),
        VariablesConsultadas: entradas.length,
        PaginasConsultadas: totalPaginas,
        ValoresRecuperados: totalValores,
        RegistrosReconstruidos: filas.length,
        RegistrosCompletos: filas.length - analisis.incompletos.length,
        RegistrosIncompletos: analisis.incompletos.length,
        ClavesFechaHoraUnicas: analisis.gruposFechaHoraUnicos,
        GruposDuplicadosFechaHora: analisis.gruposDuplicados,
        FilasEnGruposDuplicados: analisis.duplicados.length,
        DiferenciasEntreDuplicados:
            analisis.diferenciasDuplicados.length,
        ConflictosContexto: reconstruccion.conflictosContexto.length,
        FechaOperacionalMasAntigua: clavesContexto[0] ?? null,
        FechaOperacionalMasReciente: clavesContexto.at(-1) ?? null,
        FechaRecepcionMasAntiguaUTC: fechaISO(timestamps[0]),
        FechaRecepcionMasAntiguaLocal: fechaLocal(timestamps[0]),
        FechaRecepcionMasRecienteUTC: fechaISO(timestamps.at(-1)),
        FechaRecepcionMasRecienteLocal: fechaLocal(timestamps.at(-1)),
        ZonaHoraria: zonaHoraria,
        CriterioReconstruccion:
            "Unión de variables por timestamp exacto",
        DepuracionAplicada: false,
        DuracionMs: Date.now() - inicio
    };

    const metadatos = {
        fechaExportacionISO: new Date().toISOString(),
        configuracion: archivoConfig,
        tokenEnv,
        tokenIncluidoEnArchivos: false,
        soloLectura: true,
        baseUrl,
        pageSize,
        concurrencia,
        timeoutMs,
        maxPaginas,
        zonaHoraria,
        archivoJSON,
        archivoExcel,
        archivoReporte,
        modoSimulacion: simular
    };

    const instantaneaBase = {
        metadatos,
        resumen,
        porVariable: resultadosVariables.map(
            resultado => resultado.resumen
        ),
        registros: reconstruccion.registros.map(
            (registro, indice) => ({
                ...filas[indice],
                variablesPresentesNombres:
                    registro.variablesPresentes,
                context: registro.context
            })
        )
    };

    const jsonCanonico = JSON.stringify(instantaneaBase, null, 2);
    const huella = sha256(jsonCanonico);
    const instantanea = {
        ...instantaneaBase,
        integridad: {
            algoritmo: "SHA-256",
            huellaContenidoSinIntegridad: huella
        }
    };

    if (!simular) {
        try {
            fs.writeFileSync(
                archivoJSON,
                JSON.stringify(instantanea, null, 2) + "\n",
                "utf8"
            );
        } catch (error) {
            terminarConError(
                "No se pudo escribir la instantánea JSON.",
                error.message
            );
        }

        const libroDatos = XLSX.utils.book_new();
        const columnas = filas.length ? Object.keys(filas[0]) : [];
        crearHoja(libroDatos, nombreHoja, filas, columnas);
        crearHoja(
            libroDatos,
            "Metadatos",
            Object.entries({
                ...metadatos,
                HuellaSHA256: huella
            }).map(([Campo, Valor]) => ({ Campo, Valor }))
        );

        try {
            XLSX.writeFile(libroDatos, archivoExcel);
        } catch (error) {
            terminarConError(
                "No se pudo escribir el Excel exportado.",
                error.message
            );
        }

        const libroReporte = XLSX.utils.book_new();
        crearHoja(
            libroReporte,
            "Resumen",
            Object.entries({
                ...resumen,
                HuellaSHA256: huella
            }).map(([Indicador, Valor]) => ({ Indicador, Valor }))
        );
        crearHoja(
            libroReporte,
            "CoberturaVariables",
            resultadosVariables.map(resultado => resultado.resumen)
        );
        crearHoja(
            libroReporte,
            "PaginasConsultadas",
            resultadosVariables.flatMap(resultado => resultado.paginas)
        );
        crearHoja(
            libroReporte,
            "DuplicadosFechaHora",
            analisis.duplicados
        );
        crearHoja(
            libroReporte,
            "DiferenciasDuplicados",
            analisis.diferenciasDuplicados
        );
        crearHoja(
            libroReporte,
            "RegistrosIncompletos",
            analisis.incompletos
        );
        crearHoja(
            libroReporte,
            "ConflictosContexto",
            reconstruccion.conflictosContexto
        );
        crearHoja(
            libroReporte,
            "DesfasesTemporales",
            analisis.desfases
        );

        try {
            XLSX.writeFile(libroReporte, archivoReporte);
        } catch (error) {
            terminarConError(
                "No se pudo escribir el reporte técnico.",
                error.message
            );
        }
    }

    const resultadoConsola = {
        metadatos,
        resumen,
        integridad: {
            algoritmo: "SHA-256",
            huellaContenidoSinIntegridad: huella
        },
        porVariable: resultadosVariables.map(
            resultado => resultado.resumen
        ),
        hallazgos: {
            duplicadosFechaHora: analisis.duplicados,
            diferenciasDuplicados: analisis.diferenciasDuplicados,
            registrosIncompletos: analisis.incompletos,
            conflictosContexto: reconstruccion.conflictosContexto,
            mayoresDesfasesTemporales: analisis.desfases
        }
    };

    console.log("\n============================================================");
    console.log(" RESUMEN DE EXPORTACIÓN");
    console.log("============================================================");
    console.log(`Registros reconstruidos: ${resumen.RegistrosReconstruidos}`);
    console.log(`Registros completos: ${resumen.RegistrosCompletos}`);
    console.log(`Registros incompletos: ${resumen.RegistrosIncompletos}`);
    console.log(`Claves Fecha + Hora únicas: ${resumen.ClavesFechaHoraUnicas}`);
    console.log(`Grupos duplicados: ${resumen.GruposDuplicadosFechaHora}`);
    console.log(`Diferencias entre duplicados: ${resumen.DiferenciasEntreDuplicados}`);
    console.log(`Fecha operacional inicial: ${resumen.FechaOperacionalMasAntigua}`);
    console.log(`Fecha operacional final: ${resumen.FechaOperacionalMasReciente}`);
    console.log(`Huella SHA-256: ${huella}`);

    if (!simular) {
        console.log(`JSON: ${archivoJSON}`);
        console.log(`Excel: ${archivoExcel}`);
        console.log(`Reporte: ${archivoReporte}`);
    }

    if (modoConsola !== "ninguno") {
        const salida = modoConsola === "completo"
            ? limitarRecursivamente(resultadoConsola, limiteConsola)
            : {
                metadatos,
                resumen,
                integridad: resultadoConsola.integridad,
                porVariable: resultadoConsola.porVariable
            };

        console.log("\n====================== INICIO JSON ==========================");
        console.log(JSON.stringify(salida, null, 2));
        console.log("======================= FIN JSON ============================");
    }

    console.log(
        "\nLa exportación fue de solo lectura. " +
        "El token no fue escrito ni mostrado.\n"
    );
}

main().catch(error => {
    terminarConError("Error no controlado.", error.stack || error.message);
});
