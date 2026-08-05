# HARNESS_STATE — level-item-qc

- **Domain:** Per-GLEAS-level item count and quality QC for generated-bank
- **Target:** portable
- **Manifest:** HARNESS_MANIFEST.json (harness_version 1.0)
- **Vector width:** 6 (L1–L6 data slices)
- **Execution mode:** logical (sequential)
- **Location:** `harness/level-item-qc/`
- **Last validated:** 2026-08-05 — `validate_harness.py` **PASS**
- **Last run:** 2026-08-05 — overall **pass** (after L1/L4–L6 fill)

## Broadcast packet

- **goal:** Audit active items per GLEAS level for count + quality; one matrix report
- **policy:** min_per_domain=3, min_total=9, quarantine excluded
- **acceptance:** levels 1–6 covered; LEVEL_QC_REPORT.md written

## Lanes

| Lane | Slice | Role |
|---|---|---|
| lane-L1 … lane-L6 | items[level==N] active | count targets + quality codes |

## Last run snapshot (post fill)

| Level | Verdict | Active | V/G/R | Err |
|---|---|---:|---|---:|
| L1 | **pass** | 9 | 3/3/3 | 0 |
| L2 | **pass** | 28 | 10/9/9 | 0 |
| L3 | **pass** | 11 | 3/4/4 | 0 |
| L4 | **pass** | 10 | 4/3/3 | 0 |
| L5 | **pass** | 10 | 4/3/3 | 0 |
| L6 | **pass** | 10 | 4/3/3 | 0 |

**Overall: pass**

Bank: 81 items total (quarantine still present in file; active matrix above).

Fill tooling: `scripts/fill-levels-for-qc.mjs`

Report: `workspace/reports/LEVEL_QC_REPORT.md`

## Open exceptions

| Item | Status |
|---|---|
| _(none)_ | — |

## Change log

| Date | Change | Classification |
|---|---|---|
| 2026-08-05 | initial harness + first QC run (fail empty levels) | new |
| 2026-08-05 | fill L1/L4–L6 + vocab top-up; overall pass | remediation |
