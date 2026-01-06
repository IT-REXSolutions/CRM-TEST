-- =====================================================
-- EXAMPLE CUSTOMER DATA FOR IT DOCUMENTATION
-- Customer A: SMB (Small Business)
-- Customer B: Enterprise (Multi-Site)
-- =====================================================

-- =====================================================
-- CUSTOMER A: BEISPIEL SMB GMBH (Small Business)
-- 20 users, 5 servers, 1 fileserver, 2 switches
-- =====================================================

-- First, create/update the organization
INSERT INTO organizations (id, name, short_name, domain, phone, email, notes, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Beispiel SMB GmbH',
    'SMB',
    'smb-beispiel.de',
    '+49 6131 111000',
    'info@smb-beispiel.de',
    'Beispielkunde für IT-Dokumentation - Kleines Unternehmen',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    notes = EXCLUDED.notes;

-- Create a discovery scan for Customer A
INSERT INTO doc_discovery_scans (id, organization_id, scan_type, status, started_at, completed_at, statistics)
VALUES (
    'da000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'full',
    'completed',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour',
    '{
        "servers_found": 5,
        "workstations_found": 15,
        "network_devices_found": 2,
        "ad_users_found": 20,
        "ad_groups_found": 8,
        "shares_found": 4
    }'
);

-- Create inventory snapshot for Customer A
INSERT INTO doc_inventory_snapshots (id, organization_id, scan_id, summary)
VALUES (
    'sa000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'da000000-0000-0000-0000-000000000001',
    '{
        "total_systems": 22,
        "servers": 5,
        "workstations": 15,
        "network_devices": 2,
        "health_status": "healthy",
        "risks_detected": 2
    }'
);

