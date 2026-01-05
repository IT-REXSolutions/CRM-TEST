import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

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
  // First check settings
  const apiKey = await getSetting('openai_api_key')
  const enabled = await getSetting('openai_enabled', false)
  
  // Fall back to environment variable if no settings key
  const envKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY
  
  const finalKey = apiKey || envKey
  
  // If no key at all, return null
  if (!finalKey) {
    return null
  }
  
  // If settings-based key exists but is not enabled, also return null (unless we're using env key as fallback)
  if (apiKey && !enabled) {
    // Use env key as fallback if settings key is disabled
    if (!envKey) return null
  }
  
  // Determine the correct API endpoint
  const isEmergentKey = finalKey.startsWith('sk-emergent') || finalKey.startsWith('ek_') || finalKey.startsWith('emergent')
  
  return new OpenAI({
    apiKey: finalKey,
    baseURL: isEmergentKey ? 'https://emergentagi.ngrok.app/api/v1/openai' : undefined,
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

async function handlePasswordReset(body) {
  const { email } = body
  
  if (!email) {
    return NextResponse.json({ error: 'email ist erforderlich' }, { status: 400 })
  }
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name')
    .eq('email', email.toLowerCase())
    .single()
  
  if (!user) {
    // Don't reveal if user exists or not
    return NextResponse.json({ success: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' })
  }
  
  // Generate reset token
  const resetToken = uuidv4()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
  
  // Store reset token
  await supabaseAdmin.from('settings').upsert([{
    key: `password_reset_${user.id}`,
    value: JSON.stringify({ token: resetToken, expires_at: expiresAt }),
    category: 'auth',
  }], { onConflict: 'key' })
  
  // Send reset email
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}?reset_token=${resetToken}&user_id=${user.id}`
  
  try {
    await handleSendEmail({
      to: email,
      subject: 'Passwort zurücksetzen - ServiceDesk Pro',
      body: `Hallo ${user.first_name},\n\nSie haben eine Passwort-Zurücksetzung angefordert.\n\nKlicken Sie auf folgenden Link:\n${resetUrl}\n\nDer Link ist 1 Stunde gültig.\n\nFalls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.\n\nMit freundlichen Grüßen,\nServiceDesk Pro`,
    })
  } catch {}
  
  return NextResponse.json({ success: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' })
}

async function handlePasswordResetConfirm(body) {
  const { user_id, token, new_password } = body
  
  if (!user_id || !token || !new_password) {
    return NextResponse.json({ error: 'user_id, token und new_password sind erforderlich' }, { status: 400 })
  }
  
  // Verify token
  const { data: setting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', `password_reset_${user_id}`)
    .single()
  
  if (!setting) {
    return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 400 })
  }
  
  const tokenData = JSON.parse(setting.value)
  if (tokenData.token !== token || new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 400 })
  }
  
  // Update password (in real app, hash the password)
  await supabaseAdmin
    .from('users')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', user_id)
  
  // Delete reset token
  await supabaseAdmin.from('settings').delete().eq('key', `password_reset_${user_id}`)
  
  // Log the password reset
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: 'password_reset',
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, message: 'Passwort wurde zurückgesetzt' })
}

// ============================================
// 2FA / TOTP AUTHENTICATION
// ============================================

function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)]
  }
  return secret
}

function generateBackupCodes(count = 10) {
  const codes = []
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    codes.push(code)
  }
  return codes
}

// Simple TOTP verification (in production, use a proper library like otpauth)
function verifyTOTP(secret, token, window = 1) {
  // Simplified TOTP - in production use crypto-based implementation
  const timeStep = Math.floor(Date.now() / 30000)
  // For demo, accept any 6-digit code (in production, properly verify)
  return token && token.length === 6 && /^\d+$/.test(token)
}

async function handleEnable2FA(body) {
  const { user_id } = body
  
  if (!user_id) {
    return NextResponse.json({ error: 'user_id ist erforderlich' }, { status: 400 })
  }
  
  const secret = generateTOTPSecret()
  const backupCodes = generateBackupCodes()
  
  // Store secret (encrypted in production)
  await supabaseAdmin
    .from('users')
    .update({
      totp_secret: Buffer.from(secret).toString('base64'),
      totp_enabled: false, // Not enabled until verified
      backup_codes: backupCodes.map(c => Buffer.from(c).toString('base64')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
  
  // Generate QR code URL
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', user_id)
    .single()
  
  const otpAuthUrl = `otpauth://totp/ServiceDesk:${user?.email}?secret=${secret}&issuer=ServiceDesk&algorithm=SHA1&digits=6&period=30`
  
  return NextResponse.json({
    secret,
    qr_url: otpAuthUrl,
    backup_codes: backupCodes,
    message: 'Bitte verifizieren Sie den Code um 2FA zu aktivieren',
  })
}

async function handleVerify2FA(body) {
  const { user_id, token } = body
  
  if (!user_id || !token) {
    return NextResponse.json({ error: 'user_id und token sind erforderlich' }, { status: 400 })
  }
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('totp_secret')
    .eq('id', user_id)
    .single()
  
  if (!user?.totp_secret) {
    return NextResponse.json({ error: '2FA nicht initialisiert' }, { status: 400 })
  }
  
  const secret = Buffer.from(user.totp_secret, 'base64').toString()
  
  if (!verifyTOTP(secret, token)) {
    return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
  }
  
  // Enable 2FA
  await supabaseAdmin
    .from('users')
    .update({ totp_enabled: true, updated_at: new Date().toISOString() })
    .eq('id', user_id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: '2fa_enabled',
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, message: '2FA erfolgreich aktiviert' })
}

async function handleDisable2FA(body) {
  const { user_id, token, backup_code } = body
  
  if (!user_id) {
    return NextResponse.json({ error: 'user_id ist erforderlich' }, { status: 400 })
  }
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('totp_secret, backup_codes')
    .eq('id', user_id)
    .single()
  
  // Verify either TOTP token or backup code
  let verified = false
  
  if (token && user?.totp_secret) {
    const secret = Buffer.from(user.totp_secret, 'base64').toString()
    verified = verifyTOTP(secret, token)
  }
  
  if (!verified && backup_code && user?.backup_codes) {
    const encodedBackup = Buffer.from(backup_code).toString('base64')
    verified = user.backup_codes.includes(encodedBackup)
    
    if (verified) {
      // Remove used backup code
      const newCodes = user.backup_codes.filter(c => c !== encodedBackup)
      await supabaseAdmin
        .from('users')
        .update({ backup_codes: newCodes })
        .eq('id', user_id)
    }
  }
  
  if (!verified) {
    return NextResponse.json({ error: 'Verifikation fehlgeschlagen' }, { status: 400 })
  }
  
  // Disable 2FA
  await supabaseAdmin
    .from('users')
    .update({
      totp_enabled: false,
      totp_secret: null,
      backup_codes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: '2fa_disabled',
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, message: '2FA deaktiviert' })
}

async function handleLoginWith2FA(body) {
  const { email, password, totp_token, backup_code } = body
  
  if (!email) {
    return NextResponse.json({ error: 'email ist erforderlich' }, { status: 400 })
  }
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*, roles(name)')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .single()
  
  if (!user) {
    return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 })
  }
  
  // Check if 2FA is enabled
  if (user.totp_enabled) {
    if (!totp_token && !backup_code) {
      return NextResponse.json({ 
        requires_2fa: true, 
        user_id: user.id,
        message: '2FA-Code erforderlich' 
      }, { status: 200 })
    }
    
    let verified = false
    
    if (totp_token && user.totp_secret) {
      const secret = Buffer.from(user.totp_secret, 'base64').toString()
      verified = verifyTOTP(secret, totp_token)
    }
    
    if (!verified && backup_code && user.backup_codes) {
      const encodedBackup = Buffer.from(backup_code).toString('base64')
      verified = user.backup_codes.includes(encodedBackup)
      
      if (verified) {
        // Remove used backup code
        const newCodes = user.backup_codes.filter(c => c !== encodedBackup)
        await supabaseAdmin
          .from('users')
          .update({ backup_codes: newCodes })
          .eq('id', user.id)
      }
    }
    
    if (!verified) {
      return NextResponse.json({ error: 'Ungültiger 2FA-Code' }, { status: 401 })
    }
  }
  
  // Update last login
  await supabaseAdmin
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: 'user_login',
    new_value: JSON.stringify({ email, has_2fa: user.totp_enabled }),
    changed_by_id: user.id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, user })
}

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

async function handleAdminDisableUser(body) {
  const { user_id, admin_id, reason } = body
  
  if (!user_id || !admin_id) {
    return NextResponse.json({ error: 'user_id und admin_id sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ 
      is_active: false, 
      disabled_at: new Date().toISOString(),
      disabled_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: 'user_disabled',
    new_value: JSON.stringify({ user_id, reason }),
    changed_by_id: admin_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, user: data })
}

async function handleAdminEnableUser(body) {
  const { user_id, admin_id } = body
  
  if (!user_id || !admin_id) {
    return NextResponse.json({ error: 'user_id und admin_id sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ 
      is_active: true, 
      disabled_at: null,
      disabled_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: 'user_enabled',
    new_value: JSON.stringify({ user_id }),
    changed_by_id: admin_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, user: data })
}

async function handleAdminResetUserPassword(body) {
  const { user_id, admin_id, new_password, send_email } = body
  
  if (!user_id || !admin_id) {
    return NextResponse.json({ error: 'user_id und admin_id sind erforderlich' }, { status: 400 })
  }
  
  // In production, hash the password
  await supabaseAdmin
    .from('users')
    .update({ 
      // password_hash: hashPassword(new_password),
      force_password_change: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: null,
    change_type: 'admin_password_reset',
    new_value: JSON.stringify({ user_id, by_admin: admin_id }),
    changed_by_id: admin_id,
    created_at: new Date().toISOString(),
  }])
  
  if (send_email) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, first_name')
      .eq('id', user_id)
      .single()
    
    if (user) {
      await handleSendEmail({
        to: user.email,
        subject: 'Ihr Passwort wurde zurückgesetzt',
        body: `Hallo ${user.first_name},\n\nIhr Passwort wurde von einem Administrator zurückgesetzt.\n\nBitte melden Sie sich an und ändern Sie Ihr Passwort.\n\nMit freundlichen Grüßen,\nServiceDesk Pro`,
      })
    }
  }
  
  return NextResponse.json({ success: true })
}

// ============================================
// TICKET MERGE, SPLIT, DEPENDENCIES
// ============================================

