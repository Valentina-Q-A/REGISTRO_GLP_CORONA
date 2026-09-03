// ============================================
// SERVIDOR BACKEND - SISTEMA GLP
// ============================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

require('dotenv').config();

const {
    VARIABLES,
    UBIDOTS_CONFIG
} = require('./js/variables.js');

const app = express();
const PORT = process.env.PORT || 3000;


const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors()); //  IMPORTANTE para React
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));

app.get('/historial.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'historial.html'));
});

app.get('/js/variables.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'js', 'variables.js'));
});

const excelFilePath = path.join(__dirname, 'registros.xlsx');

const ubidotsQueueFilePath =
    path.join(__dirname, 'ubidots-pending.json');

const UBIDOTS_RETRY_INTERVAL =
    5* 60 * 1000;                               // 5 minutes

// ============================================
// FUNCION GUARDAR EXCEL
// ============================================

// ============================================
// FUNCION GUARDAR EXCEL - DINÁMICA
// ============================================

function saveRecord(record, filePath = excelFilePath) {

    let workbook;
    let worksheet;
    let data = [];

    // ============================================
    // CONSTRUIR FILA A PARTIR DE VARIABLES
    // ============================================

    const flatRecord = buildRecordRow(record);

    // ============================================
    // METADATO DEL SISTEMA
    // ============================================

    flatRecord.FechaServidor =
        record.FechaServidor ?? "";

    // ============================================
    // CARGAR HISTÓRICO EXISTENTE
    // ============================================

    if (fs.existsSync(filePath)) {

        workbook = XLSX.readFile(filePath);

        worksheet =
            workbook.Sheets[workbook.SheetNames[0]];

        data =
            XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: null
                }
            );

        data.push(flatRecord);

        // ============================================
        // NORMALIZAR COLUMNAS HISTÓRICAS
        // ============================================

        const excelColumns =
            Object.values(VARIABLES)
                .filter(variable => variable.excelField)
                .map(variable => variable.excelField);

        excelColumns.push(
            "FechaServidor"
        );

        data =
            data.map(row => {

                const normalizedRow = {};

                for (const column of excelColumns) {

                    normalizedRow[column] =
                        row[column] ?? null;
                }

                return normalizedRow;
            });

        worksheet =
            XLSX.utils.json_to_sheet(
                data,
                {
                    header: excelColumns
                }
            );

        workbook.Sheets[
            workbook.SheetNames[0]
        ] = worksheet;

    } else {

        workbook =
            XLSX.utils.book_new();

        worksheet =
            XLSX.utils.json_to_sheet(
                [flatRecord]
            );

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Registros"
        );
    }

    XLSX.writeFile(
        workbook,
        filePath
    );
}

// ============================================
// HOJA DE PENDIENTES
// ============================================
function toExcelFieldName(field) {
    if (!field) {
        return field;
    }

    return field.charAt(0).toUpperCase() + field.slice(1);
}

const PENDIENTES_SHEET = "Pendientes";

function getPendientesData(workbook) {

    if (!workbook.SheetNames.includes(PENDIENTES_SHEET)) {
        return [];
    }

    const worksheet =
        workbook.Sheets[PENDIENTES_SHEET];

    const pendientes =
        XLSX.utils.sheet_to_json(worksheet, {
            defval: null
        });

    const config =
        VARIABLES.pendientes;

    if (!config) {
        return [];
    }

    const recordFields =
        config.record || {};

    const contextFields =
        config.context?.fields || {};

    const resolutionFields =
        config.context?.resolution?.fields || {};

    return pendientes.map(pendiente => {

        const normalizado = {};

        // ============================================
        // CAMPOS PRINCIPALES
        // ============================================

        for (
            const [field, columnName]
            of Object.entries(recordFields)
        ) {

            normalizado[columnName] =
                pendiente[columnName] ?? null;
        }

        // ============================================
        // CAMPOS DE CONTEXTO
        // ============================================

        for (
            const field
            of Object.keys(contextFields)
        ) {

            const columnName =
                toExcelFieldName(field);

            normalizado[columnName] =
                pendiente[columnName] ??
                pendiente[field] ??
                null;
        }

        // ============================================
        // CAMPOS DE RESOLUCIÓN
        // ============================================

        for (
            const field
            of Object.keys(resolutionFields)
        ) {

            const columnName =
                toExcelFieldName(field);

            normalizado[columnName] =
                pendiente[columnName] ??
                pendiente[field] ??
                null;
        }

        return normalizado;
    });
}

