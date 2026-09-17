"use strict";
const MAX_PROJECTION_JSON_LENGTH =
    250000;

const MAX_CREATED_PER_EVENT =
    100;

const MAX_RESOLVED_PER_EVENT =
    100;

const MAX_ACTIVE_SNAPSHOT_PER_EVENT =
    500;

function isObject(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text || null;
}

function normalizeTimestamp(value) {
    if (
        value === null ||
        value === undefined ||
        (
            typeof value === "string" &&
            value.trim() === ""
        )
    ) {
        return null;
    }

    const timestamp =
        Number(value);

    return (
        Number.isFinite(timestamp) &&
        timestamp > 0
    )
        ? timestamp
        : null;
}

function normalizeProjectionArray(
    value,
    {
        allowMissing = false,
        maxItems
    } = {}
) {
    if (
        value === null ||
        value === undefined ||
        (
            typeof value === "string" &&
            value.trim() === ""
        )
    ) {
        return allowMissing
            ? {
                valid: true,
                value: [],
                missing: true,
                reason: null
            }
            : {
                valid: false,
                value: null,
                missing: true,
                reason:
                    "PENDING_EVENT_PROJECTION_MISSING"
            };
    }

    let parsedValue =
        value;

    if (typeof value === "string") {
        const text =
            value.trim();

        if (
            text.length >
            MAX_PROJECTION_JSON_LENGTH
        ) {
            return {
                valid: false,
                value: null,
                missing: false,
                reason:
                    "PENDING_EVENT_PROJECTION_TOO_LARGE"
            };
        }

        try {
            parsedValue =
                JSON.parse(text);
        } catch (error) {
            return {
                valid: false,
                value: null,
                missing: false,
                reason:
                    "PENDING_EVENT_PROJECTION_JSON_INVALID"
            };
        }
    }

    if (!Array.isArray(parsedValue)) {
        return {
            valid: false,
            value: null,
            missing: false,
            reason:
                "PENDING_EVENT_PROJECTION_INVALID"
        };
    }

    if (
        Number.isInteger(maxItems) &&
        maxItems >= 0 &&
        parsedValue.length > maxItems
    ) {
        return {
            valid: false,
            value: null,
            missing: false,
            reason:
                "PENDING_EVENT_PROJECTION_TOO_MANY_ITEMS"
        };
    }

    return {
        valid: true,

        value:
            parsedValue.map(item =>
                isObject(item)
                    ? { ...item }
                    : item
            ),

        missing: false,
        reason: null
    };
}

function addDiagnostic(
    diagnostics,
    code,
    detail = null
) {
    diagnostics.push({
        code,
        detail:
            detail &&
            typeof detail === "object"
                ? { ...detail }
                : detail
    });
}

