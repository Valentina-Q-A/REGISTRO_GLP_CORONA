"use strict";

// ============================================================
// GENERADOR DE MATRIZ DE DECISIONES PARA DUPLICADOS UBIDOTS
// ============================================================
//
// Nombre recomendado:
//   scripts/generar-matriz-duplicados-ubidots.js
//
// Propósito:
//   - Leer la exportación Excel de Ubidots.
//   - Leer la clasificación JSON de duplicados.
//   - Crear una matriz editable para grupos inconsistentes.
//   - Mostrar versiones y diferencias campo por campo.
//   - Proponer candidatos sin aplicar decisiones.
//   - No modificar ni depurar el archivo de entrada.
//
// Uso:
//   node scripts/generar-matriz-duplicados-ubidots.js \
//     --entrada=registros-ubidots.xlsx \
//     --clasificacion=clasificacion-duplicados-ubidots.json \
//     --salida=matriz-decision-duplicados-ubidots.xlsx \
//     --consola=resumen \
//     --limite=20
//
// Opciones:
//   --entrada=<xlsx>          Obligatorio
//   --clasificacion=<json>    Obligatorio
//   --salida=<xlsx>           Predeterminado automático
//   --hoja=<nombre>           Predeterminado: Registros
//   --consola=resumen|completo|ninguno
//   --limite=<n>              Máximo por lista; 0 = sin límite
//   --incluir-equivalentes    Incluye grupos equivalentes en hoja aparte
//   --ayuda
//
// Decisiones permitidas:
//   PENDIENTE
//   CONSERVAR_UNA
//   CONSERVAR_VARIAS
//   CONSERVAR_TODAS
//   COMBINAR
//   CORREGIR_FECHA_HORA
//   DESCARTAR_GRUPO
//
// El archivo generado es una herramienta de revisión. No ejecuta
// ninguna decisión ni modifica registros.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const DECISIONES = [
    "PENDIENTE",
    "CONSERVAR_UNA",
    "CONSERVAR_VARIAS",
    "CONSERVAR_TODAS",
    "COMBINAR",
    "CORREGIR_FECHA_HORA",
    "DESCARTAR_GRUPO"
];

const ESTADOS_REVISION = [
    "PENDIENTE",
    "EN_REVISION",
    "APROBADO",
    "RECHAZADO"
];

