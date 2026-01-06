-- ============================================
-- RMM SYSTEM COMPLETE SCHEMA
-- TacticalRMM + RustDesk Integration
-- Version 1.0 - Production Ready
-- ============================================

-- ============================================
-- 1. CORE RMM TABLES (Device Management)
-- ============================================

-- Agent Enrollment Tokens
CREATE TABLE IF NOT EXISTS agent_enrollment_tokens (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    token VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER DEFAULT 0,
    current_uses INTEGER DEFAULT 0,
    device_type VARCHAR(50) DEFAULT 'workstation',
    auto_tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Metrics (Time-series data)
CREATE TABLE IF NOT EXISTS device_metrics (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    cpu_usage DECIMAL(5,2),
    ram_usage DECIMAL(5,2),
    ram_used_gb DECIMAL(10,2),
    disk_usage DECIMAL(5,2),
    disk_used_gb DECIMAL(10,2),
    uptime_seconds BIGINT,
    process_count INTEGER,
    logged_in_users JSONB DEFAULT '[]',
    services_running JSONB,
    network_in_bytes BIGINT,
    network_out_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Alerts
CREATE TABLE IF NOT EXISTS device_alerts (
    id UUID PRIMARY KEY,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    metric_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    acknowledged_by_id UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    first_triggered_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ DEFAULT NOW(),
    trigger_count INTEGER DEFAULT 1,
    snooze_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device History (Audit Log)
CREATE TABLE IF NOT EXISTS device_history (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    related_id UUID,
    related_type VARCHAR(50),
    performed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitor Policies
CREATE TABLE IF NOT EXISTS monitor_policies (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    thresholds JSONB DEFAULT '{
        "cpu_warning": 80,
        "cpu_critical": 95,
        "ram_warning": 80,
        "ram_critical": 95,
        "disk_warning": 80,
        "disk_critical": 95,
        "offline_minutes": 5
    }',
    alert_settings JSONB DEFAULT '{
        "auto_create_ticket": true,
        "notify_email": true,
        "cooldown_minutes": 15
    }',
    applies_to_tags TEXT[] DEFAULT '{}',
    applies_to_device_types TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. REMOTE SESSIONS
-- ============================================

-- Remote Sessions (enhanced)
CREATE TABLE IF NOT EXISTS remote_sessions (
    id UUID PRIMARY KEY,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    session_type VARCHAR(50) DEFAULT 'remote_desktop',
    remote_tool VARCHAR(50) DEFAULT 'rustdesk',
    remote_id VARCHAR(100),
    rustdesk_peer_id UUID,
    trmm_agent_id UUID,
    status VARCHAR(20) DEFAULT 'connecting',
    is_billable BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    time_entry_id UUID REFERENCES time_entries(id),
    notes TEXT,
    recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. SOFTWARE & INVENTORY
-- ============================================

-- Software Catalog
CREATE TABLE IF NOT EXISTS software_catalog (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    version VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    icon_url TEXT,
    download_url TEXT,
    silent_install_args TEXT,
    silent_uninstall_args TEXT,
    detection_script TEXT,
    supported_os TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Software Inventory (per device)
CREATE TABLE IF NOT EXISTS software_inventory (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    vendor VARCHAR(255),
    install_date DATE,
    install_location TEXT,
    size_mb DECIMAL(10,2),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    UNIQUE(asset_id, name, version)
);

-- Hardware Inventory
CREATE TABLE IF NOT EXISTS hardware_inventory (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    component_type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    capacity VARCHAR(100),
    speed VARCHAR(100),
    interface_type VARCHAR(100),
    details JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. DEPLOYMENT & SCRIPTS
-- ============================================

-- Deployment Jobs
CREATE TABLE IF NOT EXISTS deployment_jobs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    job_type VARCHAR(50) NOT NULL,
    software_id UUID REFERENCES software_catalog(id),
    target_device_ids UUID[] DEFAULT '{}',
    target_tags TEXT[] DEFAULT '{}',
    command TEXT,
    script_content TEXT,
    script_type VARCHAR(20),
    parameters JSONB DEFAULT '{}',
    timeout_minutes INTEGER DEFAULT 30,
    schedule_type VARCHAR(20) DEFAULT 'immediate',
    scheduled_at TIMESTAMPTZ,
    cron_expression VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment Executions (per device)
CREATE TABLE IF NOT EXISTS deployment_executions (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES deployment_jobs(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    exit_code INTEGER,
    output TEXT,
    error_output TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script Library
CREATE TABLE IF NOT EXISTS script_library (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    script_type VARCHAR(20) NOT NULL DEFAULT 'powershell',
    script_content TEXT NOT NULL,
    parameters JSONB DEFAULT '[]',
    default_timeout INTEGER DEFAULT 60,
    run_as_user BOOLEAN DEFAULT FALSE,
    supported_os TEXT[] DEFAULT '{windows}',
    tags TEXT[] DEFAULT '{}',
    is_builtin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. TACTICALRMM INTEGRATION
-- ============================================

-- TacticalRMM Instances
CREATE TABLE IF NOT EXISTS tacticalrmm_instances (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_url VARCHAR(500) NOT NULL,
    api_key TEXT NOT NULL,
    default_organization_id UUID REFERENCES organizations(id),
    auto_create_tickets BOOLEAN DEFAULT TRUE,
    auto_sync_interval_minutes INTEGER DEFAULT 15,
    sync_clients BOOLEAN DEFAULT TRUE,
    sync_agents BOOLEAN DEFAULT TRUE,
    sync_alerts BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TacticalRMM Clients (maps to Organizations)
CREATE TABLE IF NOT EXISTS tacticalrmm_clients (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    trmm_client_id INTEGER NOT NULL,
    trmm_client_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TacticalRMM Sites (sub-locations)
CREATE TABLE IF NOT EXISTS tacticalrmm_sites (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
    client_mapping_id UUID REFERENCES tacticalrmm_clients(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    trmm_site_id INTEGER NOT NULL,
    trmm_site_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TacticalRMM Agents (maps to Assets)
CREATE TABLE IF NOT EXISTS tacticalrmm_agents (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    trmm_agent_id VARCHAR(100) NOT NULL UNIQUE,
    hostname VARCHAR(255),
    description TEXT,
    plat VARCHAR(50),
    plat_release VARCHAR(100),
    version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'unknown',
    last_seen TIMESTAMPTZ,
    boot_time TIMESTAMPTZ,
    public_ip VARCHAR(50),
    local_ips JSONB DEFAULT '[]',
    cpu_model VARCHAR(255),
    total_ram INTEGER,
    disks JSONB DEFAULT '[]',
    graphics VARCHAR(255),
    checks_passing INTEGER DEFAULT 0,
    checks_failing INTEGER DEFAULT 0,
    has_patches_pending BOOLEAN DEFAULT FALSE,
    pending_actions_count INTEGER DEFAULT 0,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    needs_reboot BOOLEAN DEFAULT FALSE,
    logged_user VARCHAR(255),
    trmm_client_id INTEGER,
    trmm_site_id INTEGER,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TacticalRMM Alerts
CREATE TABLE IF NOT EXISTS tacticalrmm_alerts (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
    agent_mapping_id UUID REFERENCES tacticalrmm_agents(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    trmm_alert_id INTEGER,
    trmm_agent_id VARCHAR(100),
    alert_type VARCHAR(100),
    severity VARCHAR(20),
    message TEXT,
    alert_time TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    assigned_check JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TacticalRMM Scripts (synced)
CREATE TABLE IF NOT EXISTS tacticalrmm_scripts (
    id UUID PRIMARY KEY,
    instance_id UUID REFERENCES tacticalrmm_instances(id) ON DELETE CASCADE,
    trmm_script_id INTEGER NOT NULL,
    name VARCHAR(255),
    description TEXT,
    script_type VARCHAR(20),
    shell VARCHAR(20),
    category VARCHAR(100),
    args JSONB DEFAULT '[]',
    default_timeout INTEGER DEFAULT 120,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. RUSTDESK INTEGRATION
-- ============================================

-- RustDesk Servers
CREATE TABLE IF NOT EXISTS rustdesk_servers (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    id_server VARCHAR(255) NOT NULL,
    relay_server VARCHAR(255),
    public_key TEXT,
    is_pro BOOLEAN DEFAULT FALSE,
    api_server VARCHAR(255),
    api_key TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RustDesk Peers (Devices with RustDesk installed)
CREATE TABLE IF NOT EXISTS rustdesk_peers (
    id UUID PRIMARY KEY,
    server_id UUID REFERENCES rustdesk_servers(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    trmm_agent_id UUID REFERENCES tacticalrmm_agents(id) ON DELETE SET NULL,
    peer_id VARCHAR(50) NOT NULL UNIQUE,
    hostname VARCHAR(255),
    platform VARCHAR(50),
    alias VARCHAR(255),
    password_hash TEXT,
    online BOOLEAN DEFAULT FALSE,
    last_online TIMESTAMPTZ,
    note TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RustDesk Address Book Groups
CREATE TABLE IF NOT EXISTS rustdesk_groups (
    id UUID PRIMARY KEY,
    server_id UUID REFERENCES rustdesk_servers(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES rustdesk_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RustDesk Group Members
CREATE TABLE IF NOT EXISTS rustdesk_group_members (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES rustdesk_groups(id) ON DELETE CASCADE,
    peer_id UUID NOT NULL REFERENCES rustdesk_peers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, peer_id)
);

-- ============================================
-- 7. INTEGRATION SYNC LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id UUID PRIMARY KEY,
    integration_type VARCHAR(50) NOT NULL,
    instance_id UUID,
    sync_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CONTRACTS & BILLING (CRM Enhancement)
-- ============================================

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contract_number VARCHAR(100),
    contract_type VARCHAR(50) DEFAULT 'support',
    billing_model VARCHAR(50) DEFAULT 'hourly',
    hourly_rate DECIMAL(10,2) DEFAULT 85.00,
    monthly_fee DECIMAL(10,2),
    included_hours_monthly INTEGER,
    sla_profile_id UUID REFERENCES sla_profiles(id),
    start_date DATE,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    renewal_notice_days INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    terms_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Services
CREATE TABLE IF NOT EXISTS contract_services (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    billing_frequency VARCHAR(20) DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. BACKUP MANAGEMENT
-- ============================================

-- Backup Jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    backup_type VARCHAR(50) NOT NULL DEFAULT 'full',
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    destination_type VARCHAR(50) DEFAULT 'local',
    destination_path TEXT,
    schedule_type VARCHAR(20) DEFAULT 'manual',
    cron_expression VARCHAR(100),
    retention_days INTEGER DEFAULT 30,
    compression BOOLEAN DEFAULT TRUE,
    encryption BOOLEAN DEFAULT TRUE,
    encryption_key_hash TEXT,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(20),
    last_backup_size_bytes BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup Executions
CREATE TABLE IF NOT EXISTS backup_executions (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    backup_size_bytes BIGINT,
    checksum VARCHAR(128),
    file_path TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 10. PATCH MANAGEMENT
-- ============================================

-- Patch Policies
CREATE TABLE IF NOT EXISTS patch_policies (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    approval_mode VARCHAR(20) DEFAULT 'auto',
    auto_install BOOLEAN DEFAULT FALSE,
    reboot_policy VARCHAR(20) DEFAULT 'prompt',
    maintenance_window JSONB DEFAULT '{}',
    excluded_kbs TEXT[] DEFAULT '{}',
    severity_filter TEXT[] DEFAULT '{}',
    applies_to_tags TEXT[] DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patch Status (per device)
CREATE TABLE IF NOT EXISTS patch_status (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    kb_number VARCHAR(20) NOT NULL,
    title VARCHAR(500),
    description TEXT,
    severity VARCHAR(20),
    category VARCHAR(100),
    release_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    installed_at TIMESTAMPTZ,
    install_result TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, kb_number)
);

-- ============================================
-- 11. ALTER ASSETS TABLE FOR RMM FIELDS
-- ============================================

-- Add RMM-specific columns to assets if they don't exist
DO $$
BEGIN
    -- Agent fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'agent_id') THEN
        ALTER TABLE assets ADD COLUMN agent_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'agent_status') THEN
        ALTER TABLE assets ADD COLUMN agent_status VARCHAR(20) DEFAULT 'unknown';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'agent_version') THEN
        ALTER TABLE assets ADD COLUMN agent_version VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'last_heartbeat') THEN
        ALTER TABLE assets ADD COLUMN last_heartbeat TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'enrollment_token') THEN
        ALTER TABLE assets ADD COLUMN enrollment_token VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'enrolled_at') THEN
        ALTER TABLE assets ADD COLUMN enrolled_at TIMESTAMPTZ;
    END IF;
    
    -- Hardware info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'hostname') THEN
        ALTER TABLE assets ADD COLUMN hostname VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'os_type') THEN
        ALTER TABLE assets ADD COLUMN os_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'os_version') THEN
        ALTER TABLE assets ADD COLUMN os_version VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'os_build') THEN
        ALTER TABLE assets ADD COLUMN os_build VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'cpu_model') THEN
        ALTER TABLE assets ADD COLUMN cpu_model VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'cpu_cores') THEN
        ALTER TABLE assets ADD COLUMN cpu_cores INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ram_total_gb') THEN
        ALTER TABLE assets ADD COLUMN ram_total_gb DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'disk_total_gb') THEN
        ALTER TABLE assets ADD COLUMN disk_total_gb DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'disk_free_gb') THEN
        ALTER TABLE assets ADD COLUMN disk_free_gb DECIMAL(10,2);
    END IF;
    
    -- Network
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'mac_address') THEN
        ALTER TABLE assets ADD COLUMN mac_address VARCHAR(17);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'ip_address') THEN
        ALTER TABLE assets ADD COLUMN ip_address VARCHAR(45);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'public_ip') THEN
        ALTER TABLE assets ADD COLUMN public_ip VARCHAR(45);
    END IF;
    
    -- Remote
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'remote_id') THEN
        ALTER TABLE assets ADD COLUMN remote_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'rustdesk_peer_id') THEN
        ALTER TABLE assets ADD COLUMN rustdesk_peer_id VARCHAR(50);
    END IF;
    
    -- Device type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'device_type') THEN
        ALTER TABLE assets ADD COLUMN device_type VARCHAR(50) DEFAULT 'workstation';
    END IF;
    
    -- Maintenance & Monitoring
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'maintenance_mode') THEN
        ALTER TABLE assets ADD COLUMN maintenance_mode BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'maintenance_until') THEN
        ALTER TABLE assets ADD COLUMN maintenance_until TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'monitor_policy_id') THEN
        ALTER TABLE assets ADD COLUMN monitor_policy_id UUID REFERENCES monitor_policies(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'patch_policy_id') THEN
        ALTER TABLE assets ADD COLUMN patch_policy_id UUID REFERENCES patch_policies(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'alert_policies') THEN
        ALTER TABLE assets ADD COLUMN alert_policies JSONB DEFAULT '{}';
    END IF;
    
    -- TacticalRMM linking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'trmm_agent_id') THEN
        ALTER TABLE assets ADD COLUMN trmm_agent_id UUID REFERENCES tacticalrmm_agents(id);
    END IF;
    
    -- Tags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'tags') THEN
        ALTER TABLE assets ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
    
    -- Last seen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'last_seen') THEN
        ALTER TABLE assets ADD COLUMN last_seen TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================

