import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { Button } from '../components/Button';
import { SocialLoginButton } from '../components/SocialLoginButton';
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
      // URL 파라미터에서 tripId 가져오기
      const urlParams = new URLSearchParams(window.location.search);
      const tripId = urlParams.get('tripId');
      
      // tripId가 있으면 리디렉션 URL에 포함
      const redirectTo = tripId 
        ? `${window.location.origin}/auth/callback?tripId=${tripId}`
        : `${window.location.origin}/auth/callback`;
      
      await signInWithKakao(redirectTo);
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
      // URL 파라미터에서 tripId 가져오기
      const urlParams = new URLSearchParams(window.location.search);
      const tripId = urlParams.get('tripId');
      
      // tripId가 있으면 리디렉션 URL에 포함
      const redirectTo = tripId 
        ? `${window.location.origin}/auth/callback?tripId=${tripId}`
        : `${window.location.origin}/auth/callback`;
      
      await signInWithGoogle(redirectTo);
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

          {/* 로그인 유도 텍스트 */}
          <div className="mb-3 sm:mb-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-xl">
            <p className="text-xs sm:text-sm text-gray-700 text-center leading-relaxed">
              <span className="font-semibold text-orange-600">로그인</span>해서 내 여행 일정을 관리하고 여러 여행을 저장하세요 ✈️
            </p>
          </div>

          {/* 로그인 버튼들 */}
          <div className="space-y-3">
            <SocialLoginButton
              provider="kakao"
              onClick={handleKakaoLogin}
              disabled={isLoading}
            />
            <SocialLoginButton
              provider="google"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            />
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

