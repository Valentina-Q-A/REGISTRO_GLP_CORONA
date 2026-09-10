"use strict";

const fs = require("fs");

const SUPPORTED_RESOLUTION_TYPES =
    new Set([
        "KEEP_BOTH_DISTINCT_EVENTS"
    ]);

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\r\n/g, "\n")
        .trim();
}

function normalizeTimestamp(value) {
    const timestamp =
        Number(value);

    return Number.isFinite(timestamp) &&
        timestamp > 0
        ? timestamp
        : null;
}

function operationalKey(record) {
    return [
        normalizeText(record?.Fecha),
        normalizeText(record?.Hora)
    ].join("|");
}

function uniqueSortedTimestamps(values) {
    return [
        ...new Set(
            (values || [])
                .map(normalizeTimestamp)
                .filter(timestamp =>
                    timestamp !== null
                )
        )
    ].sort((left, right) => left - right);
}

function sameTimestampSet(left, right) {
    const normalizedLeft =
        uniqueSortedTimestamps(left);

    const normalizedRight =
        uniqueSortedTimestamps(right);

    if (
        normalizedLeft.length !==
        normalizedRight.length
    ) {
        return false;
    }

    return normalizedLeft.every(
        (timestamp, index) =>
            timestamp === normalizedRight[index]
    );
}

function loadConflictResolutions(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `No existe el archivo de resoluciones: ${filePath}`
        );
    }

    const configuration =
        JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );

    if (configuration.version !== 1) {
        throw new Error(
            "La versión del archivo de resoluciones no es compatible."
        );
    }

    if (!Array.isArray(configuration.resolutions)) {
        throw new Error(
            "El archivo de resoluciones no contiene un arreglo válido."
        );
    }

    const resolutions =
        configuration.resolutions.map(
            (resolution, index) => {
                const type =
                    normalizeText(
                        resolution.type
                    );

                const key =
                    normalizeText(
                        resolution.operationalKey
                    );

                const timestamps =
                    uniqueSortedTimestamps(
                        resolution.timestamps
                    );

                if (!key) {
                    throw new Error(
                        `La resolución ${index} no tiene operationalKey.`
                    );
                }

                if (
                    !SUPPORTED_RESOLUTION_TYPES.has(
                        type
                    )
                ) {
                    throw new Error(
                        `Tipo de resolución no soportado: ${type}`
                    );
                }

                if (timestamps.length !== 2) {
                    throw new Error(
                        `La resolución ${index} debe contener exactamente dos timestamps únicos.`
                    );
                }

                return {
                    ...resolution,
                    operationalKey: key,
                    type,
                    timestamps,
                    approved:
                        resolution.approved === true
                };
            }
        );

    const signatures =
        resolutions.map(resolution =>
            [
                resolution.operationalKey,
                resolution.type,
                resolution.timestamps.join(",")
            ].join("|")
        );

    if (
        new Set(signatures).size !==
        signatures.length
    ) {
        throw new Error(
            "El archivo contiene resoluciones duplicadas."
        );
    }

    return {
        version:
            configuration.version,

        resolutions
    };
}

function conflictTimestamps(conflict) {
    return uniqueSortedTimestamps([
        conflict?.TimestampReferencia,
        conflict?.TimestampComparado
    ]);
}

function findApprovedResolution({
    conflict,
    resolutions
}) {
    const key =
        normalizeText(
            conflict?.Clave
        );

    const timestamps =
        conflictTimestamps(
            conflict
        );

    return resolutions.find(
        resolution =>
            resolution.approved === true &&
            resolution.operationalKey === key &&
            resolution.type ===
                "KEEP_BOTH_DISTINCT_EVENTS" &&
            sameTimestampSet(
                resolution.timestamps,
                timestamps
            )
    ) || null;
}

