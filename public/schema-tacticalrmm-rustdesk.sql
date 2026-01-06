-- ============================================
-- TACTICALRMM + RUSTDESK INTEGRATION SCHEMA
-- IT REX Solutions - Enterprise RMM Platform
-- Replaces: Atera.com, NinjaOne.com
-- ============================================

-- ============================================
-- 1. TACTICALRMM CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_url VARCHAR(500) NOT NULL, -- https://api.yourdomain.com
  api_key VARCHAR(255) NOT NULL, -- Encrypted
  api_key_user_id VARCHAR(100), -- TRMM user ID bound to key
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Sync settings
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_interval_minutes INTEGER DEFAULT 15,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50),
  last_sync_error TEXT,
  
  -- Mappings
  default_organization_id UUID REFERENCES organizations(id),
  auto_create_organizations BOOLEAN DEFAULT FALSE,
  auto_create_tickets BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TACTICALRMM CLIENTS (Organizations mapping)
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  trmm_client_id INTEGER NOT NULL, -- TacticalRMM client ID
  trmm_client_name VARCHAR(255),
  
  -- CRM mapping
  organization_id UUID REFERENCES organizations(id),
  
  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, trmm_client_id)
);

CREATE INDEX IF NOT EXISTS idx_trmm_clients_org ON tacticalrmm_clients(organization_id);

-- ============================================
-- 3. TACTICALRMM SITES (Locations mapping)
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES tacticalrmm_clients(id) ON DELETE CASCADE,
  trmm_site_id INTEGER NOT NULL,
  trmm_site_name VARCHAR(255),
  
  -- CRM mapping
  location_id UUID REFERENCES locations(id),
  
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, trmm_site_id)
);

-- ============================================
-- 4. TACTICALRMM AGENTS (Device mapping)
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  
  -- TacticalRMM identifiers
  trmm_agent_id VARCHAR(100) NOT NULL, -- Agent UUID in TRMM
  trmm_client_id INTEGER,
  trmm_site_id INTEGER,
  
  -- CRM mapping
  asset_id UUID REFERENCES assets(id),
  organization_id UUID REFERENCES organizations(id),
  location_id UUID REFERENCES locations(id),
  
  -- Agent info from TRMM
  hostname VARCHAR(255),
  description TEXT,
  plat VARCHAR(50), -- windows, linux, darwin
  plat_release VARCHAR(100),
  version VARCHAR(50), -- Agent version
  
  -- Status
  status VARCHAR(20) DEFAULT 'offline', -- online, offline, overdue
  last_seen TIMESTAMPTZ,
  boot_time TIMESTAMPTZ,
  public_ip VARCHAR(50),
  local_ips TEXT[],
  
  -- Hardware
  cpu_model VARCHAR(255),
  total_ram DECIMAL(10,2), -- GB
  disks JSONB DEFAULT '[]',
  graphics VARCHAR(255),
  
  -- Monitoring
  checks_passing INTEGER DEFAULT 0,
  checks_failing INTEGER DEFAULT 0,
  has_patches_pending BOOLEAN DEFAULT FALSE,
  pending_actions_count INTEGER DEFAULT 0,
  
  -- Maintenance
  maintenance_mode BOOLEAN DEFAULT FALSE,
  block_policy_inheritance BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  needs_reboot BOOLEAN DEFAULT FALSE,
  logged_user VARCHAR(255),
  wmi_detail JSONB DEFAULT '{}',
  
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(instance_id, trmm_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_trmm_agents_asset ON tacticalrmm_agents(asset_id);
CREATE INDEX IF NOT EXISTS idx_trmm_agents_org ON tacticalrmm_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_trmm_agents_status ON tacticalrmm_agents(status);
CREATE INDEX IF NOT EXISTS idx_trmm_agents_hostname ON tacticalrmm_agents(hostname);

-- ============================================
-- 5. TACTICALRMM ALERTS (Alert mapping)
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  agent_mapping_id UUID REFERENCES tacticalrmm_agents(id) ON DELETE SET NULL,
  
  -- TRMM alert info
  trmm_alert_id INTEGER NOT NULL,
  trmm_agent_id VARCHAR(100),
  alert_type VARCHAR(50), -- check, task, availability, custom
  severity VARCHAR(20), -- error, warning, info
  message TEXT,
  alert_time TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_time TIMESTAMPTZ,
  
  -- Check details (if check alert)
  assigned_check JSONB,
  
  -- CRM mapping
  device_alert_id UUID REFERENCES device_alerts(id),
  ticket_id UUID REFERENCES tickets(id),
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  auto_ticket_created BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, trmm_alert_id)
);

