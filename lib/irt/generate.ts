/**
 * IRT-principled item generation: exemplar few-shot + Gemini + validation.
 */
import { callGemini, parseJson, GeminiError } from "@/lib/gemini";
import type { Domain, Grade, Question } from "@/lib/types";
import { DOMAIN_LABELS } from "@/lib/types";
import { selectExemplars, getLevelAnchor, bankSummary } from "@/lib/irt/bank";
import { filterValidItems, validateIrtItem } from "@/lib/irt/validate";
import { rebalanceIrtItems } from "@/lib/irt/answer-balance";
import { buildConstructPromptSection } from "@/lib/irt/construct-guide";
import {
  DIMENSION_TARGETS,
  GRADE_TO_LEVEL,
  IrtGeneratedItemSchema,
  type Exemplar,
  type IrtGeneratedItem,
  type IrtLevel,
  type VocabDimension,
} from "@/lib/irt/types";
import {
  getDefaultCountForDomain,
  getLevelGenConfig,
  planReadingItemSlots,
  selectSessionPassages,
  type PresetPassage,
} from "@/lib/irt/passages";
import type { ReadingQuestionType } from "@/lib/irt/types";
import { buildSlotQaReport, type SlotQaReport } from "@/lib/irt/slot-qa";
import { z } from "zod";

const AiBatchSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      domain: z.enum(["vocabulary", "grammar", "reading"]),
      type: z.enum(["multiple_choice", "short_answer"]),
      question: z.string(),
      options: z.array(z.string()),
      // Models sometimes return a numeric index — coerce to string.
      answer: z.union([z.string(), z.number()]).transform((v) => String(v)),
      explanation: z.string().default(""),
      dimension: z.string().optional(),
      questionType: z.string().optional(),
      headword: z.string().optional(),
      passage: z.string().optional(),
      passageId: z.string().optional(),
      irt: z.object({
        a: z.coerce.number(),
        b: z.coerce.number(),
        c: z.coerce.number(),
      }),
    })
  ),
});

function normalizeDomain(raw: unknown, fallback: Domain): Domain {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "vocabulary" || s === "vocab" || s === "어휘") return "vocabulary";
  if (s === "grammar" || s === "문법") return "grammar";
  if (s === "reading" || s === "독해" || s === "read") return "reading";
  return fallback;
}

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => {
    if (typeof o === "string") return o;
    if (o && typeof o === "object") {
      const obj = o as Record<string, unknown>;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.label === "string") return obj.label;
      if (typeof obj.option === "string") return obj.option;
    }
    return String(o ?? "");
  });
}

function normalizeAnswer(raw: unknown, options: string[]): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^\d+$/.test(t)) return t;
    // letter keys A-D
    const letter = t.toUpperCase().match(/^([A-D])$/);
    if (letter) return String(letter[1].charCodeAt(0) - 65);
    const idx = options.findIndex((o) => o.trim() === t);
    if (idx >= 0) return String(idx);
    return t;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.index === "number") return String(obj.index);
  }
  return "0";
}

function normalizeIrt(raw: unknown, targetTheta: number): {
  a: number;
  b: number;
  c: number;
} {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const a = Number(obj.a ?? obj.discrimination ?? 1.2);
  const b = Number(obj.b ?? obj.difficulty ?? targetTheta);
  const c = Number(obj.c ?? obj.guessing ?? 0.25);
  return {
    a: Number.isFinite(a) ? a : 1.2,
    b: Number.isFinite(b) ? b : targetTheta,
    c: Number.isFinite(c) ? c : 0.25,
  };
}

/**
 * Coerce messy Gemini JSON into AiBatchSchema shape before Zod parse.
 * Production 502s often come from slightly off shapes (numeric answer, object options).
 */
