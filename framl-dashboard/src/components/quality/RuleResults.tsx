import type { RuleResult } from "@/lib/quality/rules";
import { formatPercent } from "@/components/dashboard/format";
import { DIMENSION_LABELS } from "@/lib/quality/labels";
import { StatusBadge } from "./StatusBadge";

export function RuleResults({ rules }: { rules: RuleResult[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header>
        <h2 className="text-base font-semibold text-primary">Resultado por regla</h2>
        <p className="text-sm text-secondary">
          Reglas de las fichas del catálogo. Resultado = conformes ÷ aplicables, comparado contra el umbral.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-medium">Regla</th>
              <th className="py-2 pr-4 font-medium">Descripción</th>
              <th className="py-2 pr-4 font-medium">Dimensión</th>
              <th className="py-2 pr-4 text-right font-medium">Conformes / aplicables</th>
              <th className="py-2 pr-4 text-right font-medium">Resultado</th>
              <th className="py-2 pr-4 text-right font-medium">Umbral</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs font-medium text-primary">{rule.id}</td>
                <td className="min-w-56 py-2 pr-4 text-secondary">
                  {rule.description}
                  {rule.reason && <span className="block text-xs text-muted">Motivo: {rule.reason}</span>}
                  {rule.failedRowIds.length > 0 && (
                    <span className="block text-xs text-muted">
                      Registros afectados: {rule.failedRowIds.map((id) => `#${id}`).join(", ")}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-secondary">{DIMENSION_LABELS[rule.dimension]}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-secondary">
                  {rule.passed} / {rule.applicable}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right font-medium tabular-nums text-primary">
                  {rule.rate === null ? "—" : formatPercent(rule.rate)}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-secondary">
                  ≥ {formatPercent(rule.threshold)}
                </td>
                <td className="py-2">
                  <StatusBadge status={rule.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
