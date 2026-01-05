-- ===============================================
-- FINAL COMPLETION - Additional Schema Updates
-- M365 OAuth, Audit Logging, User Fields
-- ===============================================

-- A) USER TABLE EXTENSIONS FOR M365 OAUTH
ALTER TABLE users ADD COLUMN IF NOT EXISTS azure_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'assigned';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_azure_id ON users(azure_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider);

-- B) CONTACTS TABLE EXTENSIONS
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS azure_id TEXT;

-- C) M365 CONNECTIONS - ADD connection_type
ALTER TABLE m365_connections ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'user';

-- D) EXTEND TICKET_HISTORY FOR FULL AUDIT LOG
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS field_name TEXT;

-- E) ORGANIZATION DOMAIN MAPPING
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

-- F) DEFAULT SETTINGS FOR M365 OAUTH
INSERT INTO settings (key, value, category, description)
VALUES 
  ('m365_client_id', '', 'integrations', 'Microsoft 365 Application (Client) ID'),
  ('m365_client_secret', '', 'integrations', 'Microsoft 365 Client Secret (encrypted)'),
  ('m365_tenant_id', '', 'integrations', 'Microsoft 365 Tenant ID (optional, use "common" for multi-tenant)'),
  ('m365_oauth_enabled', 'false', 'integrations', 'Enable Microsoft 365 OAuth for customer login')
ON CONFLICT (key) DO NOTHING;

-- G) PERMISSIONS
GRANT ALL ON users TO authenticated, anon, service_role;
GRANT ALL ON contacts TO authenticated, anon, service_role;
GRANT ALL ON organizations TO authenticated, anon, service_role;
GRANT ALL ON m365_connections TO authenticated, anon, service_role;
GRANT ALL ON ticket_history TO authenticated, anon, service_role;

-- Verify RLS policies exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
