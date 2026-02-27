#!/bin/bash

echo "========================================"
echo "Sistema de Monitoreo GLP"
echo "Locería Colombiana"
echo "========================================"
echo ""

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js no está instalado"
    echo "Por favor instala Node.js desde: https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js encontrado"
echo ""

# Verificar si existen las dependencias
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependencias..."
    npm install
    echo ""
fi

echo "[INFO] Iniciando servidor..."
echo ""
echo "Abre tu navegador en: http://localhost:3000"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo "========================================"
echo ""

node server.js
