import { z } from "zod";
import { DOMAINS, GRADES } from "@/lib/types";

/** GLEAS-aligned placement levels used by echobridge CAT. */
export const IRT_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type IrtLevel = (typeof IRT_LEVELS)[number];

export const VocabDimensionSchema = z.enum([
  "D1_Form",
  "D2_Meaning",
  "D3_Context",
  "D4_Network",
  "D5_Usage",
  "D6_Cloze",
]);
export type VocabDimension = z.infer<typeof VocabDimensionSchema>;

export const ReadingQuestionTypeSchema = z.enum([
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
]);
export type ReadingQuestionType = z.infer<typeof ReadingQuestionTypeSchema>;

export const IrtParamsSchema = z.object({
  a: z.number().min(0.3).max(3.5),
  b: z.number().min(-4).max(4),
  c: z.number().min(0).max(0.5),
});
export type IrtParams = z.infer<typeof IrtParamsSchema>;

/** Exemplar stored in data/irt-exemplars (refined echobridge service sample). */
export const ExemplarSchema = z.object({
  id: z.string(),
  domain: z.enum(DOMAINS),
  level: z.number().int().min(1).max(6),
  cefr: z.string().optional().nullable(),
  dimension: VocabDimensionSchema.optional(),
  questionType: ReadingQuestionTypeSchema.optional(),
  headword: z.string().optional().nullable(),
  passageId: z.string().optional().nullable(),
  passage: z.string().optional().nullable(),
  wordCount: z.number().optional().nullable(),
  question: z.string(),
  options: z.array(z.string()).min(4),
  answerIndex: z.number().int().min(0).max(9),
  irt: IrtParamsSchema,
  irtSource: z.string().optional(),
  provenance: z.string().optional(),
});
export type Exemplar = z.infer<typeof ExemplarSchema>;

/** AI-generated item with IRT metadata (generation output). */
export const IrtGeneratedItemSchema = z.object({
  id: z.string(),
  domain: z.enum(DOMAINS),
  type: z.enum(["multiple_choice", "short_answer"]),
  question: z.string().min(8),
  options: z.array(z.string()),
  /** MCQ: option index as string; short_answer: model text */
  answer: z.string(),
  explanation: z.string(),
  level: z.number().int().min(1).max(6),
  targetTheta: z.number(),
  irt: IrtParamsSchema,
  irtSource: z.string(),
  dimension: VocabDimensionSchema.optional(),
  questionType: ReadingQuestionTypeSchema.optional(),
  headword: z.string().optional(),
  passage: z.string().optional(),
  /** Exemplar ids that conditioned generation */
  exemplarIds: z.array(z.string()).optional(),
  validation: z
    .object({
      ok: z.boolean(),
      warnings: z.array(z.string()),
      errors: z.array(z.string()),
    })
    .optional(),
});
export type IrtGeneratedItem = z.infer<typeof IrtGeneratedItemSchema>;

export const GenerateIrtRequestSchema = z.object({
  grade: z.enum(GRADES),
  domains: z.array(z.enum(DOMAINS)).min(1),
  /** Override auto level from grade */
  level: z.number().int().min(1).max(6).optional(),
  /** Items per domain (default 5) */
  countPerDomain: z.number().int().min(1).max(10).optional(),
  /** Prefer MCQ-only for IRT bank building (default true) */
  mcqOnly: z.boolean().optional(),
  /** Include raw exemplar samples in response for teacher transparency */
  includeExemplars: z.boolean().optional(),
});
export type GenerateIrtRequest = z.infer<typeof GenerateIrtRequestSchema>;

export const GRADE_TO_LEVEL: Record<(typeof GRADES)[number], IrtLevel> = {
  초3: 1,
  초4: 1,
  초5: 1,
  초6: 1,
  중1: 2,
  중2: 2,
  중3: 3,
  고1: 3,
  고2: 4,
  고3: 4,
};

/** Dimension mix targets (aligned with echobridge DEFAULT_CAT_CONFIG). */
export const DIMENSION_TARGETS: Record<VocabDimension, number> = {
  D1_Form: 0.05,
  D2_Meaning: 0.25,
  D3_Context: 0.2,
  D4_Network: 0.2,
  D5_Usage: 0.1,
  D6_Cloze: 0.2,
};

/** Prefer non-vocabulary reading types when sampling exemplars. */
export const READING_TYPE_PRIORITY: ReadingQuestionType[] = [
  "main_idea",
  "inference",
  "detail",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
];
