"""
Convert wide dichotomous CSV → long format similar to echobridge cat_responses.

Person key prefers profile id_column / "Student ID" (not empty first col).
Output is SANDBOX only under data/irt-sample/out/.
Never writes to data/generated-bank or product paths.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from _common import (
    is_01_column,
    load_table,
    pick_id_column,
    pick_item_columns,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "data" / "irt-sample" / "Dicht_Data2.csv"
OUT_DIR = ROOT / "data" / "irt-sample" / "out"
PROFILE = OUT_DIR / "profile_report.json"


def load_profile() -> dict | None:
    if PROFILE.exists():
        return json.loads(PROFILE.read_text(encoding="utf-8"))
    return None


def parse_correct(raw: str) -> bool | None:
    if raw is None or str(raw).strip() == "":
        return None
    v = str(raw).strip().lower()
    if v in {"1", "1.0", "true", "t", "yes"}:
        return True
    if v in {"0", "0.0", "false", "f", "no"}:
        return False
    try:
        return float(v) >= 0.5
    except ValueError:
        return None


def convert(path: Path, profile: dict | None = None) -> dict:
    header, body, _delim = load_table(path)

    if profile and profile.get("id_column") is not None and profile.get("id_column") in header:
        id_col = profile["id_column"]
        id_idx = header.index(id_col)
        id_reason = profile.get("id_column_reason", "from_profile")
        item_cols = [
            c for c in (profile.get("item_columns") or []) if c in header and c != id_col
        ]
        if not item_cols:
            item_cols = pick_item_columns(header, body, id_idx)
    else:
        id_col, id_idx, id_reason = pick_id_column(header, body)
        item_cols = pick_item_columns(header, body, id_idx)

    item_indices = [(name, header.index(name)) for name in item_cols]

    long_rows: list[dict] = []
    matrix: list[list[int | None]] = []
    person_ids: list[str] = []
    skipped_missing = 0

    for r_i, r in enumerate(body):
        person = (r[id_idx] if id_idx < len(r) else "") or f"person-{r_i + 1}"
        person_ids.append(person)
        session_id = f"sandbox-{person}"
        row_vec: list[int | None] = []
        step = 0
        for item_name, j in item_indices:
            corr = parse_correct(r[j])
            if corr is None:
                row_vec.append(None)
                skipped_missing += 1
                continue
            row_vec.append(1 if corr else 0)
            step += 1
            long_rows.append(
                {
                    "session_id": session_id,
                    "step": step,
                    "item_id": f"dicht:Q{step:02d}",
                    "item_label": item_name[:200],
                    "domain": "vocabulary",  # dummy — source domain unknown
                    "dimension": None,
                    "passage_id": None,
                    "correct": corr,
                    "selected_option_id": None,
                    "response_time_ms": None,
                    "passage_ms": None,
                    "theta_before": None,
                    "theta_after": 0.0,
                    "se_before": None,
                    "se_after": 1.0,
                    "fisher_info_used": None,
                    "sandbox": True,
                    "source_dataset": "Dicht_Data2",
                    "source_person_id": person,
                    "source_person_id_column": id_col,
                    "source_item_col": item_name,
                }
            )
        matrix.append(row_vec)

    # stable short item ids for matrix (Q01..) while keeping labels
    short_item_ids = [f"dicht:Q{i + 1:02d}" for i in range(len(item_indices))]

    meta = {
        "source_file": str(path),
        "id_column": id_col,
        "id_column_index": id_idx,
        "id_column_reason": id_reason,
        "item_ids": short_item_ids,
        "item_columns": [n for n, _ in item_indices],
        "n_persons": len(person_ids),
        "n_items": len(item_indices),
        "n_long_rows": len(long_rows),
        "skipped_missing_cells": skipped_missing,
        "sample_person_ids": person_ids[:5],
        "product_bank_merge": False,
        "schema_note": (
            "Long rows follow echobridge cat_responses field names where possible. "
            "source_person_id is the raw Student ID. item_id is dicht:Q## (short); "
            "item_label holds the full stem header. domain is dummy."
        ),
    }
    return {
        "meta": meta,
        "person_ids": person_ids,
        "matrix": matrix,
        "long_rows": long_rows,
    }


def write_outputs(bundle: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = bundle["meta"]
    (out_dir / "convert_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with (out_dir / "cat_responses_long.jsonl").open("w", encoding="utf-8") as f:
        for row in bundle["long_rows"]:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    (out_dir / "response_matrix.json").write_text(
        json.dumps(
            {
                "person_ids": bundle["person_ids"],
                "item_ids": meta["item_ids"],
                "item_columns": meta["item_columns"],
                "id_column": meta["id_column"],
                "matrix": bundle["matrix"],
                "sandbox": True,
                "product_bank_merge": False,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_CSV
    if not path.exists():
        print(f"ERROR: CSV not found: {path}", file=sys.stderr)
        return 1
    # Ensure local imports work when run as script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    profile = load_profile()
    bundle = convert(path, profile)
    write_outputs(bundle, OUT_DIR)
    m = bundle["meta"]
    print(
        f"long_rows={m['n_long_rows']} persons={m['n_persons']} items={m['n_items']} "
        f"id_col={m['id_column']!r} reason={m['id_column_reason']} "
        f"sample_ids={m['sample_person_ids']}"
    )
    print(f"wrote {OUT_DIR / 'cat_responses_long.jsonl'}")
    print(f"wrote {OUT_DIR / 'response_matrix.json'}")
    print("NOTE: product bank not modified.")
    return 0


if __name__ == "__main__":
    # Allow `from _common import ...` when run as script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main(sys.argv))
