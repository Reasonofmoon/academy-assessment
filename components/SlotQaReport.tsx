"use client";

export interface SlotQaReportData {
  generatedAt: string;
  readingItemCount: number;
  plannedSlotCount: number;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    missing: number;
    typeMatchRate: number;
    passageMatchRate: number;
    overall: "pass" | "warn" | "fail";
  };
  rows: Array<{
    slot: number;
    plannedPassageId: string;
    plannedQuestionType: string;
    itemId: string | null;
    actualQuestionType: string | null;
    passageOk: boolean;
    typeOk: boolean;
    validationOk: boolean;
    validationErrors?: string[];
    validationWarnings?: string[];
    status: "pass" | "warn" | "fail" | "missing";
    notes: string[];
  }>;
}

const STATUS_STYLE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-900 border-emerald-200",
  warn: "bg-amber-100 text-amber-900 border-amber-200",
  fail: "bg-red-100 text-red-900 border-red-200",
  missing: "bg-stone-200 text-stone-700 border-stone-300",
};

const OVERALL_STYLE: Record<string, string> = {
  pass: "border-emerald-300 bg-emerald-50 text-emerald-950",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  fail: "border-red-300 bg-red-50 text-red-950",
};

interface Props {
  report: SlotQaReportData;
}

export default function SlotQaReport({ report }: Props) {
  const { summary, rows } = report;

  return (
    <section
      className={`no-print rounded-md border p-3 text-xs ${OVERALL_STYLE[summary.overall]}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold">슬롯 QA 리포트</span>
        <span
          className={`rounded border px-1.5 py-0.5 font-semibold uppercase ${STATUS_STYLE[summary.overall]}`}
        >
          {summary.overall}
        </span>
        <span className="text-stone-600">
          pass {summary.pass} · warn {summary.warn} · fail {summary.fail}
          {summary.missing ? ` · missing ${summary.missing}` : ""}
        </span>
        <span className="font-mono text-stone-500">
          type {summary.typeMatchRate}% · passage {summary.passageMatchRate}%
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-black/5 bg-white/70">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-stone-200 text-[11px] text-stone-500">
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">계획 유형</th>
              <th className="px-2 py-1.5">실제 유형</th>
              <th className="px-2 py-1.5">지문</th>
              <th className="px-2 py-1.5">검증</th>
              <th className="px-2 py-1.5">상태</th>
              <th className="px-2 py-1.5">메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slot} className="border-b border-stone-100 align-top">
                <td className="px-2 py-1.5 font-mono">{r.slot}</td>
                <td className="px-2 py-1.5">{r.plannedQuestionType}</td>
                <td className="px-2 py-1.5">
                  {r.actualQuestionType ?? "—"}
                  {r.typeOk ? (
                    <span className="ml-1 text-emerald-600">✓</span>
                  ) : (
                    <span className="ml-1 text-red-600">✗</span>
                  )}
                </td>
                <td className="px-2 py-1.5 font-mono text-[10px]">
                  {r.plannedPassageId}
                  {r.passageOk ? (
                    <span className="ml-1 text-emerald-600">✓</span>
                  ) : (
                    <span className="ml-1 text-red-600">✗</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {r.validationOk
                    ? "ok"
                    : (r.validationErrors ?? []).join(", ") || "fail"}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`rounded border px-1 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="max-w-[200px] px-2 py-1.5 text-stone-600">
                  {r.notes.join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-stone-500">
        계획 슬롯 {report.plannedSlotCount} · 리딩 문항 {report.readingItemCount} ·{" "}
        {report.generatedAt}
      </p>
    </section>
  );
}
