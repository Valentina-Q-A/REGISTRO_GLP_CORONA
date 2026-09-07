"use strict";

// ============================================================
// INSPECTOR GENÉRICO DE HISTÓRICO UBIDOTS
// ============================================================
//
// Nombre recomendado:
//   scripts/inspeccionar-ubidots.js
//
// Propósito:
//   - Consultar variables de Ubidots en modo solo lectura.
//   - Recorrer todas las páginas mediante data.next.
//   - Replicar la unión por timestamp exacto usada por GitHub Pages.
//   - Informar cobertura temporal por variable y global.
//   - Detectar registros completos, incompletos y contextos divergentes.
//   - Comparar el timestamp de recepción con Fecha + Hora del contexto.
//   - No mostrar ni guardar el token.
//   - No modificar datos en Ubidots.
//
// Requisitos:
//   - Node.js 18 o superior, por el uso de fetch global.
//   - Variable UBIDOTS_TOKEN en .env o en el entorno.
//   - Archivo de configuración JavaScript.
//
// Uso:
//   node scripts/inspeccionar-ubidots.js \
//     --config=scripts/config-ubidots-glp.js \
//     --json=resumen \
//     --limite=20
//
// Opciones:
//   --config=<archivo.js>       Obligatorio
//   --env=<archivo>             Predeterminado: .env
//   --json=resumen|hallazgos|completo|ninguno
//   --limite=<n>                Máximo por lista; 0 = sin límite
//   --page-size=<n>             Sobrescribe config.pageSize
//   --concurrencia=<n>          Variables consultadas en paralelo
//   --timeout-ms=<n>            Tiempo máximo por solicitud
//   --max-paginas=<n>           Protección contra ciclos; 0 = sin límite
//   --ayuda
//
// Códigos de salida:
//   0 = ejecución correcta
//   1 = error de configuración, red o autenticación
//   2 = inspección completada con respuesta estructural inesperada
//
// Contrato mínimo de configuración:
//
// module.exports = {
//   nombre: "Ubidots GLP",
//   baseUrl: "https://industrial.api.ubidots.com/api/v1.6",
//   tokenEnv: "UBIDOTS_TOKEN",
//   pageSize: 100,
//   zonaHoraria: "America/Bogota",
//   variables: {
//     nivel_tanque: "ID_VARIABLE",
//     presion_tanque: "ID_VARIABLE"
//   },
//   camposContexto: {
//     fecha: "Fecha",
//     hora: "Hora"
//   }
// };
//
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MODOS_JSON = new Set([
    "resumen",
    "hallazgos",
    "completo",
    "ninguno"
]);

