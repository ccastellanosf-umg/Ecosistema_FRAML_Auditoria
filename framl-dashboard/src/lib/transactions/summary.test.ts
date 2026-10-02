import { describe, expect, it } from "vitest";
import { parseTransactions, summarize, type Transaction } from "./summary";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 1,
  customerId: 1,
  amount: 100,
  occurredAt: "2026-10-01T14:15:00+00:00",
  country: "Guatemala",
  channel: "Web",
  deviceId: "DEV-PC-001",
  ...overrides,
});

describe("parseTransactions", () => {
  it("maps database rows to transactions", () => {
    const rows = [
      {
        id_transaccion: 7,
        id_cliente: 3,
        monto_txn: "1250.50",
        fecha_hora_txn: "2026-10-01T14:15:00+00:00",
        pais_contraparte: "México",
        canal_tx: "App móvil",
        id_dispositivo: "DEV-MOB-003",
      },
    ];

    expect(parseTransactions(rows)).toEqual([
      {
        id: 7,
        customerId: 3,
        amount: 1250.5,
        occurredAt: "2026-10-01T14:15:00+00:00",
        country: "México",
        channel: "App móvil",
        deviceId: "DEV-MOB-003",
      },
    ]);
  });

  it("drops rows without a valid amount", () => {
    const rows = [{ id_transaccion: 1, monto_txn: "abc" }, { id_transaccion: 2, monto_txn: null }];
    expect(parseTransactions(rows)).toEqual([]);
  });

  it("labels missing country and channel as Desconocido", () => {
    const [parsed] = parseTransactions([{ id_transaccion: 1, monto_txn: 10 }]);
    expect(parsed.country).toBe("Desconocido");
    expect(parsed.channel).toBe("Desconocido");
  });
});

describe("summarize", () => {
  it("returns zeros for no transactions", () => {
    expect(summarize([])).toEqual({
      count: 0,
      totalAmount: 0,
      averageAmount: 0,
      crossBorderCount: 0,
      byChannel: [],
      byCountry: [],
    });
  });

  it("computes totals, average and cross-border count", () => {
    const summary = summarize([
      tx({ amount: 100, country: "Guatemala" }),
      tx({ amount: 300, country: "México" }),
      tx({ amount: 200, country: "Estados Unidos" }),
    ]);

    expect(summary.count).toBe(3);
    expect(summary.totalAmount).toBe(600);
    expect(summary.averageAmount).toBe(200);
    expect(summary.crossBorderCount).toBe(2);
  });

  it("groups amounts by channel, largest first", () => {
    const summary = summarize([
      tx({ amount: 100, channel: "Web" }),
      tx({ amount: 500, channel: "Cajero" }),
      tx({ amount: 50, channel: "Web" }),
    ]);

    expect(summary.byChannel).toEqual([
      { label: "Cajero", total: 500, count: 1 },
      { label: "Web", total: 150, count: 2 },
    ]);
  });

  it("groups amounts by country, largest first", () => {
    const summary = summarize([
      tx({ amount: 100, country: "Guatemala" }),
      tx({ amount: 900, country: "México" }),
    ]);

    expect(summary.byCountry.map((group) => group.label)).toEqual(["México", "Guatemala"]);
  });
});
