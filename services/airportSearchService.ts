import { getAmadeusAccessToken } from './amadeusAuth';
import { POPULAR_DESTINATIONS, findDestination } from '../utils/popularDestinations';

export interface AirportOption {
  code: string;   // IATA (ICN, CJU)
  name: string;   // "Incheon International"
  city?: string;
  country?: string;
}

// 검색 결과 캐시 (동일 키워드 재검색 방지)
const searchCache = new Map<string, { data: AirportOption[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * Amadeus Airport & City Search API
 * keyword: 2자 이상 (영문 권장, 한글은 API 미지원 가능)
 */
export const searchAirports = async (keyword: string): Promise<AirportOption[]> => {
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toUpperCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const token = await getAmadeusAccessToken();
    const url = new URL('https://api.amadeus.com/v1/reference-data/locations');
    url.searchParams.append('keyword', trimmed);
    url.searchParams.append('subType', 'AIRPORT,CITY');
    url.searchParams.append('page[limit]', '10');
    url.searchParams.append('view', 'LIGHT');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Airport search failed: ${res.status}`);
    }

    const json = await res.json();
    const items = json.data || [];

    const options: AirportOption[] = items
      .filter((loc: any) => loc.iataCode)
      .map((loc: any) => ({
        code: loc.iataCode,
        name: loc.name || loc.detailedName || loc.iataCode,
        city: loc.address?.cityName,
        country: loc.address?.countryName,
      }));

    // 중복 제거 (동일 IATA 코드)
    const seen = new Set<string>();
    const unique = options.filter((o) => {
      if (seen.has(o.code)) return false;
      seen.add(o.code);
      return true;
    });

    searchCache.set(cacheKey, { data: unique, ts: Date.now() });
    return unique;
  } catch (err) {
    console.warn('⚠️ Amadeus airport search failed, using fallback:', err);
    return searchAirportsFallback(trimmed);
  }
};

/**
 * Amadeus API 실패 시 인기 목적지 + 로컬 매칭
 */
function searchAirportsFallback(keyword: string): AirportOption[] {
  const normalized = keyword.trim().toUpperCase();

  // 공항 코드 정확 일치
  const byCode = POPULAR_DESTINATIONS.filter(
    (d) => d.code.toUpperCase() === normalized
  ).map((d) => ({ code: d.code, name: d.name, country: d.country }));

  if (byCode.length) return byCode;

  // 도시명/이름 부분 일치
  const byName = POPULAR_DESTINATIONS.filter(
    (d) =>
      d.name.includes(keyword.trim()) ||
      d.code.toUpperCase().includes(normalized)
  ).map((d) => ({ code: d.code, name: d.name, country: d.country }));

  return byName;
}

/**
 * 입력값을 AirportOption으로 변환 (공항 코드/도시명 → 유효 옵션)
 */
export const resolveToAirport = (input: string): AirportOption | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dest = findDestination(trimmed);
  if (dest) {
    return { code: dest.code, name: dest.name, country: dest.country };
  }

  // 3자리 대문자면 공항 코드로 간주
  if (/^[A-Z]{3}$/i.test(trimmed)) {
    return { code: trimmed.toUpperCase(), name: trimmed.toUpperCase(), country: '' };
  }

  return null;
};
