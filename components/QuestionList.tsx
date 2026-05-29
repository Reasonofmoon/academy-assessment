"use client";

import {
  DOMAIN_LABELS,
  type Question,
  type Answers,
  type Domain,
} from "@/lib/types";

// ───────────────────────────────────────────────────────────
// 학생 답안 입력 폼
//   - 객관식: 라디오 버튼 (보기 인덱스를 답으로 저장)
//   - 단답형: 텍스트 입력
//   - 영역별로 그룹핑해서 표시
// ───────────────────────────────────────────────────────────

interface QuestionListProps {
  questions: Question[];
  answers: Answers;
  onAnswerChange: (questionId: string, answer: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function QuestionList({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  isSubmitting,
}: QuestionListProps) {
  // 출제된 영역 목록 (순서 유지)
  const domains = Array.from(new Set(questions.map((q) => q.domain))) as Domain[];

  // 전체 문항에 답했는지 체크 (제출 버튼 활성화 조건)
  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim() !== "");

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-primary">3. 답안 작성</h2>

      <div className="space-y-8">
        {domains.map((domain) => {
          const domainQuestions = questions.filter((q) => q.domain === domain);
          return (
            <div key={domain}>
              <h3 className="mb-3 border-l-4 border-accent pl-2 text-base font-semibold text-stone-800">
                {DOMAIN_LABELS[domain]}
              </h3>

              <ol className="space-y-5">
                {domainQuestions.map((q, idx) => (
                  <li key={q.id} className="rounded-md bg-stone-50 p-4">
                    {/* 문제 지문 */}
                    <p className="mb-3 font-medium text-stone-800">
                      <span className="mr-2 text-accent">Q{idx + 1}.</span>
                      {q.question}
                    </p>

                    {/* 객관식: 라디오 / 단답형: 텍스트 */}
                    {q.type === "multiple_choice" ? (
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                          <label
                            key={optIdx}
                            className="flex cursor-pointer items-center gap-2 text-sm text-stone-700"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              className="h-4 w-4 accent-primary"
                              // 라디오 값은 보기 인덱스 문자열 ("0"~"3")
                              checked={answers[q.id] === String(optIdx)}
                              onChange={() => onAnswerChange(q.id, String(optIdx))}
                            />
                            <span>
                              <span className="mr-1 font-semibold">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              {opt}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="답을 입력하세요"
                        value={answers[q.id] ?? ""}
                        onChange={(e) => onAnswerChange(q.id, e.target.value)}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {/* 제출 버튼 */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {!allAnswered && (
          <span className="text-sm text-stone-500">모든 문항에 답해 주세요.</span>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allAnswered || isSubmitting}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "AI 채점 중..." : "제출하고 채점하기"}
        </button>
      </div>
    </section>
  );
}
