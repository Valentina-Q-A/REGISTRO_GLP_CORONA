// ============================================
// SERVIDOR BACKEND - SISTEMA GLP
// ============================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const { VARIABLES } = require('./js/variables.js');

const app = express();
const PORT = 3000;


const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors()); //  IMPORTANTE para React
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('dist'));

const excelFilePath = path.join(__dirname, 'registros.xlsx');

// ============================================
// FUNCION GUARDAR EXCEL
// ============================================

function saveRecord(record) {

    let workbook;
    let worksheet;
    let data = [];

    // ============================================
    // CONVERTIR REGISTRO ESTRUCTURADO A FILA PLANA
    // ============================================

    const flatRecord = {
        Fecha: record.Fecha,
        Hora: record.Hora,

        EstadoOperacion: record.EstadoOperacion,

        Pendientes: Array.isArray(record.Pendientes)
            ? record.Pendientes.join(", ")
            : "",

        OtroPendiente: record.OtroPendiente || "",

        CisternaHabilitada: record.CisternaHabilitada,

        NivelTanque: record.Variables?.NivelTanque ?? "",
        PresionTanque: record.Variables?.PresionTanque ?? "",
        TempTanque: record.Variables?.TempTanque ?? "",

        PresionBomba: record.Variables?.PresionBomba ?? "",
        TempVapor: record.Variables?.TempVapor ?? "",
        PresionVapor: record.Variables?.PresionVapor ?? "",
        PresionMezcla: record.Variables?.PresionMezcla ?? "",

        NivelCisterna: record.Cisterna?.Nivel ?? "",
        PresionCisterna: record.Cisterna?.Presion ?? "",
        TempCisterna: record.Cisterna?.Temperatura ?? "",
        CapacidadCisterna: record.Cisterna?.Capacidad ?? "",
        PlacaCisterna: record.Cisterna?.Placa ?? "",

        Observaciones: record.Observaciones || "",
        Encargado: record.Encargado || "",
        FechaServidor: record.FechaServidor || ""
    };

    // ============================================
    // CARGAR HISTÓRICO EXISTENTE
    // ============================================

    if (fs.existsSync(excelFilePath)) {

        workbook = XLSX.readFile(excelFilePath);
        worksheet = workbook.Sheets[workbook.SheetNames[0]];

        data = XLSX.utils.sheet_to_json(worksheet);

        data.push(flatRecord);

        worksheet = XLSX.utils.json_to_sheet(data);

        workbook.Sheets[workbook.SheetNames[0]] = worksheet;

    } else {

        workbook = XLSX.utils.book_new();

        worksheet = XLSX.utils.json_to_sheet([flatRecord]);

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Registros'
        );
    }

    XLSX.writeFile(workbook, excelFilePath);
}

// ============================================
// HOJA DE PENDIENTES
// ============================================

const PENDIENTES_SHEET = "Pendientes";

const PENDIENTES_COLUMNS = [
    "ID",
    "Tipo",
    "Descripcion",
    "FechaRegistro",
    "EncargadoRegistro",
    "FechaSolucion",
    "EncargadoSolucion"
];

function getPendientesData(workbook) {

    if (!workbook.SheetNames.includes(PENDIENTES_SHEET)) {
        return [];
    }

    const worksheet = workbook.Sheets[PENDIENTES_SHEET];

    return XLSX.utils.sheet_to_json(worksheet);
}

function savePendientesData(pendientes) {

    let workbook;

    if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    const worksheet = XLSX.utils.json_to_sheet(
        pendientes,
        {
            header: PENDIENTES_COLUMNS
        }
    );

    if (workbook.SheetNames.includes(PENDIENTES_SHEET)) {

        workbook.Sheets[PENDIENTES_SHEET] = worksheet;

    } else {

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            PENDIENTES_SHEET
        );
    }

    XLSX.writeFile(workbook, excelFilePath);
}

