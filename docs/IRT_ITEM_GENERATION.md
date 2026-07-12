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

## 2. IRT 생성 원리 (프롬프트 + 검증)

3PL:

```
P(θ) = c + (1-c) / (1 + exp(-1.7 · a · (θ - b)))
```

| 규칙 | 구현 |
|------|------|
| 목표 θ | 학년 → GLEAS L1–L6 → `thetaCenter` |
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

## 6. 로드맵

| Phase | 내용 |
|-------|------|
| ✅ | 예시은행 + IRT 생성 + 검증 + UI 메타 |
| ✅ | JSON bank + approve/save API + 검수 UI |
| Next | Supabase 영속화 (서버리스) |
| Later | 학원 응시 로그 → empirical a,b 재추정 |
| Later | echobridge CAT 풀로 export |

## 7. 면책

이 파이프라인은 **문항 저작 보조**다. 레벨 인증·고부담 배치는 echobridge 실측 캘리브 이후 체계와 연동해야 한다.
