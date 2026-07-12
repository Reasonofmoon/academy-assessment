/**
 * Level-preset reading passages + generation slot config.
 * When a GLEAS level is selected, generation uses fixed passages
 * and IRT items only (not new passage text).
 */
import * as fs from "fs";
import * as path from "path";
import type { Domain } from "@/lib/types";
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

export interface LevelGenConfig {
  itemsPerReading: number;
  passagesPerSession: number;
  questionTypeSlots: ReadingQuestionType[];
}

export interface GenerationConfig {
  version: string;
  description?: string;
  defaults: {
    countPerDomain: Record<Domain, number>;
    passagesPerSession: number;
    maxPassagesPerSession: number;
  };
  levels: Record<string, LevelGenConfig>;
}

interface LevelBlock {
  level: number;
  passageCount: number;
  passages: PresetPassage[];
}

export interface PassageFile {
  version: string;
  description?: string;
  policy?: Record<string, unknown>;
  levels: Record<string, LevelBlock>;
}

const DATA_DIR = path.join(process.cwd(), "data", "reading-passages");
const PASSAGE_FILE = path.join(DATA_DIR, "passages-by-level.json");
const CONFIG_FILE = path.join(DATA_DIR, "generation-config.json");

const QTYPES: ReadingQuestionType[] = [
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
];

let passageCache: PassageFile | null = null;
let configCache: GenerationConfig | null = null;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPassages(): PassageFile {
  if (passageCache) return passageCache;
  if (!fs.existsSync(PASSAGE_FILE)) {
    passageCache = { version: "0", levels: {} };
    return passageCache;
  }
  passageCache = JSON.parse(fs.readFileSync(PASSAGE_FILE, "utf-8")) as PassageFile;
  return passageCache;
}

