-- ===============================================
-- WIKI / KNOWLEDGE BASE & CUSTOM FIELDS SYSTEM
-- Complete Schema for Production-Ready ITSM
-- ===============================================

-- ============================================
-- PART A: WIKI / KNOWLEDGE BASE
-- ============================================

-- Wiki Spaces (Global + Per-Organization)
CREATE TABLE IF NOT EXISTS wiki_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  space_type TEXT NOT NULL DEFAULT 'global', -- 'global', 'organization'
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, space_type) -- Only one org wiki per org
);

CREATE INDEX IF NOT EXISTS idx_wiki_spaces_org ON wiki_spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_wiki_spaces_type ON wiki_spaces(space_type);

-- Wiki Categories (for organizing pages)
CREATE TABLE IF NOT EXISTS wiki_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES wiki_spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES wiki_categories(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_categories_space ON wiki_categories(space_id);
CREATE INDEX IF NOT EXISTS idx_wiki_categories_parent ON wiki_categories(parent_id);

-- Wiki Pages
CREATE TABLE IF NOT EXISTS wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES wiki_spaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES wiki_categories(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES wiki_pages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT, -- Markdown or HTML content
  content_format TEXT DEFAULT 'markdown', -- 'markdown', 'html', 'richtext'
  excerpt TEXT, -- Short summary
  meta_description TEXT,
  meta_keywords TEXT[],
  tags TEXT[] DEFAULT '{}',
  icon TEXT,
  cover_image TEXT,
  position INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
  visibility TEXT DEFAULT 'all', -- 'all', 'internal', 'customers', 'agents'
  is_featured BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_yes INTEGER DEFAULT 0,
  helpful_no INTEGER DEFAULT 0,
  current_version INTEGER DEFAULT 1,
  locked_by_id UUID REFERENCES users(id),
  locked_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by_id UUID REFERENCES users(id),
  updated_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_space ON wiki_pages(space_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_category ON wiki_pages(category_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_parent ON wiki_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_status ON wiki_pages(status);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_tags ON wiki_pages USING GIN(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_wiki_pages_search ON wiki_pages 
  USING GIN(to_tsvector('german', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(excerpt, '')));

-- Wiki Page Versions (for history/rollback)
CREATE TABLE IF NOT EXISTS wiki_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_format TEXT,
  change_summary TEXT,
  changed_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_wiki_versions_page ON wiki_page_versions(page_id);

-- Wiki Attachments
CREATE TABLE IF NOT EXISTS wiki_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  storage_url TEXT,
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_attachments_page ON wiki_attachments(page_id);

-- Wiki Page Links (for internal linking)
CREATE TABLE IF NOT EXISTS wiki_page_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  target_page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  link_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_page_id, target_page_id)
);

-- Wiki Permissions (role-based + custom)
CREATE TABLE IF NOT EXISTS wiki_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES wiki_spaces(id) ON DELETE CASCADE,
  page_id UUID REFERENCES wiki_pages(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  can_read BOOLEAN DEFAULT true,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_publish BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (space_id IS NOT NULL OR page_id IS NOT NULL),
  CHECK (role_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wiki_perms_space ON wiki_permissions(space_id);
CREATE INDEX IF NOT EXISTS idx_wiki_perms_page ON wiki_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_wiki_perms_role ON wiki_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_wiki_perms_user ON wiki_permissions(user_id);

-- Wiki-Ticket Links
CREATE TABLE IF NOT EXISTS wiki_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  linked_by_id UUID REFERENCES users(id),
  link_type TEXT DEFAULT 'reference', -- 'reference', 'solution'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, ticket_id)
);

-- ============================================
-- PART B: CUSTOM FIELDS & FORM CONFIGURATION
-- ============================================

-- Custom Field Definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Internal name (snake_case)
  label TEXT NOT NULL, -- Display label
  description TEXT,
  entity_type TEXT NOT NULL, -- 'ticket', 'organization', 'contact', 'asset', 'task', 'wiki', 'time_entry'
  field_type TEXT NOT NULL, -- 'text', 'textarea', 'number', 'decimal', 'boolean', 'select', 'multiselect', 'date', 'datetime', 'email', 'phone', 'url', 'user_ref', 'org_ref', 'ticket_ref', 'file', 'json'
  field_options JSONB DEFAULT '{}', -- For select/multiselect: {"options": [{"value": "x", "label": "X"}]}
  default_value TEXT,
  placeholder TEXT,
  validation_rules JSONB DEFAULT '{}', -- {"required": true, "min": 0, "max": 100, "regex": "...", "min_length": 0, "max_length": 255}
  visibility TEXT DEFAULT 'all', -- 'all', 'internal', 'customers', 'hidden'
  editable_by TEXT[] DEFAULT ARRAY['admin', 'agent'], -- Roles that can edit
  scope TEXT DEFAULT 'global', -- 'global', 'organization'
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- For org-specific fields
  position INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false, -- System fields cannot be deleted
  is_active BOOLEAN DEFAULT true,
  show_in_list BOOLEAN DEFAULT false, -- Show in list views
  show_in_filter BOOLEAN DEFAULT false, -- Available as filter
  searchable BOOLEAN DEFAULT false, -- Include in search
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_field_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_field_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_field_definitions(is_active);

-- Custom Field Values (EAV Pattern)
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  value_text TEXT,
  value_number DECIMAL,
  value_boolean BOOLEAN,
  value_date DATE,
  value_datetime TIMESTAMPTZ,
  value_json JSONB,
  value_array TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_values_field ON custom_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_entity ON custom_field_values(entity_type, entity_id);

-- Form Definitions
CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  form_type TEXT NOT NULL, -- 'ticket_create', 'ticket_edit', 'ticket_close', 'org_profile', 'contact_profile', 'asset_form', 'onboarding', 'offboarding'
  entity_type TEXT NOT NULL, -- 'ticket', 'organization', 'contact', 'asset'
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global form
  ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE CASCADE, -- Form per ticket type
  layout JSONB NOT NULL DEFAULT '{}', -- {"sections": [{"title": "...", "fields": ["field_id", ...]}]}
  conditions JSONB DEFAULT '{}', -- Conditional visibility rules
  settings JSONB DEFAULT '{}', -- {"submit_button_text": "Speichern", ...}
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_type ON form_definitions(form_type);
CREATE INDEX IF NOT EXISTS idx_forms_entity ON form_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_forms_org ON form_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_forms_ticket_type ON form_definitions(ticket_type_id);

-- Form Sections
CREATE TABLE IF NOT EXISTS form_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  position INTEGER DEFAULT 0,
  is_collapsible BOOLEAN DEFAULT false,
  is_collapsed_default BOOLEAN DEFAULT false,
  visibility_condition JSONB, -- {"field": "priority", "operator": "equals", "value": "critical"}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_sections_form ON form_sections(form_id);

-- Form Fields (linking fields to forms with additional config)
CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  section_id UUID REFERENCES form_sections(id) ON DELETE SET NULL,
  field_id UUID REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  system_field TEXT, -- For built-in fields like 'subject', 'description', 'priority'
  position INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false, -- Override for this form
  is_readonly BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  visibility_condition JSONB, -- Conditional display
  custom_label TEXT, -- Override label for this form
  custom_placeholder TEXT,
  custom_help_text TEXT,
  width TEXT DEFAULT 'full', -- 'full', 'half', 'third'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (field_id IS NOT NULL OR system_field IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON form_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_field ON form_fields(field_id);

-- Field Change History (Audit)
CREATE TABLE IF NOT EXISTS field_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID REFERENCES custom_field_definitions(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by_id UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_field_history_entity ON field_change_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_field_history_field ON field_change_history(field_id);
CREATE INDEX IF NOT EXISTS idx_field_history_changed ON field_change_history(changed_at);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Create Global Wiki Space
INSERT INTO wiki_spaces (id, name, slug, description, space_type, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Wissensdatenbank',
  'global',
  'Öffentliche Wissensdatenbank für alle Benutzer',
  'global',
  true
) ON CONFLICT (slug) DO NOTHING;

-- Create Default Wiki Categories
INSERT INTO wiki_categories (space_id, name, slug, position) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Allgemein', 'allgemein', 0),
  ('00000000-0000-0000-0000-000000000001', 'FAQ', 'faq', 1),
  ('00000000-0000-0000-0000-000000000001', 'Anleitungen', 'anleitungen', 2),
  ('00000000-0000-0000-0000-000000000001', 'Support', 'support', 3)
ON CONFLICT (space_id, slug) DO NOTHING;

-- Create Default System Fields for Tickets
INSERT INTO custom_field_definitions (name, label, entity_type, field_type, is_system, position, visibility, show_in_list, show_in_filter) VALUES
  ('contract_number', 'Vertragsnummer', 'ticket', 'text', false, 10, 'all', true, true),
  ('affected_system', 'Betroffenes System', 'ticket', 'text', false, 11, 'internal', true, true),
  ('error_code', 'Fehlercode', 'ticket', 'text', false, 12, 'all', true, true),
  ('impact', 'Auswirkung', 'ticket', 'select', false, 13, 'internal', true, true),
  ('urgency', 'Dringlichkeit', 'ticket', 'select', false, 14, 'internal', true, true)
ON CONFLICT (entity_type, name, organization_id) DO NOTHING;

-- Update impact field options
UPDATE custom_field_definitions SET field_options = '{"options": [{"value": "low", "label": "Gering"}, {"value": "medium", "label": "Mittel"}, {"value": "high", "label": "Hoch"}, {"value": "critical", "label": "Kritisch"}]}'
WHERE name = 'impact' AND entity_type = 'ticket';

UPDATE custom_field_definitions SET field_options = '{"options": [{"value": "low", "label": "Niedrig"}, {"value": "medium", "label": "Mittel"}, {"value": "high", "label": "Hoch"}, {"value": "critical", "label": "Kritisch"}]}'
WHERE name = 'urgency' AND entity_type = 'ticket';

-- Create Default Ticket Form
INSERT INTO form_definitions (id, name, form_type, entity_type, is_default, is_active, layout)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Standard Ticket-Formular',
  'ticket_create',
  'ticket',
  true,
  true,
  '{
    "sections": [
      {
        "id": "basic",
        "title": "Grundinformationen",
        "fields": ["subject", "description", "priority", "ticket_type_code"]
      },
      {
        "id": "assignment",
        "title": "Zuweisung",
        "fields": ["organization_id", "contact_id", "assigned_to_id"]
      },
      {
        "id": "custom",
        "title": "Zusätzliche Informationen",
        "fields": []
      }
    ]
  }'
) ON CONFLICT DO NOTHING;

-- ============================================
-- PERMISSIONS
-- ============================================

GRANT ALL ON wiki_spaces TO authenticated, anon, service_role;
GRANT ALL ON wiki_categories TO authenticated, anon, service_role;
GRANT ALL ON wiki_pages TO authenticated, anon, service_role;
GRANT ALL ON wiki_page_versions TO authenticated, anon, service_role;
GRANT ALL ON wiki_attachments TO authenticated, anon, service_role;
GRANT ALL ON wiki_page_links TO authenticated, anon, service_role;
GRANT ALL ON wiki_permissions TO authenticated, anon, service_role;
GRANT ALL ON wiki_ticket_links TO authenticated, anon, service_role;
GRANT ALL ON custom_field_definitions TO authenticated, anon, service_role;
GRANT ALL ON custom_field_values TO authenticated, anon, service_role;
GRANT ALL ON form_definitions TO authenticated, anon, service_role;
GRANT ALL ON form_sections TO authenticated, anon, service_role;
GRANT ALL ON form_fields TO authenticated, anon, service_role;
GRANT ALL ON field_change_history TO authenticated, anon, service_role;

-- RLS Policies
ALTER TABLE wiki_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON wiki_spaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON wiki_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON wiki_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON wiki_page_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON wiki_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON wiki_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON custom_field_definitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON custom_field_values FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON form_definitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON form_sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON form_fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON field_change_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Wiki & Custom Fields Schema created successfully!';
  RAISE NOTICE 'Wiki Tables: wiki_spaces, wiki_categories, wiki_pages, wiki_page_versions, wiki_attachments, wiki_permissions, wiki_ticket_links';
  RAISE NOTICE 'Custom Fields Tables: custom_field_definitions, custom_field_values, form_definitions, form_sections, form_fields, field_change_history';
END $$;
