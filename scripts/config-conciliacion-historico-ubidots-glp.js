"use strict";

// ============================================================
// CONCILIACION DEL HISTORICO GLP CON UBIDOTS DEPURADO
// ============================================================
//
// Motor compatible:
//   scripts/conciliar-bases.js
//
// Principal:
//   registros-depurados.xlsx
//
// Secundaria:
//   registros-ubidots-depurados.xlsx
//
// Esta configuracion no depura duplicados ni corrige valores.
// Ambas entradas deben estar auditadas y depuradas previamente.
// ============================================================

module.exports = {
    nombre:
        "Conciliacion del historico GLP con Ubidots depurado",

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

    // Fecha y Hora identifican cada evento operacional.
    clave: [
        "Fecha",
        "Hora"
    ],

    // Normalizacion aplicada antes de construir la clave.
    normalizadores: {
        Fecha: "fecha",
        Hora: "hora"
    },

    // Solo estas columnas operativas intervienen cuando una clave
    // Fecha + Hora aparece en ambas fuentes.
    //
    // Las siete columnas tecnicas de Ubidots se conservan en la
    // salida, pero no participan en la comparacion de equivalencia.
    columnasComparacion: [
        "NivelTanque",
        "PresionTanque",
        "TempTanque",
        "NivelCisterna",
        "PresionCisterna",
        "TempCisterna",
        "CapacidadCisterna",
        "PlacaCisterna",
        "PresionBomba",
        "TempVapor",
        "PresionVapor",
        "PresionMezcla",
        "EstadoOperacion",
        "Pendientes",
        "Observaciones",
        "Encargado",
        "Fecha",
        "Hora",
        "FechaServidor",
        "ValvulasCapuchon"
    ],

    // No se aplican exclusiones adicionales.
    // Ambas fuentes ya fueron depuradas mediante reglas documentadas.
    exclusiones: [],

    // Orden cronologico por Fecha + Hora.
    ordenar:
        true
};
