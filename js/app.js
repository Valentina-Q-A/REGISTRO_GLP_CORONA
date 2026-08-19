// ============================================
// SISTEMA DE MONITOREO - PLANTA GLP
// Locería Colombiana
// ============================================

// ============================================
// CONFIGURACIÓN SERVIDOR API
// ============================================

//const API_URL = "https://glp-api.onrender.com";
const UBIDOTS_TOKEN = "BBUS-etSh1XzuTj9VZAJIuZLswp9CPxFBTM";

const DEVICE = "planta-glp";


// Configuración de controles y sus valores
const controls = [
    VARIABLES.nivel_tanque,
    VARIABLES.presion_tanque,
    VARIABLES.temp_tanque,
    VARIABLES.nivel_cisterna,
    VARIABLES.presion_cisterna,
    VARIABLES.temp_cisterna,
    VARIABLES.presion_bomba,
    VARIABLES.temp_vapor,
    VARIABLES.presion_vapor,
    VARIABLES.presion_mezcla,
];

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeControls();
    initializeCisterna();
    initializeOtroPendiente();
    setCurrentDateTime();
    updateSummary();
    initializeForm();
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function initializeControls() {
    controls.forEach(s => {

        const isCentralized = Boolean(s.field);

        const field = isCentralized ? s.field : s.id;
        const valueDisplay = isCentralized ? s.valueDisplay : s.span;
        const unit = s.unit || "";

        const input = document.getElementById(field);
        const span = document.getElementById(valueDisplay);

        if (input && span) {

            // Aplicar configuración centralizada
            if (isCentralized) {
                input.min = s.min;
                input.max = s.max;
                input.step = s.step;
                input.value = s.defaultValue;
            }

            span.textContent = input.value + unit;

            input.addEventListener('input', () => {
                span.textContent = input.value + unit;
                validarRango(input);
            });

            // Validar al cargar
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

function initializeCisterna() {

    const toggle = document.getElementById('cisternaHabilitada');
    const fields = document.getElementById('cisternaFields');

    if (!toggle || !fields) {
        return;
    }

    const inputs = fields.querySelectorAll('input');

    function updateState() {

        const enabled = toggle.checked;

        fields.style.display = enabled ? '' : 'none';
        inputs.forEach(input => {
            input.disabled = !enabled;
        });

        document.getElementById('capacidadCisterna').required = enabled;
        document.getElementById('placaCisterna').required = enabled;
    }

    toggle.addEventListener('change', updateState);

    // Estado inicial
    updateState();
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
    // lista de variables
    const variables = [
        "nivel_tanque",
        "presion_tanque",
        "temp_tanque",
        "nivel_cisterna",
        "presion_cisterna",
        "temp_cisterna",
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
        <th>PresionCisterna</th>
        <th>TempCisterna</th>
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
        <td>${datos.presion_cisterna.value || ""}</td>
        <td>${datos.temp_cisterna.value || ""}</td>
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

function resetForm() {
    const form = document.getElementById('glpForm');

    // Resetear campos de texto
    document.getElementById('capacidadCisterna').value = '';
    document.getElementById('placaCisterna').value = '';
    document.getElementById('observaciones').value = '';
    document.getElementById('encargado').value = '';

    // Restablecer fecha y hora actuales
    setCurrentDateTime();

    // Restablecer controles numéricos
    controls.forEach(s => {

        const isCentralized = Boolean(s.field);

        const field = isCentralized ? s.field : s.id;
        const valueDisplay = isCentralized ? s.valueDisplay : s.span;
        const unit = s.unit || "";

        const input = document.getElementById(field);
        const span = document.getElementById(valueDisplay);

        if (input && span) {

            if (isCentralized) {
                input.value = s.defaultValue;
            }

            span.textContent = input.value + unit;
            validarRango(input);
        }
    });

    // Actualizar resumen
    updateSummary();
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

function initializeOtroPendiente() {

    const checkbox = document.getElementById('pendienteOtro');
    const container = document.getElementById('otroPendienteContainer');
    const input = document.getElementById('otroPendiente');

    if (!checkbox || !container || !input) {
        return;
    }

    function updateState() {

        const enabled = checkbox.checked;

        container.style.display = enabled ? '' : 'none';
        input.disabled = !enabled;
        input.required = enabled;

        if (!enabled) {
            input.value = '';
        }
    }

    checkbox.addEventListener('change', updateState);

    // Estado inicial
    updateState();
}

function collectFormData() {
    const pendientes = Array.from(
        document.querySelectorAll('input[name="pendientes"]:checked')
        ).map(input => input.value);
    const otroPendiente = document.getElementById('otroPendiente').value.trim();

    return {
        Fecha: document.getElementById('fecha').value,
        Hora: document.getElementById('hora').value,
        CisternaHabilitada: document.getElementById('cisternaHabilitada').checked,
        EstadoOperacion: document.getElementById('estadoOperacion').value,
        Pendientes: pendientes,
        OtroPendiente: otroPendiente,
        NivelTanque: document.getElementById('nivelTanque').value,
        PresionTanque: document.getElementById('presionTanque').value,
        TempTanque: document.getElementById('tempTanque').value,
        NivelCisterna: document.getElementById('nivelCisterna').value,
        PresionCisterna: document.getElementById('presionCisterna').value,
        TempCisterna: document.getElementById('tempCisterna').value,
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

function createVariablePayload(value, data) {
    return {
        value: Number(value),
        context: {
            Fecha: data.Fecha,
            Hora: data.Hora,
            Encargado: data.Encargado,
            PlacaCisterna: data.PlacaCisterna,
            Observaciones: data.Observaciones
        }
    };
}

function buildPayload(data) {
    const payload = {
        nivel_tanque:
            createVariablePayload(data.NivelTanque, data),

        presion_tanque:
            createVariablePayload(data.PresionTanque, data),

        temp_tanque:
            createVariablePayload(data.TempTanque, data),

        presion_bomba:
            createVariablePayload(data.PresionBomba, data),

        temp_vapor:
            createVariablePayload(data.TempVapor, data),

        presion_vapor:
            createVariablePayload(data.PresionVapor, data),

        presion_mezcla:
            createVariablePayload(data.PresionMezcla, data)
    };

    if (data.CisternaHabilitada) {
        payload.nivel_cisterna =
            createVariablePayload(data.NivelCisterna, data);

        payload.presion_cisterna =
            createVariablePayload(data.PresionCisterna, data);

        payload.temp_cisterna =
            createVariablePayload(data.TempCisterna, data);

        payload.capacidad_cisterna =
            createVariablePayload(data.CapacidadCisterna, data);
    }

    return payload;
}

async function saveData(data) {
    const payload = buildPayload(data);

    console.log("Payload preparado:", payload);

    /*
    const response = await fetch(
    `https://industrial.api.ubidots.com/api/v1.6/devices/${DEVICE}`,
    {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": UBIDOTS_TOKEN
    },

    body: JSON.stringify(payload)

    }
);
*/

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
    return payload;
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
        <th>PresionCisterna</th>
        <th>TempCisterna</th>
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
        <td>${data.PresionCisterna}</td>
        <td>${data.TempCisterna}</td>
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
    testServerConnection,
    buildPayload
};

function abrirHistorico(){
    window.open("https://Valentina-Q-A.github.io/REGISTRO_GLP_CORONA/historial.html","_blank")
}

 
