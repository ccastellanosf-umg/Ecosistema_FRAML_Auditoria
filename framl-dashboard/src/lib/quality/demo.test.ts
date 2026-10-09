import { describe, expect, it } from "vitest";
import { buildDemoRows } from "./demo";
import { DIMENSIONS, evaluateRow } from "./rules";

const ctx = { now: new Date("2026-10-09T12:00:00Z"), knownCustomerIds: null, maxLoadDelayHours: 24 };

describe("buildDemoRows", () => {
  const rows = buildDemoRows(ctx.now);

  it("uses ids that cannot collide with real transactions", () => {
    expect(rows.every((row) => Number(row.id_transaccion) >= 9000)).toBe(true);
  });

  it("injects at least one issue in every demo row", () => {
    for (const row of rows) expect(evaluateRow(row, ctx).length).toBeGreaterThan(0);
  });

  it("covers every quality dimension", () => {
    const dimensions = new Set(rows.flatMap((row) => evaluateRow(row, ctx).map((i) => i.dimension)));
    expect([...dimensions].sort()).toEqual([...DIMENSIONS].sort());
  });
});
