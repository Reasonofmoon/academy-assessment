/**
 * Generated item bank — JSON file store (local / long-running Node).
 * Path: data/generated-bank/items.json
 *
 * Note: On Vercel serverless the filesystem is ephemeral. Use a persistent
 * volume or migrate to Supabase for multi-instance production.
 */
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { DOMAINS } from "@/lib/types";
import { IrtParamsSchema, VocabDimensionSchema, ReadingQuestionTypeSchema } from "@/lib/irt/types";

export const BANK_STATUSES = ["pending", "approved", "quarantine"] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

export const BankItemSchema = z.object({
  id: z.string(),
  domain: z.enum(DOMAINS),
  type: z.enum(["multiple_choice", "short_answer"]),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  explanation: z.string(),
  level: z.number().int().min(1).max(6),
  targetTheta: z.number(),
  irt: IrtParamsSchema,
  irtSource: z.string(),
  dimension: VocabDimensionSchema.optional(),
  questionType: ReadingQuestionTypeSchema.optional(),
  headword: z.string().optional(),
  passage: z.string().optional(),
  exemplarIds: z.array(z.string()).optional(),
  validation: z
    .object({
      ok: z.boolean(),
      warnings: z.array(z.string()),
      errors: z.array(z.string()),
    })
    .optional(),
  status: z.enum(BANK_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  grade: z.string().optional(),
  reviewNote: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  batchId: z.string().optional(),
});
export type BankItem = z.infer<typeof BankItemSchema>;

export interface BankFile {
  version: string;
  updatedAt: string;
  items: BankItem[];
}

const BANK_DIR = path.join(process.cwd(), "data", "generated-bank");
const BANK_FILE = path.join(BANK_DIR, "items.json");

function emptyBank(): BankFile {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    items: [],
  };
}

function ensureDir(): void {
  if (!fs.existsSync(BANK_DIR)) {
    fs.mkdirSync(BANK_DIR, { recursive: true });
  }
}

/** Simple process-local mutex to serialize read-modify-write. */
let writeChain: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function bankFilePath(): string {
  return BANK_FILE;
}

export function loadBank(): BankFile {
  ensureDir();
  if (!fs.existsSync(BANK_FILE)) {
    const bank = emptyBank();
    fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2), "utf-8");
    return bank;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(BANK_FILE, "utf-8")) as BankFile;
    if (!Array.isArray(raw.items)) return emptyBank();
    return raw;
  } catch {
    return emptyBank();
  }
}

