-- =====================================================
-- IT DOCUMENTATION MODULE - DOCUSNAP FEATURE PARITY
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. DISCOVERY & INVENTORY TABLES
-- =====================================================

-- Discovery Scans (scheduled or manual)
CREATE TABLE IF NOT EXISTS doc_discovery_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL DEFAULT 'full', -- full, ad, network, filesystem
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    statistics JSONB DEFAULT '{}',
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Snapshots (versioned state)
CREATE TABLE IF NOT EXISTS doc_inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES doc_discovery_scans(id) ON DELETE SET NULL,
    snapshot_date TIMESTAMPTZ DEFAULT NOW(),
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items (discovered systems/devices)
CREATE TABLE IF NOT EXISTS doc_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    
    -- Item identification
    item_type VARCHAR(50) NOT NULL, -- server, workstation, switch, router, printer, vm, domain_controller
    hostname VARCHAR(255),
    fqdn VARCHAR(500),
    ip_addresses JSONB DEFAULT '[]',
    mac_addresses JSONB DEFAULT '[]',
    
    -- System info
    os_name VARCHAR(255),
    os_version VARCHAR(100),
    os_architecture VARCHAR(20),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(100),
    
    -- Hardware
    cpu_info JSONB DEFAULT '{}',
    ram_gb DECIMAL(10,2),
    disk_info JSONB DEFAULT '[]',
    
    -- Network
    network_interfaces JSONB DEFAULT '[]',
    default_gateway VARCHAR(50),
    dns_servers JSONB DEFAULT '[]',
    
    -- Status
    is_online BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    
    -- Raw data
    raw_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server Roles & Features
CREATE TABLE IF NOT EXISTS doc_server_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    role_type VARCHAR(50), -- role, feature, service
    is_installed BOOLEAN DEFAULT true,
    status VARCHAR(50),
    dependencies JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Installed Software
CREATE TABLE IF NOT EXISTS doc_installed_software (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    version VARCHAR(100),
    publisher VARCHAR(255),
    install_date DATE,
    install_location VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Windows Services
CREATE TABLE IF NOT EXISTS doc_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(500),
    status VARCHAR(50),
    start_type VARCHAR(50),
    account VARCHAR(255),
    path VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Windows Updates
CREATE TABLE IF NOT EXISTS doc_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE CASCADE,
    kb_number VARCHAR(50),
    title VARCHAR(500),
    description TEXT,
    installed_on TIMESTAMPTZ,
    update_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. ACTIVE DIRECTORY TABLES
-- =====================================================

-- AD Domains
CREATE TABLE IF NOT EXISTS doc_ad_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) NOT NULL,
    netbios_name VARCHAR(50),
    forest_name VARCHAR(255),
    domain_functional_level VARCHAR(50),
    forest_functional_level VARCHAR(50),
    domain_controllers JSONB DEFAULT '[]',
    sites JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD Users
CREATE TABLE IF NOT EXISTS doc_ad_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES doc_ad_domains(id) ON DELETE CASCADE,
    sam_account_name VARCHAR(255) NOT NULL,
    user_principal_name VARCHAR(500),
    display_name VARCHAR(255),
    email VARCHAR(255),
    distinguished_name TEXT,
    ou_path TEXT,
    is_enabled BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    password_never_expires BOOLEAN DEFAULT false,
    password_last_set TIMESTAMPTZ,
    last_logon TIMESTAMPTZ,
    created_date TIMESTAMPTZ,
    member_of JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD Groups
CREATE TABLE IF NOT EXISTS doc_ad_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES doc_ad_domains(id) ON DELETE CASCADE,
    sam_account_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    distinguished_name TEXT,
    ou_path TEXT,
    group_scope VARCHAR(50), -- DomainLocal, Global, Universal
    group_type VARCHAR(50), -- Security, Distribution
    description TEXT,
    members JSONB DEFAULT '[]',
    member_of JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD Computers
