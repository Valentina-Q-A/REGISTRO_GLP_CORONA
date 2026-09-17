"use strict";

const {
    buildPendingLifecycleContextOutput
} = require("../js/variables");

function isObject(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function invalidResult(errors) {
    return {
        valid: false,
        config: null,
        pendingContextOutput: null,
        errors: [
            ...new Set(errors)
        ]
    };
}

function normalizeContextMap(contextMap) {
    if (!isObject(contextMap)) {
        return {
            valid: false,
            value: null,
            errorCode:
                "UBIDOTS_HISTORY_CONTEXT_OUTPUT_INVALID"
        };
    }

    const normalized = {};

    for (
        const [contextField, outputColumn]
        of Object.entries(contextMap)
    ) {
        const normalizedContextField =
            typeof contextField === "string"
                ? contextField.trim()
                : "";

        const normalizedOutputColumn =
            typeof outputColumn === "string"
                ? outputColumn.trim()
                : "";

        if (
            !normalizedContextField ||
            !normalizedOutputColumn
        ) {
            return {
                valid: false,
                value: null,
                errorCode:
                    "UBIDOTS_HISTORY_CONTEXT_OUTPUT_INVALID"
            };
        }

        normalized[
            normalizedContextField
        ] =
            normalizedOutputColumn;
    }

    return {
        valid: true,
        value: normalized,
        errorCode: null
    };
}

function findContextOutputConflict({
    existingContextOutput,
    pendingContextOutput
}) {
    const existingOutputOwners =
        new Map();

    for (
        const [contextField, outputColumn]
        of Object.entries(
            existingContextOutput
        )
    ) {
        existingOutputOwners.set(
            outputColumn,
            contextField
        );
    }

    for (
        const [contextField, outputColumn]
        of Object.entries(
            pendingContextOutput
        )
    ) {
        const hasExistingContextField =
            Object.prototype
                .hasOwnProperty
                .call(
                    existingContextOutput,
                    contextField
                );

        if (
            hasExistingContextField &&
            existingContextOutput[
                contextField
            ] !== outputColumn
        ) {
            return {
                code:
                    "PENDING_CONTEXT_OUTPUT_CONFLICT",

                detail: {
                    type:
                        "CONTEXT_FIELD_CONFLICT",

                    contextField,

                    existingOutputColumn:
                        existingContextOutput[
                            contextField
                        ],

                    requiredOutputColumn:
                        outputColumn
                }
            };
        }

        const existingOwner =
            existingOutputOwners.get(
                outputColumn
            );

        if (
            existingOwner &&
            existingOwner !== contextField
        ) {
            return {
                code:
                    "PENDING_CONTEXT_OUTPUT_CONFLICT",

                detail: {
                    type:
                        "OUTPUT_COLUMN_CONFLICT",

                    outputColumn,

                    existingContextField:
                        existingOwner,

                    requiredContextField:
                        contextField
                }
            };
        }
    }

    return null;
}

function enrichUbidotsHistoryConfig({
    config,
    pendingContract
} = {}) {
    if (!isObject(config)) {
        return invalidResult([
            "UBIDOTS_HISTORY_CONFIG_INVALID"
        ]);
    }

    const existingContextResult =
        normalizeContextMap(
            config.contextoSalida
        );

    if (!existingContextResult.valid) {
        return invalidResult([
            existingContextResult.errorCode
        ]);
    }

    const pendingOutputResult =
        buildPendingLifecycleContextOutput(
            pendingContract
        );

    if (
        !pendingOutputResult ||
        pendingOutputResult.valid !== true ||
        !isObject(
            pendingOutputResult
                .contextoSalida
        )
    ) {
        return invalidResult(
            Array.isArray(
                pendingOutputResult?.errors
            ) &&
            pendingOutputResult.errors.length > 0
                ? pendingOutputResult.errors
                : [
                    "PENDING_LIFECYCLE_CONTEXT_OUTPUT_INVALID"
                ]
        );
    }

    const pendingContextResult =
        normalizeContextMap(
            pendingOutputResult
                .contextoSalida
        );

    if (!pendingContextResult.valid) {
        return invalidResult([
            pendingContextResult.errorCode
        ]);
    }

    const existingContextOutput =
        existingContextResult.value;

    const pendingContextOutput =
        pendingContextResult.value;

    const conflict =
        findContextOutputConflict({
            existingContextOutput,
            pendingContextOutput
        });

    if (conflict) {
        return {
            valid: false,
            config: null,
            pendingContextOutput: {
                ...pendingContextOutput
            },
            errors: [
                conflict.code
            ],
            conflict: {
                ...conflict.detail
            }
        };
    }

    return {
        valid: true,

        config: {
            ...config,

            contextoSalida: {
                ...existingContextOutput,
                ...pendingContextOutput
            }
        },

        pendingContextOutput: {
            ...pendingContextOutput
        },

        errors: [],
        conflict: null
    };
}

module.exports = {
    enrichUbidotsHistoryConfig
};
