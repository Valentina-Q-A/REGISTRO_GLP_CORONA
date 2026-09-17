"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const historySyncConfig =
    require("../config/history-sync.config");

const {
    VARIABLES,
    buildPendingLifecycleContract
} = require("../js/variables");

const {
    planPendingLifecycleEvent,
    reconstructPendingLifecycle
} = require(
    "../services/pending-lifecycle-service"
);

const {
    sendDevicePayload,
    validateWriteTarget
} = require(
    "../services/ubidots-device-write-service"
);

const {
    fetchHistory
} = require(
    "../services/ubidots-history-service"
);

const {
    enrichUbidotsHistoryConfig
} = require(
    "../services/ubidots-history-config-service"
);

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const content = fs.readFileSync(
        filePath,
        "utf8"
    );

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (
            !trimmed ||
            trimmed.startsWith("#")
        ) {
            continue;
        }

        const equalIndex = trimmed.indexOf("=");

        if (equalIndex < 1) {
            continue;
        }

        const key = trimmed
            .slice(0, equalIndex)
            .trim();

        let value = trimmed
            .slice(equalIndex + 1)
            .trim();

        if (
            (
                value.startsWith('"') &&
                value.endsWith('"')
            ) ||
            (
                value.startsWith("'") &&
                value.endsWith("'")
            )
        ) {
            value = value.slice(1, -1);
        }

        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function sleep(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

function hashFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
}

function captureProtectedArtifacts() {
    const paths = {
        pending: path.resolve(
            process.cwd(),
            "ubidots-pending.json"
        ),

        cache: path.resolve(
            process.cwd(),
            historySyncConfig.cachePath
        ),

        checkpoint: path.resolve(
            process.cwd(),
            historySyncConfig.checkpointPath
        ),

        testConfig: path.resolve(
            process.cwd(),
            "scripts/config-ubidots-glp-pruebas.js"
        ),

        normalConfig: path.resolve(
            process.cwd(),
            "scripts/config-ubidots-glp.js"
        )
    };

    return Object.fromEntries(
        Object.entries(paths).map(
            ([name, filePath]) => [
                name,
                {
                    path: filePath,
                    exists: fs.existsSync(filePath),
                    hash: hashFile(filePath)
                }
            ]
        )
    );
}

function compareProtectedArtifacts(before, after) {
    return Object.fromEntries(
        Object.keys(before).map(name => [
            name,
            before[name].exists === after[name].exists &&
            before[name].hash === after[name].hash
        ])
    );
}

function parseArguments(argumentsList) {
    const options = {};

    for (const argument of argumentsList) {
        if (
            typeof argument !== "string" ||
            !argument.startsWith("--")
        ) {
            continue;
        }

        const content = argument.slice(2);
        const equalIndex = content.indexOf("=");

        const key = (
            equalIndex === -1
                ? content
                : content.slice(0, equalIndex)
        )
            .trim()
            .toLowerCase();

        const value =
            equalIndex === -1
                ? "true"
                : content
                    .slice(equalIndex + 1)
                    .trim();

        if (key) {
            options[key] = value;
        }
    }

    return options;
}

function normalizeMode(value) {
    const mode = String(value || "simular")
        .trim()
        .toLowerCase();

    if (![
        "simular",
        "ejecutar"
    ].includes(mode)) {
        throw new Error(
            "El modo debe ser 'simular' o 'ejecutar'."
        );
    }

    return mode;
}

function loadConfig(configOption) {
    const configPath = path.resolve(
        process.cwd(),
        configOption ||
            "scripts/config-ubidots-glp-pruebas.js"
    );

    const config = require(configPath);

    return {
        config,
        configPath
    };
}

