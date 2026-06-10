-- Admin stats function (callable by admins)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM usage_tracking WHERE date = CURRENT_DATE),
    'total_scans', (SELECT COALESCE(SUM(scans_used), 0) FROM usage_tracking),
    'scans_today', (SELECT COALESCE(SUM(scans_used), 0) FROM usage_tracking WHERE date = CURRENT_DATE),
    'premium_users', (SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium'),
    'free_users', (SELECT COUNT(*) FROM subscriptions WHERE plan = 'free')
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;