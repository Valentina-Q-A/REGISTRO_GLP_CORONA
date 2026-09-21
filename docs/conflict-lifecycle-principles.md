# Principios del Conflict Lifecycle

## Fuente de verdad

Ubidots es la fuente de verdad operacional.

El Conflict Lifecycle no reemplaza la historia recuperada desde Ubidots.

---

## No pérdida de información

Ningún conflicto debe provocar eliminación automática de registros.

Toda evidencia debe permanecer disponible para auditoría.

---

## Separación de responsabilidades

### Conflict Registry

Responsable de:

- Detectar conflictos.
- Registrar conflictos.
- Administrar estados.
- Administrar revisiones.

### Resolution Engine

Responsable de:

- Consumir resoluciones aprobadas.
- Aplicar resoluciones durante la reconstrucción.

### Repositorios de registros

Responsables de:

- Persistir registros reconstruidos.

No deben conocer el detalle del ciclo de vida del conflicto.

---

## Estados del ciclo de vida

DETECTED

↓

UNDER_REVIEW

↓

RESOLVED

↓

APPROVED

↓

PROMOTED

↓

EXPORTED

↓

CONSUMED

---

## Regla de sincronización

La existencia de conflictos no debe impedir:

- Recuperar historial.
- Reconstruir historial.
- Detectar nuevos registros.
- Detectar nuevos conflictos.

Los conflictos pendientes deben permanecer aislados hasta que exista una resolución aprobada.