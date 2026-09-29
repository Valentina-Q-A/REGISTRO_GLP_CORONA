"use strict";

const {
    loadLatestSnapshot
} = require(
    "../services/pending-snapshot-ubidots-service"
);

const records = [

    {
        TimestampUbidots:
            1000,

        ContextoCompletoJSON:
            JSON.stringify({
                encargado:
                    "Prueba"
            })
    },

    {
        TimestampUbidots:
            2000,

        ContextoCompletoJSON:
            JSON.stringify({
                pendientes_json:
                    JSON.stringify([
                        {
                            id: "p-001",

                            type:
                                "otro",

                            description:
                                "Fuga línea vapor",

                            creation: {
                                fechaRegistro:
                                    "2026-09-28",

                                encargadoRegistro:
                                    "Prueba"
                            },

                            resolution:
                                null
                        }
                    ])
            })
    },

    {
        TimestampUbidots:
            3000,

        ContextoCompletoJSON:
            JSON.stringify({
                pendientes_json:
                    JSON.stringify([
                        {
                            id: "p-001",

                            type:
                                "otro",

                            description:
                                "Fuga línea vapor",

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
                                    "JP"
                            }
                        },

                        {
                            id: "p-002",

                            type:
                                "sin_cisterna",

                            description:
                                "Sin cisterna",

                            creation: {
                                fechaRegistro:
                                    "2026-09-28",

                                encargadoRegistro:
                                    "Prueba"
                            },

                            resolution:
                                null
                        }
                    ])
            })
    }
];

const result =
    loadLatestSnapshot({
        records
    });

console.log("");
console.log(
    "================================="
);

console.log(
    "LATEST SNAPSHOT"
);

console.log(
    "================================="
);

console.log("");

console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);

console.log("");
console.log(
    "✅ PRUEBA EXITOSA"
);
console.log("");