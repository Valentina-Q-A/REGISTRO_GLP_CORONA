"use strict";

// ============================================================
// REGLAS DE DEPURACIÓN DEL HISTÓRICO GLP
// ============================================================
//
// Compatible con:
//   scripts/depurar-base.js
//
// Ejecución recomendada en modo simulación:
//
//   node scripts/depurar-base.js \
//     --entrada=registros-conciliados.xlsx \
//     --reglas=scripts/reglas-depuracion-glp.js \
//     --salida=registros-depurados.xlsx \
//     --reporte=reporte-depuracion.xlsx \
//     --simular \
//     --estricto \
//     --json=cambios \
//     --limite=20
//
// Ejecución real:
//
//   node scripts/depurar-base.js \
//     --entrada=registros-conciliados.xlsx \
//     --reglas=scripts/reglas-depuracion-glp.js \
//     --salida=registros-depurados.xlsx \
//     --reporte=reporte-depuracion.xlsx \
//     --estricto \
//     --json=cambios \
//     --limite=20
//
// PRINCIPIOS DE ESTAS REGLAS
//
// 1. No se inventan valores ausentes.
// 2. No se corrigen automáticamente valores fuera de rango.
// 3. Se eliminan únicamente duplicados exactos.
// 4. El duplicado inconsistente conocido se resuelve mediante una
//    decisión explícita y documentada.
// 5. Los valores inválidos sin evidencia se convierten a null.
// 6. Las fechas y horas se normalizan a formatos estables.
// 7. Los encargados faltantes permanecen como null.
// 8. La columna ValvulasCapuchon se agrega como null para registros
//    históricos que nunca recopilaron esa información.
//
// IMPORTANTE SOBRE LAS CLAVES DE DUPLICADOS
//
// El motor genérico representa cada parte de la clave mediante un
// prefijo de tipo. Como Fecha y Hora normalizadas son textos, la clave
// del evento 2026-01-10 07:15:00 es:
//
//   T:2026-01-10|T:07:15:00
//
// ============================================================