function savePendientesData(pendientes) {

    let workbook;

    if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    // ============================================
    // COLUMNAS DINÁMICAS
    // ============================================

    const columns = [
        ...new Set(
            pendientes.flatMap(
                pendiente => Object.keys(pendiente)
            )
        )
    ];

    const worksheet =
        XLSX.utils.json_to_sheet(
            pendientes,
            {
                header: columns
            }
        );

    if (workbook.SheetNames.includes(PENDIENTES_SHEET)) {

        workbook.Sheets[PENDIENTES_SHEET] =
            worksheet;

    } else {

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            PENDIENTES_SHEET
        );
    }

    XLSX.writeFile(
        workbook,
        excelFilePath
    );
}

function addPending(pending) {

    if (!pending) {
        throw new Error(
            "No se recibió el pendiente"
        );
    }

    const config = VARIABLES.pendientes;

    if (!config) {
        throw new Error(
            "No existe la configuración de pendientes"
        );
    }

    let workbook;

    if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    const pendientes = getPendientesData(workbook);

    const record = {};

    // ============================================
    // DATOS PRINCIPALES DEL PENDIENTE
    // ============================================

    const recordFields = config.record || {};

    for (const [pendingField, columnName] of Object.entries(recordFields)) {

        record[columnName] =
            pending[pendingField] ?? "";
    }

    // ============================================
    // CONTEXTO DEL PENDIENTE
    // ============================================

    const contextFields =
        config.context?.fields || {};

    for (
        const [targetField, sourceField]
        of Object.entries(contextFields)
    ) {

        const columnName =
            toExcelFieldName(targetField);

        record[columnName] =
            pending.context?.[targetField] ?? null;
    }

    pendientes.push(record);

    savePendientesData(pendientes);

    return record;
}

// ============================================
// CREAR PENDIENTE
// ============================================

app.post('/pendientes', (req, res) => {

    try {

        const pending = req.body;

        const nuevoPendiente = addPending(pending);

        res.status(201).json({
            success: true,
            pendiente: nuevoPendiente
        });

    } catch (err) {

        console.error(
            "Error creando pendiente:",
            err
        );

        res.status(400).json({
            success: false,
            message: err.message
        });
    }
});

// ============================================
// OBTENER VALOR DE UNA VARIABLE
// ============================================

function getVariableValue(data, variable, name) {
    if (name && data[name] !== undefined) {
        return data[name];
    }

    let value = null;
    // ========================================
    // 2. Variables pertenecientes a un grupo
    // ========================================

    if (
        variable.recordGroup &&
        variable.recordField
    ) {
        const group =
            data[variable.recordGroup];

        if (
            group &&
            typeof group === "object"
        ) {

            value =
                group[variable.recordField] ?? null;
        }
    }

    // ========================================
    // 3. Variables almacenadas directamente
    // ========================================

    if (value === null) {

        if (
            variable.recordField &&
            data[variable.recordField] !== undefined
        ) {

            value =
                data[variable.recordField];
        }
    }

    // ========================================
    // 4. Variables mediante field
    // ========================================

    if (value === null) {

        if (
            variable.field &&
            data[variable.field] !== undefined
        ) {

            value =
                data[variable.field];
        }
    }


    // ========================================
    // 5. Variables mediante excelField
    // ========================================

    if (value === null) {

        if (
            variable.excelField &&
            data[variable.excelField] !== undefined
        ) {

            value =
                data[variable.excelField];
        }
    }

    return value;
}


// ============================================
// CONSTRUIR PAYLOAD PARA UBIDOTS
// ============================================
// ============================================
// CONSTRUIR FILA DEL REGISTRO
// ============================================

