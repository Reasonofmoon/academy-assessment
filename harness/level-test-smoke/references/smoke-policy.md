# Level-test smoke policy

## Sample

- Per level L1–L6: up to **1 approved item per domain** (vocabulary, grammar, reading).
- Prefer items with `status=approved`, skip `quarantine`.
- Deterministic pick: sort by id, take first per domain.

## Solver

- Model answers **without** gold answer / answerIndex.
- Output JSON: `{ "chosen_index": 0-3, "reason": "..." }`
- Temperature low (0.2).

## Scoring

- Correct if `str(chosen_index) == str(gold_answer)`.
- Level accuracy = correct / attempted.
- Level verdict:
  - **pass** if accuracy ≥ 2/3
  - **warn** if 1/3 ≤ accuracy < 2/3
  - **fail** if accuracy < 1/3 or zero attempts when pool non-empty

## Item flags

| flag | meaning |
|---|---|
| `SOLVER_ERROR` | API/parse failure |
| `KEY_MISMATCH` | solver confident wrong vs gold (possible bad key/item) |
| `AMBIGUOUS` | solver notes multi-key / unclear stem |
| `OK` | correct |

## Overall

- fail if any level fail or overall accuracy < 0.5
- warn if any level warn and overall ≥ 0.5
- pass otherwise
