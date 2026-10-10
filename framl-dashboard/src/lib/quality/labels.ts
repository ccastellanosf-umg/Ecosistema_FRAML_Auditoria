import type { Dimension } from "@/lib/quality/rules";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  completeness: "Completitud",
  validity: "Validez",
  timeliness: "Oportunidad",
  integrity: "Integridad referencial",
};

export const DIMENSION_QUESTIONS: Record<Dimension, string> = {
  completeness: "¿Están todos los datos obligatorios?",
  validity: "¿Los valores tienen sentido?",
  timeliness: "¿El dato llegó a tiempo?",
  integrity: "¿El cliente existe en el maestro?",
};

export const STATUS_LABELS = {
  pass: "Cumple",
  fail: "No cumple",
  na: "No aplica",
  not_evaluable: "No evaluable",
} as const;
