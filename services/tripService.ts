import { supabase } from '../supabase/client';
import { User, DateVote } from '../types';
import { toLocalTimestamp } from '../utils/dateUtils';

export interface Trip {
  id: string;
  destination: string;
  share_code: string;
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  title?: string | null;
  creator_id?: string | null;
}

// 짧은 공유 코드 생성 (6자리 대문자+숫자)
const generateShareCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0, O, I, 1 제외
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Trip 생성
export const createTrip = async (
  destination: string = '제주도',
  startDate?: string | null,
  endDate?: string | null,
  title?: string | null,
  creatorId?: string | null
): Promise<Trip> => {
  // console.log('💾 createTrip: Creating new trip', { destination, startDate, endDate, title, creatorId });
  let shareCode = generateShareCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert({ 
          destination, 
          share_code: shareCode,
          start_date: startDate || null,
          end_date: endDate || null,
          title: title || '제주도 여행',
          creator_id: creatorId || null,
          created_at: toLocalTimestamp() // 한국 시간대(KST) 기준으로 명시적 설정
        })
        .select()
        .single();

      if (error) {
        // share_code 중복인 경우 재시도
        if (error.code === '23505') { // unique_violation
          // console.log('⚠️ createTrip: Share code conflict, retrying...', { shareCode, attempt: attempts + 1 });
          shareCode = generateShareCode();
          attempts++;
          continue;
        }
        // console.error('❌ createTrip: DB error', error);
        throw error;
      }
      // console.log('✅ createTrip: Trip created in DB', { tripId: data.id, shareCode: data.share_code });
      return data;
    } catch (error: any) {
      if (error.code === '23505' && attempts < maxAttempts - 1) {
        shareCode = generateShareCode();
        attempts++;
        continue;
      }
      // console.error('❌ createTrip: Failed', error);
      throw error;
    }
  }
  
  // console.error('❌ createTrip: Failed to generate unique share code after', maxAttempts, 'attempts');
  throw new Error('Failed to generate unique share code');
};

// Share Code로 Trip 조회
export const getTripByShareCode = async (shareCode: string): Promise<Trip | null> => {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('share_code', shareCode.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
};

// Trip의 모든 사용자 조회
export const getTripUsers = async (tripId: string): Promise<User[]> => {
  // console.log('📥 getTripUsers: Fetching from DB', { tripId });
  
  const { data, error } = await supabase
    .from('trip_users')
    .select('user_id, name')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    // console.error('❌ getTripUsers: DB error', error);
    throw error;
  }
  
  const users = data.map(u => ({ id: u.user_id, name: u.name }));
  // console.log('✅ getTripUsers: Fetched from DB', { count: users.length, users: users.map(u => u.name) });
  return users;
};

// 사용자 추가
export const addTripUser = async (tripId: string, user: User, authUserId?: string | null): Promise<void> => {
  // console.log('💾 addTripUser: Saving to DB', { tripId, userId: user.id, userName: user.name, authUserId });
  
  const { data, error } = await supabase
    .from('trip_users')
    .upsert({
      trip_id: tripId,
      user_id: user.id,
      name: user.name,
      auth_user_id: authUserId || null,
      created_at: toLocalTimestamp() // 한국 시간대(KST) 기준으로 명시적 설정
    }, {
      onConflict: 'trip_id,user_id'
    })
    .select();

  if (error) {
    // console.error('❌ addTripUser: DB error', error);
    throw error;
  }
  
  // console.log('✅ addTripUser: Saved to DB', { data });
};

// 투표 조회
export const getDateVotes = async (tripId: string): Promise<DateVote[]> => {
  const { data, error } = await supabase
    .from('date_votes')
    .select('date, user_id, vote_type')
    .eq('trip_id', tripId);

  if (error) throw error;
  return data.map(v => ({
    date: v.date,
    userId: v.user_id,
    type: v.vote_type as 'available' | 'unavailable'
  }));
};

// 투표 추가/업데이트
export const upsertDateVote = async (
  tripId: string,
  date: string,
  userId: string,
  voteType: 'available' | 'unavailable'
): Promise<void> => {
  const { error } = await supabase
    .from('date_votes')
    .upsert({
      trip_id: tripId,
      date,
      user_id: userId,
      vote_type: voteType,
      created_at: toLocalTimestamp() // 한국 시간대(KST) 기준으로 명시적 설정
    }, {
      onConflict: 'trip_id,date,user_id'
    });

  if (error) {
    // console.error('❌ upsertDateVote: DB error', error);
    throw error;
  }
};

// 여러 투표 일괄 추가/업데이트
export const upsertDateVotesBatch = async (
  tripId: string,
  votes: Array<{ date: string; userId: string; voteType: 'available' | 'unavailable' }>
): Promise<void> => {
  if (votes.length === 0) return;

  const { error } = await supabase
    .from('date_votes')
    .upsert(
      votes.map(v => ({
        trip_id: tripId,
        date: v.date,
        user_id: v.userId,
        vote_type: v.voteType,
        created_at: toLocalTimestamp() // 한국 시간대(KST) 기준으로 명시적 설정
      })),
      {
        onConflict: 'trip_id,date,user_id'
      }
    );

  if (error) {
    // console.error('❌ upsertDateVotesBatch: DB error', error);
    throw error;
  }
};

// 여러 투표 일괄 삭제
export const deleteDateVotes = async (
  tripId: string,
  dates: string[],
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('date_votes')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .in('date', dates);

  if (error) {
    // console.error('❌ deleteDateVotes: DB error', error);
    throw error;
  }
};

