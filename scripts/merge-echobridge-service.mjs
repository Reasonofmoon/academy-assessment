/**
 * Safely APPEND-merge academy-assessment echobridge export into
 * echobridge-web curated service JSON files.
 *
 * Rules:
 *  - NEVER overwrite an entire target service file with export-only content
 *  - Append only; skip items/passages whose ids already exist
 *  - Also skip if option ids collide inside the target file
 *  - Always write a timestamped backup of each modified target before save
 *  - Default is --dry-run (no writes). Pass --apply to commit merges.
 *
 * Usage:
 *   node scripts/merge-echobridge-service.mjs
 *   node scripts/merge-echobridge-service.mjs --apply
 *   node scripts/merge-echobridge-service.mjs --export data/exports/echobridge/<ts> --target ../echobridge-web --apply
 *   node scripts/merge-echobridge-service.mjs --levels 2,3 --apply
 *   node scripts/merge-echobridge-service.mjs --vocab-only --apply
 *   node scripts/merge-echobridge-service.mjs --reading-only --apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ── CLI ──────────────────────────────────────────────────────

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function parseLevels(raw) {
  if (!raw) return [1, 2, 3, 4, 5, 6];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n >= 1 && n <= 6);
}

function latestExportDir(exportsRoot) {
  if (!fs.existsSync(exportsRoot)) return null;
  const dirs = fs
    .readdirSync(exportsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) return null;
  return path.join(exportsRoot, dirs[dirs.length - 1]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, file);
}

function backupFile(file, backupRoot) {
  const base = path.basename(file);
  const relSafe = path
    .relative(process.cwd(), file)
    .replace(/[\\/]/g, "__");
  const dest = path.join(backupRoot, `${relSafe}.${Date.now()}.bak`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  return dest;
}

function collectVocabIds(service) {
  const itemIds = new Set();
  const optionIds = new Set();
  const wordIds = new Set();
  for (const it of service.items || []) {
    if (it?.id) itemIds.add(String(it.id));
    if (it?.wordId) wordIds.add(String(it.wordId));
    for (const opt of it.options || []) {
      if (opt?.id) optionIds.add(String(opt.id));
    }
  }
  return { itemIds, optionIds, wordIds };
}

function collectReadingIds(service) {
  const passageIds = new Set();
  const itemIds = new Set();
  const optionIds = new Set();
  for (const p of service.passages || []) {
    if (p?.id) passageIds.add(String(p.id));
    for (const it of p.items || []) {
      if (it?.id) itemIds.add(String(it.id));
      for (const opt of it.options || []) {
        if (opt?.id) optionIds.add(String(opt.id));
      }
    }
  }
  return { passageIds, itemIds, optionIds };
}

function stripPrivateFields(obj) {
  if (Array.isArray(obj)) return obj.map(stripPrivateFields);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("_")) continue;
      out[k] = stripPrivateFields(v);
    }
    return out;
  }
  return obj;
}

function mergeVocab(target, incoming, level) {
  const report = {
    level,
    kind: "vocab",
    beforeItems: (target.items || []).length,
    addedItems: 0,
    skippedItems: [],
    addedWords: 0,
  };

  if (!Array.isArray(target.items)) target.items = [];
  if (!Array.isArray(target.words)) target.words = [];

  const ids = collectVocabIds(target);
  const wordIdSet = new Set(
    (target.words || [])
      .map((w) => (typeof w === "string" ? w : w?.id))
      .filter(Boolean)
      .map(String)
  );

  for (const raw of incoming.items || []) {
    const it = stripPrivateFields(raw);
    if (!it?.id) {
      report.skippedItems.push({ id: "(missing)", reason: "no_id" });
      continue;
    }
    const id = String(it.id);
    if (ids.itemIds.has(id)) {
      report.skippedItems.push({ id, reason: "duplicate_item_id" });
      continue;
    }
    // option id collision
    let optClash = false;
    for (const opt of it.options || []) {
      if (opt?.id && ids.optionIds.has(String(opt.id))) {
        optClash = true;
        break;
      }
    }
    if (optClash) {
      report.skippedItems.push({ id, reason: "duplicate_option_id" });
      continue;
    }

    // ensure level matches file
    it.level = level;
    target.items.push(it);
    ids.itemIds.add(id);
    for (const opt of it.options || []) {
      if (opt?.id) ids.optionIds.add(String(opt.id));
    }

    if (it.wordId && !wordIdSet.has(String(it.wordId))) {
      wordIdSet.add(String(it.wordId));
      target.words.push({ id: it.wordId });
      report.addedWords++;
    }
    report.addedItems++;
  }

  target.itemCount = target.items.length;
  target.wordCount = wordIdSet.size;
  target.level = level;
  if (!target.levelName) {
    const names = {
      1: "초등",
      2: "중학교",
      3: "고등학교",
      4: "수능어휘",
      5: "토플수준",
      6: "유학수준",
    };
    target.levelName = names[level] || `L${level}`;
  }

  // merge audit trail (non-destructive)
  target.lastAcademyMerge = {
    at: new Date().toISOString(),
    addedItems: report.addedItems,
    skipped: report.skippedItems.length,
    source: "academy-assessment-merge",
  };

  report.afterItems = target.items.length;
  return { target, report };
}

function mergeReading(target, incoming, level) {
  const report = {
    level,
    kind: "reading",
    beforePassages: (target.passages || []).length,
    addedPassages: 0,
    addedItems: 0,
    skippedPassages: [],
    skippedItems: [],
  };

  if (!Array.isArray(target.passages)) target.passages = [];
  if (!target.summary || typeof target.summary !== "object") {
    target.summary = {};
  }

  const ids = collectReadingIds(target);

  for (const rawPass of incoming.passages || []) {
    const passage = stripPrivateFields(rawPass);
    if (!passage?.id) {
      report.skippedPassages.push({ id: "(missing)", reason: "no_id" });
      continue;
    }
    const pid = String(passage.id);
    if (ids.passageIds.has(pid)) {
      report.skippedPassages.push({ id: pid, reason: "duplicate_passage_id" });
      continue;
    }

    const keptItems = [];
    for (const rawIt of passage.items || []) {
      const it = stripPrivateFields(rawIt);
      if (!it?.id) {
        report.skippedItems.push({ id: "(missing)", reason: "no_id" });
        continue;
      }
      const iid = String(it.id);
      if (ids.itemIds.has(iid)) {
        report.skippedItems.push({ id: iid, reason: "duplicate_item_id" });
        continue;
      }
      let optClash = false;
      for (const opt of it.options || []) {
        if (opt?.id && ids.optionIds.has(String(opt.id))) {
          optClash = true;
          break;
        }
      }
      if (optClash) {
        report.skippedItems.push({ id: iid, reason: "duplicate_option_id" });
        continue;
      }
      it.passageId = pid;
      keptItems.push(it);
      ids.itemIds.add(iid);
      for (const opt of it.options || []) {
        if (opt?.id) ids.optionIds.add(String(opt.id));
      }
    }

    if (keptItems.length === 0) {
      report.skippedPassages.push({
        id: pid,
        reason: "all_items_skipped_or_empty",
      });
      continue;
    }

    passage.level = level;
    passage.items = keptItems;
    target.passages.push(passage);
    ids.passageIds.add(pid);
    report.addedPassages++;
    report.addedItems += keptItems.length;
  }

  // recompute summary counters (preserve other summary fields)
  const qHist = { ...(target.summary.questionTypeHistogram || {}) };
  let itemCount = 0;
  for (const p of target.passages) {
    for (const it of p.items || []) {
      itemCount++;
      const qt = it.questionType || "other";
      qHist[qt] = (qHist[qt] || 0) + 1;
    }
  }
  target.summary = {
    ...target.summary,
    level,
    passageCount: target.passages.length,
    itemCount,
    questionTypeHistogram: qHist,
    lastAcademyMerge: {
      at: new Date().toISOString(),
      addedPassages: report.addedPassages,
      addedItems: report.addedItems,
      source: "academy-assessment-merge",
    },
  };

  report.afterPassages = target.passages.length;
  report.afterItems = itemCount;
  return { target, report };
}

// ── main ─────────────────────────────────────────────────────

const apply = hasFlag("--apply");
const dryRun = !apply;
const vocabOnly = hasFlag("--vocab-only");
const readingOnly = hasFlag("--reading-only");
const levels = parseLevels(argValue("--levels", null));

const exportArg = argValue("--export", null);
const exportsRoot = path.join(ROOT, "data", "exports", "echobridge");
const exportDir = exportArg
  ? path.resolve(ROOT, exportArg)
  : latestExportDir(exportsRoot);

const targetRoot = path.resolve(
  ROOT,
  argValue("--target", path.join(ROOT, "..", "echobridge-web"))
);

const vocabTargetDir = path.join(targetRoot, "src", "data", "curated");
const readingTargetDir = path.join(
  targetRoot,
  "src",
  "data",
  "reading",
  "curated"
);

if (!exportDir || !fs.existsSync(exportDir)) {
  console.error(
    "Export directory not found. Run npm run export:echobridge first, or pass --export <path>."
  );
  process.exit(1);
}

if (!fs.existsSync(targetRoot)) {
  console.error(`echobridge-web target not found: ${targetRoot}`);
  console.error("Pass --target <path-to-echobridge-web>");
  process.exit(1);
}

const doVocab = !readingOnly;
const doReading = !vocabOnly;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  ROOT,
  "data",
  "exports",
  "merge-backups",
  stamp
);
const reportPath = path.join(
  ROOT,
  "data",
  "exports",
  "merge-reports",
  `merge-${stamp}.json`
);

console.log("=== merge-echobridge-service ===");
console.log(`mode:     ${dryRun ? "DRY-RUN (no writes)" : "APPLY"}`);
console.log(`export:   ${exportDir}`);
console.log(`target:   ${targetRoot}`);
console.log(`levels:   ${levels.join(",")}`);
console.log(`scopes:   vocab=${doVocab} reading=${doReading}`);

const reports = [];
let totalAdded = 0;
let totalSkipped = 0;

for (const level of levels) {
  if (doVocab) {
    const src = path.join(exportDir, "vocab", `level-${level}.service.json`);
    const dst = path.join(vocabTargetDir, `level-${level}.service.json`);
    if (!fs.existsSync(src)) {
      reports.push({
        level,
        kind: "vocab",
        error: `missing export: ${src}`,
      });
      continue;
    }
    if (!fs.existsSync(dst)) {
      reports.push({
        level,
        kind: "vocab",
        error: `missing target (will not create new service file to avoid accidental overwrite-as-create): ${dst}`,
      });
      continue;
    }

    const incoming = readJson(src);
    const target = readJson(dst);
    const before = (target.items || []).length;

    if ((incoming.items || []).length === 0) {
      reports.push({
        level,
        kind: "vocab",
        note: "export has 0 items — nothing to merge",
        beforeItems: before,
      });
    } else {
      const { target: merged, report } = mergeVocab(
        structuredClone(target),
        incoming,
        level
      );
      reports.push(report);
      totalAdded += report.addedItems;
      totalSkipped += report.skippedItems.length;

      console.log(
        `vocab L${level}: +${report.addedItems} items (skip ${report.skippedItems.length}) ${before} → ${report.afterItems}`
      );

      if (!dryRun && report.addedItems > 0) {
        const bak = backupFile(dst, backupRoot);
        writeJson(dst, merged);
        console.log(`  wrote ${dst}`);
        console.log(`  backup ${bak}`);
      }
    }
  }

  if (doReading) {
    const src = path.join(exportDir, "reading", `level-${level}.service.json`);
    const dst = path.join(readingTargetDir, `level-${level}.service.json`);
    if (!fs.existsSync(src)) {
      reports.push({
        level,
        kind: "reading",
        error: `missing export: ${src}`,
      });
      continue;
    }
    if (!fs.existsSync(dst)) {
      reports.push({
        level,
        kind: "reading",
        error: `missing target (will not create): ${dst}`,
      });
      continue;
    }

    const incoming = readJson(src);
    const target = readJson(dst);
    const beforeP = (target.passages || []).length;

    if ((incoming.passages || []).length === 0) {
      reports.push({
        level,
        kind: "reading",
        note: "export has 0 passages — nothing to merge",
        beforePassages: beforeP,
      });
    } else {
      const { target: merged, report } = mergeReading(
        structuredClone(target),
        incoming,
        level
      );
      reports.push(report);
      totalAdded += report.addedItems;
      totalSkipped +=
        report.skippedItems.length + report.skippedPassages.length;

      console.log(
        `reading L${level}: +${report.addedPassages} passages / +${report.addedItems} items (skip p=${report.skippedPassages.length} i=${report.skippedItems.length}) ${beforeP} → ${report.afterPassages}`
      );

      if (!dryRun && report.addedPassages > 0) {
        const bak = backupFile(dst, backupRoot);
        writeJson(dst, merged);
        console.log(`  wrote ${dst}`);
        console.log(`  backup ${bak}`);
      }
    }
  }
}

const summary = {
  mode: dryRun ? "dry-run" : "apply",
  at: new Date().toISOString(),
  exportDir,
  targetRoot,
  levels,
  totalAddedItemsOrPassagesNote:
    "totalAdded counts vocab items + reading items",
  totalAdded,
  totalSkipped,
  reports,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), "utf-8");
console.log("\n--- summary ---");
console.log(`added:   ${totalAdded}`);
console.log(`skipped: ${totalSkipped}`);
console.log(`report:  ${reportPath}`);
if (dryRun) {
  console.log(
    "\nDry-run only. Re-run with --apply to write merges (backups will be created)."
  );
} else {
  console.log(`backups: ${backupRoot}`);
}
