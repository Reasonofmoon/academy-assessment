import { NextResponse } from "next/server";
import { z } from "zod";
import { callGemini, parseJson, GeminiError } from "@/lib/gemini";
import {
  DOMAINS,
  DOMAIN_LABELS,
  QuestionSchema,
  StudentInfoSchema,
  AnswersSchema,
  EvaluationSchema,
  type Domain,
  type Question,
  type Answers,
  type DomainScore,
  type GradedItem,
  type Evaluation,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ───────────────────────────────────────────────────────────
// POST /api/evaluate
//   요청: { studentInfo, questions, answers }
//   응답: Evaluation (영역별 점수 + 총점 + 약점 + AI코멘트 + 권장단원)
//
//   채점 전략 (하이브리드):
//     · 객관식 → 서버에서 결정론적 채점 (보기 인덱스 비교) — AI 불필요, 정확
//     · 단답형 → AI가 의미 기반 채점 (철자/표현 차이 허용)
// ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  studentInfo: StudentInfoSchema,
  questions: z.array(QuestionSchema).min(1),
  answers: AnswersSchema,
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        { status: 400 }
      );
    }
    const { studentInfo, questions, answers } = parsed.data;

    // 1) 객관식 채점 (결정론적) + 단답형 분리
    const gradedItems: GradedItem[] = [];
    const shortAnswerQuestions: Question[] = [];

    for (const q of questions) {
      const studentAnswer = answers[q.id] ?? "";
      if (q.type === "multiple_choice") {
        // 객관식: 학생이 고른 보기 인덱스 == 정답 인덱스
        gradedItems.push({
          questionId: q.id,
          isCorrect: studentAnswer.trim() === q.answer.trim(),
          studentAnswer,
          correctAnswer: q.answer,
        });
      } else {
        // 단답형: 일단 모아서 AI에게 일괄 채점 요청
        shortAnswerQuestions.push(q);
      }
    }

    // 2) 단답형 AI 의미 채점 (단답형 문제가 있을 때만 호출)
    if (shortAnswerQuestions.length > 0) {
      const aiGraded = await gradeShortAnswers(shortAnswerQuestions, answers);
      for (const q of shortAnswerQuestions) {
        gradedItems.push({
          questionId: q.id,
          isCorrect: aiGraded[q.id] ?? false,
          studentAnswer: answers[q.id] ?? "",
          correctAnswer: q.answer,
        });
      }
    }

    // 3) 영역별 점수 / 총점 / 약점 영역 계산
    const domainScores = computeDomainScores(questions, gradedItems);
    const totalCorrect = gradedItems.filter((g) => g.isCorrect).length;
    const totalPercentage = Math.round((totalCorrect / gradedItems.length) * 100);
    const weakestDomain = findWeakestDomain(domainScores);

    // 4) AI 진단 코멘트 + 권장 학습 단원 3개 생성
    const { comment, recommendations } = await generateFeedback(
      studentInfo.grade,
      domainScores,
      totalPercentage,
      weakestDomain
    );

    const evaluation: Evaluation = {
      domainScores,
      totalPercentage,
      weakestDomain,
      comment,
      recommendations,
      gradedItems,
    };

    // 최종 응답도 검증 후 반환
    return NextResponse.json(EvaluationSchema.parse(evaluation));
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "평가 중 알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ── 단답형 의미 채점 ────────────────────────────────────────
/** 단답형 문제들을 AI에게 보내 정답 여부(true/false)를 일괄 판정받는다. */
async function gradeShortAnswers(
  questions: Question[],
  answers: Answers
): Promise<Record<string, boolean>> {
  const items = questions.map((q) => ({
    id: q.id,
    question: q.question,
    modelAnswer: q.answer,
    studentAnswer: answers[q.id] ?? "",
  }));

  const prompt = `You are grading short-answer English test responses for a Korean student.
For each item, decide whether the student's answer is semantically correct compared to the model answer.
Be reasonably lenient: ignore minor spelling, capitalization, or phrasing differences if the meaning is correct.
An empty student answer is incorrect.

Items:
${JSON.stringify(items, null, 2)}

Respond with ONLY valid JSON in this exact shape (no markdown):
{ "results": [ { "id": "grammar-4", "isCorrect": true } ] }`;

  const raw = await callGemini(prompt);
  const json = parseJson<unknown>(raw);

  // 결과 검증
  const schema = z.object({
    results: z.array(z.object({ id: z.string(), isCorrect: z.boolean() })),
  });
  const validated = schema.safeParse(json);
  if (!validated.success) {
    throw new GeminiError("단답형 채점 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.", 502);
  }

  const map: Record<string, boolean> = {};
  for (const r of validated.data.results) {
    map[r.id] = r.isCorrect;
  }
  return map;
}

// ── 영역별 점수 계산 ────────────────────────────────────────
function computeDomainScores(
  questions: Question[],
  gradedItems: GradedItem[]
): DomainScore[] {
  // questionId → 정답여부 빠른 조회 맵
  const correctMap = new Map(gradedItems.map((g) => [g.questionId, g.isCorrect]));

  // 실제 출제된 영역만 집계 (선택하지 않은 영역은 제외)
  const usedDomains = DOMAINS.filter((d) => questions.some((q) => q.domain === d));

  return usedDomains.map((domain): DomainScore => {
    const inDomain = questions.filter((q) => q.domain === domain);
    const correct = inDomain.filter((q) => correctMap.get(q.id)).length;
    const total = inDomain.length;
    return {
      domain,
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

/** 점수가 가장 낮은 영역을 약점으로 판정 (동점이면 첫 번째) */
function findWeakestDomain(scores: DomainScore[]): Domain | null {
  if (scores.length === 0) return null;
  return scores.reduce((min, s) => (s.percentage < min.percentage ? s : min)).domain;
}

// ── AI 진단 코멘트 & 권장 단원 ──────────────────────────────
async function generateFeedback(
  grade: string,
  domainScores: DomainScore[],
  totalPercentage: number,
  weakestDomain: Domain | null
): Promise<{ comment: string; recommendations: string[] }> {
  const scoreSummary = domainScores
    .map((s) => `${DOMAIN_LABELS[s.domain]}: ${s.percentage}% (${s.correct}/${s.total})`)
    .join(", ");
  const weakLabel = weakestDomain ? DOMAIN_LABELS[weakestDomain] : "없음";

  const prompt = `You are an English education consultant at a Korean academy.
Write feedback IN KOREAN for a student's diagnostic test result.

Student grade: ${grade}
Domain scores: ${scoreSummary}
Total score: ${totalPercentage}%
Weakest domain: ${weakLabel}

Tasks:
1) "comment": A diagnostic comment of 5 to 7 sentences in Korean. Encouraging but honest. Mention strengths, the weakest area, and concrete advice.
2) "recommendations": Exactly 3 specific next study units/topics in Korean, focused on improving the weakest area. Each is a short phrase (e.g. "현재완료 시제 집중 연습").

Respond with ONLY valid JSON (no markdown):
{ "comment": "...", "recommendations": ["...", "...", "..."] }`;

  const raw = await callGemini(prompt);
  const json = parseJson<unknown>(raw);

  const schema = z.object({
    comment: z.string(),
    recommendations: z.array(z.string()).min(1),
  });
  const validated = schema.safeParse(json);
  if (!validated.success) {
    throw new GeminiError("피드백 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.", 502);
  }

  // 권장 단원은 정확히 3개로 맞춘다 (모자라면 그대로, 넘치면 3개만)
  return {
    comment: validated.data.comment,
    recommendations: validated.data.recommendations.slice(0, 3),
  };
}