function normalizeLifecycleContract(
    pendingContract
) {
    if (
        !isObject(pendingContract) ||
        pendingContract.valid !== true ||
        !isObject(
            pendingContract.record
        ) ||
        !isObject(
            pendingContract.projection
        ) ||
        !Array.isArray(
            pendingContract.creationFields
        ) ||
        !Array.isArray(
            pendingContract.resolutionFields
        ) ||
        !Array.isArray(
            pendingContract.options
        )
    ) {
        return {
            valid: false,
            contract: null,
            errors: [
                "PENDING_LIFECYCLE_CONTRACT_INVALID"
            ]
        };
    }

    const {
        idColumn,
        typeColumn,
        descriptionColumn
    } = pendingContract.record;

    const {
        protocolVersion,
        protocolField,
        createdField,
        resolvedField,
        activeSnapshotField
    } = pendingContract.projection;

    const recordValues = [
        idColumn,
        typeColumn,
        descriptionColumn
    ].map(normalizeText);

    const projectionValues = [
        protocolVersion,
        protocolField,
        createdField,
        resolvedField,
        activeSnapshotField
    ].map(normalizeText);

    if (
        recordValues.some(
            value => value === null
        ) ||
        projectionValues.some(
            value => value === null
        ) ||
        new Set(recordValues).size !==
            recordValues.length ||
        new Set(
            projectionValues.slice(1)
        ).size !==
            projectionValues.slice(1).length
    ) {
        return {
            valid: false,
            contract: null,
            errors: [
                "PENDING_LIFECYCLE_CONTRACT_INVALID"
            ]
        };
    }

    const creationFields =
        pendingContract.creationFields
            .map(field => ({
                targetField:
                    normalizeText(
                        field?.targetField
                    ),

                sourceVariable:
                    normalizeText(
                        field?.sourceVariable
                    )
            }));

    const resolutionFields =
        pendingContract.resolutionFields
            .map(field => ({
                targetField:
                    normalizeText(
                        field?.targetField
                    ),

                sourceVariable:
                    normalizeText(
                        field?.sourceVariable
                    )
            }));

    if (
        creationFields.some(field =>
            !field.targetField ||
            !field.sourceVariable
        ) ||
        resolutionFields.some(field =>
            !field.targetField ||
            !field.sourceVariable
        )
    ) {
        return {
            valid: false,
            contract: null,
            errors: [
                "PENDING_LIFECYCLE_CONTRACT_INVALID"
            ]
        };
    }

    const optionValues =
        new Set();

    const options = [];

    for (
        const option
        of pendingContract.options
    ) {
        const value =
            normalizeText(
                option?.value
            );

        const label =
            normalizeText(
                option?.label
            );

        if (
            !value ||
            !label ||
            optionValues.has(value)
        ) {
            return {
                valid: false,
                contract: null,
                errors: [
                    "PENDING_LIFECYCLE_CONTRACT_INVALID"
                ]
            };
        }

        optionValues.add(value);

        options.push({
            value,
            label,

            descriptionField:
                normalizeText(
                    option.descriptionField
                )
        });
    }

    return {
        valid: true,

        contract: {
            record: {
                idColumn:
                    recordValues[0],

                typeColumn:
                    recordValues[1],

                descriptionColumn:
                    recordValues[2]
            },

            projection: {
                protocolVersion:
                    projectionValues[0],

                protocolField:
                    projectionValues[1],

                createdField:
                    projectionValues[2],

                resolvedField:
                    projectionValues[3],

                activeSnapshotField:
                    projectionValues[4]
            },

            creationFields,
            resolutionFields,
            options
        },

        errors: []
    };
}

function normalizeCreatedPending(
    pending,
    event,
    contract
) {
    if (!isObject(pending)) {
        return null;
    }

    const id =
        normalizeText(
            pending.id
        );

    const type =
        normalizeText(
            pending.type
        );

    const option =
        contract.options.find(
            candidate =>
                candidate.value === type
        );

    if (
        !id ||
        !type ||
        !option
    ) {
        return null;
    }

    const description =
        normalizeText(
            pending.description
        ) ||
        option.label;

    const creation = {};

    for (
        const field
        of contract.creationFields
    ) {
        creation[field.targetField] =
            pending.creation?.[
                field.targetField
            ] ??
            pending.context?.[
                field.targetField
            ] ??
            null;
    }

    return {
        id,
        type,
        description,

        status:
            "active",

        creation,

        resolution:
            null,

        createdAt:
            event.timestamp,

        createdInEventId:
            event.eventId
    };
}

function normalizeResolution(
    resolution,
    event,
    contract
) {
    if (!isObject(resolution)) {
        return null;
    }

    const id =
        normalizeText(
            resolution.id
        );

    if (!id) {
        return null;
    }

    const resolutionContext = {};

    for (
        const field
        of contract.resolutionFields
    ) {
        resolutionContext[
            field.targetField
        ] =
            resolution.resolution?.[
                field.targetField
            ] ??
            resolution.context?.[
                field.targetField
            ] ??
            null;
    }

    return {
        id,

        resolution:
            resolutionContext,

        resolvedAt:
            event.timestamp,

        resolvedInEventId:
            event.eventId
    };
}

function normalizeSnapshotPending(
    pending
) {
    if (!isObject(pending)) {
        return null;
    }

    const id =
        normalizeText(
            pending.id
        );

    const type =
        normalizeText(
            pending.type
        );

    const description =
        normalizeText(
            pending.description
        );

    if (!id || !type) {
        return null;
    }

    return {
        id,
        type,
        description,
        creation:
            isObject(pending.creation)
                ? { ...pending.creation }
                : {}
    };
}

