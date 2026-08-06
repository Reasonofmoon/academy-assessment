"use client";

import { parseRichSegments } from "@/lib/format-question";

interface RichStemProps {
  text: string;
  className?: string;
}

/**
 * Render question stem with **bold**, underline, and (A)/(B) marked spans.
 */
export default function RichStem({ text, className = "" }: RichStemProps) {
  const segments = parseRichSegments(text);
  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {segments.map((seg, i) => {
        if (!seg.bold && !seg.underline) {
          return <span key={i}>{seg.text}</span>;
        }
        return (
          <span
            key={i}
            className={[
              seg.bold ? "font-bold text-stone-900" : "",
              seg.underline
                ? "underline decoration-2 decoration-primary underline-offset-2"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}
