// ============================================
// CONFIGURACIÓN CENTRAL DE VARIABLES
// ============================================

const VARIABLES = {

    nivel_tanque: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "nivelTanque",
        excelField: "NivelTanque",
        recordGroup: "Variables",
        recordField: "NivelTanque",
        valueDisplay: "nivelTanqueValue",

        label: "Nivel Tanque",
        unit: "%",

        min: 35,
        max: 85,
        step: 1,
        defaultValue: 50,

        ubidots: {
            variableId: "69b9845f00fab5d8ef22b54d"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    presion_tanque: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "presionTanque",
        excelField: "PresionTanque",
        recordGroup: "Variables",
        recordField: "PresionTanque",
        valueDisplay: "presionTanqueValue",

        label: "Presión Tanque",
        unit: " PSI",

        min: 90,
        max: 145,
        step: 1,
        defaultValue: 100,

        ubidots: {
            variableId: "69b9846000fab5d8ef22b54e"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    temp_tanque: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "tempTanque",
        excelField: "TempTanque",
        recordGroup: "Variables",
        recordField: "TempTanque",
        valueDisplay: "tempTanqueValue",

        label: "Temperatura Tanque",
        unit: " °C",

        min: 0,
        max: 30,
        step: 1,
        defaultValue: 19,

        ubidots: {
            variableId: "69b984613609a6ccc5146aa2"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    cisterna_habilitada: {
        category: "estado",

        type: "boolean",
        control: "toggle",

        field: "cisternaHabilitada",
        recordGroup: "Estado",
        recordField: "CisternaHabilitada",

        label: "¿Ingresar datos de cisterna?"
    },
    nivel_cisterna: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "nivelCisterna",
        excelField: "NivelCisterna",
        recordGroup: "Cisterna",
        recordField: "NivelCisterna",
        valueDisplay: "nivelCisternaValue",

        label: "Nivel Cisterna",
        unit: "%",

        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0,
        ubidots: {
            variableId: "69b9845f00fab5d8ef22b54c"
        },

        comparison: {
            type: "number",
            requiredWhen: {
                variable: "cisterna_habilitada",
                equals: true
            }
        },

        cisternaReference: {
            required: true
        },

        dependsOn: "cisterna_habilitada"
    },
    presion_cisterna: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "presionCisterna",
        excelField: "PresionCisterna",
        recordGroup: "Cisterna",
        recordField: "PresionCisterna",
        valueDisplay: "presionCisternaValue",

        label: "Presión Cisterna",
        unit: " PSI",

        min: 90,
        max: 140,
        step: 1,
        defaultValue: 110,
        ubidots: {
            variableId: "6a8dbf62d9a262f5af22bdab"
        },

        comparison: {
            type: "number",
            requiredWhen: {
                variable: "cisterna_habilitada",
                equals: true
            }
        },

        cisternaReference: {
            required: true
        },

        dependsOn: "cisterna_habilitada"
    },
    temp_cisterna: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "tempCisterna",
        excelField: "TempCisterna",
        recordGroup: "Cisterna",
        recordField: "TempCisterna",
        valueDisplay: "tempCisternaValue",

        label: "Temperatura Cisterna",
        unit: " °C",

        min: 16,
        max: 30,
        step: 1,
        defaultValue: 22,

        ubidots: {
            variableId: "6a8dbf6455e95e1d147d97dc"
        },

        comparison: {
            type: "number",
            requiredWhen: {
                variable: "cisterna_habilitada",
                equals: true
            }
        },

        cisternaReference: {
            required: true
        },

        dependsOn: "cisterna_habilitada"
    },
    capacidad_cisterna: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "capacidadCisterna",
        excelField: "CapacidadCisterna",
        recordField: "CapacidadCisterna",
        recordGroup: "Cisterna",

        label: "Capacidad Cisterna (Gal)",
        unit: " Gal",
        min: 0,
        step: 1,
        ubidots: {
            variableId: "69b9845f3609a6ccc5146aa1"
        },

        dependsOn: "cisterna_habilitada",

        comparison: {
            type: "number",
            requiredWhen: {
                variable: "cisterna_habilitada",
                equals: true
            }
        },

        cisternaReference: {
            required: true
        },

        reuseFromLast: true,

        eventProjection: {
            includeWhenReused: true
        }
    },
    placa_cisterna: {
        category: "administrativo",

        type: "text",
        control: "text",

        field: "placaCisterna",
        excelField: "PlacaCisterna",
        recordField: "PlacaCisterna",
        recordGroup: "Cisterna",

        label: "Placa Cisterna",
        dependsOn: "cisterna_habilitada",
        ubidotsContext: {
            field: "PlacaCisterna",
            required: false
        },
        comparison: {
            type: "text",
            requiredWhen: {
                variable: "cisterna_habilitada",
                equals: true
            }
        },

        cisternaReference: {
            required: true
        },

        reuseFromLast: true,

        eventProjection: {
            includeWhenReused: true
        }
    },
    presion_bomba: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "presionBomba",
        excelField: "PresionBomba",
        recordGroup: "Variables",
        recordField: "PresionBomba",
        valueDisplay: "presionBombaValue",

        label: "Presión Bomba",
        unit: " PSI",

        min: 100,
        max: 115,
        step: 1,
        defaultValue: 110,

        ubidots: {
            variableId: "69b984609ae1225920346415"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    temp_vapor: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "tempVapor",
        excelField: "TempVapor",
        recordGroup: "Variables",
        recordField: "TempVapor",
        valueDisplay: "tempVaporValue",

        label: "Temperatura Vapor",
        unit: " °C",

        min: 45,
        max: 75,
        step: 1,
        defaultValue: 56,

        ubidots: {
            variableId: "69b9846100fab5d8ef22b54f"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    presion_vapor: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "presionVapor",
        excelField: "PresionVapor",
        recordGroup: "Variables",
        recordField: "PresionVapor",
        valueDisplay: "presionVaporValue",

        label: "Presión Vapor",
        unit: " PSI",

        min: 90,
        max: 115,
        step: 1,
        defaultValue: 105,

        ubidots: {
            variableId: "69b984603384289118c238ca"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    presion_mezcla: {
        category: "proceso",

        type: "number",
        control: "number",

        field: "presionMezcla",
        excelField: "PresionMezcla",
        recordGroup: "Variables",
        recordField: "PresionMezcla",
        valueDisplay: "presionMezclaValue",

        label: "Presión Mezcla",
        unit: " PSI",

        min: 9,
        max: 11,
        step: 1,
        defaultValue: 10,

        ubidots: {
            variableId: "69b98460f0f71673e8da7976"
        },
        comparison: {
            type: "number",
            required: true
        }
    },
    estado_operacion: {
        category: "estado",

        type: "select",
        control: "select",

        field: "estadoOperacion",

        excelField: "EstadoOperacion",

        recordGroup: "Estado",
        recordField: "EstadoOperacion",

        label: "Estado de operación",

        options: [
            {
                value: "inicia_trasego",
                label: "Inicia trasego"
            },
            {
                value: "finaliza_trasego",
                label: "Finaliza trasego"
            },
            {
                value: "sin_novedad",
                label: "Sin novedad"
            }
        ],
        ubidotsContext: {
            field: "EstadoOperacion",
            required: true
        },
        comparison: {
            type: "text",
            required: true
        }
    },
    pendientes: {
        category: "estado",

        type: "multiselect",
        control: "checkbox",

        field: "problemas",
        excelField: "Pendientes",

        recordGroup: "Estado",
        recordField: "Pendientes",

        label: "Pendientes",

        context: {
            fields: {
                fechaRegistro: "fecha",
                encargadoRegistro: "encargado"
            },

            resolution: {
                fields: {
                    fechaSolucion: "fecha",
                    encargadoSolucion: "encargado"
                }
            }
        },
        lifecycleProjection: {
            protocolVersion:
                "pending-lifecycle-v1",

            protocolField:
                "pendingLifecycleProtocol",

            createdField:
                "pendientes_creados_json",

            resolvedField:
                "pendientes_resueltos_json",

            activeSnapshotField:
                "pendientes_json",

            outputColumns: {
                protocol:
                    "PendingLifecycleProtocol",

                created:
                    "PendientesCreadosJSON",

                resolved:
                    "PendientesResueltosJSON",

                activeSnapshot:
                    "PendientesActivosJSON"
            }
        },
        record: {
            id: "ID",
            type: "Tipo",
            description: "Descripcion"
        },
        options: [
            {
                value: "bomba_1_apagada",
                label: "Bomba 1 apagada"
            },
            {
                value: "bomba_2_apagada",
                label: "Bomba 2 apagada"
            },
            {
                value: "sin_cisterna",
                label: "Sin cisterna"
            },
            {
                value: "otro",
                label: "Otro",
                descriptionField: "otroProblema"
            }
        ],
        ubidotsContext: {
            field: "Pendientes",
            required: true,
            serializer: "pendingSummary",
            source: "record"
        },
        comparison: {
            type: "pending-list",
            required: true
        }
    },
    observaciones: {
        category: "administrativo",

        type: "text",
        control: "textarea",

        field: "observaciones",

        excelField: "Observaciones",

        recordGroup: "Administrativo",
        recordField: "Observaciones",

        label: "Observaciones",
        ubidotsContext: {
            field: "Observaciones",
            required: false
        },
        comparison: {
            type: "text",
            required: false
        }
    },
    encargado: {
        category: "administrativo",

        type: "text",
        control: "text",

        field: "encargado",

        excelField: "Encargado",

        recordGroup: "Administrativo",
        recordField: "Encargado",

        label: "Encargado",
        ubidotsContext: {
            field: "Encargado",
            required: true
        },
        comparison: {
            type: "text",
            required: true
        }
    },
    valvulas_capuchon: {
        category: "estado",

        type: "boolean",
        control: "toggle",
        
        field: "valvulasCapuchon",

        excelField: "ValvulasCapuchon",
        recordGroup: "Estado",
        recordField: "ValvulasCapuchon",

        label: "¿Las válvulas de alivio tienen capuchón?",
        ubidotsContext: {
            field: "ValvulasCapuchon",
            required: false,
            enabled: false
        },
        comparison: {
            type: "boolean",
            enabled: false
        }
    },
    hermeticidad_conexiones: {
        category: "estado",

        type: "boolean",
        control: "toggle",

        field: "hermeticidadConexiones",

        excelField: "HermeticidadConexiones",
        recordGroup: "Estado",
        recordField: "HermeticidadConexiones",

        label: "¿Las conexiones están libres de fugas?",

        ubidotsContext: {
            field: "HermeticidadConexiones",
            required: false,
            enabled: false
        },

        comparison: {
            type: "boolean",
            enabled: false
        }
    },
    hermeticidad_accesorios: {
        category: "estado",

        type: "boolean",
        control: "toggle",

        field: "hermeticidadAccesorios",

        excelField: "HermeticidadAccesorios",
        recordGroup: "Estado",
        recordField: "HermeticidadAccesorios",

        label: "¿Los accesorios están libres de fugas?",

        ubidotsContext: {
            field: "HermeticidadAccesorios",
            required: false,
            enabled: false
        },

        comparison: {
            type: "boolean",
            enabled: false
        }
    },
    hermeticidad_instrumentacion: {
        category: "estado",

        type: "boolean",
        control: "toggle",

        field: "hermeticidadInstrumentacion",

        excelField: "HermeticidadInstrumentacion",
        recordGroup: "Estado",
        recordField: "HermeticidadInstrumentacion",

        label: "¿La instrumentación está libre de fugas?",

        ubidotsContext: {
            field: "HermeticidadInstrumentacion",
            required: false,
            enabled: false
        },

        comparison: {
            type: "boolean",
            enabled: false
        }
    },
    fecha: {
        category: "administrativo",

        type: "date",
        control: "date",

        field: "fecha",
        excelField: "Fecha",

        label: "Fecha",
        ubidotsContext: {
            field: "Fecha",
            required: true
        },
        comparison: {
            type: "date",
            required: true
        }
    },
    hora: {
        category: "administrativo",

        type: "time",
        control: "time",

        field: "hora",
        excelField: "Hora",

        label: "Hora",
        ubidotsContext: {
            field: "Hora",
            required: true
        },
        comparison: {
            type: "time",
            required: true
        }
    },
};

// ============================================
// CONSULTAS DEL CATÁLOGO DE VARIABLES
// ============================================

function getVariable(nombre) {
    return VARIABLES[nombre] || null;
}

function readVariable(variable) {

    if (!variable || !variable.field) {
        return null;
    }

    switch (variable.control) {

        case "number":
        case "text":
        case "textarea":
        case "select":
        case "date":
        case "time": {
            const element = document.getElementById(variable.field);

            return element ? element.value : "";
        }

        case "toggle": {
            const element = document.getElementById(variable.field);

            return element ? element.checked : false;
        }

        case "checkbox": {
            const elements = document.querySelectorAll(
                `input[name="${variable.field}"]:checked`
            );

            return Array.from(elements).map(element => element.value);
        }

        default:
            console.warn(
                `Control no soportado para la variable "${variable.field}":`,
                variable.control
            );

            return null;
    }
}

function readVariables(category = null) {

    const entries = Object.entries(VARIABLES)
        .filter(([, variable]) =>
            !category || variable.category === category
        );

    const data = {};

    for (const [name, variable] of entries) {

        if (variable.dependsOn) {

            const dependency = getVariable(variable.dependsOn);

            if (!dependency) {
                console.warn(
                    `Dependencia no encontrada: "${variable.dependsOn}" para "${name}"`
                );
                continue;
            }

            const dependencyValue = readVariable(dependency);

            if (!dependencyValue) {
                data[name] = null;
                continue;
            }
        }

        data[name] = readVariable(variable);
    }

    return data;
}


function resetVariable(variable) {

    if (!variable || !variable.field) {
        return;
    }

    switch (variable.control) {

        case "number":
        case "text":
        case "textarea":
        case "date":
        case "time": {

            const element =
                document.getElementById(variable.field);

            if (!element) {
                return;
            }

            element.value =
                variable.defaultValue ?? "";

            break;
        }

        case "select": {

            const element =
                document.getElementById(variable.field);

            if (!element) {
                return;
            }

            if (variable.defaultValue !== undefined) {

                element.value =
                    variable.defaultValue;

            } else if (element.options.length > 0) {

                element.selectedIndex = 0;
            }

            break;
        }

        case "toggle": {

            const element =
                document.getElementById(variable.field);

            if (!element) {
                return;
            }

            element.checked =
                variable.defaultValue ?? false;

            break;
        }

        case "checkbox": {

            const elements =
                document.querySelectorAll(
                    `input[name="${variable.field}"]`
                );

            elements.forEach(element => {
                element.checked = false;
            });

            break;
        }

        default:

            console.warn(
                `Control no soportado para resetear la variable "${variable.field}":`,
                variable.control
            );

            break;
    }
}

function resetVariables(category = null) {

    const entries =
        Object.entries(VARIABLES)
            .filter(([, variable]) =>
                !category ||
                variable.category === category
            );

    for (const [, variable] of entries) {
        resetVariable(variable);
    }
}

function groupVariablesByCategory(data) {

    const grouped = {};

    for (const [name, value] of Object.entries(data)) {

        const variable = VARIABLES[name];

        if (!variable) {
            continue;
        }

        const category = variable.category;

        if (!grouped[category]) {
            grouped[category] = {};
        }

        grouped[category][name] = value;
    }

    return grouped;
}

function buildCisternaVariableContract(
    variables = VARIABLES
) {
    const fields = [];

    if (
        !variables ||
        typeof variables !== "object" ||
        Array.isArray(variables)
    ) {
        return {
            valid: false,
            fields: [],
            errors: [
                "CISTERNA_VARIABLES_INVALID"
            ]
        };
    }

    const canonicalNames =
        new Set();

    for (
        const [logicalName, variable]
        of Object.entries(variables)
    ) {
        if (
            !variable ||
            typeof variable !== "object" ||
            Array.isArray(variable) ||
            variable.dependsOn !==
                "cisterna_habilitada"
        ) {
            continue;
        }

        const canonicalName =
            typeof variable.excelField ===
                "string"
                ? variable.excelField.trim()
                : "";

        if (!canonicalName) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "CISTERNA_CANONICAL_NAME_MISSING"
                ]
            };
        }

        if (
            canonicalNames.has(
                canonicalName
            )
        ) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "CISTERNA_CANONICAL_NAME_DUPLICATE"
                ]
            };
        }

        canonicalNames.add(
            canonicalName
        );

        fields.push({
            logicalName,
            canonicalName,

            type:
                variable.type || null,

            telemetryEnabled:
                Boolean(
                    variable.ubidots
                        ?.variableId
                ),

            contextEnabled:
                Boolean(
                    variable.ubidotsContext
                ),

            reuseFromLast:
                variable.reuseFromLast ===
                    true,

            referenceRequired:
                variable.cisternaReference
                    ?.required === true,

            measurementRequired:
                variable.comparison
                    ?.requiredWhen
                    ?.variable ===
                        "cisterna_habilitada" &&
                variable.comparison
                    ?.requiredWhen
                    ?.equals ===
                        true,
            includeWhenReused:
                variable.eventProjection
                    ?.includeWhenReused === true
        });
    }

    if (fields.length === 0) {
        return {
            valid: false,
            fields: [],
            errors: [
                "CISTERNA_VARIABLES_NOT_FOUND"
            ]
        };
    }

    return {
        valid: true,

        fields:
            fields.map(field => ({
                ...field
            })),

        errors: []
    };
}