CREATE TABLE IF NOT EXISTS doc_ad_computers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES doc_ad_domains(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE SET NULL,
    sam_account_name VARCHAR(255) NOT NULL,
    dns_hostname VARCHAR(500),
    distinguished_name TEXT,
    ou_path TEXT,
    os_name VARCHAR(255),
    os_version VARCHAR(100),
    is_enabled BOOLEAN DEFAULT true,
    last_logon TIMESTAMPTZ,
    created_date TIMESTAMPTZ,
    member_of JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD Organizational Units
CREATE TABLE IF NOT EXISTS doc_ad_ous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES doc_ad_domains(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    distinguished_name TEXT,
    parent_ou TEXT,
    description TEXT,
    linked_gpos JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD Group Policy Objects
CREATE TABLE IF NOT EXISTS doc_ad_gpos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES doc_ad_domains(id) ON DELETE CASCADE,
    gpo_id VARCHAR(100),
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    gpo_status VARCHAR(50),
    created_date TIMESTAMPTZ,
    modified_date TIMESTAMPTZ,
    linked_ous JSONB DEFAULT '[]',
    settings_summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. NETWORK TOPOLOGY TABLES
-- =====================================================

-- Network Devices (Switches, Routers)
CREATE TABLE IF NOT EXISTS doc_network_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE SET NULL,
    
    device_type VARCHAR(50) NOT NULL, -- switch, router, firewall, access_point, printer
    hostname VARCHAR(255),
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    firmware_version VARCHAR(100),
    
    -- SNMP Info
    snmp_version VARCHAR(10),
    sys_name VARCHAR(255),
    sys_description TEXT,
    sys_location VARCHAR(255),
    sys_contact VARCHAR(255),
    uptime_seconds BIGINT,
    
    -- Management
    management_ip VARCHAR(50),
    management_vlan INTEGER,
    
    location_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network Interfaces / Ports
CREATE TABLE IF NOT EXISTS doc_network_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_device_id UUID REFERENCES doc_network_devices(id) ON DELETE CASCADE,
    
    interface_index INTEGER,
    interface_name VARCHAR(255),
    interface_type VARCHAR(100),
    description VARCHAR(500),
    
    mac_address VARCHAR(50),
    ip_addresses JSONB DEFAULT '[]',
    
    speed_mbps BIGINT,
    admin_status VARCHAR(50),
    oper_status VARCHAR(50),
    
    vlan_id INTEGER,
    vlan_name VARCHAR(100),
    is_trunk BOOLEAN DEFAULT false,
    allowed_vlans JSONB DEFAULT '[]',
    
    -- LLDP/CDP neighbor info
    neighbor_device VARCHAR(255),
    neighbor_port VARCHAR(255),
    neighbor_ip VARCHAR(50),
    
    in_octets BIGINT,
    out_octets BIGINT,
    in_errors BIGINT,
    out_errors BIGINT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VLANs
CREATE TABLE IF NOT EXISTS doc_vlans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id) ON DELETE CASCADE,
    
    vlan_id INTEGER NOT NULL,
    vlan_name VARCHAR(255),
    description TEXT,
    subnet VARCHAR(50),
    gateway VARCHAR(50),
    dhcp_enabled BOOLEAN DEFAULT false,
    dhcp_server VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network Topology Links (for graph visualization)
CREATE TABLE IF NOT EXISTS doc_topology_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id) ON DELETE CASCADE,
    
    source_device_id UUID,
    source_interface_id UUID,
    source_type VARCHAR(50),
    
    target_device_id UUID,
    target_interface_id UUID,
    target_type VARCHAR(50),
    
    link_type VARCHAR(50), -- ethernet, fiber, wireless, vpn
    link_speed_mbps BIGINT,
    
    discovered_via VARCHAR(50), -- lldp, cdp, arp, manual
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PERMISSION ANALYSIS TABLES
-- =====================================================

-- File Shares
CREATE TABLE IF NOT EXISTS doc_file_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES doc_inventory_items(id) ON DELETE CASCADE,
    
    share_name VARCHAR(255) NOT NULL,
    share_path VARCHAR(1000),
    local_path VARCHAR(1000),
    description TEXT,
    share_type VARCHAR(50),
    
    max_users INTEGER,
    current_users INTEGER,
    
    share_permissions JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NTFS Permissions
CREATE TABLE IF NOT EXISTS doc_ntfs_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_share_id UUID REFERENCES doc_file_shares(id) ON DELETE CASCADE,
    
    path VARCHAR(2000) NOT NULL,
    is_folder BOOLEAN DEFAULT true,
    owner VARCHAR(255),
    
    permissions JSONB DEFAULT '[]', -- Array of {identity, access_type, rights, inheritance}
    
    is_inherited BOOLEAN DEFAULT true,
    inheritance_disabled BOOLEAN DEFAULT false,
    
    -- Risk flags
    has_everyone_access BOOLEAN DEFAULT false,
    has_domain_users_access BOOLEAN DEFAULT false,
    has_full_control_risk BOOLEAN DEFAULT false,
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission Changes (drift detection)
CREATE TABLE IF NOT EXISTS doc_permission_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    path VARCHAR(2000),
    change_type VARCHAR(50), -- added, removed, modified
    previous_value JSONB,
    new_value JSONB,
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id)
);

