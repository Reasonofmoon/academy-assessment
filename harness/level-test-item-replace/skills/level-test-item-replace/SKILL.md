---
name: level-test-item-replace
description: >-
  Vector harness for GLEAS level-test fitness audit and replacement planning.
  Triggers: "레벨테스트 문항 교체", "level-test fitness", "replace_plan",
  "/level-test-item-replace".
---

# level-test-item-replace — orchestrator

Manifest is source of truth: `harness/level-test-item-replace/HARNESS_MANIFEST.json`.

## Stage 1 — Broadcast

Freeze packet from `broadcast`. Do not renegotiate constraints mid-run.
Code catalog: `references/level-test-codes.md`.

## Stage 2 — Vector step

Record ownership to `workspace/ownership.json` **before** compute:

| lane_id | input_slice | output |
|---|---|---|
| lane-psychometric | irt / theta | workspace/lanes/psychometric.json |
| lane-construct | stem / domain / passage | workspace/lanes/construct.json |
| lane-options | options / answer | workspace/lanes/options.json |
| lane-level-fit | seed / generic / level | workspace/lanes/level-fit.json |

## Stage 3 — Parallel compute

Default: **logical** sequential runner

```bash
# from repo root
python harness/level-test-item-replace/scripts/run_level_test_fitness.py
```

Each lane emits an array of `lane_output` objects (one per item_id).

## Stage 4 — Reduce

1. Hard constraints (catalog codes only; SEED_DEMO → quarantine).
2. Masks AND: schema_valid, constraint_satisfied, provenance_present, code_from_catalog.
3. Merge codes per item_id; apply disposition_rule.
4. Build `replacement_spec` for every `replace`.
5. Write:
   - `workspace/level-test/replace_plan.json`
   - `workspace/level-test/FITNESS_REPORT.md`
   - `workspace/level-test/reduced.json`

Never average keep vs replace conflicts — route to scalar tail.

## Stage 5 — Scalar tail

Budget: `max_passes=2`.
- Pass 1: re-run mask-failed lanes only.
- Pass 2: document exceptions in HARNESS_STATE.md.

**Stage V2 (apply plan):**

```bash
# requires next dev + GEMINI_API_KEY
node harness/level-test-item-replace/scripts/apply_replace_plan.mjs
python harness/level-test-item-replace/scripts/run_level_test_fitness.py
```

- Quarantines `plan.quarantine` and replaced originals
- Generates slot-preserving replacements; filters forbidden patterns
- Writes `workspace/level-test/STAGE_V2_APPLY_LOG.json`
- Bank `status=quarantine` is terminal for V1 (code `BANK_QUARANTINE`)

## Acceptance

All tests in `broadcast.acceptance_tests` must pass before completion.
