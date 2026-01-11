import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Plus, Trash2, Calendar, MapPin, Users, LogOut } from 'lucide-react';
import { Button } from '../components/Button';
import { getCurrentUser, signOut, getUserProfile } from '../services/authService';
import { getUserCreatedTrips, getUserParticipatedTrips, deleteTrip, Trip } from '../services/tripService';

const MyTripsPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [createdTrips, setCreatedTrips] = useState<Trip[]>([]);
  const [participatedTrips, setParticipatedTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          navigate('/login');
          return;
        }

        setUser(currentUser);

        // 프로필 로드
        const profile = await getUserProfile(currentUser.id);
        setUserProfile(profile);

        // 여행 목록 로드
        const [created, participated] = await Promise.all([
          getUserCreatedTrips(currentUser.id),
          getUserParticipatedTrips(currentUser.id)
        ]);

        setCreatedTrips(created);
        setParticipatedTrips(participated);
      } catch (error) {
        console.error('❌ MyTripsPage: Error loading data', error);
        alert('데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleCreateTrip = () => {
    navigate('/');
  };

  const handleTripClick = (shareCode: string) => {
    // 로그인 상태 확인 후 바로 캘린더로 이동
    if (user) {
      navigate(`/?trip=${shareCode}`);
    } else {
      // 로그인하지 않은 경우 로그인 페이지로 이동
      navigate('/login');
    }
  };

  const handleDeleteTrip = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) return;
    
    if (!confirm('정말 이 여행 일정을 삭제하시겠어요?')) {
      return;
    }

    setIsDeleting(tripId);
    try {
      await deleteTrip(tripId, user.id);
      // 목록에서 제거
      setCreatedTrips(prev => prev.filter(t => t.id !== tripId));
      setParticipatedTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (error: any) {
      console.error('❌ MyTripsPage: Error deleting trip', error);
      if (error.message === 'Only the creator can delete this trip') {
        alert('여행 일정을 삭제할 권한이 없습니다.');
      } else {
        alert('여행 일정 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('❌ MyTripsPage: Error signing out', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const displayName = userProfile?.display_name || user?.email?.split('@')[0] || '사용자';

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12 sm:h-16 items-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="bg-orange-600 p-1 sm:p-1.5 rounded-lg">
                <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" />
              </div>
              <span className="font-bold text-xl sm:text-2xl text-gray-900 tracking-tight">언제갈래</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline-block text-sm text-gray-600 bg-orange-50/50 px-3 py-1 rounded-lg">
                반가워요, <strong className="text-orange-700">{displayName}</strong>님
              </span>
              <button 
                onClick={handleLogout}
                className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">내 여행 일정</h1>
          <p className="text-gray-600">생성한 여행과 참여한 여행을 관리하세요</p>
        </div>

        {/* 새 여행 만들기 버튼 */}
        <div className="mb-6">
          <Button
            onClick={handleCreateTrip}
            className="w-full sm:w-auto"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            새로운 여행 만들기
          </Button>
        </div>

        {/* 생성한 여행 */}
        {createdTrips.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plane className="w-5 h-5 text-orange-600" />
              내가 만든 여행 ({createdTrips.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {createdTrips.map(trip => (
                <div
                  key={trip.id}
                  onClick={() => handleTripClick(trip.share_code)}
                  className="bg-white rounded-xl p-5 shadow-sm border border-orange-100/50 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex-1">
                      {trip.title || trip.destination}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteTrip(trip.id, e)}
                      disabled={isDeleting === trip.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-600"
                    >
                      {isDeleting === trip.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <span>{trip.destination}</span>
                    </div>
                    {trip.start_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span>
                          {new Date(trip.start_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          {trip.end_date && ` ~ ${new Date(trip.end_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-orange-100">
                    <p className="text-xs text-gray-400">공유 코드: {trip.share_code}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 참여한 여행 */}
        {participatedTrips.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              참여한 여행 ({participatedTrips.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {participatedTrips.map(trip => (
                <div
                  key={trip.id}
                  onClick={() => handleTripClick(trip.share_code)}
                  className="bg-white rounded-xl p-5 shadow-sm border border-orange-100/50 hover:shadow-md transition-all cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {trip.title || trip.destination}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <span>{trip.destination}</span>
                    </div>
                    {trip.start_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span>
                          {new Date(trip.start_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          {trip.end_date && ` ~ ${new Date(trip.end_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-orange-100">
                    <p className="text-xs text-gray-400">공유 코드: {trip.share_code}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {createdTrips.length === 0 && participatedTrips.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-orange-100/50">
            <Plane className="w-16 h-16 text-orange-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">아직 여행 일정이 없어요</h3>
            <p className="text-gray-600 mb-6">새로운 여행 일정을 만들어보세요!</p>
            <Button onClick={handleCreateTrip}>
              <Plus className="w-5 h-5 mr-2" />
              여행 만들기
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyTripsPage;