function leerArgumentos(argumentos) {
    const opciones = {};

    for (const argumento of argumentos) {
        if (!argumento.startsWith("--")) {
            continue;
        }

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
Inspector de histórico Ubidots

Uso:
  node scripts/inspeccionar-ubidots.js --config=<archivo.js> [opciones]

Opciones:
  --config=<archivo.js>       Configuración de variables y conexión
  --env=<archivo>             Archivo .env; predeterminado: .env
  --json=resumen              Resumen ejecutivo, predeterminado
  --json=hallazgos            Resumen y hallazgos limitados
  --json=completo             Resultado completo limitado
  --json=ninguno              No imprime JSON
  --limite=<n>                Máximo por lista; 0 = sin límite
  --page-size=<n>             Tamaño de página para la API
  --concurrencia=<n>          Consultas simultáneas de variables
  --timeout-ms=<n>            Tiempo máximo por solicitud
  --max-paginas=<n>           Protección contra ciclos; 0 = sin límite
  --ayuda                     Muestra esta ayuda

Ejemplo:
  node scripts/inspeccionar-ubidots.js --config=scripts/config-ubidots-glp.js --json=hallazgos --limite=20
`);
}

function terminarConError(mensaje, detalle = null) {
    console.error(`ERROR: ${mensaje}`);

    if (detalle) {
        console.error(detalle);
    }

    process.exit(1);
}

function cargarEnv(rutaEnv) {
    if (!fs.existsSync(rutaEnv)) {
        return;
    }

    const contenido = fs.readFileSync(rutaEnv, "utf8");

    for (const lineaOriginal of contenido.split(/\r?\n/)) {
        const linea = lineaOriginal.trim();

        if (!linea || linea.startsWith("#")) {
            continue;
        }

        const posicionIgual = linea.indexOf("=");

        if (posicionIgual <= 0) {
            continue;
        }

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

function enteroPositivo(valor, nombre, permiteCero = false) {
    const numero = Number(valor);
    const minimo = permiteCero ? 0 : 1;

    if (!Number.isInteger(numero) || numero < minimo) {
        terminarConError(
            `${nombre} debe ser un entero mayor o igual a ${minimo}.`
        );
    }

    return numero;
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
    terminarConError(
        "Esta versión de Node.js no dispone de fetch global. Usa Node.js 18 o superior."
    );
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
        "No se pudo cargar el archivo de configuración.",
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
    terminarConError("config.variables debe contener al menos una variable.");
}

const baseUrl = String(
    config.baseUrl ||
    "https://industrial.api.ubidots.com/api/v1.6"
).replace(/\/$/, "");

const tokenEnv = config.tokenEnv || "UBIDOTS_TOKEN";
const token = process.env[tokenEnv];

if (!token) {
    terminarConError(
        `No se encontró ${tokenEnv}. Agrégala a ${archivoEnv} o al entorno del proceso.`
    );
}

const modoJSON = String(opciones.json || "resumen").toLowerCase();

if (!MODOS_JSON.has(modoJSON)) {
    terminarConError(
        "--json debe ser resumen, hallazgos, completo o ninguno."
    );
}

const limiteJSON = enteroPositivo(
    opciones.limite ?? 20,
    "--limite",
    true
);

const pageSize = enteroPositivo(
    opciones["page-size"] ?? config.pageSize ?? 100,
    "--page-size"
);

const concurrencia = enteroPositivo(
    opciones.concurrencia ?? config.concurrencia ?? 2,
    "--concurrencia"
);

const timeoutMs = enteroPositivo(
    opciones["timeout-ms"] ?? config.timeoutMs ?? 30000,
    "--timeout-ms"
);

const maxPaginas = enteroPositivo(
    opciones["max-paginas"] ?? config.maxPaginas ?? 10000,
    "--max-paginas",
    true
);

const zonaHoraria = config.zonaHoraria || "America/Bogota";
const camposContexto = {
    fecha: config.camposContexto?.fecha || "Fecha",
    hora: config.camposContexto?.hora || "Hora"
};

function ocultarURL(urlTexto) {
    try {
        const url = new URL(urlTexto);

        for (const parametro of [
            "token",
            "api_key",
            "apikey",
            "x-auth-token"
        ]) {
            if (url.searchParams.has(parametro)) {
                url.searchParams.set(parametro, "[OCULTO]");
            }
        }

        return url.toString();
    } catch {
        return "[URL NO MOSTRADA]";
    }
}

function construirURLInicial(variableId) {
    const url = new URL(
        `${baseUrl}/variables/${encodeURIComponent(variableId)}/values`
    );

    url.searchParams.set("page_size", String(pageSize));

    for (const [clave, valor] of Object.entries(config.parametros || {})) {
        if (valor !== null && valor !== undefined && valor !== "") {
            url.searchParams.set(clave, String(valor));
        }
    }

    return url.toString();
}

async function fetchJSON(url, etiqueta, pagina) {
    const controlador = new AbortController();
    const temporizador = setTimeout(
        () => controlador.abort(),
        timeoutMs
    );

    let response;

    try {
        response = await fetch(url, {
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
                `${etiqueta}, página ${pagina}: tiempo de espera agotado después de ${timeoutMs} ms.`
            );
        }

        throw new Error(
            `${etiqueta}, página ${pagina}: error de red: ${error.message}`
        );
    } finally {
        clearTimeout(temporizador);
    }

    if (!response.ok) {
        let cuerpo = "";

        try {
            cuerpo = await response.text();
        } catch {
            cuerpo = "";
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                `${etiqueta}: autenticación rechazada (HTTP ${response.status}). ` +
                `Verifica ${tokenEnv}; el token no será mostrado.`
            );
        }

        throw new Error(
            `${etiqueta}, página ${pagina}: HTTP ${response.status}. ` +
            `${cuerpo.slice(0, 300)}`
        );
    }

    try {
        return await response.json();
    } catch (error) {
        throw new Error(
            `${etiqueta}, página ${pagina}: la respuesta no es JSON válido: ${error.message}`
        );
    }
}

function timestampValido(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0;
}

function fechaDesdeTimestamp(valor) {
    if (!timestampValido(valor)) {
        return null;
    }

    const numero = Number(valor);
    const milisegundos = numero < 100000000000
        ? numero * 1000
        : numero;
    const fecha = new Date(milisegundos);

    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaISO(valor) {
    const fecha = fechaDesdeTimestamp(valor);
    return fecha ? fecha.toISOString() : null;
}

function fechaLocal(valor) {
    const fecha = fechaDesdeTimestamp(valor);

    if (!fecha) {
        return null;
    }

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

function normalizarFechaContexto(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

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

function normalizarHoraContexto(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

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

    if (!coincidencia) {
        return texto;
    }

    return [
        coincidencia[1].padStart(2, "0"),
        coincidencia[2].padStart(2, "0"),
        String(coincidencia[3] || "0").padStart(2, "0")
    ].join(":");
}

function contextoFechaHora(contexto) {
    const fecha = normalizarFechaContexto(
        contexto?.[camposContexto.fecha]
    );
    const hora = normalizarHoraContexto(
        contexto?.[camposContexto.hora]
    );

    if (!fecha && !hora) {
        return null;
    }

    return {
        fecha,
        hora,
        clave: `${fecha || ""}|${hora || ""}`
    };
}

function hashTexto(texto) {
    return crypto
        .createHash("sha256")
        .update(texto)
        .digest("hex");
}

async function consultarVariable(etiqueta, variableId) {
    let url = construirURLInicial(variableId);
    let pagina = 0;
    let totalDeclarado = null;
    const valores = [];
    const paginas = [];
    const urlsVisitadas = new Set();

    while (url) {
        pagina++;

        if (maxPaginas > 0 && pagina > maxPaginas) {
            throw new Error(
                `${etiqueta}: se superó --max-paginas=${maxPaginas}.`
            );
        }

        const urlNormalizada = String(url);

        if (urlsVisitadas.has(urlNormalizada)) {
            throw new Error(
                `${etiqueta}: se detectó un ciclo de paginación en ${ocultarURL(urlNormalizada)}.`
            );
        }

        urlsVisitadas.add(urlNormalizada);

        const contenido = await fetchJSON(urlNormalizada, etiqueta, pagina);
        const resultados = Array.isArray(contenido)
            ? contenido
            : contenido.results;

        if (!Array.isArray(resultados)) {
            const error = new Error(
                `${etiqueta}: la respuesta no contiene un arreglo results.`
            );
            error.codigoEstructura = true;
            throw error;
        }

        if (
            totalDeclarado === null &&
            Number.isFinite(Number(contenido.count))
        ) {
            totalDeclarado = Number(contenido.count);
        }

        valores.push(...resultados);

        const timestampsPagina = resultados
            .map(resultado => Number(resultado.timestamp))
            .filter(timestampValido)
            .sort((a, b) => a - b);

        paginas.push({
            pagina,
            cantidad: resultados.length,
            acumulado: valores.length,
            timestampMinimo: timestampsPagina[0] ?? null,
            timestampMaximo: timestampsPagina.at(-1) ?? null,
            fechaMinimaLocal: fechaLocal(timestampsPagina[0]),
            fechaMaximaLocal: fechaLocal(timestampsPagina.at(-1))
        });

        console.log(
            `[${etiqueta}] página ${pagina}: ` +
            `${resultados.length} valores, acumulado ${valores.length}`
        );

        url = Array.isArray(contenido)
            ? null
            : contenido.next || null;
    }

    const timestamps = valores
        .map(valor => Number(valor.timestamp))
        .filter(timestampValido)
        .sort((a, b) => a - b);

    const sinTimestamp = valores.filter(
        valor => !timestampValido(valor.timestamp)
    ).length;

    const duplicadosTimestamp = [];
    const conteoTimestamp = new Map();

    for (const timestamp of timestamps) {
        conteoTimestamp.set(
            timestamp,
            (conteoTimestamp.get(timestamp) || 0) + 1
        );
    }

    for (const [timestamp, cantidad] of conteoTimestamp.entries()) {
        if (cantidad > 1) {
            duplicadosTimestamp.push({
                variable: etiqueta,
                timestamp,
                cantidad,
                fechaLocal: fechaLocal(timestamp)
            });
        }
    }

    return {
        etiqueta,
        variableId,
        valores,
        paginas,
        resumen: {
            variable: etiqueta,
            variableId,
            paginas: paginas.length,
            valores: valores.length,
            totalDeclarado,
            coincideConTotalDeclarado:
                totalDeclarado === null || totalDeclarado === valores.length,
            sinTimestamp,
            timestampsUnicos: conteoTimestamp.size,
            timestampsDuplicados: duplicadosTimestamp.length,
            timestampMasAntiguo: timestamps[0] ?? null,
            fechaMasAntiguaUTC: fechaISO(timestamps[0]),
            fechaMasAntiguaLocal: fechaLocal(timestamps[0]),
            timestampMasReciente: timestamps.at(-1) ?? null,
            fechaMasRecienteUTC: fechaISO(timestamps.at(-1)),
            fechaMasRecienteLocal: fechaLocal(timestamps.at(-1))
        },
        duplicadosTimestamp
    };
}

async function mapConConcurrencia(entradas, limite, tarea) {
    const resultados = new Array(entradas.length);
    let siguienteIndice = 0;

    async function trabajador() {
        while (true) {
            const indice = siguienteIndice++;

            if (indice >= entradas.length) {
                return;
            }

            resultados[indice] = await tarea(entradas[indice], indice);
        }
    }

    const cantidadTrabajadores = Math.min(limite, entradas.length);

    await Promise.all(
        Array.from(
            { length: cantidadTrabajadores },
            () => trabajador()
        )
    );

    return resultados;
}

function reconstruirPorTimestamp(resultadosVariables) {
    const registros = new Map();
    const conflictosContexto = [];

    for (const resultadoVariable of resultadosVariables) {
        const etiqueta = resultadoVariable.etiqueta;

        for (const punto of resultadoVariable.valores) {
            if (!timestampValido(punto.timestamp)) {
                continue;
            }

            const timestamp = Number(punto.timestamp);

            if (!registros.has(timestamp)) {
                registros.set(timestamp, {
                    timestamp,
                    context: {},
                    variablesPresentes: [],
                    origenContexto: {}
                });
            }

            const registro = registros.get(timestamp);
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
                        timestamp,
                        fechaLocal: fechaLocal(timestamp),
                        campo,
                        valorExistente: registro.context[campo],
                        valorNuevo: valor,
                        variableExistente: registro.origenContexto[campo],
                        variableNueva: etiqueta
                    });
                }

                registro.context[campo] = valor;
                registro.origenContexto[campo] = etiqueta;
            }

            registro[etiqueta] = punto.value;

            if (!registro.variablesPresentes.includes(etiqueta)) {
                registro.variablesPresentes.push(etiqueta);
            }
        }
    }

    return {
        registros: [...registros.values()].sort(
            (a, b) => b.timestamp - a.timestamp
        ),
        conflictosContexto
    };
}

function analizarReconstruccion(registros) {
    const etiquetas = Object.keys(variables);
    const incompletos = [];
    const sinFechaHoraContexto = [];
    const conteoPorCompletitud = new Map();
    const clavesContexto = new Map();
    const diferenciasRecepcionContexto = [];

    let completos = 0;

    for (const registro of registros) {
        const faltantes = etiquetas.filter(
            etiqueta => !Object.prototype.hasOwnProperty.call(
                registro,
                etiqueta
            )
        );

        const presentes = etiquetas.length - faltantes.length;
        conteoPorCompletitud.set(
            presentes,
            (conteoPorCompletitud.get(presentes) || 0) + 1
        );

        if (faltantes.length === 0) {
            completos++;
        } else {
            incompletos.push({
                timestamp: registro.timestamp,
                fechaLocal: fechaLocal(registro.timestamp),
                variablesPresentes: registro.variablesPresentes.length,
                camposFaltantes: faltantes
            });
        }

        const temporalContexto = contextoFechaHora(registro.context);

        if (!temporalContexto?.fecha || !temporalContexto?.hora) {
            sinFechaHoraContexto.push({
                timestamp: registro.timestamp,
                fechaLocal: fechaLocal(registro.timestamp),
                fechaContexto: temporalContexto?.fecha ?? null,
                horaContexto: temporalContexto?.hora ?? null,
                variablesPresentes: registro.variablesPresentes
            });
            continue;
        }

        if (!clavesContexto.has(temporalContexto.clave)) {
            clavesContexto.set(temporalContexto.clave, []);
        }

        clavesContexto.get(temporalContexto.clave).push(
            registro.timestamp
        );

        const fechaContexto = new Date(
            `${temporalContexto.fecha}T${temporalContexto.hora}-05:00`
        );
        const fechaRecepcion = fechaDesdeTimestamp(registro.timestamp);

        if (
            !Number.isNaN(fechaContexto.getTime()) &&
            fechaRecepcion
        ) {
            const diferenciaMinutos = Math.round(
                (fechaRecepcion.getTime() - fechaContexto.getTime()) /
                60000
            );

            diferenciasRecepcionContexto.push({
                timestamp: registro.timestamp,
                fechaRecepcionLocal: fechaLocal(registro.timestamp),
                fechaHoraContexto: temporalContexto.clave,
                diferenciaMinutos
            });
        }
    }

    const duplicadosContexto = [...clavesContexto.entries()]
        .filter(([, timestamps]) => timestamps.length > 1)
        .map(([clave, timestamps]) => ({
            claveFechaHoraContexto: clave,
            cantidad: timestamps.length,
            timestamps,
            fechasRecepcionLocal: timestamps.map(fechaLocal)
        }));

    const clavesOrdenadas = [...clavesContexto.keys()].sort();
    const diferenciasOrdenadas = diferenciasRecepcionContexto
        .map(item => item.diferenciaMinutos)
        .sort((a, b) => a - b);

    return {
        completos,
        incompletos,
        sinFechaHoraContexto,
        duplicadosContexto,
        coberturaContexto: {
            clavesFechaHoraUnicas: clavesContexto.size,
            fechaHoraMasAntigua: clavesOrdenadas[0] ?? null,
            fechaHoraMasReciente: clavesOrdenadas.at(-1) ?? null
        },
        distribucionCompletitud: [...conteoPorCompletitud.entries()]
            .map(([variablesPresentes, cantidad]) => ({
                variablesPresentes,
                variablesEsperadas: etiquetas.length,
                cantidad
            }))
            .sort((a, b) => b.variablesPresentes - a.variablesPresentes),
        diferenciasRecepcionContexto,
        resumenDiferenciasMinutos: {
            cantidad: diferenciasOrdenadas.length,
            minimo: diferenciasOrdenadas[0] ?? null,
            mediana: diferenciasOrdenadas.length
                ? diferenciasOrdenadas[
                    Math.floor(diferenciasOrdenadas.length / 2)
                ]
                : null,
            maximo: diferenciasOrdenadas.at(-1) ?? null
        }
    };
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
    if (Array.isArray(valor)) {
        return limitarLista(valor, limite);
    }

    if (!valor || typeof valor !== "object") {
        return valor;
    }

    return Object.fromEntries(
        Object.entries(valor).map(([clave, contenido]) => [
            clave,
            limitarRecursivamente(contenido, limite)
        ])
    );
}

async function main() {
    const fechaInicio = new Date();
    const entradasVariables = Object.entries(variables);

    console.log("\n============================================================");
    console.log(" INSPECCIÓN DEL HISTÓRICO UBIDOTS");
    console.log("============================================================");
    console.log(`Configuración: ${config.nombre || path.basename(archivoConfig)}`);
    console.log(`Variables: ${entradasVariables.length}`);
    console.log(`Tamaño de página: ${pageSize}`);
    console.log(`Concurrencia: ${concurrencia}`);
    console.log(`Zona horaria: ${zonaHoraria}`);
    console.log(`Token: cargado desde ${tokenEnv}; valor oculto`);
    console.log("");

    let resultadosVariables;

    try {
        resultadosVariables = await mapConConcurrencia(
            entradasVariables,
            concurrencia,
            async ([etiqueta, variableId]) =>
                consultarVariable(etiqueta, variableId)
        );
    } catch (error) {
        terminarConError("La inspección no pudo completarse.", error.message);
    }

    const reconstruccion = reconstruirPorTimestamp(
        resultadosVariables
    );
    const analisis = analizarReconstruccion(
        reconstruccion.registros
    );

    const totalValores = resultadosVariables.reduce(
        (acumulado, resultado) =>
            acumulado + resultado.valores.length,
        0
    );
    const totalPaginas = resultadosVariables.reduce(
        (acumulado, resultado) =>
            acumulado + resultado.paginas.length,
        0
    );
    const timestampsGlobales = reconstruccion.registros
        .map(registro => registro.timestamp)
        .sort((a, b) => a - b);
    const fechaFin = new Date();

    const huella = hashTexto(
        JSON.stringify(
            reconstruccion.registros.map(registro => ({
                timestamp: registro.timestamp,
                variablesPresentes: [...registro.variablesPresentes].sort(),
                context: registro.context
            }))
        )
    );

    const resumen = {
        variablesConsultadas: entradasVariables.length,
        paginasConsultadas: totalPaginas,
        valoresRecuperados: totalValores,
        timestampsUnicos: reconstruccion.registros.length,
        registrosReconstruidos: reconstruccion.registros.length,
        registrosCompletos: analisis.completos,
        registrosIncompletos: analisis.incompletos.length,
        registrosSinFechaHoraContexto:
            analisis.sinFechaHoraContexto.length,
        clavesFechaHoraContextoUnicas:
            analisis.coberturaContexto.clavesFechaHoraUnicas,
        duplicadosPorFechaHoraContexto:
            analisis.duplicadosContexto.length,
        conflictosDeContexto:
            reconstruccion.conflictosContexto.length,
        timestampMasAntiguo:
            timestampsGlobales[0] ?? null,
        fechaRecepcionMasAntiguaUTC:
            fechaISO(timestampsGlobales[0]),
        fechaRecepcionMasAntiguaLocal:
            fechaLocal(timestampsGlobales[0]),
        timestampMasReciente:
            timestampsGlobales.at(-1) ?? null,
        fechaRecepcionMasRecienteUTC:
            fechaISO(timestampsGlobales.at(-1)),
        fechaRecepcionMasRecienteLocal:
            fechaLocal(timestampsGlobales.at(-1)),
        fechaHoraContextoMasAntigua:
            analisis.coberturaContexto.fechaHoraMasAntigua,
        fechaHoraContextoMasReciente:
            analisis.coberturaContexto.fechaHoraMasReciente,
        duracionMs:
            fechaFin.getTime() - fechaInicio.getTime(),
        huellaReconstruccionSHA256:
            huella
    };

    const porVariable = resultadosVariables.map(
        resultado => resultado.resumen
    );

    const hallazgos = {
        registrosIncompletos: analisis.incompletos,
        registrosSinFechaHoraContexto:
            analisis.sinFechaHoraContexto,
        duplicadosPorFechaHoraContexto:
            analisis.duplicadosContexto,
        conflictosDeContexto:
            reconstruccion.conflictosContexto,
        timestampsDuplicadosDentroDeVariables:
            resultadosVariables.flatMap(
                resultado => resultado.duplicadosTimestamp
            ),
        diferenciasRecepcionContexto:
            analisis.diferenciasRecepcionContexto
    };

    const resultadoCompleto = {
        metadatos: {
            fechaInspeccionISO: fechaFin.toISOString(),
            configuracion: archivoConfig,
            archivoEnvConsultado: archivoEnv,
            tokenEnv,
            tokenExpuestoEnSalida: false,
            soloLectura: true,
            baseUrl,
            pageSize,
            concurrencia,
            timeoutMs,
            maxPaginas,
            zonaHoraria,
            criterioReconstruccion:
                "Unión de valores de variables por timestamp exacto",
            criterioTemporalOperacional:
                `${camposContexto.fecha} + ${camposContexto.hora} del context`
        },
        resumen,
        porVariable,
        distribucionCompletitud:
            analisis.distribucionCompletitud,
        resumenDiferenciasRecepcionContexto:
            analisis.resumenDiferenciasMinutos,
        paginas: Object.fromEntries(
            resultadosVariables.map(resultado => [
                resultado.etiqueta,
                resultado.paginas
            ])
        ),
        hallazgos,
        muestraRegistrosReconstruidos:
            reconstruccion.registros
    };

    console.log("\n============================================================");
    console.log(" RESUMEN");
    console.log("============================================================");
    console.log(`Páginas consultadas: ${resumen.paginasConsultadas}`);
    console.log(`Valores recuperados: ${resumen.valoresRecuperados}`);
    console.log(`Registros reconstruidos: ${resumen.registrosReconstruidos}`);
    console.log(`Registros completos: ${resumen.registrosCompletos}`);
    console.log(`Registros incompletos: ${resumen.registrosIncompletos}`);
    console.log(
        `Fecha operacional más antigua: ${resumen.fechaHoraContextoMasAntigua}`
    );
    console.log(
        `Fecha operacional más reciente: ${resumen.fechaHoraContextoMasReciente}`
    );
    console.log(
        `Recepción más antigua (${zonaHoraria}): ${resumen.fechaRecepcionMasAntiguaLocal}`
    );
    console.log(
        `Recepción más reciente (${zonaHoraria}): ${resumen.fechaRecepcionMasRecienteLocal}`
    );
    console.log(
        `Duplicados por Fecha + Hora de contexto: ${resumen.duplicadosPorFechaHoraContexto}`
    );
    console.log(`Conflictos de contexto: ${resumen.conflictosDeContexto}`);
    console.log(`Duración: ${resumen.duracionMs} ms`);

    let salidaConsola = null;

    if (modoJSON === "resumen") {
        salidaConsola = {
            metadatos: resultadoCompleto.metadatos,
            resumen,
            porVariable,
            distribucionCompletitud:
                analisis.distribucionCompletitud,
            resumenDiferenciasRecepcionContexto:
                analisis.resumenDiferenciasMinutos
        };
    } else if (modoJSON === "hallazgos") {
        salidaConsola = limitarRecursivamente(
            {
                metadatos: resultadoCompleto.metadatos,
                resumen,
                porVariable,
                distribucionCompletitud:
                    analisis.distribucionCompletitud,
                resumenDiferenciasRecepcionContexto:
                    analisis.resumenDiferenciasMinutos,
                hallazgos
            },
            limiteJSON
        );
    } else if (modoJSON === "completo") {
        salidaConsola = limitarRecursivamente(
            resultadoCompleto,
            limiteJSON
        );
    }

    if (salidaConsola) {
        console.log("\n====================== INICIO JSON ==========================");
        console.log(JSON.stringify(salidaConsola, null, 2));
        console.log("======================= FIN JSON ============================");
    }

    console.log("\nLa inspección fue de solo lectura. El token no se imprimió.\n");
}

main().catch(error => {
    terminarConError("Error no controlado.", error.stack || error.message);
});
