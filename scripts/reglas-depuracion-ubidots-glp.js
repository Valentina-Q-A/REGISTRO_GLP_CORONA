"use strict";

// Archivo generado automáticamente. No editar manualmente.
// Fuente: matriz aprobada y validación estricta.

module.exports = {
    "metadatos": {
        "version": "1.0.0",
        "generadoISO": "2026-09-07T18:38:53.093Z",
        "matriz": "matriz-decision-duplicados-ubidots-aprobada.xlsx",
        "clasificacion": "clasificacion-duplicados-ubidots.json",
        "validacion": "validacion-matriz-ubidots-aprobada.json",
        "entrada": "registros-ubidots.xlsx",
        "validacionEstrictaRequerida": true,
        "huellasSHA256": {
            "matriz": "56d5bf183e75d04a47579c7dd47be13b2d6d93c5a6e9bdee43d4f57d5e7c6be2",
            "clasificacion": "6a837789d5a8cbde1aab4853de7de90f4e78e601ad22bc47819551af9296f80d",
            "validacion": "2ef071c6d47b021fea5e45af93ef9b601256cee1a5d2c6bde63878589a7f6f38",
            "entrada": "f596b9299999ef738a930884ccb7089e88a0cc0c01723ba70015c09591bc6428"
        }
    },
    "hojaEntrada": "Registros",
    "clave": [
        "Fecha",
        "Hora"
    ],
    "politica": {
        "noInferirDecisiones": true,
        "noCorregirFueraDeRango": true,
        "conservarColumnasTecnicas": true,
        "gruposEquivalentes": "CONSERVAR_PRIMER_ENVIO",
        "gruposInconsistentes": "APLICAR_MATRIZ_APROBADA"
    },
    "gruposEquivalentes": [
        {
            "grupo": "DUP-0001",
            "claveFechaHora": "2026-07-31|23:06:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                3,
                4
            ],
            "filasConservar": [
                3
            ],
            "filasDescartar": [
                4
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0003",
            "claveFechaHora": "2026-08-05|10:52:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                37,
                38
            ],
            "filasConservar": [
                37
            ],
            "filasDescartar": [
                38
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0004",
            "claveFechaHora": "2026-08-05|11:56:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                39,
                40
            ],
            "filasConservar": [
                39
            ],
            "filasDescartar": [
                40
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0005",
            "claveFechaHora": "2026-08-05|15:33:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                42,
                43
            ],
            "filasConservar": [
                42
            ],
            "filasDescartar": [
                43
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0007",
            "claveFechaHora": "2026-08-09|11:32:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                83,
                84
            ],
            "filasConservar": [
                83
            ],
            "filasDescartar": [
                84
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0010",
            "claveFechaHora": "2026-08-11|20:02:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                106,
                107
            ],
            "filasConservar": [
                106
            ],
            "filasDescartar": [
                107
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0011",
            "claveFechaHora": "2026-08-12|04:09:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                111,
                112
            ],
            "filasConservar": [
                111
            ],
            "filasDescartar": [
                112
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0012",
            "claveFechaHora": "2026-08-14|06:44:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                132,
                133
            ],
            "filasConservar": [
                132
            ],
            "filasDescartar": [
                133
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0014",
            "claveFechaHora": "2026-08-19|22:37:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                182,
                183
            ],
            "filasConservar": [
                182
            ],
            "filasDescartar": [
                183
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0016",
            "claveFechaHora": "2026-08-22|23:30:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                203,
                204,
                205
            ],
            "filasConservar": [
                203
            ],
            "filasDescartar": [
                204,
                205
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0017",
            "claveFechaHora": "2026-08-22|11:30:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                206,
                207
            ],
            "filasConservar": [
                206
            ],
            "filasDescartar": [
                207
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0020",
            "claveFechaHora": "2026-08-26|12:30:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                243,
                244
            ],
            "filasConservar": [
                243
            ],
            "filasDescartar": [
                244
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0022",
            "claveFechaHora": "2026-08-26|18:38:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                247,
                248
            ],
            "filasConservar": [
                247
            ],
            "filasDescartar": [
                248
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0024",
            "claveFechaHora": "2026-08-28|10:03:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                263,
                264
            ],
            "filasConservar": [
                263
            ],
            "filasDescartar": [
                264
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0028",
            "claveFechaHora": "2026-08-31|02:22:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                297,
                298
            ],
            "filasConservar": [
                297
            ],
            "filasDescartar": [
                298
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0030",
            "claveFechaHora": "2026-08-31|18:55:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                306,
                307
            ],
            "filasConservar": [
                306
            ],
            "filasDescartar": [
                307
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0031",
            "claveFechaHora": "2026-09-01|03:24:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                311,
                312
            ],
            "filasConservar": [
                311
            ],
            "filasDescartar": [
                312
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0033",
            "claveFechaHora": "2026-09-03|11:00:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                339,
                340,
                341
            ],
            "filasConservar": [
                339
            ],
            "filasDescartar": [
                340,
                341
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0034",
            "claveFechaHora": "2026-09-03|17:57:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                343,
                344
            ],
            "filasConservar": [
                343
            ],
            "filasDescartar": [
                344
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        },
        {
            "grupo": "DUP-0035",
            "claveFechaHora": "2026-09-04|01:16:00",
            "decision": "CONSERVAR_UNA",
            "criterio": "PRIMER_ENVIO",
            "filasDisponibles": [
                348,
                349
            ],
            "filasConservar": [
                348
            ],
            "filasDescartar": [
                349
            ],
            "justificacion": "Versiones operativamente equivalentes; se conserva el primer envío según la clasificación validada."
        }
    ],
    "gruposInconsistentes": [
        {
            "grupo": "DUP-0002",
            "claveFechaHora": "2026-08-04|12:39:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                28,
                35
            ],
            "filasConservar": [
                35
            ],
            "filasDescartar": [
                28
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-07",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0006",
            "claveFechaHora": "2026-08-08|18:55:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                75,
                76
            ],
            "filasConservar": [
                75
            ],
            "filasDescartar": [
                76
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-08",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0008",
            "claveFechaHora": "2026-08-11|08:40:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                99,
                103,
                114,
                115
            ],
            "filasConservar": [
                103
            ],
            "filasDescartar": [
                99,
                114,
                115
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-09",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0009",
            "claveFechaHora": "2026-08-11|11:59:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                101,
                102
            ],
            "filasConservar": [
                101
            ],
            "filasDescartar": [
                102
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-10",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0013",
            "claveFechaHora": "2026-08-15|15:41:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                146,
                147
            ],
            "filasConservar": [
                147
            ],
            "filasDescartar": [
                146
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-11",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0015",
            "claveFechaHora": "2026-08-20|23:31:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                192,
                193,
                194
            ],
            "filasConservar": [
                194
            ],
            "filasDescartar": [
                192,
                193
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-12",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0018",
            "claveFechaHora": "2026-08-24|12:45:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                223,
                224
            ],
            "filasConservar": [
                224
            ],
            "filasDescartar": [
                223
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-13",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0019",
            "claveFechaHora": "2026-08-24|14:55:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                225,
                226
            ],
            "filasConservar": [
                226
            ],
            "filasDescartar": [
                225
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-14",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0021",
            "claveFechaHora": "2026-08-26|16:08:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                245,
                246
            ],
            "filasConservar": [
                246
            ],
            "filasDescartar": [
                245
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-15",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0023",
            "claveFechaHora": "2026-08-27|15:56:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                255,
                256
            ],
            "filasConservar": [
                256
            ],
            "filasDescartar": [
                255
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-16",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0025",
            "claveFechaHora": "2026-08-29|04:10:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                271,
                272
            ],
            "filasConservar": [
                271
            ],
            "filasDescartar": [
                272
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-17",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0026",
            "claveFechaHora": "2026-08-30|04:40:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                286,
                287
            ],
            "filasConservar": [
                287
            ],
            "filasDescartar": [
                286
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-18",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0027",
            "claveFechaHora": "2026-08-29|20:25:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                289,
                290
            ],
            "filasConservar": [
                289
            ],
            "filasDescartar": [
                290
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-19",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0029",
            "claveFechaHora": "2026-08-31|00:20:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                299,
                300
            ],
            "filasConservar": [
                300
            ],
            "filasDescartar": [
                299
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-20",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0032",
            "claveFechaHora": "2026-09-01|06:23:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                314,
                315
            ],
            "filasConservar": [
                315
            ],
            "filasDescartar": [
                314
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-21",
            "estadoRevision": "APROBADO"
        },
        {
            "grupo": "DUP-0036",
            "claveFechaHora": "2026-09-04|07:31:00",
            "decision": "CONSERVAR_UNA",
            "filasDisponibles": [
                352,
                353
            ],
            "filasConservar": [
                352
            ],
            "filasDescartar": [
                353
            ],
            "filaBaseCombinacion": null,
            "nuevaFecha": null,
            "nuevaHora": null,
            "camposCombinarOCorregir": "",
            "justificacion": "Se selecciona la que tiene valores más \"coherentes\"",
            "evidenciaAdicional": "",
            "responsableRevision": "Pablo",
            "fechaRevision": "2026-09-22",
            "estadoRevision": "APROBADO"
        }
    ],
    "resumen": {
        "gruposEquivalentes": 20,
        "filasDescartarEquivalentes": 22,
        "gruposInconsistentes": 16,
        "filasDescartarInconsistentes": 19,
        "filasDescartarTotales": 41
    }
};
