"use strict";

// ============================================================
// MOTOR GENÉRICO DE DEPURACIÓN DE BASES EXCEL
// ============================================================
//
// Nombre recomendado:
//   scripts/depurar-base.js
//
// Requiere un archivo JavaScript de reglas que exporte un objeto.
// El motor no contiene reglas específicas de ningún proyecto.
//
// Uso:
//   node scripts/depurar-base.js \
//     --entrada=archivo.xlsx \
//     --reglas=scripts/reglas-depuracion.js \
//     --salida=archivo-depurado.xlsx \
//     --reporte=reporte-depuracion.xlsx
//
// Opciones:
//   --entrada=<archivo.xlsx>      Obligatorio
//   --reglas=<archivo.js>         Obligatorio
//   --salida=<archivo.xlsx>       Opcional
//   --reporte=<archivo.xlsx>      Opcional
//   --hoja=<nombre>               Sobrescribe reglas.hoja
//   --json=resumen|cambios|completo|ninguno
//   --limite=<n>                  0 = sin límite
//   --simular                     No escribe archivos
//   --estricto                    Detiene si queda una decisión sin resolver
//   --ayuda
//
// Contrato básico del archivo de reglas:
//
// module.exports = {
//   nombre: "Reglas del proyecto",
//   hoja: "Registros",
//   clave: ["Fecha", "Hora"],
//   columnasNuevas: {
//     NuevaColumna: null
//   },
//   camposObligatorios: ["Fecha", "Hora"],
//   normalizadores: {
//     Fecha: "fecha",
//     Hora: "hora"
//   },
//   transformaciones: [
//     {
//       id: "ejemplo",
//       campo: "Campo",
//       cuando: ({ valor, registro }) => valor === ".",
//       transformar: () => null,
//       motivo: "Valor inválido"
//     }
//   ],
//   duplicados: {
//     eliminarExactos: true,
//     conservarExacto: "primero",
//     decisiones: {
//       "2026-01-01|08:00:00": {
//         conservarCuando: { Campo: 123 },
//         motivo: "Decisión documentada"
//       }
//     }
//   },
//   validaciones: [
//     {
//       id: "validacion-ejemplo",
//       validar: ({ registro }) => Boolean(registro.Campo),
//       severidad: "advertencia",
//       mensaje: "Campo vacío"
//     }
//   ],
//   ordenar: true
// };
//
// Las funciones del archivo de reglas reciben un contexto con:
//   registro, valor, campo, filaOrigen, clave, utilidades y reglas.
//
// El archivo de entrada nunca se modifica.
// ============================================================

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const MODOS_JSON = new Set(["resumen", "cambios", "completo", "ninguno"]);
const NORMALIZADORES_INTEGRADOS = new Set([
    "fecha",
    "hora",
    "texto",
    "texto-minusculas",
    "numero",
    "booleano"
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
Motor genérico de depuración Excel

Uso:
  node scripts/depurar-base.js --entrada=<archivo.xlsx> --reglas=<reglas.js> [opciones]

Opciones:
  --entrada=<archivo.xlsx>   Archivo que se va a depurar
  --reglas=<archivo.js>      Módulo JavaScript con las reglas
  --salida=<archivo.xlsx>    Archivo depurado
  --reporte=<archivo.xlsx>   Reporte de trazabilidad
  --hoja=<nombre>            Sobrescribe el nombre de hoja configurado
  --json=resumen             JSON breve, predeterminado
  --json=cambios             Incluye cambios, eliminaciones y pendientes
  --json=completo            Incluye toda la información
  --json=ninguno             No imprime JSON
  --limite=<n>               Máximo por lista; 0 = sin límite
  --simular                  No escribe archivos
  --estricto                 Falla si quedan decisiones sin resolver
  --ayuda                    Muestra esta ayuda

Ejemplo:
  node scripts/depurar-base.js --entrada=datos.xlsx --reglas=scripts/reglas.js --json=cambios --limite=20
`);
}

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda === "true" || opciones.help === "true") {
    mostrarAyuda();
    process.exit(0);
}

if (!opciones.entrada || !opciones.reglas) {
    console.error("Debes indicar --entrada y --reglas.");
    mostrarAyuda();
    process.exit(1);
}

const modoJSON = String(opciones.json || "resumen").toLowerCase();

if (!MODOS_JSON.has(modoJSON)) {
    console.error(`Modo JSON inválido: ${modoJSON}`);
    process.exit(1);
}

const limiteJSON = Number(opciones.limite ?? "20");

if (!Number.isInteger(limiteJSON) || limiteJSON < 0) {
    console.error("--limite debe ser un entero mayor o igual a 0.");
    process.exit(1);
}

const simular = opciones.simular === "true";
const estricto = opciones.estricto === "true";
const archivoEntrada = path.resolve(process.cwd(), opciones.entrada);
const archivoReglas = path.resolve(process.cwd(), opciones.reglas);
const nombreBase = path.basename(archivoEntrada, path.extname(archivoEntrada));
const archivoSalida = path.resolve(
    process.cwd(),
    opciones.salida || `${nombreBase}-depurado.xlsx`
);
const archivoReporte = path.resolve(
    process.cwd(),
    opciones.reporte || `reporte-depuracion-${nombreBase}.xlsx`
);

function terminarConError(mensaje) {
    console.error(`ERROR: ${mensaje}`);
    process.exit(1);
}

function validarArchivos() {
    if (!fs.existsSync(archivoEntrada)) {
        terminarConError(`No existe el archivo de entrada: ${archivoEntrada}`);
    }

    if (path.extname(archivoEntrada).toLowerCase() !== ".xlsx") {
        terminarConError("El archivo de entrada debe tener extensión .xlsx.");
    }

    if (!fs.existsSync(archivoReglas)) {
        terminarConError(`No existe el archivo de reglas: ${archivoReglas}`);
    }

    const rutas = [archivoEntrada, archivoSalida, archivoReporte]
        .map(ruta => path.normalize(ruta).toLowerCase());

    if (new Set(rutas).size !== rutas.length) {
        terminarConError("Las rutas de entrada, salida y reporte deben ser diferentes.");
    }
}

validarArchivos();

let reglas;

try {
    delete require.cache[require.resolve(archivoReglas)];
    reglas = require(archivoReglas);
} catch (error) {
    terminarConError(`No se pudo cargar el archivo de reglas: ${error.message}`);
}

if (!reglas || typeof reglas !== "object" || Array.isArray(reglas)) {
    terminarConError("El archivo de reglas debe exportar un objeto.");
}

const nombreHoja = opciones.hoja || reglas.hoja || "Registros";
const camposClave = Array.isArray(reglas.clave) ? reglas.clave : [];

if (camposClave.length === 0) {
    terminarConError("reglas.clave debe ser un arreglo con al menos un campo.");
}

function esVacio(valor) {
    return valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function normalizarTexto(valor) {
    if (esVacio(valor)) return "";
    return String(valor).trim().replace(/\s+/g, " ");
}

function normalizarNumero(valor) {
    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : null;
    }

    if (typeof valor !== "string" || !valor.trim()) return null;

    const convertido = Number(valor.trim().replace(",", "."));
    return Number.isFinite(convertido) ? convertido : null;
}

function normalizarBooleano(valor) {
    if (typeof valor === "boolean") return valor;
    if (typeof valor === "number") return valor !== 0;

    const texto = normalizarTexto(valor).toLowerCase();

    if (["true", "sí", "si", "1", "verdadero"].includes(texto)) return true;
    if (["false", "no", "0", "falso"].includes(texto)) return false;
    return valor;
}

function normalizarFecha(valor) {
    if (esVacio(valor)) return "";

    if (valor instanceof Date) {
        return [
            valor.getFullYear(),
            String(valor.getMonth() + 1).padStart(2, "0"),
            String(valor.getDate()).padStart(2, "0")
        ].join("-");
    }

    if (typeof valor === "number") {
        const fechaExcel = XLSX.SSF.parse_date_code(valor);
        if (!fechaExcel) return "";

        return [
            fechaExcel.y,
            String(fechaExcel.m).padStart(2, "0"),
            String(fechaExcel.d).padStart(2, "0")
        ].join("-");
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

function convertirHoraDoceHoras(valor) {
    const coincidencia = String(valor).trim().match(
        /^(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*(am|pm)$/i
    );

    if (!coincidencia) return null;

    let horas = Number(coincidencia[1]);
    const minutos = Number(coincidencia[2]);
    const segundos = Number(coincidencia[3] || 0);
    const periodo = coincidencia[4].toLowerCase();

    if (horas < 1 || horas > 12 || minutos > 59 || segundos > 59) return null;
    if (periodo === "am" && horas === 12) horas = 0;
    if (periodo === "pm" && horas !== 12) horas += 12;

    return [horas, minutos, segundos]
        .map(numero => String(numero).padStart(2, "0"))
        .join(":");
}

function normalizarHora(valor) {
    if (esVacio(valor)) return "";

    if (valor instanceof Date) {
        return [valor.getHours(), valor.getMinutes(), valor.getSeconds()]
            .map(numero => String(numero).padStart(2, "0"))
            .join(":");
    }

    if (typeof valor === "number") {
        let segundos = Math.round((valor - Math.floor(valor)) * 86400);
        segundos = ((segundos % 86400) + 86400) % 86400;

        return [
            Math.floor(segundos / 3600),
            Math.floor((segundos % 3600) / 60),
            segundos % 60
        ].map(numero => String(numero).padStart(2, "0")).join(":");
    }

    const texto = String(valor).trim();
    const doceHoras = convertirHoraDoceHoras(texto);
    if (doceHoras) return doceHoras;

    const coincidencia = texto.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!coincidencia) return texto;

    return [
        coincidencia[1].padStart(2, "0"),
        coincidencia[2].padStart(2, "0"),
        String(coincidencia[3] || "0").padStart(2, "0")
    ].join(":");
}

function valorComparable(valor) {
    if (esVacio(valor)) return "V:";

    const numero = normalizarNumero(valor);
    if (numero !== null) return `N:${numero}`;

    if (typeof valor === "boolean") return `B:${valor}`;
    return `T:${normalizarTexto(valor).toLowerCase()}`;
}

function valoresEquivalentes(valorA, valorB) {
    return valorComparable(valorA) === valorComparable(valorB);
}

function valorParaSalida(valor) {
    if (valor === undefined) return null;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === "object" && valor !== null) return JSON.stringify(valor);
    return valor;
}

const utilidades = Object.freeze({
    esVacio,
    normalizarTexto,
    normalizarNumero,
    normalizarBooleano,
    normalizarFecha,
    normalizarHora,
    valoresEquivalentes,
    valorComparable
});

function aplicarNormalizadorConfigurado(nombre, valor, contexto) {
    if (typeof nombre === "function") {
        return nombre({ ...contexto, valor, utilidades, reglas });
    }

    if (!NORMALIZADORES_INTEGRADOS.has(nombre)) {
        terminarConError(`Normalizador desconocido: ${nombre}`);
    }

    switch (nombre) {
        case "fecha": return normalizarFecha(valor);
        case "hora": return normalizarHora(valor);
        case "texto": return normalizarTexto(valor);
        case "texto-minusculas": return normalizarTexto(valor).toLowerCase();
        case "numero": return normalizarNumero(valor);
        case "booleano": return normalizarBooleano(valor);
        default: return valor;
    }
}

function construirClave(registro) {
    if (typeof reglas.construirClave === "function") {
        return String(reglas.construirClave({ registro, utilidades, reglas }));
    }

    return camposClave
        .map(campo => valorComparable(registro[campo]))
        .join("|");
}

function firmaRegistro(registro, columnas) {
    return columnas
        .map(columna => `${columna}=${valorComparable(registro[columna])}`)
        .join("||");
}

function cumpleCondiciones(registro, condiciones) {
    if (typeof condiciones === "function") {
        return Boolean(condiciones({ registro, utilidades, reglas }));
    }

    return Object.entries(condiciones || {}).every(
        ([campo, valorEsperado]) => valoresEquivalentes(registro[campo], valorEsperado)
    );
}

function registrarCambio(lista, datos) {
    lista.push({
        Clave: datos.clave,
        FilaOrigen: datos.filaOrigen,
        Regla: datos.regla || null,
        Campo: datos.campo,
        ValorAnterior: valorParaSalida(datos.valorAnterior),
        ValorNuevo: valorParaSalida(datos.valorNuevo),
        Accion: datos.accion,
        Motivo: datos.motivo
    });
}

let libroEntrada;

try {
    libroEntrada = XLSX.readFile(archivoEntrada, {
        cellDates: false,
        cellNF: false,
        cellText: false
    });
} catch (error) {
    terminarConError(`No se pudo leer el Excel: ${error.message}`);
}

if (!libroEntrada.SheetNames.includes(nombreHoja)) {
    terminarConError(
        `No existe la hoja "${nombreHoja}". Hojas: ${libroEntrada.SheetNames.join(", ")}`
    );
}

const registrosOriginales = XLSX.utils.sheet_to_json(
    libroEntrada.Sheets[nombreHoja],
    { defval: null, raw: true }
);

const columnasOriginales = [
    ...new Set(registrosOriginales.flatMap(registro => Object.keys(registro)))
];
const columnasNuevas = reglas.columnasNuevas || {};
const columnasSalida = [
    ...columnasOriginales,
    ...Object.keys(columnasNuevas).filter(
        columna => !columnasOriginales.includes(columna)
    )
];

const items = registrosOriginales.map((registro, indice) => ({
    filaOrigen: indice + 2,
    registro: { ...registro }
}));

const cambios = [];
const eliminados = [];
const decisionesAplicadas = [];
const pendientesRevision = [];
const validaciones = [];

// ============================================================
// COLUMNAS NUEVAS
// ============================================================

for (const item of items) {
    for (const [campo, configuracion] of Object.entries(columnasNuevas)) {
        if (Object.prototype.hasOwnProperty.call(item.registro, campo)) continue;

        const valorNuevo = typeof configuracion === "function"
            ? configuracion({
                registro: item.registro,
                filaOrigen: item.filaOrigen,
                utilidades,
                reglas
            })
            : configuracion;

        item.registro[campo] = valorNuevo;
    }
}

// ============================================================
// NORMALIZADORES DECLARATIVOS
// ============================================================

for (const item of items) {
    for (const [campo, normalizador] of Object.entries(reglas.normalizadores || {})) {
        const valorAnterior = item.registro[campo];
        const claveAntes = construirClave(item.registro);
        const valorNuevo = aplicarNormalizadorConfigurado(
            normalizador,
            valorAnterior,
            {
                registro: item.registro,
                campo,
                filaOrigen: item.filaOrigen,
                clave: claveAntes
            }
        );

        if (!valoresEquivalentes(valorAnterior, valorNuevo)) {
            registrarCambio(cambios, {
                clave: claveAntes,
                filaOrigen: item.filaOrigen,
                regla: `normalizador:${campo}`,
                campo,
                valorAnterior,
                valorNuevo,
                accion: "NORMALIZAR",
                motivo: `Normalizador configurado para ${campo}`
            });
        }

        item.registro[campo] = valorNuevo;
    }
}

// ============================================================
// TRANSFORMACIONES ESPECÍFICAS EXTERNAS
// ============================================================

for (const transformacion of reglas.transformaciones || []) {
    if (!transformacion || typeof transformacion !== "object") continue;

    const campo = transformacion.campo;

    if (!campo || typeof transformacion.cuando !== "function") {
        terminarConError("Cada transformación requiere campo y función cuando.");
    }

    for (const item of items) {
        const clave = construirClave(item.registro);
        const valorAnterior = item.registro[campo];
        const contexto = {
            registro: item.registro,
            valor: valorAnterior,
            campo,
            filaOrigen: item.filaOrigen,
            clave,
            utilidades,
            reglas
        };

        let aplica;

        try {
            aplica = Boolean(transformacion.cuando(contexto));
        } catch (error) {
            terminarConError(
                `Falló la condición de transformación ${transformacion.id || campo}: ${error.message}`
            );
        }

        if (!aplica) continue;

        let valorNuevo;

        try {
            valorNuevo = typeof transformacion.transformar === "function"
                ? transformacion.transformar(contexto)
                : transformacion.nuevoValor;
        } catch (error) {
            terminarConError(
                `Falló la transformación ${transformacion.id || campo}: ${error.message}`
            );
        }

        item.registro[campo] = valorNuevo;

        registrarCambio(cambios, {
            clave,
            filaOrigen: item.filaOrigen,
            regla: transformacion.id || null,
            campo,
            valorAnterior,
            valorNuevo,
            accion: transformacion.accion || "TRANSFORMAR",
            motivo: transformacion.motivo || "Transformación configurada"
        });
    }
}

// ============================================================
// VALIDACIONES CONFIGURABLES
// ============================================================

for (const item of items) {
    const clave = construirClave(item.registro);

    for (const campo of reglas.camposObligatorios || []) {
        if (!esVacio(item.registro[campo])) continue;

        validaciones.push({
            Clave: clave,
            FilaOrigen: item.filaOrigen,
            Regla: `obligatorio:${campo}`,
            Severidad: "advertencia",
            Campo: campo,
            Mensaje: `El campo obligatorio ${campo} está vacío`,
            Valor: valorParaSalida(item.registro[campo])
        });
    }

    for (const validacion of reglas.validaciones || []) {
        if (typeof validacion.validar !== "function") {
            terminarConError("Cada validación requiere una función validar.");
        }

        let valido;

        try {
            valido = Boolean(validacion.validar({
                registro: item.registro,
                filaOrigen: item.filaOrigen,
                clave,
                utilidades,
                reglas
            }));
        } catch (error) {
            terminarConError(
                `Falló la validación ${validacion.id || "sin-id"}: ${error.message}`
            );
        }

        if (valido) continue;

        validaciones.push({
            Clave: clave,
            FilaOrigen: item.filaOrigen,
            Regla: validacion.id || null,
            Severidad: validacion.severidad || "advertencia",
            Campo: validacion.campo || null,
            Mensaje: typeof validacion.mensaje === "function"
                ? validacion.mensaje({
                    registro: item.registro,
                    filaOrigen: item.filaOrigen,
                    clave,
                    utilidades,
                    reglas
                })
                : validacion.mensaje || "Validación no superada",
            Valor: validacion.campo
                ? valorParaSalida(item.registro[validacion.campo])
                : null
        });
    }
}

// ============================================================
// DEPURACIÓN DE DUPLICADOS
// ============================================================

const grupos = new Map();

for (const item of items) {
    const clave = construirClave(item.registro);

    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(item);
}

const configuracionDuplicados = reglas.duplicados || {};
const eliminarExactos = configuracionDuplicados.eliminarExactos !== false;
const conservarExacto = configuracionDuplicados.conservarExacto || "primero";
const decisionesDuplicados = configuracionDuplicados.decisiones || {};
const columnasFirma = reglas.columnasComparacionDuplicados || columnasSalida;
const conservados = [];

for (const [clave, grupo] of grupos.entries()) {
    if (grupo.length === 1) {
        conservados.push(grupo[0]);
        continue;
    }

    const decision = decisionesDuplicados[clave];

    if (decision) {
        const candidatos = grupo.filter(item =>
            cumpleCondiciones(item.registro, decision.conservarCuando)
        );

        if (candidatos.length !== 1) {
            pendientesRevision.push({
                Clave: clave,
                Tipo: "DECISION_NO_RESUELTA",
                CantidadGrupo: grupo.length,
                CantidadCandidatos: candidatos.length,
                Filas: grupo.map(item => item.filaOrigen).join(", "),
                Motivo: decision.motivo || null
            });
            conservados.push(...grupo);
            continue;
        }

        const seleccionado = candidatos[0];
        conservados.push(seleccionado);

        decisionesAplicadas.push({
            Clave: clave,
            Tipo: "SELECCION_EXPLICITA",
            FilaConservada: seleccionado.filaOrigen,
            FilasEliminadas: grupo
                .filter(item => item !== seleccionado)
                .map(item => item.filaOrigen)
                .join(", "),
            Motivo: decision.motivo || "Decisión explícita"
        });

        for (const item of grupo) {
            if (item === seleccionado) continue;

            eliminados.push({
                Clave: clave,
                FilaOrigen: item.filaOrigen,
                Tipo: "DUPLICADO_DESCARTADO_POR_DECISION",
                FilaConservada: seleccionado.filaOrigen,
                Motivo: decision.motivo || "Decisión explícita",
                RegistroEliminado: JSON.stringify(item.registro),
                RegistroConservado: JSON.stringify(seleccionado.registro)
            });
        }

        continue;
    }

    const gruposPorFirma = new Map();

    for (const item of grupo) {
        const firma = firmaRegistro(item.registro, columnasFirma);
        if (!gruposPorFirma.has(firma)) gruposPorFirma.set(firma, []);
        gruposPorFirma.get(firma).push(item);
    }

    if (gruposPorFirma.size === 1 && eliminarExactos) {
        const seleccionado = conservarExacto === "ultimo"
            ? grupo[grupo.length - 1]
            : grupo[0];

        conservados.push(seleccionado);

        const descartados = grupo.filter(item => item !== seleccionado);

        decisionesAplicadas.push({
            Clave: clave,
            Tipo: "DUPLICADO_EXACTO",
            FilaConservada: seleccionado.filaOrigen,
            FilasEliminadas: descartados.map(item => item.filaOrigen).join(", "),
            Motivo: `Regla genérica: conservar ${conservarExacto}`
        });

        for (const item of descartados) {
            eliminados.push({
                Clave: clave,
                FilaOrigen: item.filaOrigen,
                Tipo: "DUPLICADO_EXACTO",
                FilaConservada: seleccionado.filaOrigen,
                Motivo: `Copia equivalente; se conserva ${conservarExacto}`,
                RegistroEliminado: JSON.stringify(item.registro),
                RegistroConservado: JSON.stringify(seleccionado.registro)
            });
        }

        continue;
    }

    pendientesRevision.push({
        Clave: clave,
        Tipo: gruposPorFirma.size === 1
            ? "DUPLICADO_EXACTO_NO_ELIMINADO"
            : "DUPLICADO_INCONSISTENTE_SIN_DECISION",
        CantidadGrupo: grupo.length,
        Filas: grupo.map(item => item.filaOrigen).join(", "),
        Recomendacion:
            "Agregar una decisión explícita al archivo de reglas o revisar manualmente"
    });

    conservados.push(...grupo);
}

if (estricto && pendientesRevision.length > 0) {
    console.error("Modo estricto: quedaron decisiones pendientes. No se escribieron archivos.");
    console.error(JSON.stringify(pendientesRevision, null, 2));
    process.exit(2);
}

// ============================================================
// ORDENAMIENTO
// ============================================================

function compararPorClave(itemA, itemB) {
    if (typeof reglas.comparador === "function") {
        return reglas.comparador({
            itemA,
            itemB,
            utilidades,
            reglas
        });
    }

    const claveA = construirClave(itemA.registro);
    const claveB = construirClave(itemB.registro);
    return claveA.localeCompare(claveB, "es", { numeric: true });
}

if (reglas.ordenar !== false) {
    conservados.sort((a, b) => {
        const resultado = compararPorClave(a, b);
        return resultado !== 0 ? resultado : a.filaOrigen - b.filaOrigen;
    });
}

const registrosDepurados = conservados.map(item => {
    const fila = {};

    for (const columna of columnasSalida) {
        fila[columna] = item.registro[columna] ?? null;
    }

    return fila;
});

const trazabilidad = conservados.map((item, indice) => ({
    FilaSalida: indice + 2,
    FilaOrigen: item.filaOrigen,
    Clave: construirClave(item.registro),
    Estado: "CONSERVADO"
}));

const cantidadEsperada = registrosOriginales.length - eliminados.length;

if (registrosDepurados.length !== cantidadEsperada) {
    terminarConError(
        `Falló control de integridad: esperados ${cantidadEsperada}, obtenidos ${registrosDepurados.length}`
    );
}

const gruposFinales = new Map();

for (const registro of registrosDepurados) {
    const clave = construirClave(registro);
    gruposFinales.set(clave, (gruposFinales.get(clave) || 0) + 1);
}

const duplicadosRestantes = [...gruposFinales.entries()]
    .filter(([, cantidad]) => cantidad > 1)
    .map(([clave, cantidad]) => ({ Clave: clave, Cantidad: cantidad }));

const resumen = {
    motor: "depurar-base.js",
    reglas: reglas.nombre || path.basename(archivoReglas),
    archivoEntrada: path.basename(archivoEntrada),
    hoja: nombreHoja,
    camposClave: camposClave.join(" + "),
    totalEntrada: registrosOriginales.length,
    totalSalida: registrosDepurados.length,
    filasEliminadas: eliminados.length,
    cambiosDeCampo: cambios.length,
    decisionesAplicadas: decisionesAplicadas.length,
    validacionesNoSuperadas: validaciones.length,
    pendientesRevision: pendientesRevision.length,
    duplicadosRestantes: duplicadosRestantes.length,
    columnasOriginales: columnasOriginales.length,
    columnasAgregadas: columnasSalida.length - columnasOriginales.length,
    modoSimulacion: simular,
    modoEstricto: estricto,
    formulaControl:
        `${registrosOriginales.length} entrada - ${eliminados.length} eliminadas = ${registrosDepurados.length} salida`
};

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
        let maximo = 10;

        for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
            const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
            if (celda) maximo = Math.max(maximo, String(celda.v ?? "").length);
        }

        hoja["!cols"].push({
            wch: Math.min(Math.max(maximo + 2, 12), 60)
        });
    }

    if (rango.e.r >= 1) hoja["!autofilter"] = { ref: hoja["!ref"] };
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
}

if (!simular) {
    const libroSalida = XLSX.utils.book_new();
    crearHoja(libroSalida, nombreHoja, registrosDepurados, columnasSalida);
    crearHoja(libroSalida, "Trazabilidad", trazabilidad);

    try {
        XLSX.writeFile(libroSalida, archivoSalida);
    } catch (error) {
        terminarConError(
            `No se pudo escribir la base depurada: ${error.message}. Verifica que no esté abierta.`
        );
    }

    const libroReporte = XLSX.utils.book_new();
    crearHoja(
        libroReporte,
        "Resumen",
        Object.entries(resumen).map(([Indicador, Valor]) => ({ Indicador, Valor }))
    );
    crearHoja(libroReporte, "Cambios", cambios);
    crearHoja(libroReporte, "Eliminados", eliminados);
    crearHoja(libroReporte, "Decisiones", decisionesAplicadas);
    crearHoja(libroReporte, "Validaciones", validaciones);
    crearHoja(libroReporte, "PendientesRevision", pendientesRevision);
    crearHoja(libroReporte, "DuplicadosRestantes", duplicadosRestantes);
    crearHoja(libroReporte, "Trazabilidad", trazabilidad);

    try {
        XLSX.writeFile(libroReporte, archivoReporte);
    } catch (error) {
        terminarConError(
            `No se pudo escribir el reporte: ${error.message}. Verifica que no esté abierto.`
        );
    }
}

const resultadoCompleto = {
    metadatos: {
        fechaEjecucionISO: new Date().toISOString(),
        archivoEntrada,
        archivoReglas,
        archivoSalida,
        archivoReporte,
        archivoOriginalModificado: false,
        modoSimulacion: simular,
        modoEstricto: estricto
    },
    resumen,
    configuracion: {
        nombre: reglas.nombre || null,
        version: reglas.version || null,
        hoja: nombreHoja,
        clave: camposClave,
        columnasNuevas: Object.keys(columnasNuevas),
        cantidadTransformaciones: (reglas.transformaciones || []).length,
        cantidadValidaciones: (reglas.validaciones || []).length,
        eliminarDuplicadosExactos: eliminarExactos,
        conservarDuplicadoExacto: conservarExacto,
        ordenar: reglas.ordenar !== false
    },
    resultados: {
        cambios,
        eliminados,
        decisionesAplicadas,
        validaciones,
        pendientesRevision,
        duplicadosRestantes,
        trazabilidad
    }
};

function limitarLista(lista, limite) {
    if (!Array.isArray(lista) || limite === 0 || lista.length <= limite) return lista;

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

function construirJSONConsola() {
    const base = {
        metadatos: resultadoCompleto.metadatos,
        configuracionConsola: {
            modoJSON,
            limitePorLista: limiteJSON,
            nota:
                "El límite solo afecta la consola; el reporte Excel contiene toda la información."
        },
        resumen,
        configuracion: resultadoCompleto.configuracion
    };

    if (modoJSON === "ninguno") return null;
    if (modoJSON === "resumen") return base;

    if (modoJSON === "cambios") {
        return limitarRecursivamente(
            { ...base, resultados: resultadoCompleto.resultados },
            limiteJSON
        );
    }

    return limitarRecursivamente(resultadoCompleto, limiteJSON);
}

console.log("\n============================================================");
console.log(" DEPURACIÓN GENÉRICA FINALIZADA");
console.log("============================================================");
console.log(`Reglas: ${reglas.nombre || archivoReglas}`);
console.log(`Entrada: ${archivoEntrada}`);
console.log(`Registros de entrada: ${registrosOriginales.length}`);
console.log(`Filas eliminadas: ${eliminados.length}`);
console.log(`Cambios: ${cambios.length}`);
console.log(`Validaciones no superadas: ${validaciones.length}`);
console.log(`Pendientes de revisión: ${pendientesRevision.length}`);
console.log(`Registros de salida: ${registrosDepurados.length}`);
console.log(`Duplicados restantes: ${duplicadosRestantes.length}`);
console.log(`Simulación: ${simular ? "Sí" : "No"}`);
console.log(`Estricto: ${estricto ? "Sí" : "No"}`);

if (!simular) {
    console.log(`Salida: ${archivoSalida}`);
    console.log(`Reporte: ${archivoReporte}`);
}

const jsonConsola = construirJSONConsola();

if (jsonConsola) {
    console.log("\n====================== INICIO JSON ==========================");
    console.log(JSON.stringify(jsonConsola, null, 2));
    console.log("======================= FIN JSON ============================");
} else {
    console.log("\nSalida JSON desactivada.");
}

console.log("\nEl archivo de entrada no fue modificado.\n");