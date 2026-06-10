import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type DocumentType = 'tax' | 'insurance' | 'pension' | 'cityHall' | 'other';
export type Category = 'tax' | 'insurance' | 'pension' | 'cityHall' | 'other';

export interface ScannedDocument {
  id: string;
  title: string;
  original_text: string | null;
  ai_summary: string | null;
  deadline: string | null;
  urgency: Urgency;
  document_type: DocumentType;
  created_at: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  urgency: Urgency;
  completed: boolean;
  category: Category;
  document_id: string | null;
  created_at: string;
}

export interface ConversationSession {
  id: string;
  scenario: string;
  messages: ConversationMessage[];
  created_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  translation?: string;
  correction?: string;
  tip?: string;
  timestamp: string;
}

// Subscription and Profile types
export type UserRole = 'user' | 'admin';
export type SubscriptionPlan = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Profile {
  user_id: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  date: string;
  scans_used: number;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users_today: number;
  total_scans: number;
  scans_today: number;
  premium_users: number;
  free_users: number;
}

// Extended analytics types
export interface AdminAnalytics {
  dau: number;
  wau: number;
  mau: number;
  total_users: number;
  total_scans: number;
  avg_scans_per_user: number;
  premium_users: number;
  free_users: number;
  scans_today: number;
  dau_yesterday: number | null;
  wau_last_week: number | null;
  mau_last_month: number | null;
}

export interface GrowthDataPoint {
  date: string;
  active_users: number;
  total_scans: number;
  new_users: number;
}

export interface DocumentTypeAnalytics {
  document_type: string;
  count: number;
  percentage: number;
}

export interface CategoryAnalytics {
  category: string;
  count: number;
  percentage: number;
  completed: number;
}

export interface RecentRegistration {
  user_id: string;
  display_name: string | null;
  role: string;
  created_at: string;
  subscription_plan: string;
}

export interface RecentScan {
  id: string;
  title: string;
  document_type: string;
  urgency: string;
  created_at: string;
  user_name: string | null;
}

// Subscription limits
export const FREE_TIER_DAILY_LIMIT = 5;
export const PREMIUM_UNLIMITED = -1; // -1 means unlimited
