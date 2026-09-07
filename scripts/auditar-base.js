"use strict";

// Motor genérico de auditoría de archivos Excel.
// Uso:
// node scripts/auditar-base.js --entrada=datos.xlsx --config=scripts/config-auditoria.js
// Opciones: --salida=reporte.xlsx --hoja=Datos --json=resumen|hallazgos|completo|ninguno --limite=20

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function args(argv) {
  const o = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const p=a.slice(2).split(/=(.*)/s); o[p[0].toLowerCase()]=p[1]===undefined?"true":p[1];
  }
  return o;
}
function ayuda(){console.log(`
Uso:
  node scripts/auditar-base.js --entrada=<xlsx> [--config=<js>] [opciones]
Opciones:
  --salida=<xlsx> --hoja=<nombre>
  --json=resumen|hallazgos|completo|ninguno --limite=<n>
  --ayuda
El config es opcional. Sin config audita estructura, vacíos y duplicados por todas las columnas.
`)}
const o=args(process.argv.slice(2));
if(o.ayuda==="true"||o.help==="true"){ayuda();process.exit(0)}
if(!o.entrada){ayuda();process.exit(1)}
const entrada=path.resolve(process.cwd(),o.entrada);
if(!fs.existsSync(entrada)) throw new Error(`No existe: ${entrada}`);
let config={};
if(o.config){const rc=path.resolve(process.cwd(),o.config);if(!fs.existsSync(rc))throw new Error(`No existe config: ${rc}`);config=require(rc);}
const hojaNombre=o.hoja||config.hoja;
const salida=path.resolve(process.cwd(),o.salida||`auditoria-${path.basename(entrada,path.extname(entrada))}.xlsx`);
const modo=(o.json||"resumen").toLowerCase();
if(!["resumen","hallazgos","completo","ninguno"].includes(modo))throw new Error("Modo JSON inválido");
const limite=Number(o.limite??20);if(!Number.isInteger(limite)||limite<0)throw new Error("Límite inválido");

const vacio=v=>v===null||v===undefined||(typeof v==="string"&&v.trim()==="");
const texto=v=>vacio(v)?"":String(v).trim().replace(/\s+/g," ");
const numero=v=>typeof v==="number"&&Number.isFinite(v)?v:(typeof v==="string"&&v.trim()&&Number.isFinite(Number(v.trim().replace(",",".")))?Number(v.trim().replace(",",".")):null);
const fecha=v=>{if(vacio(v))return"";if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:""}const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:s};
const hora=v=>{if(vacio(v))return"";if(typeof v==="number"){let s=Math.round((v-Math.floor(v))*86400);s=((s%86400)+86400)%86400;return[Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(x=>String(x).padStart(2,"0")).join(":")}const t=String(v).trim();const ap=t.match(/^(\d{1,2})[.:](\d{2})\s*(am|pm)$/i);if(ap){let h=+ap[1];if(ap[3].toLowerCase()==="am"&&h===12)h=0;if(ap[3].toLowerCase()==="pm"&&h!==12)h+=12;return`${String(h).padStart(2,"0")}:${ap[2]}:00`}const m=t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);return m?`${m[1].padStart(2,"0")}:${m[2].padStart(2,"0")}:${String(m[3]||0).padStart(2,"0")}`:t};
const utilidades={vacio,texto,numero,fecha,hora};
const norm=(v,t)=>t==="fecha"?fecha(v):t==="hora"?hora(v):t==="numero"?numero(v):t==="texto"?texto(v):t==="texto-minusculas"?texto(v).toLowerCase():v;
const comparable=v=>{if(vacio(v))return"V:";const n=numero(v);return n!==null?`N:${n}`:`T:${texto(v).toLowerCase()}`};

