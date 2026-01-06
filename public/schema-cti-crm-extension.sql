-- ============================================
-- CTI & CRM EXTENSION SCHEMA
-- IT REX Solutions - Extended Contact & Call Management
-- ============================================

-- 1. EXTEND CONTACTS TABLE
-- Add CRM fields for full contact management

-- Customer Type Enum
DO $$ BEGIN
  CREATE TYPE customer_type AS ENUM ('private', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Contact Status Enum
DO $$ BEGIN
  CREATE TYPE contact_status AS ENUM ('lead', 'new_customer', 'existing_customer', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Call Outcome Enum
DO $$ BEGIN
  CREATE TYPE call_outcome_type AS ENUM ('interested', 'offer_requested', 'complaint', 'callback_requested', 'attempted_to_reach', 'resolved', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to contacts table (if not exists)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'business';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'lead';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_owner_id UUID REFERENCES users(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_call_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_call_outcome VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_calls INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'de';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(50) DEFAULT 'phone';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS xing_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- 2. CALL_LOGS TABLE - Ensure it exists with all fields
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255),
  direction VARCHAR(20) NOT NULL DEFAULT 'inbound', -- inbound/outbound
  caller_number VARCHAR(50),
  callee_number VARCHAR(50),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'ringing', -- ringing, answered, completed, missed, voicemail
  call_outcome VARCHAR(100),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  transcription TEXT,
  ai_summary JSONB,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_billable BOOLEAN DEFAULT TRUE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  queue_name VARCHAR(100),
  ivr_path TEXT,
  wait_time_seconds INTEGER,
  hold_time_seconds INTEGER DEFAULT 0,
  transfer_count INTEGER DEFAULT 0,
  quality_score INTEGER,
  sentiment VARCHAR(20), -- positive, neutral, negative
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org ON call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_ticket ON call_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);
CREATE INDEX IF NOT EXISTS idx_call_logs_external ON call_logs(external_id);

-- 3. CALL RECORDINGS TABLE
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
  format VARCHAR(20) DEFAULT 'mp3',
  transcription_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  transcription_text TEXT,
  transcription_segments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACT TIMELINE / ACTIVITY LOG
CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- call, email, ticket, note, meeting, task
  title VARCHAR(255) NOT NULL,
  description TEXT,
  related_id UUID, -- ID of related entity (call_log_id, ticket_id, etc.)
  related_type VARCHAR(50), -- call, ticket, email, etc.
  performed_by_id UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_activities_contact ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_created ON contact_activities(created_at DESC);

-- 5. BACKUPS TABLE
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, daily, weekly, monthly
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  file_name VARCHAR(255),
  file_path TEXT,
  file_size_bytes BIGINT,
  checksum VARCHAR(64), -- SHA-256
  tables_included TEXT[],
  row_counts JSONB, -- { "users": 100, "tickets": 500, ... }
  version VARCHAR(20),
  notes TEXT,
  created_by_id UUID REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_type ON system_backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backups_status ON system_backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created ON system_backups(created_at DESC);

-- 6. RESTORE LOGS TABLE
CREATE TABLE IF NOT EXISTS restore_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID REFERENCES system_backups(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  tables_restored TEXT[],
  row_counts JSONB,
  errors TEXT[],
  performed_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TICKET MERGE HISTORY
CREATE TABLE IF NOT EXISTS ticket_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  source_ticket_id UUID NOT NULL,
  source_ticket_number VARCHAR(50),
  merged_by_id UUID REFERENCES users(id),
  merge_reason TEXT,
  items_moved JSONB, -- { comments: 5, attachments: 2, time_entries: 3 }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_merges_target ON ticket_merges(target_ticket_id);

-- 8. EMAIL SENT FROM TICKETS
CREATE TABLE IF NOT EXISTS ticket_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL DEFAULT 'outbound', -- outbound, inbound
  message_id VARCHAR(255), -- Email Message-ID header
  in_reply_to VARCHAR(255), -- For threading
  from_address VARCHAR(255) NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'sent', -- draft, queued, sent, delivered, failed, bounced
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT,
  sent_by_id UUID REFERENCES users(id),
  mailbox_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_emails_ticket ON ticket_emails(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_emails_message_id ON ticket_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_ticket_emails_in_reply_to ON ticket_emails(in_reply_to);

-- 9. CONTACT TAGS TABLE
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#3B82F6',
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default contact tags
INSERT INTO contact_tags (id, name, color, description) VALUES
  (gen_random_uuid(), 'VIP', '#EF4444', 'VIP-Kunde mit Priorität'),
  (gen_random_uuid(), 'Interessent', '#F59E0B', 'Potenzieller Neukunde'),
  (gen_random_uuid(), 'Bestandskunde', '#10B981', 'Bestehender Kunde'),
  (gen_random_uuid(), 'Beschwerde', '#DC2626', 'Hat Beschwerde eingereicht'),
  (gen_random_uuid(), 'Techniker', '#6366F1', 'Technischer Ansprechpartner'),
  (gen_random_uuid(), 'Entscheider', '#8B5CF6', 'Entscheidungsträger'),
  (gen_random_uuid(), 'Buchhaltung', '#06B6D4', 'Ansprechpartner Buchhaltung')
ON CONFLICT (name) DO NOTHING;

-- 10. BACKUP SCHEDULER SETTINGS
INSERT INTO settings (key, value, category, description) VALUES
  ('backup_daily_enabled', 'true', 'backup', 'Tägliche Backups aktivieren'),
  ('backup_daily_time', '"03:00"', 'backup', 'Uhrzeit für tägliche Backups (HH:MM)'),
  ('backup_weekly_enabled', 'true', 'backup', 'Wöchentliche Backups aktivieren'),
  ('backup_weekly_day', '0', 'backup', 'Wochentag für wöchentliches Backup (0=Sonntag)'),
  ('backup_monthly_enabled', 'true', 'backup', 'Monatliche Backups aktivieren'),
  ('backup_retention_days', '30', 'backup', 'Backups älter als X Tage löschen'),
  ('backup_include_files', 'true', 'backup', 'Dateianhänge in Backup einschließen')
ON CONFLICT (key) DO NOTHING;

-- 11. CREATE/UPDATE FUNCTION FOR CALL DURATION TIME ENTRY
CREATE OR REPLACE FUNCTION create_time_entry_from_call()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create time entry when call is completed and has duration
  IF NEW.status = 'completed' AND NEW.duration_seconds > 0 AND NEW.time_entry_id IS NULL THEN
    INSERT INTO time_entries (
      id, user_id, ticket_id, organization_id,
      description, duration_minutes, is_billable,
      entry_type, started_at, ended_at, created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.agent_id,
      NEW.ticket_id,
      NEW.organization_id,
      CONCAT('Telefonat: ', COALESCE(NEW.notes, 'Eingehender Anruf')),
      CEIL(NEW.duration_seconds / 60.0),
      NEW.is_billable,
      'call',
      NEW.started_at,
      NEW.ended_at,
      NOW()
    )
    RETURNING id INTO NEW.time_entry_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_call_time_entry ON call_logs;
CREATE TRIGGER trigger_call_time_entry
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION create_time_entry_from_call();

-- 12. UPDATE CONTACT STATS AFTER CALL
CREATE OR REPLACE FUNCTION update_contact_call_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts SET
      total_calls = total_calls + 1,
      last_call_date = NEW.started_at,
      last_call_outcome = NEW.call_outcome,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_calls ON call_logs;
CREATE TRIGGER trigger_update_contact_calls
  AFTER INSERT ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_call_stats();

-- 13. ADD entry_type TO time_entries IF NOT EXISTS
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50) DEFAULT 'manual';
-- Types: manual, call, ticket, meeting, etc.

-- Grant permissions (if using RLS)
-- ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;

COMMIT;