function validateE2EValues({
    config,
    variables
}) {
    const configuredLabels = Object.keys(
        config.variables || {}
    );

    const testValues = config.writeTarget?.testValues;

    if (
        !testValues ||
        typeof testValues !== "object" ||
        Array.isArray(testValues)
    ) {
        throw new Error(
            "PENDING_E2E_TEST_VALUES_INVALID"
        );
    }

    const testValueLabels = Object.keys(testValues);

    const sortedConfiguredLabels = [
        ...configuredLabels
    ].sort();

    const sortedTestValueLabels = [
        ...testValueLabels
    ].sort();

    if (
        JSON.stringify(sortedConfiguredLabels) !==
        JSON.stringify(sortedTestValueLabels)
    ) {
        throw new Error(
            "PENDING_E2E_TEST_VALUES_MISMATCH"
        );
    }

    for (const label of configuredLabels) {
        const variable = variables[label];
        const numericValue = Number(testValues[label]);

        if (!variable?.ubidots?.variableId) {
            throw new Error(
                `PENDING_E2E_VARIABLE_INVALID: ${label}`
            );
        }

        if (!Number.isFinite(numericValue)) {
            throw new Error(
                `PENDING_E2E_VALUE_INVALID: ${label}`
            );
        }

        if (
            variable.min !== undefined &&
            numericValue < Number(variable.min)
        ) {
            throw new Error(
                `PENDING_E2E_VALUE_BELOW_MINIMUM: ${label}`
            );
        }

        if (
            variable.max !== undefined &&
            numericValue > Number(variable.max)
        ) {
            throw new Error(
                `PENDING_E2E_VALUE_ABOVE_MAXIMUM: ${label}`
            );
        }
    }

    return {
        configuredLabels,
        testValues
    };
}

function formatColombiaDateTime(timestamp) {
    const date = new Date(timestamp);

    const dateParts = new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).formatToParts(date);

    const timeParts = new Intl.DateTimeFormat(
        "en-GB",
        {
            timeZone: "America/Bogota",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23"
        }
    ).formatToParts(date);

    function readPart(parts, type) {
        return parts.find(
            part => part.type === type
        )?.value || "";
    }

    return {
        fecha: [
            readPart(dateParts, "year"),
            readPart(dateParts, "month"),
            readPart(dateParts, "day")
        ].join("-"),

        hora: [
            readPart(timeParts, "hour"),
            readPart(timeParts, "minute"),
            readPart(timeParts, "second")
        ].join(":")
    };
}

function buildEventContext({
    timestamp,
    eventId,
    pendingContract,
    planningResult,
    phase
}) {
    const operational = formatColombiaDateTime(
        timestamp
    );

    const projection = pendingContract.projection;

    const activeSnapshot = JSON.parse(
        planningResult.contextProjection[
            projection.activeSnapshotField
        ]
    );

    return {
        Fecha: operational.fecha,
        Hora: operational.hora,
        Encargado: "Prueba E2E",
        EstadoOperacion: "prueba_e2e",
        PlacaCisterna: "E2E-TEST",

        Pendientes:
            activeSnapshot.length > 0
                ? activeSnapshot
                    .map(
                        pending =>
                            pending.description
                    )
                    .join("; ")
                : "Sin pendientes",

        Observaciones: [
            "Prueba E2E",
            "del ciclo de pendientes",
            `fase ${phase}`,
            `evento ${eventId}`
        ].join(" "),

        ValvulasCapuchon: false,

        FechaServidor: new Date(
            timestamp
        ).toISOString(),

        eventId,

        ...planningResult.contextProjection
    };
}

function buildCompletePayload({
    config,
    timestamp,
    context
}) {
    const testValues = config.writeTarget.testValues;

    return Object.fromEntries(
        Object.keys(config.variables).map(label => [
            label,
            {
                value: Number(testValues[label]),
                timestamp,
                context: {
                    ...context
                }
            }
        ])
    );
}

function buildRecoveredEvent({
    planningResult,
    context
}) {
    return {
        eventId:
            planningResult.lifecycleEvent.eventId,

        TimestampUbidots:
            planningResult.lifecycleEvent.timestamp,

        ...context
    };
}

function buildFetchMock(capturedRequests) {
    return async (url, options) => {
        capturedRequests.push({
            url: String(url),
            method: options.method,

            contentType:
                options.headers["Content-Type"],

            hasAuthToken: Boolean(
                options.headers["X-Auth-Token"]
            ),

            payload: JSON.parse(options.body)
        });

        return {
            ok: true,
            status: 200,

            async json() {
                return {
                    accepted: true,
                    simulated: true
                };
            },

            async text() {
                return "";
            }
        };
    };
}

