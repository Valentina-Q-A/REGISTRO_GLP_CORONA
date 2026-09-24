// ============================================
// SISTEMA DE MONITOREO - PLANTA GLP
// Locería Colombiana
// ============================================

// ============================================
// CONFIGURACIÓN SERVIDOR API
// ============================================

let ultimoRegistro = null;

let lastSyncSuccessAt = null;

let ultimaCisterna = {
    placa: null,
    capacidad: null
};

let cisternaTechnicalReferenceState = {
    lastValidReference: null,
    fetchStatus: "NOT_LOADED",
    serverReason: null,
    errorCode: null
};

let pendientesActivos = [];

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
    loadCisternaTechnicalReference();
    monitorSyncStatus();
    setInterval(
        monitorSyncStatus,
        60000
    );
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function normalizeRequiredReferenceNumber(value) {

    if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value !== "number" && typeof value !== "string")
    ) {
        return null;
    }

    let number;

    try {
        number = Number(value);
    } catch (error) {
        return null;
    }

    return Number.isFinite(number)
        ? number
        : null;
}

function normalizeRequiredReferenceText(value) {

    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    return text || null;
}

function normalizeCisternaReferenceField(
    value,
    field
) {
    if (
        field.type === "number" ||
        field.type === "range"
    ) {
        return normalizeRequiredReferenceNumber(
            value
        );
    }

    if (field.type === "text") {
        return normalizeRequiredReferenceText(
            value
        );
    }

    return null;
}

function normalizeCisternaTechnicalReference(payload) {
    const invalidResult = {
        valid: false,
        found: false,
        reference: null,
        reason: "INVALID_RESPONSE"
    };

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload.success !== true ||
        typeof payload.encontrada !== "boolean"
    ) {
        return invalidResult;
    }

    if (payload.encontrada === false) {
        if (
            payload.referencia !== null ||
            ![
                "NOT_INITIALIZED",
                "NO_COMPLETE_CISTERNA_REFERENCE"
            ].includes(payload.razon)
        ) {
            return invalidResult;
        }

        return {
            valid: true,
            found: false,
            reference: null,
            reason: payload.razon
        };
    }

    const reference =
        payload.referencia;

    if (
        !reference ||
        typeof reference !== "object" ||
        Array.isArray(reference)
    ) {
        return invalidResult;
    }

    const cisternaContract =
        buildCisternaVariableContract(
            VARIABLES
        );

    if (
        !cisternaContract ||
        cisternaContract.valid !== true ||
        !Array.isArray(
            cisternaContract.fields
        ) ||
        cisternaContract.fields.length === 0
    ) {
        return invalidResult;
    }

    const normalizedReference = {};

    for (
        const field
        of cisternaContract.fields
    ) {
        const normalizedValue =
            normalizeCisternaReferenceField(
                reference[
                    field.canonicalName
                ],
                field
            );

        if (
            field.referenceRequired === true &&
            normalizedValue === null
        ) {
            return invalidResult;
        }

        normalizedReference[
            field.canonicalName
        ] =
            normalizedValue;
    }

    const TimestampUbidots =
        normalizeRequiredReferenceNumber(
            reference.TimestampUbidots
        );

    const Fecha =
        normalizeRequiredReferenceText(
            reference.Fecha
        );

    const Hora =
        normalizeRequiredReferenceText(
            reference.Hora
        );

    if (
        TimestampUbidots === null ||
        TimestampUbidots <= 0 ||
        !Fecha ||
        !Hora
    ) {
        return invalidResult;
    }

    normalizedReference.TimestampUbidots =
        TimestampUbidots;

    normalizedReference.Fecha =
        Fecha;

    normalizedReference.Hora =
        Hora;

    return {
        valid: true,
        found: true,
        reference:
            normalizedReference,
        reason: null
    };
}