const COLUMNAS_TECNICAS = [
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
Generador de matriz de decisiones para duplicados Ubidots

Uso:
  node scripts/generar-matriz-duplicados-ubidots.js \\
    --entrada=registros-ubidots.xlsx \\
    --clasificacion=clasificacion-duplicados-ubidots.json \\
    --salida=matriz-decision-duplicados-ubidots.xlsx

Opciones:
  --hoja=<nombre>                    Predeterminado: Registros
  --consola=resumen|completo|ninguno
  --limite=<n>                       Máximo por lista; 0 = sin límite
  --incluir-equivalentes             Agrega grupos equivalentes
  --ayuda
`);
}

function terminarConError(mensaje, detalle = null) {
    console.error(`ERROR: ${mensaje}`);
    if (detalle) console.error(detalle);
    process.exit(1);
}

function enteroNoNegativo(valor, nombre) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 0) {
        terminarConError(`${nombre} debe ser un entero mayor o igual a 0.`);
    }

    return numero;
}

function esVacio(valor) {
    return valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function textoSeguro(valor) {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "object") return JSON.stringify(valor);
    return String(valor);
}

function valorComparable(valor) {
    if (esVacio(valor)) return "VACIO";

    if (typeof valor === "number" && Number.isFinite(valor)) {
        return `NUM:${valor}`;
    }

    const texto = String(valor).trim();
    const numero = Number(texto.replace(",", "."));

    if (texto !== "" && Number.isFinite(numero)) {
        return `NUM:${numero}`;
    }

    return `TXT:${texto
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("es")}`;
}

function fechaHoraClave(registro) {
    const fecha = textoSeguro(registro.Fecha).trim();
    let hora = textoSeguro(registro.Hora).trim();

    if (/^\d{1,2}:\d{1,2}$/.test(hora)) {
        hora += ":00";
    }

    return `${fecha}|${hora}`;
}

function timestampNumerico(registro) {
    const numero = Number(registro.TimestampUbidots);
    return Number.isFinite(numero) ? numero : Number.POSITIVE_INFINITY;
}

function desfaseAbsoluto(registro) {
    const numero = Number(registro.DiferenciaRecepcionMinutos);
    return Number.isFinite(numero)
        ? Math.abs(numero)
        : Number.POSITIVE_INFINITY;
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

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda === "true" || opciones.help === "true") {
    mostrarAyuda();
    process.exit(0);
}

if (!opciones.entrada || !opciones.clasificacion) {
    mostrarAyuda();
    terminarConError("Debes indicar --entrada y --clasificacion.");
}

const entrada = path.resolve(process.cwd(), opciones.entrada);
const archivoClasificacion = path.resolve(
    process.cwd(),
    opciones.clasificacion
);
const salida = path.resolve(
    process.cwd(),
    opciones.salida || "matriz-decision-duplicados-ubidots.xlsx"
);
const hojaNombre = opciones.hoja || "Registros";
const modoConsola = String(opciones.consola || "resumen").toLowerCase();
const limite = enteroNoNegativo(opciones.limite ?? 20, "--limite");
const incluirEquivalentes = opciones["incluir-equivalentes"] === "true";

if (!["resumen", "completo", "ninguno"].includes(modoConsola)) {
    terminarConError("--consola debe ser resumen, completo o ninguno.");
}

for (const archivo of [entrada, archivoClasificacion]) {
    if (!fs.existsSync(archivo)) {
        terminarConError(`No existe el archivo: ${archivo}`);
    }
}

if (
    path.normalize(salida).toLowerCase() ===
    path.normalize(entrada).toLowerCase()
) {
    terminarConError("La salida no puede sobrescribir el Excel de entrada.");
}

let clasificacion;

try {
    clasificacion = JSON.parse(
        fs.readFileSync(archivoClasificacion, "utf8")
    );
} catch (error) {
    terminarConError(
        "No se pudo leer la clasificación JSON.",
        error.message
    );
}

if (!Array.isArray(clasificacion.gruposInconsistentes)) {
    terminarConError(
        "El JSON no contiene gruposInconsistentes como arreglo."
    );
}

let libroEntrada;

try {
    libroEntrada = XLSX.readFile(entrada, { cellDates: false });
} catch (error) {
    terminarConError("No se pudo leer el Excel.", error.message);
}

const hojaEntrada = libroEntrada.Sheets[hojaNombre];

if (!hojaEntrada) {
    terminarConError(`No existe la hoja "${hojaNombre}".`);
}

const registros = XLSX.utils.sheet_to_json(
    hojaEntrada,
    { defval: null, raw: true }
);

if (registros.length === 0) {
    terminarConError("El Excel no contiene registros.");
}

const columnas = [
    ...new Set(registros.flatMap(registro => Object.keys(registro)))
];
const columnasTecnicasPresentes = COLUMNAS_TECNICAS.filter(
    columna => columnas.includes(columna)
);
const columnasOperativas = columnas.filter(
    columna => !columnasTecnicasPresentes.includes(columna)
);

const porFila = new Map(
    registros.map((registro, indice) => [indice + 2, registro])
);
const porClave = new Map();

registros.forEach((registro, indice) => {
    const clave = fechaHoraClave(registro);

    if (!porClave.has(clave)) porClave.set(clave, []);

    porClave.get(clave).push({
        fila: indice + 2,
        registro
    });
});

const detalleVersiones = [];
const comparacionLadoALado = [];
const matrizDecisiones = [];
const diferencias = [];
const inconsistenciasEstructura = [];

for (const grupoClasificado of clasificacion.gruposInconsistentes) {
    const grupoId = grupoClasificado.Grupo;
    const clave = grupoClasificado.Clave;
    const filasDeclaradas = textoSeguro(grupoClasificado.Filas)
        .split(",")
        .map(valor => Number(valor.trim()))
        .filter(Number.isInteger);

    let versiones = filasDeclaradas
        .map(fila => ({ fila, registro: porFila.get(fila) }))
        .filter(item => item.registro);

    if (versiones.length !== filasDeclaradas.length) {
        inconsistenciasEstructura.push({
            Grupo: grupoId,
            Clave: clave,
            FilasDeclaradas: filasDeclaradas.join(", "),
            FilasEncontradas: versiones.map(item => item.fila).join(", "),
            Mensaje: "Una o más filas declaradas no existen en el Excel."
        });
    }

    if (versiones.length === 0) {
        versiones = porClave.get(clave) || [];
    }

    versiones.sort(
        (a, b) => timestampNumerico(a.registro) - timestampNumerico(b.registro)
    );

    if (versiones.length === 0) {
        inconsistenciasEstructura.push({
            Grupo: grupoId,
            Clave: clave,
            FilasDeclaradas: filasDeclaradas.join(", "),
            FilasEncontradas: "",
            Mensaje: "No fue posible encontrar versiones para este grupo."
        });
        continue;
    }

    const referencia = versiones[0];
    const camposDiferentes = new Set();

    for (const comparada of versiones.slice(1)) {
        for (const campo of columnasOperativas) {
            const valorReferencia = referencia.registro[campo];
            const valorComparado = comparada.registro[campo];

            if (
                valorComparable(valorReferencia) !==
                valorComparable(valorComparado)
            ) {
                camposDiferentes.add(campo);
                diferencias.push({
                    Grupo: grupoId,
                    Clave: clave,
                    FilaReferencia: referencia.fila,
                    FilaComparada: comparada.fila,
                    Campo: campo,
                    ValorReferencia: valorReferencia,
                    ValorComparado: valorComparado
                });
            }
        }
    }

    const porMenorDesfase = [...versiones].sort((a, b) => {
        const diferencia =
            desfaseAbsoluto(a.registro) -
            desfaseAbsoluto(b.registro);

        return diferencia !== 0
            ? diferencia
            : timestampNumerico(a.registro) -
                timestampNumerico(b.registro);
    });

    const filaPrimerEnvio = versiones[0].fila;
    const filaUltimoEnvio = versiones.at(-1).fila;
    const filaMenorDesfase = porMenorDesfase[0].fila;

    matrizDecisiones.push({
        Grupo: grupoId,
        ClaveFechaHora: clave,
        CantidadVersiones: versiones.length,
        FilasDisponibles: versiones.map(item => item.fila).join(", "),
        CantidadCamposDiferentes: camposDiferentes.size,
        CamposDiferentes: [...camposDiferentes].join(", "),
        CandidatoPrimerEnvio: filaPrimerEnvio,
        CandidatoUltimoEnvio: filaUltimoEnvio,
        CandidatoMenorDesfase: filaMenorDesfase,
        MenorDesfaseAbsolutoMinutos:
            desfaseAbsoluto(porMenorDesfase[0].registro),
        Decision: "PENDIENTE",
        FilasConservar: "",
        FilasDescartar: "",
        FilaBaseCombinacion: "",
        NuevaFecha: "",
        NuevaHora: "",
        CamposCombinarOCorregir: "",
        Justificacion: "",
        EvidenciaAdicional: "",
        ResponsableRevision: "",
        FechaRevision: "",
        EstadoRevision: "PENDIENTE"
    });

    versiones.forEach((item, indice) => {
        const filaDetalle = {
            Grupo: grupoId,
            ClaveFechaHora: clave,
            Version: indice + 1,
            FilaOrigen: item.fila,
            EsPrimerEnvio: item.fila === filaPrimerEnvio ? "SI" : "NO",
            EsUltimoEnvio: item.fila === filaUltimoEnvio ? "SI" : "NO",
            EsMenorDesfase: item.fila === filaMenorDesfase ? "SI" : "NO",
            TimestampUbidots: item.registro.TimestampUbidots,
            FechaRecepcionUbidotsUTC:
                item.registro.FechaRecepcionUbidotsUTC,
            FechaRecepcionUbidotsColombia:
                item.registro.FechaRecepcionUbidotsColombia,
            DiferenciaRecepcionMinutos:
                item.registro.DiferenciaRecepcionMinutos,
            CamposDiferentesGrupo: [...camposDiferentes].join(", ")
        };

        for (const columna of columnasOperativas) {
            filaDetalle[columna] = item.registro[columna];
        }

        detalleVersiones.push(filaDetalle);
    });

    for (const campo of columnasOperativas) {
        const comparativa = {
            Grupo: grupoId,
            ClaveFechaHora: clave,
            Campo: campo,
            EsDiferente: camposDiferentes.has(campo) ? "SI" : "NO"
        };

        versiones.forEach((item, indice) => {
            comparativa[`FilaVersion${indice + 1}`] = item.fila;
            comparativa[`ValorVersion${indice + 1}`] =
                item.registro[campo];
        });

        comparacionLadoALado.push(comparativa);
    }
}

const gruposEquivalentes = Array.isArray(
    clasificacion.gruposEquivalentes
)
    ? clasificacion.gruposEquivalentes
    : [];

const resumen = {
    ArchivoEntrada: path.basename(entrada),
    ArchivoClasificacion: path.basename(archivoClasificacion),
    HojaEntrada: hojaNombre,
    RegistrosEntrada: registros.length,
    GruposInconsistentesIncluidos: matrizDecisiones.length,
    VersionesInconsistentesIncluidas: detalleVersiones.length,
    DiferenciasOperativasIncluidas: diferencias.length,
    ColumnasOperativas: columnasOperativas.length,
    ColumnasTecnicas: columnasTecnicasPresentes.length,
    GruposEquivalentesDisponibles: gruposEquivalentes.length,
    GruposEquivalentesIncluidos: incluirEquivalentes
        ? gruposEquivalentes.length
        : 0,
    DecisionesPendientes: matrizDecisiones.filter(
        fila => fila.Decision === "PENDIENTE"
    ).length,
    ArchivoOriginalModificado: false
};

const instrucciones = [
    {
        Paso: 1,
        Instruccion:
            "Revise la hoja MatrizDecisiones. Cada fila representa un grupo inconsistente."
    },
    {
        Paso: 2,
        Instruccion:
            "Consulte DetalleVersiones para ver todos los valores de cada envío."
    },
    {
        Paso: 3,
        Instruccion:
            "Use ComparacionCampos para revisar los valores lado a lado por campo."
    },
    {
        Paso: 4,
        Instruccion:
            "Seleccione una Decision de la lista permitida. No deje decisiones ambiguas."
    },
    {
        Paso: 5,
        Instruccion:
            "Indique FilasConservar y FilasDescartar usando números separados por comas."
    },
    {
        Paso: 6,
        Instruccion:
            "Si corrige Fecha u Hora, complete NuevaFecha en YYYY-MM-DD y NuevaHora en HH:MM:SS."
    },
    {
        Paso: 7,
        Instruccion:
            "Toda decisión distinta de PENDIENTE debe tener Justificacion."
    },
    {
        Paso: 8,
        Instruccion:
            "Cambie EstadoRevision a APROBADO solo después de validar evidencia y coherencia operacional."
    },
    {
        Paso: 9,
        Instruccion:
            "La matriz no modifica datos. Las decisiones se convertirán después en reglas de depuración."
    }
];

const catalogoDecisiones = [
    {
        Decision: "PENDIENTE",
        Descripcion: "Aún no existe una decisión aprobada."
    },
    {
        Decision: "CONSERVAR_UNA",
        Descripcion: "Conservar una versión y descartar las demás."
    },
    {
        Decision: "CONSERVAR_VARIAS",
        Descripcion: "Conservar varias versiones porque representan eventos distintos."
    },
    {
        Decision: "CONSERVAR_TODAS",
        Descripcion: "Conservar todas las versiones sin combinar."
    },
    {
        Decision: "COMBINAR",
        Descripcion: "Crear un registro consolidado tomando valores de varias versiones."
    },
    {
        Decision: "CORREGIR_FECHA_HORA",
        Descripcion: "Conservar registros modificando Fecha y/o Hora con evidencia."
    },
    {
        Decision: "DESCARTAR_GRUPO",
        Descripcion: "Excluir todas las versiones con una justificación explícita."
    }
];

function crearHojaDesdeJSON(filas, encabezados = null) {
    const datos = filas.length ? filas : [{ Resultado: "Sin registros" }];

    return XLSX.utils.json_to_sheet(
        datos,
        encabezados ? { header: encabezados } : undefined
    );
}

function ajustarHoja(hoja, opcionesHoja = {}) {
    const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1:A1");
    const anchosMaximos = opcionesHoja.anchosMaximos || {};
    const anchoPredeterminado = opcionesHoja.anchoPredeterminado || 18;
    hoja["!cols"] = [];

    for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
        const encabezado = hoja[
            XLSX.utils.encode_cell({ r: 0, c: columna })
        ]?.v;
        let ancho = Math.max(
            anchoPredeterminado,
            String(encabezado || "").length + 2
        );

        for (
            let fila = rango.s.r;
            fila <= Math.min(rango.e.r, 200);
            fila++
        ) {
            const celda = hoja[
                XLSX.utils.encode_cell({ r: fila, c: columna })
            ];

            if (celda) {
                ancho = Math.max(
                    ancho,
                    String(celda.v ?? "").length + 2
                );
            }
        }

        const maximo = anchosMaximos[encabezado] || 45;
        hoja["!cols"].push({ wch: Math.min(ancho, maximo) });
    }

    hoja["!freeze"] = { xSplit: 0, ySplit: 1 };

    if (rango.e.r >= 1) {
        hoja["!autofilter"] = { ref: hoja["!ref"] };
    }
}

function agregarValidacionesMatriz(hoja, cantidadFilas) {
    if (cantidadFilas === 0) return;

    const encabezados = XLSX.utils.sheet_to_json(
        hoja,
        { header: 1, range: 0, blankrows: false }
    )[0];

    const indiceDecision = encabezados.indexOf("Decision");
    const indiceEstado = encabezados.indexOf("EstadoRevision");
    const ultimaFilaExcel = cantidadFilas + 1;

    hoja["!dataValidation"] = [];

    if (indiceDecision >= 0) {
        const letra = XLSX.utils.encode_col(indiceDecision);
        hoja["!dataValidation"].push({
            sqref: `${letra}2:${letra}${ultimaFilaExcel}`,
            type: "list",
            allowBlank: false,
            formula1: `"${DECISIONES.join(",")}"`,
            showErrorMessage: true,
            errorTitle: "Decisión no válida",
            error: "Seleccione una decisión de la lista."
        });
    }

    if (indiceEstado >= 0) {
        const letra = XLSX.utils.encode_col(indiceEstado);
        hoja["!dataValidation"].push({
            sqref: `${letra}2:${letra}${ultimaFilaExcel}`,
            type: "list",
            allowBlank: false,
            formula1: `"${ESTADOS_REVISION.join(",")}"`,
            showErrorMessage: true,
            errorTitle: "Estado no válido",
            error: "Seleccione un estado de la lista."
        });
    }
}

const libroSalida = XLSX.utils.book_new();

const hojaInstrucciones = crearHojaDesdeJSON(instrucciones);
ajustarHoja(hojaInstrucciones, {
    anchosMaximos: { Instruccion: 100 }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaInstrucciones,
    "Instrucciones"
);

const hojaResumen = crearHojaDesdeJSON(
    Object.entries(resumen).map(([Indicador, Valor]) => ({
        Indicador,
        Valor
    }))
);
ajustarHoja(hojaResumen);
XLSX.utils.book_append_sheet(libroSalida, hojaResumen, "Resumen");

const hojaMatriz = crearHojaDesdeJSON(matrizDecisiones);
ajustarHoja(hojaMatriz, {
    anchosMaximos: {
        CamposDiferentes: 70,
        Justificacion: 90,
        EvidenciaAdicional: 90,
        CamposCombinarOCorregir: 70
    }
});
agregarValidacionesMatriz(hojaMatriz, matrizDecisiones.length);
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaMatriz,
    "MatrizDecisiones"
);

const hojaDetalle = crearHojaDesdeJSON(detalleVersiones);
ajustarHoja(hojaDetalle, {
    anchosMaximos: {
        CamposDiferentesGrupo: 70,
        Observaciones: 90,
        Encargado: 50,
        ContextoCompletoJSON: 80
    }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaDetalle,
    "DetalleVersiones"
);

const hojaComparacion = crearHojaDesdeJSON(comparacionLadoALado);
ajustarHoja(hojaComparacion, {
    anchosMaximos: {
        ValorVersion1: 70,
        ValorVersion2: 70,
        ValorVersion3: 70,
        ValorVersion4: 70
    }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaComparacion,
    "ComparacionCampos"
);

const hojaDiferencias = crearHojaDesdeJSON(diferencias);
ajustarHoja(hojaDiferencias, {
    anchosMaximos: {
        ValorReferencia: 70,
        ValorComparado: 70
    }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaDiferencias,
    "Diferencias"
);

const hojaCatalogo = crearHojaDesdeJSON(catalogoDecisiones);
ajustarHoja(hojaCatalogo, {
    anchosMaximos: { Descripcion: 90 }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaCatalogo,
    "CatalogoDecisiones"
);

if (incluirEquivalentes) {
    const hojaEquivalentes = crearHojaDesdeJSON(gruposEquivalentes);
    ajustarHoja(hojaEquivalentes);
    XLSX.utils.book_append_sheet(
        libroSalida,
        hojaEquivalentes,
        "GruposEquivalentes"
    );
}

const hojaColumnas = crearHojaDesdeJSON([
    ...columnasOperativas.map(columna => ({
        Columna: columna,
        Tipo: "OPERATIVA"
    })),
    ...columnasTecnicasPresentes.map(columna => ({
        Columna: columna,
        Tipo: "TECNICA"
    }))
]);
ajustarHoja(hojaColumnas);
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaColumnas,
    "Columnas"
);

if (inconsistenciasEstructura.length > 0) {
    const hojaErrores = crearHojaDesdeJSON(inconsistenciasEstructura);
    ajustarHoja(hojaErrores, {
        anchosMaximos: { Mensaje: 90 }
    });
    XLSX.utils.book_append_sheet(
        libroSalida,
        hojaErrores,
        "AlertasEstructura"
    );
}

const metadatos = {
    fechaGeneracionISO: new Date().toISOString(),
    archivoEntrada: entrada,
    archivoClasificacion,
    archivoSalida: salida,
    hojaEntrada: hojaNombre,
    soloLectura: true,
    decisionesAplicadas: false,
    gruposInconsistentes: matrizDecisiones.length,
    versionesIncluidas: detalleVersiones.length
};

const contenidoHuella = JSON.stringify({
    metadatos,
    resumen,
    matrizDecisiones,
    detalleVersiones,
    diferencias
});
const huella = crypto
    .createHash("sha256")
    .update(contenidoHuella)
    .digest("hex");

const hojaMetadatos = crearHojaDesdeJSON(
    Object.entries({
        ...metadatos,
        HuellaSHA256: huella
    }).map(([Campo, Valor]) => ({ Campo, Valor }))
);
ajustarHoja(hojaMetadatos, {
    anchosMaximos: { Valor: 100 }
});
XLSX.utils.book_append_sheet(
    libroSalida,
    hojaMetadatos,
    "Metadatos"
);

try {
    XLSX.writeFile(libroSalida, salida);
} catch (error) {
    terminarConError(
        "No se pudo escribir la matriz Excel.",
        error.message
    );
}

const salidaConsola = {
    metadatos,
    resumen,
    integridad: {
        algoritmo: "SHA-256",
        huellaContenidoMatriz: huella
    },
    grupos: matrizDecisiones.map(fila => ({
        Grupo: fila.Grupo,
        ClaveFechaHora: fila.ClaveFechaHora,
        CantidadVersiones: fila.CantidadVersiones,
        CamposDiferentes: fila.CamposDiferentes,
        CandidatoMenorDesfase: fila.CandidatoMenorDesfase,
        Decision: fila.Decision
    })),
    alertasEstructura: inconsistenciasEstructura
};

console.log("\n============================================================");
console.log(" MATRIZ DE DUPLICADOS UBIDOTS GENERADA");
console.log("============================================================");
console.log(`Registros de entrada: ${resumen.RegistrosEntrada}`);
console.log(
    `Grupos inconsistentes incluidos: ` +
    `${resumen.GruposInconsistentesIncluidos}`
);
console.log(
    `Versiones incluidas: ${resumen.VersionesInconsistentesIncluidas}`
);
console.log(
    `Diferencias operativas: ${resumen.DiferenciasOperativasIncluidas}`
);
console.log(`Decisiones pendientes: ${resumen.DecisionesPendientes}`);
console.log(`Alertas estructurales: ${inconsistenciasEstructura.length}`);
console.log(`Salida: ${salida}`);
console.log(`Huella SHA-256: ${huella}`);

if (modoConsola !== "ninguno") {
    const salidaJSON = modoConsola === "completo"
        ? {
            ...salidaConsola,
            grupos: limitarLista(salidaConsola.grupos, limite),
            alertasEstructura: limitarLista(
                salidaConsola.alertasEstructura,
                limite
            )
        }
        : {
            metadatos,
            resumen,
            integridad: salidaConsola.integridad,
            grupos: limitarLista(salidaConsola.grupos, limite),
            alertasEstructura: limitarLista(
                salidaConsola.alertasEstructura,
                limite
            )
        };

    console.log("\n====================== INICIO JSON ==========================");
    console.log(JSON.stringify(salidaJSON, null, 2));
    console.log("======================= FIN JSON ============================");
}

console.log(
    "\nLos archivos de entrada no fueron modificados. " +
    "La matriz no aplica decisiones ni elimina registros.\n"
);
