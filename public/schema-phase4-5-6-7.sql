-- ===============================================
-- SERVICEDESK PRO - Schema Phase 4, 5, 6, 7
-- Phone + AI, Dictation, Lexoffice, Automations
-- ===============================================

-- Call Logs (Phone Integration)
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound', -- inbound/outbound
  caller_number TEXT,
  callee_number TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  transcription TEXT,
  ai_summary JSONB,
  status TEXT DEFAULT 'completed',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for phone number lookup
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_ticket ON call_logs(ticket_id);

-- Contacts table (if not exists)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  position TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts(mobile);

-- Add AI summary column to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';

-- Invoice Drafts (Lexoffice Integration)
CREATE TABLE IF NOT EXISTS invoice_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT,
  status TEXT DEFAULT 'draft', -- draft, sent, paid, cancelled
  line_items JSONB,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 19,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  lexoffice_id TEXT,
  synced_at TIMESTAMPTZ,
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_drafts_org ON invoice_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_drafts_status ON invoice_drafts(status);

-- Add invoicing columns to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN DEFAULT false;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoice_drafts(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 85;

-- Automation Logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success', -- success, failed, skipped
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_ticket ON automation_logs(ticket_id);

-- Update automation_rules with more fields
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0;

-- Ticket tag relations (for add_tag automation)
CREATE TABLE IF NOT EXISTS ticket_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, tag_id)
);

-- SLA columns for tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_response_due TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_resolution_due TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_response_met BOOLEAN;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_resolution_met BOOLEAN;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Add organization_id to time_entries if not exists
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Initial settings for integrations (if not already set)
INSERT INTO settings (key, value, category, description)
VALUES 
  ('openai_enabled', 'false', 'integrations', 'OpenAI Integration aktiviert'),
  ('openai_model', '"gpt-4o-mini"', 'integrations', 'Standard OpenAI Modell'),
  ('placetel_enabled', 'false', 'integrations', 'Placetel Integration aktiviert'),
  ('lexoffice_enabled', 'false', 'integrations', 'Lexoffice Integration aktiviert'),
  ('default_hourly_rate', '85', 'billing', 'Standard Stundensatz in EUR')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster settings lookup
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
