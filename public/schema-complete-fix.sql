-- =====================================================
-- COMPLETE SYSTEM FIX - Database Schema
-- IT REX Solutions ITSM/CRM System
-- =====================================================

-- =====================================================
-- SECTION 1: DEALS / CRM PIPELINE
-- =====================================================

-- Create deals table if not exists
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  value DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  stage VARCHAR(50) DEFAULT 'lead',
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source VARCHAR(100),
  notes TEXT,
  pipeline_id VARCHAR(50) DEFAULT 'default',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pipelines table for multiple sales pipelines
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stages JSONB DEFAULT '["lead","qualified","proposal","negotiation","won","lost"]',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pipeline
INSERT INTO pipelines (id, name, description, is_default) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard Pipeline', 'Standard-Vertriebspipeline', true)
ON CONFLICT (id) DO NOTHING;

-- Create deal activities table
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL, -- call, email, meeting, note, task
  subject VARCHAR(255),
  description TEXT,
  completed_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 2: CTI / TELEPHONY
-- =====================================================

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id VARCHAR(100) UNIQUE, -- External call ID from phone system
  direction VARCHAR(10) NOT NULL, -- inbound, outbound
  status VARCHAR(20) DEFAULT 'ringing', -- ringing, answered, missed, ended
  caller_number VARCHAR(50),
  callee_number VARCHAR(50),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Agent who handled
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create call queue table
CREATE TABLE IF NOT EXISTS call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  queue_name VARCHAR(100),
  position INTEGER,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ
);

-- =====================================================
-- SECTION 3: ENHANCED ASSETS / SOFTWARE LICENSES
-- =====================================================

-- Add license fields to assets if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'software_name') THEN
    ALTER TABLE assets ADD COLUMN software_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'vendor') THEN
    ALTER TABLE assets ADD COLUMN vendor VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_source') THEN
    ALTER TABLE assets ADD COLUMN purchase_source VARCHAR(100); -- Amazon, Microsoft, Vendor, etc.
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_date') THEN
    ALTER TABLE assets ADD COLUMN purchase_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'license_expiry_date') THEN
    ALTER TABLE assets ADD COLUMN license_expiry_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_price') THEN
    ALTER TABLE assets ADD COLUMN purchase_price DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'sales_price') THEN
    ALTER TABLE assets ADD COLUMN sales_price DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'license_key') THEN
    ALTER TABLE assets ADD COLUMN license_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'license_quantity') THEN
    ALTER TABLE assets ADD COLUMN license_quantity INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'license_type') THEN
    ALTER TABLE assets ADD COLUMN license_type VARCHAR(50); -- perpetual, subscription, trial
  END IF;
END $$;

-- Create software_licenses table for detailed license tracking
CREATE TABLE IF NOT EXISTS software_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  product_key TEXT,
  license_type VARCHAR(50), -- perpetual, subscription, trial, volume
  quantity INTEGER DEFAULT 1,
  quantity_used INTEGER DEFAULT 0,
  purchase_source VARCHAR(100),
  purchase_date DATE,
  expiry_date DATE,
  purchase_price DECIMAL(10,2),
  renewal_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'EUR',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link assets to licenses
CREATE TABLE IF NOT EXISTS asset_license_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  license_id UUID REFERENCES software_licenses(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, license_id)
);

-- =====================================================
-- SECTION 4: TIME TRACKING ENHANCEMENTS
-- =====================================================

-- Add manual edit fields to time_entries if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'manual_edit') THEN
    ALTER TABLE time_entries ADD COLUMN manual_edit BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'original_duration') THEN
    ALTER TABLE time_entries ADD COLUMN original_duration INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'edited_by_id') THEN
    ALTER TABLE time_entries ADD COLUMN edited_by_id UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'edit_reason') THEN
    ALTER TABLE time_entries ADD COLUMN edit_reason TEXT;
  END IF;
END $$;

-- Create active_timers table for persistent timers
CREATE TABLE IF NOT EXISTS active_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_billable BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id) -- One active timer per user
);

