# Lane: lane-L3

BROADCAST (identical for every lane)
  goal: Audit active bank items per GLEAS level (L1–L6) for count coverage and quality, emit one level matrix report.
  constraints:
    - Only approved|pending count; quarantine excluded.
    - Empty levels fail unless allow_empty_levels.
    - Report only; do not rewrite bank.
  policy: references/level-qc-policy.md
  source_refs:
    - ../../data/generated-bank/items.json

YOUR SLICE
  items[level==3] (active only)
  Checks:
    - counts total and by domain vs min_total / min_per_domain
    - quality codes: INCOMPLETE_STEM, GENERIC_SYNONYM, OPTIONS_BAD, READING_NO_PASSAGE, B_FAR_THETA, IRT_SOFT, SEED_ACTIVE
  item_id: level:3

OUTPUT
  workspace/lanes/L3.json — single lane_output object for this level

RULES
  - Do not read other levels' outputs.
  - Emit uniform schema only.
