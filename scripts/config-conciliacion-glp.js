"use strict";

// ============================================================
// CONFIGURACIÓN DE CONCILIACIÓN DEL HISTÓRICO GLP
// ============================================================
//
// Compatible con:
//   scripts/conciliar-bases.js
//
// Ejemplo:
//   node scripts/conciliar-bases.js \
//     --principal=registros.xlsx \
//     --secundaria=registros-LJDCOLORADO.xlsx \
//     --config=scripts/config-conciliacion-glp.js \
//     --salida=registros-conciliados.xlsx \
//     --reporte=reporte-conciliacion.xlsx \
//     --json=hallazgos \
//     --limite=20
//
// Esta configuración no depura duplicados internos ni corrige
// valores. Solo define cómo comparar, excluir y conciliar fuentes.
// ============================================================

module.exports = {
    nombre:
        "Configuración de conciliación del histórico GLP",

    version:
        "1.0.0",

    hoja:
        "Registros",

    hojaPrincipal:
        "Registros",

    hojaSecundaria:
        "Registros",

    hojaSalida:
        "Registros",

    // Fecha + Hora constituyen la clave de agrupación utilizada
    // en la conciliación actual.
    clave: [
        "Fecha",
        "Hora"
    ],

    // Se normalizan antes de comparar las dos fuentes.
    normalizadores: {
        Fecha: "fecha",
        Hora: "hora"
    },

    // Si no se declara columnasComparacion, el motor utiliza
    // automáticamente todas las columnas comunes de ambas bases.
    // Esto permite comparar la base histórica de 15 columnas con
    // la base moderna de 19 columnas sin considerar como conflicto
    // las columnas que solo existen en la fuente principal.

    // Exclusiones documentadas de la fuente secundaria.
    exclusiones: [
        {
            id:
                "excluir-registro-tecnico-prueba",

            cuando: ({ registro, utilidades }) =>
                utilidades
                    .texto(registro.Encargado)
                    .toLowerCase() === "prueba",

            motivo:
                "Registro técnico identificado mediante el valor 'Prueba' en el campo Encargado"
        }
    ],

    // Ordenar el archivo conciliado por la clave normalizada.
    ordenar:
        true
};
