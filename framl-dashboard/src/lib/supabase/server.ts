import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";

const DEFAULT_TABLE = "transacciones";

export type TransactionsResult =
  | { status: "ok"; rows: Record<string, unknown>[] }
  | { status: "not-configured"; detail: string }
  | { status: "error"; detail: string };

export async function fetchTransactions(limit = 50): Promise<TransactionsResult> {
  const config = readSupabaseConfig(process.env);
  if (!config.ok) {
    const detail =
      config.reason === "missing"
        ? `Missing environment variables: ${config.missing.join(", ")}`
        : config.reason === "insecure-url"
          ? "SUPABASE_URL must use HTTPS"
          : "Privileged keys are not allowed; use the anon/publishable key";
    return { status: "not-configured", detail };
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });
  const table = process.env.SUPABASE_TABLE?.trim() || DEFAULT_TABLE;
  const { data, error } = await supabase.from(table).select("*").limit(limit);

  if (error) return { status: "error", detail: error.message };
  return { status: "ok", rows: data ?? [] };
}
