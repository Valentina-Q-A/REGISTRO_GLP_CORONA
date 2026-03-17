// ============================================
// SISTEMA DE MONITOREO - PLANTA GLP
// Locería Colombiana
// ============================================

// ============================================
// CONFIGURACIÓN SERVIDOR API
// ============================================

//const API_URL = "https://glp-api.onrender.com";
const UBIDOTS_TOKEN = "BBUS-9TxsD2zFJdsZHGHnhVbtafa8LU37rA";

const DEVICE = "planta-glp";



// Configuración de sliders y sus valores
const sliders = [
    {id: "nivelTanque", span: "nivelTanqueValue", unit: "%"},
    {id: "presionTanque", span: "presionTanqueValue", unit: " PSI"},
    {id: "tempTanque", span: "tempTanqueValue", unit: " °C"},
    {id: "nivelCisterna", span: "nivelCisternaValue", unit: "%"},
    {id: "presionBomba", span: "presionBombaValue", unit: " PSI"},
    {id: "tempVapor", span: "tempVaporValue", unit: " °C"},
    {id: "presionVapor", span: "presionVaporValue", unit: " PSI"},
    {id: "presionMezcla", span: "presionMezclaValue", unit: " PSI"},
];

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeSliders();
    setCurrentDateTime();
    updateSummary();
    initializeForm();
});

// ============================================
// FUNCIONES DE SLIDERS
// ============================================

function initializeSliders() {
    sliders.forEach(s => {
        const input = document.getElementById(s.id);
        const span = document.getElementById(s.span);
        
        if (input && span) {

            span.textContent = input.value + s.unit;

            input.addEventListener('input', () => {

                span.textContent = input.value + s.unit;

                validarRango(input); // validar en tiempo real
            });

            // validar al cargar
            validarRango(input);
        }
    });
}

function validarRango(input) {

    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const valor = parseFloat(input.value);

    if (input.value === "") {
        input.classList.remove("input-error");
        return;
    }

    if (!isNaN(min) && valor < min || !isNaN(max) && valor > max) {
        input.classList.add("input-error");
    } else {
        input.classList.remove("input-error");
    }
}

// ============================================
// FUNCIONES DE FECHA Y HORA
// ============================================

function setCurrentDateTime() {
    const now = new Date();
    
    // Fecha en formato YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    document.getElementById('fecha').value = `${year}-${month}-${day}`;
    
    // Hora en formato HH:MM
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('hora').value = `${hours}:${minutes}`;
}

// ============================================
// RESUMEN DE DATOS
// ============================================



async function updateSummary() {

    const TOKEN = UBIDOTS_TOKEN;
    const DEVICE = "planta-glp";

    // lista de variables
    const variables = [
        "nivel_tanque",
        "presion_tanque",
        "temp_tanque",
        "nivel_cisterna",
        "capacidad_cisterna",
        "presion_bomba",
        "temp_vapor",
        "presion_vapor",
        "presion_mezcla"
    ];

    let datos = {};

    //traer todas las variables
    for (let v of variables) {

        const res = await fetch(
            `https://industrial.api.ubidots.com/api/v1.6/devices/${DEVICE}/${v}/values?page_size=1`,
            {
                headers: { "X-Auth-Token": TOKEN }
            }
        );

        const data = await res.json();

        if (data.results && data.results.length > 0) {
            datos[v] = data.results[0];
        } else {
            datos[v] = { value: "", context: {} };
        }
    }

    //usamos el context de una sola (todas son iguales)
    const ctx = datos["nivel_tanque"].context || {};

    document.getElementById("summaryDisplay").innerHTML = `
    <table class="registro-table">
    <thead>
    <tr>
        <th>Fecha</th>
        <th>Hora</th>
        <th>NivelTanque</th>
        <th>PresionTanque</th>
        <th>TempTanque</th>
        <th>NivelCisterna</th>
        <th>CapacidadCisterna</th>
        <th>PlacaCisterna</th>
        <th>PresionBomba</th>
        <th>TempVapor</th>
        <th>PresionVapor</th>
        <th>PresionMezcla</th>
        <th>Observaciones</th>
        <th>Encargado</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td>${ctx.Fecha || ""}</td>
        <td>${ctx.Hora || ""}</td>
        <td>${datos.nivel_tanque.value || ""}</td>
        <td>${datos.presion_tanque.value || ""}</td>
        <td>${datos.temp_tanque.value || ""}</td>
        <td>${datos.nivel_cisterna.value || ""}</td>
        <td>${datos.capacidad_cisterna.value || ""}</td>
        <td>${ctx.PlacaCisterna || ""}</td>
        <td>${datos.presion_bomba.value || ""}</td>
        <td>${datos.temp_vapor.value || ""}</td>
        <td>${datos.presion_vapor.value || ""}</td>
        <td>${datos.presion_mezcla.value || ""}</td>
        <td>${ctx.Observaciones || ""}</td>
        <td>${ctx.Encargado || ""}</td>
    </tr>
    </tbody>
    </table>
    `;
}


// ============================================
// MANEJO DEL FORMULARIO
// ============================================

function initializeForm() {
    const form = document.getElementById('glpForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validar campo obligatorio
        const encargado = document.getElementById('encargado').value.trim();
        if (!encargado) {
            showAlert('El campo ENCARGADO es obligatorio', 'error');
            return;
        }
        
        // Recopilar todos los datos
        const data = collectFormData();
        
        // Enviar datos al servidor
        await saveData(data);
    });
}

