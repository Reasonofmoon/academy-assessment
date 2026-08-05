/**
 * Fill empty GLEAS levels to satisfy level-item-qc coverage.
 *
 * Usage:
 *   node scripts/fill-levels-for-qc.mjs
 *   node scripts/fill-levels-for-qc.mjs --count 3 --levels 1,4,5,6
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const COUNT = Number(arg("--count", "3"));
const LEVELS = (arg("--levels", "1,4,5,6") || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 6);

const LEVEL_TO_GRADE = {
  1: "초5",
  2: "중1",
  3: "중3",
  4: "고2",
  5: "고3",
  6: "고3",
};

const DOMAINS = (arg("--domains", "vocabulary,grammar,reading") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const READING_TYPES = new Set([
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
]);
const VOCAB_DIMS = new Set([
  "D1_Form",
  "D2_Meaning",
  "D3_Context",
  "D4_Network",
  "D5_Usage",
  "D6_Cloze",
]);

function sanitize(raw) {
  const it = { ...raw };
  if (it.questionType != null && !READING_TYPES.has(it.questionType)) {
    delete it.questionType;
  }
  if (it.dimension != null && !VOCAB_DIMS.has(it.dimension)) {
    delete it.dimension;
  }
  if (it.domain === "grammar") {
    delete it.questionType;
    delete it.dimension;
    delete it.passage;
  }
  if (it.domain === "vocabulary") {
    delete it.questionType;
    delete it.passage;
  }
  if (it.domain === "reading") {
    delete it.dimension;
    delete it.headword;
  }
  if (it.type === "multiple_choice" && typeof it.answer === "number") {
    it.answer = String(it.answer);
  }
  if (typeof it.question === "string") {
    it.question = it.question
      .replace(/(고르시오\.?)\s*(한글\s*뜻\s*:)/g, "$1\n$2")
      .replace(/(고르시오\.?)\s+(?=[A-Za-z"'“])/g, "$1\n")
      .replace(/([?？])\s+(?=[A-Za-z"'“])/g, "$1\n");
  }
  return it;
}

function isBad(it) {
  const q = it.question || "";
  if (/closest in meaning to/i.test(q)) return true;
  if (
    /한글 뜻에 맞는/.test(q) &&
    !/한글\s*뜻\s*:/.test(q) &&
    q.replace(/\s+/g, " ").trim().length < 40
  ) {
    return true;
  }
  if (it.validation?.ok === false) return true;
  if (it.validation?.errors?.length) return true;
  return false;
}

async function post(urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${urlPath} non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${urlPath} ${res.status}: ${json.error || text.slice(0, 200)}`);
  }
  return json;
}

async function fillLevel(level) {
  const grade = LEVEL_TO_GRADE[level] || "중1";
  console.log(`=== L${level} grade=${grade} countPerDomain=${COUNT} ===`);
  const gen = await post("/api/generate-questions", {
    grade,
    domains: DOMAINS,
    mode: "irt",
    level,
    countPerDomain: COUNT,
    mcqOnly: true,
    includeIrtMeta: true,
  });
  const raw = gen?.irt?.items || [];
  const warnings = gen?.warnings || [];
  if (warnings.length) console.log("  warnings:", warnings.join(" | "));
  const good = raw.map(sanitize).filter((it) => !isBad(it));
  console.log(`  generated=${raw.length} good=${good.length}`);
  if (!good.length) {
    return { level, grade, saved: 0, generated: raw.length, good: 0 };
  }
  const stamp = Date.now().toString(36);
  const stamped = good.map((it, i) => ({
    ...it,
    id: `${it.domain || "item"}-L${level}-fill-${stamp}-${i}`,
    level,
  }));
  const saved = await post("/api/items", {
    items: stamped,
    status: "approved",
    createdBy: "level-fill-qc",
    grade,
    batchId: `level-fill-L${level}-${Date.now()}`,
  });
  console.log(`  saved=${saved.saved} batch=${saved.batchId}`);
  return {
    level,
    grade,
    saved: saved.saved,
    generated: raw.length,
    good: good.length,
  };
}

async function main() {
  console.log(`base=${BASE} levels=${LEVELS.join(",")} count=${COUNT}`);
  const results = [];
  for (const level of LEVELS) {
    try {
      results.push(await fillLevel(level));
    } catch (e) {
      console.error(`FAIL L${level}:`, e.message || e);
      results.push({ level, error: String(e.message || e) });
    }
  }

  const bankPath = path.join(ROOT, "data", "generated-bank", "items.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const byLevel = {};
  for (const it of bank.items) {
    if (it.status === "quarantine") continue;
    const k = `L${it.level}`;
    byLevel[k] = byLevel[k] || { total: 0, vocabulary: 0, grammar: 0, reading: 0 };
    byLevel[k].total++;
    if (byLevel[k][it.domain] != null) byLevel[k][it.domain]++;
  }
  console.log(JSON.stringify({ results, byLevel, total: bank.items.length }, null, 2));
  if (results.some((r) => r.error)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
