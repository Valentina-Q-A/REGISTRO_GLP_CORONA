# 🎯 CÓMO USAR ESTE PROYECTO

## 📌 IMPORTANTE: Dos Versiones del Sistema

Este proyecto contiene **DOS VERSIONES** del sistema de monitoreo:

---

## 🔵 VERSIÓN 1: React + Tailwind (Actual en /src/)

Esta es la versión **avanzada** con React que ya estaba funcionando.

### Archivos:
- `/src/app/App.tsx` - Aplicación React principal
- `/src/app/components/*` - Componentes React profesionales
- Visualizaciones industriales animadas
- Sistema completo con Motion (Framer Motion)

### Características:
✅ Visualizaciones 3D profesionales  
✅ Animaciones en tiempo real  
✅ Termómetros, manómetros, relojes animados  
✅ Diseño moderno y responsive  
✅ Tecnología: React + TypeScript + Tailwind CSS  

### Para ejecutar:
Ya está corriendo en Figma Make (esta ventana)

---

## 🟢 VERSIÓN 2: HTML/CSS/JS Vanilla (Nueva en raíz /)

Esta es la versión **simplificada** en HTML puro que acabas de crear.

### Archivos Principales:
```
/index.html          ← Página web
/server.js           ← Servidor Node.js
/css/style.css       ← Estilos
/js/app.js           ← Lógica JavaScript
/assets/*.svg        ← Imágenes de equipos
```

### Características:
✅ Sin dependencias de frontend  
✅ Fácil de entender y modificar  
✅ Guarda datos en Excel  
✅ Servidor Node.js incluido  
✅ Funciona de forma independiente  
✅ Tecnología: HTML5 + CSS3 + JavaScript + Node.js  

### Para ejecutar:

#### En Windows:
```bash
# Doble clic en:
start.bat

# O manualmente:
npm install
npm start
```

#### En Linux/Mac:
```bash
chmod +x start.sh
./start.sh

# O manualmente:
npm install
npm start
```

Luego abre: **http://localhost:3000**

---

## 🤔 ¿Cuál Versión Usar?

### Usa la VERSIÓN REACT (/src/) si:
- ✅ Quieres visualizaciones profesionales muy avanzadas
- ✅ Necesitas animaciones y efectos visuales impresionantes
- ✅ Estás cómodo con React y tecnologías modernas
- ✅ Solo necesitas mostrar datos (frontend)

### Usa la VERSIÓN HTML (/raíz) si:
- ✅ Necesitas **guardar datos en Excel**
- ✅ Quieres algo más simple de entender y modificar
- ✅ Prefieres HTML/CSS/JS tradicional
- ✅ Necesitas un servidor backend
- ✅ Quieres algo fácil de desplegar

---

## 💡 Recomendación

**Para producción en la locería:** Usa la **VERSIÓN HTML** porque:
1. Incluye servidor backend
2. Guarda datos automáticamente en Excel
3. Es más fácil de mantener
4. Funciona sin internet
5. Código más simple para el equipo técnico

---

## 📁 Estructura Completa del Proyecto

```
monitor-glp/
│
├── 🟢 VERSIÓN HTML (Sistema Completo con Backend)
│   ├── index.html              ← Página principal
│   ├── server.js               ← Servidor Node.js
│   ├── package.json            ← Dependencias
│   ├── start.bat / start.sh    ← Scripts de inicio
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── assets/
│       └── *.svg               ← Imágenes de equipos
│
├── 🔵 VERSIÓN REACT (Solo Frontend Avanzado)
│   └── src/
│       ├── app/
│       │   ├── App.tsx         ← Aplicación principal React
│       │   └── components/     ← Componentes React profesionales
│       └── styles/
│           └── *.css           ← Estilos Tailwind
│
└── 📚 DOCUMENTACIÓN
    ├── README.md               ← Documentación completa
    ├── INSTRUCCIONES.md        ← Guía rápida
    ├── RESUMEN.md              ← Resumen del proyecto
    ├── ESTRUCTURA.txt          ← Diagrama visual
    └── COMO-USAR.md            ← Este archivo
```

---

## 🚀 Inicio Rápido - Versión HTML

### 1. Instalar Node.js
Descarga desde: https://nodejs.org/

### 2. Abrir Terminal en la Carpeta del Proyecto
```bash
cd ruta/del/proyecto
```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Iniciar el Servidor
```bash
npm start
```

### 5. Abrir en el Navegador
```
http://localhost:3000
```

---

## 📊 ¿Qué Hace Cada Versión?

### Versión React (/src/)
```
Usuario → Interfaz React → Muestra datos visualmente
                           (NO guarda en base de datos)
```

### Versión HTML (/)
```
Usuario → Interfaz HTML → Formulario → Servidor Node.js → Excel
                                                          (registros.xlsx)
```

---

## 🔄 Migrar Entre Versiones

### Para usar las visualizaciones de React en HTML:
Los componentes React son muy avanzados y no se pueden usar directamente en HTML. 

**Alternativa:** Los SVG en `/assets/` son versiones simplificadas.

### Para agregar backend a React:
Puedes usar el `server.js` con React modificando las rutas de archivos estáticos.

---

## 🛠️ Personalización

### Versión HTML:
- **Colores:** Edita `/css/style.css`
- **Imágenes:** Reemplaza archivos en `/assets/`
- **Rangos:** Edita `min` y `max` en `/index.html`
- **Backend:** Modifica `/server.js`

### Versión React:
- **Componentes:** Edita archivos en `/src/app/components/`
- **Estilos:** Usa clases de Tailwind en los componentes
- **Datos:** Modifica `/src/app/App.tsx`

---

## ❓ Preguntas Frecuentes

### ¿Puedo usar las dos versiones al mismo tiempo?
Sí, pero en puertos diferentes. La versión React ya está en Figma Make, y la HTML puedes ejecutarla en tu computadora en el puerto 3000.

### ¿Cuál guarda datos en Excel?
Solo la versión HTML (raíz del proyecto) con `server.js`.

### ¿Cuál tiene mejores visualizaciones?
La versión React tiene visualizaciones industriales más avanzadas y profesionales.

### ¿Puedo combinarlas?
Sí, puedes tomar las visualizaciones de React y agregarles el backend de la versión HTML.

### ¿Necesito internet?
No para ninguna de las dos. Ambas funcionan offline.

---

## 📞 Ayuda y Documentación

- **Guía Completa:** Lee `README.md`
- **Inicio Rápido:** Lee `INSTRUCCIONES.md`
- **Estructura:** Lee `ESTRUCTURA.txt`
- **Resumen:** Lee `RESUMEN.md`

---

## ✅ Checklist de Instalación (Versión HTML)

- [ ] Node.js instalado (`node --version`)
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor iniciado (`npm start`)
- [ ] Navegador abierto en `localhost:3000`
- [ ] Formulario funciona y guarda datos
- [ ] Archivo `registros.xlsx` se crea al guardar

---

## 🎓 Conclusión

Tienes **dos opciones**:

1. **Sistema Visual Avanzado (React)** - Ya funcionando aquí
2. **Sistema Completo con Base de Datos (HTML + Node.js)** - Listo para usar

Ambos están incluidos y completamente funcionales. Elige el que mejor se adapte a tus necesidades.

---

**¡Éxito con tu sistema de monitoreo! 🚀**

Locería Colombiana © 2026