function buildRecordRow(record) {

    const flatRecord = {};

    for (const [name, variable] of Object.entries(VARIABLES)) {

        // ========================================
        // SOLO VARIABLES CON EXCEL
        // ========================================

        if (!variable.excelField) {
            continue;
        }

        // ========================================
        // OBTENER VALOR
        // ========================================

        let value =
            getVariableValue(
                record,
                variable
            );

        // ========================================
        // PENDIENTES → TEXTO PARA HISTÓRICO
        // ========================================

        if (name === "pendientes") {

            if (!Array.isArray(value) || value.length === 0) {

                value = "Sin pendientes";

            } else {

                const options =
                    variable.options || [];

                value = value
                    .map(pendingValue => {

                        const option =
                            options.find(
                                option =>
                                    option.value === pendingValue
                            );

                        if (!option) {
                            return pendingValue;
                        }

                        if (
                            option.value === "otro" &&
                            option.descriptionField
                        ) {

                            const description =
                                record[
                                    option.descriptionField
                                ];

                            if (description) {

                                return `${option.label}: ${String(description).trim()}`;
                            }
                        }

                        return option.label;
                    })
                    .join("; ");
            }
        }

        // ========================================
        // GUARDAR VALOR
        // ========================================

        flatRecord[variable.excelField] =
            value ?? null;
    }

    // ============================================
    // METADATO DEL SISTEMA
    // ============================================

    flatRecord.FechaServidor =
        record.FechaServidor ?? "";

    return flatRecord;
}

// ============================================
// COLA DE SINCRONIZACIÓN UBIDOTS
// ============================================

function loadUbidotsQueue() {

    if (!fs.existsSync(ubidotsQueueFilePath)) {
        return [];
    }

    try {

        const content =
            fs.readFileSync(
                ubidotsQueueFilePath,
                'utf8'
            );

        if (!content.trim()) {
            return [];
        }

        const queue =
            JSON.parse(content);

        return Array.isArray(queue)
            ? queue
            : [];

    } catch (err) {

        console.error(
            "Error leyendo cola de Ubidots:",
            err
        );

        return [];
    }
}


function saveUbidotsQueue(queue) {

    fs.writeFileSync(
        ubidotsQueueFilePath,
        JSON.stringify(
            queue,
            null,
            2
        )
    );
}

function addToUbidotsQueue(data, payload) {

    const queue =
        loadUbidotsQueue();

    const id =
        `${data.Fecha}_${data.Hora}`;

    const alreadyExists =
        queue.some(
            item => item.id === id
        );

    if (alreadyExists) {

        return false;
    }

    queue.push({
        id,
        createdAt: Date.now(),
        attempts: 0,
        payload
    });

    saveUbidotsQueue(queue);

    return true;
}

function getRecordTimestamp(data) {

    if (!data.Fecha || !data.Hora) {
        return Date.now();
    }

    const timestamp =
        Date.parse(
            `${data.Fecha}T${data.Hora}:00-05:00`
        );

    if (Number.isNaN(timestamp)) {

        console.warn(
            "No se pudo convertir Fecha/Hora. Se utilizará la hora actual."
        );

        return Date.now();
    }

    return timestamp;
}

