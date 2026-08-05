#!/usr/bin/env python3
"""Level-test smoke: solve stratified sample items with Gemini, score vs gold.

Usage (repo root):
  python harness/level-test-smoke/scripts/run_level_test_smoke.py
  python harness/level-test-smoke/scripts/run_level_test_smoke.py --per-domain 1
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HARNESS = Path(__file__).resolve().parents[1]
REPO = HARNESS.parents[1]
DOMAINS = ("vocabulary", "grammar", "reading")


def load_env_local() -> dict[str, str]:
    env: dict[str, str] = {}
    p = REPO / ".env.local"
    if not p.exists():
        return env
    for line in p.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def call_gemini(api_key: str, model: str, prompt: str, attempt: int = 1) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.15 if attempt == 1 else 0.05,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    cands = data.get("candidates") or []
    if not cands:
        raise RuntimeError(f"no candidates: {json.dumps(data)[:200]}")
    parts = (cands[0].get("content") or {}).get("parts") or []
    texts = [p.get("text") for p in parts if isinstance(p.get("text"), str)]
    if not texts:
        raise RuntimeError("empty text")
    return "".join(texts)


def parse_json_loose(raw: str) -> dict[str, Any]:
    s = raw.strip()
    s = re.sub(r"^```json\s*", "", s, flags=re.I)
    s = re.sub(r"^```\s*", "", s)
    s = re.sub(r"```\s*$", "", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        i = s.find("{")
        if i >= 0:
            return json.loads(s[i:])
        raise


def sample_items(
    items: list[dict[str, Any]],
    level: int,
    per_domain: int,
    all_items: bool = False,
) -> list[dict[str, Any]]:
    """Stratified sample, or every approved MCQ at this level when all_items=True.

    per_domain <= 0 also means take all items in each domain.
    """
    pool = [
        it
        for it in items
        if it.get("level") == level
        and str(it.get("status") or "") == "approved"
        and it.get("type") == "multiple_choice"
    ]
    pool.sort(key=lambda x: (str(x.get("domain") or ""), str(x.get("id") or "")))
    if all_items or per_domain <= 0:
        return pool
    out: list[dict[str, Any]] = []
    for d in DOMAINS:
        dom = [it for it in pool if it.get("domain") == d]
        out.extend(dom[:per_domain])
    return out


def build_solve_prompt(item: dict[str, Any], level: int) -> str:
    opts = item.get("options") or []
    opt_lines = "\n".join(f"{i}) {o}" for i, o in enumerate(opts))
    passage = (item.get("passage") or "").strip()
    passage_block = f"Passage:\n\"\"\"\n{passage}\n\"\"\"\n\n" if passage else ""
    return f"""You are taking an English placement test at GLEAS level L{level}.
Solve this multiple-choice item carefully. Choose exactly one option index 0-3.

Do NOT skip. If unsure, pick the best answer and explain briefly.

Domain: {item.get("domain")}
{passage_block}Question:
{item.get("question")}

Options:
{opt_lines}