-- =====================================================
-- 5. CONCEPTS & HANDBOOKS
-- =====================================================

-- Document Templates
CREATE TABLE IF NOT EXISTS doc_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- operations_handbook, emergency_handbook, network_concept, security_concept
    description TEXT,
    structure JSONB NOT NULL, -- Template structure with sections
    default_content JSONB DEFAULT '{}',
    auto_fill_mappings JSONB DEFAULT '{}', -- Maps template fields to inventory data
    is_system BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Documents
CREATE TABLE IF NOT EXISTS doc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES doc_templates(id),
    
    title VARCHAR(500) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, review, approved, archived
    version INTEGER DEFAULT 1,
    
    content JSONB NOT NULL, -- Full document content
    auto_filled_at TIMESTAMPTZ,
    
    created_by_id UUID REFERENCES users(id),
    approved_by_id UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Sections (for granular editing)
CREATE TABLE IF NOT EXISTS doc_document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES doc_documents(id) ON DELETE CASCADE,
    
    section_key VARCHAR(100) NOT NULL,
    section_title VARCHAR(255),
    section_order INTEGER DEFAULT 0,
    content TEXT,
    is_auto_filled BOOLEAN DEFAULT false,
    auto_fill_source VARCHAR(255),
    
    last_edited_by UUID REFERENCES users(id),
    last_edited_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. REPORTS & AUDIT
-- =====================================================

-- Generated Reports
CREATE TABLE IF NOT EXISTS doc_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES doc_inventory_snapshots(id),
    
    report_type VARCHAR(50) NOT NULL, -- inventory, network, permissions, ad, changes, audit
    title VARCHAR(500),
    
    parameters JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    
    file_path VARCHAR(1000),
    file_checksum VARCHAR(100),
    
    generated_by_id UUID REFERENCES users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS doc_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. SCHEDULED TASKS
-- =====================================================

CREATE TABLE IF NOT EXISTS doc_scheduled_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    scan_type VARCHAR(50) NOT NULL,
    schedule_cron VARCHAR(100), -- Cron expression
    is_enabled BOOLEAN DEFAULT true,
    
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status VARCHAR(50),
    
    configuration JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_doc_inv_items_org ON doc_inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_inv_items_snapshot ON doc_inventory_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_doc_inv_items_type ON doc_inventory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_doc_ad_users_domain ON doc_ad_users(domain_id);
CREATE INDEX IF NOT EXISTS idx_doc_ad_groups_domain ON doc_ad_groups(domain_id);
CREATE INDEX IF NOT EXISTS idx_doc_network_devices_org ON doc_network_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_file_shares_item ON doc_file_shares(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_doc_documents_org ON doc_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_reports_org ON doc_reports(organization_id);

-- =====================================================
-- 9. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE doc_discovery_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_server_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_installed_software ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_computers ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_ous ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ad_gpos ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_network_interfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_vlans ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_topology_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_ntfs_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_permission_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_scheduled_scans ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, restrict in production)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'doc_discovery_scans', 'doc_inventory_snapshots', 'doc_inventory_items',
            'doc_server_roles', 'doc_installed_software', 'doc_services', 'doc_updates',
            'doc_ad_domains', 'doc_ad_users', 'doc_ad_groups', 'doc_ad_computers',
            'doc_ad_ous', 'doc_ad_gpos', 'doc_network_devices', 'doc_network_interfaces',
            'doc_vlans', 'doc_topology_links', 'doc_file_shares', 'doc_ntfs_permissions',
            'doc_permission_changes', 'doc_templates', 'doc_documents', 'doc_document_sections',
            'doc_reports', 'doc_audit_log', 'doc_scheduled_scans'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %I" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all for %I" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- =====================================================
-- 10. DEFAULT TEMPLATES
-- =====================================================

