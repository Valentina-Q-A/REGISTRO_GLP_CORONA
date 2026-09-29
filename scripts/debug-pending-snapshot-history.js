"use strict";

const fs = require("fs");
const path = require("path");

const ubidotsHistoryService =
    require("../services/ubidots-history-service");

const snapshotUbidotsService =
    require("../services/pending-snapshot-ubidots-service");

const orchestrator =
    require("../services/pending-lifecycle-orchestrator");

function parseArguments(args) {

    const result = {};

    for (const arg of args) {

        if (!arg.startsWith("--")) {
            continue;
        }

        const content =
            arg.slice(2);

        const index =
            content.indexOf("=");

        const key =
            index === -1
                ? content
                : content.slice(0, index);

        const value =
            index === -1
                ? true
                : content.slice(index + 1);

        result[key] = value;
    }

    return result;
}

function loadEnv(filePath) {

    if (!fs.existsSync(filePath)) {
        throw new Error(
            `No existe ${filePath}`
        );
    }

    const content =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    for (
        const line
        of content.split(/\r?\n/)
    ) {

        const trimmed =
            line.trim();

        if (
            !trimmed ||
            trimmed.startsWith("#")
        ) {
            continue;
        }

        const index =
            trimmed.indexOf("=");

        if (index < 1) {
            continue;
        }

        const key =
            trimmed
                .slice(0, index)
                .trim();

        let value =
            trimmed
                .slice(index + 1)
                .trim();

        if (
            (value.startsWith('"') &&
             value.endsWith('"'))
            ||
            (value.startsWith("'") &&
             value.endsWith("'"))
        ) {
            value =
                value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

async function main() {

    const args =
        parseArguments(
            process.argv.slice(2)
        );

    const envFile =
        args.env || ".env";

    const configPath =
        args.config;

    if (!configPath) {
        throw new Error(
            "Debe indicar --config"
        );
    }

    loadEnv(envFile);

    const config =
        require(
            path.resolve(configPath)
        );

    const tokenEnv =
        config.tokenEnv ||
        "UBIDOTS_TOKEN";

    const token =
        process.env[tokenEnv];

    if (!token) {
        throw new Error(
            `No existe ${tokenEnv}`
        );
    }

    console.log("");
    console.log(
        "====================================="
    );
    console.log(
        "HISTORIAL UBIDOTS"
    );
    console.log(
        "====================================="
    );
    console.log("");

    console.log(
        `Entorno: ${envFile}`
    );

    console.log(
        `Config: ${configPath}`
    );

    console.log("");

    const history =
        await ubidotsHistoryService
            .fetchHistory({
                config,
                token
            });

    console.log(
        `Registros recuperados: ${history.records.length}`
    );

    console.log(
        `Conflictos de contexto: ${history.contextConflicts.length}`
    );

    console.log("");
    console.log(
        "\nULTIMOS 5 REGISTROS\n"
    );

    history.records
        .slice(-5)
        .forEach(record => {

            try {

                const context =
                    JSON.parse(
                        record.ContextoCompletoJSON ||
                        "{}"
                    );

                console.log(
                    record.TimestampUbidots
                );

                console.log(
                    context.pendientes_json
                );

                console.log(
                    "------------------"
                );

            } catch {
                // ignorar
            }
        });

    const snapshotResult =
        snapshotUbidotsService
            .loadLatestSnapshot({
                records:
                    history.records
            });

    console.log(
        "====================================="
    );

    console.log(
        "SNAPSHOT ENCONTRADO"
    );

    console.log(
        "====================================="
    );

    console.log("");

    console.log(
        JSON.stringify(
            {
                found:
                    snapshotResult.found,

                sourceTimestamp:
                    snapshotResult.sourceTimestamp,

                snapshotSize:
                    snapshotResult.snapshot.length
            },
            null,
            2
        )
    );

    console.log("");

    if (!snapshotResult.found) {

        console.log(
            "No existe pendientes_json en el histórico."
        );

        return;
    }

    console.log(
        "====================================="
    );

    console.log(
        "SNAPSHOT COMPLETO"
    );

    console.log(
        "====================================="
    );

    console.log("");

    console.log(
        JSON.stringify(
            snapshotResult.snapshot,
            null,
            2
        )
    );

    console.log("");

    console.log(
        "====================================="
    );

    console.log(
        "ACTIVOS"
    );

    console.log(
        "====================================="
    );

    console.log("");

    console.log(
        JSON.stringify(
            orchestrator.activePendings({
                snapshot:
                    snapshotResult.snapshot
            }),
            null,
            2
        )
    );

    console.log("");

    console.log(
        "====================================="
    );

    console.log(
        "RESUELTOS"
    );

    console.log(
        "====================================="
    );

    console.log("");

    console.log(
        JSON.stringify(
            orchestrator.resolvedPendings({
                snapshot:
                    snapshotResult.snapshot
            }),
            null,
            2
        )
    );

    console.log("");

    console.log(
        "====================================="
    );

    console.log(
        "RESUMEN"
    );

    console.log(
        "====================================="
    );

    console.log("");

    console.log(
        JSON.stringify(
            orchestrator.summary({
                snapshot:
                    snapshotResult.snapshot
            }),
            null,
            2
        )
    );

    console.log("");
    console.log(
        "✅ LECTURA REAL FINALIZADA"
    );
    console.log("");
}

main().catch(error => {

    console.error("");

    console.error(
        "❌ ERROR"
    );

    console.error(
        JSON.stringify(
            {
                name: error.name,
                message: error.message,
                cause: error.cause
            },
            null,
            2
        )
    );

    console.error("");

    process.exit(1);
});