function getVariablesByCategory(category) {
    return Object.entries(VARIABLES)
        .filter(([, variable]) => variable.category === category)
        .map(([nombre, variable]) => ({
            name: nombre,
            ...variable
        }));
}

function variableExists(nombre) {
    return Object.prototype.hasOwnProperty.call(VARIABLES, nombre);
}

function buildPendingLifecycleContract(
    variables = VARIABLES
) {
    const invalidResult = errors => ({
        valid: false,
        record: null,
        projection: null,
        creationFields: [],
        resolutionFields: [],
        options: [],
        errors: [
            ...new Set(errors)
        ]
    });

    if (
        !variables ||
        typeof variables !== "object" ||
        Array.isArray(variables)
    ) {
        return invalidResult([
            "PENDING_VARIABLES_INVALID"
        ]);
    }

    const pendingVariable =
        variables.pendientes;

    if (
        !pendingVariable ||
        typeof pendingVariable !== "object" ||
        Array.isArray(pendingVariable)
    ) {
        return invalidResult([
            "PENDING_CONFIGURATION_MISSING"
        ]);
    }
    const lifecycleProjection =
        pendingVariable.lifecycleProjection;

    if (
        !lifecycleProjection ||
        typeof lifecycleProjection !== "object" ||
        Array.isArray(lifecycleProjection)
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_PROJECTION_INVALID"
        ]);
    }

    const protocolVersion =
        typeof lifecycleProjection
            .protocolVersion === "string"
            ? lifecycleProjection
                .protocolVersion
                .trim()
            : "";

    const protocolField =
    typeof lifecycleProjection
        .protocolField === "string"
        ? lifecycleProjection
            .protocolField
            .trim()
        : "";

    const createdField =
        typeof lifecycleProjection
            .createdField === "string"
            ? lifecycleProjection
                .createdField
                .trim()
            : "";

    const resolvedField =
        typeof lifecycleProjection
            .resolvedField === "string"
            ? lifecycleProjection
                .resolvedField
                .trim()
            : "";

    const activeSnapshotField =
        typeof lifecycleProjection
            .activeSnapshotField === "string"
            ? lifecycleProjection
                .activeSnapshotField
                .trim()
            : "";

    const outputColumns =
        lifecycleProjection.outputColumns;

    if (
        !outputColumns ||
        typeof outputColumns !== "object" ||
        Array.isArray(outputColumns)
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_OUTPUT_COLUMNS_INVALID"
        ]);
    }

    const protocolOutputColumn =
        typeof outputColumns.protocol ===
            "string"
            ? outputColumns.protocol.trim()
            : "";

    const createdOutputColumn =
        typeof outputColumns.created ===
            "string"
            ? outputColumns.created.trim()
            : "";

    const resolvedOutputColumn =
        typeof outputColumns.resolved ===
            "string"
            ? outputColumns.resolved.trim()
            : "";

    const activeSnapshotOutputColumn =
        typeof outputColumns
            .activeSnapshot === "string"
            ? outputColumns
                .activeSnapshot
                .trim()
            : "";

    if (
        !protocolOutputColumn ||
        !createdOutputColumn ||
        !resolvedOutputColumn ||
        !activeSnapshotOutputColumn
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_OUTPUT_COLUMNS_INVALID"
        ]);
    }

    const outputColumnValues = [
        protocolOutputColumn,
        createdOutputColumn,
        resolvedOutputColumn,
        activeSnapshotOutputColumn
    ];

    if (
        new Set(outputColumnValues).size !==
        outputColumnValues.length
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_OUTPUT_COLUMN_DUPLICATE"
        ]);
    }

    if (
        !protocolVersion ||
        !protocolField ||
        !createdField ||
        !resolvedField ||
        !activeSnapshotField
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_PROJECTION_INVALID"
        ]);
    }

    const projectionFields = [
        protocolField,
        createdField,
        resolvedField,
        activeSnapshotField
    ];

    if (
        new Set(projectionFields).size !==
        projectionFields.length
    ) {
        return invalidResult([
            "PENDING_LIFECYCLE_PROJECTION_DUPLICATE"
        ]);
    }

    const record =
        pendingVariable.record;

    if (
        !record ||
        typeof record !== "object" ||
        Array.isArray(record)
    ) {
        return invalidResult([
            "PENDING_RECORD_CONTRACT_INVALID"
        ]);
    }

    const idColumn =
        typeof record.id === "string"
            ? record.id.trim()
            : "";

    const typeColumn =
        typeof record.type === "string"
            ? record.type.trim()
            : "";

    const descriptionColumn =
        typeof record.description === "string"
            ? record.description.trim()
            : "";

    if (
        !idColumn ||
        !typeColumn ||
        !descriptionColumn
    ) {
        return invalidResult([
            "PENDING_RECORD_CONTRACT_INVALID"
        ]);
    }

    const recordColumns = [
        idColumn,
        typeColumn,
        descriptionColumn
    ];

    if (
        new Set(recordColumns).size !==
        recordColumns.length
    ) {
        return invalidResult([
            "PENDING_RECORD_COLUMN_DUPLICATE"
        ]);
    }

    function buildContextFields(
        sourceFields,
        errorCode
    ) {
        if (
            !sourceFields ||
            typeof sourceFields !== "object" ||
            Array.isArray(sourceFields)
        ) {
            return {
                valid: false,
                fields: [],
                errorCode
            };
        }

        const fields = [];

        for (
            const [targetField, sourceVariable]
            of Object.entries(sourceFields)
        ) {
            const normalizedTarget =
                typeof targetField === "string"
                    ? targetField.trim()
                    : "";

            const normalizedSource =
                typeof sourceVariable === "string"
                    ? sourceVariable.trim()
                    : "";

            if (
                !normalizedTarget ||
                !normalizedSource ||
                !variables[normalizedSource]
            ) {
                return {
                    valid: false,
                    fields: [],
                    errorCode
                };
            }

            fields.push({
                targetField:
                    normalizedTarget,

                sourceVariable:
                    normalizedSource
            });
        }

        return {
            valid: true,
            fields,
            errorCode: null
        };
    }

    const creation =
        buildContextFields(
            pendingVariable.context?.fields,
            "PENDING_CREATION_CONTEXT_INVALID"
        );

    if (!creation.valid) {
        return invalidResult([
            creation.errorCode
        ]);
    }

    const resolution =
        buildContextFields(
            pendingVariable
                .context
                ?.resolution
                ?.fields,

            "PENDING_RESOLUTION_CONTEXT_INVALID"
        );

    if (!resolution.valid) {
        return invalidResult([
            resolution.errorCode
        ]);
    }

    const sourceOptions =
        Array.isArray(
            pendingVariable.options
        )
            ? pendingVariable.options
            : [];

    const optionValues =
        new Set();

    const options = [];

    for (const option of sourceOptions) {
        if (
            !option ||
            typeof option !== "object" ||
            Array.isArray(option)
        ) {
            return invalidResult([
                "PENDING_OPTION_INVALID"
            ]);
        }

        const value =
            typeof option.value === "string"
                ? option.value.trim()
                : "";

        const label =
            typeof option.label === "string"
                ? option.label.trim()
                : "";

        if (
            !value ||
            !label ||
            optionValues.has(value)
        ) {
            return invalidResult([
                "PENDING_OPTION_INVALID"
            ]);
        }

        optionValues.add(value);

        options.push({
            value,
            label,

            descriptionField:
                typeof option
                    .descriptionField ===
                    "string"
                    ? option
                        .descriptionField
                        .trim() || null
                    : null
        });
    }

    if (options.length === 0) {
        return invalidResult([
            "PENDING_OPTIONS_NOT_FOUND"
        ]);
    }

    const creationTargets =
        new Set(
            creation.fields.map(
                field =>
                    field.targetField
            )
        );

    const duplicatedLifecycleTarget =
        resolution.fields.some(
            field =>
                creationTargets.has(
                    field.targetField
                )
        );

    if (duplicatedLifecycleTarget) {
        return invalidResult([
            "PENDING_LIFECYCLE_FIELD_DUPLICATE"
        ]);
    }

    return {
        valid: true,

        record: {
            idColumn,
            typeColumn,
            descriptionColumn
        },
        projection: {
            protocolVersion,
            protocolField,
            createdField,
            resolvedField,
            activeSnapshotField,

            outputColumns: {
                protocol:
                    protocolOutputColumn,

                created:
                    createdOutputColumn,

                resolved:
                    resolvedOutputColumn,

                activeSnapshot:
                    activeSnapshotOutputColumn
            }
        },

        creationFields:
            creation.fields.map(
                field => ({
                    ...field
                })
            ),

        resolutionFields:
            resolution.fields.map(
                field => ({
                    ...field
                })
            ),

        options:
            options.map(option => ({
                ...option
            })),

        errors: []
    };
}

