import { HOME_COUNTRY, type Transaction } from "@/lib/transactions/summary";
import { formatCurrency, formatDateTime } from "./format";

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header>
        <h2 className="text-base font-semibold text-primary">Transacciones</h2>
        <p className="text-sm text-secondary">Más recientes primero · hora de Guatemala (UTC−6)</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-medium">ID</th>
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 pr-4 font-medium">Canal</th>
              <th className="py-2 pr-4 font-medium">País de contraparte</th>
              <th className="py-2 pr-4 font-medium">Dispositivo</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-4 tabular-nums text-muted">#{tx.id}</td>
                <td className="whitespace-nowrap py-2.5 pr-4 text-secondary">
                  {formatDateTime(tx.occurredAt)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-secondary">{tx.customerId}</td>
                <td className="py-2.5 pr-4">
                  <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs text-secondary">
                    {tx.channel}
                  </span>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-4 text-primary">
                  {tx.country}
                  {tx.country !== HOME_COUNTRY && (
                    <span className="ml-2 text-xs text-muted">↗ transfronteriza</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-muted">{tx.deviceId}</td>
                <td className="whitespace-nowrap py-2.5 text-right font-medium tabular-nums text-primary">
                  {formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
