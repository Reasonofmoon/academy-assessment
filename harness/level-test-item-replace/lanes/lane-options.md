# Lane: lane-options

BROADCAST (identical for every lane)
  goal: Judge every generated-bank item for GLEAS level-test fitness and emit a deterministic replace_plan with per-slot replacement specs.
  constraints: see HARNESS_MANIFEST broadcast
  source_refs:
    - ../../data/generated-bank/items.json
    - references/level-test-codes.md

YOUR SLICE
  items[*].{options,answer,question,type}
  Own codes: DISTRACTOR_WEAK, ANSWER_INVALID, PASS
  Rules:
    - multiple_choice must have exactly 4 non-empty options
    - case-insensitive duplicate options → DISTRACTOR_WEAK (error)
    - answer index not integer 0..len-1 → ANSWER_INVALID (error)
    - extreme length tell (one option 3x longer than mean of others) → DISTRACTOR_WEAK (warning severity if only this)
  short_answer: empty model answer → ANSWER_INVALID (error)

OUTPUT SHAPE
  workspace/lanes/options.json — array of lane_output
  span: "options" | "answer"

RULES
  - Do not read other lanes' outputs.
