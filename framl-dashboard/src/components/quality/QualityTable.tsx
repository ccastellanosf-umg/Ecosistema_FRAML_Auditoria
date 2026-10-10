import type { Issue, QualityReport } from "@/lib/quality/rules";
import { formatCurrency, formatDateTime } from "@/components/dashboard/format";
import { DIMENSION_LABELS } from "@/lib/quality/labels";

type Column = {
  field: string;
  label: string;
  format?: (value: unknown) => string;
  align?: "right";
  emptyLabel?: string;
};

const asDate = (value: unknown) => {
  const formatted = formatDateTime(String(value));
  return formatted === "—" ? String(value) : formatted;
};

const asAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? formatCurrency(amount) : String(value);
};

const BASE_COLUMNS: Column[] = [
  { field: "id_cliente", label: "Cliente" },
  { field: "monto_txn", label: "Monto", format: asAmount, align: "right" },
  { field: "fecha_hora_txn", label: "Fecha", format: asDate },
  { field: "pais_contraparte", label: "País" },
  { field: "canal_tx", label: "Canal" },
  { field: "id_dispositivo", label: "Dispositivo" },
];

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

type QualityTableProps = {
  report: QualityReport;
  hasLoadDate: boolean;
  demoIds: Set<number>;
};

export function QualityTable({ report, hasLoadDate, demoIds }: QualityTableProps) {
  const columns = hasLoadDate
    ? [...BASE_COLUMNS, { field: "fecha_carga", label: "Fecha de carga", format: asDate, emptyLabel: "carga histórica" }]
    : BASE_COLUMNS;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-primary">Detalle por registro</h2>
          <p className="text-sm text-secondary">
            Las celdas en rojo incumplen una regla; pasá el mouse para ver el motivo.
          </p>
        </div>
        <Legend />
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-medium">ID</th>
              {columns.map((column) => (
                <th
                  key={column.field}
                  className={`py-2 pr-4 font-medium ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map(({ row, issues }) => {
              const id = Number(row.id_transaccion);
              return (
                <tr key={id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-muted">
                    #{id}
                    {demoIds.has(id) && (
                      <span className="ml-1.5 rounded border border-border px-1 text-[10px] uppercase">
                        demo
                      </span>
                    )}
                  </td>
                  {columns.map((column) => (
                    <Cell
                      key={column.field}
                      value={row[column.field]}
                      column={column}
                      issues={issues.filter((issue) => issue.field === column.field)}
                    />
                  ))}
                  <td className="py-2">
                    <RowStatus issues={issues} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ value, column, issues }: { value: unknown; column: Column; issues: Issue[] }) {
  const failing = issues.length > 0;
  const text = isEmpty(value) ? (column.emptyLabel ?? "vacío") : column.format ? column.format(value) : String(value);
  const reason = issues
    .map((issue) => `${issue.ruleId} · ${DIMENSION_LABELS[issue.dimension]}: ${issue.message}`)
    .join("\n");

  return (
    <td
      title={failing ? reason : undefined}
      className={`whitespace-nowrap py-2 pr-4 ${column.align === "right" ? "text-right tabular-nums" : ""} ${
        failing
          ? "bg-status-critical/15 font-medium text-primary ring-1 ring-inset ring-status-critical/60"
          : "text-secondary"
      }`}
    >
      {failing && <span aria-hidden className="mr-1 text-status-critical">✕</span>}
      <span className={isEmpty(value) ? "italic" : undefined}>{text}</span>
      {failing && <span className="sr-only"> ({reason})</span>}
    </td>
  );
}

function RowStatus({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-secondary">
        <span aria-hidden className="text-status-good">✓</span> Correcto
      </span>
    );
  }

  const dimensions = [...new Set(issues.map((issue) => DIMENSION_LABELS[issue.dimension]))];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary">
      <span aria-hidden className="text-status-critical">✕</span>
      {issues.length} {issues.length === 1 ? "error" : "errores"}
      <span className="font-normal text-muted">· {dimensions.join(", ")}</span>
    </span>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-secondary">
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="text-status-good">✓</span> Cumple
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="text-status-critical">✕</span> Incumple una regla
      </span>
    </div>
  );
}
