Usa #codebase, #.github/copilot-instructions.md y
#docs/arquitectura-glp.md.

Implementa la extracción aprobada de la política de memoria de
referencia de cisterna.

Archivos autorizados:

1. Crear:
   services/cisterna-reference-state-service.js

2. Modificar de forma mínima:
   server.js

No modifiques otros archivos.

## Servicio nuevo

El módulo debe ser puro:

- no leer process.env;
- no usar fs;
- no leer ni escribir archivos;
- no consultar Ubidots;
- no importar Express;
- no importar server.js;
- no mantener estado global interno;
- no llamar new Date();
- no modificar state;
- no modificar result.

Debe exportar únicamente:

- createCisternaReferenceState
- updateCisternaReferenceState
- getCisternaReferenceState

## Estado inicial

createCisternaReferenceState() debe devolver un objeto nuevo:

{
    encontrada: false,
    referencia: null,
    razon: "NOT_INITIALIZED",
    source: "UBIDOTS_HISTORY",
    referenceUpdatedAt: null,
    lastInspectionAt: null,
    lastInspectionFoundReference: null
}

## Actualización inmutable

Firma:

updateCisternaReferenceState(
    state,
    result,
    inspectionAt
)

Debe leer exclusivamente:

result?.ubidots?.cisternaReference

Primero debe obtener la selección.

Si la selección no existe:

- devuelve state sin cambios;
- no valida inspectionAt;
- no crea una copia innecesaria;
- no modifica state;
- no modifica result.

Si la selección existe, inspectionAt debe ser una cadena no vacía.

Si inspectionAt no es una cadena no vacía, debe lanzar:

TypeError(
    "inspectionAt debe ser un texto ISO no vacío."
)

No es necesario interpretar ni reformatear inspectionAt.

## Copias e inmutabilidad

Cuando exista una selección, construye un estado nuevo.

Si el estado anterior tiene referencia, cópiala superficialmente.

Cuando guardes selection.referencia, crea también una copia superficial.

La referencia actual contiene exclusivamente valores escalares.

## Referencia válida

Una selección válida requiere:

selection.encontrada === true

y:

Number(
    selection.referencia?.TimestampUbidots
)

finito y mayor que cero.

Si no existe referencia estable, guarda la nueva.

Si existe referencia estable, reemplázala únicamente cuando el
timestamp nuevo sea mayor.

Al guardar o reemplazar:

- encontrada: true;
- referencia: copia de selection.referencia;
- razon: null;
- source: "UBIDOTS_HISTORY";
- referenceUpdatedAt: inspectionAt;
- lastInspectionAt: inspectionAt;
- lastInspectionFoundReference: true.

## Timestamp igual o menor

Si el timestamp nuevo es igual o menor:

- conserva la referencia estable;
- conserva referenceUpdatedAt;
- conserva razon;
- actualiza lastInspectionAt a inspectionAt;
- establece lastInspectionFoundReference: true.

## Timestamp inválido

Si selection.encontrada es true, pero su timestamp es inválido:

- no almacenes la referencia inválida;
- no elimines una referencia estable;
- actualiza lastInspectionAt;
- establece lastInspectionFoundReference: false.

Si no existe referencia estable:

- encontrada: false;
- referencia: null;
- razon: "INVALID_CISTERNA_REFERENCE_TIMESTAMP";
- referenceUpdatedAt: null.

Si ya existe una referencia estable:

- encontrada: true;
- conserva referencia;
- conserva razon: null;
- conserva referenceUpdatedAt.

## Selección sin referencia

Si selection.encontrada === false:

- actualiza lastInspectionAt;
- establece lastInspectionFoundReference: false.

Si ya existe una referencia estable:

- conserva encontrada: true;
- conserva referencia;
- conserva razon: null;
- conserva referenceUpdatedAt.

Si no existe referencia estable:

- encontrada: false;
- referencia: null;
- razon:
  selection.razon ||
  "NO_COMPLETE_CISTERNA_REFERENCE";
- referenceUpdatedAt: null.

## Getter

getCisternaReferenceState(state) debe devolver:

{
    ...state,
    referencia:
        state.referencia
            ? { ...state.referencia }
            : null
}

No debe devolver directamente el objeto recibido.

## Cambios mínimos en server.js

Importa las tres funciones desde:

./services/cisterna-reference-state-service

Elimina de server.js:

- el objeto literal actual cisternaReferenceState;
- la implementación local de updateCisternaReferenceState();
- la implementación local de getCisternaReferenceState().

Declara:

let cisternaReferenceState =
    createCisternaReferenceState();

Dentro de runHistorySynchronization(), después de recibir el resultado
completo de synchronizeFromUbidots(), usa:

const inspectionAt =
    new Date().toISOString();

cisternaReferenceState =
    updateCisternaReferenceState(
        cisternaReferenceState,
        result,
        inspectionAt
    );

Debe existir una sola reasignación efectiva.

El endpoint debe usar:

getCisternaReferenceState(
    cisternaReferenceState
)

Conserva intactos:

- la ruta GET /ultima-referencia-cisterna;
- sus encabezados anti-caché;
- su HTTP 200;
- success: true.

## Restricciones

No modifiques:

- ubidots-history-service.js;
- ubidots-sync-service.js;
- variables.js;
- app.js;
- configuraciones;
- endpoints adicionales;
- buildUbidotsContext();
- buildUbidotsPayload();
- caché;
- checkpoint;
- pending;
- resoluciones.

No reformatees server.js.

No inicies el servidor.

No consultes Ubidots.

No hagas git add, commit ni push.

## Validaciones

Al terminar:

1. ejecuta:
   node --check services/cisterna-reference-state-service.js

2. ejecuta:
   node --check server.js

3. ejecuta:
   git diff --check

4. muestra el contenido completo del módulo nuevo;

5. muestra únicamente estos cambios de server.js:
   - importación;
   - creación del estado;
   - reasignación dentro de runHistorySynchronization();
   - uso del getter en el endpoint;

6. confirma:
   - una definición de cisternaReferenceState;
   - una reasignación efectiva;
   - una llamada al getter en el endpoint;
   - ninguna implementación local restante de las dos funciones;

7. muestra:
   git diff --stat

8. muestra:
   git status --short

No prepares archivos en Git.
