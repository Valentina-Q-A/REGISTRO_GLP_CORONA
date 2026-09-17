"use strict";

function isObject(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function hasOwn(object, property) {
    return Object.prototype.hasOwnProperty.call(
        object,
        property
    );
}

function addError(errors, code) {
    if (!errors.includes(code)) {
        errors.push(code);
    }
}

function normalizeNumber(value) {
    if (
        value === null ||
        value === undefined ||
        (
            typeof value === "string" &&
            value.trim() === ""
        )
    ) {
        return null;
    }

    let number;

    try {
        number = Number(value);
    } catch (error) {
        return null;
    }

    return Number.isFinite(number)
        ? number
        : null;
}

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    let text;

    try {
        text =
            String(value).trim();
    } catch (error) {
        return null;
    }

    return text || null;
}

function normalizeFieldValue(
    value,
    field
) {
    if (
        field.type === "number" ||
        field.type === "range"
    ) {
        return normalizeNumber(value);
    }

    return normalizeText(value);
}

function invalidResult(errors) {
    return {
        valid: false,
        mode: "PROVENANCE_V1",
        origin: "desconocido",
        historicalRecordData: null,
        ubidotsEventData: null,
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
                "CISTERNA_VARIABLE_CONTRACT_INVALID"
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
        if (!isObject(field)) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "CISTERNA_VARIABLE_CONTRACT_INVALID"
                ]
            };
        }

        const logicalName =
            normalizeText(
                field.logicalName
            );

        const canonicalName =
            normalizeText(
                field.canonicalName
            );

        const type =
            normalizeText(
                field.type
            );

        if (
            !logicalName ||
            !canonicalName ||
            !type ||
            ![
                "number",
                "range",
                "text"
            ].includes(type) ||
            logicalNames.has(logicalName) ||
            canonicalNames.has(
                canonicalName
            )
        ) {
            return {
                valid: false,
                fields: [],
                errors: [
                    "CISTERNA_VARIABLE_CONTRACT_INVALID"
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
            logicalName,
            canonicalName,
            type,

            telemetryEnabled:
                field.telemetryEnabled ===
                    true,

            contextEnabled:
                field.contextEnabled ===
                    true,

            reuseFromLast:
                field.reuseFromLast ===
                    true,

            referenceRequired:
                field.referenceRequired ===
                    true,

            measurementRequired:
                field.measurementRequired ===
                    true
        });
    }

    return {
        valid: true,
        fields,
        errors: []
    };
}

function normalizeTrustedReference(
    reference,
    contractFields
) {
    if (!isObject(reference)) {
        return null;
    }

    const normalized = {};

    for (const field of contractFields) {
        const canonicalName =
            field.canonicalName;

        const hasValue =
            hasOwn(
                reference,
                canonicalName
            );

        if (!hasValue) {
            if (field.referenceRequired) {
                return null;
            }

            normalized[canonicalName] =
                null;

            continue;
        }

        const rawValue =
            reference[canonicalName];

        if (rawValue === null) {
            if (field.referenceRequired) {
                return null;
            }

            normalized[canonicalName] =
                null;

            continue;
        }

        const normalizedValue =
            normalizeFieldValue(
                rawValue,
                field
            );

        if (
            normalizedValue === null &&
            field.referenceRequired
        ) {
            return null;
        }

        normalized[canonicalName] =
            normalizedValue;
    }

    normalized.TimestampUbidots =
        normalizeNumber(
            reference.TimestampUbidots
        );

    normalized.Fecha =
        normalizeText(
            reference.Fecha
        );

    normalized.Hora =
        normalizeText(
            reference.Hora
        );

    if (
        normalized.TimestampUbidots ===
            null ||
        normalized.TimestampUbidots <= 0 ||
        !normalized.Fecha ||
        !normalized.Hora
    ) {
        return null;
    }

    return normalized;
}

function buildDeterministicReferenceJson(
    reference,
    contractFields
) {
    const deterministicReference = {};

    for (const field of contractFields) {
        deterministicReference[
            field.canonicalName
        ] =
            reference[
                field.canonicalName
            ] ?? null;
    }

    deterministicReference
        .TimestampUbidots =
            reference.TimestampUbidots;

    deterministicReference.Fecha =
        reference.Fecha;

    deterministicReference.Hora =
        reference.Hora;

    return JSON.stringify(
        deterministicReference
    );
}

