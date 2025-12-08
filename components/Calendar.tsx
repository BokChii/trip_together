import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, User as UserIcon, Crown, Heart } from 'lucide-react';
import { CalendarDay, DateVote, User, VoteType } from '../types';

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  votes: DateVote[];
  users: User[];
  currentUserId: string;
  voteMode: VoteType;
  onVote: (dateIso: string | string[], shouldRemove?: boolean) => void;
  startDate?: string | null;
  endDate?: string | null;
  selectedUserId?: string | null;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  setCurrentDate,
  votes,
  users,
  currentUserId,
  voteMode,
  onVote,
  startDate,
  endDate,
  selectedUserId,
}) => {
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  // 'add' = selecting, 'remove' = deselecting
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  
  // Touch/Mobile drag detection
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number; date: string } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const DRAG_THRESHOLD = 10; // 10px 이상 움직여야 드래그로 인식

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: CalendarDay[] = [];
    
    const startPadding = firstDay.getDay(); 
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        isoString: d.toISOString().split('T')[0]
      });
    }

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

  // 월이 기간 범위 내에 있는지 확인 (해당 월에 기간 내 날짜가 하나라도 있으면 true)
  const isMonthInRange = (year: number, month: number): boolean => {
    if (!startDate && !endDate) return true; // 기간 제한이 없으면 모두 허용
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // 해당 월의 첫날과 마지막날
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    if (start && end) {
      // 기간과 월이 겹치는지 확인
      return monthStart <= end && monthEnd >= start;
    } else if (start) {
      return monthEnd >= start;
    } else if (end) {
      return monthStart <= end;
    }
    return true;
  };

  // 이전/다음 월 이동 가능 여부 확인
  const canGoToPreviousMonth = (): boolean => {
    if (!startDate && !endDate) return true;
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    return isMonthInRange(prevMonth.getFullYear(), prevMonth.getMonth());
  };

  const canGoToNextMonth = (): boolean => {
    if (!startDate && !endDate) return true;
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return isMonthInRange(nextMonth.getFullYear(), nextMonth.getMonth());
  };

  const getDayStats = (isoDate: string) => {
    // selectedUserId가 있으면 해당 유저의 투표만 필터링, 없으면 전체 참여자
    let dateVotes = votes.filter(v => v.date === isoDate);
    
    if (selectedUserId) {
      dateVotes = dateVotes.filter(v => v.userId === selectedUserId);
    }
    
    const availableCount = dateVotes.filter(v => v.type === 'available').length;
    const unavailableCount = dateVotes.filter(v => v.type === 'unavailable').length;
    
    const myVote = dateVotes.find(v => v.userId === currentUserId)?.type;

    return { availableCount, unavailableCount, myVote, dateVotes };
  };

  const getRange = (start: string, end: string): string[] => {
      const s = new Date(start);
      const e = new Date(end);
      const range: string[] = [];
      
      const startDate = s < e ? s : e;
      const endDate = s < e ? e : s;

      const current = new Date(startDate);
      while (current <= endDate) {
          range.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
      }
      return range;
  };

  const handlePointerDown = (isoDate: string, clientX?: number, clientY?: number) => {
      // Determine intent based on the starting cell's current state
      const { myVote } = getDayStats(isoDate);
      
      // If I already voted for this date with the CURRENT vote mode, my intent is to remove it.
      // Otherwise (no vote, or different vote type), my intent is to add/overwrite.
      const intent = (myVote === voteMode) ? 'remove' : 'add';

      // 모바일 터치인 경우 위치 저장
      if (clientX !== undefined && clientY !== undefined) {
        setTouchStartPos({ x: clientX, y: clientY, date: isoDate });
        setHasMoved(false);
      } else {
        // 데스크톱 마우스인 경우 즉시 드래그 시작
        setIsDragging(true);
        setDragStart(isoDate);
        setDragEnd(isoDate);
        setDragMode(intent);
      }
  };

  const handlePointerEnter = (isoDate: string) => {
      if (isDragging) {
          setDragEnd(isoDate);
      }
  };

  // 모바일 터치 이동 처리
  const handleTouchMove = (e: React.TouchEvent, isoDate: string) => {
    if (!touchStartPos) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 수직 스크롤이 주 목적이면 드래그 취소 (스크롤 허용)
    if (deltaY > deltaX && deltaY > DRAG_THRESHOLD) {
      setTouchStartPos(null);
      setHasMoved(false);
      return;
    }
    
    // 드래그 시작 (임계값 이상 움직임)
    if (distance > DRAG_THRESHOLD && !isDragging) {
      setHasMoved(true);
      const { myVote } = getDayStats(touchStartPos.date);
      const intent = (myVote === voteMode) ? 'remove' : 'add';
      
      setIsDragging(true);
      setDragStart(touchStartPos.date);
      setDragEnd(touchStartPos.date);
      setDragMode(intent);
    }
    
    // 드래그 중이면 계속 업데이트
    if (isDragging) {
      setDragEnd(isoDate);
    }
  };

  // 모바일 터치 종료 처리
  const handleTouchEnd = () => {
    if (touchStartPos && !hasMoved && !isDragging) {
      // 짧은 탭: 단일 날짜 선택/해제
      const { myVote } = getDayStats(touchStartPos.date);
      const shouldRemove = myVote === voteMode;
      onVote(touchStartPos.date, shouldRemove);
    }
    
    setTouchStartPos(null);
    setHasMoved(false);
  };

  const handlePointerUp = () => {
      if (isDragging && dragStart && dragEnd && dragMode) {
          const range = getRange(dragStart, dragEnd);
          onVote(range, dragMode === 'remove');
      }
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragMode(null);
  };

  useEffect(() => {
    const handleGlobalUp = () => {
      if (isDragging) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, [isDragging, dragStart, dragEnd, dragMode]);

  const isDateInRange = (isoDate: string): boolean => {
    if (!startDate && !endDate) return true; // 기간 제한이 없으면 모두 허용
    
    const date = new Date(isoDate);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && end) {
      return date >= start && date <= end;
    } else if (start) {
      return date >= start;
    } else if (end) {
      return date <= end;
    }
    return true;
  };

  const getCellStyles = (isoDate: string, isCurrentMonth: boolean) => {
    // 기간 제한 체크
    const isInRange = isDateInRange(isoDate);
    if (!isInRange) {
      // 기간 제한 밖이면 다른 달이든 현재 달이든 비활성화
      return "bg-gray-50/50 text-gray-300 cursor-not-allowed opacity-50";
    }

    const { availableCount, unavailableCount, myVote } = getDayStats(isoDate);
    // selectedUserId가 있으면 해당 유저만, 없으면 전체 참여자 수
    const totalUsers = selectedUserId ? 1 : users.length;
    const isPerfectMatch = totalUsers > 0 && availableCount === totalUsers;
    
    // 다른 달 날짜인 경우 투명도 적용 (시각적 구분)
    const opacityClass = isCurrentMonth ? "" : "opacity-70";
    
    let isInDragRange = false;
    if (isDragging && dragStart && dragEnd) {
        const s = new Date(dragStart);
        const e = new Date(dragEnd);
        const c = new Date(isoDate);
        if ((c >= s && c <= e) || (c >= e && c <= s)) {
            isInDragRange = true;
        }
    }

    let classes = "cursor-pointer transition-all duration-200 relative select-none ";
    
    // 다른 달 날짜는 기본적으로 회색 배경 (투표가 없을 때)
    if (!isCurrentMonth && availableCount === 0 && unavailableCount === 0) {
      classes += "bg-gray-50/50 text-gray-400 " + opacityClass + " ";
    } else {
      // Drag Preview Styles
      if (isInDragRange) {
          if (dragMode === 'remove') {
              // "Eraser" visual feedback
              return classes + "bg-gray-50 opacity-60 ring-1 ring-inset ring-gray-300 rounded-lg scale-[0.95] grayscale z-10 " + opacityClass;
          } else {
              // "Adding" visual feedback
              if (voteMode === 'available') return classes + "bg-orange-100 ring-2 ring-inset ring-orange-400 rounded-lg scale-[0.95] z-10 " + opacityClass;
              if (voteMode === 'unavailable') return classes + "bg-gray-200 ring-2 ring-inset ring-gray-400 rounded-lg scale-[0.95] z-10 " + opacityClass;
          }
      }

      // My Vote Highlight (Border)
      if (myVote === 'available') {
        classes += "ring-2 ring-inset ring-orange-400 rounded-lg z-[2] ";
      } else if (myVote === 'unavailable') {
        classes += "ring-2 ring-inset ring-gray-300 rounded-lg z-[2] ";
      }

      // Heatmap Logic (Orange Theme)
      // selectedUserId가 있으면 해당 유저만 필터링된 결과를 표시
      if (isPerfectMatch) {
        // 모두 가능: 진한 오렌지/레드오렌지
        classes += "bg-gradient-to-br from-orange-400 to-red-400 text-white shadow-md scale-[1.03] z-[5] rounded-xl " + opacityClass + " ";
      } else if (totalUsers > 0 && availableCount > 0) {
        // selectedUserId가 있으면 intensity는 항상 1.0 (해당 유저가 선택한 날짜)
        const intensity = selectedUserId ? 1.0 : availableCount / totalUsers;
        if (intensity >= 0.75) classes += "bg-orange-300 text-white hover:bg-orange-400 rounded-lg " + opacityClass + " ";
        else if (intensity >= 0.5) classes += "bg-orange-200 text-orange-900 hover:bg-orange-300 rounded-lg " + opacityClass + " ";
        else if (intensity >= 0.25) classes += "bg-orange-100 text-orange-800 hover:bg-orange-200 rounded-lg " + opacityClass + " ";
        else classes += "bg-orange-50 text-orange-800 hover:bg-orange-100 rounded-lg " + opacityClass + " ";
      } else if (availableCount === 0 && unavailableCount > 0) {
         classes += "bg-gray-100 text-gray-400 hover:bg-gray-200 rounded-lg " + opacityClass + " ";
      } else {
        classes += (isCurrentMonth ? "bg-white hover:bg-orange-50" : "bg-gray-50/50") + " text-gray-700 rounded-lg " + opacityClass + " ";
      }
    }
    
    return classes;
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="w-full max-w-5xl mx-auto bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100/50 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 border-b border-orange-100">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => changeMonth(-1)} 
            disabled={!canGoToPreviousMonth()}
            className={`min-w-[44px] min-h-[44px] p-2 rounded-full transition-colors flex items-center justify-center ${
              canGoToPreviousMonth()
                ? 'hover:bg-orange-50 text-orange-400 cursor-pointer active:bg-orange-100'
                : 'text-gray-300 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
          </button>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-wide text-center flex-1">
            {currentDate.toLocaleString('ko-KR', { month: 'long', year: 'numeric' })}
          </h2>
          <button 
            onClick={() => changeMonth(1)} 
            disabled={!canGoToNextMonth()}
            className={`min-w-[44px] min-h-[44px] p-2 rounded-full transition-colors flex items-center justify-center ${
              canGoToNextMonth()
                ? 'hover:bg-orange-50 text-orange-400 cursor-pointer active:bg-orange-100'
                : 'text-gray-300 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] bg-orange-50 rounded-full text-xs sm:text-sm text-orange-600 font-medium">
          <UserIcon className="w-4 h-4" />
          <span>{users.length}명 참여중</span>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-orange-50 bg-white">
        {weekDays.map((day, i) => (
          <div key={day} className={`py-3 sm:py-4 text-center text-xs sm:text-sm font-bold ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 auto-rows-fr p-2 gap-1 sm:gap-2 bg-orange-50/30" style={{ touchAction: 'pan-y' }}>
        {daysInMonth.map((day, idx) => {
          const { availableCount, dateVotes } = getDayStats(day.isoString);
          const totalUsers = users.length;
          const isPerfectMatch = totalUsers > 0 && availableCount === totalUsers;
          const isInRange = isDateInRange(day.isoString);
          // 기간 제한만 체크, 다른 달 날짜도 클릭 가능
          const isDisabled = !isInRange;

          return (
            <div
              key={day.isoString + idx}
              onPointerDown={(e) => !isDisabled && handlePointerDown(day.isoString, e.clientX, e.clientY)}
              onPointerEnter={() => !isDisabled && handlePointerEnter(day.isoString)}
              onTouchStart={(e) => {
                if (!isDisabled && e.touches.length === 1) {
                  const touch = e.touches[0];
                  handlePointerDown(day.isoString, touch.clientX, touch.clientY);
                }
              }}
              onTouchMove={(e) => {
                if (!isDisabled && e.touches.length === 1) {
                  handleTouchMove(e, day.isoString);
                }
              }}
              onTouchEnd={handleTouchEnd}
              className={`
                min-h-[70px] sm:min-h-[100px] md:min-h-[120px] p-2 flex flex-col items-start justify-start shadow-sm
                ${getCellStyles(day.isoString, day.isCurrentMonth)}
              `}
            >
              <div className="w-full flex justify-between items-start mb-1 pointer-events-none">
                <span className={`text-sm font-bold ${day.isToday ? 'bg-orange-400 text-white shadow-sm w-7 h-7 flex items-center justify-center rounded-full' : ''} ${!day.isCurrentMonth ? 'text-gray-400' : ''}`}>
                  {day.date.getDate()}
                </span>
                {isPerfectMatch && day.isCurrentMonth && (
                  <Crown className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-bounce" />
                )}
              </div>

              {/* User Names List - 다른 달 날짜에도 투표가 있으면 표시 */}
              {dateVotes.length > 0 && (
                <div className={`w-full flex flex-col gap-1 overflow-y-auto max-h-[70px] custom-scrollbar pointer-events-none mt-1 ${!day.isCurrentMonth ? 'opacity-70' : ''}`}>
                  {dateVotes.map((vote) => {
                    const user = users.find(u => u.id === vote.userId);
                    if (!user) return null;
                    const isAvailable = vote.type === 'available';
                    
                    // 다른 달 날짜는 Perfect Match 체크에서 제외 (현재 달만)
                    const isDayPerfectMatch = day.isCurrentMonth && isPerfectMatch;
                    
                    // Contrast Logic Improved
                    // Perfect Match: White text with shadow
                    // Others: Dark text (Gray-900 or Gray-500) for readability
                    const textColor = isDayPerfectMatch 
                        ? 'text-white drop-shadow-md' 
                        : (isAvailable ? (day.isCurrentMonth ? 'text-gray-900' : 'text-gray-700') : 'text-gray-500');

                    const iconColor = isAvailable 
                        ? (isDayPerfectMatch ? 'text-yellow-200 drop-shadow-sm' : (day.isCurrentMonth ? 'text-orange-500' : 'text-orange-400'))
                        : 'text-gray-400';

                    return (
                      <div key={vote.userId + vote.date} className={`text-[11px] flex items-center gap-1.5 leading-tight ${textColor}`}>
                         {isAvailable ? (
                             <Heart className={`w-2.5 h-2.5 ${iconColor} fill-current`} />
                         ) : (
                             <span className={`${iconColor} font-bold text-[10px]`}>-</span>
                         )}
                         <span className="truncate max-w-[50px] sm:max-w-[70px] font-bold">{user.name}</span>
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
      <div className="p-5 bg-white flex flex-wrap gap-6 text-xs text-gray-500 justify-center border-t border-orange-100 font-medium">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white border-2 border-orange-100 rounded-lg"></div>
          <span>선택안함</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-100 rounded-lg"></div>
          <span>가능</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-300 rounded-lg"></div>
          <span>인기</span>
        </div>
        <div className="flex items-center gap-2 font-bold text-orange-600">
            <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-red-400 rounded-lg flex items-center justify-center shadow-sm">
                <Crown className="w-3 h-3 text-white" />
            </div>
            <span>모두 가능!</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
          </div>
          <span>불가능</span>
        </div>
      </div>
    </div>
  );
};