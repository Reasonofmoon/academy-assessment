/**
 * Smoke test for display formatting (no build step).
 * Mirrors lib/format-question.ts logic for quick checks.
 */
function formatQuestionForDisplay(raw) {
  let text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  let passage = null;
  const tagged = text.match(/^\[지문\]\s*\n?([\s\S]*?)\n\n([\s\S]+)$/);
  if (tagged) {
    passage = tagged[1].trim();
    text = tagged[2].trim();
  }
  text = text.replace(/(고르시오\.?)\s*(한글\s*뜻\s*:)/g, "$1\n$2");
  text = text.replace(/(고르시오\.?)\s+(?=[A-Za-z"'“])/g, "$1\n");
  text = text.replace(/([?？])\s+(?=[A-Za-z"'“])/g, "$1\n");
  text = text.replace(/(것은\?)\s*(?=[A-Za-z])/g, "$1\n");
  return { passage, stem: text };
}

function isIncompleteVocabStem(question) {
  const q = question.replace(/\s+/g, " ").trim();
  if (/^(한글 뜻에 맞는 (?:단어|올바른 철자)를 고르시오\.?)$/i.test(q)) return true;
  if (/한글 뜻에 맞는/.test(q) && !/한글\s*뜻\s*:/.test(q) && q.length < 40) {
    return true;
  }
  return false;
}

const cases = [
  formatQuestionForDisplay(
    "다음 문장에서 book의 뜻으로 가장 알맞은 것은? I like to read a new book every week."
  ),
  formatQuestionForDisplay(
    "다음 빈칸에 들어갈 가장 알맞은 단어를 고르시오. Let's _____ outside."
  ),
  formatQuestionForDisplay("한글 뜻에 맞는 단어를 고르시오.\n한글 뜻: 여행하다"),
  isIncompleteVocabStem("한글 뜻에 맞는 단어를 고르시오."),
  isIncompleteVocabStem("한글 뜻에 맞는 단어를 고르시오.\n한글 뜻: 여행하다"),
];

console.log(JSON.stringify(cases, null, 2));
