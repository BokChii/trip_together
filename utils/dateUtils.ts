// 로컬 타임존 기준 ISO 날짜 문자열 생성 (YYYY-MM-DD)
// 한국 시간대(UTC+9) 기준으로 날짜를 처리
export const toLocalISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ISO 날짜 문자열을 로컬 타임존 기준 Date 객체로 변환
// new Date("2024-01-15")는 UTC로 해석되므로, 로컬 타임존 기준으로 파싱
export const parseLocalDate = (isoString: string): Date => {
  const [year, month, day] = isoString.split('-').map(Number);
  // new Date(year, month - 1, day)는 로컬 타임존 기준으로 생성됨
  return new Date(year, month - 1, day);
};

// 두 날짜 비교 (로컬 타임존 기준)
export const compareLocalDates = (date1: string, date2: string): number => {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return d1.getTime() - d2.getTime();
};

