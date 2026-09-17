# Instrucciones de Copilot para REGISTRO_GLP_CORONA

## Forma de trabajo

Este repositorio gestiona información operacional de una planta de GLP.

Antes de modificar código:

1. Analiza el flujo completo afectado.
2. Identifica todos los archivos que consumen la función, propiedad o configuración.
3. Explica el cambio propuesto, los riesgos y las validaciones requeridas.
4. Espera aprobación explícita antes de realizar refactorizaciones arquitectónicas.
5. Evita cambios masivos cuando sea posible implementar y validar bloques pequeños.

No hagas commits, merges, pushes ni despliegues automáticamente.

No cambies ramas sin explicar previamente el motivo.

Después de cada bloque funcional:

1. Ejecuta validaciones de sintaxis.
2. Revisa `git status`.
3. Revisa los archivos modificados.
4. Ejecuta `git diff --check`.
5. Confirma que no se incluyeron secretos, archivos operativos ni temporales.
6. Presenta las salidas antes de recomendar un commit.

## Archivos protegidos

No modificar, eliminar, vaciar, reemplazar ni versionar:

- `.env`
- `ubidots-pending.json`
- `registros.xlsx`
- `data/ubidots-sync-checkpoint.json`
- archivos `tmp-*`
- directorios `backups-*`
- archivos de auditoría
- tokens o claves administrativas

`ubidots-pending.json` conserva registros operacionales pendientes de envío y debe permanecer intacto.

Los archivos temporales E2E pueden modificarse únicamente cuando la prueba esté expresamente aislada:

- `tmp-e2e-cache.xlsx`
- `tmp-e2e-checkpoint.json`
- `tmp-e2e-pending.json`
- `backups-e2e-temporal/`

Nunca confundir estos archivos con sus equivalentes oficiales.

## Secretos

Nunca muestres, registres ni agregues al repositorio:

- `UBIDOTS_TOKEN`
- `GLP_SYNC_ADMIN_KEY`
- otros tokens, claves o credenciales

No imprimas el contenido de `.env`.

Para validar secretos, muestra únicamente valores booleanos como:

- `tokenConfigured: true`
- `adminKeyConfigured: true`

## Arquitectura de datos

La arquitectura acordada es:

1. Ubidots es el repositorio vivo de los eventos digitales.
2. `data/registros-historicos-base.xlsx` conserva el histórico heredado anterior o consolidado.
3. `registros.xlsx` es una caché o proyección materializada reconstruible.
4. El Excel local y el Excel generado por Render no son la fuente primaria de verdad.
5. El backend reconstruye y concilia la caché usando la base histórica, Ubidots, el checkpoint y las resoluciones auditadas.
6. `/historial` expone la proyección histórica al frontend.
7. `historial.html` consume `/historial`.
8. El navegador no debe consultar directamente Ubidots.
9. Las credenciales de Ubidots solo deben existir en el backend.
10. La falta de permisos para Microsoft Graph impide usarlo actualmente como mecanismo principal de persistencia.

No cambies esta arquitectura sin presentar primero un análisis y obtener aprobación explícita.

## Catálogo VARIABLES

`js/variables.js` es el catálogo central del programa.

Las propiedades del catálogo representan capacidades independientes.

### `field`

Identifica el control o propiedad utilizada por el formulario.

### `excelField`

Indica que la variable participa en el histórico Excel.

También puede ser consumida para generar columnas históricas.

### `recordGroup` y `recordField`

Definen cómo se construye la estructura agrupada enviada a `/save`.

### `ubidots`

Indica que la entrada se envía como una serie temporal o variable medible a Ubidots.

No agregues `ubidots` a metadatos únicamente para transportarlos en el contexto.

### `context`

Actualmente tiene una semántica especializada para el ciclo de vida de pendientes.

No reutilices esta propiedad como contrato general del contexto de Ubidots sin analizar primero su uso existente.

### Variables lógicas o auxiliares

Una entrada puede existir para lógica de interfaz, dependencias, visibilidad, reutilización o cálculos, aunque no tenga `excelField` ni `ubidots`.

No infieras automáticamente que una variable sin `ubidots` debe enviarse como contexto.

## Contexto de Ubidots

