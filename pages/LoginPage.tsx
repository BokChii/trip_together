import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { Button } from '../components/Button';
import { signInWithKakao, signInWithGoogle, getCurrentUser, handleAuthCallback } from '../services/authService';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 이미 로그인되어 있는지 확인
    const checkAuth = async () => {
      const user = await getCurrentUser();
      if (user) {
        // 이미 로그인되어 있으면 내 여행 일정 페이지로 이동
        navigate('/my-trips');
      } else {
        // OAuth 콜백 처리 (URL에 code 파라미터가 있는 경우)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) {
          setIsLoading(true);
          try {
            const session = await handleAuthCallback();
            if (session) {
              navigate('/my-trips');
            }
          } catch (error) {
            console.error('❌ LoginPage: Auth callback error', error);
            alert('로그인 중 오류가 발생했습니다.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithKakao();
      // OAuth 리디렉션이 발생하므로 여기서는 아무것도 하지 않음
    } catch (error) {
      console.error('❌ LoginPage: Kakao login error', error);
      alert('카카오톡 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // OAuth 리디렉션이 발생하므로 여기서는 아무것도 하지 않음
    } catch (error) {
      console.error('❌ LoginPage: Google login error', error);
      alert('구글 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    // 익명 사용자로 계속하기 - 기존 플로우 유지
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-md p-8 space-y-6">
          {/* 로고 및 제목 */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">언제갈래</h1>
              <Plane className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-gray-600">친구들과 함께하는 여행 일정 조율</p>
          </div>

          {/* 로그인 버튼들 */}
          <div className="space-y-3">
            <Button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#000000] font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
              </svg>
              카카오톡으로 시작하기
            </Button>

            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg border border-gray-300 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 시작하기
            </Button>
          </div>

          {/* 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 익명 사용자로 계속하기 */}
          <Button
            onClick={handleContinueAsGuest}
            disabled={isLoading}
            variant="secondary"
            className="w-full"
          >
            익명으로 계속하기
          </Button>

          {/* 안내 문구 */}
          <p className="text-xs text-gray-500 text-center">
            로그인하면 내 여행 일정을 관리하고 여러 여행을 저장할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

