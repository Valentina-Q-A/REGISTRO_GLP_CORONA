"use strict";

const {
    VARIABLES
} = require("../js/variables");

const {
    createPendingSnapshot,
    resolvePendingSnapshot,
    getActivePendings,
    getResolvedPendings
} = require("./pending-snapshot-service");

const {
    buildPendingSnapshotContext,
    serializePendingSnapshot
} = require(
    "./pending-snapshot-projection-service"
);

/**
 * ===========================================
 * CARGAR SNAPSHOT ACTUAL
 * ===========================================
 */
async function loadCurrentSnapshot({
    snapshot = []
} = {}) {

    return {
        valid: true,

        snapshot:
            Array.isArray(snapshot)
                ? snapshot
                : []
    };
}

/**
 * ===========================================
 * CREAR PENDIENTE
 * ===========================================
 */
async function createPending({
    snapshot = [],
    pending
} = {}) {

    const nextSnapshot =
        createPendingSnapshot({
            snapshot,
            pending
        });

    return {
        valid: true,

        snapshot:
            nextSnapshot,

        contextProjection:
            buildPendingSnapshotContext({
                snapshot:
                    nextSnapshot,

                pendingConfig:
                    VARIABLES.pendientes
            }),

        serializedSnapshot:
            serializePendingSnapshot({
                snapshot:
                    nextSnapshot,

                pendingConfig:
                    VARIABLES.pendientes
            })
    };
}

/**
 * ===========================================
 * RESOLVER PENDIENTE
 * ===========================================
 */
async function resolvePending({
    snapshot = [],
    pendingId,
    resolution
} = {}) {

    const nextSnapshot =
        resolvePendingSnapshot({
            snapshot,
            pendingId,
            resolution
        });

    return {
        valid: true,

        snapshot:
            nextSnapshot,

        contextProjection:
            buildPendingSnapshotContext({
                snapshot:
                    nextSnapshot,

                pendingConfig:
                    VARIABLES.pendientes
            }),

        serializedSnapshot:
            serializePendingSnapshot({
                snapshot:
                    nextSnapshot,

                pendingConfig:
                    VARIABLES.pendientes
            })
    };
}

/**
 * ===========================================
 * PROYECCION UBIDOTS
 * ===========================================
 */
function buildSnapshotProjection({
    snapshot = []
} = {}) {

    return buildPendingSnapshotContext({
        snapshot,
        pendingConfig:
            VARIABLES.pendientes
    });
}

/**
 * ===========================================
 * SERIALIZACION UBIDOTS
 * ===========================================
 */
function serializeSnapshot({
    snapshot = []
} = {}) {

    return serializePendingSnapshot({
        snapshot,
        pendingConfig:
            VARIABLES.pendientes
    });
}

/**
 * ===========================================
 * CONSULTAS
 * ===========================================
 */
function activePendings({
    snapshot = []
} = {}) {

    return getActivePendings(
        snapshot
    );
}

function resolvedPendings({
    snapshot = []
} = {}) {

    return getResolvedPendings(
        snapshot
    );
}

function summary({
    snapshot = []
} = {}) {

    const active =
        getActivePendings(
            snapshot
        );

    const resolved =
        getResolvedPendings(
            snapshot
        );

    return {
        total:
            snapshot.length,

        active:
            active.length,

        resolved:
            resolved.length
    };
}

module.exports = {

    loadCurrentSnapshot,

    createPending,

    resolvePending,

    buildSnapshotProjection,

    serializeSnapshot,

    activePendings,

    resolvedPendings,

    summary
};