# Reading passages (level presets)

## Files

| file | role |
|------|------|
| `passages-by-level.json` | **Runtime pack** used by the app (`L1`–`L6`, 5 passages each) |
| `source-catalog.json` | Local index of graded-reader **files on disk** (names/paths only), **grouped by CEFR** |
| `generation-config.json` | Default item counts / questionType slots |

## Copyright policy

Commercial series under the operator’s Downloads folder (Fly Guy, Nate the Great,
Dragon Masters, Magic Tree House Merlin Mission, My Weird School, Horrid Henry,
Little Critter, …) are used only as **CEFR difficulty references**.

- **Do not** copy book body text into this repository.
- Passages in `passages-by-level.json` are **original academy text**, written to match
  CEFR bands (not copied from those books).

Rebuild:

```bash
python scripts/build_passages_from_reader_levels.py
python scripts/build_passages_from_reader_levels.py --source "C:/path/to/영어원서 원문 모음-..."
```

## Organize by CEFR (primary)

Local series are tagged with a CEFR range (operator judgment). Use **CEFR first**,
then map into the app’s GLEAS placement ladder.

| Local series | CEFR primary | Range | Notes |
|--------------|--------------|-------|--------|
| Little Critter | **Pre-A1** | Pre-A1 | A1보다 아래 — 초단문·일상 어휘 |
| Fly Guy | **A1** | Pre-A1–A1 | A1 또는 그 아래 |
| Dragon Masters | **A2** | A1–A2 | 챕터 모험, A2까지 |
| Horrid Henry | **A2** | A2 | B1 미만, A2 중심 |
| Magic Treehouse Merlin Mission | **A2** | A2 | A2 확장 서사 |
| Nate the Great | **A2–B1** | A2–B1 | A2보다 높고 B1까지 가능 |
| My Weird School | **A2–B1** | A2–B1 | Nate와 유사, B1까지 가능 |

### CEFR → GLEAS (placement)

| CEFR band | Default GLEAS | Grades (app) |
|-----------|---------------|--------------|
| Pre-A1 / A1 | **L1** | 초1–초6 |
| A2 | **L2** | 중1–중2 |
| A2–B1 | **L3** | 중3–고1 |
| B1 | **L4** | 고2–고3 |
| B1–B2 | **L5** | 고급 |
| B2 | **L6** | 고급+ |

**IRT `levelAnchors` follow this ladder** (`data/irt-exemplars/manifest.json`).
Generation uses `getLevelAnchor(level).cefr` / `thetaCenter` aligned to the passage pack
(not the older echobridge TOEFL / C1–C2 labels).

`source-catalog.json` fields:

- `byCefr` — series names grouped by CEFR primary  
- `series[].cefrPrimary` / `cefrMin` / `cefrMax` / `cefrNote`  
- `cefrToGleas` — band → default GLEAS  
- `seriesMeta` — full CEFR map used by the builder  

## GLEAS pack calibration (original text)

| GLEAS | CEFR label | Reference series (difficulty only) |
|-------|------------|-------------------------------------|
| L1 | Pre-A1/A1 | Little Critter, Fly Guy |
| L2 | A2 | Dragon Masters, Horrid Henry, Magic Tree House |
| L3 | A2–B1 | Nate the Great, My Weird School |
| L4 | B1 | **academy original only** (no commercial series) |
| L5 | B1–B2 | **academy original only** |
| L6 | B2 | **academy original only** |

L4+ is intentionally decoupled from Nate / Weird School so B1 placement text
is not under-calibrated to A2–B1 chapter books.

## Level-test usage

- Prefer **one item per selected passage** (enforced in generation UI).
- Grade **초1–초6** locks to **L1** passage pack.

## Target length (approx.)

| GLEAS | ~words / passage | CEFR band |
|-------|------------------|-----------|
| L1 | 55–75 | Pre-A1/A1 |
| L2 | 65–90 | A2 |
| L3 | 70–95 | A2–B1 |
| L4 | 110–150 | B1 (original only) |
| L5 | 120–160 | B1–B2 (original only) |
| L6 | 120–160 | B2 (original only) |

Current pack version is written by `scripts/build_passages_from_reader_levels.py` (`version` field in JSON).
