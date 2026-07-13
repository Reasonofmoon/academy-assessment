"""
Adapter: real cat_responses export → sparse response_matrix.json
for the same estimate_2pl.py path used by the Dicht sandbox.

Input formats:
  - JSONL: one cat_responses-like object per line
  - CSV: header includes session_id,item_id,correct (and optional fields)

Usage:
  python scripts/irt_sandbox/from_cat_responses.py \\
    --in data/irt-sample/live/cat_responses.jsonl \\
    --out-dir data/irt-sample/out-live

  python scripts/irt_sandbox/estimate_2pl.py data/irt-sample/out-live/response_matrix.json

Never writes to product banks / curated service JSON.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def parse_correct(v) -> bool | None:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in {"1", "1.0", "true", "t", "yes"}:
        return True
    if s in {"0", "0.0", "false", "f", "no"}:
        return False
    try:
        return float(s) >= 0.5
    except ValueError:
        return None


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise SystemExit(f"JSONL parse error line {line_no}: {e}") from e
    return rows


def load_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_rows(path: Path) -> list[dict]:
    if path.suffix.lower() == ".jsonl":
        return load_jsonl(path)
    if path.suffix.lower() == ".csv":
        return load_csv(path)
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "rows" in data:
            return data["rows"]
        raise SystemExit("JSON must be a list or {rows: [...]}")
    raise SystemExit(f"Unsupported input type: {path.suffix}")


def filter_rows(
    rows: list[dict],
    *,
    domains: set[str] | None,
    min_rt_ms: int | None,
    max_rt_ms: int | None,
) -> tuple[list[dict], dict]:
    kept = []
    stats = defaultdict(int)
    for r in rows:
        stats["input"] += 1
        sid = str(r.get("session_id") or "").strip()
        iid = str(r.get("item_id") or "").strip()
        if not sid or not iid:
            stats["drop_missing_keys"] += 1
            continue
        if domains is not None:
            dom = str(r.get("domain") or "").strip()
            if dom and dom not in domains:
                stats["drop_domain"] += 1
                continue
        rt = r.get("response_time_ms")
        if rt is not None and rt != "":
            try:
                rti = int(rt)
                if min_rt_ms is not None and rti < min_rt_ms:
                    stats["drop_rt_fast"] += 1
                    continue
                if max_rt_ms is not None and rti > max_rt_ms:
                    stats["drop_rt_slow"] += 1
                    continue
            except (TypeError, ValueError):
                stats["drop_rt_bad"] += 1
                continue
        corr = parse_correct(r.get("correct"))
        if corr is None:
            stats["drop_correct"] += 1
            continue
        kept.append(
            {
                "session_id": sid,
                "item_id": iid,
                "step": r.get("step"),
                "correct": corr,
                "domain": r.get("domain"),
                "dimension": r.get("dimension"),
                "passage_id": r.get("passage_id"),
                "response_time_ms": r.get("response_time_ms"),
            }
        )
        stats["kept"] += 1
    return kept, dict(stats)


def to_matrix(rows: list[dict]) -> dict:
    """
    Build sparse person×item matrix.
    Person key = session_id.
    Duplicate (session, item): keep highest step if present, else last.
    """
    # session -> item -> (step, correct)
    best: dict[str, dict[str, tuple[int, int]]] = defaultdict(dict)
    for r in rows:
        sid = r["session_id"]
        iid = r["item_id"]
        y = 1 if r["correct"] else 0
        try:
            step = int(r["step"]) if r.get("step") is not None else -1
        except (TypeError, ValueError):
            step = -1
        prev = best[sid].get(iid)
        if prev is None or step >= prev[0]:
            best[sid][iid] = (step, y)

    person_ids = sorted(best.keys())
    item_set: set[str] = set()
    for items in best.values():
        item_set.update(items.keys())
    item_ids = sorted(item_set)

    matrix: list[list[int | None]] = []
    for sid in person_ids:
        row: list[int | None] = []
        for iid in item_ids:
            cell = best[sid].get(iid)
            row.append(None if cell is None else cell[1])
        matrix.append(row)

    # density
    n_obs = sum(1 for row in matrix for v in row if v is not None)
    n_cells = len(person_ids) * len(item_ids) if person_ids and item_ids else 0

    return {
        "person_ids": person_ids,
        "item_ids": item_ids,
        "matrix": matrix,
        "id_column": "session_id",
        "source": "cat_responses",
        "sandbox": False,
        "product_bank_merge": False,
        "n_observations": n_obs,
        "density": round(n_obs / n_cells, 6) if n_cells else 0,
    }


def write_long_optional(rows: list[dict], path: Path) -> None:
    """Optional long JSONL in sandbox field shape for inspection."""
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(
                json.dumps(
                    {
                        "session_id": r["session_id"],
                        "step": r.get("step"),
                        "item_id": r["item_id"],
                        "domain": r.get("domain") or "vocabulary",
                        "dimension": r.get("dimension"),
                        "passage_id": r.get("passage_id"),
                        "correct": r["correct"],
                        "response_time_ms": r.get("response_time_ms"),
                        "sandbox": False,
                        "source_dataset": "cat_responses",
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="cat_responses export → sparse matrix")
    p.add_argument("--in", dest="inp", required=True, help="JSONL/CSV/JSON export path")
    p.add_argument(
        "--out-dir",
        default=str(ROOT / "data" / "irt-sample" / "out-live"),
        help="output directory (default: data/irt-sample/out-live)",
    )
    p.add_argument(
        "--domains",
        default="",
        help="comma list filter, e.g. vocabulary,reading (empty=all)",
    )
    p.add_argument("--min-rt-ms", type=int, default=500, help="drop faster than this (0=off)")
    p.add_argument("--max-rt-ms", type=int, default=180000, help="drop slower than this (0=off)")
    p.add_argument("--write-long", action="store_true", help="also write cat_responses_long.jsonl")
    args = p.parse_args(argv)

    inp = Path(args.inp)
    if not inp.exists():
        print(f"ERROR: input not found: {inp}", file=sys.stderr)
        print(
            "Export from Supabase cat_responses first, e.g.\n"
            "  data/irt-sample/live/cat_responses.jsonl",
            file=sys.stderr,
        )
        return 1

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = load_rows(inp)
    domains = {d.strip() for d in args.domains.split(",") if d.strip()} or None
    min_rt = args.min_rt_ms if args.min_rt_ms > 0 else None
    max_rt = args.max_rt_ms if args.max_rt_ms > 0 else None
    kept, filter_stats = filter_rows(
        raw, domains=domains, min_rt_ms=min_rt, max_rt_ms=max_rt
    )
    matrix_doc = to_matrix(kept)

    meta = {
        "source_file": str(inp),
        "out_dir": str(out_dir),
        "filter_stats": filter_stats,
        "n_persons": len(matrix_doc["person_ids"]),
        "n_items": len(matrix_doc["item_ids"]),
        "n_observations": matrix_doc["n_observations"],
        "density": matrix_doc["density"],
        "id_column": "session_id",
        "drop_empty_id": True,
        "product_bank_merge": False,
        "next_step": (
            f"python scripts/irt_sandbox/estimate_2pl.py {out_dir / 'response_matrix.json'}"
        ),
    }

    (out_dir / "convert_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out_dir / "response_matrix.json").write_text(
        json.dumps(matrix_doc, ensure_ascii=False), encoding="utf-8"
    )
    if args.write_long:
        write_long_optional(kept, out_dir / "cat_responses_long.jsonl")

    print(
        f"persons={meta['n_persons']} items={meta['n_items']} "
        f"obs={meta['n_observations']} density={meta['density']} "
        f"filters={filter_stats}"
    )
    print(f"wrote {out_dir / 'response_matrix.json'}")
    print(f"wrote {out_dir / 'convert_meta.json'}")
    print(meta["next_step"])
    print("NOTE: product bank not modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
