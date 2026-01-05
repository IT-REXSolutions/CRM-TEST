-- ===============================================
-- AI-ITSM SYSTEM - Complete Schema
-- Central Inbox, AI Classification, Workflows
-- M365 Integration, Onboarding Automation
-- ===============================================

-- =============================================
-- MODULE 1: CENTRAL INBOX
-- =============================================

-- Unified Conversations (all channels)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Channel info
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'chat', 'portal', 'whatsapp', 'api', 'form')),
  channel_id TEXT, -- External message ID
  thread_id TEXT, -- For email threads
  
  -- Participants
  from_address TEXT,
  from_name TEXT,
  to_address TEXT,
  
  -- Content
  subject TEXT,
  body TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]',
  
  -- Classification (AI)
  ai_classification JSONB DEFAULT '{}',
  -- {"type": "support_ticket", "confidence": 0.95, "intent": "password_reset", "priority": "high", "suggested_queue": "helpdesk"}
  
  classification_status TEXT DEFAULT 'pending', -- pending, classified, manual, confirmed
  
  -- Linking
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT DEFAULT 'new', -- new, read, processed, archived
  is_inbound BOOLEAN DEFAULT true,
  is_spam BOOLEAN DEFAULT false,
  
  -- Metadata
  raw_data JSONB, -- Original message data
  headers JSONB, -- Email headers etc.
  
  processed_at TIMESTAMPTZ,
  processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_ticket ON conversations(ticket_id);
CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

-- =============================================
-- MODULE 2: AI CLASSIFICATION
-- =============================================

-- Classification Types
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  
  -- Workflow configuration
  default_priority TEXT DEFAULT 'medium',
  default_queue TEXT,
  sla_profile_id UUID REFERENCES sla_profiles(id) ON DELETE SET NULL,
  
  -- Required fields for this type
  required_fields JSONB DEFAULT '[]',
  -- ["customer_name", "device_type", "urgency"]
  
  -- Form template
  form_template_id UUID,
  
  -- Automation triggers
  auto_actions JSONB DEFAULT '[]',
  -- [{"trigger": "on_create", "action": "assign_queue", "config": {...}}]
  
  -- Keywords for AI classification
  keywords JSONB DEFAULT '[]',
  -- ["password", "reset", "login", "access"]
  
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default ticket types
INSERT INTO ticket_types (code, name, description, icon, color, keywords, default_priority) VALUES
  ('lead', 'Lead / Anfrage', 'Neue Kundenanfrage oder Interessent', 'UserPlus', 'blue', '["anfrage", "interesse", "angebot", "preise", "kosten", "beratung"]', 'medium'),
  ('support', 'Support Ticket', 'Technischer Support oder Hilfe', 'Headphones', 'green', '["hilfe", "problem", "fehler", "funktioniert nicht", "geht nicht", "support"]', 'medium'),
  ('onboarding', 'Mitarbeiter Onboarding', 'Neuer Mitarbeiter einrichten', 'UserCheck', 'purple', '["neuer mitarbeiter", "new starter", "einstellung", "onboarding", "neuer kollege", "anfangen"]', 'high'),
  ('offboarding', 'Mitarbeiter Offboarding', 'Mitarbeiter ausscheiden', 'UserMinus', 'orange', '["kündigung", "ausscheiden", "letzter tag", "offboarding", "verlässt", "austritt"]', 'high'),
  ('order', 'Bestellung', 'Hardware oder Software Bestellung', 'ShoppingCart', 'cyan', '["bestellen", "bestellung", "kaufen", "anschaffen", "beschaffen", "hardware", "lizenz"]', 'medium'),
  ('project', 'Projekt', 'Projektanfrage oder -arbeit', 'FolderKanban', 'indigo', '["projekt", "migration", "umstellung", "rollout", "implementierung"]', 'medium'),
  ('invoice', 'Rechnung', 'Rechnungsbezogene Anfrage', 'Receipt', 'yellow', '["rechnung", "invoice", "zahlung", "kosten", "abrechnung"]', 'low'),
  ('inquiry', 'Allgemeine Anfrage', 'Sonstige Anfragen', 'MessageCircle', 'slate', '[]', 'low')
ON CONFLICT (code) DO NOTHING;

