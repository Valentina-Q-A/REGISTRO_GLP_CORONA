"use strict";

// ============================================================
// CLASIFICADOR DE DUPLICADOS DE EXPORTACIONES UBIDOTS
// ============================================================
//
// Nombre recomendado:
//   scripts/clasificar-duplicados-ubidots.js
//
// Uso:
//   node scripts/clasificar-duplicados-ubidots.js \
//     --entrada=registros-ubidots.xlsx \
//     --reporte=reporte-clasificacion-duplicados-ubidots.xlsx \
//     --json=clasificacion-duplicados-ubidots.json \
//     --consola=resumen \
//     --limite=20
//
// Opciones:
//   --entrada=<xlsx>        Obligatorio
//   --hoja=<nombre>         Predeterminado: Registros
//   --reporte=<xlsx>        Predeterminado automático
//   --json=<json>           Predeterminado automático
//   --consola=resumen|completo|ninguno
//   --limite=<n>            0 = sin límite
//   --ayuda
//
// El script:
//   - No modifica el archivo de entrada.
//   - Agrupa por Fecha + Hora normalizadas.
//   - Ignora columnas técnicas al evaluar equivalencia operativa.
//   - Normaliza números, vacíos, espacios y mayúsculas/minúsculas.
//   - Clasifica grupos equivalentes e inconsistentes.
//   - No selecciona ni elimina automáticamente registros.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const COLUMNAS_TECNICAS_PREDETERMINADAS = [
    "TimestampUbidots",
    "FechaRecepcionUbidotsUTC",
    "FechaRecepcionUbidotsColombia",
    "DiferenciaRecepcionMinutos",
    "VariablesPresentes",
    "VariablesEsperadas",
    "ContextoCompletoJSON"
];

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
Clasificador de duplicados de Ubidots

Uso:
  node scripts/clasificar-duplicados-ubidots.js --entrada=<xlsx> [opciones]

Opciones:
  --hoja=<nombre>                    Predeterminado: Registros
  --reporte=<archivo.xlsx>           Reporte detallado
  --json=<archivo.json>              Resultado estructurado
  --consola=resumen|completo|ninguno
  --limite=<n>                       Máximo por lista; 0 = sin límite
  --ayuda
