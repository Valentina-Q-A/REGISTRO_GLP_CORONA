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

let ultimoRegistro = null;

// Configuración de controles y sus valores
const controls = getVariablesByCategory("proceso");

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeControls();
    initializeCisterna();
    initializeProblemas();
    initializeOtroProblema();
    initializeResolucionPendientes();
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
                mostrarComparativo();
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

    try {

        const response = await fetch('/ultimo-registro');

        if (!response.ok) {
            throw new Error('No se pudo obtener el último registro');
        }

        const last = await response.json();

        ultimoRegistro = last;

        if (!last) {
            document.getElementById('summaryDisplay').innerHTML =
                '<p>No hay registros anteriores</p>';
            return;
        }

        // ============================================
        // TRADUCIR ESTADO DE OPERACIÓN
        // ============================================

        const estadoOperacion =
            ESTADOS_OPERACION[last.EstadoOperacion] ||
            last.EstadoOperacion ||
            "";

        // ============================================
        // PENDIENTES
        // ============================================

        const pendientes = Array.isArray(last.Pendientes)
            ? last.Pendientes
                .filter(p => p !== "otro")
                .map(p => PENDIENTES[p] || p)
                    : [];
        if (
            Array.isArray(last.Pendientes) &&
            last.Pendientes.includes("otro") &&
            last.OtroPendiente
        ) {
            pendientes.push(last.OtroPendiente);
        }

        const pendientesHTML = pendientes.length
            ? pendientes
                .map(p => `<div class="pending-item">${p}</div>`)
                .join("")
            : `<div class="pending-none">Sin pendientes</div>`;

        // ============================================
        // CISTERNA
        // ============================================

        let cisternaHTML = "";

        if (last.CisternaHabilitada && last.Cisterna) {

            cisternaHTML = `
                <div class="summary-section">

                    <h4>Datos de cisterna</h4>

                    <div class="summary-grid">

                        <div>
                            <span>Nivel cisterna</span>
                            <strong>${last.Cisterna.Nivel ?? ""} %</strong>
                        </div>

                        <div>
                            <span>Presión cisterna</span>
                            <strong>${last.Cisterna.Presion ?? ""} PSI</strong>
                        </div>

                        <div>
                            <span>Temperatura cisterna</span>
                            <strong>${last.Cisterna.Temperatura ?? ""} °C</strong>
                        </div>

                        <div>
                            <span>Capacidad cisterna</span>
                            <strong>${last.Cisterna.Capacidad ?? ""}</strong>
                        </div>

                        <div>
                            <span>Placa cisterna</span>
                            <strong>${last.Cisterna.Placa ?? ""}</strong>
                        </div>

                    </div>

                </div>
            `;

        }

        // ============================================
        // RESUMEN
        // ============================================

        document.getElementById('summaryDisplay').innerHTML = `

            <div class="summary-panel">

                <div class="summary-header">

                    <h3>Último registro</h3>

                    <span>
                        ${last.Fecha || ""} · ${last.Hora || ""}
                    </span>

                </div>

                <!-- ESTADO -->

                <div class="summary-section">

                    <h4>Estado de operación</h4>

                    <div class="operation-status">
                        ${estadoOperacion}
                    </div>

                </div>

                <!-- PENDIENTES -->

                <div class="summary-section">

                    <h4>Pendientes</h4>

                    <div class="pending-list">
                        ${pendientesHTML}
                    </div>

                </div>

                <!-- VARIABLES PRINCIPALES -->

                <div class="summary-section">

                    <h4>Variables de operación</h4>

                    <div class="summary-grid">

                        <div>
                            <span>Nivel tanque</span>
                            <strong>
                                ${last.Variables?.NivelTanque ?? ""} %
                            </strong>
                        </div>

                        <div>
                            <span>Presión tanque</span>
                            <strong>
                                ${last.Variables?.PresionTanque ?? ""} PSI
                            </strong>
                        </div>

                        <div>
                            <span>Temperatura tanque</span>
                            <strong>
                                ${last.Variables?.TempTanque ?? ""} °C
                            </strong>
                        </div>

                        <div>
                            <span>Presión bomba</span>
                            <strong>
                                ${last.Variables?.PresionBomba ?? ""} PSI
                            </strong>
                        </div>

                        <div>
                            <span>Temperatura vapor</span>
                            <strong>
                                ${last.Variables?.TempVapor ?? ""} °C
                            </strong>
                        </div>

                        <div>
                            <span>Presión vapor</span>
                            <strong>
                                ${last.Variables?.PresionVapor ?? ""} PSI
                            </strong>
                        </div>

                        <div>
                            <span>Presión mezcla</span>
                            <strong>
                                ${last.Variables?.PresionMezcla ?? ""} PSI
                            </strong>
                        </div>

                    </div>

                </div>

                <!-- CISTERNA -->

                ${cisternaHTML}

                <!-- INFORMACIÓN DEL REGISTRO -->

                <div class="summary-section">

                    <h4>Información del registro</h4>

                    <div class="summary-grid">

                        <div>
                            <span>Encargado</span>
                            <strong>
                                ${last.Encargado || ""}
                            </strong>
                        </div>

                        <div>
                            <span>Observaciones</span>
                            <strong>
                                ${last.Observaciones || ""}
                            </strong>
                        </div>

                    </div>

                </div>

            </div>
        `;

    } catch (err) {

        console.error("Error cargando último registro:", err);

        document.getElementById('summaryDisplay').innerHTML =
            '<p>No se pudo cargar el último registro</p>';
    }
}