function buildCisternaCurrentMeasurement({
    data,
    contractFields,
    reusedFields = []
}) {
    const reusedSet =
        new Set(
            Array.isArray(reusedFields)
                ? reusedFields
                : []
        );

    const currentMeasurement = {};

    for (const field of contractFields) {
        currentMeasurement[
            field.canonicalName
        ] =
            reusedSet.has(
                field.canonicalName
            )
                ? null
                : data[
                    field.logicalName
                ] ?? null;
    }

    return currentMeasurement;
}

function hasCompleteCisternaReference({
    reference,
    contractFields
}) {
    if (
        !reference ||
        typeof reference !== "object" ||
        Array.isArray(reference)
    ) {
        return false;
    }

    const timestamp =
        normalizeRequiredReferenceNumber(
            reference.TimestampUbidots
        );

    const fecha =
        normalizeRequiredReferenceText(
            reference.Fecha
        );

    const hora =
        normalizeRequiredReferenceText(
            reference.Hora
        );

    if (
        timestamp === null ||
        timestamp <= 0 ||
        !fecha ||
        !hora
    ) {
        return false;
    }

    for (const field of contractFields) {
        if (
            field.referenceRequired !== true
        ) {
            continue;
        }

        const normalizedValue =
            normalizeCisternaReferenceField(
                reference[
                    field.canonicalName
                ],
                field
            );

        if (normalizedValue === null) {
            return false;
        }
    }

    return true;
}

function buildCisternaProvenanceCommand({
    data,
    sameCisterna = false,
    technicalReference = null
} = {}) {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        return {
            valid: false,
            cisternaProvenance: null,
            errorCode:
                "CISTERNA_COMMAND_DATA_INVALID"
        };
    }

    const cisternaContract =
        buildCisternaVariableContract(
            VARIABLES
        );

    if (
        !cisternaContract ||
        cisternaContract.valid !== true ||
        !Array.isArray(
            cisternaContract.fields
        ) ||
        cisternaContract.fields.length === 0
    ) {
        return {
            valid: false,
            cisternaProvenance: null,
            errorCode:
                "CISTERNA_VARIABLE_CONTRACT_INVALID"
        };
    }

    const contractFields =
        cisternaContract.fields;
    if (
        typeof data.cisterna_habilitada !==
            "boolean"
    ) {
        return {
            valid: false,
            cisternaProvenance: null,
            errorCode:
                "CISTERNA_ENABLED_STATE_INVALID"
        };
    }

    const enabled =
        data.cisterna_habilitada === true;

    if (!enabled) {
        const allCanonicalFields =
            contractFields.map(
                field =>
                    field.canonicalName
            );

        return {
            valid: true,

            cisternaProvenance: {
                protocolVersion:
                    "cisterna-provenance-v1",

                origin:
                    "ausentes",

                currentMeasurement:
                    buildCisternaCurrentMeasurement({
                        data,
                        contractFields,
                        reusedFields:
                            allCanonicalFields
                    }),

                referenceTimestamp:
                    null,

                reusedFields:
                    []
            },

            errorCode:
                null
        };
    }

    if (!sameCisterna) {
        return {
            valid: true,

            cisternaProvenance: {
                protocolVersion:
                    "cisterna-provenance-v1",

                origin:
                    "actualizados",

                currentMeasurement:
                    buildCisternaCurrentMeasurement({
                        data,
                        contractFields
                    }),

                referenceTimestamp:
                    null,

                reusedFields:
                    []
            },

            errorCode:
                null
        };
    }

    if (
        !hasCompleteCisternaReference({
            reference:
                technicalReference,

            contractFields
        })
    ) {
        return {
            valid: false,
            cisternaProvenance: null,
            errorCode:
                "CISTERNA_TECHNICAL_REFERENCE_REQUIRED"
        };
    }

    const reusedFields =
        contractFields
            .filter(field =>
                field.reuseFromLast ===
                    true
            )
            .map(field =>
                field.canonicalName
            );

    if (reusedFields.length === 0) {
        return {
            valid: false,
            cisternaProvenance: null,
            errorCode:
                "CISTERNA_REUSABLE_FIELDS_NOT_FOUND"
        };
    }

    return {
        valid: true,

        cisternaProvenance: {
            protocolVersion:
                "cisterna-provenance-v1",

            origin:
                "mixtos",

            currentMeasurement:
                buildCisternaCurrentMeasurement({
                    data,
                    contractFields,
                    reusedFields
                }),

            referenceTimestamp:
                Number(
                    technicalReference
                        .TimestampUbidots
                ),

            reusedFields
        },

        errorCode:
            null
    };
}

