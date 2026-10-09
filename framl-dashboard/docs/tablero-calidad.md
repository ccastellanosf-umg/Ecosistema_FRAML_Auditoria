# Tablero de calidad de datos (Control Detectivo)

Ruta: `https://ecosistema-framl-auditoria.vercel.app/calidad`
Work item: User Story 96 — Construir la lógica visual del Control Detectivo

El tablero evalúa cada registro de `transacciones` en tres dimensiones de calidad y marca en rojo las celdas que incumplen una regla. Es un **control detectivo**: no impide que entren datos erróneos (eso lo hacen los controles preventivos de la base de datos), sino que los **detecta y los hace visibles**.

## Reglas por dimensión

| Dimensión | Pregunta | Regla | Mensaje en el tablero |
|---|---|---|---|
| Completitud | ¿Están todos los datos obligatorios? | `id_cliente`, `monto_txn`, `fecha_hora_txn`, `pais_contraparte`, `canal_tx` e `id_dispositivo` no pueden estar vacíos | Campo obligatorio vacío |
| Validez | ¿Los valores tienen sentido? | `monto_txn` mayor que 0 | El monto debe ser mayor que 0 |
| Validez | | `canal_tx` es `App móvil`, `Web` o `Cajero` | Canal no permitido |
| Validez | | `pais_contraparte` pertenece a la lista de países reconocidos | País no reconocido |
| Validez | | `id_dispositivo` sigue el formato `DEV-MOB-###`, `DEV-PC-###` o `ATM-XX-###` | Formato de dispositivo inválido |
| Validez | | `id_cliente` es un entero positivo y existe en `maestro_clientes` (*) | ID de cliente inválido / Cliente no existe en maestro_clientes |
| Validez | | `fecha_hora_txn` es una fecha válida | Fecha inválida |
| Oportunidad | ¿El dato llegó a tiempo? | `fecha_hora_txn` no está en el futuro (tolerancia de 5 minutos) | Fecha en el futuro |
| Oportunidad | | El registro se cargó como máximo 24 h después de ocurrir la transacción, y nunca antes (**) | Cargado con más de 24 h de retraso / Cargado antes de que ocurriera la transacción |

El porcentaje de cada dimensión es la proporción de registros que no incumplen ninguna regla de esa dimensión.

(*) Requiere la vista `clientes_ids` (ver abajo). Sin ella, solo se valida que el ID sea un entero positivo.
(**) Requiere la columna `fecha_carga`. Sin ella, solo se detectan fechas en el futuro.

## Pendientes en la base de datos (Ingeniero de datos 1)

```sql
-- Load timestamp for the timeliness dimension
alter table public.transacciones
  add column if not exists fecha_carga timestamptz not null default now();

-- Ids-only view so the public key can check customer existence
-- without exposing names or declared income
create or replace view public.clientes_ids
with (security_invoker = false) as
  select id_cliente from public.maestro_clientes;

grant select on public.clientes_ids to anon;
```

La vista expone **solo** `id_cliente`; `nombre_ficticio` e `ingreso_declarado` siguen sin ser accesibles con la llave pública (principio de mínimo privilegio).

## Modo demostración

`/calidad?demo=1` agrega en memoria 5 registros sintéticos con errores inyectados (IDs 9001–9005, marcados como *demo*) para mostrar cómo se ve cada regla. **No escribe nada en la base de datos.**

## Protección de datos en tránsito

La nueva ruta se sirve desde el mismo despliegue de Vercel, por lo que hereda el certificado TLS, la redirección HTTP→HTTPS y el encabezado HSTS documentados en [controles-auditoria.md](controles-auditoria.md).
