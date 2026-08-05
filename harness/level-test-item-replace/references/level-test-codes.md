# Level-test fitness defect codes

Catalog used by `level-test-item-replace` lanes. Codes are stable IDs for reduce + replace_plan.

## Severity

| severity | meaning |
|---|---|
| `error` | Unsuitable for level test → default `replace` or `quarantine` |
| `warning` | Usable after non-generative fix → `repair` |
| `pass` | No issue from this lane |

## Code catalog

| code | severity | lane owner | meaning | default disposition |
|---|---|---|---|---|
| `SEED_DEMO` | error | level-fit | `irtSource=test` or seed demo item | quarantine |
| `BANK_QUARANTINE` | error | status | Bank `status=quarantine` (already removed from active pool) | quarantine |
| `GENERIC_SYNONYM` | error | level-fit | English synonym quiz without level construct | replace |
| `INCOMPLETE_STEM` | error | construct | Instruction-only stem (missing gloss / blank / passage task) | replace |
| `B_FAR_THETA` | error | psychometric | \|b − targetTheta\| > 1.0 | replace |
| `A_OUT_OF_RANGE` | warning | psychometric | a outside [0.5, 2.8] soft band | repair or keep |
| `C_UNUSUAL` | warning | psychometric | MCQ c outside [0.15, 0.35] | repair |
| `DISTRACTOR_WEAK` | error | options | duplicate options, empty, non-parallel, answer not unique | replace |
| `ANSWER_INVALID` | error | options | answer index out of range | replace |
| `CONSTRUCT_MISS` | error | construct | domain task mismatch (e.g. reading without passage) | replace |
| `LEVEL_LEXIS` | warning | level-fit | lexis/task form likely off GLEAS level (heuristic) | repair / replace if stacked |
| `SLOT_DRIFT` | warning | construct | reading questionType not in planned set | repair |
| `FORMAT_NEWLINE` | warning | construct | missing display newlines between KO stem and EN example | repair |
| `PASS` | pass | any | no defect | keep |

## Disposition merge rules (reducer)

Applied after all lanes vote:

1. Any `SEED_DEMO` → **quarantine**
2. Else any `error` code → **replace**
3. Else any `warning` only → **repair**
4. Else → **keep**
5. If one lane votes `keep` and another `replace` with no shared error code resolution → **lane_conflict** → scalar tail

## Replacement slot preservation

For `replace`, keep:

- `domain`, `level`, `targetTheta`
- `dimension` (vocab) or `questionType` (reading)
- reading: same `passage` / preset id when present

Do **not** rewrite reading passage text.
