"""
Build SANDBOX_RESULTS.md from out/* (profile + convert + 2PL).
Does not touch product banks.
"""
from __future__ import annotations

import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "irt-sample" / "out"
README = ROOT / "data" / "irt-sample" / "README.md"


def load_json(name: str) -> dict | None:
    p = OUT / name
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    profile = load_json("profile_report.json") or {}
    convert = load_json("convert_meta.json") or {}
    items_doc = load_json("item_params_2pl.json") or {}
    persons_doc = load_json("person_theta.json") or {}
    pipeline = load_json("pipeline_summary.json") or {}

    items = items_doc.get("items") or []
    persons = persons_doc.get("persons") or []
    a_vals = [i["a"] for i in items]
    b_vals = [i["b"] for i in items]
    p_vals = [i["p_plus"] for i in items if i.get("p_plus") is not None]
    th_vals = [p["theta"] for p in persons if p.get("theta") is not None]

    def rng(xs: list[float]) -> str:
        if not xs:
            return "n/a"
        return f"{min(xs):.3f} … {max(xs):.3f} (mean {statistics.mean(xs):.3f})"

    hardest = sorted(items, key=lambda x: x["b"], reverse=True)[:5]
    easiest = sorted(items, key=lambda x: x["b"])[:5]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# IRT sandbox results (NOT product bank)",
        "",
        f"_Last written: {now}_",
        "",
        "## Input",
        "",
        f"- CSV: `{profile.get('source_file') or convert.get('source_file')}`",
        f"- Bytes: {profile.get('file_bytes')}",
        f"- Demo run: {pipeline.get('demo', False)}",
        f"- Person key: `{convert.get('id_column') or profile.get('id_column')}` "
        f"({convert.get('id_column_reason') or profile.get('id_column_reason')})",
        f"- drop_empty_id: **{convert.get('drop_empty_id')}** "
        f"(dropped rows: **{convert.get('dropped_empty_id_rows', 0)}**)",
        "",
        "## Matrix",
        "",
        f"| metric | value |",
        f"|--------|------:|",
        f"| persons (raw profile) | {profile.get('n_rows')} |",
        f"| persons (after convert) | {convert.get('n_persons')} |",
        f"| items | {convert.get('n_items') or profile.get('n_item_columns')} |",
        f"| long rows | {convert.get('n_long_rows')} |",
        f"| missing item cells | {profile.get('missing_item_cells')} |",
        f"| total score range | {profile.get('score_sum')} |",
        "",
        "## 2PL estimates (sandbox joint Newton)",
        "",
        f"- model: {items_doc.get('model')} (D={items_doc.get('D')})",
        f"- algorithm: {items_doc.get('algorithm')}",
        f"- a range: {rng(a_vals)}",
        f"- b range: {rng(b_vals)}",
        f"- observed p+ range: {rng(p_vals)}",
        f"- theta range: {rng(th_vals)}",
        "",
        "### Hardest items (highest b)",
        "",
        "| item_id | a | b | p+ |",
        "|---------|--:|--:|---:|",
    ]
    for it in hardest:
        lines.append(
            f"| {it['item_id']} | {it['a']} | {it['b']} | {it.get('p_plus')} |"
        )
    lines.extend(
        [
            "",
            "### Easiest items (lowest b)",
            "",
            "| item_id | a | b | p+ |",
            "|---------|--:|--:|---:|",
        ]
    )
    for it in easiest:
        lines.append(
            f"| {it['item_id']} | {it['a']} | {it['b']} | {it.get('p_plus')} |"
        )

    lines.extend(
        [
            "",
            "## Applicability reminder",
            "",
            "- This dataset is **mixed STEM + English MCQ** dichotomous scores.",
            "- **Do not merge** into `generated-bank`, reading passages, or echobridge curated services.",
            "- Use only to validate long-format ETL and educational 2PL estimation code.",
            "- For production levels, collect responses on **our own items** via `cat_responses`.",
            "",
            "## Files",
            "",
            "| path | role |",
            "|------|------|",
            "| `out/profile_report.md` | schema profile |",
            "| `out/cat_responses_long.jsonl` | long responses |",
            "| `out/item_params_2pl.json` | item a,b |",
            "| `out/person_theta.json` | person θ |",
            "| `out/SANDBOX_RESULTS.md` | this summary |",
            "",
        ]
    )

    OUT.mkdir(parents=True, exist_ok=True)
    summary_path = OUT / "SANDBOX_RESULTS.md"
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {summary_path}")

    # Inject / refresh "Last run snapshot" section in README
    if README.exists():
        readme = README.read_text(encoding="utf-8")
        marker_start = "<!-- SANDBOX_SNAPSHOT_START -->"
        marker_end = "<!-- SANDBOX_SNAPSHOT_END -->"
        snapshot = "\n".join(
            [
                marker_start,
                "## Last run snapshot",
                "",
                f"_Auto-updated {now} from `out/*`. Full detail: [`out/SANDBOX_RESULTS.md`](out/SANDBOX_RESULTS.md)._",
                "",
                f"| field | value |",
                f"|-------|------:|",
                f"| persons (convert) | {convert.get('n_persons')} |",
                f"| dropped empty Student ID | {convert.get('dropped_empty_id_rows', 0)} |",
                f"| items | {convert.get('n_items')} |",
                f"| long rows | {convert.get('n_long_rows')} |",
                f"| person key | `{convert.get('id_column')}` |",
                f"| 2PL a | {rng(a_vals)} |",
                f"| 2PL b | {rng(b_vals)} |",
                f"| theta | {rng(th_vals)} |",
                "",
                "**Product bank merge: never.**",
                "",
                marker_end,
            ]
        )
        if marker_start in readme and marker_end in readme:
            pre = readme.split(marker_start)[0]
            post = readme.split(marker_end, 1)[1]
            readme = pre + snapshot + post
        else:
            readme = readme.rstrip() + "\n\n" + snapshot + "\n"
        README.write_text(readme, encoding="utf-8")
        print(f"updated {README}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
