/**
 * Quarantine under-leveled vocab/grammar bank items for L3–L6 and regenerate
 * using school-exam construct guides (옥길 일반고 내신 스타일).
 *
 * Prerequisites: next dev + GEMINI_API_KEY
 *
 *   node scripts/refresh-vocab-grammar-levels.mjs
 *   node scripts/refresh-vocab-grammar-levels.mjs --levels 3,4
 *   node scripts/refresh-vocab-grammar-levels.mjs --quarantine-only
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANK = path.join(ROOT, "data", "generated-bank", "items.json");
const BASE = (
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : "http://localhost:3000"
).replace(/\/$/, "");

const QUARANTINE_ONLY = process.argv.includes("--quarantine-only");
const REGEN_ONLY = process.argv.includes("--regen-only");
const LEVELS = (
  process.argv.includes("--levels")
    ? process.argv[process.argv.indexOf("--levels") + 1]
    : "3,4,5,6"
)
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 6);

const GRADE = { 1: "초3", 2: "중1", 3: "고1", 4: "고2", 5: "고3", 6: "고3" };
const COUNT = 6; // per domain per level

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

/** Heuristic: too elementary for L3+ */
function looksElementary(it) {
  const q = (it.question || "").toLowerCase();
  const stem = it.question || "";
  if (it.domain === "vocabulary") {
    if (/한글\s*뜻\s*:/.test(stem) && /행복한|학교|친구|사과|달리다|좋다/.test(stem))
      return true;
    // gloss-only for L4+ always elementary-ish for high school placement
    if (it.level >= 4 && /한글\s*뜻에\s*맞는\s*단어/.test(stem) && !/_+|_____/.test(stem))
      return true;
    if (it.level >= 3 && /한글\s*뜻에\s*맞는\s*단어/.test(stem)) {
      // allow some at L3 but flag very short gloss drills
      const gloss = stem.split(/한글\s*뜻\s*:/)[1] || "";
      if (gloss.trim().length < 8) return true;
    }
  }
  if (it.domain === "grammar") {
    if (/she ____ a student|he often ____ books|the book is ____ the table/i.test(q))
      return true;
    if (it.level >= 3 && /\b(is|are|am)\b/.test(q) && q.split(/\s+/).length < 18)
      return true;
    if (it.level >= 4 && !/\n/.test(stem) && (stem.match(/[A-Za-z]+/g) || []).length < 12)
      return true;
  }
  return false;
}

function sanitize(raw, domain) {
  const it = { ...raw, domain };
  if (it.questionType != null && !READING_TYPES.has(it.questionType))
    delete it.questionType;
  if (it.dimension != null && !VOCAB_DIMS.has(it.dimension)) delete it.dimension;
  if (domain === "grammar") {
    delete it.questionType;
    delete it.dimension;
    delete it.passage;
  }
  if (domain === "vocabulary") {
    delete it.questionType;
    delete it.passage;
  }
  if (typeof it.answer === "number") it.answer = String(it.answer);
  return it;
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
    throw new Error(`${urlPath} non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`${urlPath} ${res.status}: ${json.error || text.slice(0, 200)}`);
  return json;
}

async function waitServer(maxMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await fetch(`${BASE}/api/items?limit=1`);
      if (r.ok || r.status === 400) return;
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not ready ${BASE}`);
}

function quarantineTargets() {
  const bank = JSON.parse(fs.readFileSync(BANK, "utf-8"));
  const now = new Date().toISOString();
  let n = 0;
  for (const it of bank.items) {
    if (it.status === "quarantine") continue;
    if (it.domain !== "vocabulary" && it.domain !== "grammar") continue;
    if (!LEVELS.includes(it.level)) continue;
    // Quarantine all active L3–L6 vocab/grammar for clean replace, or only elementary-looking
    const forceAll = true;
    if (forceAll || looksElementary(it)) {
      it.status = "quarantine";
      it.updatedAt = now;
      it.reviewedAt = now;
      it.reviewedBy = "refresh-vocab-grammar-okgil";
      it.reviewNote =
        "Replaced for high-school construct fit (옥길 일반고 내신 난이도 정렬)";
      n++;
    }
  }
  bank.updatedAt = now;
  fs.writeFileSync(BANK, JSON.stringify(bank, null, 2) + "\n", "utf-8");
  return n;
}

async function generateLevel(lv, domain) {
  const grade = GRADE[lv];
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  L${lv} ${domain} attempt ${attempt}…`);
      const gen = await post("/api/generate-questions", {
        grade,
        domains: [domain],
        mode: "irt",
        level: lv,
        mcqOnly: true,
        includeIrtMeta: true,
        countsByDomain: { [domain]: COUNT },
      });
      const raw = Array.isArray(gen?.irt?.items) ? gen.irt.items : [];
      console.log(
        `  raw=${raw.length} cefr=${gen?.irt?.cefr} theta=${gen?.irt?.targetTheta}`
      );
      const stamp = Date.now().toString(36);
      const good = [];
      for (let i = 0; i < raw.length; i++) {
        let it = sanitize(raw[i], domain);
        it.level = lv;
        it.domain = domain;
        if (it.validation?.ok === false) {
          console.log("  skip invalid", it.id);
          continue;
        }
        if (looksElementary(it)) {
          console.log("  skip still-elementary", (it.question || "").slice(0, 60));
          continue;
        }
        it.id = `${domain}-L${lv}-hs-${stamp}-${good.length}`;
        it.irtSource = it.irtSource || "ai_prior";
        good.push(it);
      }
      if (good.length < Math.min(3, COUNT) && attempt < 3) {
        lastErr = new Error(`only ${good.length} good`);
        continue;
      }
      if (!good.length) {
        lastErr = new Error("no good items");
        continue;
      }
      const saved = await post("/api/items", {
        items: good,
        status: "approved",
        createdBy: "refresh-vocab-grammar-okgil",
        grade,
        batchId: `${domain}-L${lv}-hs-${Date.now()}`,
      });
      console.log(`  saved ${saved.saved}`);
      return { level: lv, domain, saved: saved.saved };
    } catch (e) {
      lastErr = e;
      console.error("  fail", e.message || e);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

function summary() {
  const bank = JSON.parse(fs.readFileSync(BANK, "utf-8"));
  const out = {};
  for (const dom of ["vocabulary", "grammar"]) {
    out[dom] = {};
    for (const lv of LEVELS) {
      const items = bank.items.filter(
        (i) =>
          i.domain === dom &&
          i.level === lv &&
          i.status === "approved"
      );
      out[dom][lv] = {
        n: items.length,
        elementaryFlags: items.filter(looksElementary).length,
        sample: items.slice(0, 2).map((i) =>
          (i.question || "").replace(/\n/g, " / ").slice(0, 90)
        ),
      };
    }
  }
  return out;
}

async function main() {
  console.log("levels", LEVELS.join(","), "base", BASE);
  if (!REGEN_ONLY) {
    const n = quarantineTargets();
    console.log("quarantined", n);
  }
  if (QUARANTINE_ONLY) {
    console.log(JSON.stringify(summary(), null, 2));
    return;
  }
  await waitServer();
  const results = [];
  for (const lv of LEVELS) {
    for (const domain of ["vocabulary", "grammar"]) {
      console.log(`\n=== L${lv} ${domain} ===`);
      try {
        results.push(await generateLevel(lv, domain));
      } catch (e) {
        results.push({
          level: lv,
          domain,
          saved: 0,
          error: String(e.message || e),
        });
      }
    }
  }
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ results, bank: summary() }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
