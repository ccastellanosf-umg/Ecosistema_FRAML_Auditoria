import { describe, expect, it } from "vitest";
import { evaluateQuality, evaluateRow, RULES, type QualityContext } from "./rules";

const NOW = new Date("2026-10-09T12:00:00Z");

const ctx = (overrides: Partial<QualityContext> = {}): QualityContext => ({
  now: NOW,
  knownCustomerIds: null,
  ...overrides,
});

const validRow = {
  id_transaccion: 1,
  id_cliente: 1,
  monto_txn: 1250,
  fecha_hora_txn: "2026-10-01T14:15:00+00:00",
  pais_contraparte: "Guatemala",
  canal_tx: "App móvil",
  id_dispositivo: "DEV-MOB-001",
};

const failedRules = (row: Record<string, unknown>, context = ctx()) =>
  evaluateRow(row, context).map((issue) => issue.ruleId);

describe("rule catalog", () => {
  it("uses the catalog rule ids", () => {
    expect(RULES.map((rule) => rule.id)).toEqual([
      "CLI-01", "CLI-02", "CLI-04",
      "MON-01", "MON-02",
      "FEC-01", "FEC-02", "FEC-03",
      "PAI-01", "PAI-02",
      "CAN-01", "CAN-02",
      "DIS-01", "DIS-02",
    ]);
  });

  it("uses the catalog thresholds", () => {
    const threshold = (id: string) => RULES.find((rule) => rule.id === id)?.threshold;
    expect(threshold("FEC-03")).toBe(0.99);
    expect(threshold("MON-02")).toBe(1);
  });
});

describe("evaluateRow", () => {
  it("reports no issues for a clean row", () => {
    expect(evaluateRow(validRow, ctx())).toEqual([]);
  });

  it("tags each issue with its rule, field and dimension", () => {
    expect(evaluateRow({ ...validRow, monto_txn: -50 }, ctx())).toEqual([
      { ruleId: "MON-02", field: "monto_txn", dimension: "validity", message: "El monto debe ser mayor que 0" },
    ]);
  });

  describe("completeness", () => {
    it.each([
      ["id_cliente", "CLI-01"],
      ["monto_txn", "MON-01"],
      ["fecha_hora_txn", "FEC-01"],
      ["pais_contraparte", "PAI-01"],
      ["canal_tx", "CAN-01"],
    ])("flags an empty %s as %s", (field, ruleId) => {
      expect(failedRules({ ...validRow, [field]: null })).toEqual([ruleId]);
    });

    it("treats blank strings as missing", () => {
      expect(failedRules({ ...validRow, canal_tx: "   " })).toEqual(["CAN-01"]);
    });

    it.each(["App móvil", "Web"])("requires a device id for channel %s (DIS-01)", (channel) => {
      expect(failedRules({ ...validRow, canal_tx: channel, id_dispositivo: null })).toEqual(["DIS-01"]);
    });

    it("accepts a missing device id for the Cajero channel", () => {
      expect(failedRules({ ...validRow, canal_tx: "Cajero", id_dispositivo: null })).toEqual([]);
    });

    it("does not evaluate DIS-01 when the channel is invalid", () => {
      expect(failedRules({ ...validRow, canal_tx: "Fax", id_dispositivo: null })).toEqual(["CAN-02"]);
    });
  });

  describe("validity", () => {
    it.each(["1", "CLI000123", "A1"])("accepts customer id %s (CLI-02)", (id) => {
      expect(failedRules({ ...validRow, id_cliente: id })).toEqual([]);
    });

    it.each(["-3", "cli001", "CLI 001", "A".repeat(21)])("flags customer id %s (CLI-02)", (id) => {
      expect(failedRules({ ...validRow, id_cliente: id })).toEqual(["CLI-02"]);
    });

    it.each([0, -50, "abc"])("flags amount %s (MON-02)", (amount) => {
      expect(failedRules({ ...validRow, monto_txn: amount })).toEqual(["MON-02"]);
    });

    it("flags an amount that needs rounding to two decimals (MON-02)", () => {
      expect(failedRules({ ...validRow, monto_txn: 10.125 })).toEqual(["MON-02"]);
    });

    it("accepts an amount with two decimals", () => {
      expect(failedRules({ ...validRow, monto_txn: "10.50" })).toEqual([]);
    });

    it("flags an unknown channel (CAN-02)", () => {
      expect(failedRules({ ...validRow, canal_tx: "Fax" })).toEqual(["CAN-02"]);
    });

    it("flags an unknown country (PAI-02)", () => {
      expect(failedRules({ ...validRow, pais_contraparte: "Narnia" })).toEqual(["PAI-02"]);
    });

    it("accepts a country regardless of case and surrounding spaces", () => {
      expect(failedRules({ ...validRow, pais_contraparte: "  méxico " })).toEqual([]);
    });

    it.each(["DEV-MOB-001", "DEV-A81F92", "ATM-GT-1", "X", "A".repeat(64)])(
      "accepts device id %s (DIS-02)",
      (deviceId) => {
        expect(failedRules({ ...validRow, id_dispositivo: deviceId })).toEqual([]);
      },
    );

    it.each(["dev-mob-001", "DEV MOB 001", "---", "A".repeat(65), "DEV_MOB"])(
      "flags device id %s (DIS-02)",
      (deviceId) => {
        expect(failedRules({ ...validRow, id_dispositivo: deviceId })).toEqual(["DIS-02"]);
      },
    );

    it("flags an unparseable date (FEC-02)", () => {
      expect(failedRules({ ...validRow, fecha_hora_txn: "not-a-date" })).toEqual(["FEC-02"]);
    });

    it("flags a date without a time zone (FEC-02)", () => {
      expect(failedRules({ ...validRow, fecha_hora_txn: "2026-10-01T14:15:00" })).toEqual(["FEC-02"]);
    });

    it("flags a transaction dated after its load date (FEC-02)", () => {
      const row = { ...validRow, fecha_hora_txn: "2026-10-02T00:00:00Z", fecha_carga: "2026-10-01T00:00:00Z" };
      expect(failedRules(row)).toEqual(["FEC-02"]);
    });

    it("flags a transaction dated in the future when there is no load date (FEC-02)", () => {
      expect(failedRules({ ...validRow, fecha_hora_txn: "2026-10-10T12:00:00Z" })).toEqual(["FEC-02"]);
    });

    it("tolerates small clock differences", () => {
      expect(failedRules({ ...validRow, fecha_hora_txn: "2026-10-09T12:03:00Z" })).toEqual([]);
    });
  });

  describe("referential integrity (CLI-04)", () => {
    it("flags a customer missing from the customer master", () => {
      expect(failedRules(validRow, ctx({ knownCustomerIds: new Set(["2"]) }))).toEqual(["CLI-04"]);
    });

    it("accepts a customer present in the customer master", () => {
      expect(failedRules(validRow, ctx({ knownCustomerIds: new Set(["1"]) }))).toEqual([]);
    });
  });

  describe("timeliness (FEC-03)", () => {
    const loaded = (minutesAfter: number) => ({
      ...validRow,
      fecha_hora_txn: "2026-10-01T00:00:00Z",
      fecha_carga: new Date(Date.parse("2026-10-01T00:00:00Z") + minutesAfter * 60_000).toISOString(),
    });

    it.each([0, 15])("accepts a record loaded %i minutes after the transaction", (minutes) => {
      expect(failedRules(loaded(minutes))).toEqual([]);
    });

    it("flags a record loaded more than 15 minutes after the transaction", () => {
      expect(failedRules(loaded(16))).toEqual(["FEC-03"]);
    });
  });
});