function assertCondition(condition, code) {
    if (!condition) {
        throw new Error(code);
    }
}

async function runSimulation({
    config,
    configPath,
    confirmation
}) {
    const target = validateWriteTarget({
        config,
        confirmation
    });

    assertCondition(
        target.valid === true,
        target.errors?.[0] ||
            "PENDING_E2E_TARGET_INVALID"
    );

    const pendingContract =
        buildPendingLifecycleContract(
            VARIABLES
        );

    assertCondition(
        pendingContract.valid === true,
        pendingContract.errors?.[0] ||
            "PENDING_E2E_CONTRACT_INVALID"
    );

    const {
        configuredLabels
    } = validateE2EValues({
        config,
        variables: VARIABLES
    });

    const baseTimestamp = Date.now();
    const creationTimestamp = baseTimestamp;
    const resolutionTimestamp = baseTimestamp + 1000;

    const pendingId =
        `pending-e2e-${baseTimestamp}`;

    const creationEventId =
        `pending-e2e-create-${baseTimestamp}`;

    const resolutionEventId =
        `pending-e2e-resolve-${baseTimestamp}`;

    const creationOperational =
        formatColombiaDateTime(
            creationTimestamp
        );

    const creationPlan =
        planPendingLifecycleEvent({
            currentState: null,

            pendingCreations: [
                {
                    id: pendingId,
                    type: "sin_cisterna",

                    description: [
                        "Pendiente E2E",
                        "para validar tablero",
                        "de Ubidots"
                    ].join(" "),

                    creation: {
                        fechaRegistro:
                            creationOperational.fecha,

                        encargadoRegistro:
                            "Prueba E2E"
                    }
                }
            ],

            pendingResolutions: [],

            event: {
                eventId: creationEventId,
                TimestampUbidots:
                    creationTimestamp
            },

            pendingContract
        });

    assertCondition(
        creationPlan.valid === true,
        creationPlan.errors?.[0] ||
            "PENDING_E2E_CREATION_PLAN_INVALID"
    );

    const creationContext = buildEventContext({
        timestamp: creationTimestamp,
        eventId: creationEventId,
        pendingContract,
        planningResult: creationPlan,
        phase: "crear"
    });

    const creationPayload = buildCompletePayload({
        config,
        timestamp: creationTimestamp,
        context: creationContext
    });

    const recoveredCreation = buildRecoveredEvent({
        planningResult: creationPlan,
        context: creationContext
    });

    const creationReconstruction =
        reconstructPendingLifecycle({
            events: [
                recoveredCreation
            ],

            pendingContract,
            contextConflicts: []
        });

    assertCondition(
        creationReconstruction.valid === true,
        "PENDING_E2E_CREATION_RECONSTRUCTION_INVALID"
    );

    assertCondition(
        creationReconstruction.diagnostics.length ===
            0,
        "PENDING_E2E_CREATION_DIAGNOSTICS"
    );

    assertCondition(
        creationReconstruction.activePendings.length ===
            1,
        "PENDING_E2E_ACTIVE_CREATION_MISMATCH"
    );

    assertCondition(
        creationReconstruction.activePendings[0].id ===
            pendingId,
        "PENDING_E2E_ACTIVE_ID_MISMATCH"
    );

    const resolutionOperational =
        formatColombiaDateTime(
            resolutionTimestamp
        );

    const resolutionPlan =
        planPendingLifecycleEvent({
            currentState:
                creationReconstruction,

            pendingCreations: [],

            pendingResolutions: [
                {
                    id: pendingId,

                    resolution: {
                        fechaSolucion:
                            resolutionOperational.fecha,

                        encargadoSolucion:
                            "Prueba E2E"
                    }
                }
            ],

            event: {
                eventId: resolutionEventId,
                TimestampUbidots:
                    resolutionTimestamp
            },

            pendingContract
        });

    assertCondition(
        resolutionPlan.valid === true,
        resolutionPlan.errors?.[0] ||
            "PENDING_E2E_RESOLUTION_PLAN_INVALID"
    );

    const resolutionContext = buildEventContext({
        timestamp: resolutionTimestamp,
        eventId: resolutionEventId,
        pendingContract,
        planningResult: resolutionPlan,
        phase: "resolver"
    });

    const resolutionPayload = buildCompletePayload({
        config,
        timestamp: resolutionTimestamp,
        context: resolutionContext
    });

    const recoveredResolution = buildRecoveredEvent({
        planningResult: resolutionPlan,
        context: resolutionContext
    });

    const finalReconstruction =
        reconstructPendingLifecycle({
            events: [
                recoveredCreation,
                recoveredResolution
            ],

            pendingContract,
            contextConflicts: []
        });

    assertCondition(
        finalReconstruction.valid === true,
        "PENDING_E2E_FINAL_RECONSTRUCTION_INVALID"
    );

    assertCondition(
        finalReconstruction.processedEvents === 2,
        "PENDING_E2E_PROCESSED_EVENTS_MISMATCH"
    );

    assertCondition(
        finalReconstruction.diagnostics.length === 0,
        "PENDING_E2E_FINAL_DIAGNOSTICS"
    );

    assertCondition(
        finalReconstruction.activePendings.length === 0,
        "PENDING_E2E_PENDING_LEFT_ACTIVE"
    );

    assertCondition(
        finalReconstruction.resolvedPendings.length ===
            1,
        "PENDING_E2E_RESOLVED_COUNT_MISMATCH"
    );

    assertCondition(
        finalReconstruction.resolvedPendings[0].id ===
            pendingId,
        "PENDING_E2E_RESOLVED_ID_MISMATCH"
    );

    assertCondition(
        Object.keys(creationPayload).length === 11,
        "PENDING_E2E_CREATION_PAYLOAD_SIZE_INVALID"
    );

    assertCondition(
        Object.keys(resolutionPayload).length === 11,
        "PENDING_E2E_RESOLUTION_PAYLOAD_SIZE_INVALID"
    );

    const capturedRequests = [];
    const fetchMock = buildFetchMock(
        capturedRequests
    );

    const simulatedToken =
        "TOKEN-SINTETICO-NO-REAL";

    const creationWrite = await sendDevicePayload({
        config,
        confirmation,
        payload: creationPayload,
        token: simulatedToken,
        fetchImpl: fetchMock,
        timeoutMs: 5000
    });

    const resolutionWrite = await sendDevicePayload({
        config,
        confirmation,
        payload: resolutionPayload,
        token: simulatedToken,
        fetchImpl: fetchMock,
        timeoutMs: 5000
    });

    assertCondition(
        creationWrite.success === true,
        "PENDING_E2E_CREATION_WRITE_SIMULATION_FAILED"
    );

    assertCondition(
        resolutionWrite.success === true,
        "PENDING_E2E_RESOLUTION_WRITE_SIMULATION_FAILED"
    );

    assertCondition(
        capturedRequests.length === 2,
        "PENDING_E2E_REQUEST_COUNT_MISMATCH"
    );

    assertCondition(
        capturedRequests.every(
            request => request.method === "POST"
        ),
        "PENDING_E2E_METHOD_INVALID"
    );

    assertCondition(
        capturedRequests.every(
            request =>
                new URL(request.url)
                    .pathname
                    .endsWith(
                        "/devices/planta-prueba"
                    )
        ),
        "PENDING_E2E_DESTINATION_INVALID"
    );

    const queryWindow = {
        start: creationTimestamp - 1000,
        end: resolutionTimestamp + 1000
    };

    return {
        mode: "SIMULATION",
        networkUsed: false,

        config: {
            path: path.relative(
                process.cwd(),
                configPath
            ),

            deviceLabel: target.deviceLabel,
            variables: configuredLabels.length
        },

        identifiers: {
            pendingId,
            creationEventId,
            resolutionEventId
        },

        timestamps: {
            creation: creationTimestamp,
            resolution: resolutionTimestamp,
            queryWindow
        },

        creation: {
            planned: creationPlan.valid,

            variablesInPayload:
                Object.keys(creationPayload).length,

            activeAfterEvent:
                creationReconstruction
                    .activePendings
                    .map(pending => pending.id),

            dashboardActiveCount:
                creationPlan
                    .dashboardSnapshot
                    .activeCount,

            simulatedWriteStatus:
                creationWrite.status
        },

        resolution: {
            planned: resolutionPlan.valid,

            variablesInPayload:
                Object.keys(resolutionPayload).length,

            resolvedAfterEvent:
                finalReconstruction
                    .resolvedPendings
                    .map(pending => pending.id),

            dashboardActiveCount:
                resolutionPlan
                    .dashboardSnapshot
                    .activeCount,

            simulatedWriteStatus:
                resolutionWrite.status
        },

        finalReconstruction: {
            processedEvents:
                finalReconstruction.processedEvents,

            activePendings:
                finalReconstruction
                    .activePendings
                    .map(pending => pending.id),

            resolvedPendings:
                finalReconstruction
                    .resolvedPendings
                    .map(pending => pending.id),

            diagnostics:
                finalReconstruction.diagnostics
        },

        dashboard: {
            activeAfterCreation:
                creationPlan
                    .dashboardSnapshot
                    .activeCount,

            activeAfterResolution:
                resolutionPlan
                    .dashboardSnapshot
                    .activeCount,

            finalActivePendings:
                finalReconstruction
                    .activePendings
                    .map(pending => pending.id)
        },

        requests: {
            count: capturedRequests.length,

            methods: capturedRequests.map(
                request => request.method
            ),

            paths: capturedRequests.map(
                request =>
                    new URL(request.url).pathname
            )
        },

        queryWindow,

        integrity: {
            productionPendingTouched: false,
            productionExcelTouched: false,
            productionCheckpointTouched: false,
            temporaryFilesCreated: false
        }
    };
}

