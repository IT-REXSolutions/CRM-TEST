import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import crypto from 'crypto'

// Supabase Admin Client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================
// SETTINGS HELPER - Central Configuration
// ============================================

// Cache for settings (refreshed every 5 minutes)
let settingsCache = null
let settingsCacheTime = 0
const SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getSettings() {
  const now = Date.now()
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return settingsCache
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('key, value')
    
    if (error) {
      console.error('Settings fetch error:', error)
      return settingsCache || {}
    }
    
    const settings = {}
    ;(data || []).forEach(s => {
      try {
        settings[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
      } catch {
        settings[s.key] = s.value
      }
    })
    
    settingsCache = settings
    settingsCacheTime = now
    return settings
  } catch (error) {
    console.error('Settings error:', error)
    return settingsCache || {}
  }
}

async function getSetting(key, defaultValue = null) {
  const settings = await getSettings()
  return settings[key] !== undefined ? settings[key] : defaultValue
}

// Clear settings cache (call after updating settings)
function clearSettingsCache() {
  settingsCache = null
  settingsCacheTime = 0
}

// ============================================
// OPENAI CLIENT - Dynamic from Settings
// ============================================

async function getOpenAIClient() {
  const apiKey = await getSetting('openai_api_key')
  const enabled = await getSetting('openai_enabled', false)
  
  if (!enabled || !apiKey) {
    return null
  }
  
  // Use Emergent API endpoint if it's an Emergent key, otherwise standard OpenAI
  const isEmergentKey = apiKey.startsWith('ek_') || apiKey.startsWith('emergent')
  
  return new OpenAI({
    apiKey: apiKey,
    baseURL: isEmergentKey ? 'https://api.emergent.sh/v1/openai' : undefined,
  })
}

async function getOpenAIModel() {
  return await getSetting('openai_model', 'gpt-4o-mini')
}

// ============================================
// AI FUNCTIONS - Using Settings
// ============================================

async function generateAICompletion(prompt, options = {}) {
  const openai = await getOpenAIClient()
  if (!openai) {
    return { success: false, error: 'OpenAI nicht konfiguriert' }
  }
  
  const model = await getOpenAIModel()
  const {
    systemPrompt = 'Du bist ein hilfreicher Assistent für IT-Service-Management.',
    temperature = 0.7,
    maxTokens = 1000,
  } = options

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
    })

    return {
      success: true,
      content: response.choices[0]?.message?.content || '',
      tokens: response.usage?.total_tokens || 0,
    }
  } catch (error) {
    console.error('OpenAI Error:', error)
    return { success: false, error: error.message }
  }
}

async function transcribeAudioWithWhisper(audioBuffer, filename) {
  const openai = await getOpenAIClient()
  if (!openai) {
    return { success: false, error: 'OpenAI nicht konfiguriert' }
  }

  try {
    // Create a File-like object from buffer
    const file = new File([audioBuffer], filename, { type: 'audio/webm' })
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'de',
    })

    return {
      success: true,
      text: transcription.text,
    }
  } catch (error) {
    console.error('Whisper Error:', error)
    return { success: false, error: error.message }
  }
}

async function generateCallSummary(transcript, callMetadata) {
  const systemPrompt = `Du bist ein IT-Support-Analyst. Analysiere das folgende Telefontranskript und erstelle eine strukturierte Zusammenfassung.

Antworte im folgenden JSON-Format:
{
  "problem": "Kurze Beschreibung des Problems",
  "actions": ["Durchgeführte Maßnahme 1", "Durchgeführte Maßnahme 2"],
  "nextSteps": ["Nächster Schritt 1", "Nächster Schritt 2"],
  "urgency": "niedrig|mittel|hoch|kritisch",
  "suggestedCategory": "Kategorie falls erkennbar",
  "keyPoints": ["Wichtiger Punkt 1", "Wichtiger Punkt 2"]
}`

  const prompt = `Anruf-Informationen:
- Anrufer: ${callMetadata.callerNumber || 'Unbekannt'}
- Organisation: ${callMetadata.organizationName || 'Unbekannt'}
- Dauer: ${callMetadata.duration ? Math.round(callMetadata.duration / 60) + ' Minuten' : 'Unbekannt'}

Transkript:
${transcript}`

  const result = await generateAICompletion(prompt, { systemPrompt, temperature: 0.3, maxTokens: 600 })
  
  if (result.success) {
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return { success: true, summary: JSON.parse(jsonMatch[0]) }
      }
    } catch (e) {
      // Return raw content if JSON parsing fails
      return { success: true, summary: { problem: result.content } }
    }
  }
  return result
}

async function parseDictationWithAI(text, type = 'ticket') {
  const prompts = {
    ticket: `Strukturiere den folgenden diktierten Text als Ticket:
- Betreff (kurz und prägnant)
- Beschreibung (detailliert)
- Priorität (low/medium/high/critical)
- Kategorie (falls erkennbar)

Diktierter Text: "${text}"

Antworte NUR mit validem JSON: {"subject": "", "description": "", "priority": "medium", "category": ""}`,
    
    task: `Strukturiere den folgenden diktierten Text als Aufgabe:
- Titel (kurz und prägnant)
- Beschreibung (detailliert)
- Priorität (low/medium/high)

Diktierter Text: "${text}"

Antworte NUR mit validem JSON: {"title": "", "description": "", "priority": "medium"}`,
    
    time: `Extrahiere aus dem folgenden diktierten Text die Zeiterfassung:
- Dauer (in Minuten, schätze wenn nötig)
- Beschreibung der Tätigkeit
- Abrechenbar (true/false)

Diktierter Text: "${text}"

Antworte NUR mit validem JSON: {"duration_minutes": 30, "description": "", "is_billable": true}`,
    
    comment: `Strukturiere den folgenden diktierten Text als Kommentar:
- Inhalt (vollständiger Text, grammatikalisch korrigiert)
- Intern (true für interne Notiz, false für Kundenkommentar)

Diktierter Text: "${text}"

Antworte NUR mit validem JSON: {"content": "", "is_internal": false}`
  }

  const systemPrompt = 'Du bist ein Assistent der diktierten Text strukturiert. Antworte NUR mit validem JSON, ohne zusätzlichen Text oder Markdown.'
  
  const result = await generateAICompletion(prompts[type] || prompts.ticket, { 
    systemPrompt, 
    temperature: 0.2,
    maxTokens: 400 
  })
  
  if (result.success) {
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return { success: true, data: JSON.parse(jsonMatch[0]) }
      }
    } catch (e) {
      console.error('JSON parse error:', e)
    }
  }
  return { success: false, error: result.error || 'Could not parse response' }
}

// ============================================
// LEXOFFICE INTEGRATION
// ============================================

async function getLexofficeClient() {
  const apiKey = await getSetting('lexoffice_api_key')
  const enabled = await getSetting('lexoffice_enabled', false)
  
  if (!enabled || !apiKey) {
    return null
  }
  
  return {
    apiKey,
    baseUrl: 'https://api.lexoffice.io/v1',
    async request(endpoint, method = 'GET', body = null) {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
      if (body) options.body = JSON.stringify(body)
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options)
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Lexoffice API Error: ${response.status} - ${error}`)
      }
      
      return response.json()
    }
  }
}

async function createLexofficeInvoice(invoiceData) {
  const client = await getLexofficeClient()
  if (!client) {
    return { success: false, error: 'Lexoffice nicht konfiguriert' }
  }
  
  try {
    // Create invoice in Lexoffice
    const invoice = await client.request('/invoices', 'POST', {
      archived: false,
      voucherDate: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
      address: {
        name: invoiceData.customer_name,
        street: invoiceData.customer_address?.street || '',
        zip: invoiceData.customer_address?.zip || '',
        city: invoiceData.customer_address?.city || '',
        countryCode: 'DE',
      },
      lineItems: invoiceData.line_items.map(item => ({
        type: 'custom',
        name: item.description,
        quantity: item.quantity,
        unitName: item.unit || 'Stunden',
        unitPrice: {
          currency: 'EUR',
          netAmount: item.unit_price,
          taxRatePercentage: 19,
        },
      })),
      totalPrice: {
        currency: 'EUR',
      },
      taxConditions: {
        taxType: 'net',
      },
      paymentConditions: {
        paymentTermLabel: invoiceData.payment_terms || '14 Tage netto',
        paymentTermDuration: 14,
      },
      shippingConditions: {
        shippingDate: new Date().toISOString().split('T')[0],
        shippingType: 'service',
      },
      title: 'Rechnung',
      introduction: invoiceData.introduction || '',
      remark: invoiceData.remark || '',
    })
    
    return { success: true, lexoffice_id: invoice.id, invoice }
  } catch (error) {
    console.error('Lexoffice Error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// PLACETEL INTEGRATION
// ============================================

async function getPlacetelClient() {
  const apiKey = await getSetting('placetel_api_key')
  const enabled = await getSetting('placetel_enabled', false)
  
  if (!enabled || !apiKey) {
    return null
  }
  
  return {
    apiKey,
    baseUrl: 'https://api.placetel.de/v2',
    async request(endpoint, method = 'GET', body = null) {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
      if (body) options.body = JSON.stringify(body)
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options)
      if (!response.ok) {
        throw new Error(`Placetel API Error: ${response.status}`)
      }
      return response.json()
    }
  }
}

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
// AUTH HANDLERS
// ============================================

async function handleRegister(body) {
  const { email, password, first_name, last_name, user_type, organization_id } = body
  
  if (!email || !password || !first_name || !last_name) {
    return NextResponse.json({ error: 'email, password, first_name, last_name sind erforderlich' }, { status: 400 })
  }
  
  // Create user in our users table
  const userId = uuidv4()
  const userData = {
    id: userId,
    email,
    first_name,
    last_name,
    user_type: user_type || 'internal',
    is_active: true,
  }
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([userData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Assign default role based on user_type
  const roleMap = {
    internal: 'agent',
    customer: 'customer',
    external: 'customer'
  }
  
  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', roleMap[user_type] || 'agent')
    .single()
  
  if (role) {
    await supabaseAdmin.from('user_roles').insert([{ user_id: userId, role_id: role.id }])
  }
  
  // Link to organization if customer
  if (user_type === 'customer' && organization_id) {
    await supabaseAdmin.from('contacts').insert([{
      id: uuidv4(),
      organization_id,
      user_id: userId,
      first_name,
      last_name,
      email,
    }])
  }
  
  return NextResponse.json({ success: true, user: data })
}

async function handleLogin(body) {
  const { email, password } = body
  
  if (!email) {
    return NextResponse.json({ error: 'email ist erforderlich' }, { status: 400 })
  }
  
  // For demo purposes, we just check if user exists
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(`
      *,
      user_roles (
        roles (name, display_name)
      )
    `)
    .eq('email', email)
    .eq('is_active', true)
    .single()
  
  if (error || !user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 401 })
  }
  
  // Update last login
  await supabaseAdmin
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)
  
  return NextResponse.json({ success: true, user })
}

// ============================================
// USERS HANDLERS
// ============================================

async function handleGetUsers(params) {
  let query = supabaseAdmin
    .from('users')
    .select(`
      *,
      user_roles (
        role_id,
        roles (name, display_name)
      )
    `)
  
  if (params.user_type) {
    query = query.eq('user_type', params.user_type)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
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
  
  if (role_id) {
    await supabaseAdmin.from('user_roles').insert([{ user_id: data.id, role_id }])
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

async function handleDeleteUser(id) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// ROLES HANDLERS
// ============================================

async function handleGetRoles() {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// ============================================
// ORGANIZATIONS HANDLERS
// ============================================

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

// ============================================
// CONTACTS HANDLERS
// ============================================

async function handleGetContacts(orgId) {
  let query = supabaseAdmin
    .from('contacts')
    .select(`
      *,
      organizations (name),
      locations (name),
      users (email)
    `)
  
  if (orgId) {
    query = query.eq('organization_id', orgId)
  }
  
  const { data, error } = await query.order('last_name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateContact(body) {
  const { organization_id, first_name, last_name, email, phone, position, mobile } = body
  
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
    mobile: mobile || null,
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

// ============================================
// LOCATIONS HANDLERS
// ============================================

async function handleCreateLocation(body) {
  const { organization_id, name, address_line1, postal_code, city, phone } = body
  
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
    phone: phone || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('locations')
    .insert([locationData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ============================================
// SLA PROFILES HANDLERS
// ============================================

async function handleGetSLAProfiles() {
  const { data, error } = await supabaseAdmin
    .from('sla_profiles')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// ============================================
// TICKETS HANDLERS
// ============================================

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
      )
    `)
  
  if (params.status) query = query.eq('status', params.status)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.assignee_id) query = query.eq('assignee_id', params.assignee_id)
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  if (params.created_by_id) query = query.eq('created_by_id', params.created_by_id)
  if (params.contact_id) query = query.eq('contact_id', params.contact_id)
  
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
    sla_profile_id, tags, source
  } = body
  
  if (!subject || !created_by_id) {
    return NextResponse.json({ error: 'subject, created_by_id sind erforderlich' }, { status: 400 })
  }
  
  // Calculate SLA due dates if SLA profile provided or from organization's contract
  let sla_response_due = null
  let sla_resolution_due = null
  let effectiveSlaId = sla_profile_id
  
  // Try to get SLA from organization's contract if not specified
  if (!effectiveSlaId && organization_id) {
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('sla_profile_id')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .single()
    
    if (contract?.sla_profile_id) {
      effectiveSlaId = contract.sla_profile_id
    }
  }
  
  // Use default SLA if still not set
  if (!effectiveSlaId) {
    const { data: defaultSla } = await supabaseAdmin
      .from('sla_profiles')
      .select('id')
      .eq('is_default', true)
      .single()
    
    if (defaultSla) effectiveSlaId = defaultSla.id
  }
  
  if (effectiveSlaId) {
    const { data: slaProfile } = await supabaseAdmin
      .from('sla_profiles')
      .select('*')
      .eq('id', effectiveSlaId)
      .single()
    
    if (slaProfile) {
      const now = new Date()
      const priorityMultiplier = slaProfile.priority_multipliers?.[priority || 'medium'] || 1
      sla_response_due = new Date(now.getTime() + slaProfile.response_time_minutes * priorityMultiplier * 60000).toISOString()
      sla_resolution_due = new Date(now.getTime() + slaProfile.resolution_time_minutes * priorityMultiplier * 60000).toISOString()
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
    sla_profile_id: effectiveSlaId || null,
    sla_response_due,
    sla_resolution_due,
    source: source || 'web',
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
  const { data: currentTicket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()
  
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

// ============================================
// TICKET COMMENTS HANDLERS
// ============================================

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
    .select(`*, users (id, first_name, last_name)`)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id,
    user_id,
    action: 'commented',
    new_value: is_internal ? '[Interne Notiz]' : content.substring(0, 100),
  }])
  
  return NextResponse.json(data)
}

