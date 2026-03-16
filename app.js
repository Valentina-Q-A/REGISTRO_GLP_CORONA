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
    try {
        const TOKEN = "BBUS-9TxsD2zFJdsZHGHnhVbtafa8LU37rA";
        const DEVICE = "planta-glp";

        const response = await fetch(
            `https://industrial.api.ubidots.com/api/v1.6/devices/${DEVICE}/?token=${TOKEN}`
        );

        const data = await response.json();

        const summaryDisplay = document.getElementById('summaryDisplay');

        if (!data) {
            summaryDisplay.innerHTML = "<p>Sin registros aún</p>";
            return;
        }

        // Mostrar tabla con todas las variables
        summaryDisplay.innerHTML = `
        <div style="overflow-x:auto;">
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
                        <th>FechaServidor</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${new Date(data.fecha.value).toLocaleDateString() || ''}</td>
                        <td>${new Date(data.hora.value).toLocaleTimeString() || ''}</td>
                        <td>${data.nivel_tanque.value || ''}</td>
                        <td>${data.presion_tanque.value || ''}</td>
                        <td>${data.temp_tanque.value || ''}</td>
                        <td>${data.nivel_cisterna.value || ''}</td>
                        <td>${data.capacidad_cisterna.value || ''}</td>
                        <td>${data.placa_cisterna.value || ''}</td>
                        <td>${data.presion_bomba.value || ''}</td>
                        <td>${data.temp_vapor.value || ''}</td>
                        <td>${data.presion_vapor.value || ''}</td>
                        <td>${data.presion_mezcla.value || ''}</td>
                        <td>${data.observaciones.value || ''}</td>
                        <td>${data.encargado.value || ''}</td>
                        <td>${new Date(data.fecha_servidor.value).toLocaleString() || ''}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        `;
    } catch (err) {
        console.error("Error cargando resumen:", err);
    }
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
    fecha: { value: data.Fecha },
    hora: { value: data.Hora },
    nivel_tanque: { value: Number(data.NivelTanque) },
    presion_tanque: { value: Number(data.PresionTanque) },
    temp_tanque: { value: Number(data.TempTanque) },
    nivel_cisterna: { value: Number(data.NivelCisterna) },
    capacidad_cisterna: { value: data.CapacidadCisterna },
    placa_cisterna: { value: data.PlacaCisterna },
    presion_bomba: { value: Number(data.PresionBomba) },
    temp_vapor: { value: Number(data.TempVapor) },
    presion_vapor: { value: Number(data.PresionVapor) },
    presion_mezcla: { value: Number(data.PresionMezcla) },
    observaciones: { value: data.Observaciones },
    encargado: { value: data.Encargado },
    fecha_servidor: { value: new Date().toISOString() }
})
}
);

if(response.ok){

showAlert("Registro enviado a Ubidots", "success");

}else{

showAlert("Error enviando datos", "error");

}

}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

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
