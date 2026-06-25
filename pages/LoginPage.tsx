import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { SocialLoginButton } from '../components/SocialLoginButton';
import { useAppDialog } from '../hooks/useAppDialog';
import { signInWithKakao, signInWithGoogle, getCurrentUser, handleAuthCallback } from '../services/authService';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { alert, DialogHost } = useAppDialog();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      if (user) {
        navigate('/my-trips');
      } else {
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
            void alert('로그인 중 오류가 발생했습니다.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    };

    checkAuth();
  }, [navigate, alert]);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tripId = urlParams.get('tripId');
      const redirectTo = tripId
        ? `${window.location.origin}/auth/callback?tripId=${tripId}`
        : `${window.location.origin}/auth/callback`;

      await signInWithKakao(redirectTo);
    } catch (error) {
      console.error('❌ LoginPage: Kakao login error', error);
      void alert('카카오톡 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tripId = urlParams.get('tripId');
      const redirectTo = tripId
        ? `${window.location.origin}/auth/callback?tripId=${tripId}`
        : `${window.location.origin}/auth/callback`;

      await signInWithGoogle(redirectTo);
    } catch (error) {
      console.error('❌ LoginPage: Google login error', error);
      void alert('구글 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card padding="lg" className="space-y-6">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="bg-orange-600 p-1.5 rounded-lg">
                <Plane className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">언제갈래</h1>
            </div>
            <p className="text-sm text-stone-600">친구들과 함께 여행 날짜를 맞춰보세요</p>
          </div>

          <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-lg">
            <p className="text-xs sm:text-sm text-stone-600 text-center leading-relaxed">
              <span className="font-medium text-orange-600">로그인</span>하면 내 여행 일정을 저장하고 관리할 수 있어요
            </p>
          </div>

          <div className="space-y-3">
            <SocialLoginButton provider="kakao" onClick={handleKakaoLogin} disabled={isLoading} />
            <SocialLoginButton provider="google" onClick={handleGoogleLogin} disabled={isLoading} />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">또는</span>
            </div>
          </div>

          <Button onClick={handleContinueAsGuest} disabled={isLoading} variant="secondary" className="w-full">
            익명으로 계속하기
          </Button>

          <p className="text-xs text-stone-500 text-center">
            로그인하면 여러 여행 일정을 저장할 수 있습니다.
          </p>
        </Card>
      </div>
      <DialogHost />
    </div>
  );
};

export default LoginPage;
