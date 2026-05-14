import { supabase } from '../supabase/client';
import { toLocalISOString, parseLocalDate } from '../utils/dateUtils';

// ============================================================================
// 타입 정의
// ============================================================================

export interface OverviewStats {
  totalAuthUsers: number;       // user_profiles 전체
  totalAnonUsers: number;       // trip_users 중 auth_user_id IS NULL
  totalTrips: number;           // trips 전체
  votedTrips: number;           // date_votes에 1개라도 있는 trip 수 (distinct)
  totalVotes: number;           // date_votes 전체
  totalButtonClicks: number;    // button_clicks 전체
}

export interface PeriodStats {
  newAuthUsers: number;
  newAnonUsers: number;
  newTrips: number;
  newVotes: number;
  newButtonClicks: number;
}

export interface TimeSeriesPoint {
  /** YYYY-MM-DD (KST 기준 bucket 시작일) */
  date: string;
  /** 사람이 읽는 라벨 (예: 11/14, 11월 3주, 2025-11) */
  label: string;
  trips: number;
  users: number;
  votes: number;
}

export interface DestinationCount {
  destination: string;
  count: number;
}

export interface ButtonClickBreakdown {
  eventType: string;
  count: number;
}

export interface RecentTrip {
  id: string;
  title: string | null;
  destination: string;
  share_code: string;
  created_at: string;
}

export interface RecentUser {
  id: string;
  display_name: string;
  created_at: string;
}

export type TimeRange = '7d' | '30d' | '90d';
export type TimeBucket = 'day' | 'week' | 'month';

// ============================================================================
// 관리자 여부 확인
// ============================================================================
export const isAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ isAdmin: Error', error);
    return false;
  }
  return data?.is_admin === true;
};

// ============================================================================
// 전체 누적 KPI
// ============================================================================
const countTable = async (
  table: string,
  filters?: (q: any) => any
): Promise<number> => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filters) query = filters(query);
  const { count, error } = await query;
  if (error) {
    console.error(`❌ countTable(${table}):`, error);
    return 0;
  }
  return count ?? 0;
};

export const getOverviewStats = async (): Promise<OverviewStats> => {
  const [
    totalAuthUsers,
    totalAnonUsers,
    totalTrips,
    totalVotes,
    totalButtonClicks,
    votedTripsData,
  ] = await Promise.all([
    countTable('user_profiles'),
    countTable('trip_users', (q) => q.is('auth_user_id', null)),
    countTable('trips'),
    countTable('date_votes'),
    countTable('button_clicks'),
    supabase.from('date_votes').select('trip_id'),
  ]);

  let votedTrips = 0;
  if (!votedTripsData.error && votedTripsData.data) {
    const ids = new Set<string>();
    votedTripsData.data.forEach((row: any) => {
      if (row.trip_id) ids.add(row.trip_id);
    });
    votedTrips = ids.size;
  }

  return {
    totalAuthUsers,
    totalAnonUsers,
    totalTrips,
    votedTrips,
    totalVotes,
    totalButtonClicks,
  };
};