-- AI Classification Log
CREATE TABLE IF NOT EXISTS ai_classification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Input
  input_text TEXT,
  input_context JSONB,
  
  -- AI Response
  classification JSONB NOT NULL,
  confidence DECIMAL(3,2),
  model_used TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Feedback
  was_correct BOOLEAN,
  corrected_to TEXT,
  feedback_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feedback_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_log_conversation ON ai_classification_log(conversation_id);
CREATE INDEX idx_ai_log_feedback ON ai_classification_log(was_correct);

-- =============================================
-- MODULE 3: DYNAMIC WORKFLOWS
-- =============================================

-- Dynamic Forms
CREATE TABLE IF NOT EXISTS dynamic_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  ticket_type_code TEXT REFERENCES ticket_types(code) ON DELETE SET NULL,
  
  -- Form configuration
  fields JSONB NOT NULL DEFAULT '[]',
  -- [{"name": "start_date", "type": "date", "label": "Startdatum", "required": true, "conditions": [...]}]
  
  -- Conditional logic
  conditions JSONB DEFAULT '[]',
  -- [{"field": "needs_email", "value": true, "show_fields": ["email_type", "distribution_lists"]}]
  
  -- Styling
  layout TEXT DEFAULT 'single', -- single, two-column, wizard
  
  is_active BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form Submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES dynamic_forms(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  
  -- Submitted data
  data JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'submitted', -- submitted, processing, completed, failed
  
  -- Processing results
  processing_log JSONB DEFAULT '[]',
  created_assets JSONB DEFAULT '[]',
  created_tasks JSONB DEFAULT '[]',
  
  submitted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_ticket ON form_submissions(ticket_id);

-- =============================================
-- MODULE 4: EMPLOYEE ONBOARDING
-- =============================================

-- Onboarding Requests
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Employee Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  personal_email TEXT,
  phone TEXT,
  start_date DATE NOT NULL,
  
  -- Position
  job_title TEXT,
  department TEXT,
  manager_name TEXT,
  manager_email TEXT,
  
  -- Work Setup
  location TEXT DEFAULT 'office', -- office, remote, hybrid
  office_location TEXT,
  
  -- IT Requirements
  needs_email BOOLEAN DEFAULT true,
  email_type TEXT, -- standard, shared, room
  email_aliases TEXT[],
  distribution_lists TEXT[],
  
  -- Microsoft 365
  m365_license_type TEXT, -- e1, e3, e5, f3, business_basic, business_standard
  needs_teams BOOLEAN DEFAULT true,
  needs_sharepoint BOOLEAN DEFAULT true,
  sharepoint_sites TEXT[],
  teams_channels TEXT[],
  
  -- Software
  software_requirements JSONB DEFAULT '[]',
  -- [{"name": "Adobe Creative Cloud", "license_type": "named"}]
  
  -- Hardware
  hardware_requirements JSONB DEFAULT '[]',
  -- [{"type": "laptop", "model": "ThinkPad T14", "specs": {...}}]
  
  -- Access
  access_permissions JSONB DEFAULT '[]',
  -- [{"system": "ERP", "role": "user"}, {"system": "CRM", "role": "admin"}]
  
  vpn_required BOOLEAN DEFAULT false,
  remote_desktop_required BOOLEAN DEFAULT false,
  
  -- Special Requirements
  special_requirements TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, form_sent, form_completed, processing, completed
  
  -- Progress tracking
  checklist JSONB DEFAULT '[]',
  -- [{"task": "Create AD account", "status": "completed", "completed_by": "...", "completed_at": "..."}]
  
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_ticket ON onboarding_requests(ticket_id);
CREATE INDEX idx_onboarding_org ON onboarding_requests(organization_id);
CREATE INDEX idx_onboarding_status ON onboarding_requests(status);
CREATE INDEX idx_onboarding_start ON onboarding_requests(start_date);

-- Offboarding Requests
CREATE TABLE IF NOT EXISTS offboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Employee Info
  employee_name TEXT NOT NULL,
  employee_email TEXT NOT NULL,
  last_day DATE NOT NULL,
  
  -- Manager
  manager_name TEXT,
  manager_email TEXT,
  
  -- Actions Required
  disable_account BOOLEAN DEFAULT true,
  disable_date DATE,
  email_forwarding TEXT,
  email_forwarding_duration INTEGER, -- days
  
  out_of_office_message TEXT,
  
  -- Data Handling
  backup_mailbox BOOLEAN DEFAULT true,
  backup_onedrive BOOLEAN DEFAULT true,
  transfer_data_to TEXT,
  
  -- Hardware
  hardware_to_return JSONB DEFAULT '[]',
  hardware_return_date DATE,
  
  -- Access Revocation
  access_to_revoke JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'pending',
  checklist JSONB DEFAULT '[]',
  
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offboarding_ticket ON offboarding_requests(ticket_id);
CREATE INDEX idx_offboarding_status ON offboarding_requests(status);

-- =============================================
-- MODULE 5: M365 INTEGRATION
-- =============================================

-- M365 Connections (OAuth)
CREATE TABLE IF NOT EXISTS m365_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Tenant Info
  tenant_id TEXT NOT NULL,
  tenant_name TEXT,
  
  -- OAuth Tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Scopes
  scopes TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  connected_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_m365_org ON m365_connections(organization_id);
CREATE INDEX idx_m365_tenant ON m365_connections(tenant_id);

-- M365 Users (synced)
CREATE TABLE IF NOT EXISTS m365_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES m365_connections(id) ON DELETE CASCADE,
  
  -- Azure AD Info
  azure_id TEXT NOT NULL,
  user_principal_name TEXT NOT NULL,
  display_name TEXT,
  given_name TEXT,
  surname TEXT,
  mail TEXT,
  job_title TEXT,
  department TEXT,
  office_location TEXT,
  mobile_phone TEXT,
  
  -- License Info
  assigned_licenses JSONB DEFAULT '[]',
  
  -- Status
  account_enabled BOOLEAN DEFAULT true,
  
  -- Linking
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_m365_users_azure ON m365_users(connection_id, azure_id);
CREATE INDEX idx_m365_users_upn ON m365_users(user_principal_name);

-- =============================================
-- MODULE 6: AUTOMATED COMMUNICATIONS
-- =============================================

-- Communication Templates (extended)
CREATE TABLE IF NOT EXISTS comm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Type
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'portal', 'internal')),
  trigger_event TEXT, -- ticket.created, onboarding.completed, etc.
  
  -- Content
  subject TEXT,
  body TEXT NOT NULL,
  body_html TEXT,
  
  -- Variables
  variables JSONB DEFAULT '[]',
  
  -- Targeting
  recipient_type TEXT DEFAULT 'customer', -- customer, employee, manager, technician
  
  -- Conditions
  conditions JSONB DEFAULT '{}',
  -- {"ticket_type": "onboarding", "status": "completed"}
  
  -- M365 specific
  include_login_instructions BOOLEAN DEFAULT false,
  include_mfa_setup BOOLEAN DEFAULT false,
  include_password_reset_link BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO comm_templates (name, type, trigger_event, subject, body, recipient_type) VALUES
