type StatTileProps = {
  label: string;
  value: string;
  detail?: string;
};

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-xl font-semibold tabular-nums sm:text-2xl tracking-tight text-primary">
        {value}
      </span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </div>
  );
}
