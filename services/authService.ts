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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('❌ getCurrentUser: Error getting user', error);
    return null;
  }
  return user;
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
export const signInWithKakao = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
  
  if (error) {
    console.error('❌ signInWithKakao: Error', error);
    throw error;
  }
  
  return data;
};

// 구글 로그인
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
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
export const upsertUserProfile = async (userId: string, displayName: string, avatarUrl?: string | null): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      display_name: displayName,
      avatar_url: avatarUrl || null,
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
export const handleAuthCallback = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('❌ handleAuthCallback: Error getting session', error);
    return null;
  }
  
  if (!session?.user) {
    return null;
  }
  
  // 프로필이 없으면 생성
  const existingProfile = await getUserProfile(session.user.id);
  if (!existingProfile) {
    // OAuth 제공자에서 이름 가져오기
    const displayName = session.user.user_metadata?.full_name 
      || session.user.user_metadata?.name 
      || session.user.user_metadata?.nickname
      || session.user.email?.split('@')[0] 
      || '사용자';
    
    const avatarUrl = session.user.user_metadata?.avatar_url 
      || session.user.user_metadata?.picture
      || null;
    
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

