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

function limitList(list, limit) {
    if (
        !Array.isArray(list) ||
        limit === 0 ||
        list.length <= limit
    ) {
        return list;
    }

    return list.slice(0, limit);
}

function simplifyRecord(record) {
    return {
        Fecha: record.Fecha,
        Hora: record.Hora,
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
        parseArguments(process.argv.slice(2));

    if (
        options.ayuda === "true" ||
        options.help === "true"
    ) {
        console.log(`
Uso:
  node scripts/simular-sincronizacion-ubidots.js [opciones]

Opciones:
  --config=<archivo.js>
  --cache=<archivo.xlsx>
  --env=<archivo>
  --limite=<numero>
  --json=resumen|completo|ninguno
  --ayuda

Este comando es siempre de solo lectura.
No modifica registros.xlsx ni ubidots-pending.json.
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

    const envPath =
        path.resolve(
            process.cwd(),
            options.env || ".env"
        );

    const pendingPath =
        path.resolve(
            process.cwd(),
            "ubidots-pending.json"
        );

    const checkpointPath =
        historySyncConfig.checkpointPath;

    const limit =
        Number(options.limite ?? 20);

    if (
        !Number.isInteger(limit) ||
        limit < 0
    ) {
        throw new Error(
            "--limite debe ser un entero mayor o igual a 0."
        );
    }

    const jsonMode =
        String(options.json || "resumen")
            .toLowerCase();

    if (
        ![
            "resumen",
            "completo",
            "ninguno"
        ].includes(jsonMode)
    ) {
        throw new Error(
            "--json debe ser resumen, completo o ninguno."
        );
    }

    if (!fs.existsSync(configPath)) {
        throw new Error(
            `No existe la configuración: ${configPath}`
        );
    }

    if (!fs.existsSync(cachePath)) {
        throw new Error(
            `No existe la caché: ${cachePath}`
        );
    }

    if (!fs.existsSync(pendingPath)) {
        throw new Error(
            `No existe el archivo protegido: ${pendingPath}`
        );
    }

    if (!fs.existsSync(checkpointPath)) {
        throw new Error(
            `No existe el checkpoint técnico: ${checkpointPath}`
        );
    }

    loadEnv(envPath);

    delete require.cache[
        require.resolve(configPath)
    ];

    const ubidotsConfig =
        require(configPath);

    const tokenEnvironment =
        ubidotsConfig.tokenEnv ||
        "UBIDOTS_TOKEN";

    const token =
        process.env[tokenEnvironment];

    if (!token) {
        throw new Error(
            `No se encontró ${tokenEnvironment} en el entorno o en ${envPath}.`
        );
    }

    const cacheHashBefore =
        hashFile(cachePath);

    const pendingHashBefore =
        hashFile(pendingPath);

    const cache =
        historyCacheService.readSheet(
            cachePath,
            historySyncConfig.cacheSheet
        );

    console.log(
        "\nSIMULACION DE SINCRONIZACION UBIDOTS\n"
    );

    console.log(
        `Caché actual: ${cache.records.length}`
    );

    console.log(
        `Variables consultadas: ${
            Object.keys(
                ubidotsConfig.variables || {}
            ).length
        }`
    );

    console.log(
        `Token: cargado desde ${tokenEnvironment}; valor oculto`
    );

    const history =
        await ubidotsHistoryService.fetchHistory({
            config: ubidotsConfig,
            token
        });

    const checkpoint =
        JSON.parse(
            fs.readFileSync(
                checkpointPath,
                "utf8"
            )
        );

    if (!Array.isArray(checkpoint.timestamps)) {
        throw new Error(
            "El checkpoint no contiene un arreglo de timestamps."
        );
    }

    const simulation =
        ubidotsHistoryService.simulateIncrementalSync({
            cacheRecords: cache.records,
            ubidotsRecords: history.records,
            reviewedTimestamps:
                checkpoint.timestamps,
            config: ubidotsConfig
        });

    const cacheHashAfter =
        hashFile(cachePath);

    const pendingHashAfter =
        hashFile(pendingPath);

    const integrity = {
        simulation: true,
        originalsModified: false,
        cacheUnchanged:
            cacheHashBefore === cacheHashAfter,
        pendingUnchanged:
            pendingHashBefore === pendingHashAfter,
        contextConflicts:
            history.contextConflicts.length,
        outputFilesWritten: false
    };

    console.log("\nRESUMEN");
    console.log(
        JSON.stringify(
            simulation.summary,
            null,
            2
        )
    );

    console.log("\nINTEGRIDAD");
    console.log(
        JSON.stringify(
            integrity,
            null,
            2
        )
    );

    if (jsonMode !== "ninguno") {
        const output =
            jsonMode === "completo"
                ? {
                    summary:
                        simulation.summary,

                    integrity,

                    newTechnicalRecords:
                        limitList(
                            simulation
                                .newTechnicalRecords
                                .map(simplifyRecord),
                            limit
                        ),

                    newOperationalEvents:
                        limitList(
                            simulation
                                .newOperationalEvents
                                .map(simplifyRecord),
                            limit
                        ),

                    equivalentResends:
                        limitList(
                            simulation
                                .equivalentResends,
                            limit
                        ),

                    alreadyRepresented:
                        limitList(
                            simulation
                                .alreadyRepresented,
                            limit
                        ),

                    recordsWithoutOperationalKey:
                        limitList(
                            simulation
                                .recordsWithoutOperationalKey
                                .map(simplifyRecord),
                            limit
                        ),

                    conflicts:
                        limitList(
                            simulation.conflicts,
                            limit
                        )
                }
                : {
                    summary:
                        simulation.summary,
                    integrity
                };

        console.log(
            "\n================ INICIO JSON ================"
        );

        console.log(
            JSON.stringify(output, null, 2)
        );

        console.log(
            "================= FIN JSON ================="
        );
    }

    if (
        !integrity.cacheUnchanged ||
        !integrity.pendingUnchanged
    ) {
        process.exitCode = 1;
        return;
    }

    if (
        simulation.summary.conflicts > 0 ||
        simulation.summary
            .recordsWithoutOperationalKey > 0 ||
        integrity.contextConflicts > 0
    ) {
        process.exitCode = 2;
        return;
    }

    process.exitCode = 0;
}

main().catch(error => {
    console.error(
        "\nERROR DE SIMULACION:",
        error.message
    );

    process.exitCode = 1;
});
