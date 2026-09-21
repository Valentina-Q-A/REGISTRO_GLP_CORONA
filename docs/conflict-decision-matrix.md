# Matriz de Decisión de Conflictos

## Principio Fundamental

La existencia de conflictos no debe impedir la sincronización.

Los conflictos detectados deben aislarse dentro del Conflict Lifecycle hasta que exista una resolución aprobada.

Mientras un conflicto permanezca sin resolver:

- No se pierde información.
- No se elimina evidencia.
- No se detiene la reconstrucción histórica.
- No se bloquea la sincronización completa.
- Únicamente los registros afectados permanecen pendientes de decisión.

---

## KEEP_BOTH_DISTINCT_EVENTS

### Descripción

Dos registros con la misma clave operacional representan eventos reales diferentes.

### Acción

- Conservar ambos registros.
- Permitir que ambos hagan parte del historial operativo.

### Ejemplo

2026-09-09 | 20:10:00

---

## KEEP_LAST_DECLARATION

### Descripción

La declaración más reciente representa el estado final correcto.

### Acción

- Conservar el último registro.
- Descartar el anterior para efectos operativos.

### Ejemplo

2026-09-12 | 19:30:00

---

## KEEP_FIRST_DECLARATION

### Descripción

La declaración inicial es válida y la posterior fue una corrección errónea o un duplicado.

### Acción

- Conservar el primer registro.
- Ignorar el posterior.

---

## MANUAL_CORRECTION_REQUIRED

### Descripción

No existe información suficiente para determinar una resolución automática.

### Acción

- Mantener el conflicto abierto.
- Esperar decisión operacional.

### Efecto sobre la sincronización

No bloquea la sincronización.

---

## INVALID_OPERATIONAL_EVENT

### Descripción

El evento incumple reglas operativas o presenta información inconsistente.

### Acción

- Mantener el conflicto abierto.
- Requiere validación operacional.

### Efecto sobre la sincronización

No bloquea la sincronización.