function deriveCisternaProvenance({
    data,
    trustedReference,
    cisternaContract
} = {}) {
    try {
        if (!isObject(data)) {
            return invalidResult([
                "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
            ]);
        }

        if (
            !hasOwn(
                data,
                "cisternaProvenance"
            )
        ) {
            return {
                valid: true,
                mode: "LEGACY",
                origin: "desconocido",
                historicalRecordData: null,
                ubidotsEventData: null,
                contextMetadata: null,
                errors: []
            };
        }

        const normalizedContract =
            normalizeCisternaContract(
                cisternaContract
            );

        if (!normalizedContract.valid) {
            return invalidResult(
                normalizedContract.errors
            );
        }

        const contractFields =
            normalizedContract.fields;

        const canonicalFields =
            contractFields.map(
                field =>
                    field.canonicalName
            );

        const provenance =
            data.cisternaProvenance;

        const errors = [];

        if (!isObject(provenance)) {
            return invalidResult([
                "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
            ]);
        }

        if (
            provenance.protocolVersion !==
                "cisterna-provenance-v1"
        ) {
            addError(
                errors,
                "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
            );
        }

        const origin =
            provenance.origin;

        if (
            ![
                "actualizados",
                "reutilizados",
                "mixtos",
                "ausentes"
            ].includes(origin)
        ) {
            addError(
                errors,
                "CISTERNA_PROVENANCE_ORIGIN_INVALID"
            );
        }

        if (
            typeof data
                .cisterna_habilitada !==
                "boolean"
        ) {
            addError(
                errors,
                "CISTERNA_PROVENANCE_COMBINATION_INVALID"
            );
        }

        const measurement =
            provenance.currentMeasurement;

        if (!isObject(measurement)) {
            addError(
                errors,
                "CISTERNA_MEASUREMENT_INCOMPLETE"
            );
        }

        for (const field of canonicalFields) {
            if (
                !isObject(measurement) ||
                !hasOwn(
                    measurement,
                    field
                )
            ) {
                addError(
                    errors,
                    "CISTERNA_MEASUREMENT_INCOMPLETE"
                );

                break;
            }
        }

        if (
            !hasOwn(
                provenance,
                "referenceTimestamp"
            )
        ) {
            addError(
                errors,
                "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
            );
        }

        if (
            !hasOwn(
                provenance,
                "reusedFields"
            ) ||
            !Array.isArray(
                provenance.reusedFields
            )
        ) {
            addError(
                errors,
                "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
            );
        }

        if (errors.length > 0) {
            return invalidResult(errors);
        }

        const fieldByCanonicalName =
            Object.fromEntries(
                contractFields.map(field => [
                    field.canonicalName,
                    field
                ])
            );

        const reusedSet =
            new Set();

        for (
            const field
            of provenance.reusedFields
        ) {
            if (
                !canonicalFields.includes(
                    field
                )
            ) {
                addError(
                    errors,
                    "CISTERNA_REUSED_FIELD_UNKNOWN"
                );

                continue;
            }

            if (reusedSet.has(field)) {
                addError(
                    errors,
                    "CISTERNA_REUSED_FIELD_DUPLICATE"
                );

                continue;
            }

            reusedSet.add(field);
        }

        const reusedFields =
            canonicalFields.filter(field =>
                reusedSet.has(field)
            );

        const normalizedMeasurement =
            {};

        for (const field of contractFields) {
            normalizedMeasurement[
                field.canonicalName
            ] =
                normalizeFieldValue(
                    measurement[
                        field.canonicalName
                    ],
                    field
                );
        }

        const normalizedReference =
            normalizeTrustedReference(
                trustedReference,
                contractFields
            );

        const referenceTimestamp =
            normalizeNumber(
                provenance
                    .referenceTimestamp
            );

        const requiresReference =
            origin === "reutilizados" ||
            origin === "mixtos";

        if (
            requiresReference &&
            trustedReference == null
        ) {
            addError(
                errors,
                "CISTERNA_TRUSTED_REFERENCE_REQUIRED"
            );
        } else if (
            requiresReference &&
            !normalizedReference
        ) {
            addError(
                errors,
                "CISTERNA_TRUSTED_REFERENCE_INVALID"
            );
        }

        if (
            requiresReference &&
            normalizedReference &&
            (
                referenceTimestamp ===
                    null ||
                referenceTimestamp !==
                    normalizedReference
                        .TimestampUbidots
            )
        ) {
            addError(
                errors,
                "CISTERNA_REFERENCE_TIMESTAMP_MISMATCH"
            );
        }

        if (origin === "actualizados") {
            if (
                data.cisterna_habilitada !==
                    true ||
                provenance
                    .referenceTimestamp !==
                    null ||
                reusedFields.length !== 0
            ) {
                addError(
                    errors,
                    "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                );
            }

            for (const field of contractFields) {
                if (
                    field.measurementRequired &&
                    normalizedMeasurement[
                        field.canonicalName
                    ] === null
                ) {
                    addError(
                        errors,
                        "CISTERNA_MEASUREMENT_INCOMPLETE"
                    );
                }
            }
        }

        if (origin === "reutilizados") {
            if (
                data.cisterna_habilitada !==
                    false ||
                !canonicalFields.every(
                    field =>
                        measurement[field] ===
                            null
                )
            ) {
                addError(
                    errors,
                    "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                );
            }

            const availableReferenceFields =
                normalizedReference
                    ? canonicalFields.filter(
                        field =>
                            normalizedReference[
                                field
                            ] !== null &&
                            normalizedReference[
                                field
                            ] !== undefined
                    )
                    : [];

            if (
                normalizedReference &&
                (
                    reusedFields.length !==
                        availableReferenceFields
                            .length ||
                    !availableReferenceFields
                        .every(field =>
                            reusedSet.has(field)
                        )
                )
            ) {
                addError(
                    errors,
                    "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                );
            }
        }

        if (origin === "mixtos") {
            if (
                data.cisterna_habilitada !==
                    true ||
                reusedFields.length < 1
            ) {
                addError(
                    errors,
                    "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                );
            }

            for (const canonicalName of reusedFields) {
                const field =
                    fieldByCanonicalName[
                        canonicalName
                    ];

                if (
                    !field ||
                    field.reuseFromLast !== true
                ) {
                    addError(
                        errors,
                        "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                    );
                }
            }

            for (const field of contractFields) {
                const canonicalName =
                    field.canonicalName;

                const reused =
                    reusedSet.has(
                        canonicalName
                    );

                const currentValue =
                    normalizedMeasurement[
                        canonicalName
                    ];

                if (
                    reused &&
                    measurement[
                        canonicalName
                    ] !== null
                ) {
                    addError(
                        errors,
                        "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                    );
                }

                if (
                    reused &&
                    normalizedReference &&
                    normalizedReference[
                        canonicalName
                    ] === null
                ) {
                    addError(
                        errors,
                        "CISTERNA_FIELD_WITHOUT_SOURCE"
                    );
                }

                if (
                    !reused &&
                    field.measurementRequired &&
                    currentValue === null
                ) {
                    addError(
                        errors,
                        "CISTERNA_FIELD_WITHOUT_SOURCE"
                    );
                }
            }
        }

        if (origin === "ausentes") {
            if (
                data.cisterna_habilitada !==
                    false ||
                !canonicalFields.every(
                    field =>
                        measurement[field] ===
                            null
                ) ||
                provenance
                    .referenceTimestamp !==
                    null ||
                reusedFields.length !== 0
            ) {
                addError(
                    errors,
                    "CISTERNA_PROVENANCE_COMBINATION_INVALID"
                );
            }
        }

        if (errors.length > 0) {
            return invalidResult(errors);
        }

        const appliedReference =
            requiresReference
                ? normalizedReference
                : null;

        const referenceJson =
            appliedReference
                ? buildDeterministicReferenceJson(
                    appliedReference,
                    contractFields
                )
                : null;

        const historicalRecordData = {
            OrigenDatosCisterna:
                origin,

            CisternaReferenciaTimestamp:
                appliedReference
                    ?.TimestampUbidots ??
                null,

            CisternaReferenciaJson:
                referenceJson,

            CisternaCamposReutilizados:
                [...reusedFields]
        };

        const ubidotsEventData = {};

        for (const field of contractFields) {
            const canonicalName =
                field.canonicalName;

            const reused =
                reusedSet.has(
                    canonicalName
                );

            const historicalValue =
                reused
                    ? appliedReference[
                        canonicalName
                    ]
                    : normalizedMeasurement[
                        canonicalName
                    ];

            historicalRecordData[
                canonicalName
            ] =
                historicalValue ?? null;

            if (
                origin !== "ausentes" &&
                !reused &&
                normalizedMeasurement[
                    canonicalName
                ] !== null
            ) {
                ubidotsEventData[
                    canonicalName
                ] =
                    normalizedMeasurement[
                        canonicalName
                    ];
            }
        }

        const contextMetadata = {
            OrigenDatosCisterna:
                origin,

            CisternaCamposReutilizados:
                [...reusedFields]
        };

        if (appliedReference) {
            contextMetadata
                .CisternaReferenciaTimestamp =
                    appliedReference
                        .TimestampUbidots;

            contextMetadata
                .cisterna_referencia_json =
                    referenceJson;
        }

        return {
            valid: true,
            mode: "PROVENANCE_V1",
            origin,
            historicalRecordData,
            ubidotsEventData,
            contextMetadata,
            errors: []
        };
    } catch (error) {
        return invalidResult([
            "CISTERNA_PROVENANCE_PROTOCOL_INVALID"
        ]);
    }
}

module.exports = {
    deriveCisternaProvenance
};