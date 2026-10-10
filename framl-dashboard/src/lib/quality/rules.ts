// Data quality rules taken from the critical data cards ("fichas") of the project catalog.
// Each rule is evaluated per record and summarized per batch as conforming / applicable.

export type Dimension = "completeness" | "validity" | "timeliness" | "integrity";

export const DIMENSIONS: Dimension[] = ["completeness", "validity", "timeliness", "integrity"];

export type QualityContext = {
  now: Date;
  // Customer ids from the customer master; null when they cannot be read.
  knownCustomerIds: Set<string> | null;
};

type Row = Record<string, unknown>;

export type RuleOutcome =
  | { status: "pass" }
  | { status: "fail"; message: string }
  | { status: "na" }
  | { status: "not_evaluable"; reason: string };

export type QualityRule = {
  id: string;
  dimension: Dimension;
  field: string;
  description: string;
  threshold: number;
  evaluate: (row: Row, ctx: QualityContext) => RuleOutcome;
};

export type Issue = { ruleId: string; field: string; dimension: Dimension; message: string };

export type ResultStatus = "pass" | "fail" | "na" | "not_evaluable";

export type RuleResult = {
  id: string;
  dimension: Dimension;
  field: string;
  description: string;
  threshold: number;
  applicable: number;
  passed: number;
  failed: number;
  notEvaluable: number;
  rate: number | null;
  status: ResultStatus;
  reason?: string;
  failedRowIds: number[];
};

export type DimensionResult = {
  dimension: Dimension;
  status: ResultStatus;
  passed: number;
  total: number;
  rate: number | null;
};

export type QualityReport = {
  rows: { row: Row; issues: Issue[] }[];
  rules: RuleResult[];
  dimensions: DimensionResult[];
  rowsWithIssues: number;
};

// --- Helpers -----------------------------------------------------------------

const PASS: RuleOutcome = { status: "pass" };
const NA: RuleOutcome = { status: "na" };
const fail = (message: string): RuleOutcome => ({ status: "fail", message });

const isMissing = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const text = (value: unknown) => String(value).trim();

