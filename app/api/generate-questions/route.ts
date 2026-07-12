import { NextResponse } from "next/server";
import { z } from "zod";
import { GeminiError } from "@/lib/gemini";
import {
  DOMAINS,
  GRADES,
  DOMAIN_LABELS,
  GenerateResponseSchema,
  type Domain,
  type Grade,
} from "@/lib/types";
import { generateIrtAssessment } from "@/lib/irt/generate";
import { GRADE_TO_LEVEL, type IrtLevel } from "@/lib/irt/types";
import { callGemini, parseJson } from "@/lib/gemini";

// ───────────────────────────────────────────────────────────
// POST /api/generate-questions
//   Default mode: IRT-principled generation with refined exemplars
//   from echobridge-web curated service sample.
//
//   Body:
//     grade, domains
//     mode?: "irt" | "legacy"   (default "irt")
//     level?: 1-6
//     countPerDomain?: 1-10
//     mcqOnly?: boolean
//     includeIrtMeta?: boolean
// ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  grade: z.enum(GRADES),
  domains: z.array(z.enum(DOMAINS)).min(1, "최소 1개 영역을 선택하세요."),
  mode: z.enum(["irt", "legacy"]).optional(),
  level: z.number().int().min(1).max(6).optional(),
  countPerDomain: z.number().int().min(1).max(10).optional(),
  mcqOnly: z.boolean().optional(),
  includeIrtMeta: z.boolean().optional(),
  /** Optional override: which preset reading passages to use */
  passageIds: z.array(z.string()).optional(),
  /** How many preset passages to load for the session (default from config) */
  passagesPerSession: z.number().int().min(1).max(5).optional(),
  /** Explicit reading questionType order (length = reading item count) */
  questionTypeSlots: z
    .array(
      z.enum([
        "main_idea",
        "detail",
        "inference",
        "purpose",
        "attitude",
        "vocabulary",
        "other",
      ])
    )
    .optional(),
  countsByDomain: z
    .object({
      vocabulary: z.number().int().min(1).max(10).optional(),
      grammar: z.number().int().min(1).max(10).optional(),
      reading: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
});

const GRADE_TO_CEFR: Record<Grade, string> = {
  초3: "A1",
  초4: "A1",
  초5: "A2",
  초6: "A2",
  중1: "A2",
  중2: "B1",
  중3: "B1",
  고1: "B1",
  고2: "B2",
  고3: "B2",
};

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

    const {
      grade,
      domains,
      mode = "irt",
      level,
      countPerDomain,
      mcqOnly,
      includeIrtMeta = true,
      passageIds,
      passagesPerSession,
      questionTypeSlots,
      countsByDomain,
    } = parsed.data;

    if (mode === "legacy") {
      return NextResponse.json(await legacyGenerate(grade, domains));
    }

    const result = await generateIrtAssessment({
      grade,
      domains,
      level: level as IrtLevel | undefined,
      countPerDomain,
      countsByDomain,
      mcqOnly: mcqOnly ?? true,
      passageIds,
      passagesPerSession,
      questionTypeSlots,
    });

    // Always return questions compatible with evaluate + UI
    const response: Record<string, unknown> = {
      questions: result.questions,
    };

    if (includeIrtMeta) {
      response.irt = {
        mode: "irt",
        level: result.level,
        levelName: `L${result.level}`,
        targetTheta: result.targetTheta,
        cefr: result.cefr,
        gradeToLevel: GRADE_TO_LEVEL[grade],
        bank: result.bank,
        /** Full items for save-to-bank (includes stem/options for review). */
        items: result.items,
        /** Level-preset passages used for reading generation */
        passagesUsed: result.passagesUsed.map((p) => ({
          id: p.id,
          title: p.title,
          level: p.level,
          cefr: p.cefr,
          wordCount: p.wordCount,
          targetB: p.targetB,
          textPreview: p.text.slice(0, 160) + (p.text.length > 160 ? "…" : ""),
        })),
        readingMode: "preset_passages",
        slotPlan: result.slotPlan,
        slotQa: result.slotQa,
        disclaimer:
          "생성된 irt a/b/c는 AI prior(휴리스틱)입니다. 실응시 보정 전까지 절대 등급 인증에 사용하지 마세요. 리딩 지문은 레벨 사전 지정 원문을 그대로 사용합니다.",
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("generate-questions", error);
    return NextResponse.json(
      { error: "문제 생성 중 알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** Original free-form Gemini generation (no exemplar bank). */
async function legacyGenerate(grade: Grade, domains: Domain[]) {
  const cefr = GRADE_TO_CEFR[grade];
  const domainList = domains
    .map((d) => `- ${d} (${DOMAIN_LABELS[d]})`)
    .join("\n");

  const prompt = `You are an expert English assessment designer for a Korean English academy.
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

  const raw = await callGemini(prompt);
  const json = parseJson<unknown>(raw);
  const validated = GenerateResponseSchema.safeParse(json);
  if (!validated.success) {
    throw new GeminiError(
      "AI가 예상과 다른 형식의 문제를 생성했습니다. 다시 시도해 주세요.",
      502
    );
  }
  return validated.data;
}
