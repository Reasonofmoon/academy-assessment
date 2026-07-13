"""
QC gates on sandbox / live 2PL item_params (Stage D).

Reads item_params_2pl.json (+ optional response_matrix.json for rpb / exposure).
Writes:
  - item_params_qc.json   (items + per-item qc block)
  - QC_REPORT.md
  - APPROVE_APPLY.draft.json  (pass-only candidates; NOT auto-applied)

Never writes product banks. Human must copy/edit draft → APPROVE_APPLY.json.

Usage:
  python scripts/irt_sandbox/qc_item_params.py data/irt-sample/out-fixture
  python scripts/irt_sandbox/qc_item_params.py --profile pilot data/irt-sample/out-live
  python scripts/irt_sandbox/qc_item_params.py --profile smoke data/irt-sample/out-fixture
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]

# Match estimate_2pl clamps
MIN_A, MAX_A = 0.2, 2.5
MIN_B, MAX_B = -3.5, 3.5
CLIP_EPS = 1e-6

PROFILES: dict[str, dict[str, Any]] = {
    # Design Stage D — pilot defaults
    "pilot": {
        "min_n_obs_b": 30,
        "min_n_obs_a": 50,
        "min_a": MIN_A,
        "max_a": MAX_A,
        "min_b": MIN_B,
        "max_b": MAX_B,
        "min_p_plus": 0.05,
        "max_p_plus": 0.95,
        "min_rpb": 0.15,
        "rpb_required": False,  # flag only when missing
        "fail_on_clip": True,
        "fail_on_rpb_low": True,
        "fail_on_p_extreme": True,
    },
    # Production readiness (LEVELTEST targets)
    "production": {
        "min_n_obs_b": 500,
        "min_n_obs_a": 1000,
        "min_a": MIN_A,
        "max_a": MAX_A,
        "min_b": MIN_B,
        "max_b": MAX_B,
        "min_p_plus": 0.05,
        "max_p_plus": 0.95,
        "min_rpb": 0.15,
        "rpb_required": True,
        "fail_on_clip": True,
        "fail_on_rpb_low": True,
        "fail_on_p_extreme": True,
    },
    # Fixture / educational — low N so pipeline can show both pass & fail
    "smoke": {
        "min_n_obs_b": 8,
        "min_n_obs_a": 12,
        "min_a": MIN_A,
        "max_a": MAX_A,
        "min_b": MIN_B,
        "max_b": MAX_B,
        "min_p_plus": 0.05,
        "max_p_plus": 0.95,
        "min_rpb": 0.10,
        "rpb_required": False,
        "fail_on_clip": True,
        "fail_on_rpb_low": True,
        "fail_on_p_extreme": True,
    },
}


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3 or n != len(ys):
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    if dx < 1e-12 or dy < 1e-12:
        return None
    return num / math.sqrt(dx * dy)


def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def compute_item_rest_rpb(
    matrix: list[list[int | None]],
    item_index: int,
) -> float | None:
    """Point-biserial: item score vs person rest-total (observed cells only)."""
    xs: list[float] = []
    ys: list[float] = []
    n_items = len(matrix[0]) if matrix else 0
    for row in matrix:
        y = row[item_index]
        if y is None:
            continue
        rest = [
            row[j]
            for j in range(n_items)
            if j != item_index and row[j] is not None
        ]
        if not rest:
            continue
        xs.append(float(y))
        ys.append(sum(rest) / len(rest))
    return pearson(xs, ys)


def compute_all_rpb(
    matrix: list[list[int | None]], item_ids: list[str]
) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for j, iid in enumerate(item_ids):
        out[iid] = compute_item_rest_rpb(matrix, j)
    return out


def exposure_rate(n_obs: int, n_persons: int) -> float | None:
    if n_persons <= 0:
        return None
    return round(n_obs / n_persons, 4)


def evaluate_item(
    item: dict[str, Any],
    *,
    profile: dict[str, Any],
    rpb: float | None,
    n_persons: int,
) -> dict[str, Any]:
    flags: list[str] = []
    n_obs = int(item.get("n_obs") or 0)
    a = float(item["a"])
    b = float(item["b"])
    p_plus = item.get("p_plus")
    p = float(p_plus) if p_plus is not None else None

    min_n_b = int(profile["min_n_obs_b"])
    min_n_a = int(profile["min_n_obs_a"])

    promote_b = n_obs >= min_n_b
    promote_a = n_obs >= min_n_a
    if not promote_b:
        flags.append(f"low_n_obs_b<{min_n_b}")
    if not promote_a:
        flags.append(f"low_n_obs_a<{min_n_a}")

    # Bounds (estimator clips; still flag boundary hits)
    if a < profile["min_a"] - CLIP_EPS or a > profile["max_a"] + CLIP_EPS:
        flags.append("a_out_of_range")
        promote_a = False
    elif abs(a - profile["min_a"]) < CLIP_EPS or abs(a - profile["max_a"]) < CLIP_EPS:
        flags.append("a_clipped")
        if profile.get("fail_on_clip"):
            promote_a = False

    if b < profile["min_b"] - CLIP_EPS or b > profile["max_b"] + CLIP_EPS:
        flags.append("b_out_of_range")
        promote_b = False
    elif abs(b - profile["min_b"]) < CLIP_EPS or abs(b - profile["max_b"]) < CLIP_EPS:
        flags.append("b_clipped")
        if profile.get("fail_on_clip"):
            promote_b = False

    if p is not None:
        if p <= profile["min_p_plus"] or p >= profile["max_p_plus"]:
            flags.append("p_plus_extreme")
            if profile.get("fail_on_p_extreme"):
                promote_a = False
                promote_b = False
    else:
        flags.append("p_plus_missing")

    if rpb is None:
        flags.append("rpb_unavailable")
        if profile.get("rpb_required"):
            promote_a = False
            promote_b = False
    else:
        if rpb < float(profile["min_rpb"]):
            flags.append(f"rpb_low<{profile['min_rpb']}")
            if profile.get("fail_on_rpb_low"):
                promote_a = False
                promote_b = False
        if rpb < 0:
            flags.append("rpb_negative")

    exp = exposure_rate(n_obs, n_persons)
    # exposure is log-only (never blocks promote)
    if exp is not None and exp >= 0.95:
        flags.append("exposure_near_1_log_only")
    if exp is not None and exp <= 0.05:
        flags.append("exposure_very_low_log_only")

    # Full promote = both a and b gates after all hard checks
    passed = promote_a and promote_b

    return {
        "pass": passed,
        "promote_a": promote_a,
        "promote_b": promote_b,
        "flags": flags,
        "rpb": round(rpb, 4) if rpb is not None else None,
        "exposure": exp,
        "n_obs": n_obs,
        "hard_flag_count": sum(
            1
            for f in flags
            if not f.endswith("_log_only") and f != "rpb_unavailable"
        ),
    }


def resolve_out_dir(path: Path) -> Path:
    """Accept out-dir or path to item_params_2pl.json."""
    if path.is_file():
        return path.parent
    return path


def run_qc(
    out_dir: Path,
    *,
    profile_name: str,
) -> dict[str, Any]:
    if profile_name not in PROFILES:
        raise SystemExit(
            f"Unknown profile {profile_name!r}. Choose: {', '.join(PROFILES)}"
        )
    profile = PROFILES[profile_name]

    params_path = out_dir / "item_params_2pl.json"
    params_doc = load_json(params_path)
    if not isinstance(params_doc, dict) or not params_doc.get("items"):
        raise SystemExit(f"ERROR: missing or empty {params_path}")

    matrix_path = out_dir / "response_matrix.json"
    matrix_doc = load_json(matrix_path)
    matrix: list[list[int | None]] = []
    item_ids_m: list[str] = []
    n_persons = int(params_doc.get("n_persons") or 0)

    rpb_by_id: dict[str, float | None] = {}
    if isinstance(matrix_doc, dict) and matrix_doc.get("matrix"):
        matrix = matrix_doc["matrix"]
        item_ids_m = list(matrix_doc.get("item_ids") or [])
        n_persons = len(matrix_doc.get("person_ids") or matrix)
        rpb_by_id = compute_all_rpb(matrix, item_ids_m)

    qc_items: list[dict[str, Any]] = []
    for it in params_doc["items"]:
        iid = it["item_id"]
        rpb = rpb_by_id.get(iid)
        qc = evaluate_item(it, profile=profile, rpb=rpb, n_persons=n_persons)
        enriched = {**it, "qc": qc, "irtSource": it.get("irtSource", "sandbox_2pl_jmle")}
        # Keep empirical promotion disabled in payload until human approve
        enriched["product_bank_merge"] = False
        enriched["empirical_eligible"] = qc["pass"]
        qc_items.append(enriched)

    n_pass = sum(1 for x in qc_items if x["qc"]["pass"])
    n_fail = len(qc_items) - n_pass
    n_promote_b = sum(1 for x in qc_items if x["qc"]["promote_b"])
    n_promote_a = sum(1 for x in qc_items if x["qc"]["promote_a"])

    # Flag frequency
    flag_counts: dict[str, int] = {}
    for x in qc_items:
        for f in x["qc"]["flags"]:
            flag_counts[f] = flag_counts.get(f, 0) + 1

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report_doc: dict[str, Any] = {
        "model": params_doc.get("model", "2PL"),
        "profile": profile_name,
        "gates": {
            k: v
            for k, v in profile.items()
            if not callable(v)
        },
        "generated_at": now,
        "source_params": str(params_path),
        "source_matrix": str(matrix_path) if matrix_path.exists() else None,
        "n_persons": n_persons,
        "n_items": len(qc_items),
        "n_pass": n_pass,
        "n_fail": n_fail,
        "n_promote_a": n_promote_a,
        "n_promote_b": n_promote_b,
        "flag_counts": dict(sorted(flag_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "items": qc_items,
        "product_bank_merge": False,
        "warning": (
            "QC only. Do not set irtSource=empirical without human APPROVE_APPLY.json. "
            "Draft file lists candidates only."
        ),
    }

    (out_dir / "item_params_qc.json").write_text(
        json.dumps(report_doc, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Draft approve — candidates that fully pass (human gate still required)
    draft = {
        "approved": False,
        "profile": profile_name,
        "generated_at": now,
        "note": (
            "DRAFT only. Set approved=true and rename/copy to APPROVE_APPLY.json "
            "after human review. Never auto-merge into product banks."
        ),
        "item_ids": [x["item_id"] for x in qc_items if x["qc"]["pass"]],
        "items": [
            {
                "item_id": x["item_id"],
                "a": x["a"],
                "b": x["b"],
                "c": x.get("c", 0.0),
                "n_obs": x["qc"]["n_obs"],
                "rpb": x["qc"]["rpb"],
                "irtSource_proposed": "empirical",
            }
            for x in qc_items
            if x["qc"]["pass"]
        ],
        "product_bank_merge": False,
    }
    (out_dir / "APPROVE_APPLY.draft.json").write_text(
        json.dumps(draft, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Markdown report
    md = build_markdown(report_doc)
    (out_dir / "QC_REPORT.md").write_text(md, encoding="utf-8")

    return report_doc


def build_markdown(doc: dict[str, Any]) -> str:
    lines = [
        "# QC report — item params (Stage D)",
        "",
        f"_Generated: {doc['generated_at']}_",
        "",
        f"- profile: **`{doc['profile']}`**",
        f"- persons: {doc['n_persons']}",
        f"- items: {doc['n_items']}",
        f"- **pass (full promote draft): {doc['n_pass']}** / fail: {doc['n_fail']}",
        f"- promote_b eligible: {doc['n_promote_b']}",
        f"- promote_a eligible: {doc['n_promote_a']}",
        f"- product_bank_merge: **false**",
        "",
        "## Gates",
        "",
        "| gate | value |",
        "|------|------:|",
    ]
    for k, v in doc["gates"].items():
        lines.append(f"| `{k}` | {v} |")

    lines.extend(
        [
            "",
            "## Flag counts",
            "",
            "| flag | n |",
            "|------|--:|",
        ]
    )
    if doc["flag_counts"]:
        for f, n in doc["flag_counts"].items():
            lines.append(f"| `{f}` | {n} |")
    else:
        lines.append("| (none) | 0 |")

    lines.extend(
        [
            "",
            "## Items",
            "",
            "| item_id | a | b | p+ | n | rpb | exp | pass | flags |",
            "|---------|--:|--:|---:|--:|----:|----:|:----:|-------|",
        ]
    )
    for it in doc["items"]:
        qc = it["qc"]
        flags = ", ".join(qc["flags"]) if qc["flags"] else "—"
        rpb = qc["rpb"] if qc["rpb"] is not None else "—"
        exp = qc["exposure"] if qc["exposure"] is not None else "—"
        mark = "✓" if qc["pass"] else "✗"
        lines.append(
            f"| {it['item_id']} | {it['a']} | {it['b']} | {it.get('p_plus')} | "
            f"{qc['n_obs']} | {rpb} | {exp} | {mark} | {flags} |"
        )

    lines.extend(
        [
            "",
            "## Next (human only)",
            "",
            "1. Review this table and `item_params_qc.json`.",
            "2. If candidates look good, edit `APPROVE_APPLY.draft.json` → "
            "`APPROVE_APPLY.json` and set `\"approved\": true`.",
            "3. Future: echobridge `apply-empirical-params --dry-run` then `--write`.",
            "",
            "**Do not merge into product banks from this script.**",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="QC gates on 2PL item params")
    p.add_argument(
        "path",
        nargs="?",
        default=str(ROOT / "data" / "irt-sample" / "out-live"),
        help="out-dir containing item_params_2pl.json (or path to that file)",
    )
    p.add_argument(
        "--profile",
        choices=sorted(PROFILES.keys()),
        default="pilot",
        help="gate thresholds (default: pilot)",
    )
    args = p.parse_args(argv)

    out_dir = resolve_out_dir(Path(args.path))
    if not out_dir.exists():
        print(f"ERROR: out-dir not found: {out_dir}", file=sys.stderr)
        return 1

    doc = run_qc(out_dir, profile_name=args.profile)
    print(
        f"profile={doc['profile']} items={doc['n_items']} "
        f"pass={doc['n_pass']} fail={doc['n_fail']} "
        f"promote_a={doc['n_promote_a']} promote_b={doc['n_promote_b']}"
    )
    print(f"wrote {out_dir / 'item_params_qc.json'}")
    print(f"wrote {out_dir / 'QC_REPORT.md'}")
    print(
        f"wrote {out_dir / 'APPROVE_APPLY.draft.json'} "
        f"(candidates={doc['n_pass']})"
    )
    print("NOTE: product bank not modified. Human APPROVE_APPLY required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
