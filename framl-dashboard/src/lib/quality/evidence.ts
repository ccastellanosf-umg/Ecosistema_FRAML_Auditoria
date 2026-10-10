import { DIMENSION_LABELS, STATUS_LABELS } from "./labels";
import type { QualityReport } from "./rules";

export type EvidenceMeta = {
  executedAt: Date;
  mode: "real" | "demo";
  rulesVersion: string;
};

const HEADER = [
  "fecha_ejecucion",
  "modo",
  "version_reglas",
  "nivel",
  "regla_id",
  "dimension",
  "regla",
  "aplicables",
  "conformes",
  "fallidos",
  "no_evaluables",
  "resultado",
  "umbral",
  "motivo",
  "registros_afectados",
];

// Spreadsheets execute cells starting with these characters as formulas (CSV injection).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: string | number): string {
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const toLine = (cells: (string | number)[]) => cells.map(escapeCell).join(",");
const percent = (value: number) => `${Math.round(value * 100)}%`;

// Common evidence record defined by the catalog: one line per rule and per dimension.
export function buildEvidenceCsv(report: QualityReport, meta: EvidenceMeta): string {
  const base = [meta.executedAt.toISOString(), meta.mode, meta.rulesVersion];

  const dimensionLines = report.dimensions.map((dimension) => {
    const failedIds = report.rows
      .filter(({ issues }) => issues.some((issue) => issue.dimension === dimension.dimension))
      .map(({ row }) => Number(row.id_transaccion));
    return toLine([
      ...base,
      "dimension",
      "",
      DIMENSION_LABELS[dimension.dimension],
      "(todas)",
      dimension.total,
      dimension.passed,
      dimension.total - dimension.passed,
      "",
      STATUS_LABELS[dimension.status],
      "",
      "",
      failedIds.join(" "),
    ]);
  });

  const ruleLines = report.rules.map((rule) =>
    toLine([
      ...base,
      "regla",
      rule.id,
      DIMENSION_LABELS[rule.dimension],
      rule.description,
      rule.applicable,
      rule.passed,
      rule.failed,
      rule.notEvaluable,
      STATUS_LABELS[rule.status],
      percent(rule.threshold),
      rule.reason ?? "",
      rule.failedRowIds.join(" "),
    ]),
  );

  return `﻿${[toLine(HEADER), ...dimensionLines, ...ruleLines].join("\r\n")}\r\n`;
}