function parseDate(value: unknown): Date | null {
  if (isMissing(value)) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

const HAS_TIME_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
// Small clock differences between systems are tolerated.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_LOAD_DELAY_MS = 15 * 60 * 1000;

// D-01 to D-03 are pending a team decision: these domains reflect what the
// database stores today, not yet the catalog formats (ISO codes, APP_MOVIL...).
export const ALLOWED_CHANNELS = ["App móvil", "Web", "Cajero"];
const DIGITAL_CHANNELS = ["App móvil", "Web"];

const VALID_COUNTRIES = [
  "Alemania", "Argentina", "Belice", "Bolivia", "Brasil", "Canadá", "Chile", "China",
  "Colombia", "Costa Rica", "Cuba", "Ecuador", "El Salvador", "España", "Estados Unidos",
  "Francia", "Guatemala", "Honduras", "Italia", "Japón", "México", "Nicaragua", "Panamá",
  "Paraguay", "Perú", "Portugal", "Puerto Rico", "Reino Unido", "República Dominicana",
  "Uruguay", "Venezuela",
];
const normalize = (value: string) => value.trim().toLowerCase();
const VALID_COUNTRY_SET = new Set(VALID_COUNTRIES.map(normalize));

const CUSTOMER_ID_PATTERN = /^[A-Z0-9]{1,20}$/;
const DEVICE_ID_PATTERN = /^(?=.*[A-Z0-9])[A-Z0-9-]{1,64}$/;
// NUMERIC(18,2): up to 16 integer digits and 2 decimals, no rounding needed.
const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

const required =
  (field: string): QualityRule["evaluate"] =>
  (row) =>
    isMissing(row[field]) ? fail("Campo obligatorio vacío") : PASS;

// Validity rules only apply when the value is present (completeness covers absence).
const whenPresent =
  (field: string, check: (value: unknown, row: Row, ctx: QualityContext) => RuleOutcome): QualityRule["evaluate"] =>
  (row, ctx) =>
    isMissing(row[field]) ? NA : check(row[field], row, ctx);

function checkTransactionDate(value: unknown, row: Row, ctx: QualityContext): RuleOutcome {
  const occurredAt = parseDate(value);
  if (!occurredAt) return fail("Fecha inválida");
  if (typeof value === "string" && !HAS_TIME_ZONE.test(value.trim())) return fail("Fecha sin zona horaria");

  const loadedAt = parseDate(row.fecha_carga);
  if (loadedAt) {
    return occurredAt > loadedAt ? fail("Fecha posterior a la fecha de carga") : PASS;
  }
  return occurredAt.getTime() - ctx.now.getTime() > FUTURE_TOLERANCE_MS ? fail("Fecha en el futuro") : PASS;
}

function checkLoadDelay(row: Row): RuleOutcome {
  // Records without fecha_carga are historical loads, evaluated separately from FEC-03.
  if (isMissing(row.fecha_carga)) return NA;
  const occurredAt = parseDate(row.fecha_hora_txn);
  const loadedAt = parseDate(row.fecha_carga);
  if (!occurredAt || !loadedAt) return { status: "not_evaluable", reason: "Fecha de transacción o de carga inválida" };

  const delay = loadedAt.getTime() - occurredAt.getTime();
  if (delay < 0) return { status: "not_evaluable", reason: "Fecha posterior a la fecha de carga (FEC-02)" };
  return delay > MAX_LOAD_DELAY_MS ? fail("Cargado con más de 15 minutos de retraso") : PASS;
}

function checkDeviceRequired(row: Row): RuleOutcome {
  const channel = isMissing(row.canal_tx) ? null : text(row.canal_tx);
  if (!channel || !ALLOWED_CHANNELS.includes(channel)) {
    return { status: "not_evaluable", reason: "Canal vacío o inválido" };
  }
  if (!DIGITAL_CHANNELS.includes(channel)) return NA;
  return isMissing(row.id_dispositivo) ? fail("Dispositivo obligatorio en canales digitales") : PASS;
}

// --- Rule catalog --------------------------------------------------------------

export const RULES: QualityRule[] = [
  {
    id: "CLI-01",
    dimension: "completeness",
    field: "id_cliente",
    description: "El identificador del cliente está presente",
    threshold: 1,
    evaluate: required("id_cliente"),
  },
  {
    id: "CLI-02",
    dimension: "validity",
    field: "id_cliente",
    description: "Identificador de 1 a 20 caracteres: mayúsculas A-Z y números",
    threshold: 1,
    evaluate: whenPresent("id_cliente", (value) =>
      CUSTOMER_ID_PATTERN.test(text(value)) ? PASS : fail("Formato de identificador de cliente inválido"),
    ),
  },
  {
    id: "CLI-04",
    dimension: "integrity",
    field: "id_cliente",
    description: "El cliente existe en el maestro de clientes",
    threshold: 1,
    evaluate: whenPresent("id_cliente", (value, _row, ctx) => {
      if (!ctx.knownCustomerIds) return { status: "not_evaluable", reason: "Falta la vista clientes_ids" };
      return ctx.knownCustomerIds.has(text(value)) ? PASS : fail("Cliente no existe en maestro_clientes");
    }),
  },
  {
    id: "MON-01",
    dimension: "completeness",
    field: "monto_txn",
    description: "El monto está presente",
    threshold: 1,
    evaluate: required("monto_txn"),
  },
  {
    id: "MON-02",
    dimension: "validity",
    field: "monto_txn",
    description: "Monto numérico, mayor que 0 y con hasta 2 decimales",
    threshold: 1,
    evaluate: whenPresent("monto_txn", (value) => {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return fail("El monto no es numérico");
      if (amount <= 0) return fail("El monto debe ser mayor que 0");
      return AMOUNT_PATTERN.test(text(value)) ? PASS : fail("El monto requiere redondeo (más de 2 decimales)");
    }),
  },
  {
    id: "FEC-01",
    dimension: "completeness",
    field: "fecha_hora_txn",
    description: "La fecha y hora están presentes",
    threshold: 1,
    evaluate: required("fecha_hora_txn"),
  },
  {
    id: "FEC-02",
    dimension: "validity",
    field: "fecha_hora_txn",
    description: "Fecha real, con zona horaria y no posterior a la fecha de carga",
    threshold: 1,
    evaluate: whenPresent("fecha_hora_txn", checkTransactionDate),
  },
  {
    id: "FEC-03",
    dimension: "timeliness",
    field: "fecha_carga",
    description: "Cargado entre 0 y 15 minutos después de la transacción",
    threshold: 0.99,
    evaluate: checkLoadDelay,
  },
  {
    id: "PAI-01",
    dimension: "completeness",
    field: "pais_contraparte",
    description: "El país de la contraparte está presente",
    threshold: 1,
    evaluate: required("pais_contraparte"),
  },
  {
    id: "PAI-02",
    dimension: "validity",
    field: "pais_contraparte",
    description: "El país pertenece al catálogo de países",
    threshold: 1,
    evaluate: whenPresent("pais_contraparte", (value) =>
      VALID_COUNTRY_SET.has(normalize(String(value))) ? PASS : fail("País no reconocido"),
    ),
  },
  {
    id: "CAN-01",
    dimension: "completeness",
    field: "canal_tx",
    description: "El canal está presente",
    threshold: 1,
    evaluate: required("canal_tx"),
  },
  {
    id: "CAN-02",
    dimension: "validity",
    field: "canal_tx",
    description: "El canal pertenece al catálogo de canales",
    threshold: 1,
    evaluate: whenPresent("canal_tx", (value) =>
      ALLOWED_CHANNELS.includes(text(value)) ? PASS : fail("Canal no permitido"),
    ),
  },
  {
    id: "DIS-01",
    dimension: "completeness",
    field: "id_dispositivo",
    description: "Dispositivo presente en canales digitales (App móvil y Web)",
    threshold: 1,
    evaluate: checkDeviceRequired,
  },
  {
    id: "DIS-02",
    dimension: "validity",
    field: "id_dispositivo",
    description: "Dispositivo de 1 a 64 caracteres: mayúsculas A-Z, números y guiones",
    threshold: 1,
    evaluate: whenPresent("id_dispositivo", (value) =>
      DEVICE_ID_PATTERN.test(text(value)) ? PASS : fail("Formato de dispositivo inválido"),
    ),
  },
];

// --- Evaluation ----------------------------------------------------------------

export function evaluateRow(row: Row, ctx: QualityContext): Issue[] {
  return RULES.flatMap((rule) => {
    const outcome = rule.evaluate(row, ctx);
    return outcome.status === "fail"
      ? [{ ruleId: rule.id, field: rule.field, dimension: rule.dimension, message: outcome.message }]
      : [];
  });
}

function statusFor(applicable: number, passed: number, notEvaluable: number, threshold: number): ResultStatus {
  if (applicable === 0) return notEvaluable > 0 ? "not_evaluable" : "na";
  return passed / applicable >= threshold ? "pass" : "fail";
}

export function evaluateQuality(rows: Row[], ctx: QualityContext): QualityReport {
  const outcomes = rows.map((row) => RULES.map((rule) => rule.evaluate(row, ctx)));

  const rules: RuleResult[] = RULES.map((rule, index) => {
    let passed = 0;
    let failed = 0;
    let notEvaluable = 0;
    let reason: string | undefined;
    const failedRowIds: number[] = [];

    outcomes.forEach((rowOutcomes, rowIndex) => {
      const outcome = rowOutcomes[index];
      if (outcome.status === "pass") passed += 1;
      if (outcome.status === "fail") {
        failed += 1;
        failedRowIds.push(Number(rows[rowIndex].id_transaccion));
      }
      if (outcome.status === "not_evaluable") {
        notEvaluable += 1;
        reason ??= outcome.reason;
      }
    });

    const applicable = passed + failed;
    return {
      id: rule.id,
      dimension: rule.dimension,
      field: rule.field,
      description: rule.description,
      threshold: rule.threshold,
      applicable,
      passed,
      failed,
      notEvaluable,
      rate: applicable === 0 ? null : passed / applicable,
      status: statusFor(applicable, passed, notEvaluable, rule.threshold),
      ...(reason ? { reason } : {}),
      failedRowIds,
    };
  });

  const dimensions: DimensionResult[] = DIMENSIONS.map((dimension) => {
    const indexes = RULES.flatMap((rule, index) => (rule.dimension === dimension ? [index] : []));
    const applicableRows = outcomes.filter((rowOutcomes) =>
      indexes.some((i) => rowOutcomes[i].status === "pass" || rowOutcomes[i].status === "fail"),
    );
    const passedRows = applicableRows.filter((rowOutcomes) => indexes.every((i) => rowOutcomes[i].status !== "fail"));
    const statuses = rules.filter((rule) => rule.dimension === dimension).map((rule) => rule.status);

    const status: ResultStatus = statuses.includes("fail")
      ? "fail"
      : statuses.includes("pass")
        ? "pass"
        : statuses.includes("not_evaluable")
          ? "not_evaluable"
          : "na";

    return {
      dimension,
      status,
      passed: passedRows.length,
      total: applicableRows.length,
      rate: applicableRows.length === 0 ? null : passedRows.length / applicableRows.length,
    };
  });

  const evaluated = rows.map((row) => ({ row, issues: evaluateRow(row, ctx) }));

  return {
    rows: evaluated,
    rules,
    dimensions,
    rowsWithIssues: evaluated.filter(({ issues }) => issues.length > 0).length,
  };
}