function buildUbidotsContext(data, pendientesActivos = []) {

    const context = {};

    const pendientesConfig =
        VARIABLES.pendientes;

    // ========================================
    // ESTADO DE OPERACIÓN
    // ========================================

    const estadoOperacion =
        getVariableValue(
            data,
            VARIABLES.estado_operacion
        );

    if (
        estadoOperacion !== null &&
        estadoOperacion !== undefined &&
        estadoOperacion !== ""
    ) {

        context.estado_operacion =
            estadoOperacion;
    }


    // ========================================
    // ENCARGADO
    // ========================================

    const encargado =
        getVariableValue(
            data,
            VARIABLES.encargado
        );

    if (
        encargado !== null &&
        encargado !== undefined &&
        encargado !== ""
    ) {

        context.encargado =
            encargado;
    }


    // ========================================
    // CONFIGURACIÓN DE PENDIENTES
    // ========================================

    const recordFields =
        pendientesConfig?.record || {};

    const contextFields =
        pendientesConfig?.context?.fields || {};


    // ========================================
    // PENDIENTES ACTIVOS
    // ========================================

    const pendientesUbidots =
        pendientesActivos.map(pendiente => {

            const resultado = {};


            // ------------------------------------
            // CAMPOS DEL REGISTRO
            // ------------------------------------

            if (recordFields.id) {

                resultado.id =
                    pendiente[
                        recordFields.id
                    ] ?? null;
            }

            if (recordFields.type) {

                resultado.tipo =
                    pendiente[
                        recordFields.type
                    ] ?? null;
            }

            if (recordFields.description) {

                resultado.descripcion =
                    pendiente[
                        recordFields.description
                    ] ?? null;
            }


            // ------------------------------------
            // CAMPOS DE CONTEXTO
            // ------------------------------------

            for (
                const [nombreCampo, nombreFuente]
                of Object.entries(contextFields)
            ) {

                const columna =
                    toExcelFieldName(
                        nombreCampo
                    );

                const valor =
                    pendiente[columna] ??
                    pendiente[nombreFuente] ??
                    null;

                if (
                    valor !== null &&
                    valor !== undefined &&
                    valor !== ""
                ) {

                    if (
                        nombreCampo ===
                        "encargadoRegistro"
                    ) {

                        resultado.encargado =
                            valor;

                    } else if (
                        nombreCampo ===
                        "fechaRegistro"
                    ) {

                        resultado.fecha =
                            valor;
                    }
                }
            }


            return resultado;
        });


    context.pendientes_json =
        JSON.stringify(
            pendientesUbidots
        );


    return context;
}

function buildUbidotsPayload(data) {

    const payload = {};

    const timestamp =
    getRecordTimestamp(data);

    for (const [name, variable] of Object.entries(VARIABLES)) {

        // ========================================
        // SOLO VARIABLES CONFIGURADAS PARA UBIDOTS
        // ========================================

        if (!variable.ubidots?.variableId) {
            continue;
        }

        // ========================================
        // OBTENER VALOR
        // ========================================

        const value =
            getVariableValue(
                data,
                variable,
                name
            );

        // ========================================
        // SIN VALOR
        // ========================================

        if (
            value === null ||
            value === undefined
        ) {

            continue;
        }

        // ========================================
        // VARIABLES NUMÉRICAS
        // ========================================

        if (
            variable.type === "number" ||
            variable.type === "range"
        ) {

            const numericValue =
                Number(value);

            if (!Number.isNaN(numericValue)) {

                payload[name] = {
                    value: numericValue,
                    timestamp
                };
            }

            continue;
        }

        // ========================================
        // VARIABLES DE TEXTO
        // ========================================

        if (typeof value === "string") {

            payload[name] = {
                value: value.length,
                timestamp
            };

            continue;
        }

        // ========================================
        // OTROS TIPOS
        // ========================================

        payload[name] = {
            value,
            timestamp
        };
    }

    // ============================================
    // METADATOS
    // ============================================

    return payload;
}

// ============================================
// CONSTRUIR PAYLOAD UBIDOTS + CONTEXTO
// ============================================

function buildUbidotsPayloadWithContext(data) {

    const payload =
        buildUbidotsPayload(data);

    let pendientesActivos = [];

    if (fs.existsSync(excelFilePath)) {

        const workbook =
            XLSX.readFile(excelFilePath);

        pendientesActivos =
            getPendientesActivos(workbook);
    }

    const context =
        buildUbidotsContext(
            data,
            pendientesActivos
        );

    for (const variable of Object.values(payload)) {

        variable.context = {
            ...context
        };
    }

    return payload;
}

// ============================================
// ENVIAR DATOS A UBIDOTS
// ============================================

async function sendToUbidots(payload) {

    const TOKEN =
        process.env.UBIDOTS_TOKEN;

    if (!TOKEN) {

        throw new Error(
            "UBIDOTS_TOKEN no está configurado."
        );
    }

    const response =
        await fetch(
            UBIDOTS_CONFIG.deviceUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "X-Auth-Token":
                        TOKEN
                },

                body:
                    JSON.stringify(payload)
            }
        );

    if (!response.ok) {

        const errorBody =
            await response.text();

        throw new Error(
            `Ubidots respondió HTTP ${response.status}: ${errorBody}`
        );
    }

    return {
        success: true,
        status: response.status
    };
}

