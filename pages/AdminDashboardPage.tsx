import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Plane,
  Users,
  Calendar as CalendarIcon,
  Vote,
  MousePointerClick,
  TrendingUp,
  UserPlus,
  MapPin,
  LogOut,
  ShieldCheck,
  Activity,
  Inbox,
} from 'lucide-react';
import { getCurrentUser, signOut, getUserProfile } from '../services/authService';
import {
  isAdmin,
  getOverviewStats,
  getPeriodStats,
  getTimeSeries,
  getTopDestinations,
  getButtonClickBreakdown,
  getRecentTrips,
  getRecentUsers,
  OverviewStats,
  PeriodStats,
  TimeSeriesPoint,
  DestinationCount,
  ButtonClickBreakdown,
  RecentTrip,
  RecentUser,
  TimeRange,
  TimeBucket,
} from '../services/adminService';

type PeriodKey = 1 | 7 | 30;

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 1, label: '오늘' },
  { key: 7, label: '7일' },
  { key: 30, label: '30일' },
];

const RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
  { key: '90d', label: '90일' },
];

const BUCKET_OPTIONS: { key: TimeBucket; label: string }[] = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
];

const EVENT_LABEL_KO: Record<string, string> = {
  share: '공유하기',
  copy_dates: '날짜 복사',
  generate_itinerary: 'AI 일정 생성',
  flight_search: '항공권 검색',
  flight_booking_click: '항공권 예약 클릭',
};

const PIE_COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fef3c7', '#fbbf24'];

const formatNumber = (n: number) => n.toLocaleString('ko-KR');

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta?: number;
  deltaLabel?: string;
  accent?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  icon,
  label,
  value,
  delta,
  deltaLabel,
  accent = 'text-orange-600 bg-orange-50',
}) => (
  <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-orange-100/50">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <p className="text-xs sm:text-sm font-medium text-gray-600">{label}</p>
    </div>
    <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
      {formatNumber(value)}
    </p>
    {delta !== undefined && (
      <p className="mt-2 text-xs text-gray-500">
        <span className="text-orange-600 font-semibold">+{formatNumber(delta)}</span>
        {deltaLabel ? ` ${deltaLabel}` : ''}
      </p>
    )}
  </div>
);

interface SegmentToggleProps<T extends string | number> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}