async function loadCisternaTechnicalReference() {

    cisternaTechnicalReferenceState.fetchStatus =
        "LOADING";

    cisternaTechnicalReferenceState.serverReason =
        null;

    cisternaTechnicalReferenceState.errorCode =
        null;

    try {
        const response = await fetch(
            "/ultima-referencia-cisterna",
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                }
            }
        );

        if (!response.ok) {
            cisternaTechnicalReferenceState.fetchStatus =
                "HTTP_ERROR";

            cisternaTechnicalReferenceState.errorCode =
                `HTTP_${response.status}`;

            return;
        }

        const normalized =
            normalizeCisternaTechnicalReference(
                await response.json()
            );

        if (!normalized.valid) {
            cisternaTechnicalReferenceState.fetchStatus =
                "INVALID_RESPONSE";

            cisternaTechnicalReferenceState.errorCode =
                "INVALID_RESPONSE";

            return;
        }

        if (!normalized.found) {
            cisternaTechnicalReferenceState.fetchStatus =
                normalized.reason;

            cisternaTechnicalReferenceState.serverReason =
                normalized.reason;

            return;
        }

        const currentReference =
            cisternaTechnicalReferenceState
                .lastValidReference;

        const currentTimestamp =
            currentReference?.TimestampUbidots;

        if (
            currentReference &&
            normalized.reference.TimestampUbidots <
                currentTimestamp
        ) {
            cisternaTechnicalReferenceState.fetchStatus =
                "STALE_REFERENCE";

            cisternaTechnicalReferenceState.errorCode =
                "STALE_REFERENCE";

            return;
        }

        if (
            !currentReference ||
            normalized.reference.TimestampUbidots >
                currentTimestamp
        ) {
            cisternaTechnicalReferenceState.lastValidReference = {
                ...normalized.reference
            };
        }

        cisternaTechnicalReferenceState.fetchStatus =
            "AVAILABLE";
    } catch (error) {
        cisternaTechnicalReferenceState.fetchStatus =
            "REQUEST_ERROR";

        cisternaTechnicalReferenceState.serverReason =
            null;

        cisternaTechnicalReferenceState.errorCode =
            "REQUEST_FAILED";
    }
}

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

    const toggle =
        document.getElementById('cisternaHabilitada');

    const fields =
        document.getElementById('cisternaFields');

    const sameToggle =
        document.getElementById('mismaCisterna');

    const sameContainer =
        document.getElementById('mismaCisternaContainer');

    const info =
        document.getElementById('ultimaCisternaInfo');
    
    const nuevaCisternaContainer =
    document.getElementById(
        'nuevaCisternaContainer'
    );

    if (!toggle || !fields) {
        return;
    }

    const inputs =
        fields.querySelectorAll('input');

    const placaInput =
        document.getElementById('placaCisterna');

    const capacidadInput =
        document.getElementById('capacidadCisterna');
    
    const placaContainer =
        placaInput.closest('.control-group');

    const capacidadContainer =
        capacidadInput.closest('.control-group');


    function updateState() {

        const enabled =
            toggle.checked;

        fields.style.display =
            enabled ? '' : 'none';

        inputs.forEach(input => {
            input.disabled = !enabled;
        });

        document.getElementById(
            'capacidadCisterna'
        ).required = enabled;

        document.getElementById(
            'placaCisterna'
        ).required = enabled;


        if (sameContainer) {

            sameContainer.style.display =
                enabled 
                    ? ''
                    : 'none';
            if (!enabled) {

                if (nuevaCisternaContainer) {
                    nuevaCisternaContainer.style.display =
                        "none";
                }

                if (info) {
                    info.style.display = "none";
                }
            }
        }

        if (!enabled) {

            if (info) {
                info.style.display = "none";
            }

            if (nuevaCisternaContainer) {
                nuevaCisternaContainer.style.display =
                    "none";
            }
        }

        updateSameCisternaState();
    }

    function updateSameCisternaState() {

        if (!sameToggle) {
            return;
        }

        const registrarNuevaCisterna =
            sameToggle.checked &&
            toggle.checked;

        const existeReferencia =
            esValorCisternaValido(
                ultimaCisterna.placa
            ) &&
            esValorCisternaValido(
                ultimaCisterna.capacidad
            );

        // ==========================
        // NUEVA CISTERNA
        // ==========================

        if (registrarNuevaCisterna) {

            if (info) {
                info.style.display = "none";
            }

            if (nuevaCisternaContainer) {
                nuevaCisternaContainer.style.display =
                    "block";
            }

            placaInput.value = "";
            capacidadInput.value = "";

            placaInput.required = true;
            capacidadInput.required = true;

            return;
        }

        // ==========================
        // REUTILIZAR REFERENCIA
        // ==========================

        if (info) {

            if (existeReferencia) {

                info.style.display = "block";

                info.innerHTML = `
                    <small>
                        Última cisterna:
                        <strong>
                            ${ultimaCisterna.placa}
                        </strong>
                        ·
                        <strong>
                            ${ultimaCisterna.capacidad} Gal
                        </strong>
                    </small>
                `;

            } else {

                info.style.display = "none";
                info.innerHTML = "";
            }
        }

        if (nuevaCisternaContainer) {
            nuevaCisternaContainer.style.display =
                "none";
        }

        if (existeReferencia) {

            placaInput.value =
                ultimaCisterna.placa;

            capacidadInput.value =
                ultimaCisterna.capacidad;

            placaInput.required = false;
            capacidadInput.required = false;

        } else {

            placaInput.value = "";
            capacidadInput.value = "";

            placaInput.required = true;
            capacidadInput.required = true;
        }
    }

    toggle.addEventListener(
        'change',
        updateState
    );


    if (sameToggle) {

        sameToggle.addEventListener(
            'change',
            updateSameCisternaState
        );
    }


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

