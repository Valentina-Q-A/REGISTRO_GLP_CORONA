"use strict";

function parseSnapshot(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {

        const parsed =
            JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch {

        return [];
    }
}

function extractSnapshotFromRecord(
    record = {}
) {

    const contextJson =
        record.ContextoCompletoJSON;

    if (!contextJson) {
        return [];
    }

    try {

        const context =
            JSON.parse(contextJson);

        return parseSnapshot(
            context.pendientes_json
        );

    } catch {

        return [];
    }
}

function loadLatestSnapshot({
    records = []
} = {}) {

    if (
        !Array.isArray(records) ||
        records.length === 0
    ) {
        return {
            found: false,
            snapshot: [],
            sourceTimestamp: null
        };
    }

    const ordered =
        [...records]
            .sort(
                (a, b) =>
                    Number(
                        b.TimestampUbidots || 0
                    ) -
                    Number(
                        a.TimestampUbidots || 0
                    )
            );

    for (const record of ordered) {

        const snapshot =
            extractSnapshotFromRecord(
                record
            );

        if (Array.isArray(snapshot)) {

            const validSnapshot =
                snapshot.filter(
                    pending =>
                        pending &&
                        typeof pending === "object" &&
                        pending.id
                );

            // Snapshot vacío = estado válido
            if (
                snapshot.length === 0
            ) {
                return {
                    found: true,

                    snapshot: [],

                    sourceTimestamp:
                        record.TimestampUbidots
                };
            }

            // Snapshot con pendientes válidos
            if (
                validSnapshot.length > 0
            ) {
                return {
                    found: true,

                    snapshot: validSnapshot,

                    sourceTimestamp:
                        record.TimestampUbidots
                };
            }
        }
    }
    return {
        found: false,
        snapshot: [],
        sourceTimestamp: null
    };
}

module.exports = {

    parseSnapshot,

    extractSnapshotFromRecord,

    loadLatestSnapshot
};