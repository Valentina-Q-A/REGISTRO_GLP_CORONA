"use strict";

const TECHNICAL_COLUMNS = new Set([
    "TimestampUbidots",
    "FechaRecepcionUbidotsUTC",
    "FechaRecepcionUbidotsColombia",
    "DiferenciaRecepcionMinutos",
    "VariablesPresentes",
    "VariablesEsperadas",
    "ContextoCompletoJSON"
]);

function requirePositiveInteger(value, name, allowZero = false) {
    const number = Number(value);
    const minimum = allowZero ? 0 : 1;

    if (!Number.isInteger(number) || number < minimum) {
        throw new Error(
            `${name} debe ser un entero mayor o igual a ${minimum}.`
        );
    }

    return number;
}

function isValidTimestamp(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0;
}

function normalizeText(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function normalizeDate(value) {
    const text = normalizeText(value);

    if (!text) {
        return "";
    }

    const matchIso =
        text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if (matchIso) {
        return [
            matchIso[1],
            matchIso[2].padStart(2, "0"),
            matchIso[3].padStart(2, "0")
        ].join("-");
    }

    const matchLocal =
        text.match(/^(\d{1,2})\d{1,2}\d{4}/);

    if (matchLocal) {
        return [
            matchLocal[3],
            matchLocal[2].padStart(2, "0"),
            matchLocal[1].padStart(2, "0")
        ].join("-");
    }

    return text;
}

function normalizeTime(value) {
    const text = normalizeText(value);

    if (!text) {
        return "";
    }

    const match =
        text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);

    if (!match) {
        return text;
    }

    return [
        match[1].padStart(2, "0"),
        match[2].padStart(2, "0"),
        String(match[3] || "0").padStart(2, "0")
    ].join(":");
}

function buildOperationalKey(record) {
    return [
        normalizeDate(record.Fecha),
        normalizeTime(record.Hora)
    ].join("|");
}

function formatUtc(timestamp) {
    if (!isValidTimestamp(timestamp)) {
        return null;
    }

    return new Date(Number(timestamp)).toISOString();
}

function formatLocal(timestamp, timeZone) {
    if (!isValidTimestamp(timestamp)) {
        return null;
    }

    return new Intl.DateTimeFormat("es-CO", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(new Date(Number(timestamp)));
}

function receptionDifferenceMinutes(timestamp, date, time) {
    if (!date || !time || !isValidTimestamp(timestamp)) {
        return null;
    }

    const operationalDate =
        new Date(`${date}T${time}-05:00`);

    if (Number.isNaN(operationalDate.getTime())) {
        return null;
    }

    return Math.round(
        (
            Number(timestamp) -
            operationalDate.getTime()
        ) / 60000
    );
}

function buildInitialUrl(config, variableId) {
    const baseUrl =
        String(config.baseUrl || "")
            .replace(/\/+$/, "");

    const url = new URL(
        `${baseUrl}/variables/${encodeURIComponent(variableId)}/values`
    );

    url.searchParams.set(
        "page_size",
        String(config.pageSize || 100)
    );

    for (
        const [key, value]
        of Object.entries(config.parametros || {})
    ) {
        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {
            url.searchParams.set(key, String(value));
        }
    }

    return url.toString();
}

async function fetchJson(url, options) {
    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs
    );

    try {
        const response = await options.fetchImpl(url, {
            method: "GET",
            headers: {
                "X-Auth-Token": options.token,
                "Accept": "application/json"
            },
            signal: controller.signal
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                `Autenticación de Ubidots rechazada (HTTP ${response.status}).`
            );
        }

        if (!response.ok) {
            const body =
                await response.text().catch(() => "");

            throw new Error(
                `Ubidots respondió HTTP ${response.status}` +
                (body ? `: ${body.slice(0, 300)}` : "")
            );
        }

        return response.json();
    }
    catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                `La consulta a Ubidots superó ${options.timeoutMs} ms.`
            );
        }

        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}

async function fetchVariable(label, variableId, options) {
    let url =
        buildInitialUrl(options.config, variableId);

    const values = [];
    const visited = new Set();
    let pages = 0;

    while (url) {
        if (visited.has(url)) {
            throw new Error(
                `Se detectó un ciclo de paginación en ${label}.`
            );
        }

        visited.add(url);
        pages++;

        if (
            options.maxPages > 0 &&
            pages > options.maxPages
        ) {
            throw new Error(
                `${label} superó el máximo de ${options.maxPages} páginas.`
            );
        }

        const content =
            await fetchJson(url, options);

        const pageValues =
            Array.isArray(content)
                ? content
                : Array.isArray(content.results)
                    ? content.results
                    : [];

        values.push(...pageValues);

        url =
            Array.isArray(content)
                ? null
                : content.next || null;
    }

    return {
        label,
        variableId,
        pages,
        values
    };
}

