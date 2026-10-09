import type { DimensionScore } from "@/lib/quality/rules";
import { formatPercent } from "@/components/dashboard/format";
import { DIMENSION_LABELS, DIMENSION_QUESTIONS } from "./labels";

export function DimensionTile({ score }: { score: DimensionScore }) {
  const ok = score.passed === score.total;
  const failed = score.total - score.passed;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-primary">{DIMENSION_LABELS[score.dimension]}</h2>
          <p className="text-xs text-muted">{DIMENSION_QUESTIONS[score.dimension]}</p>
        </div>
        <StatusBadge ok={ok} />
      </div>

      <span className="text-3xl font-semibold tabular-nums tracking-tight text-primary">
        {formatPercent(score.rate)}
      </span>

      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${score.passed} de ${score.total} registros correctos`}
      >
        {score.passed > 0 && (
          <span className="h-full rounded-l-full bg-status-good" style={{ flexGrow: score.passed }} />
        )}
        {failed > 0 && (
          <span className="h-full rounded-r-full bg-status-critical" style={{ flexGrow: failed }} />
        )}
      </div>

      <p className="text-xs text-secondary">
        {score.passed} de {score.total} registros correctos
        {failed > 0 && ` · ${failed} con errores`}
      </p>
    </div>
  );
}

export function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-good/40 px-2 py-0.5 text-xs text-primary">
      <span aria-hidden className="text-status-good">✓</span> Cumple
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-critical/40 bg-status-critical/10 px-2 py-0.5 text-xs text-primary">
      <span aria-hidden className="text-status-critical">✕</span> Con errores
    </span>
  );
}
