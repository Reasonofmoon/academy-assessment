/**
 * Rebalance MCQ answer keys in data/generated-bank/items.json.
 * Preserves correct option text; redistributes answer index evenly
 * (~25% for 4-option, ~20% for 5-option) within each status+domain group.
 *
 * Usage:
 *   node scripts/rebalance-bank-answer-keys.mjs
 *   node scripts/rebalance-bank-answer-keys.mjs --domain reading
 *   node scripts/rebalance-bank-answer-keys.mjs --status approved
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANK = path.join(ROOT, "data", "generated-bank", "items.json");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ONLY_DOMAIN = arg("--domain", "");
const ONLY_STATUS = arg("--status", "approved");

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function placeCorrectAt(options, from, to) {
  if (from === to) return { options: [...options], answer: from };
  const next = [...options];
  [next[from], next[to]] = [next[to], next[from]];
  return { options: next, answer: to };
}

function planKeys(n, k) {
  const base = Math.floor(n / k);
  const rem = n % k;
  const keys = [];
  for (let i = 0; i < k; i++) {
    const c = base + (i < rem ? 1 : 0);
    for (let j = 0; j < c; j++) keys.push(i);
  }
  return shuffle(keys);
}

function hist(items) {
  const h = {};
  for (const it of items) {
    if (it.type !== "multiple_choice") continue;
    const k = String(it.answer);
    h[k] = (h[k] || 0) + 1;
  }
  return h;
}

function main() {
  const bank = JSON.parse(fs.readFileSync(BANK, "utf-8"));
  const now = new Date().toISOString();

  // Group indices to rebalance
  const groups = new Map();
  bank.items.forEach((it, idx) => {
    if (it.type !== "multiple_choice") return;
    if (!Array.isArray(it.options) || it.options.length < 2) return;
    if (ONLY_STATUS && it.status !== ONLY_STATUS) return;
    if (ONLY_DOMAIN && it.domain !== ONLY_DOMAIN) return;
    const key = `${it.status}|${it.domain}|${it.options.length}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx);
  });

  let changed = 0;
  for (const [key, indices] of groups) {
    const nOpts = bank.items[indices[0]].options.length;
    const targets = planKeys(indices.length, nOpts);
    const before = hist(indices.map((i) => bank.items[i]));
    indices.forEach((idx, j) => {
      const it = bank.items[idx];
      const from = Number(it.answer);
      const safeFrom =
        Number.isInteger(from) && from >= 0 && from < it.options.length
          ? from
          : 0;
      const to = targets[j];
      const placed = placeCorrectAt(it.options, safeFrom, to);
      if (safeFrom !== to || String(it.answer) !== String(to)) {
        changed++;
        it.options = placed.options;
        it.answer = String(placed.answer);
        it.updatedAt = now;
        // Align guessing parameter with option count
        if (it.irt && typeof it.irt === "object") {
          const idealC = Math.round((1 / nOpts) * 100) / 100;
          if (it.irt.c == null || Math.abs(it.irt.c - 0.25) < 0.02 || nOpts === 5) {
            it.irt = { ...it.irt, c: idealC };
          }
        }
        it.reviewNote = [
          it.reviewNote,
          `answer-key rebalanced ${safeFrom}→${to} (${nOpts}-option)`,
        ]
          .filter(Boolean)
          .join("; ");
      }
    });
    const after = hist(indices.map((i) => bank.items[i]));
    console.log(key, "before", before, "after", after);
  }

  bank.updatedAt = now;
  fs.writeFileSync(BANK, JSON.stringify(bank, null, 2) + "\n", "utf-8");
  console.log(JSON.stringify({ changed, groups: groups.size }, null, 2));
}

main();
