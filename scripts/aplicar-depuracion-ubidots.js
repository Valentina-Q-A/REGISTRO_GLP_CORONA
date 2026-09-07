"use strict";

// ============================================================
// APLICADOR ESPECIFICO DE DEPURACION UBIDOTS
// ============================================================
//
// Aplica reglas declarativas generadas desde una matriz aprobada.
// No modifica el archivo de entrada y nunca lee, escribe ni elimina
// ubidots-pending.json.
//
// Uso recomendado, simulacion:
//   node scripts/aplicar-depuracion-ubidots.js \
//     --entrada=registros-ubidots.xlsx \
//     --reglas=scripts/reglas-depuracion-ubidots-glp.js \
//     --salida=registros-ubidots-depurados.xlsx \
//     --reporte=reporte-depuracion-ubidots.xlsx \
//     --json=resultado-depuracion-ubidots.json \
//     --simular --estricto --consola=hallazgos --limite=20
//
// Ejecucion real: use el mismo comando sin --simular.
//
// Codigos de salida:
//   0 = correcto
//   1 = error de ejecucion o estructura
//   2 = controles de integridad no superados
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

function leerArgumentos(argv) {
    const opciones = {};
    for (const argumento of argv) {
        if (!argumento.startsWith("--")) continue;
        const cuerpo = argumento.slice(2);
        const posicion = cuerpo.indexOf("=");
        const clave = posicion === -1 ? cuerpo : cuerpo.slice(0, posicion);
        const valor = posicion === -1 ? "true" : cuerpo.slice(posicion + 1);
        opciones[clave.toLowerCase()] = valor;
    }
    return opciones;
}

function terminar(mensaje, codigo = 1) {
    console.error(`ERROR: ${mensaje}`);
    process.exit(codigo);
}

function esVacio(valor) {
    return valor === null || valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function texto(valor) {
    return esVacio(valor) ? "" : String(valor).trim();
}

function sha256Archivo(ruta) {
    return crypto.createHash("sha256").update(fs.readFileSync(ruta)).digest("hex");
}

function sha256Texto(valor) {
    return crypto.createHash("sha256").update(valor).digest("hex");
}

function enteroNoNegativo(valor, nombre) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 0) {
        terminar(`${nombre} debe ser un entero mayor o igual a 0.`);
    }
    return numero;
}

function normalizarFecha(valor) {
    if (esVacio(valor)) return "";
    if (typeof valor === "number") {
        const fecha = XLSX.SSF.parse_date_code(valor);
        if (!fecha) return texto(valor);
        return `${fecha.y}-${String(fecha.m).padStart(2, "0")}-${String(fecha.d).padStart(2, "0")}`;
    }
    const cadena = texto(valor);
    let m = cadena.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = cadena.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return cadena;
}

