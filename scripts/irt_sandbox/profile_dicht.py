"""
Profile Dicht_Data2.csv (or any wide dichotomous matrix).
Person key prefers "Student ID" over empty/index first column.
Does NOT touch product banks.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    load_table,
    pick_id_column,
    pick_item_columns,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "data" / "irt-sample" / "Dicht_Data2.csv"
OUT_DIR = ROOT / "data" / "irt-sample" / "out"


def to_float_or_none(v: str) -> float | None:
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def profile(path: Path) -> dict:
    header, body, delim = load_table(path)
    n_rows = len(body)
    n_cols = len(header)

    id_col, id_idx, id_reason = pick_id_column(header, body)
    item_cols = pick_item_columns(header, body, id_idx)

    col_profiles = []
    for j, name in enumerate(header):
        vals = [r[j] for r in body]
        empty = sum(1 for v in vals if v == "")
        non_empty = [v for v in vals if v != ""]
        uniq = len(set(non_empty))
        top = Counter(non_empty).most_common(6)
        nums = [to_float_or_none(v) for v in non_empty]
        num_ok = [x for x in nums if x is not None]
        non_num = sum(1 for x in nums if x is None)

        if j == id_idx:
            kind = "id_person"
        elif not (name or "").strip() and j != id_idx:
            kind = "row_index_or_empty"
        elif name in item_cols:
            kind = "dichotomous_item"
        elif non_num == 0 and num_ok:
            kind = "numeric"
        elif non_num > 0:
            kind = "categorical_or_text"
        else:
            kind = "unknown"

        stats: dict = {
            "index": j,
            "name": name,
            "kind": kind,
            "empty": empty,
            "empty_rate": round(empty / n_rows, 4) if n_rows else 0,
            "unique_non_empty": uniq,
            "top_values": top,
        }
        if num_ok:
            stats["min"] = min(num_ok)
            stats["max"] = max(num_ok)
            stats["mean"] = round(sum(num_ok) / len(num_ok), 6)
            if kind == "dichotomous_item":
                ones = sum(1 for x in num_ok if x >= 0.5)
                stats["p_plus"] = round(ones / len(num_ok), 4)
        col_profiles.append(stats)

    item_idx = [header.index(c) for c in item_cols]
    missing_cells = 0
    total_cells = n_rows * len(item_idx) if item_idx else 0
    row_sums = []
    for r in body:
        s = 0
        for j in item_idx:
            v = r[j]
            if v == "":
                missing_cells += 1
            else:
                try:
                    s += 1 if float(v) >= 0.5 else 0
                except ValueError:
                    missing_cells += 1
        row_sums.append(s)

    # person id uniqueness
    person_vals = [r[id_idx] for r in body]
    person_nonempty = [v for v in person_vals if v != ""]
    person_unique = len(set(person_nonempty))

    report = {
        "source_file": str(path),
        "file_bytes": path.stat().st_size,
        "delimiter": delim,
        "n_rows": n_rows,
        "n_cols": n_cols,
        "id_column": id_col,
        "id_column_index": id_idx,
        "id_column_reason": id_reason,
        "id_unique_count": person_unique,
        "id_empty_count": sum(1 for v in person_vals if v == ""),
        "n_item_columns": len(item_cols),
        "item_columns": item_cols,
        "missing_item_cells": missing_cells,
        "missing_item_rate": round(missing_cells / total_cells, 6) if total_cells else 0,
        "score_sum": {
            "min": min(row_sums) if row_sums else None,
            "max": max(row_sums) if row_sums else None,
            "mean": round(sum(row_sums) / len(row_sums), 4) if row_sums else None,
        },
        "columns": col_profiles,
        "product_bank_merge": False,
        "notes": [
            "Sandbox only — do not merge into generated-bank or echobridge curated services.",
            "Person key prefers columns named like 'Student ID' over empty/index first columns.",
            "Dichotomous columns treated as 0/1 scored responses (not raw option letters).",
        ],
    }
    return report


def write_reports(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "profile_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        "# Dicht / dichotomous CSV profile",
        "",
        f"- source: `{report['source_file']}`",
        f"- bytes: {report['file_bytes']}",
        f"- delimiter: `{report['delimiter']!r}`",
        f"- rows (persons): **{report['n_rows']}**",
        f"- cols: **{report['n_cols']}**",
        f"- **id column (person key): `{report['id_column']}`** (index {report['id_column_index']}, reason={report['id_column_reason']})",
        f"- id unique / empty: {report['id_unique_count']} / {report['id_empty_count']}",
        f"- dichotomous item cols: **{report['n_item_columns']}**",
        f"- missing item cells: {report['missing_item_cells']} ({report['missing_item_rate']})",
        f"- total score range: {report['score_sum']}",
        "",
        "## Item columns (p+)",
        "",
        "| # | item (truncated) | empty_rate | p+ |",
        "|--:|----------------|----------:|---:|",
    ]
    for i, c in enumerate(report["columns"], 1):
        if c["kind"] != "dichotomous_item":
            continue
        label = c["name"] if len(c["name"]) <= 70 else c["name"][:67] + "..."
        lines.append(
            f"| {i} | {label} | {c['empty_rate']} | {c.get('p_plus', '')} |"
        )
    lines.extend(
        [
            "",
            "## Column kinds",
            "",
            "| index | name (truncated) | kind |",
            "|------:|----------------|------|",
        ]
    )
    for c in report["columns"]:
        nm = c["name"] if c["name"] else "(empty)"
        if len(nm) > 50:
            nm = nm[:47] + "..."
        lines.append(f"| {c['index']} | {nm} | {c['kind']} |")
    lines.extend(
        [
            "",
            "## Applicability (quick)",
            "",
            "- Long-format conversion: **yes** if item cols are 0/1.",
            "- Product bank merge: **no** (no stems/options / wrong domain for GLEAS English).",
            "- 2PL sandbox: **yes** for algorithm check only.",
            "",
        ]
    )
    (out_dir / "profile_report.md").write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT_CSV
    if not path.exists():
        print(f"ERROR: CSV not found: {path}", file=sys.stderr)
        print(
            "Place Dicht_Data2.csv under data/irt-sample/ or pass path as arg.",
            file=sys.stderr,
        )
        return 1
    report = profile(path)
    write_reports(report, OUT_DIR)
    print(
        f"persons={report['n_rows']} items={report['n_item_columns']} "
        f"id={report['id_column']!r} reason={report['id_column_reason']}"
    )
    print(f"wrote {OUT_DIR / 'profile_report.json'}")
    print(f"wrote {OUT_DIR / 'profile_report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
