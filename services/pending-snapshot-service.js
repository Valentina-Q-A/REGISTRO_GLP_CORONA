"use strict";

function cloneSnapshot(snapshot) {
    return JSON.parse(
        JSON.stringify(
            Array.isArray(snapshot)
                ? snapshot
                : []
        )
    );
}

function normalizePending(pending) {

    if (
        !pending ||
        typeof pending !== "object"
    ) {
        throw new Error(
            "PENDING_INVALID"
        );
    }

    if (!pending.id) {
        throw new Error(
            "PENDING_ID_REQUIRED"
        );
    }

    if (!pending.type) {
        throw new Error(
            "PENDING_TYPE_REQUIRED"
        );
    }

    return {
        id:
            String(pending.id).trim(),

        type:
            String(pending.type).trim(),

        description:
            pending.description
                ? String(
                    pending.description
                ).trim()
                : null,

        creation:
            pending.creation
                ? {
                    ...pending.creation
                }
                : pending.context
                    ? {
                        ...pending.context
                    }
                    : {},

        resolution:
            pending.resolution
                ? {
                    ...pending.resolution
                }
                : null
    };
}

function createPendingSnapshot({
    snapshot = [],
    pending
}) {

    const nextSnapshot =
        cloneSnapshot(snapshot);

    const normalized =
        normalizePending(pending);

    const exists =
        nextSnapshot.some(
            item =>
                item.id ===
                normalized.id
        );

    if (exists) {
        throw new Error(
            "PENDING_DUPLICATE_CREATION"
        );
    }

    nextSnapshot.push({
        ...normalized,
        resolution: null
    });

    return nextSnapshot;
}

function resolvePendingSnapshot({
    snapshot = [],
    pendingId,
    resolution
}) {

    if (!pendingId) {
        throw new Error(
            "PENDING_ID_REQUIRED"
        );
    }

    const nextSnapshot =
        cloneSnapshot(snapshot);

    const pending =
        nextSnapshot.find(
            item =>
                item.id ===
                pendingId
        );

    if (!pending) {
        throw new Error(
            "PENDING_NOT_FOUND"
        );
    }

    if (pending.resolution) {
        throw new Error(
            "PENDING_ALREADY_RESOLVED"
        );
    }

    pending.resolution = {
        ...(resolution || {})
    };

    return nextSnapshot;
}

function hasResolution(pending) {

    return Boolean(
        pending &&
        pending.resolution &&
        typeof pending.resolution === "object"
    );
}

function getActivePendings(
    snapshot = []
) {

    return snapshot.filter(
        pending =>
            !hasResolution(
                pending
            )
    );
}

function getResolvedPendings(
    snapshot = []
) {

    return snapshot.filter(
        pending =>
            hasResolution(
                pending
            )
    );
}

function findPending(
    snapshot = [],
    pendingId
) {

    return snapshot.find(
        pending =>
            pending.id === pendingId
    ) || null;
}

function summarizeSnapshot(
    snapshot = []
) {

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

    createPendingSnapshot,

    resolvePendingSnapshot,

    getActivePendings,

    getResolvedPendings,

    findPending,

    summarizeSnapshot
};