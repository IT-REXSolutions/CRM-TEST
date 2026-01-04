// Database initialization script for Supabase
// Run this file to set up all tables

const SCHEMA_SQL = `
-- =============================================
-- ServiceDesk Pro - Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ROLES & PERMISSIONS
-- =============================================

-- System Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- =============================================
-- USERS
-- =============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- Supabase Auth ID
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  user_type TEXT NOT NULL DEFAULT 'internal' CHECK (user_type IN ('internal', 'customer', 'external')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Role mapping
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- =============================================
-- ORGANIZATIONS & CUSTOMERS
-- =============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT,
  domain TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations/Sites
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Deutschland',
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (persons at organizations)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- If contact has user account
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Profiles
CREATE TABLE IF NOT EXISTS sla_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  response_time_minutes INTEGER NOT NULL DEFAULT 240, -- 4 hours
  resolution_time_minutes INTEGER NOT NULL DEFAULT 1440, -- 24 hours
  business_hours_only BOOLEAN DEFAULT true,
  priority_multipliers JSONB DEFAULT '{"low": 2, "medium": 1, "high": 0.5, "critical": 0.25}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sla_profile_id UUID REFERENCES sla_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contract_number TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_hours INTEGER, -- Included support hours
  hourly_rate DECIMAL(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TICKETS
-- =============================================

-- Ticket Tags
CREATE TABLE IF NOT EXISTS ticket_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Templates
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number SERIAL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT,
  type TEXT DEFAULT 'incident' CHECK (type IN ('incident', 'service_request', 'problem', 'change')),
  
  -- Relations
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- SLA
  sla_profile_id UUID REFERENCES sla_profiles(id) ON DELETE SET NULL,
  sla_response_due TIMESTAMPTZ,
  sla_resolution_due TIMESTAMPTZ,
  sla_response_met BOOLEAN,
  sla_resolution_met BOOLEAN,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Parent/Child for Merge/Split
  parent_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  
  -- Metadata
  source TEXT DEFAULT 'web' CHECK (source IN ('web', 'email', 'phone', 'api', 'portal')),
  ai_summary TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique ticket number sequence
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);

-- Ticket-Tag Relations
CREATE TABLE IF NOT EXISTS ticket_tag_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
  UNIQUE(ticket_id, tag_id)
);

-- Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- Internal note vs customer-visible
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket History (Audit Log)
CREATE TABLE IF NOT EXISTS ticket_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'assigned', 'commented', etc.
  field_name TEXT, -- Which field was changed
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- KANBAN / TASKS
-- =============================================

-- Task Boards
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_shared BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board Columns
CREATE TABLE IF NOT EXISTS board_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6B7280',
  wip_limit INTEGER, -- Work in progress limit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES board_columns(id) ON DELETE RESTRICT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL, -- Optional ticket link
  
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  position INTEGER NOT NULL DEFAULT 0,
  
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Dependencies
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Checklists
CREATE TABLE IF NOT EXISTS task_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Checklist',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Items
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ASSETS / CMDB
-- =============================================

-- Asset Types (Computer, Server, Printer, etc.)
CREATE TABLE IF NOT EXISTS asset_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Fields per Asset Type
CREATE TABLE IF NOT EXISTS asset_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean', 'url')),
  options JSONB, -- For select fields
  is_required BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type_id UUID NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  asset_tag TEXT UNIQUE, -- Internal ID like "PC-001"
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  
  purchase_date DATE,
  warranty_until DATE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Field Values for Assets
CREATE TABLE IF NOT EXISTS asset_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES asset_fields(id) ON DELETE CASCADE,
  value TEXT,
  UNIQUE(asset_id, field_id)
);

-- =============================================
-- TIME TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  is_billable BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2),
  
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- For invoicing
  is_invoiced BOOLEAN DEFAULT false,
  invoice_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUTOMATION
-- =============================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_breach', 'scheduled', 'task_due')),
  trigger_conditions JSONB, -- Conditions that must match
  
  -- Action configuration
  action_type TEXT NOT NULL CHECK (action_type IN ('assign', 'change_status', 'change_priority', 'add_tag', 'send_notification', 'create_task', 'escalate')),
  action_config JSONB, -- Action parameters
  
  -- Scheduling (for scheduled triggers)
  schedule_cron TEXT,
  last_run_at TIMESTAMPTZ,
  
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Log
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  message TEXT,
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (will be refined later)
CREATE POLICY "Allow all" ON roles FOR ALL USING (true);
CREATE POLICY "Allow all" ON permissions FOR ALL USING (true);
CREATE POLICY "Allow all" ON role_permissions FOR ALL USING (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true);
CREATE POLICY "Allow all" ON user_roles FOR ALL USING (true);
CREATE POLICY "Allow all" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow all" ON locations FOR ALL USING (true);
CREATE POLICY "Allow all" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all" ON sla_profiles FOR ALL USING (true);
CREATE POLICY "Allow all" ON contracts FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_tags FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_templates FOR ALL USING (true);
CREATE POLICY "Allow all" ON tickets FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_tag_relations FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_comments FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_attachments FOR ALL USING (true);
CREATE POLICY "Allow all" ON ticket_history FOR ALL USING (true);
CREATE POLICY "Allow all" ON boards FOR ALL USING (true);
CREATE POLICY "Allow all" ON board_columns FOR ALL USING (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all" ON task_checklists FOR ALL USING (true);
CREATE POLICY "Allow all" ON task_checklist_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON asset_types FOR ALL USING (true);
CREATE POLICY "Allow all" ON asset_fields FOR ALL USING (true);
CREATE POLICY "Allow all" ON assets FOR ALL USING (true);
CREATE POLICY "Allow all" ON asset_values FOR ALL USING (true);
CREATE POLICY "Allow all" ON time_entries FOR ALL USING (true);
CREATE POLICY "Allow all" ON automation_rules FOR ALL USING (true);
CREATE POLICY "Allow all" ON automation_logs FOR ALL USING (true);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_organization ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assets_organization ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON contacts(organization_id);

-- =============================================
-- INITIAL DATA
-- =============================================

-- Default Roles
INSERT INTO roles (name, display_name, description, is_system) VALUES
  ('admin', 'Administrator', 'Vollzugriff auf alle Funktionen', true),
  ('agent', 'Agent', 'Support-Mitarbeiter mit Ticket-Zugriff', true),
  ('technician', 'Techniker', 'Techniker mit Asset- und Ticket-Zugriff', true),
  ('accounting', 'Buchhaltung', 'Zugriff auf Zeiterfassung und Rechnungen', true),
  ('customer', 'Kunde', 'Eingeschränkter Zugriff über Kundenportal', true)
ON CONFLICT (name) DO NOTHING;

-- Default SLA Profile
INSERT INTO sla_profiles (name, description, response_time_minutes, resolution_time_minutes, business_hours_only, is_default) VALUES
  ('Standard', 'Standard-SLA für alle Kunden', 240, 1440, true, true),
  ('Premium', 'Premium-SLA mit schnellerer Reaktion', 60, 480, true, false),
  ('Enterprise', '24/7 Enterprise-Support', 30, 240, false, false)
ON CONFLICT DO NOTHING;

-- Default Ticket Tags
INSERT INTO ticket_tags (name, color) VALUES
  ('Dringend', '#EF4444'),
  ('Wartung', '#F59E0B'),
  ('Netzwerk', '#3B82F6'),
  ('Hardware', '#10B981'),
  ('Software', '#8B5CF6'),
  ('Sicherheit', '#EC4899')
ON CONFLICT (name) DO NOTHING;

-- Default Asset Types
INSERT INTO asset_types (name, icon, description) VALUES
  ('Computer', 'monitor', 'Desktop-Computer und Workstations'),
  ('Laptop', 'laptop', 'Notebooks und Laptops'),
  ('Server', 'server', 'Server und virtuelle Maschinen'),
  ('Drucker', 'printer', 'Drucker und Multifunktionsgeräte'),
  ('Netzwerk', 'network', 'Router, Switches, Access Points'),
  ('Telefon', 'phone', 'Telefone und Kommunikationsgeräte'),
  ('Monitor', 'monitor', 'Bildschirme und Displays'),
  ('Sonstiges', 'box', 'Sonstige IT-Geräte')
ON CONFLICT (name) DO NOTHING;

-- Default Permissions
INSERT INTO permissions (name, module, description) VALUES
  ('tickets.view', 'tickets', 'Tickets anzeigen'),
  ('tickets.create', 'tickets', 'Tickets erstellen'),
  ('tickets.edit', 'tickets', 'Tickets bearbeiten'),
  ('tickets.delete', 'tickets', 'Tickets löschen'),
  ('tickets.assign', 'tickets', 'Tickets zuweisen'),
  ('organizations.view', 'organizations', 'Organisationen anzeigen'),
  ('organizations.manage', 'organizations', 'Organisationen verwalten'),
  ('assets.view', 'assets', 'Assets anzeigen'),
  ('assets.manage', 'assets', 'Assets verwalten'),
  ('time.view', 'time', 'Zeiterfassung anzeigen'),
  ('time.manage', 'time', 'Zeiterfassung verwalten'),
  ('reports.view', 'reports', 'Berichte anzeigen'),
  ('admin.users', 'admin', 'Benutzer verwalten'),
  ('admin.settings', 'admin', 'Einstellungen verwalten')
ON CONFLICT (name) DO NOTHING;
`;

export default SCHEMA_SQL;
