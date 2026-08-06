# Level-test intent vs CEFR passage pack verification

- passages version: `2.3.0`
- bank items loaded: 143
- catalog series: 7

## 1. Product intent checklist (docs + policy)

- [PASS] policy.doNotRewritePassage=True
- [PASS] policy.generateItemsFromPassageOnly=True
- [PASS] policy.gradeLocksDefaultLevel=True
- [PASS] policy.oneItemPerPassageInLevelTest=True
- [PASS] policy organizes difficulty by CEFR first
- [PASS] No commercial series names in passage body text (copyright)

## 2. Passage pack structure (level-test runtime)

- [PASS] L1: 5 passages, count field OK
- [PASS] L2: 5 passages, count field OK
- [PASS] L3: 5 passages, count field OK
- [PASS] L4: 5 passages, count field OK
- [PASS] L5: 5 passages, count field OK
- [PASS] L6: 5 passages, count field OK
- [PASS] Global unique ids: 30

## 3. CEFR ladder alignment (passages vs IRT levelAnchors)

- [INFO] App grade lock: 초1-6→L1, 중1-2→L2, 중3/고1→L3, 고2-3→L4
- [INFO] Level-test purpose: place student on GLEAS via vocab/grammar/reading on level-appropriate materials; reading must not rewrite presets.
- [INFO] L1: pack CEFR=Pre-A1/A1 theta=-2.2 avg targetB=-2.20 | anchor CEFR=Pre-A1/A1 theta=-2.2
- [PASS] L1 CEFR roughly compatible: pack=Pre-A1/A1, anchor=Pre-A1/A1
- [PASS] L1 avg targetB near anchor theta (Δ=0.00)
- [INFO] L2: pack CEFR=A2 theta=-0.95 avg targetB=-0.95 | anchor CEFR=A2 theta=-0.95
- [PASS] L2 CEFR roughly compatible: pack=A2, anchor=A2
- [PASS] L2 avg targetB near anchor theta (Δ=0.00)
- [INFO] L3: pack CEFR=A2-B1 theta=0.25 avg targetB=0.25 | anchor CEFR=A2-B1 theta=0.25
- [PASS] L3 CEFR roughly compatible: pack=A2-B1, anchor=A2-B1
- [PASS] L3 avg targetB near anchor theta (Δ=0.00)
- [INFO] L4: pack CEFR=B1 theta=1.0 avg targetB=1.00 | anchor CEFR=B1 theta=1.0
- [PASS] L4 CEFR roughly compatible: pack=B1, anchor=B1
- [PASS] L4 avg targetB near anchor theta (Δ=0.00)
- [INFO] L5: pack CEFR=B1-B2 theta=1.7 avg targetB=1.70 | anchor CEFR=B1-B2 theta=1.7
- [PASS] L5 CEFR roughly compatible: pack=B1-B2, anchor=B1-B2
- [PASS] L5 avg targetB near anchor theta (Δ=0.00)
- [INFO] L6: pack CEFR=B2 theta=2.4 avg targetB=2.40 | anchor CEFR=B2 theta=2.4
- [PASS] L6 CEFR roughly compatible: pack=B2, anchor=B2
- [PASS] L6 avg targetB near anchor theta (Δ=0.00)

## 3b. CEFR policy (anchors follow passage pack)

- [INFO] Canonical ladder: L1 Pre-A1/A1, L2 A2, L3 A2-B1, L4 B1, L5 B1-B2, L6 B2
- [PASS] Policy A: IRT levelAnchors CEFR/theta track reading-passages pack
- [PASS] L1 Pre-A1/A1 pack matches early-reader placement (초등 lock)
- [PASS] L2 A2 pack fits 중1–중2 graded-reader band
- [PASS] L3–L6 labels no longer claim TOEFL/C1 when materials peak at B2

## 4. Local series CEFR map vs grade→level lock

- [PASS] L1 refSeries matches CEFR design: ['Fly Guy', 'Little Critter']
- [PASS] L2 refSeries matches CEFR design: ['Dragon Masters', 'Horrid Henry', 'Magic Treehouse Merlin Mission']
- [PASS] L3 refSeries matches CEFR design: ['My Weird School', 'Nate the Great']
- [PASS] L4 refSeries matches CEFR design: ['(original only)']
- [PASS] L5 refSeries matches CEFR design: ['(original only)']
- [PASS] L6 refSeries matches CEFR design: ['(original only)']
- [PASS] Catalog Pre-A1/A1 grouping correct
- [PASS] A2 series grouped
- [PASS] A2-B1 series grouped

## 5. Generation config vs one-item-per-passage intent