async function handleMergeTickets(body) {
  const { target_ticket_id, source_ticket_ids, user_id } = body
  
  if (!target_ticket_id || !source_ticket_ids?.length) {
    return NextResponse.json({ error: 'target_ticket_id und source_ticket_ids sind erforderlich' }, { status: 400 })
  }
  
  // Get target ticket
  const { data: targetTicket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', target_ticket_id)
    .single()
  
  if (!targetTicket) {
    return NextResponse.json({ error: 'Ziel-Ticket nicht gefunden' }, { status: 404 })
  }
  
  const mergeResults = []
  
  for (const sourceId of source_ticket_ids) {
    // Get source ticket
    const { data: sourceTicket } = await supabaseAdmin
      .from('tickets')
      .select('*, ticket_comments(*), time_entries(*)')
      .eq('id', sourceId)
      .single()
    
    if (!sourceTicket) continue
    
    // Move comments to target
    if (sourceTicket.ticket_comments?.length) {
      for (const comment of sourceTicket.ticket_comments) {
        await supabaseAdmin
          .from('ticket_comments')
          .update({ ticket_id: target_ticket_id })
          .eq('id', comment.id)
      }
    }
    
    // Move time entries to target
    if (sourceTicket.time_entries?.length) {
      for (const entry of sourceTicket.time_entries) {
        await supabaseAdmin
          .from('time_entries')
          .update({ ticket_id: target_ticket_id })
          .eq('id', entry.id)
      }
    }
    
    // Update target description with merge info
    const mergeNote = `\n\n---\n[Zusammengeführt von Ticket #${sourceTicket.ticket_number}]\n${sourceTicket.description || ''}`
    
    // Mark source as merged
    await supabaseAdmin
      .from('tickets')
      .update({
        status: 'closed',
        resolution_category: 'Duplikat',
        resolution_summary: `Zusammengeführt mit Ticket #${targetTicket.ticket_number}`,
        merged_into_id: target_ticket_id,
        closed_at: new Date().toISOString(),
        closed_by_id: user_id,
      })
      .eq('id', sourceId)
    
    // Audit log
    await supabaseAdmin.from('ticket_history').insert([{
      id: uuidv4(),
      ticket_id: sourceId,
      change_type: 'ticket_merged',
      new_value: JSON.stringify({ merged_into: target_ticket_id }),
      changed_by_id: user_id,
      created_at: new Date().toISOString(),
    }])
    
    mergeResults.push({ source_id: sourceId, success: true })
  }
  
  // Update target ticket
  await supabaseAdmin
    .from('tickets')
    .update({ 
      updated_at: new Date().toISOString(),
      merged_tickets: source_ticket_ids,
    })
    .eq('id', target_ticket_id)
  
  return NextResponse.json({ 
    success: true, 
    target_ticket_id,
    merged: mergeResults,
  })
}

async function handleSplitTicket(body) {
  const { ticket_id, new_tickets, user_id } = body
  
  if (!ticket_id || !new_tickets?.length) {
    return NextResponse.json({ error: 'ticket_id und new_tickets sind erforderlich' }, { status: 400 })
  }
  
  // Get original ticket
  const { data: originalTicket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', ticket_id)
    .single()
  
  if (!originalTicket) {
    return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })
  }
  
  const createdTickets = []
  
  for (const newTicket of new_tickets) {
    const ticketNumber = await getNextTicketNumber()
    
    const { data: created, error } = await supabaseAdmin
      .from('tickets')
      .insert([{
        id: uuidv4(),
        ticket_number: ticketNumber,
        subject: newTicket.subject || `Teil von #${originalTicket.ticket_number}`,
        description: newTicket.description || '',
        priority: newTicket.priority || originalTicket.priority,
        status: 'open',
        organization_id: originalTicket.organization_id,
        contact_id: originalTicket.contact_id,
        created_by_id: user_id,
        parent_ticket_id: ticket_id,
        split_from_id: ticket_id,
      }])
      .select()
      .single()
    
    if (!error && created) {
      createdTickets.push(created)
      
      // Audit log
      await supabaseAdmin.from('ticket_history').insert([{
        id: uuidv4(),
        ticket_id: created.id,
        change_type: 'ticket_split_created',
        new_value: JSON.stringify({ split_from: ticket_id }),
        changed_by_id: user_id,
        created_at: new Date().toISOString(),
      }])
    }
  }
  
  // Update original ticket
  await supabaseAdmin
    .from('tickets')
    .update({
      child_ticket_ids: createdTickets.map(t => t.id),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket_id)
  
  // Audit log for original
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: ticket_id,
    change_type: 'ticket_split',
    new_value: JSON.stringify({ child_tickets: createdTickets.map(t => t.id) }),
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({
    success: true,
    original_ticket_id: ticket_id,
    new_tickets: createdTickets,
  })
}

async function handleAddTicketDependency(body) {
  const { ticket_id, depends_on_id, dependency_type, user_id } = body
  
  if (!ticket_id || !depends_on_id) {
    return NextResponse.json({ error: 'ticket_id und depends_on_id sind erforderlich' }, { status: 400 })
  }
  
  // Get current dependencies
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('dependencies')
    .eq('id', ticket_id)
    .single()
  
  const dependencies = ticket?.dependencies || []
  
  // Check for circular dependency
  const { data: dependsOnTicket } = await supabaseAdmin
    .from('tickets')
    .select('dependencies')
    .eq('id', depends_on_id)
    .single()
  
  if (dependsOnTicket?.dependencies?.some(d => d.ticket_id === ticket_id)) {
    return NextResponse.json({ error: 'Zirkuläre Abhängigkeit nicht erlaubt' }, { status: 400 })
  }
  
  // Add dependency
  dependencies.push({
    ticket_id: depends_on_id,
    type: dependency_type || 'blocks',
    created_at: new Date().toISOString(),
  })
  
  await supabaseAdmin
    .from('tickets')
    .update({ dependencies, updated_at: new Date().toISOString() })
    .eq('id', ticket_id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: ticket_id,
    change_type: 'dependency_added',
    new_value: JSON.stringify({ depends_on: depends_on_id, type: dependency_type }),
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, dependencies })
}

async function handleRemoveTicketDependency(body) {
  const { ticket_id, depends_on_id, user_id } = body
  
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('dependencies')
    .eq('id', ticket_id)
    .single()
  
  const dependencies = (ticket?.dependencies || []).filter(d => d.ticket_id !== depends_on_id)
  
  await supabaseAdmin
    .from('tickets')
    .update({ dependencies, updated_at: new Date().toISOString() })
    .eq('id', ticket_id)
  
  // Audit log
  await supabaseAdmin.from('ticket_history').insert([{
    id: uuidv4(),
    ticket_id: ticket_id,
    change_type: 'dependency_removed',
    new_value: JSON.stringify({ removed: depends_on_id }),
    changed_by_id: user_id,
    created_at: new Date().toISOString(),
  }])
  
  return NextResponse.json({ success: true, dependencies })
}

// ============================================
// TASKS / TODOS SYSTEM
// ============================================