-- Inventory Items - Servers for Customer A
INSERT INTO doc_inventory_items (id, organization_id, snapshot_id, item_type, hostname, fqdn, ip_addresses, mac_addresses, os_name, os_version, os_architecture, manufacturer, model, cpu_info, ram_gb, disk_info, is_online) VALUES
('ia000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'domain_controller', 'SMB-DC01', 'smb-dc01.smb-beispiel.local', '["192.168.1.10"]', '["00:50:56:8A:01:01"]', 'Windows Server 2022', '21H2', 'x64', 'Dell', 'PowerEdge R650', '{"model": "Intel Xeon Silver 4310", "cores": 12, "threads": 24}', 32, '[{"drive": "C:", "size_gb": 100, "free_gb": 45, "type": "SSD"}]', true),
('ia000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'server', 'SMB-FS01', 'smb-fs01.smb-beispiel.local', '["192.168.1.20"]', '["00:50:56:8A:01:02"]', 'Windows Server 2022', '21H2', 'x64', 'Dell', 'PowerEdge R750', '{"model": "Intel Xeon Silver 4314", "cores": 16, "threads": 32}', 64, '[{"drive": "C:", "size_gb": 100, "free_gb": 60, "type": "SSD"}, {"drive": "D:", "size_gb": 2000, "free_gb": 800, "type": "HDD RAID"}]', true),
('ia000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'server', 'SMB-APP01', 'smb-app01.smb-beispiel.local', '["192.168.1.30"]', '["00:50:56:8A:01:03"]', 'Windows Server 2019', '1809', 'x64', 'HPE', 'ProLiant DL380 Gen10', '{"model": "Intel Xeon Gold 5218", "cores": 16, "threads": 32}', 64, '[{"drive": "C:", "size_gb": 200, "free_gb": 120, "type": "SSD"}]', true),
('ia000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'server', 'SMB-SQL01', 'smb-sql01.smb-beispiel.local', '["192.168.1.40"]', '["00:50:56:8A:01:04"]', 'Windows Server 2019', '1809', 'x64', 'Dell', 'PowerEdge R740', '{"model": "Intel Xeon Gold 6230", "cores": 20, "threads": 40}', 128, '[{"drive": "C:", "size_gb": 100, "free_gb": 50, "type": "SSD"}, {"drive": "D:", "size_gb": 500, "free_gb": 200, "type": "NVMe"}]', true),
('ia000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'server', 'SMB-BACKUP01', 'smb-backup01.smb-beispiel.local', '["192.168.1.50"]', '["00:50:56:8A:01:05"]', 'Windows Server 2022', '21H2', 'x64', 'Synology', 'RS1221+', '{"model": "AMD Ryzen V1500B", "cores": 4, "threads": 8}', 32, '[{"drive": "Volume1", "size_gb": 8000, "free_gb": 3500, "type": "RAID6"}]', true);

-- Inventory Items - Workstations (sample)
INSERT INTO doc_inventory_items (id, organization_id, snapshot_id, item_type, hostname, ip_addresses, os_name, os_version, manufacturer, model, ram_gb, is_online) VALUES
('ia000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'workstation', 'SMB-PC001', '["192.168.1.101"]', 'Windows 11 Pro', '23H2', 'Dell', 'OptiPlex 7090', 16, true),
('ia000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'workstation', 'SMB-PC002', '["192.168.1.102"]', 'Windows 11 Pro', '23H2', 'Dell', 'OptiPlex 7090', 16, true),
('ia000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'workstation', 'SMB-PC003', '["192.168.1.103"]', 'Windows 11 Pro', '23H2', 'Lenovo', 'ThinkCentre M920q', 16, true),
('ia000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'workstation', 'SMB-NB001', '["192.168.1.111"]', 'Windows 11 Pro', '23H2', 'Lenovo', 'ThinkPad T14s', 32, true),
('ia000000-0000-0000-0000-000000000105', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'workstation', 'SMB-NB002', '["192.168.1.112"]', 'Windows 11 Pro', '23H2', 'Dell', 'Latitude 5540', 16, true);

-- Server Roles for Customer A
INSERT INTO doc_server_roles (id, inventory_item_id, role_name, role_type, is_installed, status) VALUES
('ra000000-0000-0000-0000-000000000001', 'ia000000-0000-0000-0000-000000000001', 'Active Directory Domain Services', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000002', 'ia000000-0000-0000-0000-000000000001', 'DNS Server', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000003', 'ia000000-0000-0000-0000-000000000001', 'DHCP Server', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000004', 'ia000000-0000-0000-0000-000000000002', 'File and Storage Services', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000005', 'ia000000-0000-0000-0000-000000000002', 'Print Services', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000006', 'ia000000-0000-0000-0000-000000000003', 'Web Server (IIS)', 'role', true, 'Running'),
('ra000000-0000-0000-0000-000000000007', 'ia000000-0000-0000-0000-000000000004', 'SQL Server 2019', 'feature', true, 'Running'),
('ra000000-0000-0000-0000-000000000008', 'ia000000-0000-0000-0000-000000000005', 'Windows Server Backup', 'feature', true, 'Running');

-- AD Domain for Customer A
INSERT INTO doc_ad_domains (id, organization_id, snapshot_id, domain_name, netbios_name, forest_name, domain_functional_level, domain_controllers, sites)
VALUES (
    'ad000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'sa000000-0000-0000-0000-000000000001',
    'smb-beispiel.local',
    'SMB',
    'smb-beispiel.local',
    'Windows Server 2016',
    '["SMB-DC01"]',
    '["Default-First-Site-Name"]'
);

-- AD Users for Customer A (20 users)
INSERT INTO doc_ad_users (id, domain_id, sam_account_name, user_principal_name, display_name, email, ou_path, is_enabled, member_of) VALUES
('ua000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'administrator', 'administrator@smb-beispiel.local', 'Administrator', 'admin@smb-beispiel.de', 'OU=Admin,DC=smb-beispiel,DC=local', true, '["Domain Admins", "Enterprise Admins"]'),
('ua000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000001', 'mmueller', 'mmueller@smb-beispiel.local', 'Max Müller', 'mmueller@smb-beispiel.de', 'OU=Geschaeftsfuehrung,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["GF-Gruppe", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'sschmidt', 'sschmidt@smb-beispiel.local', 'Sandra Schmidt', 'sschmidt@smb-beispiel.de', 'OU=Buchhaltung,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Buchhaltung", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000001', 'tweber', 'tweber@smb-beispiel.local', 'Thomas Weber', 'tweber@smb-beispiel.de', 'OU=IT,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["IT-Admins", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000005', 'ad000000-0000-0000-0000-000000000001', 'afischer', 'afischer@smb-beispiel.local', 'Anna Fischer', 'afischer@smb-beispiel.de', 'OU=Vertrieb,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Vertrieb", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000006', 'ad000000-0000-0000-0000-000000000001', 'pmeier', 'pmeier@smb-beispiel.local', 'Peter Meier', 'pmeier@smb-beispiel.de', 'OU=Vertrieb,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Vertrieb", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000007', 'ad000000-0000-0000-0000-000000000001', 'kbauer', 'kbauer@smb-beispiel.local', 'Klaus Bauer', 'kbauer@smb-beispiel.de', 'OU=Produktion,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Produktion", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000008', 'ad000000-0000-0000-0000-000000000001', 'lschulz', 'lschulz@smb-beispiel.local', 'Lisa Schulz', 'lschulz@smb-beispiel.de', 'OU=Buchhaltung,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Buchhaltung", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000009', 'ad000000-0000-0000-0000-000000000001', 'mhoffmann', 'mhoffmann@smb-beispiel.local', 'Michael Hoffmann', 'mhoffmann@smb-beispiel.de', 'OU=IT,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["IT-Admins", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000010', 'ad000000-0000-0000-0000-000000000001', 'jkoch', 'jkoch@smb-beispiel.local', 'Julia Koch', 'jkoch@smb-beispiel.de', 'OU=Personal,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Personal", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000011', 'ad000000-0000-0000-0000-000000000001', 'frichter', 'frichter@smb-beispiel.local', 'Frank Richter', 'frichter@smb-beispiel.de', 'OU=Produktion,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Produktion", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000012', 'ad000000-0000-0000-0000-000000000001', 'swolf', 'swolf@smb-beispiel.local', 'Sabine Wolf', 'swolf@smb-beispiel.de', 'OU=Vertrieb,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Vertrieb", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000013', 'ad000000-0000-0000-0000-000000000001', 'dbraun', 'dbraun@smb-beispiel.local', 'Daniel Braun', 'dbraun@smb-beispiel.de', 'OU=Produktion,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Produktion", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000014', 'ad000000-0000-0000-0000-000000000001', 'nkeller', 'nkeller@smb-beispiel.local', 'Nina Keller', 'nkeller@smb-beispiel.de', 'OU=Marketing,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Marketing", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000015', 'ad000000-0000-0000-0000-000000000001', 'rschroeder', 'rschroeder@smb-beispiel.local', 'Robert Schröder', 'rschroeder@smb-beispiel.de', 'OU=Produktion,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Produktion", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000016', 'ad000000-0000-0000-0000-000000000001', 'cneumann', 'cneumann@smb-beispiel.local', 'Claudia Neumann', 'cneumann@smb-beispiel.de', 'OU=Personal,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Personal", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000017', 'ad000000-0000-0000-0000-000000000001', 'mschwarz', 'mschwarz@smb-beispiel.local', 'Martin Schwarz', 'mschwarz@smb-beispiel.de', 'OU=Vertrieb,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Vertrieb", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000018', 'ad000000-0000-0000-0000-000000000001', 'ezimmermann', 'ezimmermann@smb-beispiel.local', 'Eva Zimmermann', 'ezimmermann@smb-beispiel.de', 'OU=Marketing,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Marketing", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000019', 'ad000000-0000-0000-0000-000000000001', 'hkrueger', 'hkrueger@smb-beispiel.local', 'Hans Krüger', 'hkrueger@smb-beispiel.de', 'OU=Produktion,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Produktion", "Alle Mitarbeiter"]'),
('ua000000-0000-0000-0000-000000000020', 'ad000000-0000-0000-0000-000000000001', 'bhart', 'bhart@smb-beispiel.local', 'Birgit Hart', 'bhart@smb-beispiel.de', 'OU=Buchhaltung,OU=Benutzer,DC=smb-beispiel,DC=local', true, '["Buchhaltung", "Alle Mitarbeiter"]');

-- AD Groups for Customer A
INSERT INTO doc_ad_groups (id, domain_id, sam_account_name, display_name, group_scope, group_type, description, members) VALUES
('ga000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'Domain Admins', 'Domain Admins', 'Global', 'Security', 'Domänen-Administratoren', '["administrator"]'),
('ga000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000001', 'IT-Admins', 'IT-Administratoren', 'Global', 'Security', 'IT-Abteilung mit Admin-Rechten', '["tweber", "mhoffmann"]'),
('ga000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'Alle Mitarbeiter', 'Alle Mitarbeiter', 'Global', 'Security', 'Alle Mitarbeiter des Unternehmens', '["mmueller", "sschmidt", "tweber", "afischer", "pmeier", "kbauer", "lschulz", "mhoffmann", "jkoch", "frichter", "swolf", "dbraun", "nkeller", "rschroeder", "cneumann", "mschwarz", "ezimmermann", "hkrueger", "bhart"]'),
('ga000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000001', 'GF-Gruppe', 'Geschäftsführung', 'Global', 'Security', 'Geschäftsführung', '["mmueller"]'),
('ga000000-0000-0000-0000-000000000005', 'ad000000-0000-0000-0000-000000000001', 'Buchhaltung', 'Buchhaltung', 'Global', 'Security', 'Buchhaltungsabteilung', '["sschmidt", "lschulz", "bhart"]'),
('ga000000-0000-0000-0000-000000000006', 'ad000000-0000-0000-0000-000000000001', 'Vertrieb', 'Vertrieb', 'Global', 'Security', 'Vertriebsabteilung', '["afischer", "pmeier", "swolf", "mschwarz"]'),
('ga000000-0000-0000-0000-000000000007', 'ad000000-0000-0000-0000-000000000001', 'Produktion', 'Produktion', 'Global', 'Security', 'Produktionsabteilung', '["kbauer", "frichter", "dbraun", "rschroeder", "hkrueger"]'),
('ga000000-0000-0000-0000-000000000008', 'ad000000-0000-0000-0000-000000000001', 'Personal', 'Personal', 'Global', 'Security', 'Personalabteilung', '["jkoch", "cneumann"]');

-- Network Devices for Customer A
INSERT INTO doc_network_devices (id, organization_id, snapshot_id, device_type, hostname, ip_address, mac_address, manufacturer, model, sys_name, sys_description, sys_location, management_vlan) VALUES
('na000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'switch', 'SMB-SW01', '192.168.1.2', '00:1A:2B:3C:4D:01', 'Cisco', 'Catalyst 2960-24', 'SMB-SW01', 'Cisco IOS Software, C2960 Software', 'Serverraum Rack 1', 1),
('na000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'switch', 'SMB-SW02', '192.168.1.3', '00:1A:2B:3C:4D:02', 'Cisco', 'Catalyst 2960-48', 'SMB-SW02', 'Cisco IOS Software, C2960 Software', 'Büro Etage 1', 1);

-- VLANs for Customer A
INSERT INTO doc_vlans (id, organization_id, snapshot_id, vlan_id, vlan_name, description, subnet, gateway, dhcp_enabled) VALUES
('va000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 1, 'Default', 'Management VLAN', '192.168.1.0/24', '192.168.1.1', true),
('va000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 10, 'Server', 'Server VLAN', '192.168.10.0/24', '192.168.10.1', false),
('va000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 20, 'Clients', 'Client PCs', '192.168.20.0/24', '192.168.20.1', true);

-- File Shares for Customer A
INSERT INTO doc_file_shares (id, inventory_item_id, share_name, share_path, local_path, description, share_permissions) VALUES
('fa000000-0000-0000-0000-000000000001', 'ia000000-0000-0000-0000-000000000002', 'Daten$', '\\\\SMB-FS01\\Daten$', 'D:\\Daten', 'Hauptdatenfreigabe', '[{"identity": "Alle Mitarbeiter", "access": "Change"}, {"identity": "IT-Admins", "access": "Full Control"}]'),
('fa000000-0000-0000-0000-000000000002', 'ia000000-0000-0000-0000-000000000002', 'Buchhaltung$', '\\\\SMB-FS01\\Buchhaltung$', 'D:\\Buchhaltung', 'Buchhaltungsdaten', '[{"identity": "Buchhaltung", "access": "Change"}, {"identity": "GF-Gruppe", "access": "Read"}, {"identity": "IT-Admins", "access": "Full Control"}]'),
('fa000000-0000-0000-0000-000000000003', 'ia000000-0000-0000-0000-000000000002', 'Personal$', '\\\\SMB-FS01\\Personal$', 'D:\\Personal', 'Personalakten', '[{"identity": "Personal", "access": "Change"}, {"identity": "GF-Gruppe", "access": "Read"}, {"identity": "IT-Admins", "access": "Full Control"}]'),
('fa000000-0000-0000-0000-000000000004', 'ia000000-0000-0000-0000-000000000002', 'Public', '\\\\SMB-FS01\\Public', 'D:\\Public', 'Öffentliche Dokumente', '[{"identity": "Everyone", "access": "Read"}, {"identity": "Alle Mitarbeiter", "access": "Change"}]');

-- NTFS Permissions with risk detection
INSERT INTO doc_ntfs_permissions (id, file_share_id, path, owner, permissions, has_everyone_access, has_domain_users_access, has_full_control_risk, risk_level) VALUES
('pa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'D:\\Daten', 'BUILTIN\\Administrators', '[{"identity": "SMB\\Alle Mitarbeiter", "access_type": "Allow", "rights": "Modify", "inheritance": "ThisFolderSubfoldersAndFiles"}]', false, false, false, 'low'),
('pa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002', 'D:\\Buchhaltung', 'BUILTIN\\Administrators', '[{"identity": "SMB\\Buchhaltung", "access_type": "Allow", "rights": "Modify", "inheritance": "ThisFolderSubfoldersAndFiles"}]', false, false, false, 'low'),
('pa000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000004', 'D:\\Public', 'BUILTIN\\Administrators', '[{"identity": "Everyone", "access_type": "Allow", "rights": "Read", "inheritance": "ThisFolderSubfoldersAndFiles"}, {"identity": "SMB\\Alle Mitarbeiter", "access_type": "Allow", "rights": "Modify", "inheritance": "ThisFolderSubfoldersAndFiles"}]', true, false, false, 'medium');

-- Topology Links for Customer A
INSERT INTO doc_topology_links (id, organization_id, snapshot_id, source_device_id, source_type, target_device_id, target_type, link_type, discovered_via) VALUES
('la000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'switch', 'na000000-0000-0000-0000-000000000002', 'switch', 'ethernet', 'lldp'),
('la000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'switch', 'ia000000-0000-0000-0000-000000000001', 'server', 'ethernet', 'arp'),
('la000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'switch', 'ia000000-0000-0000-0000-000000000002', 'server', 'ethernet', 'arp'),
('la000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'switch', 'ia000000-0000-0000-0000-000000000003', 'server', 'ethernet', 'arp'),
('la000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'sa000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'switch', 'ia000000-0000-0000-0000-000000000004', 'server', 'ethernet', 'arp');


-- =====================================================
-- CUSTOMER B: ENTERPRISE AG (Multi-Site)
-- Multiple sites, VLANs, SQL + Exchange
-- =====================================================

INSERT INTO organizations (id, name, short_name, domain, phone, email, notes, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Enterprise AG',
    'ENT',
    'enterprise-ag.de',
    '+49 69 555000',
    'info@enterprise-ag.de',
    'Beispielkunde für IT-Dokumentation - Großunternehmen mit mehreren Standorten',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    notes = EXCLUDED.notes;

-- Discovery scan for Customer B
INSERT INTO doc_discovery_scans (id, organization_id, scan_type, status, started_at, completed_at, statistics)
VALUES (
    'db000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'full',
    'completed',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '2 hours',
    '{
        "servers_found": 25,
        "workstations_found": 150,
        "network_devices_found": 15,
        "ad_users_found": 200,
        "ad_groups_found": 45,
        "shares_found": 20,
        "sites_scanned": 3
    }'
);

-- Inventory snapshot for Customer B
INSERT INTO doc_inventory_snapshots (id, organization_id, scan_id, summary)
VALUES (
    'sb000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'db000000-0000-0000-0000-000000000001',
    '{
        "total_systems": 190,
        "servers": 25,
        "workstations": 150,
        "network_devices": 15,
        "sites": ["Frankfurt (HQ)", "München", "Berlin"],
        "health_status": "warning",
        "risks_detected": 8
    }'
);

-- Servers for Customer B (main ones)
INSERT INTO doc_inventory_items (id, organization_id, snapshot_id, item_type, hostname, fqdn, ip_addresses, os_name, os_version, manufacturer, model, ram_gb, is_online, raw_data) VALUES
('ib000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'domain_controller', 'ENT-DC01', 'ent-dc01.enterprise.local', '["10.0.1.10"]', 'Windows Server 2022', '21H2', 'Dell', 'PowerEdge R750', 64, true, '{"site": "Frankfurt"}'),
('ib000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'domain_controller', 'ENT-DC02', 'ent-dc02.enterprise.local', '["10.0.2.10"]', 'Windows Server 2022', '21H2', 'Dell', 'PowerEdge R750', 64, true, '{"site": "München"}'),
('ib000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'domain_controller', 'ENT-DC03', 'ent-dc03.enterprise.local', '["10.0.3.10"]', 'Windows Server 2022', '21H2', 'HPE', 'ProLiant DL380', 64, true, '{"site": "Berlin"}'),
('ib000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'server', 'ENT-EX01', 'ent-ex01.enterprise.local', '["10.0.1.20"]', 'Windows Server 2019', '1809', 'Dell', 'PowerEdge R750', 128, true, '{"site": "Frankfurt", "role": "Exchange"}'),
('ib000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'server', 'ENT-SQL01', 'ent-sql01.enterprise.local', '["10.0.1.30"]', 'Windows Server 2019', '1809', 'Dell', 'PowerEdge R750', 256, true, '{"site": "Frankfurt", "role": "SQL Server"}'),
('ib000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'server', 'ENT-FS01', 'ent-fs01.enterprise.local', '["10.0.1.40"]', 'Windows Server 2022', '21H2', 'Dell', 'PowerEdge R750', 64, true, '{"site": "Frankfurt", "role": "File Server"}'),
('ib000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'server', 'ENT-FS02', 'ent-fs02.enterprise.local', '["10.0.2.40"]', 'Windows Server 2022', '21H2', 'HPE', 'ProLiant DL380', 64, true, '{"site": "München", "role": "File Server"}'),
('ib000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'server', 'ENT-WEB01', 'ent-web01.enterprise.local', '["10.0.1.50"]', 'Windows Server 2022', '21H2', 'Dell', 'PowerEdge R650', 32, true, '{"site": "Frankfurt", "role": "Web Server"}');

-- Server Roles for Customer B
INSERT INTO doc_server_roles (id, inventory_item_id, role_name, role_type, is_installed, status) VALUES
('rb000000-0000-0000-0000-000000000001', 'ib000000-0000-0000-0000-000000000001', 'Active Directory Domain Services', 'role', true, 'Running'),
('rb000000-0000-0000-0000-000000000002', 'ib000000-0000-0000-0000-000000000001', 'DNS Server', 'role', true, 'Running'),
('rb000000-0000-0000-0000-000000000003', 'ib000000-0000-0000-0000-000000000004', 'Exchange Server 2019', 'feature', true, 'Running'),
('rb000000-0000-0000-0000-000000000004', 'ib000000-0000-0000-0000-000000000005', 'SQL Server 2019 Enterprise', 'feature', true, 'Running'),
('rb000000-0000-0000-0000-000000000005', 'ib000000-0000-0000-0000-000000000006', 'File and Storage Services', 'role', true, 'Running'),
('rb000000-0000-0000-0000-000000000006', 'ib000000-0000-0000-0000-000000000006', 'DFS Namespaces', 'feature', true, 'Running'),
('rb000000-0000-0000-0000-000000000007', 'ib000000-0000-0000-0000-000000000008', 'Web Server (IIS)', 'role', true, 'Running');

-- AD Domain for Customer B
INSERT INTO doc_ad_domains (id, organization_id, snapshot_id, domain_name, netbios_name, forest_name, domain_functional_level, domain_controllers, sites)
VALUES (
    'adb00000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'sb000000-0000-0000-0000-000000000001',
    'enterprise.local',
    'ENTERPRISE',
    'enterprise.local',
    'Windows Server 2016',
    '["ENT-DC01", "ENT-DC02", "ENT-DC03"]',
    '["Frankfurt-HQ", "Muenchen", "Berlin"]'
);

-- Network Devices for Customer B
INSERT INTO doc_network_devices (id, organization_id, snapshot_id, device_type, hostname, ip_address, manufacturer, model, sys_location, management_vlan) VALUES
('nb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'switch', 'ENT-CORE-SW01', '10.0.1.2', 'Cisco', 'Nexus 9300', 'Frankfurt DC', 1),
('nb000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'switch', 'ENT-CORE-SW02', '10.0.1.3', 'Cisco', 'Nexus 9300', 'Frankfurt DC', 1),
('nb000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'firewall', 'ENT-FW01', '10.0.1.1', 'Fortinet', 'FortiGate 200F', 'Frankfurt DC', 1),
('nb000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'switch', 'ENT-MUC-SW01', '10.0.2.2', 'Cisco', 'Catalyst 9300', 'München Office', 1),
('nb000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'switch', 'ENT-BER-SW01', '10.0.3.2', 'Cisco', 'Catalyst 9300', 'Berlin Office', 1),
('nb000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'router', 'ENT-MUC-RTR01', '10.0.2.1', 'Cisco', 'ISR 4431', 'München Office', 1),
('nb000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 'router', 'ENT-BER-RTR01', '10.0.3.1', 'Cisco', 'ISR 4431', 'Berlin Office', 1);

-- VLANs for Customer B
INSERT INTO doc_vlans (id, organization_id, snapshot_id, vlan_id, vlan_name, description, subnet, gateway) VALUES
('vb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 1, 'Management', 'Management VLAN', '10.0.0.0/24', '10.0.0.1'),
('vb000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 10, 'FRA-Server', 'Frankfurt Server VLAN', '10.0.1.0/24', '10.0.1.1'),
('vb000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 20, 'FRA-Clients', 'Frankfurt Client VLAN', '10.0.10.0/24', '10.0.10.1'),
('vb000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 100, 'MUC-Server', 'München Server VLAN', '10.0.2.0/24', '10.0.2.1'),
('vb000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 110, 'MUC-Clients', 'München Client VLAN', '10.0.20.0/24', '10.0.20.1'),
('vb000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 200, 'BER-Server', 'Berlin Server VLAN', '10.0.3.0/24', '10.0.3.1'),
('vb000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 210, 'BER-Clients', 'Berlin Client VLAN', '10.0.30.0/24', '10.0.30.1'),
('vb000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'sb000000-0000-0000-0000-000000000001', 500, 'DMZ', 'Demilitarized Zone', '10.0.100.0/24', '10.0.100.1');

-- File Shares with permission risks for Customer B
INSERT INTO doc_file_shares (id, inventory_item_id, share_name, share_path, local_path, description, share_permissions) VALUES
('fb000000-0000-0000-0000-000000000001', 'ib000000-0000-0000-0000-000000000006', 'Unternehmensdaten', '\\\\ENT-FS01\\Unternehmensdaten', 'D:\\Daten', 'Hauptfreigabe', '[{"identity": "Domain Users", "access": "Change"}]'),
('fb000000-0000-0000-0000-000000000002', 'ib000000-0000-0000-0000-000000000006', 'Finanzen', '\\\\ENT-FS01\\Finanzen', 'D:\\Finanzen', 'Finanzdaten', '[{"identity": "FIN-Gruppe", "access": "Change"}]'),
('fb000000-0000-0000-0000-000000000003', 'ib000000-0000-0000-0000-000000000006', 'Temp', '\\\\ENT-FS01\\Temp', 'D:\\Temp', 'Temporäre Dateien', '[{"identity": "Everyone", "access": "Full Control"}]');

-- Permission risks for Customer B
INSERT INTO doc_ntfs_permissions (id, file_share_id, path, permissions, has_everyone_access, has_domain_users_access, has_full_control_risk, risk_level) VALUES
('pb000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000001', 'D:\\Daten', '[{"identity": "ENTERPRISE\\Domain Users", "access_type": "Allow", "rights": "Modify"}]', false, true, false, 'medium'),
('pb000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-000000000003', 'D:\\Temp', '[{"identity": "Everyone", "access_type": "Allow", "rights": "Full Control"}]', true, false, true, 'critical');

SELECT 'Example customer data created successfully!' as result;