function esValorCisternaValido(valor) {

    if (valor === null || valor === undefined) {
        return false;
    }

    if (typeof valor === "string") {

        const texto = valor.trim();

        if (!texto || texto === "0") {
            return false;
        }

        return true;
    }

    return valor !== 0;
}

function refrescarEstadoCisterna() {

    const toggle =
        document.getElementById('cisternaHabilitada');

    const sameToggle =
        document.getElementById('mismaCisterna');

    const sameContainer =
        document.getElementById('mismaCisternaContainer');

    if (
        !toggle ||
        !sameToggle ||
        !sameContainer
    ) {
        return;
    }

    const cisternaDisponible =
        esValorCisternaValido(ultimaCisterna.placa) &&
        esValorCisternaValido(ultimaCisterna.capacidad);

    sameContainer.style.display =
        toggle.checked
            ? ''
            : 'none';

    if (!cisternaDisponible) {
        sameToggle.checked = false;
    }

    toggle.dispatchEvent(new Event('change'));
}

function actualizarUltimaCisterna(registros) {

    ultimaCisterna = {
        placa: null,
        capacidad: null
    };

    if (!Array.isArray(registros)) {
        return;
    }

    // Recorrer desde el registro más reciente
    // hacia los anteriores, según el orden recibido.
    for (let i = 0; i < registros.length; i++) {

        const registro = registros[i];

        const placa = registro.PlacaCisterna;
        const capacidad = registro.CapacidadCisterna;

        if (
            esValorCisternaValido(placa) &&
            esValorCisternaValido(capacidad)
        ) {

            ultimaCisterna = {
                placa,
                capacidad
            };

            return;
        }
    }
}

function formatSummaryValue(
    value,
    unit = ""
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    return `${value}${unit}`;
}

