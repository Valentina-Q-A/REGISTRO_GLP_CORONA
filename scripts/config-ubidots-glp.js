"use strict";

// ============================================================
// CONFIGURACION DE INSPECCION DEL HISTORICO GLP EN UBIDOTS
// ============================================================
//
// Compatible con:
//   scripts/inspeccionar-ubidots.js
//
// El token NO debe incluirse en este archivo.
// Debe almacenarse localmente en .env:
//
//   Configurar UBIDOTS_TOKEN mediante una variable de entorno.
//
// Ejecucion:
//   node scripts/inspeccionar-ubidots.js \
//     --config=scripts/config-ubidots-glp.js \
//     --json=hallazgos \
//     --limite=20
//
// Esta configuracion replica las variables consultadas por el
// historial publicado anteriormente en GitHub Pages.
// ============================================================

module.exports = {
    nombre:
        "Inspeccion del historico GLP en Ubidots",

    version:
        "1.0.0",

    baseUrl:
        "https://industrial.api.ubidots.com/api/v1.6",

    tokenEnv:
        "UBIDOTS_TOKEN",

    pageSize:
        100,

    concurrencia:
        2,

    timeoutMs:
        Number(
            process.env.GLP_UBIDOTS_QUERY_TIMEOUT_MS ||
            120000
        ),

    maxPaginas:
        10000,

    zonaHoraria:
        "America/Bogota",

    camposContexto: {
        fecha: "Fecha",
        hora: "Hora"
    },

    // Parametros adicionales opcionales para todas las consultas.
    // Se deja vacio para recuperar todo el historico disponible.
    parametros: {},

    variables: {
        nivel_tanque:
            "69c2b0e098c4170371875955",

        presion_tanque:
            "69c2b0e000a7ca2c376872f1",

        temp_tanque:
            "69c2a6179c18013ea16383e5",

        nivel_cisterna:
            "69c2a62f45c5fcfe4bad3384",

        presion_cisterna:
            "6a4e5fdc63db9441a85dcbb0",

        temp_cisterna:
            "6a4e5fd11b4b877cc189e6a6",

        capacidad_cisterna:
            "69c2a647bd8a77f94450feb1",

        presion_bomba:
            "69c2a66053a41a747f3a2129",

        temp_vapor:
            "69c2a6779933011f71ff918d",

        presion_vapor:
            "69c2a68c9933011f71ff918e",

        presion_mezcla:
            "69c2a6a3cfe705dda9e03c76"
    }, mapeoSalida: {
        nivel_tanque: "NivelTanque",
        presion_tanque: "PresionTanque",
        temp_tanque: "TempTanque",
        nivel_cisterna: "NivelCisterna",
        presion_cisterna: "PresionCisterna",
        temp_cisterna: "TempCisterna",
        capacidad_cisterna: "CapacidadCisterna",
        presion_bomba: "PresionBomba",
        temp_vapor: "TempVapor",
        presion_vapor: "PresionVapor",
        presion_mezcla: "PresionMezcla"
    },

    contextoSalida: {
        PlacaCisterna: "PlacaCisterna",
        EstadoOperacion: "EstadoOperacion",
        Pendientes: "Pendientes",
        Observaciones: "Observaciones",
        Encargado: "Encargado",
        ValvulasCapuchon: "ValvulasCapuchon",
        FechaServidor: "FechaServidor"
    },
};