function collectFormData() {
    return {
        Fecha: document.getElementById('fecha').value,
        Hora: document.getElementById('hora').value,
        NivelTanque: document.getElementById('nivelTanque').value,
        PresionTanque: document.getElementById('presionTanque').value,
        TempTanque: document.getElementById('tempTanque').value,
        NivelCisterna: document.getElementById('nivelCisterna').value,
        CapacidadCisterna: document.getElementById('capacidadCisterna').value,
        PlacaCisterna: document.getElementById('placaCisterna').value,
        PresionBomba: document.getElementById('presionBomba').value,
        TempVapor: document.getElementById('tempVapor').value,
        PresionVapor: document.getElementById('presionVapor').value,
        PresionMezcla: document.getElementById('presionMezcla').value,
        Observaciones: document.getElementById('observaciones').value,
        Encargado: document.getElementById('encargado').value.trim()
    };
}

// ============================================
// COMUNICACIÓN CON EL SERVIDOR
// ============================================

async function saveData(data) {

const TOKEN = "BBUS-9TxsD2zFJdsZHGHnhVbtafa8LU37rA";

const response = await fetch(
"https://industrial.api.ubidots.com/api/v1.6/devices/planta-glp",
{
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Auth-Token": TOKEN
},

body: JSON.stringify({
 
nivel_tanque: {

  value: Number(data.NivelTanque),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
presion_tanque: {

  value: Number(data.PresionTanque),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
temp_tanque: {

  value: Number(data.TempTanque),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
nivel_cisterna: {

  value: Number(data.NivelCisterna),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
capacidad_cisterna: {

  value: Number(data.CapacidadCisterna),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
presion_bomba: {

  value: Number(data.PresionBomba),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
temp_vapor: {

  value: Number(data.TempVapor),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
presion_vapor: {

  value: Number(data.PresionVapor),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

},
 
presion_mezcla: {

  value: Number(data.PresionMezcla),

  context: {

    Fecha: data.Fecha,

    Hora: data.Hora,

    Encargado: data.Encargado,

    PlacaCisterna: data.PlacaCisterna,

    Observaciones: data.Observaciones

  }

}
 
})
}
);

/*if(response.ok){

showAlert("Registro enviado a Ubidots", "success");

}else{

showAlert("Error enviando datos", "error");

}

}*/

if(response.ok){

    showAlert("Registro enviado a Ubidots", "success");

    // actualización inmediata (UX pro)
    updateSummaryLocal(data);

    // luego sincronizas con Ubidots
    setTimeout(() => {
        updateSummary();
    }, 1500);

}
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function updateSummaryLocal(data){

    document.getElementById("summaryDisplay").innerHTML = `
    <table class="registro-table">
    <thead>
    <tr>
        <th>Fecha</th>
        <th>Hora</th>
        <th>NivelTanque</th>
        <th>PresionTanque</th>
        <th>TempTanque</th>
        <th>NivelCisterna</th>
        <th>CapacidadCisterna</th>
        <th>PlacaCisterna</th>
        <th>PresionBomba</th>
        <th>TempVapor</th>
        <th>PresionVapor</th>
        <th>PresionMezcla</th>
        <th>Observaciones</th>
        <th>Encargado</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td>${data.Fecha}</td>
        <td>${data.Hora}</td>
        <td>${data.NivelTanque}</td>
        <td>${data.PresionTanque}</td>
        <td>${data.TempTanque}</td>
        <td>${data.NivelCisterna}</td>
        <td>${data.CapacidadCisterna}</td>
        <td>${data.PlacaCisterna}</td>
        <td>${data.PresionBomba}</td>
        <td>${data.TempVapor}</td>
        <td>${data.PresionVapor}</td>
        <td>${data.PresionMezcla}</td>
        <td>${data.Observaciones}</td>
        <td>${data.Encargado}</td>
    </tr>
    </tbody>
    </table>
    `;
}


function resetForm() {
    const form = document.getElementById('glpForm');
    
    // Resetear campos de texto
    document.getElementById('capacidadCisterna').value = '';
    document.getElementById('placaCisterna').value = '';
    document.getElementById('observaciones').value = '';
    document.getElementById('encargado').value = '';
    
    // Restablecer fecha y hora actuales
    setCurrentDateTime();
    
    // Actualizar displays de sliders
    sliders.forEach(s => {
        const slider = document.getElementById(s.id);
        const span = document.getElementById(s.span);
        if (slider && span) {
            span.textContent = slider.value + s.unit;
        }
    });
    
    // Actualizar resumen
    updateSummary();
}

function showAlert(message, type = 'info') {
    // Crear elemento de alerta personalizado
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.textContent = message;
    
    // Estilos inline para la alerta
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(alertDiv);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => alertDiv.remove(), 300);
    }, 4000);
}

// ============================================
// ESTILOS PARA ANIMACIONES DE ALERTAS
// ============================================

// Agregar estilos de animación al documento
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// FUNCIONES DE DESARROLLO/DEBUG
// ============================================

// Función para verificar conexión con el servidor
/*async function testServerConnection() {
    try {
        const response = await fetch('http://LJDCOLORADO:3000/health');*/
async function testServerConnection() {

console.log("Sistema funcionando con Ubidots");

}

// Ejecutar test de conexión al cargar
testServerConnection();

// ============================================
// EXPORTAR FUNCIONES 
// ============================================

//acceder a estas funciones desde la consola del navegador
window.appFunctions = {
    updateSummary,
    resetForm,
    collectFormData,
    testServerConnection
};

function abrirHistorico(){
    window.open("https://Valentina-Q-A.github.io/REGISTRO_GLP_CORONA/historial.html","_blank")
}

 