function normalizeAiBatch(
  json: unknown,
  domainFallback: Domain,
  targetTheta: number
): unknown {
  if (!json || typeof json !== "object") return json;
  const root = json as Record<string, unknown>;
  const list = Array.isArray(root.questions)
    ? root.questions
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(json)
        ? json
        : null;
  if (!list) return json;

  return {
    questions: list.map((raw, i) => {
      const q =
        raw && typeof raw === "object"
          ? (raw as Record<string, unknown>)
          : {};
      const options = normalizeOptions(q.options);
      const domain = normalizeDomain(q.domain, domainFallback);
      const typeRaw = String(q.type ?? "multiple_choice").toLowerCase();
      const type =
        typeRaw.includes("short") || typeRaw === "sa"
          ? "short_answer"
          : "multiple_choice";
      return {
        id: String(q.id ?? `${domainFallback}-${i + 1}`),
        domain,
        type,
        question: String(q.question ?? q.stem ?? ""),
        options,
        answer: normalizeAnswer(
          q.answer ?? q.answerIndex ?? q.correctIndex,
          options
        ),
        explanation: String(q.explanation ?? q.rationale ?? ""),
        dimension:
          typeof q.dimension === "string" ? q.dimension : undefined,
        questionType:
          typeof q.questionType === "string"
            ? q.questionType
            : typeof q.qtype === "string"
              ? q.qtype
              : undefined,
        headword:
          typeof q.headword === "string" ? q.headword : undefined,
        passage:
          typeof q.passage === "string"
            ? q.passage
            : typeof q.passageText === "string"
              ? q.passageText
              : undefined,
        passageId:
          typeof q.passageId === "string" ? q.passageId : undefined,
        irt: normalizeIrt(q.irt, targetTheta),
      };
    }),
  };
}

function parseAiBatch(
  rawText: string,
  domainFallback: Domain,
  targetTheta: number
): z.infer<typeof AiBatchSchema> {
  const json = parseJson<unknown>(rawText);
  const normalized = normalizeAiBatch(json, domainFallback, targetTheta);
  const parsed = AiBatchSchema.safeParse(normalized);
  if (!parsed.success) {
    console.warn(
      `[generate] schema fail domain=${domainFallback}`,
      parsed.error.issues.slice(0, 5),
      typeof normalized === "object"
        ? JSON.stringify(normalized).slice(0, 400)
        : normalized
    );
    throw new GeminiError(
      `AI가 ${domainFallback} 문항 형식과 다른 응답을 반환했습니다. 다시 시도해 주세요.`,
      502
    );
  }
  if (parsed.data.questions.length === 0) {
    throw new GeminiError(
      `AI가 ${domainFallback} 문항을 비어 있는 배열로 반환했습니다. 다시 시도해 주세요.`,
      502
    );
  }
  return parsed.data;
}

