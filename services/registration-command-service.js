"use strict";

const {
    deriveCisternaProvenance
} = require(
    "./cisterna-provenance-service"
);

function isObject(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function createInvalidPlan(
    errors,
    mode = null
) {
    return {
        valid: false,
        mode,
        origin: "desconocido",
        historicalData: null,
        ubidotsData: null,
        historicalMetadata: null,
        contextMetadata: null,
        errors: [
            ...new Set(
                Array.isArray(errors)
                    ? errors
                    : []
            )
        ]
    };
}

function normalizeCisternaContract(
    cisternaContract
) {
    if (
        !isObject(cisternaContract) ||
        cisternaContract.valid !== true ||
        !Array.isArray(
            cisternaContract.fields
        ) ||
        cisternaContract.fields.length === 0
    ) {
        return {
            valid: false,
            fields: [],
            errors: [
                "REGISTRATION_VARIABLE_CONTRACT_INVALID"
            ]
        };
    }

    const logicalNames =
        new Set();

    const canonicalNames =
        new Set();

    const fields = [];

    for (
        const field
        of cisternaContract.fields
    ) {
        if (
            !isObject(field) ||
            typeof field.logicalName !==
                "string" ||
            !field.logicalName.trim() ||
            typeof field.canonicalName !==
                "string" ||
            !field.canonicalName.trim()
        ) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "REGISTRATION_VARIABLE_CONTRACT_INVALID"
                ]
            };
        }

        const logicalName =
            field.logicalName.trim();

        const canonicalName =
            field.canonicalName.trim();

        if (
            logicalNames.has(logicalName) ||
            canonicalNames.has(
                canonicalName
            )
        ) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "REGISTRATION_CISTERNA_MAPPING_DUPLICATE"
                ]
            };
        }

        logicalNames.add(
            logicalName
        );

        canonicalNames.add(
            canonicalName
        );

        fields.push({
            ...field,
            logicalName,
            canonicalName
        });
    }

    return {
        valid: true,
        fields,
        errors: []
    };
}

function omitCisternaProvenance(data) {
    const {
        cisternaProvenance,
        ...plainData
    } = data;

    return plainData;
}

function applyCisternaProjection({
    baseData,
    projection,
    contractFields
}) {
    const result = {
        ...baseData
    };

    for (const field of contractFields) {
        const {
            logicalName,
            canonicalName
        } = field;

        result[logicalName] =
            Object.prototype
                .hasOwnProperty
                .call(
                    projection,
                    canonicalName
                )
                ? projection[
                    canonicalName
                ]
                : null;
    }

    return result;
}

function applyUbidotsCisternaProjection({
    baseData,
    ubidotsProjection,
    historicalProjection,
    reusedFields,
    contractFields
}) {
    const result = {
        ...baseData
    };

    const reusedSet =
        new Set(
            Array.isArray(reusedFields)
                ? reusedFields
                : []
        );

    for (const field of contractFields) {
        const {
            logicalName,
            canonicalName
        } = field;

        const hasCurrentValue =
            Object.prototype
                .hasOwnProperty
                .call(
                    ubidotsProjection,
                    canonicalName
                );

        if (hasCurrentValue) {
            result[logicalName] =
                ubidotsProjection[
                    canonicalName
                ];

            continue;
        }

        const includeReusedValue =
            reusedSet.has(
                canonicalName
            ) &&
            field.includeWhenReused ===
                true;

        if (includeReusedValue) {
            result[logicalName] =
                Object.prototype
                    .hasOwnProperty
                    .call(
                        historicalProjection,
                        canonicalName
                    )
                    ? historicalProjection[
                        canonicalName
                    ]
                    : null;

            continue;
        }

        result[logicalName] =
            null;
    }

    return result;
}

function serializeHistoricalMetadata(
    historicalRecordData
) {
    return {
        OrigenDatosCisterna:
            historicalRecordData
                .OrigenDatosCisterna,

        CisternaReferenciaTimestamp:
            historicalRecordData
                .CisternaReferenciaTimestamp,

        CisternaReferenciaJson:
            historicalRecordData
                .CisternaReferenciaJson,

        CisternaCamposReutilizados:
            JSON.stringify(
                historicalRecordData
                    .CisternaCamposReutilizados
            )
    };
}

function serializeContextMetadata(
    contextMetadata
) {
    const serialized = {
        OrigenDatosCisterna:
            contextMetadata
                .OrigenDatosCisterna,

        CisternaCamposReutilizados:
            JSON.stringify(
                contextMetadata
                    .CisternaCamposReutilizados
            )
    };

    if (
        contextMetadata
            .CisternaReferenciaTimestamp !==
        undefined
    ) {
        serialized
            .CisternaReferenciaTimestamp =
                contextMetadata
                    .CisternaReferenciaTimestamp;
    }

    if (
        contextMetadata
            .cisterna_referencia_json !==
        undefined
    ) {
        serialized
            .cisterna_referencia_json =
                contextMetadata
                    .cisterna_referencia_json;
    }

    return serialized;
}

function createRegistrationPlan({
    data,
    trustedReference,
    cisternaContract
} = {}) {
    if (!isObject(data)) {
        return createInvalidPlan([
            "REGISTRATION_DATA_INVALID"
        ]);
    }

    const normalizedContract =
        normalizeCisternaContract(
            cisternaContract
        );

    if (!normalizedContract.valid) {
        return createInvalidPlan(
            normalizedContract.errors
        );
    }

    const provenance =
        deriveCisternaProvenance({
            data,
            trustedReference,
            cisternaContract: {
                valid: true,

                fields:
                    normalizedContract.fields
                        .map(field => ({
                            ...field
                        })),

                errors: []
            }
        });

    if (!provenance.valid) {
        return createInvalidPlan(
            provenance.errors,
            provenance.mode
        );
    }

    if (provenance.mode === "LEGACY") {
        return {
            valid: true,
            mode: "LEGACY",
            origin: "desconocido",

            historicalData: {
                ...data
            },

            ubidotsData: {
                ...data
            },

            historicalMetadata: null,
            contextMetadata: null,
            errors: []
        };
    }

    const baseData =
        omitCisternaProvenance(
            data
        );

    const historicalData =
        applyCisternaProjection({
            baseData,

            projection:
                provenance
                    .historicalRecordData,

            contractFields:
                normalizedContract.fields
        });

    const ubidotsData =
        applyUbidotsCisternaProjection({
            baseData,

            ubidotsProjection:
                provenance
                    .ubidotsEventData,

            historicalProjection:
                provenance
                    .historicalRecordData,

            reusedFields:
                provenance
                    .historicalRecordData
                    .CisternaCamposReutilizados,

            contractFields:
                normalizedContract.fields
        });

    const historicalMetadata =
        serializeHistoricalMetadata(
            provenance
                .historicalRecordData
        );

    const contextMetadata =
        serializeContextMetadata(
            provenance
                .contextMetadata
        );

    return {
        valid: true,
        mode: provenance.mode,
        origin: provenance.origin,
        historicalData,
        ubidotsData,
        historicalMetadata,
        contextMetadata,
        errors: []
    };
}

module.exports = {
    createRegistrationPlan
};