function buildOperationalVariablesSummary(
    last
) {
    const variablesProceso =
        getVariablesByCategory(
            "proceso"
        ).filter(
            variable =>
                variable.recordGroup ===
                "Variables"
        );

    return variablesProceso
        .map(variable => {

            const value =
                last.Variables?.[
                    variable.recordField
                ];

            return `
                <div>
                    <span>
                        ${variable.label}
                    </span>

                    <strong>
                        ${formatSummaryValue(
                            value,
                            variable.unit || ""
                        )}
                    </strong>
                </div>
            `;
        })
        .join("");
}

async function updateSummary() {
    try {

        const response =
            await fetch(
                '/ultimo-registro'
            );

        if (!response.ok) {
            throw new Error(
                'No se pudo obtener el último registro'
            );
        }

        const last =
            await response.json();

        ultimoRegistro =
            last;

        if (!last) {

            document.getElementById(
                'summaryDisplay'
            ).innerHTML =
                '<p>No hay registros anteriores</p>';

            return;
        }

        const historialResponse =
            await fetch(
                '/historial'
            );

        if (historialResponse.ok) {

            const historial =
                await historialResponse.json();

            actualizarUltimaCisterna(
                historial
            );

            refrescarEstadoCisterna();
        }

        // ============================================
        // ESTADO DE OPERACIÓN
        // ============================================

        const estadoOperacion =
            ESTADOS_OPERACION[
                last.EstadoOperacion
            ] ||
            last.EstadoOperacion ||
            "";

        // ============================================
        // PENDIENTES
        // ============================================

        const pendientes =
            Array.isArray(
                last.Pendientes
            )
                ? last.Pendientes
                    .filter(
                        p => p !== "otro"
                    )
                    .map(
                        p =>
                            PENDIENTES[p] || p
                    )
                : [];

        if (
            Array.isArray(
                last.Pendientes
            ) &&
            last.Pendientes.includes(
                "otro"
            ) &&
            last.OtroPendiente
        ) {

            pendientes.push(
                last.OtroPendiente
            );
        }

        const pendientesHTML =
            pendientes.length
                ? pendientes
                    .map(
                        pendiente => `
                            <div class="pending-item">
                                ${pendiente}
                            </div>
                        `
                    )
                    .join("")
                : `
                    <div class="pending-none">
                        Sin pendientes
                    </div>
                `;

        const variablesOperacionHTML =
            buildOperationalVariablesSummary(
                last
            );

        // ============================================
        // CISTERNA
        // ============================================

        let cisternaHTML =
            "";

        if (
            last.CisternaHabilitada &&
            last.Cisterna
        ) {

            cisternaHTML =
                `
                <div class="summary-section">

                    <h4>
                        Datos de cisterna
                    </h4>

                    <div class="summary-grid">

                        <div>
                            <span>
                                Nivel cisterna
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Cisterna.Nivel,
                                    " %"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Presión cisterna
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Cisterna.Presion,
                                    " PSI"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Temperatura cisterna
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Cisterna.Temperatura,
                                    " °C"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Capacidad cisterna
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Cisterna.Capacidad
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Placa cisterna
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Cisterna.Placa
                                )}
                            </strong>
                        </div>

                    </div>

                </div>
                `;
        }

        // ============================================
        // RESUMEN
        // ============================================

        document.getElementById(
            'summaryDisplay'
        ).innerHTML =
        `
            <div class="summary-panel">

                <div class="summary-header">

                    <h3>
                        Último registro operativo
                    </h3>

                    <span>
                        ${last.Fecha || ""}
                        ·
                        ${last.Hora || ""}
                    </span>

                </div>

                <div class="summary-section">

                    <h4>
                        Estado de operación
                    </h4>

                    <div class="operation-status">
                        ${estadoOperacion}
                    </div>

                </div>

                <div class="summary-section">

                    <h4>
                        Pendientes
                    </h4>

                    <div class="pending-list">
                        ${pendientesHTML}
                    </div>

                </div>

                <div class="summary-section">

                    <h4>
                        Variables de operación
                    </h4>

                    <div class="summary-grid">
                        ${variablesOperacionHTML}
                    </div>

                </div>

                ${cisternaHTML}

                <div class="summary-section">

                    <h4>
                        Información del registro
                    </h4>

                    <div class="summary-grid">

                        <div>
                            <span>
                                Encargado
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Encargado
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Observaciones
                            </span>

                            <strong>
                                ${formatSummaryValue(
                                    last.Observaciones
                                )}
                            </strong>
                        </div>

                    </div>

                </div>

            </div>
        `;

    } catch (err) {

        console.error(
            "Error cargando último registro:",
            err
        );

        document.getElementById(
            'summaryDisplay'
        ).innerHTML =
            '<p>No se pudo cargar el último registro</p>';
    }
}

