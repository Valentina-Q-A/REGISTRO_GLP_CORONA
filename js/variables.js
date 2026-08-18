// ============================================
// CONFIGURACIÓN CENTRAL DE VARIABLES
// ============================================

const VARIABLES = {

    nivel_tanque: {
        type: "number",
        control: "number",

        field: "nivelTanque",
        valueDisplay: "nivelTanqueValue",

        label: "Nivel Tanque",
        unit: "%",

        min: 35,
        max: 85,
        step: 1,
        defaultValue: 50
    },
    presion_tanque: {
        type: "number",
        control: "number",

        field: "presionTanque",
        valueDisplay: "presionTanqueValue",

        label: "Presión Tanque",
        unit: " PSI",

        min: 90,
        max: 145,
        step: 1,
        defaultValue: 100
    },
    temp_tanque: {
        type: "number",
        control: "number",

        field: "tempTanque",
        valueDisplay: "tempTanqueValue",

        label: "Temperatura Tanque",
        unit: " °C",

        min: 0,
        max: 30,
        step: 1,
        defaultValue: 19
    },
    cisterna_habilitada: {
        type: "boolean",
        control: "toggle",

        field: "cisternaHabilitada",

        label: "¿Ingresar datos de cisterna?"
    },
    nivel_cisterna: {
        type: "number",
        control: "number",

        field: "nivelCisterna",
        valueDisplay: "nivelCisternaValue",

        label: "Nivel Cisterna",
        unit: "%",

        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0
    },
    presion_cisterna: {
        type: "number",
        control: "number",

        field: "presionCisterna",
        valueDisplay: "presionCisternaValue",

        label: "Presión Cisterna",
        unit: " PSI",

        min: 90,
        max: 140,
        step: 1,
        defaultValue: 110
    },
    temp_cisterna: {
        type: "number",
        control: "number",

        field: "tempCisterna",
        valueDisplay: "tempCisternaValue",

        label: "Temperatura Cisterna",
        unit: " °C",

        min: 16,
        max: 30,
        step: 1,
        defaultValue: 22
    },
    presion_bomba: {
        type: "number",
        control: "number",

        field: "presionBomba",
        valueDisplay: "presionBombaValue",

        label: "Presión Bomba",
        unit: " PSI",

        min: 100,
        max: 115,
        step: 1,
        defaultValue: 110
    },
    temp_vapor: {
        type: "number",
        control: "number",

        field: "tempVapor",
        valueDisplay: "tempVaporValue",

        label: "Temperatura Vapor",
        unit: " °C",

        min: 45,
        max: 75,
        step: 1,
        defaultValue: 56
    },
    presion_vapor: {
        type: "number",
        control: "number",

        field: "presionVapor",
        valueDisplay: "presionVaporValue",

        label: "Presión Vapor",
        unit: " PSI",

        min: 90,
        max: 115,
        step: 1,
        defaultValue: 105
    },
    presion_mezcla: {
        type: "number",
        control: "number",

        field: "presionMezcla",
        valueDisplay: "presionMezclaValue",

        label: "Presión Mezcla",
        unit: " PSI",

        min: 9,
        max: 11,
        step: 1,
        defaultValue: 10
    },
    estado_operacion: {
        type: "select",
        control: "select",

        field: "estadoOperacion",

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
        type: "multiselect",
        control: "checkbox",

        field: "pendientes",

        label: "Pendientes",

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
                label: "Otro"
            }
        ]
    },
    observaciones: {
        type: "text",
        control: "textarea",
        field: "observaciones",
        label: "Observaciones"
    },
    valvulas_capuchon: {
        type: "boolean",
        control: "toggle",
        field: "valvulasCapuchon",
        label: "¿Las válvulas tienen capuchón?"
    }

};