`);
}

function terminarConError(mensaje) {
    console.error(`ERROR: ${mensaje}`);
    process.exit(1);
}

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda === "true" || opciones.help === "true") {
    mostrarAyuda();
    process.exit(0);
}

if (!opciones.entrada) {
    mostrarAyuda();
    terminarConError("Debes indicar --entrada.");
}

const entrada = path.resolve(process.cwd(), opciones.entrada);

if (!fs.existsSync(entrada)) {
    terminarConError(`No existe el archivo de entrada: ${entrada}`);
}

const nombreBase = path.basename(entrada, path.extname(entrada));
const hojaNombre = opciones.hoja || "Registros";
const reporte = path.resolve(
    process.cwd(),
    opciones.reporte || `reporte-clasificacion-${nombreBase}.xlsx`
);
const archivoJSON = path.resolve(
    process.cwd(),
    opciones.json || `clasificacion-${nombreBase}.json`
);
const modoConsola = String(opciones.consola || "resumen").toLowerCase();
const limite = Number(opciones.limite ?? 20);

if (!["resumen", "completo", "ninguno"].includes(modoConsola)) {
    terminarConError("--consola debe ser resumen, completo o ninguno.");
}

if (!Number.isInteger(limite) || limite < 0) {
    terminarConError("--limite debe ser un entero mayor o igual a 0.");
}

if (
    path.normalize(entrada).toLowerCase() ===
        path.normalize(reporte).toLowerCase() ||
    path.normalize(entrada).toLowerCase() ===
        path.normalize(archivoJSON).toLowerCase()
) {
    terminarConError("Las salidas no pueden sobrescribir la entrada.");
}

function esVacio(valor) {
    return valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function normalizarFecha(valor) {
    if (esVacio(valor)) return "";

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

function normalizarHora(valor) {
    if (esVacio(valor)) return "";

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
    const coincidencia = texto.match(
        /^(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?$/
    );

    if (!coincidencia) return texto;

    return [
        coincidencia[1].padStart(2, "0"),
        coincidencia[2].padStart(2, "0"),
        String(coincidencia[3] || 0).padStart(2, "0")
    ].join(":");
}

function textoNormalizado(valor) {
    if (esVacio(valor)) return "";

    return String(valor)
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("es");
}

function numeroNormalizado(valor) {
    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : null;
    }

    if (typeof valor !== "string" || !valor.trim()) return null;

    const convertido = Number(valor.trim().replace(",", "."));
    return Number.isFinite(convertido) ? convertido : null;
}

function comparable(valor) {
    if (esVacio(valor)) return "VACIO";

    const numero = numeroNormalizado(valor);
    if (numero !== null) return `NUM:${numero}`;

    if (typeof valor === "boolean") return `BOOL:${valor}`;
    return `TXT:${textoNormalizado(valor)}`;
}

function valoresEquivalentes(valorA, valorB) {
    return comparable(valorA) === comparable(valorB);
}

function valorSalida(valor) {
    if (valor === undefined) return null;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === "object" && valor !== null) {
        return JSON.stringify(valor);
    }
    return valor;
}

function claveFechaHora(registro) {
    return `${normalizarFecha(registro.Fecha)}|${normalizarHora(registro.Hora)}`;
}

function firmaOperativa(registro, columnasOperativas) {
    return columnasOperativas
        .map(columna => `${columna}=${comparable(registro[columna])}`)
        .join("||");
}

function calcularDesfaseAbsoluto(registro) {
    const valor = numeroNormalizado(registro.DiferenciaRecepcionMinutos);
    return valor === null ? Number.POSITIVE_INFINITY : Math.abs(valor);
}

function timestampNumerico(registro) {
    const valor = numeroNormalizado(registro.TimestampUbidots);
    return valor === null ? Number.POSITIVE_INFINITY : valor;
}

let libro;

try {
    libro = XLSX.readFile(entrada, { cellDates: false });
} catch (error) {
    terminarConError(`No se pudo leer el Excel: ${error.message}`);
}

const hoja = libro.Sheets[hojaNombre];

if (!hoja) {
    terminarConError(`No existe la hoja "${hojaNombre}".`);
}

const registros = XLSX.utils.sheet_to_json(
    hoja,
    { defval: null, raw: true }
);

if (registros.length === 0) {
    terminarConError("La hoja de entrada no contiene registros.");
}

const columnas = [
    ...new Set(registros.flatMap(registro => Object.keys(registro)))
];
const columnasTecnicas = COLUMNAS_TECNICAS_PREDETERMINADAS.filter(
    columna => columnas.includes(columna)
);
const columnasOperativas = columnas.filter(
    columna => !columnasTecnicas.includes(columna)
);

for (const requerida of ["Fecha", "Hora"]) {
    if (!columnas.includes(requerida)) {
        terminarConError(`Falta la columna obligatoria ${requerida}.`);
    }
}

const items = registros.map((registro, indice) => ({
    fila: indice + 2,
    registro,
    clave: claveFechaHora(registro)
}));

const grupos = new Map();

for (const item of items) {
    if (!grupos.has(item.clave)) grupos.set(item.clave, []);
    grupos.get(item.clave).push(item);
}

const equivalentes = [];
const inconsistentes = [];
const filasEquivalentes = [];
const filasInconsistentes = [];
const diferenciasOperativas = [];
const candidatos = [];
const gruposNoDuplicados = [];
let numeroGrupo = 0;

for (const [clave, grupo] of grupos.entries()) {
    if (grupo.length < 2) {
        gruposNoDuplicados.push({
            Clave: clave,
            Fila: grupo[0].fila
        });
        continue;
    }

    numeroGrupo++;
    const grupoId = `DUP-${String(numeroGrupo).padStart(4, "0")}`;
    const firmas = new Map();

    for (const item of grupo) {
        const firma = firmaOperativa(item.registro, columnasOperativas);
        if (!firmas.has(firma)) firmas.set(firma, []);
        firmas.get(firma).push(item);
    }

    const esEquivalente = firmas.size === 1;
    const resumenGrupo = {
        Grupo: grupoId,
        Clave: clave,
        CantidadFilas: grupo.length,
        VersionesOperativas: firmas.size,
        Clasificacion: esEquivalente
            ? "EQUIVALENTE"
            : "INCONSISTENTE",
        Filas: grupo.map(item => item.fila).join(", "),
        Timestamps: grupo
            .map(item => valorSalida(item.registro.TimestampUbidots))
            .join(", ")
    };

    (esEquivalente ? equivalentes : inconsistentes).push(resumenGrupo);

    for (const item of grupo) {
        const filaDetalle = {
            Grupo: grupoId,
            Clave: clave,
            Clasificacion: resumenGrupo.Clasificacion,
            FilaOrigen: item.fila,
            TimestampUbidots: valorSalida(item.registro.TimestampUbidots),
            FechaRecepcionUbidotsColombia:
                valorSalida(item.registro.FechaRecepcionUbidotsColombia),
            DiferenciaRecepcionMinutos:
                valorSalida(item.registro.DiferenciaRecepcionMinutos),
            RegistroOperativoJSON: JSON.stringify(
                Object.fromEntries(
                    columnasOperativas.map(columna => [
                        columna,
                        item.registro[columna] ?? null
                    ])
                )
            )
        };

        (esEquivalente ? filasEquivalentes : filasInconsistentes)
            .push(filaDetalle);
    }

    if (!esEquivalente) {
        const referencia = grupo[0];

        for (const comparado of grupo.slice(1)) {
            for (const columna of columnasOperativas) {
                const valorReferencia = referencia.registro[columna];
                const valorComparado = comparado.registro[columna];

                if (!valoresEquivalentes(valorReferencia, valorComparado)) {
                    diferenciasOperativas.push({
                        Grupo: grupoId,
                        Clave: clave,
                        FilaReferencia: referencia.fila,
                        FilaComparada: comparado.fila,
                        Campo: columna,
                        ValorReferencia: valorSalida(valorReferencia),
                        ValorComparado: valorSalida(valorComparado),
                        ComparableReferencia: comparable(valorReferencia),
                        ComparableComparado: comparable(valorComparado)
                    });
                }
            }
        }
    }

    const ordenPrimerEnvio = [...grupo].sort(
        (a, b) => timestampNumerico(a.registro) - timestampNumerico(b.registro)
    );
    const ordenUltimoEnvio = [...ordenPrimerEnvio].reverse();
    const ordenMenorDesfase = [...grupo].sort((a, b) => {
        const diferencia =
            calcularDesfaseAbsoluto(a.registro) -
            calcularDesfaseAbsoluto(b.registro);

        return diferencia !== 0
            ? diferencia
            : timestampNumerico(a.registro) -
                timestampNumerico(b.registro);
    });

    candidatos.push({
        Grupo: grupoId,
        Clave: clave,
        Clasificacion: resumenGrupo.Clasificacion,
        CantidadFilas: grupo.length,
        CandidatoPrimerEnvio: ordenPrimerEnvio[0].fila,
        CandidatoUltimoEnvio: ordenUltimoEnvio[0].fila,
        CandidatoMenorDesfase: ordenMenorDesfase[0].fila,
        MenorDesfaseAbsolutoMinutos:
            calcularDesfaseAbsoluto(ordenMenorDesfase[0].registro),
        DecisionAutomaticaRecomendada: esEquivalente
            ? "CONSERVAR_PRIMER_ENVIO"
            : "REVISION_MANUAL",
        Motivo: esEquivalente
            ? "Todas las columnas operativas son equivalentes; solo cambian metadatos técnicos."
            : "Existen diferencias en una o más columnas operativas."
    });
}

const gruposDuplicados = equivalentes.length + inconsistentes.length;
const filasEnDuplicados = filasEquivalentes.length + filasInconsistentes.length;
const filasEliminablesEquivalentes = equivalentes.reduce(
    (suma, grupo) => suma + grupo.CantidadFilas - 1,
    0
);
const inconsistentesPorGrupo = new Map();

for (const diferencia of diferenciasOperativas) {
    if (!inconsistentesPorGrupo.has(diferencia.Grupo)) {
        inconsistentesPorGrupo.set(diferencia.Grupo, new Set());
    }
    inconsistentesPorGrupo.get(diferencia.Grupo).add(diferencia.Campo);
}

const resumenInconsistentes = inconsistentes.map(grupo => ({
    ...grupo,
    CantidadCamposDiferentes:
        inconsistentesPorGrupo.get(grupo.Grupo)?.size || 0,
    CamposDiferentes:
        [...(inconsistentesPorGrupo.get(grupo.Grupo) || [])].join(", ")
}));

const resumen = {
    ArchivoEntrada: path.basename(entrada),
    Hoja: hojaNombre,
    TotalRegistros: registros.length,
    ClavesFechaHoraUnicas: grupos.size,
    GruposDuplicados: gruposDuplicados,
    FilasEnGruposDuplicados: filasEnDuplicados,
    GruposEquivalentes: equivalentes.length,
    FilasEnGruposEquivalentes: filasEquivalentes.length,
    FilasEliminablesSinDecisionOperativa:
        filasEliminablesEquivalentes,
    GruposInconsistentes: inconsistentes.length,
    FilasEnGruposInconsistentes: filasInconsistentes.length,
    DiferenciasOperativas: diferenciasOperativas.length,
    ColumnasOperativasComparadas: columnasOperativas.length,
    ColumnasTecnicasIgnoradas: columnasTecnicas.length,
    DepuracionAplicada: false,
    ArchivoOriginalModificado: false
};

const metadatos = {
    fechaClasificacionISO: new Date().toISOString(),
    archivoEntrada: entrada,
    hoja: hojaNombre,
    reporte,
    archivoJSON,
    criterioAgrupacion: "Fecha + Hora normalizadas",
    criterioEquivalencia:
        "Comparación normalizada de columnas operativas, ignorando metadatos técnicos",
    columnasOperativas,
    columnasTecnicasIgnoradas: columnasTecnicas,
    soloLectura: true
};

const resultado = {
    metadatos,
    resumen,
    gruposEquivalentes: equivalentes,
    gruposInconsistentes: resumenInconsistentes,
    filasEquivalentes,
    filasInconsistentes,
    diferenciasOperativas,
    candidatosConservacion: candidatos
};

const contenidoCanonico = JSON.stringify(resultado, null, 2);
const huella = crypto
    .createHash("sha256")
    .update(contenidoCanonico)
    .digest("hex");

resultado.integridad = {
    algoritmo: "SHA-256",
    huellaContenidoSinIntegridad: huella
};

function crearHoja(libroSalida, nombre, datos) {
    const filas = datos.length ? datos : [{ Resultado: "Sin registros" }];
    const hojaSalida = XLSX.utils.json_to_sheet(filas);
    const rango = XLSX.utils.decode_range(hojaSalida["!ref"] || "A1:A1");
    hojaSalida["!cols"] = [];

    for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
        let ancho = 12;

        for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
            const celda = hojaSalida[
                XLSX.utils.encode_cell({ r: fila, c: columna })
            ];
            if (celda) {
                ancho = Math.max(ancho, String(celda.v ?? "").length + 2);
            }
        }

        hojaSalida["!cols"].push({ wch: Math.min(ancho, 60) });
    }

    if (rango.e.r >= 1) {
        hojaSalida["!autofilter"] = { ref: hojaSalida["!ref"] };
    }

    XLSX.utils.book_append_sheet(libroSalida, hojaSalida, nombre);
}

try {
    fs.writeFileSync(
        archivoJSON,
        JSON.stringify(resultado, null, 2) + "\n",
        "utf8"
    );
} catch (error) {
    terminarConError(`No se pudo escribir el JSON: ${error.message}`);
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
crearHoja(libroReporte, "GruposEquivalentes", equivalentes);
crearHoja(libroReporte, "FilasEquivalentes", filasEquivalentes);
crearHoja(libroReporte, "GruposInconsistentes", resumenInconsistentes);
crearHoja(libroReporte, "FilasInconsistentes", filasInconsistentes);
crearHoja(libroReporte, "DiferenciasOperativas", diferenciasOperativas);
crearHoja(libroReporte, "Candidatos", candidatos);
crearHoja(
    libroReporte,
    "ColumnasComparadas",
    [
        ...columnasOperativas.map(columna => ({
            Columna: columna,
            Tipo: "OPERATIVA_COMPARADA"
        })),
        ...columnasTecnicas.map(columna => ({
            Columna: columna,
            Tipo: "TECNICA_IGNORADA"
        }))
    ]
);

try {
    XLSX.writeFile(libroReporte, reporte);
} catch (error) {
    terminarConError(`No se pudo escribir el reporte: ${error.message}`);
}

function limitarLista(lista, maximo) {
    if (!Array.isArray(lista) || maximo === 0 || lista.length <= maximo) {
        return lista;
    }

    return {
        total: lista.length,
        mostrados: maximo,
        omitidos: lista.length - maximo,
        elementos: lista.slice(0, maximo)
    };
}

function limitarRecursivamente(valor, maximo) {
    if (Array.isArray(valor)) return limitarLista(valor, maximo);
    if (!valor || typeof valor !== "object") return valor;

    return Object.fromEntries(
        Object.entries(valor).map(([clave, contenido]) => [
            clave,
            limitarRecursivamente(contenido, maximo)
        ])
    );
}

console.log("\n============================================================");
console.log(" CLASIFICACIÓN DE DUPLICADOS UBIDOTS FINALIZADA");
console.log("============================================================");
console.log(`Registros analizados: ${resumen.TotalRegistros}`);
console.log(`Claves Fecha + Hora únicas: ${resumen.ClavesFechaHoraUnicas}`);
console.log(`Grupos duplicados: ${resumen.GruposDuplicados}`);
console.log(`Grupos equivalentes: ${resumen.GruposEquivalentes}`);
console.log(`Grupos inconsistentes: ${resumen.GruposInconsistentes}`);
console.log(
    `Filas eliminables sin decisión operativa: ` +
    `${resumen.FilasEliminablesSinDecisionOperativa}`
);
console.log(`Diferencias operativas: ${resumen.DiferenciasOperativas}`);
console.log(`Reporte: ${reporte}`);
console.log(`JSON: ${archivoJSON}`);
console.log(`Huella SHA-256: ${huella}`);

if (modoConsola !== "ninguno") {
    const salida = modoConsola === "completo"
        ? limitarRecursivamente(resultado, limite)
        : {
            metadatos,
            resumen,
            integridad: resultado.integridad,
            gruposInconsistentes: limitarLista(
                resumenInconsistentes,
                limite
            ),
            candidatosRevisionManual: limitarLista(
                candidatos.filter(
                    candidato =>
                        candidato.DecisionAutomaticaRecomendada ===
                        "REVISION_MANUAL"
                ),
                limite
            )
        };

    console.log("\n====================== INICIO JSON ==========================");
    console.log(JSON.stringify(salida, null, 2));
    console.log("======================= FIN JSON ============================");
}

console.log(
    "\nEl archivo de entrada no fue modificado. " +
    "No se eliminó ningún registro.\n"
);
