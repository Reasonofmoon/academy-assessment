# Level item QC report

- **Generated:** 2026-08-05T10:32:11.360785+00:00
- **Harness:** level-item-qc
- **Overall:** `pass`
- **Policy:** min_per_domain=3 · min_total=9 · allow_empty=False
- **Execution:** logical (L1–L6 sequential)

## Level matrix

| Level | Verdict | Active | Appr | Pend | Vocab | Gram | Read | Err | Warn |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| L1 | **pass** | 18 | 18 | 0 | 6 | 6 | 6 | 0 | 0 |
| L2 | **pass** | 37 | 37 | 0 | 13 | 12 | 12 | 0 | 0 |
| L3 | **pass** | 20 | 20 | 0 | 6 | 7 | 7 | 0 | 0 |
| L4 | **pass** | 18 | 18 | 0 | 6 | 6 | 6 | 0 | 0 |
| L5 | **pass** | 19 | 19 | 0 | 7 | 6 | 6 | 0 | 0 |
| L6 | **pass** | 18 | 18 | 0 | 6 | 6 | 6 | 0 | 0 |

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

- errors: **0**
- warnings: **0**
- info: **0**

## Remediation hints

- Underfilled levels → generate with `level` override + seed script / UI
- Quality errors → `level-test-item-replace` fitness + Stage V2 replace
- Empty L1/L4–L6 expected if only L2–L3 banked; set policy or fill

## Acceptance

- levels 1–6 covered: PASS
- report written: PASS