CREATE INDEX IF NOT EXISTS idx_trmm_alerts_ticket ON tacticalrmm_alerts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_trmm_alerts_resolved ON tacticalrmm_alerts(resolved);

-- ============================================
-- 6. RUSTDESK CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS rustdesk_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  
  -- Server endpoints
  id_server VARCHAR(500) NOT NULL, -- hbbs server (e.g., rustdesk.yourdomain.com)
  relay_server VARCHAR(500), -- hbbr server (optional, defaults to id_server)
  api_server VARCHAR(500), -- Pro API server (port 21114)
  public_key TEXT, -- Server public key for encryption
  
  -- Authentication (Pro only)
  api_key VARCHAR(255),
  is_pro BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  last_health_check TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. RUSTDESK PEERS (Device remote IDs)
-- ============================================

CREATE TABLE IF NOT EXISTS rustdesk_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES rustdesk_servers(id) ON DELETE CASCADE,
  
  -- RustDesk identifiers
  peer_id VARCHAR(50) NOT NULL, -- The 9-digit ID shown in RustDesk
  alias VARCHAR(255),
  username VARCHAR(255),
  hostname VARCHAR(255),
  platform VARCHAR(50),
  tags TEXT[] DEFAULT '{}',
  
  -- CRM mapping
  asset_id UUID REFERENCES assets(id),
  trmm_agent_id UUID REFERENCES tacticalrmm_agents(id),
  organization_id UUID REFERENCES organizations(id),
  
  -- Access control
  password_hash TEXT, -- Encrypted password if stored
  one_time_password VARCHAR(50),
  one_time_password_expires TIMESTAMPTZ,
  
  -- Status
  online BOOLEAN DEFAULT FALSE,
  last_online TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(server_id, peer_id)
);

CREATE INDEX IF NOT EXISTS idx_rustdesk_peers_asset ON rustdesk_peers(asset_id);
CREATE INDEX IF NOT EXISTS idx_rustdesk_peers_org ON rustdesk_peers(organization_id);

-- ============================================
-- 8. ENHANCED REMOTE SESSIONS
-- ============================================

-- Update remote_sessions to support RustDesk and TRMM
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS remote_tool_type VARCHAR(50) DEFAULT 'rustdesk';
-- Types: rustdesk, tacticalrmm_takeover, tacticalrmm_meshcentral, rdp, vnc, ssh

ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS rustdesk_peer_id UUID REFERENCES rustdesk_peers(id);
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS trmm_agent_id UUID REFERENCES tacticalrmm_agents(id);
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100); -- Session ID from tool
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS initiated_from VARCHAR(50) DEFAULT 'crm'; -- crm, trmm, direct
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS quality_metrics JSONB DEFAULT '{}'; -- fps, latency, bandwidth

-- ============================================
-- 9. TACTICALRMM SCRIPTS SYNC
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  
  trmm_script_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filename VARCHAR(255),
  shell VARCHAR(20), -- powershell, cmd, python, bash
  script_type VARCHAR(50), -- userdefined, builtin
  
  -- Script content (optional cache)
  script_body TEXT,
  args TEXT[] DEFAULT '{}',
  default_timeout INTEGER DEFAULT 120,
  run_as_user BOOLEAN DEFAULT FALSE,
  
  -- Sync
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, trmm_script_id)
);