(
  'Onboarding - Willkommen',
  'email',
  'onboarding.completed',
  'Willkommen bei {{company.name}} - Ihre IT-Zugangsdaten',
  'Hallo {{employee.first_name}},

herzlich willkommen bei {{company.name}}! 

Ihre IT-Zugänge wurden eingerichtet:

**E-Mail:** {{employee.email}}
**Benutzername:** {{employee.username}}

Bitte ändern Sie Ihr temporäres Passwort bei der ersten Anmeldung.

**Erste Schritte:**
1. Öffnen Sie https://portal.office.com
2. Melden Sie sich mit Ihrem Benutzernamen an
3. Richten Sie die Multi-Faktor-Authentifizierung ein
4. Ändern Sie Ihr Passwort

Bei Fragen wenden Sie sich an unser IT-Team.

Mit freundlichen Grüßen,
{{agent.name}}
IT-Support',
  'employee'
),
(
  'Ticket erstellt - Bestätigung',
  'email',
  'ticket.created',
  'Ihr Ticket #{{ticket.number}} wurde erstellt',
  'Sehr geehrte/r {{contact.name}},

vielen Dank für Ihre Anfrage. Wir haben Ihr Ticket erstellt:

**Ticket-Nr:** #{{ticket.number}}
**Betreff:** {{ticket.subject}}
**Priorität:** {{ticket.priority}}

Unser Team wird sich schnellstmöglich bei Ihnen melden.

Sie können den Status Ihres Tickets jederzeit im Kundenportal einsehen.

Mit freundlichen Grüßen,
{{company.name}} IT-Support',
  'customer'
),
(
  'Ticket gelöst',
  'email',
  'ticket.resolved',
  'Ihr Ticket #{{ticket.number}} wurde gelöst',
  'Sehr geehrte/r {{contact.name}},

Ihr Ticket wurde erfolgreich bearbeitet:

**Ticket-Nr:** #{{ticket.number}}
**Lösung:** {{ticket.resolution_summary}}

Falls Sie weitere Fragen haben, antworten Sie einfach auf diese E-Mail.

Mit freundlichen Grüßen,
{{agent.name}}',
  'customer'
)
ON CONFLICT DO NOTHING;

