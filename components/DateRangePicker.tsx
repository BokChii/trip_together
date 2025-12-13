import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { toLocalISOString, parseLocalDate } from '../utils/dateUtils';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateClick: (isoDate: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // startDate가 선택되면 해당 월로 이동
  useEffect(() => {
    if (startDate) {
      const start = parseLocalDate(startDate);
      const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      // 현재 월과 다를 때만 업데이트 (무한 루프 방지)
      if (currentDate.getFullYear() !== startMonth.getFullYear() || 
          currentDate.getMonth() !== startMonth.getMonth()) {
        setCurrentDate(startMonth);
      }
    }
  }, [startDate]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; isoString: string }> = [];
    
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        isoString: toLocalISOString(d)
      });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const isToday = new Date().toDateString() === d.toDateString();
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday,
        isoString: toLocalISOString(d)
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        isoString: toLocalISOString(d)
      });
    }

    return days;
  }, [currentDate]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const isDateInRange = (isoDate: string): boolean => {
    if (!startDate || !endDate) return false;
    // 로컬 타임존 기준으로 날짜 비교 (한국 시간대)
    const date = parseLocalDate(isoDate);
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    return date >= start && date <= end;
  };

  const isStartDate = (isoDate: string): boolean => {
    return startDate === isoDate;
  };

  const isEndDate = (isoDate: string): boolean => {
    return endDate === isoDate;
  };

  const getCellStyles = (isoDate: string, isCurrentMonth: boolean) => {
    // 로컬 타임존 기준으로 날짜 비교 (한국 시간대)
    const date = parseLocalDate(isoDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = date < today;
    
    let classes = "relative flex items-center justify-center min-h-[40px] sm:min-h-[48px] rounded-lg transition-all cursor-pointer ";
    
    // 과거 날짜는 비활성화
    if (isPast) {
      classes += "opacity-40 cursor-not-allowed ";
    }
    
    // 현재 달이 아닌 날짜
    if (!isCurrentMonth) {
      classes += "opacity-50 ";
    }
    
    // 시작일 또는 종료일
    if (isStartDate(isoDate) || isEndDate(isoDate)) {
      classes += "bg-orange-500 text-white font-bold z-10 scale-110 shadow-lg ";
      if (isStartDate(isoDate) && !isEndDate(isoDate)) {
        classes += "rounded-l-full rounded-r-lg ";
      } else if (isEndDate(isoDate) && !isStartDate(isoDate)) {
        classes += "rounded-r-full rounded-l-lg ";
      } else {
        // 시작일과 종료일이 같은 경우
        classes += "rounded-full ";
      }
    }
    // 범위 내 날짜 (시작일과 종료일 사이)
    else if (isDateInRange(isoDate)) {
      classes += "bg-orange-100 text-orange-900 ";
    }
    // 기본 스타일
    else {
      classes += isCurrentMonth ? "hover:bg-orange-50 text-gray-700 " : "text-gray-400 ";
    }
    
    // 오늘 날짜 강조
    if (date.toDateString() === today.toDateString() && isCurrentMonth) {
      classes += "ring-2 ring-orange-300 ";
    }
    
    return classes;
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="w-full bg-white rounded-xl border border-orange-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-orange-100 bg-orange-50/50">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-orange-600" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-orange-500" />
          <span className="text-lg font-semibold text-gray-800">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </span>
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-orange-600" />
        </button>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-orange-50 bg-white">
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-bold ${
              i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 p-2 gap-1 bg-orange-50/30">
        {daysInMonth.map((day, idx) => {
          const date = new Date(day.isoString);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = date < today;

          return (
            <div
              key={day.isoString + idx}
              onClick={() => {
                if (!isPast) {
                  onDateClick(day.isoString);
                }
              }}
              className={getCellStyles(day.isoString, day.isCurrentMonth)}
            >
              <span
                className={`text-sm ${
                  isStartDate(day.isoString) || isEndDate(day.isoString)
                    ? 'text-white'
                    : day.isCurrentMonth
                    ? 'text-gray-700'
                    : 'text-gray-400'
                }`}
              >
                {day.date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* 안내 메시지 */}
      <div className="p-3 bg-orange-50/50 border-t border-orange-100">
        <p className="text-xs text-center text-gray-600">
          {!startDate && !endDate && '📅 시작일을 선택해주세요'}
          {startDate && !endDate && '📅 종료일을 선택해주세요'}
          {startDate && endDate && '✅ 날짜 범위가 선택되었습니다'}
        </p>
      </div>
    </div>
  );
};

