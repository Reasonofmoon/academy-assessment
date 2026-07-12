import { NextRequest, NextResponse } from "next/server";
import {
  getLevelGenConfig,
  getPassagesForLevel,
  passageBankMeta,
  selectSessionPassages,
} from "@/lib/irt/passages";
import type { IrtLevel } from "@/lib/irt/types";
import { GRADE_TO_LEVEL } from "@/lib/irt/types";
import { GRADES } from "@/lib/types";

/**
 * GET /api/passages?level=2
 * GET /api/passages?grade=중2&preview=1
 * Lists level-preset reading passages (text truncated unless full=1).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const grade = sp.get("grade");
    let level = Number(sp.get("level") || 0) as IrtLevel | 0;

    if ((!level || level < 1 || level > 6) && grade) {
      if ((GRADES as readonly string[]).includes(grade)) {
        level = GRADE_TO_LEVEL[grade as (typeof GRADES)[number]];
      }
    }
    if (!level || level < 1 || level > 6) {
      return NextResponse.json({
        meta: passageBankMeta(),
        gradeToLevel: GRADE_TO_LEVEL,
      });
    }

    const full = sp.get("full") === "1";
    const previewCount = Number(sp.get("count") || "2");
    const all = getPassagesForLevel(level as IrtLevel);
    const session = selectSessionPassages({
      level: level as IrtLevel,
      count: Number.isFinite(previewCount) ? previewCount : 2,
    });

    const mapP = (p: (typeof all)[0]) => ({
      id: p.id,
      title: p.title,
      level: p.level,
      cefr: p.cefr,
      wordCount: p.wordCount,
      targetB: p.targetB,
      order: p.order,
      suggestedQuestionTypes: p.suggestedQuestionTypes,
      text: full ? p.text : p.text.slice(0, 220) + (p.text.length > 220 ? "…" : ""),
      textLength: p.text.length,
    });

    const gen = getLevelGenConfig(level as IrtLevel);

    return NextResponse.json({
      level,
      total: all.length,
      passages: all.map(mapP),
      sessionDefault: session.map(mapP),
      generation: gen,
      policy: {
        doNotRewritePassage: true,
        generateItemsFromPassageOnly: true,
      },
    });
  } catch (e) {
    console.error("GET /api/passages", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "지문 목록 실패" },
      { status: 500 }
    );
  }
}