// Trip destination 업데이트
export const updateTripDestination = async (
  tripId: string,
  destination: string
): Promise<void> => {
  // updated_at은 로컬 타임존(한국 시간대) 기준으로 저장
  // 한국 시간대(KST, UTC+9) 기준으로 타임스탬프 생성
  const { error } = await supabase
    .from('trips')
    .update({ 
      destination, 
      updated_at: toLocalTimestamp() // 올바른 로컬 타임스탬프 사용
    })
    .eq('id', tripId);

  if (error) throw error;
};

// 실시간 구독: Trip 변경 감지
export const subscribeToTrip = (
  tripId: string,
  callback: (trip: Trip) => void
) => {
  return supabase
    .channel(`trip:${tripId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'trips',
      filter: `id=eq.${tripId}`
    }, (payload) => {
      callback(payload.new as Trip);
    })
    .subscribe();
};

// 실시간 구독: 사용자 변경 감지
export const subscribeToTripUsers = (
  tripId: string,
  callback: (users: User[]) => void
) => {
  const channel = supabase
    .channel(`trip_users:${tripId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'trip_users',
      filter: `trip_id=eq.${tripId}`
    }, async (payload) => {
      // console.log('📡 subscribeToTripUsers: Change detected', { event: payload.eventType });
      try {
        const users = await getTripUsers(tripId);
        callback(users);
      } catch (error) {
        // console.error('❌ subscribeToTripUsers: Error fetching trip users:', error);
      }
    })
    .subscribe();
  
  return channel;
};

// 실시간 구독: 투표 변경 감지
export const subscribeToDateVotes = (
  tripId: string,
  callback: (votes: DateVote[]) => void,
  currentUserId?: string // 현재 사용자 ID (자신의 변경사항 필터링용)
) => {
  const channel = supabase
    .channel(`date_votes:${tripId}`)
    .on('postgres_changes', {
      event: '*', // INSERT, UPDATE, DELETE 모두 감지
      schema: 'public',
      table: 'date_votes',
      filter: `trip_id=eq.${tripId}`
    }, async (payload) => {
      // 자신이 변경한 이벤트는 무시 (Optimistic Update로 이미 반영됨)
      if (currentUserId) {
        const changedUserId = payload.new?.user_id || payload.old?.user_id;
        if (changedUserId === currentUserId) {
          // console.log('📡 subscribeToDateVotes: Ignoring own change');
          return;
        }
      }

      // console.log('📡 subscribeToDateVotes: Change detected', { 
      //   event: payload.eventType,
      //   userId: payload.new?.user_id || payload.old?.user_id,
      //   currentUserId
      // });
      
      try {
        // DB 업데이트 완료 대기 (삭제 이벤트가 즉시 반영되도록)
        await new Promise(resolve => setTimeout(resolve, 200));
        const votes = await getDateVotes(tripId);
        callback(votes);
      } catch (error) {
        console.error('❌ subscribeToDateVotes: Error fetching date votes:', error);
      }
    })
    .subscribe();
  
  return channel;
};

// trips 테이블의 총 row 수 가져오기 (서비스 통계용)
export const getTripsCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('trips')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Error getting trips count:', error);
    return 0;
  }

  return count || 0;
};

// 사용자가 생성한 여행 목록 조회
export const getUserCreatedTrips = async (userId: string): Promise<Trip[]> => {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ getUserCreatedTrips: Error', error);
    throw error;
  }

  return data || [];
};

// 사용자가 참여한 여행 목록 조회 (trip_users 테이블 기준)
// 로그인 사용자는 auth_user_id로, 익명 사용자는 user_id로 조회
export const getUserParticipatedTrips = async (userId: string): Promise<Trip[]> => {
  // auth_user_id로 먼저 조회 시도 (로그인 사용자)
  const { data: authData, error: authError } = await supabase
    .from('trip_users')
    .select(`
      trip_id,
      trips (
        id,
        destination,
        share_code,
        created_at,
        start_date,
        end_date,
        title,
        creator_id
      )
    `)
    .eq('auth_user_id', userId);

  if (authError && authError.code !== 'PGRST116') {
    console.error('❌ getUserParticipatedTrips: Error', authError);
    throw authError;
  }

  // 중첩된 trips 데이터 추출
  const authTrips = (authData || [])
    .map((item: any) => item.trips)
    .filter((trip: Trip | null): trip is Trip => trip !== null);

  // 중복 제거 (creator_id와 auth_user_id가 같은 경우)
  const uniqueTrips = authTrips.filter((trip, index, self) =>
    index === self.findIndex(t => t.id === trip.id)
  );

  return uniqueTrips;
};

// Trip 삭제 (생성자만 가능)
export const deleteTrip = async (tripId: string, userId: string): Promise<void> => {
  // 먼저 생성자인지 확인
  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select('creator_id')
    .eq('id', tripId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (trip.creator_id !== userId) {
    throw new Error('Only the creator can delete this trip');
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    console.error('❌ deleteTrip: Error', error);
    throw error;
  }
};

// 버튼 클릭 이벤트 타입
export type ButtonClickEvent = 'share' | 'copy_dates' | 'generate_itinerary';

// 버튼 클릭 추적 (비동기, 실패해도 서비스 동작에는 영향 없음)
export const trackButtonClick = async (
  eventType: ButtonClickEvent,
  tripId?: string,
  userId?: string
): Promise<void> => {
  try {
    await supabase
      .from('button_clicks')
      .insert({
        event_type: eventType,
        trip_id: tripId || null,
        user_id: userId || null,
        created_at: toLocalTimestamp()
      });
  } catch (error) {
    // 클릭 추적 실패해도 서비스 동작에는 영향 없음
    // console.error('Failed to track button click:', error);
  }
};

