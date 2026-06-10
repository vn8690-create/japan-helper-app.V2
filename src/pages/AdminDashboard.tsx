import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  ScanLine,
  Crown,
  User,
  TrendingUp,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { supabase, Profile, Subscription, AdminStats } from '../lib/supabase';

interface UserWithSubscription extends Profile {
  subscriptions: Subscription[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, adminStats, fetchAdminStats, loading: profileLoading } = useProfile();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');

  useEffect(() => {
    if (!profileLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, profileLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);

    // Get all users with their subscriptions
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData) {
      // Get subscriptions for all users
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('*');

      const usersWithSubs = profilesData.map((profile) => ({
        ...profile,
        subscriptions: subsData?.filter((s) => s.user_id === profile.user_id) ?? [],
      }));

      setUsers(usersWithSubs);
    }

    setLoading(false);
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId);
    fetchUsers();
  };

  const toggleUserPlan = async (userId: string, subscriptionId: string, currentPlan: string) => {
    const newPlan = currentPlan === 'premium' ? 'free' : 'premium';
    await supabase
      .from('subscriptions')
      .update({
        plan: newPlan,
        status: newPlan === 'premium' ? 'active' : 'active',
        expires_at: newPlan === 'premium'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .eq('id', subscriptionId);
    fetchUsers();
  };

  if (profileLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  const stats = adminStats || {
    total_users: 0,
    active_users_today: 0,
    total_scans: 0,
    scans_today: 0,
    premium_users: 0,
    free_users: 0,
  };

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'blue' },
    { label: 'Active Today', value: stats.active_users_today, icon: UserCheck, color: 'green' },
    { label: 'Total Scans', value: stats.total_scans, icon: ScanLine, color: 'red' },
    { label: 'Scans Today', value: stats.scans_today, icon: TrendingUp, color: 'orange' },
    { label: 'Premium Users', value: stats.premium_users, icon: Crown, color: 'yellow' },
    { label: 'Free Users', value: stats.free_users, icon: User, color: 'neutral' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-24">
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-semibold text-lg text-neutral-900 dark:text-white">
              Admin Dashboard
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Users
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-neutral-200 dark:border-neutral-800"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      stat.color === 'blue'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                        : stat.color === 'green'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        : stat.color === 'red'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                        : stat.color === 'orange'
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                        : stat.color === 'yellow'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                    }`}
                  >
                    <stat.icon size={20} />
                  </div>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{stat.label}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            ))}
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
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                No users found
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {users.map((u) => {
                  const sub = u.subscriptions[0];
                  return (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between px-4 py-3"
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleUserRole(u.user_id, u.role)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() =>
                            sub && toggleUserPlan(u.user_id, sub.id, sub.plan)
                          }
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                        >
                          {sub?.plan === 'premium' ? 'Downgrade' : 'Upgrade'}
                        </button>
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
