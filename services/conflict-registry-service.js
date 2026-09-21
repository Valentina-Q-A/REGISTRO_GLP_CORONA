"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_REGISTRY = {
    version: 1,
    conflicts: []
};

const CONFLICT_RESOLUTIONS = {
    KEEP_BOTH_DISTINCT_EVENTS: {
        operational: true
    },

    KEEP_FIRST_DECLARATION: {
        operational: true
    },

    KEEP_LAST_DECLARATION: {
        operational: true
    },

    MANUAL_CORRECTION_REQUIRED: {
        operational: false
    },

    INVALID_OPERATIONAL_EVENT: {
        operational: false
    }
};

function loadRegistry(filePath) {
    const resolvedPath =
        path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
        return {
            ...DEFAULT_REGISTRY
        };
    }

    const content =
        fs.readFileSync(
            resolvedPath,
            "utf8"
        );

    const parsed =
        JSON.parse(content);

    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
    ) {
        throw new Error(
            "CONFLICT_REGISTRY_INVALID"
        );
    }

    return {
        version:
            Number(parsed.version) || 1,

        conflicts:
            Array.isArray(parsed.conflicts)
                ? parsed.conflicts
                : []
    };
}

function saveRegistry(
    filePath,
    registry
) {
    const resolvedPath =
        path.resolve(filePath);

    fs.writeFileSync(
        resolvedPath,
        JSON.stringify(
            registry,
            null,
            2
        ) + "\n",
        "utf8"
    );
}

function buildConflictId(
    conflict
) {
    const key =
        String(
            conflict?.Clave || ""
        ).trim();

    const type =
        String(
            conflict?.Tipo || ""
        ).trim();

    return `${type}|${key}`;
}

function registerDetectedConflicts(
    filePath,
    conflicts
) {
    if (
        !Array.isArray(conflicts) ||
        conflicts.length === 0
    ) {
        return {
            registered: 0,
            updated: 0
        };
    }

    const registry =
        loadRegistry(filePath);

    let registered = 0;
    let updated = 0;

    for (const conflict of conflicts) {
        const conflictId =
            buildConflictId(conflict);

        const timestamps =
            [
                conflict?.TimestampReferencia,
                conflict?.TimestampComparado,
                conflict?.TimestampUbidots
            ]
                .filter(value =>
                    Number.isFinite(
                        Number(value)
                    )
                )
                .map(Number);

        const differentFields =
            Array.isArray(
                conflict?.Diferencias
            )
                ? conflict.Diferencias
                    .map(item =>
                        item?.Campo || null
                    )
                    .filter(Boolean)
                : [];

        const now =
            new Date()
                .toISOString();

        const record = {
            conflictId,

            status:
                "DETECTED",

            operationalKey:
                conflict?.Clave || null,

            type:
                conflict?.Tipo || null,

            timestamps,

            differentFields,

            detectedAt:
                now,

            createdAt:
                now,

            updatedAt:
                now,

            review:
                null
        };

        const existingIndex =
            registry.conflicts.findIndex(
                existing =>
                    existing.conflictId ===
                    conflictId
            );

        if (existingIndex >= 0) {
            registry.conflicts[
                existingIndex
            ] = {
                ...registry.conflicts[
                    existingIndex
                ],

                operationalKey:
                    record.operationalKey,

                type:
                    record.type,

                timestamps:
                    record.timestamps,

                differentFields:
                    record.differentFields,

                updatedAt:
                    now
            };
            updated++;
        }
        else {
            registry.conflicts.push(
                record
            );

            registered++;
        }
    }

    saveRegistry(
        filePath,
        registry
    );

    return {
        registered,
        updated
    };
}

function updateConflictStatus(
    filePath,
    conflictId,
    status,
    review = null
) {
    const registry =
        loadRegistry(filePath);

    const index =
        registry.conflicts.findIndex(
            conflict =>
                conflict.conflictId ===
                conflictId
        );

    if (index < 0) {
        throw new Error(
            "CONFLICT_NOT_FOUND"
        );
    }

    registry.conflicts[index] = {
        ...registry.conflicts[index],

        status,

        review:
            review ||
            registry.conflicts[index]
                .review,

        updatedAt:
            new Date()
                .toISOString()
    };

    saveRegistry(
        filePath,
        registry
    );

    return registry.conflicts[index];
}