INSERT INTO doc_templates (name, template_type, description, structure, auto_fill_mappings) VALUES
(
    'IT-Betriebshandbuch',
    'operations_handbook',
    'Standardvorlage für IT-Betriebshandbuch',
    '{
        "sections": [
            {"key": "overview", "title": "1. Übersicht", "subsections": [
                {"key": "company_info", "title": "1.1 Unternehmensinformationen"},
                {"key": "it_landscape", "title": "1.2 IT-Landschaft Übersicht"}
            ]},
            {"key": "infrastructure", "title": "2. Infrastruktur", "subsections": [
                {"key": "servers", "title": "2.1 Server"},
                {"key": "workstations", "title": "2.2 Arbeitsplätze"},
                {"key": "network", "title": "2.3 Netzwerk"}
            ]},
            {"key": "services", "title": "3. Dienste & Anwendungen", "subsections": [
                {"key": "active_directory", "title": "3.1 Active Directory"},
                {"key": "email", "title": "3.2 E-Mail"},
                {"key": "file_services", "title": "3.3 Dateidienste"}
            ]},
            {"key": "security", "title": "4. Sicherheit", "subsections": [
                {"key": "firewall", "title": "4.1 Firewall"},
                {"key": "backup", "title": "4.2 Backup"},
                {"key": "antivirus", "title": "4.3 Antivirus"}
            ]},
            {"key": "contacts", "title": "5. Kontakte & Zuständigkeiten"}
        ]
    }',
    '{
        "company_info": "organization",
        "servers": "inventory.servers",
        "workstations": "inventory.workstations",
        "network": "topology",
        "active_directory": "ad"
    }'
),
(
    'IT-Notfallhandbuch',
    'emergency_handbook',
    'Disaster Recovery und Notfallprozeduren',
    '{
        "sections": [
            {"key": "emergency_contacts", "title": "1. Notfallkontakte"},
            {"key": "escalation", "title": "2. Eskalationsprozess"},
            {"key": "systems", "title": "3. Kritische Systeme", "subsections": [
                {"key": "priority_1", "title": "3.1 Priorität 1 - Geschäftskritisch"},
                {"key": "priority_2", "title": "3.2 Priorität 2 - Wichtig"},
                {"key": "priority_3", "title": "3.3 Priorität 3 - Standard"}
            ]},
            {"key": "recovery", "title": "4. Wiederherstellungsprozeduren", "subsections": [
                {"key": "server_recovery", "title": "4.1 Server-Wiederherstellung"},
                {"key": "network_recovery", "title": "4.2 Netzwerk-Wiederherstellung"},
                {"key": "data_recovery", "title": "4.3 Daten-Wiederherstellung"}
            ]},
            {"key": "backup_info", "title": "5. Backup-Informationen"},
            {"key": "vendor_contacts", "title": "6. Lieferanten-Kontakte"}
        ]
    }',
    '{
        "systems": "inventory.critical",
        "backup_info": "inventory.backup"
    }'
),
(
    'Netzwerkkonzept',
    'network_concept',
    'Dokumentation der Netzwerkinfrastruktur',
    '{
        "sections": [
            {"key": "overview", "title": "1. Netzwerk-Übersicht"},
            {"key": "topology", "title": "2. Topologie", "subsections": [
                {"key": "physical", "title": "2.1 Physische Topologie"},
                {"key": "logical", "title": "2.2 Logische Topologie"}
            ]},
            {"key": "vlans", "title": "3. VLANs & Segmentierung"},
            {"key": "ip_addressing", "title": "4. IP-Adressierung"},
            {"key": "routing", "title": "5. Routing"},
            {"key": "switches", "title": "6. Switches"},
            {"key": "firewalls", "title": "7. Firewalls"},
            {"key": "wifi", "title": "8. WLAN"}
        ]
    }',
    '{
        "topology": "topology",
        "vlans": "vlans",
        "switches": "network_devices.switches"
    }'
),
(
    'Berechtigungskonzept',
    'security_concept',
    'Dokumentation der Berechtigungsstruktur',
    '{
        "sections": [
            {"key": "overview", "title": "1. Übersicht"},
            {"key": "ad_structure", "title": "2. Active Directory Struktur", "subsections": [
                {"key": "ous", "title": "2.1 Organisationseinheiten"},
                {"key": "groups", "title": "2.2 Gruppen"},
                {"key": "users", "title": "2.3 Benutzer"}
            ]},
            {"key": "file_permissions", "title": "3. Dateiberechtigungen", "subsections": [
                {"key": "shares", "title": "3.1 Freigaben"},
                {"key": "ntfs", "title": "3.2 NTFS-Berechtigungen"}
            ]},
            {"key": "application_access", "title": "4. Anwendungszugriff"},
            {"key": "risks", "title": "5. Risiken & Empfehlungen"}
        ]
    }',
    '{
        "ad_structure": "ad",
        "file_permissions": "permissions",
        "risks": "permission_risks"
    }'
)
ON CONFLICT DO NOTHING;

SELECT 'Documentation module schema created successfully!' as result;
