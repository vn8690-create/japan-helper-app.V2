/*
# Advanced Admin Analytics

## Features
- DAU/WAU/MAU tracking
- Growth charts (7d/30d)
- Document type & category analytics
- Recent registrations & scans feed
- Average scans per user
*/

-- ============================================================================
-- DAILY STATS VIEW (for growth charts)
-- ============================================================================

CREATE OR REPLACE VIEW daily_stats AS
SELECT
  date,
  COUNT(DISTINCT user_id) as active_users,
  SUM(scans_used) as total_scans
FROM usage_tracking
GROUP BY date
ORDER BY date DESC;

-- ============================================================================
-- DOCUMENT TYPE STATS
-- ============================================================================

CREATE OR REPLACE VIEW document_type_stats AS
SELECT
  document_type,
  COUNT(*) as count
FROM scanned_documents
GROUP BY document_type
ORDER BY count DESC;

-- ============================================================================
-- CATEGORY STATS (from action_items)
-- ============================================================================

CREATE OR REPLACE VIEW category_stats AS
SELECT
  category,
  COUNT(*) as count
FROM action_items
GROUP BY category
ORDER BY count DESC;

-- ============================================================================
-- RECENT REGISTRATIONS
-- ============================================================================

CREATE OR REPLACE VIEW recent_registrations AS
SELECT
  p.user_id,
  p.display_name,
  p.role,
  p.created_at,
  s.plan as subscription_plan
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.user_id
ORDER BY p.created_at DESC
LIMIT 20;

-- ============================================================================
-- RECENT SCANS FEED
-- ============================================================================

CREATE OR REPLACE VIEW recent_scans_feed AS
SELECT
  sd.id,
  sd.title,
  sd.document_type,
  sd.urgency,
  sd.created_at,
  p.display_name
FROM scanned_documents sd
LEFT JOIN profiles p ON p.user_id = sd.user_id
ORDER BY sd.created_at DESC
LIMIT 50;