async function monitorSyncStatus() {

    try {

        const response =
            await fetch(
                "/sync-status",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            return;
        }

        const status =
            await response.json();

        const currentSuccessAt =
            status.lastSuccessAt || null;

        if (!currentSuccessAt) {
            return;
        }

        if (
            lastSyncSuccessAt === null
        ) {

            lastSyncSuccessAt =
                currentSuccessAt;

            return;
        }

        if (
            currentSuccessAt !==
            lastSyncSuccessAt
        ) {

            console.log(
                "[SYNC] nueva sincronización detectada"
            );

            lastSyncSuccessAt =
                currentSuccessAt;

            await updateSummary();

            if (
                ultimoRegistro
            ) {

                const hasComparison =
                    document
                        .querySelector(
                            ".comparativo-table"
                        );

                if (hasComparison) {
                    mostrarComparativo();
                }
            }
        }

    } catch (error) {

        console.error(
            "Error monitoreando sync-status:",
            error
        );
    }
}

function mostrarComparativo() {

    if (!ultimoRegistro) {
        return;
    }

    const variables =
        getVariablesByCategory(
            "proceso"
        ).filter(
            variable =>
                variable.field !==
                "capacidadCisterna"
        );

    const filas = variables.map(variable => {

        const input = document.getElementById(variable.field);
        const actual = input ? input.value : "";
        const anterior = ultimoRegistro.Variables?.[variable.excelField] ?? "";
        const actualNumero = parseFloat(actual);
        const anteriorNumero = parseFloat(anterior);

        let diferencia = "-";
        let claseCambio = "";

        const actualDisplay =
            formatSummaryValue(
                actual,
                variable.unit || ""
            );

        const anteriorDisplay =
            formatSummaryValue(
                anterior,
                variable.unit || ""
            );

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
        }else if (
            !isNaN(actualNumero) &&
            (anterior === "" ||
            anterior === null ||
            anterior === undefined)
        ) {

            diferencia = "Nuevo";

            claseCambio =
                "change-positive";
        }

        return `
            <tr>
                <td>${variable.label}</td>

                <td>
                    ${actualDisplay}
                </td>

                <td>
                    ${anteriorDisplay}
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


function refreshControlsDisplay() {

    controls.forEach(variable => {

        const input =
            document.getElementById(variable.field);

        const span =
            document.getElementById(variable.valueDisplay);

        if (!input || !span) {
            return;
        }

        const unit =
            variable.unit || "";

        span.textContent =
            input.value + unit;

        validarRango(input);
    });
}


function resetForm() {

    // Restablecer todas las variables según su configuración
    resetVariables();

    // Fecha y hora actuales
    setCurrentDateTime();

    // Actualizar valores mostrados de los controles numéricos
    refreshControlsDisplay();

    // Restablecer comportamiento de cisterna
    const cisternaToggle =
        document.getElementById('cisternaHabilitada');

    if (cisternaToggle) {
        cisternaToggle.dispatchEvent(
            new Event('change')
        );
    }

    // Restablecer comportamiento de problemas
    const problemaSelect =
        document.getElementById('problemaReportado');

    if (problemaSelect) {
        problemaSelect.dispatchEvent(
            new Event('change')
        );
    }

    // Restablecer comportamiento de "Otro problema"
    const problemaOtro =
        document.getElementById('problemaOtro');

    if (problemaOtro) {
        problemaOtro.dispatchEvent(
            new Event('change')
        );
    }

    // Restablecer resolución de pendientes
    const pendienteResuelto =
        document.getElementById('pendienteResuelto');

    if (pendienteResuelto) {
        pendienteResuelto.dispatchEvent(
            new Event('change')
        );
    }

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

        // Actualizar fecha y hora justo antes de guardar
        setCurrentDateTime();

        // Validar campo obligatorio
        const encargado =
            document.getElementById('encargado')
                .value
                .trim();

        if (!encargado) {
            showAlert(
                'El campo ENCARGADO es obligatorio',
                'error'
            );
            return;
        }

        const data =
            collectFormData();

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

    const select =
        document.getElementById('pendienteResuelto');

    const container =
        document.getElementById('pendientesResolverContainer');

    const list =
        document.getElementById('pendientesResolverList');

    if (!select || !container || !list) {
        return;
    }

    async function updateState() {

        const enabled =
            select.value === "true";

        container.style.display =
            enabled ? '' : 'none';

        if (!enabled) {
            list.innerHTML = '';
            return;
        }

        await cargarPendientesActivos();

        if (pendientesActivos.length === 0) {

            list.innerHTML =
                '<p>No hay pendientes activos para resolver.</p>';

            return;
        }

        list.innerHTML =
            pendientesActivos
                .map(pendiente => `
                    <label>
                        <input
                            type="checkbox"
                            name="pendientesResolver"
                            value="${pendiente.ID}"
                        >
                        ${pendiente.Descripcion}
                    </label>
                `)
                .join('');
    }

    select.addEventListener(
        'change',
        updateState
    );

    updateState();
}

async function cargarPendientesActivos() {

    try {

        const response =
            await fetch('/pendientes');

        if (!response.ok) {
            throw new Error(
                'No se pudieron obtener los pendientes'
            );
        }

        const pendientes =
            await response.json();

        console.log(
            "RESPUESTA /pendientes:",
            pendientes
        );

        pendientesActivos =
            Array.isArray(pendientes)
                ? pendientes
                : [];

        console.log(
            "PENDIENTES ACTIVOS:",
            pendientesActivos
        );

        console.log(
            "CANTIDAD:",
            pendientesActivos.length
        );

    } catch (error) {

        console.error(
            'Error cargando pendientes activos:',
            error
        );

        pendientesActivos = [];
    }
}

async function savePendings(pendings) {

    if (!Array.isArray(pendings) || pendings.length === 0) {
        return [];
    }

    const saved = [];

    for (const pending of pendings) {

        console.log(
            "PENDIENTE QUE SE ENVÍA AL SERVIDOR:",
            JSON.stringify(pending, null, 2)
        );

        const response = await fetch("/pendientes", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(pending)
        });

        const result = await response.json();

        console.log(
            "RESPUESTA DEL SERVIDOR AL GUARDAR PENDIENTE:",
            result
        );

        if (!response.ok) {
            throw new Error(
                result.message || "Error guardando pendiente"
            );
        }

        saved.push(result.pendiente);
    }

    return saved;
}

async function resolverPendientes(ids, fecha, encargado) {

    if (!Array.isArray(ids) || ids.length === 0) {
        return null;
    }

    const response = await fetch(
        "/pendientes/resolver",
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ids,
                fecha,
                encargado
            })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.message ||
            "Error resolviendo pendientes"
        );
    }

    return result;
}

function collectFormData() {

    const variables = readVariables();

    const pendientes = variables.pendientes || [];

    delete variables.pendientes;

    const data = {
        Fecha: document.getElementById('fecha').value,
        Hora: document.getElementById('hora').value,

        ...variables,

        pendientes
    };

    return normalizarDatosCisterna(data);
}

function normalizarDatosCisterna(data) {

    const habilitada =
        data.cisterna_habilitada === true;

    // ============================================
    // CISTERNA DESHABILITADA
    // ============================================

    if (!habilitada) {

        for (const [name, variable] of Object.entries(VARIABLES)) {

            if (
                variable.dependsOn === "cisterna_habilitada"
            ) {
                data[name] = null;
            }
        }

        return data;
    }

    // ============================================
    // ¿REGISTRAR NUEVA CISTERNA?
    // ============================================

    const nuevaCisternaToggle =
        document.getElementById(
            "mismaCisterna"
        );

    const registrarNuevaCisterna =
        nuevaCisternaToggle?.checked === true;

    // ============================================
    // NUEVA CISTERNA
    // ============================================

    if (registrarNuevaCisterna) {
        return data;
    }

    // ============================================
    // REUTILIZAR ÚLTIMA CISTERNA
    // ============================================

    for (const [name, variable] of Object.entries(VARIABLES)) {

        if (!variable.reuseFromLast) {
            continue;
        }

        const source =
            name.replace("_cisterna", "");

        const valorAnterior =
            ultimaCisterna[source];

        if (
            esValorCisternaValido(
                valorAnterior
            )
        ) {
            data[name] = valorAnterior;
        }
    }

    return data;
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

                console.log(
                    "OTRO - descriptionField:",
                    option.descriptionField
                );

                console.log(
                    "OTRO - input encontrado:",
                    input
                );

                console.log(
                    "OTRO - valor:",
                    input?.value
                );

                description =
                    input?.value.trim() || "";
            }

            console.log(
                "PENDIENTE ANTES DE createPending:",
                {
                    type,
                    description
                }
            );

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

async function syncUbidots(data) {

    const response =
        await fetch(
            "/sync-ubidots",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(data)
            }
        );

    const result =
        await response.json();

    return {
        success:
            response.ok,

        ...result
    };
}

async function saveData(data) {

    const record = buildRecord(data);
    const pendings = buildPendingRecords(data);

    const pendientesResueltos =
        Array.from(
            document.querySelectorAll(
                'input[name="pendientesResolver"]:checked'
            )
        ).map(input => input.value);

    console.log(
        "Pendientes seleccionados para resolver:",
        pendientesResueltos
    );

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

        console.log("DATA COMPLETA ANTES DE RESOLVER:", data);
        console.log("FECHA PARA RESOLUCIÓN:", data.Fecha);
        console.log("ENCARGADO PARA RESOLUCIÓN:", data.encargado);
        console.log("PENDIENTES A RESOLVER:", pendientesResueltos);

        const resolvedPendings =
            await resolverPendientes(
                pendientesResueltos,
                data.Fecha,
                data.encargado
            );

        console.log(
            "Pendientes resueltos:",
            resolvedPendings
        );

        const ubidotsResult =
            await syncUbidots(data);

        console.log(
            "Sincronización con Ubidots:",
            ubidotsResult
        );

        if (
            ubidotsResult?.success === true
        ) {

            showAlert(
                "Registro enviado exitosamente",
                "success",
                6000
            );

        } else {

            showAlert(
                "El envío quedó pendiente.\nSerá reintentado automáticamente.",
                "warning",
                10000
            );
        }

        // Actualizar el resumen local inmediatamente
        updateSummaryLocal(record);
        // Actualiza la hora inmediatamente
        setCurrentDateTime();

        return result;

    } catch (error) {
        console.error("Error guardando registro:", error);
        showAlert(
            "No fue posible guardar el registro.\nIntente nuevamente.",
            "error",
            12000
        );
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


function showAlert(
    message,
    type = 'info',
    duration = 6000
) {
    // Crear elemento de alerta personalizado
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.innerHTML =
    message.replace(/\n/g, "<br>");
    
    // Estilos inline para la alerta
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: ${
            type === 'success'
                ? '#4CAF50'
                : type === 'warning'
                    ? '#ff9800'
                    : '#f44336'
        };
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(alertDiv);
    
    // Remover después de la duración especificada
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => alertDiv.remove(), 300);
    }, duration);
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
// EXPORTAR FUNCIONES 
// ============================================

//acceder a estas funciones desde la consola del navegador
window.appFunctions = {
    updateSummary,
    resetForm,
    collectFormData,
    buildRecord
};

function abrirHistorico(){
    window.open("/historial.html","_blank");
}