function normalizeLifecycleEvent(
    sourceEvent,
    contract
) {
    if (!isObject(sourceEvent)) {
        return null;
    }

    const timestamp =
        normalizeTimestamp(
            sourceEvent.TimestampUbidots ??
            sourceEvent.timestamp
        );

    const eventId =
        normalizeText(
            sourceEvent.eventId
        ) ||
        (
            timestamp !== null
                ? `timestamp-${timestamp}`
                : null
        );

    if (!timestamp || !eventId) {
        return null;
    }

    const projection =
        contract.projection;

    const protocolVersion =
        normalizeText(
            sourceEvent[
                projection.protocolField
            ]
        );

    const hasCreatedProjection =
        Object.prototype
            .hasOwnProperty
            .call(
                sourceEvent,
                projection.createdField
            );

    const hasResolvedProjection =
        Object.prototype
            .hasOwnProperty
            .call(
                sourceEvent,
                projection.resolvedField
            );

    const hasSnapshotProjection =
        Object.prototype
            .hasOwnProperty
            .call(
                sourceEvent,
                projection.activeSnapshotField
            );

    const hasAnyLifecycleProjection =
        hasCreatedProjection ||
        hasResolvedProjection ||
        hasSnapshotProjection;

    if (
        !protocolVersion &&
        !hasAnyLifecycleProjection
    ) {
        return {
            valid: true,
            legacy: true,
            timestamp,
            eventId,
            created: [],
            resolved: [],
            activeSnapshot: [],
            reason: null
        };
    }

    if (
        protocolVersion !==
        projection.protocolVersion
    ) {
        return {
            valid: false,
            legacy: false,
            timestamp,
            eventId,
            reason:
                "PENDING_PROTOCOL_INVALID"
        };
    }

    const createdProjection =
        normalizeProjectionArray(
            sourceEvent[
                projection.createdField
            ],
            {
                allowMissing: false,
                maxItems:
                    MAX_CREATED_PER_EVENT
            }
        );

    const resolvedProjection =
        normalizeProjectionArray(
            sourceEvent[
                projection.resolvedField
            ],
            {
                allowMissing: false,
                maxItems:
                    MAX_RESOLVED_PER_EVENT
            }
        );

    const snapshotProjection =
        normalizeProjectionArray(
            sourceEvent[
                projection.activeSnapshotField
            ],
            {
                allowMissing: false,
                maxItems:
                    MAX_ACTIVE_SNAPSHOT_PER_EVENT
            }
        );

    const invalidProjection = [
        createdProjection,
        resolvedProjection,
        snapshotProjection
    ].find(projectionResult =>
        projectionResult.valid !== true
    );

    if (invalidProjection) {
        return {
            valid: false,
            legacy: false,
            timestamp,
            eventId,
            reason:
                invalidProjection.reason
        };
    }

    const createdSource =
        createdProjection.value;

    const resolvedSource =
        resolvedProjection.value;

    const snapshotSource =
        snapshotProjection.value;

    const event = {
        timestamp,
        eventId
    };

    const created =
        createdSource.map(pending =>
            normalizeCreatedPending(
                pending,
                event,
                contract
            )
        );

    const resolved =
        resolvedSource.map(resolution =>
            normalizeResolution(
                resolution,
                event,
                contract
            )
        );

    const activeSnapshot =
        snapshotSource.map(
            normalizeSnapshotPending
        );

    if (
        created.some(
            pending => pending === null
        ) ||
        resolved.some(
            resolution =>
                resolution === null
        ) ||
        activeSnapshot.some(
            pending => pending === null
        )
    ) {
        return {
            valid: false,
            timestamp,
            eventId,
            reason:
                "PENDING_EVENT_PROJECTION_INVALID"
        };
    }

    return {
        valid: true,
        legacy: false,
        timestamp,
        eventId,
        created,
        resolved,
        activeSnapshot,
        reason: null
    };
}

function buildActiveSnapshot(state) {
    return [
        ...state.values()
    ]
        .filter(
            pending =>
                pending.status ===
                    "active"
        )
        .sort((left, right) =>
            left.id.localeCompare(
                right.id
            )
        )
        .map(pending => ({
            id:
                pending.id,

            type:
                pending.type,

            description:
                pending.description,

            creation: {
                ...pending.creation
            }
        }));
}