describe("evaluateQuality", () => {
  const ruleResult = (report: ReturnType<typeof evaluateQuality>, id: string) =>
    report.rules.find((rule) => rule.id === id)!;

  it("computes each rule as conforming over applicable records", () => {
    const report = evaluateQuality(
      [validRow, { ...validRow, id_transaccion: 2, monto_txn: -1 }, { ...validRow, id_transaccion: 3, monto_txn: null }],
      ctx(),
    );

    expect(ruleResult(report, "MON-02")).toMatchObject({
      applicable: 2,
      passed: 1,
      failed: 1,
      rate: 0.5,
      status: "fail",
      failedRowIds: [2],
    });
    expect(ruleResult(report, "MON-01")).toMatchObject({ applicable: 3, passed: 2, status: "fail" });
  });

  it("reports No aplica when a rule has no applicable records", () => {
    const report = evaluateQuality([validRow], ctx());
    expect(ruleResult(report, "FEC-03")).toMatchObject({ applicable: 0, rate: null, status: "na" });
  });

  it("reports a rule as not evaluable, never as passed, when its source is unavailable", () => {
    const report = evaluateQuality([validRow], ctx({ knownCustomerIds: null }));
    expect(ruleResult(report, "CLI-04")).toMatchObject({
      applicable: 0,
      status: "not_evaluable",
      reason: "Falta la vista clientes_ids",
    });
  });

  it("does not evaluate DIS-01 for records with an invalid channel", () => {
    const report = evaluateQuality([{ ...validRow, canal_tx: "Fax", id_dispositivo: null }], ctx());
    expect(ruleResult(report, "DIS-01")).toMatchObject({ applicable: 0, notEvaluable: 1, status: "not_evaluable" });
  });

  it("passes a rule that reaches its threshold even with failures (FEC-03, 99%)", () => {
    const onTime = (id: number) => ({
      ...validRow,
      id_transaccion: id,
      fecha_hora_txn: "2026-10-01T00:00:00Z",
      fecha_carga: "2026-10-01T00:05:00Z",
    });
    const rows = Array.from({ length: 100 }, (_, i) => onTime(i + 1));
    rows[0] = { ...rows[0], fecha_carga: "2026-10-01T02:00:00Z" };

    expect(ruleResult(evaluateQuality(rows, ctx()), "FEC-03")).toMatchObject({
      applicable: 100,
      passed: 99,
      status: "pass",
    });
  });

  it("summarizes each dimension from its rules", () => {
    const report = evaluateQuality([validRow, { ...validRow, id_transaccion: 2, canal_tx: null }], ctx());
    const dimension = (name: string) => report.dimensions.find((d) => d.dimension === name)!;

    expect(dimension("completeness")).toMatchObject({ status: "fail", passed: 1, total: 2, rate: 0.5 });
    expect(dimension("validity")).toMatchObject({ status: "pass", passed: 2, total: 2 });
    expect(dimension("timeliness")).toMatchObject({ status: "na", total: 0, rate: null });
    expect(dimension("integrity")).toMatchObject({ status: "not_evaluable" });
    expect(report.rowsWithIssues).toBe(1);
  });
});
