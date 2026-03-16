// ============================================
// SERVIDOR BACKEND - SISTEMA GLP
// ============================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

    if (fs.existsSync(excelFilePath)) {

        workbook = XLSX.readFile(excelFilePath);
        worksheet = workbook.Sheets[workbook.SheetNames[0]];

        let data = XLSX.utils.sheet_to_json(worksheet);
        data.push(record);

        worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: false });
        workbook.Sheets[workbook.SheetNames[0]] = worksheet;

    } else {

        workbook = XLSX.utils.book_new();
        worksheet = XLSX.utils.json_to_sheet([record]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    }

    XLSX.writeFile(workbook, excelFilePath);
}

// ============================================
// ENVIAR DATOS A UBIDOTS
// ============================================

async function sendToUbidots(data) {

    const TOKEN = "BBUS-EKjim7XDAmaYDMZjzu7SHJLY4H7xRK";

    try {

        await fetch("https://industrial.api.ubidots.com/api/v1.6/devices/planta-glp", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": TOKEN
            },
            body: JSON.stringify({

                nivel_tanque: data.NivelTanque,
                presion_tanque: data.PresionTanque,
                temp_tanque: data.TempTanque,

                nivel_cisterna: data.NivelCisterna,
                presion_bomba: data.PresionBomba,

                temp_vapor: data.TempVapor,
                presion_vapor: data.PresionVapor,

                presion_mezcla: data.PresionMezcla

            })

        });

        console.log("Datos enviados a Ubidots");

    } catch (err) {

        console.error("Error enviando a Ubidots:", err);

    }

}

// ============================================
// ENDPOINT GUARDAR
// ============================================

app.post('/save', (req, res) => {

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

        sendToUbidots(data);

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

    const ultimoRegistro = data[data.length - 1];

    res.json(ultimoRegistro);
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