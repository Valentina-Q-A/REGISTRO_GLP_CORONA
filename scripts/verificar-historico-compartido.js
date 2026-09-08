"use strict";

const config =
    require("../config/history-sync.config");

const historyCacheService =
    require("../services/history-cache-service");

try {
    const result =
        historyCacheService.inspectHistory(
            config
        );

    console.log(
        "\nVERIFICACION DEL HISTORICO COMPARTIDO\n"
    );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );

    const valid =
        result.historical.records === 530 &&
        result.historical.uniqueOperationalKeys === 530 &&
        result.historical.duplicates === 0 &&
        result.cache.records === 876 &&
        result.cache.uniqueOperationalKeys === 876 &&
        result.cache.duplicates === 0 &&
        result.cache.columns === 27 &&
        result.cache.recordsWithUbidotsTimestamp === 346;

    if (!valid) {
        console.error(
            "\nLa estructura actual no coincide con el punto de control aprobado."
        );

        process.exitCode = 2;
        return;
    }

    console.log(
        "\nPunto de control aprobado:"
    );

    console.log(
        "530 historicos + 346 Ubidots = 876 registros."
    );
}
catch (error) {
    console.error(
        "\nError verificando el historico:",
        error.message
    );

    process.exitCode = 1;
}
