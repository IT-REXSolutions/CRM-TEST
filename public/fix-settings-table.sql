-- ===============================================
-- SERVICEDESK PRO - Settings Table Fix
-- Run this in Supabase SQL Editor
-- ===============================================

-- Drop and recreate settings table
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  category TEXT DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID
);

-- Enable RLS but allow all operations for service role
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (the API uses service role key)
CREATE POLICY "Allow all for service role" ON settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert some default settings
INSERT INTO settings (key, value, category, description) VALUES
  ('company_name', '"ServiceDesk Pro"', 'general', 'Firmenname'),
  ('company_email', '"support@example.de"', 'general', 'Support E-Mail'),
  ('timezone', '"Europe/Berlin"', 'general', 'Zeitzone'),
  ('locale', '"de-DE"', 'general', 'Sprache'),
  ('default_ticket_priority', '"medium"', 'tickets', 'Standard-Priorität'),
  ('default_ticket_status', '"open"', 'tickets', 'Standard-Status'),
  ('auto_assign_enabled', 'false', 'tickets', 'Automatische Zuweisung'),
  ('sla_enabled', 'true', 'tickets', 'SLA-Überwachung'),
  ('openai_enabled', 'false', 'integrations', 'OpenAI aktiviert'),
  ('openai_model', '"gpt-4o-mini"', 'integrations', 'OpenAI Modell'),
  ('placetel_enabled', 'false', 'integrations', 'Placetel aktiviert'),
  ('lexoffice_enabled', 'false', 'integrations', 'Lexoffice aktiviert'),
  ('log_retention_days', '90', 'audit', 'Log-Aufbewahrung (Tage)'),
  ('backup_enabled', 'false', 'audit', 'Backup aktiviert'),
  ('backup_schedule', '"daily"', 'audit', 'Backup-Zeitplan'),
  ('default_hourly_rate', '85', 'billing', 'Standard Stundensatz')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL ON settings TO authenticated;
GRANT ALL ON settings TO anon;
GRANT ALL ON settings TO service_role;