function SegmentToggle<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentToggleProps<T>) {
  const padding = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div className="inline-flex items-center bg-orange-50 border border-orange-100 rounded-lg p-1 gap-1">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={String(opt.key)}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`${padding} rounded-md font-medium transition-all ${
              active
                ? 'bg-white text-orange-700 shadow-sm'
                : 'text-gray-600 hover:text-orange-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <Inbox className="w-10 h-10 mb-2" />
    <p className="text-sm">{message}</p>
  </div>
);

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>('관리자');

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [period, setPeriod] = useState<PeriodKey>(7);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);

  const [range, setRange] = useState<TimeRange>('30d');
  const [bucket, setBucket] = useState<TimeBucket>('day');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);

  const [topDestinations, setTopDestinations] = useState<DestinationCount[]>([]);
  const [clickBreakdown, setClickBreakdown] = useState<ButtonClickBreakdown[]>([]);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // 인증 + 권한 가드
  useEffect(() => {
    const guard = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }
        const adminCheck = await isAdmin(user.id);
        if (!adminCheck) {
          alert('관리자 권한이 없습니다.');
          navigate('/', { replace: true });
          return;
        }
        setAuthUser(user);
        const profile = await getUserProfile(user.id);
        setDisplayName(
          profile?.display_name ||
            user.user_metadata?.full_name ||
            user.email ||
            '관리자'
        );
      } catch (error) {
        console.error('❌ AdminDashboardPage: auth guard error', error);
        alert('인증 중 오류가 발생했습니다.');
        navigate('/login', { replace: true });
      } finally {
        setIsCheckingAuth(false);
      }
    };
    guard();
  }, [navigate]);

  // 메인 데이터 로드 (overview + 분포 + 최근활동)
  useEffect(() => {
    if (!authUser) return;
    const load = async () => {
      setIsLoadingMain(true);
      try {
        const [ov, dests, clicks, rTrips, rUsers] = await Promise.all([
          getOverviewStats(),
          getTopDestinations(10),
          getButtonClickBreakdown(),
          getRecentTrips(10),
          getRecentUsers(10),
        ]);
        setOverview(ov);
        setTopDestinations(dests);
        setClickBreakdown(clicks);
        setRecentTrips(rTrips);
        setRecentUsers(rUsers);
      } catch (error) {
        console.error('❌ AdminDashboardPage: load main error', error);
      } finally {
        setIsLoadingMain(false);
      }
    };
    load();
  }, [authUser]);

  // 주기 통계 로드
  useEffect(() => {
    if (!authUser) return;
    const load = async () => {
      setIsLoadingPeriod(true);
      try {
        const stats = await getPeriodStats(period);
        setPeriodStats(stats);
      } catch (error) {
        console.error('❌ AdminDashboardPage: load period error', error);
      } finally {
        setIsLoadingPeriod(false);
      }
    };
    load();
  }, [authUser, period]);

  // 시계열 로드
  useEffect(() => {
    if (!authUser) return;
    const load = async () => {
      setIsLoadingChart(true);
      try {
        const ts = await getTimeSeries(range, bucket);
        setTimeSeries(ts);
      } catch (error) {
        console.error('❌ AdminDashboardPage: load timeseries error', error);
      } finally {
        setIsLoadingChart(false);
      }
    };
    load();
  }, [authUser, range, bucket]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('❌ AdminDashboardPage: logout error', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const periodLabelText = useMemo(() => {
    const o = PERIOD_OPTIONS.find((p) => p.key === period);
    return o ? `최근 ${o.label}` : '';
  }, [period]);

  const pieData = useMemo(
    () =>
      clickBreakdown.map((c) => ({
        name: EVENT_LABEL_KO[c.eventType] || c.eventType,
        value: c.count,
      })),
    [clickBreakdown]
  );

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12 sm:h-16 items-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="bg-orange-600 p-1 sm:p-1.5 rounded-lg">
                <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" />
              </div>
              <span className="font-bold text-xl sm:text-2xl text-gray-900 tracking-tight">
                언제갈래
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline-block text-sm text-gray-600 bg-orange-50/50 px-3 py-1 rounded-lg">
                반가워요, <strong className="text-orange-700">{displayName}</strong>님
              </span>
              <button
                onClick={() => navigate('/my-trips')}
                className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors"
              >
                내 여행
              </button>
              <button
                onClick={handleLogout}
                className="min-h-[44px] px-2 sm:px-3 text-xs font-medium text-gray-500 hover:text-orange-600 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header + Period toggle */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Activity className="w-7 h-7 text-orange-600" />
              관리자 대시보드
            </h1>
            <p className="text-sm text-gray-600">
              서비스 전체 현황과 추이를 한 눈에 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">증감 기준</span>
            <SegmentToggle
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
              size="sm"
            />
          </div>
        </div>

        {/* KPI Cards */}
        {isLoadingMain || !overview ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-5 shadow-sm border border-orange-100/50 h-32 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <KPICard
              icon={<Users className="w-5 h-5" />}
              label="총 가입자"
              value={overview.totalAuthUsers}
              delta={isLoadingPeriod ? undefined : periodStats?.newAuthUsers}
              deltaLabel={periodLabelText}
            />
            <KPICard
              icon={<UserPlus className="w-5 h-5" />}
              label="익명 참여자"
              value={overview.totalAnonUsers}
              delta={isLoadingPeriod ? undefined : periodStats?.newAnonUsers}
              deltaLabel={periodLabelText}
              accent="text-amber-700 bg-amber-50"
            />
            <KPICard
              icon={<CalendarIcon className="w-5 h-5" />}
              label="생성된 여행 일정"
              value={overview.totalTrips}
              delta={isLoadingPeriod ? undefined : periodStats?.newTrips}
              deltaLabel={periodLabelText}
              accent="text-rose-700 bg-rose-50"
            />
            <KPICard
              icon={<TrendingUp className="w-5 h-5" />}
              label="투표된 여행 일정"
              value={overview.votedTrips}
              accent="text-emerald-700 bg-emerald-50"
            />
            <KPICard
              icon={<Vote className="w-5 h-5" />}
              label="총 투표 수"
              value={overview.totalVotes}
              delta={isLoadingPeriod ? undefined : periodStats?.newVotes}
              deltaLabel={periodLabelText}
              accent="text-sky-700 bg-sky-50"
            />
            <KPICard
              icon={<MousePointerClick className="w-5 h-5" />}
              label="총 버튼 클릭"
              value={overview.totalButtonClicks}
              delta={
                isLoadingPeriod ? undefined : periodStats?.newButtonClicks
              }
              deltaLabel={periodLabelText}
              accent="text-violet-700 bg-violet-50"
            />
          </div>
        )}

        {/* Time series chart */}
        <section className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-orange-100/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                시계열 추이
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                여행 일정, 신규 가입자, 투표 수의 시간별 변화
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentToggle
                options={RANGE_OPTIONS}
                value={range}
                onChange={setRange}
                size="sm"
              />
              <SegmentToggle
                options={BUCKET_OPTIONS}
                value={bucket}
                onChange={setBucket}
                size="sm"
              />
            </div>
          </div>
          <div className="h-72 sm:h-80">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : timeSeries.length === 0 ? (
              <EmptyState message="해당 기간의 데이터가 없습니다" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeSeries}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #fed7aa',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      const map: Record<string, string> = {
                        trips: '여행 일정',
                        users: '신규 가입자',
                        votes: '투표',
                      };
                      return [formatNumber(value), map[name] || name];
                    }}
                    labelStyle={{ color: '#1f2937' }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const map: Record<string, string> = {
                        trips: '여행 일정',
                        users: '신규 가입자',
                        votes: '투표',
                      };
                      return map[value] || value;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="trips"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Top destinations + Button click breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-orange-100/50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-orange-600" />
              인기 여행지 Top 10
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              생성된 여행 일정의 목적지 기준
            </p>
            <div className="h-72">
              {isLoadingMain ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : topDestinations.length === 0 ? (
                <EmptyState message="아직 데이터가 없습니다" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topDestinations}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="destination"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #fed7aa',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [formatNumber(value), '여행 수']}
                    />
                    <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-orange-100/50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-1">
              <MousePointerClick className="w-5 h-5 text-orange-600" />
              버튼 클릭 이벤트 분포
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              주요 액션별 사용 빈도
            </p>
            <div className="h-72">
              {isLoadingMain ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : pieData.length === 0 ? (
                <EmptyState message="아직 데이터가 없습니다" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry: any) =>
                        `${entry.name} ${entry.value}`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #fed7aa',
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        formatNumber(value),
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Recent activity */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-orange-100/50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-orange-600" />
              최근 가입한 사용자
            </h2>
            {isLoadingMain ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : recentUsers.length === 0 ? (
              <EmptyState message="아직 가입자가 없습니다" />
            ) : (
              <ul className="divide-y divide-orange-100/60">
                {recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {u.display_name || '이름 없음'}
                        </p>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {u.id}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(u.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-orange-100/50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <CalendarIcon className="w-5 h-5 text-orange-600" />
              최근 생성된 여행 일정
            </h2>
            {isLoadingMain ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : recentTrips.length === 0 ? (
              <EmptyState message="아직 여행 일정이 없습니다" />
            ) : (
              <ul className="divide-y divide-orange-100/60">
                {recentTrips.map((t) => (
                  <li
                    key={t.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                        <Plane className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.title || '이름없는 여행 일정'}
                        </p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {t.destination}
                          <span className="text-gray-300">·</span>
                          <span className="font-mono">{t.share_code}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(t.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
