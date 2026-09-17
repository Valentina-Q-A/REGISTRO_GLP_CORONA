"use strict";

function createCisternaReferenceState() {
    return {
        encontrada: false,
        referencia: null,
        razon: "NOT_INITIALIZED",
        source: "UBIDOTS_HISTORY",
        referenceUpdatedAt: null,
        lastInspectionAt: null,
        lastInspectionFoundReference: null
    };
}

function copyState(state) {
    return {
        ...state,
        referencia:
            state.referencia
                ? { ...state.referencia }
                : null
    };
}

function updateCisternaReferenceState(
    state,
    result,
    inspectionAt
) {
    const selection =
        result?.ubidots?.cisternaReference;

    if (!selection) {
        return state;
    }

    if (
        typeof inspectionAt !== "string" ||
        inspectionAt.trim() === ""
    ) {
        throw new TypeError(
            "inspectionAt debe ser un texto ISO no vacío."
        );
    }

    const nextState =
        copyState(state);

    if (selection.encontrada === true) {
        const timestamp =
            Number(
                selection.referencia?.TimestampUbidots
            );

        const timestampValid =
            Number.isFinite(timestamp) &&
            timestamp > 0;

        if (!timestampValid) {
            nextState.lastInspectionAt =
                inspectionAt;

            nextState.lastInspectionFoundReference =
                false;

            if (!nextState.referencia) {
                nextState.encontrada = false;
                nextState.razon =
                    "INVALID_CISTERNA_REFERENCE_TIMESTAMP";
                nextState.referenceUpdatedAt = null;
            }
            else {
                nextState.encontrada = true;
                nextState.razon = null;
            }

            return nextState;
        }

        const currentTimestamp =
            Number(
                nextState.referencia
                    ?.TimestampUbidots
            );

        const shouldReplace =
            !nextState.referencia ||
            !Number.isFinite(currentTimestamp) ||
            timestamp > currentTimestamp;

        nextState.lastInspectionAt =
            inspectionAt;

        nextState.lastInspectionFoundReference =
            true;

        if (!shouldReplace) {
            return nextState;
        }

        nextState.encontrada = true;
        nextState.referencia = {
            ...selection.referencia
        };
        nextState.razon = null;
        nextState.source = "UBIDOTS_HISTORY";
        nextState.referenceUpdatedAt = inspectionAt;

        return nextState;
    }

    nextState.lastInspectionAt =
        inspectionAt;

    nextState.lastInspectionFoundReference =
        false;

    if (nextState.referencia) {
        nextState.encontrada = true;
        nextState.razon = null;
        return nextState;
    }

    nextState.encontrada = false;
    nextState.referencia = null;
    nextState.razon =
        selection.razon ||
        "NO_COMPLETE_CISTERNA_REFERENCE";
    nextState.referenceUpdatedAt = null;

    return nextState;
}

function getCisternaReferenceState(state) {
    return copyState(state);
}

module.exports = {
    createCisternaReferenceState,
    updateCisternaReferenceState,
    getCisternaReferenceState
};
