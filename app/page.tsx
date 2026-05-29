"use client";

import { useState } from "react";
import StudentForm from "@/components/StudentForm";
import DomainSelector from "@/components/DomainSelector";
import QuestionList from "@/components/QuestionList";
import ResultReport from "@/components/ResultReport";
import {
  type StudentInfo,
  type Domain,
  type Question,
  type Answers,
  type Evaluation,
} from "@/lib/types";

// ───────────────────────────────────────────────────────────
// 메인 평가 페이지 (SPA)
//   흐름: setup → answering → result
//   상태(학생정보/영역/문제/답안/결과)를 여기서 모두 관리하고
//   하위 컴포넌트에 props로 내려준다.
//
//   ※ 학원명은 여기서 한 번만 바꾸면 전체에 반영됩니다.
// ───────────────────────────────────────────────────────────
const ACADEMY_NAME = "리드마스터학원";

// 진행 단계 타입
type Step = "setup" | "answering" | "result";

// 오늘 날짜를 YYYY-MM-DD 형식으로 (평가일자 자동 입력용)
function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HomePage() {
  // ── 상태 정의 ──
  const [step, setStep] = useState<Step>("setup");
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    name: "",
    grade: "초3",
    date: todayString(),
    teacher: "",
  });
  const [domains, setDomains] = useState<Domain[]>(["vocabulary"]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  // 로딩 / 에러 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 문제 생성 가능 조건: 이름·강사명 입력 + 영역 1개 이상
  const canGenerate =
    studentInfo.name.trim() !== "" &&
    studentInfo.teacher.trim() !== "" &&
    domains.length > 0;

  // ── 1) AI 문제 생성 ──
  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: studentInfo.grade, domains }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        // 서버가 내려준 사용자 친화 메시지 표시
        throw new Error((data as { error?: string }).error ?? "문제 생성에 실패했습니다.");
      }
      const { questions: qs } = data as { questions: Question[] };
      setQuestions(qs);
      setAnswers({}); // 답안 초기화
      setStep("answering");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  // ── 2) 답안 제출 & AI 평가 ──
  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentInfo, questions, answers }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "평가에 실패했습니다.");
      }
      setEvaluation(data as Evaluation);
      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── 3) 새 평가 시작 (초기화) ──
  function handleReset() {
    setStep("setup");
    setQuestions([]);
    setAnswers({});
    setEvaluation(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* 상단 타이틀 (인쇄 시 숨김) */}
      <header className="no-print mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary">{ACADEMY_NAME}</h1>
        <p className="mt-1 text-sm text-stone-500">AI 영어 학력 진단 평가 도구</p>
      </header>

      {/* 에러 배너 */}
      {error && (
        <div className="no-print mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* ── setup 단계 ── */}
      {step === "setup" && (
        <div className="space-y-6">
          <StudentForm value={studentInfo} onChange={setStudentInfo} />
          <DomainSelector selected={domains} onChange={setDomains} />

          <div className="no-print flex items-center justify-end gap-3">
            {!canGenerate && (
              <span className="text-sm text-stone-500">
                이름·강사명 입력 후 영역을 선택하세요.
              </span>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-primary transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? "AI가 문제 생성 중..." : "AI 문제 자동 생성"}
            </button>
          </div>
        </div>
      )}

      {/* ── answering 단계 ── */}
      {step === "answering" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("setup")}
            className="no-print text-sm text-stone-500 hover:text-primary"
          >
            ← 정보/영역 다시 설정
          </button>
          <QuestionList
            questions={questions}
            answers={answers}
            onAnswerChange={(id, ans) =>
              setAnswers((prev) => ({ ...prev, [id]: ans }))
            }
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* ── result 단계 ── */}
      {step === "result" && evaluation && (
        <ResultReport
          academyName={ACADEMY_NAME}
          studentInfo={studentInfo}
          evaluation={evaluation}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
