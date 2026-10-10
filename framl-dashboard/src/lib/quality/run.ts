import "server-only";
import { fetchQualityData } from "@/lib/supabase/server";
import { buildDemoRows } from "./demo";
import { evaluateQuality, type QualityReport } from "./rules";

export const RULES_VERSION = "1.2.0";

export type QualityRun =
  | {
      status: "ok";
      executedAt: Date;
      report: QualityReport;
      hasLoadDate: boolean;
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
  });

  return {
    status: "ok",
    executedAt,
    report,
    // Demo rows carry fecha_carga, so the column is shown in demo mode.
    hasLoadDate: data.hasLoadDate || demo,
    demoIds: new Set(demoRows.map((row) => Number(row.id_transaccion))),
  };
}
