import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportApprovedToEchobridge } from "@/lib/irt/export-echobridge";
import { getBankStats } from "@/lib/irt/bank-store";

const BodySchema = z.object({
  levels: z.array(z.number().int().min(1).max(6)).optional(),
  includeGrammarAsVocab: z.boolean().optional(),
  /** If false, only return JSON payloads stats without writing (still writes by default). */
  writeDisk: z.boolean().optional(),
});

/**
 * POST /api/export/echobridge
 * Export approved bank items into echobridge service-format files under
 * data/exports/echobridge/<timestamp>/.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = BodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 }
      );
    }

    const stats = getBankStats();
    if ((stats.counts.approved ?? 0) === 0) {
      return NextResponse.json(
        {
          error:
            "승인(approved) 문항이 없습니다. /review 에서 먼저 승인하세요.",
          stats,
        },
        { status: 400 }
      );
    }

    const result = exportApprovedToEchobridge({
      levels: parsed.data.levels,
      includeGrammarAsVocab: parsed.data.includeGrammarAsVocab,
      writeDisk: parsed.data.writeDisk ?? true,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      stats,
      // relative path for UI
      outDirRelative: result.outDir.replace(process.cwd(), "").replace(/\\/g, "/"),
    });
  } catch (e) {
    console.error("POST /api/export/echobridge", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export 실패" },
      { status: 500 }
    );
  }
}

/** GET — dry summary of what would export */
export async function GET() {
  const stats = getBankStats();
  return NextResponse.json({
    approved: stats.counts.approved ?? 0,
    pending: stats.counts.pending ?? 0,
    quarantine: stats.counts.quarantine ?? 0,
    hint: "POST /api/export/echobridge to write service JSON files",
  });
}