function normalizarHora(valor) {
    if (esVacio(valor)) return "";
    if (typeof valor === "number") {
        let segundos = Math.round((valor - Math.floor(valor)) * 86400);
        segundos = ((segundos % 86400) + 86400) % 86400;
        return [
            Math.floor(segundos / 3600),
            Math.floor((segundos % 3600) / 60),
            segundos % 60
        ].map(n => String(n).padStart(2, "0")).join(":");
    }
    const cadena = texto(valor);
    const m = cadena.match(/^(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?$/);
    if (!m) return cadena;
    return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}:${String(m[3] || 0).padStart(2, "0")}`;
}

function claveRegistro(registro) {
    return `${normalizarFecha(registro.Fecha)}|${normalizarHora(registro.Hora)}`;
}

function limitarLista(lista, limite) {
    if (!Array.isArray(lista) || limite === 0 || lista.length <= limite) return lista;
    return {
        total: lista.length,
        mostrados: limite,
        omitidos: lista.length - limite,
        elementos: lista.slice(0, limite)
    };
}

function crearHoja(libro, nombre, filas, encabezados = null) {
    const datos = filas.length ? filas : [{ Resultado: "Sin registros" }];
    const hoja = XLSX.utils.json_to_sheet(
        datos,
        encabezados ? { header: encabezados } : undefined
    );
    const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1:A1");
    hoja["!cols"] = [];
    for (let c = rango.s.c; c <= rango.e.c; c++) {
        let ancho = 12;
        for (let r = rango.s.r; r <= Math.min(rango.e.r, 400); r++) {
            const celda = hoja[XLSX.utils.encode_cell({ r, c })];
            if (celda) ancho = Math.max(ancho, String(celda.v ?? "").length + 2);
        }
        hoja["!cols"].push({ wch: Math.min(ancho, 75) });
    }
    hoja["!freeze"] = { xSplit: 0, ySplit: 1 };
    if (rango.e.r >= 1) hoja["!autofilter"] = { ref: hoja["!ref"] };
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
}

const opciones = leerArgumentos(process.argv.slice(2));
if (opciones.ayuda === "true" || opciones.help === "true") {
    console.log("Uso: node scripts/aplicar-depuracion-ubidots.js --entrada=<xlsx> --reglas=<js> --salida=<xlsx> --reporte=<xlsx> [--json=<json>] [--simular] [--estricto] [--consola=resumen|hallazgos|completo|ninguno] [--limite=20]");
    process.exit(0);
}

for (const requerida of ["entrada", "reglas", "salida", "reporte"]) {
    if (!opciones[requerida]) terminar(`Falta --${requerida}.`);
}

const entrada = path.resolve(process.cwd(), opciones.entrada);
const reglasRuta = path.resolve(process.cwd(), opciones.reglas);
const salida = path.resolve(process.cwd(), opciones.salida);
const reporte = path.resolve(process.cwd(), opciones.reporte);
const archivoJSON = opciones.json ? path.resolve(process.cwd(), opciones.json) : null;
const simular = opciones.simular === "true";
const estricto = opciones.estricto === "true";
const modoConsola = String(opciones.consola || "resumen").toLowerCase();
const limite = enteroNoNegativo(opciones.limite ?? 20, "--limite");

if (!["resumen", "hallazgos", "completo", "ninguno"].includes(modoConsola)) {
    terminar("--consola debe ser resumen, hallazgos, completo o ninguno.");
}

for (const ruta of [entrada, reglasRuta]) {
    if (!fs.existsSync(ruta)) terminar(`No existe el archivo: ${ruta}`);
}

const protegidos = [
    path.resolve(process.cwd(), "ubidots-pending.json"),
    path.resolve(process.cwd(), ".env")
].map(r => path.normalize(r).toLowerCase());
const rutasSalida = [salida, reporte, archivoJSON].filter(Boolean);
for (const ruta of rutasSalida) {
    const normalizada = path.normalize(ruta).toLowerCase();
    if (protegidos.includes(normalizada)) {
        terminar(`Ruta de salida protegida y prohibida: ${ruta}`);
    }
    if ([entrada, reglasRuta].map(r => path.normalize(r).toLowerCase()).includes(normalizada)) {
        terminar(`Una salida no puede sobrescribir una entrada: ${ruta}`);
    }
}
if (new Set(rutasSalida.map(r => path.normalize(r).toLowerCase())).size !== rutasSalida.length) {
    terminar("Las rutas de salida deben ser diferentes.");
}

let reglas;
try {
    delete require.cache[require.resolve(reglasRuta)];
    reglas = require(reglasRuta);
} catch (error) {
    terminar(`No se pudieron cargar las reglas: ${error.message}`);
}

if (!reglas || typeof reglas !== "object" || Array.isArray(reglas)) {
    terminar("El archivo de reglas debe exportar un objeto.");
}
if (!Array.isArray(reglas.gruposEquivalentes) || !Array.isArray(reglas.gruposInconsistentes)) {
    terminar("Las reglas no contienen gruposEquivalentes y gruposInconsistentes.");
}
if (reglas.politica?.noInferirDecisiones !== true) {
    terminar("Las reglas no declaran noInferirDecisiones=true.", 2);
}

const huellaEntradaActual = sha256Archivo(entrada);
const huellaEntradaEsperada = reglas.metadatos?.huellasSHA256?.entrada;
if (!huellaEntradaEsperada) terminar("Las reglas no contienen la huella de la entrada.", 2);
if (huellaEntradaActual !== huellaEntradaEsperada) {
    terminar(
        `La huella del Excel no coincide con las reglas. Esperada ${huellaEntradaEsperada}; actual ${huellaEntradaActual}.`,
        2
    );
}

let libroEntrada;
try {
    libroEntrada = XLSX.readFile(entrada, { cellDates: false });
} catch (error) {
    terminar(`No se pudo leer el Excel: ${error.message}`);
}
const hojaNombre = reglas.hojaEntrada || "Registros";
const hojaEntrada = libroEntrada.Sheets[hojaNombre];
if (!hojaEntrada) terminar(`No existe la hoja "${hojaNombre}".`);
const registros = XLSX.utils.sheet_to_json(hojaEntrada, { defval: null, raw: true });
if (!registros.length) terminar("El Excel no contiene registros.");

const columnas = [...new Set(registros.flatMap(registro => Object.keys(registro)))];
const porFila = new Map(
    registros.map((registro, indice) => [indice + 2, { filaOrigen: indice + 2, registro }])
);

const errores = [];
const trazabilidad = [];
const descartesDeclarados = new Map();
const conservacionesDeclaradas = new Map();
const todosGrupos = [
    ...reglas.gruposEquivalentes.map(g => ({ ...g, tipoGrupo: "EQUIVALENTE" })),
    ...reglas.gruposInconsistentes.map(g => ({ ...g, tipoGrupo: "INCONSISTENTE" }))
];

for (const grupo of todosGrupos) {
    const disponibles = Array.isArray(grupo.filasDisponibles) ? grupo.filasDisponibles : [];
    const conservar = Array.isArray(grupo.filasConservar) ? grupo.filasConservar : [];
    const descartar = Array.isArray(grupo.filasDescartar) ? grupo.filasDescartar : [];

    if (!grupo.grupo || !grupo.claveFechaHora) {
        errores.push({ Grupo: grupo.grupo || "", Regla: "estructura-grupo", Mensaje: "Falta grupo o claveFechaHora." });
        continue;
    }
    if (new Set([...conservar, ...descartar]).size !== disponibles.length) {
        errores.push({ Grupo: grupo.grupo, Regla: "cobertura-filtrado", Mensaje: "Conservar y descartar no cubren exactamente las filas disponibles." });
    }

    for (const fila of disponibles) {
        const item = porFila.get(fila);
        if (!item) {
            errores.push({ Grupo: grupo.grupo, Regla: "fila-no-existe", FilaOrigen: fila, Mensaje: "La fila declarada no existe." });
            continue;
        }
        const claveActual = claveRegistro(item.registro);
        if (claveActual !== grupo.claveFechaHora) {
            errores.push({ Grupo: grupo.grupo, Regla: "clave-no-coincide", FilaOrigen: fila, ClaveEsperada: grupo.claveFechaHora, ClaveActual: claveActual, Mensaje: "La fila no pertenece a la clave declarada." });
        }
    }

    for (const fila of conservar) {
        if (conservacionesDeclaradas.has(fila) || descartesDeclarados.has(fila)) {
            errores.push({ Grupo: grupo.grupo, Regla: "fila-repetida-entre-reglas", FilaOrigen: fila, Mensaje: "La fila ya fue declarada en otra regla." });
        }
        conservacionesDeclaradas.set(fila, grupo);
    }
    for (const fila of descartar) {
        if (descartesDeclarados.has(fila) || conservacionesDeclaradas.has(fila)) {
            errores.push({ Grupo: grupo.grupo, Regla: "fila-repetida-entre-reglas", FilaOrigen: fila, Mensaje: "La fila ya fue declarada en otra regla." });
        }
        descartesDeclarados.set(fila, grupo);
    }
}

const descartesEsperados = Number(reglas.resumen?.filasDescartarTotales);
if (!Number.isInteger(descartesEsperados) || descartesEsperados < 0) {
    errores.push({ Regla: "resumen-invalido", Mensaje: "filasDescartarTotales no es un entero válido." });
} else if (descartesDeclarados.size !== descartesEsperados) {
    errores.push({ Regla: "cantidad-descartes", Esperado: descartesEsperados, Actual: descartesDeclarados.size, Mensaje: "La cantidad única de descartes no coincide con el resumen." });
}

if (errores.length > 0) {
    console.error(JSON.stringify(errores.slice(0, limite || errores.length), null, 2));
    terminar(`No se superaron ${errores.length} controles previos. No se escribieron archivos.`, 2);
}

const registrosSalida = [];
for (const [filaOrigen, item] of porFila.entries()) {
    const reglaDescarte = descartesDeclarados.get(filaOrigen);
    if (reglaDescarte) {
        trazabilidad.push({
            Accion: "DESCARTAR",
            Grupo: reglaDescarte.grupo,
            TipoGrupo: reglaDescarte.tipoGrupo,
            ClaveFechaHora: reglaDescarte.claveFechaHora,
            FilaOrigen: filaOrigen,
            TimestampUbidots: item.registro.TimestampUbidots,
            Motivo: reglaDescarte.justificacion || "Descarte aprobado"
        });
        continue;
    }

    registrosSalida.push({ ...item.registro });
    const reglaConservar = conservacionesDeclaradas.get(filaOrigen);
    if (reglaConservar) {
        trazabilidad.push({
            Accion: "CONSERVAR",
            Grupo: reglaConservar.grupo,
            TipoGrupo: reglaConservar.tipoGrupo,
            ClaveFechaHora: reglaConservar.claveFechaHora,
            FilaOrigen: filaOrigen,
            TimestampUbidots: item.registro.TimestampUbidots,
            Motivo: reglaConservar.justificacion || "Conservación aprobada"
        });
    }
}

const gruposFinales = new Map();
registrosSalida.forEach((registro, indice) => {
    const clave = claveRegistro(registro);
    if (!gruposFinales.has(clave)) gruposFinales.set(clave, []);
    gruposFinales.get(clave).push(indice + 2);
});
const duplicadosRestantes = [...gruposFinales.entries()]
    .filter(([, filas]) => filas.length > 1)
    .map(([ClaveFechaHora, filas]) => ({
        ClaveFechaHora,
        Cantidad: filas.length,
        FilasSalida: filas.join(", ")
    }));

const salidaEsperada = registros.length - descartesDeclarados.size;
const controles = [
    { Control: "HuellaEntrada", Esperado: huellaEntradaEsperada, Actual: huellaEntradaActual, Superado: huellaEntradaActual === huellaEntradaEsperada },
    { Control: "DescartesDeclarados", Esperado: descartesEsperados, Actual: descartesDeclarados.size, Superado: descartesDeclarados.size === descartesEsperados },
    { Control: "TotalSalida", Esperado: salidaEsperada, Actual: registrosSalida.length, Superado: registrosSalida.length === salidaEsperada },
    { Control: "ClavesUnicasSalida", Esperado: registrosSalida.length, Actual: gruposFinales.size, Superado: gruposFinales.size === registrosSalida.length },
    { Control: "DuplicadosRestantes", Esperado: 0, Actual: duplicadosRestantes.length, Superado: duplicadosRestantes.length === 0 }
];
const controlesFallidos = controles.filter(control => !control.Superado);

if (estricto && controlesFallidos.length > 0) {
    console.error(JSON.stringify(controlesFallidos, null, 2));
    terminar("Modo estricto: fallaron controles posteriores. No se escribieron archivos.", 2);
}

const resumen = {
    archivoEntrada: path.basename(entrada),
    archivoReglas: path.basename(reglasRuta),
    totalEntrada: registros.length,
    filasDescartadas: descartesDeclarados.size,
    totalSalida: registrosSalida.length,
    clavesUnicasSalida: gruposFinales.size,
    duplicadosRestantes: duplicadosRestantes.length,
    gruposEquivalentesAplicados: reglas.gruposEquivalentes.length,
    gruposInconsistentesAplicados: reglas.gruposInconsistentes.length,
    controlesFallidos: controlesFallidos.length,
    modoSimulacion: simular,
    modoEstricto: estricto,
    formulaControl: `${registros.length} entrada - ${descartesDeclarados.size} eliminadas = ${registrosSalida.length} salida`
};

const resultadoBase = {
    metadatos: {
        fechaEjecucionISO: new Date().toISOString(),
        entrada,
        reglas: reglasRuta,
        salida,
        reporte,
        archivoJSON,
        archivoOriginalModificado: false,
        ubidotsPendingConsultadoOModificado: false
    },
    resumen,
    controles,
    duplicadosRestantes,
    trazabilidad
};
const huellaResultado = sha256Texto(JSON.stringify(resultadoBase, null, 2));
const resultado = {
    ...resultadoBase,
    integridad: {
        algoritmo: "SHA-256",
        huellaEntrada: huellaEntradaActual,
        huellaReglas: sha256Archivo(reglasRuta),
        huellaResultadoSinIntegridad: huellaResultado
    }
};

if (!simular) {
    const libroSalida = XLSX.utils.book_new();
    crearHoja(libroSalida, hojaNombre, registrosSalida, columnas);
    crearHoja(
        libroSalida,
        "Metadatos",
        Object.entries({
            ...resultado.metadatos,
            ...resultado.integridad,
            formulaControl: resumen.formulaControl
        }).map(([Campo, Valor]) => ({ Campo, Valor }))
    );
    try {
        XLSX.writeFile(libroSalida, salida);
    } catch (error) {
        terminar(`No se pudo escribir la salida: ${error.message}`);
    }

    const libroReporte = XLSX.utils.book_new();
    crearHoja(
        libroReporte,
        "Resumen",
        Object.entries(resumen).map(([Indicador, Valor]) => ({ Indicador, Valor }))
    );
    crearHoja(libroReporte, "Controles", controles);
    crearHoja(libroReporte, "Trazabilidad", trazabilidad);
    crearHoja(libroReporte, "DuplicadosRestantes", duplicadosRestantes);
    try {
        XLSX.writeFile(libroReporte, reporte);
    } catch (error) {
        terminar(`No se pudo escribir el reporte: ${error.message}`);
    }

    if (archivoJSON) {
        try {
            fs.writeFileSync(archivoJSON, JSON.stringify(resultado, null, 2) + "\n", "utf8");
        } catch (error) {
            terminar(`No se pudo escribir el JSON: ${error.message}`);
        }
    }
}

console.log("\n============================================================");
console.log(" DEPURACION ESPECIFICA UBIDOTS FINALIZADA");
console.log("============================================================");
console.log(`Registros de entrada: ${resumen.totalEntrada}`);
console.log(`Filas descartadas: ${resumen.filasDescartadas}`);
console.log(`Registros de salida: ${resumen.totalSalida}`);
console.log(`Claves unicas de salida: ${resumen.clavesUnicasSalida}`);
console.log(`Duplicados restantes: ${resumen.duplicadosRestantes}`);
console.log(`Controles fallidos: ${resumen.controlesFallidos}`);
console.log(`Simulacion: ${simular ? "Si" : "No"}`);
console.log(`Estricto: ${estricto ? "Si" : "No"}`);
if (!simular) {
    console.log(`Salida: ${salida}`);
    console.log(`Reporte: ${reporte}`);
    if (archivoJSON) console.log(`JSON: ${archivoJSON}`);
}

if (modoConsola !== "ninguno") {
    let consola;
    if (modoConsola === "resumen") {
        consola = { resumen, controles, integridad: resultado.integridad };
    } else if (modoConsola === "hallazgos") {
        consola = {
            resumen,
            controles,
            duplicadosRestantes: limitarLista(duplicadosRestantes, limite),
            trazabilidad: limitarLista(trazabilidad, limite),
            integridad: resultado.integridad
        };
    } else {
        consola = {
            ...resultado,
            trazabilidad: limitarLista(trazabilidad, limite)
        };
    }
    console.log("\n====================== INICIO JSON ==========================");
    console.log(JSON.stringify(consola, null, 2));
    console.log("======================= FIN JSON ============================");
}

console.log("\nEl Excel original no fue modificado. ubidots-pending.json no fue consultado ni modificado.\n");

process.exitCode = controlesFallidos.length > 0 ? 2 : 0;
