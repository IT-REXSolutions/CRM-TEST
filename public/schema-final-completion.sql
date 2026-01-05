-- ===============================================
-- FINAL COMPLETION - Full Schema Updates
-- 2FA, Admin Functions, M365 OAuth, Ticket Features
-- ===============================================

-- ============================================
-- A) USER TABLE EXTENSIONS
-- ============================================

-- 2FA / MFA Support
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];

-- Admin User Management
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

-- M365 OAuth Support
ALTER TABLE users ADD COLUMN IF NOT EXISTS azure_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'assigned';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_azure_id ON users(azure_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_users_totp ON users(totp_enabled);

-- ============================================
-- B) TICKET EXTENSIONS (Merge, Split, Dependencies)
-- ============================================

-- Merge/Split tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES tickets(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS split_from_id UUID REFERENCES tickets(id);

-- Dependencies table
CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'blocks',
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_deps_ticket ON ticket_dependencies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_deps_depends ON ticket_dependencies(depends_on_id);

-- ============================================
-- C) CONTACTS TABLE EXTENSIONS
-- ============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS azure_id TEXT;

-- ============================================
-- D) M365 CONNECTIONS
-- ============================================
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'user';

-- ============================================
-- E) TICKET HISTORY / AUDIT LOG EXTENSIONS
-- ============================================
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS field_name TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Allow null ticket_id for non-ticket audit entries (2FA, admin actions)
ALTER TABLE ticket_history ALTER COLUMN ticket_id DROP NOT NULL;

-- ============================================
-- F) ORGANIZATION DOMAIN MAPPING
-- ============================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain TEXT;
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

-- ============================================
-- G) DEFAULT SETTINGS FOR M365 OAUTH
-- ============================================
INSERT INTO settings (key, value, category, description)
VALUES 
  ('m365_client_id', '', 'integrations', 'Microsoft 365 Application (Client) ID'),
  ('m365_client_secret', '', 'integrations', 'Microsoft 365 Client Secret (encrypted)'),
  ('m365_tenant_id', '', 'integrations', 'Microsoft 365 Tenant ID (optional, use "common" for multi-tenant)'),
  ('m365_oauth_enabled', 'false', 'integrations', 'Enable Microsoft 365 OAuth for customer login'),
  ('allow_email_registration', 'true', 'auth', 'Allow email/password registration'),
  ('require_2fa', 'false', 'auth', 'Require 2FA for all users')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- H) TASK TABLE EXTENSIONS (for standalone tasks)
-- ============================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================
-- I) PERMISSIONS
-- ============================================
GRANT ALL ON users TO authenticated, anon, service_role;
GRANT ALL ON contacts TO authenticated, anon, service_role;
GRANT ALL ON organizations TO authenticated, anon, service_role;
GRANT ALL ON m365_connections TO authenticated, anon, service_role;
GRANT ALL ON ticket_history TO authenticated, anon, service_role;
GRANT ALL ON ticket_dependencies TO authenticated, anon, service_role;
GRANT ALL ON tasks TO authenticated, anon, service_role;

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ticket_dependencies' AND policyname = 'allow_all') THEN
    ALTER TABLE ticket_dependencies ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "allow_all" ON ticket_dependencies FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Schema update completed successfully!';
  RAISE NOTICE 'New columns added: totp_secret, totp_enabled, backup_codes, disabled_at, disabled_reason, force_password_change, merged_into_id, split_from_id';
  RAISE NOTICE 'New tables: ticket_dependencies';
END $$;
