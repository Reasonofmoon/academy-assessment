import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BANK_STATUSES,
  bulkUpdateStatus,
  getBankStats,
} from "@/lib/irt/bank-store";

const BulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(BANK_STATUSES),
  reviewedBy: z.string().optional(),
  reviewNote: z.string().optional(),
});

/**
 * POST /api/items/bulk
 * Body: { ids: string[], status: "approved"|"quarantine"|"pending", reviewedBy?, reviewNote? }
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const updated = await bulkUpdateStatus(
      parsed.data.ids,
      parsed.data.status,
      parsed.data.reviewedBy,
      parsed.data.reviewNote
    );

    return NextResponse.json({
      updated,
      stats: getBankStats(),
    });
  } catch (e) {
    console.error("POST /api/items/bulk", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "일괄 처리 실패" },
      { status: 500 }
    );
  }
}
