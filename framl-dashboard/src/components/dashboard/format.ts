const TIME_ZONE = "America/Guatemala";

const currency = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
const compactCurrency = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateTime = new Intl.DateTimeFormat("es-GT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export const formatCurrency = (value: number) => currency.format(value);
export const formatCompactCurrency = (value: number) => compactCurrency.format(value);
export const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}
