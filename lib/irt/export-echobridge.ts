/**
 * Export approved bank items → echobridge-web service JSON shapes.
 *
 * Vocab service file (per level):
 *   { level, levelName, wordCount, itemCount, words, items }
 *   item: { id, wordId, headword, level, cefr, dimension, question,
 *           options: [{id,text,isCorrect}], irtA, irtB, irtC, irtB_raw? }
 *
 * Reading service file (per level):
 *   { summary, passages: [{ id, text, wordCount, level, cefr, source,
 *       curationStatus, items: [{ id, passageId, question, options, questionType,
 *       irt:{a,b,c}, irtSource, source, curationStatus }] }] }
 */
import * as fs from "fs";
import * as path from "path";
import { loadBank, type BankItem } from "@/lib/irt/bank-store";
import { getLevelAnchor } from "@/lib/irt/bank";

export const LEVEL_NAMES: Record<number, string> = {
  1: "초등",
  2: "중학교",
  3: "고등학교",
  4: "수능어휘",
  5: "토플수준",
  6: "유학수준",
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export interface EchoVocabOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface EchoVocabItem {
  id: string;
  wordId: string;
  headword: string;
  level: number;
  cefr: string;
  dimension: string;
  question: string;
  options: EchoVocabOption[];
  irtA: number;
  irtB: number;
  irtC: number;
  irtB_raw?: number;
  /** academy provenance (ignored by echobridge loader if extra) */
  _source?: string;
  _bankId?: string;
}

export interface EchoVocabServiceFile {
  level: number;
  levelName: string;
  wordCount: number;
  itemCount: number;
  words: unknown[];
  items: EchoVocabItem[];
  summary?: {
    source: string;
    exportedAt: string;
    approvedOnly: boolean;
    academyAssessment: true;
  };
}

export interface EchoReadingOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface EchoReadingItem {
  id: string;
  passageId: string;
  question: string;
  options: EchoReadingOption[];
  questionType: string;
  irt: { a: number; b: number; c: number };
  irtSource: string;
  source: string;
  curationStatus: "approved";
  curationDecisions?: Array<{
    stage: string;
    model: string;
    decision: string;
    timestamp: string;
    confidence?: number;
    reasons?: string[];
  }>;
}

export interface EchoReadingPassage {
  id: string;
  text: string;
  wordCount: number;
  level: number;
  cefr: string;
  source: string;
  curationStatus: "approved";
  curationDecisions?: EchoReadingItem["curationDecisions"];
  items: EchoReadingItem[];
}

export interface EchoReadingServiceFile {
  summary: {
    source: string;
    generatedAt: string;
    level: number;
    mode: string;
    passageCount: number;
    itemCount: number;
    questionTypeHistogram: Record<string, number>;
    academyAssessment: true;
    approvedOnly: boolean;
  };
  passages: EchoReadingPassage[];
}

export interface ExportResult {
  exportedAt: string;
  approvedCount: number;
  skipped: Array<{ id: string; reason: string }>;
  vocab: { level: number; itemCount: number; file: string }[];
  reading: { level: number; passageCount: number; itemCount: number; file: string }[];
  grammar: { level: number; itemCount: number; file: string }[];
  manifestPath: string;
  outDir: string;
}

function cefrForItem(item: BankItem): string {
  if (item.grade && /초[34]/.test(item.grade)) return "A1";
  const anchor = getLevelAnchor(item.level as 1 | 2 | 3 | 4 | 5 | 6);
  // take first band if range like "A1-A2"
  const m = anchor.cefr.split(/[-~]/)[0]?.trim();
  return m || "B1";
}

function answerIndex(item: BankItem): number {
  if (item.type === "multiple_choice") {
    const n = Number(item.answer);
    if (Number.isInteger(n) && n >= 0 && n < item.options.length) return n;
  }
  return 0;
}

function toEchoOptions(
  item: BankItem,
  optionIdPrefix: string
): EchoVocabOption[] {
  const correct = answerIndex(item);
  const opts = item.options.length >= 2 ? item.options : ["(empty)", "placeholder"];
  return opts.map((text, i) => ({
    id: `${optionIdPrefix}-${OPTION_LETTERS[i] ?? i}`,
    text,
    isCorrect: i === correct,
  }));
}

function slugId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

/** Map vocabulary (+ grammar as D5_Usage-style vocab items) to service items. */
export function bankItemToVocabEcho(item: BankItem): EchoVocabItem | { skip: string } {
  if (item.type !== "multiple_choice") {
    return { skip: "short_answer_not_supported_in_vocab_service" };
  }
  if (!item.options || item.options.length < 2) {
    return { skip: "insufficient_options" };
  }

  const level = item.level;
  const headword = (item.headword || item.id).trim() || "word";
  const wordId = `AA-L${level}-${slugId(item.id)}`;
  const dim =
    item.domain === "grammar"
      ? "D5_Usage"
      : item.dimension || "D2_Meaning";
  const id = `${wordId}-${dim}-1`;

  return {
    id,
    wordId,
    headword,
    level,
    cefr: cefrForItem(item),
    dimension: dim,
    question: item.question,
    options: toEchoOptions(item, id),
    irtA: item.irt.a,
    irtB: item.irt.b,
    irtC: item.irt.c,
    irtB_raw: item.irt.b,
    _source: "academy-assessment",
    _bankId: item.id,
  };
}

/** Group reading items into passages (same passage text → one passage). */
export function bankItemsToReadingEcho(
  items: BankItem[],
  level: number
): { file: EchoReadingServiceFile; skipped: Array<{ id: string; reason: string }> } {
  const skipped: Array<{ id: string; reason: string }> = [];
  const byPassage = new Map<string, { text: string; items: BankItem[] }>();

  for (const item of items) {
    if (item.domain !== "reading") continue;
    if (item.type !== "multiple_choice") {
      skipped.push({ id: item.id, reason: "short_answer_not_supported" });
      continue;
    }
    if (!item.options || item.options.length < 2) {
      skipped.push({ id: item.id, reason: "insufficient_options" });
      continue;
    }

    // Prefer explicit passage; else try strip [지문] block from question
    let text = (item.passage || "").trim();
    let question = item.question;
    if (!text) {
      const m = item.question.match(
        /^\[지문\]\s*([\s\S]*?)\n\n([\s\S]+)$/
      );
      if (m) {
        text = m[1].trim();
        question = m[2].trim();
      }
    }
    if (!text || text.length < 40) {
      skipped.push({ id: item.id, reason: "missing_or_short_passage" });
      continue;
    }

    const key = text.slice(0, 200);
    const bucket = byPassage.get(key) ?? { text, items: [] };
    bucket.items.push({ ...item, question });
    byPassage.set(key, bucket);
  }

  const now = new Date().toISOString();
  const passages: EchoReadingPassage[] = [];
  const qHist: Record<string, number> = {};
  let itemCount = 0;

  let pIdx = 0;
  for (const { text, items: group } of byPassage.values()) {
    pIdx++;
    const passageId = `aa-export-L${level}-p${pIdx}-${slugId(group[0].id).slice(0, 24)}`;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const rItems: EchoReadingItem[] = group.map((it, i) => {
      const qtype = it.questionType || "other";
      qHist[qtype] = (qHist[qtype] ?? 0) + 1;
      itemCount++;
      const itemId = `${passageId}-q${i + 1}`;
      return {
        id: itemId,
        passageId,
        question: it.question,
        options: toEchoOptions(it, itemId),
        questionType: qtype,
        irt: { a: it.irt.a, b: it.irt.b, c: it.irt.c },
        irtSource: it.irtSource || "ai_prior",
        source: "academy-assessment",
        curationStatus: "approved",
        curationDecisions: [
          {
            stage: "academy-assessment-export",
            model: "teacher-review",
            decision: "approved",
            timestamp: it.reviewedAt || now,
            confidence: 0.8,
            reasons: ["exported_from_approved_bank"],
          },
        ],
      };
    });

    passages.push({
      id: passageId,
      text,
      wordCount,
      level,
      cefr: cefrForItem(group[0]),
      source: "academy-assessment",
      curationStatus: "approved",
      curationDecisions: [
        {
          stage: "academy-assessment-export",
          model: "teacher-review",
          decision: "approved",
          timestamp: now,
        },
      ],
      items: rItems,
    });
  }

  return {
    skipped,
    file: {
      summary: {
        source: "academy-assessment-approved-export",
        generatedAt: now,
        level,
        mode: "export-from-bank",
        passageCount: passages.length,
        itemCount,
        questionTypeHistogram: qHist,
        academyAssessment: true,
        approvedOnly: true,
      },
      passages,
    },
  };
}

export interface ExportOptions {
  /** Default: data/exports/echobridge/<timestamp> */
  outDir?: string;
  levels?: number[];
  /** Include grammar domain as vocab-shaped items (D5_Usage). Default true. */
  includeGrammarAsVocab?: boolean;
  writeDisk?: boolean;
}

export function exportApprovedToEchobridge(
  opts: ExportOptions = {}
): ExportResult {
  const bank = loadBank();
  const approved = bank.items.filter((i) => i.status === "approved");
  const levels =
    opts.levels && opts.levels.length > 0
      ? opts.levels
      : ([1, 2, 3, 4, 5, 6] as number[]);
  const includeGrammar = opts.includeGrammarAsVocab !== false;
  const writeDisk = opts.writeDisk !== false;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir =
    opts.outDir ??
    path.join(process.cwd(), "data", "exports", "echobridge", stamp);

  const skipped: Array<{ id: string; reason: string }> = [];
  const vocabMeta: ExportResult["vocab"] = [];
  const readingMeta: ExportResult["reading"] = [];
  const grammarMeta: ExportResult["grammar"] = [];

  if (writeDisk) {
    fs.mkdirSync(path.join(outDir, "vocab"), { recursive: true });
    fs.mkdirSync(path.join(outDir, "reading"), { recursive: true });
  }

  for (const level of levels) {
    const levelItems = approved.filter((i) => i.level === level);

    // ── Vocab ──
    const vocabSource = levelItems.filter(
      (i) =>
        i.domain === "vocabulary" ||
        (includeGrammar && i.domain === "grammar")
    );
    const echoItems: EchoVocabItem[] = [];
    const wordSet = new Set<string>();
    for (const it of vocabSource) {
      const mapped = bankItemToVocabEcho(it);
      if ("skip" in mapped) {
        skipped.push({ id: it.id, reason: mapped.skip });
        continue;
      }
      echoItems.push(mapped);
      wordSet.add(mapped.wordId);
    }

    if (echoItems.length > 0 || writeDisk) {
      const fileName = `level-${level}.service.json`;
      const rel = path.join("vocab", fileName);
      const payload: EchoVocabServiceFile = {
        level,
        levelName: LEVEL_NAMES[level] ?? `L${level}`,
        wordCount: wordSet.size,
        itemCount: echoItems.length,
        words: [...wordSet].map((id) => ({ id })),
        items: echoItems,
        summary: {
          source: "academy-assessment-approved-export",
          exportedAt: new Date().toISOString(),
          approvedOnly: true,
          academyAssessment: true,
        },
      };
      if (writeDisk) {
        fs.writeFileSync(
          path.join(outDir, rel),
          JSON.stringify(payload, null, 2),
          "utf-8"
        );
      }
      vocabMeta.push({
        level,
        itemCount: echoItems.length,
        file: rel.replace(/\\/g, "/"),
      });
    }

    // ── Reading ──
    const readingItems = levelItems.filter((i) => i.domain === "reading");
    const { file: readingFile, skipped: rSkip } = bankItemsToReadingEcho(
      readingItems,
      level
    );
    skipped.push(...rSkip);
    if (readingFile.passages.length > 0 || writeDisk) {
      const rel = path.join("reading", `level-${level}.service.json`);
      if (writeDisk) {
        fs.writeFileSync(
          path.join(outDir, rel),
          JSON.stringify(readingFile, null, 2),
          "utf-8"
        );
      }
      readingMeta.push({
        level,
        passageCount: readingFile.passages.length,
        itemCount: readingFile.summary.itemCount,
        file: rel.replace(/\\/g, "/"),
      });
    }

    // grammar-only report (also folded into vocab when includeGrammar)
    const gCount = levelItems.filter((i) => i.domain === "grammar").length;
    if (gCount > 0) {
      grammarMeta.push({
        level,
        itemCount: gCount,
        file: includeGrammar
          ? `vocab/level-${level}.service.json (as D5_Usage)`
          : "(skipped — set includeGrammarAsVocab)",
      });
    }
  }

  const manifest = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    source: "academy-assessment/data/generated-bank/items.json",
    target: "echobridge-web service format",
    approvedCount: approved.length,
    skipped,
    vocab: vocabMeta,
    reading: readingMeta,
    grammar: grammarMeta,
    installHint: {
      vocab:
        "Copy vocab/level-N.service.json → echobridge-web/src/data/curated/ (merge carefully)",
      reading:
        "Copy reading/level-N.service.json → echobridge-web/src/data/reading/curated/",
      note: "Prefer merge/append over overwrite. Re-run item audit after install.",
    },
  };

  const manifestPath = path.join(outDir, "EXPORT_MANIFEST.json");
  if (writeDisk) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    // helper merge script note
    fs.writeFileSync(
      path.join(outDir, "README.md"),
      `# Echobridge export\n\nGenerated: ${manifest.exportedAt}\n\n## Install into echobridge-web\n\n\`\`\`bash\n# From academy-assessment repo root, after export:\n# Review files under this directory, then merge into:\n#   ../echobridge-web/src/data/curated/level-N.service.json\n#   ../echobridge-web/src/data/reading/curated/level-N.service.json\n\`\`\`\n\nDo **not** blind-overwrite production service files. Merge approved items and re-run audits.\n`,
      "utf-8"
    );
  }

  return {
    exportedAt: manifest.exportedAt,
    approvedCount: approved.length,
    skipped,
    vocab: vocabMeta,
    reading: readingMeta,
    grammar: grammarMeta,
    manifestPath: writeDisk ? manifestPath : "",
    outDir,
  };
}
