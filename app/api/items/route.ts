import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BANK_STATUSES,
  listBankItems,
  saveItemsToBank,
  getBankStats,
  type IncomingBankItem,
} from "@/lib/irt/bank-store";
import { IrtGeneratedItemSchema } from "@/lib/irt/types";

/**
 * GET /api/items?status=pending|approved|quarantine|all&domain=&level=&q=&limit=&offset=
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const statusRaw = sp.get("status") ?? "all";
    const status =
      statusRaw === "all" || (BANK_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as "all" | (typeof BANK_STATUSES)[number])
        : "all";
    const domain = sp.get("domain") ?? undefined;
    const levelStr = sp.get("level");
    const level = levelStr ? Number(levelStr) : undefined;
    const q = sp.get("q") ?? undefined;
    const limit = Number(sp.get("limit") ?? "50");
    const offset = Number(sp.get("offset") ?? "0");

    const result = listBankItems({
      status,
      domain,
      level: Number.isFinite(level) ? level : undefined,
      q,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({
      ...result,
      stats: getBankStats(),
    });
  } catch (e) {
    console.error("GET /api/items", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "목록 조회 실패" },
      { status: 500 }
    );
  }
}

const SaveBodySchema = z.object({
  items: z.array(IrtGeneratedItemSchema).min(1),
  status: z.enum(BANK_STATUSES).optional(),
  createdBy: z.string().optional(),
  grade: z.string().optional(),
  batchId: z.string().optional(),
});

/**
 * POST /api/items
 * Body: { items: IrtGeneratedItem[], status?: "pending"|"approved", createdBy?, grade? }
 * Saves generated items into the JSON bank for teacher review.
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = SaveBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const incoming: IncomingBankItem[] = parsed.data.items.map((it) => ({
      id: it.id,
      domain: it.domain,
      type: it.type,
      question: it.question,
      options: it.options,
      answer: it.answer,
      explanation: it.explanation,
      level: it.level,
      targetTheta: it.targetTheta,
      irt: it.irt,
      irtSource: it.irtSource,
      dimension: it.dimension,
      questionType: it.questionType,
      headword: it.headword,
      passage: it.passage,
      exemplarIds: it.exemplarIds,
      validation: it.validation,
      grade: parsed.data.grade,
    }));

    const { saved, batchId } = await saveItemsToBank({
      items: incoming,
      status: parsed.data.status ?? "pending",
      createdBy: parsed.data.createdBy ?? "generator",
      grade: parsed.data.grade,
      batchId: parsed.data.batchId,
    });

    return NextResponse.json({
      saved: saved.length,
      batchId,
      items: saved,
      stats: getBankStats(),
    });
  } catch (e) {
    console.error("POST /api/items", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    );
  }
}
