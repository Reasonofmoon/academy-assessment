"""Shared helpers for IRT sandbox (no product bank I/O)."""
from __future__ import annotations

import csv
import re
from pathlib import Path


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
    width = len(header)
    body = [r + [""] * (width - len(r)) if len(r) < width else r[:width] for r in body]
    return header, body, delim


def is_01_column(vals: list[str]) -> bool:
    s = {v for v in vals if v != ""}
    if not s:
        return False
    allowed = {"0", "1", "0.0", "1.0", "true", "false", "True", "False"}
    return s <= allowed


def _norm_name(name: str) -> str:
    return re.sub(r"[\s_\-]+", " ", (name or "").strip().lower())


def pick_id_column(header: list[str], body: list[list[str]]) -> tuple[str, int, str]:
    """
    Choose person key column.
    Priority:
      1) name contains student + id (e.g. "Student ID")
      2) name is student / person / examinee / sid (not empty)
      3) name is exactly "id" and not 0/1-only
      4) non-empty name, not 0/1, unique ≈ n_rows
      5) fallback: first non-0/1 column; else header[0]
    Returns (column_name, index, reason).
    """
    n = len(body)
    if not header:
        raise ValueError("no header")

    def col_vals(j: int) -> list[str]:
        return [r[j] for r in body]

    # 1) Student ID style
    for j, name in enumerate(header):
        nn = _norm_name(name)
        if not nn:
            continue
        if "student" in nn and "id" in nn:
            return name, j, "name_student_id"
        if nn in {"student id", "studentid", "student_id"}:
            return name, j, "name_student_id"

    # 2) person / examinee
    for j, name in enumerate(header):
        nn = _norm_name(name)
        if not nn:
            continue
        if nn in {"person id", "personid", "examinee id", "examinee", "sid", "person"}:
            if not is_01_column(col_vals(j)):
                return name, j, "name_person_key"
        if "student" in nn and not is_01_column(col_vals(j)):
            return name, j, "name_student"

    # 3) bare "id" (not empty header)
    for j, name in enumerate(header):
        nn = _norm_name(name)
        if nn == "id" and not is_01_column(col_vals(j)):
            return name, j, "name_id"

    # 4) unique non-empty name, not dichotomous
    for j, name in enumerate(header):
        if not (name or "").strip():
            continue
        vals = col_vals(j)
        if is_01_column(vals):
            continue
        non_empty = [v for v in vals if v != ""]
        if len(set(non_empty)) >= max(1, int(0.95 * n)):
            return name, j, "unique_non_item"

    # 5) first non-01 column
    for j, name in enumerate(header):
        if not is_01_column(col_vals(j)):
            return name, j, "first_non_dichotomous"

    return header[0], 0, "fallback_first"


def pick_item_columns(
    header: list[str], body: list[list[str]], id_index: int
) -> list[str]:
    items: list[str] = []
    for j, name in enumerate(header):
        if j == id_index:
            continue
        # skip empty-named pure index columns even if not 0/1
        vals = [r[j] for r in body]
        if not (name or "").strip():
            # empty header: treat as row index, not item
            continue
        if is_01_column(vals):
            items.append(name)
    return items
