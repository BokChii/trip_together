import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 현재 모드(development/production)에 맞는 .env 파일 로드
  // Vercel 환경변수 중 VITE_로 시작하는 것들을 불러옴
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // 코드 내의 process.env.API_KEY를 빌드 시점의 문자열 값으로 치환
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || ''),
    },
  };
});