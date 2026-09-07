"use strict";

// ============================================================
// GENERADOR DE REGLAS DE DEPURACION PARA UBIDOTS
// ============================================================
// Convierte una matriz aprobada y una clasificación de duplicados
// en un archivo JavaScript declarativo de reglas reproducibles.
// No modifica la matriz, la exportación, ni elimina registros.
//
// Uso:
// node scripts/generar-reglas-depuracion-ubidots.js \
//   --matriz=matriz-decision-duplicados-ubidots-aprobada.xlsx \
//   --clasificacion=clasificacion-duplicados-ubidots.json \
//   --validacion=validacion-matriz-ubidots.json \
//   --entrada=registros-ubidots.xlsx \
//   --salida=scripts/reglas-depuracion-ubidots-glp.js \
//   --manifiesto=manifiesto-reglas-depuracion-ubidots.json \
//   --estricto
//
// Códigos de salida:
// 0 correcto | 1 ejecución | 2 matriz/reglas no aprobables
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const DECISIONES = new Set([
    "CONSERVAR_UNA",
    "CONSERVAR_VARIAS",
    "CONSERVAR_TODAS",
    "COMBINAR",
    "CORREGIR_FECHA_HORA",
    "DESCARTAR_GRUPO"
]);

function args(argv) {
    const out = {};
    for (const arg of argv) {
        if (!arg.startsWith("--")) continue;
        const body = arg.slice(2);
        const i = body.indexOf("=");
        out[(i < 0 ? body : body.slice(0, i)).toLowerCase()] =
            i < 0 ? "true" : body.slice(i + 1);
    }
    return out;
}

function fail(message, code = 1) {
    console.error(`ERROR: ${message}`);
    process.exit(code);
}

function empty(value) {
    return value === null || value === undefined ||
        (typeof value === "string" && value.trim() === "");
}

function text(value) {
    return empty(value) ? "" : String(value).trim();
}

function enumValue(value) {
    return text(value).toUpperCase().replace(/\s+/g, "_");
}

function rows(value) {
    if (empty(value)) return [];
    const parsed = String(value).split(/[;,\s]+/).filter(Boolean).map(Number);
    if (parsed.some(n => !Number.isInteger(n) || n < 2)) {
        fail(`Lista de filas inválida: ${value}`, 2);
    }
    return [...new Set(parsed)];
}

function sha(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function fileSha(file) {
    return sha(fs.readFileSync(file));
}

function js(value) {
    return JSON.stringify(value, null, 4);
}

function validDate(value) {
    if (empty(value)) return null;
    if (typeof value === "number") {
        const d = XLSX.SSF.parse_date_code(value);
        if (!d) fail(`Fecha Excel inválida: ${value}`, 2);
        return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
    }
    const s = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`Fecha inválida: ${s}`, 2);
    return s;
}

function validTime(value) {
    if (empty(value)) return null;
    const s = text(value);
    if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(s)) {
        fail(`Hora inválida: ${s}`, 2);
    }
    return s;
}

const opt = args(process.argv.slice(2));
if (opt.ayuda === "true" || opt.help === "true") {
    console.log("Uso: node scripts/generar-reglas-depuracion-ubidots.js --matriz=<xlsx> --clasificacion=<json> --validacion=<json> --entrada=<xlsx> --salida=<js> [--manifiesto=<json>] [--estricto]");
    process.exit(0);
}

for (const required of ["matriz", "clasificacion", "validacion", "entrada", "salida"]) {
    if (!opt[required]) fail(`Falta --${required}`);
}

const files = Object.fromEntries(
    ["matriz", "clasificacion", "validacion", "entrada", "salida", "manifiesto"]
        .filter(k => opt[k])
        .map(k => [k, path.resolve(process.cwd(), opt[k])])
);

for (const key of ["matriz", "clasificacion", "validacion", "entrada"]) {
    if (!fs.existsSync(files[key])) fail(`No existe ${key}: ${files[key]}`);
}

