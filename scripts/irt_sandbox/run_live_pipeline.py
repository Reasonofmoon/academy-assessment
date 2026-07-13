"""
cat_responses export (or fixture) → sparse matrix → 2PL.

Usage:
  # fixture smoke (no Supabase)
  python scripts/irt_sandbox/run_live_pipeline.py --fixture

  # real export
  python scripts/irt_sandbox/run_live_pipeline.py \\
    --in data/irt-sample/live/cat_responses.jsonl

Never writes product banks.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent
FIXTURE = ROOT / "data" / "irt-sample" / "fixtures" / "cat_responses_fixture.jsonl"
DEFAULT_LIVE = ROOT / "data" / "irt-sample" / "live" / "cat_responses.jsonl"
DEFAULT_OUT = ROOT / "data" / "irt-sample" / "out-live"
FIXTURE_OUT = ROOT / "data" / "irt-sample" / "out-fixture"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="cat_responses → 2PL pipeline")
    p.add_argument("--in", dest="inp", default="", help="JSONL/CSV export path")
    p.add_argument("--out-dir", default="", help="output directory")
    p.add_argument(
        "--fixture",
        action="store_true",
        help="regenerate fixture JSONL and run against it",
    )
    p.add_argument("--domains", default="", help="optional domain filter")
    p.add_argument("--write-long", action="store_true")
    args = p.parse_args(argv)

    py = sys.executable

    if args.fixture:
        run([py, str(SCRIPTS / "make_fixture_cat_responses.py")])
        inp = FIXTURE
        out_dir = Path(args.out_dir) if args.out_dir else FIXTURE_OUT
    else:
        inp = Path(args.inp) if args.inp else DEFAULT_LIVE
        out_dir = Path(args.out_dir) if args.out_dir else DEFAULT_OUT
        if not inp.exists():
            print(f"ERROR: export not found: {inp}", file=sys.stderr)
            print(
                "Place Supabase export at data/irt-sample/live/cat_responses.jsonl\n"
                "or run with --fixture for smoke.",
                file=sys.stderr,
            )
            return 1

    from_cmd = [
        py,
        str(SCRIPTS / "from_cat_responses.py"),
        "--in",
        str(inp),
        "--out-dir",
        str(out_dir),
    ]
    if args.domains:
        from_cmd.extend(["--domains", args.domains])
    if args.write_long or args.fixture:
        from_cmd.append("--write-long")
    run(from_cmd)

    matrix = out_dir / "response_matrix.json"
    run([py, str(SCRIPTS / "estimate_2pl.py"), str(matrix)])

    print(f"DONE out_dir={out_dir}")
    print("NOTE: product bank not modified. Human APPROVE_APPLY required for promote.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