/** Retry domain generation once when model returns unusable JSON shape. */
async function withDomainRetry<T>(
  domain: Domain,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof GeminiError) || e.status !== 502) throw e;
    console.warn(`[generate] domain=${domain} retry after: ${e.message}`);
    return fn();
  }
}

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
    ? `All items MUST be multiple_choice with exactly 4 options (or 5 if specified).`
    : `Use mostly multiple_choice (4 options); at most 1 short_answer per domain.`;

  const constructSection = buildConstructPromptSection(level, domain);

  const vocabRules =
    level <= 2
      ? `VOCABULARY stems MUST be complete — never instruction-only.
- Pattern A (meaning→word): use NEWLINES exactly like this:
  "한글 뜻에 맞는 단어를 고르시오.\\n한글 뜻: <Korean gloss>"
- Pattern B (context): English sentence on the NEXT line after Korean prompt.
- Pattern C (cloze): blank sentence on its own line.
- Always set "headword" to the target English word (correct answer lemma).
- **UNIQUE ANSWER:** distractors must NOT also fit the blank.`
      : `VOCABULARY for mid/high placement (L${level}) — match Korean high-school exam RIGOR (옥길/부천 일반고 내신 어휘 유형 참고), but write ORIGINAL items only.
- Prefer context: "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?" with 2–4 original English sentences and four underlined candidates as options (or mark candidates clearly in the stem).
- Or: cloze / best word in a multi-sentence original context (social/science/school topics).
- Bare "한글 뜻에 맞는 단어를 고르시오" is allowed at most once in the batch for L3+; for L4+ avoid it unless the headword is truly advanced.
- Always set "headword". UNIQUE ANSWER — near-synonym distractors must be wrong in THIS context.`;

  const grammarRules =
    level <= 2
      ? `GRAMMAR: put any example sentence on a new line after the Korean instruction.
Use \\n between prompt and example. Keep options short parallel forms.
- If testing 3rd-person -s / be-verbs, the stem MUST state the tense condition in Korean.
- Do not ask agreement without tense/context constraints.`
      : `GRAMMAR for mid/high placement (L${level}) — match Korean high-school 어법 내신 style (밑줄 오류 찾기 / 어법상 옳은 것), ORIGINAL short paragraphs only (do NOT copy school exams).
- Preferred: "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?" + 2–4 sentence original paragraph; options are the four underlined snippets (or ①–④ forms).
- Or multi-clause form choice (relative clauses, conditionals, participles, inversion, subjunctive, parallel structure).
- FORBIDDEN at L3+: isolated elementary drills like "She ____ a student" / bare is-are without multi-clause context.
- State conditions in Korean when needed. Options must be parallel forms.`;

  return `You are an IRT (Item Response Theory) item writer for a Korean English academy.
You generate LEVEL-PLACEMENT diagnostic items that are psychometrically purposeful — not random quiz trivia.

## IRT principles you MUST follow
1. 3PL model: P(θ) = c + (1-c) / (1 + exp(-1.7·a·(θ-b)))
2. Target ability θ ≈ ${targetTheta.toFixed(2)} (GLEAS L${level}, CEFR ~${cefr}, grade ${grade}).
3. Difficulty parameter b should be CLOSE to target θ (within ±0.6 ideally) so Fisher information is high.
4. Discrimination a typically 0.8–2.0 (clear separators). Avoid a < 0.5.
5. Guessing c ≈ 0.25 for 4-option MCQ (≈0.20 for 5-option). Never invent c > 0.35 for MCQ.
6. Distractors must be plausible for the same CEFR band (common confusions, not nonsense).
7. One clear correct answer. No double keys. No "all of the above".
7b. **ANSWER KEY BALANCE:** Do NOT put every correct answer at index "0". Across this batch, spread correct indices roughly evenly (4 options → about 25% each for "0","1","2","3"; 5 options → about 20% each).
8. Match the STYLE and RIGOR of the refined exemplars below (from a calibrated service bank).
9. Do NOT copy exemplars verbatim — create NEW items.
10. Mark irt.b honestly relative to target; if unsure, set b = ${targetTheta.toFixed(2)}.
11. **LEVEL FIT is mandatory:** items that look elementary while grade is high school MUST be rewritten harder (and vice versa).

## Domain
${domain} (${DOMAIN_LABELS[domain]})
${dimPlan}
${typeRule}
Generate EXACTLY ${count} items for this domain only.

${constructSection}

## Domain-specific stem rules (CRITICAL)
${
  domain === "vocabulary"
    ? vocabRules
    : domain === "grammar"
      ? grammarRules
      : `READING: "question" is stem ONLY (no pasted passage). Use clear Korean or English stems.`
}

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
      "options": ["option text", "option text", "option text", "option text"],
      "answer": "2",
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
- multiple_choice answer is the correct option INDEX as string ("0".."n-1"); vary across items (not all "0")
- short_answer: options=[], answer=model English text
- explanation in Korean
- reading: include "passage" (80–220 words for L1-L2, 120–280 for L3+) when the item depends on a text
- vocabulary: set dimension from the plan when provided; question MUST include \\n line breaks as shown above
`;
}