async function mapWithConcurrency(entries, limit, task) {
    const results = new Array(entries.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const current = nextIndex;
            nextIndex++;

            if (current >= entries.length) {
                return;
            }

            results[current] =
                await task(entries[current], current);
        }
    }

    const workers = Array.from(
        {
            length: Math.min(limit, entries.length)
        },
        () => worker()
    );

    await Promise.all(workers);

    return results;
}

function reconstructRecords(variableResults) {
    const recordsByTimestamp = new Map();
    const contextConflicts = [];

    for (const variableResult of variableResults) {
        for (const point of variableResult.values) {
            if (!isValidTimestamp(point.timestamp)) {
                continue;
            }

            const timestamp =
                Number(point.timestamp);

            if (!recordsByTimestamp.has(timestamp)) {
                recordsByTimestamp.set(timestamp, {
                    timestamp,
                    context: {},
                    variablesPresent: []
                });
            }

            const record =
                recordsByTimestamp.get(timestamp);

            const context =
                point.context || {};

            for (
                const [field, value]
                of Object.entries(context)
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        record.context,
                        field
                    ) &&
                    JSON.stringify(record.context[field]) !==
                        JSON.stringify(value)
                ) {
                    contextConflicts.push({
                        TimestampUbidots: timestamp,
                        Campo: field,
                        ValorExistente:
                            record.context[field],
                        ValorNuevo:
                            value,
                        VariableNueva:
                            variableResult.label
                    });
                }

                record.context[field] = value;
            }

            record[variableResult.label] =
                point.value;

            if (
                !record.variablesPresent.includes(
                    variableResult.label
                )
            ) {
                record.variablesPresent.push(
                    variableResult.label
                );
            }
        }
    }

    return {
        records: [...recordsByTimestamp.values()]
            .sort((a, b) => a.timestamp - b.timestamp),

        contextConflicts
    };
}

function flattenRecord(record, config) {
    const row = {};
    const context = record.context || {};
    const dateField =
        config.camposContexto?.fecha || "Fecha";
    const timeField =
        config.camposContexto?.hora || "Hora";

    for (
        const label
        of Object.keys(config.variables || {})
    ) {
        const outputColumn =
            config.mapeoSalida?.[label] || label;

        row[outputColumn] =
            Object.prototype.hasOwnProperty.call(
                record,
                label
            )
                ? record[label]
                : null;
    }

    for (
        const [contextField, outputColumn]
        of Object.entries(config.contextoSalida || {})
    ) {
        row[outputColumn] =
            Object.prototype.hasOwnProperty.call(
                context,
                contextField
            )
                ? context[contextField]
                : null;
    }

    row.Fecha =
        normalizeDate(context[dateField]);

    row.Hora =
        normalizeTime(context[timeField]);

    row.TimestampUbidots =
        record.timestamp;

    row.FechaRecepcionUbidotsUTC =
        formatUtc(record.timestamp);

    row.FechaRecepcionUbidotsColombia =
        formatLocal(
            record.timestamp,
            config.zonaHoraria || "America/Bogota"
        );

    row.DiferenciaRecepcionMinutos =
        receptionDifferenceMinutes(
            record.timestamp,
            row.Fecha,
            row.Hora
        );

    row.VariablesPresentes =
        record.variablesPresent.length;

    row.VariablesEsperadas =
        Object.keys(config.variables || {}).length;

    row.ContextoCompletoJSON =
        JSON.stringify(context);

    return row;
}

function operationalColumns(config) {
    return [
        ...Object.values(config.mapeoSalida || {}),
        ...Object.values(config.contextoSalida || {}),
        "Fecha",
        "Hora"
    ].filter(
        (value, index, array) =>
            value &&
            !TECHNICAL_COLUMNS.has(value) &&
            array.indexOf(value) === index
    );
}

function normalizeComparable(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return value.trim();
    }

    return value;
}

function compareOperationalRecords(left, right, columns) {
    const differences = [];

    for (const column of columns) {
        const leftValue =
            normalizeComparable(left[column]);

        const rightValue =
            normalizeComparable(right[column]);

        if (
            JSON.stringify(leftValue) !==
            JSON.stringify(rightValue)
        ) {
            differences.push({
                Campo: column,
                ValorA: leftValue,
                ValorB: rightValue
            });
        }
    }

    return differences;
}

