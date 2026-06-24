// 한국 공휴일 데이터 (2025년 12월부터)
export interface KoreanHoliday {
  date: string; // YYYY-MM-DD 형식
  name: string;
  isSubstitute?: boolean; // 대체공휴일 여부
}

export const koreanHolidays: KoreanHoliday[] = [
  // 2025년
  { date: '2025-12-25', name: '성탄절' },
  
  // 2026년
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날' },
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-03-02', name: '삼일절 대체공휴일', isSubstitute: true },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-24', name: '석가탄신일' },
  { date: '2026-05-25', name: '대체공휴일', isSubstitute: true },
  { date: '2026-06-03', name: '임시공휴일(전국동시지방선거)' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-08-17', name: '대체공휴일', isSubstitute: true },
  { date: '2026-09-24', name: '추석' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-05', name: '대체공휴일', isSubstitute: true },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '성탄절' },

  // 2027년
  { date: '2027-01-01', name: '신정' },
  { date: '2027-02-06', name: '설날' },
  { date: '2027-02-07', name: '설날' },
  { date: '2027-02-08', name: '설날' },
  { date: '2027-03-01', name: '삼일절' },
  { date: '2027-05-05', name: '어린이날' },
  { date: '2027-05-13', name: '석가탄신일' },
  { date: '2027-06-06', name: '현충일' },
  { date: '2027-06-07', name: '현충일 대체공휴일', isSubstitute: true },
  { date: '2027-08-15', name: '광복절' },
  { date: '2027-08-16', name: '광복절 대체공휴일', isSubstitute: true },
  { date: '2027-09-14', name: '추석' },
  { date: '2027-09-15', name: '추석' },
  { date: '2027-09-16', name: '추석' },
  { date: '2027-10-03', name: '개천절' },
  { date: '2027-10-04', name: '개천절 대체공휴일', isSubstitute: true },
  { date: '2027-10-09', name: '한글날' },
  { date: '2027-10-11', name: '한글날 대체공휴일', isSubstitute: true },
  { date: '2027-12-25', name: '성탄절' },
  { date: '2027-12-27', name: '성탄절 대체공휴일', isSubstitute: true },
];

// 특정 날짜가 공휴일인지 확인
export const isKoreanHoliday = (isoDate: string): KoreanHoliday | null => {
  return koreanHolidays.find(h => h.date === isoDate) || null;
};

import { parseLocalDate } from './dateUtils';

// 특정 날짜가 일요일인지 확인
export const isSunday = (isoDate: string): boolean => {
  return parseLocalDate(isoDate).getDay() === 0;
};

// 특정 날짜가 토요일인지 확인
export const isSaturday = (isoDate: string): boolean => {
  return parseLocalDate(isoDate).getDay() === 6;
};

