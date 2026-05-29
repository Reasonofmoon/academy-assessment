// ───────────────────────────────────────────────────────────
// Gemini API 호출 헬퍼
//   ⚠️ 이 파일은 "서버(API Route)"에서만 import 해야 한다.
//      절대 클라이언트 컴포넌트에서 import 하지 말 것 — API 키 노출 위험!
// ───────────────────────────────────────────────────────────

// 사용 모델 (빠르고 저렴한 flash 계열)
const GEMINI_MODEL = "gemini-2.0-flash-exp";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 사용자 친화 에러 메시지를 담는 커스텀 에러.
// API Route 에서 이 에러를 잡아 그대로 사용자에게 내려준다.
export class GeminiError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Gemini에 프롬프트를 보내고 "텍스트 응답"을 받아온다.
 * - JSON 응답을 강제하기 위해 responseMimeType: "application/json" 사용.
 * - 키 누락 / 할당량 초과 / 네트워크 오류를 사용자 친화 메시지로 변환한다.
 *
 * @param prompt  모델에게 보낼 지시문
 * @returns       모델이 생성한 원시 텍스트 (JSON 문자열)
 */
export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1) 키 누락 체크 — 가장 흔한 초보자 실수
  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요. (README의 환경변수 설정 가이드 참고)",
      500
    );
  }

  let response: Response;
  try {
    // 2) Gemini 호출
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // JSON 형식 응답 강제 — 모델이 마크다운/잡담 없이 순수 JSON만 반환하도록.
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    });
  } catch {
    // 3) 네트워크 오류 (인터넷 끊김, DNS 실패 등)
    throw new GeminiError(
      "AI 서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.",
      503
    );
  }

  // 4) HTTP 에러 상태 처리
  if (!response.ok) {
    if (response.status === 429) {
      throw new GeminiError(
        "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 Google AI Studio에서 할당량을 확인하세요.",
        429
      );
    }
    if (response.status === 400 || response.status === 403) {
      throw new GeminiError(
        "API 키가 유효하지 않습니다. .env.local의 GEMINI_API_KEY 값을 다시 확인하세요.",
        response.status
      );
    }
    throw new GeminiError(
      `AI 응답 오류가 발생했습니다. (상태 코드: ${response.status})`,
      response.status
    );
  }

  // 5) 응답 본문에서 텍스트 추출
  const data: unknown = await response.json();
  const text = extractText(data);

  if (!text) {
    throw new GeminiError("AI가 빈 응답을 반환했습니다. 다시 시도해 주세요.", 502);
  }

  return text;
}

/**
 * Gemini 응답 JSON 구조에서 실제 생성 텍스트를 안전하게 꺼낸다.
 * 응답 형태: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 * (any 사용 금지 — unknown으로 받고 좁혀가며 접근)
 */
function extractText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;

  const text = (parts[0] as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

/**
 * 모델이 반환한 텍스트를 JSON으로 파싱한다.
 * responseMimeType으로 순수 JSON을 강제했지만, 만약을 대비해
 * 코드펜스(```json ... ```)가 섞여 있으면 제거 후 파싱한다.
 */
export function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiError("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.", 502);
  }
}
