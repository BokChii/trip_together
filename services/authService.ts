import { supabase } from '../supabase/client';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

// 현재 로그인한 사용자 정보 가져오기
export const getCurrentUser = async () => {
  // 먼저 세션 확인
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // 세션이 없으면 null 반환 (오류 발생하지 않음)
    return null;
  }
  
  // 세션이 있으면 세션의 사용자 정보 반환
  return session.user;
};

// 세션 확인
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('❌ getSession: Error getting session', error);
    return null;
  }
  return session;
};

// 카카오톡 로그인
// 주의: 현재는 profile_nickname만 요청합니다.
// 나중에 이메일이나 프로필 이미지가 필요하면:
// 1. 카카오 개발자 콘솔에서 동의항목 활성화 (account_email, profile_image)
// 2. 아래 queryParams의 scope에 추가: 'profile_nickname,account_email,profile_image'
// 3. handleAuthCallback 함수의 주석 처리된 이메일/프로필 이미지 코드 주석 해제
export const signInWithKakao = async (redirectTo?: string | null) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      queryParams: {
        // 카카오 로그인에서 닉네임만 요청 (이메일, 프로필 이미지 제외)
        // 나중에 이메일/프로필 이미지가 필요하면 scope에 추가:
        // scope: 'profile_nickname,account_email,profile_image'
        scope: 'profile_nickname'
      }
    }
  });
  
  if (error) {
    console.error('❌ signInWithKakao: Error', error);
    throw error;
  }
  
  return data;
};

// 구글 로그인
export const signInWithGoogle = async (redirectTo?: string | null) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) {
    console.error('❌ signInWithGoogle: Error', error);
    throw error;
  }
  
  return data;
};

// 로그아웃
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('❌ signOut: Error', error);
    throw error;
  }
};

// 사용자 프로필 가져오기
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // 프로필이 없는 경우
      return null;
    }
    console.error('❌ getUserProfile: Error', error);
    return null;
  }
  
  return data;
};

// 사용자 프로필 생성 또는 업데이트
// TODO: 나중에 프로필 이미지 기능 추가 시 avatarUrl 파라미터와 관련 코드 주석 해제
export const upsertUserProfile = async (userId: string, displayName: string, avatarUrl?: string | null): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      display_name: displayName,
      // TODO: 나중에 프로필 이미지 기능 추가 시 주석 해제
      // avatar_url: avatarUrl || null,
      avatar_url: null, // 현재는 프로필 이미지 미사용
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ upsertUserProfile: Error', error);
    throw error;
  }
  
  return data;
};

// OAuth 콜백 처리 (인증 후 자동으로 프로필 생성)
// 주의: 이 함수는 다른 곳에서도 사용될 수 있으므로, code 파라미터가 있으면 처리하고 없으면 기존 세션을 확인합니다.
export const handleAuthCallback = async () => {
  // URL에서 code 파라미터 확인
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  let session = null;

  // code가 있으면 세션 교환 (OAuth 콜백 처리)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('❌ handleAuthCallback: Error exchanging code for session', error);
      return null;
    }
    session = data?.session;
  } else {
    // code가 없으면 기존 세션 확인 (이미 로그인된 경우)
    const { data: { session: existingSession }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ handleAuthCallback: Error getting session', error);
      return null;
    }
    session = existingSession;
  }
  
  if (!session?.user) {
    return null;
  }
  
  // 프로필이 없으면 생성
  const existingProfile = await getUserProfile(session.user.id);
  if (!existingProfile) {
    // OAuth 제공자에서 이름 가져오기
    // TODO: 나중에 이메일 기능 추가 시 주석 해제하고 카카오 로그인 scope에 account_email 추가
    // const displayName = session.user.user_metadata?.full_name 
    //   || session.user.user_metadata?.name 
    //   || session.user.user_metadata?.nickname
    //   || session.user.email?.split('@')[0] 
    //   || '사용자';
    const displayName = session.user.user_metadata?.full_name 
      || session.user.user_metadata?.name 
      || session.user.user_metadata?.nickname
      || '사용자';
    
    // TODO: 나중에 프로필 이미지 기능 추가 시 주석 해제하고 카카오 로그인 scope에 profile_image 추가
    // const avatarUrl = session.user.user_metadata?.avatar_url 
    //   || session.user.user_metadata?.picture
    //   || null;
    const avatarUrl = null; // 현재는 프로필 이미지 미사용
    
    try {
      await upsertUserProfile(session.user.id, displayName, avatarUrl);
    } catch (error) {
      console.error('❌ handleAuthCallback: Error creating profile', error);
    }
  }
  
  return session;
};

// 인증 상태 변경 구독
export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
};

