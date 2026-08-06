# Level reading pack fill verification
- pack version: `2.3.0`
- organizeBy: CEFR first

## 1. Pack completeness per level

[PASS] L1: 5 passages filled
[PASS] L1: CEFR label `Pre-A1/A1`
[PASS] L1: IRT anchor CEFR matches (`Pre-A1/A1`)
- L1 titles: ['A Red Ball', 'Rainy Morning', 'Bus to School', "Grandma's Soup", 'New Shoes']
- L1 metrics: wc=[69, 66, 73, 60, 67] avg=67 | targetB avg=-2.20 | longTok=0.025 | sentLen=8.5
[PASS] L1: word counts in soft band ~55–75
[PASS] L1: avg targetB ≈ thetaCenter (-2.2)
[PASS] L2: 5 passages filled
[PASS] L2: CEFR label `A2`
[PASS] L2: IRT anchor CEFR matches (`A2`)
- L2 titles: ['The Missing Pencil Case', 'Science Fair Plan', 'Library Detective', 'Soccer Tryouts', 'A Letter to My Teacher']
- L2 metrics: wc=[81, 78, 77, 80, 63] avg=76 | targetB avg=-0.95 | longTok=0.056 | sentLen=11.1
[PASS] L2: word counts in soft band ~65–90
[PASS] L2: avg targetB ≈ thetaCenter (-0.95)
[PASS] L3: 5 passages filled
[PASS] L3: CEFR label `A2-B1`
[PASS] L3: IRT anchor CEFR matches (`A2-B1`)
- L3 titles: ['The School Play Argument', 'Lost on the Field Trip', 'Phone Rules at Home', 'The Group Project', 'A Rainy Championship']
- L3 metrics: wc=[85, 78, 79, 77, 73] avg=78 | targetB avg=0.25 | longTok=0.079 | sentLen=10.3
[PASS] L3: word counts in soft band ~70–95
[PASS] L3: avg targetB ≈ thetaCenter (0.25)
[PASS] L4: 5 passages filled
[PASS] L4: CEFR label `B1`
[PASS] L4: IRT anchor CEFR matches (`B1`)
- L4 titles: ['The Map in the Attic', 'Guarding the Bridge', 'Signal from the Hill', 'The Shared Notebook', 'Escape from the Flooded Path']
- L4 metrics: wc=[138, 134, 129, 119, 142] avg=132 | targetB avg=1.00 | longTok=0.124 | sentLen=18.9
[PASS] L4: word counts in soft band ~110–150
[PASS] L4: avg targetB ≈ thetaCenter (1.0)
[PASS] L5: 5 passages filled
[PASS] L5: CEFR label `B1-B2`
[PASS] L5: IRT anchor CEFR matches (`B1-B2`)
- L5 titles: ['Season of Dust Storms', 'The Hidden Garden Door', 'Message in the Tide', "The Clockmaker's Apprentice", 'Flight Across the Canyon']
- L5 metrics: wc=[156, 163, 143, 144, 137] avg=149 | targetB avg=1.70 | longTok=0.133 | sentLen=20.6
[PASS] L5: word counts in soft band ~120–160
[PASS] L5: avg targetB ≈ thetaCenter (1.7)
[PASS] L6: 5 passages filled
[PASS] L6: CEFR label `B2`
[PASS] L6: IRT anchor CEFR matches (`B2`)
- L6 titles: ['The Ethics of Tracking', 'Language That Shapes Choice', 'Restoring a River', 'The Archive of Voices', 'When Markets Amplify Hits']
- L6 metrics: wc=[144, 142, 147, 135, 149] avg=143 | targetB avg=2.40 | longTok=0.219 | sentLen=20.5
[PASS] L6: word counts in soft band ~120–160
[PASS] L6: avg targetB ≈ thetaCenter (2.4)
[PASS] unique passage ids: 30
[PASS] no commercial series names in passage bodies

## 2. Difficulty ladder (L1 → L6 should rise)

