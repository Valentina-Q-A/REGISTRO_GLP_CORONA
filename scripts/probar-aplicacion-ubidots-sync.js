"use strict";

const fs = require("fs");
const path = require("path");

const historySyncConfig =
    require("../config/history-sync.config");

const ubidotsSyncService =
    require("../services/ubidots-sync-service");

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

async function main() {
    loadEnv(
        path.resolve(
            process.cwd(),
            ".env"
        )
    );

    const ubidotsConfig =
        require(
            path.resolve(
                process.cwd(),
                "scripts/config-ubidots-glp.js"
            )
        );

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
        await ubidotsSyncService
            .synchronizeFromUbidots({
                apply: true,

                cachePath:
                    path.resolve(
                        process.cwd(),
                        "tmp-sync-cache.xlsx"
                    ),

                cacheSheet:
                    historySyncConfig.cacheSheet,

                checkpointPath:
                    path.resolve(
                        process.cwd(),
                        "tmp-sync-checkpoint.json"
                    ),

                pendingPath:
                    path.resolve(
                        process.cwd(),
                        "tmp-sync-pending.json"
                    ),
                    
                conflictResolutionsPath:
                    path.resolve(
                        process.cwd(),
                        "config/ubidots-conflict-resolutions.json"
                    ),

                backupDirectory:
                    path.resolve(
                        process.cwd(),
                        "backups-sync-temporal"
                    ),

                ubidotsConfig,

                token
            });

    console.log(
        "\nPRUEBA DE APLICACION TEMPORAL\n"
    );

    console.log(
        JSON.stringify(
            {
                applied:
                    result.applied,

                restored:
                    result.restored,

                skipped:
                    result.skipped || false,

                synchronizedBefore:
                    result.synchronized,

                summary:
                    result.synchronization.summary,

                validation:
                    result.validation || null,

                pendingUnchanged:
                    result.pendingUnchanged,

                backups:
                    result.backups || null
            },
            null,
            2
        )
    );

    if (
        result.applied ||
        result.reason === "NO_NEW_RECORDS"
    ) {
        process.exitCode = 0;
        return;
    }

    process.exitCode = 2;
}

main().catch(error => {
    console.error(
        "\nERROR EN APLICACION TEMPORAL:",
        error.message
    );

    console.error(
        JSON.stringify(
            {
                restored:
                    Boolean(error.restored)
            },
            null,
            2
        )
    );

    process.exitCode = 1;
});