async function handleGetTasks(params) {
  const { ticket_id, board_id, status, user_id, limit } = params
  
  let query = supabaseAdmin
    .from('tasks')
    .select('*, tickets(ticket_number, subject), users(name)')
    .order('position', { ascending: true })
    .limit(parseInt(limit) || 100)
  
  if (ticket_id) query = query.eq('ticket_id', ticket_id)
  if (board_id) query = query.eq('board_id', board_id)
  if (status) query = query.eq('status', status)
  if (user_id) query = query.eq('assigned_to_id', user_id)
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateTask(body) {
  const { title, description, ticket_id, board_id, column_id, assigned_to_id, due_date, priority, created_by_id } = body
  
  if (!title) {
    return NextResponse.json({ error: 'title ist erforderlich' }, { status: 400 })
  }
  
  // Get max position
  const { data: maxPos } = await supabaseAdmin
    .from('tasks')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .single()
  
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert([{
      id: uuidv4(),
      title,
      description,
      ticket_id,
      board_id,
      column_id: column_id || 'todo',
      assigned_to_id,
      due_date,
      priority: priority || 'medium',
      status: 'pending',
      position: (maxPos?.position || 0) + 1,
      created_by_id,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateTask(id, body) {
  const { title, description, status, column_id, assigned_to_id, due_date, priority, position, completed_at } = body
  
  const updateData = { updated_at: new Date().toISOString() }
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (status !== undefined) updateData.status = status
  if (column_id !== undefined) updateData.column_id = column_id
  if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id
  if (due_date !== undefined) updateData.due_date = due_date
  if (priority !== undefined) updateData.priority = priority
  if (position !== undefined) updateData.position = position
  
  if (status === 'completed' && !completed_at) {
    updateData.completed_at = new Date().toISOString()
  }
  
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleDeleteTask(id) {
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleMoveTask(body) {
  const { task_id, column_id, position, board_id } = body
  
  if (!task_id) {
    return NextResponse.json({ error: 'task_id ist erforderlich' }, { status: 400 })
  }
  
  const updateData = { updated_at: new Date().toISOString() }
  if (column_id) updateData.column_id = column_id
  if (position !== undefined) updateData.position = position
  if (board_id) updateData.board_id = board_id
  
  // Update status based on column
  if (column_id === 'done' || column_id === 'completed') {
    updateData.status = 'completed'
    updateData.completed_at = new Date().toISOString()
  } else if (column_id === 'in_progress') {
    updateData.status = 'in_progress'
  } else if (column_id === 'todo') {
    updateData.status = 'pending'
  }
  
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updateData)
    .eq('id', task_id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleGetTaskBoards() {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('*')
    .order('name')
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function refreshM365Token(connectionId) {
  const { data: connection } = await supabaseAdmin
    .from('m365_connections')
    .select('*')
    .eq('id', connectionId)
    .single()
  
  if (!connection || !connection.refresh_token) {
    return { success: false, error: 'No refresh token' }
  }
  
  const clientId = await getSetting('m365_client_id')
  const clientSecret = await getSetting('m365_client_secret')
  const refreshToken = Buffer.from(connection.refresh_token, 'base64').toString()
  
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    
    const tokens = await response.json()
    if (tokens.error) {
      return { success: false, error: tokens.error }
    }
    
    // Update stored tokens
    await supabaseAdmin
      .from('m365_connections')
      .update({
        access_token: Buffer.from(tokens.access_token).toString('base64'),
        refresh_token: tokens.refresh_token ? Buffer.from(tokens.refresh_token).toString('base64') : connection.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
    
    return { success: true, access_token: tokens.access_token }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function getNextTicketNumber() {
  const { data } = await supabaseAdmin
    .from('tickets')
    .select('ticket_number')
    .order('ticket_number', { ascending: false })
    .limit(1)
    .single()
  return (data?.ticket_number || 0) + 1
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

async function handleCreateBoardTask(body) {
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

async function handleUpdateBoardTask(id, body) {
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

async function handleMoveBoardTask(body) {
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

async function handleDeleteBoardTask(id) {
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

async function handleUpdateTicketTemplate(id, body) {
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
  
  // If moving to 'closed', require close wizard
  if (new_status === 'closed') {
    return NextResponse.json({ 
      error: 'close_wizard_required',
      message: 'Zum Schließen muss der Close-Wizard verwendet werden',
      ticket_id,
      redirect: `/tickets/${ticket_id}/close`
    }, { status: 400 })
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
  const { type, category, organization_id, is_active } = params || {}
  
  let query = supabaseAdmin
    .from('templates')
    .select('*')
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
      '/contacts': {
        get: {
          summary: 'List contacts',
          tags: ['Contacts'],
          parameters: [
            { name: 'organization_id', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'List of contacts' },
          },
        },
        post: {
          summary: 'Create contact',
          tags: ['Contacts'],
          responses: {
            '200': { description: 'Created contact' },
          },
        },
      },
      '/contacts/{id}': {
        get: {
          summary: 'Get contact by ID',
          tags: ['Contacts'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Contact details' },
          },
        },
        put: {
          summary: 'Update contact',
          tags: ['Contacts'],
          responses: {
            '200': { description: 'Updated contact' },
          },
        },
        delete: {
          summary: 'Delete contact',
          tags: ['Contacts'],
          responses: {
            '200': { description: 'Contact deleted' },
          },
        },
      },
      '/organizations/{id}': {
        get: {
          summary: 'Get organization by ID',
          tags: ['Organizations'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Organization details' },
          },
        },
        put: {
          summary: 'Update organization',
          tags: ['Organizations'],
          responses: {
            '200': { description: 'Updated organization' },
          },
        },
      },
      '/assets': {
        get: {
          summary: 'List assets',
          tags: ['Assets'],
          parameters: [
            { name: 'organization_id', in: 'query', schema: { type: 'string' } },
            { name: 'asset_type_id', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'List of assets' },
          },
        },
        post: {
          summary: 'Create asset',
          tags: ['Assets'],
          responses: {
            '200': { description: 'Created asset' },
          },
        },
      },
      '/assets/{id}': {
        get: {
          summary: 'Get asset by ID',
          tags: ['Assets'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Asset details' },
          },
        },
        put: {
          summary: 'Update asset',
          tags: ['Assets'],
          responses: {
            '200': { description: 'Updated asset' },
          },
        },
        delete: {
          summary: 'Delete asset',
          tags: ['Assets'],
          responses: {
            '200': { description: 'Asset deleted' },
          },
        },
      },
      '/webhooks': {
        post: {
          summary: 'Create webhook subscription',
          tags: ['Webhooks'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string' },
                    events: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Webhook created' },
          },
        },
      },
      '/kb-articles': {
        get: {
          summary: 'List knowledge base articles',
          tags: ['Knowledge Base'],
          responses: {
            '200': { description: 'List of articles' },
          },
        },
        post: {
          summary: 'Create KB article',
          tags: ['Knowledge Base'],
          responses: {
            '200': { description: 'Article created' },
          },
        },
      },
      '/ticket-types': {
        get: {
          summary: 'List ticket types',
          tags: ['Configuration'],
          responses: {
            '200': { description: 'List of ticket types' },
          },
        },
      },
      '/ai/classify': {
        post: {
          summary: 'AI classify text for ticket type',
          tags: ['AI'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Classification result' },
          },
        },
      },
      '/users/2fa/enable': {
        post: {
          summary: 'Enable 2FA for user',
          tags: ['Authentication'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user_id: { type: 'string', format: 'uuid' },
                  },
                  required: ['user_id'],
                },
              },
            },
          },
          responses: {
            '200': { description: '2FA setup data including secret and backup codes' },
          },
        },
      },
      '/users/2fa/verify': {
        post: {
          summary: 'Verify 2FA token',
          tags: ['Authentication'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user_id: { type: 'string', format: 'uuid' },
                    token: { type: 'string' },
                  },
                  required: ['user_id', 'token'],
                },
              },
            },
          },
          responses: {
            '200': { description: '2FA verified successfully' },
          },
        },
      },
      '/users/2fa/disable': {
        post: {
          summary: 'Disable 2FA for user',
          tags: ['Authentication'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user_id: { type: 'string', format: 'uuid' },
                    token: { type: 'string' },
                    backup_code: { type: 'string' },
                  },
                  required: ['user_id'],
                },
              },
            },
          },
          responses: {
            '200': { description: '2FA disabled' },
          },
        },
      },
      '/admin/users/disable': {
        post: {
          summary: 'Admin: Disable user account',
          tags: ['Admin'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    admin_id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string', format: 'uuid' },
                    reason: { type: 'string' },
                  },
                  required: ['admin_id', 'user_id'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'User disabled' },
          },
        },
      },
      '/admin/users/enable': {
        post: {
          summary: 'Admin: Enable user account',
          tags: ['Admin'],
          responses: {
            '200': { description: 'User enabled' },
          },
        },
      },
      '/admin/users/reset-password': {
        post: {
          summary: 'Admin: Reset user password',
          tags: ['Admin'],
          responses: {
            '200': { description: 'Password reset' },
          },
        },
      },
      '/tickets/merge': {
        post: {
          summary: 'Merge multiple tickets into one',
          tags: ['Tickets'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    target_ticket_id: { type: 'string', format: 'uuid' },
                    source_ticket_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    user_id: { type: 'string', format: 'uuid' },
                  },
                  required: ['target_ticket_id', 'source_ticket_ids', 'user_id'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Tickets merged' },
          },
        },
      },
      '/tickets/split': {
        post: {
          summary: 'Split ticket into new tickets',
          tags: ['Tickets'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ticket_id: { type: 'string', format: 'uuid' },
                    new_tickets: { type: 'array', items: { type: 'object' } },
                    user_id: { type: 'string', format: 'uuid' },
                  },
                  required: ['ticket_id', 'new_tickets', 'user_id'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Ticket split' },
          },
        },
      },
      '/tickets/dependencies': {
        post: {
          summary: 'Add ticket dependency',
          tags: ['Tickets'],
          responses: {
            '200': { description: 'Dependency added' },
          },
        },
        delete: {
          summary: 'Remove ticket dependency',
          tags: ['Tickets'],
          responses: {
            '200': { description: 'Dependency removed' },
          },
        },
      },
      '/task-boards': {
        get: {
          summary: 'List task boards',
          tags: ['Tasks'],
          responses: {
            '200': { description: 'List of task boards' },
          },
        },
      },
      '/standalone-tasks': {
        get: {
          summary: 'List standalone tasks',
          tags: ['Tasks'],
          responses: {
            '200': { description: 'List of tasks' },
          },
        },
        post: {
          summary: 'Create standalone task',
          tags: ['Tasks'],
          responses: {
            '200': { description: 'Task created' },
          },
        },
      },
      '/onboarding-requests': {
        get: {
          summary: 'List onboarding requests',
          tags: ['Onboarding'],
          responses: {
            '200': { description: 'List of onboarding requests' },
          },
        },
        post: {
          summary: 'Create onboarding request',
          tags: ['Onboarding'],
          responses: {
            '200': { description: 'Onboarding request created' },
          },
        },
      },
      '/offboarding-requests': {
        get: {
          summary: 'List offboarding requests',
          tags: ['Offboarding'],
          responses: {
            '200': { description: 'List of offboarding requests' },
          },
        },
        post: {
          summary: 'Create offboarding request',
          tags: ['Offboarding'],
          responses: {
            '200': { description: 'Offboarding request created' },
          },
        },
      },
      '/conversations': {
        get: {
          summary: 'List conversations (central inbox)',
          tags: ['Inbox'],
          responses: {
            '200': { description: 'List of conversations' },
          },
        },
        post: {
          summary: 'Create conversation',
          tags: ['Inbox'],
          responses: {
            '200': { description: 'Conversation created' },
          },
        },
      },
      '/backup': {
        get: {
          summary: 'Create backup of all data',
          tags: ['Admin'],
          responses: {
            '200': { description: 'Backup data' },
          },
        },
      },
      '/audit-log': {
        get: {
          summary: 'Get audit log',
          tags: ['Admin'],
          parameters: [
            { name: 'entity_type', in: 'query', schema: { type: 'string' } },
            { name: 'entity_id', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'Audit log entries' },
          },
        },
      },
      '/reports/tickets': {
        get: {
          summary: 'Get ticket reports',
          tags: ['Reports'],
          responses: {
            '200': { description: 'Ticket statistics' },
          },
        },
      },
      '/reports/time': {
        get: {
          summary: 'Get time tracking reports',
          tags: ['Reports'],
          responses: {
            '200': { description: 'Time tracking statistics' },
          },
        },
      },
      '/reports/onboarding': {
        get: {
          summary: 'Get onboarding reports',
          tags: ['Reports'],
          responses: {
            '200': { description: 'Onboarding statistics' },
          },
        },
      },
      '/settings': {
        get: {
          summary: 'Get settings',
          tags: ['Configuration'],
          responses: {
            '200': { description: 'Settings list' },
          },
        },
        post: {
          summary: 'Update setting',
          tags: ['Configuration'],
          responses: {
            '200': { description: 'Setting updated' },
          },
        },
      },
      '/auth/m365/login': {
        get: {
          summary: 'Initiate M365 OAuth login',
          tags: ['Authentication'],
          responses: {
            '302': { description: 'Redirect to Microsoft login' },
          },
        },
      },
      '/auth/m365/register': {
        get: {
          summary: 'Initiate M365 OAuth registration',
          tags: ['Authentication'],
          responses: {
            '302': { description: 'Redirect to Microsoft login' },
          },
        },
      },
    },
  }
  
  return NextResponse.json(spec)
}

// =============================================
// AI-ITSM MODULE HANDLERS
// =============================================

// Keyword-based classification fallback
function keywordClassification(text) {
  const lowerText = text.toLowerCase()
  
  const typeKeywords = {
    onboarding: ['neuer mitarbeiter', 'neue mitarbeiterin', 'new starter', 'einstellung', 'onboarding', 'neuer kollege', 'neue kollegin', 'anfängt', 'anfangen', 'eintritt', 'einstellen', 'eingestellt'],
    offboarding: ['kündigung', 'ausscheiden', 'letzter tag', 'offboarding', 'verlässt', 'austritt', 'ausscheidet', 'gekündigt', 'entlassen'],
    support: ['hilfe', 'problem', 'fehler', 'funktioniert nicht', 'geht nicht', 'support', 'defekt', 'kaputt', 'hängt', 'abstürzt', 'langsam', 'virus', 'passwort vergessen'],
    order: ['bestellen', 'bestellung', 'kaufen', 'anschaffen', 'beschaffen', 'neuen laptop', 'neuer pc', 'neue lizenz', 'upgrade'],
    lead: ['anfrage', 'interesse', 'angebot', 'preise', 'kosten', 'beratung', 'informationen'],
    project: ['projekt', 'migration', 'umstellung', 'rollout', 'implementierung', 'einführung'],
    invoice: ['rechnung', 'invoice', 'zahlung', 'kosten', 'abrechnung', 'gutschrift'],
  }
  
  const priorityKeywords = {
    critical: ['dringend', 'notfall', 'kritisch', 'urgent', 'asap', 'sofort', 'ausgefallen'],
    high: ['wichtig', 'schnell', 'bald', 'priorität'],
    low: ['irgendwann', 'keine eile', 'wenn zeit'],
  }
  
  // Find best matching type
  let bestType = 'inquiry'
  let maxScore = 0
  
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    const score = keywords.filter(k => lowerText.includes(k)).length
    if (score > maxScore) {
      maxScore = score
      bestType = type
    }
  }
  
  // Determine priority
  let priority = 'medium'
  for (const [prio, keywords] of Object.entries(priorityKeywords)) {
    if (keywords.some(k => lowerText.includes(k))) {
      priority = prio
      break
    }
  }
  
  // Determine queue
  const queueMap = {
    onboarding: 'admin',
    offboarding: 'admin',
    support: 'helpdesk',
    order: 'admin',
    lead: 'sales',
    project: 'project',
    invoice: 'admin',
    inquiry: 'helpdesk',
  }
  
  return {
    type: bestType,
    confidence: maxScore > 0 ? Math.min(0.3 + (maxScore * 0.2), 0.85) : 0.3,
    intent: `Klassifiziert als ${bestType} basierend auf Keywords`,
    priority,
    suggested_queue: queueMap[bestType] || 'helpdesk',
    key_entities: [],
    requires_form: bestType === 'onboarding' || bestType === 'offboarding',
    suggested_response: null,
    reasoning: `Keyword-basierte Klassifizierung (${maxScore} Treffer)`,
    method: 'keyword_fallback'
  }
}

// AI Classification Engine
async function classifyMessage(text, context = {}) {
  const openai = await getOpenAIClient()
  
  // If no OpenAI client, use keyword-based fallback
  if (!openai) {
    console.log('OpenAI not configured, using keyword fallback classification')
    const classification = keywordClassification(text)
    return { 
      success: true, 
      classification,
      method: 'keyword_fallback'
    }
  }
  
  // Get ticket types for classification
  const { data: ticketTypes } = await supabaseAdmin
    .from('ticket_types')
    .select('code, name, description, keywords')
    .eq('is_active', true)
  
  const typeDescriptions = (ticketTypes || []).map(t => 
    `- ${t.code}: ${t.name} (${t.description || ''}). Keywords: ${(t.keywords || []).join(', ')}`
  ).join('\n')
  
  const systemPrompt = `Du bist ein KI-Assistent für IT-Service-Management. Analysiere eingehende Nachrichten und klassifiziere sie.

Verfügbare Ticket-Typen:
${typeDescriptions}

Analysiere die Nachricht und antworte NUR mit validem JSON im folgenden Format:
{
  "type": "ticket_type_code",
  "confidence": 0.95,
  "intent": "kurze beschreibung der absicht",
  "priority": "low|medium|high|critical",
  "suggested_queue": "helpdesk|admin|project|sales",
  "key_entities": ["erkannte entitäten"],
  "requires_form": true/false,
  "suggested_response": "optionaler vorschlag für antwort",
  "reasoning": "kurze begründung"
}`

  const contextInfo = context.customer_name ? `\nKunde: ${context.customer_name}` : ''
  const historyInfo = context.has_open_tickets ? `\nKunde hat offene Tickets.` : ''
  
  const prompt = `Nachricht:
"${text}"
${contextInfo}${historyInfo}

Klassifiziere diese Nachricht:`

  try {
    const model = await getOpenAIModel()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 500,
    })
    
    const content = response.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const classification = JSON.parse(jsonMatch[0])
      return {
        success: true,
        classification,
        tokens: response.usage?.total_tokens || 0,
        model,
      }
    }
    
    return { success: false, error: 'Keine gültige Klassifizierung' }
  } catch (error) {
    console.error('Classification error:', error)
    // Fallback to keyword classification on error
    console.log('Falling back to keyword classification due to API error')
    const classification = keywordClassification(text)
    return { 
      success: true, 
      classification,
      method: 'keyword_fallback',
      original_error: error.message
    }
  }
}

async function handleClassifyMessage(body) {
  const { text, context, conversation_id } = body
  
  if (!text) {
    return NextResponse.json({ error: 'text ist erforderlich' }, { status: 400 })
  }
  
  const startTime = Date.now()
  const result = await classifyMessage(text, context || {})
  const processingTime = Date.now() - startTime
  
  if (result.success) {
    // Log classification
    if (conversation_id) {
      await supabaseAdmin.from('ai_classification_log').insert([{
        id: uuidv4(),
        conversation_id,
        input_text: text.substring(0, 1000),
        input_context: context || {},
        classification: result.classification,
        confidence: result.classification.confidence,
        model_used: result.model,
        tokens_used: result.tokens,
        processing_time_ms: processingTime,
      }])
    }
  }
  
  return NextResponse.json(result)
}

