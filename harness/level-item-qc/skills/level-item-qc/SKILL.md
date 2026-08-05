---
name: level-item-qc
description: >-
  Vector harness: per GLEAS level (L1–L6) item count + quality QC.
  Triggers: "레벨별 문항 검수", "level item qc", "/level-item-qc".
---

# level-item-qc — orchestrator

Manifest: `harness/level-item-qc/HARNESS_MANIFEST.json`.

## Stage 1 — Broadcast

Freeze count thresholds and quality policy from `references/level-qc-policy.md`.

Defaults: `min_per_domain=3`, `min_total=9`, quarantine excluded.

## Stage 2 — Vector step

Ownership (before compute) → `workspace/ownership.json`:

| lane | slice |
|---|---|
| lane-L1 … lane-L6 | `items[level==N]` active only |

## Stage 3 — Parallel compute (logical)

```bash
python harness/level-item-qc/scripts/run_level_item_qc.py
# optional:
python harness/level-item-qc/scripts/run_level_item_qc.py --min-per-domain 4 --min-total 12
```

## Stage 4 — Reduce

Stack level outputs → overall verdict → `workspace/reports/LEVEL_QC_REPORT.md` + `reduced.json`.

## Stage 5 — Scalar tail

Record underfilled levels; remediation via generate / level-test-item-replace Stage V2.

## Acceptance

Levels 1–6 present with verdicts; report path exists.
