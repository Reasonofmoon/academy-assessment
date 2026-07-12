/**
 * Deterministic validators for IRT-principled AI items.
 * Mirrors the spirit of echobridge item-validator (fail-safe).
 */
import type { IrtGeneratedItem } from "@/lib/irt/types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const SENSITIVE =
  /\b(rape|porn|prostitute|orgasm|penis|intercourse|erotic)\b/i;

export function validateIrtItem(item: IrtGeneratedItem): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!item.question?.trim()) errors.push("EMPTY_QUESTION");
  if (item.question && item.question.length < 10) errors.push("QUESTION_TOO_SHORT");

  if (item.type === "multiple_choice") {
    if (!item.options || item.options.length !== 4) {
      errors.push("MCQ_NEEDS_4_OPTIONS");
    } else {
      const trimmed = item.options.map((o) => o.trim());
      if (trimmed.some((o) => !o)) errors.push("EMPTY_OPTION");
      if (new Set(trimmed.map((o) => o.toLowerCase())).size < 4) {
        errors.push("DUPLICATE_OPTIONS");
      }
      const idx = Number(item.answer);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
        errors.push("INVALID_ANSWER_INDEX");
      }
    }
  } else {
    if (!item.answer?.trim()) errors.push("EMPTY_SHORT_ANSWER");
  }

  const { a, b, c } = item.irt;
  if (a < 0.5) warnings.push("LOW_DISCRIMINATION_A");
  if (a > 2.8) warnings.push("VERY_HIGH_DISCRIMINATION_A");
  if (b < -3.2 || b > 3.2) warnings.push("B_OUT_OF_TYPICAL_RANGE");
  if (item.type === "multiple_choice" && (c < 0.15 || c > 0.35)) {
    warnings.push("C_UNUSUAL_FOR_MCQ");
  }

  if (item.domain === "reading" && !item.passage?.trim()) {
    // short reading items may embed passage in question — warn only
    if (!/passage|지문|다음 글/i.test(item.question)) {
      warnings.push("READING_MISSING_PASSAGE");
    }
  }

  if (item.domain === "vocabulary" && item.dimension === "D6_Cloze") {
    if (!/_{2,}|\(\s*\)|空白|빈칸|blank/i.test(item.question)) {
      warnings.push("CLOZE_WITHOUT_BLANK");
    }
  }

  if (SENSITIVE.test(item.question) || item.options?.some((o) => SENSITIVE.test(o))) {
    errors.push("SENSITIVE_CONTENT");
  }

  // Target alignment: |b - targetTheta| ideally < 1.0 for information
  if (Math.abs(item.irt.b - item.targetTheta) > 1.5) {
    warnings.push("B_FAR_FROM_TARGET_THETA");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function filterValidItems(
  items: IrtGeneratedItem[]
): { valid: IrtGeneratedItem[]; rejected: IrtGeneratedItem[] } {
  const valid: IrtGeneratedItem[] = [];
  const rejected: IrtGeneratedItem[] = [];
  for (const item of items) {
    const v = validateIrtItem(item);
    const withVal = { ...item, validation: v };
    if (v.ok) valid.push(withVal);
    else rejected.push(withVal);
  }
  return { valid, rejected };
}
