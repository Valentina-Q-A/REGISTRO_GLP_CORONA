"use strict";

const DEFAULT_UBIDOTS_API_BASE_URL =
    "https://industrial.api.ubidots.com/api/v1.6";

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}

function buildUbidotsDeviceUrl({
    environment = process.env,
    baseUrl =
        DEFAULT_UBIDOTS_API_BASE_URL
} = {}) {
    const deviceLabel =
        normalizeText(
            environment
                ?.UBIDOTS_DEVICE
        );

    if (!deviceLabel) {
        throw Object.assign(
            new Error(
                "UBIDOTS_DEVICE no está configurado."
            ),
            {
                code:
                    "UBIDOTS_DEVICE_MISSING"
            }
        );
    }

    if (
        !/^[a-z0-9][a-z0-9_-]*$/i
            .test(deviceLabel)
    ) {
        throw Object.assign(
            new Error(
                "UBIDOTS_DEVICE contiene caracteres inválidos."
            ),
            {
                code:
                    "UBIDOTS_DEVICE_INVALID"
            }
        );
    }

    const normalizedBaseUrl =
        normalizeText(
            baseUrl
        ).replace(/\/+$/, "");

    if (!normalizedBaseUrl) {
        throw Object.assign(
            new Error(
                "La URL base de Ubidots es inválida."
            ),
            {
                code:
                    "UBIDOTS_BASE_URL_INVALID"
            }
        );
    }

    let deviceUrl;

    try {
        deviceUrl =
            new URL(
                `${normalizedBaseUrl}/devices/` +
                encodeURIComponent(
                    deviceLabel
                )
            );
    } catch {
        throw Object.assign(
            new Error(
                "La URL base de Ubidots es inválida."
            ),
            {
                code:
                    "UBIDOTS_BASE_URL_INVALID"
            }
        );
    }

    const expectedPathSuffix =
        `/devices/${encodeURIComponent(
            deviceLabel
        )}`;

    if (
        deviceUrl.protocol !== "https:" ||
        deviceUrl.username ||
        deviceUrl.password ||
        deviceUrl.search ||
        deviceUrl.hash ||
        !deviceUrl.pathname.endsWith(
            expectedPathSuffix
        )
    ) {
        throw Object.assign(
            new Error(
                "El destino de Ubidots es inválido."
            ),
            {
                code:
                    "UBIDOTS_DEVICE_URL_INVALID"
            }
        );
    }

    return {
        deviceUrl:
            deviceUrl.toString(),

        deviceLabel,

        baseUrl:
            normalizedBaseUrl
    };
}

module.exports = {
    buildUbidotsDeviceUrl
};
