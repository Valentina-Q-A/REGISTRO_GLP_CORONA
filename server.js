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

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors()); // 🔥 IMPORTANTE para React
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log("===================================");
    console.log("🚀 Backend corriendo en:");
    console.log(`http://localhost:${PORT}`);
    console.log("===================================");
});