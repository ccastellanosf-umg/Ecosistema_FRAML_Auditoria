export type Dimension = "completeness" | "validity" | "timeliness";

export const DIMENSIONS: Dimension[] = ["completeness", "validity", "timeliness"];

export type Issue = { field: string; dimension: Dimension; message: string };

export type QualityContext = {
  now: Date;
  // Customer ids from the customer master; null when they cannot be read.
  knownCustomerIds: Set<number> | null;
  maxLoadDelayHours: number;
};

export type DimensionScore = { dimension: Dimension; passed: number; total: number; rate: number };

export type RuleFailure = { dimension: Dimension; message: string; count: number };

export type QualityReport = {
  rows: { row: Row; issues: Issue[] }[];
  dimensions: DimensionScore[];
  failuresByRule: RuleFailure[];
  rowsWithIssues: number;
};

type Row = Record<string, unknown>;

export const REQUIRED_FIELDS = [
  "id_cliente",
  "monto_txn",
  "fecha_hora_txn",
  "pais_contraparte",
  "canal_tx",
  "id_dispositivo",
] as const;

export const ALLOWED_CHANNELS = ["App móvil", "Web", "Cajero"];

const VALID_COUNTRIES = [
  "Alemania", "Argentina", "Belice", "Bolivia", "Brasil", "Canadá", "Chile", "China",
  "Colombia", "Costa Rica", "Cuba", "Ecuador", "El Salvador", "España", "Estados Unidos",
  "Francia", "Guatemala", "Honduras", "Italia", "Japón", "México", "Nicaragua", "Panamá",
  "Paraguay", "Perú", "Portugal", "Puerto Rico", "Reino Unido", "República Dominicana",
  "Uruguay", "Venezuela",
];

const normalize = (value: string) => value.trim().toLowerCase();
const VALID_COUNTRY_SET = new Set(VALID_COUNTRIES.map(normalize));

const DEVICE_ID_PATTERN = /^(DEV-(MOB|PC)-\d{3}|ATM-[A-Z]{2}-\d{3})$/;

// Small clock differences between systems are not timeliness issues.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const isMissing = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateRow(row: Row, ctx: QualityContext): Issue[] {
  const issues: Issue[] = [];
  const flag = (field: string, dimension: Dimension, message: string) =>
    issues.push({ field, dimension, message });

  for (const field of REQUIRED_FIELDS) {
    if (isMissing(row[field])) flag(field, "completeness", "Campo obligatorio vacío");
  }

  if (!isMissing(row.monto_txn)) {
    const amount = Number(row.monto_txn);
    if (!Number.isFinite(amount)) flag("monto_txn", "validity", "El monto no es numérico");
    else if (amount <= 0) flag("monto_txn", "validity", "El monto debe ser mayor que 0");
  }

  if (!isMissing(row.canal_tx) && !ALLOWED_CHANNELS.includes(String(row.canal_tx).trim())) {
    flag("canal_tx", "validity", "Canal no permitido");
  }

  if (!isMissing(row.pais_contraparte) && !VALID_COUNTRY_SET.has(normalize(String(row.pais_contraparte)))) {
    flag("pais_contraparte", "validity", "País no reconocido");
  }

  if (!isMissing(row.id_dispositivo) && !DEVICE_ID_PATTERN.test(String(row.id_dispositivo).trim())) {
    flag("id_dispositivo", "validity", "Formato de dispositivo inválido");
  }

  if (!isMissing(row.id_cliente)) {
    const customerId = Number(row.id_cliente);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      flag("id_cliente", "validity", "ID de cliente inválido");
    } else if (ctx.knownCustomerIds && !ctx.knownCustomerIds.has(customerId)) {
      flag("id_cliente", "validity", "Cliente no existe en maestro_clientes");
    }
  }

  const occurredAt = isMissing(row.fecha_hora_txn) ? null : parseDate(row.fecha_hora_txn);
  if (!isMissing(row.fecha_hora_txn) && !occurredAt) {
    flag("fecha_hora_txn", "validity", "Fecha inválida");
  }

  if (occurredAt && occurredAt.getTime() - ctx.now.getTime() > FUTURE_TOLERANCE_MS) {
    flag("fecha_hora_txn", "timeliness", "Fecha en el futuro");
  }

  if (!isMissing(row.fecha_carga)) {
    const loadedAt = parseDate(row.fecha_carga);
    if (!loadedAt) {
      flag("fecha_carga", "validity", "Fecha de carga inválida");
    } else if (occurredAt) {
      const delay = loadedAt.getTime() - occurredAt.getTime();
      if (delay < 0) {
        flag("fecha_carga", "timeliness", "Cargado antes de que ocurriera la transacción");
      } else if (delay > ctx.maxLoadDelayHours * HOUR_MS) {
        flag("fecha_carga", "timeliness", `Cargado con más de ${ctx.maxLoadDelayHours} h de retraso`);
      }
    }
  }

  return issues;
}

export function evaluateQuality(rows: Row[], ctx: QualityContext): QualityReport {
  const evaluated = rows.map((row) => ({ row, issues: evaluateRow(row, ctx) }));
  const total = evaluated.length;

  const dimensions = DIMENSIONS.map((dimension) => {
    const passed = evaluated.filter(({ issues }) => !issues.some((i) => i.dimension === dimension)).length;
    return { dimension, passed, total, rate: total === 0 ? 1 : passed / total };
  });

  const failures = new Map<string, RuleFailure>();
  for (const { issues } of evaluated) {
    for (const { dimension, message } of issues) {
      const key = `${dimension}|${message}`;
      const failure = failures.get(key) ?? { dimension, message, count: 0 };
      failure.count += 1;
      failures.set(key, failure);
    }
  }

  return {
    rows: evaluated,
    dimensions,
    failuresByRule: [...failures.values()].sort((a, b) => b.count - a.count),
    rowsWithIssues: evaluated.filter(({ issues }) => issues.length > 0).length,
  };
}