function testPendientesSheet() {

    let workbook;

    if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    const pendientes = getPendientesData(workbook);

    console.log("Pendientes actuales:", pendientes);
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

    for (const contextName of Object.keys(contextFields)) {

        const columnName =
            contextName.charAt(0).toUpperCase() +
            contextName.slice(1);

        record[columnName] =
            pending.context?.[contextName] ?? "";
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

function testCrearHojaPendientes() {

    let workbook;

    if (fs.existsSync(excelFilePath)) {
        workbook = XLSX.readFile(excelFilePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    const pendientes = getPendientesData(workbook);

    console.log("Hojas actuales:", workbook.SheetNames);
    console.log("Pendientes antes de la prueba:", pendientes);

    if (!workbook.SheetNames.includes(PENDIENTES_SHEET)) {

        const worksheet = XLSX.utils.json_to_sheet(
            [],
            {
                header: PENDIENTES_COLUMNS
            }
        );

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            PENDIENTES_SHEET
        );

        XLSX.writeFile(workbook, excelFilePath);

        console.log(
            `Hoja "${PENDIENTES_SHEET}" creada correctamente`
        );

    } else {

        console.log(
            `La hoja "${PENDIENTES_SHEET}" ya existe`
        );
    }
}

// ============================================
// ENVIAR DATOS A UBIDOTS
// ============================================

async function sendToUbidots(data){

const TOKEN="BBUS-9TxsD2zFJdsZHGHnhVbtafa8LU37rA";

try{

await fetch("https://industrial.api.ubidots.com/api/v1.6/devices/planta-glp",{

method:"POST",

headers:{
"Content-Type":"application/json",
"X-Auth-Token":TOKEN
},

body:JSON.stringify({

fecha: Date.parse(data.Fecha),

hora: Date.parse(`${data.Fecha} ${data.Hora}`),

nivel_tanque: Number(data.NivelTanque),
presion_tanque: Number(data.PresionTanque),
temp_tanque: Number(data.TempTanque),

nivel_cisterna: Number(data.NivelCisterna),
capacidad_cisterna: Number(data.CapacidadCisterna),

placa_cisterna: data.PlacaCisterna ? data.PlacaCisterna.length : 0,

presion_bomba: Number(data.PresionBomba),

temp_vapor: Number(data.TempVapor),
presion_vapor: Number(data.PresionVapor),

presion_mezcla: Number(data.PresionMezcla),

observaciones: data.Observaciones ? data.Observaciones.length : 0,

encargado: data.Encargado ? data.Encargado.length : 0,

fecha_servidor: Date.now()

})

});

console.log("Todas las variables enviadas a Ubidots");

}catch(err){

console.error("Error enviando a Ubidots:",err);

}

}

// ============================================
// ENDPOINT GUARDAR
// ============================================

app.post('/save', (req, res) => {

    const data = req.body;

    console.log("DATOS RECIBIDOS EN /save:");
    console.log(JSON.stringify(data, null, 2));

    if (!data) {
        return res.status(400).json({
            success: false,
            message: "No se recibieron datos"
        });
    }

    try {

        data.FechaServidor = new Date().toLocaleString('es-CO');

        saveRecord(data);
        /*sendToUbidots(data);*/
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

app.get('/historial', (req, res) => {

    const { fecha } = req.query;

    if (!fs.existsSync(excelFilePath)) {
        return res.json([]);
    }

    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!fecha) {
        return res.json(data);
    }

    const filtrados = data.filter(r => r.Fecha === fecha);

    res.json(filtrados);
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
// PENDIENTES ACTIVOS
// ============================================

app.get('/pendientes', (req, res) => {

    try {

        if (!fs.existsSync(excelFilePath)) {
            return res.json([]);
        }

        const workbook = XLSX.readFile(excelFilePath);

        const pendientes = getPendientesData(workbook);

        const pendientesActivos = pendientes.filter(
            pendiente => !pendiente.FechaSolucion
        );

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
// ENDPOINT ÚLTIMO REGISTRO
// ============================================

app.get('/ultimo-registro', (req, res) => {

    if (!fs.existsSync(excelFilePath)) {
        return res.json(null);
    }

    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
        return res.json(null);
    }

    const ultimo = data[data.length - 1];

    // ============================================
    // RECONSTRUIR REGISTRO ESTRUCTURADO
    // ============================================

    const pendientes = ultimo.Pendientes
        ? String(ultimo.Pendientes)
            .split(",")
            .map(p => p.trim())
            .filter(Boolean)
        : [];

    const cisternaHabilitada =
        ultimo.CisternaHabilitada === true ||
        ultimo.CisternaHabilitada === "true";

    const registro = {

        Fecha: ultimo.Fecha ?? "",
        Hora: ultimo.Hora ?? "",

        EstadoOperacion: ultimo.EstadoOperacion ?? "",

        Pendientes: pendientes,

        OtroPendiente: ultimo.OtroPendiente ?? "",

        CisternaHabilitada: cisternaHabilitada,

        Variables: {
            NivelTanque: ultimo.NivelTanque ?? "",
            PresionTanque: ultimo.PresionTanque ?? "",
            TempTanque: ultimo.TempTanque ?? "",

            PresionBomba: ultimo.PresionBomba ?? "",

            TempVapor: ultimo.TempVapor ?? "",
            PresionVapor: ultimo.PresionVapor ?? "",
            PresionMezcla: ultimo.PresionMezcla ?? ""
        },

        Cisterna: cisternaHabilitada
            ? {
                Nivel: ultimo.NivelCisterna ?? "",
                Presion: ultimo.PresionCisterna ?? "",
                Temperatura: ultimo.TempCisterna ?? "",
                Capacidad: ultimo.CapacidadCisterna ?? "",
                Placa: ultimo.PlacaCisterna ?? ""
            }
            : null,

        Observaciones: ultimo.Observaciones ?? "",

        Encargado: ultimo.Encargado ?? "",

        FechaServidor: ultimo.FechaServidor ?? ""
    };

    res.json(registro);
});

async function loadLastRecord() {
    try {
        const response = await fetch('http://LJDCOLORADO:3000/registros');
        const data = await response.json();

        if (data.length === 0) {
            document.getElementById('summaryDisplay').innerHTML = 
                "<p>No hay registros anteriores</p>";
            return;
        }

        const last = data[data.length - 1];

        document.getElementById('summaryDisplay').innerHTML = `
            <div class="summary-item"><label>Fecha</label><div>${last.Fecha} ${last.Hora}</div></div>
            <div class="summary-item"><label>Nivel Tanque</label><div>${last.NivelTanque}%</div></div>
            <div class="summary-item"><label>Presión Tanque</label><div>${last.PresionTanque} PSI</div></div>
            <div class="summary-item"><label>Temp Tanque</label><div>${last.TempTanque} °C</div></div>
            <div class="summary-item"><label>Encargado</label><div>${last.Encargado}</div></div>
        `;

    } catch (err) {
        console.error("Error cargando registros:", err);
    }
}

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