function saveBank(bank: BankFile): void {
  ensureDir();
  bank.updatedAt = new Date().toISOString();
  const tmp = `${BANK_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(bank, null, 2), "utf-8");
  fs.renameSync(tmp, BANK_FILE);
}

export interface ListFilter {
  status?: BankStatus | "all";
  domain?: string;
  level?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export function listBankItems(filter: ListFilter = {}): {
  items: BankItem[];
  total: number;
  counts: Record<BankStatus, number>;
} {
  const bank = loadBank();
  const counts: Record<BankStatus, number> = {
    pending: 0,
    approved: 0,
    quarantine: 0,
  };
  for (const it of bank.items) {
    counts[it.status] = (counts[it.status] ?? 0) + 1;
  }

  let items = [...bank.items];
  if (filter.status && filter.status !== "all") {
    items = items.filter((i) => i.status === filter.status);
  }
  if (filter.domain) {
    items = items.filter((i) => i.domain === filter.domain);
  }
  if (typeof filter.level === "number") {
    items = items.filter((i) => i.level === filter.level);
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.question.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.headword?.toLowerCase().includes(q) ?? false) ||
        (i.passage?.toLowerCase().includes(q) ?? false)
    );
  }

  // newest first
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const total = items.length;
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? 100;
  items = items.slice(offset, offset + limit);

  return { items, total, counts };
}

export type IncomingBankItem = Omit<
  BankItem,
  "status" | "createdAt" | "updatedAt" | "reviewedAt" | "reviewedBy" | "reviewNote"
> & {
  status?: BankStatus;
  reviewNote?: string;
};

function uniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function saveItemsToBank(opts: {
  items: IncomingBankItem[];
  status?: BankStatus;
  createdBy?: string;
  grade?: string;
  batchId?: string;
}): Promise<{ saved: BankItem[]; batchId: string }> {
  return withLock(() => {
    const bank = loadBank();
    const ids = new Set(bank.items.map((i) => i.id));
    const now = new Date().toISOString();
    const batchId = opts.batchId ?? `batch-${Date.now()}`;
    const status = opts.status ?? "pending";
    const saved: BankItem[] = [];

    for (const raw of opts.items) {
      if (!raw.question?.trim() || !raw.id) {
        throw new Error("문항 id/question 이 비어 있습니다.");
      }
      const id = uniqueId(raw.id, ids);
      ids.add(id);

      const candidate: BankItem = {
        id,
        domain: raw.domain,
        type: raw.type,
        question: raw.question,
        options: raw.options ?? [],
        answer: raw.answer,
        explanation: raw.explanation ?? "",
        level: raw.level,
        targetTheta: raw.targetTheta,
        irt: raw.irt,
        irtSource: raw.irtSource,
        dimension: raw.dimension,
        questionType: raw.questionType,
        headword: raw.headword,
        passage: raw.passage,
        exemplarIds: raw.exemplarIds,
        validation: raw.validation,
        status,
        createdAt: now,
        updatedAt: now,
        createdBy: opts.createdBy,
        grade: opts.grade ?? raw.grade,
        batchId,
      };

      const checked = BankItemSchema.safeParse(candidate);
      if (!checked.success) {
        throw new Error(
          `문항 형식 오류 (${raw.id}): ${checked.error.issues[0]?.message ?? "invalid"}`
        );
      }

      bank.items.push(checked.data);
      saved.push(checked.data);
    }

    saveBank(bank);
    return { saved, batchId };
  });
}

export async function updateBankItem(
  id: string,
  patch: {
    status?: BankStatus;
    reviewNote?: string;
    reviewedBy?: string;
    question?: string;
    options?: string[];
    answer?: string;
    explanation?: string;
    irt?: { a: number; b: number; c: number };
  }
): Promise<BankItem | null> {
  return withLock(() => {
    const bank = loadBank();
    const idx = bank.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    const prev = bank.items[idx];
    const next: BankItem = {
      ...prev,
      ...("question" in patch && patch.question !== undefined
        ? { question: patch.question }
        : {}),
      ...("options" in patch && patch.options !== undefined
        ? { options: patch.options }
        : {}),
      ...("answer" in patch && patch.answer !== undefined
        ? { answer: patch.answer }
        : {}),
      ...("explanation" in patch && patch.explanation !== undefined
        ? { explanation: patch.explanation }
        : {}),
      ...("irt" in patch && patch.irt !== undefined ? { irt: patch.irt } : {}),
      updatedAt: now,
    };

    if (patch.status) {
      next.status = patch.status;
      next.reviewedAt = now;
      next.reviewedBy = patch.reviewedBy ?? "teacher";
    }
    if (patch.reviewNote !== undefined) {
      next.reviewNote = patch.reviewNote;
    }

    bank.items[idx] = next;
    saveBank(bank);
    return next;
  });
}

export async function bulkUpdateStatus(
  ids: string[],
  status: BankStatus,
  reviewedBy?: string,
  reviewNote?: string
): Promise<number> {
  return withLock(() => {
    const bank = loadBank();
    const now = new Date().toISOString();
    const set = new Set(ids);
    let n = 0;
    bank.items = bank.items.map((it) => {
      if (!set.has(it.id)) return it;
      n++;
      return {
        ...it,
        status,
        updatedAt: now,
        reviewedAt: now,
        reviewedBy: reviewedBy ?? "teacher",
        reviewNote: reviewNote ?? it.reviewNote,
      };
    });
    saveBank(bank);
    return n;
  });
}

export function getBankItem(id: string): BankItem | null {
  return loadBank().items.find((i) => i.id === id) ?? null;
}

export function getBankStats(): {
  total: number;
  counts: Record<BankStatus, number>;
  path: string;
} {
  const { total, counts } = listBankItems({ limit: 0 });
  // recount without slice — list with limit 0 returns empty but counts full
  const bank = loadBank();
  const c: Record<BankStatus, number> = {
    pending: 0,
    approved: 0,
    quarantine: 0,
  };
  for (const it of bank.items) c[it.status]++;
  return { total: bank.items.length, counts: c, path: BANK_FILE };
}
