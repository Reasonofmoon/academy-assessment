# IRT 원리 기반 AI 문항 생성

academy-assessment를 **정제 데이터(echobridge-web curated service) few-shot + IRT 3PL 규칙**으로 문항을 만드는 앱으로 확장한 설계 문서.

## 1. 데이터 통합

| 소스 | 내용 | 이 앱에서의 역할 |
|------|------|------------------|
| `echobridge-web` `src/data/curated/*.service.json` | 어휘 service 트란치 (~6.2k) | 층화 표본 → few-shot |
| `echobridge-web` `src/data/reading/curated/*.service.json` | 리딩 service | 층화 표본 → few-shot |
| `data/irt-exemplars/` | 표본화 결과 (~340 items) | 런타임 로드 |

전체 CAT 은행(65k)은 넣지 않는다. **생성 조건용 골드 예시**만 둔다.

재생성:

```bash
# 형제 디렉터리에 echobridge-web 이 있을 때
npm run import:irt-exemplars
# 또는
node scripts/import-irt-exemplars.mjs --src path/to/echobridge-web
```

## 1b. 리딩: 레벨별 사전 지정 지문

| 항목 | 내용 |
|------|------|
| 데이터 | `data/reading-passages/passages-by-level.json` (L1–L6 각 5지문) |
| 로더 | `lib/irt/passages.ts` |
| API | `GET /api/passages?level=2&full=1` |
| UI | `LevelPassagePanel` — 레벨 선택 시 지문 체크 (최대 5개, 1지문 1문항) |
| 생성 | reading 도메인은 **고정 지문 원문** 위에서만 문항 생성 (`preset_passages`) |
| CEFR 정렬 | L1 Pre-A1/A1 · L2 A2 · L3 A2–B1 · L4 B1 · L5 B1–B2 · L6 B2 → `manifest.levelAnchors` |

흐름: 학년/레벨 선택 → 지문 프리셋 로드 → AI는 stem·선지만 생성 → 서버가 `passage` 필드를 원문으로 강제 부착.

### 지문 관리 UI + 슬롯 설정

| 경로 | 역할 |
|------|------|
| `/passages` | 레벨별 지문 CRUD (추가/수정/삭제) + questionType 슬롯 편집 |
| `GET/PUT /api/passages/config` | `generation-config.json` 로드/저장 |
| `POST /api/passages/manage` | upsert / delete / reorder |
| `data/reading-passages/generation-config.json` | 레벨별 문항 수·슬롯 기본값 |

진단 화면(`/`)에서도 독해 선택 시 **문항 수**와 **questionType 슬롯**을 세션 단위로 덮어쓸 수 있습니다.

### 지문 reorder + 슬롯 QA

| 기능 | 위치 |
|------|------|
| 지문 순서 ↑↓ | `/passages` 목록 · `POST /api/passages/manage` action=`reorder` |
| 슬롯 QA 리포트 | 생성 직후 `irt.slotQa` · `lib/irt/slot-qa.ts` · `SlotQaReport` UI |

QA는 계획 슬롯(유형·지문 id) vs 생성 문항을 대조해 pass/warn/fail 비율과 표 형태로 보여 줍니다.

## 2. IRT 생성 원리 (프롬프트 + 검증)

3PL:

```
P(θ) = c + (1-c) / (1 + exp(-1.7 · a · (θ - b)))
```

| 규칙 | 구현 |
|------|------|
| 목표 θ | 학년 → GLEAS L1–L6 → `thetaCenter` (`data/irt-exemplars/manifest.json`) |
| CEFR | **지문 팩 CEFR 사다리와 동일** (Pre-A1/A1 … B2). 예전 토플/C1 라벨 폐기 |
| b ≈ θ | 프롬프트 강제 + `B_FAR_FROM_TARGET_THETA` 경고 |
| a ∈ [0.5, 2.5+] | 검증 경고 |
| c ≈ 0.25 (4지) | 검증 경고 |
| 변별 가능한 오답 | 중복 옵션 에러 |
| 차원 균형 (어휘) | D1–D6 비율 할당 후 예시 선택 |
| 리딩 유형 | vocabulary 유형 과다 억제, main_idea/inference 우선 |

**중요:** 생성 `irtSource`는 `ai_prior`다. 실응시 MMLE/EM 전까지 절대 등급 인증에 쓰지 않는다.

## 3. API

### `POST /api/generate-questions`

