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
                        "Fuga lÃ­nea vapor",

                    creation: {
                        fechaRegistro:
                            "2026-09-28",

                        encargadoRegistro:
                            "Prueba"
                    }
                }
            });

    print(
        "DESPUÃ‰S DE CREAR p-001",
        snapshot
    );

    snapshot =
        snapshotService
            .createPendingSnapshot({

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

    print(
        "DESPUÃ‰S DE CREAR p-002",
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
        "DESPUÃ‰S DE RESOLVER p-001",
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
        "\nâœ… PRUEBA EXITOSA\n"
    );

}
catch (error) {

    console.error(
        "\nâŒ ERROR:",
        error.message
    );

    process.exit(1);
}
