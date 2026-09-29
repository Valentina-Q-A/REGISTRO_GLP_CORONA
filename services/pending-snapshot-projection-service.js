"use strict";

function buildPendingSnapshotContext({
    snapshot = [],
    pendingConfig
} = {}) {

    if (
        !pendingConfig ||
        typeof pendingConfig !== "object"
    ) {
        throw new Error(
            "PENDING_CONFIGURATION_MISSING"
        );
    }

    const creationFields =
        pendingConfig.context?.fields || {};

    const resolutionFields =
        pendingConfig.context?.resolution?.fields || {};

    return (
        Array.isArray(snapshot)
            ? snapshot
            : []
    ).map(pending => {

        const projection = {

            id:
                pending.id ?? null,

            type:
                pending.type ?? null,

            description:
                pending.description ?? null,

            status:
                pending.resolution
                    ? "resolved"
                    : "active"
        };

        const creationProjection = {};

        for (
            const field
            of Object.keys(creationFields)
        ) {

            creationProjection[field] =
                pending.creation?.[field] ?? null;
        }

        const resolutionProjection = {};

        for (
            const field
            of Object.keys(resolutionFields)
        ) {

            resolutionProjection[field] =
                pending.resolution?.[field] ?? null;
        }

        projection.creation =
            creationProjection;

        projection.resolution =
            pending.resolution
                ? resolutionProjection
                : null;

        return projection;
    });
}

function serializePendingSnapshot({
    snapshot = [],
    pendingConfig
} = {}) {

    return JSON.stringify(
        buildPendingSnapshotContext({
            snapshot,
            pendingConfig
        })
    );
}

module.exports = {

    buildPendingSnapshotContext,

    serializePendingSnapshot
};