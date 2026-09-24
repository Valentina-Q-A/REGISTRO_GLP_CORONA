"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envArgument =
    process.argv.find(argument =>
        argument.startsWith("--env=")
    );

const showConflicts =
    process.argv.includes(
        "--conflicts"
    );

const showOrphans =
    process.argv.includes(
        "--orphans"
    );

const showEvents =
    process.argv.includes(
        "--events"
    );

const showRepresented =
    process.argv.includes(
        "--represented"
    );

const verbose =
    process.argv.includes("--verbose");

const envFile =
    envArgument
        ? envArgument.replace("--env=", "")
        : ".env";

dotenv.config({
    path: envFile
});

const historySyncConfig =
    require("../config/history-sync.config");

const ubidotsSyncService =
    require("../services/ubidots-sync-service");

const {
    buildCisternaVariableContract
} = require("../js/variables");

const ubidotsHistoryConfigPath =
    path.resolve(
        process.cwd(),
        process.env.GLP_UBIDOTS_HISTORY_CONFIG ||
            "scripts/config-ubidots-glp.js"
    );

const ubidotsConfig =
    require(ubidotsHistoryConfigPath);

function printSection(title) {

    console.log("");
    console.log("======================================");
    console.log(title);
    console.log("======================================");
}

function printCount(label, value) {
    console.log(`${label}:`, value);
}

function printSectionData(
    title,
    data
) {

    console.log("");
    console.log("======================================");
    console.log(title);
    console.log("======================================");

    console.log(
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

function printVerbose(title, data) {

    if (!verbose) {
        return;
    }

    printSection(title);

    console.log(
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

async function main() {

    console.log("");
    console.log("======================================");
    console.log("      SYNC INSPECTION REPORT");
    console.log("======================================");

    const pendingPath =
        path.resolve(
            process.cwd(),
            process.env.GLP_SYNC_PENDING_FILE ||
                "ubidots-pending.json"
        );

    const conflictResolutionsPath =
        path.resolve(
            process.cwd(),
            process.env.GLP_CONFLICT_RESOLUTIONS_FILE ||
                "data/conflict-resolutions.json"
        );

    console.log("");
    console.log("[ENV]", envFile);
    console.log("[CACHE]", historySyncConfig.cachePath);
    console.log("[CHECKPOINT]", historySyncConfig.checkpointPath);

    printSection("FILE STATUS");

    console.log(
        "Cache:",
        fs.existsSync(
            historySyncConfig.cachePath
        )
            ? "OK"
            : "MISSING"
    );

    console.log(
        "Checkpoint:",
        fs.existsSync(
            historySyncConfig.checkpointPath
        )
            ? "OK"
            : "MISSING"
    );

    console.log(
        "Pending:",
        fs.existsSync(
            pendingPath
        )
            ? "OK"
            : "MISSING"
    );

    console.log(
        "Conflict Resolutions:",
        fs.existsSync(
            conflictResolutionsPath
        )
            ? "OK"
            : "NOT CONFIGURED"
    );

    const inspection =
        await ubidotsSyncService.inspectSynchronization({

            cachePath:
                historySyncConfig.cachePath,

            cacheSheet:
                historySyncConfig.cacheSheet,

            checkpointPath:
                historySyncConfig.checkpointPath,

            pendingPath,

            conflictResolutionsPath:
                fs.existsSync(
                    conflictResolutionsPath
                )
                    ? conflictResolutionsPath
                    : null,

            ubidotsConfig,

            cisternaContract:
                buildCisternaVariableContract(),

            token:
                process.env.UBIDOTS_TOKEN
        });

    printSection("SUMMARY");

    printCount(
        "Can Apply",
        inspection.canApply
    );

    printCount(
        "Synchronized",
        inspection.synchronized
    );

    printSection("CACHE");

    printCount(
        "Records",
        inspection.cache.records
    );

    printCount(
        "Visible Timestamps",
        inspection.cache.visibleTimestamps
    );

    printSection("CHECKPOINT");

    printCount(
        "Reviewed Timestamps",
        inspection.checkpoint.reviewedTimestamps
    );

    printCount(
        "Maximum Timestamp",
        inspection.checkpoint.timestampMaximum
    );

    printSection("UBIDOTS");

    printCount(
        "Recovered Records",
        inspection.ubidots.recoveredRecords
    );

    printSection("SIMULATION");

    printSection(
        "PARTIAL SYNCHRONIZATION"
    );

    console.log(
        "Valid Events:",
        inspection.partialSynchronization
            ?.validOperationalEvents ?? 0
    );

    console.log(
        "Conflicts:",
        inspection.partialSynchronization
            ?.unresolvedConflicts ?? 0
    );

    console.log(
        "Orphans:",
        inspection.partialSynchronization
            ?.orphanRecords ?? 0
    );

    console.log(
        "Processable:",
        inspection.partialSynchronization
            ?.processable ?? false
    );


    printCount(
        "New Technical Records",
        inspection.synchronization.details
            .newTechnicalRecords.length
    );

    printCount(
        "New Operational Events",
        inspection.synchronization.details
            .newOperationalEvents.length
    );

    printCount(
        "Equivalent Resends",
        inspection.synchronization.details
            .equivalentResends.length
    );

    printCount(
        "Already Represented",
        inspection.synchronization.details
            .alreadyRepresented.length
    );

    printCount(
        "Records Without Operational Key",
        inspection.synchronization.details
            .recordsWithoutOperationalKey.length
    );

    printCount(
        "Conflicts",
        inspection.synchronization.details
            .conflicts.length
    );

    printSection("INTEGRITY");

    console.log(
        JSON.stringify(
            inspection.integrity,
            null,
            2
        )
    );

    if (verbose) {

        printSectionData(
            "NEW TECHNICAL RECORDS",
            inspection.synchronization.details
                .newTechnicalRecords
        );

        printSectionData(
            "NEW OPERATIONAL EVENTS",
            inspection.synchronization.details
                .newOperationalEvents
        );

        printSectionData(
            "ALREADY REPRESENTED",
            inspection.synchronization.details
                .alreadyRepresented
        );

        printSectionData(
            "WITHOUT OPERATIONAL KEY",
            inspection.synchronization.details
                .recordsWithoutOperationalKey
        );

        printSectionData(
            "CONFLICTS",
            inspection.synchronization.details
                .conflicts
        );
    }
    else {

        if (showEvents) {

            printSectionData(
                "NEW OPERATIONAL EVENTS",
                inspection.synchronization.details
                    .newOperationalEvents
            );
        }

        if (showRepresented) {

            printSectionData(
                "ALREADY REPRESENTED",
                inspection.synchronization.details
                    .alreadyRepresented
            );
        }

        if (showOrphans) {

            printSectionData(
                "WITHOUT OPERATIONAL KEY",
                inspection.synchronization.details
                    .recordsWithoutOperationalKey
            );
        }

        if (showConflicts) {

            printSectionData(
                "CONFLICTS",
                inspection.synchronization.details
                    .conflicts
            );
        }
    }

    console.log("");
    console.log("======================================");
    console.log("END REPORT");
    console.log("======================================");
    console.log("");
}

main()
    .catch(error => {

        console.log("");
        console.log("[INSPECTION_ERROR]");
        console.log("");

        console.error(error);

        process.exit(1);
    });