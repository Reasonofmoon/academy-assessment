#!/usr/bin/env python3
"""
Index local 옥길/부천 지역 학교 영어 시험지 folders for difficulty/style reference.

Copyright: commercial exam body text is NOT copied into the repo.
Only school names, file paths, question_type histograms, and original
construct guidance we write ourselves.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "data" / "school-exam-catalog"
DEFAULT_SOURCE = Path(
    r"C:\Users\sound\Downloads\옥길시험지\옥길시험지\옥길시험지"
)

HIGH_SCHOOLS = {"범박고", "부천고", "부천여고", "소명여고", "소사고", "시온고"}
MID_SCHOOLS = {"범박중", "부일중", "옥길중", "옥길새길중"}

# GLEAS placement construct guide (original — inspired by local exam styles)
CONSTRUCT_BY_LEVEL: dict[str, dict] = {
    "1": {
        "cefr": "Pre-A1/A1",
        "grades": "초1–초6",
        "vocabulary": {
            "allowedFormats": [
                "한글 뜻 → 영어 단어 (basic daily words)",
                "1 short sentence context with blank (eat, run, happy…)",
            ],
            "forbid": ["academic abstract nouns", "SAT-style synonyms only"],
            "lexisBand": "high-frequency elementary words",
            "exampleHeads": ["happy", "run", "apple", "friend", "school"],
        },
        "grammar": {
            "targets": ["be-verbs", "simple present", "a/an/the basic", "in/on/at basic"],
            "formats": ["single-sentence blank", "choose correct form"],
            "forbid": ["inversion", "participle phrases", "subjunctive"],
        },
    },
    "2": {
        "cefr": "A2",
        "grades": "중1–중2",
        "refLocal": "옥길 중학교 내신 난이도 (일반형/문장형)",
        "vocabulary": {
            "allowedFormats": [
                "meaning match (중학 기본 어휘)",
                "sentence cloze with clear single key",
                "simple 영영 풀이 빈칸 (optional)",
            ],
            "lexisBand": "middle-school textbook / basic collocations",
            "exampleHeads": ["arrive", "hobby", "collect", "board game", "helmet"],
        },
        "grammar": {
            "targets": [
                "present simple vs continuous",
                "modals (can/must/should)",
                "prepositions of time",
                "basic comparatives",
            ],
            "formats": ["sentence blank 4-option"],
        },
    },
    "3": {
        "cefr": "A2-B1",
        "grades": "중3–고1",
        "refLocal": "옥길/부천 일반고 1학년 내신 입문 + 중3 지문형",
        "vocabulary": {
            "allowedFormats": [
                "문맥 어휘: 1–2문장 안 빈칸 (동의어 함정)",
                "한글 뜻 매칭은 최대 1문항 (고빈도 abstract 가능: achieve, feature)",
                "NOT pure 초등 뜻풀이",
            ],
            "lexisBand": "high-school entry / 수능 기초 전 단계",
            "preferContextOverGloss": True,
        },
        "grammar": {
            "targets": [
                "S-V agreement (one of the students is…)",
                "relative pronouns (who/which/that/whose)",
                "if-conditionals type 1–2",
                "to-infinitive vs gerund after enjoy/want",
                "passive basic",
            ],
            "formats": [
                "choose grammatically correct form",
                "blank in 1–2 sentences with tense/context stated",
            ],
            "forbid": ["elementary be-verb only", "single word is/are without context"],
        },
    },
    "4": {
        "cefr": "B1",
        "grades": "고2–고3",
        "refLocal": "옥길 지역 일반고(시온고·범박고·부천고·소사고 등) 내신 어법·어휘 유형",
        "vocabulary": {
            "allowedFormats": [
                "문맥상 낱말의 쓰임이 어색한 것 고르기: 짧은 지문(2–4문장) + 밑줄 4개 중 부적절 1개",
                "빈칸 추론형 어휘(문장 1–2개 맥락, 고등 학술/사회 주제)",
                "금지: '한글 뜻: 행복한' 식 초등 뜻풀이 전용 문항",
            ],
            "lexisBand": "high-school midterm 어휘 (context-sensitive near-synonyms)",
            "topics": [
                "education",
                "technology/sharing economy",
                "environment",
                "psychology/habits",
                "culture",
            ],
            "preferContextOverGloss": True,
            "minContextSentences": 2,
        },
        "grammar": {
            "targets": [
                "어법상 틀린 것: 짧은 지문(2–4문장) 안 밑줄 4지 중 오류 1개",
                "participial phrases / reduced relative",
                "subjunctive / wish / as if",
                "inversion (not until, never, only after)",
                "parallel structure",
                "tense sequence / perfect forms",
                "relative clause (including non-restrictive)",
                "verb patterns (insist on -ing, help (to) V)",
            ],
            "formats": [
                "다음 글의 밑줄 친 부분 중 어법상 틀린 것은? + short paragraph",
                "choose correct form in complex sentence (still 4 options)",
            ],
            "styleNote": "한국 일반고 내신 스타일 — 장문 원문 복사 금지, 오리지널 2–4문장 맥락",
            "forbid": [
                "elementary be-verb drills",
                "single isolated present-tense -s without multi-clause context",
            ],
        },
    },
    "5": {
        "cefr": "B1-B2",
        "grades": "고급",
        "refLocal": "일반고 상위 난이도 + 심화 구문",
        "vocabulary": {
            "allowedFormats": [
                "academic context cloze",
                "near-synonym trap in 3-sentence paragraph",
            ],
            "lexisBand": "upper high-school / early academic",
            "preferContextOverGloss": True,
            "minContextSentences": 2,
        },
        "grammar": {
            "targets": [
                "advanced inversion",
                "mixed conditionals",
                "participle absolute / with + N + p.p.",
                "cleft / emphasis",
                "complex relative / what-clauses",
            ],
            "formats": ["error identification in short academic paragraph"],
        },
    },
    "6": {
        "cefr": "B2",
        "grades": "고급+",
        "vocabulary": {
            "allowedFormats": ["dense academic context", "register/nuance discrimination"],
            "lexisBand": "B2 academic / formal prose",
            "preferContextOverGloss": True,
            "minContextSentences": 3,
        },
        "grammar": {
            "targets": [
                "Not until … auxiliary inversion",
                "reduced clauses / free modifiers",
                "nominalization-heavy agreement",
                "advanced subjunctive / hypothetical past",
            ],
            "formats": ["error ID or form choice in formal short paragraph"],
        },
    },
}


def index_exams(source: Path) -> dict:
    schools: list[dict] = []
    if not source.exists():
        return {
            "indexedAt": datetime.now(timezone.utc).isoformat(),
            "sourceRoot": str(source),
            "note": "source not found",
            "schools": [],
        }

    for school_dir in sorted(source.iterdir()):
        if not school_dir.is_dir():
            continue
        name = school_dir.name
        band = (
            "high"
            if name in HIGH_SCHOOLS
            else "middle"
            if name in MID_SCHOOLS
            else "other"
        )
        type_counts: Counter[str] = Counter()
        file_count = 0
        item_count = 0
        files_meta: list[dict] = []
        for jf in sorted(school_dir.rglob("*.json")):
            try:
                data = json.loads(jf.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(data, list):
                continue
            file_count += 1
            item_count += len(data)
            local_types: Counter[str] = Counter()
            for it in data:
                qt = (it.get("question_type") or "unknown").strip()
                type_counts[qt] += 1
                local_types[qt] += 1
            files_meta.append(
                {
                    "name": jf.name,
                    "relativePath": str(jf.relative_to(source)),
                    "itemCount": len(data),
                    "questionTypes": dict(local_types),
                }
            )
        schools.append(
            {
                "school": name,
                "band": band,
                "gleasHint": 4 if band == "high" else 2 if band == "middle" else None,
                "jsonFiles": file_count,
                "itemCount": item_count,
                "questionTypeHistogram": dict(type_counts.most_common()),
                "files": files_meta[:30],
            }
        )

    high_hist: Counter[str] = Counter()
    mid_hist: Counter[str] = Counter()
    for s in schools:
        hist = s.get("questionTypeHistogram") or {}
        target = high_hist if s["band"] == "high" else mid_hist if s["band"] == "middle" else None
        if target is None:
            continue
        for k, v in hist.items():
            target[k] += v

    return {
        "indexedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(source),
        "policy": {
            "copyExamBodyIntoRepo": False,
            "useAsDifficultyReferenceOnly": True,
            "primaryUse": "GLEAS L3–L4 vocab/grammar construct calibration for Korean high-school placement",
        },
        "highSchoolQuestionTypes": dict(high_hist.most_common()),
        "middleSchoolQuestionTypes": dict(mid_hist.most_common()),
        "schools": schools,
    }


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = index_exams(args.source)
    cat_path = OUT_DIR / "okgil-source-catalog.json"
    cat_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    guide_path = OUT_DIR / "construct-by-level.json"
    guide = {
        "version": "1.0.0",
        "description": (
            "Level construct guide for vocabulary/grammar placement items. "
            "L3–L4 calibrated to local Korean high-school exam styles (옥길 지역 일반고) "
            "without copying exam text."
        ),
        "levels": CONSTRUCT_BY_LEVEL,
    }
    guide_path.write_text(
        json.dumps(guide, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"catalog -> {cat_path} schools={len(catalog.get('schools', []))}")
    print(f"guide -> {guide_path}")
    print("high types", catalog.get("highSchoolQuestionTypes"))


if __name__ == "__main__":
    main()
