import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Seed data function
async function seedDatabase() {
  const results = []
  
  // 1. Create Roles
  console.log('Creating roles...')
  const roles = [
    { id: '10000000-0000-0000-0000-000000000001', name: 'admin', display_name: 'Administrator', description: 'Vollzugriff auf alle Funktionen', is_system: true },
    { id: '10000000-0000-0000-0000-000000000002', name: 'agent', display_name: 'Agent', description: 'Support-Mitarbeiter mit Ticket-Zugriff', is_system: true },
    { id: '10000000-0000-0000-0000-000000000003', name: 'technician', display_name: 'Techniker', description: 'Techniker mit Asset- und Ticket-Zugriff', is_system: true },
    { id: '10000000-0000-0000-0000-000000000004', name: 'accounting', display_name: 'Buchhaltung', description: 'Zugriff auf Zeiterfassung und Rechnungen', is_system: true },
    { id: '10000000-0000-0000-0000-000000000005', name: 'customer', display_name: 'Kunde', description: 'Eingeschränkter Zugriff über Kundenportal', is_system: true },
  ]
  
  for (const role of roles) {
    const { error } = await supabaseAdmin.from('roles').upsert(role, { onConflict: 'name' })
    if (error && !error.message.includes('duplicate')) {
      results.push({ table: 'roles', item: role.name, error: error.message })
    }
  }
  results.push({ table: 'roles', status: 'done', count: roles.length })

  // 2. Create SLA Profiles
  console.log('Creating SLA profiles...')
  const slaProfiles = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'Standard', description: 'Standard-SLA für alle Kunden', response_time_minutes: 240, resolution_time_minutes: 1440, business_hours_only: true, is_default: true },
    { id: '20000000-0000-0000-0000-000000000002', name: 'Premium', description: 'Premium-SLA mit schnellerer Reaktion', response_time_minutes: 60, resolution_time_minutes: 480, business_hours_only: true, is_default: false },
    { id: '20000000-0000-0000-0000-000000000003', name: 'Enterprise', description: '24/7 Enterprise-Support', response_time_minutes: 30, resolution_time_minutes: 240, business_hours_only: false, is_default: false },
  ]
  
  for (const sla of slaProfiles) {
    const { error } = await supabaseAdmin.from('sla_profiles').upsert(sla, { onConflict: 'id' })
    if (error && !error.message.includes('duplicate')) {
      results.push({ table: 'sla_profiles', item: sla.name, error: error.message })
    }
  }
  results.push({ table: 'sla_profiles', status: 'done', count: slaProfiles.length })

  // 3. Create Ticket Tags
  console.log('Creating ticket tags...')
  const tags = [
    { id: '30000000-0000-0000-0000-000000000001', name: 'Dringend', color: '#EF4444' },
    { id: '30000000-0000-0000-0000-000000000002', name: 'Wartung', color: '#F59E0B' },
    { id: '30000000-0000-0000-0000-000000000003', name: 'Netzwerk', color: '#3B82F6' },
    { id: '30000000-0000-0000-0000-000000000004', name: 'Hardware', color: '#10B981' },
    { id: '30000000-0000-0000-0000-000000000005', name: 'Software', color: '#8B5CF6' },
    { id: '30000000-0000-0000-0000-000000000006', name: 'Sicherheit', color: '#EC4899' },
  ]
  
  for (const tag of tags) {
    const { error } = await supabaseAdmin.from('ticket_tags').upsert(tag, { onConflict: 'name' })
    if (error && !error.message.includes('duplicate')) {
      results.push({ table: 'ticket_tags', item: tag.name, error: error.message })
    }
  }
  results.push({ table: 'ticket_tags', status: 'done', count: tags.length })

  // 4. Create Asset Types
  console.log('Creating asset types...')
  const assetTypes = [
    { id: '40000000-0000-0000-0000-000000000001', name: 'Computer', icon: 'monitor', description: 'Desktop-Computer und Workstations' },
    { id: '40000000-0000-0000-0000-000000000002', name: 'Laptop', icon: 'laptop', description: 'Notebooks und Laptops' },
    { id: '40000000-0000-0000-0000-000000000003', name: 'Server', icon: 'server', description: 'Server und virtuelle Maschinen' },
    { id: '40000000-0000-0000-0000-000000000004', name: 'Drucker', icon: 'printer', description: 'Drucker und Multifunktionsgeräte' },
    { id: '40000000-0000-0000-0000-000000000005', name: 'Netzwerk', icon: 'network', description: 'Router, Switches, Access Points' },
    { id: '40000000-0000-0000-0000-000000000006', name: 'Telefon', icon: 'phone', description: 'Telefone und Kommunikationsgeräte' },
    { id: '40000000-0000-0000-0000-000000000007', name: 'Monitor', icon: 'monitor', description: 'Bildschirme und Displays' },
    { id: '40000000-0000-0000-0000-000000000008', name: 'Sonstiges', icon: 'box', description: 'Sonstige IT-Geräte' },
  ]
  
  for (const type of assetTypes) {
    const { error } = await supabaseAdmin.from('asset_types').upsert(type, { onConflict: 'name' })
    if (error && !error.message.includes('duplicate')) {
      results.push({ table: 'asset_types', item: type.name, error: error.message })
    }
  }
  results.push({ table: 'asset_types', status: 'done', count: assetTypes.length })

  // 5. Create Demo User
  console.log('Creating demo user...')
  const demoUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@servicedesk.de',
    first_name: 'Admin',
    last_name: 'User',
    user_type: 'internal',
    is_active: true,
  }
  
  const { error: userError } = await supabaseAdmin.from('users').upsert(demoUser, { onConflict: 'email' })
  if (userError && !userError.message.includes('duplicate')) {
    results.push({ table: 'users', error: userError.message })
  }
  results.push({ table: 'users', status: 'done', count: 1 })

  // 6. Create Demo Organization
  console.log('Creating demo organization...')
  const demoOrg = {
    id: '50000000-0000-0000-0000-000000000001',
    name: 'Demo GmbH',
    short_name: 'DEMO',
    email: 'info@demo.de',
    phone: '+49 123 456789',
    website: 'https://demo.de',
    is_active: true,
  }
  
  const { error: orgError } = await supabaseAdmin.from('organizations').upsert(demoOrg, { onConflict: 'id' })
  if (orgError && !orgError.message.includes('duplicate')) {
    results.push({ table: 'organizations', error: orgError.message })
  }
  results.push({ table: 'organizations', status: 'done', count: 1 })

  return results
}

export async function GET() {
  try {
    // First check if tables exist by trying to query roles
    const { data: rolesCheck, error: checkError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .limit(1)
    
    if (checkError) {
      return NextResponse.json({
        success: false,
        error: 'Tables do not exist',
        message: 'Please run the SQL schema in Supabase SQL Editor first',
        sqlEditorUrl: `https://supabase.com/dashboard/project/sxjeggcwmhdplqobvjje/sql/new`,
        schemaFile: '/scripts/setup-db.js contains the full SQL schema',
      }, { status: 400 })
    }
    
    // Tables exist, seed the data
    const results = await seedDatabase()
    
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      results,
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
