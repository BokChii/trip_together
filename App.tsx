import React, { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { DateVote, User, VoteType } from './types';
import { Users, MapPin, Plane, Share2, Check, Copy, X, ArrowRight, CalendarHeart } from 'lucide-react';
import { generateItinerary } from './services/geminiService';

// 백엔드가 없으므로 시뮬레이션을 위한 한국 이름 데이터
const NAMES = ['지수', '민호', '서연', '준호', '유진', '도윤', '하은'];

// URL 공유를 위한 데이터 최소화 인터페이스
interface MinUser {
  i: string; // id
  n: string; // name
}
interface MinVote {
  d: string; // date (compressed YYYYMMDD)
  ui: number; // user index
  t: 0 | 1; // 1: available, 0: unavailable
}
interface MinPayload {
  u: MinUser[];
  v: MinVote[];
  dst: string; // destination
}

// Short ID generator (6 chars)
const generateId = () => Math.random().toString(36).substring(2, 8);

// Date Helpers for Compression (YYYY-MM-DD <-> YYYYMMDD)
const compressDate = (iso: string) => iso.replace(/-/g, '');
const decompressDate = (str: string) => {
    if (str.length !== 8) return str;
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
};

const App: React.FC = () => {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [votes, setVotes] = useState<DateVote[]>([]);
  const [voteMode, setVoteMode] = useState<VoteType>('available');
  
  // Share State
  const [isCopied, setIsCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  
  // AI Itinerary State
  const [destination, setDestination] = useState('제주도');
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize Data from LocalStorage and URL
  useEffect(() => {
    const initData = () => {
      // 1. Load Local User
      const savedUserStr = localStorage.getItem('tripsync_user');
      let localUser: User | null = null;
      if (savedUserStr) {
        try {
          localUser = JSON.parse(savedUserStr);
          setCurrentUser(localUser);
        } catch (e) {
          console.error("Failed to parse user", e);
        }
      }

      // 2. Load Shared Data from URL
      const params = new URLSearchParams(window.location.search);
      const dataStr = params.get('d');
      
      let sharedUsers: User[] = [];
      let sharedVotes: DateVote[] = [];
      let sharedDest = '제주도';

      if (dataStr) {
        try {
          // Restore Base64 standard characters
          const base64 = dataStr.replace(/-/g, '+').replace(/_/g, '/');
          // Decode Base64 with UTF-8 support
          const jsonStr = decodeURIComponent(escape(atob(base64)));
          const payload: MinPayload = JSON.parse(jsonStr);
          
          // Reconstruct Users
          if (Array.isArray(payload.u)) {
            sharedUsers = payload.u.map(u => ({ id: u.i, name: u.n }));
          }

          // Reconstruct Votes
          if (Array.isArray(payload.v) && sharedUsers.length > 0) {
            sharedVotes = payload.v.map(v => {
              const user = sharedUsers[v.ui];
              return {
                date: decompressDate(v.d),
                userId: user ? user.id : '',
                type: (v.t === 1 ? 'available' : 'unavailable') as VoteType
              };
            }).filter(v => v.userId !== '');
          }

          if (payload.dst) sharedDest = payload.dst;
          
          setDestination(sharedDest);
          setVotes(sharedVotes);
        } catch (e) {
          console.error("Failed to parse shared data", e);
        }
      }

      // 3. Merge Users (Shared + Local)
      let finalUsers = [...sharedUsers];
      
      if (localUser) {
        const exists = finalUsers.find(u => u.id === localUser!.id);
        if (!exists) {
          finalUsers.push(localUser);
        }
      }
      
      setUsers(finalUsers);
    };

    initData();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    
    // Check if user already exists in the list (simple name check for safety)
    const existing = users.find(u => u.name === nameInput.trim());
    if (existing) {
        if (!window.confirm(`${existing.name}님으로 계속하시겠습니까?`)) {
            return;
        }
        confirmUser(existing);
        return;
    }

    const newUser: User = {
      id: generateId(),
      name: nameInput.trim()
    };
    
    confirmUser(newUser);
  };

  const confirmUser = (user: User) => {
    setCurrentUser(user);
    setUsers(prev => {
        if (prev.find(u => u.id === user.id)) return prev;
        return [...prev, user];
    });
    localStorage.setItem('tripsync_user', JSON.stringify(user));
  };

  /**
   * 투표 처리 함수
   * @param dateIsoOrList 날짜 문자열 또는 날짜 문자열 배열
   * @param shouldRemove true일 경우 해당 날짜의 투표를 삭제(취소)함. undefined일 경우 기존 토글 로직.
   */
  const handleVote = (dateIsoOrList: string | string[], shouldRemove?: boolean) => {
    if (!currentUser) return;

    const datesToUpdate = Array.isArray(dateIsoOrList) ? dateIsoOrList : [dateIsoOrList];

    setVotes(prev => {
      // 1. 해당 날짜들에 대한 내 기존 투표를 모두 제거 (Clean slate)
      const filteredVotes = prev.filter(v => 
        !(datesToUpdate.includes(v.date) && v.userId === currentUser.id)
      );

      // 2. 삭제(취소) 모드라면 여기서 종료
      if (shouldRemove) {
          return filteredVotes;
      }

      // 3. shouldRemove가 명시되지 않은 단일 클릭의 경우 (Legacy Toggle)
      //    -> 이미 선택된 상태였다면 제거된 상태 그대로 반환 (Toggle Off)
      if (shouldRemove === undefined && !Array.isArray(dateIsoOrList)) {
         const existingVote = prev.find(v => v.date === dateIsoOrList && v.userId === currentUser.id);
         if (existingVote && existingVote.type === voteMode) {
             return filteredVotes; 
         }
      }

      // 4. 새로운 투표 추가
      const newEntries = datesToUpdate.map(date => ({
        date,
        userId: currentUser.id,
        type: voteMode
      }));

      return [...filteredVotes, ...newEntries];
    });
  };

  const addFakeFriend = () => {
    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)] + ` #${users.length}`;
    const fakeId = generateId();
    const fakeUser: User = { id: fakeId, name: randomName };
    
    setUsers(prev => [...prev, fakeUser]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const newVotes: DateVote[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const rand = Math.random();
        const dateIso = new Date(year, month, i).toISOString().split('T')[0];
        
        if (rand < 0.4) {
            newVotes.push({ date: dateIso, userId: fakeId, type: 'available' });
        } else if (rand > 0.9) {
            newVotes.push({ date: dateIso, userId: fakeId, type: 'unavailable' });
        }
    }
    setVotes(prev => [...prev, ...newVotes]);
  };

  const handleShare = async () => {
    const minUsers: MinUser[] = users.map(u => ({ i: u.id, n: u.name }));
    const minVotes: MinVote[] = votes.map(v => {
      const userIndex = users.findIndex(u => u.id === v.userId);
      return {
        d: compressDate(v.date),
        ui: userIndex,
        t: v.type === 'available' ? 1 : 0
      };
    }).filter(v => v.ui !== -1);

    const payload: MinPayload = {
      u: minUsers,
      v: minVotes,
      dst: destination
    };

    try {
      const jsonStr = JSON.stringify(payload);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      const urlSafeEncoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      let baseUrl = window.location.href.split('?')[0];
      baseUrl = baseUrl.split('#')[0];
      
      const url = `${baseUrl}?d=${urlSafeEncoded}`;
      
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

  if (!currentUser) {
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
            친구들과 떠나는 설레는 여행!<br/>
            우리 언제 만날지 여기서 정해봐요.
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4 mb-8">
            <input
              type="text"
              placeholder="닉네임이 뭐에요?"
              className="w-full px-6 py-4 rounded-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-center text-lg font-medium placeholder:text-gray-400 text-gray-900"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            <Button type="submit" className="w-full text-lg shadow-lg shadow-orange-200" size="lg">시작하기</Button>
          </form>

          {/* Existing Users Selection for Re-login */}
          {users.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                  <p className="text-sm text-gray-400 mb-3 font-medium">이미 참여하고 있나요?</p>
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
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-block text-sm text-gray-500 bg-orange-50 px-3 py-1 rounded-full">
                반가워요, <strong className="text-orange-600">{currentUser.name}</strong>님! 👋
              </span>
              <button onClick={() => {
                  if(window.confirm("정말 나가시겠어요?")) {
                    setCurrentUser(null);
                    localStorage.removeItem('tripsync_user');
                  }
              }} className="text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors">나가기</button>
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
               <Button variant="ghost" size="sm" onClick={addFakeFriend} className="gap-2 text-xs hidden sm:flex">
                  <Users className="w-3 h-3" />
                  테스트 친구
               </Button>
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

        {/* Calendar */}
        <Calendar 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          votes={votes}
          users={users}
          currentUserId={currentUser.id}
          voteMode={voteMode}
          onVote={handleVote}
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
                            onChange={(e) => setDestination(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 rounded-full text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-orange-300/50 border-none shadow-lg"
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
    </div>
  );
};

export default App;