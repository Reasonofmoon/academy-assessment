import { NextResponse } from "next/server";
import { z } from "zod";
import { callGemini, parseJson, GeminiError } from "@/lib/gemini";
import {
  DOMAINS,
  GRADES,
  DOMAIN_LABELS,
  GenerateResponseSchema,
  type Domain,
  type Grade,
} from "@/lib/types";

// ───────────────────────────────────────────────────────────
// POST /api/generate-questions
//   요청: { grade: Grade, domains: Domain[] }
//   응답: { questions: Question[] }  (영역별 5문제씩)
//
//   서버에서만 실행되므로 여기서 Gemini API 키를 안전하게 사용한다.
// ───────────────────────────────────────────────────────────

// 요청 본문 검증 스키마
const RequestSchema = z.object({
  grade: z.enum(GRADES),
  domains: z.array(z.enum(DOMAINS)).min(1, "최소 1개 영역을 선택하세요."),
});

// 학년 → CEFR 레벨 자동 매핑
// (초등=A1~A2, 중등=A2~B1, 고등=B1~B2 로 점진 상승)
const GRADE_TO_CEFR: Record<Grade, string> = {
  "초3": "A1",
  "초4": "A1",
  "초5": "A2",
  "초6": "A2",
  "중1": "A2",
  "중2": "B1",
  "중3": "B1",
  "고1": "B1",
  "고2": "B2",
  "고3": "B2",
};

export async function POST(request: Request) {
  try {
    // 1) 요청 본문 파싱 & 검증
    const body: unknown = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        { status: 400 }
      );
    }
    const { grade, domains } = parsed.data;
    const cefr = GRADE_TO_CEFR[grade];

    // 2) 프롬프트 작성 — JSON 형식 강제
    const prompt = buildPrompt(grade, cefr, domains);

    // 3) Gemini 호출 & JSON 파싱
    const raw = await callGemini(prompt);
    const json = parseJson<unknown>(raw);

    // 4) 응답 검증 (Zod) — 깨진 데이터 차단
    const validated = GenerateResponseSchema.safeParse(json);
    if (!validated.success) {
      throw new GeminiError("AI가 예상과 다른 형식의 문제를 생성했습니다. 다시 시도해 주세요.", 502);
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    // GeminiError는 사용자 친화 메시지를 그대로 전달
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "문제 생성 중 알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 영역별 5문제 생성을 위한 프롬프트 빌더 */
function buildPrompt(grade: Grade, cefr: string, domains: Domain[]): string {
  const domainList = domains
    .map((d) => `- ${d} (${DOMAIN_LABELS[d]})`)
    .join("\n");

  return `You are an expert English assessment designer for a Korean English academy.
Create a diagnostic test for a Korean student in grade "${grade}", targeting CEFR level ${cefr}.

Generate EXACTLY 5 questions for EACH of the following domains:
${domainList}

Rules:
- Mix question types within each domain: roughly 3 multiple-choice ("multiple_choice") and 2 short-answer ("short_answer").
- Multiple-choice questions MUST have exactly 4 options.
- For multiple_choice: "answer" is the index of the correct option as a string ("0", "1", "2", or "3"). "options" has 4 strings.
- For short_answer: "options" is an empty array []. "answer" is the model (ideal) answer text in English.
- "id" must be unique and formatted as "{domain}-{number}", e.g. "vocabulary-1".
- "question" text is in English (this is an English test), but may include brief Korean hints where natural.
- "explanation" is a concise Korean explanation (1-2 sentences) of why the answer is correct.
- Difficulty MUST match CEFR ${cefr}.

Respond with ONLY valid JSON in this exact shape (no markdown, no commentary):
{
  "questions": [
    {
      "id": "vocabulary-1",
      "domain": "vocabulary",
      "type": "multiple_choice",
      "question": "Choose the word that best fits the blank: She felt very ___ after the long trip.",
      "options": ["tired", "tire", "tiring", "tires"],
      "answer": "0",
      "explanation": "형용사 'tired'가 사람의 상태를 나타내므로 정답입니다."
    }
  ]
}`;
}
