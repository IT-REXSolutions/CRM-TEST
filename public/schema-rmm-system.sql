-- ============================================
-- RMM SYSTEM SCHEMA
-- IT REX Solutions - Complete RMM Platform
-- Replaces: Atera, NinjaOne, opsi
-- ============================================

-- ============================================
-- 1. DEVICES (RMM ASSETS) - Extends existing assets
-- ============================================

-- Add RMM-specific columns to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'workstation'; -- server, workstation, laptop, vm, mobile, network, other
ALTER TABLE assets ADD COLUMN IF NOT EXISTS agent_id VARCHAR(100); -- Unique agent identifier
ALTER TABLE assets ADD COLUMN IF NOT EXISTS agent_version VARCHAR(20);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS agent_status VARCHAR(20) DEFAULT 'offline'; -- online, offline, maintenance, error
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS enrollment_token VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os_type VARCHAR(50); -- windows, linux, macos
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os_build VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hostname VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS public_ip VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cpu_model VARCHAR(200);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cpu_cores INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ram_total_gb DECIMAL(10,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disk_total_gb DECIMAL(10,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS disk_free_gb DECIMAL(10,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS remote_id VARCHAR(100); -- RustDesk/RAS-Desk ID
ALTER TABLE assets ADD COLUMN IF NOT EXISTS remote_password_hash TEXT; -- Encrypted remote password
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS alert_policies UUID[];
ALTER TABLE assets ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS maintenance_until TIMESTAMPTZ;

-- Indexes for device management
CREATE INDEX IF NOT EXISTS idx_assets_agent_id ON assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_assets_agent_status ON assets(agent_status);
CREATE INDEX IF NOT EXISTS idx_assets_last_seen ON assets(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_assets_device_type ON assets(device_type);
CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname);

-- ============================================
-- 2. AGENT ENROLLMENT TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS agent_enrollment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 0, -- 0 = unlimited
  current_uses INTEGER DEFAULT 0,
  device_type VARCHAR(50) DEFAULT 'workstation',
  auto_tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_token ON agent_enrollment_tokens(token);
CREATE INDEX IF NOT EXISTS idx_enrollment_org ON agent_enrollment_tokens(organization_id);

-- ============================================
-- 3. DEVICE METRICS / HEARTBEAT DATA
-- ============================================

CREATE TABLE IF NOT EXISTS device_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  cpu_usage DECIMAL(5,2), -- Percentage
  ram_usage DECIMAL(5,2),
  ram_used_gb DECIMAL(10,2),
  disk_usage DECIMAL(5,2),
  disk_used_gb DECIMAL(10,2),
  network_in_bytes BIGINT,
  network_out_bytes BIGINT,
  uptime_seconds BIGINT,
  process_count INTEGER,
  logged_in_users TEXT[],
  services_running JSONB, -- List of monitored services and their status
  custom_metrics JSONB DEFAULT '{}'
);

-- Partition by time for better performance (manual partitioning hint)
CREATE INDEX IF NOT EXISTS idx_device_metrics_asset ON device_metrics(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_metrics_time ON device_metrics(timestamp DESC);

-- ============================================
-- 4. MONITORING POLICIES
-- ============================================

CREATE TABLE IF NOT EXISTS monitoring_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Thresholds
  cpu_warning_threshold INTEGER DEFAULT 80,
  cpu_critical_threshold INTEGER DEFAULT 95,
  ram_warning_threshold INTEGER DEFAULT 80,
  ram_critical_threshold INTEGER DEFAULT 95,
  disk_warning_threshold INTEGER DEFAULT 80,
  disk_critical_threshold INTEGER DEFAULT 95,
  
  -- Offline detection
  offline_warning_minutes INTEGER DEFAULT 10,
  offline_critical_minutes INTEGER DEFAULT 30,
  
  -- Custom checks
  services_to_monitor TEXT[] DEFAULT '{}',
  ports_to_check INTEGER[] DEFAULT '{}',
  custom_scripts JSONB DEFAULT '[]',
  
  -- Alert settings
  alert_channels TEXT[] DEFAULT ARRAY['ticket'], -- ticket, email, webhook
  alert_priority_warning VARCHAR(20) DEFAULT 'medium',
  alert_priority_critical VARCHAR(20) DEFAULT 'high',
  auto_create_ticket BOOLEAN DEFAULT TRUE,
  auto_remediation_enabled BOOLEAN DEFAULT FALSE,
  
  -- Schedules
  check_interval_minutes INTEGER DEFAULT 5,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_policies_org ON monitoring_policies(organization_id);

-- ============================================
-- 5. ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS device_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  policy_id UUID REFERENCES monitoring_policies(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  
  alert_type VARCHAR(50) NOT NULL, -- cpu, ram, disk, offline, service, custom
  severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- info, warning, critical
  title VARCHAR(500) NOT NULL,
  message TEXT,
  metric_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  
  status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved, auto_resolved
  acknowledged_by_id UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  auto_remediation_attempted BOOLEAN DEFAULT FALSE,
  auto_remediation_result TEXT,
  
  first_triggered_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ DEFAULT NOW(),
  trigger_count INTEGER DEFAULT 1,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_asset ON device_alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON device_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON device_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_ticket ON device_alerts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON device_alerts(created_at DESC);

-- ============================================
-- 6. REMOTE SESSIONS (RustDesk/RAS-Desk)
-- ============================================

CREATE TABLE IF NOT EXISTS remote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  
  session_type VARCHAR(50) DEFAULT 'remote_desktop', -- remote_desktop, file_transfer, terminal, view_only
  remote_tool VARCHAR(50) DEFAULT 'rustdesk', -- rustdesk, rdp, vnc, ssh
  remote_id VARCHAR(100), -- Remote access ID
  
  status VARCHAR(20) DEFAULT 'connecting', -- connecting, active, ended, failed
  started_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Time tracking integration
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  is_billable BOOLEAN DEFAULT TRUE,
  
  -- Session details
  client_ip VARCHAR(50),
  connection_quality VARCHAR(20), -- excellent, good, fair, poor
  bytes_transferred BIGINT DEFAULT 0,
  
  notes TEXT,
  recording_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_asset ON remote_sessions(asset_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_user ON remote_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_ticket ON remote_sessions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);

-- ============================================
-- 7. SOFTWARE CATALOG
-- ============================================

CREATE TABLE IF NOT EXISTS software_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  description TEXT,
  category VARCHAR(100), -- productivity, security, utility, development, system
  
  -- Package info
  current_version VARCHAR(50),
  package_type VARCHAR(50) DEFAULT 'msi', -- msi, exe, deb, rpm, script
  architecture VARCHAR(20) DEFAULT 'x64', -- x86, x64, arm64, any
  os_compatibility TEXT[] DEFAULT ARRAY['windows'],
  
  -- Installation commands
  install_command TEXT,
  install_args TEXT,
  silent_install_args TEXT,
  uninstall_command TEXT,
  uninstall_args TEXT,
  update_command TEXT,
  
  -- URLs
  download_url TEXT,
  documentation_url TEXT,
  icon_url TEXT,
  
  -- Verification
  expected_install_path TEXT,
  registry_key TEXT,
  process_name VARCHAR(100),
  
  -- Flags
  requires_reboot BOOLEAN DEFAULT FALSE,
  requires_admin BOOLEAN DEFAULT TRUE,
  is_managed BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Licensing
  license_type VARCHAR(50), -- free, commercial, subscription
  license_key_required BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_software_name ON software_catalog(name);
CREATE INDEX IF NOT EXISTS idx_software_category ON software_catalog(category);

-- ============================================
-- 8. SOFTWARE INVENTORY (Installed on devices)
-- ============================================

CREATE TABLE IF NOT EXISTS software_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  name VARCHAR(500) NOT NULL,
  version VARCHAR(100),
  vendor VARCHAR(255),
  install_date DATE,
  install_location TEXT,
  install_source VARCHAR(50), -- msi, exe, store, package_manager, manual
  
  size_mb INTEGER,
  is_system_component BOOLEAN DEFAULT FALSE,
  is_update BOOLEAN DEFAULT FALSE,
  
  catalog_id UUID REFERENCES software_catalog(id) ON DELETE SET NULL,
  is_managed BOOLEAN DEFAULT FALSE,
  
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_software_inv_asset ON software_inventory(asset_id);
CREATE INDEX IF NOT EXISTS idx_software_inv_name ON software_inventory(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_software_inv_unique ON software_inventory(asset_id, name, version) WHERE removed_at IS NULL;

-- ============================================
-- 9. DEPLOYMENT JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS deployment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id),
  
  job_type VARCHAR(50) NOT NULL, -- install, uninstall, update, script, patch
  software_id UUID REFERENCES software_catalog(id) ON DELETE SET NULL,
  
  -- Target devices
  target_type VARCHAR(50) DEFAULT 'devices', -- devices, groups, tags, organization
  target_device_ids UUID[] DEFAULT '{}',
  target_tags TEXT[] DEFAULT '{}',
  target_device_types TEXT[] DEFAULT '{}',
  
  -- Execution
  command TEXT,
  script_content TEXT,
  script_type VARCHAR(20), -- powershell, bash, python, batch
  parameters JSONB DEFAULT '{}',
  timeout_minutes INTEGER DEFAULT 30,
  
  -- Schedule
  schedule_type VARCHAR(50) DEFAULT 'immediate', -- immediate, scheduled, recurring
  scheduled_at TIMESTAMPTZ,
  recurring_cron VARCHAR(100),
  maintenance_window_only BOOLEAN DEFAULT FALSE,
  
  -- Execution settings
  run_as_system BOOLEAN DEFAULT TRUE,
  requires_reboot BOOLEAN DEFAULT FALSE,
  auto_retry BOOLEAN DEFAULT TRUE,
  max_retries INTEGER DEFAULT 3,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_jobs_status ON deployment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_deployment_jobs_org ON deployment_jobs(organization_id);

-- ============================================
-- 10. DEPLOYMENT JOB EXECUTIONS (per device)
-- ============================================

CREATE TABLE IF NOT EXISTS deployment_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES deployment_jobs(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, skipped
  exit_code INTEGER,
  output TEXT,
  error_output TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_exec_job ON deployment_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_deployment_exec_asset ON deployment_executions(asset_id);
CREATE INDEX IF NOT EXISTS idx_deployment_exec_status ON deployment_executions(status);

-- ============================================
-- 11. PATCH MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS patch_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Update settings
  auto_approve_critical BOOLEAN DEFAULT TRUE,
  auto_approve_security BOOLEAN DEFAULT TRUE,
  auto_approve_updates BOOLEAN DEFAULT FALSE,
  
  -- Categories
  include_categories TEXT[] DEFAULT ARRAY['Security', 'Critical', 'Updates'],
  exclude_kb_ids TEXT[] DEFAULT '{}',
  
  -- Schedule
  scan_schedule_cron VARCHAR(100) DEFAULT '0 3 * * *', -- Daily at 3 AM
  install_schedule_cron VARCHAR(100),
  maintenance_window_start TIME,
  maintenance_window_end TIME,
  maintenance_days INTEGER[] DEFAULT ARRAY[0, 6], -- Sunday, Saturday
  
  -- Reboot policy
  reboot_policy VARCHAR(50) DEFAULT 'schedule', -- never, immediate, schedule, user_choice
  reboot_delay_hours INTEGER DEFAULT 4,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  kb_id VARCHAR(50),
  title VARCHAR(500),
  description TEXT,
  category VARCHAR(100), -- Security, Critical, Updates, Drivers
  severity VARCHAR(20), -- Critical, Important, Moderate, Low
  
  release_date DATE,
  size_mb INTEGER,
  
  status VARCHAR(20) DEFAULT 'available', -- available, approved, downloading, installing, installed, failed, excluded
  installed_at TIMESTAMPTZ,
  
  policy_id UUID REFERENCES patch_policies(id),
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  error_message TEXT,
  requires_reboot BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patches_asset ON device_patches(asset_id);
CREATE INDEX IF NOT EXISTS idx_patches_status ON device_patches(status);
CREATE INDEX IF NOT EXISTS idx_patches_kb ON device_patches(kb_id);

-- ============================================
-- 12. HARDWARE INVENTORY
-- ============================================

CREATE TABLE IF NOT EXISTS hardware_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  component_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, gpu, network, motherboard, bios
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  serial_number VARCHAR(255),
  
  -- Specs (varies by type)
  capacity VARCHAR(50), -- RAM size, Disk size, etc.
  speed VARCHAR(50), -- Clock speed, RPM, etc.
  interface_type VARCHAR(50), -- SATA, NVMe, DDR4, PCIe, etc.
  
  details JSONB DEFAULT '{}', -- Additional component-specific details
  
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  changed_at TIMESTAMPTZ -- When specs changed
);

CREATE INDEX IF NOT EXISTS idx_hw_inventory_asset ON hardware_inventory(asset_id);
CREATE INDEX IF NOT EXISTS idx_hw_inventory_type ON hardware_inventory(component_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hw_inventory_unique ON hardware_inventory(asset_id, component_type, serial_number);

-- ============================================
-- 13. INVENTORY SNAPSHOTS (Change tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(50) NOT NULL, -- full, software, hardware, changes
  
  software_count INTEGER,
  hardware_count INTEGER,
  
  software_data JSONB,
  hardware_data JSONB,
  
  changes_since_last JSONB, -- { added: [], removed: [], modified: [] }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_asset ON inventory_snapshots(asset_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_created ON inventory_snapshots(created_at DESC);

-- ============================================
-- 14. DEVICE HISTORY / TIMELINE
-- ============================================

CREATE TABLE IF NOT EXISTS device_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL, -- enrolled, online, offline, alert, remote_session, deployment, patch, inventory_change, note, maintenance
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  related_id UUID, -- ID of related entity (alert_id, session_id, job_id, etc.)
  related_type VARCHAR(50),
  
  performed_by_id UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_history_asset ON device_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_history_type ON device_history(event_type);
CREATE INDEX IF NOT EXISTS idx_device_history_created ON device_history(created_at DESC);

-- ============================================
-- 15. AUTOMATION SCRIPTS
-- ============================================

CREATE TABLE IF NOT EXISTS automation_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- remediation, maintenance, diagnostic, custom
  
  script_type VARCHAR(20) NOT NULL, -- powershell, bash, python, batch
  script_content TEXT NOT NULL,
  parameters JSONB DEFAULT '[]', -- [{ name: 'param1', type: 'string', required: true }]
  
  os_compatibility TEXT[] DEFAULT ARRAY['windows'],
  requires_admin BOOLEAN DEFAULT TRUE,
  timeout_seconds INTEGER DEFAULT 300,
  
  -- Triggers
  trigger_on_alert_types TEXT[] DEFAULT '{}',
  trigger_on_severity TEXT[] DEFAULT '{}',
  
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- System scripts cannot be deleted
  
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_scripts_category ON automation_scripts(category);

-- ============================================
-- 16. SCRIPT EXECUTION LOG
-- ============================================

CREATE TABLE IF NOT EXISTS script_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES automation_scripts(id) ON DELETE SET NULL,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES device_alerts(id) ON DELETE SET NULL,
  
  trigger_type VARCHAR(50), -- manual, alert, scheduled
  parameters_used JSONB DEFAULT '{}',
  
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, timeout
  exit_code INTEGER,
  output TEXT,
  error_output TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  executed_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_exec_asset ON script_executions(asset_id);
CREATE INDEX IF NOT EXISTS idx_script_exec_status ON script_executions(status);

-- ============================================
-- 17. RMM SETTINGS
-- ============================================

INSERT INTO settings (key, value, category, description) VALUES
  ('rmm_enabled', 'true', 'rmm', 'RMM-System aktivieren'),
  ('rmm_agent_version', '"1.0.0"', 'rmm', 'Aktuelle Agent-Version'),
  ('rmm_heartbeat_interval', '60', 'rmm', 'Heartbeat-Intervall in Sekunden'),
  ('rmm_offline_threshold', '300', 'rmm', 'Sekunden bis Gerät als offline gilt'),
  ('rmm_auto_ticket_on_critical', 'true', 'rmm', 'Automatisch Ticket bei kritischen Alerts'),
  ('rustdesk_server', '""', 'rmm', 'RustDesk/RAS-Desk Server URL'),
  ('rustdesk_key', '""', 'rmm', 'RustDesk Public Key'),
  ('rmm_metrics_retention_days', '30', 'rmm', 'Metriken-Aufbewahrung in Tagen')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 18. DEFAULT MONITORING POLICY
-- ============================================

INSERT INTO monitoring_policies (id, name, description, is_default, is_active) VALUES
  (gen_random_uuid(), 'Standard-Überwachung', 'Standard-Monitoring für alle Geräte', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 19. DEFAULT SOFTWARE CATALOG ENTRIES
-- ============================================

INSERT INTO software_catalog (id, name, vendor, category, package_type, os_compatibility, silent_install_args) VALUES
  (gen_random_uuid(), '7-Zip', '7-Zip', 'utility', 'msi', ARRAY['windows'], '/qn'),
  (gen_random_uuid(), 'Google Chrome', 'Google', 'productivity', 'msi', ARRAY['windows'], '/qn'),
  (gen_random_uuid(), 'Mozilla Firefox', 'Mozilla', 'productivity', 'msi', ARRAY['windows'], '/qn'),
  (gen_random_uuid(), 'Adobe Reader DC', 'Adobe', 'productivity', 'exe', ARRAY['windows'], '/sAll /rs'),
  (gen_random_uuid(), 'TeamViewer', 'TeamViewer', 'utility', 'msi', ARRAY['windows'], '/qn'),
  (gen_random_uuid(), 'VLC Media Player', 'VideoLAN', 'utility', 'msi', ARRAY['windows'], '/qn'),
  (gen_random_uuid(), 'Notepad++', 'Notepad++', 'development', 'exe', ARRAY['windows'], '/S')
ON CONFLICT DO NOTHING;

-- ============================================
-- 20. DEFAULT AUTOMATION SCRIPTS
-- ============================================

INSERT INTO automation_scripts (id, name, description, category, script_type, script_content, os_compatibility, is_system) VALUES
  (gen_random_uuid(), 'Dienst neu starten', 'Startet einen Windows-Dienst neu', 'remediation', 'powershell', 
   'param([string]$ServiceName)\nRestart-Service -Name $ServiceName -Force\nWrite-Output "Dienst $ServiceName neu gestartet"',
   ARRAY['windows'], TRUE),
  (gen_random_uuid(), 'Speicherplatz bereinigen', 'Löscht temporäre Dateien', 'maintenance', 'powershell',
   'Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue\nRemove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue\nWrite-Output "Temporäre Dateien gelöscht"',
   ARRAY['windows'], TRUE),
  (gen_random_uuid(), 'Systeminfo abrufen', 'Sammelt Systeminformationen', 'diagnostic', 'powershell',
   'Get-ComputerInfo | ConvertTo-Json',
   ARRAY['windows'], TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
