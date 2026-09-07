"use strict";

// ============================================================
// VALIDADOR DE MATRIZ DE DECISIONES DE DUPLICADOS UBIDOTS
// ============================================================
//
// Nombre recomendado:
//   scripts/validar-matriz-duplicados-ubidots.js
//
// Propósito:
//   - Validar una matriz de decisiones diligenciada.
//   - Contrastar grupos y filas contra los archivos fuente.
//   - Detectar decisiones incompletas, contradictorias o inseguras.
//   - No modificar la matriz ni aplicar depuración.
//   - Generar un reporte Excel y un JSON de validación.
//
// Uso:
//   node scripts/validar-matriz-duplicados-ubidots.js \
//     --matriz=matriz-decision-duplicados-ubidots-revisada.xlsx \
//     --entrada=registros-ubidots.xlsx \
//     --clasificacion=clasificacion-duplicados-ubidots.json \
//     --reporte=reporte-validacion-matriz-ubidots.xlsx \
//     --json=validacion-matriz-ubidots.json \
//     --estricto \
//     --consola=hallazgos \
//     --limite=20
//
// Opciones:
//   --matriz=<xlsx>             Obligatorio
//   --entrada=<xlsx>            Obligatorio
//   --clasificacion=<json>      Obligatorio
//   --hoja-matriz=<nombre>      Predeterminado: MatrizDecisiones
//   --hoja-entrada=<nombre>     Predeterminado: Registros
//   --reporte=<xlsx>            Predeterminado automático
//   --json=<json>               Predeterminado automático
//   --estricto                  Advertencias bloquean aprobación global
//   --consola=resumen|hallazgos|completo|ninguno
//   --limite=<n>                0 = sin límite
//   --ayuda
//
// Códigos de salida:
//   0 = matriz aprobada
//   2 = matriz no aprobada por errores o pendientes
//   3 = modo estricto: existen advertencias
//   1 = error de ejecución o estructura
//
// Este script NO modifica archivos de entrada ni elimina registros.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const DECISIONES = new Set([
    "PENDIENTE",
    "CONSERVAR_UNA",
    "CONSERVAR_VARIAS",
    "CONSERVAR_TODAS",
    "COMBINAR",
    "CORREGIR_FECHA_HORA",
    "DESCARTAR_GRUPO"
]);

const ESTADOS = new Set([
    "PENDIENTE",
    "EN_REVISION",
    "APROBADO",
    "RECHAZADO"
]);

const CAMPOS_REQUERIDOS_MATRIZ = [
    "Grupo",
    "ClaveFechaHora",
    "CantidadVersiones",
    "FilasDisponibles",
    "Decision",
    "FilasConservar",
    "FilasDescartar",
    "Justificacion",
    "ResponsableRevision",
    "FechaRevision",
    "EstadoRevision"
];

function leerArgumentos(argumentos) {
    const opciones = {};

    for (const argumento of argumentos) {
        if (!argumento.startsWith("--")) continue;
        const contenido = argumento.slice(2);
        const posicion = contenido.indexOf("=");
        const clave = posicion === -1
            ? contenido
            : contenido.slice(0, posicion);
        const valor = posicion === -1
            ? "true"
            : contenido.slice(posicion + 1);
        opciones[clave.toLowerCase()] = valor;
    }

    return opciones;
}

function mostrarAyuda() {
    console.log(`
Validador de matriz de duplicados Ubidots

Uso:
  node scripts/validar-matriz-duplicados-ubidots.js \\
    --matriz=<matriz-revisada.xlsx> \\
    --entrada=<registros-ubidots.xlsx> \\
    --clasificacion=<clasificacion.json> [opciones]

Opciones:
  --hoja-matriz=<nombre>              MatrizDecisiones
  --hoja-entrada=<nombre>             Registros
  --reporte=<archivo.xlsx>            Reporte de validación
  --json=<archivo.json>               Resultado estructurado
  --estricto                          Advertencias bloquean aprobación
  --consola=resumen|hallazgos|completo|ninguno
  --limite=<n>                        Máximo por lista; 0 = sin límite
  --ayuda
`);
}

function terminar(mensaje, codigo = 1) {
    if (mensaje) console.error(`ERROR: ${mensaje}`);
    process.exit(codigo);
}

function esVacio(valor) {
    return valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "");
}

function texto(valor) {
    return esVacio(valor) ? "" : String(valor).trim();
}

