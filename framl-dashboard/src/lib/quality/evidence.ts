import { DIMENSION_LABELS } from "./labels";
import type { QualityReport } from "./rules";

export type EvidenceMeta = {
  executedAt: Date;
  mode: "real" | "demo";
  rulesVersion: string;
};

// Until per-rule thresholds are defined in the catalog (D-10), every rule must reach 100%.
const THRESHOLD = "100%";

const HEADER = [
  "fecha_ejecucion",
  "modo",
  "version_reglas",
  "nivel",
  "dimension",
  "regla",
  "aplicables",
  "conformes",
  "fallidos",
  "resultado",
  "umbral",
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

export function buildEvidenceCsv(report: QualityReport, meta: EvidenceMeta): string {
  const total = report.rows.length;
  const base = [meta.executedAt.toISOString(), meta.mode, meta.rulesVersion];
  const result = (failed: number) => (failed === 0 ? "Cumple" : "No cumple");

  const dimensionLines = report.dimensions.map((score) => {
    const failedIds = report.rows
      .filter(({ issues }) => issues.some((issue) => issue.dimension === score.dimension))
      .map(({ row }) => Number(row.id_transaccion));
    const failed = score.total - score.passed;
    return toLine([
      ...base,
      "dimension",
      DIMENSION_LABELS[score.dimension],
      "(todas)",
      score.total,
      score.passed,
      failed,
      result(failed),
      THRESHOLD,
      failedIds.join(" "),
    ]);
  });

  const ruleLines = report.failuresByRule.map((failure) => {
    const affected = [...new Set(failure.rowIds)];
    return toLine([
      ...base,
      "regla",
      DIMENSION_LABELS[failure.dimension],
      failure.message,
      total,
      total - affected.length,
      affected.length,
      result(affected.length),
      THRESHOLD,
      affected.join(" "),
    ]);
  });

  return `﻿${[toLine(HEADER), ...dimensionLines, ...ruleLines].join("\r\n")}\r\n`;
}
