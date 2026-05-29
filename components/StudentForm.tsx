"use client";

import { GRADES, type StudentInfo, type Grade } from "@/lib/types";

// ───────────────────────────────────────────────────────────
// 학생 정보 입력 폼
//   - 이름(text), 학년(select), 평가일자(자동/읽기전용), 강사명(text)
//   - 상태는 부모(page.tsx)가 들고 있고, 이 컴포넌트는 표시 + 변경 알림만 한다.
// ───────────────────────────────────────────────────────────

interface StudentFormProps {
  value: StudentInfo;
  onChange: (info: StudentInfo) => void;
}

export default function StudentForm({ value, onChange }: StudentFormProps) {
  // 공통 입력 스타일
  const inputClass =
    "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "mb-1 block text-sm font-medium text-stone-700";

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-primary">1. 학생 정보</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 학생 이름 */}
        <div>
          <label htmlFor="student-name" className={labelClass}>
            학생 이름
          </label>
          <input
            id="student-name"
            type="text"
            className={inputClass}
            placeholder="예: 홍길동"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>

        {/* 학년 선택 */}
        <div>
          <label htmlFor="student-grade" className={labelClass}>
            학년
          </label>
          <select
            id="student-grade"
            className={inputClass}
            value={value.grade}
            onChange={(e) => onChange({ ...value, grade: e.target.value as Grade })}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* 평가 일자 — 자동(오늘), 읽기 전용 */}
        <div>
          <label htmlFor="assessment-date" className={labelClass}>
            평가 일자
          </label>
          <input
            id="assessment-date"
            type="date"
            className={`${inputClass} bg-stone-50 text-stone-500`}
            value={value.date}
            readOnly
          />
        </div>

        {/* 강사명 */}
        <div>
          <label htmlFor="teacher-name" className={labelClass}>
            평가자 (강사명)
          </label>
          <input
            id="teacher-name"
            type="text"
            className={inputClass}
            placeholder="예: 김선생"
            value={value.teacher}
            onChange={(e) => onChange({ ...value, teacher: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