[PASS] targetB L1 -2.20 → L2 -0.95
[PASS] wordCount L1 67 → L2 76
[PASS] lexis/syntax L1→L2 (lr 0.025→0.056, sl 8.5→11.1)
[PASS] targetB L2 -0.95 → L3 0.25
[PASS] wordCount L2 76 → L3 78
[PASS] lexis/syntax L2→L3 (lr 0.056→0.079, sl 11.1→10.3)
[PASS] targetB L3 0.25 → L4 1.00
[PASS] wordCount L3 78 → L4 132
[PASS] lexis/syntax L3→L4 (lr 0.079→0.124, sl 10.3→18.9)
[PASS] targetB L4 1.00 → L5 1.70
[PASS] wordCount L4 132 → L5 149
[PASS] lexis/syntax L4→L5 (lr 0.124→0.133, sl 18.9→20.6)
[PASS] targetB L5 1.70 → L6 2.40
[PASS] wordCount L5 149 → L6 143
[PASS] lexis/syntax L5→L6 (lr 0.133→0.219, sl 20.6→20.5)

## 3. L1 elementary fitness

[PASS] preset-L1-P01 elementary-ok (wc=69, lr=0.01, sl=7.7)
[PASS] preset-L1-P02 elementary-ok (wc=66, lr=0.00, sl=8.2)
[PASS] preset-L1-P03 elementary-ok (wc=73, lr=0.01, sl=10.4)
[PASS] preset-L1-P04 elementary-ok (wc=60, lr=0.07, sl=7.5)
[PASS] preset-L1-P05 elementary-ok (wc=67, lr=0.03, sl=8.5)

## 4. L4+ original-only policy

[PASS] L4: refSeries empty (academy original only)
[PASS] L5: refSeries empty (academy original only)
[PASS] L6: refSeries empty (academy original only)

## 5. Approved bank fill vs presets (target: 1 item / passage)

[PASS] approved reading all match presets (n=30)
[PASS] L1: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L1: item.level matches passage pack level
- L1 questionTypes: {'main_idea': 1, 'detail': 2, 'inference': 1, 'purpose': 1}
[PASS] L2: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L2: item.level matches passage pack level
- L2 questionTypes: {'main_idea': 1, 'detail': 2, 'inference': 1, 'purpose': 1}
[PASS] L3: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L3: item.level matches passage pack level
- L3 questionTypes: {'main_idea': 1, 'detail': 1, 'inference': 1, 'purpose': 1, 'attitude': 1}
[PASS] L4: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L4: item.level matches passage pack level
- L4 questionTypes: {'main_idea': 1, 'inference': 1, 'detail': 1, 'purpose': 1, 'attitude': 1}
[PASS] L5: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L5: item.level matches passage pack level
- L5 questionTypes: {'main_idea': 1, 'inference': 1, 'detail': 1, 'purpose': 1, 'attitude': 1}
[PASS] L6: bank fill complete — 5 approved, 5/5 presets, no dups
[PASS] L6: item.level matches passage pack level
- L6 questionTypes: {'main_idea': 1, 'inference': 1, 'detail': 1, 'purpose': 1, 'attitude': 1}

## 6. Generation config (1:1 sessions)

[PASS] L1: items=5 passagesPerSession=5
[PASS] L2: items=5 passagesPerSession=5
[PASS] L3: items=5 passagesPerSession=5
[PASS] L4: items=5 passagesPerSession=5
[PASS] L5: items=5 passagesPerSession=5
[PASS] L6: items=5 passagesPerSession=5

## Sample stems (approved)

- L1 `main_idea`: What is the story mostly about?
- L1 `detail`: What does Mia drink on the rainy morning?
- L2 `main_idea`: 윗글의 내용으로 가장 적절한 것은?
- L2 `detail`: 준은 과학 박람회 프로젝트를 위해 매일 무엇을 할 것인가?
- L3 `main_idea`: 이 글의 중심 내용은 무엇인가?
- L3 `detail`: 대이는 학급 친구들이 사라진 것을 깨달은 후 무엇을 했는가?
- L4 `main_idea`: What is the main idea of the passage?
- L4 `inference`: What can be inferred about Hoon's work as a bridge volunteer?
- L5 `main_idea`: What is the main idea of the passage?
- L5 `inference`: What can be inferred about the hidden garden room before Jack discover
- L6 `main_idea`: What is the main topic discussed in the passage?
- L6 `inference`: What can be inferred about the impact of "framing" from the passage?

## Verdict
- PASS=74 · WARN=0 · FAIL=0
- **Verdict: PASS**
