import type { Dimension } from "@/lib/quality/rules";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  completeness: "Completitud",
  validity: "Validez",
  timeliness: "Oportunidad",
};

export const DIMENSION_QUESTIONS: Record<Dimension, string> = {
  completeness: "¿Están todos los datos obligatorios?",
  validity: "¿Los valores tienen sentido?",
  timeliness: "¿El dato llegó a tiempo?",
};
