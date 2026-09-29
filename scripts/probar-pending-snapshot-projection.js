"use strict";

const {
    VARIABLES
} = require("../js/variables");

const {
    buildPendingSnapshotContext
} = require(
    "../services/pending-snapshot-projection-service"
);

const snapshot = [
    {
        id: "p-001",

        type: "otro",

        description:
            "Fuga línea vapor",

        creation: {
            fechaRegistro:
                "2026-09-28",

            encargadoRegistro:
                "Prueba"
        },

        resolution: null
    },

    {
        id: "p-002",

        type: "sin_cisterna",

        description:
            "Sin cisterna",

        creation: {
            fechaRegistro:
                "2026-09-28",

            encargadoRegistro:
                "Prueba"
        },

        resolution: {
            fechaSolucion:
                "2026-09-29",

            encargadoSolucion:
                "Juan Pablo"
        }
    }
];

const result =
    buildPendingSnapshotContext({

        snapshot,

        pendingConfig:
            VARIABLES.pendientes
    });

console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);