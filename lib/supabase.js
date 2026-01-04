import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Client for general use (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
)

// Auth helper functions
export const auth = {
  // Sign up new user
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  },

  // Sign in
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Get session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Database table names
export const TABLES = {
  // Core system
  USERS: 'users',
  ROLES: 'roles',
  USER_ROLES: 'user_roles',
  PERMISSIONS: 'permissions',
  ROLE_PERMISSIONS: 'role_permissions',
  
  // Organizations & Customers
  ORGANIZATIONS: 'organizations',
  LOCATIONS: 'locations',
  CONTACTS: 'contacts',
  CONTRACTS: 'contracts',
  SLA_PROFILES: 'sla_profiles',
  
  // Tickets
  TICKETS: 'tickets',
  TICKET_COMMENTS: 'ticket_comments',
  TICKET_ATTACHMENTS: 'ticket_attachments',
  TICKET_HISTORY: 'ticket_history',
  TICKET_TEMPLATES: 'ticket_templates',
  TICKET_TAGS: 'ticket_tags',
  TICKET_TAG_RELATIONS: 'ticket_tag_relations',
  
  // Kanban/Tasks
  BOARDS: 'boards',
  BOARD_COLUMNS: 'board_columns',
  TASKS: 'tasks',
  TASK_CHECKLISTS: 'task_checklists',
  TASK_CHECKLIST_ITEMS: 'task_checklist_items',
  
  // Assets/CMDB
  ASSET_TYPES: 'asset_types',
  ASSET_FIELDS: 'asset_fields',
  ASSETS: 'assets',
  ASSET_VALUES: 'asset_values',
  
  // Time Tracking
  TIME_ENTRIES: 'time_entries',
  
  // Automation
  AUTOMATION_RULES: 'automation_rules',
  AUTOMATION_LOGS: 'automation_logs',
}

export default supabase
