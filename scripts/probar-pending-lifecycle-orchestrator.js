"use strict";

const orchestrator =
    require(
        "../services/pending-lifecycle-orchestrator"
    );

async function main() {

    let snapshot = [];

    console.log("");
    console.log("=================================");
    console.log("SNAPSHOT INICIAL");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    // =======================================
    // CREACION P-001
    // =======================================

    const creation1 =
        await orchestrator.createPending({

            snapshot,

            pending: {
                id: "p-001",

                type: "otro",

                description:
                    "Fuga lÃ­nea vapor",

                creation: {
                    fechaRegistro:
                        "2026-09-28",

                    encargadoRegistro:
                        "Prueba"
                }
            }
        });

    snapshot =
        creation1.snapshot;

    console.log("");
    console.log("=================================");
    console.log("DESPUES DE CREAR p-001");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    // =======================================
    // CREACION P-002
    // =======================================

    const creation2 =
        await orchestrator.createPending({

            snapshot,

            pending: {
                id: "p-002",

                type: "bomba_1_apagada",

                description:
                    "Bomba 1 apagada",

                creation: {
                    fechaRegistro:
                        "2026-09-28",

                    encargadoRegistro:
                        "Prueba"
                }
            }
        });

    snapshot =
        creation2.snapshot;

    console.log("");
    console.log("=================================");
    console.log("DESPUES DE CREAR p-002");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    // =======================================
    // RESOLUCION P-001
    // =======================================

    const resolution =
        await orchestrator.resolvePending({

            snapshot,

            pendingId:
                "p-001",

            resolution: {
                fechaSolucion:
                    "2026-09-29",

                encargadoSolucion:
                    "Juan Pablo"
            }
        });

    snapshot =
        resolution.snapshot;

    console.log("");
    console.log("=================================");
    console.log("DESPUES DE RESOLVER p-001");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    // =======================================
    // PROYECCION
    // =======================================

    console.log("");
    console.log("=================================");
    console.log("PROYECCION UBIDOTS");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            orchestrator
                .buildSnapshotProjection({
                    snapshot
                }),
            null,
            2
        )
    );

    // =======================================
    // SERIALIZACION
    // =======================================

    console.log("");
    console.log("=================================");
    console.log("JSON PARA pendientes_json");
    console.log("=================================");
    console.log("");

    console.log(
        orchestrator.serializeSnapshot({
            snapshot
        })
    );

    // =======================================
    // ACTIVOS
    // =======================================

    console.log("");
    console.log("=================================");
    console.log("ACTIVOS");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            orchestrator
                .activePendings({
                    snapshot
                }),
            null,
            2
        )
    );

    // =======================================
    // RESUELTOS
    // =======================================

    console.log("");
    console.log("=================================");
    console.log("RESUELTOS");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            orchestrator
                .resolvedPendings({
                    snapshot
                }),
            null,
            2
        )
    );

    // =======================================
    // RESUMEN
    // =======================================

    console.log("");
    console.log("=================================");
    console.log("RESUMEN");
    console.log("=================================");
    console.log("");

    console.log(
        JSON.stringify(
            orchestrator.summary({
                snapshot
            }),
            null,
            2
        )
    );

    console.log("");
    console.log(
        "âœ… ORCHESTRATOR VALIDADO"
    );
    console.log("");
}

main()
    .catch(error => {

        console.error("");
        console.error(
            "âŒ ERROR:"
        );

        console.error(
            error.message
        );

        console.error("");

        process.exit(1);
    });