// ============================================
// PROCESAR COLA UBIDOTS
// ============================================

async function processUbidotsQueue() {

    const queue =
        loadUbidotsQueue();

    if (queue.length === 0) {
        return;
    }
    console.log(
        `Cola de Ubidots: ${queue.length} registro(s) pendiente(s).`
    );

    const remaining = [];

    for (const item of queue) {

        try {

            item.attempts++;

            await sendToUbidots(
                item.payload
            );

        } catch (err) {

            console.error(
                `No se pudo sincronizar ${item.id}:`,
                err.message
            );

            remaining.push(item);
        }
    }

    saveUbidotsQueue(remaining);
}

// ============================================
// REINTENTO AUTOMÁTICO UBIDOTS
// ============================================

setInterval(
    processUbidotsQueue,
    UBIDOTS_RETRY_INTERVAL
);

// ============================================
// ENDPOINT GUARDAR
// ============================================

app.post('/save', async (req, res) => {

    const data = req.body;

    if (!data) {
        return res.status(400).json({
            success: false,
            message: "No se recibieron datos"
        });
    }

    try {

        data.FechaServidor = new Date().toLocaleString('es-CO');

        saveRecord(data);

        res.status(200).json({
            success: true,
            message: "Registro guardado correctamente"
        });

    } catch (err) {

        console.error("Error guardando:", err);

        res.status(500).json({
            success: false,
            message: "Error guardando registro",
            error: err.message
        });
    }
});

// ============================================
// SINCRONIZAR UBIDOTS
// Se ejecuta después de actualizar pendientes
// ============================================

app.post('/sync-ubidots', async (req, res) => {

    const data = req.body;

    if (!data) {

        return res.status(400).json({
            success: false,
            message: "No se recibieron datos"
        });
    }

    try {
        console.log("");
        console.log("==============================================");
        console.log("       DATA RECIBIDA EN /sync-ubidots");
        console.log("==============================================");
        console.log(
            JSON.stringify(data, null, 2)
        );

        const payload =
            buildUbidotsPayloadWithContext(data);

        console.log("");
        console.log("==============================================");
        console.log("       SYNC UBIDOTS - PAYLOAD");
        console.log("==============================================");
        console.log(
            JSON.stringify(payload, null, 2)
        );

        try {

            await sendToUbidots(
                payload
            );

        console.log(
            "Ubidots sincronizado correctamente."
        );

        } catch (err) {

            console.error(
                "Advertencia: no se pudo sincronizar con Ubidots. Se agregará a la cola:",
                err.message
            );

            addToUbidotsQueue(
                data,
                payload
            );
        }

        res.status(200).json({
            success: true,
            message: "Sincronización con Ubidots procesada"
        });

    } catch (err) {

        console.error(
            "Error sincronizando Ubidots:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Error sincronizando Ubidots",
            error: err.message
        });
    }
});

// ============================================
// ENDPOINT VER REGISTROS
// ============================================

app.get('/registros', (req, res) => {

    if (!fs.existsSync(excelFilePath)) {
        return res.json([]);
    }

    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    res.json(data);
});

// ============================================
// FILTRAR REGISTROS POR FECHA
// ============================================

// ============================================
// CONVERTIR FECHA EXCEL → YYYY-MM-DD
// ============================================

function excelDateToISO(value) {

    if (typeof value === "number") {

        const date = XLSX.SSF.parse_date_code(value);

        if (!date) {
            return "";
        }

        return [
            date.y,
            String(date.m).padStart(2, "0"),
            String(date.d).padStart(2, "0")
        ].join("-");
    }

    return value || "";
}


// ============================================
// CONVERTIR HORA EXCEL → HH:MM
// ============================================