const strict = opt.estricto === "true";
let classification;
let validation;
try {
    classification = JSON.parse(fs.readFileSync(files.clasificacion, "utf8"));
    validation = JSON.parse(fs.readFileSync(files.validacion, "utf8"));
} catch (error) {
    fail(`No se pudo leer JSON: ${error.message}`);
}

if (!validation.resumen?.AprobacionGlobal) {
    fail("La validación no tiene AprobacionGlobal=true.", 2);
}
if (validation.resumen?.Errores !== 0) {
    fail("La validación contiene errores.", 2);
}
if (strict && validation.resumen?.Advertencias !== 0) {
    fail("La validación contiene advertencias en modo estricto.", 2);
}
if (strict && validation.resumen?.ModoEstricto !== true) {
    fail("--estricto requiere una validación generada en modo estricto.", 2);
}
if (path.resolve(validation.metadatos?.matriz || "") !== files.matriz) {
    fail("La validación no corresponde a la matriz indicada.", 2);
}
if (path.resolve(validation.metadatos?.entrada || "") !== files.entrada) {
    fail("La validación no corresponde al Excel de entrada.", 2);
}
if (path.resolve(validation.metadatos?.clasificacion || "") !== files.clasificacion) {
    fail("La validación no corresponde a la clasificación indicada.", 2);
}

const workbook = XLSX.readFile(files.matriz, { cellDates: false });
const sheet = workbook.Sheets.MatrizDecisiones;
if (!sheet) fail('No existe la hoja "MatrizDecisiones".');
const matrix = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

const equivalent = classification.gruposEquivalentes;
const inconsistent = classification.gruposInconsistentes;
if (!Array.isArray(equivalent) || !Array.isArray(inconsistent)) {
    fail("La clasificación no contiene ambos tipos de grupos.", 2);
}
if (matrix.length !== inconsistent.length) {
    fail(`La matriz tiene ${matrix.length} decisiones y se esperaban ${inconsistent.length}.`, 2);
}

const sourceGroups = new Map(inconsistent.map(g => [g.Grupo, g]));
const seen = new Set();
const rulesInconsistent = [];

for (const row of matrix) {
    const group = text(row.Grupo);
    const decision = enumValue(row.Decision);
    const status = enumValue(row.EstadoRevision);
    const source = sourceGroups.get(group);

    if (!source || seen.has(group)) fail(`Grupo inválido o repetido: ${group}`, 2);
    seen.add(group);
    if (!DECISIONES.has(decision)) fail(`Decisión no ejecutable en ${group}: ${decision}`, 2);
    if (status !== "APROBADO") fail(`El grupo ${group} no está APROBADO.`, 2);

    const available = rows(row.FilasDisponibles);
    const keep = rows(row.FilasConservar);
    const discard = rows(row.FilasDescartar);
    const sourceRows = rows(source.Filas);

    if (js([...available].sort()) !== js([...sourceRows].sort())) {
        fail(`FilasDisponibles no coincide en ${group}.`, 2);
    }

    rulesInconsistent.push({
        grupo: group,
        claveFechaHora: text(row.ClaveFechaHora),
        decision,
        filasDisponibles: available,
        filasConservar: keep,
        filasDescartar: discard,
        filaBaseCombinacion: empty(row.FilaBaseCombinacion)
            ? null : Number(row.FilaBaseCombinacion),
        nuevaFecha: validDate(row.NuevaFecha),
        nuevaHora: validTime(row.NuevaHora),
        camposCombinarOCorregir: text(row.CamposCombinarOCorregir),
        justificacion: text(row.Justificacion),
        evidenciaAdicional: text(row.EvidenciaAdicional),
        responsableRevision: text(row.ResponsableRevision),
        fechaRevision: validDate(row.FechaRevision),
        estadoRevision: status
    });
}

for (const group of sourceGroups.keys()) {
    if (!seen.has(group)) fail(`Falta el grupo ${group} en la matriz.`, 2);
}

const rulesEquivalent = equivalent.map(group => {
    const available = rows(group.Filas);
    const ordered = [...available].sort((a, b) => a - b);
    return {
        grupo: group.Grupo,
        claveFechaHora: group.Clave,
        decision: "CONSERVAR_UNA",
        criterio: "PRIMER_ENVIO",
        filasDisponibles: ordered,
        filasConservar: [ordered[0]],
        filasDescartar: ordered.slice(1),
        justificacion: "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
    };
});

