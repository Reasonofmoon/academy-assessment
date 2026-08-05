// ───────────────────────────────────────────────────────────
// Gemini API 호출 헬퍼
//   ⚠️ 이 파일은 "서버(API Route)"에서만 import 해야 한다.
//      절대 클라이언트 컴포넌트에서 import 하지 말 것 — API 키 노출 위험!
// ───────────────────────────────────────────────────────────

// 사용 모델 (빠르고 저렴한 flash 계열, GA 안정 버전)
//  - 기본값은 안정 출시된 "gemini-2.5-flash".
//  - 실험용 "-exp" 모델은 수시로 종료되어 404를 유발하므로 사용하지 않는다.
//  - 환경변수 GEMINI_MODEL 로 코드 수정 없이 모델을 교체할 수 있다.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
/** Fallback chain when primary returns empty / 404 / transient errors. */
const MODEL_FALLBACKS = [
  PRIMARY_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

/** Max attempts per model for transient empty/malformed/network failures. */
const MAX_ATTEMPTS = 2;
const RETRY_BASE_MS = 700;

// 사용자 친화 에러 메시지를 담는 커스텀 에러.
// API Route 에서 이 에러를 잡아 그대로 사용자에게 내려준다.
export class GeminiError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "GeminiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Gemini에 프롬프트를 보내고 "텍스트 응답"을 받아온다.
 * - JSON 응답을 강제하기 위해 responseMimeType: "application/json" 사용.
 * - 키 누락 / 할당량 초과 / 네트워크 오류를 사용자 친화 메시지로 변환한다.
 * - 빈 응답·일시 오류는 최대 3회 재시도.
 */
export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요. (README의 환경변수 설정 가이드 참고)",
      500
    );
  }

  let lastError: GeminiError | null = null;

  for (const model of MODEL_FALLBACKS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await callGeminiOnce(apiKey, model, prompt, attempt);
      } catch (e) {
        if (!(e instanceof GeminiError)) {
          throw e;
        }
        lastError = e;
        const tryNextModel =
          e.status === 404 ||
          e.message.includes("모델을 찾을 수 없습니다");
        const retryable =
          e.status === 502 ||
          e.status === 503 ||
          e.status === 429 ||
          e.message.includes("빈 응답") ||
          e.message.includes("해석하지 못");

        console.warn(
          `[gemini] model=${model} attempt ${attempt}/${MAX_ATTEMPTS} failed (${e.status}): ${e.message}`
        );

        if (tryNextModel) break; // next model in outer loop
        if (!retryable || attempt === MAX_ATTEMPTS) {
          // For hard auth errors, do not burn through models.
          if (e.status === 400 || e.status === 403) throw e;
          break;
        }
        await sleep(RETRY_BASE_MS * attempt);
      }
    }
  }

  throw (
    lastError ??
    new GeminiError("AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.", 502)
  );
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  prompt: string,
  attempt: number
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let response: Response;
  try {
    response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          // Slightly lower temp improves JSON reliability for structured items.
          temperature: attempt === 1 ? 0.55 : 0.35,
        },
      }),
    });
  } catch {
    throw new GeminiError(
      "AI 서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.",
      503
    );
  }

  if (!response.ok) {
    // Try to surface provider message without leaking the API key.
    let providerHint = "";
    try {
      const errBody: unknown = await response.json();
      const msg = extractProviderError(errBody);
      if (msg) providerHint = ` (${msg})`;
    } catch {
      // ignore parse errors on error body
    }

    if (response.status === 429) {
      throw new GeminiError(
        `AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 Google AI Studio에서 할당량을 확인하세요.${providerHint}`,
        429
      );
    }
    if (response.status === 400 || response.status === 403) {
      throw new GeminiError(
        `API 키가 유효하지 않거나 요청이 거부되었습니다. .env.local의 GEMINI_API_KEY / GEMINI_MODEL 을 확인하세요.${providerHint}`,
        response.status
      );
    }
    if (response.status === 404) {
      throw new GeminiError(
        `AI 모델(${model})을 찾을 수 없습니다. GEMINI_MODEL 환경변수를 확인하세요.${providerHint}`,
        404
      );
    }
    if (isRetryableStatus(response.status)) {
      throw new GeminiError(
        `AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.${providerHint}`,
        502
      );
    }
    throw new GeminiError(
      `AI 응답 오류가 발생했습니다. (상태 코드: ${response.status})${providerHint}`,
      response.status
    );
  }

  const data: unknown = await response.json();
  const diagnosis = diagnoseEmpty(data);
  const text = extractText(data);

  if (!text) {
    console.warn("[gemini] empty text", { model, ...diagnosis });
    throw new GeminiError(
      `AI가 빈 응답을 반환했습니다${diagnosis.reason ? ` (${diagnosis.reason})` : ""}. 다시 시도해 주세요.`,
      502
    );
  }

  return text;
}

function extractProviderError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const err = (data as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return null;
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  // Truncate long provider messages.
  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}

function diagnoseEmpty(data: unknown): { reason: string | null } {
  if (typeof data !== "object" || data === null) {
    return { reason: "invalid payload" };
  }
  const obj = data as {
    candidates?: unknown;
    promptFeedback?: { blockReason?: unknown };
  };
  const block = obj.promptFeedback?.blockReason;
  if (typeof block === "string" && block) {
    return { reason: `blocked:${block}` };
  }
  const candidates = obj.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { reason: "no candidates" };
  }
  const first = candidates[0] as {
    finishReason?: unknown;
    content?: { parts?: unknown };
  };
  const finish =
    typeof first.finishReason === "string" ? first.finishReason : null;
  if (finish && finish !== "STOP") {
    return { reason: `finish:${finish}` };
  }
  const parts = first.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return { reason: "no parts" };
  }
  return { reason: null };
}

/**
 * Gemini 응답 JSON 구조에서 실제 생성 텍스트를 안전하게 꺼낸다.
 * 응답 형태: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 */
function extractText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;

  // Some responses split text across parts — join them.
  const chunks: string[] = [];
  for (const part of parts) {
    if (typeof part === "object" && part !== null) {
      const t = (part as { text?: unknown }).text;
      if (typeof t === "string" && t) chunks.push(t);
    }
  }
  if (chunks.length === 0) return null;
  return chunks.join("");
}

/**
 * 모델이 반환한 텍스트를 JSON으로 파싱한다.
 * responseMimeType으로 순수 JSON을 강제했지만, 만약을 대비해
 * 코드펜스(```json ... ```)가 섞여 있으면 제거 후 파싱한다.
 */
export function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Prefer full parse; on failure try first JSON object/array substring.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const startObj = cleaned.indexOf("{");
    const startArr = cleaned.indexOf("[");
    let start = -1;
    if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr);
    else start = Math.max(startObj, startArr);
    if (start >= 0) {
      const slice = cleaned.slice(start);
      // Truncate trailing junk after balanced close (best-effort).
      try {
        return JSON.parse(slice) as T;
      } catch {
        // fall through
      }
    }
    throw new GeminiError(
      "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.",
      502
    );
  }
}

export function getGeminiModelName(): string {
  return PRIMARY_MODEL;
}
