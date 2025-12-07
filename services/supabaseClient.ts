import { createClient } from '@supabase/supabase-js';

// Vite에서는 import.meta.env를 사용합니다.
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// 환경 변수가 누락되었을 때 앱이 멈추지 않도록 처리
const clientUrl = supabaseUrl || 'https://placeholder.supabase.co';
const clientKey = supabaseAnonKey || 'placeholder';

export const supabase = createClient(clientUrl, clientKey);

// 설정이 올바른지 확인하는 플래그
export const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co';