# School exam catalog (difficulty reference)

Local Korean school English tests under the operator’s Downloads folder
(`옥길시험지/...`) are used only as **difficulty / construct references** for
GLEAS **vocabulary** and **grammar** placement items.

| file | role |
|------|------|
| `okgil-source-catalog.json` | Index of local JSON exams (paths, type histograms) — **no passage body** |
| `construct-by-level.json` | Per-level vocab/grammar formats & forbidden patterns |

## Copyright

- Do **not** copy exam passages or items into the item bank.
- Generation prompts load `construct-by-level.json` and say “style only”.

## Rebuild index

```bash
python scripts/index_okgil_exam_styles.py
python scripts/index_okgil_exam_styles.py --source "C:/Users/sound/Downloads/옥길시험지/옥길시험지/옥길시험지"
```

## High-school construct (L4)

Calibrated to local 일반고 내신 type mix (대의파악·빈칸·**어법**·**어휘**·내용일치…):

- **어휘**: 문맥상 쓰임이 어색한 낱말 / multi-sentence cloze (not elementary gloss drills)
- **어법**: 밑줄 오류 찾기, 도치·가정법·분사·관계사 등 단문 나열 금지

## Seed / refresh bank

```bash
# Offline original HS-style seed (no Gemini)
python scripts/seed_hs_vocab_grammar_bank.py

# Online regenerate when GEMINI_API_KEY works
node scripts/refresh-vocab-grammar-levels.mjs --levels 3,4,5,6
```