function buildHistoryConfigForWindow({
    sourceConfig,
    pendingContract,
    start,
    end
}) {
    const enriched = enrichUbidotsHistoryConfig({
        config: sourceConfig,
        pendingContract
    });

    assertCondition(
        enriched?.valid === true &&
        enriched.config,
        enriched?.errors?.[0] ||
            "PENDING_E2E_HISTORY_CONFIG_INVALID"
    );

    return {
        ...enriched.config,

        parametros: {
            ...(enriched.config.parametros || {}),
            start,
            end
        },

        pageSize: Math.max(
            Number(enriched.config.pageSize) || 100,
            100
        )
    };
}

function adaptRecoveredRecords({
    records,
    pendingContract,
    eventIdsByTimestamp
}) {
    const projection = pendingContract.projection;
    const outputColumns = projection.outputColumns;

    return records
        .filter(record =>
            eventIdsByTimestamp.has(
                Number(record.TimestampUbidots)
            )
        )
        .map(record => {
            const timestamp = Number(
                record.TimestampUbidots
            );

            return {
                eventId:
                    eventIdsByTimestamp.get(timestamp),

                TimestampUbidots: timestamp,

                [projection.protocolField]:
                    record[outputColumns.protocol],

                [projection.createdField]:
                    record[outputColumns.created],

                [projection.resolvedField]:
                    record[outputColumns.resolved],

                [projection.activeSnapshotField]:
                    record[outputColumns.activeSnapshot]
            };
        })
        .sort(
            (left, right) =>
                left.TimestampUbidots -
                right.TimestampUbidots
        );
}

