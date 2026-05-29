import type { Config } from "tailwindcss";

// TailwindCSS 설정
// - content: Tailwind가 클래스명을 스캔할 파일 경로 (사용하지 않는 CSS 제거용)
// - theme.extend.colors: 학원 브랜드 컬러를 커스텀 토큰으로 등록
//   → 코드에서 `bg-primary`, `text-accent` 처럼 사용 가능
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary: 깊은 녹색 (학원 메인 컬러)
        primary: {
          DEFAULT: "#08231b",
          light: "#0f3a2c",
        },
        // Accent: 골드 (강조 컬러)
        accent: {
          DEFAULT: "#c9a94d",
          light: "#dcc079",
        },
      },
      fontFamily: {
        // Pretendard를 기본 sans 폰트로 사용 (layout.tsx에서 CDN 로드)
        sans: ["Pretendard", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
