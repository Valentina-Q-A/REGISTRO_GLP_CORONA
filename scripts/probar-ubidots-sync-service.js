"use strict";

const fs = require("fs");
const path = require("path");

const historySyncConfig =
    require("../config/history-sync.config");

const ubidotsSyncService =
    require("../services/ubidots-sync-service");

function parseArguments(argumentsList) {
    const options = {};

    for (const argument of argumentsList) {
        if (!argument.startsWith("--")) {
            continue;
        }

        const content =
            argument.slice(2);

        const equalIndex =
            content.indexOf("=");

        const key =
            equalIndex === -1
                ? content
                : content.slice(0, equalIndex);

        const value =
            equalIndex === -1
                ? "true"
                : content.slice(equalIndex + 1);

        options[key.toLowerCase()] =
            value;
    }

    return options;
}

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const content =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    for (const line of content.split(/\r?\n/)) {
        const trimmed =
            line.trim();

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
            trimmed
                .slice(0, equalIndex)
                .trim();

        let value =
            trimmed
                .slice(equalIndex + 1)
                .trim();

        if (
            (
                value.startsWith('"') &&
                value.endsWith('"')
            ) ||
            (
                value.startsWith("'") &&
                value.endsWith("'")
            )
        ) {
            value =
                value.slice(1, -1);
        }

        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function simplifyRecord(record) {
    return {
        Fecha:
            record.Fecha,

        Hora:
            record.Hora,

        TimestampUbidots:
            record.TimestampUbidots,

        Encargado:
            record.Encargado,

        VariablesPresentes:
            record.VariablesPresentes,

        VariablesEsperadas:
            record.VariablesEsperadas
    };
}

async function main() {
    
    const options =
    parseArguments(
        process.argv.slice(2)
    );

    const envPath =
        path.resolve(
            process.cwd(),
            ".env"
        );

    const ubidotsConfigPath =
        path.resolve(
            process.cwd(),
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
            options.pending ||
                "ubidots-pending.json"
        );

    loadEnv(envPath);

    const ubidotsConfig =
        require(ubidotsConfigPath);

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

    const result =
        await ubidotsSyncService.inspectSynchronization({
            cachePath,

            cacheSheet:
                historySyncConfig.cacheSheet,

            checkpointPath,

            pendingPath,

            conflictResolutionsPath:
                path.resolve(
                    process.cwd(),
                    "config/ubidots-conflict-resolutions.json"
                ),

            ubidotsConfig,

            token
        });

    const output = {
        mode:
            result.mode,

        synchronized:
            result.synchronized,

        canApply:
            result.canApply,

        cache:
            result.cache,

        checkpoint:
            result.checkpoint,

        ubidots:
            result.ubidots,

        relationshipBefore:
            result.relationshipBefore,
        
        conflictResolution:
            result.conflictResolution,

        summary:
            result.synchronization.summary,

        newTechnicalRecords:
            result.synchronization
                .details
                .newTechnicalRecords
                .map(simplifyRecord),

        newOperationalEvents:
            result.synchronization
                .details
                .newOperationalEvents
                .map(simplifyRecord),

        resolvedConflicts:
            result.synchronization
                .details
                .resolvedConflicts,

        unresolvedConflicts:
            result.synchronization
                .details
                .conflicts,

        integrity:
            result.integrity
    };

    console.log(
        "\nPRUEBA DEL SERVICIO DE SINCRONIZACION UBIDOTS\n"
    );

    console.log(
        JSON.stringify(
            output,
            null,
            2
        )
    );

    if (
        !result.integrity.cacheUnchanged ||
        !result.integrity
            .checkpointUnchanged ||
        !result.integrity.pendingUnchanged
    ) {
        process.exitCode = 1;
        return;
    }

    if (!result.canApply) {
        process.exitCode = 2;
        return;
    }

    process.exitCode = 0;
}

main().catch(error => {
    console.error(
        "\nERROR PROBANDO EL SERVICIO:",
        error.message
    );

    process.exitCode = 1;
});
