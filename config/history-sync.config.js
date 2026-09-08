"use strict";

const path = require("path");

module.exports = Object.freeze({
    historicalBasePath: path.resolve(
        process.cwd(),
        process.env.GLP_HISTORICAL_BASE ||
            "data/registros-historicos-base.xlsx"
    ),

    cachePath: path.resolve(
        process.cwd(),
        process.env.GLP_CACHE_FILE ||
            "registros.xlsx"
    ),

    cacheSheet: process.env.GLP_CACHE_SHEET ||
        "Registros",

    historicalSheet: process.env.GLP_HISTORICAL_SHEET ||
        "Registros",

    operationalKey: [
        "Fecha",
        "Hora"
    ],

    technicalKey:
        "TimestampUbidots",

    syncIntervalMs: Number(
        process.env.GLP_SYNC_INTERVAL_MS ||
        300000
    ),

    autoSyncEnabled:
        String(
            process.env.GLP_AUTO_SYNC_ENABLED ||
            "false"
        ).toLowerCase() === "true",

    syncOnStartup:
        String(
            process.env.GLP_SYNC_ON_STARTUP ||
            "false"
        ).toLowerCase() === "true"
});