async function recoverLifecycleWindow({
    sourceConfig,
    pendingContract,
    token,
    start,
    end,
    eventIdsByTimestamp,
    expectedEvents,
    attempts = 8,
    delayMs = 2500
}) {
    let lastResult = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const historyConfig =
            buildHistoryConfigForWindow({
                sourceConfig,
                pendingContract,
                start,
                end
            });

        const history = await fetchHistory({
            config: historyConfig,
            token
        });

        const lifecycleEvents =
            adaptRecoveredRecords({
                records: history.records,
                pendingContract,
                eventIdsByTimestamp
            });

        const reconstruction =
            reconstructPendingLifecycle({
                events: lifecycleEvents,
                pendingContract,
                contextConflicts:
                    history.contextConflicts || []
            });

        lastResult = {
            attempt,
            history,
            lifecycleEvents,
            reconstruction
        };

        if (
            reconstruction.valid === true &&
            reconstruction.processedEvents ===
                expectedEvents &&
            reconstruction.diagnostics.length === 0
        ) {
            return lastResult;
        }

        if (attempt < attempts) {
            await sleep(delayMs);
        }
    }

    const error = new Error(
        "PENDING_E2E_REMOTE_RECOVERY_TIMEOUT"
    );

    error.code =
        "PENDING_E2E_REMOTE_RECOVERY_TIMEOUT";

    error.lastRecovery = lastResult
        ? {
            attempt: lastResult.attempt,
            recoveredRecords:
                lastResult.history.records.length,
            lifecycleEvents:
                lastResult.lifecycleEvents.length,
            processedEvents:
                lastResult.reconstruction
                    .processedEvents,
            diagnostics:
                lastResult.reconstruction
                    .diagnostics
        }
        : null;

    throw error;
}