const discardsEquivalent = rulesEquivalent.flatMap(r => r.filasDescartar);
const discardsInconsistent = rulesInconsistent.flatMap(r => r.filasDescartar);
const allDiscards = [...new Set([...discardsEquivalent, ...discardsInconsistent])];
const duplicateDiscards = [...discardsEquivalent, ...discardsInconsistent]
    .filter((row, i, arr) => arr.indexOf(row) !== i);
if (duplicateDiscards.length) fail(`Filas descartadas repetidas: ${duplicateDiscards.join(", ")}`, 2);

const metadata = {
    version: "1.0.0",
    generadoISO: new Date().toISOString(),
    matriz: path.basename(files.matriz),
    clasificacion: path.basename(files.clasificacion),
    validacion: path.basename(files.validacion),
    entrada: path.basename(files.entrada),
    validacionEstrictaRequerida: strict,
    huellasSHA256: {
        matriz: fileSha(files.matriz),
        clasificacion: fileSha(files.clasificacion),
        validacion: fileSha(files.validacion),
        entrada: fileSha(files.entrada)
    }
};

const ruleObject = {
    metadatos: metadata,
    hojaEntrada: "Registros",
    clave: ["Fecha", "Hora"],
    politica: {
        noInferirDecisiones: true,
        noCorregirFueraDeRango: true,
        conservarColumnasTecnicas: true,
        gruposEquivalentes: "CONSERVAR_PRIMER_ENVIO",
        gruposInconsistentes: "APLICAR_MATRIZ_APROBADA"
    },
    gruposEquivalentes: rulesEquivalent,
    gruposInconsistentes: rulesInconsistent,
    resumen: {
        gruposEquivalentes: rulesEquivalent.length,
        filasDescartarEquivalentes: discardsEquivalent.length,
        gruposInconsistentes: rulesInconsistent.length,
        filasDescartarInconsistentes: discardsInconsistent.length,
        filasDescartarTotales: allDiscards.length
    }
};

const banner = `"use strict";\n\n// Archivo generado automáticamente. No editar manualmente.\n// Fuente: matriz aprobada y validación estricta.\n\nmodule.exports = ${js(ruleObject)};\n`;

fs.mkdirSync(path.dirname(files.salida), { recursive: true });
fs.writeFileSync(files.salida, banner, "utf8");

const manifesto = {
    metadatos: metadata,
    salidaReglas: files.salida,
    huellaReglasSHA256: fileSha(files.salida),
    resumen: ruleObject.resumen,
    decisionesInconsistentes: rulesInconsistent.map(r => ({
        grupo: r.grupo,
        decision: r.decision,
        conservar: r.filasConservar,
        descartar: r.filasDescartar,
        nuevaFecha: r.nuevaFecha,
        nuevaHora: r.nuevaHora
    }))
};

if (files.manifiesto) {
    fs.writeFileSync(files.manifiesto, JSON.stringify(manifesto, null, 2) + "\n", "utf8");
}

console.log("\n============================================================");
console.log(" REGLAS DE DEPURACION UBIDOTS GENERADAS");
console.log("============================================================");
console.log(`Grupos equivalentes: ${ruleObject.resumen.gruposEquivalentes}`);
console.log(`Descartes equivalentes: ${ruleObject.resumen.filasDescartarEquivalentes}`);
console.log(`Grupos inconsistentes: ${ruleObject.resumen.gruposInconsistentes}`);
console.log(`Descartes inconsistentes: ${ruleObject.resumen.filasDescartarInconsistentes}`);
console.log(`Descartes totales declarados: ${ruleObject.resumen.filasDescartarTotales}`);
console.log(`Salida: ${files.salida}`);
console.log(`SHA-256 reglas: ${manifesto.huellaReglasSHA256}`);
if (files.manifiesto) console.log(`Manifiesto: ${files.manifiesto}`);
console.log("\nNo se modificaron los archivos fuente ni se depuraron datos.\n");