-- ============================================
-- 10. TACTICALRMM TASKS/JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
  agent_mapping_id UUID REFERENCES tacticalrmm_agents(id),
  
  -- Task info
  trmm_task_id INTEGER,
  task_type VARCHAR(50), -- script, command, patch
  name VARCHAR(255),
  
  -- Script details
  script_id UUID REFERENCES tacticalrmm_scripts(id),
  trmm_script_id INTEGER,
  script_args TEXT[] DEFAULT '{}',
  
  -- Execution
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, timeout
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_seconds INTEGER DEFAULT 300,
  
  -- Results
  retcode INTEGER,
  stdout TEXT,
  stderr TEXT,
  execution_time DECIMAL(10,3), -- seconds
  
  -- CRM integration
  triggered_by_alert_id UUID REFERENCES tacticalrmm_alerts(id),
  triggered_by_ticket_id UUID REFERENCES tickets(id),
  triggered_by_user_id UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trmm_tasks_agent ON tacticalrmm_tasks(agent_mapping_id);
CREATE INDEX IF NOT EXISTS idx_trmm_tasks_status ON tacticalrmm_tasks(status);

-- ============================================
-- 11. SYNC LOG / AUDIT
-- ============================================

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type VARCHAR(50) NOT NULL, -- tacticalrmm, rustdesk
  instance_id UUID,
  
  sync_type VARCHAR(50), -- full, incremental, agents, alerts, inventory
  status VARCHAR(20) NOT NULL, -- started, completed, failed
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Stats
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  
  error_message TEXT,
  details JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON integration_sync_logs(integration_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON integration_sync_logs(created_at DESC);

-- ============================================
-- 12. PATCH MANAGEMENT (TRMM sync)
-- ============================================

CREATE TABLE IF NOT EXISTS tacticalrmm_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_mapping_id UUID NOT NULL REFERENCES tacticalrmm_agents(id) ON DELETE CASCADE,
  
  -- Patch info from TRMM
  kb VARCHAR(50),
  title VARCHAR(500),
  description TEXT,
  severity VARCHAR(20), -- critical, important, moderate, low
  categories TEXT[],
  
  -- Status
  installed BOOLEAN DEFAULT FALSE,
  action VARCHAR(20), -- nothing, approve, ignore
  
  -- Timestamps
  release_date DATE,
  installed_date DATE,
  
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trmm_patches_agent ON tacticalrmm_patches(agent_mapping_id);
CREATE INDEX IF NOT EXISTS idx_trmm_patches_kb ON tacticalrmm_patches(kb);

-- ============================================
-- 13. SETTINGS FOR INTEGRATIONS
-- ============================================

INSERT INTO settings (key, value, category, description) VALUES
  -- TacticalRMM
  ('tacticalrmm_enabled', 'false', 'integrations', 'TacticalRMM Integration aktivieren'),
  ('tacticalrmm_api_url', '""', 'integrations', 'TacticalRMM API URL'),
  ('tacticalrmm_api_key', '""', 'integrations', 'TacticalRMM API Key (verschlüsselt)'),
  ('tacticalrmm_sync_interval', '15', 'integrations', 'Sync-Intervall in Minuten'),
  ('tacticalrmm_auto_ticket', 'true', 'integrations', 'Automatisch Tickets aus Alerts erstellen'),
  ('tacticalrmm_auto_map_devices', 'true', 'integrations', 'Geräte automatisch zu Assets zuordnen'),
  
  -- RustDesk
  ('rustdesk_enabled', 'false', 'integrations', 'RustDesk Integration aktivieren'),
  ('rustdesk_id_server', '""', 'integrations', 'RustDesk ID Server (hbbs)'),
  ('rustdesk_relay_server', '""', 'integrations', 'RustDesk Relay Server (hbbr)'),
  ('rustdesk_public_key', '""', 'integrations', 'RustDesk Server Public Key'),
  ('rustdesk_is_pro', 'false', 'integrations', 'RustDesk Pro Server'),
  ('rustdesk_api_server', '""', 'integrations', 'RustDesk Pro API Server')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 14. AUTO-SYNC TRIGGER (Status updates)
-- ============================================

CREATE OR REPLACE FUNCTION update_asset_from_trmm_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Update linked asset when TRMM agent status changes
  IF NEW.asset_id IS NOT NULL THEN
    UPDATE assets SET
      agent_status = NEW.status,
      last_seen = NEW.last_seen,
      hostname = COALESCE(NEW.hostname, assets.hostname),
      os_type = CASE 
        WHEN NEW.plat = 'windows' THEN 'windows'
        WHEN NEW.plat = 'linux' THEN 'linux'
        WHEN NEW.plat = 'darwin' THEN 'macos'
        ELSE assets.os_type
      END,
      os_version = COALESCE(NEW.plat_release, assets.os_version),
      public_ip = COALESCE(NEW.public_ip, assets.public_ip),
      cpu_model = COALESCE(NEW.cpu_model, assets.cpu_model),
      ram_total_gb = COALESCE(NEW.total_ram, assets.ram_total_gb),
      maintenance_mode = COALESCE(NEW.maintenance_mode, assets.maintenance_mode),
      updated_at = NOW()
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trmm_agent_update ON tacticalrmm_agents;
CREATE TRIGGER trigger_trmm_agent_update
  AFTER INSERT OR UPDATE ON tacticalrmm_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_from_trmm_agent();

-- ============================================
-- 15. AUTO-CREATE TICKET FROM ALERT
-- ============================================

CREATE OR REPLACE FUNCTION create_ticket_from_trmm_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_asset_id UUID;
  v_ticket_id UUID;
  v_hostname VARCHAR(255);
BEGIN
  -- Only process if not resolved and auto-ticket enabled
  IF NOT NEW.resolved AND NOT NEW.auto_ticket_created THEN
    -- Get organization and asset from agent
    SELECT ta.organization_id, ta.asset_id, ta.hostname
    INTO v_org_id, v_asset_id, v_hostname
    FROM tacticalrmm_agents ta
    WHERE ta.id = NEW.agent_mapping_id;
    
    IF v_org_id IS NOT NULL THEN
      -- Create ticket
      v_ticket_id := gen_random_uuid();
      
      INSERT INTO tickets (
        id, subject, description, status, priority, source,
        organization_id, created_at
      ) VALUES (
        v_ticket_id,
        '[TRMM Alert] ' || COALESCE(v_hostname, 'Unbekannt') || ': ' || NEW.alert_type,
        'Automatisch erstelltes Ticket aus TacticalRMM Alert\n\n' ||
        'Typ: ' || NEW.alert_type || E'\n' ||
        'Schweregrad: ' || NEW.severity || E'\n' ||
        'Meldung: ' || COALESCE(NEW.message, 'Keine Details') || E'\n' ||
        'Zeit: ' || NEW.alert_time::TEXT,
        'open',
        CASE 
          WHEN NEW.severity = 'error' THEN 'high'
          WHEN NEW.severity = 'warning' THEN 'medium'
          ELSE 'low'
        END,
        'monitoring',
        v_org_id,
        NOW()
      );
      
      -- Update alert with ticket reference
      NEW.ticket_id := v_ticket_id;
      NEW.auto_ticket_created := TRUE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trmm_alert_ticket ON tacticalrmm_alerts;
CREATE TRIGGER trigger_trmm_alert_ticket
  BEFORE INSERT ON tacticalrmm_alerts
  FOR EACH ROW
  EXECUTE FUNCTION create_ticket_from_trmm_alert();

COMMIT;
