import { connection } from "next/server";
import { fetchTransactions } from "@/lib/supabase/server";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function Home() {
  // Read env vars and data at request time, not at build time.
  await connection();
  const result = await fetchTransactions();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">FRAML Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Synthetic transactions for the FRAML audit ecosystem. All data shown is fictitious.
        </p>
      </header>

      {result.status === "not-configured" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Database connection is not configured. {result.detail}.
        </p>
      )}

      {result.status === "error" && (
        <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          Could not load transactions: {result.detail}
        </p>
      )}

      {result.status === "ok" && result.rows.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No transactions found.</p>
      )}

      {result.status === "ok" && result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {Object.keys(result.rows[0]).map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-t border-zinc-200 dark:border-zinc-800">
                  {Object.keys(result.rows[0]).map((column) => (
                    <td key={column} className="px-3 py-2 whitespace-nowrap">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
