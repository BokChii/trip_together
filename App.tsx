import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Calendar } from './components/Calendar';
import { DateRangePicker } from './components/DateRangePicker';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { DateVote, User, VoteType } from './types';
import { MapPin, Plane, Share2, Check, Copy, X, ArrowRight, CalendarHeart, Calendar as CalendarIcon, PlusCircle, User as UserIcon, Crown, BookOpen, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
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
  
  // 날짜 범위 선택 State (DateRangePicker용)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  
  // 날짜 범위 선택 캘린더 토글 State
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // 날짜 범위 선택 핸들러
  const handleDateRangeClick = (isoDate: string) => {
    if (!dateRangeStart) {
      // 첫 번째 클릭: 시작일 설정
      setDateRangeStart(isoDate);
      setDateRangeEnd(null);
    } else if (!dateRangeEnd) {
      // 두 번째 클릭: 종료일 설정
      const startDate = new Date(dateRangeStart);
      const clickedDate = new Date(isoDate);
      
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

    // console.log('✅ Subscriptions: All subscriptions active');

    return () => {
      // console.log('🔌 Subscriptions: Cleaning up subscriptions');
      tripSubscription.unsubscribe();
      usersSubscription.unsubscribe();
      votesSubscription.unsubscribe();
    };
  }, [currentTripId, currentUser]);

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

    // Trip이 없으면 생성 (사용자가 로그인할 때 생성)
    if (!currentTripId) {
      // console.log('📝 confirmUser: No trip exists, creating new trip...');
      setIsLoadingTrip(true);
      try {
        const newTrip = await createTrip(
          destination,
          startDateInput || null,
          endDateInput || null
        );
        // console.log('✅ confirmUser: Trip created', { tripId: newTrip.id, shareCode: newTrip.share_code });
        setCurrentTripId(newTrip.id);
        setShareCode(newTrip.share_code);
        setTripStartDate(newTrip.start_date || null);
        setTripEndDate(newTrip.end_date || null);
        
        // 사용자 추가
        // console.log('👤 confirmUser: Adding user to new trip...');
        await addTripUser(newTrip.id, user);
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
        await addTripUser(currentTripId, user);
        // console.log('✅ confirmUser: User added to existing trip successfully');
        
        // localStorage에 사용자 정보와 trip_id를 함께 저장
        const userWithTripId = {
          ...user,
          trip_id: currentTripId
        };
        localStorage.setItem('tripsync_user', JSON.stringify(userWithTripId));
        
        // Users will be updated via subscription
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
    const plan = await generateItinerary({
        destination,
        startDate,
        endDate: endDate || startDate
    });
    setItinerary(plan);
    setIsGenerating(false);
  };

  // 날짜를 연속된 그룹으로 묶고 포맷팅하는 함수
  const formatBestDates = (): { dates: string; participants: string } => {
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      if (v.type === 'available') {
        voteCounts[v.date] = (voteCounts[v.date] || 0) + 1;
      }
    });

    const maxVotes = Math.max(...Object.values(voteCounts), 0);
    if (maxVotes === 0) {
      return { dates: '', participants: '' };
    }

    // 가장 많이 선택된 날짜들만 필터링 (ISO 문자열 그대로 사용)
    const bestDates = Object.keys(voteCounts)
      .filter(d => voteCounts[d] === maxVotes)
      .sort();

    if (bestDates.length === 0) {
      return { dates: '', participants: '' };
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
      participants: participantNames
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
    } catch (error) {
      alert('복사에 실패했습니다.');
    }
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
    setDateRangeStart(null);
    setDateRangeEnd(null);
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
      <div className="min-h-screen flex flex-col bg-[#fff7ed] p-4 font-sans">
        <div className="flex-1 flex items-center justify-center">
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
          
          {/* Existing Users Selection for Re-login - 여행 기간과 닉네임 입력칸 사이로 이동 */}
          {users.length > 0 && (
              <div className="mb-6 p-4 bg-white border border-orange-100 rounded-xl">
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
          
          <form onSubmit={handleLogin} className="space-y-5 mb-10">
            <input
              type="text"
              placeholder="닉네임이 뭐에요?"
              className="w-full px-6 sm:px-8 py-4 sm:py-5 min-h-[56px] rounded-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-center text-lg sm:text-xl font-medium placeholder:text-gray-400 text-gray-900"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            
            {/* 최초 유저만 기간 설정 표시 */}
            {!currentTripId && users.length === 0 && (
              <div className="pt-2 pb-1">
                <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-2xl p-5 sm:p-6 shadow-sm">
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
                    <div className="mb-4 p-3 bg-white rounded-xl border border-orange-200">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="font-semibold text-orange-600">
                          {dateRangeStart ? new Date(dateRangeStart).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '시작일'}
                        </span>
                        <span className="text-orange-400">~</span>
                        <span className="font-semibold text-orange-600">
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
            
            <Button type="submit" className="w-full text-lg sm:text-xl py-5 sm:py-6 min-h-[56px] shadow-lg shadow-orange-200" size="lg">시작하기</Button>
          </form>
          
          {/* 사용법 보기 버튼 */}
          <button
            onClick={() => setShowTutorial(true)}
            className="w-full mt-4 text-sm text-gray-500 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
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
              className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 튜토리얼 단계별 내용 - 로그인 화면용 간단 버전 */}
              {tutorialStep === 0 && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-100 p-2 rounded-full">
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
    <div className="min-h-screen bg-[#fff7ed] text-gray-900 pb-20 font-sans">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
               <div className="bg-orange-500 p-1 sm:p-1.5 rounded-lg">
                   <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" />
               </div>
               <span className="font-hand font-bold text-xl sm:text-2xl text-gray-800 tracking-tight pt-1">언제갈래</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={handleNewTrip}
                className="min-h-[44px] text-xs sm:text-sm font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 sm:px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">새로운 일정 만들기</span>
                <span className="sm:hidden">새 일정</span>
              </button>
              <span className="hidden sm:inline-block text-sm text-gray-500 bg-orange-50 px-3 py-1 rounded-full">
                반가워요, <strong className="text-orange-600">{currentUser.name}</strong>님! 👋
              </span>
              <button 
                onClick={handleExit} 
                className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        
        {/* 사용법 가이드 (접을 수 있는 형태) */}
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-orange-50 overflow-hidden">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between p-4 hover:bg-orange-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-full">
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
            <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2">
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
        
        {/* 친구 초대하기 - 가이드 아래, 캘린더 위로 이동 */}
        <div className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-orange-50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-orange-500" />
                친구 초대하기
              </h3>
              <p className="text-xs text-gray-500">링크를 복사해서 친구들에게 공유하세요</p>
            </div>
            <Button 
              variant="secondary" 
              size="md" 
              onClick={handleShare} 
              className={`gap-2 transition-all duration-300 ${isCopied ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {isCopied ? "복사완료!" : "초대하기"}
            </Button>
          </div>

          {/* Generated Link Display */}
          {generatedUrl && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4 pt-4 border-t border-orange-100">
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
        <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm -mx-4 sm:mx-0 px-4 sm:px-0 mb-4">
          <div className="bg-white p-3 sm:p-4 rounded-b-[1.5rem]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">날짜 선택 모드</p>
              <ModeToggle mode={voteMode} setMode={setVoteMode} />
            </div>
          </div>
        </div>

        {/* 참여자 목록 - Sticky로 변경 (캘린더 바로 위) */}
        {users.length > 1 && (
          <div className="sticky top-[calc(4rem+80px)] z-40 bg-white/95 backdrop-blur-md border-b border-orange-100 shadow-sm -mx-4 sm:mx-0 px-4 sm:px-0 mb-4">
            <div className="bg-white p-3 sm:p-4 rounded-b-[1.5rem]">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-700">참여자</h3>
              <span className="text-xs text-gray-400">({users.length}명)</span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex gap-2 min-w-max sm:flex-wrap sm:min-w-0">
                {/* "가장 많이 가능" 버튼 추가 */}
                <button
                  onClick={() => setSelectedUserId(selectedUserId === 'all' ? null : 'all')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
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
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap relative ${
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
        <div className="bg-white rounded-[2rem] p-5 sm:p-6 shadow-sm border border-orange-50">
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
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
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

      {/* 푸터 */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-orange-100 py-4 sm:py-6 mt-8">
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
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 튜토리얼 단계별 내용 */}
            {tutorialStep === 0 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-100 p-2 rounded-full">
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
                  <div className="bg-orange-100 p-2 rounded-full">
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
                  <div className="bg-orange-100 p-2 rounded-full">
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
                  <div className="bg-orange-100 p-2 rounded-full">
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
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
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
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
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
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
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
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-orange-100 max-w-md w-full sm:max-w-lg p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-2"
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
      <Analytics />
    </div>
  );
};

export default App;