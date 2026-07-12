/**
 * Rebuild data/irt-exemplars from a local echobridge-web clone.
 *
 * Usage:
 *   node scripts/import-irt-exemplars.mjs
 *   node scripts/import-irt-exemplars.mjs --src ../echobridge-web
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const SRC = path.resolve(ROOT, argValue("--src", "../echobridge-web"));
const OUT = path.join(ROOT, "data", "irt-exemplars");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function pick(arr, n, rng) {
  if (arr.length <= n) return [...arr];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// mulberry32
function rngFactory(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = rngFactory(42);
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(SRC)) {
  console.error(`echobridge-web not found at ${SRC}`);
  process.exit(1);
}

const vocabEx = [];
const vocabStats = {};
for (let lv = 1; lv <= 6; lv++) {
  const p = path.join(SRC, "src/data/curated", `level-${lv}.service.json`);
  if (!fs.existsSync(p)) {
    console.warn("missing", p);
    continue;
  }
  const data = loadJson(p);
  const byDim = {};
  for (const it of data.items || []) {
    if (!it.question || !it.options || it.options.length < 4) continue;
    if (!it.options.some((o) => o.isCorrect)) continue;
    const dim = it.dimension || "D2_Meaning";
    (byDim[dim] ||= []).push(it);
  }
  const stats = {};
  for (const [dim, arr] of Object.entries(byDim)) {
    const chosen = pick(arr, 6, rng);
    stats[dim] = { pool: arr.length, exemplars: chosen.length };
    for (const it of chosen) {
      const correctIdx = it.options.findIndex((o) => o.isCorrect);
      vocabEx.push({
        id: it.id,
        domain: "vocabulary",
        level: it.level,
        cefr: it.cefr,
        dimension: it.dimension,
        headword: it.headword,
        question: it.question,
        options: it.options.map((o) => o.text),
        answerIndex: correctIdx,
        irt: { a: it.irtA ?? 1, b: it.irtB ?? 0, c: it.irtC ?? 0.25 },
        irtSource: "heuristic-service",
        provenance: "echobridge-web/curated",
      });
    }
  }
  vocabStats[lv] = stats;
}

const readingEx = [];
const readingStats = {};
for (let lv = 1; lv <= 6; lv++) {
  const p = path.join(SRC, "src/data/reading/curated", `level-${lv}.service.json`);
  if (!fs.existsSync(p)) continue;
  const data = loadJson(p);
  const byType = {};
  for (const passage of data.passages || []) {
    const text = (passage.text || "").trim();
    if (text.length < 80) continue;
    for (const it of passage.items || []) {
      if (!it.options || it.options.length < 4) continue;
      if (!it.options.some((o) => o.isCorrect)) continue;
      const qtype = it.questionType || "other";
      (byType[qtype] ||= []).push({ passage, it });
    }
  }
  const stats = {};
  for (const [qtype, arr] of Object.entries(byType)) {
    const n = qtype === "vocabulary" ? 3 : 5;
    const chosen = pick(arr, n, rng);
    stats[qtype] = { pool: arr.length, exemplars: chosen.length };
    for (const { passage, it } of chosen) {
      const correctIdx = it.options.findIndex((o) => o.isCorrect);
      const irt = it.irt || {};
      readingEx.push({
        id: it.id,
        domain: "reading",
        level: passage.level ?? lv,
        cefr: passage.cefr,
        questionType: it.questionType,
        passageId: passage.id,
        passage: passage.text,
        wordCount: passage.wordCount || (passage.text || "").split(/\s+/).length,
        question: it.question,
        options: it.options.map((o) => o.text),
        answerIndex: correctIdx,
        irt: { a: irt.a ?? 1, b: irt.b ?? 0, c: irt.c ?? 0.2 },
        irtSource: it.irtSource || "heuristic",
        provenance: "echobridge-web/reading-curated",
      });
    }
  }
  readingStats[lv] = stats;
}

const levelAnchors = {
  1: { name: "초등", thetaCenter: -2.25, cefr: "A1-A2", grades: ["초3", "초4", "초5", "초6"] },
  2: { name: "중학교", thetaCenter: -0.9, cefr: "A2-B1", grades: ["중1", "중2"] },
  3: { name: "고등학교", thetaCenter: 0.25, cefr: "B1-B2", grades: ["중3", "고1"] },
  4: { name: "수능어휘", thetaCenter: 1.15, cefr: "B1-B2", grades: ["고2", "고3"] },
  5: { name: "토플수준", thetaCenter: 1.9, cefr: "B2-C1", grades: [] },
  6: { name: "유학수준", thetaCenter: 2.65, cefr: "C1-C2", grades: [] },
};

const manifest = {
  version: "1.0.0",
  sourceRepo: "Reasonofmoon/echobridge-web",
  builtAt: new Date().toISOString(),
  purpose: "Few-shot exemplars for IRT-principled AI item generation",
  vocabExemplarCount: vocabEx.length,
  readingExemplarCount: readingEx.length,
  levelAnchors,
  vocabStats,
  readingStats,
  irtPrinciples: {
    model: "3PL",
    formula: "P(theta)=c+(1-c)/(1+exp(-1.7*a*(theta-b)))",
    a_range: [0.5, 2.5],
    b_range: [-3.0, 3.0],
    c_mcq: 0.25,
  },
};

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
fs.writeFileSync(path.join(OUT, "vocab-exemplars.json"), JSON.stringify(vocabEx, null, 2), "utf-8");
fs.writeFileSync(path.join(OUT, "reading-exemplars.json"), JSON.stringify(readingEx, null, 2), "utf-8");

console.log(`Wrote ${vocabEx.length} vocab + ${readingEx.length} reading exemplars → ${OUT}`);