// ============================================================================
// 주기별 통계 (오늘, 7일, 30일)
// ============================================================================
const getPeriodStartDate = (periodDays: number): Date => {
  const now = new Date();
  if (periodDays === 1) {
    // 오늘 자정 (KST 로컬 자정)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const d = new Date(now);
  d.setDate(d.getDate() - periodDays);
  return d;
};

const isoFromDate = (d: Date): string => {
  // dateUtils.toLocalTimestamp와 동일한 포맷 (타임존 정보 없음)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
};

export const getPeriodStats = async (
  periodDays: 1 | 7 | 30
): Promise<PeriodStats> => {
  const since = isoFromDate(getPeriodStartDate(periodDays));

  const [
    newAuthUsers,
    newAnonUsers,
    newTrips,
    newVotes,
    newButtonClicks,
  ] = await Promise.all([
    countTable('user_profiles', (q) => q.gte('created_at', since)),
    countTable('trip_users', (q) =>
      q.is('auth_user_id', null).gte('created_at', since)
    ),
    countTable('trips', (q) => q.gte('created_at', since)),
    countTable('date_votes', (q) => q.gte('created_at', since)),
    countTable('button_clicks', (q) => q.gte('created_at', since)),
  ]);

  return {
    newAuthUsers,
    newAnonUsers,
    newTrips,
    newVotes,
    newButtonClicks,
  };
};

// ============================================================================
// 시계열 추이 (trips / users / votes)
// ============================================================================

const rangeToDays: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** 로컬(KST) 기준 bucket 시작일 ISO(YYYY-MM-DD) 반환 */
const bucketKey = (created_at: string, bucket: TimeBucket): string => {
  // Supabase의 timestamptz 컬럼이지만 토큰 패턴(toLocalTimestamp)으로 인해
  // KST 시각이 그대로 저장되어 있음. 그러나 표시 시 시스템 타임존을 그대로 사용.
  const d = new Date(created_at);
  if (bucket === 'day') {
    return toLocalISOString(d);
  }
  if (bucket === 'week') {
    // 주의 시작(월요일)으로 정렬
    const day = d.getDay(); // 0(일) ~ 6(토)
    const diff = (day + 6) % 7; // 월요일까지의 차이
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
    return toLocalISOString(monday);
  }
  // month: 매월 1일
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return toLocalISOString(first);
};

const formatBucketLabel = (key: string, bucket: TimeBucket): string => {
  const d = parseLocalDate(key);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (bucket === 'day') {
    return `${month}/${day}`;
  }
  if (bucket === 'week') {
    return `${month}/${day}~`;
  }
  return `${d.getFullYear()}-${String(month).padStart(2, '0')}`;
};

/** [from, to) 사이의 모든 bucket 키를 생성 */
const generateBucketKeys = (
  from: Date,
  to: Date,
  bucket: TimeBucket
): string[] => {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor <= end) {
    keys.push(bucketKey(isoFromDate(cursor), bucket));
    if (bucket === 'day') {
      cursor.setDate(cursor.getDate() + 1);
    } else if (bucket === 'week') {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  // 중복 제거 (week/month에서 발생 가능)
  return Array.from(new Set(keys));
};

export const getTimeSeries = async (
  range: TimeRange,
  bucket: TimeBucket
): Promise<TimeSeriesPoint[]> => {
  const days = rangeToDays[range];
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const since = isoFromDate(from);

  const [tripsRes, usersRes, votesRes] = await Promise.all([
    supabase.from('trips').select('created_at').gte('created_at', since),
    supabase
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', since),
    supabase.from('date_votes').select('created_at').gte('created_at', since),
  ]);

  const tripsRows = (tripsRes.data ?? []) as Array<{ created_at: string }>;
  const usersRows = (usersRes.data ?? []) as Array<{ created_at: string }>;
  const votesRows = (votesRes.data ?? []) as Array<{ created_at: string }>;

  const tripsMap = new Map<string, number>();
  const usersMap = new Map<string, number>();
  const votesMap = new Map<string, number>();

  tripsRows.forEach((r) => {
    const k = bucketKey(r.created_at, bucket);
    tripsMap.set(k, (tripsMap.get(k) ?? 0) + 1);
  });
  usersRows.forEach((r) => {
    const k = bucketKey(r.created_at, bucket);
    usersMap.set(k, (usersMap.get(k) ?? 0) + 1);
  });
  votesRows.forEach((r) => {
    const k = bucketKey(r.created_at, bucket);
    votesMap.set(k, (votesMap.get(k) ?? 0) + 1);
  });

  const allKeys = generateBucketKeys(from, now, bucket).sort();
  return allKeys.map((key) => ({
    date: key,
    label: formatBucketLabel(key, bucket),
    trips: tripsMap.get(key) ?? 0,
    users: usersMap.get(key) ?? 0,
    votes: votesMap.get(key) ?? 0,
  }));
};

// ============================================================================
// 인기 여행지 Top N
// ============================================================================
export const getTopDestinations = async (
  limit = 10
): Promise<DestinationCount[]> => {
  const { data, error } = await supabase
    .from('trips')
    .select('destination');

  if (error) {
    console.error('❌ getTopDestinations:', error);
    return [];
  }

  const map = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const dest = (r.destination ?? '').trim();
    if (!dest) return;
    map.set(dest, (map.get(dest) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// ============================================================================
// 버튼 클릭 이벤트 분포
// ============================================================================
export const getButtonClickBreakdown = async (): Promise<ButtonClickBreakdown[]> => {
  const { data, error } = await supabase
    .from('button_clicks')
    .select('event_type');

  if (error) {
    console.error('❌ getButtonClickBreakdown:', error);
    return [];
  }

  const map = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const t = r.event_type ?? 'unknown';
    map.set(t, (map.get(t) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count);
};

// ============================================================================
// 최근 활동
// ============================================================================
export const getRecentTrips = async (limit = 10): Promise<RecentTrip[]> => {
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, destination, share_code, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ getRecentTrips:', error);
    return [];
  }
  return (data ?? []) as RecentTrip[];
};

export const getRecentUsers = async (limit = 10): Promise<RecentUser[]> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, display_name, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ getRecentUsers:', error);
    return [];
  }
  return (data ?? []) as RecentUser[];
};