function snapshotsMatch(
    expected,
    actual
) {
    const expectedIds =
        expected
            .map(pending =>
                pending.id
            )
            .sort();

    const actualIds =
        actual
            .map(pending =>
                pending.id
            )
            .sort();

    return (
        expectedIds.length ===
            actualIds.length &&
        expectedIds.every(
            (id, index) =>
                id === actualIds[index]
        )
    );
}

function invalidPlanningResult(
    errors,
    diagnostics = []
) {
    return {
        valid: false,
        nextState: null,
        lifecycleEvent: null,
        contextProjection: null,
        dashboardSnapshot: null,
        diagnostics:
            Array.isArray(diagnostics)
                ? diagnostics.map(
                    diagnostic => ({
                        ...diagnostic
                    })
                )
                : [],
        errors: [
            ...new Set(
                Array.isArray(errors)
                    ? errors
                    : [
                        "PENDING_LIFECYCLE_PLANNING_INVALID"
                    ]
            )
        ]
    };
}

function normalizeCurrentPendingState(
    currentState
) {
    if (
        currentState === null ||
        currentState === undefined
    ) {
        return {
            valid: true,
            allPendings: [],
            errors: []
        };
    }

    if (!isObject(currentState)) {
        return {
            valid: false,
            allPendings: [],
            errors: [
                "PENDING_CURRENT_STATE_INVALID"
            ]
        };
    }

    const sourcePendings =
        Array.isArray(
            currentState.allPendings
        )
            ? currentState.allPendings
            : [
                ...(
                    Array.isArray(
                        currentState.activePendings
                    )
                        ? currentState.activePendings
                        : []
                ),
                ...(
                    Array.isArray(
                        currentState.resolvedPendings
                    )
                        ? currentState.resolvedPendings
                        : []
                )
            ];

    const normalizedPendings = [];
    const pendingIds = new Set();

    for (const sourcePending of sourcePendings) {
        if (!isObject(sourcePending)) {
            return {
                valid: false,
                allPendings: [],
                errors: [
                    "PENDING_CURRENT_STATE_INVALID"
                ]
            };
        }

        const id =
            normalizeText(
                sourcePending.id
            );

        const type =
            normalizeText(
                sourcePending.type
            );

        const description =
            normalizeText(
                sourcePending.description
            );

        const status =
            normalizeText(
                sourcePending.status
            );

        if (
            !id ||
            !type ||
            ![
                "active",
                "resolved"
            ].includes(status)
        ) {
            return {
                valid: false,
                allPendings: [],
                errors: [
                    "PENDING_CURRENT_STATE_INVALID"
                ]
            };
        }

        if (pendingIds.has(id)) {
            return {
                valid: false,
                allPendings: [],
                errors: [
                    "PENDING_CURRENT_STATE_DUPLICATE"
                ]
            };
        }

        pendingIds.add(id);

        normalizedPendings.push({
            ...sourcePending,

            id,
            type,
            description,

            status,

            creation:
                isObject(
                    sourcePending.creation
                )
                    ? {
                        ...sourcePending.creation
                    }
                    : {},

            resolution:
                isObject(
                    sourcePending.resolution
                )
                    ? {
                        ...sourcePending.resolution
                    }
                    : null
        });
    }

    return {
        valid: true,
        allPendings:
            normalizedPendings,
        errors: []
    };
}

