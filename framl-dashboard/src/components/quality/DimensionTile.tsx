import type { DimensionResult } from "@/lib/quality/rules";
import { formatPercent } from "@/components/dashboard/format";
import { DIMENSION_LABELS, DIMENSION_QUESTIONS } from "@/lib/quality/labels";
import { StatusBadge } from "./StatusBadge";

export function DimensionTile({ result }: { result: DimensionResult }) {
  const failed = result.total - result.passed;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-medium text-primary">{DIMENSION_LABELS[result.dimension]}</h2>
          <StatusBadge status={result.status} />
        </div>
        <p className="text-xs text-muted">{DIMENSION_QUESTIONS[result.dimension]}</p>
      </div>

      <span className="text-3xl font-semibold tabular-nums tracking-tight text-primary">
        {result.rate === null ? "—" : formatPercent(result.rate)}
      </span>

      {result.total > 0 ? (
        <>
          <div
            className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`${result.passed} de ${result.total} registros correctos`}
          >
            {result.passed > 0 && (
              <span className="h-full rounded-l-full bg-status-good" style={{ flexGrow: result.passed }} />
            )}
            {failed > 0 && <span className="h-full rounded-r-full bg-status-critical" style={{ flexGrow: failed }} />}
          </div>
          <p className="text-xs text-secondary">
            {result.passed} de {result.total} registros correctos
            {failed > 0 && ` · ${failed} con errores`}
          </p>
        </>
      ) : (
        <>
          <div className="h-2 w-full rounded-full bg-track" aria-hidden />
          <p className="text-xs text-secondary">Ningún registro aplicable en este lote</p>
        </>
      )}
    </div>
  );
}