-- Device metrics indexes
CREATE INDEX IF NOT EXISTS idx_device_metrics_asset_timestamp ON device_metrics(asset_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_metrics_timestamp ON device_metrics(timestamp DESC);

-- Device alerts indexes
CREATE INDEX IF NOT EXISTS idx_device_alerts_asset ON device_alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_alerts_status ON device_alerts(status);
CREATE INDEX IF NOT EXISTS idx_device_alerts_org ON device_alerts(organization_id);

-- Device history indexes
CREATE INDEX IF NOT EXISTS idx_device_history_asset ON device_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_history_type ON device_history(event_type);

-- Remote sessions indexes
CREATE INDEX IF NOT EXISTS idx_remote_sessions_asset ON remote_sessions(asset_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_user ON remote_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);

-- Software inventory indexes
CREATE INDEX IF NOT EXISTS idx_software_inventory_asset ON software_inventory(asset_id);
CREATE INDEX IF NOT EXISTS idx_software_inventory_name ON software_inventory(name);

-- Hardware inventory indexes
CREATE INDEX IF NOT EXISTS idx_hardware_inventory_asset ON hardware_inventory(asset_id);

-- TacticalRMM indexes
CREATE INDEX IF NOT EXISTS idx_trmm_agents_agent_id ON tacticalrmm_agents(trmm_agent_id);
CREATE INDEX IF NOT EXISTS idx_trmm_agents_hostname ON tacticalrmm_agents(hostname);
CREATE INDEX IF NOT EXISTS idx_trmm_alerts_resolved ON tacticalrmm_alerts(resolved);

-- RustDesk indexes
CREATE INDEX IF NOT EXISTS idx_rustdesk_peers_peer_id ON rustdesk_peers(peer_id);
CREATE INDEX IF NOT EXISTS idx_rustdesk_peers_online ON rustdesk_peers(online);

-- Assets RMM indexes
CREATE INDEX IF NOT EXISTS idx_assets_agent_id ON assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_assets_agent_status ON assets(agent_status);
CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname);
CREATE INDEX IF NOT EXISTS idx_assets_last_seen ON assets(last_seen);

