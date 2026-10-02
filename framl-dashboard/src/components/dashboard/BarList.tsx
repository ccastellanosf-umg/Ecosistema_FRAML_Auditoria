import type { Group } from "@/lib/transactions/summary";
import { formatCompactCurrency, formatCurrency, formatPercent } from "./format";

type BarListProps = {
  title: string;
  description: string;
  groups: Group[];
};

// Horizontal bar chart rendered on the server: one series, one hue.
export function BarList({ title, description, groups }: BarListProps) {
  const max = Math.max(...groups.map((group) => group.total), 0);
  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header>
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        <p className="text-sm text-secondary">{description}</p>
      </header>

      <ul className="flex flex-col gap-1">
        {groups.map((group) => {
          const width = max === 0 ? 0 : (group.total / max) * 100;
          const share = grandTotal === 0 ? 0 : group.total / grandTotal;
          return (
            <li
              key={group.label}
              tabIndex={0}
              className="group relative grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-1.5 outline-none hover:bg-track/60 focus-visible:bg-track/60"
            >
              <span className="truncate text-sm text-secondary" title={group.label}>
                {group.label}
              </span>
              <span className="h-3 w-full">
                <span
                  className="block h-full rounded-r-[4px] bg-series-1"
                  style={{ width: `${Math.max(width, 1)}%` }}
                />
              </span>
              <span className="text-sm tabular-nums text-primary">
                {formatCompactCurrency(group.total)}
              </span>

              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg group-hover:block group-focus-visible:block"
              >
                <span className="block font-medium text-primary">{group.label}</span>
                <span className="block tabular-nums text-secondary">
                  {formatCurrency(group.total)} · {group.count}{" "}
                  {group.count === 1 ? "transaction" : "transactions"} · {formatPercent(share)} of
                  total
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
