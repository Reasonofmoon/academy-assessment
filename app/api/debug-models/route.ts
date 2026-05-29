import { NextResponse } from "next/server";

// ⚠️ 임시 진단용 라우트 — 사용 가능한 Gemini 모델 목록을 확인한 뒤 삭제한다.
// 보안: API 키 자체는 절대 응답에 포함하지 않고, 모델 이름/지원 메서드만 반환.
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no key" }, { status: 500 });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  const data: unknown = await res.json();

  // generateContent를 지원하는 모델 이름만 추려서 반환
  const models = (data as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> })
    .models;
  const generateModels = (models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name);

  return NextResponse.json({ status: res.status, generateModels, all: models?.map((m) => m.name) });
}
