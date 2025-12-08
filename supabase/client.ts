import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables';
  // console.error('❌', errorMsg);
  // console.error('Please check your .env.local file in the project root');
  // console.error('Make sure the file contains:');
  // console.error('VITE_SUPABASE_URL=your_url');
  // console.error('VITE_SUPABASE_ANON_KEY=your_key');
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

