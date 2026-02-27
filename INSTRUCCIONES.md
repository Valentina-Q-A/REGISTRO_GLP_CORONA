# 📖 Guía Rápida de Instalación y Uso

## ⚡ Inicio Rápido (3 pasos)

### 1️⃣ Instalar Dependencias
```bash
npm install
```

### 2️⃣ Iniciar el Servidor
```bash
npm start
```

### 3️⃣ Abrir en el Navegador
Abre tu navegador y ve a: **http://localhost:3000**

---

## 🎯 Uso del Sistema

### Monitoreo en Tiempo Real

1. **Ajustar valores**: Mueve los sliders para cambiar los valores de cada equipo
2. **Ver resumen**: Los valores actuales se muestran en el resumen automáticamente
3. **Completar datos**: Llena los campos obligatorios (marcados con *)
   - Fecha
   - Hora  
   - Capacidad de la cisterna
   - Placa de la cisterna
   - Encargado

4. **Guardar**: Haz clic en "Guardar Registro"

### Datos Guardados

- Los registros se guardan automáticamente en `registros.xlsx`
- Puedes abrir el archivo con Excel, Google Sheets, LibreOffice, etc.
- Cada registro incluye fecha y hora del servidor

---

## 🔧 Comandos Útiles

```bash
# Iniciar servidor (modo normal)
npm start

# Iniciar servidor (modo desarrollo con auto-reload)
npm run dev

# Instalar dependencias
npm install

# Ver versión de Node.js
node --version
```

---

## 📱 Acceso desde Otros Dispositivos

### En la misma red WiFi:

1. En la computadora donde corre el servidor, abre CMD/Terminal
2. Escribe `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
3. Busca tu dirección IP (ejemplo: 192.168.1.100)
4. En otro dispositivo, abre el navegador y ve a: `http://TU_IP:3000`

Ejemplo: `http://192.168.1.100:3000`

---

## ❓ Preguntas Frecuentes

### ¿Dónde se guardan los datos?
En el archivo `registros.xlsx` en la misma carpeta del proyecto.

### ¿Puedo cambiar los rangos de los valores?
Sí, edita el archivo `index.html` y cambia los atributos `min` y `max` de cada slider.

### ¿Cómo cambio el puerto?
Edita `server.js` y cambia `const PORT = 3000;` por el puerto que desees.

### ¿Cómo veo todos los registros?
Ve a: `http://localhost:3000/registros`

### ¿Cómo descargo el Excel?
Ve a: `http://localhost:3000/download`

### El servidor no inicia
- Verifica que Node.js esté instalado: `node --version`
- Verifica que hayas ejecutado: `npm install`
- Cierra otras aplicaciones que usen el puerto 3000

---

## 🎨 Personalización

### Cambiar colores:
Edita `/css/style.css` y modifica las variables:
```css
:root {
    --primary-blue: #0d3b66;      /* Azul principal */
    --secondary-blue: #1e5f99;    /* Azul secundario */
    --highlight-yellow: #ffd166;  /* Amarillo destacado */
}
```

### Cambiar imágenes:
Reemplaza los archivos SVG en `/assets/` con tus propias imágenes.

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del servidor (donde ejecutaste `npm start`)
2. Revisa la consola del navegador (presiona F12)
3. Contacta al departamento de sistemas

---

## ✅ Checklist de Instalación

- [ ] Node.js instalado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor iniciado (`npm start`)
- [ ] Navegador abierto en `localhost:3000`
- [ ] Prueba guardando un registro
- [ ] Verifica que se creó `registros.xlsx`

---

**¡Listo! El sistema está funcionando correctamente. 🎉**
