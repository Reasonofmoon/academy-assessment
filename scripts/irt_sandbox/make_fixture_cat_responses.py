"""
Write a small synthetic cat_responses JSONL (sparse CAT-like) for pipeline smoke.

Usage:
  python scripts/irt_sandbox/make_fixture_cat_responses.py

Output (committed fixture, not live PII):
  data/irt-sample/fixtures/cat_responses_fixture.jsonl
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "irt-sample" / "fixtures" / "cat_responses_fixture.jsonl"

# Fixed seed so smoke is reproducible
RNG = random.Random(42)

# Bank-ish ids (not real production stems)
ITEMS = [
    ("L1-V-001", "vocabulary", "D1_Form"),
    ("L1-V-002", "vocabulary", "D2_Meaning"),
    ("L2-V-010", "vocabulary", "D2_Meaning"),
    ("L2-V-011", "vocabulary", "D3_Use"),
    ("L2-R-001", "reading", "main_idea"),
    ("L2-R-002", "reading", "detail"),
    ("L3-V-020", "vocabulary", "D2_Meaning"),
    ("L3-R-003", "reading", "inference"),
    ("L3-R-004", "reading", "vocab_in_context"),
    ("L4-V-030", "vocabulary", "D3_Use"),
    ("L4-R-005", "reading", "main_idea"),
    ("L5-R-006", "reading", "inference"),
]

# True difficulty order (easier first) for generating p(correct)
TRUE_B = {
    "L1-V-001": -1.5,
    "L1-V-002": -1.2,
    "L2-V-010": -0.6,
    "L2-V-011": -0.4,
    "L2-R-001": -0.3,
    "L2-R-002": 0.0,
    "L3-V-020": 0.3,
    "L3-R-003": 0.5,
    "L3-R-004": 0.7,
    "L4-V-030": 1.0,
    "L4-R-005": 1.2,
    "L5-R-006": 1.8,
}


def p_correct(theta: float, b: float, a: float = 1.0) -> float:
    import math

    x = 1.7 * a * (theta - b)
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    n_sessions = 24
    steps_per = 8  # sparse: not all 12 items
    rows: list[dict] = []

    for s in range(n_sessions):
        sid = f"fixture-session-{s:03d}"
        # ability spread
        theta = RNG.gauss(0.0, 1.0)
        # adaptive-ish: sample items near theta + noise
        ranked = sorted(
            ITEMS,
            key=lambda it: abs(TRUE_B[it[0]] - theta) + RNG.random() * 0.3,
        )
        chosen = ranked[:steps_per]
        for step, (iid, domain, dim) in enumerate(chosen, start=1):
            b = TRUE_B[iid]
            ok = RNG.random() < p_correct(theta, b)
            rows.append(
                {
                    "session_id": sid,
                    "step": step,
                    "item_id": iid,
                    "domain": domain,
                    "dimension": dim,
                    "passage_id": f"pass-{iid}" if domain == "reading" else None,
                    "correct": ok,
                    "selected_option_id": f"{iid}-{'A' if ok else 'C'}",
                    "response_time_ms": RNG.randint(1200, 25000),
                    "created_at": "2026-07-13T10:00:00Z",
                }
            )

    with OUT.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"wrote {OUT} rows={len(rows)} sessions={n_sessions}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
