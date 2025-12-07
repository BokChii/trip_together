import React, { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { DateVote, User, VoteType } from './types';
import { MapPin, Plane, Share2, Check, ArrowRight, CalendarHeart, WifiOff } from 'lucide-react';
import { generateItinerary } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';

const App: React.FC = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [tripId, setTripId] = useState<string | null>(null);
  const [destination, setDestination] = useState('즐거운 여행'); // 기본값 변경
  
  const [users, setUsers] = useState<User[]>([]);
  const [votes, setVotes] = useState<DateVote[]>([]);
  const [voteMode, setVoteMode] = useState<VoteType>('available');
  
  // Share & UI State
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // AI Itinerary State
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    // 1. URL에서 tripId 확인
    const params = new URLSearchParams(window.location.search);
    const urlTripId = params.get('id');

    if (urlTripId) {
      setTripId(urlTripId);
      // 오프라인/데모 ID인지 확인 (demo- 로 시작하면 로컬스토리지 사용)
      if (urlTripId.startsWith('demo-')) {
          setIsOffline(true);
          const storedUsers = localStorage.getItem(`demo_users_${urlTripId}`);
          if (storedUsers) setUsers(JSON.parse(storedUsers));
          const storedVotes = localStorage.getItem(`demo_votes_${urlTripId}`);
          if (storedVotes) setVotes(JSON.parse(storedVotes));
          const storedDest = localStorage.getItem(`demo_dest_${urlTripId}`);
          if (storedDest) setDestination(storedDest);
      } else {
          fetchTripData(urlTripId);
          subscribeToRealtime(urlTripId);
      }
    }

    // 2. 로컬스토리지에서 내 정보 확인 (해당 Trip에 대한)
    const storedUser = localStorage.getItem(`tripsync_user_${urlTripId || 'new'}`);
    if (storedUser) {
        try {
            setCurrentUser(JSON.parse(storedUser));
        } catch (e) {
            console.error("User parsing error", e);
        }
    }
  }, []);

  // --- Supabase Actions ---

  const fetchTripData = async (tid: string) => {
    try {
        setIsLoading(true);
        if (!isSupabaseConfigured) throw new Error("Supabase credentials missing");

        // 1. Get Trip Info
        const { data: tripData, error: tripError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tid)
            .single();
        
        if (tripError || !tripData) {
            throw tripError || new Error("Trip not found");
        }
        setDestination(tripData.destination);

        // 2. Get Users
        const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('trip_id', tid);
        
        if (userData) setUsers(userData);

        // 3. Get Votes
        const { data: voteData } = await supabase
            .from('votes')
            .select('*')
            .eq('trip_id', tid);
        
        if (voteData) {
            setVotes(voteData.map(v => ({
                date: v.date,
                userId: v.user_id,
                type: v.type as VoteType
            })));
        }
    } catch (e: any) {
        console.error("Trip fetch error:", e);
        // 에러 발생 시 오프라인 모드로 전환하여 앱이 죽지 않게 함
        if (e.message !== "Supabase credentials missing") {
            alert("데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.");
        }
        setIsOffline(true);
    } finally {
        setIsLoading(false);
    }
  };

  const subscribeToRealtime = (tid: string) => {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase.channel(`trip_${tid}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tid}` },
            () => fetchVotesOnly(tid)
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users', filter: `trip_id=eq.${tid}` },
            () => fetchUsersOnly(tid)
        )
        .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  };

  const fetchVotesOnly = async (tid: string) => {
      const { data } = await supabase.from('votes').select('*').eq('trip_id', tid);
      if (data) {
          setVotes(data.map(v => ({ date: v.date, userId: v.user_id, type: v.type as VoteType })));
      }
  };
  
  const fetchUsersOnly = async (tid: string) => {
      const { data } = await supabase.from('users').select('*').eq('trip_id', tid);
      if (data) setUsers(data);
  };

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setIsLoading(true);
    try {
        if (!isSupabaseConfigured) throw new Error("Supabase credentials not set");

        // 1. Create Trip
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .insert({ destination })
            .select()
            .single();

        if (tripError || !trip) throw tripError;

        await createUserAndLogin(trip.id, nameInput.trim());

    } catch (error: any) {
        console.error("Error starting trip:", error);
        
        // Fallback to Offline Mode
        setIsOffline(true);
        const demoTripId = 'demo-' + Math.random().toString(36).substr(2, 6);
        localStorage.setItem(`demo_dest_${demoTripId}`, destination);
        setupDemoSession(demoTripId, nameInput.trim());
    } finally {
        setIsLoading(false);
    }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!tripId || !nameInput.trim()) return;
      
      const existingUser = users.find(u => u.name === nameInput.trim());
      if (existingUser) {
          if (confirm(`${existingUser.name}님으로 로그인하시겠습니까?`)) {
              setCurrentUser(existingUser);
              localStorage.setItem(`tripsync_user_${tripId}`, JSON.stringify(existingUser));
              return;
          }
          return;
      }

      if (isOffline) {
          setupDemoSession(tripId, nameInput.trim());
      } else {
          setIsLoading(true);
          try {
             await createUserAndLogin(tripId, nameInput.trim());
          } catch (error: any) {
               console.error("Join error:", error);
               alert("참여 실패: " + (error.message || "알 수 없는 오류"));
          } finally {
              setIsLoading(false);
          }
      }
  };

  const setupDemoSession = (tid: string, name: string) => {
      const user: User = { id: 'user-' + Date.now(), name: name, trip_id: tid };
      const currentUsers = [...users, user]; 
      
      setUsers(currentUsers);
      localStorage.setItem(`demo_users_${tid}`, JSON.stringify(currentUsers));
      
      setTripId(tid);
      setCurrentUser(user);
      localStorage.setItem(`tripsync_user_${tid}`, JSON.stringify(user));

      const newUrl = `${window.location.pathname}?id=${tid}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
  };
  
  const createUserAndLogin = async (tid: string, name: string) => {
      const { data: user, error } = await supabase
            .from('users')
            .insert({ trip_id: tid, name: name })
            .select()
            .single();
        
      if (error || !user) throw error;

      setTripId(tid);
      setCurrentUser(user);
      setUsers(prev => [...prev, user]);
      localStorage.setItem(`tripsync_user_${tid}`, JSON.stringify(user));
      
      const newUrl = `${window.location.pathname}?id=${tid}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      subscribeToRealtime(tid);
  };

  const handleVote = async (dateIsoOrList: string | string[], shouldRemove?: boolean) => {
    if (!currentUser || !tripId) return;

    const datesToUpdate = Array.isArray(dateIsoOrList) ? dateIsoOrList : [dateIsoOrList];

    // Optimistic Update (화면 즉시 반영)
    const newVotes = votes.filter(v => !(datesToUpdate.includes(v.date) && v.userId === currentUser.id));
    
    let finalVotes = newVotes;
    if (!shouldRemove) {
        if (shouldRemove === undefined && !Array.isArray(dateIsoOrList)) {
            // Toggle logic for single click
            const existing = votes.find(v => v.date === dateIsoOrList && v.userId === currentUser.id);
            if (!existing || existing.type !== voteMode) {
                finalVotes = [...newVotes, { date: dateIsoOrList, userId: currentUser.id, type: voteMode }];
            }
        } else {
            // Bulk add
            const newEntries = datesToUpdate.map(date => ({
                date,
                userId: currentUser.id,
                type: voteMode
            }));
            finalVotes = [...newVotes, ...newEntries];
        }
    }
    
    setVotes(finalVotes);
    
    if (isOffline) {
        localStorage.setItem(`demo_votes_${tripId}`, JSON.stringify(finalVotes));
        return;
    }

    // DB Update
    try {
        if (shouldRemove) {
             await supabase
                .from('votes')
                .delete()
                .eq('trip_id', tripId)
                .eq('user_id', currentUser.id)
                .in('date', datesToUpdate);
        } else {
             // 1. Delete existing for these dates (to avoid conflicts or cleanup old type)
             await supabase
                .from('votes')
                .delete()
                .eq('trip_id', tripId)
                .eq('user_id', currentUser.id)
                .in('date', datesToUpdate);

             // 2. Insert new ones
             const toInsert = finalVotes
                .filter(v => v.userId === currentUser.id && datesToUpdate.includes(v.date))
                .map(v => ({
                     trip_id: tripId,
                     user_id: currentUser.id,
                     date: v.date,
                     type: v.type
                 }));
             
             if (toInsert.length > 0) {
                 await supabase.from('votes').insert(toInsert);
             }
        }
    } catch (e) {
        console.error("Vote error", e);
        // 실제 앱에서는 여기서 Rollback 처리가 필요할 수 있음
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
        prompt("이 링크를 복사하세요:", url);
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

  // ---------------- UI: Landing / Login ----------------
  if (!tripId || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff7ed] p-4 font-sans">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-orange-100 max-w-md w-full text-center border border-orange-50">
          <div className="mb-6 flex justify-center">
            <div className="bg-orange-100 p-5 rounded-full animate-bounce">
              <Plane className="w-10 h-10 text-orange-500" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl font-hand font-bold text-gray-800 mb-3">언제갈래? ✈️</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {tripId ? "친구들이 기다리고 있어요!" : "친구들과 떠나는 설레는 여행!"}<br/>
            {tripId ? "이름을 입력하고 참여하세요." : "우리 언제 만날지 쉽게 정해보세요."}
          </p>
          
          <form onSubmit={tripId ? handleJoinTrip : handleStartTrip} className="space-y-4 mb-8">
            <input
              type="text"
              placeholder="닉네임이 뭐에요?"
              className="w-full px-6 py-4 rounded-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-center text-lg font-medium placeholder:text-gray-400 text-gray-900"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            <Button type="submit" className="w-full text-lg shadow-lg shadow-orange-200" size="lg" isLoading={isLoading}>
                {tripId ? "입장하기" : "방 만들기"}
            </Button>
          </form>
          
          {!isSupabaseConfigured && (
              <p className="text-xs text-orange-400 mt-4">
                  * Supabase 설정이 감지되지 않아 데모 모드로 실행됩니다.
              </p>
          )}

          {tripId && users.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                  <p className="text-sm text-gray-400 mb-3 font-medium">이미 참여하셨나요?</p>
                  <div className="flex flex-wrap justify-center gap-2">
                      {users.map(u => (
                          <button
                            key={u.id}
                            onClick={() => {
                                if(confirm(`${u.name}님으로 다시 로그인할까요?`)) {
                                    setCurrentUser(u);
                                    localStorage.setItem(`tripsync_user_${tripId}`, JSON.stringify(u));
                                }
                            }}
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

  // ---------------- UI: Main App ----------------
  return (
    <div className="min-h-screen bg-[#fff7ed] text-gray-900 pb-20 font-sans">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
               <div className="bg-orange-500 p-1.5 rounded-lg">
                   <Plane className="w-4 h-4 text-white" fill="currentColor" />
               </div>
               <span className="font-hand font-bold text-2xl text-gray-800 tracking-tight pt-1">언제갈래</span>
               {destination !== '즐거운 여행' && (
                 <>
                   <span className="text-sm text-gray-400 mx-2 hidden sm:inline">|</span>
                   <span className="text-sm font-bold text-gray-600 hidden sm:inline">{destination}</span>
                 </>
               )}
            </div>
            <div className="flex items-center gap-4">
              {isOffline && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      <WifiOff className="w-3 h-3" /> 오프라인/데모
                  </span>
              )}
              <span className="hidden sm:inline-block text-sm text-gray-500 bg-orange-50 px-3 py-1 rounded-full">
                반가워요, <strong className="text-orange-600">{currentUser.name}</strong>님! 👋
              </span>
              <button onClick={() => {
                  if(window.confirm("로그아웃 하시겠습니까?")) {
                    setCurrentUser(null);
                    localStorage.removeItem(`tripsync_user_${tripId}`);
                  }
              }} className="text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors">나가기</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col gap-5 bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-orange-50">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
             <div className="flex flex-col gap-1">
               <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   <CalendarHeart className="w-6 h-6 text-orange-500" />
                   언제가 좋으세요?
               </h2>
               <p className="text-sm text-gray-500 pl-1">가능한 날짜를 드래그해서 선택해주세요.</p>
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
        </div>

        <Calendar 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          votes={votes}
          users={users}
          currentUserId={currentUser.id}
          voteMode={voteMode}
          onVote={handleVote}
        />

        <div className="bg-gradient-to-br from-orange-400 to-rose-400 rounded-[2rem] p-6 sm:p-10 text-white shadow-xl shadow-orange-200 overflow-hidden relative">
           <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
           <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-yellow-300/20 rounded-full blur-2xl"></div>

           <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-orange-50 font-medium bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                  <MapPin className="w-4 h-4" />
                  <span>AI 여행 플래너</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-hand font-bold leading-tight">
                    {destination === '즐거운 여행' ? '이번 여행' : destination} 계획해볼까요?
                </h3>
                <p className="text-orange-50 opacity-90 max-w-md">
                    가장 투표가 많이 된 날짜를 기준으로<br/>
                    Gemini가 <strong>딱 맞는 일정</strong>을 추천해드릴게요! 🏝️
                </p>
                
                <div className="mt-6">
                    <Button 
                        onClick={handleGenerateItinerary} 
                        isLoading={isGenerating}
                        className="bg-white text-orange-600 hover:bg-orange-50 border-none shadow-lg px-8 py-3.5 w-full sm:w-auto"
                    >
                        일정 생성하기
                    </Button>
                </div>
             </div>
             
             {itinerary && (
                 <div className="flex-1 w-full bg-white/90 backdrop-blur-md rounded-[1.5rem] p-6 text-gray-800 shadow-lg border border-white/50">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-600">
                        <Plane className="w-5 h-5" />
                        추천 일정
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
    </div>
  );
};

export default App;