"""
Run full IRT sandbox pipeline on Dicht_Data2.csv.

  python scripts/irt_sandbox/run_sandbox.py
  python scripts/irt_sandbox/run_sandbox.py --demo   # synthetic matrix if CSV missing

Never writes to product banks.
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "data" / "irt-sample"
CSV_PATH = SAMPLE / "Dicht_Data2.csv"
OUT = SAMPLE / "out"
SCRIPTS = Path(__file__).resolve().parent


def write_demo_csv(path: Path) -> None:
    """Small synthetic dichotomous matrix for pipeline smoke test only."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # 40 persons x 10 items, loosely 2PL-ish by score bands
    header = ["StudentID"] + [f"Q{i}" for i in range(1, 11)]
    rows = [header]
    import random

    random.seed(42)
    for p in range(1, 41):
        theta = random.gauss(0, 1)
        row = [f"S{p:03d}"]
        for j in range(10):
            b = -1.5 + j * 0.3
            a = 1.0
            # P via 1.7 logistic
            import math

            x = 1.7 * a * (theta - b)
            prob = 1 / (1 + math.exp(-x)) if x < 20 else 1.0
            row.append("1" if random.random() < prob else "0")
        rows.append(row)
    with path.open("w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"DEMO: wrote synthetic {path} (not real Dicht_Data2)")


def run(cmd: list[str]) -> None:
    print(">", " ".join(cmd))
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main(argv: list[str]) -> int:
    demo = "--demo" in argv
    keep_empty_id = "--keep-empty-id" in argv
    csv_path = CSV_PATH

    if not csv_path.exists():
        if demo:
            demo_path = SAMPLE / "Dicht_Data2_DEMO.csv"
            write_demo_csv(demo_path)
            csv_path = demo_path
        else:
            print(f"ERROR: missing {CSV_PATH}", file=sys.stderr)
            print(
                "Place the real Kaggle file at data/irt-sample/Dicht_Data2.csv\n"
                "Or run with --demo to smoke-test the pipeline on synthetic data.",
                file=sys.stderr,
            )
            # still write a stub profile note
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / "MISSING_INPUT.md").write_text(
                f"# Missing input\n\nExpected: `{CSV_PATH}`\n\n"
                "Download from Kaggle and place here, then re-run:\n"
                "`python scripts/irt_sandbox/run_sandbox.py`\n",
                encoding="utf-8",
            )
            return 1

    py = sys.executable
    run([py, str(SCRIPTS / "profile_dicht.py"), str(csv_path)])
    convert_cmd = [py, str(SCRIPTS / "convert_to_cat_responses.py"), str(csv_path)]
    if keep_empty_id:
        convert_cmd.append("--keep-empty-id")
    run(convert_cmd)
    run([py, str(SCRIPTS / "estimate_2pl.py")])
    run([py, str(SCRIPTS / "write_summary.py")])

    convert_meta = {}
    cm_path = OUT / "convert_meta.json"
    if cm_path.exists():
        convert_meta = json.loads(cm_path.read_text(encoding="utf-8"))

    summary = {
        "csv": str(csv_path),
        "demo": demo or "DEMO" in csv_path.name,
        "drop_empty_id": not keep_empty_id,
        "dropped_empty_id_rows": convert_meta.get("dropped_empty_id_rows"),
        "n_persons": convert_meta.get("n_persons"),
        "n_items": convert_meta.get("n_items"),
        "out_dir": str(OUT),
        "product_bank_merge": False,
        "outputs": [
            "profile_report.json",
            "profile_report.md",
            "cat_responses_long.jsonl",
            "response_matrix.json",
            "item_params_2pl.json",
            "person_theta.json",
            "estimate_2pl_report.md",
            "SANDBOX_RESULTS.md",
        ],
    }
    (OUT / "pipeline_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    # refresh summary once more with pipeline_summary present
    run([py, str(SCRIPTS / "write_summary.py")])
    print("\n=== DONE (sandbox only; product bank untouched) ===")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