function savePassages(file: PassageFile): void {
  ensureDir();
  file.version = file.version || "1.0.0";
  const tmp = `${PASSAGE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, PASSAGE_FILE);
  passageCache = file;
}

function defaultConfig(): GenerationConfig {
  const mk = (items: number, slots: ReadingQuestionType[]): LevelGenConfig => ({
    itemsPerReading: items,
    passagesPerSession: 2,
    questionTypeSlots: slots,
  });
  return {
    version: "1.0.0",
    defaults: {
      countPerDomain: { vocabulary: 5, grammar: 5, reading: 5 },
      passagesPerSession: 2,
      maxPassagesPerSession: 3,
    },
    levels: {
      "1": mk(4, ["main_idea", "detail", "inference", "detail"]),
      "2": mk(5, ["main_idea", "detail", "inference", "purpose", "detail"]),
      "3": mk(5, ["main_idea", "detail", "inference", "purpose", "attitude"]),
      "4": mk(5, ["main_idea", "inference", "detail", "purpose", "attitude"]),
      "5": mk(5, ["main_idea", "inference", "detail", "purpose", "attitude"]),
      "6": mk(5, ["main_idea", "inference", "detail", "purpose", "attitude"]),
    },
  };
}

export function loadGenerationConfig(): GenerationConfig {
  if (configCache) return configCache;
  if (!fs.existsSync(CONFIG_FILE)) {
    configCache = defaultConfig();
    return configCache;
  }
  try {
    configCache = JSON.parse(
      fs.readFileSync(CONFIG_FILE, "utf-8")
    ) as GenerationConfig;
  } catch {
    configCache = defaultConfig();
  }
  return configCache;
}

export function saveGenerationConfig(cfg: GenerationConfig): GenerationConfig {
  ensureDir();
  // normalize slots
  for (const [k, lv] of Object.entries(cfg.levels || {})) {
    lv.itemsPerReading = Math.min(10, Math.max(1, Number(lv.itemsPerReading) || 5));
    lv.passagesPerSession = Math.min(5, Math.max(1, Number(lv.passagesPerSession) || 2));
    lv.questionTypeSlots = (lv.questionTypeSlots || [])
      .map((t) => String(t) as ReadingQuestionType)
      .filter((t) => QTYPES.includes(t));
    if (lv.questionTypeSlots.length === 0) {
      lv.questionTypeSlots = ["main_idea", "detail", "inference"];
    }
    // pad/truncate slots to itemsPerReading
    while (lv.questionTypeSlots.length < lv.itemsPerReading) {
      lv.questionTypeSlots.push(
        lv.questionTypeSlots[lv.questionTypeSlots.length % lv.questionTypeSlots.length]
      );
    }
    lv.questionTypeSlots = lv.questionTypeSlots.slice(0, lv.itemsPerReading);
    cfg.levels[k] = lv;
  }
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, CONFIG_FILE);
  configCache = cfg;
  return cfg;
}

export function getLevelGenConfig(level: IrtLevel): LevelGenConfig {
  const cfg = loadGenerationConfig();
  return (
    cfg.levels[String(level)] ?? {
      itemsPerReading: cfg.defaults.countPerDomain.reading ?? 5,
      passagesPerSession: cfg.defaults.passagesPerSession ?? 2,
      questionTypeSlots: ["main_idea", "detail", "inference", "purpose", "attitude"],
    }
  );
}

export function getDefaultCountForDomain(
  domain: Domain,
  level?: IrtLevel
): number {
  const cfg = loadGenerationConfig();
  if (domain === "reading" && level) {
    return getLevelGenConfig(level).itemsPerReading;
  }
  return cfg.defaults.countPerDomain[domain] ?? 5;
}

export function invalidatePassageCache(): void {
  passageCache = null;
}

export function getPassagesForLevel(level: IrtLevel): PresetPassage[] {
  const block = loadPassages().levels[String(level)];
  if (!block?.passages?.length) return [];
  return [...block.passages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getPassageById(
  level: IrtLevel,
  passageId: string
): PresetPassage | null {
  return getPassagesForLevel(level).find((p) => p.id === passageId) ?? null;
}

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

/**
 * Assign question types across items.
 * Prefer explicit slot list (from config or request); else round-robin.
 */
export function planReadingItemSlots(
  passages: PresetPassage[],
  totalItems: number,
  questionTypeSlots?: ReadingQuestionType[]
): Array<{ passage: PresetPassage; questionType: ReadingQuestionType; slot: number }> {
  if (passages.length === 0 || totalItems <= 0) return [];

  const types = READING_TYPE_PRIORITY.filter(
    (t) => t !== "vocabulary" && t !== "other"
  );
  const slots: Array<{
    passage: PresetPassage;
    questionType: ReadingQuestionType;
    slot: number;
  }> = [];

  for (let i = 0; i < totalItems; i++) {
    const passage = passages[i % passages.length];
    let questionType: ReadingQuestionType;
    if (questionTypeSlots && questionTypeSlots.length > 0) {
      questionType = questionTypeSlots[i % questionTypeSlots.length];
    } else {
      const preferred = passage.suggestedQuestionTypes?.length
        ? passage.suggestedQuestionTypes
        : types;
      questionType = preferred[i % preferred.length] as ReadingQuestionType;
    }
    slots.push({ passage, questionType, slot: i + 1 });
  }
  return slots;
}

export function passageBankMeta(): {
  version: string;
  levels: Array<{ level: number; passageCount: number; titles: string[] }>;
  config: GenerationConfig;
} {
  const file = loadPassages();
  const levels = [1, 2, 3, 4, 5, 6].map((lv) => {
    const ps = getPassagesForLevel(lv as IrtLevel);
    return {
      level: lv,
      passageCount: ps.length,
      titles: ps.map((p) => p.title),
    };
  });
  return { version: file.version, levels, config: loadGenerationConfig() };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function nextPassageId(level: IrtLevel, existing: PresetPassage[]): string {
  let n = existing.length + 1;
  const ids = new Set(existing.map((p) => p.id));
  while (ids.has(`preset-L${level}-P${String(n).padStart(2, "0")}`)) n++;
  return `preset-L${level}-P${String(n).padStart(2, "0")}`;
}

export type PassageInput = {
  id?: string;
  title?: string;
  text: string;
  cefr?: string;
  targetB?: number;
  source?: string;
  suggestedQuestionTypes?: ReadingQuestionType[];
  order?: number;
};

export function upsertPassage(
  level: IrtLevel,
  input: PassageInput
): PresetPassage {
  const file = loadPassages();
  if (!file.levels[String(level)]) {
    file.levels[String(level)] = { level, passageCount: 0, passages: [] };
  }
  const block = file.levels[String(level)];
  const text = input.text.trim();
  if (text.length < 40) {
    throw new Error("지문은 최소 40자 이상이어야 합니다.");
  }

  let passage: PresetPassage;
  const idx = input.id
    ? block.passages.findIndex((p) => p.id === input.id)
    : -1;

  if (idx >= 0) {
    const prev = block.passages[idx];
    passage = {
      ...prev,
      title: input.title?.trim() || prev.title,
      text,
      wordCount: wordCount(text),
      cefr: input.cefr ?? prev.cefr,
      targetB:
        typeof input.targetB === "number" ? input.targetB : prev.targetB,
      source: input.source ?? prev.source,
      suggestedQuestionTypes:
        input.suggestedQuestionTypes ?? prev.suggestedQuestionTypes,
      order: input.order ?? prev.order,
      level,
    };
    block.passages[idx] = passage;
  } else {
    const id = input.id || nextPassageId(level, block.passages);
    if (block.passages.some((p) => p.id === id)) {
      throw new Error(`이미 존재하는 지문 id: ${id}`);
    }
    passage = {
      id,
      level,
      title: input.title?.trim() || `L${level} Reading Passage`,
      text,
      wordCount: wordCount(text),
      cefr: input.cefr || "B1",
      targetB: typeof input.targetB === "number" ? input.targetB : 0,
      source: input.source || "manual",
      suggestedQuestionTypes: input.suggestedQuestionTypes?.length
        ? input.suggestedQuestionTypes
        : ["main_idea", "detail", "inference", "purpose"],
      order: input.order ?? block.passages.length + 1,
    };
    block.passages.push(passage);
  }

  block.passages.sort((a, b) => a.order - b.order);
  block.passageCount = block.passages.length;
  block.level = level;
  savePassages(file);
  return passage;
}

export function deletePassage(level: IrtLevel, passageId: string): boolean {
  const file = loadPassages();
  const block = file.levels[String(level)];
  if (!block) return false;
  const before = block.passages.length;
  block.passages = block.passages.filter((p) => p.id !== passageId);
  if (block.passages.length === before) return false;
  block.passages.forEach((p, i) => {
    p.order = i + 1;
  });
  block.passageCount = block.passages.length;
  savePassages(file);
  return true;
}

export function reorderPassages(level: IrtLevel, orderedIds: string[]): void {
  const file = loadPassages();
  const block = file.levels[String(level)];
  if (!block) throw new Error("level not found");
  const map = new Map(block.passages.map((p) => [p.id, p]));
  const next: PresetPassage[] = [];
  for (const id of orderedIds) {
    const p = map.get(id);
    if (p) next.push(p);
  }
  // append any missing
  for (const p of block.passages) {
    if (!orderedIds.includes(p.id)) next.push(p);
  }
  next.forEach((p, i) => {
    p.order = i + 1;
  });
  block.passages = next;
  block.passageCount = next.length;
  savePassages(file);
}

export { QTYPES as READING_QUESTION_TYPES };
