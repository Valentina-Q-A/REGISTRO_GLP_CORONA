"use strict";

const path = require("path");

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

async function main() {
    const options = parseArguments(
        process.argv.slice(2)
    );

    const mode = normalizeMode(options.modo);

    const {
        config,
        configPath
    } = loadConfig(options.config);

    if (mode === "ejecutar") {
        throw new Error(
            [
                "El modo ejecutar todavía",
                "no está habilitado.",
                "Ejecuta primero",
                "--modo=simular."
            ].join(" ")
        );
    }

    const confirmation =
        options["confirmar-escritura"] ||
        config.writeTarget?.confirmation;

    const result = await runSimulation({
        config,
        configPath,
        confirmation
    });

    console.log(
        "\nPRUEBA E2E SIMULADA DEL CICLO DE PENDIENTES\n"
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

    process.exitCode = 1;
});