function resolveConflict(
    filePath,
    conflictId,
    resolution
) {
    const registry =
        loadRegistry(filePath);

    const index =
        registry.conflicts.findIndex(
            conflict =>
                conflict.conflictId ===
                conflictId
        );

    if (index < 0) {
        throw new Error(
            "CONFLICT_NOT_FOUND"
        );
    }

    if (
        !resolution ||
        !CONFLICT_RESOLUTIONS[
            resolution.type
        ]
    ) {
        throw new Error(
            "CONFLICT_RESOLUTION_INVALID"
        );
    }

    registry.conflicts[index] = {
        ...registry.conflicts[index],

        status:
            "RESOLVED",

        resolution: {
            ...resolution,

            operational:
                CONFLICT_RESOLUTIONS[
                    resolution.type
                ].operational,

            resolvedAt:
                new Date()
                    .toISOString()
        },

        updatedAt:
            new Date()
                .toISOString()
    };

    saveRegistry(
        filePath,
        registry
    );

    return registry.conflicts[index];
}

function approveOperationalResolution(
    filePath,
    conflictId,
    approval
) {
    const registry =
        loadRegistry(filePath);

    const index =
        registry.conflicts.findIndex(
            conflict =>
                conflict.conflictId ===
                conflictId
        );

    if (index < 0) {
        throw new Error(
            "CONFLICT_NOT_FOUND"
        );
    }

    const conflict =
        registry.conflicts[index];

    if (
        conflict.status !==
        "RESOLVED"
    ) {
        throw new Error(
            "CONFLICT_NOT_RESOLVED"
        );
    }

    registry.conflicts[index] = {
        ...conflict,

        operationalApproval: {
            approved: true,

            approvedBy:
                approval?.approvedBy ||
                null,

            approvedAt:
                new Date()
                    .toISOString(),

            note:
                approval?.note ||
                null
        },

        updatedAt:
            new Date()
                .toISOString()
    };

    saveRegistry(
        filePath,
        registry
    );

    return registry.conflicts[index];
}

function getConflictById(
    filePath,
    conflictId
) {
    const registry =
        loadRegistry(filePath);

    return (
        registry.conflicts.find(
            conflict =>
                conflict.conflictId ===
                conflictId
        ) || null
    );
}

function listConflicts(
    filePath
) {
    const registry =
        loadRegistry(filePath);

    return registry.conflicts;
}

function listActiveConflicts(
    filePath
) {
    return listConflicts(
        filePath
    ).filter(
        conflict =>
            conflict.status !==
            "RESOLVED"
    );
}

function listOperationalResolutions(
    filePath
) {
    return listConflicts(
        filePath
    ).filter(
        conflict => {
            if (
                conflict.status !==
                "RESOLVED"
            ) {
                return false;
            }

            const resolutionType =
                conflict.resolution
                    ?.type;

            return Boolean(
                CONFLICT_RESOLUTIONS[
                    resolutionType
                ]?.operational
            );
        }
    );
}

function listApprovedOperationalConflicts(
    filePath
) {
    return listConflicts(
        filePath
    ).filter(conflict => {
        if (
            conflict.status !==
            "RESOLVED"
        ) {
            return false;
        }

        const resolutionType =
            conflict.resolution?.type;

        const operational =
            Boolean(
                CONFLICT_RESOLUTIONS[
                    resolutionType
                ]?.operational
            );

        return (
            operational &&
            conflict
                ?.operationalApproval
                ?.approved === true
        );
    });
}

function getOperationalResolution(
    filePath,
    operationalKey
) {
    return (
        listOperationalResolutions(
            filePath
        ).find(
            conflict =>
                conflict.operationalKey ===
                operationalKey
        ) || null
    );
}


function hasOperationalResolution(
    filePath,
    operationalKey
) {
    return Boolean(
        getOperationalResolution(
            filePath,
            operationalKey
        )
    );
}

module.exports = {
    loadRegistry,
    saveRegistry,
    registerDetectedConflicts,
    updateConflictStatus,
    getConflictById,
    listConflicts,
    resolveConflict,
    approveOperationalResolution,
    listActiveConflicts,
    listOperationalResolutions,
    listApprovedOperationalConflicts,
    getOperationalResolution,
    hasOperationalResolution,
    CONFLICT_RESOLUTIONS
};