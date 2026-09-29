"use strict";

const path = require("path");

const dotenv = require("dotenv");

const envArgument =
    process.argv.find(arg =>
        arg.startsWith("--env=")
    );

const envFile =
    envArgument
        ? envArgument.split("=")[1]
        : ".env";

dotenv.config({
    path: envFile
});

console.log(
    `\nEntorno cargado: ${envFile}\n`
);

const {
    VARIABLES,
    buildPendingLifecycleContract
} = require("../js/variables");

const {
    reconstructPendingLifecycle
} = require("../services/pending-lifecycle-service");

const ubidotsHistoryService =
    require("../services/ubidots-history-service");

const historyConfig =
    require("../config/history-sync.config");

async function main() {

    const token =
        process.env.UBIDOTS_TOKEN;

    if (!token) {
        throw new Error(
            "UBIDOTS_TOKEN no configurado."
        );
    }

    const contract =
        buildPendingLifecycleContract(
            VARIABLES
        );

    if (!contract.valid) {

        console.log(
            "\nCONTRATO INVÁLIDO\n"
        );

        console.log(
            JSON.stringify(
                contract.errors,
                null,
                2
            )
        );

        process.exit(1);
    }

    console.log(
        "\n====================================="
    );

    console.log(
        "PENDING LIFECYCLE - RECONSTRUCCIÓN"
    );

    console.log(
        "=====================================\n"
    );

    const history =
        await ubidotsHistoryService
            .fetchHistory({
                config: historyConfig,
                token
            });

    console.log(
        `Registros recuperados: ${history.records.length}`
    );

    console.log(
        `Conflictos de contexto: ${history.contextConflicts.length}\n`
    );

    const lifecycle =
        reconstructPendingLifecycle({
            events:
                history.records,

            pendingContract:
                contract,

            contextConflicts:
                history.contextConflicts
        });

    console.log(
        "====================================="
    );

    console.log(
        "RESUMEN"
    );

    console.log(
        "=====================================\n"
    );

    console.log(
        JSON.stringify(
            {
                environment: envFile,
                ubidotsToken:
                    token
                        ? `${token.slice(0, 6)}...`
                        : null,

                recordsRecovered:
                    history.records.length,

                contextConflicts:
                    history.contextConflicts.length,

                valid:
                    lifecycle.valid,

                processedEvents:
                    lifecycle.processedEvents,

                activePendings:
                    lifecycle.activePendings.length,

                resolvedPendings:
                    lifecycle.resolvedPendings.length
            },
            null,
            2
        )
    );

    console.log(
        JSON.stringify(
            {
                valid:
                    lifecycle.valid,

                processedEvents:
                    lifecycle.processedEvents,

                ignoredEvents:
                    lifecycle.ignoredEvents,

                legacyEvents:
                    lifecycle.legacyEvents,

                activePendings:
                    lifecycle.activePendings.length,

                resolvedPendings:
                    lifecycle.resolvedPendings.length,

                diagnostics:
                    lifecycle.diagnostics.length
            },
            null,
            2
        )
    );

    console.log("");

    if (
        lifecycle.diagnostics.length > 0
    ) {

        console.log(
            "====================================="
        );

        console.log(
            "DIAGNÓSTICOS"
        );

        console.log(
            "=====================================\n"
        );

        console.log(
            JSON.stringify(
                lifecycle.diagnostics,
                null,
                2
            )
        );

        console.log("");
    }

    console.log(
        "====================================="
    );

    console.log(
        "PENDIENTES ACTIVOS"
    );

    console.log(
        "=====================================\n"
    );

    if (
        lifecycle.activePendings.length === 0
    ) {

        console.log(
            "No existen pendientes activos.\n"
        );

    } else {

        lifecycle.activePendings.forEach(
            (pending, index) => {

                console.log(
                    `[${index + 1}]`
                );

                console.log(
                    JSON.stringify(
                        pending,
                        null,
                        2
                    )
                );

                console.log("");
            }
        );
    }

    console.log(
        "====================================="
    );

    console.log(
        "PENDIENTES RESUELTOS"
    );

    console.log(
        "=====================================\n"
    );

    console.log(
        `Total: ${lifecycle.resolvedPendings.length}\n`
    );

    const ultimos =
        lifecycle.resolvedPendings
            .slice(-10);

    ultimos.forEach(
        (pending, index) => {

            console.log(
                `[${index + 1}]`
            );

            console.log(
                JSON.stringify(
                    pending,
                    null,
                    2
                )
            );

            console.log("");
        }
    );
}

main()
    .catch(error => {

        console.error(
            "\nERROR:",
            error.message
        );

        console.error(
            error.stack
        );

        process.exit(1);
    });