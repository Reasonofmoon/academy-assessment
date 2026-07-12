import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BANK_STATUSES,
  getBankItem,
  updateBankItem,
  getBankStats,
} from "@/lib/irt/bank-store";
import { IrtParamsSchema } from "@/lib/irt/types";

const PatchSchema = z.object({
  status: z.enum(BANK_STATUSES).optional(),
  reviewNote: z.string().optional(),
  reviewedBy: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  explanation: z.string().optional(),
  irt: IrtParamsSchema.optional(),
});

/**
 * GET /api/items/[id]
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const item = getBankItem(decodeURIComponent(ctx.params.id));
  if (!item) {
    return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ item });
}

/**
 * PATCH /api/items/[id]
 * Approve / quarantine / edit fields.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  try {
    const body: unknown = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const id = decodeURIComponent(ctx.params.id);
    const item = await updateBankItem(id, parsed.data);
    if (!item) {
      return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ item, stats: getBankStats() });
  } catch (e) {
    console.error("PATCH /api/items/[id]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "수정 실패" },
      { status: 500 }
    );
  }
}
