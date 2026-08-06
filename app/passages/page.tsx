"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type QType =
  | "main_idea"
  | "detail"
  | "inference"
  | "purpose"
  | "attitude"
  | "vocabulary"
  | "other";

interface Passage {
  id: string;
  title: string;
  text: string;
  level: number;
  cefr: string;
  wordCount: number;
  targetB: number;
  source: string;
  order: number;
  suggestedQuestionTypes: QType[];
}

interface LevelGenConfig {
  itemsPerReading: number;
  passagesPerSession: number;
  questionTypeSlots: QType[];
}

interface GenConfig {
  version: string;
  defaults: {
    countPerDomain: { vocabulary: number; grammar: number; reading: number };
    passagesPerSession: number;
    maxPassagesPerSession: number;
  };
  levels: Record<string, LevelGenConfig>;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "L1 초등 · Pre-A1/A1",
  2: "L2 중학 · A2",
  3: "L3 중3·고1 · A2–B1",
  4: "L4 고2–고3 · B1",
  5: "L5 고급 · B1–B2",
  6: "L6 고급 · B2",
};

const ALL_QTYPES: QType[] = [
  "main_idea",
  "detail",
  "inference",
  "purpose",
  "attitude",
  "vocabulary",
  "other",
];

const emptyDraft = (): Partial<Passage> & { text: string } => ({
  title: "",
  text: "",
  cefr: "B1",
  targetB: 0,
  suggestedQuestionTypes: ["main_idea", "detail", "inference", "purpose"],
});