`ubidotsContext` fue aprobado como capacidad independiente del catálogo. Controla los metadatos reconstructivos enviados en el contexto de Ubidots.

`context` conserva su semántica especializada para el ciclo de vida de pendientes; no es el contrato general de contexto de Ubidots.

Los campos activos de `ubidotsContext` son:

- obligatorios: `Fecha`, `Hora`, `Encargado`, `EstadoOperacion` y `Pendientes`;
- opcionales: `Observaciones` y `PlacaCisterna`;
- deshabilitado: `ValvulasCapuchon`.

`comparison` está declarado como capacidad de equivalencia operacional, pero su consumidor dinámico todavía no está implementado.

No agregues campos manualmente a `buildUbidotsContext()`; declara la capacidad en `js/variables.js` y revisa sus consumidores.

### Lógica de cisterna

`cisterna_habilitada` continúa siendo exclusiva de la lógica del formulario. No tiene `excelField`, `ubidots`, `ubidotsContext` ni `comparison`.

## Identidades del sistema

### Identidad técnica

La identidad técnica es:

- `TimestampUbidots`

Varios valores de distintas variables con el mismo timestamp forman un registro técnico reconstruido.

### Identidad operacional

La identidad operacional es:

- `Fecha`
- `Hora`

Las horas deben normalizarse para que valores como `13:58` y `13:58:00` representen la misma clave.

### Equivalencia operacional

La equivalencia determina si un registro recuperado desde Ubidots ya está representado en la caché.

No confundas:

- identidad operacional;
- equivalencia de contenido;
- trazabilidad técnica;
- resolución auditada de conflictos.

Campos técnicos como `FechaServidor`, `TimestampUbidots`, fechas de recepción y columnas de auditoría no deberían convertirse automáticamente en diferencias operacionales.

La lista definitiva de campos de equivalencia todavía está en análisis.

## Evolución del esquema

El programa debe admitir variables nuevas sin invalidar registros históricos anteriores.

`ValvulasCapuchon` es un caso introducido deliberadamente para validar la evolución dinámica del esquema.

No asumir automáticamente que:

- campo ausente;
- `null`;
- cadena vacía;
- `false`;
- cero

son equivalentes.

Antes de definir equivalencia, considera:

1. si el campo existía cuando se creó el registro;
2. si su ausencia significa desconocido;
3. si existe un valor predeterminado;
4. si el campo participa en identidad o equivalencia;
5. si es una variable operacional, técnica o de presentación.

## Pendientes

Existen distintas representaciones con propósitos diferentes:

1. Columna `Pendientes` en la hoja `Registros`.
2. Hoja estructurada `Pendientes`.
3. `pendientes_json` dentro del contexto de Ubidots.
4. `ubidots-pending.json`, que es una cola de envíos fallidos.

No mezcles estas responsabilidades.

`Pendientes` es la lista canónica de códigos lógicos. `pendientes_json` permanece como una cadena JSON con la fotografía estructurada de pendientes activos para un futuro tablero.

La frase `Sin pendientes`, el arreglo `[]` y el texto JSON `"[]"` pueden representar el mismo estado funcional, pero su normalización debe definirse explícitamente.

## Conflictos

No agregues resoluciones aprobadas para ocultar:

- diferencias de tipos;
- diferencias de formato;
- contexto incompleto;
- campos técnicos ausentes;
- errores del contrato del catálogo.

`KEEP_BOTH_DISTINCT_EVENTS` se usa únicamente para eventos operacionales distintos y auditados que comparten Fecha y Hora.

## Pruebas

Las pruebas E2E deben ejecutarse únicamente contra:

- dispositivo Ubidots `planta-prueba`;
- configuración histórica de pruebas;
- caché temporal;
- checkpoint temporal;
- pending temporal;
- respaldos temporales.

Antes de una prueba E2E, valida explícitamente las rutas efectivas.

No uses datos sintéticos en el dispositivo productivo.

## Compatibilidad y escalabilidad

Favorece soluciones:

- declarativas;
- genéricas;
- modulares;
- reutilizables;
- auditables;
- compatibles con registros históricos;
- configurables por ambiente.

Evita condiciones específicas para una variable concreta cuando la regla pueda expresarse mediante el catálogo.

No elimines compatibilidad existente sin identificar primero todos los consumidores.
