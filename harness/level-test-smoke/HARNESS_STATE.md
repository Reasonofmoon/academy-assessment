# HARNESS_STATE — level-test-smoke

- **Domain:** Agent-solved level-test smoke (Gemini solves without gold, then score)
- **Target:** portable
- **Vector width:** 6 (lane-solve-L1 … L6)
- **Execution:** logical sequential
- **Last validated:** 2026-08-05 — `validate_harness.py` **PASS**
- **Last run (full bank):** 2026-08-05 — overall **pass** · **130/132 (98.5%)**

## Modes

| Mode | Command | Scope |
|---|---|---|
| stratified | `python …/run_level_test_smoke.py` | 1/domain/level (~18) |
| **full bank** | `python …/run_level_test_smoke.py --all` | every approved MCQ |

## Full-bank snapshot

| Level | Score | Verdict |
|---|---|---|
| L1 | 20/20 (100%) | pass |
| L2 | 35/37 (95%) | pass |
| L3 | 20/20 (100%) | pass |
| L4 | 18/18 (100%) | pass |
| L5 | 19/19 (100%) | pass |
| L6 | 18/18 (100%) | pass |
| **Overall** | **130/132 (98.5%)** | **pass** |

### Mismatches (2)

| item_id | domain | chosen | gold | note |
|---|---|---|---|---|
| `grammar-2` | grammar | 0 | 2 | modal must vs gold key |
| `reading-2-2` | reading | 2 | 0 | HIGH_CONF_WRONG — double charge / $44 interpretation |

Report: `workspace/reports/SMOKE_REPORT.md`

## Open exceptions

| Item | Status |
|---|---|
| grammar-2, reading-2-2 | optional human key review |

## Change log

| Date | Change |
|---|---|
| 2026-08-05 | initial harness + stratified 18/18 |
| 2026-08-05 | `--all` full-bank smoke 130/132 |
