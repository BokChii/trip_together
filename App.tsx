import React, { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { ModeToggle } from './components/ModeToggle';
import { Button } from './components/Button';
import { DateVote, User, VoteType } from './types';
import { Users, MapPin, Sparkles, Share2, Check, AlertCircle } from 'lucide-react';
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
  const [isBlobEnv, setIsBlobEnv] = useState(false);
  
  // AI Itinerary State
  const [destination, setDestination] = useState('제주도');
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize Data from LocalStorage and URL
  useEffect(() => {
    // Check environment
    setIsBlobEnv(window.location.protocol === 'blob:');

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
    
    const newUser: User = {
      id: generateId(),
      name: nameInput.trim()
    };
    
    setCurrentUser(newUser);
    setUsers(prev => {
        if (prev.find(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
    });
    localStorage.setItem('tripsync_user', JSON.stringify(newUser));
  };

  const handleVote = (dateIso: string) => {
    if (!currentUser) return;

    setVotes(prev => {
      const filtered = prev.filter(v => !(v.date === dateIso && v.userId === currentUser.id));
      const existingVote = prev.find(v => v.date === dateIso && v.userId === currentUser.id);
      
      if (existingVote && existingVote.type === voteMode) {
        return filtered;
      }
      
      return [...filtered, { date: dateIso, userId: currentUser.id, type: voteMode }];
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
    if (isBlobEnv) {
        alert("주의: 현재 브라우저 프리뷰(Blob URL) 환경에서는 공유 링크가 외부에서 작동하지 않습니다. 실제 서버에 배포 후 테스트해주세요.");
        // 계속 진행은 하되 사용자에게 알림
    }

    // 1. Minify Users
    const minUsers: MinUser[] = users.map(u => ({ i: u.id, n: u.name }));
    
    // 2. Minify Votes (Use User Index to save space)
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
      
      // Construct URL carefully
      let baseUrl = window.location.href.split('?')[0];
      // remove hash if present for cleaner url
      baseUrl = baseUrl.split('#')[0];
      
      const url = `${baseUrl}?d=${urlSafeEncoded}`;
      
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
      alert("링크 복사에 실패했습니다.");
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="bg-indigo-100 p-4 rounded-full">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">TripSync에 오신 것을 환영합니다</h1>
          <p className="text-gray-500 mb-6">친구들과 여행 날짜를 쉽고 간편하게 조율해보세요.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" size="lg">시작하기</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
               <Sparkles className="w-5 h-5 text-indigo-600" />
               <span className="font-bold text-lg text-gray-900 tracking-tight">TripSync</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-block text-sm text-gray-500">안녕하세요, <strong>{currentUser.name}</strong>님</span>
              <button onClick={() => {
                  setCurrentUser(null);
                  localStorage.removeItem('tripsync_user');
              }} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Environment Warning */}
        {isBlobEnv && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3" />
                    <p className="text-sm text-amber-700">
                        현재 <strong>프리뷰 모드(Blob URL)</strong>에서 실행 중입니다. 생성된 공유 링크는 외부에서 접속이 불가능할 수 있습니다. 
                        정상적인 공유 기능을 테스트하려면 앱을 배포해주세요.
                    </p>
                </div>
            </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <div className="flex flex-col gap-1">
             <h2 className="text-lg font-semibold text-gray-900">날짜 선택</h2>
             <p className="text-sm text-gray-500">가능한 날짜와 불가능한 날짜를 표시해주세요.</p>
           </div>
           
           <div className="flex flex-wrap items-center gap-3">
             <ModeToggle mode={voteMode} setMode={setVoteMode} />
             <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
             <Button variant="secondary" size="sm" onClick={addFakeFriend} className="gap-2">
                <Users className="w-4 h-4" />
                친구 추가 시뮬레이션
             </Button>
             <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleShare} 
                className={`gap-2 min-w-[110px] transition-all duration-200 ${isCopied ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
             >
                {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {isCopied ? "복사됨!" : "공유하기"}
             </Button>
           </div>
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
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 sm:p-10 text-white shadow-lg">
           <div className="flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 text-indigo-100 font-medium">
                  <Sparkles className="w-5 h-5" />
                  <span>AI 여행 플래너</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold">
                    완벽한 날짜를 찾으셨나요?
                </h3>
                <p className="text-indigo-100 max-w-md">
                    가장 많이 선택된 날짜를 기반으로 Gemini가 맞춤형 여행 일정을 짜드립니다.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 max-w-md mt-4">
                    <div className="relative flex-grow">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-white/50 border-none"
                            placeholder="여행지 입력 (예: 제주도)"
                        />
                    </div>
                    <Button 
                        onClick={handleGenerateItinerary} 
                        isLoading={isGenerating}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 border-none"
                    >
                        일정 생성
                    </Button>
                </div>
             </div>
             
             {/* Itinerary Result */}
             {itinerary && (
                 <div className="flex-1 w-full bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                        {destination} 추천 여행 일정
                    </h4>
                    <div className="prose prose-sm prose-invert max-h-80 overflow-y-auto custom-scrollbar">
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
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