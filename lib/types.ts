import { z } from "zod";

// ───────────────────────────────────────────────────────────
// 공유 타입 & Zod 스키마
//   - API Route(서버)와 컴포넌트(클라이언트)가 함께 사용한다.
//   - Zod 스키마로 런타임 검증 + TypeScript 타입을 동시에 얻는다. (z.infer)
// ───────────────────────────────────────────────────────────

// 진단 영역 3가지
export const DOMAINS = ["vocabulary", "grammar", "reading"] as const;
export type Domain = (typeof DOMAINS)[number];

// 영역별 한글 라벨 (UI 표시용)
export const DOMAIN_LABELS: Record<Domain, string> = {
  vocabulary: "어휘",
  grammar: "문법",
  reading: "독해",
};

// 학년 옵션 (초1 ~ 고3) — 초1·초2는 GLEAS L1(초등) 배치
export const GRADES = [
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3",
  "고1", "고2", "고3",
] as const;
export type Grade = (typeof GRADES)[number];

// 문제 유형: 객관식(4지선다) 또는 단답형
export const QuestionTypeSchema = z.enum(["multiple_choice", "short_answer"]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

// ── 문제(Question) ──────────────────────────────────────────
// AI가 생성하는 단일 문제 구조.
export const QuestionSchema = z.object({
  id: z.string(),                       // 고유 id (예: "vocabulary-1")
  domain: z.enum(DOMAINS),              // 소속 영역
  type: QuestionTypeSchema,             // 객관식 / 단답형
  question: z.string(),                 // 문제 지문
  // 객관식일 때만 4개의 보기. 단답형이면 빈 배열.
  options: z.array(z.string()),
  // 정답 — 객관식은 보기 인덱스 문자열("0"~"3"), 단답형은 모범답안 텍스트.
  answer: z.string(),
  // 해설 (채점/리포트 표시에 활용)
  explanation: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

// 문제 생성 API 응답
export const GenerateResponseSchema = z.object({
  questions: z.array(QuestionSchema),
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

// ── 학생 정보 ───────────────────────────────────────────────
export const StudentInfoSchema = z.object({
  name: z.string().min(1, "학생 이름을 입력하세요."),
  grade: z.enum(GRADES),
  date: z.string(),       // YYYY-MM-DD (자동 입력)
  teacher: z.string().min(1, "강사명을 입력하세요."),
});
export type StudentInfo = z.infer<typeof StudentInfoSchema>;

// ── 평가 요청 / 응답 ────────────────────────────────────────
// 클라이언트가 제출하는 답안: { 문제id: 학생답안 }
export const AnswersSchema = z.record(z.string(), z.string());
export type Answers = z.infer<typeof AnswersSchema>;

// 영역별 점수
export const DomainScoreSchema = z.object({
  domain: z.enum(DOMAINS),
  correct: z.number(),        // 맞은 문항 수
  total: z.number(),          // 전체 문항 수
  percentage: z.number(),     // 백분율 (0~100)
});
export type DomainScore = z.infer<typeof DomainScoreSchema>;

// 문항별 채점 결과
export const GradedItemSchema = z.object({
  questionId: z.string(),
  isCorrect: z.boolean(),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
});
export type GradedItem = z.infer<typeof GradedItemSchema>;

// 최종 평가 리포트
export const EvaluationSchema = z.object({
  domainScores: z.array(DomainScoreSchema),
  totalPercentage: z.number(),              // 총점 (백분율)
  weakestDomain: z.enum(DOMAINS).nullable(),// 약점 영역 (없으면 null)
  comment: z.string(),                      // AI 진단 코멘트 (5~7줄)
  recommendations: z.array(z.string()),     // 다음 학습 권장 단원 3개
  gradedItems: z.array(GradedItemSchema),   // 문항별 채점 상세
});
export type Evaluation = z.infer<typeof EvaluationSchema>;
