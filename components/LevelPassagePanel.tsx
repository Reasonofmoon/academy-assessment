"use client";

import { useEffect, useState } from "react";
import type { Grade } from "@/lib/types";
import { GRADE_TO_LEVEL, LEVEL_GRADE_HINT } from "@/lib/irt/types";

export interface PassagePreview {
  id: string;
  title: string;
  level: number;
  cefr: string;
  wordCount: number;
  targetB: number;
  text: string;
  order?: number;
}

export interface LevelGenConfig {
  itemsPerReading: number;
  passagesPerSession: number;
  questionTypeSlots: string[];
}

interface LevelPassagePanelProps {
  grade: Grade;
  level: number;
  onLevelChange: (level: number) => void;
  selectedPassageIds: string[];
  onPassageIdsChange: (ids: string[]) => void;
  /** Session overrides */
  itemsPerReading: number;
  onItemsPerReadingChange: (n: number) => void;
  questionTypeSlots: string[];
  onQuestionTypeSlotsChange: (slots: string[]) => void;
  visible: boolean;
  /** When true, grade always drives the GLEAS level (recommended for placement). */
  lockLevelToGrade?: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "L1 초등 · Pre-A1/A1",
  2: "L2 중학 · A2",
  3: "L3 중3·고1 · A2–B1",
  4: "L4 고2–고3 · B1",
  5: "L5 고급 · B1–B2",
  6: "L6 고급 · B2",
};

const QTYPES = [
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
];

