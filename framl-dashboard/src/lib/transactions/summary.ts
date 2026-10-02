export const HOME_COUNTRY = "Guatemala";

export type Transaction = {
  id: number;
  customerId: number;
  amount: number;
  occurredAt: string;
  country: string;
  channel: string;
  deviceId: string;
};

export type Group = { label: string; total: number; count: number };

export type Summary = {
  count: number;
  totalAmount: number;
  averageAmount: number;
  crossBorderCount: number;
  byChannel: Group[];
  byCountry: Group[];
};

type Row = Record<string, unknown>;

const text = (value: unknown, fallback = "Unknown") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

export function parseTransactions(rows: Row[]): Transaction[] {
  return rows.flatMap((row) => {
    if (row.monto_txn === null || row.monto_txn === undefined) return [];
    const amount = Number(row.monto_txn);
    if (!Number.isFinite(amount)) return [];

    return [
      {
        id: Number(row.id_transaccion),
        customerId: Number(row.id_cliente),
        amount,
        occurredAt: text(row.fecha_hora_txn, ""),
        country: text(row.pais_contraparte),
        channel: text(row.canal_tx),
        deviceId: text(row.id_dispositivo, ""),
      },
    ];
  });
}

function groupBy(transactions: Transaction[], key: (tx: Transaction) => string): Group[] {
  const groups = new Map<string, Group>();
  for (const tx of transactions) {
    const label = key(tx);
    const group = groups.get(label) ?? { label, total: 0, count: 0 };
    group.total += tx.amount;
    group.count += 1;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

export function summarize(transactions: Transaction[]): Summary {
  const count = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    count,
    totalAmount,
    averageAmount: count === 0 ? 0 : totalAmount / count,
    crossBorderCount: transactions.filter((tx) => tx.country !== HOME_COUNTRY).length,
    byChannel: groupBy(transactions, (tx) => tx.channel),
    byCountry: groupBy(transactions, (tx) => tx.country),
  };
}