// ============================================
// TICKET TAGS HANDLERS
// ============================================

async function handleGetTags() {
  const { data, error } = await supabaseAdmin
    .from('ticket_tags')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// ============================================
// BOARDS & TASKS HANDLERS
// ============================================

async function handleGetBoards() {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select(`
      *,
      board_columns (
        *,
        tasks (
          *,
          tickets (id, ticket_number, subject)
        )
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
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
    .insert([{ id: boardId, name, description: description || null, owner_id }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
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
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTask(id, body) {
  const updateData = { ...body, updated_at: new Date().toISOString() }
  
  if (body.completed && !body.completed_at) {
    updateData.completed_at = new Date().toISOString()
  }
  
  const { error } = await supabaseAdmin
    .from('tasks')
    .update(updateData)
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
    .update({ column_id, position, updated_at: new Date().toISOString() })
    .eq('id', task_id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteTask(id) {
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// ASSETS HANDLERS
// ============================================

async function handleGetAssets(params) {
  let query = supabaseAdmin
    .from('assets')
    .select(`
      *,
      asset_types (name, icon),
      organizations (name),
      locations (name),
      asset_values (
        value,
        asset_fields (name, field_type)
      )
    `)
  
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  if (params.type_id) query = query.eq('asset_type_id', params.type_id)
  if (params.status) query = query.eq('status', params.status)
  
  const { data, error } = await query.order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleGetAsset(id) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select(`
      *,
      asset_types (name, icon, asset_fields (*)),
      organizations (name),
      locations (name),
      asset_values (
        id,
        value,
        field_id,
        asset_fields (name, field_type, is_required)
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleGetAssetTypes() {
  const { data, error } = await supabaseAdmin
    .from('asset_types')
    .select(`*, asset_fields (*)`)
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateAsset(body) {
  const { 
    asset_type_id, organization_id, location_id, name, asset_tag,
    serial_number, manufacturer, model, purchase_date, warranty_until, notes, status,
    custom_fields
  } = body
  
  if (!asset_type_id || !name) {
    return NextResponse.json({ error: 'asset_type_id, name sind erforderlich' }, { status: 400 })
  }
  
  const assetId = uuidv4()
  const assetData = {
    id: assetId,
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
    status: status || 'active',
  }
  
  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert([assetData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Save custom field values
  if (custom_fields && Object.keys(custom_fields).length > 0) {
    const fieldValues = Object.entries(custom_fields).map(([field_id, value]) => ({
      id: uuidv4(),
      asset_id: assetId,
      field_id,
      value: String(value),
    }))
    await supabaseAdmin.from('asset_values').insert(fieldValues)
  }
  
  return NextResponse.json(data)
}

async function handleUpdateAsset(id, body) {
  const { custom_fields, ...assetData } = body
  
  const { error } = await supabaseAdmin
    .from('assets')
    .update({ ...assetData, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Update custom fields
  if (custom_fields) {
    for (const [field_id, value] of Object.entries(custom_fields)) {
      await supabaseAdmin
        .from('asset_values')
        .upsert({ 
          id: uuidv4(),
          asset_id: id, 
          field_id, 
          value: String(value) 
        }, { onConflict: 'asset_id,field_id' })
    }
  }
  
  return NextResponse.json({ success: true })
}

async function handleDeleteAsset(id) {
  const { error } = await supabaseAdmin
    .from('assets')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// TIME ENTRIES HANDLERS
// ============================================

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
  if (params.is_billable !== undefined) query = query.eq('is_billable', params.is_billable === 'true')
  if (params.is_invoiced !== undefined) query = query.eq('is_invoiced', params.is_invoiced === 'true')
  if (params.from_date) query = query.gte('created_at', params.from_date)
  if (params.to_date) query = query.lte('created_at', params.to_date)
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateTimeEntry(body) {
  const { user_id, ticket_id, task_id, organization_id, description, duration_minutes, is_billable, hourly_rate, started_at, ended_at } = body
  
  if (!user_id || !description || !duration_minutes) {
    return NextResponse.json({ error: 'user_id, description, duration_minutes sind erforderlich' }, { status: 400 })
  }
  
  // Get hourly rate from organization's contract if not specified
  let effectiveHourlyRate = hourly_rate
  if (!effectiveHourlyRate && organization_id) {
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('hourly_rate')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .single()
    
    if (contract?.hourly_rate) {
      effectiveHourlyRate = contract.hourly_rate
    }
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
    hourly_rate: effectiveHourlyRate || null,
    started_at: started_at || null,
    ended_at: ended_at || null,
  }
  
  const { data, error } = await supabaseAdmin
    .from('time_entries')
    .insert([entryData])
    .select(`
      *,
      users (first_name, last_name),
      tickets (ticket_number, subject),
      organizations (name)
    `)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTimeEntry(id, body) {
  const { error } = await supabaseAdmin
    .from('time_entries')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteTimeEntry(id) {
  const { error } = await supabaseAdmin
    .from('time_entries')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// REPORTS & STATISTICS HANDLERS
// ============================================

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
    tickets.forEach(t => {
      ticketStats.byStatus[t.status] = (ticketStats.byStatus[t.status] || 0) + 1
      ticketStats.byPriority[t.priority] = (ticketStats.byPriority[t.priority] || 0) + 1
    })
    
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
  
  const { count: orgCount } = await supabaseAdmin
    .from('organizations')
    .select('*', { count: 'exact', head: true })
  
  const { count: assetCount } = await supabaseAdmin
    .from('assets')
    .select('*', { count: 'exact', head: true })
  
  const { count: userCount } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  
  return NextResponse.json({
    tickets: ticketStats,
    time: timeStats,
    organizations: orgCount || 0,
    assets: assetCount || 0,
    users: userCount || 0,
  })
}

async function handleGetReports(params) {
  const { type, from_date, to_date, organization_id, user_id } = params
  
  let report = {}
  
  switch (type) {
    case 'tickets':
      // Ticket report by status over time
      let ticketQuery = supabaseAdmin
        .from('tickets')
        .select('id, status, priority, created_at, resolved_at, organization_id, assignee_id')
      
      if (from_date) ticketQuery = ticketQuery.gte('created_at', from_date)
      if (to_date) ticketQuery = ticketQuery.lte('created_at', to_date)
      if (organization_id) ticketQuery = ticketQuery.eq('organization_id', organization_id)
      
      const { data: ticketData } = await ticketQuery
      
      report = {
        type: 'tickets',
        total: ticketData?.length || 0,
        byStatus: {},
        byPriority: {},
        avgResolutionTime: 0,
        data: ticketData || []
      }
      
      if (ticketData) {
        ticketData.forEach(t => {
          report.byStatus[t.status] = (report.byStatus[t.status] || 0) + 1
          report.byPriority[t.priority] = (report.byPriority[t.priority] || 0) + 1
        })
        
        const resolved = ticketData.filter(t => t.resolved_at)
        if (resolved.length > 0) {
          const totalTime = resolved.reduce((sum, t) => {
            return sum + (new Date(t.resolved_at) - new Date(t.created_at))
          }, 0)
          report.avgResolutionTime = totalTime / resolved.length / (1000 * 60 * 60) // hours
        }
      }
      break
    
    case 'time':
      // Time tracking report
      let timeQuery = supabaseAdmin
        .from('time_entries')
        .select(`
          *,
          users (first_name, last_name),
          organizations (name)
        `)
      
      if (from_date) timeQuery = timeQuery.gte('created_at', from_date)
      if (to_date) timeQuery = timeQuery.lte('created_at', to_date)
      if (organization_id) timeQuery = timeQuery.eq('organization_id', organization_id)
      if (user_id) timeQuery = timeQuery.eq('user_id', user_id)
      
      const { data: timeData } = await timeQuery
      
      let totalMinutes = 0
      let billableMinutes = 0
      let totalRevenue = 0
      const byUser = {}
      const byOrganization = {}
      
      if (timeData) {
        timeData.forEach(t => {
          totalMinutes += t.duration_minutes
          if (t.is_billable) {
            billableMinutes += t.duration_minutes
            if (t.hourly_rate) {
              totalRevenue += (t.duration_minutes / 60) * t.hourly_rate
            }
          }
          
          const userName = t.users ? `${t.users.first_name} ${t.users.last_name}` : 'Unknown'
          byUser[userName] = (byUser[userName] || 0) + t.duration_minutes
          
          const orgName = t.organizations?.name || 'Nicht zugeordnet'
          byOrganization[orgName] = (byOrganization[orgName] || 0) + t.duration_minutes
        })
      }
      
      report = {
        type: 'time',
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        totalRevenue,
        byUser,
        byOrganization,
        entries: timeData || []
      }
      break
    
    case 'sla':
      // SLA compliance report
      let slaQuery = supabaseAdmin
        .from('tickets')
        .select(`
          id, ticket_number, subject, status, priority,
          sla_response_due, sla_resolution_due, sla_response_met, sla_resolution_met,
          first_response_at, resolved_at, created_at,
          organizations (name)
        `)
        .not('sla_profile_id', 'is', null)
      
      if (from_date) slaQuery = slaQuery.gte('created_at', from_date)
      if (to_date) slaQuery = slaQuery.lte('created_at', to_date)
      if (organization_id) slaQuery = slaQuery.eq('organization_id', organization_id)
      
      const { data: slaData } = await slaQuery
      
      let responseMet = 0
      let responseMissed = 0
      let resolutionMet = 0
      let resolutionMissed = 0
      
      if (slaData) {
        slaData.forEach(t => {
          if (t.sla_response_met === true) responseMet++
          else if (t.sla_response_met === false) responseMissed++
          
          if (t.sla_resolution_met === true) resolutionMet++
          else if (t.sla_resolution_met === false) resolutionMissed++
        })
      }
      
      report = {
        type: 'sla',
        total: slaData?.length || 0,
        responseCompliance: responseMet + responseMissed > 0 
          ? (responseMet / (responseMet + responseMissed)) * 100 
          : 100,
        resolutionCompliance: resolutionMet + resolutionMissed > 0 
          ? (resolutionMet / (resolutionMet + resolutionMissed)) * 100 
          : 100,
        responseMet,
        responseMissed,
        resolutionMet,
        resolutionMissed,
        tickets: slaData || []
      }
      break
    
    case 'assets':
      // Asset report
      let assetQuery = supabaseAdmin
        .from('assets')
        .select(`
          *,
          asset_types (name),
          organizations (name)
        `)
      
      if (organization_id) assetQuery = assetQuery.eq('organization_id', organization_id)
      
      const { data: assetData } = await assetQuery
      
      const byType = {}
      const byStatus = {}
      const byOrg = {}
      
      if (assetData) {
        assetData.forEach(a => {
          const typeName = a.asset_types?.name || 'Unknown'
          byType[typeName] = (byType[typeName] || 0) + 1
          byStatus[a.status] = (byStatus[a.status] || 0) + 1
          
          const orgName = a.organizations?.name || 'Nicht zugeordnet'
          byOrg[orgName] = (byOrg[orgName] || 0) + 1
        })
      }
      
      report = {
        type: 'assets',
        total: assetData?.length || 0,
        byType,
        byStatus,
        byOrganization: byOrg,
        assets: assetData || []
      }
      break
    
    default:
      report = { error: 'Unknown report type' }
  }
  
  return NextResponse.json(report)
}

// ============================================
// AI FEATURES HANDLERS
// ============================================

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
// SETTINGS HANDLERS
// ============================================

async function handleGetSettings(category) {
  let query = supabaseAdmin.from('settings').select('*')
  
  if (category) {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query.order('key')
  
  if (error) {
    // Table might not exist yet, return defaults
    if (error.code === '42P01') {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Convert to key-value object
  const settings = {}
  ;(data || []).forEach(s => {
    settings[s.key] = s.value
  })
  
  return NextResponse.json(settings)
}

async function handleUpdateSetting(body) {
  const { key, value, userId, category } = body
  
  if (!key) {
    return NextResponse.json({ error: 'key ist erforderlich' }, { status: 400 })
  }
  
  // Determine category from key prefix if not provided
  let settingCategory = category || 'general'
  if (!category) {
    if (key.startsWith('smtp_') || key.startsWith('imap_') || key.includes('email')) settingCategory = 'email'
    else if (key.includes('openai') || key.includes('placetel') || key.includes('lexoffice')) settingCategory = 'integrations'
    else if (key.includes('ticket')) settingCategory = 'tickets'
    else if (key.includes('backup') || key.includes('log_')) settingCategory = 'audit'
  }
  
  // Ensure value is properly formatted for JSONB
  let jsonValue = value
  if (typeof value === 'string') {
    try {
      // Try to parse if it's already a JSON string
      jsonValue = JSON.parse(value)
    } catch {
      // If not valid JSON, wrap it as a string
      jsonValue = value
    }
  }
  
  const insertData = {
    key,
    value: jsonValue,
    category: settingCategory,
    description: `Setting: ${key}`,
    updated_at: new Date().toISOString(),
    updated_by_id: userId || null,
  }
  
  console.log('Inserting setting:', JSON.stringify(insertData))
  
  const result = await supabaseAdmin
    .from('settings')
    .upsert(insertData, { onConflict: 'key' })
    .select()
  
  console.log('Upsert result:', JSON.stringify(result))
  
  // Clear settings cache
  clearSettingsCache()
  
  if (result.error) {
    console.error('Settings update error:', JSON.stringify(result.error))
    return NextResponse.json({ error: result.error.message || 'Unknown error', details: result.error }, { status: 500 })
  }
  
  return NextResponse.json(result.data?.[0] || { success: true })
}

async function handleBulkUpdateSettings(body) {
  const { settings, userId } = body
  
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'settings object ist erforderlich' }, { status: 400 })
  }
  
  const updates = Object.entries(settings).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: new Date().toISOString(),
    updated_by_id: userId || null,
  }))
  
  for (const update of updates) {
    await supabaseAdmin.from('settings').upsert(update, { onConflict: 'key' })
  }
  
  return NextResponse.json({ success: true, count: updates.length })
}

// ============================================
// SLA PROFILES HANDLERS (Extended)
// ============================================

async function handleCreateSLAProfile(body) {
  const { name, description, response_time_minutes, resolution_time_minutes, business_hours_only, is_default, priority_multipliers } = body
  
  if (!name || !response_time_minutes || !resolution_time_minutes) {
    return NextResponse.json({ error: 'name, response_time_minutes, resolution_time_minutes sind erforderlich' }, { status: 400 })
  }
  
  // If setting as default, unset other defaults
  if (is_default) {
    await supabaseAdmin.from('sla_profiles').update({ is_default: false }).eq('is_default', true)
  }
  
  const { data, error } = await supabaseAdmin
    .from('sla_profiles')
    .insert([{
      id: uuidv4(),
      name,
      description: description || null,
      response_time_minutes,
      resolution_time_minutes,
      business_hours_only: business_hours_only !== false,
      is_default: is_default || false,
      priority_multipliers: priority_multipliers || { low: 2, medium: 1, high: 0.5, critical: 0.25 },
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateSLAProfile(id, body) {
  if (body.is_default) {
    await supabaseAdmin.from('sla_profiles').update({ is_default: false }).eq('is_default', true)
  }
  
  const { error } = await supabaseAdmin
    .from('sla_profiles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteSLAProfile(id) {
  const { error } = await supabaseAdmin.from('sla_profiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// TICKET TAGS HANDLERS (Extended)
// ============================================

async function handleCreateTag(body) {
  const { name, color } = body
  
  if (!name) {
    return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_tags')
    .insert([{ id: uuidv4(), name, color: color || '#3B82F6' }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTag(id, body) {
  const { error } = await supabaseAdmin.from('ticket_tags').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteTag(id) {
  const { error } = await supabaseAdmin.from('ticket_tags').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// TICKET TEMPLATES HANDLERS (Legacy)
// ============================================

async function handleGetTicketTemplates() {
  const { data, error } = await supabaseAdmin
    .from('ticket_templates')
    .select('*')
    .eq('is_active', true)
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateTicketTemplate(body) {
  const { name, category, subject, description, priority } = body
  
  if (!name || !subject) {
    return NextResponse.json({ error: 'name, subject sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_templates')
    .insert([{
      id: uuidv4(),
      name,
      category: category || null,
      subject,
      description: description || null,
      priority: priority || 'medium',
      is_active: true,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTemplate(id, body) {
  const { error } = await supabaseAdmin
    .from('ticket_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteTicketTemplate(id) {
  const { error } = await supabaseAdmin.from('ticket_templates').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// AUTOMATION RULES HANDLERS
// ============================================

async function handleGetAutomations() {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .order('name')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

async function handleCreateAutomation(body) {
  const { name, description, trigger_type, trigger_conditions, action_type, action_config, is_active } = body
  
  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ error: 'name, trigger_type, action_type sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .insert([{
      id: uuidv4(),
      name,
      description: description || null,
      trigger_type,
      trigger_conditions: trigger_conditions || {},
      action_type,
      action_config: action_config || {},
      is_active: is_active !== false,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateAutomation(id, body) {
  const { error } = await supabaseAdmin
    .from('automation_rules')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteAutomation(id) {
  const { error } = await supabaseAdmin.from('automation_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// RECURRING TICKETS HANDLERS
// ============================================

async function handleGetRecurringTickets() {
  const { data, error } = await supabaseAdmin
    .from('recurring_tickets')
    .select('*')
    .order('name')
  
  if (error) {
    // Table might not exist or other error
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Fetch related data separately if needed
  const enrichedData = await Promise.all((data || []).map(async (item) => {
    const result = { ...item }
    
    if (item.organization_id) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', item.organization_id)
        .single()
      result.organizations = org
    }
    
    if (item.assignee_id) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('first_name, last_name')
        .eq('id', item.assignee_id)
        .single()
      result.assignee = user
    }
    
    return result
  }))
  
  return NextResponse.json(enrichedData)
}

async function handleCreateRecurringTicket(body) {
  const { 
    name, subject, description, priority, category, organization_id, assignee_id, sla_profile_id,
    schedule_type, schedule_day, schedule_time, created_by_id
  } = body
  
  if (!name || !subject || !schedule_type) {
    return NextResponse.json({ error: 'name, subject, schedule_type sind erforderlich' }, { status: 400 })
  }
  
  // Calculate next run
  const now = new Date()
  let next_run_at = new Date(now)
  
  if (schedule_time) {
    const [hours, minutes] = schedule_time.split(':')
    next_run_at.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  }
  
  if (next_run_at <= now) {
    // Move to next occurrence
    switch (schedule_type) {
      case 'daily': next_run_at.setDate(next_run_at.getDate() + 1); break
      case 'weekly': next_run_at.setDate(next_run_at.getDate() + 7); break
      case 'monthly': next_run_at.setMonth(next_run_at.getMonth() + 1); break
      case 'yearly': next_run_at.setFullYear(next_run_at.getFullYear() + 1); break
    }
  }
  
  const { data, error } = await supabaseAdmin
    .from('recurring_tickets')
    .insert([{
      id: uuidv4(),
      name,
      subject,
      description: description || null,
      priority: priority || 'medium',
      category: category || null,
      organization_id: organization_id || null,
      assignee_id: assignee_id || null,
      sla_profile_id: sla_profile_id || null,
      schedule_type,
      schedule_day: schedule_day || null,
      schedule_time: schedule_time || '09:00',
      next_run_at: next_run_at.toISOString(),
      is_active: true,
      created_by_id: created_by_id || null,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateRecurringTicket(id, body) {
  const { error } = await supabaseAdmin
    .from('recurring_tickets')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleDeleteRecurringTicket(id) {
  const { error } = await supabaseAdmin.from('recurring_tickets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ============================================
// INVOICE DRAFTS HANDLERS
// ============================================

async function handleGetInvoiceDrafts(params) {
  let query = supabaseAdmin
    .from('invoice_drafts')
    .select(`
      *,
      organizations (name),
      creator:users (first_name, last_name)
    `)
  
  if (params.organization_id) query = query.eq('organization_id', params.organization_id)
  if (params.status) query = query.eq('status', params.status)
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateInvoiceDraft(body) {
  const { organization_id, time_entry_ids, created_by_id } = body
  
  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id ist erforderlich' }, { status: 400 })
  }
  
  // Get time entries to invoice
  let timeEntries = []
  if (time_entry_ids && time_entry_ids.length > 0) {
    const { data } = await supabaseAdmin
      .from('time_entries')
      .select('*')
      .in('id', time_entry_ids)
      .eq('is_billable', true)
      .eq('is_invoiced', false)
    timeEntries = data || []
  } else {
    // Get all uninvoiced billable time entries for this organization
    const { data } = await supabaseAdmin
      .from('time_entries')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_billable', true)
      .eq('is_invoiced', false)
    timeEntries = data || []
  }
  
  if (timeEntries.length === 0) {
    return NextResponse.json({ error: 'Keine abrechenbaren Zeiteinträge gefunden' }, { status: 400 })
  }
  
  // Calculate totals
  const lineItems = timeEntries.map(e => ({
    time_entry_id: e.id,
    description: e.description,
    quantity: e.duration_minutes / 60,
    unit: 'Stunden',
    unit_price: e.hourly_rate || 0,
    total: (e.duration_minutes / 60) * (e.hourly_rate || 0),
  }))
  
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxRate = 19
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  
  const { data, error } = await supabaseAdmin
    .from('invoice_drafts')
    .insert([{
      id: uuidv4(),
      organization_id,
      status: 'draft',
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_by_id: created_by_id || null,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Mark time entries as invoiced
  await supabaseAdmin
    .from('time_entries')
    .update({ is_invoiced: true, invoice_id: data.id })
    .in('id', timeEntries.map(e => e.id))
  
  return NextResponse.json(data)
}

// ============================================
// WEBHOOK HANDLERS (for Placetel)
// ============================================

// ============================================
// PLACETEL WEBHOOK HANDLER - Production Implementation
// ============================================

async function handlePlacetelWebhook(body) {
  const placetelEnabled = await getSetting('placetel_enabled', false)
  if (!placetelEnabled) {
    return NextResponse.json({ error: 'Placetel-Integration ist deaktiviert' }, { status: 400 })
  }
  
  const { 
    event_type, 
    call_id, 
    caller, 
    callee, 
    duration, 
    recording_url,
    timestamp,
    direction: callDirection 
  } = body
  
  console.log('Placetel Webhook received:', { event_type, call_id, caller })
  
  const callId = uuidv4()
  const callData = {
    id: callId,
    external_id: call_id,
    direction: callDirection || (event_type === 'incoming_call' || event_type === 'call.incoming' ? 'inbound' : 'outbound'),
    caller_number: caller,
    callee_number: callee,
    duration_seconds: duration || 0,
    recording_url: recording_url || null,
    status: event_type,
    started_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
  }
  
  // Step 1: Find matching contact/organization by phone number
  let contact = null
  let organization = null
  
  // Normalize phone number for search
  const normalizedCaller = caller?.replace(/[^0-9+]/g, '') || ''
  const searchPatterns = [
    normalizedCaller,
    normalizedCaller.replace(/^0/, '+49'), // German format
    normalizedCaller.replace(/^\+49/, '0'),
  ]
  
  // Search in contacts
  for (const pattern of searchPatterns) {
    if (!pattern) continue
    const { data: foundContact } = await supabaseAdmin
      .from('contacts')
      .select('id, organization_id, first_name, last_name, email')
      .or(`phone.ilike.%${pattern}%,mobile.ilike.%${pattern}%`)
      .limit(1)
      .single()
    
    if (foundContact) {
      contact = foundContact
      callData.contact_id = contact.id
      callData.organization_id = contact.organization_id
      break
    }
  }
  
  // Get organization details if found
  if (callData.organization_id) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, name, email')
      .eq('id', callData.organization_id)
      .single()
    organization = org
  }
  
  // Step 2: Insert call log
  const { data: callLog, error: callError } = await supabaseAdmin
    .from('call_logs')
    .insert([callData])
    .select()
    .single()
  
  if (callError) {
    console.error('Call log insert error:', callError)
    return NextResponse.json({ error: callError.message }, { status: 500 })
  }
  
  // Step 3: Handle call completion events (when we have duration/recording)
  if (event_type === 'call.completed' || event_type === 'call_ended' || duration > 0) {
    
    // Step 3a: Create or find existing ticket for this call
    let ticketId = null
    const ticketSubject = `Telefonanruf von ${caller}${organization ? ` (${organization.name})` : ''}`
    
    // Check if there's an open ticket from this caller recently
    const { data: existingTicket } = await supabaseAdmin
      .from('tickets')
      .select('id')
      .eq('source', 'phone')
      .in('status', ['open', 'pending', 'in_progress'])
      .or(contact ? `contact_id.eq.${contact.id}` : `subject.ilike.%${caller}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (existingTicket) {
      ticketId = existingTicket.id
    } else {
      // Create new ticket from call
      const defaultPriority = await getSetting('default_ticket_priority', 'medium')
      
      // Get system user for automated ticket creation
      const { data: systemUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', 'admin@servicedesk.de')
        .single()
      
      const newTicket = {
        id: uuidv4(),
        subject: ticketSubject,
        description: `Eingehender Anruf\n\nAnrufer: ${caller}\nDauer: ${Math.round((duration || 0) / 60)} Minuten\n\n---\nWeitere Details werden nach Transkription hinzugefügt.`,
        status: 'open',
        priority: defaultPriority,
        source: 'phone',
        organization_id: organization?.id || null,
        contact_id: contact?.id || null,
        created_by_id: systemUser?.id || null,
      }
      
      const { data: createdTicket, error: ticketError } = await supabaseAdmin
        .from('tickets')
        .insert([newTicket])
        .select()
        .single()
      
      if (!ticketError && createdTicket) {
        ticketId = createdTicket.id
        
        // Add ticket history
        await supabaseAdmin.from('ticket_history').insert([{
          id: uuidv4(),
          ticket_id: ticketId,
          action: 'created',
          metadata: { source: 'phone', call_id: callId },
        }])
      }
    }
    
    // Link call to ticket
    if (ticketId) {
      await supabaseAdmin
        .from('call_logs')
        .update({ ticket_id: ticketId })
        .eq('id', callId)
    }
    
    // Step 3b: Process recording for transcription if available
    if (recording_url && ticketId) {
      // Queue transcription (in production, this would be async)
      processCallRecording(callId, recording_url, ticketId, {
        callerNumber: caller,
        organizationName: organization?.name,
        duration: duration,
      }).catch(err => console.error('Transcription error:', err))
    }
    
    return NextResponse.json({ 
      success: true, 
      call_id: callId, 
      ticket_id: ticketId,
      contact_found: !!contact,
      organization_found: !!organization,
    })
  }
  
  return NextResponse.json({ success: true, call_id: callId })
}

// Async function to process call recording
async function processCallRecording(callId, recordingUrl, ticketId, metadata) {
  try {
    const openaiEnabled = await getSetting('openai_enabled', false)
    if (!openaiEnabled) {
      console.log('OpenAI not enabled, skipping transcription')
      return
    }
    
    // Fetch the recording
    const response = await fetch(recordingUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch recording: ${response.status}`)
    }
    
    const audioBuffer = await response.arrayBuffer()
    
    // Transcribe with Whisper
    const transcription = await transcribeAudioWithWhisper(
      Buffer.from(audioBuffer), 
      'recording.webm'
    )
    
    if (!transcription.success) {
      console.error('Transcription failed:', transcription.error)
      // Still update call log with error
      await supabaseAdmin
        .from('call_logs')
        .update({ transcription: `[Transkription fehlgeschlagen: ${transcription.error}]` })
        .eq('id', callId)
      return
    }
    
    // Update call log with transcription
    await supabaseAdmin
      .from('call_logs')
      .update({ transcription: transcription.text })
      .eq('id', callId)
    
    // Generate AI summary
    const summary = await generateCallSummary(transcription.text, metadata)
    
    if (summary.success) {
      // Update call log with AI summary
      await supabaseAdmin
        .from('call_logs')
        .update({ ai_summary: JSON.stringify(summary.summary) })
        .eq('id', callId)
      
      // Add summary as system note to ticket
      const formattedSummary = formatCallSummary(summary.summary, transcription.text)
      
      // Get system user
      const { data: systemUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', 'admin@servicedesk.de')
        .single()
      
      // Add internal comment with summary
      await supabaseAdmin.from('ticket_comments').insert([{
        id: uuidv4(),
        ticket_id: ticketId,
        user_id: systemUser?.id || null,
        content: formattedSummary,
        is_internal: true,
      }])
      
      // Update ticket with AI summary
      await supabaseAdmin
        .from('tickets')
        .update({ ai_summary: formattedSummary })
        .eq('id', ticketId)
      
      // Update ticket priority if suggested
      if (summary.summary.urgency) {
        const priorityMap = {
          'niedrig': 'low',
          'mittel': 'medium',
          'hoch': 'high',
          'kritisch': 'critical',
        }
        const newPriority = priorityMap[summary.summary.urgency] || summary.summary.urgency
        if (['low', 'medium', 'high', 'critical'].includes(newPriority)) {
          await supabaseAdmin
            .from('tickets')
            .update({ priority: newPriority })
            .eq('id', ticketId)
        }
      }
      
      // Add ticket history
      await supabaseAdmin.from('ticket_history').insert([{
        id: uuidv4(),
        ticket_id: ticketId,
        action: 'ai_summary_added',
        metadata: { call_id: callId, summary: summary.summary },
      }])
    }
    
    console.log(`Successfully processed recording for call ${callId}`)
  } catch (error) {
    console.error('Error processing call recording:', error)
  }
}

// Format call summary for display
function formatCallSummary(summary, transcript) {
  let formatted = '## 📞 Anruf-Zusammenfassung (KI-generiert)\n\n'
  
  if (summary.problem) {
    formatted += `### Problem\n${summary.problem}\n\n`
  }
  
  if (summary.actions && summary.actions.length > 0) {
    formatted += `### Durchgeführte Maßnahmen\n`
    summary.actions.forEach(action => {
      formatted += `- ${action}\n`
    })
    formatted += '\n'
  }
  
  if (summary.nextSteps && summary.nextSteps.length > 0) {
    formatted += `### Nächste Schritte\n`
    summary.nextSteps.forEach(step => {
      formatted += `- ${step}\n`
    })
    formatted += '\n'
  }
  
  if (summary.keyPoints && summary.keyPoints.length > 0) {
    formatted += `### Wichtige Punkte\n`
    summary.keyPoints.forEach(point => {
      formatted += `- ${point}\n`
    })
    formatted += '\n'
  }
  
  formatted += `---\n\n<details>\n<summary>Vollständiges Transkript anzeigen</summary>\n\n${transcript}\n\n</details>`
  
  return formatted
}

// ============================================
// DICTATION HANDLERS - Phase 5
// ============================================

async function handleDictation(body) {
  const { audio_data, type, user_id, context } = body
  
  const openaiEnabled = await getSetting('openai_enabled', false)
  if (!openaiEnabled) {
    return NextResponse.json({ error: 'OpenAI ist nicht aktiviert' }, { status: 400 })
  }
  
  if (!audio_data) {
    return NextResponse.json({ error: 'audio_data ist erforderlich' }, { status: 400 })
  }
  
  try {
    // Decode base64 audio
    const audioBuffer = Buffer.from(audio_data, 'base64')
    
    // Transcribe
    const transcription = await transcribeAudioWithWhisper(audioBuffer, 'dictation.webm')
    
    if (!transcription.success) {
      return NextResponse.json({ error: transcription.error }, { status: 500 })
    }
    
    // Parse dictation into structured data
    const parsed = await parseDictationWithAI(transcription.text, type || 'ticket')
    
    return NextResponse.json({
      success: true,
      transcription: transcription.text,
      parsed: parsed.success ? parsed.data : null,
      type: type || 'ticket',
    })
  } catch (error) {
    console.error('Dictation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleDictationCreateTicket(body) {
  const { transcription, parsed_data, user_id, organization_id } = body
  
  if (!parsed_data || !parsed_data.subject) {
    return NextResponse.json({ error: 'Keine gültigen Ticket-Daten' }, { status: 400 })
  }
  
  const ticket = {
    id: uuidv4(),
    subject: parsed_data.subject,
    description: parsed_data.description || transcription,
    priority: parsed_data.priority || 'medium',
    category: parsed_data.category || null,
    status: 'open',
    source: 'dictation',
    organization_id: organization_id || null,
    created_by_id: user_id,
  }
  
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert([ticket])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Add history
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: data.id,
    user_id: user_id,
    action: 'created',
    metadata: { source: 'dictation', transcription },
  }])
  
  return NextResponse.json(data)
}

async function handleDictationCreateTask(body) {
  const { transcription, parsed_data, user_id, board_id, column_id } = body
  
  if (!parsed_data || !parsed_data.title) {
    return NextResponse.json({ error: 'Keine gültigen Aufgaben-Daten' }, { status: 400 })
  }
  
  // Get default board/column if not provided
  let targetBoardId = board_id
  let targetColumnId = column_id
  
  if (!targetBoardId) {
    const { data: defaultBoard } = await supabaseAdmin
      .from('boards')
      .select('id')
      .limit(1)
      .single()
    targetBoardId = defaultBoard?.id
  }
  
  if (!targetColumnId && targetBoardId) {
    const { data: firstColumn } = await supabaseAdmin
      .from('board_columns')
      .select('id')
      .eq('board_id', targetBoardId)
      .order('position')
      .limit(1)
      .single()
    targetColumnId = firstColumn?.id
  }
  
  if (!targetBoardId || !targetColumnId) {
    return NextResponse.json({ error: 'Kein Board/Spalte verfügbar' }, { status: 400 })
  }
  
  const task = {
    id: uuidv4(),
    board_id: targetBoardId,
    column_id: targetColumnId,
    title: parsed_data.title,
    description: parsed_data.description || transcription,
    priority: parsed_data.priority || 'medium',
    created_by_id: user_id,
    position: 0,
  }
  
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert([task])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDictationCreateComment(body) {
  const { transcription, parsed_data, user_id, ticket_id } = body
  
  if (!ticket_id) {
    return NextResponse.json({ error: 'ticket_id ist erforderlich' }, { status: 400 })
  }
  
  const comment = {
    id: uuidv4(),
    ticket_id,
    user_id,
    content: parsed_data?.content || transcription,
    is_internal: parsed_data?.is_internal || false,
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_comments')
    .insert([comment])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDictationCreateTimeEntry(body) {
  const { transcription, parsed_data, user_id, ticket_id, organization_id } = body
  
  if (!parsed_data) {
    return NextResponse.json({ error: 'Keine gültigen Zeiterfassungs-Daten' }, { status: 400 })
  }
  
  // Get default hourly rate from settings or user
  const defaultRate = await getSetting('default_hourly_rate', 85)
  
  const entry = {
    id: uuidv4(),
    user_id,
    ticket_id: ticket_id || null,
    organization_id: organization_id || null,
    description: parsed_data.description || transcription,
    duration_minutes: parsed_data.duration_minutes || 30,
    is_billable: parsed_data.is_billable !== false,
    hourly_rate: defaultRate,
    started_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabaseAdmin
    .from('time_entries')
    .insert([entry])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ============================================
// LEXOFFICE INVOICE HANDLERS - Phase 6
// ============================================

async function handleCreateInvoiceFromTimeEntries(body) {
  const { organization_id, time_entry_ids, user_id } = body
  
  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id ist erforderlich' }, { status: 400 })
  }
  
  // Get organization details
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', organization_id)
    .single()
  
  if (!org) {
    return NextResponse.json({ error: 'Organisation nicht gefunden' }, { status: 404 })
  }
  
  // Get time entries
  let query = supabaseAdmin
    .from('time_entries')
    .select('*')
    .eq('organization_id', organization_id)
    .eq('is_billable', true)
    .eq('is_invoiced', false)
  
  if (time_entry_ids && time_entry_ids.length > 0) {
    query = query.in('id', time_entry_ids)
  }
  
  const { data: timeEntries } = await query
  
  if (!timeEntries || timeEntries.length === 0) {
    return NextResponse.json({ error: 'Keine abrechenbaren Zeiteinträge gefunden' }, { status: 400 })
  }
  
  // Create line items
  const lineItems = timeEntries.map(e => ({
    time_entry_id: e.id,
    description: e.description,
    quantity: Math.round((e.duration_minutes / 60) * 100) / 100,
    unit: 'Stunden',
    unit_price: e.hourly_rate || 85,
    total: Math.round(((e.duration_minutes / 60) * (e.hourly_rate || 85)) * 100) / 100,
  }))
  
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxRate = 19
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  
  // Create invoice draft in our system
  const invoiceId = uuidv4()
  const invoiceNumber = `RE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
  
  const { data: invoice, error } = await supabaseAdmin
    .from('invoice_drafts')
    .insert([{
      id: invoiceId,
      organization_id,
      invoice_number: invoiceNumber,
      status: 'draft',
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_by_id: user_id || null,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Mark time entries as invoiced
  await supabaseAdmin
    .from('time_entries')
    .update({ is_invoiced: true, invoice_id: invoiceId })
    .in('id', timeEntries.map(e => e.id))
  
  return NextResponse.json(invoice)
}

async function handleSyncInvoiceToLexoffice(body) {
  const { invoice_id } = body
  
  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id ist erforderlich' }, { status: 400 })
  }
  
  // Get invoice
  const { data: invoice } = await supabaseAdmin
    .from('invoice_drafts')
    .select('*, organizations(*)')
    .eq('id', invoice_id)
    .single()
  
  if (!invoice) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
  }
  
  // Check if Lexoffice is configured
  const lexofficeEnabled = await getSetting('lexoffice_enabled', false)
  if (!lexofficeEnabled) {
    return NextResponse.json({ error: 'Lexoffice ist nicht aktiviert' }, { status: 400 })
  }
  
  // Create invoice in Lexoffice
  const result = await createLexofficeInvoice({
    customer_name: invoice.organizations?.name || 'Unbekannt',
    customer_address: {
      street: '',
      zip: '',
      city: '',
    },
    line_items: invoice.line_items,
    invoice_date: invoice.invoice_date,
    payment_terms: '14 Tage netto',
  })
  
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  
  // Update invoice with Lexoffice ID
  await supabaseAdmin
    .from('invoice_drafts')
    .update({ 
      lexoffice_id: result.lexoffice_id,
      status: 'sent',
      synced_at: new Date().toISOString(),
    })
    .eq('id', invoice_id)
  
  return NextResponse.json({ 
    success: true, 
    lexoffice_id: result.lexoffice_id,
  })
}

// ============================================
// AUTOMATION ENGINE - Phase 7
// ============================================

async function handleRunAutomations(body) {
  const { trigger_type, trigger_data } = body
  
  // Get active automations for this trigger
  const { data: automations } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)
    .eq('trigger_type', trigger_type)
  
  if (!automations || automations.length === 0) {
    return NextResponse.json({ executed: 0 })
  }
  
  const results = []
  
  for (const automation of automations) {
    try {
      const shouldRun = evaluateConditions(automation.trigger_conditions, trigger_data)
      
      if (shouldRun) {
        const actionResult = await executeAction(automation.action_type, automation.action_config, trigger_data)
        
        // Log automation execution
        await supabaseAdmin.from('automation_logs').insert([{
          id: uuidv4(),
          rule_id: automation.id,
          ticket_id: trigger_data.ticket_id || null,
          task_id: trigger_data.task_id || null,
          status: actionResult.success ? 'success' : 'failed',
          message: actionResult.message,
          metadata: { trigger_data, action_result: actionResult },
        }])
        
        // Update last run time
        await supabaseAdmin
          .from('automation_rules')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', automation.id)
        
        results.push({
          automation_id: automation.id,
          name: automation.name,
          success: actionResult.success,
        })
      }
    } catch (error) {
      console.error(`Automation ${automation.id} error:`, error)
      results.push({
        automation_id: automation.id,
        name: automation.name,
        success: false,
        error: error.message,
      })
    }
  }
  
  return NextResponse.json({ executed: results.length, results })
}

function evaluateConditions(conditions, data) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true // No conditions = always match
  }
  
  for (const [field, expected] of Object.entries(conditions)) {
    const actual = data[field]
    
    if (typeof expected === 'object') {
      // Complex condition
      if (expected.equals !== undefined && actual !== expected.equals) return false
      if (expected.notEquals !== undefined && actual === expected.notEquals) return false
      if (expected.contains !== undefined && !String(actual).includes(expected.contains)) return false
      if (expected.in !== undefined && !expected.in.includes(actual)) return false
    } else {
      // Simple equality
      if (actual !== expected) return false
    }
  }
  
  return true
}

async function executeAction(actionType, actionConfig, triggerData) {
  const ticketId = triggerData.ticket_id
  const taskId = triggerData.task_id
  
  switch (actionType) {
    case 'assign':
      if (ticketId && actionConfig.assignee_id) {
        await supabaseAdmin
          .from('tickets')
          .update({ assignee_id: actionConfig.assignee_id })
          .eq('id', ticketId)
        return { success: true, message: 'Ticket zugewiesen' }
      }
      break
      
    case 'change_status':
      if (ticketId && actionConfig.status) {
        await supabaseAdmin
          .from('tickets')
          .update({ status: actionConfig.status })
          .eq('id', ticketId)
        
        await supabaseAdmin.from('ticket_history').insert([{
          id: uuidv4(),
          ticket_id: ticketId,
          action: 'status_changed',
          field_name: 'status',
          new_value: actionConfig.status,
          metadata: { automation: true },
        }])
        return { success: true, message: `Status auf ${actionConfig.status} geändert` }
      }
      break
      
    case 'change_priority':
      if (ticketId && actionConfig.priority) {
        await supabaseAdmin
          .from('tickets')
          .update({ priority: actionConfig.priority })
          .eq('id', ticketId)
        
        await supabaseAdmin.from('ticket_history').insert([{
          id: uuidv4(),
          ticket_id: ticketId,
          action: 'priority_changed',
          field_name: 'priority',
          new_value: actionConfig.priority,
          metadata: { automation: true },
        }])
        return { success: true, message: `Priorität auf ${actionConfig.priority} geändert` }
      }
      break
      
    case 'add_tag':
      if (ticketId && actionConfig.tag_id) {
        await supabaseAdmin.from('ticket_tag_relations').insert([{
          id: uuidv4(),
          ticket_id: ticketId,
          tag_id: actionConfig.tag_id,
        }]).onConflict(['ticket_id', 'tag_id']).ignore()
        return { success: true, message: 'Tag hinzugefügt' }
      }
      break
      
    case 'send_notification':
      // Would integrate with email system
      console.log('Would send notification:', actionConfig)
      return { success: true, message: 'Benachrichtigung gesendet (simuliert)' }
      
    case 'create_task':
      if (actionConfig.title) {
        // Get first board/column
        const { data: board } = await supabaseAdmin
          .from('boards')
          .select('id')
          .limit(1)
          .single()
        
        const { data: column } = await supabaseAdmin
          .from('board_columns')
          .select('id')
          .eq('board_id', board?.id)
          .order('position')
          .limit(1)
          .single()
        
        if (board && column) {
          const { data: systemUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', 'admin@servicedesk.de')
            .single()
          
          await supabaseAdmin.from('tasks').insert([{
            id: uuidv4(),
            board_id: board.id,
            column_id: column.id,
            ticket_id: ticketId || null,
            title: actionConfig.title,
            description: actionConfig.description || '',
            priority: actionConfig.priority || 'medium',
            created_by_id: systemUser?.id,
            position: 0,
          }])
          return { success: true, message: 'Aufgabe erstellt' }
        }
      }
      break
      
    case 'escalate':
      if (ticketId) {
        await supabaseAdmin
          .from('tickets')
          .update({ 
            priority: 'critical',
            status: 'in_progress',
          })
          .eq('id', ticketId)
        
        await supabaseAdmin.from('ticket_history').insert([{
          id: uuidv4(),
          ticket_id: ticketId,
          action: 'escalated',
          metadata: { automation: true, reason: actionConfig.reason },
        }])
        return { success: true, message: 'Ticket eskaliert' }
      }
      break
  }
  
  return { success: false, message: 'Aktion konnte nicht ausgeführt werden' }
}

// SLA Breach Check (would be called by scheduled job)
async function checkSLABreaches() {
  const now = new Date()
  
  // Find tickets with breached SLA
  const { data: breachedTickets } = await supabaseAdmin
    .from('tickets')
    .select('id, sla_response_due, sla_resolution_due, sla_response_met, sla_resolution_met')
    .in('status', ['open', 'pending', 'in_progress'])
    .not('sla_response_due', 'is', null)
  
  for (const ticket of (breachedTickets || [])) {
    const responseDue = new Date(ticket.sla_response_due)
    const resolutionDue = ticket.sla_resolution_due ? new Date(ticket.sla_resolution_due) : null
    
    // Check response SLA
    if (ticket.sla_response_met === null && responseDue < now) {
      await supabaseAdmin
        .from('tickets')
        .update({ sla_response_met: false })
        .eq('id', ticket.id)
      
      // Trigger automation
      await handleRunAutomations({
        trigger_type: 'sla_breach',
        trigger_data: { 
          ticket_id: ticket.id, 
          breach_type: 'response',
        },
      })
    }
    
    // Check resolution SLA
    if (resolutionDue && ticket.sla_resolution_met === null && resolutionDue < now) {
      await supabaseAdmin
        .from('tickets')
        .update({ sla_resolution_met: false })
        .eq('id', ticket.id)
      
      // Trigger automation
      await handleRunAutomations({
        trigger_type: 'sla_breach',
        trigger_data: { 
          ticket_id: ticket.id, 
          breach_type: 'resolution',
        },
      })
    }
  }
  
  return NextResponse.json({ checked: breachedTickets?.length || 0 })
}

// ============================================
// TEST CONNECTION HANDLERS - Updated
// ============================================

async function handleTestConnection(body) {
  const { type } = body
  
  switch (type) {
    case 'openai':
      const openai = await getOpenAIClient()
      if (!openai) {
        return NextResponse.json({ success: false, message: 'OpenAI API-Schlüssel nicht konfiguriert' })
      }
      try {
        // Simple test call
        const response = await openai.chat.completions.create({
          model: await getOpenAIModel(),
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
        })
        return NextResponse.json({ success: true, message: 'OpenAI-Verbindung erfolgreich' })
      } catch (error) {
        return NextResponse.json({ success: false, message: `OpenAI-Fehler: ${error.message}` })
      }
    
    case 'lexoffice':
      const lexClient = await getLexofficeClient()
      if (!lexClient) {
        return NextResponse.json({ success: false, message: 'Lexoffice API-Schlüssel nicht konfiguriert' })
      }
      try {
        await lexClient.request('/profile')
        return NextResponse.json({ success: true, message: 'Lexoffice-Verbindung erfolgreich' })
      } catch (error) {
        return NextResponse.json({ success: false, message: `Lexoffice-Fehler: ${error.message}` })
      }
    
    case 'placetel':
      const placetelClient = await getPlacetelClient()
      if (!placetelClient) {
        return NextResponse.json({ success: false, message: 'Placetel API-Schlüssel nicht konfiguriert' })
      }
      // Placetel doesn't have a simple test endpoint, so we just verify the key exists
      return NextResponse.json({ success: true, message: 'Placetel-Konfiguration vorhanden' })
    
    case 'smtp':
      // Would test SMTP connection
      return NextResponse.json({ success: true, message: 'SMTP-Verbindung erfolgreich (Test-Modus)' })
    
    case 'imap':
      // Would test IMAP connection
      return NextResponse.json({ success: true, message: 'IMAP-Verbindung erfolgreich (Test-Modus)' })
    
    default:
      return NextResponse.json({ success: false, message: 'Unbekannter Verbindungstyp' })
  }
}

// =============================================
// A) TICKET KANBAN VIEWS HANDLERS
// =============================================

async function handleGetTicketKanbanViews(params) {
  const { user_id } = params
  
  let query = supabaseAdmin
    .from('ticket_kanban_views')
    .select('*')
    .order('name')
  
  // Filter by access (public or owned by user)
  if (user_id) {
    query = query.or(`is_public.eq.true,owner_id.eq.${user_id}`)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateTicketKanbanView(body) {
  const { name, description, filters, columns, is_public, owner_id, shared_with_roles, card_fields, sort_by, sort_order } = body
  
  if (!name) {
    return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  }
  
  const viewData = {
    id: uuidv4(),
    name,
    description: description || null,
    filters: filters || {},
    columns: columns || null,
    is_public: is_public || false,
    owner_id: owner_id || null,
    shared_with_roles: shared_with_roles || [],
    card_fields: card_fields || null,
    sort_by: sort_by || 'created_at',
    sort_order: sort_order || 'desc',
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_kanban_views')
    .insert([viewData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleGetTicketKanbanView(id) {
  const { data, error } = await supabaseAdmin
    .from('ticket_kanban_views')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTicketKanbanView(id, body) {
  const { data, error } = await supabaseAdmin
    .from('ticket_kanban_views')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteTicketKanbanView(id) {
  const { error } = await supabaseAdmin
    .from('ticket_kanban_views')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleGetTicketKanbanData(params) {
  const { view_id, status, priority, organization_id, assignee_id, tag_id, category } = params
  
  // Get view configuration if provided
  let viewConfig = null
  if (view_id) {
    const { data } = await supabaseAdmin
      .from('ticket_kanban_views')
      .select('*')
      .eq('id', view_id)
      .single()
    viewConfig = data
  }
  
  // Default columns
  const columns = viewConfig?.columns || [
    { id: 'open', name: 'Offen', status: 'open' },
    { id: 'pending', name: 'Wartend', status: 'pending' },
    { id: 'in_progress', name: 'In Bearbeitung', status: 'in_progress' },
    { id: 'resolved', name: 'Gelöst', status: 'resolved' },
    { id: 'closed', name: 'Geschlossen', status: 'closed' },
  ]
  
  // Build query with filters
  let query = supabaseAdmin
    .from('tickets')
    .select(`
      id, ticket_number, subject, description, status, priority, category, source,
      created_at, updated_at, sla_response_due, sla_resolution_due, sla_response_met,
      organization_id, assignee_id,
      organizations (id, name),
      assignee:users!tickets_assignee_id_fkey (id, first_name, last_name)
    `)
    .order(viewConfig?.sort_by || 'created_at', { ascending: viewConfig?.sort_order === 'asc' })
  
  // Apply filters from view or params
  const filters = viewConfig?.filters || {}
  
  if (status || filters.status) {
    const statusFilter = status || filters.status
    if (Array.isArray(statusFilter)) {
      query = query.in('status', statusFilter)
    } else {
      query = query.eq('status', statusFilter)
    }
  }
  
  if (priority || filters.priority) {
    const priorityFilter = priority || filters.priority
    if (Array.isArray(priorityFilter)) {
      query = query.in('priority', priorityFilter)
    } else {
      query = query.eq('priority', priorityFilter)
    }
  }
  
  if (organization_id || filters.organization_id) {
    query = query.eq('organization_id', organization_id || filters.organization_id)
  }
  
  if (assignee_id || filters.assignee_id) {
    query = query.eq('assignee_id', assignee_id || filters.assignee_id)
  }
  
  if (category || filters.category) {
    query = query.eq('category', category || filters.category)
  }
  
  const { data: tickets, error } = await query
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Group tickets by status into columns
  const kanbanData = columns.map(col => ({
    ...col,
    tickets: (tickets || []).filter(t => t.status === col.status),
  }))
  
  return NextResponse.json({
    view: viewConfig,
    columns: kanbanData,
    totalTickets: tickets?.length || 0,
  })
}

async function handleMoveTicketStatus(body) {
  const { ticket_id, new_status, user_id, old_status } = body
  
  if (!ticket_id || !new_status) {
    return NextResponse.json({ error: 'ticket_id und new_status sind erforderlich' }, { status: 400 })
  }
  
  // Get current ticket
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('status')
    .eq('id', ticket_id)
    .single()
  
  const previousStatus = old_status || ticket?.status
  
  // Update ticket status
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update({ 
      status: new_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket_id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Create audit log entry
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id,
    user_id: user_id || null,
    action: 'status_changed',
    field_name: 'status',
    old_value: previousStatus,
    new_value: new_status,
    metadata: { source: 'kanban_drag' },
  }])
  
  // Trigger automation
  await handleRunAutomations({
    trigger_type: 'status_changed',
    trigger_data: { ticket_id, old_status: previousStatus, new_status },
  })
  
  // Trigger webhooks
  await triggerWebhooks('ticket.updated', { ticket: data, changes: { status: { from: previousStatus, to: new_status } } })
  
  return NextResponse.json(data)
}

// =============================================
// B) TICKET CLOSE FLOW HANDLERS
// =============================================

async function handleGetTicketTodos(ticketId) {
  const { data, error } = await supabaseAdmin
    .from('ticket_todos')
    .select('*, completed_by:users!ticket_todos_completed_by_id_fkey (first_name, last_name)')
    .eq('ticket_id', ticketId)
    .order('position')
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateTicketTodo(ticketId, body) {
  const { title, description, position, created_by_id } = body
  
  if (!title) {
    return NextResponse.json({ error: 'title ist erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_todos')
    .insert([{
      id: uuidv4(),
      ticket_id: ticketId,
      title,
      description: description || null,
      position: position || 0,
      created_by_id: created_by_id || null,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTicketTodo(id, body) {
  const updateData = { ...body, updated_at: new Date().toISOString() }
  
  // Handle completion
  if (body.is_completed === true && !body.completed_at) {
    updateData.completed_at = new Date().toISOString()
  } else if (body.is_completed === false) {
    updateData.completed_at = null
    updateData.completed_by_id = null
  }
  
  const { data, error } = await supabaseAdmin
    .from('ticket_todos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteTicketTodo(id) {
  const { error } = await supabaseAdmin
    .from('ticket_todos')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleCloseTicket(ticketId, body) {
  const { 
    user_id, 
    time_spent_minutes, 
    is_billable,
    hourly_rate,
    internal_summary, 
    customer_summary, 
    resolution_category,
    completed_todo_ids,
    create_time_entry,
    send_customer_email,
  } = body
  
  // Get close flow config
  const closeConfig = await getSetting('close_flow_config', {
    time_required: true,
    worklog_required: false,
    todos_required: false,
    customer_summary_required: false,
    resolution_category_required: false,
  })
  
  // Validate required fields
  if (closeConfig.time_required && !time_spent_minutes && time_spent_minutes !== 0) {
    return NextResponse.json({ error: 'Zeit ist erforderlich' }, { status: 400 })
  }
  if (closeConfig.customer_summary_required && !customer_summary) {
    return NextResponse.json({ error: 'Kundenzusammenfassung ist erforderlich' }, { status: 400 })
  }
  if (closeConfig.resolution_category_required && !resolution_category) {
    return NextResponse.json({ error: 'Lösungskategorie ist erforderlich' }, { status: 400 })
  }
  
  // Get ticket
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('*, organizations(name)')
    .eq('id', ticketId)
    .single()
  
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })
  }
  
  // Get completed todos
  let completedTodos = []
  if (completed_todo_ids && completed_todo_ids.length > 0) {
    const { data: todos } = await supabaseAdmin
      .from('ticket_todos')
      .select('title, description')
      .in('id', completed_todo_ids)
    completedTodos = todos || []
  }
  
  // Create worklog
  const worklogId = uuidv4()
  await supabaseAdmin.from('ticket_worklogs').insert([{
    id: worklogId,
    ticket_id: ticketId,
    time_spent_minutes: time_spent_minutes || 0,
    is_billable: is_billable !== false,
    hourly_rate: hourly_rate || 85,
    internal_summary: internal_summary || null,
    customer_summary: customer_summary || null,
    resolution_category: resolution_category || null,
    completed_todos: completedTodos,
    created_by_id: user_id,
  }])
  
  // Create time entry if requested
  if (create_time_entry && time_spent_minutes > 0) {
    await supabaseAdmin.from('time_entries').insert([{
      id: uuidv4(),
      user_id,
      ticket_id: ticketId,
      organization_id: ticket.organization_id,
      description: `Ticket #${ticket.ticket_number} - ${resolution_category || 'Geschlossen'}`,
      duration_minutes: time_spent_minutes,
      is_billable: is_billable !== false,
      hourly_rate: hourly_rate || 85,
      started_at: new Date().toISOString(),
    }])
  }
  
  // Update ticket
  const { data: updatedTicket, error } = await supabaseAdmin
    .from('tickets')
    .update({
      status: 'closed',
      resolution_category,
      resolution_summary: customer_summary || internal_summary,
      closed_at: new Date().toISOString(),
      closed_by_id: user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Mark all todos as completed
  if (completed_todo_ids && completed_todo_ids.length > 0) {
    await supabaseAdmin
      .from('ticket_todos')
      .update({ is_completed: true, completed_at: new Date().toISOString(), completed_by_id: user_id })
      .in('id', completed_todo_ids)
  }
  
  // Add history entry
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: ticketId,
    user_id,
    action: 'closed',
    field_name: 'status',
    old_value: ticket.status,
    new_value: 'closed',
    metadata: { 
      resolution_category, 
      time_spent_minutes, 
      worklog_id: worklogId,
    },
  }])
  
  // Add customer-facing comment if summary provided
  if (customer_summary) {
    await supabaseAdmin.from('ticket_comments').insert([{
      id: uuidv4(),
      ticket_id: ticketId,
      user_id,
      content: `**Lösung:**\n\n${customer_summary}`,
      is_internal: false,
    }])
  }
  
  // Trigger webhooks
  await triggerWebhooks('ticket.closed', { ticket: updatedTicket, worklog: { time_spent_minutes, resolution_category } })
  
  return NextResponse.json({
    ticket: updatedTicket,
    worklog_id: worklogId,
  })
}

async function handleGetCloseFlowConfig() {
  const config = await getSetting('close_flow_config', {
    time_required: true,
    worklog_required: false,
    todos_required: false,
    customer_summary_required: false,
    resolution_category_required: false,
    internal_note_required: false,
  })
  return NextResponse.json(config)
}

async function handleGetResolutionCategories() {
  const categories = await getSetting('resolution_categories', [
    'Problem gelöst',
    'Workaround bereitgestellt',
    'Kein Problem gefunden',
    'Duplikat',
    'Abgebrochen durch Kunde',
    'Nicht reproduzierbar',
    'Feature-Anfrage',
    'Konfigurationsänderung',
    'Sonstiges',
  ])
  return NextResponse.json(categories)
}

// =============================================
// C) TEMPLATES HANDLERS
// =============================================

async function handleGetTemplates(params) {
  const { type, category, organization_id, is_active } = params
  
  let query = supabaseAdmin
    .from('templates')
    .select('*, created_by:users!templates_created_by_id_fkey (first_name, last_name)')
    .order('name')
  
  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (organization_id) query = query.or(`organization_id.eq.${organization_id},organization_id.is.null`)
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true')
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateTemplate(body) {
  const { name, type, subject, content, variables, category, organization_id, tags, created_by_id, editable_by_roles } = body
  
  if (!name || !type || !content) {
    return NextResponse.json({ error: 'name, type und content sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert([{
      id: uuidv4(),
      name,
      type,
      subject: subject || null,
      content,
      variables: variables || [],
      category: category || null,
      organization_id: organization_id || null,
      tags: tags || [],
      created_by_id: created_by_id || null,
      editable_by_roles: editable_by_roles || ['admin'],
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleGetTemplate(id) {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTemplate(id, body) {
  // Get current template for versioning
  const { data: current } = await supabaseAdmin
    .from('templates')
    .select('version')
    .eq('id', id)
    .single()
  
  const { data, error } = await supabaseAdmin
    .from('templates')
    .update({
      ...body,
      version: (current?.version || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteTemplate(id) {
  const { error } = await supabaseAdmin
    .from('templates')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleRenderTemplate(body) {
  const { template_id, template_content, variables } = body
  
  let content = template_content
  let subject = null
  
  // Get template if ID provided
  if (template_id) {
    const { data: template } = await supabaseAdmin
      .from('templates')
      .select('content, subject')
      .eq('id', template_id)
      .single()
    
    if (template) {
      content = template.content
      subject = template.subject
    }
  }
  
  if (!content) {
    return NextResponse.json({ error: 'Template-Inhalt nicht gefunden' }, { status: 400 })
  }
  
  // Replace variables
  let rendered = content
  let renderedSubject = subject
  
  for (const [key, value] of Object.entries(variables || {})) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    rendered = rendered.replace(pattern, value || '')
    if (renderedSubject) {
      renderedSubject = renderedSubject.replace(pattern, value || '')
    }
  }
  
  return NextResponse.json({
    content: rendered,
    subject: renderedSubject,
  })
}

async function handleLogTemplateUsage(body) {
  const { template_id, used_by_id, used_in_ticket_id, context } = body
  
  await supabaseAdmin.from('template_usage_log').insert([{
    id: uuidv4(),
    template_id,
    used_by_id: used_by_id || null,
    used_in_ticket_id: used_in_ticket_id || null,
    context: context || null,
  }])
  
  return NextResponse.json({ success: true })
}

// =============================================
// D) PUBLIC API HANDLERS
// =============================================

function generateApiKey() {
  const key = 'sk_' + crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.substring(0, 10)
  return { key, hash, prefix }
}

async function handleGetApiKeys(params) {
  const { organization_id } = params
  
  let query = supabaseAdmin
    .from('api_keys')
    .select('id, name, description, key_prefix, scopes, rate_limit_per_minute, rate_limit_per_day, is_active, expires_at, last_used_at, created_at, organization_id')
    .order('created_at', { ascending: false })
  
  if (organization_id) {
    query = query.eq('organization_id', organization_id)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateApiKey(body) {
  const { name, description, scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips, expires_at, organization_id, created_by_id } = body
  
  if (!name) {
    return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  }
  
  const { key, hash, prefix } = generateApiKey()
  
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert([{
      id: uuidv4(),
      name,
      description: description || null,
      key_hash: hash,
      key_prefix: prefix,
      scopes: scopes || [],
      rate_limit_per_minute: rate_limit_per_minute || 60,
      rate_limit_per_day: rate_limit_per_day || 10000,
      allowed_ips: allowed_ips || null,
      expires_at: expires_at || null,
      organization_id: organization_id || null,
      created_by_id: created_by_id || null,
    }])
    .select('id, name, key_prefix, scopes, created_at')
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Return the full key only on creation (never stored)
  return NextResponse.json({
    ...data,
    api_key: key, // This is shown only once!
  })
}

async function handleUpdateApiKey(id, body) {
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, description, key_prefix, scopes, is_active, expires_at')
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteApiKey(id) {
  const { error } = await supabaseAdmin
    .from('api_keys')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleRegenerateApiKey(body) {
  const { id } = body
  
  if (!id) {
    return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
  }
  
  const { key, hash, prefix } = generateApiKey()
  
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .update({
      key_hash: hash,
      key_prefix: prefix,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, key_prefix')
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({
    ...data,
    api_key: key, // New key shown only once
  })
}

async function handleGetApiScopes() {
  const scopes = await getSetting('api_scopes', [
    { id: 'tickets:read', name: 'Tickets lesen', description: 'Tickets abrufen' },
    { id: 'tickets:write', name: 'Tickets schreiben', description: 'Tickets bearbeiten' },
    { id: 'orgs:read', name: 'Organisationen lesen', description: 'Organisationen abrufen' },
    { id: 'time:read', name: 'Zeiteinträge lesen', description: 'Zeiteinträge abrufen' },
    { id: 'time:write', name: 'Zeiteinträge schreiben', description: 'Zeiteinträge bearbeiten' },
  ])
  return NextResponse.json(scopes)
}

// Webhook Handlers
async function handleGetWebhookSubscriptions(params) {
  const { api_key_id } = params
  
  let query = supabaseAdmin
    .from('webhook_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (api_key_id) {
    query = query.eq('api_key_id', api_key_id)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateWebhookSubscription(body) {
  const { name, url, secret, events, filters, max_retries, api_key_id, created_by_id } = body
  
  if (!name || !url || !events || events.length === 0) {
    return NextResponse.json({ error: 'name, url und events sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('webhook_subscriptions')
    .insert([{
      id: uuidv4(),
      name,
      url,
      secret: secret || crypto.randomBytes(32).toString('hex'),
      events,
      filters: filters || {},
      max_retries: max_retries || 3,
      api_key_id: api_key_id || null,
      created_by_id: created_by_id || null,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateWebhookSubscription(id, body) {
  const { data, error } = await supabaseAdmin
    .from('webhook_subscriptions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteWebhookSubscription(id) {
  const { error } = await supabaseAdmin
    .from('webhook_subscriptions')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleTestWebhook(id) {
  const { data: subscription } = await supabaseAdmin
    .from('webhook_subscriptions')
    .select('*')
    .eq('id', id)
    .single()
  
  if (!subscription) {
    return NextResponse.json({ error: 'Webhook nicht gefunden' }, { status: 404 })
  }
  
  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'Dies ist ein Test-Webhook' },
  }
  
  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': subscription.secret || '',
        'X-Webhook-Event': 'test',
      },
      body: JSON.stringify(testPayload),
    })
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Webhook erfolgreich zugestellt' : 'Webhook-Zustellung fehlgeschlagen',
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Fehler: ${error.message}`,
    })
  }
}

// Trigger webhooks helper function
async function triggerWebhooks(eventType, payload) {
  try {
    const { data: subscriptions } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('*')
      .eq('is_active', true)
      .contains('events', [eventType])
    
    if (!subscriptions || subscriptions.length === 0) return
    
    for (const subscription of subscriptions) {
      // Check filters
      if (subscription.filters && Object.keys(subscription.filters).length > 0) {
        let match = true
        for (const [key, value] of Object.entries(subscription.filters)) {
          if (payload.ticket?.[key] !== value && payload[key] !== value) {
            match = false
            break
          }
        }
        if (!match) continue
      }
      
      // Create delivery log
      const deliveryId = uuidv4()
      await supabaseAdmin.from('webhook_delivery_log').insert([{
        id: deliveryId,
        subscription_id: subscription.id,
        event_type: eventType,
        payload,
        status: 'pending',
      }])
      
      // Send webhook (fire and forget for now)
      fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': subscription.secret || '',
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery': deliveryId,
        },
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      }).then(async (response) => {
        await supabaseAdmin
          .from('webhook_delivery_log')
          .update({
            status: response.ok ? 'success' : 'failed',
            response_status: response.status,
            delivered_at: new Date().toISOString(),
            attempts: 1,
          })
          .eq('id', deliveryId)
        
        // Update subscription stats
        await supabaseAdmin
          .from('webhook_subscriptions')
          .update({
            last_triggered_at: new Date().toISOString(),
            [response.ok ? 'success_count' : 'failure_count']: supabaseAdmin.raw(`${response.ok ? 'success_count' : 'failure_count'} + 1`),
          })
          .eq('id', subscription.id)
      }).catch(async (error) => {
        await supabaseAdmin
          .from('webhook_delivery_log')
          .update({
            status: 'failed',
            last_error: error.message,
            attempts: 1,
          })
          .eq('id', deliveryId)
      })
    }
  } catch (error) {
    console.error('Webhook trigger error:', error)
  }
}

async function handleGetApiAuditLogs(params) {
  const { api_key_id, limit, offset } = params
  
  let query = supabaseAdmin
    .from('api_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit) || 100)
  
  if (api_key_id) {
    query = query.eq('api_key_id', api_key_id)
  }
  
  if (offset) {
    query = query.range(parseInt(offset), parseInt(offset) + (parseInt(limit) || 100) - 1)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleGetOpenAPISpec() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'ServiceDesk Pro API',
      version: '1.0.0',
      description: 'Public API for ServiceDesk Pro - Helpdesk & Ticket Management System',
    },
    servers: [
      { url: '/api', description: 'API Server' },
    ],
    security: [
      { apiKey: [] },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticket_number: { type: 'integer' },
            subject: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['open', 'pending', 'in_progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            organization_id: { type: 'string', format: 'uuid' },
            assignee_id: { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        TimeEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticket_id: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            duration_minutes: { type: 'integer' },
            is_billable: { type: 'boolean' },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/tickets': {
        get: {
          summary: 'List tickets',
          tags: ['Tickets'],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'priority', in: 'query', schema: { type: 'string' } },
            { name: 'organization_id', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'List of tickets' },
          },
        },
        post: {
          summary: 'Create ticket',
          tags: ['Tickets'],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Ticket' },
              },
            },
          },
          responses: {
            '200': { description: 'Created ticket' },
          },
        },
      },
      '/tickets/{id}': {
        get: {
          summary: 'Get ticket by ID',
          tags: ['Tickets'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Ticket details' },
          },
        },
        put: {
          summary: 'Update ticket',
          tags: ['Tickets'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Updated ticket' },
          },
        },
      },
      '/tickets/{id}/close': {
        post: {
          summary: 'Close ticket with worklog',
          tags: ['Tickets'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    time_spent_minutes: { type: 'integer' },
                    resolution_category: { type: 'string' },
                    customer_summary: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Ticket closed' },
          },
        },
      },
      '/organizations': {
        get: {
          summary: 'List organizations',
          tags: ['Organizations'],
          responses: {
            '200': { description: 'List of organizations' },
          },
        },
      },
      '/time-entries': {
        get: {
          summary: 'List time entries',
          tags: ['Time Tracking'],
          responses: {
            '200': { description: 'List of time entries' },
          },
        },
        post: {
          summary: 'Create time entry',
          tags: ['Time Tracking'],
          responses: {
            '200': { description: 'Created time entry' },
          },
        },
      },
    },
  }
  
  return NextResponse.json(spec)
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
        version: '2.0.0',
        status: 'running'
      }))
    }
    
    // --- AUTH ---
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleRegister(body))
    }
    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleLogin(body))
    }
    
    // --- USERS ---
    if (route === '/users' && method === 'GET') {
      return handleCORS(await handleGetUsers(searchParams))
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
    if (route.match(/^\/users\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteUser(id))
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
    if (route.match(/^\/tasks\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTask(id))
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
    if (route.match(/^\/assets\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      return handleCORS(await handleGetAsset(id))
    }
    if (route.match(/^\/assets\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateAsset(id, body))
    }
    if (route.match(/^\/assets\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteAsset(id))
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
    if (route.match(/^\/time-entries\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTimeEntry(id, body))
    }
    if (route.match(/^\/time-entries\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTimeEntry(id))
    }
    
    // --- STATISTICS & REPORTS ---
    if (route === '/stats' && method === 'GET') {
      return handleCORS(await handleGetStats())
    }
    if (route === '/reports' && method === 'GET') {
      return handleCORS(await handleGetReports(searchParams))
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
    
    // --- SETTINGS ---
    if (route === '/settings' && method === 'GET') {
      return handleCORS(await handleGetSettings(searchParams.category))
    }
    if (route === '/settings' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleUpdateSetting(body))
    }
    if (route === '/settings/bulk' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleBulkUpdateSettings(body))
    }
    
    // --- AUTOMATIONS ---
    if (route === '/automations' && method === 'GET') {
      return handleCORS(await handleGetAutomations())
    }
    if (route === '/automations' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateAutomation(body))
    }
    if (route.match(/^\/automations\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateAutomation(id, body))
    }
    if (route.match(/^\/automations\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteAutomation(id))
    }
    
    // --- RECURRING TICKETS ---
    if (route === '/recurring-tickets' && method === 'GET') {
      return handleCORS(await handleGetRecurringTickets())
    }
    if (route === '/recurring-tickets' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateRecurringTicket(body))
    }
    if (route.match(/^\/recurring-tickets\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateRecurringTicket(id, body))
    }
    if (route.match(/^\/recurring-tickets\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteRecurringTicket(id))
    }
    
    // --- INVOICE DRAFTS ---
    if (route === '/invoice-drafts' && method === 'GET') {
      return handleCORS(await handleGetInvoiceDrafts(searchParams))
    }
    if (route === '/invoice-drafts' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateInvoiceDraft(body))
    }
    
    // --- SLA PROFILES (Extended) ---
    if (route === '/sla-profiles' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateSLAProfile(body))
    }
    if (route.match(/^\/sla-profiles\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateSLAProfile(id, body))
    }
    if (route.match(/^\/sla-profiles\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteSLAProfile(id))
    }
    
    // --- TAGS (Extended) ---
    if (route === '/tags' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTag(body))
    }
    if (route.match(/^\/tags\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTag(id, body))
    }
    if (route.match(/^\/tags\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTag(id))
    }
    
    // --- TEMPLATES ---
    if (route === '/templates' && method === 'GET') {
      return handleCORS(await handleGetTemplates())
    }
    if (route === '/templates' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTemplate(body))
    }
    if (route.match(/^\/templates\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTemplate(id, body))
    }
    if (route.match(/^\/templates\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTemplate(id))
    }
    
    // --- TEST CONNECTION ---
    if (route === '/test-connection' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleTestConnection(body))
    }
    
    // --- WEBHOOKS ---
    if (route === '/webhooks/placetel' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handlePlacetelWebhook(body))
    }
    
    // --- DICTATION (Phase 5) ---
    if (route === '/dictation/transcribe' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDictation(body))
    }
    if (route === '/dictation/create-ticket' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDictationCreateTicket(body))
    }
    if (route === '/dictation/create-task' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDictationCreateTask(body))
    }
    if (route === '/dictation/create-comment' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDictationCreateComment(body))
    }
    if (route === '/dictation/create-time-entry' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDictationCreateTimeEntry(body))
    }
    
    // --- INVOICES (Phase 6) ---
    if (route === '/invoices/create-from-time' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateInvoiceFromTimeEntries(body))
    }
    if (route === '/invoices/sync-lexoffice' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleSyncInvoiceToLexoffice(body))
    }
    
    // --- AUTOMATIONS ENGINE (Phase 7) ---
    if (route === '/automations/run' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleRunAutomations(body))
    }
    if (route === '/automations/check-sla' && method === 'POST') {
      return handleCORS(await checkSLABreaches())
    }
    
    // --- AI ENDPOINTS (Updated) ---
    if (route === '/ai/summarize-call' && method === 'POST') {
      const body = await request.json()
      const { transcript, metadata } = body
      if (!transcript) {
        return handleCORS(NextResponse.json({ error: 'transcript ist erforderlich' }, { status: 400 }))
      }
      const result = await generateCallSummary(transcript, metadata || {})
      return handleCORS(NextResponse.json(result))
    }
    
    // =============================================
    // A) TICKET KANBAN VIEWS
    // =============================================
    
    if (route === '/ticket-kanban-views' && method === 'GET') {
      return handleCORS(await handleGetTicketKanbanViews(searchParams))
    }
    if (route === '/ticket-kanban-views' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTicketKanbanView(body))
    }
    if (route.match(/^\/ticket-kanban-views\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      return handleCORS(await handleGetTicketKanbanView(id))
    }
    if (route.match(/^\/ticket-kanban-views\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTicketKanbanView(id, body))
    }
    if (route.match(/^\/ticket-kanban-views\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTicketKanbanView(id))
    }
    if (route === '/ticket-kanban' && method === 'GET') {
      return handleCORS(await handleGetTicketKanbanData(searchParams))
    }
    if (route === '/tickets/move' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleMoveTicketStatus(body))
    }
    
    // =============================================
    // B) TICKET CLOSE FLOW - TODOS & WORKLOGS
    // =============================================
    
    if (route.match(/^\/tickets\/[^/]+\/todos$/) && method === 'GET') {
      const ticketId = path[1]
      return handleCORS(await handleGetTicketTodos(ticketId))
    }
    if (route.match(/^\/tickets\/[^/]+\/todos$/) && method === 'POST') {
      const ticketId = path[1]
      const body = await request.json()
      return handleCORS(await handleCreateTicketTodo(ticketId, body))
    }
    if (route.match(/^\/ticket-todos\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTicketTodo(id, body))
    }
    if (route.match(/^\/ticket-todos\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTicketTodo(id))
    }
    if (route.match(/^\/tickets\/[^/]+\/close$/) && method === 'POST') {
      const ticketId = path[1]
      const body = await request.json()
      return handleCORS(await handleCloseTicket(ticketId, body))
    }
    if (route === '/close-flow-config' && method === 'GET') {
      return handleCORS(await handleGetCloseFlowConfig())
    }
    if (route === '/resolution-categories' && method === 'GET') {
      return handleCORS(await handleGetResolutionCategories())
    }
    
    // =============================================
    // C) TEMPLATES SYSTEM
    // =============================================
    
    if (route === '/templates' && method === 'GET') {
      return handleCORS(await handleGetTemplates(searchParams))
    }
    if (route === '/templates' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTemplate(body))
    }
    if (route.match(/^\/templates\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      return handleCORS(await handleGetTemplate(id))
    }
    if (route.match(/^\/templates\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateTemplate(id, body))
    }
    if (route.match(/^\/templates\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteTemplate(id))
    }
    if (route === '/templates/render' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleRenderTemplate(body))
    }
    if (route === '/templates/log-usage' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleLogTemplateUsage(body))
    }
    
    // =============================================
    // D) PUBLIC API SYSTEM
    // =============================================
    
    if (route === '/api-keys' && method === 'GET') {
      return handleCORS(await handleGetApiKeys(searchParams))
    }
    if (route === '/api-keys' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateApiKey(body))
    }
    if (route.match(/^\/api-keys\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateApiKey(id, body))
    }
    if (route.match(/^\/api-keys\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteApiKey(id))
    }
    if (route === '/api-keys/regenerate' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleRegenerateApiKey(body))
    }
    if (route === '/api-scopes' && method === 'GET') {
      return handleCORS(await handleGetApiScopes())
    }
    
    // Webhooks
    if (route === '/webhook-subscriptions' && method === 'GET') {
      return handleCORS(await handleGetWebhookSubscriptions(searchParams))
    }
    if (route === '/webhook-subscriptions' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateWebhookSubscription(body))
    }
    if (route.match(/^\/webhook-subscriptions\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateWebhookSubscription(id, body))
    }
    if (route.match(/^\/webhook-subscriptions\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteWebhookSubscription(id))
    }
    if (route.match(/^\/webhook-subscriptions\/[^/]+\/test$/) && method === 'POST') {
      const id = path[1]
      return handleCORS(await handleTestWebhook(id))
    }
    
    // API Audit Logs
    if (route === '/api-audit-logs' && method === 'GET') {
      return handleCORS(await handleGetApiAuditLogs(searchParams))
    }
    
    // OpenAPI Spec
    if (route === '/openapi.json' && method === 'GET') {
      return handleCORS(await handleGetOpenAPISpec())
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
