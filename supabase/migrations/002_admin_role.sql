-- 002_admin_role.sql
-- 관리자 대시보드용 마이그레이션
-- 1) user_profiles.is_admin 컬럼 추가
-- 2) 관리자용 RLS 정책 추가 (is_admin = true인 사용자는 모든 데이터를 SELECT 가능)
-- 
-- 적용 방법:
--   Supabase Studio → SQL Editor 에서 이 파일 전체를 실행하세요.
--   적용 후, 본인 계정을 관리자로 승격하려면 아래 SQL을 한 번 실행:
--
--     UPDATE public.user_profiles
--     SET is_admin = true
--     WHERE id = (SELECT id FROM auth.users WHERE email = 'kdshin@freshmilk.kr');
--
--   (이메일은 본인 계정에 맞춰 변경)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_profiles.is_admin 컬럼 추가
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
  ON public.user_profiles(is_admin)
  WHERE is_admin = true;

-- ----------------------------------------------------------------------------
-- 2. 관리자 여부 판별 헬퍼 함수
--    RLS USING 절에서 user_profiles를 직접 참조하면 재귀가 발생하므로,
--    SECURITY DEFINER 함수로 안전하게 우회합니다.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. 각 테이블 RLS 활성화 + 관리자 SELECT 정책 추가
--    (기존 정책은 그대로 유지하고, 관리자용 SELECT 정책만 추가)
-- ----------------------------------------------------------------------------

-- trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all trips" ON public.trips;
CREATE POLICY "Admins can read all trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- trip_users
ALTER TABLE public.trip_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all trip_users" ON public.trip_users;
CREATE POLICY "Admins can read all trip_users"
  ON public.trip_users FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- date_votes
ALTER TABLE public.date_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all date_votes" ON public.date_votes;
CREATE POLICY "Admins can read all date_votes"
  ON public.date_votes FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- button_clicks
ALTER TABLE public.button_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all button_clicks" ON public.button_clicks;
CREATE POLICY "Admins can read all button_clicks"
  ON public.button_clicks FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- user_profiles (관리자는 모든 프로필 조회)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all user_profiles" ON public.user_profiles;
CREATE POLICY "Admins can read all user_profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. is_admin 컬럼은 절대 클라이언트에서 수정할 수 없도록 보호
--    (UPDATE 정책에 명시적으로 차단)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users cannot change is_admin" ON public.user_profiles;
CREATE POLICY "Users cannot change is_admin"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 적용 후 본인 계정 승격 예시 (필요한 부분 주석 해제 후 실행)
-- ----------------------------------------------------------------------------
-- UPDATE public.user_profiles
-- SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'kdshin@freshmilk.kr');
