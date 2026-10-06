"use strict";

const snapshot = [
    {
        id: "p-001",

        type: "otro",

        description:
            "Fuga lÃ­nea vapor",

        creation: {
            fechaRegistro:
                "2026-09-28",

            encargadoRegistro:
                "Prueba"
        },

        resolution: null
    },

    {
        id: "p-002",

        type: "bomba_1_apagada",

        description:
            "Bomba 1 apagada",

        creation: {
            fechaRegistro:
                "2026-09-28",

            encargadoRegistro:
                "Prueba"
        },

        resolution: {
            fechaSolucion:
                "2026-09-29",

            encargadoSolucion:
                "Juan Pablo"
        }
    }
];

function buildPendingSnapshotContext(
    snapshot = []
) {

    return snapshot.map(
        pending => ({
            id:
                pending.id,

            tipo:
                pending.type,

            descripcion:
                pending.description,

            fecha:
                pending.creation
                    ?.fechaRegistro,

            encargado:
                pending.creation
                    ?.encargadoRegistro,

            estado:
                pending.resolution
                    ? "resuelto"
                    : "activo",

            fechaSolucion:
                pending.resolution
                    ?.fechaSolucion ?? null,

            encargadoSolucion:
                pending.resolution
                    ?.encargadoSolucion ?? null
        })
    );
}

console.log(
    JSON.stringify(
        buildPendingSnapshotContext(
            snapshot
        ),
        null,
        2
    )
);