-- Integration sync logs
CREATE INDEX IF NOT EXISTS idx_integration_sync_type ON integration_sync_logs(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_sync_status ON integration_sync_logs(status);

-- ============================================
-- 13. DEFAULT DATA
-- ============================================

-- Default monitor policy
INSERT INTO monitor_policies (id, name, description, is_default, thresholds, alert_settings, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Standard Monitoring',
    'Default monitoring policy for all devices',
    TRUE,
    '{"cpu_warning": 80, "cpu_critical": 95, "ram_warning": 80, "ram_critical": 95, "disk_warning": 80, "disk_critical": 95, "offline_minutes": 5}',
    '{"auto_create_ticket": true, "notify_email": true, "cooldown_minutes": 15}',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Default patch policy
INSERT INTO patch_policies (id, name, description, is_default, approval_mode, auto_install, reboot_policy, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Standard Patching',
    'Default patch policy - manual approval, no auto reboot',
    TRUE,
    'manual',
    FALSE,
    'prompt',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Sample scripts for library
INSERT INTO script_library (id, name, description, category, script_type, script_content, supported_os, is_builtin, is_active)
VALUES 
(
    'c0000000-0000-0000-0000-000000000001',
    'Get System Info',
    'Collects basic system information',
    'Information',
    'powershell',
    'Get-ComputerInfo | Select-Object CsName, OsName, OsVersion, OsArchitecture, CsTotalPhysicalMemory | ConvertTo-Json',
    '{windows}',
    TRUE,
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000002',
    'Clear Temp Files',
    'Clears temporary files to free up disk space',
    'Maintenance',
    'powershell',
    'Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Temp files cleared"',
    '{windows}',
    TRUE,
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000003',
    'Restart Service',
    'Restarts a Windows service',
    'Services',
    'powershell',
    'param($ServiceName)
Restart-Service -Name $ServiceName -Force
Get-Service -Name $ServiceName | Select-Object Name, Status | ConvertTo-Json',
    '{windows}',
    TRUE,
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000004',
    'Disk Usage Report',
    'Gets disk usage for all drives',
    'Information',
    'powershell',
    'Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DriveType -eq 3} | Select-Object DeviceID, @{N="SizeGB";E={[math]::Round($_.Size/1GB,2)}}, @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB,2)}}, @{N="UsedPercent";E={[math]::Round(100-($_.FreeSpace/$_.Size*100),1)}} | ConvertTo-Json',
    '{windows}',
    TRUE,
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000005',
    'System Info (Linux)',
    'Collects basic system information on Linux',
    'Information',
    'bash',
    '#!/bin/bash
echo "{"
echo "  \"hostname\": \"$(hostname)\","
echo "  \"os\": \"$(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \"\")\"",
echo "  \"kernel\": \"$(uname -r)\","
echo "  \"uptime\": \"$(uptime -p)\","
echo "  \"memory_total\": \"$(free -h | awk ''/Mem/{print $2}'')\"",
echo "  \"disk_usage\": \"$(df -h / | awk ''NR==2{print $5}'')\""
echo "}"',
    '{linux}',
    TRUE,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 14. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_monitor_policies_updated_at ON monitor_policies;
CREATE TRIGGER update_monitor_policies_updated_at
    BEFORE UPDATE ON monitor_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patch_policies_updated_at ON patch_policies;
CREATE TRIGGER update_patch_policies_updated_at
    BEFORE UPDATE ON patch_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tacticalrmm_instances_updated_at ON tacticalrmm_instances;
CREATE TRIGGER update_tacticalrmm_instances_updated_at
    BEFORE UPDATE ON tacticalrmm_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rustdesk_servers_updated_at ON rustdesk_servers;
CREATE TRIGGER update_rustdesk_servers_updated_at
    BEFORE UPDATE ON rustdesk_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 15. VIEWS FOR REPORTING
-- ============================================

-- Device Overview View
CREATE OR REPLACE VIEW v_device_overview AS
SELECT 
    a.id,
    a.name,
    a.hostname,
    a.device_type,
    a.agent_status,
    a.last_seen,
    a.os_type,
    a.os_version,
    o.id as organization_id,
    o.name as organization_name,
    l.name as location_name,
    ta.hostname as trmm_hostname,
    ta.status as trmm_status,
    ta.checks_failing,
    ta.has_patches_pending,
    rp.peer_id as rustdesk_id,
    rp.online as rustdesk_online,
    (SELECT COUNT(*) FROM device_alerts da WHERE da.asset_id = a.id AND da.status = 'active') as active_alerts
FROM assets a
LEFT JOIN organizations o ON a.organization_id = o.id
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN tacticalrmm_agents ta ON a.trmm_agent_id = ta.id
LEFT JOIN rustdesk_peers rp ON a.id = rp.asset_id
WHERE a.agent_id IS NOT NULL;

-- RMM Dashboard Stats View
CREATE OR REPLACE VIEW v_rmm_dashboard AS
SELECT
    (SELECT COUNT(*) FROM assets WHERE agent_id IS NOT NULL) as total_devices,
    (SELECT COUNT(*) FROM assets WHERE agent_status = 'online') as online_devices,
    (SELECT COUNT(*) FROM assets WHERE agent_status = 'offline') as offline_devices,
    (SELECT COUNT(*) FROM device_alerts WHERE status = 'active') as active_alerts,
    (SELECT COUNT(*) FROM device_alerts WHERE status = 'active' AND severity = 'critical') as critical_alerts,
    (SELECT COUNT(*) FROM remote_sessions WHERE status = 'active') as active_sessions,
    (SELECT COUNT(*) FROM deployment_jobs WHERE status IN ('pending', 'running')) as pending_jobs,
    (SELECT COUNT(*) FROM tacticalrmm_agents) as trmm_agents,
    (SELECT COUNT(*) FROM rustdesk_peers WHERE online = true) as rustdesk_online;

COMMIT;
