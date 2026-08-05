"use client";

import { useState } from "react";
import Link from "next/link";
import StudentForm from "@/components/StudentForm";
import DomainSelector from "@/components/DomainSelector";
import QuestionList from "@/components/QuestionList";
import ResultReport from "@/components/ResultReport";
import LevelPassagePanel from "@/components/LevelPassagePanel";
import { type SlotQaReportData } from "@/components/SlotQaReport";
import {
  type StudentInfo,
  type Domain,
  type Question,
  type Answers,
  type Evaluation,
} from "@/lib/types";
import { GRADE_TO_LEVEL, type IrtGeneratedItem } from "@/lib/irt/types";

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
  const [irtLevel, setIrtLevel] = useState<number>(1);
  const [passageIds, setPassageIds] = useState<string[]>([]);
  const [readingItemCount, setReadingItemCount] = useState(5);
  const [questionTypeSlots, setQuestionTypeSlots] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  /** IRT generation metadata from refined echobridge exemplars */
  const [irtMeta, setIrtMeta] = useState<{
    level: number;
    targetTheta: number;
    cefr: string;
    bank?: { vocab: number; reading: number; version: string };
    disclaimer?: string;
    items?: IrtGeneratedItem[];
    passagesUsed?: Array<{ id: string; title: string; targetB: number }>;
    readingMode?: string;
    slotPlan?: Array<{ slot: number; passageId: string; questionType: string }>;
    slotQa?: SlotQaReportData | null;
  } | null>(null);

  // Sync default IRT level when grade changes (unless user already picked reading level)
  const readingSelected = domains.includes("reading");

  // 로딩 / 에러 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSaveMsg, setBankSaveMsg] = useState<string | null>(null);
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
      const levelForRequest = readingSelected
        ? irtLevel
        : GRADE_TO_LEVEL[studentInfo.grade];

      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: studentInfo.grade,
          domains,
          mode: "irt",
          level: levelForRequest,
          mcqOnly: true,
          includeIrtMeta: true,
          ...(readingSelected
            ? {
                countsByDomain: { reading: readingItemCount },
                questionTypeSlots: questionTypeSlots.slice(0, readingItemCount),
                ...(passageIds.length > 0
                  ? {
                      passageIds,
                      passagesPerSession: Math.min(3, passageIds.length),
                    }
                  : {}),
              }
            : {}),
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        // 서버가 내려준 사용자 친화 메시지 표시
        throw new Error((data as { error?: string }).error ?? "문제 생성에 실패했습니다.");
      }
      const payload = data as {
        questions: Question[];
        warnings?: string[];
        irt?: {
          level: number;
          targetTheta: number;
          cefr: string;
          bank?: { vocab: number; reading: number; version: string };
          disclaimer?: string;
          items?: IrtGeneratedItem[];
          passagesUsed?: Array<{ id: string; title: string; targetB: number }>;
          readingMode?: string;
          slotPlan?: Array<{
            slot: number;
            passageId: string;
            questionType: string;
          }>;
          slotQa?: SlotQaReportData | null;
          domainErrors?: Array<{ domain: string; message: string }>;
        };
      };
      if (!payload.questions?.length) {
        throw new Error("생성된 문항이 없습니다. 다시 시도해 주세요.");
      }
      setQuestions(payload.questions);
      setIrtMeta(payload.irt ?? null);
      setBankSaveMsg(null);
      setAnswers({}); // 답안 초기화
      setStep("answering");
      // Partial domain failure: still proceed, but surface a non-blocking notice.
      if (payload.warnings?.length) {
        setError(
          `일부 영역 생성에 실패해 나머지 문항만 표시합니다. (${payload.warnings.join(" · ")})`
        );
      }
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
    setIrtMeta(null);
    setBankSaveMsg(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── 생성 문항 → JSON bank (검수 대기) ──
  async function handleSaveToBank() {
    if (!irtMeta?.items?.length) {
      setError("저장할 IRT 문항 메타가 없습니다. IRT 모드로 다시 생성하세요.");
      return;
    }
    setError(null);
    setBankSaveMsg(null);
    setIsSavingBank(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: irtMeta.items,
          status: "pending",
          createdBy: studentInfo.teacher || "teacher",
          grade: studentInfo.grade,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        saved?: number;
        batchId?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "bank 저장 실패");
      setBankSaveMsg(
        `${data.saved}문항을 검수 대기(pending)로 저장했습니다. (${data.batchId})`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setIsSavingBank(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* 상단 타이틀 (인쇄 시 숨김) */}
      <header className="no-print mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary">{ACADEMY_NAME}</h1>
        <p className="mt-1 text-sm text-stone-500">
          IRT 원리 기반 AI 문항 생성 · 정제 예시은행(echobridge) few-shot
        </p>
        <p className="mt-2 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="/review"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            문항 검수
          </Link>
          <Link
            href="/passages"
            className="font-medium text-indigo-800 underline-offset-2 hover:underline"
          >
            지문·슬롯 관리
          </Link>
        </p>
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
          <StudentForm
            value={studentInfo}
            onChange={(info) => {
              setStudentInfo(info);
              // grade → default level when reading not customized yet
              if (!readingSelected) {
                setIrtLevel(GRADE_TO_LEVEL[info.grade]);
              }
            }}
          />
          <DomainSelector
            selected={domains}
            onChange={(next) => {
              setDomains(next);
              if (next.includes("reading") && !domains.includes("reading")) {
                setIrtLevel(GRADE_TO_LEVEL[studentInfo.grade]);
                setPassageIds([]);
              }
            }}
          />
          <LevelPassagePanel
            visible={readingSelected}
            grade={studentInfo.grade}
            level={irtLevel}
            onLevelChange={(lv) => {
              setIrtLevel(lv);
              setPassageIds([]);
            }}
            selectedPassageIds={passageIds}
            onPassageIdsChange={setPassageIds}
            itemsPerReading={readingItemCount}
            onItemsPerReadingChange={setReadingItemCount}
            questionTypeSlots={questionTypeSlots}
            onQuestionTypeSlotsChange={setQuestionTypeSlots}
          />

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
              {isGenerating
                ? "IRT 문항 생성 중 (예시은행 + AI)..."
                : "IRT 원리로 AI 문항 생성"}
            </button>
          </div>
          <p className="no-print text-xs text-stone-500">
            학년 → GLEAS 레벨·목표 θ 매핑 후, 정제된 서비스 문항 예시를 few-shot으로
            넣고 3PL(a,b,c) 타깃에 맞게 생성합니다. 생성 모수는 AI prior이며 실측
            보정 전입니다.
          </p>
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

          {/* Teacher-only: collapsed by default — no IRT/slot QA chrome for students */}
          {irtMeta?.items && irtMeta.items.length > 0 && (
            <details className="no-print group rounded-md border border-stone-200 bg-white text-xs text-stone-600">
              <summary className="cursor-pointer select-none px-3 py-2 text-stone-500 hover:text-stone-700">
                교사 도구
              </summary>
              <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => void handleSaveToBank()}
                  disabled={isSavingBank}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {isSavingBank ? "저장 중…" : "bank에 저장 (검수 대기)"}
                </button>
                <Link
                  href="/review"
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                >
                  검수 화면
                </Link>
                {bankSaveMsg && (
                  <span className="text-emerald-700">{bankSaveMsg}</span>
                )}
              </div>
            </details>
          )}

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
