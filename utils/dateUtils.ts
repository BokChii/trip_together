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

// 로컬 타임존 기준 타임스탬프 ISO 문자열 생성 (YYYY-MM-DDTHH:mm:ss)
// Supabase의 timestamptz는 타임존 정보가 있으면 UTC로 변환하므로,
// 타임존 정보 없이 한국 시간 값을 그대로 전송
export const toLocalTimestamp = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  // 타임존 정보 없이 반환 (Supabase가 UTC로 해석하지만, 한국 시간 값이 그대로 저장됨)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