-- ============================================================================
-- MAIN ANALYTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_analytics()
RETURNS json AS $$
DECLARE
  result json;
  dau_stat bigint;
  wau_stat bigint;
  mau_stat bigint;
  total_scans_stat bigint;
  total_users_stat bigint;
  avg_scans_stat numeric;
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- DAU (today)
  SELECT COUNT(DISTINCT user_id) INTO dau_stat
  FROM usage_tracking WHERE date = CURRENT_DATE;

  -- WAU (last 7 days)
  SELECT COUNT(DISTINCT user_id) INTO wau_stat
  FROM usage_tracking WHERE date >= CURRENT_DATE - INTERVAL '6 days';

  -- MAU (last 30 days)
  SELECT COUNT(DISTINCT user_id) INTO mau_stat
  FROM usage_tracking WHERE date >= CURRENT_DATE - INTERVAL '29 days';

  -- Total scans (all time)
  SELECT COALESCE(SUM(scans_used), 0)::bigint INTO total_scans_stat
  FROM usage_tracking;

  -- Total users
  SELECT COUNT(*)::bigint INTO total_users_stat FROM profiles;

  -- Average scans per active user
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT user_id) > 0 
      THEN ROUND(SUM(scans_used)::numeric / COUNT(DISTINCT user_id), 2)
      ELSE 0 
    END INTO avg_scans_stat
  FROM usage_tracking WHERE date >= CURRENT_DATE - INTERVAL '29 days';

  SELECT json_build_object(
    -- Core metrics
    'dau', dau_stat,
    'wau', wau_stat,
    'mau', mau_stat,
    'total_users', total_users_stat,
    'total_scans', total_scans_stat,
    'avg_scans_per_user', avg_scans_stat,
    'premium_users', (SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium'),
    'free_users', (SELECT COUNT(*) FROM subscriptions WHERE plan = 'free'),
    
    -- Scans today
    'scans_today', (SELECT COALESCE(SUM(scans_used), 0) FROM usage_tracking WHERE date = CURRENT_DATE),
    
    -- Growth metrics (compare to previous period)
    'dau_yesterday', (SELECT COUNT(DISTINCT user_id) FROM usage_tracking WHERE date = CURRENT_DATE - 1),
    'wau_last_week', (SELECT COUNT(DISTINCT user_id) FROM usage_tracking WHERE date >= CURRENT_DATE - INTERVAL '13 days' AND date < CURRENT_DATE - INTERVAL '6 days'),
    'mau_last_month', (SELECT COUNT(DISTINCT user_id) FROM usage_tracking WHERE date >= CURRENT_DATE - INTERVAL '59 days' AND date < CURRENT_DATE - INTERVAL '29 days')
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- GROWTH DATA FUNCTION (for charts)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_growth_data(days_back integer DEFAULT 30)
RETURNS TABLE(date date, active_users bigint, total_scans bigint, new_users bigint) AS $$
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    d.date,
    COALESCE(u.active_users, 0)::bigint,
    COALESCE(u.total_scans, 0)::bigint,
    COALESCE(p.new_users, 0)::bigint
  FROM generate_series(CURRENT_DATE - (days_back - 1), CURRENT_DATE, INTERVAL '1 day') d(date)
  LEFT JOIN (
    SELECT date, COUNT(DISTINCT user_id)::bigint as active_users, SUM(scans_used)::bigint as total_scans
    FROM usage_tracking
    GROUP BY date
  ) u ON u.date = d.date
  LEFT JOIN (
    SELECT DATE(created_at) as created_date, COUNT(*)::bigint as new_users
    FROM profiles
    GROUP BY DATE(created_at)
  ) p ON p.created_date = d.date
  ORDER BY d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- DOCUMENT TYPE ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_document_type_analytics()
RETURNS TABLE(document_type text, count bigint, percentage numeric) AS $$
DECLARE
  total bigint;
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT COUNT(*) INTO total FROM scanned_documents;

  RETURN QUERY
  SELECT
    sd.document_type,
    COUNT(*)::bigint,
    CASE 
      WHEN total > 0 THEN ROUND((COUNT(*)::numeric / total) * 100, 1)
      ELSE 0 
    END
  FROM scanned_documents sd
  GROUP BY sd.document_type
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- CATEGORY ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_category_analytics()
RETURNS TABLE(category text, count bigint, percentage numeric, completed bigint) AS $$
DECLARE
  total bigint;
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT COUNT(*) INTO total FROM action_items;

  RETURN QUERY
  SELECT
    ai.category,
    COUNT(*)::bigint,
    CASE 
      WHEN total > 0 THEN ROUND((COUNT(*)::numeric / total) * 100, 1)
      ELSE 0 
    END,
    SUM(CASE WHEN ai.completed THEN 1 ELSE 0 END)::bigint
  FROM action_items ai
  GROUP BY ai.category
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- RECENT REGISTRATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_registrations(limit_count integer DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  role text,
  created_at timestamptz,
  subscription_plan text
) AS $$
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    p.role,
    p.created_at,
    s.plan
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.user_id
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- RECENT SCANS FEED
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_scans_feed(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  title text,
  document_type text,
  urgency text,
  created_at timestamptz,
  user_name text
) AS $$
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    sd.id,
    sd.title,
    sd.document_type,
    sd.urgency,
    sd.created_at,
    p.display_name
  FROM scanned_documents sd
  LEFT JOIN profiles p ON p.user_id = sd.user_id
  ORDER BY sd.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- HOURLY ACTIVITY (for detailed view)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_hourly_activity_today()
RETURNS TABLE(hour integer, scans bigint) AS $$
BEGIN
  -- Check admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM sd.created_at)::integer,
    COUNT(*)::bigint
  FROM scanned_documents sd
  WHERE DATE(sd.created_at) = CURRENT_DATE
  GROUP BY EXTRACT(HOUR FROM sd.created_at)
  ORDER BY hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;