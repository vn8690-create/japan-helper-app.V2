import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, Profile, Subscription, UsageTracking, AdminStats, FREE_TIER_DAILY_LIMIT } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ProfileContextType {
  profile: Profile | null;
  subscription: Subscription | null;
  usage: UsageTracking | null;
  isAdmin: boolean;
  isPremium: boolean;
  scansRemaining: number;
  loading: boolean;
  incrementScanUsage: () => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  adminStats: AdminStats | null;
  fetchAdminStats: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const isPremium = subscription?.plan === 'premium' && subscription?.status === 'active';

  // Calculate remaining scans
  const scansRemaining = isPremium
    ? FREE_TIER_DAILY_LIMIT // Show max for premium (unlimited)
    : Math.max(0, FREE_TIER_DAILY_LIMIT - (usage?.scans_used ?? 0));

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSubscription(null);
      setUsage(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setProfile(profileData);

    // Fetch subscription
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setSubscription(subData);

    // Fetch today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    setUsage(usageData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const incrementScanUsage = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    // Premium users have unlimited scans
    if (isPremium) return true;

    // Free users: check limit
    const usedToday = usage?.scans_used ?? 0;
    if (usedToday >= FREE_TIER_DAILY_LIMIT) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert usage tracking
    if (usage) {
      // Update existing
      const { error } = await supabase
        .from('usage_tracking')
        .update({ scans_used: usage.scans_used + 1 })
        .eq('id', usage.id);

      if (!error) {
        setUsage({ ...usage, scans_used: usage.scans_used + 1 });
      }
      return !error;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('usage_tracking')
        .insert({ user_id: user.id, date: today, scans_used: 1 })
        .select()
        .single();

      if (!error && data) {
        setUsage(data);
      }
      return !error;
    }
  }, [user, isPremium, usage]);

  const fetchAdminStats = useCallback(async () => {
    if (!isAdmin) return;

    const { data, error } = await supabase
      .rpc('get_admin_stats');

    if (!error && data) {
      setAdminStats(data);
    }
  }, [isAdmin]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        subscription,
        usage,
        isAdmin,
        isPremium,
        scansRemaining,
        loading,
        incrementScanUsage,
        refreshProfile: fetchProfile,
        adminStats,
        fetchAdminStats,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
