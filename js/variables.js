// ============================================
// CONFIGURACIÓN CENTRAL DE VARIABLES
// ============================================

const VARIABLES = {

    nivel_tanque: {
        type: "number",
        control: "slider",

        field: "nivelTanque",
        valueDisplay: "nivelTanqueValue",

        label: "Nivel Tanque",
        unit: "%",

        min: 0,
        max: 100
    },

    presion_tanque: {
        type: "number",
        control: "slider",
        field: "presionTanque",
        label: "Presión Tanque",
        unit: " PSI"
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