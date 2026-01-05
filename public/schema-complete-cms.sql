-- ===============================================
-- SERVICEDESK PRO - Complete CMS Schema
-- Ticket Kanban, Close Flow, Templates, Public API
-- ===============================================

-- =============================================
-- A) TICKET KANBAN VIEWS
-- =============================================

CREATE TABLE IF NOT EXISTS ticket_kanban_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Filter configuration (JSONB for flexibility)
  filters JSONB DEFAULT '{}',
  -- e.g. {"status": ["open", "pending"], "priority": ["high"], "organization_id": "...", "assignee_id": "..."}
  
  -- Column configuration
  columns JSONB DEFAULT '[
    {"id": "open", "name": "Offen", "status": "open"},
    {"id": "pending", "name": "Wartend", "status": "pending"},
    {"id": "in_progress", "name": "In Bearbeitung", "status": "in_progress"},
    {"id": "resolved", "name": "Gelöst", "status": "resolved"},
    {"id": "closed", "name": "Geschlossen", "status": "closed"}
  ]',
  
  -- Permissions
  is_public BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_roles TEXT[], -- Array of role names
  shared_with_teams UUID[], -- Array of team IDs
  
  -- Display settings
  card_fields JSONB DEFAULT '["subject", "priority", "assignee", "sla_status"]',
  sort_by TEXT DEFAULT 'created_at',
  sort_order TEXT DEFAULT 'desc',
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kanban_views_owner ON ticket_kanban_views(owner_id);

-- =============================================
-- B) TICKET CLOSE FLOW - WORKLOGS & TODOS
-- =============================================

-- Ticket Todos (Checklist items)
CREATE TABLE IF NOT EXISTS ticket_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  
  -- Can be converted to worklog item
  include_in_worklog BOOLEAN DEFAULT true,
  
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_todos_ticket ON ticket_todos(ticket_id);

-- Ticket Worklogs (Close summaries)
CREATE TABLE IF NOT EXISTS ticket_worklogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Time tracking
  time_spent_minutes INTEGER DEFAULT 0,
  is_billable BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2),
  
  -- Worklog content
  internal_summary TEXT,
  customer_summary TEXT,
  resolution_category TEXT,
  
  -- Completed todos (snapshot)
  completed_todos JSONB DEFAULT '[]',
  
  -- Metadata
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_worklogs_ticket ON ticket_worklogs(ticket_id);

-- Close Flow Settings (which fields are required)
-- This will be stored in the settings table with key 'close_flow_config'
-- Default: {"time_required": true, "worklog_required": false, "todos_required": false, "customer_summary_required": false, "resolution_category_required": false}

-- Add resolution fields to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_summary TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- =============================================
-- C) TEMPLATES SYSTEM
-- =============================================

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Template type
  type TEXT NOT NULL CHECK (type IN ('email', 'note', 'snippet', 'macro')),
  
  -- Content with variables
  subject TEXT, -- For email templates
  content TEXT NOT NULL,
  
  -- Variables used (for documentation/validation)
  variables JSONB DEFAULT '[]',
  -- e.g. ["ticket.number", "ticket.subject", "org.name", "agent.name"]
  
  -- Categorization
  category TEXT,
  tags TEXT[],
  
  -- Scope
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Permissions
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  editable_by_roles TEXT[] DEFAULT ARRAY['admin'],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON templates(type);
CREATE INDEX idx_templates_org ON templates(organization_id);

-- Template usage audit
CREATE TABLE IF NOT EXISTS template_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  used_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  used_in_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  context TEXT, -- 'reply', 'note', 'close_wizard'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- D) PUBLIC API SYSTEM
-- =============================================

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Key (hashed for security - we store prefix for identification)
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  
  -- Scopes/Permissions
  scopes JSONB DEFAULT '[]',
  -- e.g. ["tickets:read", "tickets:write", "orgs:read", "time:write"]
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  
  -- Restrictions
  allowed_ips TEXT[], -- NULL = all IPs allowed
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  -- Ownership
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, -- NULL = system-wide
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- API Audit Logs
CREATE TABLE IF NOT EXISTS api_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Request info
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_body JSONB,
  query_params JSONB,
  
  -- Response info
  response_status INTEGER,
  response_time_ms INTEGER,
  
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_audit_key ON api_audit_logs(api_key_id);
CREATE INDEX idx_api_audit_time ON api_audit_logs(created_at DESC);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  
  -- Target
  url TEXT NOT NULL,
  secret TEXT, -- For signature verification
  
  -- Events to subscribe to
  events TEXT[] NOT NULL,
  -- e.g. ['ticket.created', 'ticket.updated', 'ticket.closed', 'time.created']
  
  -- Filters (optional)
  filters JSONB DEFAULT '{}',
  -- e.g. {"organization_id": "...", "priority": ["high", "critical"]}
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Retry config
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Stats
  last_triggered_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Ownership
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events ON webhook_subscriptions USING GIN(events);

-- Webhook Delivery Log
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  -- Delivery status
  status TEXT DEFAULT 'pending', -- pending, success, failed, retrying
  attempts INTEGER DEFAULT 0,
  
  -- Response
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Error tracking
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_delivery_sub ON webhook_delivery_log(subscription_id);
CREATE INDEX idx_webhook_delivery_status ON webhook_delivery_log(status);

-- =============================================
-- E) ADDITIONAL AUDIT IMPROVEMENTS
-- =============================================

-- Add more fields to ticket_history for comprehensive audit
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Default Kanban View
INSERT INTO ticket_kanban_views (name, description, is_public, is_default)
VALUES ('Standard-Ansicht', 'Alle Tickets nach Status', true, true)
ON CONFLICT DO NOTHING;

