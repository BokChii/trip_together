# Vercel 배포 가이드

## 📋 사전 준비사항

1. ✅ Vercel Analytics 패키지 설치 완료
2. ✅ Analytics 컴포넌트 추가 완료
3. ✅ `.gitignore`에 `.env` 추가 완료

## 🚀 배포 단계

### 1단계: GitHub에 코드 푸시

```bash
# 변경사항 확인
git status

# 변경된 파일 추가
git add .

# 커밋
git commit -m "feat: Vercel Analytics 추가 및 배포 준비"

# GitHub에 푸시
git push origin main
```

### 2단계: Vercel 프로젝트 생성

1. [vercel.com](https://vercel.com) 접속
2. GitHub 계정으로 로그인
3. "Add New Project" 클릭
4. 저장소 선택 (`trip_together`)
5. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (자동 감지)
   - **Output Directory**: `dist` (자동 감지)

### 3단계: 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 추가:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | `https://rntujltzhubjbpmdolbc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `GEMINI_API_KEY` | Gemini API Key | `AIzaSyDhGOz84NTEr4jaUEXr8j5BSD_E70Xhk` |

**참고**: `GEMINI_API_KEY`는 `vite.config.ts`에서 `process.env.GEMINI_API_KEY`로 사용되므로 `VITE_` 접두사가 없어도 됩니다.

### 4단계: 배포 실행

1. "Deploy" 버튼 클릭
2. 배포 완료 대기 (약 1-2분)
3. 배포된 URL 확인 (예: `https://trip-together.vercel.app`)

### 5단계: Analytics 활성화

1. Vercel 대시보드 → 프로젝트 선택
2. "Analytics" 탭 클릭
3. "Enable Web Analytics" 토글 활성화
4. Analytics 데이터 수집 시작 (약 5-10분 후부터 데이터 표시)

## 🔧 추가 설정 (선택사항)

### 커스텀 도메인 연결

1. Vercel 대시보드 → 프로젝트 → Settings → Domains
2. 원하는 도메인 입력
3. DNS 설정 안내에 따라 도메인 제공업체에서 설정

### 환경 변수별 환경 설정

- Production: 프로덕션 환경 변수
- Preview: PR/브랜치별 미리보기 환경 변수
- Development: 로컬 개발 환경 변수

## 📊 Analytics 확인

배포 후 Analytics 탭에서 다음 정보 확인 가능:
- 페이지뷰
- 고유 방문자
- 평균 세션 시간
- 인기 페이지
- 트래픽 소스

## ⚠️ 주의사항

1. **환경 변수 보안**: `.env` 파일은 절대 GitHub에 커밋하지 마세요 (이미 `.gitignore`에 추가됨)
2. **빌드 오류**: 배포 실패 시 Vercel 대시보드의 "Deployments" 탭에서 로그 확인
3. **캐시 문제**: 배포 후 변경사항이 반영되지 않으면 브라우저 캐시 삭제

## 🐛 문제 해결

### 빌드 실패
- `package.json`의 `build` 스크립트 확인
- 환경 변수 누락 확인
- Vercel 로그에서 에러 메시지 확인

### Analytics가 작동하지 않음
- `@vercel/analytics` 패키지 설치 확인
- `App.tsx`에 `<Analytics />` 컴포넌트 추가 확인
- Vercel 대시보드에서 Analytics 활성화 확인

### 환경 변수 인식 안 됨
- 변수명 앞에 `VITE_` 접두사 확인 (Vite 프로젝트의 경우)
- Vercel에서 환경 변수 저장 후 재배포

## 📝 참고 링크

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vercel Analytics 문서](https://vercel.com/docs/analytics)
- [Vite 환경 변수 가이드](https://vitejs.dev/guide/env-and-mode.html)

