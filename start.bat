@echo off
echo ========================================
echo Sistema de Monitoreo GLP
echo Loceria Colombiana
echo ========================================
echo.

REM Verificar si Node.js esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

REM Verificar si existen las dependencias
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    echo.
)

echo [INFO] Iniciando servidor...
echo.
echo Abre tu navegador en: http://localhost:3000
echo.
echo Presiona Ctrl+C para detener el servidor
echo ========================================
echo.

node server.js
