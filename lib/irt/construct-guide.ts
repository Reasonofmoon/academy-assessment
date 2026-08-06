/**
 * Load per-level vocab/grammar construct guides (school-exam calibrated).
 * Source: data/school-exam-catalog/construct-by-level.json
 */
import * as fs from "fs";
import * as path from "path";
import type { Domain } from "@/lib/types";
import type { IrtLevel } from "@/lib/irt/types";

export interface DomainConstruct {
  allowedFormats?: string[];
  formats?: string[];
  targets?: string[];
  forbid?: string[];
  lexisBand?: string;
  exampleHeads?: string[];
  preferContextOverGloss?: boolean;
  minContextSentences?: number;
  topics?: string[];
  styleNote?: string;
}

export interface LevelConstruct {
  cefr?: string;
  grades?: string;
  refLocal?: string;
  vocabulary?: DomainConstruct;
  grammar?: DomainConstruct;
}

interface ConstructFile {
  version?: string;
  description?: string;
  levels: Record<string, LevelConstruct>;
}

const GUIDE_PATH = path.join(
  process.cwd(),
  "data",
  "school-exam-catalog",
  "construct-by-level.json"
);

let cache: ConstructFile | null = null;

function loadGuide(): ConstructFile {
  if (cache) return cache;
  if (!fs.existsSync(GUIDE_PATH)) {
    cache = { levels: {} };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(GUIDE_PATH, "utf-8")) as ConstructFile;
  } catch {
    cache = { levels: {} };
  }
  return cache;
}

export function getLevelConstruct(level: IrtLevel): LevelConstruct | null {
  return loadGuide().levels[String(level)] ?? null;
}

/** Prompt block for vocab/grammar generation at a given GLEAS level. */
export function buildConstructPromptSection(
  level: IrtLevel,
  domain: Domain
): string {
  if (domain !== "vocabulary" && domain !== "grammar") return "";
  const block = getLevelConstruct(level);
  if (!block) return "";

  const d: DomainConstruct | undefined =
    domain === "vocabulary" ? block.vocabulary : block.grammar;
  if (!d) return "";

  const lines: string[] = [
    `## LEVEL CONSTRUCT GUIDE (GLEAS L${level}, CEFR ${block.cefr ?? "?"}, ${block.grades ?? ""})`,
    `Local difficulty reference: ${block.refLocal ?? "academy CEFR ladder"}`,
    `Use this as RIGOR/STYLE target. Do NOT copy any school exam text.`,
  ];

  if (d.lexisBand) lines.push(`- Lexis band: ${d.lexisBand}`);
  if (d.preferContextOverGloss) {
    lines.push(
      "- Prefer **context-based** items over bare Korean-gloss → English word matching."
    );
  }
  if (d.minContextSentences && d.minContextSentences > 1) {
    lines.push(
      `- Provide at least ${d.minContextSentences} English sentences of original context when testing meaning-in-context or error ID.`
    );
  }
  if (d.topics?.length) {
    lines.push(`- Preferred topics: ${d.topics.join(", ")}`);
  }
  if (d.allowedFormats?.length) {
    lines.push("- Allowed formats:");
    for (const f of d.allowedFormats) lines.push(`  • ${f}`);
  }
  if (d.formats?.length) {
    lines.push("- Item formats:");
    for (const f of d.formats) lines.push(`  • ${f}`);
  }
  if (d.targets?.length) {
    lines.push("- Grammar/content targets:");
    for (const t of d.targets) lines.push(`  • ${t}`);
  }
  if (d.forbid?.length) {
    lines.push("- FORBIDDEN at this level:");
    for (const f of d.forbid) lines.push(`  • ${f}`);
  }
  if (d.styleNote) lines.push(`- Style: ${d.styleNote}`);
  if (d.exampleHeads?.length) {
    lines.push(
      `- Example lexis heads (do not overuse): ${d.exampleHeads.join(", ")}`
    );
  }

  if (level >= 4 && domain === "vocabulary") {
    lines.push(
      "- High-school placement: at most ONE pure gloss-matching item; the rest MUST be context/cloze or inappropriate-word-in-context."
    );
  }
  if (level >= 4 && domain === "grammar") {
    lines.push(
      "- High-school placement: prefer short original paragraph (2–4 sentences) with four underlined candidates OR multi-clause form choice. Avoid isolated elementary drills."
    );
  }

  return lines.join("\n");
}
