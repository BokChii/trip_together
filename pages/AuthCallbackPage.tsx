import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUserProfile, upsertUserProfile } from '../services/authService';
import { updateAllTripUsersAuthId, getTripByShareCode } from '../services/tripService';
import { supabase } from '../supabase/client';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // URL에서 code 파라미터 확인
        const code = searchParams.get('code');
        let session = null;

        // code가 있으면 세션 교환 (OAuth 콜백 처리)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('❌ AuthCallbackPage: Error exchanging code for session', error);
            navigate('/login', { replace: true });
            return;
          }
          session = data?.session;
        } else {
          // code가 없으면 기존 세션 확인 (이미 로그인된 경우)
          const { data: { session: existingSession }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('❌ AuthCallbackPage: Error getting session', error);
            navigate('/login', { replace: true });
            return;
          }
          session = existingSession;
        }

        if (session && session.user) {
          // 프로필 생성 (없는 경우에만)
          const existingProfile = await getUserProfile(session.user.id);
          if (!existingProfile) {
            const displayName = session.user.user_metadata?.full_name 
              || session.user.user_metadata?.name 
              || session.user.user_metadata?.nickname
              || '사용자';
            
            const avatarUrl = null; // 현재는 프로필 이미지 미사용
            
            try {
              await upsertUserProfile(session.user.id, displayName, avatarUrl);
            } catch (error) {
              console.error('❌ AuthCallbackPage: Error creating profile', error);
            }
          }

          const authUserId = session.user.id;
          
          // 현재 참여 중인 모든 여행의 auth_user_id 업데이트
          // localStorage에서 현재 사용자 정보 가져오기
          const storedUser = localStorage.getItem('tripsync_user');
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              // 해당 user_id로 참여한 모든 여행의 auth_user_id 업데이트
              await updateAllTripUsersAuthId(user.id, authUserId);
            } catch (error) {
              console.error('❌ AuthCallbackPage: Error updating trip users', error);
            }
          }
          
          // URL 파라미터로 tripId가 있으면 해당 여행으로 이동
          const tripId = searchParams.get('tripId');
          if (tripId) {
            try {
              // tripId는 실제로는 shareCode일 수도 있고, 실제 trip id일 수도 있음
              // 일단 shareCode로 시도
              const trip = await getTripByShareCode(tripId);
              if (trip) {
                navigate(`/?trip=${trip.share_code}`, { replace: true });
                return;
              }
            } catch (error) {
              // shareCode가 아니면 trip id일 수도 있으므로 직접 조회 시도
              try {
                const { data: tripData, error: tripError } = await supabase
                  .from('trips')
                  .select('share_code')
                  .eq('id', tripId)
                  .single();
                
                if (!tripError && tripData) {
                  navigate(`/?trip=${tripData.share_code}`, { replace: true });
                  return;
                }
              } catch (err) {
                console.error('❌ AuthCallbackPage: Error finding trip by id', err);
              }
            }
          }
          
          // tripId가 없거나 찾을 수 없으면 내 여행 일정 페이지로 이동
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
  }, [navigate, searchParams]);

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

