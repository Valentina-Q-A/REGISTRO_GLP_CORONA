# 🏭 Sistema de Monitoreo GLP - Locería Colombiana

Sistema web para el monitoreo y registro de operaciones de la planta GLP de Locería Colombiana. Incluye visualización en tiempo real de equipos industriales y almacenamiento de datos en Excel.

## 📁 Estructura del Proyecto

```
monitor-glp/
│
├── index.html              # Página principal del sistema
├── server.js               # Servidor backend Node.js + Express
├── package.json            # Dependencias del proyecto
├── registros.xlsx          # Archivo Excel (se crea automáticamente)
│
├── css/
│   └── style.css          # Estilos de la aplicación
│
├── js/
│   └── app.js             # Lógica del frontend
│
└── assets/                # Imágenes SVG de equipos
    ├── tank.svg           # Imagen del tanque
    ├── pump.svg           # Imagen de la bomba
    ├── vaporizer.svg      # Imagen del vaporizador
    ├── cisterna.svg       # Imagen de la cisterna
    └── mixer.svg          # Imagen del mezclador
```

## 🚀 Instalación

### 1. Requisitos Previos

- Node.js (versión 14 o superior)
- npm (viene incluido con Node.js)

### 2. Instalar Dependencias

```bash
npm install
```

Esto instalará:
- **express**: Framework web para Node.js
- **body-parser**: Middleware para procesar datos JSON
- **xlsx**: Librería para leer/escribir archivos Excel

## ▶️ Ejecución

### Modo Producción

```bash
npm start
```

### Modo Desarrollo (con auto-reload)

```bash
npm run dev
```

El servidor se iniciará en: **http://localhost:3000**

## 📊 Características

### Frontend (HTML/CSS/JS Vanilla)

- ✅ Visualización interactiva de equipos industriales
- ✅ Sliders para control de valores en tiempo real
- ✅ Formulario de registro con validación
- ✅ Resumen de datos actuales
- ✅ Diseño responsive
- ✅ Interfaz con colores corporativos azules

### Backend (Node.js + Express)

- ✅ API REST para guardar registros
- ✅ Almacenamiento en archivo Excel (.xlsx)
- ✅ Gestión automática del archivo Excel
- ✅ Endpoints para consultar registros
- ✅ Validación de datos

## 🔌 Endpoints de la API

### POST /save
Guarda un nuevo registro en Excel

**Body:**
```json
{
  "Fecha": "2026-02-27",
  "Hora": "14:30",
  "NivelTanque": "80",
  "PresionTanque": "85",
  "TempTanque": "50",
  "NivelCisterna": "95",
  "CapacidadCisterna": "30000",
  "PlacaCisterna": "XYZ-987",
  "PresionBomba": "105",
  "TempVapor": "63",
  "PresionVapor": "95",
  "PresionMezcla": "10",
  "Observaciones": "Funcionamiento normal",
  "Encargado": "Juan Pérez"
}
```

### GET /registros
Obtiene todos los registros guardados

### GET /download
Descarga el archivo Excel con todos los registros

### GET /health
Verifica el estado del servidor

## 📋 Datos Monitoreados

### Vaporizador
- Temperatura del vapor (50-76°C)
- Presión del vapor (90-100 PSI)

### Tanque Principal
- Nivel (35-90%)
- Presión (70-100 PSI)
- Temperatura (0-100°C)

### Bomba Centrífuga
- Presión (100-110 PSI)

### Cisterna/Camión Tanque
- Nivel (0-100%)
- Capacidad (galones)
- Placa del vehículo

### Mezclador
- Presión de mezcla (8-12 PSI)

### Información General
- Fecha y hora del registro
- Observaciones
- Encargado del turno

## 🎨 Personalización

### Colores

Los colores están definidos en `/css/style.css` como variables CSS:

```css
:root {
    --primary-blue: #0d3b66;
    --secondary-blue: #1e5f99;
    --accent-blue: #144d78;
    --highlight-yellow: #ffd166;
}
```

### Imágenes de Equipos

Coloca tus imágenes SVG o PNG en la carpeta `/assets/` con los nombres:
- `tank.svg` - Tanque
- `pump.svg` - Bomba
- `vaporizer.svg` - Vaporizador
- `cisterna.svg` - Cisterna
- `mixer.svg` - Mezclador

## 🔧 Configuración del Servidor

Para cambiar el puerto del servidor, edita `server.js`:

```javascript
const PORT = process.env.PORT || 3000;
```

O usa una variable de entorno:

```bash
PORT=8080 npm start
```

## 📝 Archivo Excel

El archivo `registros.xlsx` se crea automáticamente al guardar el primer registro.

**Ubicación:** Raíz del proyecto

**Columnas:**
- Fecha
- Hora
- NivelTanque
- PresionTanque
- TempTanque
- NivelCisterna
- CapacidadCisterna
- PlacaCisterna
- PresionBomba
- TempVapor
- PresionVapor
- PresionMezcla
- Observaciones
- Encargado
- FechaRegistro (timestamp del servidor)

## 🌐 Acceso desde Otros Dispositivos

El servidor se inicia en `0.0.0.0`, permitiendo acceso desde otros dispositivos en la red local.

1. Encuentra tu IP local:
   - **Windows:** `ipconfig`
   - **Mac/Linux:** `ifconfig` o `ip addr`

2. Accede desde otro dispositivo: `http://TU_IP:3000`

Ejemplo: `http://192.168.1.100:3000`

## 🐛 Solución de Problemas

### El servidor no inicia
- Verifica que Node.js esté instalado: `node --version`
- Verifica que las dependencias estén instaladas: `npm install`
- Verifica que el puerto 3000 no esté en uso

### Los datos no se guardan
- Revisa la consola del servidor para ver errores
- Verifica que tengas permisos de escritura en la carpeta
- Revisa la consola del navegador (F12) para ver errores de conexión

### El archivo Excel no se crea
- Verifica que la dependencia `xlsx` esté instalada
- Verifica permisos de escritura en el directorio

## 📄 Licencia

MIT License - Locería Colombiana

## 👨‍💻 Soporte

Para soporte técnico, contacta al departamento de sistemas de Locería Colombiana.

---

**Versión:** 1.0.0  
**Última actualización:** Febrero 2026
