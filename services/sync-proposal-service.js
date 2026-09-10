"use strict";

const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");

function uniqueColumns(...columnGroups) {
    return [
        ...new Set(
            columnGroups
                .flat()
                .filter(Boolean)
        )
    ];
}

function normalizeRows(records, columns) {
    return records.map(record => {
        const normalized = {};

        for (const column of columns) {
            normalized[column] =
                record[column] ?? null;
        }

        return normalized;
    });
}

function writeProposedCache({
    cacheData,
    newOperationalEvents,
    sheetName,
    outputPath
}) {
    if (!cacheData?.workbook) {
        throw new Error(
            "No se recibió el libro de caché."
        );
    }

    if (!Array.isArray(cacheData.records)) {
        throw new Error(
            "La caché no contiene un arreglo de registros."
        );
    }

    if (!Array.isArray(newOperationalEvents)) {
        throw new Error(
            "Los eventos nuevos deben ser un arreglo."
        );
    }

    const eventColumns =
        newOperationalEvents.flatMap(
            record => Object.keys(record)
        );

    const columns =
        uniqueColumns(
            cacheData.columns || [],
            eventColumns
        );

    const proposedRecords = [
        ...cacheData.records,
        ...newOperationalEvents
    ];

    const normalizedRows =
        normalizeRows(
            proposedRecords,
            columns
        );

    const worksheet =
        XLSX.utils.json_to_sheet(
            normalizedRows,
            {
                header: columns
            }
        );

    cacheData.workbook.Sheets[sheetName] =
        worksheet;

    XLSX.writeFile(
        cacheData.workbook,
        outputPath
    );

    return {
        records: proposedRecords,
        columns,
        outputPath
    };
}

function buildCheckpoint({
    currentCheckpoint,
    newTechnicalRecords
}) {
    if (
        !currentCheckpoint ||
        !Array.isArray(
            currentCheckpoint.timestamps
        )
    ) {
        throw new Error(
            "El checkpoint actual no contiene timestamps."
        );
    }

    if (!Array.isArray(newTechnicalRecords)) {
        throw new Error(
            "Los registros técnicos nuevos deben ser un arreglo."
        );
    }

    const newTimestamps =
        newTechnicalRecords
            .map(record =>
                Number(record.TimestampUbidots)
            )
            .filter(timestamp =>
                Number.isFinite(timestamp) &&
                timestamp > 0
            );

    const timestamps = [
        ...new Set([
            ...currentCheckpoint.timestamps.map(Number),
            ...newTimestamps
        ])
    ].sort((a, b) => a - b);

    const sha256Timestamps =
        crypto
            .createHash("sha256")
            .update(JSON.stringify(timestamps))
            .digest("hex");

    return {
        version:
            Number(currentCheckpoint.version || 1),

        descripcion:
            "Timestamps tecnicos de Ubidots revisados por sincronizacion controlada",

        fechaCreacionISO:
            currentCheckpoint.fechaCreacionISO ||
            null,

        fechaActualizacionISO:
            new Date().toISOString(),

        cantidad:
            timestamps.length,

        timestampMinimo:
            timestamps[0] ?? null,

        timestampMaximo:
            timestamps.at(-1) ?? null,

        sha256Timestamps,

        timestamps
    };
}

function writeProposedCheckpoint({
    currentCheckpoint,
    newTechnicalRecords,
    outputPath
}) {
    const checkpoint =
        buildCheckpoint({
            currentCheckpoint,
            newTechnicalRecords
        });

    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            checkpoint,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return {
        checkpoint,
        outputPath
    };
}

function inspectProposedRecords(records) {
    const operationalKeys =
        records.map(record => [
            String(record.Fecha ?? "").trim(),
            String(record.Hora ?? "").trim()
        ].join("|"));

    const operationalKeyRepetitions =
        records.length -
        new Set(operationalKeys).size;

    const timestamps =
        records
            .map(record =>
                Number(
                    record.TimestampUbidots
                )
            )
            .filter(timestamp =>
                Number.isFinite(timestamp) &&
                timestamp > 0
            );

    const timestampCounts =
        new Map();

    for (const timestamp of timestamps) {
        timestampCounts.set(
            timestamp,
            (
                timestampCounts.get(timestamp) ||
                0
            ) + 1
        );
    }

    const duplicateTechnicalTimestamps =
        [...timestampCounts.entries()]
            .filter(([, count]) =>
                count > 1
            )
            .map(([timestamp, count]) => ({
                timestamp,
                count
            }));

    return {
        records:
            records.length,

        uniqueOperationalKeys:
            new Set(
                operationalKeys
            ).size,

        // Compatibilidad con scripts anteriores.
        // Representa repeticiones de Fecha + Hora,
        // no necesariamente duplicados técnicos.
        duplicates:
            operationalKeyRepetitions,

        operationalKeyRepetitions,

        recordsWithUbidotsTimestamp:
            timestamps.length,

        uniqueTechnicalTimestamps:
            timestampCounts.size,

        duplicateTechnicalTimestamps,

        duplicateTechnicalTimestampCount:
            duplicateTechnicalTimestamps.length
    };
}

module.exports = {
    buildCheckpoint,
    inspectProposedRecords,
    writeProposedCache,
    writeProposedCheckpoint
};