async function runRealExecution({
    config,
    configPath,
    confirmation
}) {
    const target = validateWriteTarget({
        config,
        confirmation
    });

    assertCondition(
        target.valid === true,
        target.errors?.[0] ||
            "PENDING_E2E_TARGET_INVALID"
    );

    assertCondition(
        confirmation === "planta-prueba",
        "UBIDOTS_WRITE_CONFIRMATION_INVALID"
    );

    const tokenEnvironment =
        config.tokenEnv || "UBIDOTS_TOKEN";

    const token = process.env[tokenEnvironment];

    assertCondition(
        typeof token === "string" &&
        token.trim() !== "",
        "UBIDOTS_WRITE_TOKEN_MISSING"
    );

    const pendingContract =
        buildPendingLifecycleContract(VARIABLES);

    assertCondition(
        pendingContract.valid === true,
        pendingContract.errors?.[0] ||
            "PENDING_E2E_CONTRACT_INVALID"
    );

    const {
        configuredLabels
    } = validateE2EValues({
        config,
        variables: VARIABLES
    });

    const protectedBefore =
        captureProtectedArtifacts();

    const creationTimestamp = Date.now();
    const pendingId =
        `pending-e2e-${creationTimestamp}`;
    const creationEventId =
        `pending-e2e-create-${creationTimestamp}`;

    let resolutionTimestamp = null;
    let resolutionEventId = null;
    let creationWritten = false;
    let resolutionWritten = false;

    try {
        const creationOperational =
            formatColombiaDateTime(
                creationTimestamp
            );

        const creationPlan =
            planPendingLifecycleEvent({
                currentState: null,

                pendingCreations: [
                    {
                        id: pendingId,
                        type: "sin_cisterna",

                        description: [
                            "Pendiente E2E",
                            "para validar tablero",
                            "de Ubidots"
                        ].join(" "),

                        creation: {
                            fechaRegistro:
                                creationOperational.fecha,
                            encargadoRegistro:
                                "Prueba E2E"
                        }
                    }
                ],

                pendingResolutions: [],

                event: {
                    eventId: creationEventId,
                    TimestampUbidots:
                        creationTimestamp
                },

                pendingContract
            });

        assertCondition(
            creationPlan.valid === true,
            creationPlan.errors?.[0] ||
                "PENDING_E2E_CREATION_PLAN_INVALID"
        );

        const creationContext = buildEventContext({
            timestamp: creationTimestamp,
            eventId: creationEventId,
            pendingContract,
            planningResult: creationPlan,
            phase: "crear"
        });

        const creationPayload = buildCompletePayload({
            config,
            timestamp: creationTimestamp,
            context: creationContext
        });

        assertCondition(
            Object.keys(creationPayload).length === 11,
            "PENDING_E2E_CREATION_PAYLOAD_SIZE_INVALID"
        );

        const creationWrite = await sendDevicePayload({
            config,
            confirmation,
            payload: creationPayload,
            token,
            timeoutMs: config.timeoutMs
        });

        creationWritten = creationWrite.success === true;

        const creationEventIds = new Map([
            [creationTimestamp, creationEventId]
        ]);

        const creationRecovery =
            await recoverLifecycleWindow({
                sourceConfig: config,
                pendingContract,
                token,
                start: creationTimestamp - 2000,
                end: creationTimestamp + 2000,
                eventIdsByTimestamp: creationEventIds,
                expectedEvents: 1
            });

        assertCondition(
            creationRecovery.reconstruction
                .activePendings.length === 1,
            "PENDING_E2E_REMOTE_CREATION_ACTIVE_MISMATCH"
        );

        assertCondition(
            creationRecovery.reconstruction
                .activePendings[0].id === pendingId,
            "PENDING_E2E_REMOTE_CREATION_ID_MISMATCH"
        );

        resolutionTimestamp = Math.max(
            Date.now(),
            creationTimestamp + 3000
        );

        resolutionEventId =
            `pending-e2e-resolve-${creationTimestamp}`;

        const resolutionOperational =
            formatColombiaDateTime(
                resolutionTimestamp
            );

        const resolutionPlan =
            planPendingLifecycleEvent({
                currentState:
                    creationRecovery.reconstruction,

                pendingCreations: [],

                pendingResolutions: [
                    {
                        id: pendingId,
                        resolution: {
                            fechaSolucion:
                                resolutionOperational.fecha,
                            encargadoSolucion:
                                "Prueba E2E"
                        }
                    }
                ],

                event: {
                    eventId: resolutionEventId,
                    TimestampUbidots:
                        resolutionTimestamp
                },

                pendingContract
            });

        assertCondition(
            resolutionPlan.valid === true,
            resolutionPlan.errors?.[0] ||
                "PENDING_E2E_RESOLUTION_PLAN_INVALID"
        );

        const resolutionContext = buildEventContext({
            timestamp: resolutionTimestamp,
            eventId: resolutionEventId,
            pendingContract,
            planningResult: resolutionPlan,
            phase: "resolver"
        });

        const resolutionPayload = buildCompletePayload({
            config,
            timestamp: resolutionTimestamp,
            context: resolutionContext
        });

        assertCondition(
            Object.keys(resolutionPayload).length === 11,
            "PENDING_E2E_RESOLUTION_PAYLOAD_SIZE_INVALID"
        );

        const resolutionWrite = await sendDevicePayload({
            config,
            confirmation,
            payload: resolutionPayload,
            token,
            timeoutMs: config.timeoutMs
        });

        resolutionWritten =
            resolutionWrite.success === true;

        const eventIdsByTimestamp = new Map([
            [creationTimestamp, creationEventId],
            [resolutionTimestamp, resolutionEventId]
        ]);

        const finalRecovery =
            await recoverLifecycleWindow({
                sourceConfig: config,
                pendingContract,
                token,
                start: creationTimestamp - 2000,
                end: resolutionTimestamp + 2000,
                eventIdsByTimestamp,
                expectedEvents: 2
            });

        const finalState =
            finalRecovery.reconstruction;

        assertCondition(
            finalState.activePendings.length === 0,
            "PENDING_E2E_PENDING_LEFT_ACTIVE"
        );

        assertCondition(
            finalState.resolvedPendings.length === 1 &&
            finalState.resolvedPendings[0].id ===
                pendingId,
            "PENDING_E2E_REMOTE_RESOLUTION_MISMATCH"
        );

        const protectedAfter =
            captureProtectedArtifacts();

        const integrity =
            compareProtectedArtifacts(
                protectedBefore,
                protectedAfter
            );

        assertCondition(
            Object.values(integrity).every(Boolean),
            "PENDING_E2E_PROTECTED_ARTIFACT_CHANGED"
        );

        return {
            mode: "REAL_EXECUTION",
            networkUsed: true,

            config: {
                path: path.relative(
                    process.cwd(),
                    configPath
                ),
                deviceLabel: target.deviceLabel,
                variables: configuredLabels.length
            },

            identifiers: {
                pendingId,
                creationEventId,
                resolutionEventId
            },

            timestamps: {
                creation: creationTimestamp,
                resolution: resolutionTimestamp,
                queryWindow: {
                    start: creationTimestamp - 2000,
                    end: resolutionTimestamp + 2000
                }
            },

            creation: {
                written: creationWritten,
                writeStatus: creationWrite.status,
                recoveryAttempt:
                    creationRecovery.attempt,
                recoveredRecords:
                    creationRecovery.history
                        .records.length,
                processedEvents:
                    creationRecovery.reconstruction
                        .processedEvents,
                dashboardActiveCount:
                    creationRecovery.reconstruction
                        .activePendings.length,
                activePendings:
                    creationRecovery.reconstruction
                        .activePendings
                        .map(pending => pending.id)
            },

            resolution: {
                written: resolutionWritten,
                writeStatus: resolutionWrite.status,
                recoveryAttempt:
                    finalRecovery.attempt,
                recoveredRecords:
                    finalRecovery.history.records.length,
                processedEvents:
                    finalState.processedEvents,
                dashboardActiveCount:
                    finalState.activePendings.length,
                resolvedPendings:
                    finalState.resolvedPendings
                        .map(pending => pending.id)
            },

            finalReconstruction: {
                processedEvents:
                    finalState.processedEvents,
                activePendings:
                    finalState.activePendings
                        .map(pending => pending.id),
                resolvedPendings:
                    finalState.resolvedPendings
                        .map(pending => pending.id),
                diagnostics: finalState.diagnostics
            },

            dashboard: {
                activeAfterCreation:
                    creationRecovery.reconstruction
                        .activePendings.length,
                activeAfterResolution:
                    finalState.activePendings.length,
                finalActivePendings:
                    finalState.activePendings
                        .map(pending => pending.id)
            },

            integrity: {
                ...integrity,
                allProtectedArtifactsUnchanged:
                    Object.values(integrity)
                        .every(Boolean)
            }
        };
    } catch (error) {
        error.recovery = {
            deviceLabel: target.deviceLabel,
            pendingId,
            creationEventId,
            creationTimestamp,
            creationWritten,
            resolutionEventId,
            resolutionTimestamp,
            resolutionWritten,
            instruction:
                creationWritten && !resolutionWritten
                    ? "El pendiente E2E pudo quedar activo. Conserva estos identificadores para ejecutar una resolución de recuperación."
                    : "Revisa el último evento confirmado antes de repetir la prueba."
        };

        throw error;
    }
}

