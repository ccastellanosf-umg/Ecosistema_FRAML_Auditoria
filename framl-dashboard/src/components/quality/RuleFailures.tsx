import type { RuleFailure } from "@/lib/quality/rules";
import { DIMENSION_LABELS } from "@/lib/quality/labels";

export function RuleFailures({ failures }: { failures: RuleFailure[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header>
        <h2 className="text-base font-semibold text-primary">Reglas incumplidas</h2>
        <p className="text-sm text-secondary">Cantidad de fallas por regla, de mayor a menor</p>
      </header>

      {failures.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-secondary">
          <span aria-hidden className="text-status-good">✓</span>
          Todos los registros cumplen las reglas de calidad.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {failures.map((failure) => (
            <li key={`${failure.dimension}-${failure.message}`} className="flex items-center gap-3 py-2 text-sm">
              <span aria-hidden className="text-status-critical">✕</span>
              <span className="flex-1 text-primary">{failure.message}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-secondary">
                {DIMENSION_LABELS[failure.dimension]}
              </span>
              <span className="w-8 text-right font-medium tabular-nums text-primary">{failure.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
