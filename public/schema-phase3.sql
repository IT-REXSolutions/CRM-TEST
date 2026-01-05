-- =============================================
-- ServiceDesk Pro - Phase 3 Schema Extensions
-- =============================================

-- Settings/Configuration Table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Recurring Tickets Table
CREATE TABLE IF NOT EXISTS recurring_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Template data
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_profile_id UUID REFERENCES sla_profiles(id) ON DELETE SET NULL,
  
  -- Schedule
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  schedule_day INTEGER, -- day of week (0-6) for weekly, day of month (1-31) for monthly
  schedule_time TIME DEFAULT '09:00:00',
  schedule_timezone TEXT DEFAULT 'Europe/Berlin',
  
  -- Tracking
  last_created_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Integration Log
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body TEXT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'processed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phone Call Logs (for Placetel integration)
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT, -- Placetel call ID
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  caller_number TEXT,
  callee_number TEXT,
  duration_seconds INTEGER,
  status TEXT,
  recording_url TEXT,
  transcription TEXT,
  ai_summary TEXT,
  
  -- Linked entities
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  handled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Drafts (for Lexoffice integration)
CREATE TABLE IF NOT EXISTS invoice_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Invoice data
  invoice_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  
  -- Totals
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 19,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  
  -- Line items stored as JSON
  line_items JSONB DEFAULT '[]',
  
  -- Lexoffice sync
  lexoffice_id TEXT,
  synced_at TIMESTAMPTZ,
  
  -- Dates
  invoice_date DATE,
  due_date DATE,
  
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all" ON settings FOR ALL USING (true);
CREATE POLICY "Allow all" ON recurring_tickets FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON call_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON invoice_drafts FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_recurring_tickets_next_run ON recurring_tickets(next_run_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_ticket ON call_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_invoice_drafts_org ON invoice_drafts(organization_id);

-- Default Settings
INSERT INTO settings (key, value, category, description) VALUES
  ('company_name', '"ServiceDesk Pro"', 'general', 'Firmenname'),
  ('company_email', '"support@example.de"', 'general', 'Support E-Mail'),
  ('company_phone', '""', 'general', 'Telefonnummer'),
  ('default_ticket_priority', '"medium"', 'tickets', 'Standard-Priorität für neue Tickets'),
  ('auto_assign_enabled', 'false', 'tickets', 'Automatische Zuweisung aktivieren'),
  ('email_notifications_enabled', 'false', 'notifications', 'E-Mail-Benachrichtigungen aktivieren'),
  ('placetel_api_key', '""', 'integrations', 'Placetel API-Schlüssel'),
  ('placetel_enabled', 'false', 'integrations', 'Placetel-Integration aktiviert'),
  ('lexoffice_api_key', '""', 'integrations', 'Lexoffice API-Schlüssel'),
  ('lexoffice_enabled', 'false', 'integrations', 'Lexoffice-Integration aktiviert'),
  ('smtp_host', '""', 'email', 'SMTP Server'),
  ('smtp_port', '587', 'email', 'SMTP Port'),
  ('smtp_user', '""', 'email', 'SMTP Benutzername'),
  ('smtp_password', '""', 'email', 'SMTP Passwort'),
  ('smtp_from_address', '""', 'email', 'Absender E-Mail'),
  ('imap_host', '""', 'email', 'IMAP Server'),
  ('imap_port', '993', 'email', 'IMAP Port'),
  ('imap_user', '""', 'email', 'IMAP Benutzername'),
  ('imap_password', '""', 'email', 'IMAP Passwort'),
  ('email_to_ticket_enabled', 'false', 'email', 'E-Mail zu Ticket aktiviert')
ON CONFLICT (key) DO NOTHING;
