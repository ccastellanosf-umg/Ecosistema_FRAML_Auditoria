import type { ResultStatus } from "@/lib/quality/rules";
import { STATUS_LABELS } from "@/lib/quality/labels";

const STYLES: Record<ResultStatus, { icon: string; badge: string; iconColor: string }> = {
  pass: { icon: "✓", badge: "border-status-good/40", iconColor: "text-status-good" },
  fail: { icon: "✕", badge: "border-status-critical/40 bg-status-critical/10", iconColor: "text-status-critical" },
  na: { icon: "–", badge: "border-border", iconColor: "text-muted" },
  not_evaluable: { icon: "?", badge: "border-border border-dashed", iconColor: "text-muted" },
};

export function StatusBadge({ status }: { status: ResultStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs text-primary ${style.badge}`}
    >
      <span aria-hidden className={style.iconColor}>
        {style.icon}
      </span>
      {STATUS_LABELS[status]}
    </span>
  );
}
