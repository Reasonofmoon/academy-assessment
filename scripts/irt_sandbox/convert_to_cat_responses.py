"""
Convert wide dichotomous CSV → long format similar to echobridge cat_responses.

Output is SANDBOX only under data/irt-sample/out/.
Never writes to data/generated-bank or product paths.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "data" / "irt-sample" / "Dicht_Data2.csv"
OUT_DIR = ROOT / "data" / "irt-sample" / "out"
PROFILE = OUT_DIR / "profile_report.json"

# Fields aligned with echobridge migrations/cat_responses.sql (+ sandbox extras)
# Not all filled — CAT telemetry N/A for fixed-form matrix data.


def load_profile() -> dict | None:
    if PROFILE.exists():
        return json.loads(PROFILE.read_text(encoding="utf-8"))
    return None


def detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
    except csv.Error:
        return ","


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
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    delim = detect_delimiter(text[:8000])
    rows = list(csv.reader(text.splitlines(), delimiter=delim))
    header = [h.strip() for h in rows[0]]
    body = [r for r in rows[1:] if any(c.strip() for c in r)]
    width = len(header)
    body = [
        ([c.strip() for c in r] + [""] * width)[:width] for r in body
    ]

    if profile:
        id_col = profile.get("id_column") or header[0]
        item_cols = profile.get("item_columns") or []
    else:
        id_col = header[0]
        item_cols = []
        for name in header[1:]:
            j = header.index(name)
            vals = [r[j] for r in body]
            s = {v for v in vals if v}
            if s and s <= {"0", "1", "0.0", "1.0", "true", "false", "True", "False"}:
                item_cols.append(name)

    if id_col not in header:
        id_col = header[0]
    id_idx = header.index(id_col)
    item_indices = [(name, header.index(name)) for name in item_cols if name in header]

    long_rows: list[dict] = []
    matrix: list[list[int | None]] = []
    person_ids: list[str] = []
    skipped_missing = 0

    for r_i, r in enumerate(body):
        person = r[id_idx] or f"person-{r_i + 1}"
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
            # Shape mirrors cat_responses; CAT fields null/default for fixed form.
            long_rows.append(
                {
                    "session_id": session_id,
                    "step": step,
                    "item_id": f"dicht:{item_name}",
                    "domain": "vocabulary",  # dummy — source domain unknown
                    "dimension": None,
                    "passage_id": None,
                    "correct": corr,
                    "selected_option_id": None,
                    "response_time_ms": None,
                    "passage_ms": None,
                    "theta_before": None,
                    "theta_after": 0.0,  # filled later by 2PL person estimate
                    "se_before": None,
                    "se_after": 1.0,
                    "fisher_info_used": None,
                    "sandbox": True,
                    "source_dataset": "Dicht_Data2",
                    "source_person_id": person,
                    "source_item_col": item_name,
                }
            )
        matrix.append(row_vec)

    meta = {
        "source_file": str(path),
        "id_column": id_col,
        "item_ids": [f"dicht:{n}" for n, _ in item_indices],
        "item_columns": [n for n, _ in item_indices],
        "n_persons": len(person_ids),
        "n_items": len(item_indices),
        "n_long_rows": len(long_rows),
        "skipped_missing_cells": skipped_missing,
        "product_bank_merge": False,
        "schema_note": (
            "Long rows follow echobridge cat_responses field names where possible. "
            "domain is dummy; theta_after placeholder until estimate_2pl.py runs."
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

    # compact matrix for estimator
    (out_dir / "response_matrix.json").write_text(
        json.dumps(
            {
                "person_ids": bundle["person_ids"],
                "item_ids": meta["item_ids"],
                "item_columns": meta["item_columns"],
                "matrix": bundle["matrix"],  # 0/1/null
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
    profile = load_profile()
    bundle = convert(path, profile)
    write_outputs(bundle, OUT_DIR)
    m = bundle["meta"]
    print(
        f"long_rows={m['n_long_rows']} persons={m['n_persons']} items={m['n_items']} "
        f"missing_skipped={m['skipped_missing_cells']}"
    )
    print(f"wrote {OUT_DIR / 'cat_responses_long.jsonl'}")
    print(f"wrote {OUT_DIR / 'response_matrix.json'}")
    print("NOTE: product bank not modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