module.exports = {
    nombre:
        "Reglas de depuración del histórico GLP",

    version:
        "1.0.0",

    hoja:
        "Registros",

    // Fecha + Hora identifican un evento para la deduplicación.
    clave: [
        "Fecha",
        "Hora"
    ],

    // ========================================================
    // COLUMNAS NUEVAS
    // ========================================================
    //
    // null significa que la información no fue recopilada.
    // No debe utilizarse false porque false tendría significado
    // operacional y supondría una respuesta que no existe.
    // ========================================================

    columnasNuevas: {
        ValvulasCapuchon: null
    },

    // ========================================================
    // CAMPOS OBLIGATORIOS
    // ========================================================
    //
    // El motor documentará los vacíos, pero no los completará.
    // ========================================================

    camposObligatorios: [
        "Fecha",
        "Hora",
        "Encargado"
    ],

    // ========================================================
    // NORMALIZACIÓN
    // ========================================================
    //
    // Fecha:
    //   Convierte seriales Excel y textos reconocibles a YYYY-MM-DD.
    //
    // Hora:
    //   Convierte seriales Excel y formatos reconocibles a HH:MM:SS.
    //   El normalizador integrado convierte "3.20 AM" a "03:20:00".
    // ========================================================

    normalizadores: {
        Fecha: "fecha",
        Hora: "hora"
    },

    // ========================================================
    // TRANSFORMACIONES APROBADAS
    // ========================================================

    transformaciones: [
        {
            id:
                "temp-tanque-punto-a-null",

            campo:
                "TempTanque",

            cuando: ({ valor }) =>
                typeof valor === "string" &&
                valor.trim() === ".",

            transformar:
                () => null,

            accion:
                "VALOR_INVALIDO_A_NULL",

            motivo:
                "El valor '.' no es numérico y no existe evidencia para reconstruir la temperatura"
        },

        // Esta transformación no imputa información. Solamente unifica
        // representaciones vacías de Encargado como null.
        {
            id:
                "encargado-vacio-a-null",

            campo:
                "Encargado",

            cuando: ({ valor, utilidades }) =>
                utilidades.esVacio(valor) &&
                valor !== null,

            transformar:
                () => null,

            accion:
                "VACIO_A_NULL",

            motivo:
                "El encargado no pudo determinarse; el valor se conserva como desconocido sin imputación"
        }
    ],

    // ========================================================
    // COMPARACIÓN DE DUPLICADOS
    // ========================================================
    //
    // Se comparan todas las columnas del archivo de salida, incluida
    // ValvulasCapuchon. Como esta nueva columna vale null para todos los
    // registros históricos, no altera la equivalencia de los duplicados.
    // ========================================================

    duplicados: {
        // Eliminar copias exactas o normalizadamente equivalentes.
        eliminarExactos:
            true,

        // Ante duplicados exactos, conservar la primera aparición.
        conservarExacto:
            "primero",

        // Decisiones explícitas para duplicados inconsistentes conocidos.
        decisiones: {
            "T:2026-01-10|T:07:15:00": {
                conservarCuando: {
                    NivelCisterna: 76,
                    TempVapor: 65,
                    PresionVapor: 105
                },

                motivo:
                    "Se conserva la captura con NivelCisterna 76, TempVapor 65 y PresionVapor 105. La otra captura contiene valores incompatibles y probablemente cruzados."
            }
        }
    },

    // ========================================================
    // VALIDACIONES POSTERIORES A LAS TRANSFORMACIONES
    // ========================================================
    //
    // Estas validaciones generan hallazgos en el reporte. No cambian
    // los datos y no impiden la salida salvo que el motor se ejecute
    // con una política externa adicional.
    // ========================================================

    validaciones: [
        {
            id:
                "fecha-no-vacia",

            campo:
                "Fecha",

            severidad:
                "error",

            validar: ({ registro, utilidades }) =>
                !utilidades.esVacio(registro.Fecha),

            mensaje:
                "El registro no contiene una fecha"
        },
        {
            id:
                "hora-no-vacia",

            campo:
                "Hora",

            severidad:
                "error",

            validar: ({ registro, utilidades }) =>
                !utilidades.esVacio(registro.Hora),

            mensaje:
                "El registro no contiene una hora"
        },
        {
            id:
                "hora-formato-hh-mm-ss",

            campo:
                "Hora",

            severidad:
                "error",

            validar: ({ registro, utilidades }) => {
                if (utilidades.esVacio(registro.Hora)) {
                    return false;
                }

                const coincidencia = String(registro.Hora).match(
                    /^(\d{2}):(\d{2}):(\d{2})$/
                );

                if (!coincidencia) {
                    return false;
                }

                const horas = Number(coincidencia[1]);
                const minutos = Number(coincidencia[2]);
                const segundos = Number(coincidencia[3]);

                return (
                    horas >= 0 &&
                    horas <= 23 &&
                    minutos >= 0 &&
                    minutos <= 59 &&
                    segundos >= 0 &&
                    segundos <= 59
                );
            },

            mensaje:
                "La hora no tiene un formato HH:MM:SS válido"
        },
        {
            id:
                "fecha-formato-iso",

            campo:
                "Fecha",

            severidad:
                "error",

            validar: ({ registro, utilidades }) => {
                if (utilidades.esVacio(registro.Fecha)) {
                    return false;
                }

                const texto = String(registro.Fecha);
                const coincidencia = texto.match(
                    /^(\d{4})-(\d{2})-(\d{2})$/
                );

                if (!coincidencia) {
                    return false;
                }

                const year = Number(coincidencia[1]);
                const month = Number(coincidencia[2]);
                const day = Number(coincidencia[3]);
                const fecha = new Date(year, month - 1, day);

                return (
                    fecha.getFullYear() === year &&
                    fecha.getMonth() === month - 1 &&
                    fecha.getDate() === day
                );
            },

            mensaje:
                "La fecha no tiene un formato YYYY-MM-DD válido"
        },
        {
            id:
                "encargado-no-vacio",

            campo:
                "Encargado",

            severidad:
                "advertencia",

            validar: ({ registro, utilidades }) =>
                !utilidades.esVacio(registro.Encargado),

            mensaje:
                "No fue posible identificar al encargado; el registro se conserva sin imputación"
        },
        {
            id:
                "temp-tanque-numerica-o-vacia",

            campo:
                "TempTanque",

            severidad:
                "error",

            validar: ({ registro, utilidades }) =>
                utilidades.esVacio(registro.TempTanque) ||
                utilidades.normalizarNumero(registro.TempTanque) !== null,

            mensaje:
                "TempTanque debe ser numérica o permanecer vacía"
        }
    ],

    // ========================================================
    // ORDENAMIENTO
    // ========================================================
    //
    // El motor ordena por la clave Fecha + Hora ya normalizada.
    // ========================================================

    ordenar:
        true
};
