-- ===============================================
-- M365 MAILBOX INTEGRATION - Extended Schema
-- Multi-Mailbox Support, Migration, Inbox Visualization
-- ===============================================

-- Extend m365_connections for mailbox features
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS mailbox_type TEXT DEFAULT 'user'; -- 'user', 'shared', 'service'
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS auto_ticket_create BOOLEAN DEFAULT false;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS default_queue TEXT;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS default_priority TEXT DEFAULT 'medium';
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS default_sla_id UUID;
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS visible_to_roles TEXT[] DEFAULT ARRAY['admin', 'agent'];

-- Migration Jobs Table
CREATE TABLE IF NOT EXISTS migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES m365_connections(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  total_emails INTEGER DEFAULT 0,
  processed_emails INTEGER DEFAULT 0,
  created_tickets INTEGER DEFAULT 0,
  skipped_emails INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  date_from DATE,
  date_to DATE,
  folder TEXT DEFAULT 'inbox',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_mailbox ON migration_jobs(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);

-- Extend conversations table for mailbox linking
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mailbox_id UUID REFERENCES m365_connections(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_thread_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS importance TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_mailbox ON conversations(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(conversation_thread_id);

-- Email attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT,
  name TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  content_id TEXT,
  is_inline BOOLEAN DEFAULT false,
  graph_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_conversation ON email_attachments(conversation_id);

-- Mailbox access rules (role-based visibility)
CREATE TABLE IF NOT EXISTS mailbox_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES m365_connections(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  access_level TEXT DEFAULT 'read', -- 'read', 'write', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mailbox_id, role_id),
  UNIQUE(mailbox_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mailbox_access_mailbox ON mailbox_access_rules(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_access_user ON mailbox_access_rules(user_id);

-- Email-to-Ticket Rules per Mailbox
CREATE TABLE IF NOT EXISTS mailbox_ticket_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES m365_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions JSONB DEFAULT '{}', -- {"sender_contains": "@domain.de", "subject_contains": "urgent"}
  actions JSONB DEFAULT '{}', -- {"priority": "high", "queue": "support", "sla_id": "..."}
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mailbox_rules_mailbox ON mailbox_ticket_rules(mailbox_id);

-- Permissions
GRANT ALL ON migration_jobs TO authenticated, anon, service_role;
GRANT ALL ON email_attachments TO authenticated, anon, service_role;
GRANT ALL ON mailbox_access_rules TO authenticated, anon, service_role;
GRANT ALL ON mailbox_ticket_rules TO authenticated, anon, service_role;

-- RLS Policies
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailbox_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailbox_ticket_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON migration_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON email_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON mailbox_access_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON mailbox_ticket_rules FOR ALL USING (true) WITH CHECK (true);

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'M365 Mailbox Schema update completed!';
  RAISE NOTICE 'New tables: migration_jobs, email_attachments, mailbox_access_rules, mailbox_ticket_rules';
  RAISE NOTICE 'Extended: m365_connections, conversations';
END $$;
