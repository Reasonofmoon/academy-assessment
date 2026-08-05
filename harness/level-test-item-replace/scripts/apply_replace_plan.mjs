/**
 * Stage V2: apply level-test replace_plan.json
 *
 * - quarantine listed item ids
 * - generate replacement items for replace slots via /api/generate-questions
 * - quarantine replaced originals
 * - save approved replacements to bank
 *
 * Prerequisites: next dev + .env.local GEMINI_API_KEY
 *
 * Usage (repo root):
 *   node harness/level-test-item-replace/scripts/apply_replace_plan.mjs
 *   node harness/level-test-item-replace/scripts/apply_replace_plan.mjs --base http://localhost:3000
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(__dirname, "..");
const REPO = path.join(HARNESS, "..", "..");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const PLAN_PATH = arg(
  "--plan",
  path.join(HARNESS, "workspace", "level-test", "replace_plan.json")
);

const LEVEL_TO_GRADE = {
  1: "초5",
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
const VOCAB_DIMS = new Set([
  "D1_Form",
  "D2_Meaning",
  "D3_Context",
  "D4_Network",
  "D5_Usage",
  "D6_Cloze",
]);

function sanitizeItem(raw, forceDomain) {
  const it = { ...raw };
  if (forceDomain) it.domain = forceDomain;
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
  // Prefer display newlines
  if (typeof it.question === "string") {
    it.question = it.question
      .replace(/(고르시오\.?)\s*(한글\s*뜻\s*:)/g, "$1\n$2")
      .replace(/(고르시오\.?)\s+(?=[A-Za-z"'“])/g, "$1\n")
      .replace(/([?？])\s+(?=[A-Za-z"'“])/g, "$1\n");
  }
  return it;
}

function isBadReplacement(it, forbid = []) {
  const q = it.question || "";
  for (const p of forbid) {
    if (p && q.toLowerCase().includes(String(p).toLowerCase())) return true;
  }
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
    throw new Error(`${urlPath} non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${urlPath} ${res.status}: ${json.error || text.slice(0, 200)}`);
  }
  return json;
}

async function patchItem(id, patch) {
  const res = await fetch(`${BASE}/api/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`PATCH items/${id} non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`PATCH items/${id} ${res.status}: ${json.error || text.slice(0, 200)}`);
  }
  return json;
}

async function bulkStatus(ids, status, reviewNote) {
  if (!ids.length) return { updated: 0 };
  return postJson("/api/items/bulk", {
    ids,
    status,
    reviewedBy: "level-test-replace-v2",
    reviewNote,
  });
}

async function waitForServer(maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/items?limit=1`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${BASE}`);
}

async function generateForSlot(slot) {
  const level = Number(slot.level || slot.replacement_spec?.level || 2);
  const domain = slot.domain || slot.replacement_spec?.domain || "vocabulary";
  const grade = LEVEL_TO_GRADE[level] || "중1";
  const forbid = slot.replacement_spec?.forbid_patterns || [];

  // Generate a small batch and pick the best valid item for this slot.
  const gen = await postJson("/api/generate-questions", {
    grade,
    domains: [domain],
    mode: "irt",
    level,
    countPerDomain: 4,
    mcqOnly: true,
    includeIrtMeta: true,
  });

  const items = (gen?.irt?.items || []).map((it) => sanitizeItem(it, domain));
  const good = items.filter((it) => !isBadReplacement(it, forbid));
  // Prefer matching dimension when present
  const dim = slot.slot?.dimension || slot.replacement_spec?.dimension;
  good.sort((a, b) => {
    const as = dim && a.dimension === dim ? 0 : 1;
    const bs = dim && b.dimension === dim ? 0 : 1;
    return as - bs;
  });

  return {
    grade,
    domain,
    level,
    generated: items.length,
    good: good.length,
    picked: good[0] || null,
    allGood: good,
  };
}

async function main() {
  console.log(`base=${BASE}`);
  console.log(`plan=${PLAN_PATH}`);
  await waitForServer();

  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf-8"));
  const log = {
    startedAt: new Date().toISOString(),
    quarantine: [],
    replaced: [],
    saved: [],
    skipped: [],
    errors: [],
  };

  // 1) Quarantine seeds / listed ids
  const qIds = plan.quarantine || [];
  if (qIds.length) {
    try {
      const r = await bulkStatus(
        qIds,
        "quarantine",
        "level-test Stage V2: SEED_DEMO / plan quarantine"
      );
      log.quarantine.push({ ids: qIds, result: r });
      console.log(`quarantine bulk updated=${r.updated ?? r.count ?? "?"}`);
    } catch (e) {
      // fallback per-id
      for (const id of qIds) {
        try {
          await patchItem(id, {
            status: "quarantine",
            reviewedBy: "level-test-replace-v2",
            reviewNote: "level-test Stage V2: quarantine",
          });
          log.quarantine.push({ id, ok: true });
        } catch (err) {
          log.errors.push(String(err.message || err));
        }
      }
    }
  }

  // 2) Replace slots
  for (const slot of plan.replace || []) {
    const oldId = slot.item_id;
    console.log(`replace slot ${oldId} …`);
    try {
      const { grade, domain, level, generated, good, picked, allGood } =
        await generateForSlot(slot);
      console.log(
        `  gen domain=${domain} L${level} grade=${grade} generated=${generated} good=${good}`
      );

      if (!picked) {
        log.skipped.push({ oldId, reason: "no_good_candidate" });
        console.log("  SKIP no good candidate");
        continue;
      }

      // Prefer unique id for replacement
      const replacement = {
        ...picked,
        id: `${domain}-L${level}-replace-${Date.now().toString(36)}`,
        level: level,
        targetTheta:
          slot.targetTheta ??
          slot.replacement_spec?.targetTheta ??
          picked.targetTheta,
        irtSource: picked.irtSource || "ai_prior",
      };
      if (slot.slot?.dimension && !replacement.dimension) {
        replacement.dimension = slot.slot.dimension;
      }

      const saved = await postJson("/api/items", {
        items: [replacement],
        status: "approved",
        createdBy: "level-test-replace-v2",
        grade,
        batchId: `replace-v2-${Date.now()}`,
      });
      log.saved.push({
        oldId,
        newId: replacement.id,
        batchId: saved.batchId,
        question: replacement.question?.slice(0, 120),
      });

      // Quarantine original
      await patchItem(oldId, {
        status: "quarantine",
        reviewedBy: "level-test-replace-v2",
        reviewNote: `replaced by ${replacement.id} codes=${(slot.codes || []).join(",")}`,
      });
      log.replaced.push({ oldId, newId: replacement.id });

      // Optionally save extra good candidates as pending for review
      const extras = allGood
        .filter((x) => x.question !== picked.question)
        .slice(0, 2)
        .map((x, i) =>
          sanitizeItem(
            {
              ...x,
              id: `${domain}-L${level}-extra-${Date.now().toString(36)}-${i}`,
              level,
            },
            domain
          )
        );
      if (extras.length) {
        const ex = await postJson("/api/items", {
          items: extras,
          status: "pending",
          createdBy: "level-test-replace-v2",
          grade,
          batchId: `replace-v2-extra-${Date.now()}`,
        });
        log.saved.push({ extras: extras.map((e) => e.id), batchId: ex.batchId });
      }

      console.log(`  OK ${oldId} → ${replacement.id}`);
    } catch (e) {
      console.error(`  FAIL ${oldId}:`, e.message || e);
      log.errors.push({ oldId, error: String(e.message || e) });
    }
  }

  // 3) Repair ops (non-generative notes only for LEVEL_LEXIS — mark reviewNote)
  for (const r of plan.repair || []) {
    try {
      await patchItem(r.item_id, {
        reviewNote: `level-test repair pending: ${(r.ops || []).join(",")} codes=${(r.codes || []).join(",")}`,
        reviewedBy: "level-test-replace-v2",
      });
      log.saved.push({ repairNote: r.item_id, ops: r.ops });
    } catch (e) {
      log.errors.push({ repair: r.item_id, error: String(e.message || e) });
    }
  }

  log.finishedAt = new Date().toISOString();
  const outPath = path.join(
    HARNESS,
    "workspace",
    "level-test",
    "STAGE_V2_APPLY_LOG.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(log, null, 2) + "\n", "utf-8");
  console.log(`log=${outPath}`);

  // Bank summary from disk
  const bankPath = path.join(REPO, "data", "generated-bank", "items.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const byStatus = bank.items.reduce((a, it) => {
    a[it.status] = (a[it.status] || 0) + 1;
    return a;
  }, {});
  console.log(JSON.stringify({ total: bank.items.length, byStatus }, null, 2));

  if (log.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
