import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  loadGenerationConfig,
  saveGenerationConfig,
  type GenerationConfig,
  READING_QUESTION_TYPES,
} from "@/lib/irt/passages";

const QType = z.enum([
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
]);

const LevelSchema = z.object({
  itemsPerReading: z.number().int().min(1).max(10),
  passagesPerSession: z.number().int().min(1).max(5),
  questionTypeSlots: z.array(QType).min(1).max(10),
});

const PutSchema = z.object({
  defaults: z
    .object({
      countPerDomain: z.object({
        vocabulary: z.number().int().min(1).max(10),
        grammar: z.number().int().min(1).max(10),
        reading: z.number().int().min(1).max(10),
      }),
      passagesPerSession: z.number().int().min(1).max(5),
      maxPassagesPerSession: z.number().int().min(1).max(5),
    })
    .optional(),
  levels: z.record(z.string(), LevelSchema).optional(),
});

/** GET /api/passages/config */
export async function GET() {
  return NextResponse.json({
    config: loadGenerationConfig(),
    questionTypes: READING_QUESTION_TYPES,
  });
}

/** PUT /api/passages/config — update generation slot defaults */
export async function PUT(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const current = loadGenerationConfig();
    const next: GenerationConfig = {
      ...current,
      defaults: parsed.data.defaults
        ? { ...current.defaults, ...parsed.data.defaults }
        : current.defaults,
      levels: { ...current.levels },
    };

    if (parsed.data.levels) {
      for (const [k, v] of Object.entries(parsed.data.levels)) {
        next.levels[k] = v;
      }
    }

    const saved = saveGenerationConfig(next);
    return NextResponse.json({ ok: true, config: saved });
  } catch (e) {
    console.error("PUT /api/passages/config", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "설정 저장 실패" },
      { status: 500 }
    );
  }
}