function buildPendingLifecycleContextOutput(
    pendingContract
) {
    if (
        !pendingContract ||
        typeof pendingContract !== "object" ||
        Array.isArray(pendingContract) ||
        pendingContract.valid !== true ||
        !pendingContract.projection ||
        typeof pendingContract.projection !==
            "object" ||
        Array.isArray(
            pendingContract.projection
        )
    ) {
        return {
            valid: false,
            contextoSalida: null,
            errors: [
                "PENDING_LIFECYCLE_CONTRACT_INVALID"
            ]
        };
    }

    const projection =
        pendingContract.projection;

    const outputColumns =
        projection.outputColumns;

    if (
        !outputColumns ||
        typeof outputColumns !== "object" ||
        Array.isArray(outputColumns)
    ) {
        return {
            valid: false,
            contextoSalida: null,
            errors: [
                "PENDING_LIFECYCLE_OUTPUT_COLUMNS_INVALID"
            ]
        };
    }

    const entries = [
        [
            projection.protocolField,
            outputColumns.protocol
        ],
        [
            projection.createdField,
            outputColumns.created
        ],
        [
            projection.resolvedField,
            outputColumns.resolved
        ],
        [
            projection.activeSnapshotField,
            outputColumns.activeSnapshot
        ]
    ];

    const invalidEntry =
        entries.some(
            ([contextField, outputColumn]) =>
                typeof contextField !==
                    "string" ||
                contextField.trim() === "" ||
                typeof outputColumn !==
                    "string" ||
                outputColumn.trim() === ""
        );

    if (invalidEntry) {
        return {
            valid: false,
            contextoSalida: null,
            errors: [
                "PENDING_LIFECYCLE_CONTEXT_OUTPUT_INVALID"
            ]
        };
    }

    const contextFields =
        entries.map(
            ([contextField]) =>
                contextField.trim()
        );

    const localColumns =
        entries.map(
            ([, outputColumn]) =>
                outputColumn.trim()
        );

    if (
        new Set(contextFields).size !==
            contextFields.length ||
        new Set(localColumns).size !==
            localColumns.length
    ) {
        return {
            valid: false,
            contextoSalida: null,
            errors: [
                "PENDING_LIFECYCLE_CONTEXT_OUTPUT_DUPLICATE"
            ]
        };
    }

    return {
        valid: true,

        contextoSalida:
            Object.fromEntries(
                entries.map(
                    ([
                        contextField,
                        outputColumn
                    ]) => [
                        contextField.trim(),
                        outputColumn.trim()
                    ]
                )
            ),

        errors: []
    };
}

