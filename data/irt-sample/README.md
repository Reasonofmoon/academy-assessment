# IRT sample sandbox (NOT product bank)

이 폴더는 **캘리브레이션 코드 검증용**입니다.

- **제품 문항 bank / curated service / passages-by-level 에 merge 하지 않습니다.**
- 입력: `Dicht_Data2.csv` (Kaggle dichotomous IRT sample)
- 출력: `out/` 아래 프로파일·long format·2PL 추정 결과

## 파일 배치

```
data/irt-sample/Dicht_Data2.csv   ← 사용자가 다운로드해 둠
data/irt-sample/out/              ← 스크립트 산출물 (gitignore 권장)
```

## 실행

```bash
# 전체 파이프라인 (프로파일 → long format → 2PL)
python scripts/irt_sandbox/run_sandbox.py

# 단계별
python scripts/irt_sandbox/profile_dicht.py
python scripts/irt_sandbox/convert_to_cat_responses.py
python scripts/irt_sandbox/estimate_2pl.py

# CSV 없을 때 합성 데이터로 파이프라인 스모크만
python scripts/irt_sandbox/run_sandbox.py --demo
```

## 산출물

| 파일 | 내용 |
|------|------|
| `out/profile_report.json` | 행/열/결측/0-1 비율 |
| `out/profile_report.md` | 사람이 읽는 요약 |
| `out/cat_responses_long.jsonl` | echobridge `cat_responses` 유사 long format |
| `out/response_matrix.npz` 또는 `.json` | 추정용 행렬 메타 |
| `out/item_params_2pl.json` | 문항 a,b (2PL) — **샌드박스 라벨** |
| `out/person_theta.json` | 응시자 θ 추정 |

## 금지

- `data/generated-bank/` 에 쓰지 않음
- `data/reading-passages/` / `data/irt-exemplars/` 덮어쓰지 않음
- echobridge `src/data/curated` merge 하지 않음
