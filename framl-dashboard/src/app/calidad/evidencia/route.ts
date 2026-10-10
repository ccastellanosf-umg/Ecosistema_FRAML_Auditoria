import { buildEvidenceCsv } from "@/lib/quality/evidence";
import { RULES_VERSION, runQualityCheck } from "@/lib/quality/run";

export async function GET(request: Request) {
  const demo = new URL(request.url).searchParams.get("demo") === "1";
  const run = await runQualityCheck(demo);

  if (run.status !== "ok") {
    return new Response(run.detail, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const mode = demo ? "demo" : "real";
  const stamp = run.executedAt.toISOString().replace(/[:.]/g, "-");
  const csv = buildEvidenceCsv(run.report, { executedAt: run.executedAt, mode, rulesVersion: RULES_VERSION });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="evidencia-calidad-${mode}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
