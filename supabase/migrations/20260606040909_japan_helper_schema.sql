/*
# Japan Helper — Initial Schema

## Overview
Creates three tables to support the Japan Helper application for foreign residents in Japan.

## New Tables

### 1. `scanned_documents`
Stores results from scanning Japanese documents (tax notices, official letters, etc.).
- `id` — Primary key (UUID)
- `title` — Human-readable title for the document
- `original_text` — Raw OCR-extracted Japanese text
- `ai_summary` — AI-generated summary/translation
- `deadline` — Detected deadline date from the document
- `urgency` — Urgency level: low | medium | high | critical
- `document_type` — Category (tax, insurance, pension, other)
- `created_at` — Timestamp of when document was scanned

### 2. `action_items`
Stores the checklist of required actions for foreign residents.
- `id` — Primary key (UUID)
- `title` — Short description of the action
- `description` — Detailed description
- `due_date` — When the action needs to be completed
- `urgency` — Urgency level: low | medium | high | critical
- `completed` — Whether action has been completed
- `category` — Category (tax, insurance, pension, cityHall, other)
- `document_id` — Optional foreign key linking to a scanned document
- `created_at` — Creation timestamp

### 3. `conversation_sessions`
Stores AI conversation practice sessions.
- `id` — Primary key (UUID)
- `scenario` — Which scenario was practiced (cityHall, doctor, bank, school)
- `messages` — JSONB array of chat messages with role/content/corrections
- `created_at` — Session timestamp

## Security
- RLS enabled on all tables with anon + authenticated access (single-tenant, no auth)

## Notes
1. This is a single-tenant app — no user_id columns needed.
2. `USING (true)` policies are intentional for a shared/personal-use app.
3. All tables use UUID primary keys with random generation.
4. `document_id` in action_items uses ON DELETE SET NULL for safe document removal.
*/

-- scanned_documents
CREATE TABLE IF NOT EXISTS scanned_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Document',
  original_text text,
  ai_summary text,
  deadline date,
  urgency text CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  document_type text CHECK (document_type IN ('tax', 'insurance', 'pension', 'cityHall', 'other')) DEFAULT 'other',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanned_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scanned_documents" ON scanned_documents;
CREATE POLICY "anon_select_scanned_documents" ON scanned_documents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scanned_documents" ON scanned_documents;
CREATE POLICY "anon_insert_scanned_documents" ON scanned_documents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scanned_documents" ON scanned_documents;
CREATE POLICY "anon_update_scanned_documents" ON scanned_documents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scanned_documents" ON scanned_documents;
CREATE POLICY "anon_delete_scanned_documents" ON scanned_documents FOR DELETE
  TO anon, authenticated USING (true);


-- action_items
CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date date,
  urgency text CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  completed boolean NOT NULL DEFAULT false,
  category text CHECK (category IN ('tax', 'insurance', 'pension', 'cityHall', 'other')) DEFAULT 'other',
  document_id uuid REFERENCES scanned_documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_action_items" ON action_items;
CREATE POLICY "anon_select_action_items" ON action_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_action_items" ON action_items;
CREATE POLICY "anon_insert_action_items" ON action_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_action_items" ON action_items;
CREATE POLICY "anon_update_action_items" ON action_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_action_items" ON action_items;
CREATE POLICY "anon_delete_action_items" ON action_items FOR DELETE
  TO anon, authenticated USING (true);


-- conversation_sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversation_sessions" ON conversation_sessions;
CREATE POLICY "anon_select_conversation_sessions" ON conversation_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversation_sessions" ON conversation_sessions;
CREATE POLICY "anon_insert_conversation_sessions" ON conversation_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversation_sessions" ON conversation_sessions;
CREATE POLICY "anon_update_conversation_sessions" ON conversation_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversation_sessions" ON conversation_sessions;
CREATE POLICY "anon_delete_conversation_sessions" ON conversation_sessions FOR DELETE
  TO anon, authenticated USING (true);
