# HARNESS_STATE — level-test-item-replace

- **Domain:** Level-test fitness audit and replacement planning for academy-assessment item bank
- **Target:** portable
- **Manifest:** HARNESS_MANIFEST.json (harness_version 1.0)
- **Vector width:** 4
- **Execution mode:** logical (sequential Python runner)
- **Location:** `harness/level-test-item-replace/` (does not replace root `academy-data-audit`)
- **Last validated:** 2026-08-05 — `validate_harness.py` **PASS**
- **Last run:** 2026-08-05 — Stage V2 applied; fitness items=42 · keep=38 · repair=1 · replace=0 · quarantine=3

## Broadcast packet

- **goal:** Judge every generated-bank item for GLEAS level-test fitness and emit a deterministic replace_plan with per-slot replacement specs.
- **constraints:** slot preservation; no passage rewrite; ai_prior only; no averaging conflicts; path-cited provenance; SEED_DEMO → quarantine
- **source_refs:** `../../data/generated-bank/items.json`, exemplars, passages, IRT docs, `references/level-test-codes.md`
- **acceptance_tests:** full disposition coverage; replace specs complete; exceptions isolated; FITNESS_REPORT + replace_plan exist

## Lanes

| Lane | Role | Input slice | Output artifact | Definition |
|---|---|---|---|---|
| lane-psychometric | IRT a/b/c vs θ | irt fields | workspace/lanes/psychometric.json | lanes/lane-psychometric.md |
| lane-construct | stem/domain/passage construct | stem fields | workspace/lanes/construct.json | lanes/lane-construct.md |
| lane-options | options/answer quality | options | workspace/lanes/options.json | lanes/lane-options.md |
| lane-level-fit | seed/generic/level fitness | product fitness | workspace/lanes/level-fit.json | lanes/lane-level-fit.md |

## Masks

| Mask | True when | Checked by |
|---|---|---|
| schema_valid | lane_output schema exact | run_level_test_fitness.py |
| constraint_satisfied | vote consistent with severity | reducer |
| provenance_present | evidence when not pass | reducer |
| code_from_catalog | codes ⊆ level-test-codes catalog | run_level_test_fitness.py |

## Reduction

- **operator:** collect_codes → severity_max → disposition_rule → build_replacement_spec → report
- **precedence:** hard_constraints → masks → confidence → lane_order
- **hard replace codes:** B_FAR_THETA, INCOMPLETE_STEM, CONSTRUCT_MISS, ANSWER_INVALID, GENERIC_SYNONYM
- **SEED_DEMO** → quarantine

## Scalar tail

- **triggers:** mask_false, lane_conflict, incomplete_output, inherently_sequential
- **max_passes:** 2
- **Stage V2 generation:** out of band (not unbounded tail)

## Open exceptions

| Item | Trigger | Passes used | Status |
|---|---|---|---|
| _(none)_ | — | — | — |

## Last run snapshot

| disposition | count | notes |
|---|---:|---|
| keep | 38 | active level-test pool |
| repair | 1 | `grammar-3-2` LEVEL_LEXIS (reviewNote only) |
| replace | 0 | none remaining |
| quarantine | 3 | seeds + replaced `vocabulary-3` |

### Stage V2 apply

| action | detail |
|---|---|
| quarantine | seed-export-vocab-1, seed-export-reading-1 |
| replace | vocabulary-3 → `vocabulary-L2-replace-msfvg3on` (한글 뜻: 제안하다…) |
| extras pending | 2 context/cloze candidates for review |
| log | `workspace/level-test/STAGE_V2_APPLY_LOG.json` |

Bank: total 42 · approved 37 · pending 2 · quarantine 3

Artifacts:

- `workspace/level-test/FITNESS_REPORT.md`
- `workspace/level-test/replace_plan.json`
- `workspace/level-test/reduced.json`
- `workspace/level-test/STAGE_V2_APPLY_LOG.json`

## Change log

| Date | Change | Classification |
|---|---|---|
| 2026-08-05 | initial scaffold under harness/level-test-item-replace | new |
| 2026-08-05 | validate PASS; first fitness run on 39-item bank | run |
| 2026-08-05 | fix reduce: hard error codes beat keep votes | remediation |
| 2026-08-05 | Stage V2 apply_replace_plan + BANK_QUARANTINE status short-circuit | run |
