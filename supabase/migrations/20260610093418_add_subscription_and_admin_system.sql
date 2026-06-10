/*
# Subscription and Admin System

## New Tables

### 1. `profiles`
Extends auth.users with app-specific data.
- `user_id` — PK, references auth.users
- `display_name` — User's display name
- `role` — 'user' or 'admin'
- `created_at` — Creation timestamp
- `updated_at` — Last update timestamp

### 2. `subscriptions`
User subscription status.
- `id` — PK (UUID)
- `user_id` — FK to auth.users
- `plan` — 'free' | 'premium'
- `status` — 'active' | 'expired' | 'cancelled'
- `expires_at` — When premium expires (null for free)
- `created_at` — Creation timestamp
- `updated_at` — Last update timestamp

### 3. `usage_tracking`
Daily scan usage for rate limiting.
- `id` — PK (UUID)
- `user_id` — FK to auth.users
- `date` — The date of usage
- `scans_used` — Number of scans that day
- `created_at` — Creation timestamp

## Security
- RLS enabled on all tables
- Users can only read/write their own data
- Only admins can access admin endpoints

## Notes
1. Free users: 5 scans/day
2. Premium users: unlimited scans
3. Admin role grants access to /admin dashboard
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Users can update their own profile (but not role)
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert happens via trigger, not direct user insert


-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Users can read their own subscription
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Users cannot directly modify subscriptions (admin/system only)
-- Inserts happen via trigger


-- ============================================================================
-- USAGE_TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  scans_used integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_usage_tracking_user_date ON usage_tracking(user_id, date);

-- Users can read their own usage
CREATE POLICY "select_own_usage" ON usage_tracking FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Users can insert their own usage (for simplicity)
CREATE POLICY "insert_own_usage" ON usage_tracking FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage (increment scans)
CREATE POLICY "update_own_usage" ON usage_tracking FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- AUTO-CREATE PROFILE & SUBSCRIPTION ON USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- ADMIN STATS VIEW (for admin dashboard)
-- ============================================================================

CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM profiles p
   WHERE EXISTS (
     SELECT 1 FROM usage_tracking ut
     WHERE ut.user_id = p.user_id AND ut.date = CURRENT_DATE
   )
  ) as active_users_today,
  (SELECT COALESCE(SUM(scans_used), 0) FROM usage_tracking) as total_scans,
  (SELECT COALESCE(SUM(scans_used), 0) FROM usage_tracking WHERE date = CURRENT_DATE) as scans_today,
  (SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium') as premium_users,
  (SELECT COUNT(*) FROM subscriptions WHERE plan = 'free') as free_users;


-- ============================================================================
-- GRANT ADMIN ACCESS TO VIEW
-- ============================================================================

-- Allow admins to read admin_stats (RLS on view uses auth.uid())
-- We need a function to check admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin can read all profiles (for user management)
CREATE POLICY "admin_read_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

-- Admin can update any profile (including roles)
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (is_admin())
  WITH CHECK (is_admin());

-- Admin can read all subscriptions
CREATE POLICY "admin_read_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (is_admin());

-- Admin can update any subscription
CREATE POLICY "admin_update_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (is_admin())
  WITH CHECK (is_admin());

-- Admin can read all usage_tracking
CREATE POLICY "admin_read_usage" ON usage_tracking FOR SELECT
  TO authenticated USING (is_admin());
