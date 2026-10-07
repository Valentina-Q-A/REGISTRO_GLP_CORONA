"use strict";

const {
    VARIABLES
} = require("../js/variables");

const {
    formatVariableDisplay
} = require("../services/variable-display-service");

console.log(
    "================================="
);
console.log(
    "PRUEBAS VARIABLE DISPLAY"
);
console.log(
    "================================="
);

// ============================================
// BOOLEAN
// ============================================

console.log(
    "BOOLEAN TRUE:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        true
    )
);

console.log(
    "BOOLEAN FALSE:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        false
    )
);

console.log(
    "BOOLEAN NULL:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        null
    )
);

console.log(
    "BOOLEAN UNDEFINED:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        undefined
    )
);

// ============================================
// SELECT
// ============================================

console.log(
    "ESTADO:",
    formatVariableDisplay(
        VARIABLES.estado_operacion,
        "sin_novedad"
    )
);

// ============================================
// EMPTY DISPLAY
// ============================================

console.log(
    "OBSERVACIONES VACÍAS:",
    formatVariableDisplay(
        VARIABLES.observaciones,
        null
    )
);

console.log(
    "PENDIENTES VACÍOS:",
    formatVariableDisplay(
        VARIABLES.pendientes,
        []
    )
);

// ============================================
// MULTISELECT
// ============================================

console.log(
    "PENDIENTE BOMBA:",
    formatVariableDisplay(
        VARIABLES.pendientes,
        [
            "bomba_1_apagada"
        ]
    )
);

console.log(
    "PENDIENTE OTRO:",
    formatVariableDisplay(
        VARIABLES.pendientes,
        [
            "otro"
        ]
    )
);
