---
name: level-test-smoke
description: >-
  Agent-solved level-test smoke. Triggers: "레벨테스트 스모크", "smoke test items",
  "/level-test-smoke".
---

# level-test-smoke — orchestrator

## Stages

1. Broadcast smoke policy + bank path  
2. Vector: assign L1–L6 sample slices  
3. Compute: solve each item (Gemini) without gold, score vs key  
4. Reduce: accuracy matrix + flags  
5. Scalar tail: retry API failures (max 2)

```bash
python harness/level-test-smoke/scripts/run_level_test_smoke.py
```

Requires `GEMINI_API_KEY` in repo `.env.local`.
