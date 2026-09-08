"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

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

function hashFile(filePath) {
    return crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
}

function ensureFile(filePath, description) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `No existe ${description}: ${filePath}`
        );
    }
}

function inspectExcel(filePath) {
    const workbook =
        XLSX.readFile(filePath);

    const worksheet =
        workbook.Sheets.Registros;

    if (!worksheet) {
        throw new Error(
            `El archivo no contiene la hoja Registros: ${filePath}`
        );
    }

    const records =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                defval: null,
                raw: true
            }
        );

    const operationalKeys =
        records.map(record => [
            String(record.Fecha ?? "").trim(),
            String(record.Hora ?? "").trim()
        ].join("|"));

    const visibleTimestamps =
        records
            .filter(record =>
                record.TimestampUbidots !== null &&
                record.TimestampUbidots !== undefined &&
                String(
                    record.TimestampUbidots
                ).trim() !== ""
            )
            .map(record =>
                Number(record.TimestampUbidots)
            )
            .filter(timestamp =>
                Number.isFinite(timestamp) &&
                timestamp > 0
            );

    const columns =
        records.length > 0
            ? Object.keys(records[0])
            : [];

    return {
        records:
            records.length,

        uniqueOperationalKeys:
            new Set(operationalKeys).size,

        duplicates:
            records.length -
            new Set(operationalKeys).size,

        columns:
            columns.length,

        visibleTimestamps:
            new Set(visibleTimestamps).size,

        sheetNames:
            workbook.SheetNames
    };
}

function inspectCheckpoint(filePath) {
    const checkpoint =
        JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );

    if (!Array.isArray(checkpoint.timestamps)) {
        throw new Error(
            "El checkpoint no contiene un arreglo de timestamps."
        );
    }

    const timestamps =
        checkpoint.timestamps
            .map(Number)
            .filter(timestamp =>
                Number.isFinite(timestamp) &&
                timestamp > 0
            );

    const ordered =
        [...timestamps].sort(
            (a, b) => a - b
        );

    const calculatedHash =
        crypto
            .createHash("sha256")
            .update(JSON.stringify(ordered))
            .digest("hex");

    return {
        checkpoint,
        count:
            timestamps.length,

        unique:
            new Set(timestamps).size,

        ordered:
            JSON.stringify(timestamps) ===
            JSON.stringify(ordered),

        validHash:
            checkpoint.sha256Timestamps ===
            calculatedHash,

        minimum:
            timestamps[0] ?? null,

        maximum:
            timestamps.at(-1) ?? null,

        timestampSet:
            new Set(timestamps)
    };
}

function validateRelationship(
    excelPath,
    checkpointPath
) {
    const workbook =
        XLSX.readFile(excelPath);

    const records =
        XLSX.utils.sheet_to_json(
            workbook.Sheets.Registros,
            {
                defval: null,
                raw: true
            }
        );

    const visible =
        new Set(
            records
                .filter(record =>
                    record.TimestampUbidots !== null &&
                    record.TimestampUbidots !== undefined &&
                    String(
                        record.TimestampUbidots
                    ).trim() !== ""
                )
                .map(record =>
                    Number(record.TimestampUbidots)
                )
                .filter(timestamp =>
                    Number.isFinite(timestamp) &&
                    timestamp > 0
                )
        );

    const checkpoint =
        inspectCheckpoint(
            checkpointPath
        );

    const visibleNotReviewed =
        [...visible].filter(timestamp =>
            !checkpoint.timestampSet.has(timestamp)
        );

    const reviewedNotVisible =
        [...checkpoint.timestampSet]
            .filter(timestamp =>
                !visible.has(timestamp)
            );

    return {
        visible:
            visible.size,

        reviewed:
            checkpoint.timestampSet.size,

        visibleNotReviewed,

        reviewedNotVisible:
            reviewedNotVisible.length
    };
}

function timestampSuffix() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

function restoreFiles({
    cacheBackup,
    checkpointBackup,
    cachePath,
    checkpointPath
}) {
    if (fs.existsSync(cacheBackup)) {
        fs.copyFileSync(
            cacheBackup,
            cachePath
        );
    }

    if (fs.existsSync(checkpointBackup)) {
        fs.copyFileSync(
            checkpointBackup,
            checkpointPath
        );
    }
}

