/**
 * Level-test bank hygiene for L1 reading:
 * - Keep at most one main_idea-like item per passage text.
 * - Quarantine near-duplicate main-idea stems on the same passage.
 * - Generate replacement items (detail/inference/purpose) on underused presets.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = "http://localhost:3000";

const PRESETS = [
  "preset-L1-P01",
  "preset-L1-P02",
  "preset-L1-P03",
  "preset-L1-P04",
  "preset-L1-P05",
];

const MAIN_IDEAISH =
  /main idea|main topic|main point|mainly about|mostly about|best title|요지|주제|주된 내용|mainly describing|best describes/i;

async function post(urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${urlPath} ${res.status}: ${j.error || ""}`);
  return j;
}

async function patch(id, body) {
  const res = await fetch(`${BASE}/api/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`PATCH ${id} ${res.status}: ${j.error || ""}`);
  return j;
}

function passageKey(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function isMainIdeaish(item) {
  if (item.questionType === "main_idea") return true;
  return MAIN_IDEAISH.test(item.question || "");
}

function sanitize(raw) {
  const it = { ...raw, domain: "reading", level: 1 };
  delete it.dimension;
  delete it.headword;
  if (typeof it.answer === "number") it.answer = String(it.answer);
  return it;
}

async function main() {
  const bankPath = path.join(ROOT, "data", "generated-bank", "items.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const active = bank.items.filter(
    (i) =>
      i.level === 1 &&
      i.domain === "reading" &&
      i.status === "approved" &&
      i.type === "multiple_choice"
  );

  // Group by passage
  const groups = new Map();
  for (const it of active) {
    const k = passageKey(it.passage);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }

  let quarantined = 0;
  for (const [, list] of groups) {
    const mainish = list.filter(isMainIdeaish).sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );
    // Keep first main-idea; quarantine rest on same passage
    for (const dup of mainish.slice(1)) {
      await patch(dup.id, {
        status: "quarantine",
        reviewedBy: "level-test-reading-dedupe",
        reviewNote:
          "Duplicate main-idea style item on same passage (level-test uniqueness)",
      });
      quarantined++;
      console.log("quarantine dup", dup.id);
    }
  }

  // Generate 5 items: one per elementary preset, mixed types
  const gen = await post("/api/generate-questions", {
    grade: "초1",
    domains: ["reading"],
    mode: "irt",
    level: 1,
    mcqOnly: true,
    includeIrtMeta: true,
    countsByDomain: { reading: 5 },
    passageIds: PRESETS,
    passagesPerSession: 5,
    questionTypeSlots: [
      "main_idea",
      "detail",
      "inference",
      "purpose",
      "detail",
    ],
  });

  const raw = (gen?.irt?.items || []).map(sanitize);
  const stamp = Date.now().toString(36);
  const stamped = raw.map((it, i) => ({
    ...it,
    id: `reading-L1-unique-${stamp}-${i}`,
    level: 1,
    domain: "reading",
  }));

  if (stamped.length) {
    const saved = await post("/api/items", {
      items: stamped,
      status: "approved",
      createdBy: "level-test-reading-dedupe",
      grade: "초1",
      batchId: `l1-unique-${Date.now()}`,
    });
    console.log("saved unique-batch", saved.saved);
  }

  console.log(JSON.stringify({ quarantined, generated: stamped.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
