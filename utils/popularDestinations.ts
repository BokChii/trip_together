export interface Destination {
  name: string;      // "제주도"
  code: string;      // "CJU" (공항 코드)
  country: string;   // "KR"
}

export const POPULAR_DESTINATIONS: Destination[] = [
  { name: "제주도", code: "CJU", country: "KR" },
  { name: "부산", code: "PUS", country: "KR" },
  { name: "도쿄", code: "NRT", country: "JP" },
  { name: "오사카", code: "KIX", country: "JP" },
  { name: "방콕", code: "BKK", country: "TH" },
  { name: "싱가포르", code: "SIN", country: "SG" },
  { name: "홍콩", code: "HKG", country: "HK" },
  { name: "다낭", code: "DAD", country: "VN" },
  { name: "세부", code: "CEB", country: "PH" },
  { name: "타이페이", code: "TPE", country: "TW" },
  { name: "마닐라", code: "MNL", country: "PH" },
  { name: "하노이", code: "HAN", country: "VN" },
  { name: "발리", code: "DPS", country: "ID" },
  { name: "쿠알라룸푸르", code: "KUL", country: "MY" },
  { name: "상하이", code: "PVG", country: "CN" },
];

// 도시명 또는 공항 코드로 목적지 찾기
export const findDestination = (input: string): Destination | null => {
  const normalizedInput = input.trim().toUpperCase();
  
  // 공항 코드로 검색
  const byCode = POPULAR_DESTINATIONS.find(
    d => d.code.toUpperCase() === normalizedInput
  );
  if (byCode) return byCode;
  
  // 도시명으로 검색 (부분 일치)
  const byName = POPULAR_DESTINATIONS.find(
    d => d.name.includes(input.trim()) || input.trim().includes(d.name)
  );
  if (byName) return byName;
  
  return null;
};

// 공항 코드로 목적지 찾기
export const findDestinationByCode = (code: string): Destination | null => {
  return POPULAR_DESTINATIONS.find(d => d.code.toUpperCase() === code.toUpperCase()) || null;
};
