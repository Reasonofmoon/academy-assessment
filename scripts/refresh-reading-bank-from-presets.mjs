/**
 * Quarantine orphan reading bank items (passage text not in current pack),
 * then regenerate 1 item per preset passage for GLEAS L1–L6.
 *
 * Prerequisites:
 *   - .env.local with GEMINI_API_KEY
 *   - next dev at --base (default http://localhost:3000)
 *
 * Usage:
 *   node scripts/refresh-reading-bank-from-presets.mjs
 *   node scripts/refresh-reading-bank-from-presets.mjs --quarantine-only
 *   node scripts/refresh-reading-bank-from-presets.mjs --regen-only
 *   node scripts/refresh-reading-bank-from-presets.mjs --base http://localhost:3000
 *   node scripts/refresh-reading-bank-from-presets.mjs --levels 1,2,3
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANK_PATH = path.join(ROOT, "data", "generated-bank", "items.json");
const PASSAGES_PATH = path.join(
  ROOT,
  "data",
  "reading-passages",
  "passages-by-level.json"
);
const GEN_CFG_PATH = path.join(
  ROOT,
  "data",
  "reading-passages",
  "generation-config.json"
);

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const QUARANTINE_ONLY = process.argv.includes("--quarantine-only");
const REGEN_ONLY = process.argv.includes("--regen-only");
const LEVELS = (arg("--levels", "1,2,3,4,5,6") || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 6);

const GRADE_FOR_LEVEL = {
  1: "초3",
  2: "중1",
  3: "중3",
  4: "고2",
  5: "고3",
  6: "고3",
};

const READING_TYPES = new Set([
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
]);

function normText(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveBank(bank) {
  bank.updatedAt = new Date().toISOString();
  fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2) + "\n", "utf-8");
}

function buildPresetIndex(passagesFile) {
  /** @type {Map<string, {id:string, level:number, text:string, title:string, targetB:number, cefr:string}>} */
  const byNorm = new Map();
  /** @type {Record<number, typeof byNorm extends Map<string, infer V> ? V[] : never>} */
  const byLevel = {};
  for (let lv = 1; lv <= 6; lv++) {
    const block = passagesFile.levels[String(lv)];
    byLevel[lv] = [];
    for (const p of block?.passages || []) {
      const entry = {
        id: p.id,
        level: lv,
        text: p.text,
        title: p.title,
        targetB: p.targetB,
        cefr: p.cefr,
      };
      byNorm.set(normText(p.text), entry);
      byLevel[lv].push(entry);
    }
  }
  return { byNorm, byLevel, version: passagesFile.version };
}

function sanitizeReading(raw, level) {
  const it = { ...raw, domain: "reading", level };
  delete it.dimension;
  delete it.headword;
  if (it.questionType != null && !READING_TYPES.has(it.questionType)) {
    delete it.questionType;
  }
  if (typeof it.answer === "number") it.answer = String(it.answer);
  if (it.type !== "multiple_choice") it.type = "multiple_choice";
  if (!Array.isArray(it.options)) it.options = [];
  while (it.options.length < 4) it.options.push(`Option ${it.options.length + 1}`);
  it.options = it.options.slice(0, 4);
  return it;
}

/** Force exact preset passage text onto item when possible. */
function attachPresetPassage(item, presets) {
  const n = normText(item.passage);
  const hit = presets.byNorm.get(n);
  if (hit) {
    return {
      ...item,
      level: hit.level,
      passage: hit.text,
      irtSource: item.irtSource || "ai_prior_on_preset_passage",
    };
  }
  // try match by partial inclusion (model may trim)
  for (const p of Object.values(presets.byLevel).flat()) {
    const pn = normText(p.text);
    if (!pn) continue;
    if (n.includes(pn.slice(0, 40)) || pn.includes(n.slice(0, 40))) {
      return {
        ...item,
        level: p.level,
        passage: p.text,
        irtSource: item.irtSource || "ai_prior_on_preset_passage",
      };
    }
  }
  return null;
}

function quarantineOrphans(presets) {
  const bank = loadJson(BANK_PATH);
  const now = new Date().toISOString();
  let n = 0;
  for (const it of bank.items) {
    if (it.domain !== "reading") continue;
    if (it.status === "quarantine") continue;
    const nText = normText(it.passage);
    const match = nText && presets.byNorm.has(nText);
    if (!match) {
      it.status = "quarantine";
      it.updatedAt = now;
      it.reviewedAt = now;
      it.reviewedBy = "refresh-reading-presets";
      it.reviewNote = `Orphan passage vs pack v${presets.version}; replaced by preset regeneration`;
      n++;
    }
  }
  saveBank(bank);
  return n;
}

