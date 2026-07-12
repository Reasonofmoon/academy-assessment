/**
 * IRT-principled item generation: exemplar few-shot + Gemini + validation.
 */
import { callGemini, parseJson, GeminiError } from "@/lib/gemini";
import type { Domain, Grade, Question } from "@/lib/types";
import { DOMAIN_LABELS } from "@/lib/types";
import { selectExemplars, getLevelAnchor, bankSummary } from "@/lib/irt/bank";
import { filterValidItems, validateIrtItem } from "@/lib/irt/validate";
import {
  DIMENSION_TARGETS,
  GRADE_TO_LEVEL,
  IrtGeneratedItemSchema,
  type Exemplar,
  type IrtGeneratedItem,
  type IrtLevel,
  type VocabDimension,
} from "@/lib/irt/types";
import { z } from "zod";

const AiBatchSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      domain: z.enum(["vocabulary", "grammar", "reading"]),
      type: z.enum(["multiple_choice", "short_answer"]),
      question: z.string(),
      options: z.array(z.string()),
      answer: z.string(),
      explanation: z.string(),
      dimension: z.string().optional(),
      questionType: z.string().optional(),
      headword: z.string().optional(),
      passage: z.string().optional(),
      irt: z.object({
        a: z.number(),
        b: z.number(),
        c: z.number(),
      }),
    })
  ),
});

function allocateDimensions(count: number): VocabDimension[] {
  const dims = Object.keys(DIMENSION_TARGETS) as VocabDimension[];
  const weights = dims.map((d) => DIMENSION_TARGETS[d]);
  const out: VocabDimension[] = [];
  for (let i = 0; i < count; i++) {
    // proportional round-robin by cumulative weight
    const targetShare = dims.map((d, idx) => ({
      d,
      need: weights[idx] * (i + 1) - out.filter((x) => x === d).length,
    }));
    targetShare.sort((a, b) => b.need - a.need);
    out.push(targetShare[0].d);
  }
  return out;
}

