"use strict";

// ============================================
// REPRESENTACIÓN DE BOOLEANOS
// ============================================

function formatBooleanValue(value) {

    if (
        value === true ||
        value === "true"
    ) {
        return "SÍ";
    }

    if (
        value === false ||
        value === "false"
    ) {
        return "NO";
    }

    return value;
}

// ============================================
// REPRESENTACIÓN DE OPTIONS
// ============================================

function formatOptionValue(
    variable,
    value
) {

    if (
        !variable ||
        !Array.isArray(variable.options)
    ) {
        return value;
    }

    const option =
        variable.options.find(
            option =>
                option.value === value
        );

    return option
        ? option.label
        : value;
}

// ============================================
// VALORES VACÍOS
// ============================================

function formatEmptyValue(
    variable,
    value
) {

    const emptyDisplay =
        variable?.emptyDisplay;

    if (!emptyDisplay) {
        return null;
    }

    if (
        value === null ||
        value === undefined
    ) {
        return emptyDisplay;
    }

    if (
        typeof value === "string" &&
        value.trim() === ""
    ) {
        return emptyDisplay;
    }

    if (
        Array.isArray(value) &&
        value.length === 0
    ) {
        return emptyDisplay;
    }

    return null;
}

// ============================================
// REPRESENTACIÓN POR DEFECTO
// ============================================

function formatDefaultValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "N/A";
    }

    return value;
}

// ============================================
// MULTISELECT
// ============================================

function formatMultiSelectValue(
    variable,
    value
) {

    if (
        !Array.isArray(value)
    ) {
        return value;
    }

    return value.map(item =>
        formatOptionValue(
            variable,
            item
        )
    );
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

function formatVariableDisplay(
    variable,
    value
) {

    const emptyValue =
        formatEmptyValue(
            variable,
            value
        );

    if (
        emptyValue !== null
    ) {
        return emptyValue;
    }

    if (!variable) {
        return formatDefaultValue(
            value
        );
    }

    switch(variable.type) {

        case "boolean":

            return formatBooleanValue(
                value
            );

        case "select":

            return formatOptionValue(
                variable,
                value
            );

        case "multiselect":

            return formatMultiSelectValue(
                variable,
                value
            );

        default:

            return formatDefaultValue(
                value
            );
    }
}

// ============================================
// EXPORTACIÓN NAVEGADOR
// ============================================

if (typeof window !== "undefined") {

    window.VariableDisplayService = {

        formatBooleanValue,
        formatOptionValue,
        formatEmptyValue,
        formatDefaultValue,
        formatMultiSelectValue,
        formatVariableDisplay
    };
}

// ============================================
// EXPORTACIÓN
// ============================================

if (
    typeof module !== "undefined" &&
    module.exports
) {

    module.exports = {

        formatBooleanValue,
        formatOptionValue,
        formatEmptyValue,
        formatDefaultValue,
        formatMultiSelectValue,
        formatVariableDisplay
    };
}