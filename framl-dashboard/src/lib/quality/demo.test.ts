import { describe, expect, it } from "vitest";
import { buildDemoRows } from "./demo";
import { evaluateRow } from "./rules";

const ctx = { now: new Date("2026-10-09T12:00:00Z"), knownCustomerIds: null };

describe("buildDemoRows", () => {
  const rows = buildDemoRows(ctx.now);

  it("uses ids that cannot collide with real transactions", () => {
    expect(rows.every((row) => Number(row.id_transaccion) >= 9000)).toBe(true);
  });

  it("injects at least one issue in every demo row", () => {
    for (const row of rows) expect(evaluateRow(row, ctx).length).toBeGreaterThan(0);
  });

  it("covers completeness, validity and timeliness", () => {
    const dimensions = new Set(rows.flatMap((row) => evaluateRow(row, ctx).map((i) => i.dimension)));
    expect([...dimensions].sort()).toEqual(["completeness", "timeliness", "validity"]);
  });

  it("does not inject customers the master would reject when the view exists", () => {
    const withMaster = { ...ctx, knownCustomerIds: new Set(["1", "2", "3", "4", "6"]) };
    const integrity = rows.flatMap((row) => evaluateRow(row, withMaster)).filter((i) => i.dimension === "integrity");
    expect(integrity).toEqual([]);
  });

  it("includes a record loaded outside the allowed delay", () => {
    const messages = rows.flatMap((row) => evaluateRow(row, ctx).map((i) => i.message));
    expect(messages).toContain("Cargado con más de 15 minutos de retraso");
  });
});
