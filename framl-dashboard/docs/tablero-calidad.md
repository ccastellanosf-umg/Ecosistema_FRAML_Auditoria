# Tablero de calidad de datos (Control Detectivo)

Ruta: `https://ecosistema-framl-auditoria.vercel.app/calidad`
Work item: User Story 96 — Construir la lógica visual del Control Detectivo

El tablero evalúa cada registro de `transacciones` en tres dimensiones de calidad y marca en rojo las celdas que incumplen una regla. Es un **control detectivo**: no impide que entren datos erróneos (eso lo hacen los controles preventivos de la base de datos), sino que los **detecta y los hace visibles**.

## Reglas evaluadas (fichas del catálogo)

Las reglas, sus IDs, dimensiones y umbrales provienen de las fichas de datos críticos del documento del proyecto (versión de reglas 1.2.0). Cada regla se calcula por lote como **conformes ÷ aplicables** y se compara contra su umbral:

- **Cumple**: el resultado alcanza el umbral.
- **No cumple**: el resultado está por debajo del umbral.
- **No aplica**: no hay registros aplicables (por ejemplo, FEC-03 sin registros con `fecha_carga`).
- **No evaluable**: la regla no se pudo evaluar; se registra el motivo y **nunca se reporta como cumplida**.

| Regla | Dimensión | Validación | Umbral |
|---|---|---|---|
| CLI-01 | Completitud | `id_cliente` presente | 100 % |
| CLI-02 | Validez | 1 a 20 caracteres, solo mayúsculas A-Z y números | 100 % |
| CLI-04 | Integridad referencial | El cliente existe en `maestro_clientes` (requiere la vista `clientes_ids`) | 100 % |
| MON-01 | Completitud | `monto_txn` presente | 100 % |
| MON-02 | Validez | Numérico, mayor que 0 y con hasta 2 decimales sin redondeo | 100 % |
| FEC-01 | Completitud | `fecha_hora_txn` presente | 100 % |
| FEC-02 | Validez | Fecha real, con zona horaria y no posterior a `fecha_carga` (sin `fecha_carga`: no posterior a la hora actual, con 5 minutos de tolerancia) | 100 % |
| FEC-03 | Oportunidad | Entre 0 y 15 minutos entre `fecha_hora_txn` y `fecha_carga`. Los registros sin `fecha_carga` son carga histórica y no aplican | ≥ 99 % |
| PAI-01 | Completitud | `pais_contraparte` presente | 100 % |
| PAI-02 | Validez | Pertenece al catálogo de países (*) | 100 % |
| CAN-01 | Completitud | `canal_tx` presente | 100 % |
| CAN-02 | Validez | Pertenece al catálogo de canales (*) | 100 % |
| DIS-01 | Completitud condicional | `id_dispositivo` presente en canales digitales. No aplica en Cajero; no evaluable si el canal es vacío o inválido | 100 % |
| DIS-02 | Validez | 1 a 64 caracteres: mayúsculas A-Z, números y guiones, con al menos una letra o número | 100 % |

(*) Pendiente de decisión del equipo (revisión D-01 a D-03). Mientras tanto, CLI-02 acepta los IDs numéricos actuales (cumplen el patrón), PAI-02 valida contra una lista de nombres de país y CAN-02 contra `App móvil`, `Web` y `Cajero`, que son los valores que guarda hoy la base de datos.

**Fuera del tablero:** CLI-03 (duplicados en el maestro), ING-01 a ING-03 (el ingreso no se expone con la llave pública) y las reglas de consistencia con el origen (MON-03, PAI-03, CAN-03, DIS-03). Ver revisión D-11.

Las dimensiones del tablero resumen sus reglas: **No cumple** si alguna regla no cumple; **Cumple** si las reglas evaluadas cumplen. El porcentaje de la dimensión es la proporción de registros aplicables sin fallas en esa dimensión.

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

El botón **Descargar evidencia (CSV)** genera un archivo fechado (`/calidad/evidencia`, o `/calidad/evidencia?demo=1`) con una línea por dimensión y una por cada regla del catálogo:

`fecha_ejecucion, modo, version_reglas, nivel, regla_id, dimension, regla, aplicables, conformes, fallidos, no_evaluables, resultado, umbral, motivo, registros_afectados`

Cada corrida de prueba debe guardar su CSV como evidencia (revisión D-13). El archivo sigue el registro común de evidencia del catálogo, salvo `id_lote`, que se agregará cuando existan lotes de carga. Las celdas que una planilla interpretaría como fórmula se neutralizan para evitar inyección de fórmulas (CSV injection).

## Protección de datos en tránsito

La nueva ruta se sirve desde el mismo despliegue de Vercel, por lo que hereda el certificado TLS, la redirección HTTP→HTTPS y el encabezado HSTS documentados en [controles-auditoria.md](controles-auditoria.md).
