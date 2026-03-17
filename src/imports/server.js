const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const excelFilePath = path.join(__dirname, 'registros.xlsx');

// Función para guardar un registro
function saveRecord(record) {
    let workbook;
    let worksheet;
    
    if (fs.existsSync(excelFilePath)) {
        // Abrir Excel existente
        workbook = XLSX.readFile(excelFilePath);
        worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // Convertir a array de objetos
        var data = XLSX.utils.sheet_to_json(worksheet);
        data.push(record);
        worksheet = XLSX.utils.json_to_sheet(data, {skipHeader:false});
        workbook.Sheets[workbook.SheetNames[0]] = worksheet;
    } else {
        // Crear nuevo Excel
        workbook = XLSX.utils.book_new();
        worksheet = XLSX.utils.json_to_sheet([record]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    }

    XLSX.writeFile(workbook, excelFilePath);
}

// Endpoint para guardar registros
app.post('/save', (req, res) => {
    const data = req.body;

    try {
        saveRecord(data);
        res.status(200).send("Registro guardado en Excel correctamente");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error guardando registro en Excel");
    }
});

//app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});