function normalizarEnumerado(valor) {
    return texto(valor).toUpperCase().replace(/\s+/g, "_");
}

function parsearFilas(valor) {
    if (esVacio(valor)) return { filas: [], invalidos: [] };

    const partes = String(valor)
        .split(/[;,\s]+/)
        .map(item => item.trim())
        .filter(Boolean);
    const filas = [];
    const invalidos = [];

    for (const parte of partes) {
        const numero = Number(parte);
        if (Number.isInteger(numero) && numero >= 2) {
            filas.push(numero);
        } else {
            invalidos.push(parte);
        }
    }

    return {
        filas: [...new Set(filas)],
        invalidos
    };
}

function interseccion(a, b) {
    const conjuntoB = new Set(b);
    return a.filter(valor => conjuntoB.has(valor));
}

function diferencia(a, b) {
    const conjuntoB = new Set(b);
    return a.filter(valor => !conjuntoB.has(valor));
}

function union(...listas) {
    return [...new Set(listas.flat())];
}

function fechaValida(valor) {
    const cadena = texto(valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cadena)) return false;

    const fecha = new Date(`${cadena}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === cadena;
}

function horaValida(valor) {
    const cadena = texto(valor);
    const coincidencia = cadena.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!coincidencia) return false;

    const [, hora, minuto, segundo] = coincidencia.map(Number);
    return hora >= 0 && hora <= 23 &&
        minuto >= 0 && minuto <= 59 &&
        segundo >= 0 && segundo <= 59;
}

function fechaRevisionValida(valor) {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return true;
    if (typeof valor === "number") {
        return Boolean(XLSX.SSF.parse_date_code(valor));
    }
    return fechaValida(valor);
}

function claveRegistro(registro) {
    let hora = texto(registro.Hora);
    if (/^\d{1,2}:\d{2}$/.test(hora)) hora += ":00";
    return `${texto(registro.Fecha)}|${hora}`;
}

function enteroNoNegativo(valor, nombre) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 0) {
        terminar(`${nombre} debe ser un entero mayor o igual a 0.`);
    }
    return numero;
}

function limitarLista(lista, limite) {
    if (!Array.isArray(lista) || limite === 0 || lista.length <= limite) {
        return lista;
    }

    return {
        total: lista.length,
        mostrados: limite,
        omitidos: lista.length - limite,
        elementos: lista.slice(0, limite)
    };
}

function limitarRecursivamente(valor, limite) {
    if (Array.isArray(valor)) return limitarLista(valor, limite);
    if (!valor || typeof valor !== "object") return valor;

    return Object.fromEntries(
        Object.entries(valor).map(([clave, contenido]) => [
            clave,
            limitarRecursivamente(contenido, limite)
        ])
    );
}

function agregarHallazgo(lista, datos) {
    lista.push({
        Severidad: datos.Severidad,
        Grupo: datos.Grupo || "",
        ClaveFechaHora: datos.ClaveFechaHora || "",
        Regla: datos.Regla,
        Campo: datos.Campo || "",
        Mensaje: datos.Mensaje,
        Valor: datos.Valor ?? ""
    });
}

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda === "true" || opciones.help === "true") {
    mostrarAyuda();
    process.exit(0);
}

for (const obligatoria of ["matriz", "entrada", "clasificacion"]) {
    if (!opciones[obligatoria]) {
        mostrarAyuda();
        terminar(`Debes indicar --${obligatoria}.`);
    }
}

const matriz = path.resolve(process.cwd(), opciones.matriz);
const entrada = path.resolve(process.cwd(), opciones.entrada);
const clasificacionRuta = path.resolve(
    process.cwd(),
    opciones.clasificacion
);
const hojaMatrizNombre = opciones["hoja-matriz"] || "MatrizDecisiones";
const hojaEntradaNombre = opciones["hoja-entrada"] || "Registros";
const base = path.basename(matriz, path.extname(matriz));
const reporte = path.resolve(
    process.cwd(),
    opciones.reporte || `reporte-validacion-${base}.xlsx`
);
const archivoJSON = path.resolve(
    process.cwd(),
    opciones.json || `validacion-${base}.json`
);
const estricto = opciones.estricto === "true";
const modoConsola = String(opciones.consola || "hallazgos").toLowerCase();
const limite = enteroNoNegativo(opciones.limite ?? 20, "--limite");

if (!["resumen", "hallazgos", "completo", "ninguno"].includes(modoConsola)) {
    terminar("--consola debe ser resumen, hallazgos, completo o ninguno.");
}

for (const archivo of [matriz, entrada, clasificacionRuta]) {
    if (!fs.existsSync(archivo)) terminar(`No existe el archivo: ${archivo}`);
}

const entradasNormalizadas = [matriz, entrada, clasificacionRuta]
    .map(ruta => path.normalize(ruta).toLowerCase());

if (
    entradasNormalizadas.includes(path.normalize(reporte).toLowerCase()) ||
    entradasNormalizadas.includes(path.normalize(archivoJSON).toLowerCase())
) {
    terminar("Las salidas no pueden sobrescribir archivos de entrada.");
}

let clasificacion;
let libroMatriz;
let libroEntrada;

try {
    clasificacion = JSON.parse(fs.readFileSync(clasificacionRuta, "utf8"));
    libroMatriz = XLSX.readFile(matriz, { cellDates: false });
    libroEntrada = XLSX.readFile(entrada, { cellDates: false });
} catch (error) {
    terminar(`No se pudieron leer los archivos: ${error.message}`);
}

const hojaMatriz = libroMatriz.Sheets[hojaMatrizNombre];
const hojaEntrada = libroEntrada.Sheets[hojaEntradaNombre];

if (!hojaMatriz) terminar(`No existe la hoja "${hojaMatrizNombre}".`);
if (!hojaEntrada) terminar(`No existe la hoja "${hojaEntradaNombre}".`);

const filasMatriz = XLSX.utils.sheet_to_json(
    hojaMatriz,
    { defval: null, raw: true }
);
const registros = XLSX.utils.sheet_to_json(
    hojaEntrada,
    { defval: null, raw: true }
);

if (filasMatriz.length === 0) terminar("La matriz no contiene decisiones.");
if (registros.length === 0) terminar("La entrada no contiene registros.");

const encabezadosMatriz = [
    ...new Set(filasMatriz.flatMap(fila => Object.keys(fila)))
];
const faltantesEstructura = CAMPOS_REQUERIDOS_MATRIZ.filter(
    campo => !encabezadosMatriz.includes(campo)
);

if (faltantesEstructura.length > 0) {
    terminar(
        `La matriz no contiene columnas obligatorias: ` +
        faltantesEstructura.join(", ")
    );
}

if (!Array.isArray(clasificacion.gruposInconsistentes)) {
    terminar("La clasificación no contiene gruposInconsistentes.");
}

const gruposFuente = new Map(
    clasificacion.gruposInconsistentes.map(grupo => [grupo.Grupo, grupo])
);
const registrosPorFila = new Map(
    registros.map((registro, indice) => [indice + 2, registro])
);
const clavesPorFila = new Map(
    registros.map((registro, indice) => [indice + 2, claveRegistro(registro)])
);

const errores = [];
const advertencias = [];
const informativos = [];
const validacionGrupos = [];
const gruposVistos = new Set();

for (const fila of filasMatriz) {
    const grupo = texto(fila.Grupo);
    const clave = texto(fila.ClaveFechaHora);
    const decision = normalizarEnumerado(fila.Decision);
    const estado = normalizarEnumerado(fila.EstadoRevision);
    const disponiblesParseo = parsearFilas(fila.FilasDisponibles);
    const conservarParseo = parsearFilas(fila.FilasConservar);
    const descartarParseo = parsearFilas(fila.FilasDescartar);
    const disponibles = disponiblesParseo.filas;
    const conservar = conservarParseo.filas;
    const descartar = descartarParseo.filas;
    const filaBase = esVacio(fila.FilaBaseCombinacion)
        ? null
        : Number(fila.FilaBaseCombinacion);
    const fuente = gruposFuente.get(grupo);
    const erroresAntes = errores.length;
    const advertenciasAntes = advertencias.length;

    if (!grupo) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Regla: "grupo-obligatorio",
            Campo: "Grupo",
            Mensaje: "El identificador del grupo está vacío."
        });
        continue;
    }

    if (gruposVistos.has(grupo)) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "grupo-repetido-en-matriz",
            Campo: "Grupo",
            Mensaje: "El grupo aparece más de una vez en MatrizDecisiones."
        });
    }
    gruposVistos.add(grupo);

    if (!fuente) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "grupo-no-existe-en-clasificacion",
            Campo: "Grupo",
            Mensaje: "El grupo no existe en la clasificación fuente."
        });
    } else {
        const filasFuente = parsearFilas(fuente.Filas).filas;

        if (clave !== texto(fuente.Clave)) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "clave-no-coincide",
                Campo: "ClaveFechaHora",
                Mensaje: "La clave no coincide con la clasificación fuente.",
                Valor: `${clave} != ${fuente.Clave}`
            });
        }

        const faltanDisponibles = diferencia(filasFuente, disponibles);
        const sobranDisponibles = diferencia(disponibles, filasFuente);

        if (faltanDisponibles.length || sobranDisponibles.length) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "filas-disponibles-no-coinciden",
                Campo: "FilasDisponibles",
                Mensaje:
                    "Las filas disponibles no coinciden con la clasificación fuente.",
                Valor:
                    `faltan=${faltanDisponibles.join(",")}; ` +
                    `sobran=${sobranDisponibles.join(",")}`
            });
        }
    }

    for (const [campo, parseo] of [
        ["FilasDisponibles", disponiblesParseo],
        ["FilasConservar", conservarParseo],
        ["FilasDescartar", descartarParseo]
    ]) {
        if (parseo.invalidos.length > 0) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "numero-fila-invalido",
                Campo: campo,
                Mensaje: "El campo contiene identificadores de fila inválidos.",
                Valor: parseo.invalidos.join(", ")
            });
        }
    }

    for (const numeroFila of disponibles) {
        if (!registrosPorFila.has(numeroFila)) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "fila-no-existe",
                Campo: "FilasDisponibles",
                Mensaje: `La fila ${numeroFila} no existe en el Excel fuente.`
            });
        } else if (clavesPorFila.get(numeroFila) !== clave) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "fila-pertenece-a-otra-clave",
                Campo: "FilasDisponibles",
                Mensaje:
                    `La fila ${numeroFila} pertenece a ` +
                    `${clavesPorFila.get(numeroFila)}, no a ${clave}.`
            });
        }
    }

    const conservarFuera = diferencia(conservar, disponibles);
    const descartarFuera = diferencia(descartar, disponibles);
    const cruce = interseccion(conservar, descartar);

    if (conservarFuera.length > 0) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "conservar-fuera-del-grupo",
            Campo: "FilasConservar",
            Mensaje: "Hay filas a conservar que no pertenecen al grupo.",
            Valor: conservarFuera.join(", ")
        });
    }

    if (descartarFuera.length > 0) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "descartar-fuera-del-grupo",
            Campo: "FilasDescartar",
            Mensaje: "Hay filas a descartar que no pertenecen al grupo.",
            Valor: descartarFuera.join(", ")
        });
    }

    if (cruce.length > 0) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "fila-conservar-y-descartar",
            Campo: "FilasConservar/FilasDescartar",
            Mensaje: "Una misma fila no puede conservarse y descartarse.",
            Valor: cruce.join(", ")
        });
    }

    if (!DECISIONES.has(decision)) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "decision-invalida",
            Campo: "Decision",
            Mensaje: "La decisión no pertenece al catálogo permitido.",
            Valor: fila.Decision
        });
    }

    if (!ESTADOS.has(estado)) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "estado-invalido",
            Campo: "EstadoRevision",
            Mensaje: "El estado no pertenece al catálogo permitido.",
            Valor: fila.EstadoRevision
        });
    }

    if (decision === "PENDIENTE") {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "decision-pendiente",
            Campo: "Decision",
            Mensaje: "El grupo continúa pendiente de decisión."
        });
    }

    if (estado !== "APROBADO") {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupo,
            ClaveFechaHora: clave,
            Regla: "revision-no-aprobada",
            Campo: "EstadoRevision",
            Mensaje: "La decisión debe estar en estado APROBADO.",
            Valor: estado
        });
    }

    if (decision !== "PENDIENTE") {
        if (esVacio(fila.Justificacion)) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "justificacion-obligatoria",
                Campo: "Justificacion",
                Mensaje: "La decisión requiere una justificación."
            });
        }

        if (esVacio(fila.ResponsableRevision)) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "responsable-obligatorio",
                Campo: "ResponsableRevision",
                Mensaje: "Debe identificarse el responsable de revisión."
            });
        }

        if (!fechaRevisionValida(fila.FechaRevision)) {
            agregarHallazgo(errores, {
                Severidad: "ERROR",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "fecha-revision-invalida",
                Campo: "FechaRevision",
                Mensaje: "La fecha de revisión debe ser válida."
            });
        }
    }

    const cubiertas = union(conservar, descartar);
    const noCubiertas = diferencia(disponibles, cubiertas);

    switch (decision) {
        case "CONSERVAR_UNA":
            if (conservar.length !== 1) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "conservar-una-cantidad",
                    Campo: "FilasConservar",
                    Mensaje: "CONSERVAR_UNA exige exactamente una fila."
                });
            }
            if (descartar.length !== Math.max(0, disponibles.length - 1)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "conservar-una-descartes",
                    Campo: "FilasDescartar",
                    Mensaje: "Deben descartarse todas las demás filas."
                });
            }
            break;

        case "CONSERVAR_VARIAS":
            if (conservar.length < 2 || conservar.length >= disponibles.length) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "conservar-varias-cantidad",
                    Campo: "FilasConservar",
                    Mensaje:
                        "CONSERVAR_VARIAS exige al menos dos filas, pero no todas."
                });
            }
            if (noCubiertas.length > 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "filas-sin-cobertura",
                    Campo: "FilasConservar/FilasDescartar",
                    Mensaje: "Todas las filas deben conservarse o descartarse.",
                    Valor: noCubiertas.join(", ")
                });
            }
            agregarHallazgo(advertencias, {
                Severidad: "ADVERTENCIA",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "claves-repetidas-al-conservar-varias",
                Campo: "NuevaFecha/NuevaHora",
                Mensaje:
                    "Conservar varias filas deja claves repetidas salvo que posteriormente se asignen claves únicas."
            });
            break;

        case "CONSERVAR_TODAS":
            if (
                diferencia(disponibles, conservar).length > 0 ||
                descartar.length > 0
            ) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "conservar-todas-cobertura",
                    Campo: "FilasConservar/FilasDescartar",
                    Mensaje:
                        "CONSERVAR_TODAS exige conservar todas y no descartar ninguna."
                });
            }
            agregarHallazgo(advertencias, {
                Severidad: "ADVERTENCIA",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "duplicado-permanece",
                Campo: "Decision",
                Mensaje:
                    "La decisión conserva todas las filas con la misma clave Fecha + Hora."
            });
            break;

        case "COMBINAR":
            if (!Number.isInteger(filaBase) || !disponibles.includes(filaBase)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "fila-base-combinacion-invalida",
                    Campo: "FilaBaseCombinacion",
                    Mensaje:
                        "COMBINAR exige una fila base perteneciente al grupo."
                });
            }
            if (esVacio(fila.CamposCombinarOCorregir)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "campos-combinacion-obligatorios",
                    Campo: "CamposCombinarOCorregir",
                    Mensaje:
                        "Debe documentar qué campos se combinarán o corregirán."
                });
            }
            if (conservar.length !== 1) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "combinar-salida-unica",
                    Campo: "FilasConservar",
                    Mensaje:
                        "COMBINAR debe producir una única fila base conservada."
                });
            }
            if (noCubiertas.length > 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "combinar-filas-sin-cobertura",
                    Campo: "FilasConservar/FilasDescartar",
                    Mensaje: "Todas las filas del grupo deben quedar cubiertas.",
                    Valor: noCubiertas.join(", ")
                });
            }
            break;

        case "CORREGIR_FECHA_HORA":
            if (conservar.length === 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "corregir-sin-filas",
                    Campo: "FilasConservar",
                    Mensaje: "Debe indicar qué filas se conservarán y corregirán."
                });
            }
            if (esVacio(fila.NuevaFecha) && esVacio(fila.NuevaHora)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "correccion-temporal-vacia",
                    Campo: "NuevaFecha/NuevaHora",
                    Mensaje:
                        "Debe informar al menos una nueva Fecha o una nueva Hora."
                });
            }
            if (!esVacio(fila.NuevaFecha) && !fechaValida(fila.NuevaFecha)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "nueva-fecha-invalida",
                    Campo: "NuevaFecha",
                    Mensaje: "NuevaFecha debe usar YYYY-MM-DD."
                });
            }
            if (!esVacio(fila.NuevaHora) && !horaValida(fila.NuevaHora)) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "nueva-hora-invalida",
                    Campo: "NuevaHora",
                    Mensaje: "NuevaHora debe usar HH:MM:SS."
                });
            }
            if (conservar.length > 1) {
                agregarHallazgo(advertencias, {
                    Severidad: "ADVERTENCIA",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "misma-correccion-para-varias-filas",
                    Campo: "NuevaFecha/NuevaHora",
                    Mensaje:
                        "La matriz dispone de una sola nueva Fecha/Hora por grupo. Varias filas podrían seguir compartiendo clave."
                });
            }
            if (noCubiertas.length > 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "correccion-filas-sin-cobertura",
                    Campo: "FilasConservar/FilasDescartar",
                    Mensaje: "Todas las filas del grupo deben quedar cubiertas.",
                    Valor: noCubiertas.join(", ")
                });
            }
            break;

        case "DESCARTAR_GRUPO":
            if (conservar.length > 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "descartar-grupo-con-conservadas",
                    Campo: "FilasConservar",
                    Mensaje: "DESCARTAR_GRUPO no permite filas conservadas."
                });
            }
            if (diferencia(disponibles, descartar).length > 0) {
                agregarHallazgo(errores, {
                    Severidad: "ERROR",
                    Grupo: grupo,
                    ClaveFechaHora: clave,
                    Regla: "descartar-grupo-incompleto",
                    Campo: "FilasDescartar",
                    Mensaje: "Deben descartarse todas las filas del grupo."
                });
            }
            agregarHallazgo(advertencias, {
                Severidad: "ADVERTENCIA",
                Grupo: grupo,
                ClaveFechaHora: clave,
                Regla: "perdida-total-grupo",
                Campo: "Decision",
                Mensaje:
                    "Esta decisión elimina todas las versiones del evento."
            });
            break;

        case "PENDIENTE":
        default:
            break;
    }

    validacionGrupos.push({
        Grupo: grupo,
        ClaveFechaHora: clave,
        Decision: decision,
        EstadoRevision: estado,
        FilasDisponibles: disponibles.join(", "),
        FilasConservar: conservar.join(", "),
        FilasDescartar: descartar.join(", "),
        Errores: errores.length - erroresAntes,
        Advertencias: advertencias.length - advertenciasAntes,
        EstadoValidacion:
            errores.length === erroresAntes &&
            (!estricto || advertencias.length === advertenciasAntes)
                ? "APROBADO"
                : "NO_APROBADO"
    });
}

for (const grupoFuente of gruposFuente.keys()) {
    if (!gruposVistos.has(grupoFuente)) {
        agregarHallazgo(errores, {
            Severidad: "ERROR",
            Grupo: grupoFuente,
            ClaveFechaHora: gruposFuente.get(grupoFuente).Clave,
            Regla: "grupo-faltante-en-matriz",
            Campo: "Grupo",
            Mensaje:
                "El grupo inconsistente de la clasificación no aparece en la matriz."
        });
    }
}

for (const grupoMatriz of gruposVistos) {
    if (!gruposFuente.has(grupoMatriz)) {
        agregarHallazgo(advertencias, {
            Severidad: "ADVERTENCIA",
            Grupo: grupoMatriz,
            Regla: "grupo-adicional-en-matriz",
            Campo: "Grupo",
            Mensaje:
                "La matriz contiene un grupo no incluido entre los inconsistentes de la clasificación."
        });
    }
}

const decisionesAprobadas = validacionGrupos.filter(
    grupo => grupo.EstadoValidacion === "APROBADO"
).length;
const gruposNoAprobados = validacionGrupos.length - decisionesAprobadas;
const aprobacionGlobal = errores.length === 0 &&
    (!estricto || advertencias.length === 0);

const resumen = {
    ArchivoMatriz: path.basename(matriz),
    ArchivoEntrada: path.basename(entrada),
    ArchivoClasificacion: path.basename(clasificacionRuta),
    GruposEsperados: gruposFuente.size,
    GruposEncontrados: filasMatriz.length,
    GruposValidados: validacionGrupos.length,
    GruposAprobados: decisionesAprobadas,
    GruposNoAprobados: gruposNoAprobados,
    Errores: errores.length,
    Advertencias: advertencias.length,
    Informativos: informativos.length,
    ModoEstricto: estricto,
    AprobacionGlobal: aprobacionGlobal,
    MatrizModificada: false,
    DatosDepurados: false
};

const metadatos = {
    fechaValidacionISO: new Date().toISOString(),
    matriz,
    entrada,
    clasificacion: clasificacionRuta,
    hojaMatriz: hojaMatrizNombre,
    hojaEntrada: hojaEntradaNombre,
    reporte,
    archivoJSON,
    soloLectura: true
};

const resultadoBase = {
    metadatos,
    resumen,
    validacionGrupos,
    errores,
    advertencias,
    informativos
};
const huella = crypto
    .createHash("sha256")
    .update(JSON.stringify(resultadoBase, null, 2))
    .digest("hex");
const resultado = {
    ...resultadoBase,
    integridad: {
        algoritmo: "SHA-256",
        huellaContenidoSinIntegridad: huella
    }
};

try {
    fs.writeFileSync(
        archivoJSON,
        JSON.stringify(resultado, null, 2) + "\n",
        "utf8"
    );
} catch (error) {
    terminar(`No se pudo escribir el JSON: ${error.message}`);
}

function crearHoja(libro, nombre, filas) {
    const datos = filas.length ? filas : [{ Resultado: "Sin registros" }];
    const hoja = XLSX.utils.json_to_sheet(datos);
    const rango = XLSX.utils.decode_range(hoja["!ref"] || "A1:A1");
    hoja["!cols"] = [];

    for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
        let ancho = 12;

        for (
            let fila = rango.s.r;
            fila <= Math.min(rango.e.r, 300);
            fila++
        ) {
            const celda = hoja[
                XLSX.utils.encode_cell({ r: fila, c: columna })
            ];
            if (celda) {
                ancho = Math.max(ancho, String(celda.v ?? "").length + 2);
            }
        }

        hoja["!cols"].push({ wch: Math.min(ancho, 75) });
    }

    hoja["!freeze"] = { xSplit: 0, ySplit: 1 };
    if (rango.e.r >= 1) hoja["!autofilter"] = { ref: hoja["!ref"] };
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
}

const libroReporte = XLSX.utils.book_new();
crearHoja(
    libroReporte,
    "Resumen",
    Object.entries({
        ...resumen,
        HuellaSHA256: huella
    }).map(([Indicador, Valor]) => ({ Indicador, Valor }))
);
crearHoja(libroReporte, "ValidacionGrupos", validacionGrupos);
crearHoja(libroReporte, "Errores", errores);
crearHoja(libroReporte, "Advertencias", advertencias);
crearHoja(libroReporte, "Informativos", informativos);
crearHoja(
    libroReporte,
    "Metadatos",
    Object.entries(metadatos).map(([Campo, Valor]) => ({ Campo, Valor }))
);

try {
    XLSX.writeFile(libroReporte, reporte);
} catch (error) {
    terminar(`No se pudo escribir el reporte: ${error.message}`);
}

console.log("\n============================================================");
console.log(" VALIDACIÓN DE MATRIZ UBIDOTS FINALIZADA");
console.log("============================================================");
console.log(`Grupos esperados: ${resumen.GruposEsperados}`);
console.log(`Grupos encontrados: ${resumen.GruposEncontrados}`);
console.log(`Grupos aprobados: ${resumen.GruposAprobados}`);
console.log(`Grupos no aprobados: ${resumen.GruposNoAprobados}`);
console.log(`Errores: ${resumen.Errores}`);
console.log(`Advertencias: ${resumen.Advertencias}`);
console.log(`Estricto: ${estricto ? "Sí" : "No"}`);
console.log(
    `Aprobación global: ${aprobacionGlobal ? "SÍ" : "NO"}`
);
console.log(`Reporte: ${reporte}`);
console.log(`JSON: ${archivoJSON}`);
console.log(`Huella SHA-256: ${huella}`);

if (modoConsola !== "ninguno") {
    let salida;

    if (modoConsola === "resumen") {
        salida = {
            metadatos,
            resumen,
            integridad: resultado.integridad
        };
    } else if (modoConsola === "hallazgos") {
        salida = {
            metadatos,
            resumen,
            errores: limitarLista(errores, limite),
            advertencias: limitarLista(advertencias, limite),
            integridad: resultado.integridad
        };
    } else {
        salida = limitarRecursivamente(resultado, limite);
    }

    console.log("\n====================== INICIO JSON ==========================");
    console.log(JSON.stringify(salida, null, 2));
    console.log("======================= FIN JSON ============================");
}

console.log(
    "\nLa matriz y los datos de entrada no fueron modificados. " +
    "No se aplicó ninguna decisión.\n"
);

if (errores.length > 0) process.exitCode = 2;
else if (estricto && advertencias.length > 0) process.exitCode = 3;
else process.exitCode = 0;
