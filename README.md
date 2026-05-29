# 영어 학력 진단 평가 도구 (Academy Assessment)

한국 영어 학원을 위한 **AI 기반 학생 영어 학력 진단 도구**입니다.
강사가 학년·영역을 고르면 Gemini AI가 문제를 자동 생성하고, 학생 답안을 자동 채점·피드백한 뒤, 인쇄(PDF) 가능한 리포트를 출력합니다.
어휘·문법·독해 3개 영역, 학년별 CEFR(A1~B2) 난이도 자동 매칭을 지원합니다.

---

## 🖥 로컬 실행 방법

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 파일 만들기
#    .env.local.example 을 복사해서 .env.local 로 저장한 뒤
#    GEMINI_API_KEY 값에 본인 키를 입력하세요.
#    (Windows PowerShell)
copy .env.local.example .env.local

# 3) 개발 서버 실행
npm run dev
```

실행 후 브라우저에서 **http://localhost:3000** 으로 접속하세요.

### Gemini API 키 발급
1. https://aistudio.google.com/app/apikey 접속
2. **Create API Key** 클릭 → 키 복사
3. `.env.local` 파일의 `GEMINI_API_KEY=` 뒤에 붙여넣기

---

## 🚀 Vercel 배포 방법

1. 이 프로젝트를 **GitHub**에 push 합니다.
2. [Vercel](https://vercel.com) 에서 **New Project → Import** 로 해당 저장소를 가져옵니다.
3. **Settings → Environment Variables** 에 다음을 등록합니다.
   - Key: `GEMINI_API_KEY`
   - Value: (발급받은 Gemini API 키)
4. **Deploy** 버튼을 누르면 배포가 완료됩니다.

> ⚠️ `.env.local` 은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.
> 따라서 배포 환경에서는 반드시 Vercel 대시보드에 환경변수를 따로 등록해야 합니다.

---

## 👨‍🏫 학원 원장용 사용 가이드 (3줄)

1. **학생 정보**(이름·학년·강사명)를 입력하고 **진단 영역**(어휘/문법/독해)을 1~3개 고른 뒤 **[AI 문제 자동 생성]**을 누릅니다.
2. 학생이 화면에서 답을 작성하고 **[제출하고 채점하기]**를 누르면 AI가 자동 채점·진단합니다.
3. 결과 화면에서 **[인쇄하기]** 또는 `Ctrl+P → PDF로 저장`으로 리포트를 출력해 학부모 상담에 활용하세요.

---

## 🔐 보안 원칙

- Gemini API 키는 **서버(API Route)에서만** 사용되며, 브라우저(클라이언트)에 절대 노출되지 않습니다.
- 모든 AI 호출(`/api/generate-questions`, `/api/evaluate`)은 서버에서 처리됩니다.
- `.env.local` 은 Git에 커밋되지 않습니다.

---

## 📁 프로젝트 구조

```
academy-assessment/
├── app/
│   ├── page.tsx                      # 메인 평가 페이지 (SPA 흐름 제어)
│   ├── layout.tsx                    # 공통 레이아웃 + Pretendard 폰트
│   ├── globals.css                   # 전역 스타일 + A4 인쇄 최적화 CSS
│   └── api/
│       ├── generate-questions/route.ts   # 문제 생성 (서버)
│       └── evaluate/route.ts             # 자동 채점·평가 (서버)
├── components/
│   ├── StudentForm.tsx               # 학생 정보 입력
│   ├── DomainSelector.tsx            # 진단 영역 선택
│   ├── QuestionList.tsx              # 답안 작성 폼
│   └── ResultReport.tsx              # 인쇄용 결과 리포트
├── lib/
│   ├── gemini.ts                     # Gemini API 호출 헬퍼 (에러 처리 포함)
│   └── types.ts                      # 공유 타입 & Zod 검증 스키마
├── .env.local.example                # 환경변수 템플릿
├── .gitignore                        # .env.local 제외
└── README.md
```

---

## 🎨 커스터마이징 팁 (원장님용)

| 바꾸고 싶은 것 | 수정할 파일 / 위치 |
| --- | --- |
| 학원 이름 | `app/page.tsx` 상단 `ACADEMY_NAME` |
| 브랜드 색상 | `tailwind.config.ts` 의 `primary`, `accent` |
| 학원 로고 | `components/ResultReport.tsx` 의 "학원 로고" 자리 |
| AI 모델 | `lib/gemini.ts` 의 `GEMINI_MODEL` |
| 문제 난이도/유형 | `app/api/generate-questions/route.ts` 의 프롬프트 |

---

## 🛠 기술 스택

- **Next.js 14** (App Router) · **TypeScript** (strict)
- **TailwindCSS** · **Pretendard** (한글 폰트)
- **Zod** (런타임 데이터 검증)
- **Google Gemini API** (`gemini-2.0-flash-exp`)