export default function PassagesAdminPage() {
  const [level, setLevel] = useState(2);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [config, setConfig] = useState<GenConfig | null>(null);
  const [levelCfg, setLevelCfg] = useState<LevelGenConfig | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/passages?level=${level}&full=1`),
        fetch("/api/passages/config"),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      if (!pRes.ok) throw new Error(pData.error ?? "지문 로드 실패");
      if (!cRes.ok) throw new Error(cData.error ?? "설정 로드 실패");
      setPassages(pData.passages ?? []);
      setConfig(cData.config);
      setLevelCfg(
        cData.config?.levels?.[String(level)] ?? pData.generation ?? null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    void load();
    setEditingId(null);
    setDraft(emptyDraft());
  }, [load]);

  async function savePassage() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/passages/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          level,
          passage: {
            id: editingId ?? undefined,
            title: draft.title,
            text: draft.text,
            cefr: draft.cefr,
            targetB: Number(draft.targetB) || 0,
            suggestedQuestionTypes: draft.suggestedQuestionTypes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setPassages(data.passages ?? []);
      setEditingId(null);
      setDraft(emptyDraft());
      setMsg(editingId ? "지문을 수정했습니다." : "지문을 추가했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function removePassage(id: string) {
    if (!confirm("이 지문을 삭제할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/passages/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", level, passageId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      setPassages(data.passages ?? []);
      setMsg("삭제했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function movePassage(id: string, direction: "up" | "down") {
    const idx = passages.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const j = direction === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= passages.length) return;

    const next = [...passages];
    [next[idx], next[j]] = [next[j], next[idx]];
    setPassages(next);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/passages/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          level,
          orderedIds: next.map((p) => p.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "순서 저장 실패");
      setPassages(data.passages ?? next);
      setMsg("지문 순서를 저장했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
      await load(); // revert from server
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Passage) {
    setEditingId(p.id);
    setDraft({
      title: p.title,
      text: p.text,
      cefr: p.cefr,
      targetB: p.targetB,
      suggestedQuestionTypes: p.suggestedQuestionTypes ?? [
        "main_idea",
        "detail",
      ],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setSlot(i: number, t: QType) {
    if (!levelCfg) return;
    const slots = [...levelCfg.questionTypeSlots];
    slots[i] = t;
    setLevelCfg({ ...levelCfg, questionTypeSlots: slots });
  }

  function resizeSlots(n: number) {
    if (!levelCfg) return;
    const slots = [...levelCfg.questionTypeSlots];
    while (slots.length < n) {
      slots.push(slots[slots.length % Math.max(1, slots.length)] || "detail");
    }
    setLevelCfg({
      ...levelCfg,
      itemsPerReading: n,
      questionTypeSlots: slots.slice(0, n),
    });
  }

  async function saveConfig() {
    if (!config || !levelCfg) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/passages/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaults: config.defaults,
          levels: {
            ...config.levels,
            [String(level)]: levelCfg,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "설정 저장 실패");
      setConfig(data.config);
      setLevelCfg(data.config.levels[String(level)]);
      setMsg(`L${level} 생성 설정을 저장했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Teacher Console
          </p>
          <h1 className="text-2xl font-bold text-primary">
            리딩 지문 · 슬롯 설정
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            레벨별 지정 지문 편집 + 문항 수 / questionType 슬롯 관리
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/"
            className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-50"
          >
            ← 진단 평가
          </Link>
          <Link
            href="/review"
            className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-50"
          >
            문항 검수
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              level === lv
                ? "bg-indigo-700 text-white"
                : "border border-stone-300 bg-white"
            }`}
          >
            {LEVEL_LABELS[lv]}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900">
          {msg}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Slot config */}
      {levelCfg && (
        <section className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <h2 className="mb-3 font-bold text-primary">
            L{level} 생성 슬롯 설정
          </h2>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-stone-700">
                리딩 문항 수
              </span>
              <input
                type="number"
                min={1}
                max={10}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
                value={levelCfg.itemsPerReading}
                onChange={(e) => resizeSlots(Number(e.target.value) || 1)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-stone-700">
                기본 사용 지문 수
              </span>
              <input
                type="number"
                min={1}
                max={5}
                className="w-full rounded border border-stone-300 px-2 py-1.5"
                value={levelCfg.passagesPerSession}
                onChange={(e) =>
                  setLevelCfg({
                    ...levelCfg,
                    passagesPerSession: Number(e.target.value) || 1,
                  })
                }
              />
            </label>
          </div>
          <p className="mb-2 text-xs text-stone-600">
            슬롯 순서 = 생성 문항 유형 순서 (1번 문항부터 순환 배치)
          </p>
          <ol className="mb-3 space-y-2">
            {levelCfg.questionTypeSlots.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-14 font-mono text-stone-500">#{i + 1}</span>
                <select
                  className="flex-1 rounded border border-stone-300 px-2 py-1"
                  value={t}
                  onChange={(e) => setSlot(i, e.target.value as QType)}
                >
                  {ALL_QTYPES.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveConfig()}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            슬롯 설정 저장
          </button>
        </section>
      )}

      {/* Editor */}
      <section className="mb-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-primary">
          {editingId ? `지문 수정 (${editingId})` : "새 지문 추가"}
        </h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block font-medium">제목</span>
            <input
              className="w-full rounded border border-stone-300 px-2 py-1.5"
              value={draft.title ?? ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="예: L2 편지문 지문"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-medium">CEFR</span>
              <input
                className="w-full rounded border border-stone-300 px-2 py-1.5"
                value={draft.cefr ?? ""}
                onChange={(e) => setDraft({ ...draft, cefr: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">preset targetB</span>
              <input
                type="number"
                step="0.01"
                className="w-full rounded border border-stone-300 px-2 py-1.5"
                value={draft.targetB ?? 0}
                onChange={(e) =>
                  setDraft({ ...draft, targetB: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block font-medium">지문 본문 (영어)</span>
            <textarea
              className="min-h-[140px] w-full rounded border border-stone-300 px-2 py-1.5 font-mono text-xs"
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder="고정 지문 원문을 입력하세요 (최소 40자)"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (draft.text?.length ?? 0) < 40}
              onClick={() => void savePassage()}
              className="rounded-md bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              {editingId ? "수정 저장" : "추가"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft());
                }}
                className="rounded-md border border-stone-300 px-4 py-2"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </section>

      {/* List + reorder */}
      <section>
        <h2 className="mb-1 font-bold text-primary">
          L{level} 지정 지문 ({passages.length})
        </h2>
        <p className="mb-3 text-xs text-stone-500">
          ↑↓ 버튼으로 출제 우선순서를 바꿉니다. 위에서부터 기본 세션 지문으로
          사용됩니다.
        </p>
        {loading ? (
          <p className="text-sm text-stone-500">불러오는 중…</p>
        ) : passages.length === 0 ? (
          <p className="text-sm text-stone-500">지문이 없습니다. 위에서 추가하세요.</p>
        ) : (
          <ul className="space-y-3">
            {passages.map((p, idx) => (
              <li
                key={p.id}
                className="rounded-lg border border-stone-200 bg-white p-4 text-sm shadow-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-indigo-100 px-1.5 font-mono text-xs text-indigo-900">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold">{p.title}</span>
                  <span className="font-mono text-xs text-stone-500">{p.id}</span>
                  <span className="rounded bg-stone-100 px-1.5 text-xs">
                    {p.wordCount}w · {p.cefr} · b={p.targetB}
                  </span>
                </div>
                <p className="mb-2 whitespace-pre-wrap text-xs text-stone-600">
                  {p.text.slice(0, 240)}
                  {p.text.length > 240 ? "…" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || idx === 0}
                    className="rounded border border-stone-300 px-2 py-1 text-xs disabled:opacity-30"
                    onClick={() => void movePassage(p.id, "up")}
                    title="위로"
                  >
                    ↑ 위로
                  </button>
                  <button
                    type="button"
                    disabled={busy || idx === passages.length - 1}
                    className="rounded border border-stone-300 px-2 py-1 text-xs disabled:opacity-30"
                    onClick={() => void movePassage(p.id, "down")}
                    title="아래로"
                  >
                    ↓ 아래로
                  </button>
                  <button
                    type="button"
                    className="rounded bg-stone-800 px-2 py-1 text-xs text-white"
                    onClick={() => startEdit(p)}
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-40"
                    onClick={() => void removePassage(p.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
