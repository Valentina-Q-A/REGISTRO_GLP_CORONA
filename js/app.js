// ============================================
// SISTEMA DE MONITOREO - PLANTA GLP
// Locería Colombiana
// ============================================

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
        const slider = document.getElementById(s.id);
        const span = document.getElementById(s.span);
        
        if (slider && span) {
            // Actualizar valor inicial
            span.textContent = slider.value + s.unit;
            
            // Listener para cambios en tiempo real
            slider.addEventListener('input', () => {
                span.textContent = slider.value + s.unit;
                updateSummary();
            });
        }
    });
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

function updateSummary() {
    const summaryData = [
        {label: "Nivel Tanque", value: document.getElementById('nivelTanque').value + "%"},
        {label: "Presión Tanque", value: document.getElementById('presionTanque').value + " PSI"},
        {label: "Temp Tanque", value: document.getElementById('tempTanque').value + " °C"},
        {label: "Nivel Cisterna", value: document.getElementById('nivelCisterna').value + "%"},
        {label: "Presión Bomba", value: document.getElementById('presionBomba').value + " PSI"},
        {label: "Temp Vapor", value: document.getElementById('tempVapor').value + " °C"},
        {label: "Presión Vapor", value: document.getElementById('presionVapor').value + " PSI"},
        {label: "Presión Mezcla", value: document.getElementById('presionMezcla').value + " PSI"},
    ];
    
    const summaryDisplay = document.getElementById('summaryDisplay');
    summaryDisplay.innerHTML = summaryData.map(item => `
        <div class="summary-item">
            <label>${item.label}</label>
            <div class="value">${item.value}</div>
        </div>
    `).join('');
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
    try {
        const response = await fetch('http://172.20.121.80:3000/save', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert('✓ Registro guardado exitosamente en Excel', 'success');
            resetForm();
        } else {
            const errorText = await response.text();
            showAlert('Error al guardar el registro: ' + errorText, 'error');
        }
    } catch(err) {
        console.error('Error de conexión:', err);
        showAlert('Error de conexión con el servidor. Verifique que el servidor esté corriendo.', 'error');
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
async function testServerConnection() {
    try {
        const response = await fetch('http://172.20.121.80:3000/health');
        if (response.ok) {
            console.log('✓ Conexión con servidor establecida');
            return true;
        }
    } catch(err) {
        console.error('✗ No se puede conectar con el servidor:', err);
        return false;
    }
}

// Ejecutar test de conexión al cargar
testServerConnection();

// ============================================
// EXPORTAR FUNCIONES (opcional)
// ============================================

// Si necesitas acceder a estas funciones desde la consola del navegador
window.appFunctions = {
    updateSummary,
    resetForm,
    collectFormData,
    testServerConnection
};
