/**
 * CLI: export approved bank items to echobridge service format.
 *
 *   node scripts/export-echobridge.mjs
 *   node scripts/export-echobridge.mjs --out data/exports/manual
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// This script duplicates the export logic in plain JS so it runs without tsx.
// Prefer POST /api/export/echobridge when the Next server is up.

const BANK = path.join(ROOT, "data/generated-bank/items.json");
const LEVEL_NAMES = {
  1: "초등",
  2: "중학교",
  3: "고등학교",
  4: "수능어휘",
  5: "토플수준",
  6: "유학수준",
};

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function slugId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function toOptions(item, prefix) {
  const correct = Number(item.answer);
  return (item.options || []).map((text, i) => ({
    id: `${prefix}-${String.fromCharCode(65 + i)}`,
    text,
    isCorrect: i === correct,
  }));
}

if (!fs.existsSync(BANK)) {
  console.error("Bank not found:", BANK);
  process.exit(1);
}

const bank = JSON.parse(fs.readFileSync(BANK, "utf-8"));
const approved = (bank.items || []).filter((i) => i.status === "approved");
if (approved.length === 0) {
  console.error("No approved items. Approve items in /review first.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(ROOT, argValue("--out", `data/exports/echobridge/${stamp}`));
fs.mkdirSync(path.join(outDir, "vocab"), { recursive: true });
fs.mkdirSync(path.join(outDir, "reading"), { recursive: true });

const skipped = [];
const vocabMeta = [];
const readingMeta = [];

for (let level = 1; level <= 6; level++) {
  const levelItems = approved.filter((i) => i.level === level);

  // vocab + grammar
  const echoItems = [];
  const wordSet = new Set();
  for (const it of levelItems.filter(
    (i) => i.domain === "vocabulary" || i.domain === "grammar"
  )) {
    if (it.type !== "multiple_choice" || !it.options?.length) {
      skipped.push({ id: it.id, reason: "not_mcq" });
      continue;
    }
    const headword = it.headword || it.id;
    const wordId = `AA-L${level}-${slugId(it.id)}`;
    const dim = it.domain === "grammar" ? "D5_Usage" : it.dimension || "D2_Meaning";
    const id = `${wordId}-${dim}-1`;
    echoItems.push({
      id,
      wordId,
      headword,
      level,
      cefr: "B1",
      dimension: dim,
      question: it.question,
      options: toOptions(it, id),
      irtA: it.irt?.a ?? 1,
      irtB: it.irt?.b ?? 0,
      irtC: it.irt?.c ?? 0.25,
      irtB_raw: it.irt?.b ?? 0,
      _source: "academy-assessment",
      _bankId: it.id,
    });
    wordSet.add(wordId);
  }
  const vRel = `vocab/level-${level}.service.json`;
  fs.writeFileSync(
    path.join(outDir, vRel),
    JSON.stringify(
      {
        level,
        levelName: LEVEL_NAMES[level],
        wordCount: wordSet.size,
        itemCount: echoItems.length,
        words: [...wordSet].map((id) => ({ id })),
        items: echoItems,
        summary: {
          source: "academy-assessment-cli-export",
          exportedAt: new Date().toISOString(),
          approvedOnly: true,
          academyAssessment: true,
        },
      },
      null,
      2
    ),
    "utf-8"
  );
  vocabMeta.push({ level, itemCount: echoItems.length, file: vRel });

  // reading
  const byPassage = new Map();
  for (const it of levelItems.filter((i) => i.domain === "reading")) {
    if (it.type !== "multiple_choice") {
      skipped.push({ id: it.id, reason: "not_mcq" });
      continue;
    }
    let text = (it.passage || "").trim();
    let question = it.question;
    if (!text) {
      const m = it.question.match(/^\[지문\]\s*([\s\S]*?)\n\n([\s\S]+)$/);
      if (m) {
        text = m[1].trim();
        question = m[2].trim();
      }
    }
    if (!text || text.length < 40) {
      skipped.push({ id: it.id, reason: "missing_passage" });
      continue;
    }
    const key = text.slice(0, 200);
    const b = byPassage.get(key) || { text, items: [] };
    b.items.push({ ...it, question });
    byPassage.set(key, b);
  }
  const passages = [];
  let pIdx = 0;
  let itemCount = 0;
  const qHist = {};
  for (const { text, items } of byPassage.values()) {
    pIdx++;
    const passageId = `aa-export-L${level}-p${pIdx}`;
    const rItems = items.map((it, i) => {
      const itemId = `${passageId}-q${i + 1}`;
      const qtype = it.questionType || "other";
      qHist[qtype] = (qHist[qtype] || 0) + 1;
      itemCount++;
      return {
        id: itemId,
        passageId,
        question: it.question,
        options: toOptions(it, itemId),
        questionType: qtype,
        irt: { a: it.irt?.a ?? 1, b: it.irt?.b ?? 0, c: it.irt?.c ?? 0.2 },
        irtSource: it.irtSource || "ai_prior",
        source: "academy-assessment",
        curationStatus: "approved",
      };
    });
    passages.push({
      id: passageId,
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      level,
      cefr: "B1",
      source: "academy-assessment",
      curationStatus: "approved",
      items: rItems,
    });
  }
  const rRel = `reading/level-${level}.service.json`;
  fs.writeFileSync(
    path.join(outDir, rRel),
    JSON.stringify(
      {
        summary: {
          source: "academy-assessment-cli-export",
          generatedAt: new Date().toISOString(),
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
      null,
      2
    ),
    "utf-8"
  );
  readingMeta.push({
    level,
    passageCount: passages.length,
    itemCount,
    file: rRel,
  });
}

const manifest = {
  exportedAt: new Date().toISOString(),
  approvedCount: approved.length,
  skipped,
  vocab: vocabMeta,
  reading: readingMeta,
  installHint: {
    vocab: "Merge into echobridge-web/src/data/curated/",
    reading: "Merge into echobridge-web/src/data/reading/curated/",
  },
};
fs.writeFileSync(
  path.join(outDir, "EXPORT_MANIFEST.json"),
  JSON.stringify(manifest, null, 2),
  "utf-8"
);

console.log("Exported", approved.length, "approved items →", outDir);
console.log("Skipped:", skipped.length);
console.log(JSON.stringify({ vocab: vocabMeta, reading: readingMeta }, null, 2));
