# HARNESS_STATE — level-item-qc

- **Domain:** Per-GLEAS-level item count and quality QC for generated-bank
- **Target:** portable
- **Manifest:** HARNESS_MANIFEST.json (harness_version 1.0)
- **Vector width:** 6 (L1–L6 data slices)
- **Execution mode:** logical (sequential)
- **Location:** `harness/level-item-qc/` (alongside `level-test-item-replace`, does not replace it)
- **Last validated:** 2026-08-05 — `validate_harness.py` **PASS**
- **Last run:** 2026-08-05 — overall **fail** (empty levels L1, L4–L6)

## Broadcast packet

- **goal:** Audit active items per GLEAS level for count + quality; one matrix report
- **policy:** min_per_domain=3, min_total=9, quarantine excluded (`references/level-qc-policy.md`)
- **acceptance:** levels 1–6 covered; LEVEL_QC_REPORT.md written

## Lanes

| Lane | Slice | Role |
|---|---|---|
| lane-L1 … lane-L6 | items[level==N] active | count targets + quality codes |

## Masks

schema_valid · constraint_satisfied · provenance_present

## Reduction

Stack levels → overall = fail if any level fail; warn if any warn; else pass.

## Last run snapshot (default policy)

| Level | Verdict | Active | V/G/R | Notes |
|---|---|---:|---|---|
| L1 | **fail** | 0 | 0/0/0 | LEVEL_EMPTY |
| L2 | **pass** | 28 | 10/9/9 | quality clean |
| L3 | **pass** | 11 | 3/4/4 | quality clean |
| L4 | **fail** | 0 | 0/0/0 | LEVEL_EMPTY |
| L5 | **fail** | 0 | 0/0/0 | LEVEL_EMPTY |
| L6 | **fail** | 0 | 0/0/0 | LEVEL_EMPTY |

**Overall: fail** — coverage gap outside L2–L3 (not stem quality on existing items).

Report: `workspace/reports/LEVEL_QC_REPORT.md`

## Open exceptions

| Item | Trigger | Status |
|---|---|---|
| L1, L4, L5, L6 | LEVEL_EMPTY under default policy | open — generate fills or policy allow_empty |
| L2–L3 quality | — | clear (0 error codes on active set) |

## Change log

| Date | Change | Classification |
|---|---|---|
| 2026-08-05 | initial harness + first QC run | new |
