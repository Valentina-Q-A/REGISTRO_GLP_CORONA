(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))r(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&r(d)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const l=[{id:"nivelTanque",span:"nivelTanqueValue",unit:"%"},{id:"presionTanque",span:"presionTanqueValue",unit:" PSI"},{id:"tempTanque",span:"tempTanqueValue",unit:" °C"},{id:"nivelCisterna",span:"nivelCisternaValue",unit:"%"},{id:"presionBomba",span:"presionBombaValue",unit:" PSI"},{id:"tempVapor",span:"tempVaporValue",unit:" °C"},{id:"presionVapor",span:"presionVaporValue",unit:" PSI"},{id:"presionMezcla",span:"presionMezclaValue",unit:" PSI"}];document.addEventListener("DOMContentLoaded",function(){g(),u(),s(),f()});function g(){l.forEach(t=>{const e=document.getElementById(t.id),n=document.getElementById(t.span);e&&n&&(n.textContent=e.value+t.unit,e.addEventListener("input",()=>{n.textContent=e.value+t.unit,c(e)}),c(e))})}function c(t){const e=parseFloat(t.min),n=parseFloat(t.max),r=parseFloat(t.value);if(t.value===""){t.classList.remove("input-error");return}!isNaN(e)&&r<e||!isNaN(n)&&r>n?t.classList.add("input-error"):t.classList.remove("input-error")}function u(){const t=new Date,e=t.getFullYear(),n=String(t.getMonth()+1).padStart(2,"0"),r=String(t.getDate()).padStart(2,"0");document.getElementById("fecha").value=`${e}-${n}-${r}`;const a=String(t.getHours()).padStart(2,"0"),o=String(t.getMinutes()).padStart(2,"0");document.getElementById("hora").value=`${a}:${o}`}async function s(){try{const t=await fetch("http://LJDCOLORADO:3000/ultimo-registro");if(!t.ok)throw new Error("No se pudo obtener el último registro");const e=await t.json(),n=document.getElementById("summaryDisplay");if(!e){n.innerHTML=`
                <div class="summary-item">
                    <label>Sin registros aún</label>
                    <div class="value">---</div>
                </div>
            `;return}n.innerHTML=`

        <!-- ===================== -->
        <!-- PANEL OPERATIVO -->
        <!-- ===================== -->
        
        </div>


        <!-- ===================== -->
        <!-- TABLA REGISTRO -->
        <!-- ===================== -->

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
                        <td>${e.Fecha||""}</td>
                        <td>${e.Hora||""}</td>
                        <td>${e.NivelTanque||""}</td>
                        <td>${e.PresionTanque||""}</td>
                        <td>${e.TempTanque||""}</td>
                        <td>${e.NivelCisterna||""}</td>
                        <td>${e.CapacidadCisterna||""}</td>
                        <td>${e.PlacaCisterna||""}</td>
                        <td>${e.PresionBomba||""}</td>
                        <td>${e.TempVapor||""}</td>
                        <td>${e.PresionVapor||""}</td>
                        <td>${e.PresionMezcla||""}</td>
                        <td>${e.Observaciones||""}</td>
                        <td>${e.Encargado||""}</td>
                        <td>${e.FechaServidor||""}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        `}catch(t){console.error("Error cargando resumen:",t)}}function f(){document.getElementById("glpForm").addEventListener("submit",async function(e){if(e.preventDefault(),!document.getElementById("encargado").value.trim()){i("El campo ENCARGADO es obligatorio","error");return}const r=m();await y(r)})}function m(){return{Fecha:document.getElementById("fecha").value,Hora:document.getElementById("hora").value,NivelTanque:document.getElementById("nivelTanque").value,PresionTanque:document.getElementById("presionTanque").value,TempTanque:document.getElementById("tempTanque").value,NivelCisterna:document.getElementById("nivelCisterna").value,CapacidadCisterna:document.getElementById("capacidadCisterna").value,PlacaCisterna:document.getElementById("placaCisterna").value,PresionBomba:document.getElementById("presionBomba").value,TempVapor:document.getElementById("tempVapor").value,PresionVapor:document.getElementById("presionVapor").value,PresionMezcla:document.getElementById("presionMezcla").value,Observaciones:document.getElementById("observaciones").value,Encargado:document.getElementById("encargado").value.trim()}}async function y(t){try{const e=await fetch("http://LJDCOLORADO:3000/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(e.ok)i("✓ Registro guardado exitosamente en Excel","success"),p(),s();else{const n=await e.text();i("Error al guardar el registro: "+n,"error")}}catch(e){console.error("Error de conexión:",e),i("Error de conexión con el servidor. Verifique que el servidor esté corriendo.","error")}}function p(){document.getElementById("glpForm"),document.getElementById("capacidadCisterna").value="",document.getElementById("placaCisterna").value="",document.getElementById("observaciones").value="",document.getElementById("encargado").value="",u(),l.forEach(t=>{const e=document.getElementById(t.id),n=document.getElementById(t.span);e&&n&&(n.textContent=e.value+t.unit)}),s()}function i(t,e="info"){const n=document.createElement("div");n.className=`custom-alert alert-${e}`,n.textContent=t,n.style.cssText=`
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: ${e==="success"?"#4CAF50":"#f44336"};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `,document.body.appendChild(n),setTimeout(()=>{n.style.animation="slideOut 0.3s ease-out",setTimeout(()=>n.remove(),300)},4e3)}const h=document.createElement("style");h.textContent=`
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
`;document.head.appendChild(h);async function v(){try{if((await fetch("http://LJDCOLORADO:3000/health")).ok)return console.log("✓ Conexión con servidor establecida"),!0}catch(t){return console.error("✗ No se puede conectar con el servidor:",t),!1}}v();window.appFunctions={updateSummary:s,resetForm:p,collectFormData:m,testServerConnection:v};
