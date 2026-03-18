import React, { useState, useEffect, useRef } from 'react';
// @ts-expect-error - @vercel/analytics 타입 선언 문제 (로컬 개발 환경에서 타입 오류 발생)
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Calendar } from './components/Calendar';
import { DateRangePicker } from './components/DateRangePicker';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { SocialLoginButton } from './components/SocialLoginButton';
import { DateVote, User, VoteType } from './types';
import { MapPin, Plane, Share2, Check, Copy, X, ArrowRight, CalendarHeart, Calendar as CalendarIcon, PlusCircle, User as UserIcon, Crown, BookOpen, ChevronRight, ChevronLeft, ChevronDown, LogOut } from 'lucide-react';
import { generateItinerary as generateItineraryGemini } from './services/geminiService';
import { generateItinerary as generateItineraryOpenAI } from './services/openaiService';
import { searchCheapestFlights, searchFlight, FlightResult } from './services/flightSearchService';
import { AirportOption } from './services/airportSearchService';
import { findDestination } from './utils/popularDestinations';
import { AirportAutocompleteInput } from './components/AirportAutocompleteInput';
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
  subscribeToDateVotes,
  getTripsCount,
  trackButtonClick
} from './services/tripService';
import { parseLocalDate } from './utils/dateUtils';
import { validateDestination } from './utils/inputValidation';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import MyTripsPage from './pages/MyTripsPage';
import { getCurrentUser, signInWithKakao, signInWithGoogle, signOut, getUserProfile } from './services/authService';

// Short ID generator (6 chars)
const generateId = () => Math.random().toString(36).substring(2, 8);