-- =====================================================
-- SECTION 5: KNOWLEDGE BASE PERMISSIONS
-- =====================================================

-- Add visibility fields to wiki_pages if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_pages' AND column_name = 'visibility_type') THEN
    ALTER TABLE wiki_pages ADD COLUMN visibility_type VARCHAR(20) DEFAULT 'public'; -- public, internal, customer_specific
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_pages' AND column_name = 'allowed_organization_ids') THEN
    ALTER TABLE wiki_pages ADD COLUMN allowed_organization_ids UUID[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_pages' AND column_name = 'allowed_user_ids') THEN
    ALTER TABLE wiki_pages ADD COLUMN allowed_user_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- Create KB article permissions table
CREATE TABLE IF NOT EXISTS kb_article_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL, -- References wiki_pages
  permission_type VARCHAR(20) NOT NULL, -- organization, user, role
  target_id UUID NOT NULL, -- ID of org, user, or role
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 6: TICKET SYSTEM - ZAMMAD PARITY
-- =====================================================

-- Ticket articles (Zammad-style communication)
CREATE TABLE IF NOT EXISTS ticket_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  article_type VARCHAR(50) NOT NULL, -- email, note, phone, web, chat
  sender_type VARCHAR(20), -- customer, agent, system
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject VARCHAR(500),
  body TEXT NOT NULL,
  body_html TEXT,
  content_type VARCHAR(50) DEFAULT 'text/plain',
  is_internal BOOLEAN DEFAULT FALSE,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket macros (Zammad-style)
CREATE TABLE IF NOT EXISTS ticket_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  actions JSONB NOT NULL DEFAULT '[]', -- [{field, value}, ...]
  is_active BOOLEAN DEFAULT TRUE,
  group_ids UUID[] DEFAULT '{}', -- Which groups can use this macro
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default macros
INSERT INTO ticket_macros (id, name, description, actions) VALUES
('00000000-0000-0000-0000-000000000001', 'Schließen - Gelöst', 'Ticket als gelöst schließen', '[{"field":"status","value":"closed"},{"field":"resolution_category","value":"Gelöst"}]'),
('00000000-0000-0000-0000-000000000002', 'Eskalieren - Hoch', 'Priorität auf Hoch setzen', '[{"field":"priority","value":"high"}]'),
('00000000-0000-0000-0000-000000000003', 'Warten auf Kunde', 'Status auf wartend setzen', '[{"field":"status","value":"waiting"}]')
ON CONFLICT (id) DO NOTHING;

-- Ticket dynamic form definitions
CREATE TABLE IF NOT EXISTS ticket_form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ticket_type VARCHAR(50), -- incident, request, problem, change
  schema JSONB NOT NULL DEFAULT '{"fields":[]}',
  is_default BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket SLA tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'first_response_at') THEN
    ALTER TABLE tickets ADD COLUMN first_response_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'first_response_due_at') THEN
    ALTER TABLE tickets ADD COLUMN first_response_due_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolution_due_at') THEN
    ALTER TABLE tickets ADD COLUMN resolution_due_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'sla_breached') THEN
    ALTER TABLE tickets ADD COLUMN sla_breached BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_type') THEN
    ALTER TABLE tickets ADD COLUMN ticket_type VARCHAR(50) DEFAULT 'incident';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'group_id') THEN
    ALTER TABLE tickets ADD COLUMN group_id UUID;
  END IF;
END $$;

-- =====================================================
-- SECTION 7: PDF EXPORT SUPPORT
-- =====================================================

-- Create export_jobs table for tracking PDF generation
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type VARCHAR(50) NOT NULL, -- report, time_entries, tickets
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  parameters JSONB,
  file_url TEXT,
  file_name VARCHAR(255),
  requested_by_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 8: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_organization ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_software_licenses_expiry ON software_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_active_timers_user ON active_timers(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_articles_ticket ON ticket_articles(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_permissions_article ON kb_article_permissions(article_id);

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
