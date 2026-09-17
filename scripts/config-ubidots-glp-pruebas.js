"use strict";

// ============================================================
// CONFIGURACION HISTORICA E2E DE PLANTA-PRUEBA
// ============================================================
//
// Esta configuracion consulta exclusivamente las variables
// del dispositivo Ubidots llamado planta-prueba.
//
// No contiene tokens ni credenciales.
// No debe utilizarse en produccion.
// ============================================================

module.exports = {
    nombre:
        "Inspeccion historica E2E de planta-prueba",

    version:
        "1.0.0",

    baseUrl:
        "https://industrial.api.ubidots.com/api/v1.6",

    tokenEnv:
        "UBIDOTS_TOKEN",

    writeTarget: {
        enabled:
            true,

        purpose:
            "pending-lifecycle-e2e",

        deviceLabel:
            "planta-prueba",

        confirmation:
            "planta-prueba",

        testValues: {
            nivel_tanque:
                50,

            presion_tanque:
                100,

            temp_tanque:
                19,

            nivel_cisterna:
                50,

            presion_cisterna:
                110,

            temp_cisterna:
                22,

            capacidad_cisterna:
                1000,

            presion_bomba:
                110,

            temp_vapor:
                56,

            presion_vapor:
                105,

            presion_mezcla:
                10
        }
    },

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

    parametros: {
        start: 1789145580001
    },

    variables: {
        nivel_tanque:
            "6aa41fe34efd749086f1bd13",

        presion_tanque:
            "6aa41fe5194b5ee792adf661",

        temp_tanque:
            "6aa41fe5f7354a7748e61109",

        nivel_cisterna:
            "6aa4252f3b471812327ac77f",

        presion_cisterna:
            "6aa425303b471812327ac782",

        temp_cisterna:
            "6aa42530349dfa3e41e0a9d3",

        capacidad_cisterna:
            "6aa4252f3b471812327ac77c",

        presion_bomba:
            "6aa41fe45f2d338599ee251e",

        temp_vapor:
            "6aa41fe6d7b6d6e9d1b987ed",

        presion_vapor:
            "6aa41fe5bc9cd994555317ef",

        presion_mezcla:
            "6aa41fe40ea1693752e7285d"
    },

    mapeoSalida: {
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
    }
};