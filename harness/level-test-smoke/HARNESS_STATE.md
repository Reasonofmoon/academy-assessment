# HARNESS_STATE — level-test-smoke

- **Domain:** Agent-solved level-test smoke (Gemini solves without gold, then score)
- **Target:** portable
- **Vector width:** 6 (lane-solve-L1 … L6)
- **Execution:** logical sequential
- **Last validated:** 2026-08-05 — `validate_harness.py` **PASS**
- **Last run:** 2026-08-05 — overall **pass** · **18/18 (100%)**

## Broadcast

- Sample: 1 approved MCQ per domain × L1–L6 (18 items)
- Solver never sees gold before choose
- Verdict thresholds: pass ≥2/3, warn ≥1/3, else fail

## Last run snapshot

| Level | Verdict | Score |
|---|---|---|
| L1–L6 | all **pass** | 3/3 each |
| **Overall** | **pass** | **18/18 (100%)** |
| Mismatches | 0 | — |

Report: `workspace/reports/SMOKE_REPORT.md`

## Open exceptions

| Item | Status |
|---|---|
| _(none)_ | — |

## Change log

| Date | Change |
|---|---|
| 2026-08-05 | initial harness + first smoke run 18/18 |