function planPendingLifecycleEvent({
    currentState = null,
    pendingCreations = [],
    pendingResolutions = [],
    event,
    pendingContract
} = {}) {
    const normalizedContract =
        normalizeLifecycleContract(
            pendingContract
        );

    if (!normalizedContract.valid) {
        return invalidPlanningResult(
            normalizedContract.errors
        );
    }

    const contract =
        normalizedContract.contract;

    if (
        !event ||
        !isObject(event)
    ) {
        return invalidPlanningResult([
            "PENDING_EVENT_METADATA_INVALID"
        ]);
    }

    const timestamp =
        normalizeTimestamp(
            event.TimestampUbidots ??
            event.timestamp
        );

    const eventId =
        normalizeText(
            event.eventId
        );

    if (
        timestamp === null ||
        !eventId
    ) {
        return invalidPlanningResult([
            "PENDING_EVENT_METADATA_INVALID"
        ]);
    }

    if (
        !Array.isArray(
            pendingCreations
        )
    ) {
        return invalidPlanningResult([
            "PENDING_CREATIONS_INVALID"
        ]);
    }

    if (
        !Array.isArray(
            pendingResolutions
        )
    ) {
        return invalidPlanningResult([
            "PENDING_RESOLUTIONS_INVALID"
        ]);
    }

    if (
        pendingCreations.length >
            MAX_CREATED_PER_EVENT ||
        pendingResolutions.length >
            MAX_RESOLVED_PER_EVENT
    ) {
        return invalidPlanningResult([
            "PENDING_EVENT_PROJECTION_TOO_MANY_ITEMS"
        ]);
    }

    const normalizedState =
        normalizeCurrentPendingState(
            currentState
        );

    if (!normalizedState.valid) {
        return invalidPlanningResult(
            normalizedState.errors
        );
    }

    const state =
        new Map(
            normalizedState
                .allPendings
                .map(pending => [
                    pending.id,
                    {
                        ...pending,

                        creation: {
                            ...pending.creation
                        },

                        resolution:
                            pending.resolution
                                ? {
                                    ...pending
                                        .resolution
                                }
                                : null
                    }
                ])
        );

    const normalizedEvent = {
        timestamp,
        eventId
    };

    const normalizedCreations =
        pendingCreations.map(
            pending =>
                normalizeCreatedPending(
                    pending,
                    normalizedEvent,
                    contract
                )
        );

    if (
        normalizedCreations.some(
            pending =>
                pending === null
        )
    ) {
        return invalidPlanningResult([
            "PENDING_CREATION_INVALID"
        ]);
    }

    const normalizedResolutions =
        pendingResolutions.map(
            resolution =>
                normalizeResolution(
                    resolution,
                    normalizedEvent,
                    contract
                )
        );

    if (
        normalizedResolutions.some(
            resolution =>
                resolution === null
        )
    ) {
        return invalidPlanningResult([
            "PENDING_RESOLUTION_INVALID"
        ]);
    }

    const creationIds =
        new Set();

    for (
        const pending
        of normalizedCreations
    ) {
        if (
            creationIds.has(
                pending.id
            )
        ) {
            return invalidPlanningResult([
                "PENDING_CREATION_DUPLICATE"
            ]);
        }

        creationIds.add(
            pending.id
        );

        if (state.has(pending.id)) {
            return invalidPlanningResult([
                "PENDING_DUPLICATE_CREATION"
            ]);
        }
    }

    const resolutionIds =
        new Set();

    for (
        const resolution
        of normalizedResolutions
    ) {
        if (
            resolutionIds.has(
                resolution.id
            )
        ) {
            return invalidPlanningResult([
                "PENDING_RESOLUTION_DUPLICATE"
            ]);
        }

        resolutionIds.add(
            resolution.id
        );
    }

    for (
        const pending
        of normalizedCreations
    ) {
        state.set(
            pending.id,
            {
                ...pending,

                creation: {
                    ...pending.creation
                }
            }
        );
    }

    for (
        const resolution
        of normalizedResolutions
    ) {
        const current =
            state.get(
                resolution.id
            );

        if (!current) {
            return invalidPlanningResult([
                "PENDING_NOT_FOUND"
            ]);
        }

        if (
            current.status ===
                "resolved"
        ) {
            return invalidPlanningResult([
                "PENDING_ALREADY_RESOLVED"
            ]);
        }

        state.set(
            resolution.id,
            {
                ...current,

                status:
                    "resolved",

                resolution: {
                    ...resolution
                        .resolution
                },

                resolvedAt:
                    resolution.resolvedAt,

                resolvedInEventId:
                    resolution
                        .resolvedInEventId
            }
        );
    }

    const allPendings =
        [...state.values()]
            .sort((left, right) =>
                left.id.localeCompare(
                    right.id
                )
            )
            .map(pending => ({
                ...pending,

                creation: {
                    ...pending.creation
                },

                resolution:
                    pending.resolution
                        ? {
                            ...pending
                                .resolution
                        }
                        : null
            }));

    const activePendings =
        allPendings.filter(
            pending =>
                pending.status ===
                    "active"
        );

    const resolvedPendings =
        allPendings.filter(
            pending =>
                pending.status ===
                    "resolved"
        );

    if (
        activePendings.length >
            MAX_ACTIVE_SNAPSHOT_PER_EVENT
    ) {
        return invalidPlanningResult([
            "PENDING_EVENT_PROJECTION_TOO_MANY_ITEMS"
        ]);
    }

    const activeSnapshot =
        buildActiveSnapshot(
            state
        );

    const createdProjection =
        normalizedCreations.map(
            pending => ({
                id:
                    pending.id,

                type:
                    pending.type,

                description:
                    pending.description,

                creation: {
                    ...pending.creation
                },

                createdAt:
                    pending.createdAt,

                createdInEventId:
                    pending.createdInEventId
            })
        );

    const resolvedProjection =
        normalizedResolutions.map(
            resolution => ({
                id:
                    resolution.id,

                resolution: {
                    ...resolution
                        .resolution
                },

                resolvedAt:
                    resolution.resolvedAt,

                resolvedInEventId:
                    resolution
                        .resolvedInEventId
            })
        );

    const projection =
        contract.projection;

    const contextProjection = {
        [projection.protocolField]:
            projection.protocolVersion,

        [projection.createdField]:
            JSON.stringify(
                createdProjection
            ),

        [projection.resolvedField]:
            JSON.stringify(
                resolvedProjection
            ),

        [projection.activeSnapshotField]:
            JSON.stringify(
                activeSnapshot
            )
    };

    return {
        valid: true,

        nextState: {
            activePendings,
            resolvedPendings,
            allPendings
        },

        lifecycleEvent: {
            protocolVersion:
                projection
                    .protocolVersion,

            eventId,
            timestamp,

            created:
                createdProjection,

            resolved:
                resolvedProjection,

            activeSnapshot
        },

        contextProjection,

        dashboardSnapshot: {
            activeCount:
                activeSnapshot.length,

            activePendings:
                activeSnapshot.map(
                    pending => ({
                        ...pending,

                        creation: {
                            ...pending.creation
                        }
                    })
                )
        },

        diagnostics: [],
        errors: []
    };
}