export default function LevelPassagePanel({
  grade,
  level,
  onLevelChange,
  selectedPassageIds,
  onPassageIdsChange,
  itemsPerReading,
  onItemsPerReadingChange,
  questionTypeSlots,
  onQuestionTypeSlotsChange,
  visible,
  lockLevelToGrade = false,
}: LevelPassagePanelProps) {
  const [passages, setPassages] = useState<PassagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [pickHint, setPickHint] = useState<string | null>(null);
  /** Max simultaneous preset passages (generation-config maxPassagesPerSession). */
  const [maxPassages, setMaxPassages] = useState(5);

  const recommendedLevel = GRADE_TO_LEVEL[grade];
  const effectiveLevel = lockLevelToGrade ? recommendedLevel : level;
  const atMax = selectedPassageIds.length >= maxPassages;

  // Grade lock: force level to grade mapping whenever grade or lock mode changes.
  useEffect(() => {
    if (!visible || !lockLevelToGrade) return;
    if (level !== recommendedLevel) {
      onLevelChange(recommendedLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, lockLevelToGrade, visible, recommendedLevel]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/passages?level=${effectiveLevel}&full=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "지문 로드 실패");
        if (cancelled) return;
        // Defense: only keep passages whose level field matches the requested pack.
        const list = ((data.passages ?? []) as PassagePreview[]).filter(
          (p) => !p.level || p.level === effectiveLevel
        );
        setPassages(list);
        setPickHint(null);
        const gen = data.generation as LevelGenConfig | undefined;
        const maxCap =
          typeof (data as { maxPassagesPerSession?: number })
            .maxPassagesPerSession === "number"
            ? (data as { maxPassagesPerSession: number }).maxPassagesPerSession
            : 5;
        setMaxPassages(Math.min(5, Math.max(1, maxCap)));
        if (gen) {
          // Level-test default: select enough unique passages for item count (1:1).
          const want = Math.min(
            list.length || 1,
            maxCap,
            Math.max(gen.passagesPerSession ?? 3, gen.itemsPerReading ?? 3)
          );
          onItemsPerReadingChange(Math.min(gen.itemsPerReading, want));
          onQuestionTypeSlotsChange(
            (gen.questionTypeSlots ?? []).slice(0, Math.min(gen.itemsPerReading, want))
          );
          onPassageIdsChange(list.slice(0, want).map((p) => p.id));
        } else if (list.length > 0) {
          const n = Math.min(5, list.length);
          onPassageIdsChange(list.slice(0, n).map((p) => p.id));
          onItemsPerReadingChange(n);
        } else {
          onPassageIdsChange([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "오류");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLevel, visible, grade]);

  if (!visible) return null;

  function toggle(id: string) {
    if (selectedPassageIds.includes(id)) {
      if (selectedPassageIds.length <= 1) {
        setPickHint("최소 1개 지문은 선택해야 합니다.");
        return;
      }
      setPickHint(null);
      onPassageIdsChange(selectedPassageIds.filter((x) => x !== id));
      return;
    }
    if (selectedPassageIds.length >= maxPassages) {
      setPickHint(
        `지문은 최대 ${maxPassages}개까지 선택 가능합니다. 「My Best Friend」「At the Library」 등을 쓰려면 위쪽 지문 체크를 먼저 해제한 뒤 선택하세요.`
      );
      return;
    }
    setPickHint(null);
    onPassageIdsChange([...selectedPassageIds, id]);
  }

  /** Replace current selection with only this passage (always allowed). */
  function selectOnly(id: string) {
    setPickHint(null);
    onPassageIdsChange([id]);
  }

  function resizeItems(n: number) {
    const count = Math.min(10, Math.max(1, n));
    onItemsPerReadingChange(count);
    const slots = [...questionTypeSlots];
    while (slots.length < count) {
      slots.push(slots[slots.length % Math.max(1, slots.length)] || "detail");
    }
    onQuestionTypeSlotsChange(slots.slice(0, count));
  }

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-primary">리딩 레벨 · 지정 지문</h2>
        <a
          href="/passages"
          className="text-xs font-medium text-indigo-800 underline"
        >
          지문·슬롯 관리 →
        </a>
      </div>
      <p className="mb-3 text-sm text-stone-600">
        학년 <strong>{grade}</strong> → 권장 레벨{" "}
        <strong>
          L{recommendedLevel} ({LEVEL_GRADE_HINT[recommendedLevel]})
        </strong>
        . 해당 레벨의 <strong>큐레이션 지문</strong>만 사용하며, AI는 이 지문
        위에서만 IRT 문항을 생성합니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((lv) => {
          const lockedOut = lockLevelToGrade && lv !== recommendedLevel;
          return (
            <button
              key={lv}
              type="button"
              disabled={lockedOut}
              title={
                lockedOut
                  ? `${grade}는 L${recommendedLevel} 지문 팩을 사용합니다`
                  : LEVEL_GRADE_HINT[lv as 1 | 2 | 3 | 4 | 5 | 6]
              }
              onClick={() => {
                if (!lockedOut) onLevelChange(lv);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                effectiveLevel === lv
                  ? "bg-indigo-700 text-white"
                  : lockedOut
                    ? "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-indigo-400"
              }`}
            >
              {LEVEL_LABELS[lv]}
              {lv === recommendedLevel ? " · 권장" : ""}
            </button>
          );
        })}
      </div>
      {lockLevelToGrade && (
        <p className="mb-3 text-xs text-indigo-900/80">
          학년 연동 모드: 레벨은 학년 매핑으로 고정됩니다. 다른 레벨 지문은 선택할 수
          없습니다.
        </p>
      )}

      {/* Item count + slots */}
      <div className="mb-4 rounded-md border border-indigo-100 bg-white/80 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-stone-600">문항 수</span>
            <input
              type="number"
              min={1}
              max={10}
              className="w-16 rounded border border-stone-300 px-2 py-1"
              value={itemsPerReading}
              onChange={(e) => resizeItems(Number(e.target.value) || 1)}
            />
          </label>
          <span className="text-xs text-stone-500">
            선택 지문 {selectedPassageIds.length}/{maxPassages}개 · 학년 {grade}
          </span>
          <button
            type="button"
            className="ml-auto text-xs text-indigo-700 underline"
            onClick={() => setShowSlots((v) => !v)}
          >
            {showSlots ? "슬롯 접기" : "questionType 슬롯 편집"}
          </button>
        </div>
        {showSlots && (
          <ol className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
            {Array.from({ length: itemsPerReading }).map((_, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-mono text-stone-400">#{i + 1}</span>
                <select
                  className="flex-1 rounded border border-stone-300 px-2 py-1"
                  value={questionTypeSlots[i] ?? "detail"}
                  onChange={(e) => {
                    const next = [...questionTypeSlots];
                    while (next.length < itemsPerReading) next.push("detail");
                    next[i] = e.target.value;
                    onQuestionTypeSlotsChange(next.slice(0, itemsPerReading));
                  }}
                >
                  {QTYPES.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
        )}
        {!showSlots && questionTypeSlots.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-stone-500">
            slots: [{questionTypeSlots.slice(0, itemsPerReading).join(", ")}]
          </p>
        )}
      </div>

      {loading && <p className="text-sm text-stone-500">지문 불러오는 중…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {pickHint && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {pickHint}
        </p>
      )}
      <p className="mb-2 text-xs text-stone-500">
        레벨테스트: 선택한 지문마다 <strong>문항 1개</strong> (지문 재사용 없음). 지문
        최대 {maxPassages}개 · 문항 수는 선택 지문 수에 맞춰 생성됩니다. 다른 지문을
        쓰려면 체크를 바꾸거나 <strong>이 지문만</strong>을 누르세요.
      </p>

      <ul className="space-y-2">
        {passages.map((p) => {
          const checked = selectedPassageIds.includes(p.id);
          const open = expanded === p.id;
          const blocked = atMax && !checked;
          return (
            <li
              key={p.id}
              className={`rounded-md border bg-white p-3 text-sm ${
                checked
                  ? "border-indigo-400 ring-1 ring-indigo-200"
                  : blocked
                    ? "border-stone-200 opacity-70"
                    : "border-stone-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={blocked}
                  title={
                    blocked
                      ? `최대 ${maxPassages}개까지 선택 가능. 다른 지문을 먼저 해제하세요.`
                      : undefined
                  }
                  onChange={() => toggle(p.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-800">
                      {p.title}
                    </span>
                    <span className="rounded bg-stone-100 px-1.5 text-xs">
                      {p.wordCount}w
                    </span>
                    <span className="rounded bg-stone-100 px-1.5 text-xs">
                      CEFR {p.cefr}
                    </span>
                    <span className="font-mono text-xs text-stone-500">
                      b={p.targetB}
                    </span>
                    {blocked && (
                      <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-900">
                        최대 {maxPassages}개 · 다른 체크 해제 필요
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">
                    {open
                      ? p.text
                      : p.text.slice(0, 160) + (p.text.length > 160 ? "…" : "")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="text-xs text-indigo-700 underline"
                      onClick={() => setExpanded(open ? null : p.id)}
                    >
                      {open ? "접기" : "전문 보기"}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline"
                      onClick={() => selectOnly(p.id)}
                    >
                      이 지문만
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
