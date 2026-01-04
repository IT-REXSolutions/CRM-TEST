import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Supabase Admin Client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// ============================================
// API HANDLERS
// ============================================

// --- INIT: Create Database Schema ---
async function handleInit() {
  try {
    // Import schema SQL
    const { default: SCHEMA_SQL } = await import('@/lib/schema.js')
    
    // Execute schema (split by statements)
    const statements = SCHEMA_SQL.split(';').filter(s => s.trim())
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt + ';' }).catch(() => ({ error: 'RPC not available' }))
        // We'll try direct query method instead
      }
    }
    
    // For now, return instructions to run SQL manually
    return NextResponse.json({ 
      success: true, 
      message: 'Schema bereit. Bitte führen Sie das SQL-Schema in Supabase SQL Editor aus.',
      schemaUrl: 'Gehen Sie zu Supabase Dashboard -> SQL Editor'
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// --- USERS ---
async function handleGetUsers() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      *,
      user_roles (
        role_id,
        roles (name, display_name)
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateUser(body) {
  const { email, first_name, last_name, phone, user_type, role_id } = body
  
  if (!email || !first_name || !last_name) {
    return NextResponse.json({ error: 'email, first_name, last_name sind erforderlich' }, { status: 400 })
  }
  
  const userData = {
    id: uuidv4(),
    email,
    first_name,
    last_name,
    phone: phone || null,
    user_type: user_type || 'internal',
  }
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([userData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Assign role if provided
  if (role_id) {
    await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: data.id, role_id }])
  }
  
  return NextResponse.json(data)
}

async function handleUpdateUser(id, body) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// --- ROLES ---
async function handleGetRoles() {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// --- ORGANIZATIONS ---
async function handleGetOrganizations() {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select(`
      *,
      locations (*),
      contacts (*),
      contracts (
        *,
        sla_profiles (*)
      )
    `)
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateOrganization(body) {
  const { name, short_name, domain, phone, email, website, notes } = body
  
  if (!name) {
    return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  }
  
  const orgData = {
    id: uuidv4(),
    name,
    short_name: short_name || null,
    domain: domain || null,
    phone: phone || null,
    email: email || null,
    website: website || null,
    notes: notes || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert([orgData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateOrganization(id, body) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteOrganization(id) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// --- CONTACTS ---
async function handleGetContacts(orgId) {
  let query = supabaseAdmin
    .from('contacts')
    .select(`
      *,
      organizations (name),
      locations (name)
    `)
  
  if (orgId) {
    query = query.eq('organization_id', orgId)
  }
  
  const { data, error } = await query.order('last_name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateContact(body) {
  const { organization_id, first_name, last_name, email, phone, position } = body
  
  if (!organization_id || !first_name || !last_name) {
    return NextResponse.json({ error: 'organization_id, first_name, last_name sind erforderlich' }, { status: 400 })
  }
  
  const contactData = {
    id: uuidv4(),
    organization_id,
    first_name,
    last_name,
    email: email || null,
    phone: phone || null,
    position: position || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert([contactData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// --- LOCATIONS ---
async function handleCreateLocation(body) {
  const { organization_id, name, address_line1, postal_code, city } = body
  
  if (!organization_id || !name) {
    return NextResponse.json({ error: 'organization_id, name sind erforderlich' }, { status: 400 })
  }
  
  const locationData = {
    id: uuidv4(),
    organization_id,
    name,
    address_line1: address_line1 || null,
    postal_code: postal_code || null,
    city: city || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('locations')
    .insert([locationData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// --- SLA PROFILES ---
async function handleGetSLAProfiles() {
  const { data, error } = await supabaseAdmin
    .from('sla_profiles')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// --- TICKETS ---
async function handleGetTickets(params) {
  let query = supabaseAdmin
    .from('tickets')
    .select(`
      *,
      organizations (id, name),
      contacts (id, first_name, last_name, email),
      assignee:users!tickets_assignee_id_fkey (id, first_name, last_name, email),
      creator:users!tickets_created_by_id_fkey (id, first_name, last_name),
      sla_profiles (name, response_time_minutes, resolution_time_minutes),
      ticket_tag_relations (
        ticket_tags (id, name, color)
      ),
      ticket_comments (count)
    `)
  
  // Apply filters
  if (params.status) query = query.eq('status', params.status)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.assignee_id) query = query.eq('assignee_id', params.assignee_id)
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleGetTicket(id) {
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select(`
      *,
      organizations (id, name, phone, email),
      contacts (id, first_name, last_name, email, phone),
      assignee:users!tickets_assignee_id_fkey (id, first_name, last_name, email),
      creator:users!tickets_created_by_id_fkey (id, first_name, last_name),
      sla_profiles (*),
      ticket_tag_relations (
        ticket_tags (id, name, color)
      ),
      ticket_comments (
        *,
        users (id, first_name, last_name)
      ),
      ticket_attachments (*),
      ticket_history (
        *,
        users (first_name, last_name)
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleCreateTicket(body) {
  const { 
    subject, description, priority, status, category, type,
    organization_id, contact_id, assignee_id, created_by_id,
    sla_profile_id, tags
  } = body
  
  if (!subject || !created_by_id) {
    return NextResponse.json({ error: 'subject, created_by_id sind erforderlich' }, { status: 400 })
  }
  
  // Calculate SLA due dates if SLA profile provided
  let sla_response_due = null
  let sla_resolution_due = null
  
  if (sla_profile_id) {
    const { data: slaProfile } = await supabaseAdmin
      .from('sla_profiles')
      .select('*')
      .eq('id', sla_profile_id)
      .single()
    
    if (slaProfile) {
      const now = new Date()
      sla_response_due = new Date(now.getTime() + slaProfile.response_time_minutes * 60000).toISOString()
      sla_resolution_due = new Date(now.getTime() + slaProfile.resolution_time_minutes * 60000).toISOString()
    }
  }
  
  const ticketData = {
    id: uuidv4(),
    subject,
    description: description || null,
    priority: priority || 'medium',
    status: status || 'open',
    category: category || null,
    type: type || 'incident',
    organization_id: organization_id || null,
    contact_id: contact_id || null,
    assignee_id: assignee_id || null,
    created_by_id,
    sla_profile_id: sla_profile_id || null,
    sla_response_due,
    sla_resolution_due,
  }
  
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert([ticketData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Add tags if provided
  if (tags && tags.length > 0) {
    const tagRelations = tags.map(tag_id => ({
      ticket_id: data.id,
      tag_id
    }))
    await supabaseAdmin.from('ticket_tag_relations').insert(tagRelations)
  }
  
  // Create history entry
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: data.id,
    user_id: created_by_id,
    action: 'created',
    new_value: subject,
  }])
  
  return NextResponse.json(data)
}

async function handleUpdateTicket(id, body, userId) {
  // Get current ticket for history
  const { data: currentTicket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()
  
  // Track changes for history
  const changes = []
  const fieldsToTrack = ['status', 'priority', 'assignee_id', 'subject']
  
  for (const field of fieldsToTrack) {
    if (body[field] !== undefined && body[field] !== currentTicket[field]) {
      changes.push({
        id: uuidv4(),
        ticket_id: id,
        user_id: userId,
        action: field === 'status' ? 'status_changed' : field === 'assignee_id' ? 'assigned' : 'updated',
        field_name: field,
        old_value: String(currentTicket[field] || ''),
        new_value: String(body[field] || ''),
      })
    }
  }
  
  // Handle resolution
  if (body.status === 'resolved' && currentTicket.status !== 'resolved') {
    body.resolved_at = new Date().toISOString()
    body.sla_resolution_met = currentTicket.sla_resolution_due 
      ? new Date() <= new Date(currentTicket.sla_resolution_due)
      : null
  }
  
  // Handle first response
  if (!currentTicket.first_response_at && body.assignee_id && body.assignee_id !== currentTicket.assignee_id) {
    body.first_response_at = new Date().toISOString()
    body.sla_response_met = currentTicket.sla_response_due
      ? new Date() <= new Date(currentTicket.sla_response_due)
      : null
  }
  
  const { error } = await supabaseAdmin
    .from('tickets')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Insert history entries
  if (changes.length > 0) {
    await supabaseAdmin.from('ticket_history').insert(changes)
  }
  
  return NextResponse.json({ success: true })
}

async function handleDeleteTicket(id) {
  const { error } = await supabaseAdmin
    .from('tickets')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// --- TICKET COMMENTS ---
async function handleCreateComment(body) {
  const { ticket_id, user_id, content, is_internal } = body
  
  if (!ticket_id || !user_id || !content) {
    return NextResponse.json({ error: 'ticket_id, user_id, content sind erforderlich' }, { status: 400 })
  }
  
  const commentData = {
    id: uuidv4(),
    ticket_id,
    user_id,
    content,
    is_internal: is_internal || false,
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_comments')
    .insert([commentData])
    .select(`
      *,
      users (id, first_name, last_name)
    `)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Add history entry
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id,
    user_id,
    action: 'commented',
    new_value: is_internal ? '[Interne Notiz]' : content.substring(0, 100),
  }])
  
  return NextResponse.json(data)
}

// --- TICKET TAGS ---
async function handleGetTags() {
  const { data, error } = await supabaseAdmin
    .from('ticket_tags')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// --- BOARDS & TASKS ---
async function handleGetBoards() {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select(`
      *,
      board_columns (
        *,
        tasks (
          *,
          assignee:users (id, first_name, last_name),
          tickets (id, ticket_number, subject)
        )
      ),
      owner:users (id, first_name, last_name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Sort columns and tasks by position
  const boards = (data || []).map(board => ({
    ...board,
    board_columns: (board.board_columns || []).sort((a, b) => a.position - b.position).map(col => ({
      ...col,
      tasks: (col.tasks || []).sort((a, b) => a.position - b.position)
    }))
  }))
  
  return NextResponse.json(boards)
}

async function handleCreateBoard(body) {
  const { name, description, owner_id } = body
  
  if (!name || !owner_id) {
    return NextResponse.json({ error: 'name, owner_id sind erforderlich' }, { status: 400 })
  }
  
  const boardId = uuidv4()
  
  const { data, error } = await supabaseAdmin
    .from('boards')
    .insert([{
      id: boardId,
      name,
      description: description || null,
      owner_id,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Create default columns
  const defaultColumns = [
    { name: 'Backlog', position: 0, color: '#6B7280' },
    { name: 'To Do', position: 1, color: '#3B82F6' },
    { name: 'In Progress', position: 2, color: '#F59E0B' },
    { name: 'Review', position: 3, color: '#8B5CF6' },
    { name: 'Done', position: 4, color: '#10B981' },
  ]
  
  const columns = defaultColumns.map(col => ({
    id: uuidv4(),
    board_id: boardId,
    ...col
  }))
  
  await supabaseAdmin.from('board_columns').insert(columns)
  
  return NextResponse.json(data)
}

async function handleCreateTask(body) {
  const { board_id, column_id, title, description, priority, assignee_id, created_by_id, due_date, ticket_id } = body
  
  if (!board_id || !column_id || !title || !created_by_id) {
    return NextResponse.json({ error: 'board_id, column_id, title, created_by_id sind erforderlich' }, { status: 400 })
  }
  
  // Get max position in column
  const { data: existingTasks } = await supabaseAdmin
    .from('tasks')
    .select('position')
    .eq('column_id', column_id)
    .order('position', { ascending: false })
    .limit(1)
  
  const position = existingTasks && existingTasks.length > 0 ? existingTasks[0].position + 1 : 0
  
  const taskData = {
    id: uuidv4(),
    board_id,
    column_id,
    title,
    description: description || null,
    priority: priority || 'medium',
    position,
    assignee_id: assignee_id || null,
    created_by_id,
    due_date: due_date || null,
    ticket_id: ticket_id || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert([taskData])
    .select(`
      *,
      assignee:users (id, first_name, last_name)
    `)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTask(id, body) {
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleMoveTask(body) {
  const { task_id, column_id, position } = body
  
  if (!task_id || !column_id || position === undefined) {
    return NextResponse.json({ error: 'task_id, column_id, position sind erforderlich' }, { status: 400 })
  }
  
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ 
      column_id, 
      position,
      updated_at: new Date().toISOString()
    })
    .eq('id', task_id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// --- ASSETS ---
async function handleGetAssets(params) {
  let query = supabaseAdmin
    .from('assets')
    .select(`
      *,
      asset_types (name, icon),
      organizations (name),
      locations (name)
    `)
  
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  if (params.type_id) query = query.eq('asset_type_id', params.type_id)
  
  const { data, error } = await query.order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleGetAssetTypes() {
  const { data, error } = await supabaseAdmin
    .from('asset_types')
    .select(`
      *,
      asset_fields (*)
    `)
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateAsset(body) {
  const { 
    asset_type_id, organization_id, location_id, name, asset_tag,
    serial_number, manufacturer, model, purchase_date, warranty_until, notes
  } = body
  
  if (!asset_type_id || !name) {
    return NextResponse.json({ error: 'asset_type_id, name sind erforderlich' }, { status: 400 })
  }
  
  const assetData = {
    id: uuidv4(),
    asset_type_id,
    organization_id: organization_id || null,
    location_id: location_id || null,
    name,
    asset_tag: asset_tag || null,
    serial_number: serial_number || null,
    manufacturer: manufacturer || null,
    model: model || null,
    purchase_date: purchase_date || null,
    warranty_until: warranty_until || null,
    notes: notes || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert([assetData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// --- TIME ENTRIES ---
async function handleGetTimeEntries(params) {
  let query = supabaseAdmin
    .from('time_entries')
    .select(`
      *,
      users (first_name, last_name),
      tickets (ticket_number, subject),
      organizations (name)
    `)
  
  if (params.user_id) query = query.eq('user_id', params.user_id)
  if (params.ticket_id) query = query.eq('ticket_id', params.ticket_id)
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  if (params.is_billable !== undefined) query = query.eq('is_billable', params.is_billable)
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateTimeEntry(body) {
  const { user_id, ticket_id, task_id, organization_id, description, duration_minutes, is_billable, hourly_rate } = body
  
  if (!user_id || !description || !duration_minutes) {
    return NextResponse.json({ error: 'user_id, description, duration_minutes sind erforderlich' }, { status: 400 })
  }
  
  const entryData = {
    id: uuidv4(),
    user_id,
    ticket_id: ticket_id || null,
    task_id: task_id || null,
    organization_id: organization_id || null,
    description,
    duration_minutes,
    is_billable: is_billable !== false,
    hourly_rate: hourly_rate || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('time_entries')
    .insert([entryData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// --- REPORTS / STATISTICS ---
async function handleGetStats() {
  // Ticket statistics
  const { data: tickets } = await supabaseAdmin
    .from('tickets')
    .select('status, priority, created_at, resolved_at, sla_response_met, sla_resolution_met')
  
  const ticketStats = {
    total: tickets?.length || 0,
    byStatus: {},
    byPriority: {},
    slaResponseRate: 0,
    slaResolutionRate: 0,
  }
  
  if (tickets) {
    // Count by status
    tickets.forEach(t => {
      ticketStats.byStatus[t.status] = (ticketStats.byStatus[t.status] || 0) + 1
      ticketStats.byPriority[t.priority] = (ticketStats.byPriority[t.priority] || 0) + 1
    })
    
    // Calculate SLA rates
    const withSlaResponse = tickets.filter(t => t.sla_response_met !== null)
    const withSlaResolution = tickets.filter(t => t.sla_resolution_met !== null)
    
    if (withSlaResponse.length > 0) {
      ticketStats.slaResponseRate = withSlaResponse.filter(t => t.sla_response_met).length / withSlaResponse.length * 100
    }
    if (withSlaResolution.length > 0) {
      ticketStats.slaResolutionRate = withSlaResolution.filter(t => t.sla_resolution_met).length / withSlaResolution.length * 100
    }
  }
  
  // Time entry statistics
  const { data: timeEntries } = await supabaseAdmin
    .from('time_entries')
    .select('duration_minutes, is_billable, hourly_rate')
  
  const timeStats = {
    totalMinutes: 0,
    billableMinutes: 0,
    totalRevenue: 0,
  }
  
  if (timeEntries) {
    timeEntries.forEach(t => {
      timeStats.totalMinutes += t.duration_minutes
      if (t.is_billable) {
        timeStats.billableMinutes += t.duration_minutes
        if (t.hourly_rate) {
          timeStats.totalRevenue += (t.duration_minutes / 60) * t.hourly_rate
        }
      }
    })
  }
  
  // Organization count
  const { count: orgCount } = await supabaseAdmin
    .from('organizations')
    .select('*', { count: 'exact', head: true })
  
  // Asset count
  const { count: assetCount } = await supabaseAdmin
    .from('assets')
    .select('*', { count: 'exact', head: true })
  
  return NextResponse.json({
    tickets: ticketStats,
    time: timeStats,
    organizations: orgCount || 0,
    assets: assetCount || 0,
  })
}

// --- AI FEATURES ---
async function handleAISummarize(body) {
  const { content, comments } = body
  
  if (!content) {
    return NextResponse.json({ error: 'content ist erforderlich' }, { status: 400 })
  }
  
  try {
    const { summarizeTicket } = await import('@/lib/openai.js')
    const result = await summarizeTicket(content, comments || [])
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleAIParseDictation(body) {
  const { text, type } = body
  
  if (!text) {
    return NextResponse.json({ error: 'text ist erforderlich' }, { status: 400 })
  }
  
  try {
    const { parseDictation } = await import('@/lib/openai.js')
    const result = await parseDictation(text, type || 'ticket')
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================
// MAIN ROUTE HANDLER
// ============================================

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method
  const url = new URL(request.url)
  const searchParams = Object.fromEntries(url.searchParams)
  
  try {
    // Root endpoint
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ 
        message: 'ServiceDesk Pro API',
        version: '1.0.0',
        status: 'running'
      }))
    }
    
    // Init database
    if (route === '/init' && method === 'POST') {
      return handleCORS(await handleInit())
    }
    
    // --- USERS ---
    if (route === '/users' && method === 'GET') {
      return handleCORS(await handleGetUsers())
    }
    if (route === '/users' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateUser(body))
    }
    if (route.match(/^\/users\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateUser(id, body))
    }
    
    // --- ROLES ---
    if (route === '/roles' && method === 'GET') {
      return handleCORS(await handleGetRoles())
    }
    
    // --- ORGANIZATIONS ---
    if (route === '/organizations' && method === 'GET') {
      return handleCORS(await handleGetOrganizations())
    }
    if (route === '/organizations' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateOrganization(body))
    }
    if (route.match(/^\/organizations\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateOrganization(id, body))
    }
    if (route.match(/^\/organizations\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteOrganization(id))
    }
    
    // --- CONTACTS ---
    if (route === '/contacts' && method === 'GET') {
      return handleCORS(await handleGetContacts(searchParams.organization_id))
    }
    if (route === '/contacts' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateContact(body))
    }
    
    // --- LOCATIONS ---
    if (route === '/locations' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateLocation(body))
    }
    
    // --- SLA PROFILES ---
    if (route === '/sla-profiles' && method === 'GET') {
      return handleCORS(await handleGetSLAProfiles())
    }
    
    // --- TICKETS ---
    if (route === '/tickets' && method === 'GET') {
      return handleCORS(await handleGetTickets(searchParams))
    }
    if (route === '/tickets' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTicket(body))
    }
    if (route.match(/^\/tickets\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      return handleCORS(await handleGetTicket(id))
    }
    if (route.match(/^\/tickets\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTicket(id, body, searchParams.user_id))
    }
    if (route.match(/^\/tickets\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTicket(id))
    }
    
    // --- TICKET COMMENTS ---
    if (route === '/comments' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateComment(body))
    }
    
    // --- TAGS ---
    if (route === '/tags' && method === 'GET') {
      return handleCORS(await handleGetTags())
    }
    
    // --- BOARDS ---
    if (route === '/boards' && method === 'GET') {
      return handleCORS(await handleGetBoards())
    }
    if (route === '/boards' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateBoard(body))
    }
    
    // --- TASKS ---
    if (route === '/tasks' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTask(body))
    }
    if (route.match(/^\/tasks\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTask(id, body))
    }
    if (route === '/tasks/move' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleMoveTask(body))
    }
    
    // --- ASSETS ---
    if (route === '/assets' && method === 'GET') {
      return handleCORS(await handleGetAssets(searchParams))
    }
    if (route === '/assets' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateAsset(body))
    }
    if (route === '/asset-types' && method === 'GET') {
      return handleCORS(await handleGetAssetTypes())
    }
    
    // --- TIME ENTRIES ---
    if (route === '/time-entries' && method === 'GET') {
      return handleCORS(await handleGetTimeEntries(searchParams))
    }
    if (route === '/time-entries' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTimeEntry(body))
    }
    
    // --- STATISTICS ---
    if (route === '/stats' && method === 'GET') {
      return handleCORS(await handleGetStats())
    }
    
    // --- AI FEATURES ---
    if (route === '/ai/summarize' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAISummarize(body))
    }
    if (route === '/ai/parse-dictation' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAIParseDictation(body))
    }
    
    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} nicht gefunden` }, 
      { status: 404 }
    ))
    
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message }, 
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute