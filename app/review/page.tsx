"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DOMAIN_LABELS, type Domain } from "@/lib/types";
import { formatQuestionForDisplay } from "@/lib/format-question";
import RichStem from "@/components/RichStem";

type BankStatus = "pending" | "approved" | "quarantine";

interface BankItem {
  id: string;
  domain: Domain;
  type: "multiple_choice" | "short_answer";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  level: number;
  targetTheta: number;
  irt: { a: number; b: number; c: number };
  irtSource: string;
  dimension?: string;
  questionType?: string;
  headword?: string;
  passage?: string;
  status: BankStatus;
  createdAt: string;
  updatedAt: string;
  grade?: string;
  reviewNote?: string;
  validation?: { ok: boolean; warnings: string[]; errors: string[] };
  batchId?: string;
}

interface ListResponse {
  items: BankItem[];
  total: number;
  counts: Record<BankStatus, number>;
  stats?: { total: number; counts: Record<BankStatus, number> };
  error?: string;
}

const STATUS_LABEL: Record<BankStatus | "all", string> = {
  all: "전체",
  pending: "검수 대기",
  approved: "승인",
  quarantine: "격리",
};

const STATUS_STYLE: Record<BankStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  quarantine: "bg-red-100 text-red-900 border-red-200",
};

export default function ReviewPage() {
  const [status, setStatus] = useState<BankStatus | "all">("pending");
  const [domain, setDomain] = useState<string>("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<BankItem[]>([]);
  const [counts, setCounts] = useState<Record<BankStatus, number>>({
    pending: 0,
    approved: 0,
    quarantine: 0,
  });
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        limit: "100",
      });
      if (domain) params.set("domain", domain);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/items?${params}`);
      const data = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(data.error ?? "목록 로드 실패");
      setItems(data.items);
      setTotal(data.total);
      setCounts(data.counts ?? data.stats?.counts ?? counts);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }, [status, domain, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selected.has(i.id)),
    [items, selected]
  );

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchOne(id: string, nextStatus: BankStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reviewedBy: "teacher",
          reviewNote: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리 실패");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function bulk(nextStatus: BankStatus) {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          status: nextStatus,
          reviewedBy: "teacher",
          reviewNote: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "일괄 처리 실패");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function exportEchobridge() {
    setExporting(true);
    setExportMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/export/echobridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeGrammarAsVocab: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        approvedCount?: number;
        outDirRelative?: string;
        skipped?: unknown[];
        vocab?: Array<{ level: number; itemCount: number }>;
        reading?: Array<{ level: number; itemCount: number; passageCount: number }>;
      };
      if (!res.ok) throw new Error(data.error ?? "export 실패");
      const vSum = (data.vocab ?? []).reduce((s, x) => s + x.itemCount, 0);
      const rSum = (data.reading ?? []).reduce((s, x) => s + x.itemCount, 0);
      setExportMsg(
        `Export 완료 · approved ${data.approvedCount} · vocab items ${vSum} · reading items ${rSum} · 경로 ${data.outDirRelative ?? ""}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "export 오류");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Teacher Console
          </p>
          <h1 className="text-2xl font-bold text-primary">IRT 문항 검수</h1>
          <p className="mt-1 text-sm text-stone-500">
            생성된 문항을 승인·격리하여 JSON bank에 반영합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
          >
            ← 진단 평가
          </Link>
          <Link
            href="/passages"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
          >
            지문·슬롯 관리
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:opacity-90"
          >
            새로고침
          </button>
          <button
            type="button"
            disabled={exporting || (counts.approved ?? 0) === 0}
            onClick={() => void exportEchobridge()}
            className="rounded-md bg-indigo-700 px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
            title="approved 문항을 echobridge service JSON으로 저장"
          >
            {exporting ? "Export 중…" : "echobridge 포맷 Export"}
          </button>
        </div>
      </header>

      {exportMsg && (
        <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          {exportMsg}
          <p className="mt-1 text-xs text-indigo-800/80">
            산출물: data/exports/echobridge/&lt;timestamp&gt;/vocab|reading/level-N.service.json
            · 프로덕션 서비스 파일에 덮어쓰지 말고 merge 하세요.
          </p>
        </div>
      )}

      {/* counts */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
        {(["pending", "approved", "quarantine"] as BankStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg border p-3 text-left transition ${
              status === s ? "border-primary ring-1 ring-primary" : "border-stone-200"
            }`}
          >
            <div className="text-xs text-stone-500">{STATUS_LABEL[s]}</div>
            <div className="text-xl font-bold text-stone-800">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3">
        <select
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as BankStatus | "all")}
        >
          {(["all", "pending", "approved", "quarantine"] as const).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          <option value="">전 영역</option>
          <option value="vocabulary">어휘</option>
          <option value="grammar">문법</option>
          <option value="reading">독해</option>
        </select>
        <input
          className="min-w-[12rem] flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm"
          placeholder="검색 (문항/id/headword)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded bg-stone-800 px-3 py-1.5 text-sm text-white"
        >
          필터 적용
        </button>
      </div>

      {/* bulk actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          전체 선택 ({selected.size})
        </label>
        <input
          className="min-w-[10rem] flex-1 rounded border border-stone-300 px-2 py-1"
          placeholder="검수 메모 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void bulk("approved")}
          className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white disabled:opacity-40"
        >
          선택 승인
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void bulk("quarantine")}
          className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-40"
        >
          선택 격리
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void bulk("pending")}
          className="rounded border border-stone-400 px-3 py-1.5 disabled:opacity-40"
        >
          대기로
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          검수할 문항이 없습니다. 홈에서 IRT 문항을 생성한 뒤 「bank에 저장」을 누르세요.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const answerIdx = Number(item.answer);
            const open = expanded === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-medium ${STATUS_STYLE[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">
                        {DOMAIN_LABELS[item.domain]}
                      </span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">
                        L{item.level}
                      </span>
                      <span className="font-mono text-stone-500">
                        b={item.irt.b.toFixed(2)} a={item.irt.a.toFixed(2)} c=
                        {item.irt.c.toFixed(2)}
                      </span>
                      {item.dimension && (
                        <span className="text-stone-500">{item.dimension}</span>
                      )}
                      {item.validation && !item.validation.ok && (
                        <span className="text-red-600">
                          검증실패: {item.validation.errors.join(", ")}
                        </span>
                      )}
                      {item.validation?.warnings?.length ? (
                        <span className="text-amber-700">
                          경고 {item.validation.warnings.length}
                        </span>
                      ) : null}
                    </div>
                    <RichStem
                      text={
                        formatQuestionForDisplay(
                          item.question.length > 280 && !open
                            ? `${item.question.slice(0, 280)}…`
                            : item.question
                        ).stem
                      }
                      className="text-sm font-medium text-stone-800"
                    />
                    {item.passage && open && (
                      <div className="mt-2 rounded bg-stone-50 p-2 text-xs text-stone-600 whitespace-pre-wrap">
                        {item.passage}
                      </div>
                    )}
                    {item.type === "multiple_choice" && (
                      <ol className="mt-2 list-none space-y-1 text-sm text-stone-700">
                        {item.options.map((opt, i) => (
                          <li
                            key={i}
                            className={
                              i === answerIdx
                                ? "font-semibold text-emerald-800"
                                : ""
                            }
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                            {i === answerIdx ? " ✓" : ""}
                          </li>
                        ))}
                      </ol>
                    )}
                    {open && (
                      <p className="mt-2 text-xs text-stone-500">
                        해설: {item.explanation}
                        {item.reviewNote ? ` · 메모: ${item.reviewNote}` : ""}
                        <br />
                        <span className="font-mono">{item.id}</span>
                        {item.batchId ? ` · ${item.batchId}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="text-xs text-stone-500 underline"
                      onClick={() =>
                        setExpanded((cur) => (cur === item.id ? null : item.id))
                      }
                    >
                      {open ? "접기" : "상세"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || item.status === "approved"}
                      onClick={() => void patchOne(item.id, "approved")}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={busy || item.status === "quarantine"}
                      onClick={() => void patchOne(item.id, "quarantine")}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      격리
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-stone-400">
        표시 {items.length} / 필터 매칭 {total} · 저장 위치 data/generated-bank/items.json
      </p>
    </main>
  );
}
