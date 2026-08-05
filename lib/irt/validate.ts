/**
 * Deterministic validators for IRT-principled AI items.
 * Mirrors the spirit of echobridge item-validator (fail-safe).
 */
import type { IrtGeneratedItem } from "@/lib/irt/types";
import { isIncompleteVocabStem } from "@/lib/format-question";

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

  // Incomplete stems (e.g. "한글 뜻에 맞는 단어를 고르시오." with no meaning line)
  if (item.domain === "vocabulary" && item.question && isIncompleteVocabStem(item.question)) {
    errors.push("INCOMPLETE_VOCAB_STEM");
  }

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

  // Weak cloze: very short blank sentence + all single adjectives/adverbs (often multi-key)
  if (
    item.domain === "vocabulary" &&
    item.type === "multiple_choice" &&
    item.options?.length === 4 &&
    /_{2,}|_____/.test(item.question)
  ) {
    const lines = item.question.split("\n").map((l) => l.trim()).filter(Boolean);
    const blankLine = lines.find((l) => /_{2,}|_____/.test(l)) ?? "";
    const opts = item.options.map((o) => o.trim());
    const allShortAdj =
      opts.every((o) => /^[A-Za-z]+$/.test(o) && o.length <= 12) &&
      blankLine.split(/\s+/).length <= 6;
    if (allShortAdj && /very\s+_{2,}|very\s+_____|is\s+_{2,}|is\s+_____/i.test(blankLine)) {
      warnings.push("CLOZE_MULTIKEY_RISK");
    }
  }

  // Grammar -s / agreement without tense stated
  if (
    item.domain === "grammar" &&
    /동사에\s*-?s|3인칭|-s가\s*올바/i.test(item.question) &&
    !/현재시제|과거시제|present\s*tense|past\s*tense/i.test(item.question)
  ) {
    warnings.push("GRAMMAR_TENSE_UNSPECIFIED");
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
