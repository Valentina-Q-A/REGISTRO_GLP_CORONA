"use strict";

function isObject(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}

function requirePositiveInteger(
    value,
    fieldName
) {
    const numericValue =
        Number(value);

    if (
        !Number.isInteger(numericValue) ||
        numericValue <= 0
    ) {
        throw new Error(
            `${fieldName} debe ser un entero positivo.`
        );
    }

    return numericValue;
}

function validateWriteTarget({
    config,
    confirmation,
    expectedPurpose =
        "pending-lifecycle-e2e",
    expectedDeviceLabel =
        "planta-prueba"
} = {}) {
    if (!isObject(config)) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel: null,
            errors: [
                "UBIDOTS_WRITE_CONFIG_INVALID"
            ]
        };
    }

    const writeTarget =
        config.writeTarget;

    if (!isObject(writeTarget)) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel: null,
            errors: [
                "UBIDOTS_WRITE_TARGET_MISSING"
            ]
        };
    }

    if (writeTarget.enabled !== true) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel: null,
            errors: [
                "UBIDOTS_WRITE_TARGET_DISABLED"
            ]
        };
    }

    const purpose =
        normalizeText(
            writeTarget.purpose
        );

    const deviceLabel =
        normalizeText(
            writeTarget.deviceLabel
        );

    const requiredConfirmation =
        normalizeText(
            writeTarget.confirmation
        );

    const receivedConfirmation =
        normalizeText(
            confirmation
        );

    if (
        !purpose ||
        purpose !== expectedPurpose
    ) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_PURPOSE_INVALID"
            ]
        };
    }

    if (
        !deviceLabel ||
        deviceLabel !==
            expectedDeviceLabel
    ) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_DEVICE_NOT_ALLOWED"
            ]
        };
    }

    if (
        !requiredConfirmation ||
        receivedConfirmation !==
            requiredConfirmation ||
        receivedConfirmation !==
            expectedDeviceLabel
    ) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_CONFIRMATION_INVALID"
            ]
        };
    }

    const baseUrl =
        normalizeText(
            config.baseUrl
        ).replace(/\/+$/, "");

    if (!baseUrl) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_BASE_URL_INVALID"
            ]
        };
    }

    let deviceUrl;

    try {
        deviceUrl =
            new URL(
                `${baseUrl}/devices/` +
                encodeURIComponent(
                    deviceLabel
                )
            );
    } catch {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_BASE_URL_INVALID"
            ]
        };
    }

    if (
        deviceUrl.protocol !== "https:" ||
        deviceUrl.username ||
        deviceUrl.password ||
        deviceUrl.search ||
        deviceUrl.hash ||
        !deviceUrl.pathname.endsWith(
            `/devices/${encodeURIComponent(
                expectedDeviceLabel
            )}`
        )
    ) {
        return {
            valid: false,
            deviceUrl: null,
            deviceLabel,
            errors: [
                "UBIDOTS_WRITE_URL_NOT_ALLOWED"
            ]
        };
    }

    return {
        valid: true,
        deviceUrl:
            deviceUrl.toString(),
        deviceLabel,
        purpose,
        errors: []
    };
}

function validatePayload(payload) {
    if (
        !isObject(payload) ||
        Object.keys(payload).length === 0
    ) {
        return {
            valid: false,
            errors: [
                "UBIDOTS_WRITE_PAYLOAD_INVALID"
            ]
        };
    }

    for (
        const [variableLabel, point]
        of Object.entries(payload)
    ) {
        if (
            !normalizeText(variableLabel) ||
            !isObject(point)
        ) {
            return {
                valid: false,
                errors: [
                    "UBIDOTS_WRITE_PAYLOAD_INVALID"
                ]
            };
        }

        const timestamp =
            Number(point.timestamp);

        if (
            !Number.isFinite(timestamp) ||
            timestamp <= 0 ||
            !Object.prototype
                .hasOwnProperty
                .call(
                    point,
                    "value"
                )
        ) {
            return {
                valid: false,
                errors: [
                    "UBIDOTS_WRITE_POINT_INVALID"
                ]
            };
        }

        if (
            point.context !== undefined &&
            !isObject(point.context)
        ) {
            return {
                valid: false,
                errors: [
                    "UBIDOTS_WRITE_CONTEXT_INVALID"
                ]
            };
        }
    }

    return {
        valid: true,
        errors: []
    };
}

