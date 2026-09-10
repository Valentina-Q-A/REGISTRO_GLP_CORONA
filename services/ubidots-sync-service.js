"use strict";

const fs = require("fs");
const crypto = require("crypto");

const historyCacheService =
    require("./history-cache-service");

const ubidotsHistoryService =
    require("./ubidots-history-service");

const path = require("path");

const syncProposalService =
    require("./sync-proposal-service");

const conflictResolutionService =
    require("./ubidots-conflict-resolution-service");

function hashFile(filePath) {
    return crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
}

function readCheckpoint(checkpointPath) {
    if (!fs.existsSync(checkpointPath)) {
        throw new Error(
            `No existe el checkpoint: ${checkpointPath}`
        );
    }

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

    const timestamps =
        checkpoint.timestamps
            .map(Number)
            .filter(timestamp =>
                Number.isFinite(timestamp) &&
                timestamp > 0
            );

    const uniqueTimestamps =
        [...new Set(timestamps)]
            .sort((a, b) => a - b);

    return {
        checkpoint,
        timestamps: uniqueTimestamps
    };
}

function inspectCacheRelationship({
    cacheRecords,
    reviewedTimestamps
}) {
    const visibleTimestamps =
        new Set(
            cacheRecords
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

    const reviewedSet =
        new Set(
            reviewedTimestamps.map(Number)
        );

    const visibleNotReviewed =
        [...visibleTimestamps]
            .filter(timestamp =>
                !reviewedSet.has(timestamp)
            );

    const reviewedNotVisible =
        [...reviewedSet]
            .filter(timestamp =>
                !visibleTimestamps.has(timestamp)
            );

    return {
        visibleTimestamps:
            visibleTimestamps.size,

        reviewedTimestamps:
            reviewedSet.size,

        visibleNotReviewed,

        reviewedNotVisible:
            reviewedNotVisible.length
    };
}

async function inspectSynchronization({
    cachePath,
    cacheSheet,
    checkpointPath,
    pendingPath,
    conflictResolutionsPath,
    ubidotsConfig,
    token,
    fetchImpl = globalThis.fetch
}) {
    if (!fs.existsSync(cachePath)) {
        throw new Error(
            `No existe la cachÃ©: ${cachePath}`
        );
    }

    if (!fs.existsSync(pendingPath)) {
        throw new Error(
            `No existe el archivo de pendientes: ${pendingPath}`
        );
    }

    const hashesBefore = {
        cache:
            hashFile(cachePath),

        checkpoint:
            hashFile(checkpointPath),

        pending:
            hashFile(pendingPath)
    };

    const cache =
        historyCacheService.readSheet(
            cachePath,
            cacheSheet
        );

    const checkpointData =
        readCheckpoint(
            checkpointPath
        );

    const relationshipBefore =
        inspectCacheRelationship({
            cacheRecords:
                cache.records,

            reviewedTimestamps:
                checkpointData.timestamps
        });
        

    const history =
        await ubidotsHistoryService.fetchHistory({
            config:
                ubidotsConfig,

            token,

            fetchImpl
        });

    const originalSimulation =
        ubidotsHistoryService.simulateIncrementalSync({
            cacheRecords:
                cache.records,

            ubidotsRecords:
                history.records,

            reviewedTimestamps:
                checkpointData.timestamps,

            config:
                ubidotsConfig
        });

    const resolutionConfiguration =
        conflictResolutionService
            .loadConflictResolutions(
                conflictResolutionsPath
            );

    const simulation =
        conflictResolutionService
            .resolveApprovedConflicts({
                simulation:
                    originalSimulation,

                resolutionConfiguration
            });

    const hashesAfter = {
        cache:
            hashFile(cachePath),

        checkpoint:
            hashFile(checkpointPath),

        pending:
            hashFile(pendingPath)
    };

    const integrity = {
        cacheUnchanged:
            hashesBefore.cache ===
            hashesAfter.cache,

        checkpointUnchanged:
            hashesBefore.checkpoint ===
            hashesAfter.checkpoint,

        pendingUnchanged:
            hashesBefore.pending ===
            hashesAfter.pending
    };

    const unresolvedConflicts =
        simulation.unresolvedConflicts.length;

    const totalBlockingConditions =
        unresolvedConflicts +
        simulation.summary
            .recordsWithoutOperationalKey +
        history.contextConflicts.length;

    return {
        mode:
            "INSPECTION_ONLY",

        synchronized:
            simulation.summary
                .newTechnicalRecords === 0 &&
            simulation.summary
                .newOperationalEvents === 0 &&
            totalBlockingConditions === 0,

        canApply:
            totalBlockingConditions === 0,

        cache: {
            records:
                cache.records.length,

            columns:
                cache.columns.length,

            visibleTimestamps:
                relationshipBefore
                    .visibleTimestamps
        },

        checkpoint: {
            reviewedTimestamps:
                checkpointData
                    .timestamps
                    .length,

            timestampMaximum:
                checkpointData
                    .timestamps
                    .at(-1) ?? null
        },

        ubidots: {
            recoveredRecords:
                history.records.length,

            contextConflicts:
                history
                    .contextConflicts
                    .length
        },

        relationshipBefore,

        conflictResolution: {
            resolved:
                simulation
                    .resolvedConflicts
                    .length,

            unresolved:
                simulation
                    .unresolvedConflicts
                    .length,

            resolvedConflicts:
                simulation
                    .resolvedConflicts
        },

        synchronization: {
            summary:
                simulation.summary,

            details: {
                newTechnicalRecords:
                    simulation.newTechnicalRecords,

                newOperationalEvents:
                    simulation.newOperationalEvents,

                equivalentResends:
                    simulation.equivalentResends,

                alreadyRepresented:
                    simulation.alreadyRepresented,

                recordsWithoutOperationalKey:
                    simulation.recordsWithoutOperationalKey,

                conflicts:
                    simulation.unresolvedConflicts,

                resolvedConflicts:
                    simulation.resolvedConflicts
            }
        },

        integrity
    };
}

function createBackupPaths({
    backupDirectory,
    cachePath,
    checkpointPath
}) {
    const suffix =
        new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

    return {
        cacheBackup:
            path.join(
                backupDirectory,
                `${path.basename(
                    cachePath,
                    path.extname(cachePath)
                )}-antes-sync-${suffix}${path.extname(cachePath)}`
            ),

        checkpointBackup:
            path.join(
                backupDirectory,
                `${path.basename(
                    checkpointPath,
                    path.extname(checkpointPath)
                )}-antes-sync-${suffix}${path.extname(checkpointPath)}`
            )
    };
}

function restoreFromBackups({
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

function validateAppliedState({
    cachePath,
    cacheSheet,
    checkpointPath,
    conflictResolutionsPath
}) {
    const cache =
        historyCacheService.readSheet(
            cachePath,
            cacheSheet
        );

    const checkpointData =
        readCheckpoint(
            checkpointPath
        );

    const resolutionConfiguration =
        conflictResolutionService
            .loadConflictResolutions(
                conflictResolutionsPath
            );

    const relationship =
        inspectCacheRelationship({
            cacheRecords:
                cache.records,

            reviewedTimestamps:
                checkpointData.timestamps
        });

    const operationalGroups =
        new Map();

    const timestampCounts =
        new Map();

    for (const record of cache.records) {
        const operationalKey = [
            String(record.Fecha ?? "").trim(),
            String(record.Hora ?? "").trim()
        ].join("|");

        if (!operationalGroups.has(operationalKey)) {
            operationalGroups.set(
                operationalKey,
                []
            );
        }

        operationalGroups
            .get(operationalKey)
            .push(record);

        const timestamp =
            Number(record.TimestampUbidots);

        if (
            Number.isFinite(timestamp) &&
            timestamp > 0
        ) {
            timestampCounts.set(
                timestamp,
                (
                    timestampCounts.get(timestamp) ||
                    0
                ) + 1
            );
        }
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

    const operationalCollisions = [];
    const approvedOperationalCollisions = [];
    const unresolvedOperationalCollisions = [];

    for (
        const [
            operationalKey,
            records
        ]
        of operationalGroups.entries()
    ) {
        if (records.length < 2) {
            continue;
        }

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
                )
                .sort((left, right) =>
                    left - right
                );

        const collision = {
            operationalKey,
            records:
                records.length,
            timestamps
        };

        operationalCollisions.push(
            collision
        );

        const approvedResolution =
            resolutionConfiguration
                .resolutions
                .find(resolution =>
                    resolution.approved === true &&
                    resolution.type ===
                        "KEEP_BOTH_DISTINCT_EVENTS" &&
                    resolution.operationalKey ===
                        operationalKey &&
                    conflictResolutionService
                        .sameTimestampSet(
                            resolution.timestamps,
                            timestamps
                        )
                );

        const allRecordsHaveTimestamp =
            timestamps.length ===
            records.length;

        const timestampsAreUnique =
            new Set(timestamps).size ===
            timestamps.length;

        if (
            approvedResolution &&
            allRecordsHaveTimestamp &&
            timestampsAreUnique
        ) {
            approvedOperationalCollisions.push({
                ...collision,

                type:
                    approvedResolution.type,

                reason:
                    approvedResolution.reason ||
                    null
            });

            continue;
        }

        unresolvedOperationalCollisions.push({
            ...collision,

            reason:
                !allRecordsHaveTimestamp
                    ? "OPERATIONAL_COLLISION_WITHOUT_COMPLETE_TIMESTAMPS"
                    : !timestampsAreUnique
                        ? "DUPLICATE_TECHNICAL_TIMESTAMP"
                        : "OPERATIONAL_COLLISION_NOT_APPROVED"
        });
    }

    const operationalKeys =
        cache.records.map(record => [
            String(record.Fecha ?? "").trim(),
            String(record.Hora ?? "").trim()
        ].join("|"));

    return {
        cacheRecords:
            cache.records.length,

        uniqueOperationalKeys:
            new Set(
                operationalKeys
            ).size,

        operationalKeyRepetitions:
            cache.records.length -
            new Set(
                operationalKeys
            ).size,

        uniqueTechnicalTimestamps:
            timestampCounts.size,

        duplicateTechnicalTimestamps,

        duplicateTechnicalTimestampCount:
            duplicateTechnicalTimestamps.length,

        operationalCollisions:
            operationalCollisions.length,

        approvedOperationalCollisions:
            approvedOperationalCollisions.length,

        unresolvedOperationalCollisions:
            unresolvedOperationalCollisions.length,

        approvedOperationalCollisionDetails:
            approvedOperationalCollisions,

        unresolvedOperationalCollisionDetails:
            unresolvedOperationalCollisions,

        reviewedTimestamps:
            checkpointData.timestamps.length,

        visibleTimestamps:
            relationship.visibleTimestamps,

        visibleNotReviewed:
            relationship.visibleNotReviewed,

        reviewedNotVisible:
            relationship.reviewedNotVisible
    };
}

async function synchronizeFromUbidots({
    apply = false,
    cachePath,
    cacheSheet,
    checkpointPath,
    pendingPath,
    conflictResolutionsPath,
    backupDirectory,
    ubidotsConfig,
    token,
    fetchImpl = globalThis.fetch
}) {
    const inspection =
        await inspectSynchronization({
            cachePath,
            cacheSheet,
            checkpointPath,
            pendingPath,
            conflictResolutionsPath,
            ubidotsConfig,
            token,
            fetchImpl
        });

    if (!apply) {
        return {
            ...inspection,
            mode: "INSPECTION_ONLY",
            applied: false,
            restored: false
        };
    }

    if (!inspection.canApply) {
        return {
            ...inspection,
            mode: "APPLICATION",
            applied: false,
            restored: false,
            reason:
                "SYNC_CONFLICTS_DETECTED"
        };
    }

    const newTechnicalRecords =
        inspection.synchronization
            .details
            .newTechnicalRecords;

    const newOperationalEvents =
        inspection.synchronization
            .details
            .newOperationalEvents;

    if (newTechnicalRecords.length === 0) {
        return {
            ...inspection,
            mode: "APPLICATION",
            applied: false,
            restored: false,
            skipped: true,
            reason:
                "NO_NEW_RECORDS"
        };
    }

    const cache =
        historyCacheService.readSheet(
            cachePath,
            cacheSheet
        );

    const checkpointData =
        readCheckpoint(
            checkpointPath
        );

    const pendingHashBefore =
        hashFile(pendingPath);

    const resolvedBackupDirectory =
        path.resolve(
            backupDirectory ||
                "backups-sync"
        );

    fs.mkdirSync(
        resolvedBackupDirectory,
        {
            recursive: true
        }
    );

    const backupPaths =
        createBackupPaths({
            backupDirectory:
                resolvedBackupDirectory,

            cachePath,

            checkpointPath
        });

    fs.copyFileSync(
        cachePath,
        backupPaths.cacheBackup
    );

    fs.copyFileSync(
        checkpointPath,
        backupPaths.checkpointBackup
    );

    const cacheExtension =
        path.extname(cachePath);

    const checkpointExtension =
        path.extname(checkpointPath);

    const proposedCachePath =
        path.join(
            path.dirname(cachePath),
            `${path.basename(
                cachePath,
                cacheExtension
            )}.proposed${cacheExtension}`
        );

    const proposedCheckpointPath =
        path.join(
            path.dirname(checkpointPath),
            `${path.basename(
                checkpointPath,
                checkpointExtension
            )}.proposed${checkpointExtension}`
        );

    let restored = false;

    try {
        syncProposalService.writeProposedCache({
            cacheData:
                cache,

            newOperationalEvents,

            sheetName:
                cacheSheet,

            outputPath:
                proposedCachePath
        });

        syncProposalService.writeProposedCheckpoint({
            currentCheckpoint:
                checkpointData.checkpoint,

            newTechnicalRecords,

            outputPath:
                proposedCheckpointPath
        });

        fs.copyFileSync(
            proposedCachePath,
            cachePath
        );

        fs.copyFileSync(
            proposedCheckpointPath,
            checkpointPath
        );

        const validation =
            validateAppliedState({
                cachePath,
                cacheSheet,
                checkpointPath,
                conflictResolutionsPath
            });

        const expectedCacheRecords =
            inspection.cache.records +
            newOperationalEvents.length;

        const expectedReviewedTimestamps =
            inspection.checkpoint
                .reviewedTimestamps +
            newTechnicalRecords.length;

        const pendingUnchanged =
            pendingHashBefore ===
            hashFile(pendingPath);

        const valid =
            validation.cacheRecords ===
                expectedCacheRecords &&
            validation.duplicateTechnicalTimestampCount ===
                0 &&
            validation.unresolvedOperationalCollisions ===
                0 &&
            validation.reviewedTimestamps ===
                expectedReviewedTimestamps &&
            validation.visibleNotReviewed.length ===
                0 &&
            pendingUnchanged;

        if (!valid) {
            throw new Error(
                "La validación posterior de la sincronización falló."
            );
        }

        return {
            ...inspection,

            mode: "APPLICATION",

            applied: true,

            restored: false,

            skipped: false,

            validation,

            pendingUnchanged,

            backups: backupPaths
        };
    }
    catch (error) {
        restoreFromBackups({
            ...backupPaths,
            cachePath,
            checkpointPath
        });

        restored = true;

        throw Object.assign(
            new Error(
                `Sincronización restaurada: ${error.message}`
            ),
            {
                restored
            }
        );
    }
    finally {
        if (fs.existsSync(proposedCachePath)) {
            fs.unlinkSync(
                proposedCachePath
            );
        }

        if (fs.existsSync(proposedCheckpointPath)) {
            fs.unlinkSync(
                proposedCheckpointPath
            );
        }
    }
}

module.exports = {
    createBackupPaths,
    hashFile,
    inspectCacheRelationship,
    inspectSynchronization,
    readCheckpoint,
    restoreFromBackups,
    synchronizeFromUbidots,
    validateAppliedState
};
