#!/usr/bin/env python3
"""Per-level item count + quality QC (logical 6-lane vector).

Usage (repo root):
  python harness/level-item-qc/scripts/run_level_item_qc.py
  python harness/level-item-qc/scripts/run_level_item_qc.py --min-per-domain 4 --min-total 12
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HARNESS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = HARNESS_DIR.parents[1]
DOMAINS = ("vocabulary", "grammar", "reading")
ACTIVE = {"approved", "pending"}

LANE_KEYS = {
    "lane_id",
    "item_id",
    "result",
    "confidence",
    "evidence",
    "unresolved",
}
RESULT_KEYS = {
    "level",
    "verdict",
    "counts",
    "quality",
    "defects",
    "hard_fail",
}


def defect(code: str, severity: str, path: str, message: str) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "path": path,
        "message": message,
    }


def is_incomplete_vocab(q: str) -> bool:
    s = re.sub(r"\s+", " ", (q or "").strip())
    if re.match(r"^(한글 뜻에 맞는 (?:단어|올바른 철자)를 고르시오\.?)$", s, re.I):
        return True
    if "한글 뜻에 맞는" in s and not re.search(r"한글\s*뜻\s*:", q or "") and len(s) < 40:
        return True
    return False


def quality_scan(items: list[dict[str, Any]], level: int) -> tuple[list[dict[str, Any]], dict[str, int]]:
    defects: list[dict[str, Any]] = []
    tallies: Counter[str] = Counter()
    for it in items:
        iid = str(it.get("id") or "?")
        path = f"data/generated-bank/items.json#{iid}"
        q = it.get("question") or ""
        domain = it.get("domain")

        if str(it.get("irtSource")) == "test" or iid.startswith("seed-export-"):
            defects.append(defect("SEED_ACTIVE", "error", path, "seed/demo still active"))
            tallies["SEED_ACTIVE"] += 1

        if domain == "vocabulary" and is_incomplete_vocab(q):
            defects.append(defect("INCOMPLETE_STEM", "error", path, "incomplete vocab stem"))
            tallies["INCOMPLETE_STEM"] += 1

        if re.search(r"closest in meaning to", q, re.I):
            defects.append(defect("GENERIC_SYNONYM", "error", path, "generic synonym pattern"))
            tallies["GENERIC_SYNONYM"] += 1

        if it.get("type") == "multiple_choice":
            opts = it.get("options")
            if not isinstance(opts, list) or len(opts) != 4:
                defects.append(defect("OPTIONS_BAD", "error", path, "need 4 options"))
                tallies["OPTIONS_BAD"] += 1
            else:
                lows = [str(o).strip().lower() for o in opts]
                if any(not o for o in lows) or len(set(lows)) < 4:
                    defects.append(defect("OPTIONS_BAD", "error", path, "empty/duplicate options"))
                    tallies["OPTIONS_BAD"] += 1
                try:
                    idx = int(str(it.get("answer")).strip())
                    if idx < 0 or idx > 3:
                        raise ValueError
                except (TypeError, ValueError):
                    defects.append(defect("OPTIONS_BAD", "error", path, "bad answer index"))
                    tallies["OPTIONS_BAD"] += 1

        if domain == "reading":
            passage = (it.get("passage") or "").strip()
            if len(passage) < 40 and not re.search(r"\[지문\]|passage|다음 글", q, re.I):
                defects.append(defect("READING_NO_PASSAGE", "error", path, "reading without passage"))
                tallies["READING_NO_PASSAGE"] += 1

        irt = it.get("irt") if isinstance(it.get("irt"), dict) else {}
        try:
            a, b, c = float(irt["a"]), float(irt["b"]), float(irt["c"])
            theta = float(it.get("targetTheta"))
            if abs(b - theta) > 1.0:
                defects.append(
                    defect("B_FAR_THETA", "warning", path, f"|b-θ|={abs(b-theta):.2f}")
                )
                tallies["B_FAR_THETA"] += 1
            if a < 0.5 or a > 2.8 or (
                it.get("type") == "multiple_choice" and (c < 0.15 or c > 0.35)
            ):
                defects.append(defect("IRT_SOFT", "warning", path, f"a={a} c={c}"))
                tallies["IRT_SOFT"] += 1
        except (KeyError, TypeError, ValueError):
            defects.append(defect("IRT_SOFT", "warning", path, "irt incomplete"))
            tallies["IRT_SOFT"] += 1

        if it.get("status") == "pending":
            defects.append(defect("STATUS_PENDING", "info", path, "pending review"))
            tallies["STATUS_PENDING"] += 1

    return defects, dict(tallies)


def audit_level(
    level: int,
    items: list[dict[str, Any]],
    min_per_domain: int,
    min_total: int,
    allow_empty: bool,
) -> dict[str, Any]:
    lane_id = f"lane-L{level}"
    active = [
        it
        for it in items
        if isinstance(it, dict)
        and it.get("level") == level
        and str(it.get("status") or "") in ACTIVE
    ]
    by_domain = Counter(str(it.get("domain")) for it in active)
    by_status = Counter(str(it.get("status")) for it in active)
    defects: list[dict[str, Any]] = []
    evidence = [
        f"level={level}",
        f"active_total={len(active)}",
        f"by_domain={dict(by_domain)}",
        f"by_status={dict(by_status)}",
    ]

    if len(active) == 0:
        if not allow_empty:
            defects.append(
                defect(
                    "LEVEL_EMPTY",
                    "error",
                    f"level:{level}",
                    "no active items at this level",
                )
            )
    else:
        if len(active) < min_total:
            defects.append(
                defect(
                    "COUNT_TOTAL_LOW",
                    "error",
                    f"level:{level}",
                    f"active={len(active)} < min_total={min_total}",
                )
            )
        for d in DOMAINS:
            n = by_domain.get(d, 0)
            if n == 0:
                defects.append(
                    defect(
                        "COUNT_DOMAIN_ZERO",
                        "error",
                        f"level:{level}:{d}",
                        f"domain {d} has 0 active items",
                    )
                )
            elif n < min_per_domain:
                defects.append(
                    defect(
                        "COUNT_DOMAIN_LOW",
                        "error",
                        f"level:{level}:{d}",
                        f"{d} active={n} < min_per_domain={min_per_domain}",
                    )
                )

    q_defects, q_tallies = quality_scan(active, level)
    defects.extend(q_defects)

    errors = sum(1 for d in defects if d["severity"] == "error")
    warnings = sum(1 for d in defects if d["severity"] == "warning")
    if errors:
        verdict = "fail"
    elif warnings or by_status.get("pending", 0) > 0:
        verdict = "warn"
    else:
        verdict = "pass"

    counts = {
        "active_total": len(active),
        "approved": by_status.get("approved", 0),
        "pending": by_status.get("pending", 0),
        **{f"domain_{d}": by_domain.get(d, 0) for d in DOMAINS},
        "errors": errors,
        "warnings": warnings,
        "min_total": min_total,
        "min_per_domain": min_per_domain,
    }
    quality = {
        "error_rate": (errors / len(active)) if active else (1.0 if errors else 0.0),
        "warning_rate": (warnings / len(active)) if active else 0.0,
        **{f"tally_{k}": v for k, v in q_tallies.items()},
    }

    return {
        "lane_id": lane_id,
        "item_id": f"level:{level}",
        "result": {
            "level": level,
            "verdict": verdict,
            "counts": counts,
            "quality": quality,
            "defects": defects,
            "hard_fail": errors > 0,
        },
        "confidence": 0.95 if active or allow_empty else 0.99,
        "evidence": evidence,
        "unresolved": [],
    }


def schema_valid(row: dict[str, Any]) -> bool:
    if set(row.keys()) != LANE_KEYS:
        return False
    res = row.get("result")
    if not isinstance(res, dict) or set(res.keys()) != RESULT_KEYS:
        return False
    if res.get("verdict") not in {"pass", "warn", "fail"}:
        return False
    if not isinstance(res.get("hard_fail"), bool):
        return False
    if not isinstance(res.get("defects"), list):
        return False
    return True


def constraint_ok(row: dict[str, Any]) -> bool:
    res = row["result"]
    errs = sum(1 for d in res["defects"] if d["severity"] == "error")
    if res["verdict"] == "fail":
        return res["hard_fail"] and errs > 0
    if res["verdict"] == "pass":
        return errs == 0 and not res["hard_fail"]
    # warn
    return errs == 0 and not res["hard_fail"]


def reduce_levels(rows: list[dict[str, Any]]) -> dict[str, Any]:
    masks = {}
    exceptions = []
    for row in rows:
        lid = row["lane_id"]
        m = {
            "schema_valid": schema_valid(row),
            "provenance_present": bool(row.get("lane_id") and row.get("evidence")),
            "constraint_satisfied": schema_valid(row) and constraint_ok(row),
        }
        masks[lid] = m
        if not all(m.values()):
            exceptions.append(
                {
                    "lane_id": lid,
                    "trigger": "mask_false",
                    "failed": [k for k, v in m.items() if not v],
                }
            )

    verdicts = [r["result"]["verdict"] for r in rows]
    if any(v == "fail" for v in verdicts):
        overall = "fail"
    elif any(v == "warn" for v in verdicts):
        overall = "warn"
    else:
        overall = "pass"

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": overall,
        "masks": masks,
        "exceptions": exceptions,
        "levels": [
            {
                "level": r["result"]["level"],
                "verdict": r["result"]["verdict"],
                "counts": r["result"]["counts"],
                "quality": r["result"]["quality"],
                "defect_n": len(r["result"]["defects"]),
                "lane_id": r["lane_id"],
            }
            for r in sorted(rows, key=lambda x: x["result"]["level"])
        ],
        "defects": [
            {**d, "level": r["result"]["level"], "lane_id": r["lane_id"]}
            for r in rows
            for d in r["result"]["defects"]
        ],
    }


def write_report(path: Path, reduced: dict[str, Any], policy: dict[str, Any]) -> None:
    lines = [
        "# Level item QC report",
        "",
        f"- **Generated:** {reduced['generated_at']}",
        f"- **Harness:** level-item-qc",
        f"- **Overall:** `{reduced['overall']}`",
        f"- **Policy:** min_per_domain={policy['min_per_domain']} · min_total={policy['min_total']} · allow_empty={policy['allow_empty']}",
        f"- **Execution:** logical (L1–L6 sequential)",
        "",
        "## Level matrix",
        "",
        "| Level | Verdict | Active | Appr | Pend | Vocab | Gram | Read | Err | Warn |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for lv in reduced["levels"]:
        c = lv["counts"]
        lines.append(
            f"| L{lv['level']} | **{lv['verdict']}** | {c['active_total']} | {c['approved']} | {c['pending']} | "
            f"{c.get('domain_vocabulary', 0)} | {c.get('domain_grammar', 0)} | {c.get('domain_reading', 0)} | "
            f"{c['errors']} | {c['warnings']} |"
        )

    lines += ["", "## Masks", "", "| Lane | schema | constraint | provenance |", "|---|---|---|---|"]
    for lid, m in reduced["masks"].items():
        lines.append(
            f"| {lid} | {m['schema_valid']} | {m['constraint_satisfied']} | {m['provenance_present']} |"
        )

    by_sev = Counter(d["severity"] for d in reduced["defects"])
    lines += [
        "",
        "## Defect summary",
        "",
        f"- errors: **{by_sev.get('error', 0)}**",
        f"- warnings: **{by_sev.get('warning', 0)}**",
        f"- info: **{by_sev.get('info', 0)}**",
        "",
    ]
    for sev in ("error", "warning", "info"):
        chunk = [d for d in reduced["defects"] if d["severity"] == sev]
        if not chunk:
            continue
        lines.append(f"## {sev.upper()}s ({len(chunk)})")
        lines.append("")
        for d in chunk[:60]:
            lines.append(
                f"- L{d['level']} · `{d['code']}` · `{d['path']}` · {d['message']}"
            )
        if len(chunk) > 60:
            lines.append(f"- … +{len(chunk) - 60} more")
        lines.append("")

    lines += [
        "## Remediation hints",
        "",
        "- Underfilled levels → generate with `level` override + seed script / UI",
        "- Quality errors → `level-test-item-replace` fitness + Stage V2 replace",
        "- Empty L1/L4–L6 expected if only L2–L3 banked; set policy or fill",
        "",
        "## Acceptance",
        "",
        f"- levels 1–6 covered: {'PASS' if len(reduced['levels']) == 6 else 'FAIL'}",
        f"- report written: PASS",
        "",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", type=Path, default=REPO_ROOT / "data" / "generated-bank" / "items.json")
    ap.add_argument("--root", type=Path, default=HARNESS_DIR)
    ap.add_argument("--min-per-domain", type=int, default=3)
    ap.add_argument("--min-total", type=int, default=9)
    ap.add_argument("--allow-empty-levels", action="store_true")
    args = ap.parse_args()

    root = args.root.resolve()
    bank = json.loads(args.bank.resolve().read_text(encoding="utf-8"))
    items = bank.get("items") if isinstance(bank, dict) else bank
    if not isinstance(items, list):
        raise SystemExit("items[] missing")

    ws = root / "workspace"
    (ws / "lanes").mkdir(parents=True, exist_ok=True)
    (ws / "reports").mkdir(parents=True, exist_ok=True)

    policy = {
        "min_per_domain": args.min_per_domain,
        "min_total": args.min_total,
        "allow_empty": args.allow_empty_levels,
    }
    ownership = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "bank": str(args.bank.resolve()),
        "policy": policy,
        "lanes": {f"lane-L{n}": f"workspace/lanes/L{n}.json" for n in range(1, 7)},
    }
    (ws / "ownership.json").write_text(
        json.dumps(ownership, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    rows = []
    for level in range(1, 7):
        row = audit_level(
            level,
            [it for it in items if isinstance(it, dict)],
            args.min_per_domain,
            args.min_total,
            args.allow_empty_levels,
        )
        rows.append(row)
        (ws / "lanes" / f"L{level}.json").write_text(
            json.dumps(row, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    reduced = reduce_levels(rows)
    (ws / "reports" / "reduced.json").write_text(
        json.dumps(reduced, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    report = ws / "reports" / "LEVEL_QC_REPORT.md"
    write_report(report, reduced, policy)

    print(f"overall={reduced['overall']}")
    for lv in reduced["levels"]:
        c = lv["counts"]
        print(
            f"  L{lv['level']}: {lv['verdict']} active={c['active_total']} "
            f"V/G/R={c.get('domain_vocabulary',0)}/{c.get('domain_grammar',0)}/{c.get('domain_reading',0)} "
            f"err={c['errors']} warn={c['warnings']}"
        )
    print(f"report={report}")
    return 0 if reduced["overall"] != "fail" else 1


if __name__ == "__main__":
    raise SystemExit(main())