Return JSON only:
{{"chosen_index": 0, "reason": "one short sentence", "confidence": 0.0}}
"""


def solve_item(
    item: dict[str, Any],
    level: int,
    api_key: str,
    models: list[str],
) -> dict[str, Any]:
    gold = str(item.get("answer") or "").strip()
    iid = str(item.get("id") or "?")
    domain = str(item.get("domain") or "?")
    last_err = ""
    for model in models:
        for attempt in (1, 2):
            try:
                raw = call_gemini(
                    api_key, model, build_solve_prompt(item, level), attempt
                )
                data = parse_json_loose(raw)
                chosen = data.get("chosen_index", data.get("answer"))
                if isinstance(chosen, str) and chosen.isdigit():
                    chosen = int(chosen)
                if not isinstance(chosen, int):
                    raise ValueError(f"bad chosen_index {chosen!r}")
                chosen_s = str(chosen)
                is_correct = chosen_s == gold
                conf = float(data.get("confidence") or 0.5)
                flags: list[str] = []
                if is_correct:
                    flags.append("OK")
                else:
                    flags.append("KEY_MISMATCH")
                    if conf >= 0.75:
                        flags.append("HIGH_CONF_WRONG")
                reason = str(data.get("reason") or "")
                if re.search(r"ambiguous|two answers|unclear|both", reason, re.I):
                    flags.append("AMBIGUOUS")
                return {
                    "item_id": iid,
                    "domain": domain,
                    "chosen": chosen_s,
                    "gold": gold,
                    "is_correct": is_correct,
                    "solver_note": reason[:240],
                    "flags": flags,
                    "model": model,
                }
            except Exception as e:  # noqa: BLE001
                last_err = f"{model}: {e}"
                time.sleep(0.4 * attempt)
    return {
        "item_id": iid,
        "domain": domain,
        "chosen": "",
        "gold": gold,
        "is_correct": False,
        "solver_note": f"SOLVER_ERROR {last_err}"[:240],
        "flags": ["SOLVER_ERROR"],
        "model": models[0] if models else "",
    }


def lane_verdict(accuracy: float, total: int, pool_nonempty: bool) -> str:
    if total == 0:
        return "fail" if pool_nonempty else "pass"
    if accuracy < 1 / 3:
        return "fail"
    if accuracy < 2 / 3:
        return "warn"
    return "pass"


def run_lane(
    level: int,
    items: list[dict[str, Any]],
    per_domain: int,
    api_key: str,
    models: list[str],
    all_items: bool = False,
) -> dict[str, Any]:
    sample = sample_items(items, level, per_domain, all_items=all_items)
    results: list[dict[str, Any]] = []
    for idx, it in enumerate(sample, start=1):
        print(
            f"  [{idx}/{len(sample)}] {it.get('id')} ({it.get('domain')}) …",
            flush=True,
        )
        results.append(solve_item(it, level, api_key, models))
    correct = sum(1 for r in results if r["is_correct"])
    total = len(results)
    acc = (correct / total) if total else 0.0
    pool_n = sum(
        1
        for it in items
        if it.get("level") == level and it.get("status") == "approved"
    )
    verdict = lane_verdict(acc, total, pool_n > 0)
    return {
        "lane_id": f"lane-solve-L{level}",
        "item_id": f"level:{level}",
        "result": {
            "level": level,
            "attempts": total,
            "correct": correct,
            "total": total,
            "accuracy": round(acc, 4),
            "item_results": results,
            "verdict": verdict,
        },
        "confidence": 0.8 if total else 0.5,
        "evidence": [f"attempted={total}", f"correct={correct}", f"pool_approved={pool_n}"]
        + [r["item_id"] for r in results],
        "unresolved": [r["item_id"] for r in results if "SOLVER_ERROR" in r.get("flags", [])],
    }


def reduce_all(lanes: list[dict[str, Any]]) -> dict[str, Any]:
    total_c = sum(r["result"]["correct"] for r in lanes)
    total_n = sum(r["result"]["total"] for r in lanes)
    overall_acc = (total_c / total_n) if total_n else 0.0
    verdicts = [r["result"]["verdict"] for r in lanes]
    if any(v == "fail" for v in verdicts) or overall_acc < 0.5:
        overall = "fail"
    elif any(v == "warn" for v in verdicts):
        overall = "warn"
    else:
        overall = "pass"

    mismatches = [
        ir
        for r in lanes
        for ir in r["result"]["item_results"]
        if not ir["is_correct"]
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": overall,
        "overall_accuracy": round(overall_acc, 4),
        "correct": total_c,
        "total": total_n,
        "levels": [
            {
                "level": r["result"]["level"],
                "verdict": r["result"]["verdict"],
                "accuracy": r["result"]["accuracy"],
                "correct": r["result"]["correct"],
                "total": r["result"]["total"],
            }
            for r in sorted(lanes, key=lambda x: x["result"]["level"])
        ],
        "mismatches": mismatches,
        "lanes": lanes,
    }


def write_report(path: Path, reduced: dict[str, Any]) -> None:
    lines = [
        "# Level-test smoke report (agent-solved)",
        "",
        f"- **Generated:** {reduced['generated_at']}",
        f"- **Harness:** level-test-smoke",
        f"- **Overall:** `{reduced['overall']}`",
        f"- **Accuracy:** {reduced['correct']}/{reduced['total']} = **{reduced['overall_accuracy']:.0%}**",
        f"- **Execution:** logical sequential lanes; Gemini solves without gold",
        "",
        "## Level matrix",
        "",
        "| Level | Verdict | Correct | Total | Accuracy |",
        "|---|---|---:|---:|---:|",
    ]
    for lv in reduced["levels"]:
        lines.append(
            f"| L{lv['level']} | **{lv['verdict']}** | {lv['correct']} | {lv['total']} | {lv['accuracy']:.0%} |"
        )

    lines += ["", "## Item-by-item", ""]
    for lane in reduced["lanes"]:
        lvl = lane["result"]["level"]
        lines.append(f"### L{lvl}")
        lines.append("")
        for ir in lane["result"]["item_results"]:
            mark = "✓" if ir["is_correct"] else "✗"
            flags = ",".join(ir.get("flags") or [])
            lines.append(
                f"- {mark} `{ir['item_id']}` [{ir['domain']}] "
                f"chosen={ir['chosen']} gold={ir['gold']} · {flags}"
            )
            if ir.get("solver_note"):
                lines.append(f"  - note: {ir['solver_note'][:160]}")
        lines.append("")

    lines += ["## Mismatches (possible key/item issues)", ""]
    if reduced["mismatches"]:
        for ir in reduced["mismatches"]:
            lines.append(
                f"- `{ir['item_id']}` [{ir['domain']}] chosen={ir['chosen']} gold={ir['gold']} "
                f"flags={ir.get('flags')}"
            )
    else:
        lines.append("_None — all smoke items scored correct._")
    lines += [
        "",
        "## Interpretation",
        "",
        "- High accuracy: bank keys mostly consistent with solvable stems.",
        "- KEY_MISMATCH + HIGH_CONF_WRONG: review gold key or stem ambiguity.",
        "- SOLVER_ERROR: API/transient; re-run smoke.",
        "",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", type=Path, default=REPO / "data" / "generated-bank" / "items.json")
    ap.add_argument("--root", type=Path, default=HARNESS)
    ap.add_argument(
        "--per-domain",
        type=int,
        default=1,
        help="Items per domain per level. Use 0 with --all, or alone for all in each domain.",
    )
    ap.add_argument(
        "--all",
        action="store_true",
        help="Solve every approved MCQ (full-bank smoke). Ignores --per-domain cap.",
    )
    ap.add_argument("--levels", type=str, default="1,2,3,4,5,6")
    args = ap.parse_args()

    env = load_env_local()
    api_key = env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY missing (.env.local)")
    model = env.get("GEMINI_MODEL") or "gemini-2.5-flash"
    raw_models = [m for m in [model, "gemini-2.5-flash", "gemini-2.0-flash"] if m]
    seen: set[str] = set()
    models: list[str] = []
    for m in raw_models:
        if m not in seen:
            seen.add(m)
            models.append(m)

    bank = json.loads(args.bank.read_text(encoding="utf-8"))
    items = [it for it in bank.get("items", []) if isinstance(it, dict)]
    levels = [int(x) for x in args.levels.split(",") if x.strip()]

    root = args.root.resolve()
    (root / "workspace" / "lanes").mkdir(parents=True, exist_ok=True)
    (root / "workspace" / "reports").mkdir(parents=True, exist_ok=True)

    # Count approved MCQs for progress estimate
    approved_mcq = [
        it
        for it in items
        if str(it.get("status")) == "approved" and it.get("type") == "multiple_choice"
    ]
    ownership = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "mode": "full_bank" if args.all else "stratified",
        "per_domain": args.per_domain,
        "all_items": bool(args.all),
        "levels": levels,
        "models": models,
        "approved_mcq_count": len(approved_mcq),
    }
    (root / "workspace" / "ownership.json").write_text(
        json.dumps(ownership, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"mode={'full_bank' if args.all else 'stratified'} "
        f"approved_mcq={len(approved_mcq)} levels={levels}",
        flush=True,
    )

    lanes: list[dict[str, Any]] = []
    for lv in levels:
        print(f"=== solve L{lv} ===", flush=True)
        row = run_lane(
            lv,
            items,
            args.per_domain,
            api_key,
            models,
            all_items=bool(args.all),
        )
        lanes.append(row)
        (root / "workspace" / "lanes" / f"L{lv}.json").write_text(
            json.dumps(row, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        r = row["result"]
        print(
            f"  {r['verdict']} {r['correct']}/{r['total']} ({r['accuracy']:.0%})",
            flush=True,
        )

    reduced = reduce_all(lanes)
    (root / "workspace" / "reports" / "reduced.json").write_text(
        json.dumps(reduced, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    report = root / "workspace" / "reports" / "SMOKE_REPORT.md"
    write_report(report, reduced)
    print(
        f"overall={reduced['overall']} acc={reduced['correct']}/{reduced['total']} "
        f"({reduced['overall_accuracy']:.0%})"
    )
    print(f"report={report}")
    return 0 if reduced["overall"] != "fail" else 1


if __name__ == "__main__":
    raise SystemExit(main())