/** Ensure stems keep display-friendly newlines before validation. */
function normalizeStemNewlines(question: string, domain: Domain): string {
  let q = question.replace(/\r\n/g, "\n").trim();
  if (domain === "vocabulary") {
    q = q.replace(/(고르시오\.?)\s*(한글\s*뜻\s*:)/g, "$1\n$2");
    q = q.replace(/(고르시오\.?)\s+(?=[A-Za-z"'“])/g, "$1\n");
    q = q.replace(/([?？])\s+(?=[A-Za-z"'“])/g, "$1\n");
    q = q.replace(/(것은\?)\s*(?=[A-Za-z])/g, "$1\n");
  }
  return q;
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
    question: normalizeStemNewlines(raw.question, raw.domain),
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
 * Reading: generate IRT items ON TOP OF level-preset passages only.
 * Passage text is fixed; the model must not invent/rewrite passages.
 */
function buildReadingFromPassagesPrompt(args: {
  grade: Grade;
  level: IrtLevel;
  targetTheta: number;
  cefr: string;
  slots: Array<{
    passage: PresetPassage;
    questionType: string;
    slot: number;
  }>;
  styleExemplars: Exemplar[];
}): string {
  const { grade, level, targetTheta, cefr, slots, styleExemplars } = args;

  const passageBlocks = [
    ...new Map(slots.map((s) => [s.passage.id, s.passage])).values(),
  ]
    .map(
      (p, i) => `### FIXED PASSAGE ${i + 1}
id: ${p.id}
title: ${p.title}
level: L${p.level} | CEFR ${p.cefr} | wordCount ${p.wordCount} | preset targetB=${p.targetB}
TEXT (copy EXACTLY into each item.passage field for questions on this passage):
"""
${p.text}
"""`
    )
    .join("\n\n");

  const slotPlan = slots
    .map(
      (s) =>
        `${s.slot}. id=reading-${s.slot} | passageId=${s.passage.id} | questionType=${s.questionType} | target b≈${targetTheta.toFixed(2)} (passage preset b=${s.passage.targetB})`
    )
    .join("\n");

  const styleBlocks = styleExemplars
    .slice(0, 3)
    .map((e, i) => exemplarToPromptBlock(e, i))
    .join("\n\n");

  return `You are an IRT reading-item writer for a Korean English academy (LEVEL PLACEMENT TEST).

## HARD CONSTRAINTS (reading)
1. You MUST write questions ONLY about the FIXED PASSAGES below.
2. Do NOT invent, rewrite, shorten, or translate the passage text.
3. For every item, set "passage" to the EXACT full text of the assigned passage (character-for-character).
4. Set "question" to the stem ONLY (do not paste the passage into "question").
5. All items: type=multiple_choice, exactly 4 options, answer is index "0"-"3".
5b. **Spread correct keys:** across this batch, correct answers should use indices 0/1/2/3 roughly evenly (~25% each). Do NOT set every item's answer to "0".
6. Answers must be uniquely determined by the passage; distractors plausible but wrong.
7. Use the assigned questionType for each slot (main_idea, detail, inference, purpose, attitude).
8. IRT 3PL: target θ ≈ ${targetTheta.toFixed(2)} (GLEAS L${level}, CEFR ~${cefr}, grade ${grade}).
   Set irt.b near θ (±0.5); irt.a in 0.8–2.0; irt.c ≈ 0.25.
9. explanation in Korean (1–2 sentences).
10. Do NOT copy style exemplars verbatim.
11. **LEVEL-TEST UNIQUENESS (critical):**
    - Each slot has its own passageId — write ONLY about that passage.
    - Do NOT write near-duplicate stems across items (no repeated "main idea of the passage" with same options pattern).
    - If questionType is detail/inference/purpose, ask about a **specific fact, reason, or purpose** — not another paraphrase of main idea.
    - Different passages must produce clearly different questions and option sets.

## FIXED PASSAGES
${passageBlocks}

## ITEM SLOT PLAN (generate EXACTLY these ${slots.length} items)
${slotPlan}

## Style exemplars (question craft only — ignore their passages)
${styleBlocks || "(none)"}

## Output JSON ONLY
{
  "questions": [
    {
      "id": "reading-1",
      "domain": "reading",
      "type": "multiple_choice",
      "question": "stem only",
      "options": ["...", "...", "...", "..."],
      "answer": "1",
      "explanation": "한국어 해설",
      "questionType": "main_idea",
      "passage": "EXACT fixed passage text",
      "passageId": "preset-L1-P01",
      "irt": { "a": 1.2, "b": ${targetTheta.toFixed(2)}, "c": 0.25 }
    }
  ]
}`;
}

/** Force correct passage text onto generated reading items by slot/passageId. */
function attachPresetPassages(
  items: IrtGeneratedItem[],
  slots: Array<{ passage: PresetPassage; questionType: string; slot: number }>
): IrtGeneratedItem[] {
  const byId = new Map(slots.map((s) => [s.passage.id, s.passage]));
  return items.map((item, idx) => {
    const slot = slots[idx];
    const rawPid = (item as IrtGeneratedItem & { passageId?: string }).passageId;
    const byField = rawPid ? byId.get(rawPid) : undefined;
    const passage = byField ?? slot?.passage;
    if (!passage) return item;
    // Force planned type + passage so bank/export stay aligned with slot plan.
    // QA still reports if model originally drifted (via notes / warnings).
    const plannedType =
      (slot?.questionType as IrtGeneratedItem["questionType"]) ||
      (item.questionType as IrtGeneratedItem["questionType"]);
    const next: IrtGeneratedItem = {
      ...item,
      domain: "reading",
      passage: passage.text,
      questionType: plannedType,
      exemplarIds: [
        ...new Set([...(item.exemplarIds ?? []), passage.id, slot?.passage.id].filter(Boolean) as string[]),
      ],
      irtSource: "ai_prior_on_preset_passage",
    };
    if (next.question.includes(passage.text.slice(0, 40))) {
      next.question = next.question.replace(passage.text, "").trim();
    }
    next.validation = validateIrtItem(next);
    return next;
  });
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
  passageIds?: string[];
  passagesPerSession?: number;
  questionTypeSlots?: ReadingQuestionType[];
}): Promise<{ items: IrtGeneratedItem[]; passagesUsed: PresetPassage[] }> {
  return withDomainRetry(opts.domain, () => generateDomainItemsOnce(opts));
}

async function generateDomainItemsOnce(opts: {
  grade: Grade;
  level: IrtLevel;
  domain: Domain;
  count: number;
  mcqOnly?: boolean;
  passageIds?: string[];
  passagesPerSession?: number;
  questionTypeSlots?: ReadingQuestionType[];
}): Promise<{ items: IrtGeneratedItem[]; passagesUsed: PresetPassage[] }> {
  const anchor = getLevelAnchor(opts.level);
  const targetTheta = anchor.thetaCenter;
  const levelCfg = getLevelGenConfig(opts.level);

  // ── Reading: preset passages ──
  if (opts.domain === "reading") {
    // Prefer enough unique passages for level-test (one item ↔ one passage when stock allows).
    const desiredPassages = Math.min(
      Math.max(
        opts.passagesPerSession ?? levelCfg.passagesPerSession ?? 2,
        opts.count
      ),
      5
    );
    const passages = selectSessionPassages({
      level: opts.level,
      count: desiredPassages,
      passageIds: opts.passageIds,
    });
    if (passages.length === 0) {
      throw new GeminiError(
        `L${opts.level}에 사전 지정된 리딩 지문이 없습니다. data/reading-passages 를 확인하세요.`,
        500
      );
    }
    const typeSlots =
      opts.questionTypeSlots && opts.questionTypeSlots.length > 0
        ? opts.questionTypeSlots
        : levelCfg.questionTypeSlots;
    const slots = planReadingItemSlots(passages, opts.count, typeSlots);
    const styleExemplars = selectExemplars({
      domain: "reading",
      level: opts.level,
      count: 3,
    });
    const prompt = buildReadingFromPassagesPrompt({
      grade: opts.grade,
      level: opts.level,
      targetTheta,
      cefr: anchor.cefr,
      slots,
      styleExemplars,
    });

    const rawText = await callGemini(prompt);
    const parsed = parseAiBatch(rawText, "reading", targetTheta);

    const exemplarIds = [
      ...styleExemplars.map((e) => e.id),
      ...passages.map((p) => p.id),
    ];
    let items = parsed.questions
      .filter((q) => q.domain === "reading" || q.domain === "vocabulary")
      // Prefer reading; if model mislabeled, still keep stems with passage.
      .map((q) =>
        toGenerated(
          { ...q, domain: "reading" },
          opts.level,
          targetTheta,
          exemplarIds
        )
      )
      .slice(0, opts.count);

    items = attachPresetPassages(items, slots);
    items = rebalanceIrtItems(items, (it) => validateIrtItem(it));
    const { valid } = filterValidItems(items);
    return {
      items: valid.length > 0 ? valid : items,
      passagesUsed: passages,
    };
  }

  // ── Vocab / grammar (unchanged few-shot path) ──
  const dimensions =
    opts.domain === "vocabulary" ? allocateDimensions(opts.count) : undefined;

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
  const parsed = parseAiBatch(rawText, opts.domain, targetTheta);

  const exemplarIds = exemplars.map((e) => e.id);
  // If model mislabels domain, still accept items (force to requested domain).
  let items = parsed.questions
    .slice(0, opts.count)
    .map((q) =>
      toGenerated(
        { ...q, domain: opts.domain },
        opts.level,
        targetTheta,
        exemplarIds
      )
    );

  items = rebalanceIrtItems(items, (it) => validateIrtItem(it));
  const { valid } = filterValidItems(items);
  return {
    items: valid.length > 0 ? valid : items,
    passagesUsed: [],
  };
}

export async function generateIrtAssessment(opts: {
  grade: Grade;
  domains: Domain[];
  level?: IrtLevel;
  countPerDomain?: number;
  /** Per-domain overrides, e.g. { reading: 4, vocabulary: 5 } */
  countsByDomain?: Partial<Record<Domain, number>>;
  mcqOnly?: boolean;
  passageIds?: string[];
  passagesPerSession?: number;
  questionTypeSlots?: ReadingQuestionType[];
}): Promise<{
  level: IrtLevel;
  targetTheta: number;
  cefr: string;
  bank: ReturnType<typeof bankSummary>;
  items: IrtGeneratedItem[];
  questions: Question[];
  exemplarsUsed: Exemplar[];
  passagesUsed: PresetPassage[];
  slotPlan?: Array<{ slot: number; passageId: string; questionType: string }>;
  slotQa?: SlotQaReport | null;
  domainErrors: Array<{ domain: Domain; message: string }>;
}> {
  const level = opts.level ?? GRADE_TO_LEVEL[opts.grade];
  const anchor = getLevelAnchor(level);
  const mcqOnly = opts.mcqOnly ?? true;
  const levelCfg = getLevelGenConfig(level);

  let allItems: IrtGeneratedItem[] = [];
  const exemplarsUsed: Exemplar[] = [];
  const passagesUsed: PresetPassage[] = [];
  const seenEx = new Set<string>();
  const seenPass = new Set<string>();
  const domainErrors: Array<{ domain: Domain; message: string }> = [];
  let slotPlan:
    | Array<{ slot: number; passageId: string; questionType: string }>
    | undefined;

  for (const domain of opts.domains) {
    const count =
      opts.countsByDomain?.[domain] ??
      opts.countPerDomain ??
      getDefaultCountForDomain(domain, level);

    const typeSlots =
      domain === "reading"
        ? opts.questionTypeSlots && opts.questionTypeSlots.length > 0
          ? opts.questionTypeSlots
          : levelCfg.questionTypeSlots
        : undefined;

    try {
      const { items, passagesUsed: used } = await generateDomainItems({
        grade: opts.grade,
        level,
        domain,
        count,
        mcqOnly,
        passageIds: opts.passageIds,
        passagesPerSession:
          opts.passagesPerSession ?? levelCfg.passagesPerSession,
        questionTypeSlots: typeSlots,
      });

      if (domain === "reading" && used.length > 0) {
        const planned = planReadingItemSlots(used, count, typeSlots);
        slotPlan = planned.map((s) => ({
          slot: s.slot,
          passageId: s.passage.id,
          questionType: s.questionType,
        }));
      }
      allItems.push(...items);
      for (const p of used) {
        if (!seenPass.has(p.id)) {
          seenPass.add(p.id);
          passagesUsed.push(p);
        }
      }
      for (const id of items.flatMap((i) => i.exemplarIds ?? [])) {
        if (seenEx.has(id)) continue;
        seenEx.add(id);
      }
    } catch (e) {
      const message =
        e instanceof GeminiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "알 수 없는 생성 오류";
      console.error(`[generate] domain=${domain} failed:`, message);
      domainErrors.push({ domain, message });
    }
  }

  // Only hard-fail when every domain failed (partial success is still useful).
  if (allItems.length === 0) {
    const detail =
      domainErrors.map((d) => `${d.domain}: ${d.message}`).join(" / ") ||
      "생성된 문항이 없습니다.";
    throw new GeminiError(
      `문제 생성에 실패했습니다. ${detail}`,
      502
    );
  }

  // Post-process: spread MCQ correct keys (~1/n each). Models often default to "0".
  allItems = rebalanceIrtItems(allItems, (it) => validateIrtItem(it));

  for (const domain of opts.domains) {
    if (domain === "reading") continue;
    for (const e of selectExemplars({ domain, level, count: 2 })) {
      if (!exemplarsUsed.find((x) => x.id === e.id)) {
        exemplarsUsed.push(e);
      }
    }
  }

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

  const passageTexts = Object.fromEntries(
    passagesUsed.map((p) => [p.id, p.text])
  );
  const slotQa = buildSlotQaReport(slotPlan, allItems, { passageTexts });

  return {
    level,
    targetTheta: anchor.thetaCenter,
    cefr: anchor.cefr,
    bank: bankSummary(),
    items: allItems,
    questions,
    exemplarsUsed: exemplarsUsed.slice(0, 12),
    passagesUsed,
    slotPlan,
    slotQa,
    domainErrors,
  };
}

// re-export schema parse helper for routes
export { IrtGeneratedItemSchema };
