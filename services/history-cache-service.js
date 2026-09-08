"use strict";

const fs = require("fs");
const XLSX = require("xlsx");

function readSheet(filePath, sheetName) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `No existe el archivo: ${filePath}`
        );
    }

    const workbook = XLSX.readFile(
        filePath,
        {
            cellDates: false
        }
    );

    const worksheet =
        workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error(
            `No existe la hoja "${sheetName}" en ${filePath}`
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

    const matrix =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                header: 1,
                defval: null,
                raw: true
            }
        );

    const columns =
        Array.isArray(matrix[0])
            ? matrix[0]
                .map(value =>
                    value === null ||
                    value === undefined
                        ? ""
                        : String(value).trim()
                )
                .filter(Boolean)
            : [];

    return {
        workbook,
        worksheet,
        records,
        columns
    };
}

function normalizeKeyPart(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}

function buildOperationalKey(record) {
    return [
        normalizeKeyPart(record.Fecha),
        normalizeKeyPart(record.Hora)
    ].join("|");
}

function inspectHistory(config) {
    const historical =
        readSheet(
            config.historicalBasePath,
            config.historicalSheet
        );

    const cache =
        readSheet(
            config.cachePath,
            config.cacheSheet
        );

    const historicalKeys =
        new Set(
            historical.records.map(
                buildOperationalKey
            )
        );

    const cacheKeys =
        new Set(
            cache.records.map(
                buildOperationalKey
            )
        );

    const cacheTimestamps =
        cache.records.filter(record =>
            record.TimestampUbidots !== null &&
            record.TimestampUbidots !== undefined &&
            record.TimestampUbidots !== ""
        );

    return {
        historical: {
            records:
                historical.records.length,

            uniqueOperationalKeys:
                historicalKeys.size,

            duplicates:
                historical.records.length -
                historicalKeys.size,

            columns:
                historical.columns.length
        },

        cache: {
            records:
                cache.records.length,

            uniqueOperationalKeys:
                cacheKeys.size,

            duplicates:
                cache.records.length -
                cacheKeys.size,

            columns:
                cache.columns.length,

            recordsWithUbidotsTimestamp:
                cacheTimestamps.length
        }
    };
}

module.exports = {
    readSheet,
    buildOperationalKey,
    inspectHistory
};