- [PASS] L1: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] L2: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] L3: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] L4: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] L5: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] L6: default auto-select want=5 ≥ itemsPerReading=5 → can be 1:1
- [PASS] maxPassagesPerSession=5 allows full 5-passage unique sessions

## 6. Approved bank reading items vs current preset texts

- [INFO] Reading items total=54 by status={'quarantine': 12, 'approved': 42}
- [INFO] Approved reading with exact preset text match: 0; mismatch/orphan: 42
- [FAIL] No approved reading items match current presets (42 orphans) — bank out of sync with pack v2.3.0
- [INFO]   L1: approved=10 exact=0 miss=5 quarantine=11 pending=0
- [INFO]   L2: approved=24 exact=0 miss=12 quarantine=1 pending=0
- [INFO]   L3: approved=14 exact=0 miss=7 quarantine=0 pending=0
- [INFO]   L4: approved=12 exact=0 miss=6 quarantine=0 pending=0
- [INFO]   L5: approved=12 exact=0 miss=6 quarantine=0 pending=0
- [INFO]   L6: approved=12 exact=0 miss=6 quarantine=0 pending=0

Orphan approved reading samples (passage no longer in pack):
  - reading-1 L2: "Dear Ms. White, My son, Michael, got home from school yesterday around 6 p.m. af…"
  - reading-2 L2: "My wife and I visited your cinema last month. We purchased two tickets which cam…"
  - reading-3 L2: "Dear Ms. White, My son, Michael, got home from school yesterday around 6 p.m. af…"
  - reading-4 L2: "My wife and I visited your cinema last month. We purchased two tickets which cam…"
  - reading-1-2 L2: "Dear Ms. White, My son, Michael, got home from school yesterday around 6 p.m. af…"
  - reading-2-2 L2: "My wife and I visited your cinema last month. We purchased two tickets which cam…"
  - reading-3-2 L2: "Dear Ms. White, My son, Michael, got home from school yesterday around 6 p.m. af…"
  - reading-4-2 L2: "My wife and I visited your cinema last month. We purchased two tickets which cam…"

## 7. Level-test uniqueness (approved reading)

- [WARN] 10 passage texts used by multiple approved items (spam risk if served together)
- [INFO]   x7: Dear Ms. White, My son, Michael, got home from sch…
- [INFO]   x5: My wife and I visited your cinema last month. We p…
- [INFO]   x4: Shoppers confronted with the choice of thirty diff…
- [INFO]   x3: One of the most important things to remember befor…
- [INFO]   x4: Although we humans are equipped with reflexive res…

## 8. L1 elementary fitness (초1–초6 lock)

- [PASS] L1 word counts in elementary band: [69, 66, 73, 60, 67]
- [PASS] L1 preset-L1-P01 lexis light (long-token ratio 0.01)
- [PASS] L1 preset-L1-P02 lexis light (long-token ratio 0.00)
- [PASS] L1 preset-L1-P03 lexis light (long-token ratio 0.01)
- [PASS] L1 preset-L1-P04 lexis light (long-token ratio 0.07)
- [PASS] L1 preset-L1-P05 lexis light (long-token ratio 0.03)

## 9. Monotonic difficulty ladder (targetB / length)

- [PASS] targetB L1 -2.20 → L2 -0.95
- [PASS] wordCount L1 67 → L2 76
- [PASS] targetB L2 -0.95 → L3 0.25
- [PASS] wordCount L2 76 → L3 78
- [PASS] targetB L3 0.25 → L4 1.00
- [PASS] wordCount L3 78 → L4 132
- [PASS] targetB L4 1.00 → L5 1.70
- [PASS] wordCount L4 132 → L5 149
- [PASS] targetB L5 1.70 → L6 2.40
- [WARN] wordCount L5 149 → L6 143 (non-monotonic)

## 10. Code-level level-test behaviors (spot check)

- [PASS] page.tsx: grade lock + readingCount capped by selected passages
- [PASS] LevelPassagePanel documents 1 item per passage
- [PASS] generate.ts enforces fixed passages + uniqueness for level test
- [PASS] planReadingItemSlots prefers unique passages first

## 11. Overall verdict

- Passes: 64 · Warnings: 2 · Fails: 1
- **Verdict: FAIL — fix before treating bank/pack as level-test ready**

### Recommended actions
1. Regenerate/replace orphan approved reading items so bank passages equal preset pack v2.3.0.
2. Keep L4–L6 as original-only while commercial series peak at A2–B1.
3. Re-run this script after bank regeneration: python scripts/verify_level_test_passage_intent.py
