# Level item QC report

- **Generated:** 2026-08-05T09:53:19.861860+00:00
- **Harness:** level-item-qc
- **Overall:** `fail`
- **Policy:** min_per_domain=3 · min_total=9 · allow_empty=False
- **Execution:** logical (L1–L6 sequential)

## Level matrix

| Level | Verdict | Active | Appr | Pend | Vocab | Gram | Read | Err | Warn |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| L1 | **fail** | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| L2 | **pass** | 28 | 28 | 0 | 10 | 9 | 9 | 0 | 0 |
| L3 | **pass** | 11 | 11 | 0 | 3 | 4 | 4 | 0 | 0 |
| L4 | **fail** | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| L5 | **fail** | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| L6 | **fail** | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |

## Masks

| Lane | schema | constraint | provenance |
|---|---|---|---|
| lane-L1 | True | True | True |
| lane-L2 | True | True | True |
| lane-L3 | True | True | True |
| lane-L4 | True | True | True |
| lane-L5 | True | True | True |
| lane-L6 | True | True | True |

## Defect summary

- errors: **4**
- warnings: **0**
- info: **0**

## ERRORs (4)

- L1 · `LEVEL_EMPTY` · `level:1` · no active items at this level
- L4 · `LEVEL_EMPTY` · `level:4` · no active items at this level
- L5 · `LEVEL_EMPTY` · `level:5` · no active items at this level
- L6 · `LEVEL_EMPTY` · `level:6` · no active items at this level

## Remediation hints

- Underfilled levels → generate with `level` override + seed script / UI
- Quality errors → `level-test-item-replace` fitness + Stage V2 replace
- Empty L1/L4–L6 expected if only L2–L3 banked; set policy or fill

## Acceptance

- levels 1–6 covered: PASS
- report written: PASS

