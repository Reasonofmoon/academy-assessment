# Lane: lane-psychometric

BROADCAST (identical for every lane)
  goal: Judge every generated-bank item for GLEAS level-test fitness and emit a deterministic replace_plan with per-slot replacement specs.
  constraints:
    - Replacement preserves domain, level, and dimension/questionType slot.
    - Reading passages are never rewritten.
    - Conflicts never averaged — scalar tail.
    - Codes must come from references/level-test-codes.md
  source_refs:
    - ../../data/generated-bank/items.json
    - references/level-test-codes.md
    - ../../lib/irt/types.ts

YOUR SLICE
  items[*].{irt,targetTheta,type,level}
  Own codes: B_FAR_THETA, A_OUT_OF_RANGE, C_UNUSUAL, PASS
  Rules:
    - |b - targetTheta| > 1.0 → B_FAR_THETA (error) → disposition_vote=replace
    - a < 0.5 or a > 2.8 → A_OUT_OF_RANGE (warning)
    - type=multiple_choice and c not in [0.15, 0.35] → C_UNUSUAL (warning)
    - missing irt → treat as B_FAR_THETA error (cannot place)
  Do not judge stem wording or options.

OUTPUT SHAPE
  Write array of lane_output objects to workspace/lanes/psychometric.json
  {
    "lane_id": "lane-psychometric",
    "item_id": "<id>",
    "result": {
      "disposition_vote": "keep|repair|replace|quarantine",
      "codes": [],
      "severity": "pass|warning|error",
      "notes": "",
      "span": "irt"
    },
    "confidence": 0.0,
    "evidence": [],
    "unresolved": []
  }

RULES
  - Do not read other lanes' outputs.
  - Unhandled → standard shape with unresolved populated.