async function postJson(urlPath, body) {
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
    throw new Error(`${urlPath} non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(
      `${urlPath} ${res.status}: ${json.error || text.slice(0, 300)}`
    );
  }
  return json;
}

async function waitForServer(maxMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/items?limit=1`);
      if (res.ok || res.status === 400) return;
    } catch {
      // not up
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not ready at ${BASE} after ${maxMs}ms`);
}

async function generateLevel(lv, presets, genCfg) {
  const pack = presets.byLevel[lv] || [];
  if (pack.length === 0) throw new Error(`No presets for L${lv}`);

  const cfg = genCfg.levels?.[String(lv)] || {};
  const slots =
    (cfg.questionTypeSlots || []).slice(0, pack.length).length === pack.length
      ? cfg.questionTypeSlots.slice(0, pack.length)
      : ["main_idea", "detail", "inference", "purpose", "detail"].slice(
          0,
          pack.length
        );

  const grade = GRADE_FOR_LEVEL[lv];
  const passageIds = pack.map((p) => p.id);

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  L${lv} generate attempt ${attempt}…`);
      const gen = await postJson("/api/generate-questions", {
        grade,
        domains: ["reading"],
        mode: "irt",
        level: lv,
        mcqOnly: true,
        includeIrtMeta: true,
        countsByDomain: { reading: pack.length },
        passageIds,
        passagesPerSession: pack.length,
        questionTypeSlots: slots,
      });

      const raw = Array.isArray(gen?.irt?.items) ? gen.irt.items : [];
      console.log(
        `  L${lv} raw=${raw.length} cefr=${gen?.irt?.cefr} theta=${gen?.irt?.targetTheta} warnings=${(gen?.warnings || []).length}`
      );

      const stamp = Date.now().toString(36);
      const good = [];
      const usedPassages = new Set();

      for (let i = 0; i < raw.length; i++) {
        let it = sanitizeReading(raw[i], lv);
        const attached = attachPresetPassage(it, presets);
        if (!attached) {
          console.log(`  skip no-preset-match id=${it.id}`);
          continue;
        }
        it = attached;
        if (it.validation?.ok === false) {
          console.log(`  skip validation fail id=${it.id}`);
          continue;
        }
        const key = normText(it.passage);
        // Prefer unique passages; allow second pass only if short stock
        if (usedPassages.has(key) && usedPassages.size < pack.length) {
          console.log(`  skip duplicate passage on ${it.id}`);
          continue;
        }
        usedPassages.add(key);
        it.id = `reading-L${lv}-preset-${stamp}-${good.length}`;
        it.level = lv;
        it.domain = "reading";
        it.targetTheta = it.targetTheta ?? gen?.irt?.targetTheta;
        if (!it.irt) {
          it.irt = { a: 1.2, b: it.targetTheta ?? 0, c: 0.25 };
        }
        it.irtSource = "ai_prior_on_preset_passage";
        good.push(it);
      }

      // If model returned fewer than pack size, try to fill by re-request? keep partial.
      if (good.length === 0) {
        lastErr = new Error(`L${lv}: no good items`);
        continue;
      }

      // Ensure we cover as many presets as possible: if missing, leave gap (retry full)
      if (good.length < Math.min(3, pack.length) && attempt < 3) {
        lastErr = new Error(`L${lv}: only ${good.length} items, retry`);
        continue;
      }

      const saved = await postJson("/api/items", {
        items: good,
        status: "approved",
        createdBy: "refresh-reading-presets",
        grade,
        batchId: `reading-preset-L${lv}-${Date.now()}`,
      });
      console.log(`  L${lv} saved approved=${saved.saved} batch=${saved.batchId}`);
      return { level: lv, saved: saved.saved, items: good.length };
    } catch (e) {
      lastErr = e;
      console.error(`  L${lv} attempt ${attempt} failed:`, e.message || e);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr || new Error(`L${lv} generation failed`);
}

function summary(presets) {
  const bank = loadJson(BANK_PATH);
  const reading = bank.items.filter((i) => i.domain === "reading");
  const byStatus = {};
  const byLevel = {};
  let exactApproved = 0;
  let orphanApproved = 0;
  for (const it of reading) {
    byStatus[it.status] = (byStatus[it.status] || 0) + 1;
    if (it.status !== "approved") continue;
    const lv = it.level;
    byLevel[lv] = (byLevel[lv] || 0) + 1;
    if (presets.byNorm.has(normText(it.passage))) exactApproved++;
    else orphanApproved++;
  }
  return { byStatus, byLevel, exactApproved, orphanApproved, totalReading: reading.length };
}

async function main() {
  const passagesFile = loadJson(PASSAGES_PATH);
  const genCfg = loadJson(GEN_CFG_PATH);
  const presets = buildPresetIndex(passagesFile);
  console.log(
    `pack v${presets.version} presets=${[...Object.values(presets.byLevel)].flat().length} levels=${LEVELS.join(",")}`
  );

  if (!REGEN_ONLY) {
    const n = quarantineOrphans(presets);
    console.log(`quarantined orphans: ${n}`);
  }

  if (QUARANTINE_ONLY) {
    console.log(JSON.stringify(summary(presets), null, 2));
    return;
  }

  console.log(`waiting for server ${BASE}…`);
  await waitForServer();

  const results = [];
  for (const lv of LEVELS) {
    console.log(`\n=== L${lv} ===`);
    try {
      results.push(await generateLevel(lv, presets, genCfg));
    } catch (e) {
      console.error(`L${lv} FAILED:`, e.message || e);
      results.push({ level: lv, saved: 0, error: String(e.message || e) });
    }
  }

  const s = summary(presets);
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ results, ...s }, null, 2));

  if (s.orphanApproved > 0) {
    console.error(`Still have ${s.orphanApproved} approved orphans`);
    process.exitCode = 2;
  }
  if (s.exactApproved < LEVELS.length * 3) {
    console.error(
      `Only ${s.exactApproved} exact approved reading (expected ~${LEVELS.length * 5})`
    );
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
