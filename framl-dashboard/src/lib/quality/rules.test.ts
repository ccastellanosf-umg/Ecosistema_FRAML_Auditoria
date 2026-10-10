import { describe, expect, it } from "vitest";
import { evaluateQuality, evaluateRow, type QualityContext } from "./rules";

const NOW = new Date("2026-10-09T12:00:00Z");

const ctx = (overrides: Partial<QualityContext> = {}): QualityContext => ({
  now: NOW,
  knownCustomerIds: null,
  maxLoadDelayHours: 24,
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

const issuesOf = (row: Record<string, unknown>, context = ctx()) =>
  evaluateRow(row, context).map(({ field, dimension }) => `${dimension}:${field}`);

describe("evaluateRow", () => {
  it("reports no issues for a clean row", () => {
    expect(evaluateRow(validRow, ctx())).toEqual([]);
  });

  describe("completeness", () => {
    it.each(["id_cliente", "monto_txn", "fecha_hora_txn", "pais_contraparte", "canal_tx", "id_dispositivo"])(
      "flags an empty %s",
      (field) => {
        expect(issuesOf({ ...validRow, [field]: null })).toEqual([`completeness:${field}`]);
      },
    );

    it("treats blank strings as missing", () => {
      expect(issuesOf({ ...validRow, canal_tx: "   " })).toEqual(["completeness:canal_tx"]);
    });

    it.each(["App móvil", "Web"])("requires a device id for channel %s", (channel) => {
      expect(issuesOf({ ...validRow, canal_tx: channel, id_dispositivo: null })).toEqual([
        "completeness:id_dispositivo",
      ]);
    });

    it("accepts a missing device id for the Cajero channel", () => {
      expect(issuesOf({ ...validRow, canal_tx: "Cajero", id_dispositivo: null })).toEqual([]);
    });

    it("does not evaluate the device requirement when the channel is invalid", () => {
      expect(issuesOf({ ...validRow, canal_tx: "Fax", id_dispositivo: null })).toEqual(["validity:canal_tx"]);
    });

    it("does not evaluate the device requirement when the channel is missing", () => {
      expect(issuesOf({ ...validRow, canal_tx: null, id_dispositivo: null })).toEqual([
        "completeness:canal_tx",
      ]);
    });
  });

  describe("validity", () => {
    it.each([0, -50, "abc"])("flags amount %s", (amount) => {
      expect(issuesOf({ ...validRow, monto_txn: amount })).toEqual(["validity:monto_txn"]);
    });

    it("flags an unknown channel", () => {
      expect(issuesOf({ ...validRow, canal_tx: "Fax" })).toEqual(["validity:canal_tx"]);
    });

    it("flags an unknown country", () => {
      expect(issuesOf({ ...validRow, pais_contraparte: "Narnia" })).toEqual([
        "validity:pais_contraparte",
      ]);
    });

    it("accepts a country regardless of case and surrounding spaces", () => {
      expect(issuesOf({ ...validRow, pais_contraparte: "  méxico " })).toEqual([]);
    });

    it.each(["DEV-MOB-001", "DEV-PC-042", "ATM-GT-001"])("accepts device id %s", (deviceId) => {
      expect(issuesOf({ ...validRow, id_dispositivo: deviceId })).toEqual([]);
    });

    it.each(["XYZ", "DEV-TAB-001", "dev-mob-001", "ATM-GT-1"])("flags device id %s", (deviceId) => {
      expect(issuesOf({ ...validRow, id_dispositivo: deviceId })).toEqual(["validity:id_dispositivo"]);
    });

    it("flags a non-positive customer id", () => {
      expect(issuesOf({ ...validRow, id_cliente: -3 })).toEqual(["validity:id_cliente"]);
    });

    it("flags a customer missing from the customer master when ids are known", () => {
      const context = ctx({ knownCustomerIds: new Set([2, 3]) });
      expect(issuesOf(validRow, context)).toEqual(["validity:id_cliente"]);
    });

    it("skips the customer master check when ids are unknown", () => {
      expect(issuesOf({ ...validRow, id_cliente: 999 })).toEqual([]);
    });

    it("flags an unparseable date", () => {
      expect(issuesOf({ ...validRow, fecha_hora_txn: "not-a-date" })).toEqual([
        "validity:fecha_hora_txn",
      ]);
    });
  });

  describe("transaction date validity", () => {
    it("flags a transaction dated in the future when there is no load date", () => {
      expect(issuesOf({ ...validRow, fecha_hora_txn: "2026-10-10T12:00:00Z" })).toEqual([
        "validity:fecha_hora_txn",
      ]);
    });

    it("tolerates small clock differences", () => {
      expect(issuesOf({ ...validRow, fecha_hora_txn: "2026-10-09T12:03:00Z" })).toEqual([]);
    });

    it("flags a transaction dated after its load date", () => {
      const row = { ...validRow, fecha_hora_txn: "2026-10-02T00:00:00Z", fecha_carga: "2026-10-01T00:00:00Z" };
      expect(issuesOf(row)).toEqual(["validity:fecha_hora_txn"]);
    });
  });

  describe("timeliness", () => {
    it("does not evaluate historical records without a load date", () => {
      expect(evaluateRow({ ...validRow, fecha_carga: null }, ctx())).toEqual([]);
    });

    it("flags a record loaded later than the allowed delay", () => {
      const row = { ...validRow, fecha_hora_txn: "2026-10-01T00:00:00Z", fecha_carga: "2026-10-03T00:00:00Z" };
      expect(issuesOf(row)).toEqual(["timeliness:fecha_carga"]);
    });

    it("accepts a record loaded within the allowed delay", () => {
      const row = { ...validRow, fecha_hora_txn: "2026-10-01T00:00:00Z", fecha_carga: "2026-10-01T05:00:00Z" };
      expect(issuesOf(row)).toEqual([]);
    });
  });

  it("explains each issue in Spanish", () => {
    const [issue] = evaluateRow({ ...validRow, monto_txn: -50 }, ctx());
    expect(issue.message).toBe("El monto debe ser mayor que 0");
  });
});

describe("evaluateQuality", () => {
  it("scores each dimension as the share of rows without issues", () => {
    const report = evaluateQuality(
      [
        validRow,
        { ...validRow, id_transaccion: 2, canal_tx: null },
        { ...validRow, id_transaccion: 3, monto_txn: -1, fecha_hora_txn: "2030-01-01T00:00:00Z" },
        {
          ...validRow,
          id_transaccion: 4,
          fecha_hora_txn: "2026-10-01T00:00:00Z",
          fecha_carga: "2026-10-05T00:00:00Z",
        },
      ],
      ctx(),
    );

    expect(report.dimensions).toEqual([
      { dimension: "completeness", passed: 3, total: 4, rate: 0.75 },
      { dimension: "validity", passed: 3, total: 4, rate: 0.75 },
      { dimension: "timeliness", passed: 3, total: 4, rate: 0.75 },
    ]);
    expect(report.rowsWithIssues).toBe(3);
    expect(report.rows[1].issues).toHaveLength(1);
  });

  it("counts failures per rule, most frequent first", () => {
    const report = evaluateQuality(
      [
        { ...validRow, id_transaccion: 7, canal_tx: "Fax" },
        { ...validRow, id_transaccion: 8, canal_tx: "Fax", monto_txn: 0 },
      ],
      ctx(),
    );

    expect(report.failuresByRule).toEqual([
      { dimension: "validity", message: "Canal no permitido", count: 2, rowIds: [7, 8] },
      { dimension: "validity", message: "El monto debe ser mayor que 0", count: 1, rowIds: [8] },
    ]);
  });

  it("returns perfect scores for no rows", () => {
    const report = evaluateQuality([], ctx());
    expect(report.dimensions.map((d) => d.rate)).toEqual([1, 1, 1]);
  });
});
