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
        defaultValue: 50
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
        defaultValue: 100
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
        defaultValue: 19
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
        dependsOn: "cisterna_habilitada"
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
        dependsOn: "cisterna_habilitada"
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
        defaultValue: 110
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
        defaultValue: 56
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
        defaultValue: 105
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
        defaultValue: 10
    },
    estado_operacion: {
        category: "estado",

        type: "select",
        control: "select",

        field: "estadoOperacion",
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
        ]
    },
    pendientes: {
        category: "estado",

        type: "multiselect",
        control: "checkbox",

        field: "pendientes",
        recordGroup: "Estado",
        recordField: "Pendientes",

        label: "Pendientes",

        context: {
            fields: {
                fechaRegistro: "fecha",
                encargadoRegistro: "encargado",
                fechaSolucion: null,
                encargadoSolucion: null
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
        ]
    },
    observaciones: {
        category: "administrativo",

        type: "text",
        control: "textarea",

        field: "observaciones",
        recordGroup: "Administrativo",
        recordField: "Observaciones",

        label: "Observaciones"
    },
     encargado: {
        category: "administrativo",

        type: "text",
        control: "text",

        field: "encargado",
        recordGroup: "Administrativo",
        recordField: "Encargado",

        label: "Encargado"
    },
        valvulas_capuchon: {
        category: "estado",

        type: "boolean",
        control: "toggle",
        
        field: "valvulasCapuchon",
        recordGroup: "Estado",
        recordField: "ValvulasCapuchon",

        label: "¿Las válvulas tienen capuchón?"
    },
    fecha: {
        category: "administrativo",
        type: "date",
        control: "date",
        field: "fecha",
        label: "Fecha"
    },

    hora: {
        category: "administrativo",
        type: "time",
        control: "time",
        field: "hora",
        label: "Hora"
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
                continue;
            }
        }

        data[name] = readVariable(variable);
    }

    return data;
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
            VARIABLES.pendientes?.context?.fields || [];

        for (const field of contextFields) {
            context[field] =
                pending.context?.[field] ?? null;
        }

        return {
            id: pending.id,
            type: pending.type,
            description: String(pending.description || "").trim(),
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

        if (variable.dependsOn) {

            const dependencyValue = data[variable.dependsOn];

            if (!dependencyValue) {

                if (!(variable.recordGroup in record)) {
                    record[variable.recordGroup] = null;
                }

                continue;
            }
        }

        if (!(variable.recordGroup in record)) {
            record[variable.recordGroup] = {};
        }

        record[variable.recordGroup][variable.recordField] = data[name];
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
        groupVariablesByCategory,
        buildRecordVariables,
        buildRecordGroups,
        createPending,
        normalizePending,
        normalizePendings,
        mergePendings
    };
}