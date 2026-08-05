# Lane: lane-level-fit

BROADCAST (identical for every lane)
  goal: Judge every generated-bank item for GLEAS level-test fitness and emit a deterministic replace_plan with per-slot replacement specs.
  constraints: see HARNESS_MANIFEST broadcast
  source_refs:
    - ../../data/generated-bank/items.json
    - ../../data/irt-exemplars/manifest.json
    - references/level-test-codes.md

YOUR SLICE
  items[*].{irtSource,question,level,domain,options}
  Own codes: SEED_DEMO, GENERIC_SYNONYM, LEVEL_LEXIS, PASS
  Rules:
    - irtSource == "test" OR id starts with seed-export- → SEED_DEMO (error) → quarantine
    - stem matches /closest in meaning to/i or bare EN synonym quiz without Korean scaffold → GENERIC_SYNONYM (error)
    - optional heuristic: L1–L2 non-grammar items with 3+ uncommon long tokens (len≥11) → LEVEL_LEXIS (warning)
    - grammar options are excluded (comparative/superlative distractors often look “long”)
  This lane owns level-test product fitness, not pure schema.

OUTPUT SHAPE
  workspace/lanes/level-fit.json — array of lane_output
  span: "item" | "question"

RULES
  - Do not read other lanes' outputs.
  - SEED_DEMO always disposition_vote=quarantine.
