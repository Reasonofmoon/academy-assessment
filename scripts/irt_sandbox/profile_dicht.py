"""
Profile Dicht_Data2.csv (or any wide dichotomous matrix).
Does NOT touch product banks.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "data" / "irt-sample" / "Dicht_Data2.csv"
OUT_DIR = ROOT / "data" / "irt-sample" / "out"


def detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
    except csv.Error:
        return ","


def load_table(path: Path) -> tuple[list[str], list[list[str]], str]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    delim = detect_delimiter(text[:8000])
    rows = list(csv.reader(text.splitlines(), delimiter=delim))
    if not rows:
        raise ValueError("empty csv")
    header = [h.strip() for h in rows[0]]
    body = [[c.strip() for c in r] for r in rows[1:] if any(c.strip() for c in r)]
    # pad short rows
    width = len(header)
    body = [r + [""] * (width - len(r)) if len(r) < width else r[:width] for r in body]
    return header, body, delim


def is_01(vals: list[str]) -> bool:
    s = {v for v in vals if v != ""}
    if not s:
        return False
    allowed = {"0", "1", "0.0", "1.0", "true", "false", "True", "False"}
    return s <= allowed


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

    col_profiles = []
    item_cols: list[str] = []
    id_col: str | None = None

    for j, name in enumerate(header):
        vals = [r[j] for r in body]
        empty = sum(1 for v in vals if v == "")
        non_empty = [v for v in vals if v != ""]
        uniq = len(set(non_empty))
        top = Counter(non_empty).most_common(6)
        nums = [to_float_or_none(v) for v in non_empty]
        num_ok = [x for x in nums if x is not None]
        non_num = sum(1 for x in nums if x is None)

        kind = "unknown"
        lower = name.lower()
        if j == 0 and ( "id" in lower or "student" in lower or "person" in lower or uniq == n_rows):
            kind = "id_candidate"
            id_col = name
        if is_01(vals):
            kind = "dichotomous_item"
            item_cols.append(name)
        elif non_num == 0 and num_ok:
            kind = "numeric"
        elif non_num > 0:
            kind = "categorical_or_text"

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
                # p+
                ones = sum(1 for x in num_ok if x >= 0.5)
                stats["p_plus"] = round(ones / len(num_ok), 4)
        col_profiles.append(stats)

    # re-detect id if first col not chosen
    if id_col is None:
        for c in col_profiles:
            if c["kind"] != "dichotomous_item" and c["unique_non_empty"] == n_rows:
                id_col = c["name"]
                c["kind"] = "id_candidate"
                break
        if id_col is None and header:
            id_col = header[0]
            col_profiles[0]["kind"] = "id_candidate"
            if id_col in item_cols:
                item_cols = [c for c in item_cols if c != id_col]

    # matrix completeness among item cols
    item_idx = [header.index(c) for c in item_cols]
    missing_cells = 0
    total_cells = n_rows * len(item_idx)
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

    report = {
        "source_file": str(path),
        "file_bytes": path.stat().st_size,
        "delimiter": delim,
        "n_rows": n_rows,
        "n_cols": n_cols,
        "id_column": id_col,
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
        f"- id column: `{report['id_column']}`",
        f"- dichotomous item cols: **{report['n_item_columns']}**",
        f"- missing item cells: {report['missing_item_cells']} ({report['missing_item_rate']})",
        f"- total score range: {report['score_sum']}",
        "",
        "## Item columns (p+)",
        "",
        "| item | empty_rate | p+ |",
        "|------|----------:|---:|",
    ]
    for c in report["columns"]:
        if c["kind"] != "dichotomous_item":
            continue
        lines.append(
            f"| {c['name']} | {c['empty_rate']} | {c.get('p_plus', '')} |"
        )
    lines.extend(
        [
            "",
            "## Applicability (quick)",
            "",
            "- Long-format conversion: **yes** if item cols are 0/1.",
            "- Product bank merge: **no** (no stems/options).",
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
    print(f"persons={report['n_rows']} items={report['n_item_columns']} id={report['id_column']}")
    print(f"wrote {OUT_DIR / 'profile_report.json'}")
    print(f"wrote {OUT_DIR / 'profile_report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
