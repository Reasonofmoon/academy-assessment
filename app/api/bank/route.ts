import { NextResponse } from "next/server";
import { bankSummary, getLevelAnchor, getManifest } from "@/lib/irt/bank";
import { GRADE_TO_LEVEL, IRT_LEVELS } from "@/lib/irt/types";

/**
 * GET /api/bank — refined exemplar bank metadata (no full item dump).
 */
export async function GET() {
  try {
    const summary = bankSummary();
    const levels = IRT_LEVELS.map((lv) => ({
      level: lv,
      ...getLevelAnchor(lv),
    }));
    return NextResponse.json({
      ...summary,
      levels,
      gradeToLevel: GRADE_TO_LEVEL,
      irtPrinciples: (getManifest() as { irtPrinciples?: unknown }).irtPrinciples ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "문항 은행 메타데이터를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
