import { describe, expect, it } from "vitest";
import { buildEvidenceCsv } from "./evidence";
import { evaluateQuality } from "./rules";

const validRow = {
  id_transaccion: 1,
  id_cliente: 1,
  monto_txn: 100,
  fecha_hora_txn: "2026-10-01T14:15:00Z",
  pais_contraparte: "Guatemala",
  canal_tx: "Web",
  id_dispositivo: "DEV-PC-001",
};

const ctx = { now: new Date("2026-10-09T12:00:00Z"), knownCustomerIds: null, maxLoadDelayHours: 24 };
const meta = { executedAt: new Date("2026-10-09T18:30:00Z"), mode: "demo" as const, rulesVersion: "1.1.0" };

const parse = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n");

describe("buildEvidenceCsv", () => {
  const report = evaluateQuality(
    [validRow, { ...validRow, id_transaccion: 2, monto_txn: -5 }, { ...validRow, id_transaccion: 3, monto_txn: 0 }],
    ctx,
  );
  const lines = parse(buildEvidenceCsv(report, meta));

  it("starts with a UTF-8 BOM so spreadsheets keep accents", () => {
    expect(buildEvidenceCsv(report, meta).startsWith("﻿")).toBe(true);
  });

  it("writes the evidence header", () => {
    expect(lines[0]).toBe(
      "fecha_ejecucion,modo,version_reglas,nivel,dimension,regla,aplicables,conformes,fallidos,resultado,umbral,registros_afectados",
    );
  });

  it("writes one summary line per dimension", () => {
    expect(lines[1]).toBe("2026-10-09T18:30:00.000Z,demo,1.1.0,dimension,Completitud,(todas),3,3,0,Cumple,100%,");
    expect(lines[2]).toBe("2026-10-09T18:30:00.000Z,demo,1.1.0,dimension,Validez,(todas),3,1,2,No cumple,100%,2 3");
  });

  it("writes one line per failing rule with the affected records", () => {
    expect(lines[4]).toBe(
      "2026-10-09T18:30:00.000Z,demo,1.1.0,regla,Validez,El monto debe ser mayor que 0,3,1,2,No cumple,100%,2 3",
    );
    expect(lines).toHaveLength(5);
  });

  it("quotes values containing separators or quotes", () => {
    const csv = buildEvidenceCsv(evaluateQuality([], ctx), { ...meta, rulesVersion: 'v1, "beta"' });
    expect(csv).toContain(`,"v1, ""beta""",`);
  });

  it("neutralizes values that a spreadsheet would run as formulas", () => {
    const report = evaluateQuality([], ctx);
    const csv = buildEvidenceCsv(report, { ...meta, rulesVersion: "=HYPERLINK(\"x\")" });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