-- Sent Communications Log
CREATE TABLE IF NOT EXISTS comm_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES comm_templates(id) ON DELETE SET NULL,
  
  -- Target
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_type TEXT,
  
  -- Content (rendered)
  subject TEXT,
  body TEXT,
  
  -- Context
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  onboarding_id UUID REFERENCES onboarding_requests(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed, bounced
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_log_ticket ON comm_log(ticket_id);
CREATE INDEX idx_comm_log_status ON comm_log(status);

-- =============================================
-- MODULE 7: SIMILAR TICKETS & KNOWLEDGE
-- =============================================

-- Ticket Embeddings (for similarity search)
CREATE TABLE IF NOT EXISTS ticket_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Content that was embedded
  content_hash TEXT NOT NULL,
  
  -- Embedding vector (stored as array for simplicity, would use pgvector in production)
  embedding JSONB,
  
  -- Metadata
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_embeddings_ticket ON ticket_embeddings(ticket_id);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Categorization
  category TEXT,
  tags TEXT[],
  ticket_type_code TEXT,
  
  -- Linking
  related_tickets UUID[],
  
  -- AI
  embedding JSONB,
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT true,
  
  views INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_category ON kb_articles(category);
CREATE INDEX idx_kb_published ON kb_articles(is_published);

-- AI Suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Suggestion type
  type TEXT NOT NULL, -- response, solution, article, similar_ticket, escalation
  
  -- Content
  content JSONB NOT NULL,
  -- For response: {"text": "...", "tone": "professional"}
  -- For solution: {"steps": [...], "estimated_time": 15}
  -- For similar: {"ticket_ids": [...], "similarity_scores": [...]}
  
  -- Relevance
  confidence DECIMAL(3,2),
  
  -- Feedback
  was_used BOOLEAN,
  was_helpful BOOLEAN,
  feedback_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suggestions_ticket ON ai_suggestions(ticket_id);
CREATE INDEX idx_suggestions_type ON ai_suggestions(type);

-- =============================================
-- EXTEND EXISTING TABLES
-- =============================================

-- Add AI fields to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type_code TEXT REFERENCES ticket_types(code) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_classification JSONB DEFAULT '{}';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_suggested_response TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS similar_ticket_ids UUID[];
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

-- Add M365 fields to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS m365_tenant_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS m365_connected BOOLEAN DEFAULT false;

-- Add fields to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS azure_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS m365_user_id UUID REFERENCES m365_users(id) ON DELETE SET NULL;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT ALL ON conversations TO authenticated, anon, service_role;
GRANT ALL ON ticket_types TO authenticated, anon, service_role;
GRANT ALL ON ai_classification_log TO authenticated, anon, service_role;
GRANT ALL ON dynamic_forms TO authenticated, anon, service_role;
GRANT ALL ON form_submissions TO authenticated, anon, service_role;
GRANT ALL ON onboarding_requests TO authenticated, anon, service_role;
GRANT ALL ON offboarding_requests TO authenticated, anon, service_role;
GRANT ALL ON m365_connections TO authenticated, anon, service_role;
GRANT ALL ON m365_users TO authenticated, anon, service_role;
GRANT ALL ON comm_templates TO authenticated, anon, service_role;
GRANT ALL ON comm_log TO authenticated, anon, service_role;
GRANT ALL ON ticket_embeddings TO authenticated, anon, service_role;
GRANT ALL ON kb_articles TO authenticated, anon, service_role;
GRANT ALL ON ai_suggestions TO authenticated, anon, service_role;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_classification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE m365_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE m365_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Permissive policies
CREATE POLICY "allow_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ticket_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_classification_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON dynamic_forms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON form_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON onboarding_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON offboarding_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON m365_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON m365_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comm_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comm_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ticket_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON kb_articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ai_suggestions FOR ALL USING (true) WITH CHECK (true);
