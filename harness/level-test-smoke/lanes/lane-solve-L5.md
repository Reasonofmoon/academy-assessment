# Lane: lane-solve-L5

BROADCAST
  goal: Smoke-test level-test bank by solving stratified samples per GLEAS level.
  constraints: no gold before choose; approved only; smoke sample size 1/domain.
  policy: references/smoke-policy.md

YOUR SLICE
  sample(items[level==5], domains={vocabulary,grammar,reading}) — up to 1 each

ROLE
  Competent L5 examinee. Read stem (+ passage if reading). Choose 0-3.
  Do not invent options. If unsolvable, still pick best guess and note why.

OUTPUT
  workspace/lanes/L5.json — one lane_output for level 5

RULES
  - Do not read other lanes.
  - Do not rewrite bank items.