function resolveApprovedConflicts({
    simulation,
    resolutionConfiguration
}) {
    if (!simulation) {
        throw new Error(
            "No se recibió la simulación."
        );
    }

    const resolutions =
        resolutionConfiguration?.resolutions ||
        [];

    const originalConflicts =
        Array.isArray(simulation.conflicts)
            ? simulation.conflicts
            : [];

    const newTechnicalRecords =
        Array.isArray(
            simulation.newTechnicalRecords
        )
            ? simulation.newTechnicalRecords
            : [];

    const originalOperationalEvents =
        Array.isArray(
            simulation.newOperationalEvents
        )
            ? simulation.newOperationalEvents
            : [];

    const resolvedConflicts = [];
    const unresolvedConflicts = [];

    const operationalEventsByTimestamp =
        new Map();

    for (
        const record
        of originalOperationalEvents
    ) {
        const timestamp =
            normalizeTimestamp(
                record.TimestampUbidots
            );

        if (timestamp !== null) {
            operationalEventsByTimestamp.set(
                timestamp,
                record
            );
        }
    }

    const technicalRecordsByTimestamp =
        new Map();

    for (
        const record
        of newTechnicalRecords
    ) {
        const timestamp =
            normalizeTimestamp(
                record.TimestampUbidots
            );

        if (timestamp !== null) {
            technicalRecordsByTimestamp.set(
                timestamp,
                record
            );
        }
    }

    for (const conflict of originalConflicts) {
        const resolution =
            findApprovedResolution({
                conflict,
                resolutions
            });

        if (!resolution) {
            unresolvedConflicts.push(
                conflict
            );

            continue;
        }

        const records =
            resolution.timestamps
                .map(timestamp =>
                    technicalRecordsByTimestamp.get(
                        timestamp
                    )
                )
                .filter(Boolean);

        const recordKeys =
            new Set(
                records.map(record =>
                    operationalKey(record)
                )
            );

        const resolutionValid =
            records.length ===
                resolution.timestamps.length &&
            recordKeys.size === 1 &&
            recordKeys.has(
                resolution.operationalKey
            );

        if (!resolutionValid) {
            unresolvedConflicts.push({
                ...conflict,

                ErrorResolucion:
                    "La resolución aprobada no coincide con los registros técnicos recuperados."
            });

            continue;
        }

        for (const record of records) {
            const timestamp =
                normalizeTimestamp(
                    record.TimestampUbidots
                );

            operationalEventsByTimestamp.set(
                timestamp,
                record
            );
        }

        resolvedConflicts.push({
            operationalKey:
                resolution.operationalKey,

            type:
                resolution.type,

            timestamps:
                resolution.timestamps,

            reason:
                resolution.reason || null,

            evidence:
                resolution.evidence || null
        });
    }

    const newOperationalEvents =
        [...operationalEventsByTimestamp.values()]
            .sort(
                (left, right) =>
                    Number(
                        left.TimestampUbidots
                    ) -
                    Number(
                        right.TimestampUbidots
                    )
            );

    const originalSummary =
        simulation.summary || {};

    const cacheRecords =
        Number(
            originalSummary.cacheRecords || 0
        );

    const summary = {
        ...originalSummary,

        newTechnicalRecords:
            newTechnicalRecords.length,

        newOperationalEvents:
            newOperationalEvents.length,

        conflicts:
            unresolvedConflicts.length,

        resolvedConflicts:
            resolvedConflicts.length,

        unresolvedConflicts:
            unresolvedConflicts.length,

        proposedCacheRecords:
            cacheRecords +
            newOperationalEvents.length
    };

    return {
        ...simulation,

        summary,

        newTechnicalRecords,

        newOperationalEvents,

        conflicts:
            unresolvedConflicts,

        resolvedConflicts,

        unresolvedConflicts
    };
}

module.exports = {
    conflictTimestamps,
    findApprovedResolution,
    loadConflictResolutions,
    normalizeText,
    operationalKey,
    resolveApprovedConflicts,
    sameTimestampSet,
    uniqueSortedTimestamps
};