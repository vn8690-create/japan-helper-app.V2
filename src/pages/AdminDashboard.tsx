import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  UserCheck,
  ScanLine,
  Crown,
  User,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Loader2,
  Calendar,
  FileText,
  Clock,
  Activity,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import {
  supabase,
  Profile,
  Subscription,
  AdminAnalytics,
  GrowthDataPoint,
  DocumentTypeAnalytics,
  CategoryAnalytics,
  RecentRegistration,
  RecentScan,
} from '../lib/supabase';

interface UserWithSubscription extends Profile {
  subscriptions: Subscription[];
}

// Colors for charts
const CHART_COLORS = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0891b2', '#6366f1', '#a855f7'];
const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  tax: '#dc2626',
  insurance: '#ea580c',
  pension: '#d97706',
  cityHall: '#059669',
  other: '#6b7280',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: profileLoading } = useProfile();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'activity' | 'users'>('overview');
  const [chartRange, setChartRange] = useState<7 | 30>(7);

  // Analytics data
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [docTypeData, setDocTypeData] = useState<DocumentTypeAnalytics[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryAnalytics[]>([]);
  const [recentRegs, setRecentRegs] = useState<RecentRegistration[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, profileLoading, navigate]);

  const fetchAnalytics = useCallback(async () => {
    if (!isAdmin) return;

    // Main analytics
    const { data: analyticsData } = await supabase.rpc('get_admin_analytics');
    if (analyticsData) setAnalytics(analyticsData);

    // Growth data
    const { data: growthDataResult } = await supabase.rpc('get_growth_data', { days_back: chartRange });
    if (growthDataResult) setGrowthData(growthDataResult);

    // Document types
    const { data: docTypes } = await supabase.rpc('get_document_type_analytics');
    if (docTypes) setDocTypeData(docTypes);

    // Category analytics
    const { data: categories } = await supabase.rpc('get_category_analytics');
    if (categories) setCategoryData(categories);

    // Recent registrations
    const { data: regs } = await supabase.rpc('get_recent_registrations', { limit_count: 10 });
    if (regs) setRecentRegs(regs);

    // Recent scans
    const { data: scans } = await supabase.rpc('get_recent_scans_feed', { limit_count: 20 });
    if (scans) setRecentScans(scans);
  }, [isAdmin, chartRange]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData) {
      const { data: subsData } = await supabase.from('subscriptions').select('*');

      const usersWithSubs = profilesData.map((profile) => ({
        ...profile,
        subscriptions: subsData?.filter((s) => s.user_id === profile.user_id) ?? [],
      }));

      setUsers(usersWithSubs);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
      fetchUsers();
    }
  }, [isAdmin, fetchAnalytics, fetchUsers]);

  // Re-fetch growth data when range changes
  useEffect(() => {
    if (isAdmin) {
      supabase.rpc('get_growth_data', { days_back: chartRange }).then(({ data }) => {
        if (data) setGrowthData(data);
      });
    }
  }, [chartRange, isAdmin]);

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
    fetchUsers();
  };

  const toggleUserPlan = async (userId: string, subscriptionId: string, currentPlan: string) => {
    const newPlan = currentPlan === 'premium' ? 'free' : 'premium';
    await supabase
      .from('subscriptions')
      .update({
        plan: newPlan,
        status: 'active',
        expires_at: newPlan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .eq('id', subscriptionId);
    fetchUsers();
  };

  // Calculate growth percentages
  const dauGrowth = analytics?.dau_yesterday
    ? ((analytics.dau - analytics.dau_yesterday) / analytics.dau_yesterday) * 100
    : 0;
  const wauGrowth = analytics?.wau_last_week
    ? ((analytics.wau - analytics.wau_last_week) / analytics.wau_last_week) * 100
    : 0;
  const mauGrowth = analytics?.mau_last_month
    ? ((analytics.mau - analytics.mau_last_month) / analytics.mau_last_month) * 100
    : 0;

  if (profileLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Format date for charts
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Metric card component
  const MetricCard = ({
    label,
    value,
    icon: Icon,
    trend,
    trendLabel,
    color = 'red',
  }: {
    label: string;
    value: number | string;
    icon: typeof Users;
    trend?: number;
    trendLabel?: string;
    color?: string;
  }) => (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            color === 'red'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
              : color === 'green'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
              : color === 'blue'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
              : color === 'yellow'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
          }`}
        >
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</p>
      {trendLabel && <p className="text-xs text-neutral-400 mt-1">{trendLabel}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-purple-600" />
              <h1 className="font-semibold text-lg text-neutral-900 dark:text-white">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'analytics', label: 'Analytics' },
            { key: 'activity', label: 'Activity' },
            { key: 'users', label: 'Users' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-red-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard label="Total Users" value={analytics?.total_users ?? 0} icon={Users} color="blue" />
              <MetricCard
                label="Active Today (DAU)"
                value={analytics?.dau ?? 0}
                icon={UserCheck}
                trend={dauGrowth}
                trendLabel="vs yesterday"
                color="green"
              />
              <MetricCard label="Total Scans" value={analytics?.total_scans ?? 0} icon={ScanLine} color="red" />
              <MetricCard
                label="Scans Today"
                value={analytics?.scans_today ?? 0}
                icon={Activity}
                color="orange"
              />
              <MetricCard
                label="Weekly Active"
                value={analytics?.wau ?? 0}
                icon={Calendar}
                trend={wauGrowth}
                trendLabel="vs last week"
                color="blue"
              />
              <MetricCard
                label="Monthly Active"
                value={analytics?.mau ?? 0}
                icon={Users}
                trend={mauGrowth}
                trendLabel="vs last month"
                color="green"
              />
              <MetricCard label="Premium Users" value={analytics?.premium_users ?? 0} icon={Crown} color="yellow" />
              <MetricCard label="Free Users" value={analytics?.free_users ?? 0} icon={User} color="neutral" />
            </div>

            {/* Avg Scans Per User */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white">Average Scans Per User</h3>
                <span className="text-sm text-neutral-500">Last 30 days</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-red-600">{analytics?.avg_scans_per_user ?? 0}</div>
                <div className="text-sm text-neutral-500">
                  scans/user<br />
                  among {analytics?.mau ?? 0} active users
                </div>
              </div>
            </div>

            {/* Quick Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Document Types Pie */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Document Types</h3>
                {docTypeData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={docTypeData}
                          dataKey="count"
                          nameKey="document_type"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                        >
                          {docTypeData.map((entry, index) => (
                            <Cell
                              key={entry.document_type}
                              fill={DOCUMENT_TYPE_COLORS[entry.document_type] || CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {docTypeData.slice(0, 5).map((item) => (
                        <div key={item.document_type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: DOCUMENT_TYPE_COLORS[item.document_type] || '#6b7280' }}
                            />
                            <span className="text-sm text-neutral-600 dark:text-neutral-400 capitalize">
                              {item.document_type}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-8">No data yet</p>
                )}
              </div>

              {/* Category Stats */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Action Categories</h3>
                {categoryData.length > 0 ? (
                  <div className="space-y-3">
                    {categoryData.map((item) => (
                      <div key={item.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-neutral-600 dark:text-neutral-400 capitalize">
                            {item.category}
                          </span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">
                            {item.count} ({item.completed} completed)
                          </span>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
                          <div
                            className="bg-red-600 rounded-full h-2 transition-all"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-8">No data yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Range Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setChartRange(7)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  chartRange === 7
                    ? 'bg-red-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setChartRange(30)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  chartRange === 30
                    ? 'bg-red-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            {/* Growth Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Users Chart */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Active Users</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="active_users"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={{ fill: '#dc2626', r: 3 }}
                      name="Active Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Scans Chart */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Total Scans</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="total_scans" fill="#ea580c" radius={[4, 4, 0, 0]} name="Scans" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* New Users Chart */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">New Registrations</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="new_users"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ fill: '#059669', r: 3 }}
                      name="New Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Combined Chart */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Activity Overview</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="active_users" stroke="#dc2626" strokeWidth={2} name="Active Users" />
                    <Line type="monotone" dataKey="new_users" stroke="#059669" strokeWidth={2} name="New Users" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Registrations */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  Recent Registrations
                </h3>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-96 overflow-y-auto">
                {recentRegs.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-8">No registrations yet</p>
                ) : (
                  recentRegs.map((reg) => (
                    <div key={reg.user_id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {reg.display_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                          <Clock size={12} />
                          {new Date(reg.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            reg.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                          }`}
                        >
                          {reg.role}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            reg.subscription_plan === 'premium'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                          }`}
                        >
                          {reg.subscription_plan || 'free'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Scans Feed */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  <ScanLine size={18} className="text-red-600" />
                  Recent Scans
                </h3>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-96 overflow-y-auto">
                {recentScans.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-8">No scans yet</p>
                ) : (
                  recentScans.map((scan) => (
                    <div key={scan.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {scan.title}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {scan.user_name || 'Unknown user'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <span className="text-xs text-neutral-500">
                            {new Date(scan.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex gap-1">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
                              style={{
                                backgroundColor: DOCUMENT_TYPE_COLORS[scan.document_type] + '20',
                                color: DOCUMENT_TYPE_COLORS[scan.document_type],
                              }}
                            >
                              {scan.document_type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">No users found</div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {users.map((u) => {
                  const sub = u.subscriptions[0];
                  return (
                    <div
                      key={u.user_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 dark:text-white truncate">
                          {u.display_name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.role === 'admin'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {u.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              sub?.plan === 'premium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {sub?.plan || 'free'}
                          </span>
                          <span className="text-xs text-neutral-500">
                            Joined {new Date(u.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleUserRole(u.user_id, u.role)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                        {sub && (
                          <button
                            onClick={() => toggleUserPlan(u.user_id, sub.id, sub.plan)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                          >
                            {sub.plan === 'premium' ? 'Downgrade' : 'Upgrade'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