function createPending(type, description = null) {

    const variable = VARIABLES.pendientes;

    if (!variable || !Array.isArray(variable.options)) {
        return null;
    }

    const option = variable.options.find(
        option => option.value === type
    );

    if (!option) {
        return null;
    }

    const context = {};

    const contextFields =
        variable.context?.fields || {};

    for (const [contextName, variableName] of Object.entries(contextFields)) {

        if (!variableName) {
            context[contextName] = null;
            continue;
        }

        const contextVariable = VARIABLES[variableName];

        if (!contextVariable) {
            console.warn(
                `Variable de contexto no encontrada: "${variableName}"`
            );

            context[contextName] = null;
            continue;
        }

        context[contextName] = readVariable(contextVariable);
    }

    return {
        id: `pendiente-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

        type,

        description:
            type === "otro"
                ? String(description || "").trim()
                : option.label,

        context
    };
}

function normalizePending(pending) {

    if (!pending) {
        return null;
    }

    if (typeof pending === "string") {
        return createPending(pending);
    }

    if (typeof pending === "object") {

        if (!pending.id || !pending.type) {
            return null;
        }

        const context = {};

        const contextFields =
            VARIABLES.pendientes?.context?.fields || {};

        for (const field of Object.keys(contextFields)) {

            context[field] =
                pending.context?.[field] ?? null;
        }

        return {
            id: pending.id,
            type: pending.type,
            description:
                String(
                    pending.description || ""
                ).trim(),
            context
        };
    }

    return null;
}

function normalizePendings(pendings) {

    if (!Array.isArray(pendings)) {
        return [];
    }

    return pendings
        .map(normalizePending)
        .filter(Boolean);
}

function mergePendings(previousPendings, selectedPendings) {

    const previous = normalizePendings(previousPendings);
    const selected = normalizePendings(selectedPendings);

    const result = [...previous];

    for (const pending of selected) {

        const existing = result.find(previousPending => {

            if (pending.type === "otro") {
                return (
                    previousPending.type === "otro" &&
                    previousPending.description === pending.description
                );
            }

            return previousPending.type === pending.type;
        });

        if (!existing) {
            result.push(pending);
        }
    }

    return result;
}

function buildRecordVariables(data) {

    const result = {};

    for (const [name, value] of Object.entries(data)) {

        const variable = VARIABLES[name];

        if (!variable || !variable.excelField) {
            continue;
        }

        result[variable.excelField] = value;
    }

    return result;
}

function buildRecordGroups(data) {

    const record = {};

    for (const [name, variable] of Object.entries(VARIABLES)) {

        if (!variable.recordGroup || !variable.recordField) {
            continue;
        }

        // ============================================
        // El registro ya viene normalizado.
        // Solo agrupamos variables.
        // ============================================

        if (!(variable.recordGroup in record)) {
            record[variable.recordGroup] = {};
        }

        record[variable.recordGroup][variable.recordField] =
            data[name] ?? null;
    }

    return record;
}

// ============================================
// EXPORTACIÓN PARA NODE.JS
// ============================================

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        VARIABLES,
        getVariable,
        getVariablesByCategory,
        variableExists,
        readVariable,
        readVariables,
        resetVariable,
        resetVariables,
        groupVariablesByCategory,
        buildRecordVariables,
        buildRecordGroups,
        buildPendingLifecycleContract,
        buildPendingLifecycleContextOutput,
        createPending,
        normalizePending,
        normalizePendings,
        mergePendings,
        buildCisternaVariableContract
    };
}