import { supabase } from '../supabase/client';
import { POPULAR_DESTINATIONS, findDestination } from '../utils/popularDestinations';

export interface AirportOption {
  code: string;   // IATA (ICN, CJU)
  name: string;   // "Incheon International" or "인천국제공항"
  city?: string;
  country?: string;
}

// 검색 결과 캐시
const searchCache = new Map<string, { data: AirportOption[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * Supabase airports 테이블에서 검색 (한글/영문 모두 지원)
 */
export const searchAirports = async (keyword: string): Promise<AirportOption[]> => {
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const pattern = `%${trimmed}%`;

  const { data, error } = await supabase
    .from('airports')
    .select('iata_code, name_en, city_en, country_code, name_ko, city_ko')
    .or(`iata_code.ilike.${pattern},name_en.ilike.${pattern},city_en.ilike.${pattern},name_ko.ilike.${pattern},city_ko.ilike.${pattern}`)
    .limit(10);

  if (error) {
    console.warn('⚠️ Airport search failed, using fallback:', error);
    return searchAirportsFallback(trimmed);
  }

  const options: AirportOption[] = (data || []).map((row: any) => ({
    code: row.iata_code,
    name: row.name_ko || row.name_en,
    city: row.city_ko || row.city_en,
    country: row.country_code,
  }));

  searchCache.set(cacheKey, { data: options, ts: Date.now() });
  return options;
};

/**
 * DB 검색 실패 시 인기 목적지 로컬 폴백
 */
function searchAirportsFallback(keyword: string): AirportOption[] {
  const normalized = keyword.trim().toUpperCase();

  const byCode = POPULAR_DESTINATIONS.filter(
    (d) => d.code.toUpperCase() === normalized
  ).map((d) => ({ code: d.code, name: d.name, country: d.country }));

  if (byCode.length) return byCode;

  const byName = POPULAR_DESTINATIONS.filter(
    (d) =>
      d.name.includes(keyword.trim()) ||
      d.code.toUpperCase().includes(normalized)
  ).map((d) => ({ code: d.code, name: d.name, country: d.country }));

  return byName;
}

/**
 * 입력값을 AirportOption으로 변환
 */
export const resolveToAirport = (input: string): AirportOption | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dest = findDestination(trimmed);
  if (dest) {
    return { code: dest.code, name: dest.name, country: dest.country };
  }

  if (/^[A-Z]{3}$/i.test(trimmed)) {
    return { code: trimmed.toUpperCase(), name: trimmed.toUpperCase(), country: '' };
  }

  return null;
};