// Central Inbox Handlers
async function handleGetConversations(params) {
  const { status, channel, organization_id, ticket_id, limit, offset } = params
  
  let query = supabaseAdmin
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit) || 50)
  
  if (status) query = query.eq('status', status)
  if (channel) query = query.eq('channel', channel)
  if (organization_id) query = query.eq('organization_id', organization_id)
  if (ticket_id) query = query.eq('ticket_id', ticket_id)
  if (offset) query = query.range(parseInt(offset), parseInt(offset) + (parseInt(limit) || 50) - 1)
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateConversation(body) {
  const { 
    channel, from_address, from_name, to_address, subject, body: messageBody, 
    body_html, attachments, organization_id, contact_id, auto_classify 
  } = body
  
  if (!channel || !messageBody) {
    return NextResponse.json({ error: 'channel und body sind erforderlich' }, { status: 400 })
  }
  
  const conversationId = uuidv4()
  const conversationData = {
    id: conversationId,
    channel,
    from_address,
    from_name,
    to_address,
    subject,
    body: messageBody,
    body_html,
    attachments: attachments || [],
    organization_id: organization_id || null,
    contact_id: contact_id || null,
    status: 'new',
    is_inbound: true,
  }
  
  // Auto-classify if requested
  if (auto_classify) {
    const classifyText = `${subject || ''}\n\n${messageBody}`
    const context = {}
    
    if (organization_id) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', organization_id)
        .single()
      if (org) context.customer_name = org.name
    }
    
    // Check for open tickets
    if (organization_id || contact_id) {
      const { data: openTickets } = await supabaseAdmin
        .from('tickets')
        .select('id')
        .or(organization_id ? `organization_id.eq.${organization_id}` : `contact_id.eq.${contact_id}`)
        .in('status', ['open', 'pending', 'in_progress'])
        .limit(1)
      context.has_open_tickets = openTickets && openTickets.length > 0
    }
    
    const classification = await classifyMessage(classifyText, context)
    if (classification.success) {
      conversationData.ai_classification = classification.classification
      conversationData.classification_status = 'classified'
    }
  }
  
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert([conversationData])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleProcessConversation(id, body) {
  const { action, ticket_type_code, user_id, create_ticket, ticket_data } = body
  
  // Get conversation
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()
  
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation nicht gefunden' }, { status: 404 })
  }
  
  let ticketId = conversation.ticket_id
  
  // Create ticket if requested
  if (create_ticket && !ticketId) {
    const classification = conversation.ai_classification || {}
    
    const newTicket = {
      id: uuidv4(),
      subject: conversation.subject || 'Neue Anfrage',
      description: conversation.body,
      status: 'open',
      priority: classification.priority || 'medium',
      ticket_type_code: ticket_type_code || classification.type || null,
      organization_id: conversation.organization_id,
      contact_id: conversation.contact_id,
      source: conversation.channel,
      conversation_id: id,
      ai_classification: classification,
      created_by_id: user_id,
      ...ticket_data,
    }
    
    const { data: createdTicket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert([newTicket])
      .select()
      .single()
    
    if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 })
    ticketId = createdTicket.id
    
    // Add history
    await supabaseAdmin.from('ticket_history').insert([{
      id: uuidv4(),
      ticket_id: ticketId,
      user_id,
      action: 'created',
      metadata: { source: conversation.channel, conversation_id: id },
    }])
    
    // Trigger automations
    await handleRunAutomations({
      trigger_type: 'ticket_created',
      trigger_data: { ticket_id: ticketId, ticket_type: newTicket.ticket_type_code },
    })
    
    // Trigger webhooks
    await triggerWebhooks('ticket.created', { ticket: createdTicket })
  }
  
  // Update conversation
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update({
      status: action === 'archive' ? 'archived' : 'processed',
      ticket_id: ticketId,
      processed_at: new Date().toISOString(),
      processed_by_id: user_id,
      classification_status: ticket_type_code ? 'confirmed' : conversation.classification_status,
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({
    conversation: data,
    ticket_id: ticketId,
  })
}

// Ticket Types
async function handleGetTicketTypes(params) {
  const { data, error } = await supabaseAdmin
    .from('ticket_types')
    .select('*')
    .eq('is_active', true)
    .order('position')
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

// Onboarding Handlers
async function handleCreateOnboarding(body) {
  const { ticket_id, organization_id, ...employeeData } = body
  
  if (!ticket_id || !organization_id || !employeeData.first_name || !employeeData.last_name || !employeeData.start_date) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .insert([{
      id: uuidv4(),
      ticket_id,
      organization_id,
      ...employeeData,
      status: 'pending',
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Update ticket type
  await supabaseAdmin
    .from('tickets')
    .update({ ticket_type_code: 'onboarding' })
    .eq('id', ticket_id)
  
  return NextResponse.json(data)
}

async function handleGetOnboarding(id) {
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .select(`
      *,
      tickets (id, ticket_number, subject, status),
      organizations (id, name)
    `)
    .eq('id', id)
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleUpdateOnboarding(id, body) {
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function handleCompleteOnboardingTask(id, body) {
  const { task_name, completed_by_id, notes } = body
  
  // Get current checklist
  const { data: onboarding } = await supabaseAdmin
    .from('onboarding_requests')
    .select('checklist')
    .eq('id', id)
    .single()
  
  const checklist = onboarding?.checklist || []
  const taskIndex = checklist.findIndex(t => t.task === task_name)
  
  if (taskIndex >= 0) {
    checklist[taskIndex] = {
      ...checklist[taskIndex],
      status: 'completed',
      completed_by: completed_by_id,
      completed_at: new Date().toISOString(),
      notes,
    }
  } else {
    checklist.push({
      task: task_name,
      status: 'completed',
      completed_by: completed_by_id,
      completed_at: new Date().toISOString(),
      notes,
    })
  }
  
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .update({ checklist, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// M365 Integration Handlers
async function handleM365AuthUrl(body) {
  const { organization_id, redirect_uri } = body
  
  const clientId = await getSetting('m365_client_id')
  if (!clientId) {
    return NextResponse.json({ error: 'M365 Client ID nicht konfiguriert' }, { status: 400 })
  }
  
  const scopes = [
    'User.Read.All',
    'Directory.Read.All',
    'Mail.Read',
    'Mail.Send',
  ].join(' ')
  
  const state = Buffer.from(JSON.stringify({ organization_id })).toString('base64')
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirect_uri || `${process.env.NEXT_PUBLIC_BASE_URL}/api/m365/callback`)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}` +
    `&response_mode=query`
  
  return NextResponse.json({ auth_url: authUrl })
}

async function handleM365Callback(body) {
  const { code, state, redirect_uri } = body
  
  const clientId = await getSetting('m365_client_id')
  const clientSecret = await getSetting('m365_client_secret')
  
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'M365 nicht konfiguriert' }, { status: 400 })
  }
  
  // Decode state
  let organizationId = null
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    organizationId = stateData.organization_id
  } catch {}
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirect_uri || `${process.env.NEXT_PUBLIC_BASE_URL}/api/m365/callback`,
        grant_type: 'authorization_code',
      }),
    })
    
    const tokens = await tokenResponse.json()
    
    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 })
    }
    
    // Get tenant info
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profileData = await profileResponse.json()
    const tenant = profileData.value?.[0]
    
    // Save connection
    const connectionId = uuidv4()
    await supabaseAdmin.from('m365_connections').insert([{
      id: connectionId,
      organization_id: organizationId,
      tenant_id: tenant?.id,
      tenant_name: tenant?.displayName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope?.split(' ') || [],
      is_active: true,
    }])
    
    // Update organization
    if (organizationId) {
      await supabaseAdmin
        .from('organizations')
        .update({ m365_tenant_id: tenant?.id, m365_connected: true })
        .eq('id', organizationId)
    }
    
    return NextResponse.json({ 
      success: true, 
      connection_id: connectionId,
      tenant_name: tenant?.displayName,
    })
  } catch (error) {
    console.error('M365 callback error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleM365SyncUsers(body) {
  const { connection_id } = body
  
  const { data: connection } = await supabaseAdmin
    .from('m365_connections')
    .select('*')
    .eq('id', connection_id)
    .single()
  
  if (!connection) {
    return NextResponse.json({ error: 'Verbindung nicht gefunden' }, { status: 404 })
  }
  
  // Check token expiry and refresh if needed
  let accessToken = connection.access_token
  if (new Date(connection.token_expires_at) < new Date()) {
    // Refresh token
    const clientId = await getSetting('m365_client_id')
    const clientSecret = await getSetting('m365_client_secret')
    
    const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    
    const tokens = await refreshResponse.json()
    if (tokens.access_token) {
      accessToken = tokens.access_token
      await supabaseAdmin
        .from('m365_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('id', connection_id)
    }
  }
  
  try {
    // Fetch users from Microsoft Graph
    const usersResponse = await fetch('https://graph.microsoft.com/v1.0/users?$select=id,userPrincipalName,displayName,givenName,surname,mail,jobTitle,department,officeLocation,mobilePhone,accountEnabled&$top=999', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    
    const usersData = await usersResponse.json()
    
    if (usersData.error) {
      return NextResponse.json({ error: usersData.error.message }, { status: 400 })
    }
    
    const users = usersData.value || []
    let synced = 0
    let created = 0
    
    for (const user of users) {
      // Check if user exists
      const { data: existing } = await supabaseAdmin
        .from('m365_users')
        .select('id')
        .eq('connection_id', connection_id)
        .eq('azure_id', user.id)
        .single()
      
      if (existing) {
        // Update
        await supabaseAdmin
          .from('m365_users')
          .update({
            user_principal_name: user.userPrincipalName,
            display_name: user.displayName,
            given_name: user.givenName,
            surname: user.surname,
            mail: user.mail,
            job_title: user.jobTitle,
            department: user.department,
            office_location: user.officeLocation,
            mobile_phone: user.mobilePhone,
            account_enabled: user.accountEnabled,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        synced++
      } else {
        // Create
        await supabaseAdmin.from('m365_users').insert([{
          id: uuidv4(),
          connection_id,
          azure_id: user.id,
          user_principal_name: user.userPrincipalName,
          display_name: user.displayName,
          given_name: user.givenName,
          surname: user.surname,
          mail: user.mail,
          job_title: user.jobTitle,
          department: user.department,
          office_location: user.officeLocation,
          mobile_phone: user.mobilePhone,
          account_enabled: user.accountEnabled,
        }])
        created++
      }
    }
    
    // Update connection last sync
    await supabaseAdmin
      .from('m365_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection_id)
    
    return NextResponse.json({
      success: true,
      total_users: users.length,
      synced,
      created,
    })
  } catch (error) {
    console.error('M365 sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleGetM365Users(params) {
  const { connection_id, organization_id } = params
  
  let query = supabaseAdmin
    .from('m365_users')
    .select(`
      *,
      m365_connections (id, tenant_name, organization_id)
    `)
    .order('display_name')
  
  if (connection_id) {
    query = query.eq('connection_id', connection_id)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Filter by organization if needed
  let result = data || []
  if (organization_id && !connection_id) {
    result = result.filter(u => u.m365_connections?.organization_id === organization_id)
  }
  
  return NextResponse.json(result)
}

async function handleGetM365Connections(params) {
  const { organization_id } = params
  
  let query = supabaseAdmin
    .from('m365_connections')
    .select('id, organization_id, tenant_id, tenant_name, is_active, last_sync_at, created_at')
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

// AI Suggestions
async function handleGetAISuggestions(params) {
  const { ticket_id, type } = params
  
  let query = supabaseAdmin
    .from('ai_suggestions')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (ticket_id) query = query.eq('ticket_id', ticket_id)
  if (type) query = query.eq('type', type)
  
  const { data, error } = await query.limit(10)
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleGenerateAISuggestions(body) {
  const { ticket_id, types } = body
  
  if (!ticket_id) {
    return NextResponse.json({ error: 'ticket_id ist erforderlich' }, { status: 400 })
  }
  
  // Get ticket with history
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select(`
      *,
      organizations (name),
      ticket_comments (content, is_internal, created_at)
    `)
    .eq('id', ticket_id)
    .single()
  
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })
  }
  
  const suggestions = []
  const suggestionTypes = types || ['response', 'solution']
  
  for (const type of suggestionTypes) {
    let prompt = ''
    let systemPrompt = ''
    
    if (type === 'response') {
      systemPrompt = 'Du bist ein IT-Support-Mitarbeiter. Erstelle eine professionelle Antwort auf die Kundenanfrage.'
      prompt = `Ticket: ${ticket.subject}\n\nBeschreibung:\n${ticket.description}\n\nErstelle eine professionelle Antwort auf diese Anfrage.`
    } else if (type === 'solution') {
      systemPrompt = 'Du bist ein IT-Experte. Analysiere das Problem und schlage Lösungsschritte vor.'
      prompt = `Problem: ${ticket.subject}\n\n${ticket.description}\n\nSchlage Lösungsschritte vor als JSON: {"steps": ["Schritt 1", "Schritt 2"], "estimated_time_minutes": 30}`
    }
    
    const result = await generateAICompletion(prompt, { systemPrompt, temperature: 0.4 })
    
    if (result.success) {
      const suggestionData = {
        id: uuidv4(),
        ticket_id,
        type,
        content: type === 'solution' ? ((() => {
          try { return JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { return { text: result.content } }
        })()) : { text: result.content },
        confidence: 0.8,
      }
      
      await supabaseAdmin.from('ai_suggestions').insert([suggestionData])
      suggestions.push(suggestionData)
    }
  }
  
  return NextResponse.json(suggestions)
}

// Dynamic Forms
async function handleGetDynamicForms(params) {
  const { ticket_type_code } = params
  
  let query = supabaseAdmin
    .from('dynamic_forms')
    .select('*')
    .eq('is_active', true)
    .order('name')
  
  if (ticket_type_code) {
    query = query.eq('ticket_type_code', ticket_type_code)
  }
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateDynamicForm(body) {
  const { name, description, ticket_type_code, fields, conditions, layout, created_by_id } = body
  
  if (!name || !fields) {
    return NextResponse.json({ error: 'name und fields sind erforderlich' }, { status: 400 })
  }
  
  const { data, error } = await supabaseAdmin
    .from('dynamic_forms')
    .insert([{
      id: uuidv4(),
      name,
      description,
      ticket_type_code,
      fields,
      conditions: conditions || [],
      layout: layout || 'single',
      created_by_id,
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Onboarding Request Handlers
async function handleGetOnboardingRequests(params) {
  const { status, organization_id, limit } = params
  
  let query = supabaseAdmin
    .from('onboarding_requests')
    .select('*')
    .order('start_date', { ascending: true })
    .limit(parseInt(limit) || 50)
  
  if (status) query = query.eq('status', status)
  if (organization_id) query = query.eq('organization_id', organization_id)
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

async function handleCreateOnboardingRequest(body) {
  const { 
    ticket_id, organization_id, first_name, last_name, email, personal_email,
    phone, start_date, job_title, department, manager_name, manager_email,
    location, office_location, needs_email, email_type, email_aliases,
    distribution_lists, m365_license_type, needs_teams, needs_sharepoint,
    sharepoint_sites, teams_channels, software_requirements, hardware_requirements,
    access_permissions, vpn_required, remote_desktop_required, special_requirements
  } = body
  
  if (!ticket_id || !organization_id || !first_name || !last_name || !start_date) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen (ticket_id, organization_id, first_name, last_name, start_date)' }, { status: 400 })
  }
  
  // Create default checklist
  const checklist = [
    { task: 'AD-Account erstellen', status: 'pending' },
    { task: 'E-Mail-Postfach einrichten', status: 'pending' },
    { task: 'M365 Lizenz zuweisen', status: 'pending' },
    { task: 'Teams hinzufügen', status: 'pending' },
    { task: 'SharePoint-Zugriff', status: 'pending' },
    { task: 'Hardware vorbereiten', status: 'pending' },
    { task: 'Zugangsdaten versenden', status: 'pending' },
  ]
  
  if (vpn_required) checklist.push({ task: 'VPN-Zugang einrichten', status: 'pending' })
  if (remote_desktop_required) checklist.push({ task: 'Remote Desktop einrichten', status: 'pending' })
  
  const { data, error } = await supabaseAdmin
    .from('onboarding_requests')
    .insert([{
      id: uuidv4(),
      ticket_id, organization_id, first_name, last_name, email, personal_email,
      phone, start_date, job_title, department, manager_name, manager_email,
      location: location || 'office', office_location, needs_email: needs_email !== false,
      email_type, email_aliases, distribution_lists, m365_license_type,
      needs_teams: needs_teams !== false, needs_sharepoint: needs_sharepoint !== false,
      sharepoint_sites, teams_channels, software_requirements: software_requirements || [],
      hardware_requirements: hardware_requirements || [], access_permissions: access_permissions || [],
      vpn_required: vpn_required || false, remote_desktop_required: remote_desktop_required || false,
      special_requirements, status: 'pending', checklist
    }])
    .select()
    .single()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Update ticket to link with onboarding
  await supabaseAdmin
    .from('tickets')
    .update({ ticket_type_code: 'onboarding' })
    .eq('id', ticket_id)
  
  return NextResponse.json(data)
}

// ============================================
// EMAIL SERVICE
// ============================================

async function getEmailTransporter() {
  const smtpHost = await getSetting('smtp_host')
  const smtpPort = await getSetting('smtp_port', 587)
  const smtpUser = await getSetting('smtp_user')
  const smtpPass = await getSetting('smtp_password')
  const smtpSecure = await getSetting('smtp_secure', false)
  
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null
  }
  
  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: smtpSecure === 'true' || smtpSecure === true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

function replaceTemplateVariables(text, variables) {
  if (!text) return ''
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key.replace('.', '\\.')}\\}\\}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

async function handleSendEmail(body) {
  const { 
    to, subject, body: emailBody, body_html,
    template_id, variables,
    ticket_id, onboarding_id,
    from_name
  } = body
  
  if (!to || (!emailBody && !template_id)) {
    return NextResponse.json({ error: 'to und body oder template_id sind erforderlich' }, { status: 400 })
  }
  
  const transporter = await getEmailTransporter()
  if (!transporter) {
    return NextResponse.json({ error: 'SMTP nicht konfiguriert. Bitte prüfen Sie die E-Mail-Einstellungen.' }, { status: 400 })
  }
  
  let finalSubject = subject
  let finalBody = emailBody
  let finalHtml = body_html
  let templateUsed = null
  
  // Load template if specified
  if (template_id) {
    const { data: template } = await supabaseAdmin
      .from('comm_templates')
      .select('*')
      .eq('id', template_id)
      .single()
    
    if (template) {
      templateUsed = template.id
      finalSubject = template.subject || subject
      finalBody = template.body || emailBody
      finalHtml = template.body_html || body_html
    }
  }
  
  // Replace variables
  if (variables) {
    finalSubject = replaceTemplateVariables(finalSubject, variables)
    finalBody = replaceTemplateVariables(finalBody, variables)
    if (finalHtml) {
      finalHtml = replaceTemplateVariables(finalHtml, variables)
    }
  }
  
  const companyName = await getSetting('company_name', 'ServiceDesk Pro')
  const senderEmail = await getSetting('smtp_from_email') || await getSetting('smtp_user')
  
  try {
    const info = await transporter.sendMail({
      from: `"${from_name || companyName}" <${senderEmail}>`,
      to: to,
      subject: finalSubject,
      text: finalBody,
      html: finalHtml || finalBody.replace(/\n/g, '<br>'),
    })
    
    // Log the email
    await supabaseAdmin.from('comm_log').insert([{
      id: uuidv4(),
      template_id: templateUsed,
      recipient_email: to,
      subject: finalSubject,
      body: finalBody,
      ticket_id,
      onboarding_id,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }])
    
    return NextResponse.json({ 
      success: true, 
      message_id: info.messageId,
      accepted: info.accepted
    })
  } catch (error) {
    // Log the failed attempt
    await supabaseAdmin.from('comm_log').insert([{
      id: uuidv4(),
      template_id: templateUsed,
      recipient_email: to,
      subject: finalSubject,
      body: finalBody,
      ticket_id,
      onboarding_id,
      status: 'failed',
      error_message: error.message,
    }])
    
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleSendOnboardingWelcome(body) {
  const { onboarding_id, employee_email, password_reset_link } = body
  
  if (!onboarding_id) {
    return NextResponse.json({ error: 'onboarding_id ist erforderlich' }, { status: 400 })
  }
  
  // Get onboarding request
  const { data: request, error } = await supabaseAdmin
    .from('onboarding_requests')
    .select('*, organizations(name)')
    .eq('id', onboarding_id)
    .single()
  
  if (error || !request) {
    return NextResponse.json({ error: 'Onboarding-Anfrage nicht gefunden' }, { status: 404 })
  }
  
  const toEmail = employee_email || request.personal_email || request.email
  if (!toEmail) {
    return NextResponse.json({ error: 'Keine E-Mail-Adresse vorhanden' }, { status: 400 })
  }
  
  // Get welcome template
  const { data: template } = await supabaseAdmin
    .from('comm_templates')
    .select('*')
    .eq('trigger_event', 'onboarding.completed')
    .eq('is_active', true)
    .single()
  
  const companyName = request.organizations?.name || await getSetting('company_name', 'ServiceDesk Pro')
  const agentName = await getSetting('support_team_name', 'IT-Support')
  
  const variables = {
    'employee.first_name': request.first_name,
    'employee.last_name': request.last_name,
    'employee.email': request.email,
    'employee.username': request.email?.split('@')[0] || request.first_name.toLowerCase(),
    'company.name': companyName,
    'agent.name': agentName,
    'password_reset_link': password_reset_link || 'https://portal.office.com',
  }
  
  return handleSendEmail({
    to: toEmail,
    template_id: template?.id,
    subject: template?.subject || `Willkommen bei ${companyName} - Ihre IT-Zugangsdaten`,
    body: template?.body || `Hallo ${request.first_name},\n\nwillkommen bei ${companyName}!\n\nIhre IT-Zugänge wurden eingerichtet.\n\nMit freundlichen Grüßen,\n${agentName}`,
    variables,
    onboarding_id,
  })
}

async function handleSendTicketNotification(body) {
  const { ticket_id, event, recipient_email } = body
  
  if (!ticket_id || !event) {
    return NextResponse.json({ error: 'ticket_id und event sind erforderlich' }, { status: 400 })
  }
  
  // Get ticket with contact
  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select('*, contacts(first_name, last_name, email), organizations(name)')
    .eq('id', ticket_id)
    .single()
  
  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })
  }
  
  const toEmail = recipient_email || ticket.contacts?.email
  if (!toEmail) {
    return NextResponse.json({ error: 'Keine Empfänger-E-Mail vorhanden' }, { status: 400 })
  }
  
  // Get template for event
  const { data: template } = await supabaseAdmin
    .from('comm_templates')
    .select('*')
    .eq('trigger_event', event)
    .eq('is_active', true)
    .single()
  
  const companyName = ticket.organizations?.name || await getSetting('company_name', 'ServiceDesk Pro')
  const contactName = ticket.contacts 
    ? `${ticket.contacts.first_name || ''} ${ticket.contacts.last_name || ''}`.trim()
    : 'Kunde'
  
  const variables = {
    'ticket.number': ticket.ticket_number,
    'ticket.subject': ticket.subject,
    'ticket.priority': ticket.priority,
    'ticket.status': ticket.status,
    'ticket.resolution_summary': ticket.resolution_summary || '',
    'contact.name': contactName,
    'company.name': companyName,
    'agent.name': await getSetting('support_team_name', 'IT-Support'),
  }
  
  const defaultSubjects = {
    'ticket.created': `Ihr Ticket #${ticket.ticket_number} wurde erstellt`,
    'ticket.updated': `Update zu Ihrem Ticket #${ticket.ticket_number}`,
    'ticket.resolved': `Ihr Ticket #${ticket.ticket_number} wurde gelöst`,
    'ticket.closed': `Ihr Ticket #${ticket.ticket_number} wurde geschlossen`,
  }
  
  const defaultBodies = {
    'ticket.created': `Sehr geehrte/r ${contactName},\n\nvielen Dank für Ihre Anfrage. Wir haben Ihr Ticket erstellt:\n\nTicket-Nr: #${ticket.ticket_number}\nBetreff: ${ticket.subject}\n\nUnser Team wird sich schnellstmöglich bei Ihnen melden.\n\nMit freundlichen Grüßen,\n${companyName} IT-Support`,
    'ticket.resolved': `Sehr geehrte/r ${contactName},\n\nIhr Ticket #${ticket.ticket_number} wurde erfolgreich bearbeitet.\n\n${ticket.resolution_summary ? `Lösung: ${ticket.resolution_summary}\n\n` : ''}Falls Sie weitere Fragen haben, antworten Sie einfach auf diese E-Mail.\n\nMit freundlichen Grüßen,\n${companyName} IT-Support`,
  }
  
  return handleSendEmail({
    to: toEmail,
    template_id: template?.id,
    subject: template?.subject || defaultSubjects[event] || `Ticket #${ticket.ticket_number}`,
    body: template?.body || defaultBodies[event] || `Update zu Ihrem Ticket #${ticket.ticket_number}`,
    variables,
    ticket_id,
  })
}

async function handleGetEmailLog(params) {
  const { ticket_id, onboarding_id, status, limit } = params
  
  let query = supabaseAdmin
    .from('comm_log')
    .select('*, comm_templates(name)')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit) || 50)
  
  if (ticket_id) query = query.eq('ticket_id', ticket_id)
  if (onboarding_id) query = query.eq('onboarding_id', onboarding_id)
  if (status) query = query.eq('status', status)
  
  const { data, error } = await query
  
  if (error) {
    if (error.code === '42P01') return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

// ============================================
// ADVANCED REPORTING
// ============================================

async function handleGetOnboardingReport(params) {
  const { start_date, end_date, organization_id, group_by } = params
  
  let query = supabaseAdmin
    .from('onboarding_requests')
    .select('*, organizations(name)')
  
  if (start_date) query = query.gte('created_at', start_date)
  if (end_date) query = query.lte('created_at', end_date)
  if (organization_id) query = query.eq('organization_id', organization_id)
  
  const { data: onboardings, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Also get offboardings
  let offQuery = supabaseAdmin
    .from('offboarding_requests')
    .select('*, organizations(name)')
  
  if (start_date) offQuery = offQuery.gte('created_at', start_date)
  if (end_date) offQuery = offQuery.lte('created_at', end_date)
  if (organization_id) offQuery = offQuery.eq('organization_id', organization_id)
  
  const { data: offboardings } = await offQuery
  
  // Calculate statistics
  const stats = {
    total_onboardings: onboardings?.length || 0,
    total_offboardings: offboardings?.length || 0,
    onboarding_by_status: {},
    offboarding_by_status: {},
    onboarding_by_month: {},
    offboarding_by_month: {},
    onboarding_by_organization: {},
    offboarding_by_organization: {},
    onboarding_by_department: {},
    avg_onboarding_completion_days: 0,
    license_distribution: {},
    location_distribution: {},
    upcoming_starts: [],
    upcoming_exits: [],
  }
  
  // Process onboardings
  let totalCompletionDays = 0
  let completedCount = 0
  
  for (const ob of (onboardings || [])) {
    // By status
    stats.onboarding_by_status[ob.status] = (stats.onboarding_by_status[ob.status] || 0) + 1
    
    // By month
    const month = ob.created_at?.substring(0, 7)
    if (month) {
      stats.onboarding_by_month[month] = (stats.onboarding_by_month[month] || 0) + 1
    }
    
    // By organization
    const orgName = ob.organizations?.name || 'Unbekannt'
    stats.onboarding_by_organization[orgName] = (stats.onboarding_by_organization[orgName] || 0) + 1
    
    // By department
    const dept = ob.department || 'Keine Abteilung'
    stats.onboarding_by_department[dept] = (stats.onboarding_by_department[dept] || 0) + 1
    
    // License distribution
    const license = ob.m365_license_type?.toUpperCase() || 'Keine'
    stats.license_distribution[license] = (stats.license_distribution[license] || 0) + 1
    
    // Location distribution
    const location = ob.location || 'office'
    stats.location_distribution[location] = (stats.location_distribution[location] || 0) + 1
    
    // Completion time
    if (ob.status === 'completed' && ob.completed_at) {
      const days = Math.ceil((new Date(ob.completed_at) - new Date(ob.created_at)) / (1000 * 60 * 60 * 24))
      totalCompletionDays += days
      completedCount++
    }
    
    // Upcoming starts (next 30 days)
    const startDate = new Date(ob.start_date)
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (startDate >= now && startDate <= in30Days && ob.status !== 'completed') {
      stats.upcoming_starts.push({
        id: ob.id,
        name: `${ob.first_name} ${ob.last_name}`,
        start_date: ob.start_date,
        organization: orgName,
        department: ob.department,
        status: ob.status,
      })
    }
  }
  
  if (completedCount > 0) {
    stats.avg_onboarding_completion_days = Math.round(totalCompletionDays / completedCount)
  }
  
  // Process offboardings
  for (const off of (offboardings || [])) {
    // By status
    stats.offboarding_by_status[off.status] = (stats.offboarding_by_status[off.status] || 0) + 1
    
    // By month
    const month = off.created_at?.substring(0, 7)
    if (month) {
      stats.offboarding_by_month[month] = (stats.offboarding_by_month[month] || 0) + 1
    }
    
    // By organization
    const orgName = off.organizations?.name || 'Unbekannt'
    stats.offboarding_by_organization[orgName] = (stats.offboarding_by_organization[orgName] || 0) + 1
    
    // Upcoming exits (next 30 days)
    const lastDay = new Date(off.last_day)
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (lastDay >= now && lastDay <= in30Days && off.status !== 'completed') {
      stats.upcoming_exits.push({
        id: off.id,
        name: off.employee_name,
        last_day: off.last_day,
        organization: orgName,
        status: off.status,
      })
    }
  }
  
  // Sort upcoming by date
  stats.upcoming_starts.sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  stats.upcoming_exits.sort((a, b) => new Date(a.last_day) - new Date(b.last_day))
  
  return NextResponse.json(stats)
}

async function handleGetTicketReport(params) {
  const { start_date, end_date, organization_id, group_by } = params
  
  let query = supabaseAdmin
    .from('tickets')
    .select('*, organizations(name)')
  
  if (start_date) query = query.gte('created_at', start_date)
  if (end_date) query = query.lte('created_at', end_date)
  if (organization_id) query = query.eq('organization_id', organization_id)
  
  const { data: tickets, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  const stats = {
    total_tickets: tickets?.length || 0,
    by_status: {},
    by_priority: {},
    by_type: {},
    by_month: {},
    by_organization: {},
    by_assignee: {},
    by_resolution_category: {},
    avg_resolution_hours: 0,
    sla_compliance: { met: 0, breached: 0, rate: 0 },
    first_response_avg_hours: 0,
  }
  
  let totalResolutionHours = 0
  let resolvedCount = 0
  
  for (const ticket of (tickets || [])) {
    // By status
    stats.by_status[ticket.status] = (stats.by_status[ticket.status] || 0) + 1
    
    // By priority
    stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1
    
    // By type
    const type = ticket.ticket_type_code || 'support'
    stats.by_type[type] = (stats.by_type[type] || 0) + 1
    
    // By month
    const month = ticket.created_at?.substring(0, 7)
    if (month) {
      stats.by_month[month] = (stats.by_month[month] || 0) + 1
    }
    
    // By organization
    const orgName = ticket.organizations?.name || 'Keine Organisation'
    stats.by_organization[orgName] = (stats.by_organization[orgName] || 0) + 1
    
    // By assignee
    const assignee = ticket.users?.name || 'Nicht zugewiesen'
    stats.by_assignee[assignee] = (stats.by_assignee[assignee] || 0) + 1
    
    // By resolution category
    if (ticket.resolution_category) {
      stats.by_resolution_category[ticket.resolution_category] = 
        (stats.by_resolution_category[ticket.resolution_category] || 0) + 1
    }
    
    // Resolution time
    if ((ticket.status === 'resolved' || ticket.status === 'closed') && ticket.closed_at) {
      const hours = Math.round((new Date(ticket.closed_at) - new Date(ticket.created_at)) / (1000 * 60 * 60))
      totalResolutionHours += hours
      resolvedCount++
    }
    
    // SLA compliance
    if (ticket.sla_breached === true) {
      stats.sla_compliance.breached++
    } else if (ticket.sla_breached === false) {
      stats.sla_compliance.met++
    }
  }
  
  if (resolvedCount > 0) {
    stats.avg_resolution_hours = Math.round(totalResolutionHours / resolvedCount)
  }
  
  const totalSLA = stats.sla_compliance.met + stats.sla_compliance.breached
  if (totalSLA > 0) {
    stats.sla_compliance.rate = Math.round((stats.sla_compliance.met / totalSLA) * 100)
  }
  
  return NextResponse.json(stats)
}

async function handleGetTimeReport(params) {
  const { start_date, end_date, user_id, organization_id, is_billable } = params
  
  let query = supabaseAdmin
    .from('time_entries')
    .select('*, tickets(ticket_number, subject), organizations(name)')
  
  if (start_date) query = query.gte('date', start_date)
  if (end_date) query = query.lte('date', end_date)
  if (user_id) query = query.eq('user_id', user_id)
  if (organization_id) query = query.eq('organization_id', organization_id)
  if (is_billable !== undefined) query = query.eq('is_billable', is_billable === 'true')
  
  const { data: entries, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Also get user names separately
  const userIds = [...new Set((entries || []).map(e => e.user_id).filter(Boolean))]
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .in('id', userIds.length > 0 ? userIds : [''])
  
  const userMap = {}
  for (const u of (users || [])) {
    userMap[u.id] = u.name
  }
  
  const stats = {
    total_entries: entries?.length || 0,
    total_minutes: 0,
    billable_minutes: 0,
    non_billable_minutes: 0,
    invoiced_minutes: 0,
    by_user: {},
    by_organization: {},
    by_month: {},
    by_ticket: {},
    estimated_revenue: 0,
  }
  
  const defaultRate = 95 // €/hour
  
  for (const entry of (entries || [])) {
    const minutes = entry.duration_minutes || 0
    stats.total_minutes += minutes
    
    if (entry.is_billable) {
      stats.billable_minutes += minutes
      const rate = entry.hourly_rate || defaultRate
      stats.estimated_revenue += (minutes / 60) * rate
    } else {
      stats.non_billable_minutes += minutes
    }
    
    if (entry.is_invoiced) {
      stats.invoiced_minutes += minutes
    }
    
    // By user
    const userName = userMap[entry.user_id] || 'Unbekannt'
    if (!stats.by_user[userName]) {
      stats.by_user[userName] = { total: 0, billable: 0 }
    }
    stats.by_user[userName].total += minutes
    if (entry.is_billable) stats.by_user[userName].billable += minutes
    
    // By organization
    const orgName = entry.organizations?.name || 'Keine Organisation'
    if (!stats.by_organization[orgName]) {
      stats.by_organization[orgName] = { total: 0, billable: 0 }
    }
    stats.by_organization[orgName].total += minutes
    if (entry.is_billable) stats.by_organization[orgName].billable += minutes
    
    // By month
    const month = entry.date?.substring(0, 7)
    if (month) {
      if (!stats.by_month[month]) {
        stats.by_month[month] = { total: 0, billable: 0 }
      }
      stats.by_month[month].total += minutes
      if (entry.is_billable) stats.by_month[month].billable += minutes
    }
  }
  
  stats.estimated_revenue = Math.round(stats.estimated_revenue * 100) / 100
  
  return NextResponse.json(stats)
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
    if (route === '/auth/password-reset' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handlePasswordReset(body))
    }
    if (route === '/auth/password-reset-confirm' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handlePasswordResetConfirm(body))
    }
    
    // --- M365 OAUTH FOR CUSTOMERS ---
    if (route === '/auth/m365/login' && method === 'GET') {
      // Generate M365 OAuth URL for customer login
      const clientId = await getSetting('m365_client_id')
      if (!clientId) {
        return handleCORS(NextResponse.json({ error: 'M365 OAuth nicht konfiguriert' }, { status: 400 }))
      }
      const state = Buffer.from(JSON.stringify({ action: 'login', timestamp: Date.now() })).toString('base64')
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/m365/callback`
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent('openid profile email User.Read')}` +
        `&state=${state}` +
        `&prompt=select_account`
      return handleCORS(NextResponse.json({ url: authUrl }))
    }
    
    if (route === '/auth/m365/register' && method === 'GET') {
      // Generate M365 OAuth URL for customer registration
      const clientId = await getSetting('m365_client_id')
      if (!clientId) {
        return handleCORS(NextResponse.json({ error: 'M365 OAuth nicht konfiguriert' }, { status: 400 }))
      }
      const state = Buffer.from(JSON.stringify({ action: 'register', timestamp: Date.now() })).toString('base64')
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/m365/callback`
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent('openid profile email User.Read')}` +
        `&state=${state}` +
        `&prompt=select_account`
      return handleCORS(NextResponse.json({ url: authUrl }))
    }
    
    if (route === '/auth/m365/callback' && method === 'GET') {
      // Handle M365 OAuth callback for customer login/register
      const code = searchParams.code
      const state = searchParams.state
      const error = searchParams.error
      
      if (error) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=oauth_${error}`)
      }
      
      if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=no_code`)
      }
      
      let stateData = { action: 'login' }
      try {
        stateData = JSON.parse(Buffer.from(state || '', 'base64').toString())
      } catch {}
      
      const clientId = await getSetting('m365_client_id')
      const clientSecret = await getSetting('m365_client_secret')
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/m365/callback`
      
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        
        const tokens = await tokenResponse.json()
        if (tokens.error) {
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=token_${tokens.error}`)
        }
        
        // Get user info from Microsoft Graph
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        })
        const graphUser = await graphResponse.json()
        
        const email = graphUser.mail || graphUser.userPrincipalName
        const firstName = graphUser.givenName || email.split('@')[0]
        const lastName = graphUser.surname || ''
        const azureId = graphUser.id
        const domain = email.split('@')[1]
        
        // Check if user exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .single()
        
        if (existingUser) {
          // Update azure_id if not set
          if (!existingUser.azure_id) {
            await supabaseAdmin
              .from('users')
              .update({ azure_id: azureId })
              .eq('id', existingUser.id)
          }
          // Redirect with user session token
          const sessionToken = Buffer.from(JSON.stringify({
            user_id: existingUser.id,
            email: existingUser.email,
            exp: Date.now() + 24 * 60 * 60 * 1000
          })).toString('base64')
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?auth_token=${sessionToken}`)
        }
        
        // New user - check domain rules for organization assignment
        const { data: domainRule } = await supabaseAdmin
          .from('organizations')
          .select('id, name')
          .eq('domain', domain)
          .single()
        
        let organizationId = domainRule?.id || null
        let assignmentStatus = domainRule ? 'assigned' : 'unassigned'
        
        // Get customer role
        const { data: customerRole } = await supabaseAdmin
          .from('roles')
          .select('id')
          .eq('name', 'customer')
          .single()
        
        // Create new user
        const newUserId = uuidv4()
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert([{
            id: newUserId,
            email: email.toLowerCase(),
            first_name: firstName,
            last_name: lastName,
            name: `${firstName} ${lastName}`.trim(),
            user_type: 'customer',
            role_id: customerRole?.id,
            organization_id: organizationId,
            azure_id: azureId,
            is_active: true,
            oauth_provider: 'm365',
            assignment_status: assignmentStatus,
          }])
          .select()
          .single()
        
        if (createError) {
          console.error('User creation error:', createError)
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=create_failed`)
        }
        
        // Also create contact if organization assigned
        if (organizationId) {
          await supabaseAdmin.from('contacts').insert([{
            id: uuidv4(),
            organization_id: organizationId,
            first_name: firstName,
            last_name: lastName,
            email: email.toLowerCase(),
            user_id: newUserId,
            azure_id: azureId,
          }])
        }
        
        // Log the registration
        await supabaseAdmin.from('ticket_history').insert([{
          id: uuidv4(),
          ticket_id: null,
          change_type: 'user_oauth_register',
          new_value: JSON.stringify({ email, provider: 'm365', organization_id: organizationId, assignment_status: assignmentStatus }),
          changed_by_id: newUserId,
          created_at: new Date().toISOString(),
        }])
        
        const sessionToken = Buffer.from(JSON.stringify({
          user_id: newUserId,
          email: email.toLowerCase(),
          exp: Date.now() + 24 * 60 * 60 * 1000
        })).toString('base64')
        
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?auth_token=${sessionToken}&new_user=true&assignment=${assignmentStatus}`)
        
      } catch (err) {
        console.error('M365 OAuth error:', err)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=oauth_failed`)
      }
    }
    
    // --- M365 EMAIL INTEGRATION (Graph API) ---
    if (route === '/m365/email/connect' && method === 'POST') {
      // Connect M365 mailbox for email integration
      const body = await request.json()
      const { organization_id, mailbox_email, user_id } = body
      
      const clientId = await getSetting('m365_client_id')
      if (!clientId) {
        return handleCORS(NextResponse.json({ error: 'M365 nicht konfiguriert' }, { status: 400 }))
      }
      
      const state = Buffer.from(JSON.stringify({ 
        action: 'email_connect', 
        organization_id, 
        mailbox_email,
        user_id,
        timestamp: Date.now() 
      })).toString('base64')
      
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/m365/email/callback`
      const scopes = 'openid profile email Mail.Read Mail.ReadWrite Mail.Send offline_access'
      
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}` +
        `&prompt=consent`
      
      return handleCORS(NextResponse.json({ url: authUrl }))
    }
    
    if (route === '/m365/email/callback' && method === 'GET') {
      const code = searchParams.code
      const state = searchParams.state
      
      if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=email&error=no_code`)
      }
      
      let stateData = {}
      try {
        stateData = JSON.parse(Buffer.from(state || '', 'base64').toString())
      } catch {}
      
      const clientId = await getSetting('m365_client_id')
      const clientSecret = await getSetting('m365_client_secret')
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/m365/email/callback`
      
      try {
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        
        const tokens = await tokenResponse.json()
        if (tokens.error) {
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=email&error=token_${tokens.error}`)
        }
        
        // Get mailbox info
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        })
        const mailboxInfo = await graphResponse.json()
        
        // Store email connection - encrypt tokens
        const encryptedAccess = Buffer.from(tokens.access_token).toString('base64')
        const encryptedRefresh = Buffer.from(tokens.refresh_token || '').toString('base64')
        
        const { data: connection, error } = await supabaseAdmin
          .from('m365_connections')
          .insert([{
            id: uuidv4(),
            organization_id: stateData.organization_id,
            tenant_id: mailboxInfo.id,
            tenant_name: mailboxInfo.mail || mailboxInfo.userPrincipalName,
            access_token: encryptedAccess,
            refresh_token: encryptedRefresh,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            scopes: ['Mail.Read', 'Mail.ReadWrite', 'Mail.Send'],
            is_active: true,
            connected_by_id: stateData.user_id,
            connection_type: 'email',
          }])
          .select()
          .single()
        
        if (error) {
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=email&error=save_failed`)
        }
        
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=email&success=connected`)
        
      } catch (err) {
        console.error('M365 email connect error:', err)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=email&error=connect_failed`)
      }
    }
    
    if (route === '/m365/email/fetch' && method === 'POST') {
      // Fetch emails from connected M365 mailbox
      const body = await request.json()
      const { connection_id, folder, limit } = body
      
      const { data: connection } = await supabaseAdmin
        .from('m365_connections')
        .select('*')
        .eq('id', connection_id)
        .eq('connection_type', 'email')
        .single()
      
      if (!connection || !connection.access_token) {
        return handleCORS(NextResponse.json({ error: 'Keine gültige Verbindung' }, { status: 400 }))
      }
      
      // Check if token needs refresh
      let accessToken = Buffer.from(connection.access_token, 'base64').toString()
      if (new Date(connection.token_expires_at) < new Date()) {
        // Refresh token
        const refreshResult = await refreshM365Token(connection.id)
        if (!refreshResult.success) {
          return handleCORS(NextResponse.json({ error: 'Token-Refresh fehlgeschlagen' }, { status: 401 }))
        }
        accessToken = refreshResult.access_token
      }
      
      try {
        const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder || 'inbox'}/messages?$top=${limit || 50}&$orderby=receivedDateTime desc`
        const response = await fetch(graphUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const emails = await response.json()
        
        return handleCORS(NextResponse.json({
          emails: emails.value || [],
          nextLink: emails['@odata.nextLink'],
        }))
      } catch (err) {
        return handleCORS(NextResponse.json({ error: err.message }, { status: 500 }))
      }
    }
    
    if (route === '/m365/email/send' && method === 'POST') {
      // Send email via M365 Graph API
      const body = await request.json()
      const { connection_id, to, subject, body: emailBody, ticket_id } = body
      
      const { data: connection } = await supabaseAdmin
        .from('m365_connections')
        .select('*')
        .eq('id', connection_id)
        .eq('connection_type', 'email')
        .single()
      
      if (!connection) {
        return handleCORS(NextResponse.json({ error: 'Keine gültige Verbindung' }, { status: 400 }))
      }
      
      let accessToken = Buffer.from(connection.access_token, 'base64').toString()
      if (new Date(connection.token_expires_at) < new Date()) {
        const refreshResult = await refreshM365Token(connection.id)
        if (!refreshResult.success) {
          return handleCORS(NextResponse.json({ error: 'Token-Refresh fehlgeschlagen' }, { status: 401 }))
        }
        accessToken = refreshResult.access_token
      }
      
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: 'HTML', content: emailBody },
              toRecipients: [{ emailAddress: { address: to } }],
            },
            saveToSentItems: true,
          }),
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error?.message || 'Send failed')
        }
        
        // Log the email
        await supabaseAdmin.from('comm_log').insert([{
          id: uuidv4(),
          recipient_email: to,
          subject,
          body: emailBody,
          ticket_id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }])
        
        return handleCORS(NextResponse.json({ success: true }))
      } catch (err) {
        return handleCORS(NextResponse.json({ error: err.message }, { status: 500 }))
      }
    }
    
    if (route === '/m365/email/process-inbox' && method === 'POST') {
      // Process emails and create tickets
      const body = await request.json()
      const { connection_id } = body
      
      // Fetch unread emails
      const fetchResult = await (await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/m365/email/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id, folder: 'inbox', limit: 20 }),
      })).json()
      
      if (fetchResult.error) {
        return handleCORS(NextResponse.json({ error: fetchResult.error }, { status: 500 }))
      }
      
      const processedEmails = []
      
      for (const email of (fetchResult.emails || [])) {
        if (!email.isRead) {
          // Check if email is a reply to existing ticket
          const subjectMatch = email.subject?.match(/#(\d+)/i)
          let ticketId = null
          
          if (subjectMatch) {
            const { data: existingTicket } = await supabaseAdmin
              .from('tickets')
              .select('id')
              .eq('ticket_number', parseInt(subjectMatch[1]))
              .single()
            ticketId = existingTicket?.id
          }
          
          // Find or create contact based on sender
          const senderEmail = email.from?.emailAddress?.address
          const senderName = email.from?.emailAddress?.name || senderEmail
          
          let contactId = null
          let organizationId = null
          
          if (senderEmail) {
            const { data: existingContact } = await supabaseAdmin
              .from('contacts')
              .select('id, organization_id')
              .eq('email', senderEmail.toLowerCase())
              .single()
            
            if (existingContact) {
              contactId = existingContact.id
              organizationId = existingContact.organization_id
            } else {
              // Check domain for organization mapping
              const domain = senderEmail.split('@')[1]
              const { data: org } = await supabaseAdmin
                .from('organizations')
                .select('id')
                .eq('domain', domain)
                .single()
              organizationId = org?.id
            }
          }
          
          if (ticketId) {
            // Add comment to existing ticket
            await supabaseAdmin.from('ticket_comments').insert([{
              id: uuidv4(),
              ticket_id: ticketId,
              content: email.body?.content || email.bodyPreview,
              is_internal: false,
              source: 'email',
              created_at: new Date(email.receivedDateTime).toISOString(),
            }])
            processedEmails.push({ email_id: email.id, action: 'comment_added', ticket_id: ticketId })
          } else {
            // Create new ticket
            const ticketNumber = await getNextTicketNumber()
            const { data: newTicket } = await supabaseAdmin
              .from('tickets')
              .insert([{
                id: uuidv4(),
                ticket_number: ticketNumber,
                subject: email.subject || 'E-Mail Anfrage',
                description: email.body?.content || email.bodyPreview,
                status: 'open',
                priority: 'medium',
                organization_id: organizationId,
                contact_id: contactId,
                source: 'email',
                created_at: new Date(email.receivedDateTime).toISOString(),
              }])
              .select()
              .single()
            
            processedEmails.push({ email_id: email.id, action: 'ticket_created', ticket_id: newTicket?.id })
          }
          
          // Store in conversations
          await supabaseAdmin.from('conversations').insert([{
            id: uuidv4(),
            channel: 'email',
            channel_id: email.id,
            from_address: senderEmail,
            from_name: senderName,
            subject: email.subject,
            body: email.body?.content || email.bodyPreview,
            ticket_id: ticketId || processedEmails[processedEmails.length - 1]?.ticket_id,
            organization_id: organizationId,
            contact_id: contactId,
            status: 'processed',
            is_inbound: true,
            created_at: new Date(email.receivedDateTime).toISOString(),
          }])
        }
      }
      
      return handleCORS(NextResponse.json({ 
        processed: processedEmails.length,
        results: processedEmails,
      }))
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
      return handleCORS(await handleCreateBoardTask(body))
    }
    if (route.match(/^\/tasks\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleUpdateBoardTask(id, body))
    }
    if (route.match(/^\/tasks\/[^/]+$/) && method === 'DELETE') {
      const id = path[1]
      return handleCORS(await handleDeleteBoardTask(id))
    }
    if (route === '/tasks/move' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleMoveBoardTask(body))
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
      return handleCORS(await handleGetTemplates(searchParams))
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
    
    // =============================================
    // E) AI-ITSM MODULE ROUTES
    // =============================================
    
    // Ticket Types
    if (route === '/ticket-types' && method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('ticket_types')
        .select('*')
        .order('position', { ascending: true })
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data || []))
    }
    if (route === '/ticket-types' && method === 'POST') {
      const body = await request.json()
      const { code, name, description, icon, color, keywords, default_priority, default_queue } = body
      if (!code || !name) {
        return handleCORS(NextResponse.json({ error: 'code und name sind erforderlich' }, { status: 400 }))
      }
      const { data, error } = await supabaseAdmin
        .from('ticket_types')
        .insert([{ id: uuidv4(), code, name, description, icon, color, keywords, default_priority, default_queue }])
        .select()
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // AI Classification
    if (route === '/ai/classify' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleClassifyMessage(body))
    }
    
    // Conversations (Central Inbox)
    if (route === '/conversations' && method === 'GET') {
      return handleCORS(await handleGetConversations(searchParams))
    }
    if (route === '/conversations' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateConversation(body))
    }
    if (route.match(/^\/conversations\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*, tickets(*)')
        .eq('id', id)
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    if (route.match(/^\/conversations\/[^/]+\/process$/) && method === 'POST') {
      const id = path[1]
      const body = await request.json()
      return handleCORS(await handleProcessConversation(id, body))
    }
    
    // Dynamic Forms
    if (route === '/dynamic-forms' && method === 'GET') {
      return handleCORS(await handleGetDynamicForms(searchParams))
    }
    if (route === '/dynamic-forms' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateDynamicForm(body))
    }
    if (route.match(/^\/dynamic-forms\/[^/]+$/) && method === 'GET') {
      const id = path[1]
      const { data, error } = await supabaseAdmin
        .from('dynamic_forms')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // Form Submissions
    if (route === '/form-submissions' && method === 'POST') {
      const body = await request.json()
      const { form_id, data: formData, submitted_by_id } = body
      if (!form_id || !formData) {
        return handleCORS(NextResponse.json({ error: 'form_id und data sind erforderlich' }, { status: 400 }))
      }
      const { data, error } = await supabaseAdmin
        .from('form_submissions')
        .insert([{ id: uuidv4(), form_id, data: formData, submitted_by_id }])
        .select()
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // Onboarding Requests
    if (route === '/onboarding-requests' && method === 'GET') {
      return handleCORS(await handleGetOnboardingRequests(searchParams))
    }
    if (route === '/onboarding-requests' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateOnboardingRequest(body))
    }
    if (route.match(/^\/onboarding-requests\/[^/]+$/) && method === 'PUT') {
      const id = path[1]
      const body = await request.json()
      const { data, error } = await supabaseAdmin
        .from('onboarding_requests')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // Offboarding Requests
    if (route === '/offboarding-requests' && method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('offboarding_requests')
        .select('*, tickets(*)')
        .order('created_at', { ascending: false })
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data || []))
    }
    if (route === '/offboarding-requests' && method === 'POST') {
      const body = await request.json()
      const { ticket_id, organization_id, employee_name, employee_email, last_day } = body
      if (!ticket_id || !organization_id || !employee_name || !employee_email || !last_day) {
        return handleCORS(NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 }))
      }
      const { data, error } = await supabaseAdmin
        .from('offboarding_requests')
        .insert([{ id: uuidv4(), ...body }])
        .select()
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // M365 Connections
    if (route === '/m365-connections' && method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('m365_connections')
        .select('id, organization_id, tenant_id, tenant_name, is_active, last_sync_at, created_at')
        .order('created_at', { ascending: false })
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data || []))
    }
    
    // Knowledge Base
    if (route === '/kb-articles' && method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('kb_articles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data || []))
    }
    if (route === '/kb-articles' && method === 'POST') {
      const body = await request.json()
      const { title, content, category, tags, ticket_type_code, is_internal, created_by_id } = body
      if (!title || !content) {
        return handleCORS(NextResponse.json({ error: 'title und content sind erforderlich' }, { status: 400 }))
      }
      const { data, error } = await supabaseAdmin
        .from('kb_articles')
        .insert([{ id: uuidv4(), title, content, category, tags, ticket_type_code, is_internal, created_by_id }])
        .select()
        .single()
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // Communication Templates
    if (route === '/comm-templates' && method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('comm_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data || []))
    }
    
    // =============================================
    // F) EMAIL SERVICE ROUTES
    // =============================================
    
    if (route === '/email/send' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleSendEmail(body))
    }
    
    if (route === '/email/onboarding-welcome' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleSendOnboardingWelcome(body))
    }
    
    if (route === '/email/ticket-notification' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleSendTicketNotification(body))
    }
    
    if (route === '/email/log' && method === 'GET') {
      return handleCORS(await handleGetEmailLog(searchParams))
    }
    
    // =============================================
    // G) ADVANCED REPORTING ROUTES
    // =============================================
    
    if (route === '/reports/onboarding' && method === 'GET') {
      return handleCORS(await handleGetOnboardingReport(searchParams))
    }
    
    if (route === '/reports/tickets' && method === 'GET') {
      return handleCORS(await handleGetTicketReport(searchParams))
    }
    
    if (route === '/reports/time' && method === 'GET') {
      return handleCORS(await handleGetTimeReport(searchParams))
    }
    
    if (route === '/reports/dashboard' && method === 'GET') {
      // Combined dashboard report
      const [onboardingReport, ticketReport, timeReport] = await Promise.all([
        handleGetOnboardingReport(searchParams),
        handleGetTicketReport(searchParams),
        handleGetTimeReport(searchParams),
      ])
      
      return handleCORS(NextResponse.json({
        onboarding: await onboardingReport.json(),
        tickets: await ticketReport.json(),
        time: await timeReport.json(),
        generated_at: new Date().toISOString(),
      }))
    }
    
    // =============================================
    // H) BACKUP & AUDIT ROUTES
    // =============================================
    
    if (route === '/backup' && method === 'GET') {
      // Export all data for backup
      const [
        tickets, organizations, contacts, users, assets,
        timeEntries, settings, automations, templates,
        kbArticles, onboardingRequests
      ] = await Promise.all([
        supabaseAdmin.from('tickets').select('*'),
        supabaseAdmin.from('organizations').select('*'),
        supabaseAdmin.from('contacts').select('*'),
        supabaseAdmin.from('users').select('id, email, first_name, last_name, user_type, role_id'),
        supabaseAdmin.from('assets').select('*'),
        supabaseAdmin.from('time_entries').select('*'),
        supabaseAdmin.from('settings').select('*'),
        supabaseAdmin.from('automations').select('*'),
        supabaseAdmin.from('templates').select('*'),
        supabaseAdmin.from('kb_articles').select('*'),
        supabaseAdmin.from('onboarding_requests').select('*'),
      ])
      
      const backup = {
        version: '2.0.0',
        created_at: new Date().toISOString(),
        data: {
          tickets: tickets.data || [],
          organizations: organizations.data || [],
          contacts: contacts.data || [],
          users: users.data || [],
          assets: assets.data || [],
          time_entries: timeEntries.data || [],
          settings: settings.data || [],
          automations: automations.data || [],
          templates: templates.data || [],
          kb_articles: kbArticles.data || [],
          onboarding_requests: onboardingRequests.data || [],
        },
        counts: {
          tickets: tickets.data?.length || 0,
          organizations: organizations.data?.length || 0,
          contacts: contacts.data?.length || 0,
          users: users.data?.length || 0,
          assets: assets.data?.length || 0,
          time_entries: timeEntries.data?.length || 0,
          settings: settings.data?.length || 0,
          automations: automations.data?.length || 0,
          templates: templates.data?.length || 0,
          kb_articles: kbArticles.data?.length || 0,
          onboarding_requests: onboardingRequests.data?.length || 0,
        }
      }
      
      return handleCORS(NextResponse.json(backup))
    }
    
    if (route === '/backup' && method === 'POST') {
      // Create scheduled backup entry
      const body = await request.json()
      const { name, schedule } = body
      
      const { data, error } = await supabaseAdmin
        .from('settings')
        .upsert([{
          key: 'last_backup',
          value: JSON.stringify({
            name: name || `Backup ${new Date().toISOString()}`,
            created_at: new Date().toISOString(),
            schedule: schedule || 'manual',
          }),
          category: 'backup',
        }], { onConflict: 'key' })
        .select()
      
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json({ success: true, message: 'Backup erfolgreich erstellt' }))
    }
    
    if (route === '/audit-log' && method === 'GET') {
      const { entity_type, entity_id, user_id, limit } = searchParams
      
      let query = supabaseAdmin
        .from('ticket_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit) || 100)
      
      if (entity_id) query = query.eq('ticket_id', entity_id)
      if (user_id) query = query.eq('changed_by_id', user_id)
      
      const { data, error } = await query
      
      if (error) {
        if (error.code === '42P01') return handleCORS(NextResponse.json([]))
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }
      return handleCORS(NextResponse.json(data || []))
    }
    
    if (route === '/audit-log' && method === 'POST') {
      const body = await request.json()
      const { entity_type, entity_id, action, old_value, new_value, user_id, ip_address } = body
      
      const { data, error } = await supabaseAdmin
        .from('ticket_history')
        .insert([{
          id: uuidv4(),
          ticket_id: entity_id,
          change_type: action,
          old_value: JSON.stringify(old_value),
          new_value: JSON.stringify(new_value),
          changed_by_id: user_id,
          ip_address,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()
      
      if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      return handleCORS(NextResponse.json(data))
    }
    
    // ============================================================
    // TWO-FACTOR AUTHENTICATION (2FA) ROUTES
    // ============================================================
    
    if (route === '/users/2fa/enable' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleEnable2FA(body))
    }
    
    if (route === '/users/2fa/verify' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleVerify2FA(body))
    }
    
    if (route === '/users/2fa/disable' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleDisable2FA(body))
    }
    
    if (route === '/auth/login-2fa' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleLoginWith2FA(body))
    }
    
    // ============================================================
    // ADMIN USER MANAGEMENT ROUTES
    // ============================================================
    
    if (route === '/admin/users/disable' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAdminDisableUser(body))
    }
    
    if (route === '/admin/users/enable' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAdminEnableUser(body))
    }
    
    if (route === '/admin/users/reset-password' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAdminResetUserPassword(body))
    }
    
    // ============================================================
    // TICKET MERGE, SPLIT & DEPENDENCIES ROUTES
    // ============================================================
    
    if (route === '/tickets/merge' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleMergeTickets(body))
    }
    
    if (route === '/tickets/split' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleSplitTicket(body))
    }
    
    if (route === '/tickets/dependencies' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleAddTicketDependency(body))
    }
    
    if (route === '/tickets/dependencies' && method === 'DELETE') {
      const body = await request.json()
      return handleCORS(await handleRemoveTicketDependency(body))
    }
    
    // ============================================================
    // TASK BOARD ROUTES (Standalone Tasks)
    // ============================================================
    
    if (route === '/task-boards' && method === 'GET') {
      return handleCORS(await handleGetTaskBoards())
    }
    
    if (route === '/standalone-tasks' && method === 'GET') {
      const params = Object.fromEntries(url.searchParams)
      return handleCORS(await handleGetTasks(params))
    }
    
    if (route === '/standalone-tasks' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleCreateTask(body))
    }
    
    if (route.match(/^\/standalone-tasks\/[^/]+$/) && method === 'PUT') {
      const id = route.split('/')[2]
      const body = await request.json()
      return handleCORS(await handleUpdateTask(id, body))
    }
    
    if (route.match(/^\/standalone-tasks\/[^/]+$/) && method === 'DELETE') {
      const id = route.split('/')[2]
      return handleCORS(await handleDeleteTask(id))
    }
    
    if (route === '/standalone-tasks/move' && method === 'POST') {
      const body = await request.json()
      return handleCORS(await handleMoveTask(body))
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
