/**
 * Display helpers for student-facing question stems.
 * Models often omit newlines; CSS collapses them unless we normalize.
 */

export interface FormattedQuestion {
  /** Optional fixed passage block (reading). */
  passage: string | null;
  /** Stem / instruction + prompt lines, with newlines ready for pre-wrap. */
  stem: string;
}

/**
 * Normalize a raw question string for on-screen rendering.
 * - Extracts `[지문]...` blocks
 * - Inserts line breaks between Korean instructions and English examples
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

  // Blank-fill: put sentence after Korean prompt on next line
  text = text.replace(
    /(고르시오\.?)\s*(Let's|Let us|She |He |They |I |We |The |A |An )/gi,
    "$1\n$2"
  );

  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return { passage, stem: text };
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