function main() {
    const options =
        parseArguments(process.argv.slice(2));

    if (
        options.ayuda === "true" ||
        options.help === "true"
    ) {
        console.log(`
Uso:
  node scripts/aplicar-propuesta-sync-ubidots.js [opciones]

Opciones:
  --manifiesto=<archivo.json>
  --cache=<archivo.xlsx>
  --checkpoint=<archivo.json>
  --backups=<directorio>
  --aplicar
  --ayuda

Sin --aplicar, el comando solo valida la propuesta.
`);

        return;
    }

    const manifestPath =
        path.resolve(
            process.cwd(),
            options.manifiesto ||
                "manifiesto-aplicacion-sync-propuesto.json"
        );

    const cachePath =
        path.resolve(
            process.cwd(),
            options.cache ||
                "registros.xlsx"
        );

    const checkpointPath =
        path.resolve(
            process.cwd(),
            options.checkpoint ||
                "data/ubidots-sync-checkpoint.json"
        );

    const backupDirectory =
        path.resolve(
            process.cwd(),
            options.backups ||
                "backups-sync"
        );

    const apply =
        options.aplicar === "true";

    ensureFile(
        manifestPath,
        "el manifiesto"
    );

    ensureFile(
        cachePath,
        "la caché oficial"
    );

    ensureFile(
        checkpointPath,
        "el checkpoint oficial"
    );

    const manifest =
        JSON.parse(
            fs.readFileSync(
                manifestPath,
                "utf8"
            )
        );

    const proposedCachePath =
        path.resolve(
            process.cwd(),
            manifest.propuestaExcel.archivo
        );

    const proposedCheckpointPath =
        path.resolve(
            process.cwd(),
            manifest.propuestaCheckpoint.archivo
        );

    const pendingPath =
        path.resolve(
            process.cwd(),
            manifest.pendientes.archivo
        );

    ensureFile(
        proposedCachePath,
        "la caché propuesta"
    );

    ensureFile(
        proposedCheckpointPath,
        "el checkpoint propuesto"
    );

    ensureFile(
        pendingPath,
        "el archivo de pendientes"
    );

    const prevalidation = {
        proposedCacheHashValid:
            hashFile(proposedCachePath) ===
            manifest.propuestaExcel.sha256,

        proposedCheckpointHashValid:
            hashFile(proposedCheckpointPath) ===
            manifest.propuestaCheckpoint.sha256,

        pendingHashValid:
            hashFile(pendingPath) ===
            manifest.pendientes.sha256,

        pendingModificationAllowed:
            manifest.pendientes.modificar === false
    };

    if (
        !prevalidation.proposedCacheHashValid ||
        !prevalidation.proposedCheckpointHashValid ||
        !prevalidation.pendingHashValid ||
        !prevalidation.pendingModificationAllowed
    ) {
        console.log(
            JSON.stringify(
                {
                    applied: false,
                    prevalidation
                },
                null,
                2
            )
        );

        process.exitCode = 2;
        return;
    }

    const proposedExcel =
        inspectExcel(
            proposedCachePath
        );

    const proposedCheckpoint =
        inspectCheckpoint(
            proposedCheckpointPath
        );

    const proposedRelationship =
        validateRelationship(
            proposedCachePath,
            proposedCheckpointPath
        );

    const proposalValid =
        proposedExcel.records ===
            manifest.propuestaExcel.registros &&
        proposedExcel.uniqueOperationalKeys ===
            manifest.propuestaExcel.clavesUnicas &&
        proposedExcel.duplicates === 0 &&
        proposedExcel.columns ===
            manifest.propuestaExcel.columnas &&
        proposedExcel.visibleTimestamps ===
            manifest.propuestaExcel
                .registrosConTimestampUbidots &&
        proposedCheckpoint.count ===
            manifest.propuestaCheckpoint.cantidad &&
        proposedCheckpoint.unique ===
            manifest.propuestaCheckpoint
                .timestampsUnicos &&
        proposedCheckpoint.ordered &&
        proposedCheckpoint.validHash &&
        proposedRelationship
            .visibleNotReviewed.length === 0;

    const validationResult = {
        applied: false,
        mode:
            apply
                ? "APLICACION"
                : "VALIDACION",

        prevalidation,
        proposedExcel,
        proposedCheckpoint: {
            count:
                proposedCheckpoint.count,

            unique:
                proposedCheckpoint.unique,

            ordered:
                proposedCheckpoint.ordered,

            validHash:
                proposedCheckpoint.validHash,

            minimum:
                proposedCheckpoint.minimum,

            maximum:
                proposedCheckpoint.maximum
        },

        proposedRelationship: {
            visible:
                proposedRelationship.visible,

            reviewed:
                proposedRelationship.reviewed,

            visibleNotReviewed:
                proposedRelationship
                    .visibleNotReviewed,

            reviewedNotVisible:
                proposedRelationship
                    .reviewedNotVisible
        },

        proposalValid
    };

    if (!proposalValid) {
        console.log(
            JSON.stringify(
                validationResult,
                null,
                2
            )
        );

        process.exitCode = 2;
        return;
    }

    if (!apply) {
        console.log(
            "\nVALIDACION DE PROPUESTA APROBADA\n"
        );

        console.log(
            JSON.stringify(
                validationResult,
                null,
                2
            )
        );

        process.exitCode = 0;
        return;
    }

    fs.mkdirSync(
        backupDirectory,
        {
            recursive: true
        }
    );

    const suffix =
        timestampSuffix();

    const cacheBackup =
        path.join(
            backupDirectory,
            `registros-antes-sync-${suffix}.xlsx`
        );

    const checkpointBackup =
        path.join(
            backupDirectory,
            `checkpoint-antes-sync-${suffix}.json`
        );

    fs.copyFileSync(
        cachePath,
        cacheBackup
    );

    fs.copyFileSync(
        checkpointPath,
        checkpointBackup
    );

    const pendingHashBefore =
        hashFile(pendingPath);

    let restored = false;

    try {
        fs.copyFileSync(
            proposedCachePath,
            cachePath
        );

        fs.copyFileSync(
            proposedCheckpointPath,
            checkpointPath
        );

        const appliedExcel =
            inspectExcel(
                cachePath
            );

        const appliedCheckpoint =
            inspectCheckpoint(
                checkpointPath
            );

        const appliedRelationship =
            validateRelationship(
                cachePath,
                checkpointPath
            );

        const pendingUnchanged =
            pendingHashBefore ===
            hashFile(pendingPath);

        const postvalidationValid =
            hashFile(cachePath) ===
                manifest.propuestaExcel.sha256 &&
            hashFile(checkpointPath) ===
                manifest.propuestaCheckpoint.sha256 &&
            appliedExcel.records ===
                manifest.propuestaExcel.registros &&
            appliedExcel.uniqueOperationalKeys ===
                manifest.propuestaExcel.clavesUnicas &&
            appliedExcel.duplicates === 0 &&
            appliedCheckpoint.count ===
                manifest.propuestaCheckpoint.cantidad &&
            appliedCheckpoint.unique ===
                manifest.propuestaCheckpoint
                    .timestampsUnicos &&
            appliedCheckpoint.ordered &&
            appliedCheckpoint.validHash &&
            appliedRelationship
                .visibleNotReviewed.length === 0 &&
            pendingUnchanged;

        if (!postvalidationValid) {
            throw new Error(
                "La validación posterior no superó todos los controles."
            );
        }

        console.log(
            "\nPROPUESTA APLICADA CORRECTAMENTE\n"
        );

        console.log(
            JSON.stringify(
                {
                    applied: true,
                    restored: false,

                    appliedExcel,

                    appliedCheckpoint: {
                        count:
                            appliedCheckpoint.count,

                        unique:
                            appliedCheckpoint.unique,

                        ordered:
                            appliedCheckpoint.ordered,

                        validHash:
                            appliedCheckpoint.validHash,

                        maximum:
                            appliedCheckpoint.maximum
                    },

                    relationship: {
                        visible:
                            appliedRelationship.visible,

                        reviewed:
                            appliedRelationship.reviewed,

                        visibleNotReviewed:
                            appliedRelationship
                                .visibleNotReviewed,

                        reviewedNotVisible:
                            appliedRelationship
                                .reviewedNotVisible
                    },

                    pendingUnchanged,

                    backups: {
                        cache:
                            cacheBackup,

                        checkpoint:
                            checkpointBackup
                    }
                },
                null,
                2
            )
        );

        process.exitCode = 0;
    }
    catch (error) {
        restoreFiles({
            cacheBackup,
            checkpointBackup,
            cachePath,
            checkpointPath
        });

        restored = true;

        console.error(
            "\nERROR APLICANDO PROPUESTA:",
            error.message
        );

        console.error(
            JSON.stringify(
                {
                    applied: false,
                    restored
                },
                null,
                2
            )
        );

        process.exitCode = 1;
    }
}

try {
    main();
}
catch (error) {
    console.error(
        "\nERROR DE APLICACION:",
        error.message
    );

    process.exitCode = 1;
}