const TripPage: React.FC = () => {
  const navigate = useNavigate();
  
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
  
  // 날짜 범위 선택 State (DateRangePicker용)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  
  // 날짜 범위 선택 캘린더 토글 State
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  
  // Service Stats State
  const [tripsCount, setTripsCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Supabase 인증 사용자 상태
  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // 여행 제목 입력 state (로그인한 사용자용)
  const [tripTitleInput, setTripTitleInput] = useState('');

  // AI 모델 선택 state
  const [selectedAiModel, setSelectedAiModel] = useState<'gemini' | 'openai'>('gemini');

  // 날짜 범위 선택 핸들러
  const handleDateRangeClick = (isoDate: string) => {
    if (!dateRangeStart) {
      // 첫 번째 클릭: 시작일 설정
      setDateRangeStart(isoDate);
      setDateRangeEnd(null);
    } else if (!dateRangeEnd) {
      // 두 번째 클릭: 종료일 설정
      // 로컬 타임존 기준으로 날짜 비교 (한국 시간대)
      const startDate = parseLocalDate(dateRangeStart);
      const clickedDate = parseLocalDate(isoDate);
      
      if (clickedDate < startDate) {
        // 클릭한 날짜가 시작일보다 이전이면 리셋 후 새로운 시작일로
        setDateRangeStart(isoDate);
        setDateRangeEnd(null);
      } else {
        // 정상적인 종료일 설정
        setDateRangeEnd(isoDate);
      }
    } else {
      // 둘 다 있으면 리셋 후 새로운 시작일로
      setDateRangeStart(isoDate);
      setDateRangeEnd(null);
    }
  };

  // 날짜 범위가 변경될 때 startDateInput, endDateInput 업데이트
  useEffect(() => {
    if (dateRangeStart) {
      setStartDateInput(dateRangeStart);
    } else {
      setStartDateInput('');
    }
    if (dateRangeEnd) {
      setEndDateInput(dateRangeEnd);
    } else {
      setEndDateInput('');
    }
  }, [dateRangeStart, dateRangeEnd]);
  
  // Share State
  const [isCopied, setIsCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  
  // AI Itinerary State
  const [destination, setDestination] = useState('제주도');
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Flight Search State
  const defaultOrigin: AirportOption = { code: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'South Korea' };
  const [flightOrigin, setFlightOrigin] = useState<AirportOption | null>(defaultOrigin);
  const [flightDestination, setFlightDestination] = useState<AirportOption | null>(null);
  const [flightResults, setFlightResults] = useState<FlightResult[]>([]);
  const [isSearchingFlights, setIsSearchingFlights] = useState(false);

  // Modal State
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showNoDateModal, setShowNoDateModal] = useState(false);
  const [showCopySuccessModal, setShowCopySuccessModal] = useState(false);

  // Selected User for Highlighting
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // User Guide State
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // 중복 실행 방지를 위한 ref
  const hasInitialized = useRef(false);
  
  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setAuthUser(user);
          const profile = await getUserProfile(user.id);
          setUserProfile(profile);
          
          // URL에 trip 파라미터가 없으면 my-trips로 리다이렉트
          const params = new URLSearchParams(window.location.search);
          const tripCode = params.get('trip');
          const isNewTrip = params.get('new') === 'true';
          
          if (!tripCode && !isNewTrip) {
            // 로그인된 사용자가 루트 경로에 접근하고 trip 파라미터가 없으면
            // my-trips 페이지로 리다이렉트
            navigate('/my-trips', { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error('❌ Error checking auth:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // 로그인한 유저의 닉네임 자동 입력
  useEffect(() => {
    if (authUser && userProfile && !currentUser && !nameInput) {
      const displayName = userProfile?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0];
      if (displayName) {
        setNameInput(displayName);
      }
    }
  }, [authUser, userProfile, currentUser, nameInput]);
  
  // 입력 중인지 추적하는 ref (구독 업데이트 방지용)
  const isTypingDestination = useRef(false);
  const destinationUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize Trip from URL (기존 Trip 로드만, 새로 생성하지 않음)
  useEffect(() => {
    // 이미 초기화되었으면 스킵
    if (hasInitialized.current) {
      // console.log('⏭️ initTrip: Already initialized, skipping...');
      return;
    }

    const initTrip = async () => {
      // console.log('🚀 initTrip: Starting trip initialization...');
      hasInitialized.current = true;
      setIsLoadingTrip(true);
      
      try {
        // URL에서 share_code 확인
      const params = new URLSearchParams(window.location.search);
        const code = params.get('trip');
        // console.log('🔗 initTrip: URL trip code', code || 'none');

        if (code) {
          // 기존 Trip 로드
          // console.log('📥 initTrip: Loading existing trip...', { code });
          const trip = await getTripByShareCode(code);
          if (trip) {
            // console.log('✅ initTrip: Trip loaded', { tripId: trip.id, shareCode: trip.share_code, destination: trip.destination });
            
            setCurrentTripId(trip.id);
            setShareCode(trip.share_code);
            setDestination(trip.destination);
            setTripStartDate(trip.start_date || null);
            setTripEndDate(trip.end_date || null);

            // tripStartDate가 있으면 해당 월로 달력 이동
            if (trip.start_date) {
              const startDate = parseLocalDate(trip.start_date);
              setCurrentDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
            }

            // Load users and votes
            // console.log('📊 initTrip: Loading users and votes...');
            const tripUsers = await getTripUsers(trip.id);
            const tripVotes = await getDateVotes(trip.id);
            // console.log('✅ initTrip: Data loaded', { usersCount: tripUsers.length, votesCount: tripVotes.length });

            setUsers(tripUsers);
            setVotes(tripVotes);

            // Local user가 있으면 추가 (하지만 currentUser는 설정하지 않음 - 로그인 화면 유지)
            // ⚠️ 같은 trip에 속한 사용자만 자동 추가 (다른 trip의 사용자는 제외)
            const savedUserStr = localStorage.getItem('tripsync_user');
            if (savedUserStr) {
              try {
                const localUser = JSON.parse(savedUserStr);
          
                // localStorage의 trip_id와 현재 trip_id를 비교
                // 같은 trip이 아니면 자동 추가하지 않음 (다른 trip의 사용자 정보가 섞이는 것을 방지)
                if (localUser.trip_id && localUser.trip_id === trip.id) {
                  // console.log('👤 initTrip: Found saved user for this trip, adding...', { userId: localUser.id, userName: localUser.name });
                  await addTripUser(trip.id, localUser);
                  // console.log('✅ initTrip: Saved user added to trip');
                } else {
                  // console.log('👤 initTrip: Saved user is for different trip, skipping auto-add', { savedTripId: localUser.trip_id, currentTripId: trip.id });
                }
              } catch (error) {
                // console.error("❌ initTrip: Failed to add user to trip", error);
              }
            }
          } else {
            // console.warn('⚠️ initTrip: Trip not found');
            alert("존재하지 않는 여행 일정입니다.");
          }
        } else {
          // URL에 trip 코드가 없으면 Trip 생성하지 않음
          // 사용자가 로그인할 때 생성됨
          // console.log('📝 initTrip: No trip code in URL, waiting for user login...');
        }
      } catch (error) {
        // console.error("❌ initTrip: Failed to initialize trip", error);
        alert("일정을 불러오는데 실패했습니다.");
        hasInitialized.current = false; // 에러 시 재시도 가능하도록
      } finally {
        setIsLoadingTrip(false);
        // console.log('✅ initTrip: Initialization complete');
      }
    };

    initTrip();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentTripId || !currentUser) {
      // console.log('📡 Subscriptions: No tripId or currentUser, skipping subscriptions');
      return;
    }

    // console.log('📡 Subscriptions: Setting up real-time subscriptions', { tripId: currentTripId, userId: currentUser.id });

    // Subscribe to trip changes
    const tripSubscription = subscribeToTrip(currentTripId, (trip) => {
      // console.log('📡 Subscription: Trip updated', { destination: trip.destination });
      // 입력 중이 아닐 때만 destination 업데이트 (다른 사용자의 변경만 반영)
      if (!isTypingDestination.current) {
        setDestination(trip.destination);
      }
      setTripStartDate(trip.start_date || null);
      setTripEndDate(trip.end_date || null);
    });

    // Subscribe to user changes
    const usersSubscription = subscribeToTripUsers(currentTripId, (updatedUsers) => {
      // console.log('📡 Subscription: Users updated', { count: updatedUsers.length, users: updatedUsers.map(u => u.name) });
      setUsers(updatedUsers);
    });

    // Subscribe to vote changes - currentUserId 전달하여 자신의 변경사항 필터링
    const votesSubscription = subscribeToDateVotes(
      currentTripId, 
      (updatedVotes) => {
        // console.log('📡 Subscription: Votes updated', { count: updatedVotes.length });
        setVotes(updatedVotes);
      },
      currentUser.id // 현재 사용자 ID 전달
    );

    // 주기적 DB 동기화 (실시간 구독 백업)
    // 실시간 구독이 놓친 변경사항(특히 DELETE 이벤트)을 보완
    // 3초 주기로 동기화하여 서버 부하 최소화하면서도 실시간성 유지
    const syncInterval = setInterval(async () => {
      try {
        const latestVotes = await getDateVotes(currentTripId);
        // 변경사항이 있을 때만 상태 업데이트 (불필요한 리렌더링 방지)
        setVotes(prevVotes => {
          // 간단한 비교: 길이와 내용이 같으면 업데이트하지 않음
          if (prevVotes.length === latestVotes.length) {
            const prevMap = new Map(prevVotes.map(v => [`${v.date}-${v.userId}-${v.type}`, true]));
            const hasChanges = latestVotes.some(v => !prevMap.has(`${v.date}-${v.userId}-${v.type}`));
            if (!hasChanges) {
              return prevVotes; // 변경사항 없음
            }
          }
          // 변경사항이 있으면 업데이트
          return latestVotes;
        });
      } catch (error) {
        // 에러 발생 시에도 앱이 계속 작동하도록 조용히 처리
        // console.error('❌ Periodic sync: Error fetching votes:', error);
        }
    }, 3000); // 3초마다 동기화 (서버 부하 최소화)

    // console.log('✅ Subscriptions: All subscriptions active');

    return () => {
      // console.log('🔌 Subscriptions: Cleaning up subscriptions');
      tripSubscription.unsubscribe();
      usersSubscription.unsubscribe();
      votesSubscription.unsubscribe();
      clearInterval(syncInterval); // 인터벌 정리 (메모리 누수 방지)
    };
  }, [currentTripId, currentUser]);

  // 서비스 통계 로드 (로그인 페이지에서만)
  useEffect(() => {
    if (!currentUser) {
      const loadStats = async () => {
        setIsLoadingStats(true);
        try {
          const count = await getTripsCount();
          setTripsCount(count);
        } catch (error) {
          console.error('❌ Error loading trips count:', error);
        } finally {
          setIsLoadingStats(false);
        }
      };
      
      loadStats();
    }
  }, [currentUser]);

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
    // console.log('👤 confirmUser: Starting', { userId: user.id, userName: user.name });
    setCurrentUser(user);

    // 로그인 사용자 확인
    const authUser = await getCurrentUser();

    // Trip이 없으면 생성 (사용자가 로그인할 때 생성)
    if (!currentTripId) {
      // console.log('📝 confirmUser: No trip exists, creating new trip...');
      setIsLoadingTrip(true);
      try {
        // 로그인한 사용자는 제목 사용 (빈 문자열이면 기본값), 익명 사용자는 undefined
        const tripTitle = authUser 
          ? (tripTitleInput.trim() || '이름없는 여행 일정')
          : undefined;
        
        const newTrip = await createTrip(
          destination,
          startDateInput || null,
          endDateInput || null,
          tripTitle, // 제목 전달
          authUser?.id || null // creator_id
        );
        // console.log('✅ confirmUser: Trip created', { tripId: newTrip.id, shareCode: newTrip.share_code });
        setCurrentTripId(newTrip.id);
        setShareCode(newTrip.share_code);
        setTripStartDate(newTrip.start_date || null);
        setTripEndDate(newTrip.end_date || null);
        
        // tripStartDate가 있으면 해당 월로 달력 이동
        if (newTrip.start_date) {
          const startDate = parseLocalDate(newTrip.start_date);
          setCurrentDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
        }
        
        // 사용자 추가
        // console.log('👤 confirmUser: Adding user to new trip...');
        await addTripUser(newTrip.id, user, authUser?.id || null);
        // console.log('✅ confirmUser: User added to trip successfully');
        
        // localStorage에 사용자 정보와 trip_id를 함께 저장
        const userWithTripId = {
          ...user,
          trip_id: newTrip.id
        };
        localStorage.setItem('tripsync_user', JSON.stringify(userWithTripId));
        
        // 초기 데이터 로드
        const tripUsers = await getTripUsers(newTrip.id);
        const tripVotes = await getDateVotes(newTrip.id);
        setUsers(tripUsers);
        setVotes(tripVotes);
        // console.log('✅ confirmUser: Initial data loaded', { usersCount: tripUsers.length, votesCount: tripVotes.length });
        
        // 첫 접속 시 튜토리얼 표시 (localStorage에 저장된 값 확인)
        const hasSeenTutorial = localStorage.getItem('tripsync_seen_tutorial');
        if (!hasSeenTutorial) {
          setTimeout(() => setShowTutorial(true), 500); // 약간의 딜레이 후 표시
        }
      } catch (error) {
        // console.error("❌ confirmUser: Failed to create trip and add user", error);
        alert("일정 생성에 실패했습니다. 다시 시도해주세요.");
        setCurrentUser(null); // 실패 시 로그인 상태 리셋
      } finally {
        setIsLoadingTrip(false);
      }
    } else {
      // Trip이 있으면 사용자 추가
      // console.log('👤 confirmUser: Trip exists, adding user...', { tripId: currentTripId });
      try {
        await addTripUser(currentTripId, user, authUser?.id || null);
        // console.log('✅ confirmUser: User added to existing trip successfully');
        
        // localStorage에 사용자 정보와 trip_id를 함께 저장
        const userWithTripId = {
          ...user,
          trip_id: currentTripId
        };
        localStorage.setItem('tripsync_user', JSON.stringify(userWithTripId));
        
        // tripStartDate가 있으면 해당 월로 달력 이동
        if (tripStartDate) {
          const startDate = parseLocalDate(tripStartDate);
          setCurrentDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
        }
        
        // 사용자 추가 후 최신 데이터 로드 (구독이 활성화되기 전에)
        // 약간의 딜레이를 두어 DB 업데이트가 완료되도록 함
        await new Promise(resolve => setTimeout(resolve, 100));
        const [tripUsers, tripVotes] = await Promise.all([
          getTripUsers(currentTripId),
          getDateVotes(currentTripId)
        ]);
        setUsers(tripUsers);
        setVotes(tripVotes);
        // console.log('✅ confirmUser: Latest data loaded after adding user', { usersCount: tripUsers.length, votesCount: tripVotes.length });
      } catch (error) {
        // console.error("❌ confirmUser: Failed to add user", error);
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
      // console.warn("⚠️ handleVote: currentUser is null");
      alert("먼저 로그인해주세요.");
      return;
    }
    if (!currentTripId) {
      // console.warn("⚠️ handleVote: currentTripId is null");
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
        
        // DB 저장 후 최신 데이터 로드 (자신의 변경사항도 반영)
        await new Promise(resolve => setTimeout(resolve, 100));
        const updatedVotes = await getDateVotes(currentTripId);
        setVotes(updatedVotes);
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
            
            // DB 저장 후 최신 데이터 로드
            await new Promise(resolve => setTimeout(resolve, 100));
            const updatedVotes = await getDateVotes(currentTripId);
            setVotes(updatedVotes);
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
        
        // DB 저장 후 최신 데이터 로드 (자신의 변경사항도 반영)
        await new Promise(resolve => setTimeout(resolve, 100));
        const updatedVotes = await getDateVotes(currentTripId);
        setVotes(updatedVotes);
      }
      // 구독은 다른 사용자의 변경사항을 받기 위해 유지
    } catch (error) {
      // console.error("❌ handleVote: Failed to vote", error);
      // 에러 시 이전 상태로 복구
      setVotes(previousVotes);
      
      // DB에서 최신 상태 다시 로드 시도
      try {
        const updatedVotes = await getDateVotes(currentTripId);
        setVotes(updatedVotes);
      } catch (reloadError) {
        // console.error("❌ handleVote: Failed to reload votes", reloadError);
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
        
        // 클릭 추적 추가
        trackButtonClick('share', currentTripId || undefined, currentUser?.id);
      } catch (clipErr) {
        // console.warn("Clipboard failed", clipErr);
      }
    } catch (e) {
      // console.error("Failed to generate URL", e);
      alert("링크 생성에 실패했습니다.");
    }
  };

  const handleDestinationChange = (newDestination: string) => {
    // 입력 중 플래그 설정
    isTypingDestination.current = true;
    
    // 상태는 즉시 업데이트
    setDestination(newDestination);

    // 이전 timeout이 있으면 취소
    if (destinationUpdateTimeout.current) {
      clearTimeout(destinationUpdateTimeout.current);
    }

    // DB 업데이트는 debounce 처리 (입력이 끝난 후에만 업데이트)
    if (currentTripId) {
      destinationUpdateTimeout.current = setTimeout(async () => {
        try {
          await updateTripDestination(currentTripId, newDestination);
          // 입력 완료 후 플래그 해제 (약간의 딜레이를 두어 구독 업데이트와 충돌 방지)
          setTimeout(() => {
            isTypingDestination.current = false;
          }, 200);
        } catch (error) {
          // console.error("Failed to update destination", error);
          isTypingDestination.current = false;
        }
        destinationUpdateTimeout.current = null;
      }, 500); // 500ms debounce
    } else {
      isTypingDestination.current = false;
    }
  };

  const handleGenerateItinerary = async () => {
    // 입력 검증 (프롬프트 인젝션 방지)
    const validation = validateDestination(destination);
    if (!validation.valid) {
      alert(validation.error || '올바른 여행지를 입력해주세요.');
      return;
    }

    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
        if (v.type === 'available') {
            voteCounts[v.date] = (voteCounts[v.date] || 0) + 1;
        }
    });

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    if (maxVotes === 0) {
        setShowNoDateModal(true);
        return;
    }

    const bestDates = Object.keys(voteCounts).filter(d => voteCounts[d] === maxVotes).sort();
    const startDate = bestDates[0];
    const endDate = bestDates[bestDates.length - 1];

    if (!startDate) return;

    setIsGenerating(true);
    const plan = selectedAiModel === 'gemini'
      ? await generateItineraryGemini({
          destination,
          startDate,
          endDate: endDate || startDate
        })
      : await generateItineraryOpenAI({
          destination,
          startDate,
          endDate: endDate || startDate
        });
    setItinerary(plan);
    setIsGenerating(false);
    
    // 클릭 추적 추가 (성공적으로 일정 생성된 경우만)
    if (plan && !plan.includes('죄송')) {
      trackButtonClick('generate_itinerary', currentTripId || undefined, currentUser?.id);
    }
  };

  // 날짜를 연속된 그룹으로 묶고 포맷팅하는 함수
  const formatBestDates = (): { dates: string; participants: string; isoDates: string[] } => {
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      if (v.type === 'available') {
        voteCounts[v.date] = (voteCounts[v.date] || 0) + 1;
      }
    });

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    if (maxVotes === 0) {
      return { dates: '', participants: '', isoDates: [] };
    }

    // 가장 많이 선택된 날짜들만 필터링 (ISO 문자열 그대로 사용)
    const bestDates = Object.keys(voteCounts)
      .filter(d => voteCounts[d] === maxVotes)
      .sort();

    if (bestDates.length === 0) {
      return { dates: '', participants: '', isoDates: [] };
    }

    // 연속된 날짜 그룹으로 묶기 (ISO 문자열 직접 파싱)
    const groups: string[][] = [];
    let currentGroup: string[] = [bestDates[0]];

    for (let i = 1; i < bestDates.length; i++) {
      const prevDate = bestDates[i - 1];
      const currentDate = bestDates[i];
      
      // ISO 문자열을 직접 파싱하여 날짜 차이 계산 (타임존 문제 해결)
      const [prevYear, prevMonth, prevDay] = prevDate.split('-').map(Number);
      const [currYear, currMonth, currDay] = currentDate.split('-').map(Number);
      
      // 날짜 차이 계산 (로컬 타임존 기준)
      const prevDateObj = new Date(prevYear, prevMonth - 1, prevDay);
      const currDateObj = new Date(currYear, currMonth - 1, currDay);
      const daysDiff = (currDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff === 1) {
        // 연속된 날짜
        currentGroup.push(currentDate);
      } else {
        // 연속되지 않은 날짜 - 새 그룹 시작
        groups.push(currentGroup);
        currentGroup = [currentDate];
      }
    }
    groups.push(currentGroup);

    // 그룹을 문자열로 포맷팅 (ISO 문자열에서 직접 추출)
    const formatGroup = (group: string[]): string => {
      if (group.length === 1) {
        const [year, month, day] = group[0].split('-').map(Number);
        return `${month}월 ${day}일`;
      } else {
        const [startYear, startMonth, startDay] = group[0].split('-').map(Number);
        const [endYear, endMonth, endDay] = group[group.length - 1].split('-').map(Number);
        
        if (startMonth === endMonth) {
          return `${startMonth}월 ${startDay}~${endDay}일`;
        } else {
          return `${startMonth}월 ${startDay}일~${endMonth}월 ${endDay}일`;
        }
      }
    };

    const datesText = groups.map(formatGroup).join(', ');

    // 일자 선택에 참여한 참가자 명단 추출
    const participantIds = new Set<string>();
    votes.forEach(v => {
      if (v.type === 'available') {
        participantIds.add(v.userId);
      }
    });

    const participantNames = Array.from(participantIds)
      .map(id => users.find(u => u.id === id)?.name)
      .filter((name): name is string => !!name)
      .join(', ');

    return {
      dates: datesText,
      participants: participantNames,
      isoDates: bestDates // ISO 날짜 배열 반환
    };
  };

  // 복사 핸들러
  const handleCopyBestDates = async () => {
    const { dates, participants } = formatBestDates();
    
    if (!dates) {
      setShowNoDateModal(true);
      return;
    }

    // 텍스트 형식 변경
    const textToCopy = participants 
      ? `가장 많이 가능한 일정:\n\n${dates}\n\n참여자: ${participants}`
      : `가장 많이 가능한 일정:\n\n${dates}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setShowCopySuccessModal(true);
      
      // 클릭 추적 추가
      trackButtonClick('copy_dates', currentTripId || undefined, currentUser?.id);
    } catch (error) {
      alert('복사에 실패했습니다.');
    }
  };

  const handleNewTrip = () => {
    setShowNewTripModal(true);
  };

  // 항공권 검색 핸들러
  const handleSearchFlights = async () => {
    // 클릭 추적 추가
    trackButtonClick('flight_search', currentTripId || undefined, currentUser?.id);
    
    const { isoDates } = formatBestDates();
    
    if (isoDates.length === 0) {
      alert('먼저 날짜를 선택해주세요.');
      return;
    }

    setIsSearchingFlights(true);
    setFlightResults([]);

    try {
      // 사용자가 선택한 날짜를 그대로 사용 (YYYY-MM-DD 형식으로 변환)
      const departureDate = isoDates[0].split('T')[0];
      const returnDate = isoDates.length > 1 
        ? isoDates[isoDates.length - 1].split('T')[0] 
        : undefined;

      // 출발일 과거 여부 검증
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parseLocalDate(departureDate) < today) {
        alert('출발일은 오늘 이후 날짜를 선택해주세요.');
        setIsSearchingFlights(false);
        return;
      }

      const originCode = flightOrigin?.code || 'ICN';

      // 목적지가 선택되었으면 해당 목적지만 검색
      if (flightDestination) {
        const result = await searchFlight(originCode, flightDestination.code, departureDate, returnDate);
        if (result) {
          setFlightResults([result]);
        } else {
          alert('해당 날짜와 목적지에 대한 항공권을 찾을 수 없습니다.');
        }
      } else {
        // 목적지 입력이 없으면 인기 여행지 전체 검색
        const results = await searchCheapestFlights(departureDate, returnDate, originCode);
        if (results.length === 0) {
          alert('해당 날짜에 대한 항공권을 찾을 수 없습니다.');
        } else {
          setFlightResults(results);
        }
      }
    } catch (error: any) {
      console.error('❌ Error searching flights:', error);
      if (error.message?.includes('Rate limit')) {
        alert('API 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.');
      } else {
        alert('항공권 검색 중 오류가 발생했습니다. ' + (error.message || ''));
      }
    } finally {
      setIsSearchingFlights(false);
    }
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
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setGeneratedUrl(null);
    setIsCopied(false);
    setItinerary(null);
    setNameInput('');
    setFlightOrigin(defaultOrigin);
    setFlightDestination(null);
    
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
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">일정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fff7ed] p-4 font-sans">
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white p-10 sm:p-12 rounded-2xl shadow-md max-w-xl w-full text-center border border-orange-100/50">
          <div className="mb-4 sm:mb-6 flex justify-center">
            <div className="bg-orange-50 p-6 rounded-xl">
              <Plane className="w-12 h-12 text-orange-600" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 tracking-tight">언제갈래 ✈️</h1>
          
          <p className="text-base sm:text-lg text-gray-500 mb-4 sm:mb-6 leading-relaxed">
            친구들과 떠나는 설레는 여행!<br/>
            우리 언제 떠날지 여기에서 정해봐요.
          </p>
          
          {/* 로그인한 사용자에게 표시할 UI */}
          {authUser && (
            <div className="mb-4 sm:mb-6 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {userProfile?.display_name || authUser.user_metadata?.full_name || authUser.email}님으로 로그인됨
                  </span>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await signOut();
                      setAuthUser(null);
                      setUserProfile(null);
                    } catch (error) {
                      console.error('Logout failed:', error);
                      alert('로그아웃에 실패했습니다.');
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  로그아웃
                </Button>
              </div>
            </div>
          )}
          
          {/* 서비스 통계 배너 */}
          {!isLoadingStats && tripsCount !== null && (
            <div className="mb-3 sm:mb-5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed text-center">
                현재 <span className="font-semibold text-gray-800">언제갈래</span>를 통해{' '}
                <span className="font-semibold text-orange-600">{tripsCount.toLocaleString('ko-KR')}개</span>의 여행 일정이 계획되고 있습니다
              </p>
            </div>
          )}
          
          {/* 초대 링크 접속 시 기간 표시 */}
          {currentTripId && (tripStartDate || tripEndDate) && (
            <div className="mb-3 sm:mb-4 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-gray-800">여행 기간</span>
              </div>
              <p className="text-sm text-gray-700">
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

          {/* Existing Users Selection for Re-login - 여행 기간과 닉네임 입력칸 사이로 이동 */}
          {users.length > 0 && (
              <div className="mb-3 sm:mb-4 p-4 bg-white border border-orange-100 rounded-xl">
                  {/* 다른 참가자의 링크로 접속한 경우 - 최상단에 배치 */}
                  {currentTripId && (
                    <p className="text-base font-bold text-orange-700 mb-3 text-center">
                      {users[0].name}님의 여행일정 입니다 ✈️
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mb-3 font-medium text-center">이미 참여하고 있나요? 이름을 클릭하세요 👇</p>
                  <div className="flex flex-wrap justify-center gap-2">
                      {users.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => confirmUser(u)}
                            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-orange-50 hover:bg-orange-100 text-gray-700 hover:text-orange-600 rounded-full text-sm border-2 border-orange-200 hover:border-orange-300 transition-all"
                          >
                              <span className="font-bold">{u.name}</span>
                              <ArrowRight className="w-3 h-3" />
                          </button>
                      ))}
                  </div>
              </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <input
              type="text"
              placeholder="닉네임이 뭐에요?"
              className="w-full px-6 sm:px-8 py-4 sm:py-5 min-h-[56px] rounded-lg bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-center text-lg sm:text-xl font-medium placeholder:text-gray-400 text-gray-900"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            
            {/* 로그인한 사용자에게만 제목 입력 필드 표시 */}
            {authUser && (
              <input
                type="text"
                placeholder="여행 일정 제목 (선택)"
                className="w-full px-6 sm:px-8 py-4 sm:py-5 min-h-[56px] rounded-lg bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-center text-lg sm:text-xl font-medium placeholder:text-gray-400 text-gray-900"
                value={tripTitleInput}
                onChange={(e) => setTripTitleInput(e.target.value)}
              />
            )}
            
            {/* 최초 유저만 기간 설정 표시 */}
            {!currentTripId && users.length === 0 && (
              <div className="pt-2 pb-1">
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 sm:p-6 hover:border-orange-300 transition-colors">
                  <button
                    type="button"
                    onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                    className="w-full flex items-center justify-between gap-2 mb-4 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-orange-500" />
                      <p className="text-base font-medium text-gray-700">여행 기간 설정 <span className="text-sm text-gray-400 font-normal">(선택)</span></p>
        </div>
                    <ChevronDown 
                      className={`w-5 h-5 text-orange-500 transition-transform duration-200 ${
                        showDateRangePicker ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {/* 선택된 날짜 범위 표시 */}
                  {(dateRangeStart || dateRangeEnd) && (
                    <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="font-semibold text-orange-700">
                          {dateRangeStart ? new Date(dateRangeStart).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '시작일'}
                        </span>
                        <span className="text-orange-400">~</span>
                        <span className="font-semibold text-orange-700">
                          {dateRangeEnd ? new Date(dateRangeEnd).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '종료일'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* 날짜 범위 선택 달력 (토글) */}
                  {showDateRangePicker && (
                    <div className="mt-4">
                      <DateRangePicker
                        startDate={dateRangeStart}
                        endDate={dateRangeEnd}
                        onDateClick={handleDateRangeClick}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <Button type="submit" className="w-full text-lg sm:text-xl py-5 sm:py-6 min-h-[56px] shadow-md" size="lg">시작하기</Button>
          </form>
          
          {/* OAuth 로그인 버튼 - 로그인하지 않은 사용자에게만 표시 */}
          {!authUser && (
            <>
              {/* 로그인 유도 텍스트 */}
              <div className="mb-3 sm:mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs sm:text-sm text-gray-600 text-center leading-relaxed">
                  <span className="font-semibold text-orange-600">로그인</span>해서 내 여행 일정을 관리하고 여러 여행을 저장하세요 ✈️
                </p>
              </div>

              {/* 구분선 - OAuth 로그인 옵션 */}
              <div className="relative my-4 sm:my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>

              {/* OAuth 로그인 버튼 */}
              <div className="space-y-3 mb-4 sm:mb-6 relative">
                {/* 말풍선 안내 문구 - 깜빡임 애니메이션 */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10 animate-pulse">
                  <div className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg">
                    SNS로 3초만에 로그인
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                </div>
                
                <SocialLoginButton
                  provider="kakao"
                  onClick={async () => {
                    try {
                      // 현재 tripId가 있으면 URL 파라미터로 전달
                      const tripParam = currentTripId ? `?tripId=${currentTripId}` : '';
                      const redirectTo = `${window.location.origin}/auth/callback${tripParam}`;
                      await signInWithKakao(redirectTo);
                    } catch (error) {
                      console.error('Kakao login failed:', error);
                      alert('카카오 로그인에 실패했습니다.');
                    }
                  }}
                />
                <SocialLoginButton
                  provider="google"
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (error) {
                      console.error('Google login failed:', error);
                      alert('구글 로그인에 실패했습니다.');
                    }
                  }}
                />
              </div>
            </>
          )}

          {/* 사용법 보기 버튼 */}
          <button
            onClick={() => setShowTutorial(true)}
            className="w-full mt-3 text-sm text-gray-500 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            사용법 보기
          </button>
          </div>
        </div>
        
        {/* 푸터 */}
        <footer className="mt-auto pt-6 pb-4 border-t border-orange-100">
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-400">
              © 2025 언제갈래? All rights reserved.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-gray-400">
              <span>기획: Jay, Shin</span>
              <span className="hidden sm:inline">•</span>
              <a 
                href="mailto:kdshin@freshmilk.kr" 
                className="hover:text-orange-500 transition-colors"
              >
                kdshin@freshmilk.kr
              </a>
              <span className="hidden sm:inline">•</span>
              <a 
                href="https://forms.gle/MiUa2TrigEMbtbAN8" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors underline"
              >
                💬 피드백 보내기
              </a>
            </div>
          </div>
        </footer>
        
        {/* 로그인 화면용 튜토리얼 모달 */}
        {showTutorial && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (dontShowAgain) {
                localStorage.setItem('tripsync_seen_tutorial', 'true');
              }
              setShowTutorial(false);
              setTutorialStep(0);
            }}
          >
            <div 
              className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 튜토리얼 단계별 내용 - 로그인 화면용 간단 버전 */}
              {tutorialStep === 0 && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-50 p-2 rounded-lg">
                      <Plane className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">언제갈래? 시작하기</h3>
                  </div>
                  <div className="mb-6">
                    <p className="text-sm sm:text-base text-gray-600 mb-4 leading-relaxed">
                      <strong className="text-orange-600">언제갈래?</strong>는 친구들과 함께 여행 일정을 조율하는 서비스입니다. 
                      각자 가능한 날짜를 선택하면 모두가 가능한 날짜를 한눈에 확인할 수 있어요! ✈️
                    </p>
                    <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        💡 <strong>핵심 기능:</strong> 캘린더에서 드래그로 여러 날짜를 한 번에 선택하고, 
                        "가능해요" 또는 "안돼요"로 투표하세요. 모든 참여자가 가능한 날짜는 👑 표시로 보여집니다!
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="dontShowAgainLogin"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      className="w-4 h-4 text-orange-500 rounded"
                    />
                    <label htmlFor="dontShowAgainLogin" className="text-xs text-gray-600 cursor-pointer">
                      다시 보지 않기
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (dontShowAgain) {
                          localStorage.setItem('tripsync_seen_tutorial', 'true');
                        }
                        setShowTutorial(false);
                        setTutorialStep(0);
                      }}
                      className="flex-1 min-h-[48px]"
                    >
                      닫기
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-12 sm:pb-20">
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
              <button 
                onClick={handleNewTrip}
                className="min-h-[44px] text-xs sm:text-sm font-medium text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">새로운 일정 만들기</span>
                <span className="sm:hidden">새 일정</span>
              </button>
              
              {/* 로그인한 사용자 */}
              {authUser ? (
                <>
                  <span className="hidden sm:inline-block text-sm text-gray-600 bg-orange-50/50 px-3 py-1 rounded-lg">
                    반가워요, <strong className="text-orange-700">{userProfile?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '사용자'}</strong>님
                  </span>
                  <button 
                    onClick={() => navigate('/my-trips')}
                    className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors"
                  >
                    <span className="hidden sm:inline">마이 페이지</span>
                    <span className="sm:hidden">마이</span>
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        await signOut();
                        setAuthUser(null);
                        setUserProfile(null);
                        // 로그아웃 후 현재 페이지 유지
                      } catch (error) {
                        console.error('Logout failed:', error);
                        alert('로그아웃에 실패했습니다.');
                      }
                    }}
                    className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">로그아웃</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline-block text-sm text-gray-600 bg-orange-50/50 px-3 py-1 rounded-lg">
                    반가워요, <strong className="text-orange-700">{currentUser.name}</strong>님
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block px-2 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-lg">
                      <p className="text-xs text-gray-700 whitespace-nowrap">
                        <span className="font-semibold text-orange-600">로그인</span>해서 여러 여행 저장
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        // 현재 tripId가 있으면 URL 파라미터로 전달
                        const tripParam = currentTripId ? `?tripId=${currentTripId}` : '';
                        navigate(`/login${tripParam}`);
                      }}
                      className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                    >
                      로그인
                    </button>
                    <button 
                      onClick={handleExit} 
                      className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors"
                    >
                      나가기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-8 space-y-2 sm:space-y-4">
        
        {/* 친구 초대하기 - 가이드 아래, 캘린더 위로 이동 */}
        <div className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-orange-100/50">
          <div className="flex items-center justify-between gap-3">
             <div className="flex flex-col gap-0.5 sm:gap-1">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-orange-500" />
                친구 초대하기
              </h3>
              <p className="text-xs text-gray-500">링크를 복사해 친구들에게 공유하세요</p>
             </div>
               <Button 
                  variant="secondary" 
                  size="md" 
                  onClick={handleShare} 
              className={`gap-2 whitespace-nowrap transition-all duration-300 ${isCopied ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
               >
                  {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isCopied ? "복사완료!" : "초대하기"}</span>
                  <span className="sm:hidden">{isCopied ? "완료" : "초대"}</span>
               </Button>
           </div>

           {/* Generated Link Display */}
           {generatedUrl && (
            <div className="mt-4 pt-4 border-t border-orange-100/50">
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
        
        {/* ModeToggle - 가능/불가 토글 (항상 표시, Sticky) */}
        <div className="sticky top-12 sm:top-16 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm -mx-4 sm:mx-0 px-4 sm:px-0 mb-2 sm:mb-4">
          <div className="bg-white p-2.5 sm:p-4 rounded-b-[1.5rem]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">날짜 선택 모드</p>
              <ModeToggle mode={voteMode} setMode={setVoteMode} />
            </div>
          </div>
        </div>

        {/* 참여자 목록 - Sticky로 변경 (캘린더 바로 위) */}
        {users.length > 1 && (
          <div className="sticky top-[calc(3rem+60px)] sm:top-[calc(4rem+80px)] z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm -mx-4 sm:mx-0 px-4 sm:px-0 mb-2 sm:mb-4">
            <div className="bg-white p-2.5 sm:p-4 rounded-b-[1.5rem]">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <UserIcon className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-700">참여자</h3>
              <span className="text-xs text-gray-400">({users.length}명)</span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex gap-2 min-w-max sm:flex-wrap sm:min-w-0">
                {/* "가장 많이 가능" 버튼 추가 */}
                <button
                  onClick={() => setSelectedUserId(selectedUserId === 'all' ? null : 'all')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedUserId === 'all'
                      ? 'bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-md scale-105'
                      : 'bg-gradient-to-r from-orange-50 to-rose-50 text-orange-700 hover:from-orange-100 hover:to-rose-100 hover:scale-105 border-2 border-orange-200'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  <span>가장 많이 가능</span>
                </button>
                
                {users.map(user => {
                  const isSelected = selectedUserId === user.id;
                  const isCurrentUser = user.id === currentUser.id;
                  const userVotes = votes.filter(v => v.userId === user.id);
                  const availableCount = userVotes.filter(v => v.type === 'available').length;
                  const unavailableCount = userVotes.filter(v => v.type === 'unavailable').length;
                  
                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(isSelected ? null : user.id)}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-md scale-105'
                          : isCurrentUser
                            ? 'bg-orange-200 text-orange-800 border-2 border-orange-400 font-semibold hover:bg-orange-300'
                            : 'bg-orange-50 text-orange-700 hover:bg-orange-100 hover:scale-105'
                      }`}
                    >
                      {isCurrentUser && (
                        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          나
                        </span>
                      )}
                      <span>{user.name}</span>
                      {availableCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/30' : isCurrentUser ? 'bg-orange-300' : 'bg-orange-200'
                        }`}>
                          가능 {availableCount}
                        </span>
                      )}
                      {unavailableCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/30' : isCurrentUser ? 'bg-gray-300' : 'bg-gray-200'
                        }`}>
                          불가 {unavailableCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
              {selectedUserId === 'all' && (
                <p className="text-xs text-orange-600 mt-3 font-medium">
                  👆 가장 많은 참여자가 가능한 날짜만 표시됩니다
                </p>
              )}
              {selectedUserId && selectedUserId !== 'all' && (
                <p className="text-xs text-orange-600 mt-3 font-medium">
                  👆 {users.find(u => u.id === selectedUserId)?.name}님이 선택한 날짜만 표시됩니다
                </p>
              )}
            </div>
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
          setVoteMode={setVoteMode}
          onVote={handleVote}
          startDate={tripStartDate}
          endDate={tripEndDate}
          selectedUserId={selectedUserId}
        />

        {/* Best Dates Copy Section */}
        <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-orange-100/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <CalendarHeart className="w-5 h-5 text-orange-500" />
                📅 가장 많이 가능한 일정
              </h3>
              {formatBestDates().dates ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-700 font-medium">
                    {formatBestDates().dates}
                  </p>
                  {formatBestDates().participants && (
                    <p className="text-xs text-gray-500">
                      참여자: {formatBestDates().participants}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">아직 선택된 날짜가 없습니다</p>
              )}
            </div>
            <Button
              onClick={handleCopyBestDates}
              disabled={!formatBestDates().dates}
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Copy className="w-4 h-4 mr-2" />
              복사하기
            </Button>
          </div>
        </div>

        {/* Flight Search Section */}
        {formatBestDates().isoDates.length > 0 && (
          <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-orange-100/50 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Plane className="w-5 h-5 text-orange-500" />
              <h3 className="text-base font-semibold text-gray-800">
                ✈️ 최저가 항공권 검색
              </h3>
              <span className="text-xs text-white bg-orange-600 px-2 py-1 rounded-full font-medium">
                테스트 단계입니다
              </span>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    출발지
                  </label>
                  <AirportAutocompleteInput
                    value={flightOrigin}
                    onChange={setFlightOrigin}
                    placeholder="ICN, 인천, Seoul..."
                    aria-label="출발 공항 검색"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    목적지 <span className="text-gray-400 font-normal">(선택, 비우면 인기 목적지 전체)</span>
                  </label>
                  <AirportAutocompleteInput
                    value={flightDestination}
                    onChange={setFlightDestination}
                    placeholder="제주, CJU, Tokyo, NRT..."
                    aria-label="목적지 공항 검색"
                  />
                </div>
              </div>
              <Button
                onClick={handleSearchFlights}
                isLoading={isSearchingFlights}
                disabled={isSearchingFlights}
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isSearchingFlights ? '검색 중...' : '항공권 검색'}
              </Button>
            </div>

            {/* 검색 결과 */}
            {flightResults.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    ⚠️ 표시된 가격은 Amadeus API 기준 참고용 가격입니다. 실제 예약 시 Google Flights에서 확인되는 가격과 다를 수 있습니다.
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  검색 결과 ({flightResults.length}개)
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {flightResults.map((flight, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors bg-gray-50/50"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-lg text-orange-600">
                              {flight.price.toLocaleString('ko-KR')} {flight.currency}
                            </span>
                            {idx === 0 && (
                              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded font-medium">
                                최저가
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 font-medium mb-1">
                            {flight.destination} ({flight.destinationCode})
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                            <span>{flight.airline}</span>
                            <span>•</span>
                            <span>{flight.duration}</span>
                            <span>•</span>
                            <span>
                              {new Date(flight.departure).toLocaleString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <a
                          href={flight.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          onClick={() => {
                            // 클릭 추적 (선택적)
                            trackButtonClick('flight_booking_click', currentTripId || undefined, currentUser?.id);
                          }}
                        >
                          확인하기
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 사용법 가이드 (접을 수 있는 형태) */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100/50 overflow-hidden">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-2 rounded-lg">
                <BookOpen className="w-5 h-5 text-orange-600" />
             </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-gray-800">사용법 가이드</h3>
                <p className="text-xs text-gray-500">언제갈래? 서비스 이용 방법</p>
              </div>
            </div>
            {showGuide ? (
              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-90" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
            )}
          </button>
          
          {showGuide && (
            <div className="px-4 pb-4 space-y-4">
              <div className="pt-2 pb-3 border-t border-orange-100">
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  <strong className="text-orange-600">언제갈래?</strong>는 친구들과 함께 여행 일정을 조율하는 서비스입니다. 
                  각자 가능한 날짜를 선택하면 모두가 가능한 날짜를 한눈에 확인할 수 있어요! ✈️
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                    <CalendarHeart className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">📅 날짜 선택</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      • 단일 클릭/탭: 날짜 선택 또는 해제<br/>
                      • 드래그: 여러 날짜를 한 번에 선택 (모바일에서도 가능!)
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                    <Check className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">✅ 투표 모드</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      • <strong>"가능해요"</strong>: 선택한 날짜에 가능 표시<br/>
                      • <strong>"안돼요"</strong>: 선택한 날짜에 불가능 표시
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">👥 참여자 확인</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      • 참여자 이름 클릭: 해당 참여자만 보기<br/>
                      • <strong>"가장 많이 가능"</strong> 클릭: 가장 많은 참여자가 가능한 날짜만 보기
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                    <Share2 className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">🔗 공유하기</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      • <strong>"초대하기"</strong> 버튼으로 링크 복사 후 친구들에게 공유하세요!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Itinerary Section */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 sm:p-10 text-white shadow-md overflow-hidden relative">
           {/* Background Decoration */}
           <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
           <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>

           <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-white font-medium bg-white/20 w-fit px-3 py-1 rounded-lg backdrop-blur-sm">
                  <MapPin className="w-4 h-4" />
                  <span>AI 여행 플래너</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-bold leading-tight">
                    어디로 떠나볼까요?
                </h3>
                <p className="text-white/90 max-w-md">
                    날짜가 정해졌나요? 여행지만 알려주세요.<br/>
                    {selectedAiModel === 'gemini' ? 'Gemini' : 'GPT'}가 <strong>딱 맞는 일정</strong>을 추천해드릴게요! 🏝️
                </p>
                
                {/* AI 모델 선택 토글 */}
                <div className="flex items-center gap-3 mt-4">
                  <span className="text-white/80 text-sm font-medium">AI 모델:</span>
                  <div className="flex bg-white/20 border border-white/30 p-1 rounded-full shadow-sm backdrop-blur-sm">
                    <button
                      onClick={() => setSelectedAiModel('gemini')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                        selectedAiModel === 'gemini'
                          ? 'bg-white text-orange-600 shadow-md transform scale-105'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>Gemini</span>
                    </button>
                    <button
                      onClick={() => setSelectedAiModel('openai')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                        selectedAiModel === 'openai'
                          ? 'bg-white text-orange-600 shadow-md transform scale-105'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>GPT</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 max-w-md mt-6">
                    <div className="relative flex-grow">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input 
                            type="text" 
                            value={destination}
                            onChange={(e) => handleDestinationChange(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-300/50 border-none shadow-md"
                            placeholder="예: 제주도, 오사카..."
                        />
                    </div>
                    <Button 
                        onClick={handleGenerateItinerary} 
                        isLoading={isGenerating}
                        variant="ai-planner"
                        className="px-8 py-3.5"
                    >
                        추천받기
                    </Button>
                </div>
             </div>
             
             {/* Itinerary Result */}
             {itinerary && (
                 <div className="flex-1 w-full bg-white/90 backdrop-blur-md rounded-xl p-6 text-gray-800 shadow-md border border-white/50">
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

      {/* 푸터 */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-orange-100/50 py-4 sm:py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-400">
              © 2025 언제갈래? All rights reserved.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-gray-400">
              <span>기획: Jay, Shin</span>
              <span className="hidden sm:inline">•</span>
              <a 
                href="mailto:kdshin@freshmilk.kr" 
                className="hover:text-orange-500 transition-colors"
              >
                kdshin@freshmilk.kr
              </a>
              <span className="hidden sm:inline">•</span>
              <a 
                href="https://forms.gle/MiUa2TrigEMbtbAN8" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors underline"
              >
                💬 피드백 보내기
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* 튜토리얼 모달 */}
      {showTutorial && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (dontShowAgain) {
              localStorage.setItem('tripsync_seen_tutorial', 'true');
            }
            setShowTutorial(false);
            setTutorialStep(0);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 튜토리얼 단계별 내용 */}
            {tutorialStep === 0 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <Plane className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">언제갈래? 시작하기</h3>
                </div>
                <div className="mb-6">
                  <p className="text-sm sm:text-base text-gray-600 mb-4 leading-relaxed">
                    <strong className="text-orange-600">언제갈래?</strong>는 친구들과 함께 여행 일정을 조율하는 서비스입니다. 
                    각자 가능한 날짜를 선택하면 모두가 가능한 날짜를 한눈에 확인할 수 있어요! ✈️
                  </p>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <p className="text-xs text-orange-800 leading-relaxed">
                      💡 <strong>핵심 기능:</strong> 캘린더에서 드래그로 여러 날짜를 한 번에 선택하고, 
                      "가능해요" 또는 "안돼요"로 투표하세요. 모든 참여자가 가능한 날짜는 👑 표시로 보여집니다!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="dontShowAgain"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                  <label htmlFor="dontShowAgain" className="text-xs text-gray-600 cursor-pointer">
                    다시 보지 않기
                  </label>
                </div>
                {/* 페이지 넘버링 */}
                <div className="flex justify-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (dontShowAgain) {
                        localStorage.setItem('tripsync_seen_tutorial', 'true');
                      }
                      setShowTutorial(false);
                      setTutorialStep(0);
                    }}
                    className="flex-1 min-h-[48px]"
                  >
                    건너뛰기
                  </Button>
                  <Button
                    onClick={() => setTutorialStep(1)}
                    className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    다음
                  </Button>
                </div>
              </>
            )}
            
            {tutorialStep === 1 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <CalendarHeart className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">날짜 선택하기</h3>
                </div>
                <div className="mb-6 space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Check className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">단일 선택</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        날짜를 클릭하거나 탭하면 선택/해제됩니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Share2 className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">드래그 선택</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        날짜를 드래그하면 여러 날짜를 한 번에 선택할 수 있습니다. 모바일에서도 가능해요!
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Crown className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">가장 많이 가능한 날짜</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        👑 표시가 있는 날짜는 가장 많은 참여자가 가능한 날짜입니다!
                      </p>
                    </div>
                  </div>
                </div>
                {/* 페이지 넘버링 */}
                <div className="flex justify-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setTutorialStep(0)}
                    className="flex-1 min-h-[48px]"
                  >
                    이전
                  </Button>
                  <Button
                    onClick={() => setTutorialStep(2)}
                    className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    다음
                  </Button>
                </div>
              </>
            )}
            
            {tutorialStep === 2 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <UserIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">참여자 필터</h3>
                </div>
                <div className="mb-6 space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">개별 참여자 보기</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        참여자 이름을 클릭하면 해당 참여자가 선택한 날짜만 볼 수 있습니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Crown className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">"가장 많이 가능" 필터</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        참여자 리스트 맨 앞의 <strong>"가장 많이 가능"</strong> 버튼을 클릭하면 
                        가장 많은 참여자가 가능한 날짜만 표시됩니다.
                      </p>
                    </div>
                  </div>
                </div>
                {/* 페이지 넘버링 */}
                <div className="flex justify-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setTutorialStep(1)}
                    className="flex-1 min-h-[48px]"
                  >
                    이전
                  </Button>
                  <Button
                    onClick={() => setTutorialStep(3)}
                    className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    다음
                  </Button>
                </div>
              </>
            )}
            
            {/* 새로 추가: step 3 - 링크 공유 */}
            {tutorialStep === 3 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <Share2 className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">친구 초대하기</h3>
                </div>
                <div className="mb-6 space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Share2 className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">초대하기 버튼</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        캘린더 화면 상단의 <strong>"초대하기"</strong> 버튼을 클릭하면 공유 링크가 생성됩니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                      <Copy className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">링크 복사</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        생성된 링크를 복사하여 친구들에게 공유하세요. 친구들이 링크로 접속하면 
                        같은 일정에 참여할 수 있습니다!
                      </p>
                    </div>
                  </div>
                </div>
                {/* 페이지 넘버링 */}
                <div className="flex justify-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-200"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setTutorialStep(2)}
                    className="flex-1 min-h-[48px]"
                  >
                    이전
                  </Button>
                  <Button
                    onClick={() => {
                      if (dontShowAgain) {
                        localStorage.setItem('tripsync_seen_tutorial', 'true');
                      }
                      setShowTutorial(false);
                      setTutorialStep(0);
                    }}
                    className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    완료
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 새로운 일정 만들기 모달 */}
      {showNewTripModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNewTripModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-50 p-2 rounded-lg">
                <PlusCircle className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">새로운 일정 만들기</h3>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
              새로운 여행 일정을 만들면 현재 일정에서 나가게 됩니다.<br/>
              새로운 일정을 만들까요?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowNewTripModal(false)}
                className="flex-1 min-h-[48px]"
              >
                취소
              </Button>
              <Button
                onClick={confirmNewTrip}
                className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowExitModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-50 p-2 rounded-lg">
                <X className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">나가기</h3>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
              정말 나가시겠어요?<br/>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowExitModal(false)}
                className="flex-1 min-h-[48px]"
              >
                취소
              </Button>
              <Button
                onClick={confirmExit}
                className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
              >
                나가기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜 미선택 알림 모달 */}
      {showNoDateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNoDateModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-50 p-2 rounded-lg">
                <CalendarHeart className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">날짜를 선택해주세요</h3>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
              AI 여행 일정을 추천받으려면<br/>
              먼저 캘린더에서 <strong className="text-orange-600">가능한 날짜를 선택</strong>해주세요! 📅
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowNoDateModal(false)}
                className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 복사 성공 모달 */}
      {showCopySuccessModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCopySuccessModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-full">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">복사 완료!</h3>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
              가장 많이 가능한 일정이 클립보드에 복사되었습니다!<br/>
              친구들에게 공유해보세요! 📋✨
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowCopySuccessModal(false)}
                className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Analytics는 프로덕션 환경에서만 활성화 (로컬 개발 환경 타입 오류 방지) */}
      {/* @ts-ignore - import.meta.env.PROD는 Vite에서 제공하는 환경 변수 */}
      {import.meta.env.PROD && <Analytics />}
    </div>
  );
};

export default TripPage;

// 라우팅을 담당하는 메인 App 컴포넌트
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/my-trips" element={<MyTripsPage />} />
        <Route path="/" element={<TripPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export { App };