function reconstructPendingLifecycle({
    events,
    pendingContract,
    contextConflicts = []
} = {}) {
    const normalizedContract =
        normalizeLifecycleContract(
            pendingContract
        );

    if (!normalizedContract.valid) {
        return {
            valid: false,
            protocolVersion: null,
            activePendings: [],
            resolvedPendings: [],
            allPendings: [],
            processedEvents: 0,
            ignoredEvents: 0,
            legacyEvents: 0,
            diagnostics: [],
            errors:
                normalizedContract.errors
        };
    }

    const contract =
        normalizedContract.contract;

    const sourceEvents =
        Array.isArray(events)
            ? events
            : [];

    const conflicts =
        new Set(
            (
                Array.isArray(
                    contextConflicts
                )
                    ? contextConflicts
                    : []
            )
                .map(conflict =>
                    normalizeTimestamp(
                        conflict
                            ?.TimestampUbidots
                    )
                )
                .filter(Boolean)
        );

    const normalizedEvents =
        sourceEvents
            .map(sourceEvent =>
                normalizeLifecycleEvent(
                    sourceEvent,
                    contract
                )
            )
            .sort((left, right) => {
                const leftTimestamp =
                    left?.timestamp ??
                    Number.MAX_SAFE_INTEGER;

                const rightTimestamp =
                    right?.timestamp ??
                    Number.MAX_SAFE_INTEGER;

                if (
                    leftTimestamp !==
                    rightTimestamp
                ) {
                    return (
                        leftTimestamp -
                        rightTimestamp
                    );
                }

                return String(
                    left?.eventId ?? ""
                ).localeCompare(
                    String(
                        right?.eventId ?? ""
                    )
                );
            });

    const state =
        new Map();

    const processedEventIds =
        new Set();

    const diagnostics = [];

    let processedEvents = 0;
    let ignoredEvents = 0;
    let legacyEvents = 0;

    for (
        const event
        of normalizedEvents
    ) {
        if (!event) {
            ignoredEvents++;

            addDiagnostic(
                diagnostics,
                "PENDING_EVENT_INVALID"
            );

            continue;
        }

        if (
            event.valid === true &&
            event.legacy === true
        ) {
            legacyEvents++;
            continue;
        }

        if (
            conflicts.has(
                event.timestamp
            )
        ) {
            ignoredEvents++;

            addDiagnostic(
                diagnostics,
                "PENDING_CONTEXT_CONFLICT",
                {
                    timestamp:
                        event.timestamp,

                    eventId:
                        event.eventId
                }
            );

            continue;
        }

        if (!event.valid) {
            ignoredEvents++;

            addDiagnostic(
                diagnostics,
                event.reason,
                {
                    timestamp:
                        event.timestamp,

                    eventId:
                        event.eventId
                }
            );

            continue;
        }

        if (
            processedEventIds.has(
                event.eventId
            )
        ) {
            ignoredEvents++;

            addDiagnostic(
                diagnostics,
                "PENDING_EVENT_DUPLICATE",
                {
                    eventId:
                        event.eventId
                }
            );

            continue;
        }

        processedEventIds.add(
            event.eventId
        );

        for (
            const pending
            of event.created
        ) {
            if (state.has(pending.id)) {
                addDiagnostic(
                    diagnostics,
                    "PENDING_DUPLICATE_CREATION",
                    {
                        pendingId:
                            pending.id,

                        eventId:
                            event.eventId
                    }
                );

                continue;
            }

            state.set(
                pending.id,
                pending
            );
        }

        for (
            const resolution
            of event.resolved
        ) {
            const current =
                state.get(
                    resolution.id
                );

            if (!current) {
                addDiagnostic(
                    diagnostics,
                    "PENDING_NOT_FOUND",
                    {
                        pendingId:
                            resolution.id,

                        eventId:
                            event.eventId
                    }
                );

                continue;
            }

            if (
                current.status ===
                    "resolved"
            ) {
                addDiagnostic(
                    diagnostics,
                    "PENDING_ALREADY_RESOLVED",
                    {
                        pendingId:
                            resolution.id,

                        eventId:
                            event.eventId
                    }
                );

                continue;
            }

            state.set(
                resolution.id,
                {
                    ...current,

                    status:
                        "resolved",

                    resolution: {
                        ...resolution
                            .resolution
                    },

                    resolvedAt:
                        resolution
                            .resolvedAt,

                    resolvedInEventId:
                        resolution
                            .resolvedInEventId
                }
            );
        }

        const reconstructedSnapshot =
            buildActiveSnapshot(
                state
            );

        if (
            !snapshotsMatch(
                event.activeSnapshot,
                reconstructedSnapshot
            )
        ) {
            addDiagnostic(
                diagnostics,
                "PENDING_SNAPSHOT_MISMATCH",
                {
                    eventId:
                        event.eventId,

                    timestamp:
                        event.timestamp,

                    expectedIds:
                        event
                            .activeSnapshot
                            .map(
                                pending =>
                                    pending.id
                            )
                            .sort(),

                    reconstructedIds:
                        reconstructedSnapshot
                            .map(
                                pending =>
                                    pending.id
                            )
                            .sort()
                }
            );
        }

        processedEvents++;
    }

    const allPendings =
        [...state.values()]
            .sort((left, right) =>
                left.id.localeCompare(
                    right.id
                )
            )
            .map(pending => ({
                ...pending,

                creation: {
                    ...pending.creation
                },

                resolution:
                    pending.resolution
                        ? {
                            ...pending
                                .resolution
                        }
                        : null
            }));

    const activePendings =
        allPendings.filter(
            pending =>
                pending.status ===
                    "active"
        );

    const resolvedPendings =
        allPendings.filter(
            pending =>
                pending.status ===
                    "resolved"
        );

    return {
        valid: true,

        protocolVersion:
            contract.projection
                .protocolVersion,

        activePendings,
        resolvedPendings,
        allPendings,
        processedEvents,
        ignoredEvents,
        legacyEvents,
        diagnostics,
        errors: []
    };
}

module.exports = {
    planPendingLifecycleEvent,
    reconstructPendingLifecycle
};
