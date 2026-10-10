// Synthetic rows with deliberately injected errors, used only to preview how the
// quality dashboard flags each rule. They are never written to the database.
export function buildDemoRows(now: Date): Record<string, unknown>[] {
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

  return [
    {
      id_transaccion: 9001,
      id_cliente: 1,
      monto_txn: null,
      fecha_hora_txn: daysFromNow(-2),
      pais_contraparte: "Guatemala",
      canal_tx: "Web",
      id_dispositivo: "DEV-PC-901",
    },
    {
      id_transaccion: 9002,
      id_cliente: 2,
      monto_txn: -350,
      fecha_hora_txn: daysFromNow(-2),
      pais_contraparte: "México",
      canal_tx: "App móvil",
      id_dispositivo: "DEV-MOB-902",
    },
    {
      id_transaccion: 9003,
      id_cliente: 3,
      monto_txn: 1800,
      fecha_hora_txn: daysFromNow(-1),
      pais_contraparte: "Narnia",
      canal_tx: "Fax",
      id_dispositivo: "dev mob 903",
    },
    {
      id_transaccion: 9004,
      id_cliente: 4,
      monto_txn: 5200,
      fecha_hora_txn: daysFromNow(30),
      pais_contraparte: "Panamá",
      canal_tx: "Web",
      id_dispositivo: "DEV-PC-904",
    },
    {
      id_transaccion: 9005,
      id_cliente: null,
      monto_txn: 640,
      fecha_hora_txn: daysFromNow(-3),
      pais_contraparte: "",
      canal_tx: "Cajero",
      id_dispositivo: "ATM-GT-905",
    },
    {
      id_transaccion: 9006,
      id_cliente: 6,
      monto_txn: 2750,
      fecha_hora_txn: daysFromNow(-4),
      pais_contraparte: "Colombia",
      canal_tx: "App móvil",
      id_dispositivo: "DEV-MOB-906",
      fecha_carga: daysFromNow(-2),
    },
  ];
}
