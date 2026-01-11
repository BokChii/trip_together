import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleAuthCallback } from '../services/authService';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        const session = await handleAuthCallback();
        if (session) {
          // 로그인 성공 - 내 여행 일정 페이지로 이동
          navigate('/my-trips', { replace: true });
        } else {
          // 로그인 실패 - 로그인 페이지로 이동
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('❌ AuthCallbackPage: Error processing callback', error);
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;

