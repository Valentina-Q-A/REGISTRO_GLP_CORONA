# Configuraciones del proyecto GLP

Archivos incluidos:

- `config-auditoria-glp.js`: conecta el motor genérico de auditoría con `js/variables.js`.
- `config-conciliacion-glp.js`: define hojas, clave, normalización y exclusión documentada del registro de prueba.

La configuración de depuración no se incluye todavía porque sus reglas deben aprobarse antes de ejecutarse.

## Auditoría

```powershell
node scripts/auditar-base.js `
  --entrada=registros-conciliados.xlsx `
  --config=scripts/config-auditoria-glp.js `
  --salida=auditoria-registros-conciliados.xlsx `
  --json=hallazgos `
  --limite=20
```

## Conciliación

```powershell
node scripts/conciliar-bases.js `
  --principal=registros.xlsx `
  --secundaria=registros-LJDCOLORADO.xlsx `
  --config=scripts/config-conciliacion-glp.js `
  --salida=registros-conciliados.xlsx `
  --reporte=reporte-conciliacion.xlsx `
  --json=hallazgos `
  --limite=20
```
