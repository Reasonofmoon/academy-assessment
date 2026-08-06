#!/usr/bin/env python3
"""
Seed original high-school-placement vocabulary/grammar items for GLEAS L3–L6.
Style calibrated to local 일반고 내신 (옥길/부천/시온 등) 어법·어휘 types —
no exam text copied.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BANK = REPO / "data" / "generated-bank" / "items.json"

THETA = {3: 0.25, 4: 1.0, 5: 1.7, 6: 2.4}


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def item(
    *,
    domain: str,
    level: int,
    question: str,
    options: list[str],
    answer: int,
    explanation: str,
    headword: str | None = None,
    dimension: str | None = None,
    idx: int,
    stamp: str,
) -> dict:
    n = len(options)
    return {
        "id": f"{domain}-L{level}-hs-seed-{stamp}-{idx}",
        "domain": domain,
        "type": "multiple_choice",
        "question": question,
        "options": options,
        "answer": str(answer),
        "explanation": explanation,
        "level": level,
        "targetTheta": THETA[level],
        "irt": {
            "a": 1.25,
            "b": THETA[level] + (idx - 2) * 0.05,
            "c": round(1 / n, 2),
        },
        "irtSource": "ai_prior",
        **({"dimension": dimension, "headword": headword} if domain == "vocabulary" else {}),
        "status": "approved",
        "createdAt": now(),
        "updatedAt": now(),
        "createdBy": "seed-hs-okgil-style",
        "reviewedAt": now(),
        "reviewedBy": "seed-hs-okgil-style",
        "reviewNote": "Original HS-style item; 옥길 일반고 내신 유형 참고 (본문 미복사)",
        "batchId": f"hs-seed-{stamp}",
    }


def place(opts: list[str], correct: str, target: int) -> tuple[list[str], int]:
    opts = list(opts)
    if correct not in opts:
        opts[0] = correct
    from_i = opts.index(correct)
    if from_i != target:
        opts[from_i], opts[target] = opts[target], opts[from_i]
    return opts, target


def build_all(stamp: str) -> list[dict]:
    items: list[dict] = []
    i = 0

    def add_v(level: int, q: str, opts: list[str], correct: str, exp: str, head: str, dim: str):
        nonlocal i
        target = i % 4
        o, a = place(opts, correct, target)
        items.append(
            item(
                domain="vocabulary",
                level=level,
                question=q,
                options=o,
                answer=a,
                explanation=exp,
                headword=head,
                dimension=dim,
                idx=i,
                stamp=stamp,
            )
        )
        i += 1

    def add_g(level: int, q: str, opts: list[str], correct: str, exp: str):
        nonlocal i
        target = i % 4
        o, a = place(opts, correct, target)
        items.append(
            item(
                domain="grammar",
                level=level,
                question=q,
                options=o,
                answer=a,
                explanation=exp,
                idx=i,
                stamp=stamp,
            )
        )
        i += 1

    # ── L3 중3·고1 ──
    add_v(
        3,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "After months of practice, the team finally managed to _____ its goal of reaching the finals.",
        ["achieve", "arrive", "borrow", "forget"],
        "achieve",
        "목표를 '달성하다'는 achieve가 문맥에 맞습니다.",
        "achieve",
        "D3_Context",
    )
    add_v(
        3,
        "다음 문장에서 feature의 의미로 가장 알맞은 것은?\n"
        "The new phone has several useful features, including a longer battery life.",
        ["특징, 기능", "얼굴", "미래", "실패"],
        "특징, 기능",
        "제품의 유용한 기능/특징을 가리킵니다.",
        "feature",
        "D2_Meaning",
    )
    add_v(
        3,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Parents often _____ children to read every day because it builds vocabulary.",
        ["encourage", "ignore", "prevent", "punish"],
        "encourage",
        "독서하도록 '격려하다'가 자연스럽습니다.",
        "encourage",
        "D3_Context",
    )
    add_v(
        3,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "If you do not understand the rule, please _____ the teacher for help.",
        ["consult", "confuse", "cancel", "compare"],
        "consult",
        "도움을 구하기 위해 선생님께 '상담하다/문의하다' consult.",
        "consult",
        "D3_Context",
    )
    add_v(
        3,
        "다음 글의 밑줄 친 단어 중 문맥상 쓰임이 어색한 것은?\n"
        "Many students join clubs to (A) expand their interests. Clubs also help them (B) build friendships. "
        "However, joining too many clubs can (C) improve their free time until they feel tired. "
        "Wise students (D) balance activities and rest.",
        ["expand", "build", "improve", "balance"],
        "improve",
        "free time을 줄이는 상황이면 reduce/limit이 맞고 improve는 부적절합니다.",
        "reduce",
        "D3_Context",
    )
    add_v(
        3,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The museum will _____ a special exhibition on local history next month.",
        ["host", "hide", "harm", "hesitate"],
        "host",
        "전시회를 '개최하다' host가 적절합니다.",
        "host",
        "D3_Context",
    )

    add_g(
        3,
        "다음 빈칸에 어법상 알맞은 것은?\n"
        "One of the students _____ already finished the assignment.",
        ["has", "have", "having", "are"],
        "has",
        "one of + 복수명사 뒤 동사는 단수 has.",
    )
    add_g(
        3,
        "다음 빈칸에 알맞은 관계대명사는?\n"
        "This is the teacher _____ class I enjoyed the most last year.",
        ["whose", "who", "which", "where"],
        "whose",
        "소유 관계 whose class.",
    )
    add_g(
        3,
        "다음 빈칸에 알맞은 것은?\n"
        "If it _____ tomorrow, we will cancel the picnic.",
        ["rains", "rained", "will rain", "would rain"],
        "rains",
        "1조건문 if + 현재, will.",
    )
    add_g(
        3,
        "다음 빈칸에 알맞은 것은?\n"
        "She enjoys _____ novels before going to bed.",
        ["reading", "read", "to reading", "reads"],
        "reading",
        "enjoy + V-ing.",
    )
    add_g(
        3,
        "다음 빈칸에 알맞은 것은?\n"
        "The windows _____ by the students every Friday.",
        ["are cleaned", "clean", "cleaned", "are cleaning"],
        "are cleaned",
        "수동태 are cleaned.",
    )
    add_g(
        3,
        "다음 글의 밑줄 친 부분 중 어법상 틀린 것은?\n"
        "The book (A) that I borrowed yesterday (B) were on the desk, but now it (C) is missing. "
        "I (D) need to find it before class.",
        ["that I borrowed yesterday", "were", "is", "need"],
        "were",
        "주어 the book은 단수이므로 was가 맞습니다.",
    )

    # ── L4 고2–고3 (옥길 일반고 어법·어휘 유형) ──
    add_v(
        4,
        "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?\n"
        "Cities introduce shared bikes to (A) ease traffic and pollution. Riders can (B) unlock a bike with an app "
        "and leave it at another station. This system (C) weakens convenience for short trips across downtown. "
        "Still, some people (D) hesitate because of safety concerns.",
        ["ease", "unlock", "weakens", "hesitate"],
        "weakens",
        "편의성을 높이는 맥락이므로 weakens가 아니라 increases/improves 등이 맞습니다.",
        "improve",
        "D3_Context",
    )
    add_v(
        4,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Online platforms collect vast amounts of data about users. Without clear rules, this practice may _____ privacy.\n"
        "That is why lawmakers debate new regulations.",
        ["threaten", "decorate", "celebrate", "translate"],
        "threaten",
        "사생활 보호를 '위협할 수 있다' threaten.",
        "threaten",
        "D3_Context",
    )
    add_v(
        4,
        "다음 글의 밑줄 친 부분 중, 문맥상 쓰임이 적절하지 않은 것은?\n"
        "Regular sleep helps the brain (A) consolidate memories. Students who stay up late often (B) struggle "
        "the next day. Surprisingly, short naps can (C) impair attention after long study sessions. "
        "Teachers therefore (D) recommend consistent bedtimes.",
        ["consolidate", "struggle", "impair", "recommend"],
        "impair",
        "짧은 낮잠이 주의력을 해친다는 것은 문맥상 어색하고, 오히려 improve/restore가 자연스럽습니다.",
        "improve",
        "D3_Context",
    )
    add_v(
        4,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The charity's campaign aims to _____ public awareness of food waste.\n"
        "Posters, school talks, and short videos all support that goal.",
        ["raise", "raise up", "arise", "rose"],
        "raise",
        "awareness를 raise. arise/rose는 비문 또는 의미 불일치.",
        "raise",
        "D5_Usage",
    )
    add_v(
        4,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Although the plan looked simple, putting it into practice proved more _____ than expected.\n"
        "Teams needed extra training and tools.",
        ["demanding", "decorative", "identical", "optional"],
        "demanding",
        "실행이 예상보다 '까다로운/힘든' demanding.",
        "demanding",
        "D3_Context",
    )
    add_v(
        4,
        "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?\n"
        "Local shops (A) benefit when more people walk downtown. Clean sidewalks (B) attract visitors "
        "and support small businesses. Closing the main street to cars may (C) discourage noise and accidents. "
        "Residents hope the change will (D) revitalize the area.",
        ["benefit", "attract", "discourage", "revitalize"],
        "discourage",
        "소음·사고를 줄인다는 맥락이면 reduce가 맞고 discourage noise는 어색합니다.",
        "reduce",
        "D3_Context",
    )

    add_g(
        4,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "The committee (A) has announced its decision, which (B) surprise many teachers. "
        "The policy (C) adopted last week (D) will take effect in March.",
        ["has announced", "surprise", "adopted", "will take"],
        "surprise",
        "which의 선행사가 decision이므로 surprises가 맞습니다.",
    )
    add_g(
        4,
        "다음 빈칸에 어법상 알맞은 것은?\n"
        "Not until the final whistle _____ the fans leave their seats.",
        ["did", "do", "had", "were"],
        "did",
        "Not until 도치: Not until ... did + S + V.",
    )
    add_g(
        4,
        "다음 빈칸에 알맞은 것은?\n"
        "If I _____ more careful, I would not have lost the file.",
        ["had been", "was", "have been", "would be"],
        "had been",
        "가정법 과거완료: If + had p.p., would have p.p.",
    )
    add_g(
        4,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "Walking through the park, (A) a strange noise was heard by Mina. "
        "She (B) stopped and (C) looked around, but nothing (D) seemed unusual.",
        ["a strange noise was heard by Mina", "stopped", "looked", "seemed"],
        "a strange noise was heard by Mina",
        "분사구문의 의미상 주어가 Mina여야 하므로 Hearing a strange noise, Mina... 형태가 맞습니다.",
    )
    add_g(
        4,
        "다음 빈칸에 알맞은 것은?\n"
        "She insisted on _____ the document before the meeting.",
        ["reviewing", "review", "to review", "reviewed"],
        "reviewing",
        "insist on + V-ing.",
    )
    add_g(
        4,
        "다음 빈칸에 알맞은 것은?\n"
        "The data collected last year _____ still useful for our research.",
        ["is", "are", "were", "have"],
        "is",
        "주어 data를 단수 취급하는 학술 문맥(집합) 또는 The data ... is; 여기선 collected가 수식. "
        "실제 정답은 주어 'The data collected last year'를 단수로 보는 is (현대 학술 영어에서 data 단수 빈번).",
    )

    # ── L5 ──
    add_v(
        5,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "New taxes may _____ investment if companies expect lower profits.\n"
        "Policymakers must weigh short-term revenue against long-term growth.",
        ["discourage", "decorate", "illustrate", "memorize"],
        "discourage",
        "투자를 위축/저해하다 discourage.",
        "discourage",
        "D3_Context",
    )
    add_v(
        5,
        "다음 글의 밑줄 친 부분 중, 문맥상 쓰임이 적절하지 않은 것은?\n"
        "Transparent rules can (A) foster trust between citizens and government. "
        "Hidden procedures often (B) fuel suspicion. "
        "When officials (C) obscure key documents, public debate becomes healthier. "
        "Open data portals (D) enable independent checks.",
        ["foster", "fuel", "obscure", "enable"],
        "obscure",
        "문서를 숨기면 토론이 건강해진다는 흐름이 모순이므로 obscure가 아니라 release/share 등이 맞습니다.",
        "release",
        "D3_Context",
    )
    add_v(
        5,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The study tries to _____ the gap between laboratory results and real-world behavior.\n"
        "Field experiments provide one possible bridge.",
        ["bridge", "break", "bury", "borrow"],
        "bridge",
        "간극을 '메우다/연결하다' bridge the gap.",
        "bridge",
        "D3_Context",
    )
    add_v(
        5,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Critics argue that the advertisement _____ consumers by hiding important costs.",
        ["misleads", "motivates", "measures", "mentions"],
        "misleads",
        "중요한 비용을 숨겨 소비자를 '오도한다' misleads.",
        "mislead",
        "D2_Meaning",
    )
    add_v(
        5,
        "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?\n"
        "Urban farms can (A) supplement local food supplies. They also (B) strengthen community ties. "
        "However, without training, volunteers may (C) enhance crops through poor watering. "
        "Workshops help participants (D) avoid such mistakes.",
        ["supplement", "strengthen", "enhance", "avoid"],
        "enhance",
        "잘못된 물주기로 작물을 해치는 맥락이면 damage/harm이지 enhance가 아닙니다.",
        "damage",
        "D3_Context",
    )
    add_v(
        5,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The committee refused to _____ the proposal until more evidence was provided.",
        ["endorse", "endure", "enroll", "enlarge"],
        "endorse",
        "제안(안)을 '지지/승인하다' endorse.",
        "endorse",
        "D2_Meaning",
    )

    add_g(
        5,
        "다음 빈칸에 어법상 알맞은 것은?\n"
        "Had the warning been issued earlier, many accidents _____.",
        ["could have been prevented", "could be prevented", "can prevent", "were prevented"],
        "could have been prevented",
        "가정법 과거완료 수동: could have been prevented.",
    )
    add_g(
        5,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "Only after the report (A) was published (B) did the public (C) understanding the scale of the problem, "
        "which (D) had been hidden for years.",
        ["was published", "did", "understanding", "had been hidden"],
        "understanding",
        "did 뒤 동사원형 understand.",
    )
    add_g(
        5,
        "다음 빈칸에 알맞은 것은?\n"
        "She speaks as if she _____ the country for decades, though she moved here last year.",
        ["had known", "knows", "has been knowing", "will know"],
        "had known",
        "as if + 가정법(실제와 반대) had known.",
    )
    add_g(
        5,
        "다음 빈칸에 알맞은 것은?\n"
        "The proposal _____ by experts last month is now under review.",
        ["examined", "examining", "was examined", "has examined"],
        "examined",
        "과거분사 형용사적 용법 the proposal examined by experts.",
    )
    add_g(
        5,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "What (A) makes the plan unique (B) are its focus on prevention rather than punishment, "
        "and the way it (C) involves local schools. Many cities (D) have adopted similar models.",
        ["makes", "are", "involves", "have adopted"],
        "are",
        "What makes ... 는 단수 취급 → is.",
    )
    add_g(
        5,
        "다음 빈칸에 알맞은 것은?\n"
        "Never before _____ such detailed maps of the ocean floor been available to students.",
        ["have", "has", "had", "having"],
        "have",
        "Never before 도치 + 복수 maps → have ... been.",
    )

    # ── L6 ──
    add_v(
        6,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "The author argues that popularity can _____ genuine merit in cultural markets.\n"
        "Early attention snowballs, so weaker works may outsell stronger ones.",
        ["overshadow", "outline", "overflow", "overlooked"],
        "overshadow",
        "진정한 가치를 '가릴 수 있다' overshadow.",
        "overshadow",
        "D3_Context",
    )
    add_v(
        6,
        "다음 글의 밑줄 친 부분 중, 문맥상 쓰임이 적절하지 않은 것은?\n"
        "Independent archives (A) preserve voices that official records ignore. "
        "Volunteers (B) transcribe interviews carefully. "
        "Yet memory is selective, so historians must (C) discard every personal story as absolute fact. "
        "Cross-checking with documents (D) remains essential.",
        ["preserve", "transcribe", "discard", "remains"],
        "discard",
        "개인 서사를 절대 사실로 '채택'하면 안 된다는 맥락이면 treat/accept with caution이지 discard every story가 아닙니다. "
        "문장 의미가 '모든 개인 서사를 절대 사실로 받아들여서는 안 된다'여야 하므로 discard는 부적절하고 treat 등이 맞습니다.",
        "treat",
        "D3_Context",
    )
    add_v(
        6,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Framing a medical risk as '90 percent survival' rather than '10 percent mortality' can _____ patient choices "
        "even when the numbers are identical.",
        ["sway", "sew", "sow only seeds", "swipe"],
        "sway",
        "선택의 방향을 '좌우하다' sway.",
        "sway",
        "D3_Context",
    )
    add_v(
        6,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Environmental repair is slow; each generation must _____ what the previous generation claimed to fix.",
        ["reassess", "reassure", "reassign", "relocate"],
        "reassess",
        "이전 세대의 성과를 다시 '평가/점검하다' reassess.",
        "reassess",
        "D2_Meaning",
    )
    add_v(
        6,
        "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?\n"
        "Digital tracking of students may (A) improve attendance records. Supporters say lost children can be found faster. "
        "Critics warn that constant monitoring can (B) normalize surveillance. "
        "A delayed pilot and privacy review can (C) eliminate the need for any public debate. "
        "Parents still ask who stores the data and for how long (D) it remains accessible.",
        ["improve", "normalize", "eliminate", "remains"],
        "eliminate",
        "지연·검토는 토론을 없애는 것이 아니라 오히려 신중 논의를 전제로 하므로 eliminate the need for debate가 부적절합니다.",
        "prompt",
        "D3_Context",
    )
    add_v(
        6,
        "다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        "Because early attention can grow into a large sales gap, predicting cultural hits remains highly _____.",
        ["uncertain", "uniform", "unlocked", "unpaid"],
        "uncertain",
        "예측이 '불확실하다' uncertain.",
        "uncertain",
        "D2_Meaning",
    )

    add_g(
        6,
        "다음 빈칸에 어법상 알맞은 것은?\n"
        "Not until the privacy report was released _____ the city postpone the tracking pilot.",
        ["did", "does", "had", "was"],
        "did",
        "Not until ... did + S + V.",
    )
    add_g(
        6,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "The findings, (A) published after three years of fieldwork, (B) suggests that small framing changes "
        "(C) can alter decisions. Researchers (D) urge clearer communication standards.",
        ["published", "suggests", "can alter", "urge"],
        "suggests",
        "주어 The findings는 복수 → suggest.",
    )
    add_g(
        6,
        "다음 빈칸에 알맞은 것은?\n"
        "_____ the risks fully, the council would not have approved the project so quickly.",
        ["Had they understood", "If they understand", "Did they understand", "Understanding they had"],
        "Had they understood",
        "가정법 과거완료 도치: Had they understood = If they had understood.",
    )
    add_g(
        6,
        "다음 빈칸에 알맞은 것은?\n"
        "The archive offers many unfinished accounts, which, the directors argue, _____ closer to historical truth "
        "than a single polished narrative.",
        ["are", "is", "was", "has been"],
        "are",
        "선행사 accounts 복수 → are.",
    )
    add_g(
        6,
        "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?\n"
        "What the market amplifies (A) is attention, not necessarily merit, and this pattern (B) help explain "
        "why strong works may remain little known. Critics (C) therefore separate craft from visibility "
        "when they (D) teach media literacy.",
        ["is", "help", "therefore separate", "teach"],
        "help",
        "주어 this pattern 단수 → helps.",
    )
    add_g(
        6,
        "다음 빈칸에 알맞은 것은?\n"
        "The volunteers spent months transcribing interviews, _____ accents and painful silences alike.",
        ["preserving", "preserve", "preserved", "to preserving"],
        "preserving",
        "분사구문(동시/부대 상황) preserving.",
    )

    return items


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%y%m%d%H%M")
    new_items = build_all(stamp)
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    # remove previous hs-seed approved for L3-6 vocab/grammar to avoid dupes on re-run
    kept = []
    removed = 0
    for it in bank.get("items", []):
        if (
            it.get("domain") in ("vocabulary", "grammar")
            and it.get("level") in (3, 4, 5, 6)
            and it.get("status") == "approved"
            and str(it.get("createdBy", "")).startswith("seed-hs")
        ):
            removed += 1
            continue
        kept.append(it)
    kept.extend(new_items)
    bank["items"] = kept
    bank["updatedAt"] = now()
    BANK.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # summary
    from collections import Counter

    ap = [
        i
        for i in bank["items"]
        if i["status"] == "approved" and i["domain"] in ("vocabulary", "grammar")
    ]
    print(
        json.dumps(
            {
                "seeded": len(new_items),
                "removed_old_seeds": removed,
                "approved_by_level": {
                    f"L{lv}-{dom}": sum(
                        1 for i in ap if i["level"] == lv and i["domain"] == dom
                    )
                    for lv in (3, 4, 5, 6)
                    for dom in ("vocabulary", "grammar")
                },
                "answer_hist": dict(Counter(i["answer"] for i in new_items)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