-- Default Close Flow Settings
INSERT INTO settings (key, value, category, description)
VALUES (
  'close_flow_config',
  '{"time_required": true, "worklog_required": false, "todos_required": false, "customer_summary_required": false, "resolution_category_required": false, "internal_note_required": false}',
  'tickets',
  'Pflichtfelder beim Schließen von Tickets'
)
ON CONFLICT (key) DO NOTHING;

-- Default Email Templates
INSERT INTO templates (name, type, subject, content, variables, category) VALUES
(
  'Ticket erstellt',
  'email',
  'Ihr Ticket #{{ticket.number}} wurde erstellt',
  'Sehr geehrte/r {{contact.name}},

vielen Dank für Ihre Anfrage. Wir haben Ihr Ticket mit der Nummer #{{ticket.number}} erhalten.

**Betreff:** {{ticket.subject}}

Unser Team wird sich schnellstmöglich um Ihr Anliegen kümmern.

Mit freundlichen Grüßen,
{{agent.name}}
{{company.name}}',
  '["ticket.number", "ticket.subject", "contact.name", "agent.name", "company.name"]',
  'system'
),
(
  'Ticket gelöst',
  'email',
  'Ihr Ticket #{{ticket.number}} wurde gelöst',
  'Sehr geehrte/r {{contact.name}},

Ihr Ticket #{{ticket.number}} wurde gelöst.

**Lösung:**
{{ticket.resolution_summary}}

Falls Sie weitere Fragen haben, antworten Sie einfach auf diese E-Mail.

Mit freundlichen Grüßen,
{{agent.name}}',
  '["ticket.number", "contact.name", "agent.name", "ticket.resolution_summary"]',
  'system'
),
(
  'Interne Notiz - Eskalation',
  'note',
  NULL,
  '⚠️ **ESKALATION**

Grund: {{reason}}
Eskaliert an: {{escalation_target}}
Priorität: {{priority}}

Nächste Schritte:
- ',
  '["reason", "escalation_target", "priority"]',
  'internal'
),
(
  'Snippet - Begrüßung',
  'snippet',
  NULL,
  'Vielen Dank für Ihre Nachricht. Ich habe Ihr Anliegen erhalten und werde mich darum kümmern.',
  '[]',
  'replies'
),
(
  'Snippet - Rückfrage',
  'snippet',
  NULL,
  'Um Ihnen besser helfen zu können, benötige ich noch folgende Informationen:

1. 
2. 
3. ',
  '[]',
  'replies'
)
ON CONFLICT DO NOTHING;

-- Resolution Categories
INSERT INTO settings (key, value, category, description)
VALUES (
  'resolution_categories',
  '["Problem gelöst", "Workaround bereitgestellt", "Kein Problem gefunden", "Duplikat", "Abgebrochen durch Kunde", "Nicht reproduzierbar", "Feature-Anfrage", "Konfigurationsänderung", "Sonstiges"]',
  'tickets',
  'Verfügbare Lösungskategorien'
)
ON CONFLICT (key) DO NOTHING;

-- Available API Scopes
INSERT INTO settings (key, value, category, description)
VALUES (
  'api_scopes',
  '[
    {"id": "tickets:read", "name": "Tickets lesen", "description": "Tickets abrufen und durchsuchen"},
    {"id": "tickets:write", "name": "Tickets schreiben", "description": "Tickets erstellen und bearbeiten"},
    {"id": "tickets:delete", "name": "Tickets löschen", "description": "Tickets löschen"},
    {"id": "orgs:read", "name": "Organisationen lesen", "description": "Organisationen und Kontakte abrufen"},
    {"id": "orgs:write", "name": "Organisationen schreiben", "description": "Organisationen und Kontakte bearbeiten"},
    {"id": "users:read", "name": "Benutzer lesen", "description": "Benutzerinformationen abrufen"},
    {"id": "time:read", "name": "Zeiteinträge lesen", "description": "Zeiteinträge abrufen"},
    {"id": "time:write", "name": "Zeiteinträge schreiben", "description": "Zeiteinträge erstellen und bearbeiten"},
    {"id": "assets:read", "name": "Assets lesen", "description": "Assets/CMDB abrufen"},
    {"id": "assets:write", "name": "Assets schreiben", "description": "Assets erstellen und bearbeiten"},
    {"id": "webhooks:manage", "name": "Webhooks verwalten", "description": "Webhook-Subscriptions verwalten"}
  ]',
  'api',
  'Verfügbare API-Berechtigungen'
)
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL ON ticket_kanban_views TO authenticated, anon, service_role;
GRANT ALL ON ticket_todos TO authenticated, anon, service_role;
GRANT ALL ON ticket_worklogs TO authenticated, anon, service_role;
GRANT ALL ON templates TO authenticated, anon, service_role;
GRANT ALL ON template_usage_log TO authenticated, anon, service_role;
GRANT ALL ON api_keys TO authenticated, anon, service_role;
GRANT ALL ON api_audit_logs TO authenticated, anon, service_role;
GRANT ALL ON webhook_subscriptions TO authenticated, anon, service_role;
GRANT ALL ON webhook_delivery_log TO authenticated, anon, service_role;

-- Enable RLS with permissive policies
ALTER TABLE ticket_kanban_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON ticket_kanban_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ticket_todos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ticket_worklogs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON template_usage_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON api_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON webhook_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON webhook_delivery_log FOR ALL USING (true) WITH CHECK (true);
