# Tablero de calidad de datos (Control Detectivo)

Ruta: `https://ecosistema-framl-auditoria.vercel.app/calidad`
Work item: User Story 96 — Construir la lógica visual del Control Detectivo

El tablero evalúa cada registro de `transacciones` en tres dimensiones de calidad y marca en rojo las celdas que incumplen una regla. Es un **control detectivo**: no impide que entren datos erróneos (eso lo hacen los controles preventivos de la base de datos), sino que los **detecta y los hace visibles**.

## Reglas por dimensión

| Dimensión | Pregunta | Regla | Mensaje en el tablero |
|---|---|---|---|
| Completitud | ¿Están todos los datos obligatorios? | `id_cliente`, `monto_txn`, `fecha_hora_txn`, `pais_contraparte` y `canal_tx` no pueden estar vacíos | Campo obligatorio vacío |
| Completitud | | `id_dispositivo` es obligatorio solo en los canales `App móvil` y `Web`; puede ser nulo en `Cajero`. Si el canal está vacío o no es válido, la regla no se evalúa (DIS-01) | Dispositivo obligatorio en canales digitales |
| Validez | ¿Los valores tienen sentido? | `monto_txn` mayor que 0 | El monto debe ser mayor que 0 |
| Validez | | `canal_tx` es `App móvil`, `Web` o `Cajero` | Canal no permitido |
| Validez | | `pais_contraparte` pertenece a la lista de países reconocidos | País no reconocido |
| Validez | | `id_dispositivo` sigue el formato `DEV-MOB-###`, `DEV-PC-###` o `ATM-XX-###` | Formato de dispositivo inválido |
| Validez | | `id_cliente` es un entero positivo y existe en `maestro_clientes` (*) | ID de cliente inválido / Cliente no existe en maestro_clientes |
| Validez | | `fecha_hora_txn` es una fecha válida | Fecha inválida |
| Validez | | `fecha_hora_txn` no es posterior a `fecha_carga`; si el registro no tiene `fecha_carga`, no es posterior a la hora actual (tolerancia de 5 minutos) (FEC-02) | Fecha posterior a la fecha de carga / Fecha en el futuro |
| Oportunidad | ¿El dato llegó a tiempo? | El registro se cargó como máximo 24 h después de ocurrir la transacción (**) (FEC-03) | Cargado con más de 24 h de retraso |

El porcentaje de cada dimensión es la proporción de registros que no incumplen ninguna regla de esa dimensión.

(*) Requiere la vista `clientes_ids` (ver abajo). Sin ella, solo se valida que el ID sea un entero positivo.
(**) Requiere la columna `fecha_carga`. Los registros sin `fecha_carga` se consideran **carga histórica** y no se evalúan en oportunidad, como indica la ficha FEC-03. El plazo de 24 h está pendiente de alinear con la ficha, que indica 15 minutos (revisión D-06).

## Pendientes en la base de datos (Ingeniero de datos 1)

```sql
-- Load timestamp for the timeliness dimension.
-- 1) Add the column WITHOUT a default: existing rows keep NULL and are treated
--    as a historical load. Adding it with "default now()" would stamp them with
--    the moment the ALTER runs, and timeliness of real data would drop to 0%.
alter table public.transacciones
  add column if not exists fecha_carga timestamptz;

-- 2) From now on, new rows get their load time automatically.
alter table public.transacciones
  alter column fecha_carga set default now();

-- Ids-only view so the public key can check customer existence
-- without exposing names or declared income
create or replace view public.clientes_ids
with (security_invoker = false) as
  select id_cliente from public.maestro_clientes;

grant select on public.clientes_ids to anon;
```

La vista expone **solo** `id_cliente`; `nombre_ficticio` e `ingreso_declarado` siguen sin ser accesibles con la llave pública (principio de mínimo privilegio).

## Modo demostración

`/calidad?demo=1` agrega en memoria 6 registros sintéticos con errores inyectados (IDs 9001–9006, marcados como *demo*) para mostrar cómo se ve cada regla, incluido un registro cargado fuera de plazo (9006) que demuestra un fallo de oportunidad. **No escribe nada en la base de datos.**

## Evidencia por ejecución

El botón **Descargar evidencia (CSV)** genera un archivo fechado (`/calidad/evidencia`, o `/calidad/evidencia?demo=1`) con una línea por dimensión y una por regla incumplida:

`fecha_ejecucion, modo, version_reglas, nivel, dimension, regla, aplicables, conformes, fallidos, resultado, umbral, registros_afectados`

Cada corrida de prueba debe guardar su CSV como evidencia (revisión D-13). Mientras no existan IDs de regla ni umbrales por regla (D-10), el umbral es 100% y la regla se identifica por su mensaje. Las celdas que una planilla interpretaría como fórmula se neutralizan para evitar inyección de fórmulas (CSV injection).

## Protección de datos en tránsito

La nueva ruta se sirve desde el mismo despliegue de Vercel, por lo que hereda el certificado TLS, la redirección HTTP→HTTPS y el encabezado HSTS documentados en [controles-auditoria.md](controles-auditoria.md).
