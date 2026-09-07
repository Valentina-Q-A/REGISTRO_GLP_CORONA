"use strict";

// ============================================================
// CONFIGURACIÓN DE AUDITORÍA DEL HISTÓRICO GLP
// ============================================================
//
// Compatible con:
//   scripts/auditar-base.js
//
// Ejemplo:
//   node scripts/auditar-base.js \
//     --entrada=registros-conciliados.xlsx \
//     --config=scripts/config-auditoria-glp.js \
//     --salida=auditoria-registros-conciliados.xlsx \
//     --json=hallazgos \
//     --limite=20
//
// Esta configuración solo diagnostica. No modifica registros.
// Los rangos se toman de js/variables.js para evitar duplicar la
// configuración operativa vigente del formulario.
// ============================================================

const path = require("path");

const rutaVariables = path.join(
    __dirname,
    "..",
    "js",
    "variables.js"
);

const {
    VARIABLES
} = require(rutaVariables);

if (!VARIABLES || typeof VARIABLES !== "object") {
    throw new Error(
        "No fue posible cargar VARIABLES desde js/variables.js"
    );
}

// ============================================================
// CONSTRUIR COLUMNAS ESPERADAS
// ============================================================

const columnasEsperadas = [
    ...new Set([
        ...Object.values(VARIABLES)
            .filter(variable => Boolean(variable.excelField))
            .map(variable => variable.excelField),
        "FechaServidor"
    ])
];

// ============================================================
// CONSTRUIR REGLAS DE CAMPOS NUMÉRICOS
// ============================================================
//
// IMPORTANTE:
// Estos límites son los rangos configurados actualmente en el
// formulario. Estar por fuera del rango genera un hallazgo, pero
// no demuestra por sí solo que el dato histórico sea incorrecto.
// ============================================================

const camposNumericos = {};

for (const [nombre, variable] of Object.entries(VARIABLES)) {
    if (
        variable.type !== "number" ||
        !variable.excelField
    ) {
        continue;
    }

    camposNumericos[variable.excelField] = {
        nombreVariable: nombre,
        etiqueta: variable.label || variable.excelField,
        unidad: variable.unit || "",
        minimo: variable.min,
        maximo: variable.max,
        clasificacion:
            "Comparación contra el rango operativo vigente del formulario"
    };
}

// ============================================================
// CONFIGURACIÓN EXPORTADA
// ============================================================

module.exports = {
    nombre:
        "Configuración de auditoría del histórico GLP",

    version:
        "1.0.0",

    hoja:
        "Registros",

    // La combinación Fecha + Hora identifica un evento para la
    // detección de duplicados dentro del histórico actual.
    clave: [
        "Fecha",
        "Hora"
    ],

    normalizadores: {
        Fecha: "fecha",
        Hora: "hora"
    },

    columnasEsperadas,

    camposObligatorios: [
        "Fecha",
        "Hora",
        "Encargado"
    ],

    camposNumericos,

    // Validaciones adicionales independientes de los rangos.
    validaciones: [
        {
            id: "fecha-presente",
            campo: "Fecha",
            severidad: "error",

            validar: ({ registro, utilidades }) =>
                !utilidades.vacio(registro.Fecha),

            mensaje:
                "El registro no contiene una fecha"
        },
        {
            id: "hora-presente",
            campo: "Hora",
            severidad: "error",

            validar: ({ registro, utilidades }) =>
                !utilidades.vacio(registro.Hora),

            mensaje:
                "El registro no contiene una hora"
        },
        {
            id: "encargado-presente",
            campo: "Encargado",
            severidad: "advertencia",

            validar: ({ registro, utilidades }) =>
                !utilidades.vacio(registro.Encargado),

            mensaje:
                "No fue posible identificar al encargado del registro"
        }
    ]
};