const wb=XLSX.readFile(entrada,{cellDates:false});
const hoja=hojaNombre||wb.SheetNames[0];if(!wb.Sheets[hoja])throw new Error(`No existe hoja: ${hoja}`);
const rows=XLSX.utils.sheet_to_json(wb.Sheets[hoja],{defval:null,raw:true});
const columnas=[...new Set(rows.flatMap(r=>Object.keys(r)))];
const esperadas=config.columnasEsperadas||[];
const faltantes=esperadas.filter(c=>!columnas.includes(c));
const adicionales=columnas.filter(c=>esperadas.length&&!esperadas.includes(c));
const claveCampos=config.clave||columnas;
function copiaNormal(r){const x={...r};for(const[c,t]of Object.entries(config.normalizadores||{}))x[c]=typeof t==="function"?t({valor:x[c],registro:x,utilidades}):norm(x[c],t);return x}
const items=rows.map((r,i)=>({fila:i+2,registro:copiaNormal(r)}));
const clave=r=>typeof config.construirClave==="function"?String(config.construirClave({registro:r,utilidades})):claveCampos.map(c=>comparable(r[c])).join("|");
const camposVacios=[];for(const i of items)for(const c of config.camposObligatorios||[])if(vacio(i.registro[c]))camposVacios.push({Fila:i.fila,Clave:clave(i.registro),Campo:c});
const noNumericos=[],fueraRango=[],estadisticas=[];
for(const[c,regla]of Object.entries(config.camposNumericos||{})){const vals=[];let vac=0,inv=0,fuera=0;for(const i of items){const v=i.registro[c];if(vacio(v)){vac++;continue}const n=numero(v);if(n===null){inv++;noNumericos.push({Fila:i.fila,Clave:clave(i.registro),Campo:c,Valor:v});continue}vals.push(n);const mal=(regla.minimo!==undefined&&n<regla.minimo)||(regla.maximo!==undefined&&n>regla.maximo);if(mal){fuera++;fueraRango.push({Fila:i.fila,Clave:clave(i.registro),Campo:c,Valor:n,Minimo:regla.minimo??null,Maximo:regla.maximo??null})}}estadisticas.push({Campo:c,Validos:vals.length,Vacios:vac,NoNumericos:inv,FueraRango:fuera,Minimo:vals.length?Math.min(...vals):null,Maximo:vals.length?Math.max(...vals):null,Promedio:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null})}
const grupos=new Map();for(const i of items){const k=clave(i.registro);if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(i)}
const duplicadosExactos=[],duplicadosDiferentes=[],diferencias=[];
for(const[k,g]of grupos){if(g.length<2)continue;const firmas=g.map(i=>columnas.map(c=>`${c}=${comparable(i.registro[c])}`).join("||"));const exacto=new Set(firmas).size===1;for(const i of g)(exacto?duplicadosExactos:duplicadosDiferentes).push({Clave:k,Fila:i.fila,Cantidad:g.length});if(!exacto)for(let j=1;j<g.length;j++)for(const c of columnas)if(comparable(g[0].registro[c])!==comparable(g[j].registro[c]))diferencias.push({Clave:k,FilaReferencia:g[0].fila,FilaComparada:g[j].fila,Campo:c,ValorReferencia:g[0].registro[c],ValorComparado:g[j].registro[c]})}
const validaciones=[];for(const i of items)for(const v of config.validaciones||[]){const ok=v.validar({registro:i.registro,fila:i.fila,clave:clave(i.registro),utilidades});if(!ok)validaciones.push({Fila:i.fila,Clave:clave(i.registro),Regla:v.id||null,Severidad:v.severidad||"advertencia",Campo:v.campo||null,Mensaje:typeof v.mensaje==="function"?v.mensaje({registro:i.registro,utilidades}):(v.mensaje||"Validación no superada")})}
const resumen={archivo:path.basename(entrada),hoja,totalRegistros:rows.length,clavesUnicas:grupos.size,gruposDuplicados:[...grupos.values()].filter(g=>g.length>1).length,filasDuplicadas:duplicadosExactos.length+duplicadosDiferentes.length,valoresNoNumericos:noNumericos.length,valoresFueraRango:fueraRango.length,camposObligatoriosVacios:camposVacios.length,validacionesNoSuperadas:validaciones.length,columnasEncontradas:columnas.length,columnasFaltantes:faltantes.length,columnasAdicionales:adicionales.length};
const resultado={metadatos:{fechaISO:new Date().toISOString(),entrada,salida,config:o.config?path.resolve(process.cwd(),o.config):null,originalModificado:false},resumen,estructura:{columnas,columnasEsperadas:esperadas,columnasFaltantes:faltantes,columnasAdicionales:adicionales},hallazgos:{duplicadosExactos,duplicadosDiferentes,diferencias,camposVacios,noNumericos,fueraRango,validaciones},estadisticas};
function hojaOut(libro,nombre,datos){const d=datos.length?datos:[{Resultado:"Sin hallazgos"}];const ws=XLSX.utils.json_to_sheet(d);XLSX.utils.book_append_sheet(libro,ws,nombre)}
const out=XLSX.utils.book_new();hojaOut(out,"Resumen",Object.entries(resumen).map(([Indicador,Valor])=>({Indicador,Valor})));hojaOut(out,"DuplicadosExactos",duplicadosExactos);hojaOut(out,"DuplicadosDiferentes",duplicadosDiferentes);hojaOut(out,"Diferencias",diferencias);hojaOut(out,"CamposVacios",camposVacios);hojaOut(out,"NoNumericos",noNumericos);hojaOut(out,"FueraRango",fueraRango);hojaOut(out,"Validaciones",validaciones);hojaOut(out,"Estadisticas",estadisticas);XLSX.writeFile(out,salida);
const limita=v=>Array.isArray(v)&&limite&&v.length>limite?{total:v.length,mostrados:limite,omitidos:v.length-limite,elementos:v.slice(0,limite)}:Array.isArray(v)?v:(v&&typeof v==="object"?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,limita(x)])):v);
let consola=null;if(modo==="resumen")consola={metadatos:resultado.metadatos,resumen,estructura:resultado.estructura};if(modo==="hallazgos")consola=limita({...resultado,estadisticas:undefined});if(modo==="completo")consola=limita(resultado);
console.log("\nAUDITORÍA FINALIZADA",resumen);console.log(`Reporte: ${salida}`);if(consola){console.log("\n================ INICIO JSON ================");console.log(JSON.stringify(consola,null,2));console.log("================= FIN JSON =================")}
