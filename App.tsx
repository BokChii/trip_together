import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Calendar } from './components/Calendar';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { DateVote, User, VoteType } from './types';
import { MapPin, Plane, Share2, Check, Copy, X, ArrowRight, CalendarHeart, Calendar as CalendarIcon, PlusCircle, User as UserIcon } from 'lucide-react';
import { generateItinerary } from './services/geminiService';
import {
  createTrip,
  getTripByShareCode,
  getTripUsers,
  getDateVotes,
  addTripUser,
  upsertDateVote,
  upsertDateVotesBatch,
  deleteDateVotes,
  updateTripDestination,
  subscribeToTrip,
  subscribeToTripUsers,
  subscribeToDateVotes
} from './services/tripService';

// Short ID generator (6 chars)
const generateId = () => Math.random().toString(36).substring(2, 8);

const App: React.FC = () => {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [votes, setVotes] = useState<DateVote[]>([]);
  const [voteMode, setVoteMode] = useState<VoteType>('available');
  
  // Trip State
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);
  const [tripStartDate, setTripStartDate] = useState<string | null>(null);
  const [tripEndDate, setTripEndDate] = useState<string | null>(null);
  
  // 기간 설정 State (최초 유저용)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  // Share State
  const [isCopied, setIsCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  
  // AI Itinerary State
  const [destination, setDestination] = useState('제주도');
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal State
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Selected User for Highlighting
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 중복 실행 방지를 위한 ref
  const hasInitialized = useRef(false);

  // Initialize Trip from URL (기존 Trip 로드만, 새로 생성하지 않음)
  useEffect(() => {
    // 이미 초기화되었으면 스킵
    if (hasInitialized.current) {
      console.log('⏭️ initTrip: Already initialized, skipping...');
      return;
    }

    const initTrip = async () => {
      console.log('🚀 initTrip: Starting trip initialization...');
      hasInitialized.current = true;
      setIsLoadingTrip(true);
      
      try {
        // URL에서 share_code 확인
        const params = new URLSearchParams(window.location.search);
        const code = params.get('trip');
        console.log('🔗 initTrip: URL trip code', code || 'none');

        if (code) {
          // 기존 Trip 로드
          console.log('📥 initTrip: Loading existing trip...', { code });
          const trip = await getTripByShareCode(code);
          if (trip) {
            console.log('✅ initTrip: Trip loaded', { tripId: trip.id, shareCode: trip.share_code, destination: trip.destination });
            
            setCurrentTripId(trip.id);
            setShareCode(trip.share_code);
            setDestination(trip.destination);
            setTripStartDate(trip.start_date || null);
            setTripEndDate(trip.end_date || null);

            // Load users and votes
            console.log('📊 initTrip: Loading users and votes...');
            const tripUsers = await getTripUsers(trip.id);
            const tripVotes = await getDateVotes(trip.id);
            console.log('✅ initTrip: Data loaded', { usersCount: tripUsers.length, votesCount: tripVotes.length });

            setUsers(tripUsers);
            setVotes(tripVotes);

            // Local user가 있으면 추가 (하지만 currentUser는 설정하지 않음 - 로그인 화면 유지)
            const savedUserStr = localStorage.getItem('tripsync_user');
            if (savedUserStr) {
              try {
                const localUser = JSON.parse(savedUserStr);
                console.log('👤 initTrip: Found saved user, adding to trip...', { userId: localUser.id, userName: localUser.name });
                await addTripUser(trip.id, localUser);
                console.log('✅ initTrip: Saved user added to trip');
              } catch (error) {
                console.error("❌ initTrip: Failed to add user to trip", error);
              }
            }
          } else {
            console.warn('⚠️ initTrip: Trip not found');
            alert("존재하지 않는 여행 일정입니다.");
          }
        } else {
          // URL에 trip 코드가 없으면 Trip 생성하지 않음
          // 사용자가 로그인할 때 생성됨
          console.log('📝 initTrip: No trip code in URL, waiting for user login...');
        }
      } catch (error) {
        console.error("❌ initTrip: Failed to initialize trip", error);
        alert("일정을 불러오는데 실패했습니다.");
        hasInitialized.current = false; // 에러 시 재시도 가능하도록
      } finally {
        setIsLoadingTrip(false);
        console.log('✅ initTrip: Initialization complete');
      }
    };

    initTrip();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentTripId) {
      console.log('📡 Subscriptions: No tripId, skipping subscriptions');
      return;
    }

    console.log('📡 Subscriptions: Setting up real-time subscriptions', { tripId: currentTripId });

    // Subscribe to trip changes
    const tripSubscription = subscribeToTrip(currentTripId, (trip) => {
      console.log('📡 Subscription: Trip updated', { destination: trip.destination });
      setDestination(trip.destination);
      setTripStartDate(trip.start_date || null);
      setTripEndDate(trip.end_date || null);
    });

    // Subscribe to user changes
    const usersSubscription = subscribeToTripUsers(currentTripId, (updatedUsers) => {
      console.log('📡 Subscription: Users updated', { count: updatedUsers.length, users: updatedUsers.map(u => u.name) });
      setUsers(updatedUsers);
    });

    // Subscribe to vote changes
    const votesSubscription = subscribeToDateVotes(currentTripId, (updatedVotes) => {
      console.log('📡 Subscription: Votes updated', { count: updatedVotes.length });
      setVotes(updatedVotes);
    });

    console.log('✅ Subscriptions: All subscriptions active');

    return () => {
      console.log('🔌 Subscriptions: Cleaning up subscriptions');
      tripSubscription.unsubscribe();
      usersSubscription.unsubscribe();
      votesSubscription.unsubscribe();
    };
  }, [currentTripId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    
    // 이름 입력 필드에서는 항상 새 유저로 생성
    // 기존 유저 재접속은 하단 버튼으로만 가능
    const newUser: User = {
      id: generateId(),
      name: nameInput.trim()
    };
    
    confirmUser(newUser);
  };

  const confirmUser = async (user: User) => {
    console.log('👤 confirmUser: Starting', { userId: user.id, userName: user.name });
    setCurrentUser(user);
    localStorage.setItem('tripsync_user', JSON.stringify(user));

    // Trip이 없으면 생성 (사용자가 로그인할 때 생성)
    if (!currentTripId) {
      console.log('📝 confirmUser: No trip exists, creating new trip...');
      setIsLoadingTrip(true);
      try {
        const newTrip = await createTrip(
          destination,
          startDateInput || null,
          endDateInput || null
        );
        console.log('✅ confirmUser: Trip created', { tripId: newTrip.id, shareCode: newTrip.share_code });
        setCurrentTripId(newTrip.id);
        setShareCode(newTrip.share_code);
        setTripStartDate(newTrip.start_date || null);
        setTripEndDate(newTrip.end_date || null);
        
        // 사용자 추가
        console.log('👤 confirmUser: Adding user to new trip...');
        await addTripUser(newTrip.id, user);
        console.log('✅ confirmUser: User added to trip successfully');
        
        // 초기 데이터 로드
        const tripUsers = await getTripUsers(newTrip.id);
        const tripVotes = await getDateVotes(newTrip.id);
        setUsers(tripUsers);
        setVotes(tripVotes);
        console.log('✅ confirmUser: Initial data loaded', { usersCount: tripUsers.length, votesCount: tripVotes.length });
      } catch (error) {
        console.error("❌ confirmUser: Failed to create trip and add user", error);
        alert("일정 생성에 실패했습니다. 다시 시도해주세요.");
        setCurrentUser(null); // 실패 시 로그인 상태 리셋
      } finally {
        setIsLoadingTrip(false);
      }
    } else {
      // Trip이 있으면 사용자 추가
      console.log('👤 confirmUser: Trip exists, adding user...', { tripId: currentTripId });
      try {
        await addTripUser(currentTripId, user);
        console.log('✅ confirmUser: User added to existing trip successfully');
        // Users will be updated via subscription
      } catch (error) {
        console.error("❌ confirmUser: Failed to add user", error);
        alert("사용자 추가에 실패했습니다.");
      }
    }
  };

  /**
   * 투표 처리 함수
   * @param dateIsoOrList 날짜 문자열 또는 날짜 문자열 배열
   * @param shouldRemove true일 경우 해당 날짜의 투표를 삭제(취소)함. undefined일 경우 기존 토글 로직.
   */
  const handleVote = async (dateIsoOrList: string | string[], shouldRemove?: boolean) => {
    if (!currentUser) {
      console.warn("⚠️ handleVote: currentUser is null");
      alert("먼저 로그인해주세요.");
      return;
    }
    if (!currentTripId) {
      console.warn("⚠️ handleVote: currentTripId is null");
      alert("일정을 불러오는 중입니다. 잠시만 기다려주세요.");
      return;
    }

    const datesToUpdate = Array.isArray(dateIsoOrList) ? dateIsoOrList : [dateIsoOrList];

    // Optimistic Update를 위한 이전 상태 저장 (에러 시 복구용)
    const previousVotes = [...votes];

    try {
      if (shouldRemove) {
        // 삭제 - Optimistic Update
        setVotes(prev => prev.filter(v => 
          !(datesToUpdate.includes(v.date) && v.userId === currentUser.id)
        ));
        
        await deleteDateVotes(currentTripId, datesToUpdate, currentUser.id);
      } else {
        // 단일 클릭의 경우 토글 로직
        if (shouldRemove === undefined && !Array.isArray(dateIsoOrList)) {
          const existingVote = votes.find(v => v.date === dateIsoOrList && v.userId === currentUser.id);
          if (existingVote && existingVote.type === voteMode) {
            // 이미 선택된 상태면 삭제 - Optimistic Update
            setVotes(prev => prev.filter(v => 
              !(v.date === dateIsoOrList && v.userId === currentUser.id)
            ));
            
            await deleteDateVotes(currentTripId, [dateIsoOrList], currentUser.id);
            return;
          }
        }

        // 추가/업데이트 - Optimistic Update
        setVotes(prev => {
          // 기존 투표 제거
          const filtered = prev.filter(v => 
            !(datesToUpdate.includes(v.date) && v.userId === currentUser.id)
          );
          // 새 투표 추가
          const newVotes = datesToUpdate.map(date => ({
            date,
            userId: currentUser.id,
            type: voteMode
          }));
          return [...filtered, ...newVotes];
        });

        // DB 저장 - 배치로 한 번에 저장
        await upsertDateVotesBatch(
          currentTripId,
          datesToUpdate.map(date => ({
            date,
            userId: currentUser.id,
            voteType: voteMode
          }))
        );
      }
      // 구독은 다른 사용자의 변경사항을 받기 위해 유지
    } catch (error) {
      console.error("❌ handleVote: Failed to vote", error);
      // 에러 시 이전 상태로 복구
      setVotes(previousVotes);
      
      // DB에서 최신 상태 다시 로드 시도
      try {
        const updatedVotes = await getDateVotes(currentTripId);
        setVotes(updatedVotes);
      } catch (reloadError) {
        console.error("❌ handleVote: Failed to reload votes", reloadError);
      }
      alert("투표 저장에 실패했습니다.");
    }
  };


  const handleShare = async () => {
    if (!shareCode) {
      alert("일정을 불러오는 중입니다. 잠시만 기다려주세요.");
      return;
    }

    try {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}?trip=${shareCode}`;

      setGeneratedUrl(url);

      try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (clipErr) {
        console.warn("Clipboard failed", clipErr);
      }
    } catch (e) {
      console.error("Failed to generate URL", e);
      alert("링크 생성에 실패했습니다.");
    }
  };

  const handleDestinationChange = async (newDestination: string) => {
    setDestination(newDestination);

    if (currentTripId) {
      try {
        await updateTripDestination(currentTripId, newDestination);
        // Destination will be updated via subscription
      } catch (error) {
        console.error("Failed to update destination", error);
      }
    }
  };

  const handleGenerateItinerary = async () => {
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
        if (v.type === 'available') {
            voteCounts[v.date] = (voteCounts[v.date] || 0) + 1;
        }
    });

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    if (maxVotes === 0) {
        alert("먼저 가능한 날짜를 선택해주세요!");
        return;
    }

    const bestDates = Object.keys(voteCounts).filter(d => voteCounts[d] === maxVotes).sort();
    const startDate = bestDates[0];
    const endDate = bestDates[bestDates.length - 1];

    if (!startDate) return;

    setIsGenerating(true);
    const plan = await generateItinerary({
        destination,
        startDate,
        endDate: endDate || startDate
    });
    setItinerary(plan);
    setIsGenerating(false);
  };

  const handleNewTrip = () => {
    setShowNewTripModal(true);
  };

  const confirmNewTrip = () => {
    // 모든 상태 초기화
    setCurrentUser(null);
    setCurrentTripId(null);
    setShareCode(null);
    setUsers([]);
    setVotes([]);
    setDestination('제주도');
    setTripStartDate(null);
    setTripEndDate(null);
    setStartDateInput('');
    setEndDateInput('');
    setGeneratedUrl(null);
    setIsCopied(false);
    setItinerary(null);
    setNameInput('');
    
    // 초기화 ref 리셋
    hasInitialized.current = false;
    
    // URL에서 trip 파라미터 제거
    window.history.pushState({}, '', window.location.pathname);
    
    setShowNewTripModal(false);
  };

  const handleExit = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    setCurrentUser(null);
    localStorage.removeItem('tripsync_user');
    setShowExitModal(false);
  };

  // Loading state
  if (isLoadingTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff7ed]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff7ed] p-4 font-sans">
        <div className="bg-white p-10 sm:p-12 rounded-[2rem] shadow-xl shadow-orange-100 max-w-xl w-full text-center border border-orange-50">
          <div className="mb-8 flex justify-center">
            <div className="bg-orange-100 p-6 rounded-full animate-bounce">
              <Plane className="w-12 h-12 text-orange-500" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-hand font-bold text-gray-800 mb-4">언제갈래? ✈️</h1>
          <p className="text-base sm:text-lg text-gray-500 mb-10 leading-relaxed">
            친구들과 떠나는 설레는 여행!<br/>
            우리 언제 떠날지 여기에서 정해봐요.
          </p>
          
          {/* 초대 링크 접속 시 기간 표시 */}
          {currentTripId && (tripStartDate || tripEndDate) && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">여행 기간</span>
              </div>
              <p className="text-sm text-orange-700">
                {tripStartDate && tripEndDate 
                  ? `${new Date(tripStartDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} ~ ${new Date(tripEndDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`
                  : tripStartDate 
                    ? `${new Date(tripStartDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}부터`
                    : tripEndDate
                      ? `${new Date(tripEndDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}까지`
                      : ''
                }
              </p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5 mb-10">
            <input
              type="text"
              placeholder="닉네임이 뭐에요?"
              className="w-full px-8 py-5 rounded-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-center text-xl font-medium placeholder:text-gray-400 text-gray-900"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            
            {/* 최초 유저만 기간 설정 표시 */}
            {!currentTripId && users.length === 0 && (
              <div className="pt-2 pb-1">
                <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarIcon className="w-5 h-5 text-orange-500" />
                    <p className="text-base font-medium text-gray-700">여행 기간 설정 <span className="text-sm text-gray-400 font-normal">(선택)</span></p>
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <div className="flex-1 relative min-w-0">
                      <label className="block text-sm text-gray-600 mb-2 pl-1 font-medium">시작일</label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none" />
                        <input
                          type="date"
                          className="w-full pl-10 pr-3 py-3 rounded-xl bg-white border-2 border-orange-100 focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm text-gray-900 shadow-sm hover:border-orange-200"
                          value={startDateInput}
                          onChange={(e) => setStartDateInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-end pb-8">
                      <span className="text-orange-400 font-bold text-lg">~</span>
                    </div>
                    <div className="flex-1 relative min-w-0">
                      <label className="block text-sm text-gray-600 mb-2 pl-1 font-medium">종료일</label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none" />
                        <input
                          type="date"
                          className="w-full pl-10 pr-3 py-3 rounded-xl bg-white border-2 border-orange-100 focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm text-gray-900 shadow-sm hover:border-orange-200"
                          value={endDateInput}
                          onChange={(e) => setEndDateInput(e.target.value)}
                          min={startDateInput || undefined}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Button type="submit" className="w-full text-xl py-6 shadow-lg shadow-orange-200" size="lg">시작하기</Button>
          </form>

          {/* Existing Users Selection for Re-login */}
          {users.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                  <p className="text-sm text-gray-400 mb-3 font-medium">이미 참여하고 있나요? 이름을 클릭하세요 👇</p>
                  <div className="flex flex-wrap justify-center gap-2">
                      {users.map(u => (
                          <button
                            key={u.id}
                            onClick={() => confirmUser(u)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-orange-50 text-gray-600 hover:text-orange-600 rounded-full text-sm border-2 border-gray-100 hover:border-orange-200 transition-all"
                          >
                              <span className="font-bold">{u.name}</span>
                              <ArrowRight className="w-3 h-3" />
                          </button>
                      ))}
                  </div>
              </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff7ed] text-gray-900 pb-20 font-sans">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
               <div className="bg-orange-500 p-1.5 rounded-lg">
                   <Plane className="w-4 h-4 text-white" fill="currentColor" />
               </div>
               <span className="font-hand font-bold text-2xl text-gray-800 tracking-tight pt-1">언제갈래</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleNewTrip}
                className="text-xs sm:text-sm font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">새로운 일정 만들기</span>
                <span className="sm:hidden">새 일정</span>
              </button>
              <span className="hidden sm:inline-block text-sm text-gray-500 bg-orange-50 px-3 py-1 rounded-full">
                반가워요, <strong className="text-orange-600">{currentUser.name}</strong>님! 👋
              </span>
              <button onClick={handleExit} className="text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors">나가기</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Controls */}
        <div className="flex flex-col gap-5 bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-orange-50">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
             <div className="flex flex-col gap-1">
               <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   <CalendarHeart className="w-6 h-6 text-orange-500" />
                   언제가 좋으세요?
               </h2>
               <p className="text-sm text-gray-500 pl-1">드래그해서 여러 날짜를 쓱- 선택해보세요.</p>
             </div>
             
             <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
               <ModeToggle mode={voteMode} setMode={setVoteMode} />
               <div className="h-8 w-px bg-gray-100 hidden sm:block mx-1"></div>
               <Button 
                  variant="secondary" 
                  size="md" 
                  onClick={handleShare} 
                  className={`gap-2 flex-1 sm:flex-none justify-center transition-all duration-300 ${isCopied ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
               >
                  {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {isCopied ? "복사완료!" : "초대하기"}
               </Button>
             </div>
           </div>

           {/* Generated Link Display */}
           {generatedUrl && (
             <div className="animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                 <input 
                   type="text" 
                   readOnly 
                   value={generatedUrl} 
                   className="flex-1 bg-white border border-orange-200 rounded-lg px-4 py-2.5 text-xs sm:text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
                   onClick={(e) => e.currentTarget.select()}
                 />
                 <Button size="sm" onClick={() => {
                    navigator.clipboard.writeText(generatedUrl);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                 }}>
                   {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                 </Button>
                 <button onClick={() => setGeneratedUrl(null)} className="p-2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                 </button>
               </div>
               <p className="text-xs text-orange-600 mt-2 ml-2 font-medium">✨ 이 링크를 친구들에게 보내주세요!</p>
             </div>
           )}
        </div>

        {/* Participants List */}
        {users.length > 1 && (
          <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-orange-50">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-700">참여자</h3>
              <span className="text-xs text-gray-400">({users.length}명)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {users.map(user => {
                const isSelected = selectedUserId === user.id;
                const userVotes = votes.filter(v => v.userId === user.id);
                const availableCount = userVotes.filter(v => v.type === 'available').length;
                const unavailableCount = userVotes.filter(v => v.type === 'unavailable').length;
                
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(isSelected ? null : user.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-orange-500 text-white shadow-md scale-105'
                        : 'bg-orange-50 text-orange-700 hover:bg-orange-100 hover:scale-105'
                    }`}
                  >
                    <span>{user.name}</span>
                    {availableCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/30' : 'bg-orange-200'
                      }`}>
                        가능 {availableCount}
                      </span>
                    )}
                    {unavailableCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/30' : 'bg-gray-200'
                      }`}>
                        불가 {unavailableCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedUserId && (
              <p className="text-xs text-orange-600 mt-3 font-medium">
                👆 {users.find(u => u.id === selectedUserId)?.name}님이 선택한 날짜만 표시됩니다
              </p>
            )}
          </div>
        )}

        {/* Calendar */}
        <Calendar 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          votes={votes}
          users={users}
          currentUserId={currentUser.id}
          voteMode={voteMode}
          onVote={handleVote}
          startDate={tripStartDate}
          endDate={tripEndDate}
          selectedUserId={selectedUserId}
        />

        {/* AI Itinerary Section */}
        <div className="bg-gradient-to-br from-orange-400 to-rose-400 rounded-[2rem] p-6 sm:p-10 text-white shadow-xl shadow-orange-200 overflow-hidden relative">
           {/* Background Decoration */}
           <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
           <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-yellow-300/20 rounded-full blur-2xl"></div>

           <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-orange-50 font-medium bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                  <MapPin className="w-4 h-4" />
                  <span>AI 여행 플래너</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-hand font-bold leading-tight">
                    어디로 떠나볼까요?
                </h3>
                <p className="text-orange-50 opacity-90 max-w-md">
                    날짜가 정해졌나요? 여행지만 알려주세요.<br/>
                    Gemini가 <strong>딱 맞는 일정</strong>을 추천해드릴게요! 🏝️
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 max-w-md mt-6">
                    <div className="relative flex-grow">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={destination}
                            onChange={(e) => handleDestinationChange(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 rounded-full bg-white text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-orange-300/50 border-none shadow-lg"
                            placeholder="예: 제주도, 오사카..."
                        />
                    </div>
                    <Button 
                        onClick={handleGenerateItinerary} 
                        isLoading={isGenerating}
                        className="bg-white text-orange-600 hover:bg-orange-50 border-none shadow-lg px-8 py-3.5"
                    >
                        추천받기
                    </Button>
                </div>
             </div>
             
             {/* Itinerary Result */}
             {itinerary && (
                 <div className="flex-1 w-full bg-white/90 backdrop-blur-md rounded-[1.5rem] p-6 text-gray-800 shadow-lg border border-white/50">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-600">
                        <Plane className="w-5 h-5" />
                        {destination} 추천 코스
                    </h4>
                    <div className="prose prose-sm prose-orange max-h-80 overflow-y-auto custom-scrollbar pr-2">
                        <div className="whitespace-pre-wrap leading-relaxed text-sm text-gray-600">
                           {itinerary}
                        </div>
                    </div>
                 </div>
             )}
           </div>
        </div>
      </main>

      {/* 새로운 일정 만들기 모달 */}
      {showNewTripModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNewTripModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-orange-100 max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
                <PlusCircle className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">새로운 일정 만들기</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              새로운 여행 일정을 만들면 현재 일정에서 나가게 됩니다.<br/>
              새로운 일정을 만들까요?
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowNewTripModal(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={confirmNewTrip}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                만들기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 나가기 모달 */}
      {showExitModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowExitModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-orange-100 max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
                <X className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">나가기</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              정말 나가시겠어요?<br/>
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowExitModal(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={confirmExit}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                나가기
              </Button>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
};

export default App;