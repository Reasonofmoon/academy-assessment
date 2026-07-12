"use client";

import { useEffect, useState } from "react";
import type { Grade } from "@/lib/types";

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

interface LevelPassagePanelProps {
  grade: Grade;
  /** Controlled level; if omitted, derived from grade on server */
  level: number;
  onLevelChange: (level: number) => void;
  selectedPassageIds: string[];
  onPassageIdsChange: (ids: string[]) => void;
  /** Show only when reading domain is active */
  visible: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "L1 초등",
  2: "L2 중학",
  3: "L3 고등",
  4: "L4 수능",
  5: "L5 토플",
  6: "L6 유학",
};

export default function LevelPassagePanel({
  grade,
  level,
  onLevelChange,
  selectedPassageIds,
  onPassageIdsChange,
  visible,
}: LevelPassagePanelProps) {
  const [passages, setPassages] = useState<PassagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/passages?level=${level}&full=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "지문 로드 실패");
        if (cancelled) return;
        const list = (data.passages ?? []) as PassagePreview[];
        setPassages(list);
        // default: first 2 passages
        if (selectedPassageIds.length === 0 && list.length > 0) {
          onPassageIdsChange(list.slice(0, 2).map((p) => p.id));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when level changes; don't reset selection mid-edit via selectedPassageIds
  }, [level, visible, grade]);

  // When level changes, reset selection to first two of new level
  useEffect(() => {
    if (!visible || passages.length === 0) return;
    const stillValid = selectedPassageIds.every((id) =>
      passages.some((p) => p.id === id)
    );
    if (!stillValid) {
      onPassageIdsChange(passages.slice(0, 2).map((p) => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passages]);

  if (!visible) return null;

  function toggle(id: string) {
    if (selectedPassageIds.includes(id)) {
      if (selectedPassageIds.length <= 1) return; // keep at least one
      onPassageIdsChange(selectedPassageIds.filter((x) => x !== id));
    } else {
      if (selectedPassageIds.length >= 3) return; // max 3
      onPassageIdsChange([...selectedPassageIds, id]);
    }
  }

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-primary">리딩 레벨 · 지정 지문</h2>
      <p className="mb-3 text-sm text-stone-600">
        레벨을 고르면 <strong>미리 지정된 지문</strong>이 고정됩니다. AI는 이 지문
        위에서만 IRT 문항(요지·세부·추론 등)을 생성합니다. 지문 원문은 수정하지
        않습니다.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => onLevelChange(lv)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              level === lv
                ? "bg-indigo-700 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:border-indigo-400"
            }`}
          >
            {LEVEL_LABELS[lv]}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs text-stone-500">
        학년 <span className="font-medium text-stone-700">{grade}</span> · 선택 지문{" "}
        {selectedPassageIds.length}개 (1~3개)
      </p>

      {loading && <p className="text-sm text-stone-500">지문 불러오는 중…</p>}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <ul className="space-y-2">
        {passages.map((p) => {
          const checked = selectedPassageIds.includes(p.id);
          const open = expanded === p.id;
          return (
            <li
              key={p.id}
              className={`rounded-md border bg-white p-3 text-sm ${
                checked ? "border-indigo-400 ring-1 ring-indigo-200" : "border-stone-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-800">{p.title}</span>
                    <span className="rounded bg-stone-100 px-1.5 text-xs">
                      {p.wordCount}w
                    </span>
                    <span className="rounded bg-stone-100 px-1.5 text-xs">
                      CEFR {p.cefr}
                    </span>
                    <span className="font-mono text-xs text-stone-500">
                      preset b={p.targetB}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600 whitespace-pre-wrap">
                    {open ? p.text : p.text.slice(0, 160) + (p.text.length > 160 ? "…" : "")}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-xs text-indigo-700 underline"
                    onClick={() => setExpanded(open ? null : p.id)}
                  >
                    {open ? "접기" : "전문 보기"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