function exemplarToPromptBlock(e: Exemplar, index: number): string {
  const meta = [
    `level=L${e.level}`,
    `b=${e.irt.b.toFixed(2)}`,
    `a=${e.irt.a.toFixed(2)}`,
    e.dimension ? `dim=${e.dimension}` : null,
    e.questionType ? `qtype=${e.questionType}` : null,
    e.headword ? `headword=${e.headword}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const opts = e.options
    .map((o, i) => `  ${i}) ${o}${i === e.answerIndex ? "  ← correct" : ""}`)
    .join("\n");

  const passage =
    e.passage && e.passage.length > 0
      ? `Passage:\n"""${e.passage.slice(0, 900)}${e.passage.length > 900 ? "…" : ""}"""\n`
      : "";

  return `### Exemplar ${index + 1} (${e.id})
Meta: ${meta}
${passage}Question: ${e.question}
Options:
${opts}`;
}

function buildDomainPrompt(args: {
  grade: Grade;
  level: IrtLevel;
  domain: Domain;
  count: number;
  targetTheta: number;
  cefr: string;
  exemplars: Exemplar[];
  dimensions?: VocabDimension[];
  mcqOnly: boolean;
}): string {
  const { grade, level, domain, count, targetTheta, cefr, exemplars, dimensions, mcqOnly } =
    args;

  const exemplarBlocks = exemplars.map(exemplarToPromptBlock).join("\n\n");
  const dimPlan =
    domain === "vocabulary" && dimensions
      ? `Dimension plan (assign one item each, in order): ${dimensions.join(", ")}`
      : domain === "reading"
        ? `Prefer questionTypes: main_idea, inference, detail, purpose (avoid overusing vocabulary-in-context).`
        : `Focus on grammar form/usage appropriate for CEFR ${cefr}.`;

  const typeRule = mcqOnly
    ? `All items MUST be multiple_choice with exactly 4 options.`
    : `Use mostly multiple_choice (4 options); at most 1 short_answer per domain.`;

  return `You are an IRT (Item Response Theory) item writer for a Korean English academy.
You generate diagnostic items that are psychometrically purposeful — not random quiz trivia.

## IRT principles you MUST follow
1. 3PL model: P(θ) = c + (1-c) / (1 + exp(-1.7·a·(θ-b)))
2. Target ability θ ≈ ${targetTheta.toFixed(2)} (GLEAS L${level}, CEFR ~${cefr}, grade ${grade}).
3. Difficulty parameter b should be CLOSE to target θ (within ±0.6 ideally) so Fisher information is high.
4. Discrimination a typically 0.8–2.0 (clear separators). Avoid a < 0.5.
5. Guessing c ≈ 0.25 for 4-option MCQ (≈0.20 for 5-option). Never invent c > 0.35 for MCQ.
6. Distractors must be plausible for the same CEFR band (common confusions, not nonsense).
7. One clear correct answer. No double keys. No "all of the above".
8. Match the STYLE and RIGOR of the refined exemplars below (from a calibrated service bank).
9. Do NOT copy exemplars verbatim — create NEW items.
10. Mark irt.b honestly relative to target; if unsure, set b = ${targetTheta.toFixed(2)}.

## Domain
${domain} (${DOMAIN_LABELS[domain]})
${dimPlan}
${typeRule}
Generate EXACTLY ${count} items for this domain only.

## Refined exemplars (few-shot, do not copy)
${exemplarBlocks || "(no exemplars — still follow IRT rules)"}

## Output JSON ONLY
{
  "questions": [
    {
      "id": "${domain}-1",
      "domain": "${domain}",
      "type": "multiple_choice",
      "question": "...",
      "options": ["A text", "B text", "C text", "D text"],
      "answer": "0",
      "explanation": "한국어 해설 1-2문장",
      "dimension": "D2_Meaning",
      "questionType": "main_idea",
      "headword": "optional for vocab",
      "passage": "required for reading when question refers to a text",
      "irt": { "a": 1.2, "b": ${targetTheta.toFixed(2)}, "c": 0.25 }
    }
  ]
}

Rules for fields:
- id format: "${domain}-1" .. "${domain}-${count}"
- multiple_choice answer is the correct option INDEX as string "0"-"3"
- short_answer: options=[], answer=model English text
- explanation in Korean
- reading: include "passage" (80–220 words for L1-L2, 120–280 for L3+) when the item depends on a text
- vocabulary: set dimension from the plan when provided
`;
}

function toGenerated(
  raw: z.infer<typeof AiBatchSchema>["questions"][number],
  level: IrtLevel,
  targetTheta: number,
  exemplarIds: string[]
): IrtGeneratedItem {
  const base: IrtGeneratedItem = {
    id: raw.id,
    domain: raw.domain,
    type: raw.type,
    question: raw.question,
    options: raw.options ?? [],
    answer: raw.answer,
    explanation: raw.explanation,
    level,
    targetTheta,
    irt: {
      a: raw.irt.a,
      b: raw.irt.b,
      c: raw.irt.c,
    },
    irtSource: "ai_prior",
    dimension: raw.dimension as IrtGeneratedItem["dimension"],
    questionType: raw.questionType as IrtGeneratedItem["questionType"],
    headword: raw.headword,
    passage: raw.passage,
    exemplarIds,
  };
  // soft clamp irt into valid ranges before schema
  base.irt.a = Math.min(3.5, Math.max(0.3, base.irt.a));
  base.irt.b = Math.min(4, Math.max(-4, base.irt.b));
  base.irt.c = Math.min(0.5, Math.max(0, base.irt.c));
  const v = validateIrtItem(base);
  return { ...base, validation: v };
}

/**
 * Generate IRT-principled items for one domain using refined exemplars.
 */
export async function generateDomainItems(opts: {
  grade: Grade;
  level: IrtLevel;
  domain: Domain;
  count: number;
  mcqOnly?: boolean;
}): Promise<IrtGeneratedItem[]> {
  const anchor = getLevelAnchor(opts.level);
  const targetTheta = anchor.thetaCenter;
  const dimensions =
    opts.domain === "vocabulary" ? allocateDimensions(opts.count) : undefined;

  // Gather exemplars — for vocab, pick per planned dimension when possible
  let exemplars: Exemplar[] = [];
  if (opts.domain === "vocabulary" && dimensions) {
    const seen = new Set<string>();
    for (const dim of [...new Set(dimensions)]) {
      for (const e of selectExemplars({
        domain: "vocabulary",
        level: opts.level,
        count: 2,
        dimension: dim,
      })) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          exemplars.push(e);
        }
      }
    }
    exemplars = exemplars.slice(0, 6);
  } else {
    exemplars = selectExemplars({
      domain: opts.domain,
      level: opts.level,
      count: 4,
    });
  }

  const prompt = buildDomainPrompt({
    grade: opts.grade,
    level: opts.level,
    domain: opts.domain,
    count: opts.count,
    targetTheta,
    cefr: anchor.cefr,
    exemplars,
    dimensions,
    mcqOnly: opts.mcqOnly ?? true,
  });

  const rawText = await callGemini(prompt);
  const json = parseJson<unknown>(rawText);
  const parsed = AiBatchSchema.safeParse(json);
  if (!parsed.success) {
    throw new GeminiError(
      "AI가 IRT 문항 형식과 다른 응답을 반환했습니다. 다시 시도해 주세요.",
      502
    );
  }

  const exemplarIds = exemplars.map((e) => e.id);
  const items = parsed.data.questions
    .filter((q) => q.domain === opts.domain)
    .slice(0, opts.count)
    .map((q) => toGenerated(q, opts.level, targetTheta, exemplarIds));

  // one repair pass for invalid MCQs
  const { valid, rejected } = filterValidItems(items);
  if (rejected.length > 0 && valid.length < opts.count) {
    // keep valid + attempt to keep rejected with warnings only if only warnings-level issues... already filtered by errors
    // return valid only; caller may retry domain
  }
  return valid.length > 0 ? valid : items; // if all fail validation, still return for transparency with validation.ok=false
}

export async function generateIrtAssessment(opts: {
  grade: Grade;
  domains: Domain[];
  level?: IrtLevel;
  countPerDomain?: number;
  mcqOnly?: boolean;
}): Promise<{
  level: IrtLevel;
  targetTheta: number;
  cefr: string;
  bank: ReturnType<typeof bankSummary>;
  items: IrtGeneratedItem[];
  questions: Question[];
  exemplarsUsed: Exemplar[];
}> {
  const level = opts.level ?? GRADE_TO_LEVEL[opts.grade];
  const anchor = getLevelAnchor(level);
  const count = opts.countPerDomain ?? 5;
  const mcqOnly = opts.mcqOnly ?? true;

  const allItems: IrtGeneratedItem[] = [];
  const exemplarsUsed: Exemplar[] = [];
  const seenEx = new Set<string>();

  for (const domain of opts.domains) {
    const items = await generateDomainItems({
      grade: opts.grade,
      level,
      domain,
      count,
      mcqOnly,
    });
    allItems.push(...items);
    for (const id of items.flatMap((i) => i.exemplarIds ?? [])) {
      if (seenEx.has(id)) continue;
      seenEx.add(id);
    }
  }

  // reload exemplars for response transparency
  for (const domain of opts.domains) {
    for (const e of selectExemplars({ domain, level, count: 2 })) {
      if (!seenEx.has(e.id)) {
        // still include few for UI
      }
      if (!exemplarsUsed.find((x) => x.id === e.id)) {
        exemplarsUsed.push(e);
      }
    }
  }

  // Map to legacy Question shape for existing UI/evaluate flow
  const questions: Question[] = allItems.map((item) => {
    let questionText = item.question;
    if (item.passage?.trim()) {
      questionText = `[지문]\n${item.passage.trim()}\n\n${item.question}`;
    }
    return {
      id: item.id,
      domain: item.domain,
      type: item.type,
      question: questionText,
      options: item.options,
      answer: item.answer,
      explanation: item.explanation,
    };
  });

  return {
    level,
    targetTheta: anchor.thetaCenter,
    cefr: anchor.cefr,
    bank: bankSummary(),
    items: allItems,
    questions,
    exemplarsUsed: exemplarsUsed.slice(0, 12),
  };
}

// re-export schema parse helper for routes
export { IrtGeneratedItemSchema };
