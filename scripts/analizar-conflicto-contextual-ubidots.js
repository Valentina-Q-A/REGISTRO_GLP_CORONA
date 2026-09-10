"use strict";

const path = require("path");

require("dotenv").config({
    quiet: true
});

const ubidotsHistoryService =
    require("../services/ubidots-history-service");

const ubidotsConfig =
    require("./config-ubidots-glp");

function parseArguments(argumentsList) {
    const options = {};

    for (const argument of argumentsList) {
        if (!argument.startsWith("--")) {
            continue;
        }

        const content = argument.slice(2);
        const equalIndex = content.indexOf("=");

        const key =
            equalIndex === -1
                ? content
                : content.slice(0, equalIndex);

        const value =
            equalIndex === -1
                ? "true"
                : content.slice(equalIndex + 1);

        options[key.toLowerCase()] = value;
    }

    return options;
}

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\r\n/g, "\n")
        .trim();
}

function operationalKey(record) {
    return [
        normalizeText(record.Fecha),
        normalizeText(record.Hora)
    ].join("|");
}

function differenceMinutes(leftTimestamp, rightTimestamp) {
    return Number(
        (
            (
                Number(rightTimestamp) -
                Number(leftTimestamp)
            ) /
            60000
        ).toFixed(2)
    );
}

function selectOperationalFields(record) {
    return {
        Fecha:
            record.Fecha ?? null,

        Hora:
            record.Hora ?? null,

        TimestampUbidots:
            record.TimestampUbidots ?? null,

        FechaRecepcionUbidotsUTC:
            record.FechaRecepcionUbidotsUTC ?? null,

        FechaRecepcionUbidotsColombia:
            record.FechaRecepcionUbidotsColombia ?? null,

        DiferenciaRecepcionMinutos:
            record.DiferenciaRecepcionMinutos ?? null,

        NivelTanque:
            record.NivelTanque ?? null,

        PresionTanque:
            record.PresionTanque ?? null,

        TempTanque:
            record.TempTanque ?? null,

        NivelCisterna:
            record.NivelCisterna ?? null,

        PresionCisterna:
            record.PresionCisterna ?? null,

        TempCisterna:
            record.TempCisterna ?? null,

        CapacidadCisterna:
            record.CapacidadCisterna ?? null,

        PlacaCisterna:
            record.PlacaCisterna ?? null,

        PresionBomba:
            record.PresionBomba ?? null,

        TempVapor:
            record.TempVapor ?? null,

        PresionVapor:
            record.PresionVapor ?? null,

        PresionMezcla:
            record.PresionMezcla ?? null,

        EstadoOperacion:
            record.EstadoOperacion ?? null,

        Pendientes:
            record.Pendientes ?? null,

        Observaciones:
            record.Observaciones ?? null,

        Encargado:
            record.Encargado ?? null,

        VariablesPresentes:
            record.VariablesPresentes ?? null,

        VariablesEsperadas:
            record.VariablesEsperadas ?? null
    };
}

function compareRecords(left, right) {
    const ignoredFields =
        new Set([
            "TimestampUbidots",
            "FechaRecepcionUbidotsUTC",
            "FechaRecepcionUbidotsColombia",
            "DiferenciaRecepcionMinutos",
            "ContextoCompletoJSON"
        ]);

    const fields =
        [...new Set([
            ...Object.keys(left),
            ...Object.keys(right)
        ])]
            .filter(field =>
                !ignoredFields.has(field)
            )
            .sort();

    const differences = [];

    for (const field of fields) {
        const valueA =
            left[field] ?? null;

        const valueB =
            right[field] ?? null;

        if (
            normalizeText(valueA) !==
            normalizeText(valueB)
        ) {
            differences.push({
                Campo: field,
                ValorA: valueA,
                ValorB: valueB
            });
        }
    }

    return differences;
}

async function main() {
    const options =
        parseArguments(
            process.argv.slice(2)
        );

    const timestampA =
        Number(options["timestamp-a"]);

    const timestampB =
        Number(options["timestamp-b"]);

    const windowSize =
        Number(options.ventana || 2);

    if (
        !Number.isFinite(timestampA) ||
        !Number.isFinite(timestampB)
    ) {
        throw new Error(
            "Debes indicar --timestamp-a y --timestamp-b."
        );
    }

    const tokenEnvironment =
        ubidotsConfig.tokenEnv ||
        "UBIDOTS_TOKEN";

    const token =
        process.env[tokenEnvironment];

    if (!token) {
        throw new Error(
            `No se encontró ${tokenEnvironment}.`
        );
    }

    const history =
        await ubidotsHistoryService.fetchHistory({
            config: ubidotsConfig,
            token
        });

    const records =
        [...history.records]
            .sort(
                (left, right) =>
                    Number(left.TimestampUbidots) -
                    Number(right.TimestampUbidots)
            );

    const indexA =
        records.findIndex(
            record =>
                Number(record.TimestampUbidots) ===
                timestampA
        );

    const indexB =
        records.findIndex(
            record =>
                Number(record.TimestampUbidots) ===
                timestampB
        );

    if (
        indexA === -1 ||
        indexB === -1
    ) {
        throw new Error(
            "No se encontraron los dos timestamps indicados."
        );
    }

    const startIndex =
        Math.max(
            0,
            Math.min(indexA, indexB) -
                windowSize
        );

    const endIndex =
        Math.min(
            records.length,
            Math.max(indexA, indexB) +
                windowSize +
                1
        );

    const windowRecords =
        records
            .slice(
                startIndex,
                endIndex
            )
            .map((record, offset) => ({
                PosicionGlobal:
                    startIndex + offset,

                Rol:
                    Number(record.TimestampUbidots) === timestampA
                        ? "CONFLICTO_A"
                        : Number(record.TimestampUbidots) === timestampB
                            ? "CONFLICTO_B"
                            : "CONTEXTO",

                ClaveOperacional:
                    operationalKey(record),

                ...selectOperationalFields(record)
            }));

    const recordA =
        records[indexA];

    const recordB =
        records[indexB];

    const result = {
        mode:
            "CONTEXTUAL_ANALYSIS_ONLY",

        originalsModified:
            false,

        contextConflicts:
            history.contextConflicts.length,

        conflict: {
            operationalKey:
                operationalKey(recordA),

            timestampA,

            timestampB,

            separationMinutes:
                differenceMinutes(
                    timestampA,
                    timestampB
                ),

            sameOperationalKey:
                operationalKey(recordA) ===
                operationalKey(recordB),

            differences:
                compareRecords(
                    recordA,
                    recordB
                )
        },

        window:
            windowRecords
    };

    console.log(
        "\nANALISIS CONTEXTUAL DE CONFLICTO UBIDOTS\n"
    );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );

    process.exitCode =
        history.contextConflicts.length === 0
            ? 0
            : 2;
}

main().catch(error => {
    console.error(
        "\nERROR ANALIZANDO CONFLICTO:",
        error.message
    );

    process.exitCode = 1;
});