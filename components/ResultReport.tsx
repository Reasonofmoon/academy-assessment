"use client";

import {
  DOMAIN_LABELS,
  type Evaluation,
  type StudentInfo,
} from "@/lib/types";

// ───────────────────────────────────────────────────────────
// 결과 리포트 (인쇄/PDF 출력 대상)
//   - .print-area 클래스로 인쇄 시 이 영역만 남는다.
//   - 인쇄/다시하기 버튼은 .no-print 로 인쇄에서 제외.
// ───────────────────────────────────────────────────────────

interface ResultReportProps {
  academyName: string;
  studentInfo: StudentInfo;
  evaluation: Evaluation;
  onReset: () => void;
}

export default function ResultReport({
  academyName,
  studentInfo,
  evaluation,
  onReset,
}: ResultReportProps) {
  const { domainScores, totalPercentage, weakestDomain, comment, recommendations } =
    evaluation;

  return (
    <div className="space-y-4">
      {/* ── 화면 전용 액션 버튼 (인쇄 제외) ── */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-stone-600">
          채점이 완료되었습니다. <strong>인쇄</strong> 또는 <strong>PDF 저장</strong>이
          가능합니다.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          >
            인쇄하기
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            새 평가 시작
          </button>
        </div>
      </div>

      {/* PDF 저장 안내 */}
      <p className="no-print text-center text-xs text-stone-500">
        💡 PDF로 저장하려면 <kbd className="rounded border px-1">Ctrl</kbd> +{" "}
        <kbd className="rounded border px-1">P</kbd> → 대상(프린터)을{" "}
        <strong>“PDF로 저장”</strong>으로 선택하세요.
      </p>

      {/* ── 인쇄 대상 리포트 본문 ── */}
      <div className="print-area rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        {/* 헤더: 로고 자리 + 제목 */}
        <header className="avoid-break mb-6 flex items-start justify-between border-b-2 border-primary pb-4">
          <div>
            {/* 학원 로고 자리 — 이미지로 교체 가능 */}
            <div className="mb-1 flex h-12 w-32 items-center justify-center rounded border border-dashed border-stone-300 text-xs text-stone-400">
              학원 로고
            </div>
            <h1 className="text-xl font-bold text-primary">{academyName}</h1>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-stone-800">영어 학력 진단 리포트</h2>
            <p className="text-sm text-stone-500">English Proficiency Diagnostic Report</p>
          </div>
        </header>

        {/* 학생 정보 */}
        <section className="avoid-break mb-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <InfoCell label="학생 이름" value={studentInfo.name} />
          <InfoCell label="학년" value={studentInfo.grade} />
          <InfoCell label="평가 일자" value={studentInfo.date} />
          <InfoCell label="평가자" value={studentInfo.teacher} />
        </section>

        {/* 총점 */}
        <section className="avoid-break mb-6 rounded-md bg-primary/5 p-4 text-center">
          <p className="text-sm text-stone-600">종합 점수 (Total Score)</p>
          <p className="text-4xl font-bold text-primary">{totalPercentage}점</p>
        </section>

        {/* 영역별 점수 막대그래프 (CSS only) */}
        <section className="avoid-break mb-6">
          <h3 className="mb-3 text-base font-bold text-stone-800">영역별 점수</h3>
          <div className="space-y-3">
            {domainScores.map((s) => {
              const isWeak = s.domain === weakestDomain;
              return (
                <div key={s.domain}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-700">
                      {DOMAIN_LABELS[s.domain]}
                      {/* 약점 영역 강조: 색 + 뱃지 (흑백에서도 식별) */}
                      {isWeak && (
                        <span className="ml-2 rounded border border-red-600 px-1.5 py-0.5 text-xs font-bold text-red-600">
                          약점
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        isWeak ? "font-bold text-red-600" : "font-semibold text-stone-700"
                      }
                    >
                      {s.percentage}% ({s.correct}/{s.total})
                    </span>
                  </div>
                  {/* 막대 트랙 */}
                  <div className="h-5 w-full overflow-hidden rounded bg-stone-200">
                    <div
                      // 약점이면 빨강(굵은 테두리), 아니면 골드(accent)
                      className={`h-full rounded ${
                        isWeak
                          ? "border-2 border-red-700 bg-red-500"
                          : "bg-accent"
                      }`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI 진단 코멘트 */}
        <section className="avoid-break mb-6">
          <h3 className="mb-2 text-base font-bold text-stone-800">AI 진단 코멘트</h3>
          <p className="whitespace-pre-line rounded-md border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
            {comment}
          </p>
        </section>

        {/* 다음 학습 권장 단원 */}
        <section className="avoid-break mb-8">
          <h3 className="mb-2 text-base font-bold text-stone-800">다음 학습 권장 단원</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ol>
        </section>

        {/* 강사 사인 자리 */}
        <footer className="avoid-break flex items-end justify-end border-t border-stone-200 pt-6">
          <div className="text-center">
            <div className="mb-1 h-12 w-40 border-b border-stone-400" />
            <p className="text-xs text-stone-500">강사 서명 ({studentInfo.teacher})</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// 학생 정보 셀 (라벨 + 값)
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 p-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="font-semibold text-stone-800">{value || "-"}</p>
    </div>
  );
}
