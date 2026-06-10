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