function simulateIncrementalSync({
    cacheRecords,
    ubidotsRecords,
    reviewedTimestamps = [],
    config
}) {
    const cachedTimestamps = new Set(
        cacheRecords
            .filter(record =>
                record.TimestampUbidots !== null &&
                record.TimestampUbidots !== undefined &&
                record.TimestampUbidots !== ""
            )
            .map(record =>
                String(record.TimestampUbidots)
            )
    );

    const knownTechnicalTimestamps = new Set([
        ...cachedTimestamps,
        ...reviewedTimestamps.map(timestamp =>
            String(timestamp)
        )
    ]);

    const cacheByOperationalKey =
        new Map(
            cacheRecords.map(record => [
                buildOperationalKey(record),
                record
            ])
        );

    const technicalNewRecords =
        ubidotsRecords
            .filter(record =>
                !knownTechnicalTimestamps.has(
                    String(record.TimestampUbidots)
                )
            )
            .sort(
                (a, b) =>
                    Number(a.TimestampUbidots) -
                    Number(b.TimestampUbidots)
            );

    const withoutOperationalKey = [];
    const alreadyRepresented = [];
    const groups = new Map();

    for (const record of technicalNewRecords) {
        const key =
            buildOperationalKey(record);

        if (key === "|") {
            withoutOperationalKey.push(record);
            continue;
        }

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(record);
    }

    const columns =
        operationalColumns(config);

    const newOperationalEvents = [];
    const equivalentResends = [];
    const conflicts = [];

    for (const [key, group] of groups) {
        const cached =
            cacheByOperationalKey.get(key);

        if (cached) {
            for (const candidate of group) {
                const differences =
                    compareOperationalRecords(
                        cached,
                        candidate,
                        columns
                    );

                if (differences.length === 0) {
                    alreadyRepresented.push({
                        Clave: key,
                        TimestampUbidots:
                            candidate.TimestampUbidots
                    });
                }
                else {
                    conflicts.push({
                        Clave: key,
                        Tipo: "COLISION_CON_CACHE",
                        TimestampUbidots:
                            candidate.TimestampUbidots,
                        Diferencias: differences
                    });
                }
            }

            continue;
        }

        const reference = group[0];
        const groupConflicts = [];

        for (const compared of group.slice(1)) {
            const differences =
                compareOperationalRecords(
                    reference,
                    compared,
                    columns
                );

            if (differences.length === 0) {
                equivalentResends.push({
                    Clave: key,
                    TimestampConservado:
                        reference.TimestampUbidots,
                    TimestampDescartado:
                        compared.TimestampUbidots
                });
            }
            else {
                groupConflicts.push({
                    Clave: key,
                    Tipo: "CONFLICTO_INCREMENTAL",
                    TimestampReferencia:
                        reference.TimestampUbidots,
                    TimestampComparado:
                        compared.TimestampUbidots,
                    Diferencias: differences
                });
            }
        }

        if (groupConflicts.length > 0) {
            conflicts.push(...groupConflicts);
            continue;
        }

        newOperationalEvents.push(reference);
    }

    return {
        summary: {
            cacheRecords:
                cacheRecords.length,

            cachedUbidotsTimestamps:
                cachedTimestamps.size,

            recoveredUbidotsRecords:
                ubidotsRecords.length,

            newTechnicalRecords:
                technicalNewRecords.length,



            newOperationalEvents:
                newOperationalEvents.length,

            equivalentResends:
                equivalentResends.length,

            alreadyRepresented:
                alreadyRepresented.length,

            reviewedTechnicalTimestamps:
                knownTechnicalTimestamps.size,

            recordsWithoutOperationalKey:
                withoutOperationalKey.length,

            conflicts:
                conflicts.length,

            proposedCacheRecords:
                cacheRecords.length +
                newOperationalEvents.length
        },

        newTechnicalRecords: technicalNewRecords,
        newOperationalEvents,
        equivalentResends,
        alreadyRepresented,
        recordsWithoutOperationalKey:
            withoutOperationalKey,

        conflicts
    };
}

async function fetchHistory({
    config,
    token,
    fetchImpl = globalThis.fetch
}) {
    if (!token) {
        throw new Error(
            `No se encontró ${config.tokenEnv || "UBIDOTS_TOKEN"}.`
        );
    }

    if (typeof fetchImpl !== "function") {
        throw new Error(
            "Se requiere Node.js 18 o superior."
        );
    }

    const concurrency =
        requirePositiveInteger(
            config.concurrencia || 2,
            "concurrencia"
        );

    const timeoutMs =
        requirePositiveInteger(
            config.timeoutMs || 30000,
            "timeoutMs"
        );

    const maxPages =
        requirePositiveInteger(
            config.maxPaginas ?? 10000,
            "maxPaginas",
            true
        );

    const entries =
        Object.entries(config.variables || {});

    const variableResults =
        await mapWithConcurrency(
            entries,
            concurrency,
            ([label, variableId]) =>
                fetchVariable(label, variableId, {
                    config,
                    token,
                    fetchImpl,
                    timeoutMs,
                    maxPages
                })
        );

    const reconstruction =
        reconstructRecords(variableResults);

    const flatRecords =
        reconstruction.records.map(
            record => flattenRecord(record, config)
        );

    return {
        records: flatRecords,
        variableResults,
        contextConflicts:
            reconstruction.contextConflicts
    };
}

module.exports = {
    buildOperationalKey,
    compareOperationalRecords,
    fetchHistory,
    flattenRecord,
    operationalColumns,
    reconstructRecords,
    simulateIncrementalSync
};
