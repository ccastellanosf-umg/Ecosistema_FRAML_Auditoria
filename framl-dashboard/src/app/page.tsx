import { connection } from "next/server";
import { fetchTransactions } from "@/lib/supabase/server";
import { HOME_COUNTRY, summarize } from "@/lib/transactions/summary";
import { BarList } from "@/components/dashboard/BarList";
import { StatTile } from "@/components/dashboard/StatTile";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { formatCurrency, formatPercent } from "@/components/dashboard/format";

function Notice({ tone, children }: { tone: "warning" | "error"; children: React.ReactNode }) {
  const styles =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200";
  return <p className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</p>;
}

export default async function Home() {
  // Read env vars and data at request time, not at build time.
  await connection();
  const result = await fetchTransactions();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Dashboard FRAML</h1>
        <p className="text-sm text-secondary">
          Transacciones sintéticas del ecosistema de auditoría FRAML. Todos los datos mostrados son ficticios.
        </p>
      </header>

      {result.status === "not-configured" && (
        <Notice tone="warning">La conexión a la base de datos no está configurada. {result.detail}.</Notice>
      )}

      {result.status === "error" && (
        <Notice tone="error">No se pudieron cargar las transacciones: {result.detail}</Notice>
      )}

      {result.status === "ok" && result.transactions.length === 0 && (
        <p className="text-sm text-secondary">No se encontraron transacciones.</p>
      )}

      {result.status === "ok" && result.transactions.length > 0 && (
        <Dashboard transactions={result.transactions} />
      )}
    </main>
  );
}

function Dashboard({ transactions }: { transactions: Parameters<typeof summarize>[0] }) {
  const summary = summarize(transactions);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Transacciones" value={summary.count.toLocaleString("es-GT")} />
        <StatTile label="Monto total" value={formatCurrency(summary.totalAmount)} />
        <StatTile label="Monto promedio" value={formatCurrency(summary.averageAmount)} />
        <StatTile
          label="Transfronterizas"
          value={summary.crossBorderCount.toLocaleString("es-GT")}
          detail={`${formatPercent(summary.crossBorderCount / summary.count)} enviadas fuera de ${HOME_COUNTRY}`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList
          title="Monto por canal"
          description="Total transaccionado por canal"
          groups={summary.byChannel}
        />
        <BarList
          title="Monto por país de contraparte"
          description="Total transaccionado por país de destino"
          groups={summary.byCountry}
        />
      </section>

      <TransactionsTable transactions={transactions} />
    </>
  );
}
