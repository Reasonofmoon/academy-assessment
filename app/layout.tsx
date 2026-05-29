import type { Metadata } from "next";
import "./globals.css";

// 페이지 메타데이터 (브라우저 탭 제목 등)
export const metadata: Metadata = {
  title: "영어 학력 진단 평가 도구",
  description: "AI 기반 학생 영어 학력 진단 · 자동 채점 · 리포트 출력",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* 한글 폰트 Pretendard — CDN 로드 (별도 설치 불필요) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
