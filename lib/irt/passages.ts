/**
 * Level-preset reading passages.
 * When a GLEAS level is selected, generation uses these fixed passages
 * and only invents IRT items (not new passage text).
 */
import * as fs from "fs";
import * as path from "path";
import type { IrtLevel, ReadingQuestionType } from "@/lib/irt/types";
import { READING_TYPE_PRIORITY } from "@/lib/irt/types";

export interface PresetPassage {
  id: string;
  level: number;
  cefr: string;
  wordCount: number;
  targetB: number;
  source: string;
  title: string;
  text: string;
  order: number;
  suggestedQuestionTypes: ReadingQuestionType[];
}

interface LevelBlock {
  level: number;
  passageCount: number;
  passages: PresetPassage[];
}

interface PassageFile {
  version: string;
  description?: string;
  policy?: Record<string, unknown>;
  levels: Record<string, LevelBlock>;
}

const FILE = path.join(
  process.cwd(),
  "data",
  "reading-passages",
  "passages-by-level.json"
);

let cache: PassageFile | null = null;

function load(): PassageFile {
  if (cache) return cache;
  if (!fs.existsSync(FILE)) {
    cache = { version: "0", levels: {} };
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(FILE, "utf-8")) as PassageFile;
  return cache;
}

export function getPassagesForLevel(level: IrtLevel): PresetPassage[] {
  const block = load().levels[String(level)];
  if (!block?.passages?.length) return [];
  return [...block.passages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getPassageById(
  level: IrtLevel,
  passageId: string
): PresetPassage | null {
  return getPassagesForLevel(level).find((p) => p.id === passageId) ?? null;
}

/**
 * Select passages for a generation session.
 * - If passageIds provided, use those (validated against level)
 * - Else take the first `count` presets in order (stable assignment)
 */
export function selectSessionPassages(opts: {
  level: IrtLevel;
  count?: number;
  passageIds?: string[];
}): PresetPassage[] {
  const all = getPassagesForLevel(opts.level);
  if (all.length === 0) return [];

  if (opts.passageIds?.length) {
    const picked: PresetPassage[] = [];
    for (const id of opts.passageIds) {
      const p = all.find((x) => x.id === id);
      if (p) picked.push(p);
    }
    return picked.length > 0 ? picked : all.slice(0, opts.count ?? 2);
  }

  const n = Math.min(opts.count ?? 2, all.length);
  return all.slice(0, n);
}

/** Assign question types across items for balanced reading skills. */
export function planReadingItemSlots(
  passages: PresetPassage[],
  totalItems: number
): Array<{ passage: PresetPassage; questionType: ReadingQuestionType; slot: number }> {
  if (passages.length === 0 || totalItems <= 0) return [];

  const types = READING_TYPE_PRIORITY.filter((t) => t !== "vocabulary" && t !== "other");
  const slots: Array<{
    passage: PresetPassage;
    questionType: ReadingQuestionType;
    slot: number;
  }> = [];

  for (let i = 0; i < totalItems; i++) {
    const passage = passages[i % passages.length];
    const preferred = passage.suggestedQuestionTypes?.length
      ? passage.suggestedQuestionTypes
      : types;
    const questionType = preferred[i % preferred.length] as ReadingQuestionType;
    slots.push({ passage, questionType, slot: i + 1 });
  }
  return slots;
}

export function passageBankMeta(): {
  version: string;
  levels: Array<{ level: number; passageCount: number; titles: string[] }>;
} {
  const file = load();
  const levels = [1, 2, 3, 4, 5, 6].map((lv) => {
    const ps = getPassagesForLevel(lv as IrtLevel);
    return {
      level: lv,
      passageCount: ps.length,
      titles: ps.map((p) => p.title),
    };
  });
  return { version: file.version, levels };
}
