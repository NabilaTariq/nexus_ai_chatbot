-- ==============================================================================
-- Nexus AI Database Schema for Supabase (PostgreSQL)
-- Safe to run multiple times (Idempotent)
-- ==============================================================================

-- 1. Enable UUID Extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Messages Table with Foreign Key & Cascading Deletion
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'model')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Performance Indexes for Fast Lookups & Sorting
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at ASC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Safe recreate with DROP POLICY IF EXISTS)
DROP POLICY IF EXISTS "Allow public full access to conversations" ON conversations;
CREATE POLICY "Allow public full access to conversations"
  ON conversations FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access to messages" ON messages;
CREATE POLICY "Allow public full access to messages"
  ON messages FOR ALL
  USING (true)
  WITH CHECK (true);