async function main() {
    const options = parseArguments(
        process.argv.slice(2)
    );

    const mode = normalizeMode(options.modo);

    const {
        config,
        configPath
    } = loadConfig(options.config);

    const explicitConfirmation =
        options["confirmar-escritura"];

    let result;

    if (mode === "ejecutar") {
        assertCondition(
            explicitConfirmation === "planta-prueba",
            "UBIDOTS_WRITE_CONFIRMATION_INVALID"
        );

        loadEnv(
            path.resolve(
                process.cwd(),
                ".env"
            )
        );

        result = await runRealExecution({
            config,
            configPath,
            confirmation: explicitConfirmation
        });
    } else {
        const confirmation =
            explicitConfirmation ||
            config.writeTarget?.confirmation;

        result = await runSimulation({
            config,
            configPath,
            confirmation
        });
    }

    console.log(
        mode === "ejecutar"
            ? "\nPRUEBA E2E REAL DEL CICLO DE PENDIENTES\n"
            : "\nPRUEBA E2E SIMULADA DEL CICLO DE PENDIENTES\n"
    );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );
}

main().catch(error => {
    console.error(
        "\nERROR EN PRUEBA E2E DE PENDIENTES:",
        error.code || error.message
    );

    if (error.lastRecovery) {
        console.error(
            JSON.stringify(
                {
                    lastRecovery:
                        error.lastRecovery
                },
                null,
                2
            )
        );
    }

    if (error.recovery) {
        console.error(
            JSON.stringify(
                {
                    recovery:
                        error.recovery
                },
                null,
                2
            )
        );
    }

    process.exitCode = 1;
});
