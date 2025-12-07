import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, User as UserIcon, Crown } from 'lucide-react';
import { CalendarDay, DateVote, User, VoteType } from '../types';

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  votes: DateVote[];
  users: User[];
  currentUserId: string;
  voteMode: VoteType;
  onVote: (dateIso: string) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  setCurrentDate,
  votes,
  users,
  currentUserId,
  voteMode,
  onVote,
}) => {
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: CalendarDay[] = [];
    
    // Padding for previous month
    const startPadding = firstDay.getDay(); // 0 is Sunday
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        isoString: d.toISOString().split('T')[0]
      });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const isToday = new Date().toDateString() === d.toDateString();
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday,
        isoString: d.toISOString().split('T')[0]
      });
    }

    // Padding for next month to complete the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        isoString: d.toISOString().split('T')[0]
      });
    }

    return days;
  }, [currentDate]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const getDayStats = (isoDate: string) => {
    const dateVotes = votes.filter(v => v.date === isoDate);
    const availableCount = dateVotes.filter(v => v.type === 'available').length;
    const unavailableCount = dateVotes.filter(v => v.type === 'unavailable').length;
    
    const myVote = dateVotes.find(v => v.userId === currentUserId)?.type;

    return { availableCount, unavailableCount, myVote, dateVotes };
  };

  const getCellStyles = (isoDate: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "bg-gray-50 text-gray-300 cursor-default";

    const { availableCount, unavailableCount, myVote } = getDayStats(isoDate);
    const totalUsers = users.length;
    const isPerfectMatch = totalUsers > 0 && availableCount === totalUsers;
    
    // Base styles
    let classes = "cursor-pointer transition-all duration-200 relative ";
    
    // My Vote Highlight (Border)
    if (myVote === 'available') {
      classes += "ring-2 ring-inset ring-green-500 ";
    } else if (myVote === 'unavailable') {
      classes += "ring-2 ring-inset ring-rose-500 ";
    }

    // Heatmap Logic
    if (isPerfectMatch) {
      // 모두가 가능한 날: 특별 강조 (남색 배경 + 황금 테두리 효과 느낌)
      classes += "bg-indigo-600 text-white shadow-lg ring-4 ring-yellow-400/70 z-10 scale-[1.02] ";
    } else if (totalUsers > 0 && availableCount > 0) {
      const intensity = availableCount / totalUsers;
      
      // 일반적인 히트맵 (초록색)
      if (intensity >= 0.75) classes += "bg-green-500 text-white hover:bg-green-600 ";
      else if (intensity >= 0.5) classes += "bg-green-400 text-white hover:bg-green-500 ";
      else if (intensity >= 0.25) classes += "bg-green-200 text-green-900 hover:bg-green-300 ";
      else classes += "bg-green-50 text-green-900 hover:bg-green-100 ";
    } else if (availableCount === 0 && unavailableCount > 0) {
       // 불가능만 있는 경우
       classes += "bg-rose-50 text-gray-900 hover:bg-rose-100 ";
    } else {
      // 아무도 선택 안함
      classes += "bg-white hover:bg-gray-50 text-gray-900 ";
    }
    
    return classes;
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {currentDate.toLocaleString('ko-KR', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <UserIcon className="w-4 h-4" />
          <span>{users.length}명 참여 중</span>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {weekDays.map((day, i) => (
          <div key={day} className={`py-3 text-center text-xs font-semibold uppercase tracking-wider ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {daysInMonth.map((day, idx) => {
          const { availableCount, dateVotes } = getDayStats(day.isoString);
          const totalUsers = users.length;
          const isPerfectMatch = day.isCurrentMonth && totalUsers > 0 && availableCount === totalUsers;

          return (
            <div
              key={day.isoString + idx}
              onClick={() => day.isCurrentMonth && onVote(day.isoString)}
              className={`
                min-h-[110px] sm:min-h-[130px] p-2 flex flex-col items-start justify-start border-b border-r border-gray-50
                ${getCellStyles(day.isoString, day.isCurrentMonth)}
              `}
            >
              <div className="w-full flex justify-between items-start mb-1">
                <span className={`text-sm font-medium ${day.isToday ? 'bg-white text-indigo-600 shadow-sm w-6 h-6 flex items-center justify-center rounded-full' : ''}`}>
                  {day.date.getDate()}
                </span>
                {isPerfectMatch && (
                  <Crown className="w-4 h-4 text-yellow-300 fill-yellow-300 animate-pulse" />
                )}
              </div>

              {/* User Names List */}
              {day.isCurrentMonth && (
                <div className="w-full flex flex-col gap-0.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                  {dateVotes.map((vote) => {
                    const user = users.find(u => u.id === vote.userId);
                    if (!user) return null;
                    const isAvailable = vote.type === 'available';
                    
                    // 텍스트 색상: 셀 배경이 어두울 때(PerfectMatch, High Heat)는 흰색/밝은색, 아닐 땐 어두운색
                    // PerfectMatch(Indigo) or High Heat(Green-500/600) -> Text White
                    // Low Heat(Green-100/200) -> Text Gray-900
                    const isDarkBackground = isPerfectMatch || (totalUsers > 0 && (availableCount / totalUsers) >= 0.5);
                    const textColor = isDarkBackground ? 'text-white/90' : 'text-gray-700';
                    const iconColor = isAvailable 
                        ? (isDarkBackground ? 'text-green-300' : 'text-green-600')
                        : (isDarkBackground ? 'text-rose-300' : 'text-rose-500');

                    return (
                      <div key={vote.userId + vote.date} className={`text-[10px] flex items-center gap-1 leading-tight ${textColor}`}>
                         <span className={`${iconColor} font-bold text-[10px]`}>
                           {isAvailable ? '●' : '×'}
                         </span>
                         <span className="truncate max-w-[50px] sm:max-w-[70px]">{user.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="p-4 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-600 justify-center border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
          <span>입력 없음</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 rounded"></div>
          <span>일부 가능</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>대부분 가능</span>
        </div>
        <div className="flex items-center gap-2 font-semibold text-indigo-700">
            <div className="w-4 h-4 bg-indigo-600 ring-2 ring-yellow-400 rounded flex items-center justify-center">
                <Crown className="w-2.5 h-2.5 text-white" />
            </div>
            <span>모두 가능! (추천)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-rose-50 border border-rose-200 rounded relative">
            <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
          </div>
          <span>불가능 있음</span>
        </div>
      </div>
    </div>
  );
};