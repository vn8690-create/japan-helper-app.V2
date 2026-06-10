/*
# Fix RLS Security Policies

## Security Issue
Previous policies used `USING (true)` which allows unrestricted access,
effectively bypassing row-level security.

## Fix
1. Add `user_id` column to all tables
2. Update RLS policies to require ownership (`auth.uid() = user_id`)
3. Remove anon access - only authenticated users can access data
4. Add index on user_id for performance
*/

-- ============================================================================
-- STEP 1: Add user_id columns
-- ============================================================================

ALTER TABLE scanned_documents 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE action_items 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE conversation_sessions 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Create indexes for user_id lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scanned_documents_user_id ON scanned_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);

-- ============================================================================
-- STEP 3: Drop old insecure policies
-- ============================================================================

DROP POLICY IF EXISTS "anon_select_scanned_documents" ON scanned_documents;
DROP POLICY IF EXISTS "anon_insert_scanned_documents" ON scanned_documents;
DROP POLICY IF EXISTS "anon_update_scanned_documents" ON scanned_documents;
DROP POLICY IF EXISTS "anon_delete_scanned_documents" ON scanned_documents;

DROP POLICY IF EXISTS "anon_select_action_items" ON action_items;
DROP POLICY IF EXISTS "anon_insert_action_items" ON action_items;
DROP POLICY IF EXISTS "anon_update_action_items" ON action_items;
DROP POLICY IF EXISTS "anon_delete_action_items" ON action_items;

DROP POLICY IF EXISTS "anon_select_conversation_sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "anon_insert_conversation_sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "anon_update_conversation_sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "anon_delete_conversation_sessions" ON conversation_sessions;

-- ============================================================================
-- STEP 4: Create secure RLS policies (authenticated users only)
-- ============================================================================

-- scanned_documents: user owns their data
CREATE POLICY "select_own_scanned_documents" ON scanned_documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_scanned_documents" ON scanned_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_scanned_documents" ON scanned_documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_scanned_documents" ON scanned_documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- action_items: user owns their data
CREATE POLICY "select_own_action_items" ON action_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_action_items" ON action_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_action_items" ON action_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_action_items" ON action_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- conversation_sessions: user owns their data
CREATE POLICY "select_own_conversation_sessions" ON conversation_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_conversation_sessions" ON conversation_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_conversation_sessions" ON conversation_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_conversation_sessions" ON conversation_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 5: Trigger to auto-populate user_id on INSERT (safety net)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables
DROP TRIGGER IF EXISTS trigger_set_user_id_scanned_documents ON scanned_documents;
CREATE TRIGGER trigger_set_user_id_scanned_documents
  BEFORE INSERT ON scanned_documents
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS trigger_set_user_id_action_items ON action_items;
CREATE TRIGGER trigger_set_user_id_action_items
  BEFORE INSERT ON action_items
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS trigger_set_user_id_conversation_sessions ON conversation_sessions;
CREATE TRIGGER trigger_set_user_id_conversation_sessions
  BEFORE INSERT ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id();
