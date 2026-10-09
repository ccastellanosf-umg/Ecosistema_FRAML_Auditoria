import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";
import { parseTransactions, type Transaction } from "@/lib/transactions/summary";

const DEFAULT_TABLE = "transacciones";
const CUSTOMER_IDS_VIEW = "clientes_ids";
const UNDEFINED_COLUMN = "42703";

// Data minimization: request only the columns the dashboard renders.
const COLUMNS =
  "id_transaccion, id_cliente, monto_txn, fecha_hora_txn, pais_contraparte, canal_tx, id_dispositivo";

type NotConfigured = { status: "not-configured"; detail: string };
type Failed = { status: "error"; detail: string };

export type TransactionsResult =
  | { status: "ok"; transactions: Transaction[] }
  | NotConfigured
  | Failed;

export type QualityDataResult =
  | {
      status: "ok";
      rows: Record<string, unknown>[];
      hasLoadDate: boolean;
      knownCustomerIds: Set<number> | null;
    }
  | NotConfigured
  | Failed;

function connect(): { client: SupabaseClient; table: string } | NotConfigured {
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

  return {
    client: createClient(config.url, config.anonKey, { auth: { persistSession: false } }),
    table: process.env.SUPABASE_TABLE?.trim() || DEFAULT_TABLE,
  };
}

export async function fetchTransactions(limit = 200): Promise<TransactionsResult> {
  const connection = connect();
  if ("status" in connection) return connection;

  const { data, error } = await connection.client
    .from(connection.table)
    .select(COLUMNS)
    .order("fecha_hora_txn", { ascending: false })
    .limit(limit);

  if (error) return { status: "error", detail: error.message };
  return { status: "ok", transactions: parseTransactions(data ?? []) };
}

export async function fetchQualityData(limit = 500): Promise<QualityDataResult> {
  const connection = connect();
  if ("status" in connection) return connection;
  const { client, table } = connection;

  const query = (columns: string) =>
    client.from(table).select(columns).order("id_transaccion", { ascending: true }).limit(limit);

  // fecha_carga is optional: timeliness of loading is only checked when it exists.
  let hasLoadDate = true;
  let result = await query(`${COLUMNS}, fecha_carga`);
  if (result.error?.code === UNDEFINED_COLUMN) {
    hasLoadDate = false;
    result = await query(COLUMNS);
  }
  if (result.error) return { status: "error", detail: result.error.message };

  return {
    status: "ok",
    rows: (result.data ?? []) as unknown as Record<string, unknown>[],
    hasLoadDate,
    knownCustomerIds: await fetchCustomerIds(client),
  };
}

// The customer master is not readable with the public key; an ids-only view is.
async function fetchCustomerIds(client: SupabaseClient): Promise<Set<number> | null> {
  const { data, error } = await client.from(CUSTOMER_IDS_VIEW).select("id_cliente");
  if (error || !data) return null;
  return new Set(data.map((row) => Number(row.id_cliente)));
}
