import "server-only";
import { fetchQualityData } from "@/lib/supabase/server";
import { buildDemoRows } from "./demo";
import { evaluateQuality, type QualityReport } from "./rules";

export const RULES_VERSION = "1.1.0";
const MAX_LOAD_DELAY_HOURS = 24;

export type QualityRun =
  | {
      status: "ok";
      executedAt: Date;
      report: QualityReport;
      hasLoadDate: boolean;
      customerCheck: boolean;
      demoIds: Set<number>;
    }
  | { status: "not-configured" | "error"; detail: string };

export async function runQualityCheck(demo: boolean): Promise<QualityRun> {
  const data = await fetchQualityData();
  if (data.status !== "ok") return data;

  const executedAt = new Date();
  const demoRows = demo ? buildDemoRows(executedAt) : [];
  const report = evaluateQuality([...data.rows, ...demoRows], {
    now: executedAt,
    knownCustomerIds: data.knownCustomerIds,
    maxLoadDelayHours: MAX_LOAD_DELAY_HOURS,
  });

  return {
    status: "ok",
    executedAt,
    report,
    // Demo rows carry fecha_carga, so the column is shown in demo mode.
    hasLoadDate: data.hasLoadDate || demo,
    customerCheck: data.knownCustomerIds !== null,
    demoIds: new Set(demoRows.map((row) => Number(row.id_transaccion))),
  };
}
