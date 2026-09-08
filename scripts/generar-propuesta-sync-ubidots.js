"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const historySyncConfig =
    require("../config/history-sync.config");

const historyCacheService =
    require("../services/history-cache-service");

const ubidotsHistoryService =
    require("../services/ubidots-history-service");

const syncProposalService =
    require("../services/sync-proposal-service");

function parseArguments(argumentsList) {
    const options = {};

    for (const argument of argumentsList) {
        if (!argument.startsWith("--")) {
            continue;
        }

        const content = argument.slice(2);
        const equalIndex = content.indexOf("=");

        const key =
            equalIndex === -1
                ? content
                : content.slice(0, equalIndex);

        const value =
            equalIndex === -1
                ? "true"
                : content.slice(equalIndex + 1);

        options[key.toLowerCase()] = value;
    }

    return options;
}

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const content =
        fs.readFileSync(filePath, "utf8");

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (
            !trimmed ||
            trimmed.startsWith("#")
        ) {
            continue;
        }

        const equalIndex =
            trimmed.indexOf("=");

        if (equalIndex < 1) {
            continue;
        }

        const key =
            trimmed.slice(0, equalIndex).trim();

        let value =
            trimmed.slice(equalIndex + 1).trim();

        if (
            (value.startsWith('"') &&
                value.endsWith('"')) ||
            (value.startsWith("'") &&
                value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function hashFile(filePath) {
    return crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
}

async function main() {
    const options =
        parseArguments(process.argv.slice(2));

    if (
        options.ayuda === "true" ||
        options.help === "true"
    ) {
        console.log(`
Uso:
  node scripts/generar-propuesta-sync-ubidots.js [opciones]

Opciones:
  --config=<archivo.js>
  --cache=<archivo.xlsx>
  --checkpoint=<archivo.json>
  --salida-cache=<archivo.xlsx>
  --salida-checkpoint=<archivo.json>
  --env=<archivo>
  --ayuda

Genera archivos nuevos de propuesta.
No sobrescribe la caché, el checkpoint ni los pendientes.
`);

        return;
    }

    const configPath =
        path.resolve(
            process.cwd(),
            options.config ||
                "scripts/config-ubidots-glp.js"
        );

    const cachePath =
        path.resolve(
            process.cwd(),
            options.cache ||
                historySyncConfig.cachePath
        );

    const checkpointPath =
        path.resolve(
            process.cwd(),
            options.checkpoint ||
                historySyncConfig.checkpointPath
        );

    const pendingPath =
        path.resolve(
            process.cwd(),
            "ubidots-pending.json"
        );

    const envPath =
        path.resolve(
            process.cwd(),
            options.env || ".env"
        );

    const proposedCachePath =
        path.resolve(
            process.cwd(),
            options["salida-cache"] ||
                "registros-sync-propuesto.xlsx"
        );

    const proposedCheckpointPath =
        path.resolve(
            process.cwd(),
            options["salida-checkpoint"] ||
                "ubidots-sync-checkpoint-propuesto.json"
        );

    for (
        const [name, filePath]
        of Object.entries({
            configuración: configPath,
            caché: cachePath,
            checkpoint: checkpointPath,
            pendientes: pendingPath
        })
    ) {
        if (!fs.existsSync(filePath)) {
            throw new Error(
                `No existe ${name}: ${filePath}`
            );
        }
    }

    if (
        proposedCachePath === cachePath ||
        proposedCheckpointPath === checkpointPath
    ) {
        throw new Error(
            "Las salidas propuestas no pueden sobrescribir los originales."
        );
    }

    loadEnv(envPath);

    const ubidotsConfig =
        require(configPath);

    const tokenEnvironment =
        ubidotsConfig.tokenEnv ||
        "UBIDOTS_TOKEN";

    const token =
        process.env[tokenEnvironment];

    if (!token) {
        throw new Error(
            `No se encontró ${tokenEnvironment}.`
        );
    }

    const hashesBefore = {
        cache: hashFile(cachePath),
        checkpoint: hashFile(checkpointPath),
        pending: hashFile(pendingPath)
    };

    const cache =
        historyCacheService.readSheet(
            cachePath,
            historySyncConfig.cacheSheet
        );

    const checkpoint =
        JSON.parse(
            fs.readFileSync(
                checkpointPath,
                "utf8"
            )
        );

    const history =
        await ubidotsHistoryService.fetchHistory({
            config: ubidotsConfig,
            token
        });

    const simulation =
        ubidotsHistoryService.simulateIncrementalSync({
            cacheRecords: cache.records,
            ubidotsRecords: history.records,
            reviewedTimestamps:
                checkpoint.timestamps,
            config: ubidotsConfig
        });

    if (
        simulation.summary.conflicts > 0 ||
        simulation.summary.recordsWithoutOperationalKey > 0 ||
        history.contextConflicts.length > 0
    ) {
        console.log(
            JSON.stringify(
                {
                    summary: simulation.summary,
                    contextConflicts:
                        history.contextConflicts.length
                },
                null,
                2
            )
        );

        process.exitCode = 2;
        return;
    }

    const proposedCache =
        syncProposalService.writeProposedCache({
            cacheData: cache,
            newOperationalEvents:
                simulation.newOperationalEvents,
            sheetName:
                historySyncConfig.cacheSheet,
            outputPath:
                proposedCachePath
        });

    const proposedCheckpoint =
        syncProposalService.writeProposedCheckpoint({
            currentCheckpoint: checkpoint,
            newTechnicalRecords:
                simulation.newTechnicalRecords,
            outputPath:
                proposedCheckpointPath
        });

    const proposedInspection =
        syncProposalService.inspectProposedRecords(
            proposedCache.records
        );

    const hashesAfter = {
        cache: hashFile(cachePath),
        checkpoint: hashFile(checkpointPath),
        pending: hashFile(pendingPath)
    };

    const integrity = {
        cacheUnchanged:
            hashesBefore.cache === hashesAfter.cache,

        checkpointUnchanged:
            hashesBefore.checkpoint ===
            hashesAfter.checkpoint,

        pendingUnchanged:
            hashesBefore.pending === hashesAfter.pending
    };

    const result = {
        summary: simulation.summary,

        proposedCache: {
            ...proposedInspection,
            columns:
                proposedCache.columns.length,
            path:
                proposedCachePath
        },

        proposedCheckpoint: {
            previousTimestamps:
                checkpoint.timestamps.length,

            proposedTimestamps:
                proposedCheckpoint
                    .checkpoint
                    .timestamps
                    .length,

            timestampMaximum:
                proposedCheckpoint
                    .checkpoint
                    .timestampMaximo,

            path:
                proposedCheckpointPath
        },

        integrity
    };

    console.log(
        "\nPROPUESTA DE SINCRONIZACION UBIDOTS\n"
    );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );

    if (
        !integrity.cacheUnchanged ||
        !integrity.checkpointUnchanged ||
        !integrity.pendingUnchanged
    ) {
        process.exitCode = 1;
        return;
    }

    process.exitCode = 0;
}

main().catch(error => {
    console.error(
        "\nERROR GENERANDO PROPUESTA:",
        error.message
    );

    process.exitCode = 1;
});
