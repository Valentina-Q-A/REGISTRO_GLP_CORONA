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
    "PRUEBAS SUMMARY"
);
console.log(
    "================================="
);

console.log(
    "ESTADO:",
    formatVariableDisplay(
        VARIABLES.estado_operacion,
        "sin_novedad"
    )
);

console.log(
    "OBSERVACIONES:",
    formatVariableDisplay(
        VARIABLES.observaciones,
        null
    )
);

console.log(
    "CAPUCHONES TRUE:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        true
    )
);

console.log(
    "CAPUCHONES FALSE:",
    formatVariableDisplay(
        VARIABLES.valvulas_capuchon,
        false
    )
);