function excelTimeToString(value) {

    if (typeof value === "number") {

        const totalMinutes =
            Math.round(value * 24 * 60);

        const hours =
            Math.floor(totalMinutes / 60) % 24;

        const minutes =
            totalMinutes % 60;

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    return value || "";
}

app.get('/historial', (req, res) => {

    const { fecha } = req.query;

    if (!fs.existsSync(excelFilePath)) {
        return res.json([]);
    }

    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null
    });

    // ============================================
    // NORMALIZAR DATOS
    // ============================================

    const normalizados = data.map(record => ({
        ...record,

        Fecha: excelDateToISO(record.Fecha),
        Hora: excelTimeToString(record.Hora)
    }));

    // ============================================
    // ORDENAR DEL MÁS RECIENTE AL MÁS ANTIGUO
    // ============================================

    normalizados.sort((a, b) => {

        const fechaHoraA =
            new Date(`${a.Fecha}T${a.Hora}:00`);

        const fechaHoraB =
            new Date(`${b.Fecha}T${b.Hora}:00`);

        return fechaHoraB - fechaHoraA;
    });
    // ============================================
    // FILTRAR POR FECHA
    // ============================================

    if (fecha) {

        const filtrados = normalizados.filter(
            record => record.Fecha === fecha
        );

        return res.json(filtrados);
    }

    // ============================================
    // SIN FILTRO
    // ============================================

    res.json(normalizados);
});

// ============================================
// HISTÓRICO DE PENDIENTES
// ============================================

app.get('/pendientes/historial', (req, res) => {

    try {

        if (!fs.existsSync(excelFilePath)) {
            return res.json([]);
        }

        const workbook = XLSX.readFile(excelFilePath);

        const pendientes = getPendientesData(workbook);

        res.json(pendientes);

    } catch (err) {

        console.error(
            "Error cargando histórico de pendientes:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Error cargando histórico de pendientes",
            error: err.message
        });
    }
});

// ============================================
// RESOLVER PENDIENTES
// ============================================

app.patch('/pendientes/resolver', (req, res) => {

    try {

        const {
            ids,
            fecha,
            encargado
        } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {

            return res.status(400).json({
                success: false,
                message: "No se recibieron pendientes para resolver"
            });
        }

        if (!fecha || !encargado) {

            return res.status(400).json({
                success: false,
                message: "Fecha y encargado son obligatorios"
            });
        }

        if (!fs.existsSync(excelFilePath)) {

            return res.status(404).json({
                success: false,
                message: "No existe el archivo de registros"
            });
        }

        const workbook =
            XLSX.readFile(excelFilePath);

        const pendientes =
            getPendientesData(workbook);

        let solucionados = 0;

        const resolutionFields =
            VARIABLES.pendientes?.context?.resolution?.fields || {};

        const resolutionContext = {
            fecha,
            encargado
        };

        for (const pendiente of pendientes) {

            if (!ids.includes(String(pendiente.ID))) {
                continue;
            }

            // Buscar si el pendiente ya tiene algún campo
            // de resolución informado.
            const yaResuelto =
                Object.keys(resolutionFields).some(
                    targetField => {

                        const columnName =
                            toExcelFieldName(targetField);

                        return (
                            pendiente[columnName] !== null &&
                            pendiente[columnName] !== undefined &&
                            pendiente[columnName] !== ""
                        );
                    }
                );

            if (yaResuelto) {
                continue;
            }

            // Aplicar dinámicamente todos los campos
            // definidos en la configuración.
            for (
                const [targetField, sourceField]
                of Object.entries(resolutionFields)
            ) {

                const columnName =
                    toExcelFieldName(targetField);

                pendiente[columnName] =
                    resolutionContext[sourceField] ?? null;
            }

            solucionados++;
        }

        savePendientesData(pendientes);

        res.json({
            success: true,
            solucionados
        });

    } catch (err) {

        console.error(
            "Error resolviendo pendientes:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Error resolviendo pendientes",
            error: err.message
        });
    }
});

// ============================================
// OBTENER PENDIENTES ACTIVOS
// ============================================

