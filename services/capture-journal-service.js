"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_JOURNAL = {
    version: 1,
    records: []
};

function loadJournal(filePath) {
    const resolvedPath =
        path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
        return {
            ...DEFAULT_JOURNAL
        };
    }

    const content =
        fs.readFileSync(
            resolvedPath,
            "utf8"
        );

    const parsed =
        JSON.parse(content);

    return {
        version:
            Number(parsed.version) || 1,

        records:
            Array.isArray(parsed.records)
                ? parsed.records
                : []
    };
}

function saveJournal(
    filePath,
    journal
) {
    const resolvedPath =
        path.resolve(filePath);

    fs.writeFileSync(
        resolvedPath,
        JSON.stringify(
            journal,
            null,
            2
        ) + "\n",
        "utf8"
    );
}

function appendRecord(
    filePath,
    payload
) {
    const journal =
        loadJournal(filePath);

    const record = {
        journalId:
            crypto.randomUUID(),

        capturedAt:
            new Date()
                .toISOString(),

        status:
            "CAPTURED",

        payload
    };

    journal.records.push(
        record
    );

    saveJournal(
        filePath,
        journal
    );

    return record;
}

function updateRecordStatus(
    filePath,
    journalId,
    status
) {
    const journal =
        loadJournal(filePath);

    const index =
        journal.records.findIndex(
            record =>
                record.journalId ===
                journalId
        );

    if (index < 0) {
        throw new Error(
            "JOURNAL_RECORD_NOT_FOUND"
        );
    }

    journal.records[index] = {
        ...journal.records[index],

        status,

        updatedAt:
            new Date()
                .toISOString()
    };

    saveJournal(
        filePath,
        journal
    );

    return journal.records[index];
}

function listRecordsByStatus(
    filePath,
    status
) {
    return loadJournal(
        filePath
    ).records.filter(
        record =>
            record.status ===
            status
    );
}

function summarizeJournal(
    filePath
) {
    const records =
        loadJournal(
            filePath
        ).records;

    const summary = {};

    for (const record of records) {
        summary[
            record.status
        ] =
            (summary[
                record.status
            ] || 0) + 1;
    }

    return {
        total:
            records.length,

        byStatus:
            summary
    };
}

function findRecord(
    filePath,
    predicate
) {
    return (
        loadJournal(filePath)
            .records
            .find(predicate) || null
    );
}

function markSyncedToUbidots(
    filePath,
    fecha,
    hora
) {
    const journal =
        loadJournal(filePath);

    const record =
        journal.records.find(
            item =>
                item.payload?.Fecha ===
                    fecha &&
                item.payload?.Hora ===
                    hora
        );

    if (!record) {
        return null;
    }

    record.status =
        "SYNCED_TO_UBIDOTS";

    record.updatedAt =
        new Date()
            .toISOString();

    saveJournal(
        filePath,
        journal
    );

    return record;
}

function markPendingUbidots(
    filePath,
    fecha,
    hora,
    reason = null
) {
    const journal =
        loadJournal(filePath);

    console.log(
        "[JOURNAL] buscando",
        {
            fecha,
            hora
        }
    );

    console.log(
        "[JOURNAL] registros",
        journal.records.map(record => ({
            Fecha:
                record.payload?.Fecha,
            Hora:
                record.payload?.Hora,
            Status:
                record.status
        }))
    );

    const record =
        journal.records.find(
            item =>
                String(
                    item.payload?.Fecha || ""
                ).trim() ===
                    String(fecha || "")
                        .trim() &&
                String(
                    item.payload?.Hora || ""
                ).trim() ===
                    String(hora || "")
                        .trim()
        );

    console.log(
        "[JOURNAL] encontrado:",
        Boolean(record)
    );

    if (!record) {
        console.log(
            "[JOURNAL] registro no encontrado"
        );
    console.log(
        "[JOURNAL-EXCEL] buscando",
        {
            fecha,
            hora
        }
    );

    console.log(
        "[JOURNAL-EXCEL] registros",
        journal.records.map(record => ({
            Fecha: record.payload?.Fecha,
            Hora: record.payload?.Hora,
            Status: record.status
        }))
    );

        return null;
    }

    record.status =
        "PENDING_UBIDOTS";

    record.pendingReason =
        reason;

    record.updatedAt =
        new Date()
            .toISOString();

    saveJournal(
        filePath,
        journal
    );

    console.log(
        "[JOURNAL] actualizado a PENDING_UBIDOTS"
    );

    return record;
}

function markSyncedToExcel(
    filePath,
    fecha,
    hora
) {
    const journal =
        loadJournal(filePath);

    console.log(
        "[JOURNAL-EXCEL] buscando",
        {
            fecha,
            hora
        }
    );

    const record =
        journal.records.find(
            item =>
                String(
                    item.payload?.Fecha || ""
                ).trim() ===
                    String(fecha || "")
                        .trim() &&
                String(
                    item.payload?.Hora || ""
                ).trim() ===
                    String(hora || "")
                        .trim()
        );

    console.log(
        "[JOURNAL-EXCEL] encontrado:",
        Boolean(record)
    );

    if (!record) {

        console.log(
            "[JOURNAL-EXCEL] registro no encontrado"
        );

        return null;
    }

    record.status =
        "SYNCED_TO_EXCEL";

    record.updatedAt =
        new Date()
            .toISOString();

    saveJournal(
        filePath,
        journal
    );

    console.log(
        "[JOURNAL-EXCEL] actualizado a SYNCED_TO_EXCEL"
    );

    return record;
}

const crypto =
    require("crypto");

module.exports = {
    loadJournal,
    saveJournal,
    appendRecord,
    updateRecordStatus,
    listRecordsByStatus,
    summarizeJournal,
    findRecord,
    markSyncedToUbidots,
    markPendingUbidots,
    markSyncedToExcel
};