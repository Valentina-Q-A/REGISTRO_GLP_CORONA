// Actualizar valores de sliders
const sliders = [
    {id: "nivelTanque", span: "nivelTanqueValue", unit: "%"},
    {id: "presionTanque", span: "presionTanqueValue", unit: "PSI"},
    {id: "tempTanque", span: "tempTanqueValue", unit: "°C"},
    {id: "nivelCisterna", span: "nivelCisternaValue", unit: "%"},
    {id: "presionBomba", span: "presionBombaValue", unit: "PSI"},
    {id: "tempVapor", span: "tempVaporValue", unit: "°C"},
    {id: "presionVapor", span: "presionVaporValue", unit: "PSI"},
    {id: "presionMezcla", span: "presionMezclaValue", unit: "PSI"},
];

sliders.forEach(s => {
    const slider = document.getElementById(s.id);
    const span = document.getElementById(s.span);
    slider.addEventListener('input', () => {
        span.textContent = slider.value + " " + s.unit;
    });
});

// Envío de formulario
document.getElementById("glpForm").addEventListener("submit", async function(e){
    e.preventDefault();

    const encargado = document.getElementById("encargado").value.trim();
    if(!encargado){
        alert("El campo ENCARGADO es obligatorio");
        return;
    }

    const data = {
        Fecha: document.getElementById("fecha").value,
        Hora: document.getElementById("hora").value,
        NivelTanque: document.getElementById("nivelTanque").value,
        PresionTanque: document.getElementById("presionTanque").value,
        TempTanque: document.getElementById("tempTanque").value,
        NivelCisterna: document.getElementById("nivelCisterna").value,
        CapacidadCisterna: document.getElementById("capacidadCisterna").value,
        PlacaCisterna: document.getElementById("placaCisterna").value,
        PresionBomba: document.getElementById("presionBomba").value,
        TempVapor: document.getElementById("tempVapor").value,
        PresionVapor: document.getElementById("presionVapor").value,
        PresionMezcla: document.getElementById("presionMezcla").value,
        Observaciones: document.getElementById("observaciones").value,
        Encargado: encargado
    };

    try {
        const response = await fetch("/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if(response.ok){
            alert("Registro guardado localmente con éxito");
            document.getElementById("glpForm").reset();
            sliders.forEach(s => {
                const slider = document.getElementById(s.id);
                const span = document.getElementById(s.span);
                span.textContent = slider.value + " " + s.unit;
            });
        } else {
            alert("Error al guardar el registro");
        }
    } catch(err) {
        console.error(err);
        alert("Error de conexión con backend");
    }
});