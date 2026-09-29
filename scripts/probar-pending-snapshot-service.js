"use strict";

const snapshotService =
    require(
        "../services/pending-snapshot-service"
    );

function print(title, data) {

    console.log("\n=================================");
    console.log(title);
    console.log("=================================\n");

    console.log(
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

try {

    let snapshot = [];

    print(
        "ESTADO INICIAL",
        snapshot
    );

    snapshot =
        snapshotService
            .createPendingSnapshot({

                snapshot,

                pending: {
                    id: "p-001",

                    type: "otro",

                    description:
                        "Fuga línea vapor",

                    creation: {
                        fechaRegistro:
                            "2026-09-28",

                        encargadoRegistro:
                            "Prueba"
                    }
                }
            });

    print(
        "DESPUÉS DE CREAR p-001",
        snapshot
    );

    snapshot =
        snapshotService
            .createPendingSnapshot({

                snapshot,

                pending: {
                    id: "p-002",

                    type: "sin_cisterna",

                    description:
                        "Sin cisterna",

                    creation: {
                        fechaRegistro:
                            "2026-09-28",

                        encargadoRegistro:
                            "Prueba"
                    }
                }
            });

    print(
        "DESPUÉS DE CREAR p-002",
        snapshot
    );

    snapshot =
        snapshotService
            .resolvePendingSnapshot({

                snapshot,

                pendingId:
                    "p-001",

                resolution: {
                    fechaSolucion:
                        "2026-09-29",

                    encargadoSolucion:
                        "JP"
                }
            });

    print(
        "DESPUÉS DE RESOLVER p-001",
        snapshot
    );

    print(
        "ACTIVOS",
        snapshotService
            .getActivePendings(
                snapshot
            )
    );

    print(
        "RESUELTOS",
        snapshotService
            .getResolvedPendings(
                snapshot
            )
    );

    print(
        "RESUMEN",
        snapshotService
            .summarizeSnapshot(
                snapshot
            )
    );

    console.log(
        "\n✅ PRUEBA EXITOSA\n"
    );

}
catch (error) {

    console.error(
        "\n❌ ERROR:",
        error.message
    );

    process.exit(1);
}