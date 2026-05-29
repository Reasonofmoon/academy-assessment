"use client";

import { DOMAINS, DOMAIN_LABELS, type Domain } from "@/lib/types";

// ───────────────────────────────────────────────────────────
// 진단 영역 선택기
//   - 어휘 / 문법 / 독해 중 1~3개 동시 선택 가능 (체크박스)
// ───────────────────────────────────────────────────────────

interface DomainSelectorProps {
  selected: Domain[];
  onChange: (domains: Domain[]) => void;
}

// 영역별 영문 부제 (라벨 아래 표시)
const DOMAIN_SUBTITLES: Record<Domain, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading Comprehension",
};

export default function DomainSelector({ selected, onChange }: DomainSelectorProps) {
  // 체크박스 토글 — 이미 있으면 제거, 없으면 추가
  const toggle = (domain: Domain) => {
    if (selected.includes(domain)) {
      onChange(selected.filter((d) => d !== domain));
    } else {
      onChange([...selected, domain]);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-primary">2. 진단 영역 선택</h2>
      <p className="mb-4 text-sm text-stone-500">
        1~3개를 동시에 선택할 수 있습니다. (영역당 5문제 출제)
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DOMAINS.map((domain) => {
          const isChecked = selected.includes(domain);
          return (
            <label
              key={domain}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-4 transition ${
                isChecked
                  ? "border-primary bg-primary/5"
                  : "border-stone-300 hover:border-stone-400"
              }`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={isChecked}
                onChange={() => toggle(domain)}
              />
              <span>
                <span className="block font-semibold text-stone-800">
                  {DOMAIN_LABELS[domain]}
                </span>
                <span className="block text-xs text-stone-500">
                  {DOMAIN_SUBTITLES[domain]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
