import { describe, expect, it } from "vitest";
import { buildEvidenceCsv } from "./evidence";
import { evaluateQuality, RULES } from "./rules";

const validRow = {
  id_transaccion: 1,
  id_cliente: 1,
  monto_txn: 100,
  fecha_hora_txn: "2026-10-01T14:15:00Z",
  pais_contraparte: "Guatemala",
  canal_tx: "Web",
  id_dispositivo: "DEV-PC-001",
};

const ctx = { now: new Date("2026-10-09T12:00:00Z"), knownCustomerIds: null };
const meta = { executedAt: new Date("2026-10-09T18:30:00Z"), mode: "demo" as const, rulesVersion: "1.2.0" };
const PREFIX = "2026-10-09T18:30:00.000Z,demo,1.2.0";

const parse = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n");

describe("buildEvidenceCsv", () => {
  const report = evaluateQuality(
    [validRow, { ...validRow, id_transaccion: 2, monto_txn: -5 }, { ...validRow, id_transaccion: 3, monto_txn: 0 }],
    ctx,
  );
  const lines = parse(buildEvidenceCsv(report, meta));
  const line = (start: string) => lines.find((l) => l.startsWith(`${PREFIX},${start}`));

  it("starts with a UTF-8 BOM so spreadsheets keep accents", () => {
    expect(buildEvidenceCsv(report, meta).startsWith("﻿")).toBe(true);
  });

  it("writes the evidence header", () => {
    expect(lines[0]).toBe(
      "fecha_ejecucion,modo,version_reglas,nivel,regla_id,dimension,regla,aplicables,conformes,fallidos,no_evaluables,resultado,umbral,motivo,registros_afectados",
    );
  });

  it("writes one line per dimension and one per catalog rule", () => {
    expect(lines).toHaveLength(1 + 4 + RULES.length);
  });

  it("summarizes a failing rule with its id, threshold and affected records", () => {
    expect(line("regla,MON-02")).toBe(
      `${PREFIX},regla,MON-02,Validez,"Monto numérico, mayor que 0 y con hasta 2 decimales",3,1,2,0,No cumple,100%,,2 3`,
    );
  });

  it("reports rules without applicable records as No aplica", () => {
    expect(line("regla,FEC-03")).toContain(",0,0,0,0,No aplica,99%,,");
  });

  it("reports unavailable rules as not evaluable with the reason", () => {
    expect(line("regla,CLI-04")).toContain(",0,0,0,3,No evaluable,100%,Falta la vista clientes_ids,");
  });

  it("writes a dimension summary line", () => {
    expect(line("dimension,,Validez")).toBe(`${PREFIX},dimension,,Validez,(todas),3,1,2,,No cumple,,,2 3`);
  });

  it("quotes values containing separators or quotes", () => {
    const csv = buildEvidenceCsv(evaluateQuality([], ctx), { ...meta, rulesVersion: 'v1, "beta"' });
    expect(csv).toContain(`,"v1, ""beta""",`);
  });

  it("neutralizes values that a spreadsheet would run as formulas", () => {
    const csv = buildEvidenceCsv(evaluateQuality([], ctx), { ...meta, rulesVersion: '=HYPERLINK("x")' });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
