/**
 * Refined IRT exemplar bank loader (echobridge curated service sample).
 * Server-only — uses fs.
 */
import * as fs from "fs";
import * as path from "path";
import type { Domain } from "@/lib/types";
import type {
  Exemplar,
  IrtLevel,
  ReadingQuestionType,
  VocabDimension,
} from "@/lib/irt/types";
import { READING_TYPE_PRIORITY } from "@/lib/irt/types";

const DATA_DIR = path.join(process.cwd(), "data", "irt-exemplars");

let vocabCache: Exemplar[] | null = null;
let readingCache: Exemplar[] | null = null;
let manifestCache: Record<string, unknown> | null = null;

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
  return JSON.parse(raw) as T;
}

export function getManifest(): Record<string, unknown> {
  if (!manifestCache) {
    manifestCache = readJson<Record<string, unknown>>("manifest.json");
  }
  return manifestCache ?? {};
}

export function getVocabExemplars(): Exemplar[] {
  if (!vocabCache) {
    vocabCache = readJson<Exemplar[]>("vocab-exemplars.json");
  }
  return vocabCache;
}

export function getReadingExemplars(): Exemplar[] {
  if (!readingCache) {
    readingCache = readJson<Exemplar[]>("reading-exemplars.json");
  }
  return readingCache;
}

export function getLevelAnchor(level: IrtLevel): {
  name: string;
  thetaCenter: number;
  cefr: string;
} {
  const anchors = (getManifest().levelAnchors ?? {}) as Record<
    string,
    { name: string; thetaCenter: number; cefr: string }
  >;
  const a = anchors[String(level)];
  if (!a) {
    return { name: `L${level}`, thetaCenter: 0, cefr: "B1" };
  }
  return a;
}

/**
 * Sample few-shot exemplars near target difficulty for a domain.
 */
export function selectExemplars(opts: {
  domain: Domain;
  level: IrtLevel;
  count?: number;
  dimension?: VocabDimension;
  questionType?: ReadingQuestionType;
}): Exemplar[] {
  const count = opts.count ?? 3;
  if (opts.domain === "vocabulary") {
    return selectVocab(opts.level, count, opts.dimension);
  }
  if (opts.domain === "reading") {
    return selectReading(opts.level, count, opts.questionType);
  }
  // grammar: no refined bank yet — reuse vocab context/usage exemplars as style refs
  return selectVocab(opts.level, count, opts.dimension ?? "D5_Usage");
}

function selectVocab(
  level: IrtLevel,
  count: number,
  dimension?: VocabDimension
): Exemplar[] {
  const all = getVocabExemplars().filter((e) => e.level === level);
  let pool = dimension ? all.filter((e) => e.dimension === dimension) : all;
  if (pool.length === 0) pool = all;
  if (pool.length === 0) {
    // fallback adjacent levels
    pool = getVocabExemplars().filter(
      (e) => e.level === level - 1 || e.level === level + 1
    );
  }
  return stratifiedByDimension(pool, count);
}

function selectReading(
  level: IrtLevel,
  count: number,
  questionType?: ReadingQuestionType
): Exemplar[] {
  const all = getReadingExemplars().filter((e) => e.level === level);
  let pool = questionType
    ? all.filter((e) => e.questionType === questionType)
    : all.filter((e) => e.questionType !== "vocabulary");
  if (pool.length < count) pool = all;
  if (pool.length === 0) {
    pool = getReadingExemplars().filter(
      (e) => e.level === level - 1 || e.level === level + 1
    );
  }
  // Prefer higher-priority question types
  const ranked = [...pool].sort((a, b) => {
    const ia = READING_TYPE_PRIORITY.indexOf(
      (a.questionType as ReadingQuestionType) || "other"
    );
    const ib = READING_TYPE_PRIORITY.indexOf(
      (b.questionType as ReadingQuestionType) || "other"
    );
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return ranked.slice(0, count);
}

function stratifiedByDimension(pool: Exemplar[], count: number): Exemplar[] {
  const byDim = new Map<string, Exemplar[]>();
  for (const e of pool) {
    const k = e.dimension || "unknown";
    const arr = byDim.get(k) ?? [];
    arr.push(e);
    byDim.set(k, arr);
  }
  const dims = [...byDim.keys()];
  const out: Exemplar[] = [];
  let i = 0;
  while (out.length < count && dims.length > 0) {
    const dim = dims[i % dims.length];
    const arr = byDim.get(dim)!;
    if (arr.length > 0) {
      out.push(arr.shift()!);
    }
    if (arr.length === 0) {
      dims.splice(dims.indexOf(dim), 1);
      if (dims.length === 0) break;
      i = i % dims.length;
      continue;
    }
    i++;
  }
  return out;
}

export function bankSummary(): {
  vocab: number;
  reading: number;
  version: string;
  sourceRepo: string;
} {
  const m = getManifest();
  return {
    vocab: getVocabExemplars().length,
    reading: getReadingExemplars().length,
    version: String(m.version ?? "?"),
    sourceRepo: String(m.sourceRepo ?? "echobridge-web"),
  };
}