function mostrarComparativo() {

    if (!ultimoRegistro) {
        return;
    }

    const variables = getVariablesByCategory("proceso");

    const filas = variables.map(variable => {

        const input = document.getElementById(variable.field);
        const actual = input ? input.value : "";
        const anterior = ultimoRegistro.Variables?.[variable.excelField] ?? "";
        const actualNumero = parseFloat(actual);
        const anteriorNumero = parseFloat(anterior);

        let diferencia = "";
        let claseCambio = "";

        if (!isNaN(actualNumero) && !isNaN(anteriorNumero)) {

            const cambio = actualNumero - anteriorNumero;

            if (cambio > 0) {
                diferencia = `+${cambio}`;
                claseCambio = "change-positive";
            } else if (cambio < 0) {
                diferencia = `${cambio}`;
                claseCambio = "change-negative";
            } else {
                diferencia = "0";
                claseCambio = "change-neutral";
            }
        }

        return `
            <tr>
                <td>${variable.label}</td>

                <td>
                    ${actual} ${variable.unit}
                </td>

                <td>
                    ${anterior} ${variable.unit}
                </td>

                <td class="${claseCambio}">
                    ${diferencia} ${variable.unit}
                </td>
            </tr>
        `;

    }).join("");

    document.getElementById("summaryDisplay").innerHTML = `

        <div class="summary-panel">

            <div class="summary-header">

                <h3>Comparación con último registro</h3>

                <span>
                    ${ultimoRegistro.Fecha || ""} ·
                    ${ultimoRegistro.Hora || ""}
                </span>

            </div>

            <div class="summary-section">

                <div class="table-container">

                    <table class="registro-table comparativo-table">

                        <thead>
                            <tr>
                                <th>Variable</th>
                                <th>Actual</th>
                                <th>Último registro</th>
                                <th>Cambio</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${filas}
                        </tbody>

                    </table>

                </div>

            </div>

        </div>
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

function initializeProblemas() {

    const select = document.getElementById('problemaReportado');
    const container = document.getElementById('problemasContainer');

    if (!select || !container) {
        return;
    }

    function updateState() {

        const enabled = select.value === "true";

        container.style.display = enabled ? '' : 'none';

        if (!enabled) {

            const checkboxes = container.querySelectorAll(
                'input[name="problemas"]'
            );

            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });

            const otroInput =
                document.getElementById('otroProblema');

            if (otroInput) {
                otroInput.value = '';
                otroInput.disabled = true;
            }

            const otroContainer =
                document.getElementById('otroProblemaContainer');

            if (otroContainer) {
                otroContainer.style.display = 'none';
            }
        }
    }

    select.addEventListener('change', updateState);

    updateState();
}

function initializeOtroProblema() {

    const checkbox =
        document.getElementById('problemaOtro');

    const container =
        document.getElementById('otroProblemaContainer');

    const input =
        document.getElementById('otroProblema');

    if (!checkbox || !container || !input) {
        return;
    }

    function updateState() {

        const enabled = checkbox.checked;

        container.style.display =
            enabled ? '' : 'none';

        input.disabled = !enabled;
        input.required = enabled;

        if (!enabled) {
            input.value = '';
        }
    }

    checkbox.addEventListener('change', updateState);

    updateState();
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

function initializeResolucionPendientes() {

    const select = document.getElementById('pendienteResuelto');
    const container = document.getElementById('pendientesResolverContainer');
    const list = document.getElementById('pendientesResolverList');

    if (!select || !container || !list) {
        return;
    }

    function updateState() {

        const enabled = select.value === "true";

        container.style.display = enabled ? '' : 'none';

        if (!enabled) {
            list.innerHTML = '';
            return;
        }

        cargarPendientesParaResolver();
    }

    select.addEventListener('change', updateState);

    updateState();
}

async function cargarPendientesParaResolver() {

    const list = document.getElementById('pendientesResolverList');

    if (!list) {
        return;
    }

    list.innerHTML = '<p>Cargando pendientes...</p>';

    try {

        const response = await fetch('/pendientes');

        if (!response.ok) {
            throw new Error('No se pudieron obtener los pendientes');
        }

        const pendientes = await response.json();

        if (!Array.isArray(pendientes) || pendientes.length === 0) {

            list.innerHTML =
                '<p>No hay pendientes activos para resolver.</p>';

            return;
        }

        list.innerHTML = pendientes.map(pending => `

            <label>
                <input
                    type="checkbox"
                    name="pendientesResolver"
                    value="${pending.id}"
                >
                ${pending.description}
            </label>

        `).join('');

    } catch (err) {

        console.error(
            'Error cargando pendientes para resolver:',
            err
        );

        list.innerHTML =
            '<p>No se pudieron cargar los pendientes.</p>';
    }
}

async function savePendings(pendings) {

    if (!Array.isArray(pendings) || pendings.length === 0) {
        return [];
    }

    const saved = [];

    for (const pending of pendings) {

        const response = await fetch("/pendientes", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(pending)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Error guardando pendiente"
            );
        }

        saved.push(result.pendiente);
    }

    return saved;
}

function collectFormData() {

    const variables = readVariables();

    const pendientes = variables.pendientes || [];

    delete variables.pendientes;

    return {
        Fecha: document.getElementById('fecha').value,
        Hora: document.getElementById('hora').value,

        ...variables,

        pendientes
    };
}

function buildPendingRecords(data) {

    const config = VARIABLES.pendientes;

    if (!config) {
        return [];
    }

    const selectedTypes = data.pendientes || [];

    return selectedTypes
        .map(type => {

            const option = config.options?.find(
                option => option.value === type
            );

            if (!option) {
                return null;
            }

            let description = null;

            if (option.descriptionField) {

                const input =
                    document.getElementById(
                        option.descriptionField
                    );

                description =
                    input?.value.trim() || "";
            }

            return createPending(
                type,
                description
            );
        })
        .filter(Boolean);
}

function buildRecord(data) {

    const recordGroups = buildRecordGroups(data);

    return {
        Fecha: data.Fecha,
        Hora: data.Hora,

        ...recordGroups
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

    const payload = {};

    for (const [name, variable] of Object.entries(VARIABLES)) {

        if (!variable.ubidots?.variableId) {
            continue;
        }

        if (!(name in data)) {
            continue;
        }

        const value = data[name];

        if (value === "" || value === null || value === undefined) {
            continue;
        }

        let ubidotsValue = value;

        if (variable.type === "number") {
            ubidotsValue = Number(value);

            if (!Number.isFinite(ubidotsValue)) {
                console.warn(
                    `Valor no numérico para "${name}":`,
                    value
                );
                continue;
            }
        }

        payload[name] = {
            value: ubidotsValue
        };
    }

    return payload;
}

async function saveData(data) {

    const record = buildRecord(data);
    const pendings = buildPendingRecords(data);

    console.log("Registro preparado:", record);
    console.log("Pendientes preparados:", pendings);

    try {
        const response = await fetch("/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(record)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Error guardando el registro");
        }

        console.log("Registro guardado:", result);
        const savedPendings = await savePendings(pendings);

        console.log(
            "Pendientes guardados:",
            savedPendings
        );

        showAlert("Registro guardado correctamente", "success");

        // Actualizar el resumen local inmediatamente
        updateSummaryLocal(record);

        return result;

    } catch (error) {
        console.error("Error guardando registro:", error);
        showAlert("Error guardando el registro", "error");

        throw error;
    }
}
// ============================================
// FUNCIONES AUXILIARES
// ============================================
function updateSummaryLocal(data) {

    // Después de guardar, el registro recién creado
    // pasa a ser el último registro.
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
    testServerConnection,
    buildPayload,
    buildRecord
};

function abrirHistorico(){
    window.open("https://Valentina-Q-A.github.io/REGISTRO_GLP_CORONA/historial.html","_blank")
}

 
