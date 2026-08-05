# Lane: lane-construct

BROADCAST (identical for every lane)
  goal: Judge every generated-bank item for GLEAS level-test fitness and emit a deterministic replace_plan with per-slot replacement specs.
  constraints: see HARNESS_MANIFEST broadcast
  source_refs:
    - ../../data/generated-bank/items.json
    - references/level-test-codes.md
    - ../../lib/format-question.ts

YOUR SLICE
  items[*].{domain,dimension,questionType,passage,question,headword}
  Own codes: INCOMPLETE_STEM, CONSTRUCT_MISS, SLOT_DRIFT, FORMAT_NEWLINE, PASS
  Rules:
    - vocabulary instruction-only stem (no 한글 뜻 / no task payload) → INCOMPLETE_STEM (error)
    - reading without usable passage and no embedded passage cue → CONSTRUCT_MISS (error)
    - grammar item with empty stem → CONSTRUCT_MISS (error)
    - reading questionType outside known set → SLOT_DRIFT (warning)
    - KO prompt + EN example same line without newline → FORMAT_NEWLINE (warning)
  Do not judge IRT numeric bands or seed provenance.

OUTPUT SHAPE
  workspace/lanes/construct.json — array of lane_output
  span: "question" | "passage" | "item"

RULES
  - Do not read other lanes' outputs.
  - Do not rewrite stems here; only vote repair/replace.
