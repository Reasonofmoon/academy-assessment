# IRT sample sandbox (NOT product bank)

이 폴더는 **캘리브레이션 코드 검증용**입니다.

- **제품 문항 bank / curated service / passages-by-level 에 merge 하지 않습니다.**
- 입력: `Dicht_Data2.csv` (Kaggle dichotomous IRT sample)
- 출력: `out/` 아래 프로파일·long format·2PL 추정 결과

## 파일 배치

```
data/irt-sample/Dicht_Data2.csv   ← 사용자 배치 (gitignore)
data/irt-sample/out/              ← 스크립트 산출물 (gitignore)
```

다운로드 후 자동 배치:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/irt_sandbox/place_dicht_csv.ps1
```

## 실행

```bash
# 전체 파이프라인 (프로파일 → long format → 2PL → 요약)
python scripts/irt_sandbox/run_sandbox.py

# 빈 Student ID 행을 제외하지 않으려면
python scripts/irt_sandbox/run_sandbox.py --keep-empty-id

# 단계별
python scripts/irt_sandbox/profile_dicht.py
python scripts/irt_sandbox/convert_to_cat_responses.py          # 기본: drop empty ID
python scripts/irt_sandbox/convert_to_cat_responses.py --keep-empty-id
python scripts/irt_sandbox/estimate_2pl.py
python scripts/irt_sandbox/write_summary.py

# CSV 없을 때 합성 데이터 스모크
python scripts/irt_sandbox/run_sandbox.py --demo
```

npm:

```bash
npm run irt:sandbox
npm run irt:sandbox:demo
npm run irt:from-cat:fixture   # 합성 cat_responses → sparse 2PL → QC(smoke)
npm run irt:from-cat           # live export → 2PL → QC(pilot)
npm run irt:qc:smoke           # out-fixture 에 QC만 재실행
npm run irt:ci                 # CI와 동일 fixture 파이프라인
```

CI: `.github/workflows/irt-sandbox.yml` (fixture → 2PL → QC, bank 미기록).

## Real cat_responses (live)

설계 문서: [`docs/IRT_CAT_RESPONSES_2PL_PIPELINE.md`](../../docs/IRT_CAT_RESPONSES_2PL_PIPELINE.md)

| 경로 | 역할 |
|------|------|
| `fixtures/cat_responses_fixture.jsonl` | 커밋된 합성 로그 (스모크) |
| `live/cat_responses.jsonl` | Supabase export (gitignore, PII 없이 session_id) |
| `out-fixture/` / `out-live/` | 행렬·2PL 산출 (gitignore) |

```bash
# 1) 픽스처 스모크 (DB 불필요)
python scripts/irt_sandbox/run_live_pipeline.py --fixture

# 2) 실로그: Supabase에서 export 후
#    data/irt-sample/live/cat_responses.jsonl 에 두고
python scripts/irt_sandbox/run_live_pipeline.py
# 또는 단계별
python scripts/irt_sandbox/from_cat_responses.py --in data/irt-sample/live/cat_responses.jsonl --out-dir data/irt-sample/out-live --write-long
python scripts/irt_sandbox/estimate_2pl.py data/irt-sample/out-live/response_matrix.json
python scripts/irt_sandbox/qc_item_params.py --profile pilot data/irt-sample/out-live
```

QC 산출: `item_params_qc.json`, `QC_REPORT.md`, `APPROVE_APPLY.draft.json` (human only → `APPROVE_APPLY.json`).

Export SQL (echobridge `public.cat_responses`):

```sql
select session_id, step, item_id, domain, dimension, passage_id,
       correct, selected_option_id, response_time_ms, created_at
from public.cat_responses
where created_at >= '2026-07-01'
order by session_id, step;
```

**Bank merge 금지.** 승격은 `APPROVE_APPLY` + human gate 후에만.

### Export / apply (echobridge-web)

```bash
# 1) 응답 로그 export → live/
cd ../echobridge-web
npm run export:cat-responses -- --out ../academy-assessment/data/irt-sample/live/cat_responses.jsonl

# 2) academy에서 캘리브 + QC
cd ../academy-assessment
npm run irt:from-cat

# 3) draft 검토 → APPROVE_APPLY.json (approved:true) 후 dry-run / write
cd ../echobridge-web
npm run apply:empirical -- --approve ../academy-assessment/data/irt-sample/out-live/APPROVE_APPLY.json
# npm run apply:empirical:write -- --approve ...   # human only
```

상세: `echobridge-web/docs/CAT_RESPONSES_EXPORT_AND_EMPIRICAL_APPLY.md`

## 옵션: empty Student ID

| 플래그 | 동작 |
|--------|------|
| (기본) | `Student ID` 가 빈 행 **제외** (`drop_empty_id=true`) |
| `--keep-empty-id` | 빈 ID를 `person-{row}` 로 채우고 **포함** |

실데이터(Dicht)에는 빈 ID **1행**이 있어 기본 실행 시 persons **239 → 238**.

## 산출물

| 파일 | 내용 |
|------|------|
| `out/profile_report.md` | 행/열/결측/p+ |
| `out/cat_responses_long.jsonl` | echobridge형 long format |
| `out/response_matrix.json` | 추정용 행렬 |
| `out/item_params_2pl.json` | 문항 a,b (샌드박스) |
| `out/person_theta.json` | 응시자 θ |
| `out/SANDBOX_RESULTS.md` | **2PL 포함 종합 요약** |
| `out/estimate_2pl_report.md` | 2PL 짧은 표 |

## 금지

- `data/generated-bank/` 에 쓰지 않음
- `data/reading-passages/` / `data/irt-exemplars/` 덮어쓰지 않음
- echobridge `src/data/curated` merge 하지 않음

## 실데이터 적용 메모

- 행렬: STEM+영어 MCQ **0/1** 점수 (문항 stem 헤더만 있음, 보기 없음)
- 우리 GLEAS 영어 bank와 **구인 불일치** → 연습용만
- person 키: **`Student ID`** (빈 첫 열 인덱스 아님)

<!-- SANDBOX_SNAPSHOT_START -->
## Last run snapshot

_Auto-updated 2026-07-13 11:03 UTC from `out/*`. Full detail: [`out/SANDBOX_RESULTS.md`](out/SANDBOX_RESULTS.md)._

| field | value |
|-------|------:|
| persons (convert) | 238 |
| dropped empty Student ID | 1 |
| items | 60 |
| long rows | 14280 |
| person key | `Student ID` |
| 2PL a | 0.200 … 2.500 (mean 0.678) |
| 2PL b | -1.871 … 3.497 (mean 0.823) |
| theta | -1.506 … 2.841 (mean 0.000) |

**Product bank merge: never.**

<!-- SANDBOX_SNAPSHOT_END -->
