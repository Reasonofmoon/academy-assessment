/**
 * MCQ answer-key balancing: keep the correct option text, move it to a
 * target index so keys are roughly uniform (≈1/n for n-option items).
 */
import type { IrtGeneratedItem } from "@/lib/irt/types";

/** Fisher–Yates shuffle (mutates copy). */
export function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Move the option currently at `from` to index `to` (other items shift).
 * Returns new options array and the new correct index (= to).
 */
export function moveOptionToIndex(
  options: string[],
  from: number,
  to: number
): { options: string[]; answerIndex: number } {
  if (
    from < 0 ||
    to < 0 ||
    from >= options.length ||
    to >= options.length ||
    from === to
  ) {
    return { options: [...options], answerIndex: from };
  }
  const next = [...options];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return { options: next, answerIndex: to };
}

/** Swap so that the correct option lands at `targetIndex`. */
export function placeCorrectAt(
  options: string[],
  correctIndex: number,
  targetIndex: number
): { options: string[]; answerIndex: number } {
  if (
    options.length === 0 ||
    correctIndex < 0 ||
    correctIndex >= options.length ||
    targetIndex < 0 ||
    targetIndex >= options.length
  ) {
    return { options: [...options], answerIndex: Math.max(0, correctIndex) };
  }
  if (correctIndex === targetIndex) {
    return { options: [...options], answerIndex: correctIndex };
  }
  const next = [...options];
  [next[correctIndex], next[targetIndex]] = [next[targetIndex], next[correctIndex]];
  return { options: next, answerIndex: targetIndex };
}

/**
 * Build target answer indices for a batch so counts are as even as possible.
 * e.g. 30 items, 4 options → [0..3] each ~7–8 times.
 */
export function planBalancedAnswerKeys(
  itemCount: number,
  optionCount: number,
  rng: () => number = Math.random
): number[] {
  if (itemCount <= 0 || optionCount <= 0) return [];
  const base = Math.floor(itemCount / optionCount);
  const rem = itemCount % optionCount;
  const keys: number[] = [];
  for (let k = 0; k < optionCount; k++) {
    const n = base + (k < rem ? 1 : 0);
    for (let i = 0; i < n; i++) keys.push(k);
  }
  return shuffleInPlace(keys, rng);
}

export function parseAnswerIndex(answer: string | number | undefined, n: number): number {
  const idx = Number(answer);
  if (Number.isInteger(idx) && idx >= 0 && idx < n) return idx;
  return 0;
}

/**
 * Rebalance MCQ items in a list: redistribute correct keys evenly across options.
 * Non-MCQ items are left unchanged. Correct option *text* is preserved.
 */
export function rebalanceMcqAnswerKeys<
  T extends {
    type?: string;
    options?: string[];
    answer?: string;
  },
>(items: T[], rng: () => number = Math.random): T[] {
  const mcqIdx: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (
      (it.type === "multiple_choice" || it.type == null) &&
      Array.isArray(it.options) &&
      it.options.length >= 2
    ) {
      mcqIdx.push(i);
    }
  }
  if (mcqIdx.length === 0) return items;

  // Group by option arity so 4-choice and 5-choice balance separately.
  const byArity = new Map<number, number[]>();
  for (const i of mcqIdx) {
    const n = items[i].options!.length;
    const list = byArity.get(n) ?? [];
    list.push(i);
    byArity.set(n, list);
  }

  const out = items.map((it) => ({ ...it }));
  for (const [nOpts, indices] of byArity) {
    const targets = planBalancedAnswerKeys(indices.length, nOpts, rng);
    indices.forEach((itemIndex, j) => {
      const it = out[itemIndex];
      const opts = [...(it.options ?? [])];
      const from = parseAnswerIndex(it.answer, opts.length);
      const to = targets[j] ?? 0;
      const placed = placeCorrectAt(opts, from, to);
      out[itemIndex] = {
        ...it,
        options: placed.options,
        answer: String(placed.answerIndex),
      };
    });
  }
  return out;
}

/**
 * Rebalance IRT items and refresh validation if present.
 */
export function rebalanceIrtItems(
  items: IrtGeneratedItem[],
  validate?: (item: IrtGeneratedItem) => IrtGeneratedItem["validation"],
  rng: () => number = Math.random
): IrtGeneratedItem[] {
  const balanced = rebalanceMcqAnswerKeys(items, rng);
  if (!validate) return balanced as IrtGeneratedItem[];
  return balanced.map((it) => {
    const next = { ...it } as IrtGeneratedItem;
    next.validation = validate(next);
    return next;
  });
}

/** Count answer indices for reporting. */
export function answerKeyHistogram(
  items: Array<{ type?: string; options?: string[]; answer?: string }>
): Record<string, number> {
  const hist: Record<string, number> = {};
  for (const it of items) {
    if (!Array.isArray(it.options) || it.options.length < 2) continue;
    if (it.type && it.type !== "multiple_choice") continue;
    const k = String(parseAnswerIndex(it.answer, it.options.length));
    hist[k] = (hist[k] || 0) + 1;
  }
  return hist;
}
