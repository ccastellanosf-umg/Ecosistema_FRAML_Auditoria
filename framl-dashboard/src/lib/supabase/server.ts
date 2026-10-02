import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";
import { parseTransactions, type Transaction } from "@/lib/transactions/summary";

const DEFAULT_TABLE = "transacciones";

// Data minimization: request only the columns the dashboard renders.
const COLUMNS =
  "id_transaccion, id_cliente, monto_txn, fecha_hora_txn, pais_contraparte, canal_tx, id_dispositivo";

export type TransactionsResult =
  | { status: "ok"; transactions: Transaction[] }
  | { status: "not-configured"; detail: string }
  | { status: "error"; detail: string };

export async function fetchTransactions(limit = 200): Promise<TransactionsResult> {
  const config = readSupabaseConfig(process.env);
  if (!config.ok) {
    const detail =
      config.reason === "missing"
        ? `Faltan variables de entorno: ${config.missing.join(", ")}`
        : config.reason === "insecure-url"
          ? "SUPABASE_URL debe usar HTTPS"
          : "No se permiten llaves privilegiadas; use la llave anon o publishable";
    return { status: "not-configured", detail };
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });
  const table = process.env.SUPABASE_TABLE?.trim() || DEFAULT_TABLE;
  const { data, error } = await supabase
    .from(table)
    .select(COLUMNS)
    .order("fecha_hora_txn", { ascending: false })
    .limit(limit);

  if (error) return { status: "error", detail: error.message };
  return { status: "ok", transactions: parseTransactions(data ?? []) };
}