```json
{
  "grade": "중2",
  "domains": ["vocabulary", "reading"],
  "mode": "irt",
  "mcqOnly": true,
  "includeIrtMeta": true
}
```

- `mode: "legacy"` — 기존 자유 생성
- 응답 `questions` — 기존 채점 UI 호환
- 응답 `irt` — level, targetTheta, item별 a/b/c, validation, bank 버전

### `GET /api/bank`

예시은행 메타 (개수, 레벨 앵커, 학년 매핑).

## 4. 코드 맵

```
lib/irt/types.ts      # 스키마, 레벨 앵커 타입
lib/irt/bank.ts       # exemplar 로드·층화 샘플
lib/irt/validate.ts   # 결정론 검증
lib/irt/generate.ts   # few-shot 프롬프트 + Gemini + 매핑
data/irt-exemplars/   # 정제 표본
scripts/import-irt-exemplars.mjs
```

## 5. 생성 문항 bank + 교사 검수

| 경로 | 역할 |
|------|------|
| `data/generated-bank/items.json` | pending / approved / quarantine 저장 |
| `POST /api/items` | 생성 문항 일괄 저장 |
| `GET /api/items` | 필터 목록 |
| `PATCH /api/items/[id]` | 승인·격리·필드 수정 |
| `POST /api/items/bulk` | 일괄 상태 변경 |
| `/review` | 교사 검수 UI |

홈 화면에서 「bank에 저장」→ `/review`에서 승인/격리.

## 6. Echobridge service export

승인 문항 → echobridge-web 이 읽는 service JSON.

```bash
# API (dev server 실행 중)
curl -X POST http://localhost:3000/api/export/echobridge

# CLI
npm run export:echobridge
```

| 산출 | 경로 | 대응 설치 위치 |
|------|------|----------------|
| 어휘 | `data/exports/echobridge/<ts>/vocab/level-N.service.json` | `echobridge-web/src/data/curated/` |
| 독해 | `.../reading/level-N.service.json` | `echobridge-web/src/data/reading/curated/` |
| 매니페스트 | `EXPORT_MANIFEST.json` | — |

- 문법 영역은 기본 `D5_Usage` vocab item으로 포함.
- short_answer·지문 없는 reading은 skip 목록에 기록.
- **기존 service 파일을 통째로 덮어쓰지 말 것** — merge/append 후 audit.

코드: `lib/irt/export-echobridge.ts`, `POST /api/export/echobridge`, `/review` Export 버튼.

### Safe append-merge into echobridge-web

```bash
# 1) 미리보기 (기본 dry-run, 디스크 변경 없음)
npm run merge:echobridge

# 2) 실제 병합 (수정 전 .bak 백업 생성)
npm run merge:echobridge:apply

# 옵션
node scripts/merge-echobridge-service.mjs --export data/exports/echobridge/<ts> --target ../echobridge-web --levels 2,3 --apply
node scripts/merge-echobridge-service.mjs --vocab-only --apply
node scripts/merge-echobridge-service.mjs --reading-only --dry-run   # dry-run is default
```

| 규칙 | 동작 |
|------|------|
| overwrite 금지 | export 파일로 타깃 전체를 교체하지 않음 |
| id 중복 | item / passage / option id 충돌 시 스킵 |
| 신규 파일 생성 금지 | 타깃 `level-N.service.json` 없으면 스킵 (실수 방지) |
| 백업 | `--apply` 시 `data/exports/merge-backups/<ts>/` 에 복사 |
| 리포트 | `data/exports/merge-reports/merge-*.json` |

스크립트: `scripts/merge-echobridge-service.mjs`

## 7. 로드맵

| Phase | 내용 |
|-------|------|
| ✅ | 예시은행 + IRT 생성 + 검증 + UI 메타 |
| ✅ | JSON bank + approve/save API + 검수 UI |
| ✅ | approved → echobridge service export |
| ✅ | safe append-merge into echobridge curated service |
| ✅ | level-preset reading passages → IRT item generation |
| ✅ | passage admin UI + per-level item/slot config |
| ✅ | passage reorder UI + slot-plan QA report |
| Next | Supabase 영속화 (서버리스) |
| Later | 학원 응시 로그 → empirical a,b 재추정 |

## 8. 면책

이 파이프라인은 **문항 저작 보조**다. 레벨 인증·고부담 배치는 echobridge 실측 캘리브 이후 체계와 연동해야 한다.
