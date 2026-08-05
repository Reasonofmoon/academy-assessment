/**
 * Quarantine L1 reading items that still use pre-curation passages,
 * generate new items on elementary L1 presets.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = "http://localhost:3000";

const NEW_MARKERS = [
  "I have a small dog",
  "Mina goes to school",
  "our family goes to the park for a picnic",
  "Tom is my best friend",
  "Our class visits the library",
];

const PRESET_IDS = [
  "preset-L1-P01",
  "preset-L1-P02",
  "preset-L1-P03",
  "preset-L1-P04",
  "preset-L1-P05",
];

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

function isElementaryPassage(text) {
  const t = text || "";
  return NEW_MARKERS.some((m) => t.includes(m));
}

function sanitizeReading(raw) {
  const it = { ...raw, domain: "reading", level: 1 };
  delete it.dimension;
  delete it.headword;
  if (typeof it.answer === "number") it.answer = String(it.answer);
  if (it.questionType && !["main_idea", "detail", "inference", "purpose", "attitude", "vocabulary", "other"].includes(it.questionType)) {
    delete it.questionType;
  }
  return it;
}

async function main() {
  const bankPath = path.join(ROOT, "data", "generated-bank", "items.json");
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const l1Reading = bank.items.filter(
    (i) => i.level === 1 && i.domain === "reading" && i.status !== "quarantine"
  );

  const stale = l1Reading.filter((i) => !isElementaryPassage(i.passage || ""));
  const keep = l1Reading.filter((i) => isElementaryPassage(i.passage || ""));
  console.log(`L1 reading active=${l1Reading.length} stale=${stale.length} elementary=${keep.length}`);

  for (const it of stale) {
    await patch(it.id, {
      status: "quarantine",
      reviewedBy: "l1-reading-refresh",
      reviewNote: "Pre-curation L1 passage; replaced by elementary preset pack",
    });
    console.log("quarantine", it.id);
  }

  // Generate covering all 5 elementary presets (two batches if needed)
  const gen = await post("/api/generate-questions", {
    grade: "초1",
    domains: ["reading"],
    mode: "irt",
    level: 1,
    mcqOnly: true,
    includeIrtMeta: true,
    countsByDomain: { reading: 5 },
    passageIds: PRESET_IDS,
    passagesPerSession: 5,
    questionTypeSlots: [
      "main_idea",
      "detail",
      "inference",
      "purpose",
      "detail",
    ],
  });

  const raw = gen?.irt?.items || [];
  console.log("generated", raw.length, "warnings", gen?.warnings || []);
  const good = raw
    .map(sanitizeReading)
    .filter((it) => {
      if (it.validation?.ok === false) return false;
      if (!isElementaryPassage(it.passage || "")) {
        console.log("skip non-elementary passage on", it.id);
        return false;
      }
      return true;
    });

  if (!good.length) {
    console.error("No good elementary reading items generated");
    process.exit(1);
  }

  const stamp = Date.now().toString(36);
  const stamped = good.map((it, i) => ({
    ...it,
    id: `reading-L1-elem-${stamp}-${i}`,
    level: 1,
    domain: "reading",
    irtSource: it.irtSource || "ai_prior_on_preset_passage",
  }));

  const saved = await post("/api/items", {
    items: stamped,
    status: "approved",
    createdBy: "l1-reading-refresh",
    grade: "초1",
    batchId: `l1-elem-reading-${Date.now()}`,
  });
  console.log("saved", saved.saved, "batch", saved.batchId);

  // summary
  const bank2 = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
  const active = bank2.items.filter(
    (i) => i.level === 1 && i.domain === "reading" && i.status === "approved"
  );
  console.log(
    JSON.stringify(
      {
        activeL1Reading: active.length,
        passages: active.map((i) => ({
          id: i.id,
          head: (i.passage || "").slice(0, 50),
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