async function sendDevicePayload({
    config,
    confirmation,
    payload,
    token,
    fetchImpl = globalThis.fetch,
    timeoutMs
} = {}) {
    const target =
        validateWriteTarget({
            config,
            confirmation
        });

    if (!target.valid) {
        throw Object.assign(
            new Error(
                target.errors.join(" ")
            ),
            {
                code:
                    target.errors[0]
            }
        );
    }

    const payloadValidation =
        validatePayload(
            payload
        );

    if (!payloadValidation.valid) {
        throw Object.assign(
            new Error(
                payloadValidation
                    .errors
                    .join(" ")
            ),
            {
                code:
                    payloadValidation
                        .errors[0]
            }
        );
    }

    const normalizedToken =
        normalizeText(token);

    if (!normalizedToken) {
        throw Object.assign(
            new Error(
                "UBIDOTS_WRITE_TOKEN_MISSING"
            ),
            {
                code:
                    "UBIDOTS_WRITE_TOKEN_MISSING"
            }
        );
    }

    if (typeof fetchImpl !== "function") {
        throw Object.assign(
            new Error(
                "UBIDOTS_WRITE_FETCH_INVALID"
            ),
            {
                code:
                    "UBIDOTS_WRITE_FETCH_INVALID"
            }
        );
    }

    const effectiveTimeout =
        requirePositiveInteger(
            timeoutMs ??
                config.timeoutMs ??
                30000,
            "timeoutMs"
        );

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () =>
                controller.abort(),
            effectiveTimeout
        );

    let response;

    try {
        response =
            await fetchImpl(
                target.deviceUrl,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "X-Auth-Token":
                            normalizedToken
                    },

                    body:
                        JSON.stringify(
                            payload
                        ),

                    signal:
                        controller.signal
                }
            );
    } catch (error) {
        if (
            error?.name ===
                "AbortError"
        ) {
            throw Object.assign(
                new Error(
                    "UBIDOTS_WRITE_TIMEOUT"
                ),
                {
                    code:
                        "UBIDOTS_WRITE_TIMEOUT"
                }
            );
        }

        throw Object.assign(
            new Error(
                "UBIDOTS_WRITE_NETWORK_ERROR"
            ),
            {
                code:
                    "UBIDOTS_WRITE_NETWORK_ERROR",

                cause:
                    error
            }
        );
    } finally {
        clearTimeout(timeout);
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        throw Object.assign(
            new Error(
                "UBIDOTS_WRITE_AUTH_REJECTED"
            ),
            {
                code:
                    "UBIDOTS_WRITE_AUTH_REJECTED",

                status:
                    response.status
            }
        );
    }

    if (!response.ok) {
        const responseBody =
            await response
                .text()
                .catch(() => "");

        throw Object.assign(
            new Error(
                "UBIDOTS_WRITE_HTTP_ERROR"
            ),
            {
                code:
                    "UBIDOTS_WRITE_HTTP_ERROR",

                status:
                    response.status,

                responseExcerpt:
                    responseBody.slice(
                        0,
                        300
                    )
            }
        );
    }

    let responseBody = null;

    try {
        responseBody =
            await response.json();
    } catch {
        responseBody = null;
    }

    return {
        success: true,
        status:
            response.status,
        deviceLabel:
            target.deviceLabel,
        purpose:
            target.purpose,
        response:
            responseBody
    };
}

module.exports = {
    sendDevicePayload,
    validateWriteTarget
};
