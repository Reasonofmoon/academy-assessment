#!/usr/bin/env python3
"""Level-test fitness harness runner (logical lanes + reduce).

Usage (from repo root or harness root):
  python harness/level-test-item-replace/scripts/run_level_test_fitness.py
  python scripts/run_level_test_fitness.py --bank ../../data/generated-bank/items.json

Writes:
  workspace/ownership.json
  workspace/lanes/*.json
  workspace/level-test/replace_plan.json
  workspace/level-test/FITNESS_REPORT.md
  workspace/level-test/reduced.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HARNESS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = HARNESS_DIR.parents[1]

CODE_CATALOG = {
    "SEED_DEMO",
    "BANK_QUARANTINE",
    "GENERIC_SYNONYM",
    "INCOMPLETE_STEM",
    "B_FAR_THETA",
    "A_OUT_OF_RANGE",
    "C_UNUSUAL",
    "DISTRACTOR_WEAK",
    "ANSWER_INVALID",
    "CONSTRUCT_MISS",
    "LEVEL_LEXIS",
    "SLOT_DRIFT",
    "FORMAT_NEWLINE",
    "PASS",
}

READING_TYPES = {
    "main_idea",
    "detail",
    "inference",
    "purpose",
    "attitude",
    "vocabulary",
    "other",
}

LANE_KEYS = {
    "lane_id",
    "item_id",
    "result",
    "confidence",
    "evidence",
    "unresolved",
}
RESULT_KEYS = {
    "disposition_vote",
    "codes",
    "severity",
    "notes",
    "span",
}


def out(
    lane_id: str,
    item_id: str,
    vote: str,
    codes: list[str],
    severity: str,
    notes: str,
    span: str,
    evidence: list[str],
    confidence: float = 0.9,
    unresolved: list[str] | None = None,
) -> dict[str, Any]:
    if not codes:
        codes = ["PASS"]
    return {
        "lane_id": lane_id,
        "item_id": item_id,
        "result": {
            "disposition_vote": vote,
            "codes": codes,
            "severity": severity,
            "notes": notes,
            "span": span,
        },
        "confidence": confidence,
        "evidence": evidence,
        "unresolved": unresolved or [],
    }


def is_incomplete_vocab_stem(question: str) -> bool:
    q = re.sub(r"\s+", " ", (question or "").strip())
    if re.match(r"^(한글 뜻에 맞는 (?:단어|올바른 철자)를 고르시오\.?)$", q, re.I):
        return True
    if "한글 뜻에 맞는" in q and not re.search(r"한글\s*뜻\s*:", question or "") and len(q) < 40:
        return True
    return False


def lane_psychometric(item: dict[str, Any]) -> dict[str, Any]:
    iid = item.get("id") or "?"
    irt = item.get("irt") if isinstance(item.get("irt"), dict) else {}
    codes: list[str] = []
    evidence: list[str] = []
    try:
        a = float(irt.get("a"))
        b = float(irt.get("b"))
        c = float(irt.get("c"))
        evidence.append(f"irt a={a} b={b} c={c}")
    except (TypeError, ValueError):
        return out(
            "lane-psychometric",
            iid,
            "replace",
            ["B_FAR_THETA"],
            "error",
            "missing or non-numeric irt",
            "irt",
            ["irt missing"],
            0.95,
        )

    theta = item.get("targetTheta")
    try:
        theta_f = float(theta)
        evidence.append(f"targetTheta={theta_f}")
        if abs(b - theta_f) > 1.0:
            codes.append("B_FAR_THETA")
    except (TypeError, ValueError):
        codes.append("B_FAR_THETA")
        evidence.append("targetTheta missing")

    if a < 0.5 or a > 2.8:
        codes.append("A_OUT_OF_RANGE")
    if item.get("type") == "multiple_choice" and (c < 0.15 or c > 0.35):
        codes.append("C_UNUSUAL")

    if "B_FAR_THETA" in codes:
        return out(
            "lane-psychometric",
            iid,
            "replace",
            codes,
            "error",
            "b far from target theta or irt incomplete",
            "irt",
            evidence,
        )
    if codes:
        return out(
            "lane-psychometric",
            iid,
            "repair",
            codes,
            "warning",
            "soft IRT band warnings",
            "irt",
            evidence,
            0.75,
        )
    return out(
        "lane-psychometric",
        iid,
        "keep",
        ["PASS"],
        "pass",
        "irt within soft bands",
        "irt",
        evidence,
        0.85,
    )


def lane_construct(item: dict[str, Any]) -> dict[str, Any]:
    iid = item.get("id") or "?"
    domain = item.get("domain")
    q = item.get("question") or ""
    codes: list[str] = []
    evidence: list[str] = [f"domain={domain}", f"q_len={len(q)}"]

    if not q.strip():
        return out(
            "lane-construct",
            iid,
            "replace",
            ["CONSTRUCT_MISS"],
            "error",
            "empty question",
            "question",
            evidence,
        )

    if domain == "vocabulary" and is_incomplete_vocab_stem(q):
        codes.append("INCOMPLETE_STEM")

    if domain == "reading":
        passage = (item.get("passage") or "").strip()
        if len(passage) < 40 and not re.search(r"\[지문\]|passage|다음 글", q, re.I):
            codes.append("CONSTRUCT_MISS")
            evidence.append("reading missing passage")
        qt = item.get("questionType")
        if qt is not None and qt not in READING_TYPES:
            codes.append("SLOT_DRIFT")
            evidence.append(f"questionType={qt}")

    # KO prompt + EN body on same line
    if re.search(r"(고르시오\.?|것은\?)\s+[A-Za-z\"'“]", q) and "\n" not in q:
        codes.append("FORMAT_NEWLINE")

    if "INCOMPLETE_STEM" in codes or "CONSTRUCT_MISS" in codes:
        return out(
            "lane-construct",
            iid,
            "replace",
            codes,
            "error",
            "construct failure",
            "question",
            evidence,
        )
    if codes:
        return out(
            "lane-construct",
            iid,
            "repair",
            codes,
            "warning",
            "construct warnings",
            "question",
            evidence,
            0.8,
        )
    return out(
        "lane-construct",
        iid,
        "keep",
        ["PASS"],
        "pass",
        "construct ok",
        "question",
        evidence,
        0.85,
    )


def lane_options(item: dict[str, Any]) -> dict[str, Any]:
    iid = item.get("id") or "?"
    qtype = item.get("type")
    codes: list[str] = []
    evidence: list[str] = [f"type={qtype}"]

    if qtype == "multiple_choice":
        opts = item.get("options")
        if not isinstance(opts, list) or len(opts) != 4:
            codes.append("DISTRACTOR_WEAK")
            evidence.append(f"options_n={len(opts) if isinstance(opts, list) else 'na'}")
        else:
            trimmed = [str(o).strip() for o in opts]
            if any(not o for o in trimmed):
                codes.append("DISTRACTOR_WEAK")
                evidence.append("empty option")
            lower = [o.lower() for o in trimmed]
            if len(set(lower)) < 4:
                codes.append("DISTRACTOR_WEAK")
                evidence.append("duplicate options")
            lengths = [len(o) for o in trimmed]
            mean_l = sum(lengths) / 4
            if mean_l > 0 and max(lengths) >= mean_l * 3 and max(lengths) >= 20:
                codes.append("DISTRACTOR_WEAK")
                evidence.append("length tell")
            try:
                idx = int(str(item.get("answer")).strip())
                if idx < 0 or idx > 3:
                    codes.append("ANSWER_INVALID")
            except (TypeError, ValueError):
                codes.append("ANSWER_INVALID")
                evidence.append(f"answer={item.get('answer')!r}")
    else:
        if not str(item.get("answer") or "").strip():
            codes.append("ANSWER_INVALID")

    # unique codes preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for c in codes:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    codes = uniq

    if any(c in {"DISTRACTOR_WEAK", "ANSWER_INVALID"} for c in codes):
        # length-tell alone as only DISTRACTOR → still error if other hard flags; pure length → warning path
        hard = False
        opts = item.get("options") if isinstance(item.get("options"), list) else []
        if not opts or len(opts) != 4:
            hard = True
        elif any(not str(o).strip() for o in opts):
            hard = True
        elif len({str(o).strip().lower() for o in opts}) < 4:
            hard = True
        if "ANSWER_INVALID" in codes:
            hard = True
        if hard:
            return out(
                "lane-options",
                iid,
                "replace",
                codes,
                "error",
                "option/answer defect",
                "options",
                evidence,
            )
        return out(
            "lane-options",
            iid,
            "repair",
            codes,
            "warning",
            "soft option quality issue",
            "options",
            evidence,
            0.7,
        )
    return out(
        "lane-options",
        iid,
        "keep",
        ["PASS"],
        "pass",
        "options ok",
        "options",
        evidence,
        0.9,
    )


def lane_level_fit(item: dict[str, Any]) -> dict[str, Any]:
    iid = str(item.get("id") or "?")
    q = item.get("question") or ""
    codes: list[str] = []
    evidence: list[str] = [f"irtSource={item.get('irtSource')}", f"level={item.get('level')}"]

    src = str(item.get("irtSource") or "")
    if src == "test" or iid.startswith("seed-export-"):
        codes.append("SEED_DEMO")
        evidence.append("seed/demo item")

    if re.search(r"closest in meaning to", q, re.I):
        codes.append("GENERIC_SYNONYM")
        evidence.append("generic EN synonym template")
    if re.search(r"^Choose the (correct meaning|best word|word that best)", q.strip(), re.I):
        if not re.search(r"[가-힣]", q):
            codes.append("GENERIC_SYNONYM")
            evidence.append("EN-only MCQ shell")

    # crude level lexis: L1-L2 with many long tokens
    level = item.get("level")
    if isinstance(level, int) and level <= 2:
        tokens = re.findall(r"[A-Za-z]{10,}", q + " " + " ".join(item.get("options") or []))
        if len(tokens) >= 3:
            codes.append("LEVEL_LEXIS")
            evidence.append(f"long_tokens={tokens[:5]}")

    if "SEED_DEMO" in codes:
        return out(
            "lane-level-fit",
            iid,
            "quarantine",
            codes,
            "error",
            "seed/demo not for level test",
            "item",
            evidence,
            0.99,
        )
    if "GENERIC_SYNONYM" in codes:
        return out(
            "lane-level-fit",
            iid,
            "replace",
            codes,
            "error",
            "generic pattern unsuitable for placement",
            "question",
            evidence,
            0.9,
        )
    if codes:
        return out(
            "lane-level-fit",
            iid,
            "repair",
            codes,
            "warning",
            "level-fit warnings",
            "question",
            evidence,
            0.7,
        )
    return out(
        "lane-level-fit",
        iid,
        "keep",
        ["PASS"],
        "pass",
        "level-fit ok",
        "item",
        evidence,
        0.85,
    )


def schema_valid(row: dict[str, Any]) -> bool:
    if set(row.keys()) != LANE_KEYS:
        return False
    res = row.get("result")
    if not isinstance(res, dict) or set(res.keys()) != RESULT_KEYS:
        return False
    if res.get("disposition_vote") not in {"keep", "repair", "replace", "quarantine"}:
        return False
    if res.get("severity") not in {"pass", "warning", "error"}:
        return False
    codes = res.get("codes")
    if not isinstance(codes, list) or not codes:
        return False
    return True


def constraint_satisfied(row: dict[str, Any]) -> bool:
    res = row["result"]
    sev = res["severity"]
    vote = res["disposition_vote"]
    codes = [c for c in res["codes"] if c != "PASS"]
    if sev == "error" and vote == "keep":
        return False
    if sev == "pass" and vote not in {"keep"}:
        return False
    if "SEED_DEMO" in codes and vote != "quarantine":
        return False
    return True


def provenance_ok(row: dict[str, Any]) -> bool:
    if not row.get("lane_id"):
        return False
    if row["result"]["severity"] == "pass":
        return True
    return bool(row.get("evidence"))


def code_from_catalog(row: dict[str, Any]) -> bool:
    return all(c in CODE_CATALOG for c in row["result"]["codes"])


# Hard error codes always win over keep votes (catalog precedence).
HARD_REPLACE_CODES = {
    "B_FAR_THETA",
    "INCOMPLETE_STEM",
    "CONSTRUCT_MISS",
    "ANSWER_INVALID",
    "GENERIC_SYNONYM",
}


def merge_disposition(codes: list[str], votes: list[str]) -> str:
    """Deterministic disposition from merged codes + lane votes.

    Precedence: SEED_DEMO/BANK_QUARANTINE → hard error codes replace →
    replace votes → repair warnings → keep.
    keep vs replace without a hard code is lane_conflict (caller handles).
    """
    if "SEED_DEMO" in codes or "BANK_QUARANTINE" in codes:
        return "quarantine"
    if votes and all(v == "quarantine" for v in votes):
        return "quarantine"

    if any(c in HARD_REPLACE_CODES for c in codes):
        return "replace"

    # DISTRACTOR_WEAK: replace only if a lane voted replace (true hard option defect)
    if "DISTRACTOR_WEAK" in codes and "replace" in votes:
        return "replace"

    if "replace" in votes and "keep" in votes:
        return "conflict"
    if "replace" in votes:
        return "replace"

    if any(v == "repair" for v in votes) or any(
        c in codes
        for c in (
            "A_OUT_OF_RANGE",
            "C_UNUSUAL",
            "FORMAT_NEWLINE",
            "SLOT_DRIFT",
            "LEVEL_LEXIS",
            "DISTRACTOR_WEAK",
        )
    ):
        return "repair"
    return "keep"


def build_replacement_spec(item: dict[str, Any], codes: list[str]) -> dict[str, Any]:
    domain = item.get("domain")
    level = item.get("level")
    spec: dict[str, Any] = {
        "domain": domain,
        "level": level,
        "targetTheta": item.get("targetTheta"),
        "mcqOnly": True,
        "codes": codes,
        "exemplar_policy": "same_level_dim",
    }
    if domain == "vocabulary":
        spec["dimension"] = item.get("dimension") or "D2_Meaning"
        spec["stem_pattern"] = "meaning_to_word_ko"
        spec["require_headword"] = True
        if "GENERIC_SYNONYM" in codes:
            spec["forbid_patterns"] = ["closest in meaning to", "EN-only synonym"]
    elif domain == "reading":
        spec["questionType"] = item.get("questionType") or "main_idea"
        spec["passage_policy"] = "preset_fixed"
        if item.get("passage"):
            spec["passage_id_hint"] = item.get("exemplarIds") or []
    elif domain == "grammar":
        spec["stem_pattern"] = "form_in_context"
    return spec


def reduce_all(
    items: list[dict[str, Any]],
    lane_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    by_item: dict[str, list[dict[str, Any]]] = defaultdict(list)
    masks: dict[str, dict[str, bool]] = {}
    exceptions: list[dict[str, Any]] = []

    for lane_id, rows in lane_rows.items():
        for row in rows:
            iid = row.get("item_id", "")
            mid = f"{lane_id}::{iid}"
            m = {
                "schema_valid": schema_valid(row),
                "constraint_satisfied": schema_valid(row) and constraint_satisfied(row),
                "provenance_present": provenance_ok(row),
                "code_from_catalog": schema_valid(row) and code_from_catalog(row),
            }
            masks[mid] = m
            if not all(m.values()):
                exceptions.append(
                    {
                        "lane_id": lane_id,
                        "item_id": iid,
                        "trigger": "mask_false",
                        "failed_masks": [k for k, v in m.items() if not v],
                    }
                )
            by_item[iid].append(row)

    item_by_id = {str(i.get("id")): i for i in items}
    plan = {
        "keep": [],
        "repair": [],
        "replace": [],
        "quarantine": [],
        "exceptions": [],
    }
    per_item: list[dict[str, Any]] = []

    for iid, rows in sorted(by_item.items()):
        codes: list[str] = []
        votes: list[str] = []
        lane_detail = []
        for row in rows:
            votes.append(row["result"]["disposition_vote"])
            for c in row["result"]["codes"]:
                if c != "PASS" and c not in codes:
                    codes.append(c)
            lane_detail.append(
                {
                    "lane_id": row["lane_id"],
                    "vote": row["result"]["disposition_vote"],
                    "codes": row["result"]["codes"],
                    "severity": row["result"]["severity"],
                }
            )

        disp = merge_disposition(codes, votes)
        if disp == "conflict":
            exceptions.append(
                {
                    "item_id": iid,
                    "trigger": "lane_conflict",
                    "votes": votes,
                    "codes": codes,
                }
            )
            plan["exceptions"].append(
                {"item_id": iid, "trigger": "lane_conflict", "votes": votes, "codes": codes}
            )

        entry: dict[str, Any] = {
            "item_id": iid,
            "disposition": disp if disp != "conflict" else "needs_human",
            "codes": codes,
            "lanes": lane_detail,
        }
        item = item_by_id.get(iid, {})
        if disp == "keep":
            plan["keep"].append(iid)
        elif disp == "repair":
            ops = []
            if "FORMAT_NEWLINE" in codes:
                ops.append("normalize_newlines")
            if "A_OUT_OF_RANGE" in codes or "C_UNUSUAL" in codes:
                ops.append("review_irt_soft")
            if "LEVEL_LEXIS" in codes:
                ops.append("review_lexis")
            if "SLOT_DRIFT" in codes:
                ops.append("fix_question_type")
            entry["ops"] = ops or ["manual_review"]
            plan["repair"].append({"item_id": iid, "ops": entry["ops"], "codes": codes})
        elif disp == "quarantine":
            plan["quarantine"].append(iid)
        elif disp == "replace":
            spec = build_replacement_spec(item, codes)
            entry["replacement_spec"] = spec
            plan["replace"].append(
                {
                    "item_id": iid,
                    "slot": {
                        "domain": item.get("domain"),
                        "level": item.get("level"),
                        "dimension": item.get("dimension"),
                        "questionType": item.get("questionType"),
                    },
                    "targetTheta": item.get("targetTheta"),
                    "codes": codes,
                    "replacement_spec": spec,
                }
            )
        per_item.append(entry)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "item_count": len(items),
        "masks": masks,
        "exceptions": exceptions,
        "per_item": per_item,
        "plan": plan,
        "counts": {
            "keep": len(plan["keep"]),
            "repair": len(plan["repair"]),
            "replace": len(plan["replace"]),
            "quarantine": len(plan["quarantine"]),
            "exceptions": len(plan["exceptions"]),
        },
    }


def write_report(path: Path, reduced: dict[str, Any]) -> None:
    plan = reduced["plan"]
    lines = [
        "# Level-test fitness report",
        "",
        f"- **Generated:** {reduced['generated_at']}",
        f"- **Harness:** level-test-item-replace",
        f"- **Items:** {reduced['item_count']}",
        f"- **Execution:** logical (sequential lanes)",
        "",
        "## Disposition counts",
        "",
        f"| keep | repair | replace | quarantine | exceptions |",
        f"|---:|---:|---:|---:|---:|",
        f"| {reduced['counts']['keep']} | {reduced['counts']['repair']} | {reduced['counts']['replace']} | {reduced['counts']['quarantine']} | {reduced['counts']['exceptions']} |",
        "",
        "## Quarantine",
        "",
    ]
    if plan["quarantine"]:
        for iid in plan["quarantine"]:
            lines.append(f"- `{iid}`")
    else:
        lines.append("_None_")
    lines += ["", "## Replace", ""]
    if plan["replace"]:
        for r in plan["replace"]:
            lines.append(
                f"- `{r['item_id']}` · codes={r['codes']} · slot={r['slot']} · θ={r.get('targetTheta')}"
            )
    else:
        lines.append("_None_")
    lines += ["", "## Repair", ""]
    if plan["repair"]:
        for r in plan["repair"]:
            lines.append(f"- `{r['item_id']}` · ops={r['ops']} · codes={r['codes']}")
    else:
        lines.append("_None_")
    lines += ["", "## Keep (ids)", ""]
    if plan["keep"]:
        lines.append(", ".join(f"`{i}`" for i in plan["keep"][:40]))
        if len(plan["keep"]) > 40:
            lines.append(f"… +{len(plan['keep']) - 40} more")
    else:
        lines.append("_None_")
    lines += ["", "## Exceptions", ""]
    if reduced["exceptions"]:
        for e in reduced["exceptions"][:50]:
            lines.append(f"- {e}")
    else:
        lines.append("_None — all masks passed or conflicts recorded in plan._")
    lines += [
        "",
        "## Acceptance",
        "",
        f"- full item coverage: {'PASS' if reduced['item_count'] == len(reduced['per_item']) else 'FAIL'}",
        f"- replace specs present: {'PASS' if all('replacement_spec' in r for r in plan['replace']) else 'FAIL'}",
        f"- report written: PASS",
        "",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--bank",
        type=Path,
        default=REPO_ROOT / "data" / "generated-bank" / "items.json",
        help="path to generated-bank items.json",
    )
    ap.add_argument(
        "--root",
        type=Path,
        default=HARNESS_DIR,
        help="harness root",
    )
    args = ap.parse_args()
    root: Path = args.root.resolve()
    bank_path: Path = args.bank.resolve()

    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    items = bank.get("items") if isinstance(bank, dict) else bank
    if not isinstance(items, list):
        raise SystemExit("bank items[] missing")

    ws = root / "workspace"
    (ws / "lanes").mkdir(parents=True, exist_ok=True)
    (ws / "level-test").mkdir(parents=True, exist_ok=True)

    ownership = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "bank": str(bank_path),
        "item_count": len(items),
        "lanes": {
            "lane-psychometric": "workspace/lanes/psychometric.json",
            "lane-construct": "workspace/lanes/construct.json",
            "lane-options": "workspace/lanes/options.json",
            "lane-level-fit": "workspace/lanes/level-fit.json",
        },
    }
    (ws / "ownership.json").write_text(
        json.dumps(ownership, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    runners = [
        ("psychometric.json", "lane-psychometric", lane_psychometric),
        ("construct.json", "lane-construct", lane_construct),
        ("options.json", "lane-options", lane_options),
        ("level-fit.json", "lane-level-fit", lane_level_fit),
    ]
    lane_rows: dict[str, list[dict[str, Any]]] = {}
    for filename, lane_id, fn in runners:
        rows = []
        for it in items:
            if not isinstance(it, dict):
                continue
            # Terminal bank quarantine: all lanes emit quarantine vote (no re-replace).
            if str(it.get("status") or "") == "quarantine":
                iid = str(it.get("id") or "?")
                note = str(it.get("reviewNote") or "status=quarantine")
                is_seed = str(it.get("irtSource")) == "test" or iid.startswith(
                    "seed-"
                )
                rows.append(
                    out(
                        lane_id,
                        iid,
                        "quarantine",
                        ["SEED_DEMO"] if is_seed else ["BANK_QUARANTINE"],
                        "error",
                        f"bank status quarantine — skip replace planning ({note[:100]})",
                        "item",
                        ["status=quarantine"],
                        0.99,
                    )
                )
                continue
            rows.append(fn(it))
        lane_rows[lane_id] = rows
        (ws / "lanes" / filename).write_text(
            json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    reduced = reduce_all([it for it in items if isinstance(it, dict)], lane_rows)
    (ws / "level-test" / "reduced.json").write_text(
        json.dumps(reduced, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (ws / "level-test" / "replace_plan.json").write_text(
        json.dumps(reduced["plan"], indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    write_report(ws / "level-test" / "FITNESS_REPORT.md", reduced)

    c = reduced["counts"]
    print(
        f"items={reduced['item_count']} keep={c['keep']} repair={c['repair']} "
        f"replace={c['replace']} quarantine={c['quarantine']} exceptions={c['exceptions']}"
    )
    print(f"report={ws / 'level-test' / 'FITNESS_REPORT.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
