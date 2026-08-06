/**
 * Display helpers for student-facing question stems.
 * Models often omit newlines; CSS collapses them unless we normalize.
 * Also maps (A)/(B) markers and **bold** / __underline__ into rich spans.
 */

export interface FormattedQuestion {
  /** Optional fixed passage block (reading). */
  passage: string | null;
  /** Stem / instruction + prompt lines, with newlines ready for pre-wrap. */
  stem: string;
}

export interface RichSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

/**
 * Mark (A)/(B)/(C)/(D) target phrases for underline+bold display.
 * - If another label follows soon (grammar phrases): underline up to next (B)/(C)/(D).
 * - Otherwise (vocab single words in a long sentence): underline the first English word only.
 * e.g. "(A) ease traffic…" → "(A) «bu:ease»"
 * e.g. "(A) that I borrowed yesterday (B) were" → underline "that I borrowed yesterday"
 */
export function markLabeledUnderlines(text: string): string {
  const re = /\(([A-Da-d])\)\s+/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    const letter = m[1];
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const nextLabel = rest.search(/\([A-Da-d]\)/);
    const nextStop = rest.search(/[.!?]/);
    let phrase: string;
    let consumed = 0;
    // Multi-word grammar underline: next label soon, no sentence end/comma, ≤6 words
    // (e.g. "(A) that I borrowed yesterday (B) were")
    if (
      nextLabel >= 0 &&
      nextLabel <= 60 &&
      (nextStop < 0 || nextStop >= nextLabel)
    ) {
      const candidate = rest.slice(0, nextLabel).replace(/\s+/g, " ").trim();
      const words = candidate.split(/\s+/).filter(Boolean);
      if (words.length > 0 && words.length <= 6 && !/,/.test(candidate)) {
        phrase = candidate;
        consumed = nextLabel;
      } else {
        const word = rest.match(/^[A-Za-z][A-Za-z'-]*/);
        phrase = word
          ? word[0]
          : (rest.split(/\s+/)[0] || "").replace(/[.,;:!?]+$/, "");
        consumed = phrase.length;
      }
    } else {
      const word = rest.match(/^[A-Za-z][A-Za-z'-]*/);
      phrase = word
        ? word[0]
        : (rest.split(/\s+/)[0] || "").replace(/[.,;:!?]+$/, "");
      consumed = phrase.length;
    }
    if (!phrase) {
      out += m[0];
    } else {
      out += `(${letter}) «bu:${phrase}»`;
      // Preserve a space before the next (B)/(C)/(D) label when we consumed up to it
      if (text[start + consumed] === "(") out += " ";
      re.lastIndex = start + consumed;
    }
    last = re.lastIndex;
  }
  out += text.slice(last);
  return out;
}

/**
 * Normalize a raw question string for on-screen rendering.
 * - Extracts `[지문]...` blocks
 * - Inserts line breaks between Korean instructions and English examples
 * - Marks (A)/(B) candidates for underline+bold
 * - Keeps existing newlines
 */
export function formatQuestionForDisplay(raw: string): FormattedQuestion {
  let text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  let passage: string | null = null;

  const tagged = text.match(/^\[지문\]\s*\n?([\s\S]*?)\n\n([\s\S]+)$/);
  if (tagged) {
    passage = tagged[1].trim();
    text = tagged[2].trim();
  }

  // "한글 뜻:" always on its own line
  text = text.replace(/(고르시오\.?)\s*(한글\s*뜻\s*:)/g, "$1\n$2");
  text = text.replace(/([.。])\s*(한글\s*뜻\s*:)/g, "$1\n$2");

  // Korean instruction then English example / blank sentence
  text = text.replace(/(고르시오\.?)\s+(?=[A-Za-z"'“‘`_])/g, "$1\n");
  text = text.replace(/([?？])\s+(?=[A-Za-z"'“‘`_])/g, "$1\n");
  text = text.replace(/(것은\?)\s*(?=[A-Za-z"'“‘`_])/g, "$1\n");
  text = text.replace(/(알맞은\s*(?:것|단어)은\?)\s*(?=[A-Za-z"'“‘`_])/g, "$1\n");
  text = text.replace(/(적절하지\s*않은\s*것은\?)\s*(?=[A-Za-z])/g, "$1\n");
  text = text.replace(/(틀린\s*것은\?)\s*(?=[A-Za-z])/g, "$1\n");
  text = text.replace(/(어색한\s*것은\?)\s*(?=[A-Za-z])/g, "$1\n");

  // Blank-fill: put sentence after Korean prompt on next line
  text = text.replace(
    /(고르시오\.?)\s*(Let's|Let us|She |He |They |I |We |The |A |An |Many |Cities |Regular |Local |Online |New |After |If |One |This |The )/gi,
    "$1\n$2"
  );

  // If stem mentions 밑줄, ensure (A)-(D) phrases are marked for underline
  if (/밑줄/.test(text) || /\([A-Da-d]\)/.test(text)) {
    text = markLabeledUnderlines(text);
  }

  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return { passage, stem: text };
}

/**
 * Parse stem into segments for bold / underline rendering.
 * Supports:
 * - **bold**
 * - __underline__ or _underline_ (single underscore pair, word-ish)
 * - «bu:text» bold+underline (from (A) markers)
 * - «u:text» underline only
 * - «b:text» bold only
 */
export function parseRichSegments(raw: string): RichSegment[] {
  if (!raw) return [];
  const tokenRe =
    /\*\*([\s\S]+?)\*\*|__([^_]+?)__|«bu:([\s\S]+?)»|«u:([\s\S]+?)»|«b:([\s\S]+?)»/g;
  const parts: RichSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(raw)) !== null) {
    if (m.index > last) {
      parts.push({ text: raw.slice(last, m.index) });
    }
    if (m[1] != null) {
      parts.push({ text: m[1], bold: true });
    } else if (m[2] != null) {
      parts.push({ text: m[2], underline: true });
    } else if (m[3] != null) {
      parts.push({ text: m[3], bold: true, underline: true });
    } else if (m[4] != null) {
      parts.push({ text: m[4], underline: true });
    } else if (m[5] != null) {
      parts.push({ text: m[5], bold: true });
    }
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    parts.push({ text: raw.slice(last) });
  }
  // Strip leftover lone ** that models leave unmatched
  return parts.map((p) => ({
    ...p,
    text: p.text.replace(/\*\*/g, ""),
  }));
}

/** True when stem is instruction-only (e.g. missing "한글 뜻: …"). */
export function isIncompleteVocabStem(question: string): boolean {
  const q = question.replace(/\s+/g, " ").trim();
  // Bare instruction without meaning / target
  if (
    /^(한글 뜻에 맞는 (?:단어|올바른 철자)를 고르시오\.?)$/i.test(q) ||
    /^(Choose the (?:word|best answer).{0,40})$/i.test(q)
  ) {
    return true;
  }
  // Instruction present but no payload after it
  if (
    /한글 뜻에 맞는/.test(q) &&
    !/한글\s*뜻\s*:/.test(q) &&
    q.length < 40
  ) {
    return true;
  }
  return false;
}
