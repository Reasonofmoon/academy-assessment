import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertPassage,
  deletePassage,
  reorderPassages,
  getPassagesForLevel,
  READING_QUESTION_TYPES,
} from "@/lib/irt/passages";
import type { IrtLevel } from "@/lib/irt/types";

const QType = z.enum([
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
]);

const UpsertSchema = z.object({
  action: z.literal("upsert"),
  level: z.number().int().min(1).max(6),
  passage: z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    text: z.string().min(40),
    cefr: z.string().optional(),
    targetB: z.number().optional(),
    source: z.string().optional(),
    suggestedQuestionTypes: z.array(QType).optional(),
    order: z.number().int().optional(),
  }),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  level: z.number().int().min(1).max(6),
  passageId: z.string().min(1),
});

const ReorderSchema = z.object({
  action: z.literal("reorder"),
  level: z.number().int().min(1).max(6),
  orderedIds: z.array(z.string()).min(1),
});

const BodySchema = z.discriminatedUnion("action", [
  UpsertSchema,
  DeleteSchema,
  ReorderSchema,
]);

/**
 * POST /api/passages/manage
 * Teacher CRUD for level-preset passages.
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const level = data.level as IrtLevel;

    if (data.action === "upsert") {
      const passage = upsertPassage(level, data.passage);
      return NextResponse.json({
        ok: true,
        passage,
        passages: getPassagesForLevel(level),
        questionTypes: READING_QUESTION_TYPES,
      });
    }

    if (data.action === "delete") {
      const ok = deletePassage(level, data.passageId);
      if (!ok) {
        return NextResponse.json(
          { error: "지문을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        passages: getPassagesForLevel(level),
      });
    }

    // reorder
    reorderPassages(level, data.orderedIds);
    return NextResponse.json({
      ok: true,
      passages: getPassagesForLevel(level),
    });
  } catch (e) {
    console.error("POST /api/passages/manage", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    );
  }
}