function getPendientesActivos(workbook) {

    const pendientes =
        getPendientesData(workbook);

    const resolutionFields =
        VARIABLES.pendientes?.context?.resolution?.fields || {};

    return pendientes.filter(pendiente => {

        // Si no hay campos de resolución configurados,
        // todos los pendientes se consideran activos.
        if (
            Object.keys(resolutionFields).length === 0
        ) {
            return true;
        }

        // Un pendiente está resuelto cuando alguno
        // de los campos de resolución tiene valor.
        const yaResuelto =
            Object.keys(resolutionFields).some(
                targetField => {

                    const columnName =
                        toExcelFieldName(targetField);

                    return (
                        pendiente[columnName] !== null &&
                        pendiente[columnName] !== undefined &&
                        pendiente[columnName] !== ""
                    );
                }
            );

        return !yaResuelto;
    });
}

// ============================================
// PENDIENTES ACTIVOS
// ============================================

app.get('/pendientes', (req, res) => {

    try {

        if (!fs.existsSync(excelFilePath)) {
            return res.json([]);
        }

        const workbook =
            XLSX.readFile(excelFilePath);

        const pendientesActivos =
            getPendientesActivos(workbook);

        res.json(pendientesActivos);

    } catch (err) {

        console.error(
            "Error cargando pendientes activos:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Error cargando pendientes activos",
            error: err.message
        });
    }
});

// ============================================
// ÚLTIMO REGISTRO
// ============================================

app.get('/ultimo-registro', (req, res) => {

    if (!fs.existsSync(excelFilePath)) {
        return res.json(null);
    }

    const workbook = XLSX.readFile(excelFilePath);

    const worksheet =
        workbook.Sheets[workbook.SheetNames[0]];

    const data =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                defval: null
            }
        );

    if (data.length === 0) {
        return res.json(null);
    }

    const ultimo = data[data.length - 1];

    // ========================================
    // 1. Obtener variables desde VARIABLES
    // ========================================

    const valores = {};

    for (const [name, variable] of Object.entries(VARIABLES)) {

        valores[name] =
            getVariableValue(
                ultimo,
                variable
            );
    }


    // ========================================
    // 2. Construir grupos dinámicamente
    // ========================================

    const grupos = {};

    for (const [name, variable] of Object.entries(VARIABLES)) {

        if (
            !variable.recordGroup ||
            !variable.recordField
        ) {
            continue;
        }

        if (!grupos[variable.recordGroup]) {
            grupos[variable.recordGroup] = {};
        }

        grupos[variable.recordGroup][variable.recordField] =
            valores[name];
    }


    // ========================================
    // 3. Estado
    // ========================================

    const estado =
        grupos.Estado || {};


    const cisternaHabilitada =
        estado.CisternaHabilitada === true ||
        estado.CisternaHabilitada === "true";


    // ========================================
    // 4. Pendientes
    // ========================================

    const pendientesValor =
        valores.pendientes;

    const pendientes =
        pendientesValor === null ||
        pendientesValor === undefined ||
        pendientesValor === ""
            ? []
            : String(pendientesValor)
                .split(",")
                .map(p => p.trim())
                .filter(Boolean);


    // ========================================
    // 5. Registro estructurado
    // ========================================

    const registro = {

        Fecha:
            excelDateToISO(
                valores.fecha
            ),

        Hora:
            excelTimeToString(
                valores.hora
            ),

        EstadoOperacion:
            valores.estado_operacion ?? null,

        Pendientes:
            pendientes,

        // Compatibilidad con registros históricos
        // donde este campo todavía existe.
        OtroPendiente:
            ultimo.OtroPendiente ?? null,

        CisternaHabilitada:
            cisternaHabilitada,

        Variables:
            grupos.Variables || {},

        Cisterna:
            cisternaHabilitada
                ? (grupos.Cisterna || {})
                : null,

        Observaciones:
            valores.observaciones ?? null,

        Encargado:
            valores.encargado ?? null,

        FechaServidor:
            ultimo.FechaServidor ?? null
    };


    res.json(registro);
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req,res)=>{
    res.json({status:"Servidor activo"});
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log("===================================");
    console.log("Backend corriendo en:");
    console.log(`http://localhost:${PORT}`);
    console.log("===================================");
});


// ============================================
// DESCARGAR EXCEL
// ============================================

app.get('/exportar', (req,res)=>{

if (!fs.existsSync(excelFilePath)) {
return res.status(404).send("No hay archivo");
}

res.download(excelFilePath);

});