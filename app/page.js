'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  LayoutDashboard, Ticket, KanbanSquare, Building2, Users, 
  Clock, Package, Settings, ChevronLeft, ChevronRight, Plus,
  Search, Bell, User, Filter, Calendar, Tag,
  MessageSquare, AlertCircle, CheckCircle2,
  Timer, TrendingUp, Loader2, Mic, MicOff,
  Trash2, LogOut, LogIn, Play, Pause, StopCircle,
  FileText, Download, BarChart3, PieChart, Monitor,
  Laptop, Server, Printer, Phone, Box, ChevronDown,
  ExternalLink, RefreshCw, Save, Key, Globe, Mail,
  Shield, Database, Zap, ToggleLeft, ToggleRight,
  AlertTriangle, Check, X, Eye, EyeOff, Copy,
  Webhook, Cloud, CreditCard, PhoneCall, HelpCircle,
  History, Archive, Repeat, UserPlus, UserMinus, UserCheck,
  Inbox, Send, Brain, Sparkles, FileQuestion, BookOpen,
  GripVertical, MoreVertical, ArrowRight, CircleDot, FileDown, Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import dynamic from 'next/dynamic'

// ============================================
// CONSTANTS
// ============================================

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700',
  waiting: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
}

const STATUS_LABELS = {
  open: 'Offen',
  pending: 'Wartend',
  in_progress: 'In Bearbeitung',
  waiting: 'Warten auf Kunde',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}

const PRIORITY_LABELS = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
}

const ASSET_STATUS_LABELS = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  maintenance: 'Wartung',
  retired: 'Ausgemustert',
}

const ASSET_STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-red-100 text-red-700',
}

const ASSET_ICONS = {
  Computer: Monitor,
  Laptop: Laptop,
  Server: Server,
  Drucker: Printer,
  Netzwerk: Server,
  Telefon: Phone,
  Monitor: Monitor,
  Sonstiges: Box,
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'daily-assistant', label: 'KI-Assistent', icon: Brain, highlight: true },
  { id: 'inbox', label: 'Posteingang', icon: Mail },
  { id: 'telephony', label: 'Telefonie', icon: PhoneCall },
  { id: 'rmm', label: 'RMM', icon: Monitor, submenu: [
    { id: 'rmm-dashboard', label: 'Übersicht' },
    { id: 'rmm-devices', label: 'Geräte' },
    { id: 'rmm-alerts', label: 'Alerts' },
    { id: 'rmm-remote', label: 'Remote' },
    { id: 'rmm-deployment', label: 'Software' },
  ]},
  { id: 'chatwoot', label: 'Chatwoot', icon: MessageSquare },
  { id: 'crm', label: 'CRM', icon: Users, submenu: [
    { id: 'contacts', label: 'Kontakte' },
    { id: 'companies', label: 'Unternehmen' },
    { id: 'deals', label: 'Deals' },
  ]},
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'organizations', label: 'Organisationen', icon: Building2 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'assets', label: 'Assets & Lizenzen', icon: Package },
  { id: 'time', label: 'Zeiterfassung', icon: Clock },
  { id: 'knowledge', label: 'Wissensdatenbank', icon: HelpCircle },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'diagnostics', label: 'System-Diagnose', icon: Shield },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
]

// Tabs für Tickets-Seite
const TICKET_TABS = [
  { id: 'list', label: 'Liste', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
]

const CUSTOMER_NAV_ITEMS = [
  { id: 'portal-tickets', label: 'Meine Tickets', icon: Ticket },
  { id: 'portal-new', label: 'Neues Ticket', icon: Plus },
]

// ============================================
// API FUNCTIONS
// ============================================

const api = {
  async fetch(endpoint, options = {}) {
    try {
      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API Fehler')
      return data
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  },
  
  // Auth
  login: (data) => api.fetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => api.fetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  // Users
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/users${query ? `?${query}` : ''}`)
  },
  createUser: (data) => api.fetch('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => api.fetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => api.fetch(`/users/${id}`, { method: 'DELETE' }),
  
  // Organizations
  getOrganizations: () => api.fetch('/organizations'),
  createOrganization: (data) => api.fetch('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrganization: (id, data) => api.fetch(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrganization: (id) => api.fetch(`/organizations/${id}`, { method: 'DELETE' }),
  
  // Contacts
  getContacts: (orgId) => api.fetch(`/contacts${orgId ? `?organization_id=${orgId}` : ''}`),
  createContact: (data) => api.fetch('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) => api.fetch(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => api.fetch(`/contacts/${id}`, { method: 'DELETE' }),
  
  // Locations
  createLocation: (data) => api.fetch('/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id, data) => api.fetch(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id) => api.fetch(`/locations/${id}`, { method: 'DELETE' }),
  
  // Comments
  createComment: (data) => api.fetch('/comments', { method: 'POST', body: JSON.stringify(data) }),
  updateComment: (id, data, userId) => api.fetch(`/comments/${id}?user_id=${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComment: (id, userId) => api.fetch(`/comments/${id}?user_id=${userId}`, { method: 'DELETE' }),
  
  // Tickets
  getTickets: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/tickets${query ? `?${query}` : ''}`)
  },
  getTicket: (id) => api.fetch(`/tickets/${id}`),
  createTicket: (data) => api.fetch('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id, data, userId) => api.fetch(`/tickets/${id}?user_id=${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTicket: (id) => api.fetch(`/tickets/${id}`, { method: 'DELETE' }),
  
  // Comments
  createComment: (data) => api.fetch('/comments', { method: 'POST', body: JSON.stringify(data) }),
  
  // Tags
  getTags: () => api.fetch('/tags'),
  
  // Boards
  getBoards: () => api.fetch('/boards'),
  createBoard: (data) => api.fetch('/boards', { method: 'POST', body: JSON.stringify(data) }),
  
  // Tasks
  createTask: (data) => api.fetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => api.fetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => api.fetch(`/tasks/${id}`, { method: 'DELETE' }),
  moveTask: (data) => api.fetch('/tasks/move', { method: 'POST', body: JSON.stringify(data) }),
  
  // Assets
  getAssets: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/assets${query ? `?${query}` : ''}`)
  },
  getAsset: (id) => api.fetch(`/assets/${id}`),
  getAssetTypes: () => api.fetch('/asset-types'),
  createAsset: (data) => api.fetch('/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id, data) => api.fetch(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAsset: (id) => api.fetch(`/assets/${id}`, { method: 'DELETE' }),
  
  // Time Entries
  getTimeEntries: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/time-entries${query ? `?${query}` : ''}`)
  },
  createTimeEntry: (data) => api.fetch('/time-entries', { method: 'POST', body: JSON.stringify(data) }),
  updateTimeEntry: (id, data) => api.fetch(`/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimeEntry: (id) => api.fetch(`/time-entries/${id}`, { method: 'DELETE' }),
  
  // Stats & Reports
  getStats: () => api.fetch('/stats'),
  getReports: (params) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/reports?${query}`)
  },
  
  // Roles & SLA
  getRoles: () => api.fetch('/roles'),
  getSLAProfiles: () => api.fetch('/sla-profiles'),
  createSLAProfile: (data) => api.fetch('/sla-profiles', { method: 'POST', body: JSON.stringify(data) }),
  updateSLAProfile: (id, data) => api.fetch(`/sla-profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSLAProfile: (id) => api.fetch(`/sla-profiles/${id}`, { method: 'DELETE' }),
  
  // AI
  aiSummarize: (data) => api.fetch('/ai/summarize', { method: 'POST', body: JSON.stringify(data) }),
  aiParseDictation: (data) => api.fetch('/ai/parse-dictation', { method: 'POST', body: JSON.stringify(data) }),
  
  // Settings
  getSettings: (category) => api.fetch(`/settings${category ? `?category=${category}` : ''}`),
  updateSetting: (data) => api.fetch('/settings', { method: 'POST', body: JSON.stringify(data) }),
  bulkUpdateSettings: (data) => api.fetch('/settings/bulk', { method: 'POST', body: JSON.stringify(data) }),
  testConnection: (data) => api.fetch('/test-connection', { method: 'POST', body: JSON.stringify(data) }),
  
  // Automations
  getAutomations: () => api.fetch('/automations'),
  createAutomation: (data) => api.fetch('/automations', { method: 'POST', body: JSON.stringify(data) }),
  updateAutomation: (id, data) => api.fetch(`/automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAutomation: (id) => api.fetch(`/automations/${id}`, { method: 'DELETE' }),
  
  // Recurring Tickets
  getRecurringTickets: () => api.fetch('/recurring-tickets'),
  createRecurringTicket: (data) => api.fetch('/recurring-tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurringTicket: (id, data) => api.fetch(`/recurring-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecurringTicket: (id) => api.fetch(`/recurring-tickets/${id}`, { method: 'DELETE' }),
  
  // Tags
  createTag: (data) => api.fetch('/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id, data) => api.fetch(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTag: (id) => api.fetch(`/tags/${id}`, { method: 'DELETE' }),
  
  // Dictation (Phase 5)
  transcribeDictation: (data) => api.fetch('/dictation/transcribe', { method: 'POST', body: JSON.stringify(data) }),
  dictationCreateTicket: (data) => api.fetch('/dictation/create-ticket', { method: 'POST', body: JSON.stringify(data) }),
  dictationCreateTask: (data) => api.fetch('/dictation/create-task', { method: 'POST', body: JSON.stringify(data) }),
  dictationCreateComment: (data) => api.fetch('/dictation/create-comment', { method: 'POST', body: JSON.stringify(data) }),
  dictationCreateTimeEntry: (data) => api.fetch('/dictation/create-time-entry', { method: 'POST', body: JSON.stringify(data) }),
  
  // Invoices (Phase 6)
  getInvoiceDrafts: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/invoice-drafts${query ? `?${query}` : ''}`)
  },
  createInvoiceFromTime: (data) => api.fetch('/invoices/create-from-time', { method: 'POST', body: JSON.stringify(data) }),
  syncInvoiceToLexoffice: (data) => api.fetch('/invoices/sync-lexoffice', { method: 'POST', body: JSON.stringify(data) }),
  
  // Ticket Kanban (New)
  getTicketKanbanViews: () => api.fetch('/ticket-kanban-views'),
  createTicketKanbanView: (data) => api.fetch('/ticket-kanban-views', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketKanbanView: (id, data) => api.fetch(`/ticket-kanban-views/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTicketKanbanView: (id) => api.fetch(`/ticket-kanban-views/${id}`, { method: 'DELETE' }),
  getTicketKanbanData: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/ticket-kanban${query ? `?${query}` : ''}`)
  },
  moveTicketStatus: (data) => api.fetch('/tickets/move', { method: 'POST', body: JSON.stringify(data) }),
  
  // Ticket Todos & Close Flow
  getTicketTodos: (ticketId) => api.fetch(`/tickets/${ticketId}/todos`),
  createTicketTodo: (ticketId, data) => api.fetch(`/tickets/${ticketId}/todos`, { method: 'POST', body: JSON.stringify(data) }),
  updateTicketTodo: (id, data) => api.fetch(`/ticket-todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTicketTodo: (id) => api.fetch(`/ticket-todos/${id}`, { method: 'DELETE' }),
  closeTicket: (ticketId, data) => api.fetch(`/tickets/${ticketId}/close`, { method: 'POST', body: JSON.stringify(data) }),
  getCloseFlowConfig: () => api.fetch('/close-flow-config'),
  getResolutionCategories: () => api.fetch('/resolution-categories'),
  
  // Templates
  getTemplates: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/templates${query ? `?${query}` : ''}`)
  },
  createTemplate: (data) => api.fetch('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => api.fetch(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => api.fetch(`/templates/${id}`, { method: 'DELETE' }),
  renderTemplate: (data) => api.fetch('/templates/render', { method: 'POST', body: JSON.stringify(data) }),
  
  // API Keys
  getApiKeys: () => api.fetch('/api-keys'),
  createApiKey: (data) => api.fetch('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  updateApiKey: (id, data) => api.fetch(`/api-keys/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApiKey: (id) => api.fetch(`/api-keys/${id}`, { method: 'DELETE' }),
  regenerateApiKey: (data) => api.fetch('/api-keys/regenerate', { method: 'POST', body: JSON.stringify(data) }),
  getApiScopes: () => api.fetch('/api-scopes'),
  
  // Webhooks
  getWebhooks: () => api.fetch('/webhook-subscriptions'),
  createWebhook: (data) => api.fetch('/webhook-subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id, data) => api.fetch(`/webhook-subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebhook: (id) => api.fetch(`/webhook-subscriptions/${id}`, { method: 'DELETE' }),
  testWebhook: (id) => api.fetch(`/webhook-subscriptions/${id}/test`, { method: 'POST' }),
  
  // OpenAPI Spec
  getOpenAPISpec: () => api.fetch('/openapi.json'),
  
  // Automation Engine (Phase 7)
  runAutomation: (data) => api.fetch('/automations/run', { method: 'POST', body: JSON.stringify(data) }),
  checkSLA: () => api.fetch('/automations/check-sla', { method: 'POST' }),
  
  // AI
  aiSummarizeCall: (data) => api.fetch('/ai/summarize-call', { method: 'POST', body: JSON.stringify(data) }),
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('de-DE')
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('de-DE')
}

// ============================================
// DICTATION COMPONENT (Global - Phase 5)
// ============================================

function DictationButton({ type = 'ticket', onComplete, ticketId, organizationId, className = '' }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioChunks, setAudioChunks] = useState([])
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      
      const chunks = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        await processAudio(audioBlob)
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setAudioChunks(chunks)
      setIsRecording(true)
      toast.info('Aufnahme gestartet... Sprechen Sie jetzt.')
    } catch (error) {
      toast.error('Mikrofon-Zugriff verweigert')
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }
  
  const processAudio = async (audioBlob) => {
    setIsProcessing(true)
    try {
      // Convert to base64
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1]
        
        // Transcribe and parse
        const result = await api.transcribeDictation({
          audio_data: base64Audio,
          type: type,
        })
        
        if (result.success && result.parsed) {
          toast.success('Diktat erfolgreich verarbeitet')
          
          // Create the entity based on type
          let created = null
          switch (type) {
            case 'ticket':
              created = await api.dictationCreateTicket({
                transcription: result.transcription,
                parsed_data: result.parsed,
                organization_id: organizationId,
              })
              break
            case 'task':
              created = await api.dictationCreateTask({
                transcription: result.transcription,
                parsed_data: result.parsed,
              })
              break
            case 'comment':
              created = await api.dictationCreateComment({
                transcription: result.transcription,
                parsed_data: result.parsed,
                ticket_id: ticketId,
              })
              break
            case 'time':
              created = await api.dictationCreateTimeEntry({
                transcription: result.transcription,
                parsed_data: result.parsed,
                ticket_id: ticketId,
                organization_id: organizationId,
              })
              break
          }
          
          if (onComplete) onComplete(created, result)
        } else {
          toast.error(result.error || 'Diktat konnte nicht verarbeitet werden')
        }
        setIsProcessing(false)
      }
    } catch (error) {
      toast.error('Fehler bei der Verarbeitung')
      setIsProcessing(false)
    }
  }
  
  const labels = {
    ticket: 'Ticket diktieren',
    task: 'Aufgabe diktieren',
    comment: 'Kommentar diktieren',
    time: 'Zeit diktieren',
  }
  
  return (
    <Button
      variant={isRecording ? 'destructive' : 'outline'}
      size="sm"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={className}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4 mr-2" />
      ) : (
        <Mic className="h-4 w-4 mr-2" />
      )}
      {isProcessing ? 'Verarbeite...' : isRecording ? 'Stoppen' : labels[type]}
    </Button>
  )
}

// ============================================
// INVOICE CREATION DIALOG (Phase 6)
// ============================================

function CreateInvoiceDialog({ organizationId, open, onClose, onCreated }) {
  const [loading, setLoading] = useState(false)
  const [timeEntries, setTimeEntries] = useState([])
  const [selectedEntries, setSelectedEntries] = useState([])
  
  const loadTimeEntries = useCallback(async () => {
    try {
      const entries = await api.getTimeEntries({ 
        organization_id: organizationId,
        is_billable: true,
        is_invoiced: false,
      })
      setTimeEntries(entries.filter(e => e.is_billable && !e.is_invoiced))
      setSelectedEntries(entries.filter(e => e.is_billable && !e.is_invoiced).map(e => e.id))
    } catch (error) {
      toast.error('Fehler beim Laden der Zeiteinträge')
    }
  }, [organizationId])
  
  useEffect(() => {
    if (open && organizationId) {
      loadTimeEntries()
    }
  }, [open, organizationId, loadTimeEntries])
  
  const handleCreate = async () => {
    if (selectedEntries.length === 0) {
      toast.error('Keine Zeiteinträge ausgewählt')
      return
    }
    
    setLoading(true)
    try {
      const invoice = await api.createInvoiceFromTime({
        organization_id: organizationId,
        time_entry_ids: selectedEntries,
      })
      toast.success('Rechnungsentwurf erstellt')
      onCreated?.(invoice)
      onClose()
    } catch (error) {
      toast.error('Fehler beim Erstellen der Rechnung')
    }
    setLoading(false)
  }
  
  const toggleEntry = (id) => {
    setSelectedEntries(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }
  
  const totalMinutes = timeEntries
    .filter(e => selectedEntries.includes(e.id))
    .reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  
  const totalAmount = timeEntries
    .filter(e => selectedEntries.includes(e.id))
    .reduce((sum, e) => sum + ((e.duration_minutes / 60) * (e.hourly_rate || 85)), 0)
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rechnung erstellen</DialogTitle>
          <DialogDescription>
            Wählen Sie die abrechenbaren Zeiteinträge für diese Rechnung
          </DialogDescription>
        </DialogHeader>
        
        {timeEntries.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            Keine abrechenbaren Zeiteinträge vorhanden
          </div>
        ) : (
          <>
            <div className="max-h-64 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-24">Dauer</TableHead>
                    <TableHead className="w-24">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map(entry => (
                    <TableRow key={entry.id} className="cursor-pointer" onClick={() => toggleEntry(entry.id)}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleEntry(entry.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                      <TableCell>
                        €{((entry.duration_minutes / 60) * (entry.hourly_rate || 85)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-slate-500">
                {selectedEntries.length} Einträge ausgewählt
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Gesamt: {formatDuration(totalMinutes)}</div>
                <div className="text-lg font-semibold">€{totalAmount.toFixed(2)} (netto)</div>
              </div>
            </div>
          </>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button 
            onClick={handleCreate} 
            disabled={loading || selectedEntries.length === 0}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            Rechnung erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// AUTH COMPONENTS
// ============================================

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [registerData, setRegisterData] = useState({
    first_name: '',
    last_name: '',
    user_type: 'internal',
  })
  
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('E-Mail ist erforderlich')
      return
    }
    
    setLoading(true)
    try {
      const result = await api.login({ email })
      if (result.success) {
        onLogin(result.user)
        toast.success(`Willkommen, ${result.user.first_name}!`)
      }
    } catch (error) {
      toast.error(error.message || 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!email || !registerData.first_name || !registerData.last_name) {
      toast.error('Alle Felder sind erforderlich')
      return
    }
    
    setLoading(true)
    try {
      const result = await api.register({
        email,
        password: 'demo', // For demo purposes
        ...registerData,
      })
      if (result.success) {
        onLogin(result.user)
        toast.success('Registrierung erfolgreich!')
      }
    } catch (error) {
      toast.error(error.message || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src="https://customer-assets.emergentagent.com/job_v1-itsm-completion/artifacts/w6ojc37j_logo_itrex.png" 
            alt="IT REX Solutions" 
            className="h-20 mx-auto mb-4 object-contain"
          />
          <CardTitle className="text-2xl">IT REX ServiceDesk</CardTitle>
          <CardDescription>
            {isRegister ? 'Neuen Account erstellen' : 'Melden Sie sich an'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Vorname</Label>
                    <Input
                      value={registerData.first_name}
                      onChange={(e) => setRegisterData(r => ({ ...r, first_name: e.target.value }))}
                      placeholder="Max"
                    />
                  </div>
                  <div>
                    <Label>Nachname</Label>
                    <Input
                      value={registerData.last_name}
                      onChange={(e) => setRegisterData(r => ({ ...r, last_name: e.target.value }))}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
                <div>
                  <Label>Benutzertyp</Label>
                  <Select value={registerData.user_type} onValueChange={(v) => setRegisterData(r => ({ ...r, user_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interner Mitarbeiter</SelectItem>
                      <SelectItem value="customer">Kunde</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.de"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isRegister ? 'Registrieren' : 'Anmelden'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Bereits registriert? Anmelden' : 'Noch kein Account? Registrieren'}
            </Button>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-3">
            <p className="text-sm text-slate-500 text-center mb-2">Oder anmelden mit:</p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={async () => {
                try {
                  const { url } = await api.fetch('/auth/m365/login')
                  if (url) window.location.href = url
                  else toast.error('M365 OAuth nicht konfiguriert')
                } catch { toast.error('M365 OAuth nicht verfügbar') }
              }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none">
                <path d="M10 0H0v10h10V0z" fill="#f25022"/>
                <path d="M21 0H11v10h10V0z" fill="#7fba00"/>
                <path d="M10 11H0v10h10V11z" fill="#00a4ef"/>
                <path d="M21 11H11v10h10V11z" fill="#ffb900"/>
              </svg>
              Mit Microsoft 365 anmelden
            </Button>
          </div>
          
          <Separator className="my-4" />
          
          <div className="text-sm text-slate-500 text-center">
            <p className="mb-2">Demo-Accounts:</p>
            <Button variant="outline" size="sm" className="mr-2" onClick={() => setEmail('admin@servicedesk.de')}>
              Admin
            </Button>
          </div>
          
          <Separator className="my-4" />
          
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-2">Kein Konto? Nutzen Sie unser Self-Service Portal:</p>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => window.location.href = '/self-service'}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Self-Service Portal öffnen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// SIDEBAR & HEADER
// ============================================

function Sidebar({ currentPage, setCurrentPage, collapsed, setCollapsed, user, isCustomerPortal }) {
  const navItems = isCustomerPortal ? CUSTOMER_NAV_ITEMS : NAV_ITEMS
  const [expandedMenus, setExpandedMenus] = useState({})
  
  const toggleSubmenu = (id) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }))
  }
  
  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-300`}>
      <div className="p-4 flex items-center justify-between border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img 
              src="https://customer-assets.emergentagent.com/job_v1-itsm-completion/artifacts/w6ojc37j_logo_itrex.png" 
              alt="IT REX" 
              className="h-8 w-8 object-contain bg-white rounded p-0.5"
            />
            <span className="font-semibold text-sm">{isCustomerPortal ? 'Kundenportal' : 'IT REX ServiceDesk'}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.id}>
            <Button
              variant={currentPage === item.id || (item.submenu && item.submenu.some(s => currentPage === s.id)) ? 'secondary' : 'ghost'}
              className={`w-full justify-start mb-1 ${collapsed ? 'px-2' : ''} ${
                item.highlight 
                  ? 'bg-orange-500 text-white hover:bg-orange-600 font-semibold'
                  : currentPage === item.id || (item.submenu && item.submenu.some(s => currentPage === s.id))
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => {
                if (item.submenu && !collapsed) {
                  toggleSubmenu(item.id)
                } else {
                  setCurrentPage(item.id)
                }
              }}
            >
              <item.icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.submenu && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedMenus[item.id] ? 'rotate-180' : ''}`} />
                  )}
                </>
              )}
            </Button>
            {/* Submenu */}
            {!collapsed && item.submenu && expandedMenus[item.id] && (
              <div className="ml-4 pl-4 border-l border-slate-700 mb-2">
                {item.submenu.map((subItem) => (
                  <Button
                    key={subItem.id}
                    variant={currentPage === subItem.id ? 'secondary' : 'ghost'}
                    className={`w-full justify-start mb-1 text-sm ${
                      currentPage === subItem.id 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    onClick={() => setCurrentPage(subItem.id)}
                  >
                    {subItem.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      
      {!collapsed && user && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.first_name} {user.last_name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Header({ title, user, onLogout, onNavigate, setSelectedTicketId }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  
  const performSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const results = await api.fetch(`/search?q=${encodeURIComponent(query)}&limit=10`)
      setSearchResults(results)
      setShowResults(true)
    } catch (e) {
      console.error('Search error:', e)
    }
    setSearching(false)
  }
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleResultClick = (result) => {
    setShowResults(false)
    setSearchQuery('')
    
    // Navigate based on type
    const typeToPage = {
      ticket: 'tickets',
      contact: 'contacts',
      organization: 'organizations',
      asset: 'assets',
      kb_article: 'knowledge',
      call: 'telephony',
      deal: 'deals',
    }
    
    const page = typeToPage[result.type] || 'dashboard'
    if (onNavigate) {
      onNavigate(page)
    }
    
    // For tickets, also open the detail view
    if (result.type === 'ticket' && setSelectedTicketId) {
      setSelectedTicketId(result.id)
    }
    
    toast.success(`Navigiere zu ${result.title}`)
  }
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'ticket': return <Ticket className="h-4 w-4" />
      case 'contact': return <User className="h-4 w-4" />
      case 'organization': return <Building2 className="h-4 w-4" />
      case 'asset': return <Package className="h-4 w-4" />
      case 'kb_article': return <BookOpen className="h-4 w-4" />
      case 'call': return <PhoneCall className="h-4 w-4" />
      case 'deal': return <TrendingUp className="h-4 w-4" />
      default: return <Search className="h-4 w-4" />
    }
  }
  
  const getTypeBadge = (type) => {
    const types = {
      ticket: { label: 'Ticket', color: 'bg-blue-100 text-blue-700' },
      contact: { label: 'Kontakt', color: 'bg-green-100 text-green-700' },
      organization: { label: 'Organisation', color: 'bg-purple-100 text-purple-700' },
      asset: { label: 'Asset', color: 'bg-orange-100 text-orange-700' },
      kb_article: { label: 'Artikel', color: 'bg-cyan-100 text-cyan-700' },
      call: { label: 'Anruf', color: 'bg-yellow-100 text-yellow-700' },
      deal: { label: 'Deal', color: 'bg-pink-100 text-pink-700' },
    }
    return types[type] || { label: type, color: 'bg-slate-100 text-slate-700' }
  }
  
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />}
          <Input 
            placeholder="Globale Suche..." 
            className="w-80 pl-10 pr-10" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults && setShowResults(true)}
          />
          {showResults && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-auto">
              {searchResults.total === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Keine Ergebnisse für "{searchQuery}"
                </div>
              ) : (
                <>
                  <div className="p-2 border-b bg-slate-50 text-xs text-slate-500">
                    {searchResults.total} Ergebnisse gefunden
                  </div>
                  <div className="divide-y">
                    {searchResults.results?.slice(0, 10).map((result, idx) => {
                      const typeBadge = getTypeBadge(result.type)
                      return (
                        <button
                          key={`${result.type}-${result.id}-${idx}`}
                          className="w-full p-3 hover:bg-slate-50 flex items-start gap-3 text-left cursor-pointer"
                          onClick={() => handleResultClick(result)}
                        >
                          <div className="mt-0.5 text-slate-400">
                            {getTypeIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{result.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${typeBadge.color}`}>
                                {typeBadge.label}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user?.first_name?.[0]}{user?.last_name?.[0]}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

// ============================================
// STATS CARD
// ============================================

function StatsCard({ title, value, icon: Icon, trend, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  }
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// DASHBOARD PAGE
// ============================================

function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentTickets, setRecentTickets] = useState([])
  
  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, ticketsData] = await Promise.all([
          api.getStats(),
          api.getTickets()
        ])
        setStats(statsData)
        setRecentTickets(ticketsData.slice(0, 5))
      } catch (error) {
        toast.error('Fehler beim Laden der Daten')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Offene Tickets"
          value={stats?.tickets?.byStatus?.open || 0}
          icon={Ticket}
          color="blue"
        />
        <StatsCard
          title="In Bearbeitung"
          value={stats?.tickets?.byStatus?.in_progress || 0}
          icon={AlertCircle}
          color="orange"
        />
        <StatsCard
          title="Gelöst"
          value={stats?.tickets?.byStatus?.resolved || 0}
          icon={CheckCircle2}
          color="green"
        />
        <StatsCard
          title="SLA-Erfüllung"
          value={`${(stats?.tickets?.slaResolutionRate || 0).toFixed(0)}%`}
          icon={TrendingUp}
          color="purple"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Ticket-Übersicht</CardTitle>
            <CardDescription>Verteilung nach Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.tickets?.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status] || status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / (stats?.tickets?.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Schnellstatistik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-slate-500">Organisationen</span>
              <span className="font-semibold">{stats?.organizations || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-500">Benutzer</span>
              <span className="font-semibold">{stats?.users || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-500">Assets</span>
              <span className="font-semibold">{stats?.assets || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-500">Erfasste Zeit</span>
              <span className="font-semibold">{Math.round((stats?.time?.totalMinutes || 0) / 60)}h</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTickets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Keine Tickets vorhanden</p>
          ) : (
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500 font-mono">#{ticket.ticket_number}</span>
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-sm text-slate-500">{ticket.organizations?.name || 'Keine Organisation'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// TICKETS PAGE
// ============================================

function TicketsPage({ currentUser, onOpenTicket }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: 'all', priority: 'all' })
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [slaProfiles, setSlaProfiles] = useState([])
  const [users, setUsers] = useState([])
  const [viewMode, setViewMode] = useState('list') // 'list' or 'kanban'
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closingTicket, setClosingTicket] = useState(null)
  
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (filter.status && filter.status !== 'all') params.status = filter.status
      if (filter.priority && filter.priority !== 'all') params.priority = filter.priority
      const data = await api.getTickets(params)
      setTickets(data)
    } catch (error) {
      toast.error('Fehler beim Laden der Tickets')
    } finally {
      setLoading(false)
    }
  }, [filter])
  
  useEffect(() => {
    loadTickets()
    Promise.all([
      api.getOrganizations(),
      api.getSLAProfiles(),
      api.getUsers()
    ]).then(([orgs, slas, usersData]) => {
      setOrganizations(orgs)
      setSlaProfiles(slas)
      setUsers(usersData)
    }).catch(console.error)
  }, [loadTickets])
  
  const handleCreateTicket = async (data) => {
    try {
      await api.createTicket({ ...data, created_by_id: currentUser.id })
      toast.success('Ticket erstellt')
      setShowCreateDialog(false)
      loadTickets()
    } catch (error) {
      toast.error('Fehler beim Erstellen des Tickets')
    }
  }
  
  const handleCloseTicket = (ticket) => {
    setClosingTicket(ticket)
    setShowCloseDialog(true)
  }
  
  const handleCloseSubmit = async (closeData) => {
    try {
      await api.closeTicket(closingTicket.id, { ...closeData, user_id: currentUser.id })
      toast.success('Ticket geschlossen')
      setShowCloseDialog(false)
      setClosingTicket(null)
      loadTickets()
    } catch (error) {
      toast.error('Fehler beim Schließen: ' + (error.message || ''))
    }
  }
  
  const handleMoveTicket = async (ticketId, newStatus, oldStatus) => {
    try {
      await api.moveTicketStatus({ ticket_id: ticketId, new_status: newStatus, old_status: oldStatus, user_id: currentUser.id })
      toast.success('Status aktualisiert')
      loadTickets()
    } catch (error) {
      toast.error('Fehler beim Verschieben')
    }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Ticket className="h-4 w-4 inline mr-1" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <KanbanSquare className="h-4 w-4 inline mr-1" />
              Kanban
            </button>
          </div>
          
          {viewMode === 'list' && (
            <>
              <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filter.priority} onValueChange={(v) => setFilter(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priorität" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioritäten</SelectItem>
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button variant="outline" onClick={loadTickets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <DictationButton 
            type="ticket" 
            onComplete={() => {
              loadTickets()
              toast.success('Ticket per Diktat erstellt')
            }}
          />
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neues Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Neues Ticket erstellen</DialogTitle>
              </DialogHeader>
              <CreateTicketForm
                organizations={organizations}
                slaProfiles={slaProfiles}
                users={users}
                onSubmit={handleCreateTicket}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 mx-auto text-slate-300" />
              <p className="mt-4 text-slate-500">Keine Tickets gefunden</p>
            </div>
          ) : viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Zugewiesen</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="font-mono text-slate-500" onClick={() => onOpenTicket(ticket.id)}>{ticket.ticket_number}</TableCell>
                    <TableCell className="font-medium" onClick={() => onOpenTicket(ticket.id)}>{ticket.subject}</TableCell>
                    <TableCell onClick={() => onOpenTicket(ticket.id)}>{ticket.organizations?.name || '-'}</TableCell>
                    <TableCell onClick={() => onOpenTicket(ticket.id)}>
                      {ticket.assignee ? `${ticket.assignee.first_name} ${ticket.assignee.last_name}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ticket.created_at)}</TableCell>
                    <TableCell>
                      {ticket.status !== 'closed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleCloseTicket(ticket)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <TicketKanbanBoard 
              tickets={tickets} 
              onMoveTicket={handleMoveTicket}
              onOpenTicket={onOpenTicket}
              onCloseTicket={handleCloseTicket}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Close Ticket Dialog */}
      <CloseTicketDialog
        open={showCloseDialog}
        ticket={closingTicket}
        onClose={() => {
          setShowCloseDialog(false)
          setClosingTicket(null)
        }}
        onSubmit={handleCloseSubmit}
      />
    </div>
  )
}

// ============================================
// TICKET KANBAN BOARD
// ============================================

function TicketKanbanBoard({ tickets, onMoveTicket, onOpenTicket, onCloseTicket }) {
  const [draggedTicket, setDraggedTicket] = useState(null)
  
  const columns = [
    { id: 'open', name: 'Offen', color: 'bg-yellow-500' },
    { id: 'pending', name: 'Wartend', color: 'bg-orange-500' },
    { id: 'in_progress', name: 'In Bearbeitung', color: 'bg-blue-500' },
    { id: 'resolved', name: 'Gelöst', color: 'bg-green-500' },
    { id: 'closed', name: 'Geschlossen', color: 'bg-slate-500' },
  ]
  
  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  
  const handleDrop = (e, newStatus) => {
    e.preventDefault()
    if (draggedTicket && draggedTicket.status !== newStatus) {
      onMoveTicket(draggedTicket.id, newStatus, draggedTicket.status)
    }
    setDraggedTicket(null)
  }
  
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
      {columns.map(column => {
        const columnTickets = tickets.filter(t => t.status === column.id)
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-72 bg-slate-50 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className={`${column.color} text-white px-3 py-2 rounded-t-lg font-medium flex justify-between items-center`}>
              <span>{column.name}</span>
              <Badge variant="secondary" className="bg-white/20 text-white">{columnTickets.length}</Badge>
            </div>
            <div className="p-2 space-y-2 min-h-[400px]">
              {columnTickets.map(ticket => (
                <div
                  key={ticket.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, ticket)}
                  className="bg-white rounded-lg p-3 shadow-sm border cursor-move hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-slate-500 font-mono">#{ticket.ticket_number}</span>
                    <Badge className={`${PRIORITY_COLORS[ticket.priority]} text-xs`}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                  </div>
                  <h4 className="font-medium text-sm mb-2 line-clamp-2 cursor-pointer hover:text-blue-600" onClick={() => onOpenTicket(ticket.id)}>
                    {ticket.subject}
                  </h4>
                  {ticket.organizations?.name && (
                    <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                      <Building2 className="h-3 w-3" />
                      {ticket.organizations.name}
                    </div>
                  )}
                  {ticket.assignee && (
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {ticket.assignee.first_name} {ticket.assignee.last_name}
                    </div>
                  )}
                  {column.id !== 'closed' && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => onCloseTicket(ticket)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Schließen
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// CLOSE TICKET DIALOG
// ============================================

function CloseTicketDialog({ open, ticket, onClose, onSubmit }) {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({})
  const [categories, setCategories] = useState([])
  const [todos, setTodos] = useState([])
  const [form, setForm] = useState({
    time_spent_minutes: 0,
    is_billable: true,
    resolution_category: '',
    internal_summary: '',
    customer_summary: '',
    completed_todo_ids: [],
    create_time_entry: true,
  })
  
  useEffect(() => {
    if (open && ticket) {
      // Load config and todos
      Promise.all([
        api.getCloseFlowConfig().catch(() => ({})),
        api.getResolutionCategories().catch(() => []),
        api.getTicketTodos(ticket.id).catch(() => []),
      ]).then(([cfg, cats, todoList]) => {
        setConfig(cfg)
        setCategories(cats)
        setTodos(todoList)
        // Pre-select completed todos
        setForm(f => ({ ...f, completed_todo_ids: todoList.filter(t => t.is_completed).map(t => t.id) }))
      })
    }
  }, [open, ticket])
  
  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }
  
  const toggleTodo = (id) => {
    setForm(f => ({
      ...f,
      completed_todo_ids: f.completed_todo_ids.includes(id)
        ? f.completed_todo_ids.filter(i => i !== id)
        : [...f.completed_todo_ids, id]
    }))
  }
  
  if (!ticket) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket #{ticket.ticket_number} schließen</DialogTitle>
          <DialogDescription>{ticket.subject}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Time Entry */}
          <div className="space-y-2">
            <Label>Zeitaufwand (Minuten) {config.time_required && <span className="text-red-500">*</span>}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                value={form.time_spent_minutes}
                onChange={(e) => setForm(f => ({ ...f, time_spent_minutes: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
              <div className="flex items-center gap-2">
                <Switch checked={form.is_billable} onCheckedChange={(v) => setForm(f => ({ ...f, is_billable: v }))} />
                <Label>Abrechenbar</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.create_time_entry} onChange={(e) => setForm(f => ({ ...f, create_time_entry: e.target.checked }))} />
              <Label className="text-sm">Zeiteintrag erstellen</Label>
            </div>
          </div>
          
          {/* Resolution Category */}
          <div className="space-y-2">
            <Label>Lösungskategorie {config.resolution_category_required && <span className="text-red-500">*</span>}</Label>
            <Select value={form.resolution_category} onValueChange={(v) => setForm(f => ({ ...f, resolution_category: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Todos */}
          {todos.length > 0 && (
            <div className="space-y-2">
              <Label>Erledigte Aufgaben</Label>
              <div className="border rounded-lg p-2 max-h-32 overflow-auto space-y-1">
                {todos.map(todo => (
                  <label key={todo.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.completed_todo_ids.includes(todo.id)}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span className={form.completed_todo_ids.includes(todo.id) ? 'line-through text-slate-400' : ''}>{todo.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Internal Summary */}
          <div className="space-y-2">
            <Label>Interne Notiz {config.internal_note_required && <span className="text-red-500">*</span>}</Label>
            <Textarea
              value={form.internal_summary}
              onChange={(e) => setForm(f => ({ ...f, internal_summary: e.target.value }))}
              placeholder="Interne Zusammenfassung der Lösung..."
              rows={2}
            />
          </div>
          
          {/* Customer Summary */}
          <div className="space-y-2">
            <Label>Kundenzusammenfassung {config.customer_summary_required && <span className="text-red-500">*</span>}</Label>
            <Textarea
              value={form.customer_summary}
              onChange={(e) => setForm(f => ({ ...f, customer_summary: e.target.value }))}
              placeholder="Zusammenfassung für den Kunden (wird als Kommentar hinzugefügt)..."
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Ticket schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// CREATE TICKET FORM
// ============================================

function CreateTicketForm({ organizations, slaProfiles, users, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    organization_id: '',
    sla_profile_id: '',
    assignee_id: '',
  })
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.subject) {
      toast.error('Betreff ist erforderlich')
      return
    }
    onSubmit({
      ...formData,
      organization_id: formData.organization_id || null,
      sla_profile_id: formData.sla_profile_id || null,
      assignee_id: formData.assignee_id || null,
    })
  }
  
  const handleDictation = async () => {
    if (isRecording) return
    
    try {
      setIsRecording(true)
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
      recognition.lang = 'de-DE'
      recognition.continuous = false
      
      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript
        setIsRecording(false)
        setIsProcessing(true)
        
        try {
          const result = await api.aiParseDictation({ text: transcript, type: 'ticket' })
          if (result.success && result.data) {
            setFormData(f => ({
              ...f,
              subject: result.data.subject || f.subject,
              description: result.data.description || transcript,
              priority: result.data.priority || f.priority,
            }))
            toast.success('Diktat verarbeitet')
          } else {
            setFormData(f => ({ ...f, description: transcript }))
          }
        } catch {
          setFormData(f => ({ ...f, description: transcript }))
        } finally {
          setIsProcessing(false)
        }
      }
      
      recognition.onerror = () => {
        setIsRecording(false)
        toast.error('Spracherkennung fehlgeschlagen')
      }
      
      recognition.start()
    } catch {
      toast.error('Mikrofon nicht verfügbar')
      setIsRecording(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Betreff *</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
          placeholder="Kurze Beschreibung des Problems"
        />
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Beschreibung</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleDictation} disabled={isProcessing}>
            {isRecording ? (
              <><MicOff className="h-4 w-4 mr-2 text-red-500 animate-pulse" />Aufnahme...</>
            ) : isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verarbeite...</>
            ) : (
              <><Mic className="h-4 w-4 mr-2" />Diktieren</>
            )}
          </Button>
        </div>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
          placeholder="Detaillierte Beschreibung"
          rows={4}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Organisation</Label>
          <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priorität</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zuweisen an</Label>
          <Select value={formData.assignee_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, assignee_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nicht zugewiesen</SelectItem>
              {users.filter(u => u.user_type === 'internal').map((user) => (
                <SelectItem key={user.id} value={user.id}>{user.first_name} {user.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>SLA-Profil</Label>
          <Select value={formData.sla_profile_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, sla_profile_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Standard" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standard</SelectItem>
              {slaProfiles.map((sla) => (
                <SelectItem key={sla.id} value={sla.id}>{sla.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Ticket erstellen</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// TICKET DETAIL DIALOG
// ============================================

function TicketDetailDialog({ ticketId, currentUser, open, onClose }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [users, setUsers] = useState([])
  const [isEditingTicket, setIsEditingTicket] = useState(false)
  const [editForm, setEditForm] = useState({ subject: '', description: '', priority: '' })
  const [editingComment, setEditingComment] = useState(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  
  useEffect(() => {
    if (open && ticketId) {
      setLoading(true)
      Promise.all([
        api.getTicket(ticketId),
        api.getUsers()
      ]).then(([ticketData, usersData]) => {
        setTicket(ticketData)
        setUsers(usersData)
        setEditForm({
          subject: ticketData.subject || '',
          description: ticketData.description || '',
          priority: ticketData.priority || 'medium'
        })
      }).catch(() => toast.error('Fehler beim Laden')).finally(() => setLoading(false))
    }
  }, [open, ticketId])
  
  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateTicket(ticket.id, { status: newStatus }, currentUser.id)
      setTicket(t => ({ ...t, status: newStatus }))
      toast.success('Status aktualisiert')
    } catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handlePriorityChange = async (newPriority) => {
    try {
      await api.updateTicket(ticket.id, { priority: newPriority }, currentUser.id)
      setTicket(t => ({ ...t, priority: newPriority }))
      toast.success('Priorität aktualisiert')
    } catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handleAssigneeChange = async (assigneeId) => {
    try {
      const id = assigneeId === 'none' ? null : assigneeId
      await api.updateTicket(ticket.id, { assignee_id: id }, currentUser.id)
      const assignee = users.find(u => u.id === assigneeId)
      setTicket(t => ({ ...t, assignee_id: id, assignee }))
      toast.success('Zuweisung aktualisiert')
    } catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handleSaveTicketEdit = async () => {
    try {
      await api.updateTicket(ticket.id, {
        subject: editForm.subject,
        description: editForm.description,
        priority: editForm.priority,
      }, currentUser.id)
      setTicket(t => ({ ...t, ...editForm }))
      setIsEditingTicket(false)
      toast.success('Ticket aktualisiert')
    } catch { toast.error('Fehler beim Speichern') }
  }
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return
    try {
      const comment = await api.createComment({
        ticket_id: ticket.id,
        user_id: currentUser.id,
        content: newComment,
        is_internal: isInternal,
      })
      setTicket(t => ({ ...t, ticket_comments: [...(t.ticket_comments || []), comment] }))
      setNewComment('')
      toast.success('Kommentar hinzugefügt')
    } catch { toast.error('Fehler') }
  }
  
  const handleEditComment = (comment) => {
    setEditingComment(comment)
    setEditCommentContent(comment.content)
  }
  
  const handleSaveComment = async () => {
    try {
      const updated = await api.updateComment(editingComment.id, { content: editCommentContent }, currentUser.id)
      setTicket(t => ({
        ...t,
        ticket_comments: t.ticket_comments.map(c => c.id === editingComment.id ? { ...c, content: editCommentContent } : c)
      }))
      setEditingComment(null)
      setEditCommentContent('')
      toast.success('Kommentar aktualisiert')
    } catch { toast.error('Fehler beim Speichern') }
  }
  
  const handleDeleteComment = async (commentId) => {
    if (!confirm('Kommentar wirklich löschen?')) return
    try {
      await api.deleteComment(commentId, currentUser.id)
      setTicket(t => ({
        ...t,
        ticket_comments: t.ticket_comments.filter(c => c.id !== commentId)
      }))
      toast.success('Kommentar gelöscht')
    } catch { toast.error('Fehler beim Löschen') }
  }
  
  const handleAISummary = async () => {
    try {
      const comments = ticket.ticket_comments?.map(c => c.content) || []
      const result = await api.aiSummarize({
        content: `${ticket.subject}\n\n${ticket.description || ''}`,
        comments
      })
      if (result.success) {
        await api.updateTicket(ticket.id, { ai_summary: result.content }, currentUser.id)
        setTicket(t => ({ ...t, ai_summary: result.content }))
        toast.success('KI-Zusammenfassung erstellt')
      }
    } catch { toast.error('Fehler') }
  }
  
  if (!open) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : ticket ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">#{ticket.ticket_number}</span>
                  {isEditingTicket ? (
                    <Input 
                      value={editForm.subject} 
                      onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                      className="flex-1"
                    />
                  ) : (
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => setIsEditingTicket(true)}>{ticket.subject}</span>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {!isEditingTicket && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingTicket(true)}>
                      <Settings className="h-4 w-4 mr-1" />Bearbeiten
                    </Button>
                  )}
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                  <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden grid grid-cols-3 gap-4">
              <div className="col-span-2 flex flex-col overflow-hidden">
                <Tabs defaultValue="details" className="flex-1 flex flex-col">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="comments">Kommentare ({ticket.ticket_comments?.length || 0})</TabsTrigger>
                    <TabsTrigger value="history">Verlauf</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="flex-1 overflow-auto p-2 space-y-4">
                    {isEditingTicket ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Betreff</Label>
                          <Input 
                            value={editForm.subject} 
                            onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Beschreibung</Label>
                          <Textarea 
                            value={editForm.description} 
                            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                            rows={6}
                          />
                        </div>
                        <div>
                          <Label>Priorität</Label>
                          <Select value={editForm.priority} onValueChange={(v) => setEditForm(f => ({ ...f, priority: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveTicketEdit}><Save className="h-4 w-4 mr-1" />Speichern</Button>
                          <Button variant="outline" onClick={() => {
                            setIsEditingTicket(false)
                            setEditForm({ subject: ticket.subject, description: ticket.description, priority: ticket.priority })
                          }}>Abbrechen</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label className="text-slate-500">Beschreibung</Label>
                          <p className="mt-1 whitespace-pre-wrap">{ticket.description || 'Keine Beschreibung'}</p>
                        </div>
                        {ticket.ai_summary && (
                          <div className="bg-blue-50 rounded-lg p-4">
                            <Label className="text-blue-700">KI-Zusammenfassung</Label>
                            <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.ai_summary}</p>
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={handleAISummary}>
                          <AlertCircle className="h-4 w-4 mr-2" />KI-Zusammenfassung
                        </Button>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                      <div className="space-y-4 p-2">
                        {ticket.ticket_comments?.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">Keine Kommentare</p>
                        ) : (
                          ticket.ticket_comments?.map((comment) => (
                            <div key={comment.id} className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}>
                              {editingComment?.id === comment.id ? (
                                <div className="space-y-2">
                                  <Textarea 
                                    value={editCommentContent} 
                                    onChange={(e) => setEditCommentContent(e.target.value)}
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveComment}><Save className="h-3 w-3 mr-1" />Speichern</Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>Abbrechen</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{comment.users?.first_name?.[0]}{comment.users?.last_name?.[0]}</AvatarFallback></Avatar>
                                      <span className="font-medium text-sm">{comment.users?.first_name} {comment.users?.last_name}</span>
                                      {comment.is_internal && <Badge variant="outline" className="text-yellow-700">Intern</Badge>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">{formatDateTime(comment.created_at)}</span>
                                      {comment.user_id === currentUser.id && (
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditComment(comment)}>
                                            <Settings className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteComment(comment.id)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" id="internal" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                        <Label htmlFor="internal" className="text-sm cursor-pointer">Interne Notiz</Label>
                      </div>
                      <div className="flex gap-2">
                        <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Kommentar..." rows={2} className="flex-1" />
                        <Button onClick={handleAddComment} disabled={!newComment.trim()}><MessageSquare className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="history" className="flex-1 overflow-auto p-2">
                    {ticket.ticket_history?.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">Kein Verlauf</p>
                    ) : (
                      ticket.ticket_history?.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 py-2 border-b">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                          <div>
                            <p className="text-sm">{entry.users?.first_name} {entry.users?.last_name} - {entry.action}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="space-y-4 border-l pl-4">
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <Select value={ticket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-500">Priorität</Label>
                  <Select value={ticket.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-500">Zugewiesen an</Label>
                  <Select value={ticket.assignee_id || 'none'} onValueChange={handleAssigneeChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Nicht zugewiesen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.first_name} {user.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {ticket.organizations && (
                  <div>
                    <Label className="text-slate-500">Organisation</Label>
                    <p className="mt-1 font-medium">{ticket.organizations.name}</p>
                  </div>
                )}
                {ticket.sla_profiles && (
                  <div>
                    <Label className="text-slate-500">SLA</Label>
                    <p className="mt-1 font-medium">{ticket.sla_profiles.name}</p>
                    {ticket.sla_response_due && (
                      <p className="text-sm text-slate-500">Antwort bis: {formatDateTime(ticket.sla_response_due)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// KANBAN PAGE
// ============================================

function KanbanPage({ currentUser }) {
  const [boards, setBoards] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateBoardDialog, setShowCreateBoardDialog] = useState(false)
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false)
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [draggedTask, setDraggedTask] = useState(null)
  
  const loadBoards = useCallback(async () => {
    try {
      const data = await api.getBoards()
      setBoards(data)
      if (data.length > 0 && !activeBoard) {
        setActiveBoard(data[0])
      } else if (activeBoard) {
        const updated = data.find(b => b.id === activeBoard.id)
        if (updated) setActiveBoard(updated)
      }
    } catch { toast.error('Fehler beim Laden') }
    finally { setLoading(false) }
  }, [activeBoard])
  
  useEffect(() => { loadBoards() }, [])
  
  const handleCreateBoard = async (data) => {
    try {
      await api.createBoard({ ...data, owner_id: currentUser.id })
      toast.success('Board erstellt')
      setShowCreateBoardDialog(false)
      loadBoards()
    } catch { toast.error('Fehler') }
  }
  
  const handleCreateTask = async (data) => {
    try {
      await api.createTask({ ...data, board_id: activeBoard.id, column_id: selectedColumn.id, created_by_id: currentUser.id })
      toast.success('Aufgabe erstellt')
      setShowCreateTaskDialog(false)
      loadBoards()
    } catch { toast.error('Fehler') }
  }
  
  const handleDrop = async (column) => {
    if (!draggedTask || draggedTask.column_id === column.id) {
      setDraggedTask(null)
      return
    }
    try {
      await api.moveTask({ task_id: draggedTask.id, column_id: column.id, position: column.tasks?.length || 0 })
      loadBoards()
    } catch { toast.error('Fehler') }
    finally { setDraggedTask(null) }
  }
  
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <Select value={activeBoard?.id || ''} onValueChange={(id) => setActiveBoard(boards.find(b => b.id === id))}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Board wählen" /></SelectTrigger>
          <SelectContent>
            {boards.map((board) => (<SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Dialog open={showCreateBoardDialog} onOpenChange={setShowCreateBoardDialog}>
          <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Neues Board</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neues Board</DialogTitle></DialogHeader>
            <CreateBoardForm onSubmit={handleCreateBoard} onCancel={() => setShowCreateBoardDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {!activeBoard ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <KanbanSquare className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500">Kein Board ausgewählt</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {activeBoard.board_columns?.map((column) => (
              <div key={column.id} className="w-80 flex flex-col bg-slate-100 rounded-lg" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(column)}>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                    <span className="font-medium">{column.name}</span>
                    <Badge variant="secondary" className="text-xs">{column.tasks?.length || 0}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedColumn(column); setShowCreateTaskDialog(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-2">
                    {column.tasks?.map((task) => (
                      <Card key={task.id} className={`cursor-grab ${draggedTask?.id === task.id ? 'opacity-50' : ''}`} draggable onDragStart={() => setDraggedTask(task)}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{task.title}</h4>
                            <Badge className={`${PRIORITY_COLORS[task.priority]} text-xs`}>{PRIORITY_LABELS[task.priority]}</Badge>
                          </div>
                          {task.due_date && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                              <Calendar className="h-3 w-3" />{formatDate(task.due_date)}
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
          <CreateTaskForm onSubmit={handleCreateTask} onCancel={() => setShowCreateTaskDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateBoardForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name) onSubmit({ name }); }} className="space-y-4">
      <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
      </DialogFooter>
    </form>
  )
}

function CreateTaskForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium', due_date: '' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.title) onSubmit(formData); }} className="space-y-4">
      <div><Label>Titel *</Label><Input value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))} /></div>
      <div><Label>Beschreibung</Label><Textarea value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Priorität</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Fällig</Label><Input type="date" value={formData.due_date} onChange={(e) => setFormData(f => ({ ...f, due_date: e.target.value }))} /></div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// ORGANIZATIONS PAGE
// ============================================

function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingOrg, setEditingOrg] = useState(null)
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [slaProfiles, setSlaProfiles] = useState([])
  
  const loadOrganizations = useCallback(async () => {
    try { 
      const [orgs, slas] = await Promise.all([api.getOrganizations(), api.getSLAProfiles()])
      setOrganizations(orgs)
      setSlaProfiles(slas)
    }
    catch { toast.error('Fehler beim Laden') }
    finally { setLoading(false) }
  }, [])
  
  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  
  const handleCreate = async (data) => {
    try { await api.createOrganization(data); toast.success('Organisation erstellt'); setShowCreateDialog(false); loadOrganizations(); }
    catch { toast.error('Fehler beim Erstellen') }
  }
  
  const handleUpdate = async (data) => {
    try { 
      await api.updateOrganization(editingOrg.id, data); 
      toast.success('Organisation aktualisiert'); 
      setEditingOrg(null); 
      loadOrganizations(); 
    }
    catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Organisation wirklich löschen? Alle zugehörigen Daten werden gelöscht!')) return
    try { await api.deleteOrganization(id); toast.success('Organisation gelöscht'); loadOrganizations(); }
    catch { toast.error('Fehler beim Löschen') }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Organisationen</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neue Organisation</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neue Organisation</DialogTitle></DialogHeader>
            <OrganizationForm slaProfiles={slaProfiles} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <div className="cursor-pointer" onClick={() => setSelectedOrg(org)}>
                    <CardTitle className="text-lg hover:text-blue-600">{org.name}</CardTitle>
                    {org.short_name && <CardDescription>{org.short_name}</CardDescription>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingOrg(org)} title="Bearbeiten">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)} title="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {org.email && <p className="text-slate-500 flex items-center gap-2"><Mail className="h-3 w-3" />{org.email}</p>}
                  {org.phone && <p className="text-slate-500 flex items-center gap-2"><Phone className="h-3 w-3" />{org.phone}</p>}
                  {org.domain && <p className="text-slate-500 flex items-center gap-2"><Globe className="h-3 w-3" />{org.domain}</p>}
                  <div className="flex gap-4 pt-2">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{org.locations?.length || 0} Standorte</span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{org.contacts?.length || 0} Kontakte</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Edit Organization Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Organisation bearbeiten</DialogTitle></DialogHeader>
          {editingOrg && (
            <OrganizationForm 
              organization={editingOrg} 
              slaProfiles={slaProfiles}
              onSubmit={handleUpdate} 
              onCancel={() => setEditingOrg(null)} 
              isEdit 
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Organization Detail Dialog */}
      <OrganizationDetailDialog 
        organization={selectedOrg}
        slaProfiles={slaProfiles}
        open={!!selectedOrg}
        onClose={() => setSelectedOrg(null)}
        onUpdate={loadOrganizations}
      />
    </div>
  )
}

function OrganizationForm({ organization, slaProfiles = [], onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    short_name: organization?.short_name || '',
    email: organization?.email || '',
    phone: organization?.phone || '',
    website: organization?.website || '',
    domain: organization?.domain || '',
    notes: organization?.notes || '',
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Name ist erforderlich')
      return
    }
    onSubmit(formData)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Kurzname</Label><Input value={formData.short_name} onChange={(e) => setFormData(f => ({ ...f, short_name: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>E-Mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Website</Label><Input value={formData.website} onChange={(e) => setFormData(f => ({ ...f, website: e.target.value }))} placeholder="https://..." /></div>
        <div><Label>Domain (für Auto-Zuweisung)</Label><Input value={formData.domain} onChange={(e) => setFormData(f => ({ ...f, domain: e.target.value }))} placeholder="firma.de" /></div>
      </div>
      <div>
        <Label>Notizen</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </form>
  )
}

function OrganizationDetailDialog({ organization, slaProfiles, open, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [contacts, setContacts] = useState([])
  const [locations, setLocations] = useState([])
  const [editingContact, setEditingContact] = useState(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  
  useEffect(() => {
    if (open && organization) {
      setContacts(organization.contacts || [])
      setLocations(organization.locations || [])
    }
  }, [open, organization])
  
  const handleAddContact = async (data) => {
    try {
      await api.createContact({ ...data, organization_id: organization.id })
      toast.success('Kontakt hinzugefügt')
      setShowAddContact(false)
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  const handleUpdateContact = async (data) => {
    try {
      await api.updateContact(editingContact.id, data)
      toast.success('Kontakt aktualisiert')
      setEditingContact(null)
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  const handleDeleteContact = async (id) => {
    if (!confirm('Kontakt wirklich löschen?')) return
    try {
      await api.deleteContact(id)
      toast.success('Kontakt gelöscht')
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  const handleAddLocation = async (data) => {
    try {
      await api.createLocation({ ...data, organization_id: organization.id })
      toast.success('Standort hinzugefügt')
      setShowAddLocation(false)
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  const handleUpdateLocation = async (data) => {
    try {
      await api.updateLocation(editingLocation.id, data)
      toast.success('Standort aktualisiert')
      setEditingLocation(null)
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  const handleDeleteLocation = async (id) => {
    if (!confirm('Standort wirklich löschen?')) return
    try {
      await api.deleteLocation(id)
      toast.success('Standort gelöscht')
      onUpdate()
    } catch { toast.error('Fehler') }
  }
  
  if (!organization) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {organization.name}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="contacts">Kontakte ({contacts.length})</TabsTrigger>
            <TabsTrigger value="locations">Standorte ({locations.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="flex-1 overflow-auto p-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-500">E-Mail</Label><p>{organization.email || '-'}</p></div>
              <div><Label className="text-slate-500">Telefon</Label><p>{organization.phone || '-'}</p></div>
              <div><Label className="text-slate-500">Website</Label><p>{organization.website || '-'}</p></div>
              <div><Label className="text-slate-500">Domain</Label><p>{organization.domain || '-'}</p></div>
            </div>
            {organization.notes && (
              <div className="mt-4">
                <Label className="text-slate-500">Notizen</Label>
                <p className="whitespace-pre-wrap">{organization.notes}</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="contacts" className="flex-1 overflow-auto p-2">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setShowAddContact(true)}><Plus className="h-4 w-4 mr-1" />Kontakt</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map(contact => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.first_name} {contact.last_name}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>{contact.phone || '-'}</TableCell>
                    <TableCell>{contact.position || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingContact(contact)}><Settings className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(contact.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="locations" className="flex-1 overflow-auto p-2">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setShowAddLocation(true)}><Plus className="h-4 w-4 mr-1" />Standort</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Stadt</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map(loc => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name} {loc.is_headquarters && <Badge variant="outline" className="ml-2">HQ</Badge>}</TableCell>
                    <TableCell>{loc.address || '-'}</TableCell>
                    <TableCell>{loc.zip_code} {loc.city}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingLocation(loc)}><Settings className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(loc.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
        
        {/* Add/Edit Contact Dialog */}
        <Dialog open={showAddContact || !!editingContact} onOpenChange={(open) => { if (!open) { setShowAddContact(false); setEditingContact(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</DialogTitle></DialogHeader>
            <ContactForm contact={editingContact} onSubmit={editingContact ? handleUpdateContact : handleAddContact} onCancel={() => { setShowAddContact(false); setEditingContact(null); }} isEdit={!!editingContact} />
          </DialogContent>
        </Dialog>
        
        {/* Add/Edit Location Dialog */}
        <Dialog open={showAddLocation || !!editingLocation} onOpenChange={(open) => { if (!open) { setShowAddLocation(false); setEditingLocation(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingLocation ? 'Standort bearbeiten' : 'Neuer Standort'}</DialogTitle></DialogHeader>
            <LocationForm location={editingLocation} onSubmit={editingLocation ? handleUpdateLocation : handleAddLocation} onCancel={() => { setShowAddLocation(false); setEditingLocation(null); }} isEdit={!!editingLocation} />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

function ContactForm({ contact, onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    position: contact?.position || '',
    department: contact?.department || '',
    is_primary: contact?.is_primary || false,
  })
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.first_name && formData.last_name) onSubmit(formData); else toast.error('Name ist erforderlich'); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Vorname *</Label><Input value={formData.first_name} onChange={(e) => setFormData(f => ({ ...f, first_name: e.target.value }))} /></div>
        <div><Label>Nachname *</Label><Input value={formData.last_name} onChange={(e) => setFormData(f => ({ ...f, last_name: e.target.value }))} /></div>
      </div>
      <div><Label>E-Mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><Label>Mobil</Label><Input value={formData.mobile} onChange={(e) => setFormData(f => ({ ...f, mobile: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Position</Label><Input value={formData.position} onChange={(e) => setFormData(f => ({ ...f, position: e.target.value }))} /></div>
        <div><Label>Abteilung</Label><Input value={formData.department} onChange={(e) => setFormData(f => ({ ...f, department: e.target.value }))} /></div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={formData.is_primary} onCheckedChange={(v) => setFormData(f => ({ ...f, is_primary: v }))} />
        <Label>Hauptkontakt</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Hinzufügen'}</Button>
      </DialogFooter>
    </form>
  )
}

function LocationForm({ location, onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '',
    city: location?.city || '',
    zip_code: location?.zip_code || '',
    country: location?.country || 'Deutschland',
    phone: location?.phone || '',
    is_headquarters: location?.is_headquarters || false,
  })
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.name) onSubmit(formData); else toast.error('Name ist erforderlich'); }} className="space-y-4">
      <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Hauptsitz, Niederlassung Berlin..." /></div>
      <div><Label>Adresse</Label><Input value={formData.address} onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))} /></div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label>PLZ</Label><Input value={formData.zip_code} onChange={(e) => setFormData(f => ({ ...f, zip_code: e.target.value }))} /></div>
        <div className="col-span-2"><Label>Stadt</Label><Input value={formData.city} onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Land</Label><Input value={formData.country} onChange={(e) => setFormData(f => ({ ...f, country: e.target.value }))} /></div>
        <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={formData.is_headquarters} onCheckedChange={(v) => setFormData(f => ({ ...f, is_headquarters: v }))} />
        <Label>Hauptsitz</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Hinzufügen'}</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// USERS PAGE
// ============================================

function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [roles, setRoles] = useState([])
  const [organizations, setOrganizations] = useState([])
  
  useEffect(() => {
    Promise.all([api.getUsers(), api.getRoles(), api.getOrganizations()])
      .then(([usersData, rolesData, orgsData]) => { setUsers(usersData); setRoles(rolesData); setOrganizations(orgsData); })
      .catch(() => toast.error('Fehler'))
      .finally(() => setLoading(false))
  }, [])
  
  const loadUsers = async () => {
    try { setUsers(await api.getUsers()); }
    catch { toast.error('Fehler beim Laden'); }
  }
  
  const handleCreate = async (data) => {
    try { await api.createUser(data); toast.success('Benutzer erstellt'); setShowCreateDialog(false); loadUsers(); }
    catch { toast.error('Fehler beim Erstellen') }
  }
  
  const handleUpdate = async (data) => {
    try { 
      await api.updateUser(editingUser.id, data); 
      toast.success('Benutzer aktualisiert'); 
      setEditingUser(null); 
      loadUsers(); 
    }
    catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Benutzer wirklich deaktivieren?')) return
    try { await api.deleteUser(id); toast.success('Benutzer deaktiviert'); loadUsers(); }
    catch { toast.error('Fehler') }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Benutzer</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neuer Benutzer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neuer Benutzer</DialogTitle></DialogHeader>
            <UserForm roles={roles} organizations={organizations} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant="outline">{user.user_type === 'internal' ? 'Intern' : 'Kunde'}</Badge></TableCell>
                  <TableCell>{user.user_roles?.[0]?.roles?.display_name || '-'}</TableCell>
                  <TableCell>{organizations.find(o => o.id === user.organization_id)?.name || '-'}</TableCell>
                  <TableCell><Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>{user.is_active ? 'Aktiv' : 'Inaktiv'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)} title="Bearbeiten">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} title="Deaktivieren">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Benutzer bearbeiten</DialogTitle></DialogHeader>
          {editingUser && (
            <UserForm 
              user={editingUser} 
              roles={roles} 
              organizations={organizations}
              onSubmit={handleUpdate} 
              onCancel={() => setEditingUser(null)} 
              isEdit 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserForm({ user, roles, organizations = [], onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    user_type: user?.user_type || 'internal',
    role_id: user?.user_roles?.[0]?.role_id || user?.role_id || '',
    organization_id: user?.organization_id || '',
    is_active: user?.is_active !== false,
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.email || !formData.first_name || !formData.last_name) {
      toast.error('Bitte alle Pflichtfelder ausfüllen')
      return
    }
    onSubmit({
      ...formData,
      role_id: formData.role_id || null,
      organization_id: formData.organization_id || null,
    })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Vorname *</Label><Input value={formData.first_name} onChange={(e) => setFormData(f => ({ ...f, first_name: e.target.value }))} /></div>
        <div><Label>Nachname *</Label><Input value={formData.last_name} onChange={(e) => setFormData(f => ({ ...f, last_name: e.target.value }))} /></div>
      </div>
      <div><Label>E-Mail *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} disabled={isEdit} /></div>
      <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Benutzertyp</Label>
          <Select value={formData.user_type} onValueChange={(v) => setFormData(f => ({ ...f, user_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Intern (Agent)</SelectItem>
              <SelectItem value="customer">Kunde</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Rolle</Label>
          <Select value={formData.role_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, role_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine</SelectItem>
              {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Organisation</Label>
        <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v }))}>
          <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine</SelectItem>
            {organizations.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isEdit && (
        <div className="flex items-center gap-2">
          <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData(f => ({ ...f, is_active: v }))} />
          <Label>Benutzer aktiv</Label>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// ASSETS PAGE
// ============================================

function AssetsPage() {
  const [assets, setAssets] = useState([])
  const [assetTypes, setAssetTypes] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [filter, setFilter] = useState({ type_id: 'all', status: 'all' })
  
  const loadAssets = useCallback(async () => {
    try {
      const params = {}
      if (filter.type_id && filter.type_id !== 'all') params.type_id = filter.type_id
      if (filter.status && filter.status !== 'all') params.status = filter.status
      setAssets(await api.getAssets(params))
    } catch { toast.error('Fehler beim Laden') }
    finally { setLoading(false) }
  }, [filter])
  
  useEffect(() => {
    Promise.all([api.getAssetTypes(), api.getOrganizations(), api.getUsers()])
      .then(([types, orgs, usersData]) => { setAssetTypes(types); setOrganizations(orgs); setUsers(usersData); })
    loadAssets()
  }, [loadAssets])
  
  const handleCreate = async (data) => {
    try { await api.createAsset(data); toast.success('Asset erstellt'); setShowCreateDialog(false); loadAssets(); }
    catch { toast.error('Fehler beim Erstellen') }
  }
  
  const handleUpdate = async (data) => {
    try { 
      await api.updateAsset(editingAsset.id, data); 
      toast.success('Asset aktualisiert'); 
      setEditingAsset(null); 
      loadAssets(); 
    }
    catch { toast.error('Fehler beim Aktualisieren') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Asset wirklich löschen?')) return
    try { await api.deleteAsset(id); toast.success('Asset gelöscht'); loadAssets(); }
    catch { toast.error('Fehler beim Löschen') }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <div className="flex gap-4">
          <Select value={filter.type_id} onValueChange={(v) => setFilter(f => ({ ...f, type_id: v }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Typ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {assetTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAssets}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neues Asset</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neues Asset</DialogTitle></DialogHeader>
            <AssetForm assetTypes={assetTypes} organizations={organizations} users={users} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Zugewiesen an</TableHead>
                <TableHead>Seriennummer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const IconComponent = ASSET_ICONS[asset.asset_types?.name] || Box
                const assignedUser = users.find(u => u.id === asset.assigned_user_id)
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded"><IconComponent className="h-5 w-5" /></div>
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          {asset.asset_tag && <p className="text-xs text-slate-500">{asset.asset_tag}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{asset.asset_types?.name}</TableCell>
                    <TableCell>{asset.organizations?.name || '-'}</TableCell>
                    <TableCell>{assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
                    <TableCell><Badge className={ASSET_STATUS_COLORS[asset.status]}>{ASSET_STATUS_LABELS[asset.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingAsset(asset)} title="Bearbeiten">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)} title="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Edit Asset Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Asset bearbeiten</DialogTitle></DialogHeader>
          {editingAsset && (
            <AssetForm 
              asset={editingAsset}
              assetTypes={assetTypes} 
              organizations={organizations} 
              users={users}
              onSubmit={handleUpdate} 
              onCancel={() => setEditingAsset(null)} 
              isEdit 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssetForm({ asset, assetTypes, organizations, users = [], onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    asset_type_id: asset?.asset_type_id || '',
    name: asset?.name || '',
    asset_tag: asset?.asset_tag || '',
    serial_number: asset?.serial_number || '',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    organization_id: asset?.organization_id || '',
    assigned_user_id: asset?.assigned_user_id || '',
    location_id: asset?.location_id || '',
    status: asset?.status || 'active',
    purchase_date: asset?.purchase_date?.split('T')[0] || '',
    purchase_price: asset?.purchase_price || '',
    warranty_end: asset?.warranty_end?.split('T')[0] || '',
    notes: asset?.notes || '',
    // Software License Fields
    software_name: asset?.software_name || '',
    vendor: asset?.vendor || '',
    purchase_source: asset?.purchase_source || '',
    license_expiry_date: asset?.license_expiry_date?.split('T')[0] || '',
    sales_price: asset?.sales_price || '',
    license_key: asset?.license_key || '',
    license_quantity: asset?.license_quantity || 1,
    license_type: asset?.license_type || '',
  })
  const [showLicenseFields, setShowLicenseFields] = useState(!!asset?.software_name || !!asset?.license_key)
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.asset_type_id || !formData.name) {
      toast.error('Typ und Name sind erforderlich')
      return
    }
    onSubmit({
      ...formData,
      organization_id: formData.organization_id || null,
      assigned_user_id: formData.assigned_user_id || null,
      location_id: formData.location_id || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      sales_price: formData.sales_price ? parseFloat(formData.sales_price) : null,
      purchase_date: formData.purchase_date || null,
      warranty_end: formData.warranty_end || null,
      license_expiry_date: formData.license_expiry_date || null,
      software_name: formData.software_name || null,
      vendor: formData.vendor || null,
      purchase_source: formData.purchase_source || null,
      license_key: formData.license_key || null,
      license_quantity: formData.license_quantity || 1,
      license_type: formData.license_type || null,
    })
  }
  
  // Get locations for selected organization
  const selectedOrg = organizations.find(o => o.id === formData.organization_id)
  const locations = selectedOrg?.locations || []
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Typ *</Label>
          <Select value={formData.asset_type_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, asset_type_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Wählen...</SelectItem>
              {assetTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Asset-Tag</Label><Input value={formData.asset_tag} onChange={(e) => setFormData(f => ({ ...f, asset_tag: e.target.value }))} placeholder="PC-001" /></div>
        <div><Label>Seriennummer</Label><Input value={formData.serial_number} onChange={(e) => setFormData(f => ({ ...f, serial_number: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Hersteller</Label><Input value={formData.manufacturer} onChange={(e) => setFormData(f => ({ ...f, manufacturer: e.target.value }))} /></div>
        <div><Label>Modell</Label><Input value={formData.model} onChange={(e) => setFormData(f => ({ ...f, model: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Organisation</Label>
          <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v, location_id: '' }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine</SelectItem>
              {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Standort</Label>
          <Select value={formData.location_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, location_id: v === 'none' ? '' : v }))} disabled={!formData.organization_id}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Standort</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Zugewiesen an</Label>
          <Select value={formData.assigned_user_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, assigned_user_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nicht zugewiesen</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label>Kaufdatum</Label><Input type="date" value={formData.purchase_date} onChange={(e) => setFormData(f => ({ ...f, purchase_date: e.target.value }))} /></div>
        <div><Label>Kaufpreis (€)</Label><Input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData(f => ({ ...f, purchase_price: e.target.value }))} /></div>
        <div><Label>Garantie bis</Label><Input type="date" value={formData.warranty_end} onChange={(e) => setFormData(f => ({ ...f, warranty_end: e.target.value }))} /></div>
      </div>
      
      {/* Software License Section */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Software-Lizenz Details</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowLicenseFields(!showLicenseFields)}>
            {showLicenseFields ? 'Ausblenden' : 'Einblenden'}
          </Button>
        </div>
        {showLicenseFields && (
          <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Software-Name</Label><Input value={formData.software_name} onChange={(e) => setFormData(f => ({ ...f, software_name: e.target.value }))} placeholder="z.B. Microsoft Office 365" /></div>
              <div><Label>Hersteller/Vendor</Label><Input value={formData.vendor} onChange={(e) => setFormData(f => ({ ...f, vendor: e.target.value }))} placeholder="z.B. Microsoft" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bezugsquelle</Label>
                <Select value={formData.purchase_source || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, purchase_source: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht angegeben</SelectItem>
                    <SelectItem value="Microsoft">Microsoft</SelectItem>
                    <SelectItem value="Amazon">Amazon</SelectItem>
                    <SelectItem value="Vendor">Direkter Vendor</SelectItem>
                    <SelectItem value="Reseller">Reseller</SelectItem>
                    <SelectItem value="OEM">OEM/Vorinstalliert</SelectItem>
                    <SelectItem value="Other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lizenztyp</Label>
                <Select value={formData.license_type || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, license_type: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht angegeben</SelectItem>
                    <SelectItem value="perpetual">Dauerlizenz (Perpetual)</SelectItem>
                    <SelectItem value="subscription">Abonnement (Subscription)</SelectItem>
                    <SelectItem value="trial">Testlizenz (Trial)</SelectItem>
                    <SelectItem value="volume">Volumenlizenz</SelectItem>
                    <SelectItem value="oem">OEM-Lizenz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Ablaufdatum</Label><Input type="date" value={formData.license_expiry_date} onChange={(e) => setFormData(f => ({ ...f, license_expiry_date: e.target.value }))} /></div>
              <div><Label>Verkaufspreis (€)</Label><Input type="number" step="0.01" value={formData.sales_price} onChange={(e) => setFormData(f => ({ ...f, sales_price: e.target.value }))} /></div>
              <div><Label>Anzahl Lizenzen</Label><Input type="number" min="1" value={formData.license_quantity} onChange={(e) => setFormData(f => ({ ...f, license_quantity: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div>
              <Label>Lizenzschlüssel</Label>
              <Input value={formData.license_key} onChange={(e) => setFormData(f => ({ ...f, license_key: e.target.value }))} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono" />
            </div>
          </div>
        )}
      </div>
      
      <div>
        <Label>Notizen</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// TIME TRACKING PAGE
// ============================================

function TimePage({ currentUser }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState(null)
  const [tickets, setTickets] = useState([])
  const [organizations, setOrganizations] = useState([])
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerDescription, setTimerDescription] = useState('')
  const [timerTicketId, setTimerTicketId] = useState('')
  const timerRef = useRef(null)
  const timerStartRef = useRef(null)
  
  const loadEntries = useCallback(async () => {
    try { setEntries(await api.getTimeEntries({ user_id: currentUser.id })) }
    catch { toast.error('Fehler') }
    finally { setLoading(false) }
  }, [currentUser.id])
  
  useEffect(() => {
    loadEntries()
    Promise.all([api.getTickets(), api.getOrganizations()])
      .then(([t, o]) => { setTickets(t); setOrganizations(o); })
  }, [loadEntries])
  
  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isTimerRunning])
  
  const startTimer = () => {
    setIsTimerRunning(true)
    timerStartRef.current = new Date()
    setTimerSeconds(0)
  }
  
  const stopTimer = async () => {
    setIsTimerRunning(false)
    if (timerSeconds < 60) {
      toast.error('Mindestens 1 Minute erforderlich')
      return
    }
    if (!timerDescription) {
      toast.error('Beschreibung erforderlich')
      return
    }
    
    try {
      const ticket = tickets.find(t => t.id === timerTicketId)
      await api.createTimeEntry({
        user_id: currentUser.id,
        description: timerDescription,
        duration_minutes: Math.round(timerSeconds / 60),
        ticket_id: timerTicketId || null,
        organization_id: ticket?.organization_id || null,
        started_at: timerStartRef.current.toISOString(),
        ended_at: new Date().toISOString(),
        is_billable: true,
      })
      toast.success('Zeit erfasst')
      setTimerDescription('')
      setTimerTicketId('')
      setTimerSeconds(0)
      loadEntries()
    } catch { toast.error('Fehler') }
  }
  
  const handleCreate = async (data) => {
    try {
      await api.createTimeEntry({ ...data, user_id: currentUser.id })
      toast.success('Zeit erfasst')
      setShowCreateDialog(false)
      loadEntries()
    } catch { toast.error('Fehler') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Löschen?')) return
    try { await api.deleteTimeEntry(id); toast.success('Gelöscht'); loadEntries(); }
    catch { toast.error('Fehler') }
  }
  
  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
  const billableMinutes = entries.filter(e => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0)
  const unbilledMinutes = entries.filter(e => e.is_billable && !e.is_invoiced).reduce((sum, e) => sum + e.duration_minutes, 0)
  
  // Get organizations with unbilled time
  const orgsWithUnbilledTime = [...new Set(
    entries
      .filter(e => e.is_billable && !e.is_invoiced && e.organization_id)
      .map(e => e.organization_id)
  )].map(orgId => organizations.find(o => o?.id === orgId)).filter(Boolean)
  
  return (
    <div className="p-6 space-y-6">
      {/* Timer Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="text-4xl font-mono font-bold">{formatTimer(timerSeconds)}</div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <Input value={timerDescription} onChange={(e) => setTimerDescription(e.target.value)} placeholder="Was arbeiten Sie?" disabled={isTimerRunning} />
              <Select value={timerTicketId || 'none'} onValueChange={(v) => setTimerTicketId(v === 'none' ? '' : v)} disabled={isTimerRunning}>
                <SelectTrigger><SelectValue placeholder="Ticket (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Ticket</SelectItem>
                  {tickets.slice(0, 20).map((t) => <SelectItem key={t.id} value={t.id}>#{t.ticket_number} - {t.subject}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isTimerRunning ? (
              <Button variant="destructive" size="lg" onClick={stopTimer}><StopCircle className="h-5 w-5 mr-2" />Stopp</Button>
            ) : (
              <Button size="lg" onClick={startTimer}><Play className="h-5 w-5 mr-2" />Start</Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Gesamt diese Woche" value={formatDuration(totalMinutes)} icon={Clock} color="blue" />
        <StatsCard title="Abrechenbar" value={formatDuration(billableMinutes)} icon={Timer} color="green" />
        <StatsCard title="Noch nicht abgerechnet" value={formatDuration(unbilledMinutes)} icon={CreditCard} color="orange" />
        <StatsCard title="Einträge" value={entries.length} icon={FileText} color="purple" />
      </div>
      
      {/* Billing Section */}
      {orgsWithUnbilledTime.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <CreditCard className="h-5 w-5" />
              Offene Abrechnungen
            </CardTitle>
            <CardDescription>
              Folgende Organisationen haben noch nicht abgerechnete Zeiteinträge
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {orgsWithUnbilledTime.map(org => {
                const orgMinutes = entries
                  .filter(e => e.is_billable && !e.is_invoiced && e.organization_id === org.id)
                  .reduce((sum, e) => sum + e.duration_minutes, 0)
                return (
                  <Button
                    key={org.id}
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      setSelectedOrganization(org.id)
                      setShowInvoiceDialog(true)
                    }}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {org.name}
                    <Badge variant="secondary" className="ml-2">{formatDuration(orgMinutes)}</Badge>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Header */}
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Zeiteinträge</h2>
        <div className="flex items-center gap-2">
          <DictationButton 
            type="time" 
            onComplete={() => {
              loadEntries()
              toast.success('Zeit per Diktat erfasst')
            }}
          />
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Manuell erfassen</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Zeit erfassen</DialogTitle></DialogHeader>
              <CreateTimeEntryForm tickets={tickets} organizations={organizations} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Entries */}
      {loading ? <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead>Abrechenbar</TableHead>
                <TableHead>Abgerechnet</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.description}</TableCell>
                  <TableCell>{entry.tickets ? `#${entry.tickets.ticket_number}` : '-'}</TableCell>
                  <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                  <TableCell><Badge className={entry.is_billable ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>{entry.is_billable ? 'Ja' : 'Nein'}</Badge></TableCell>
                  <TableCell><Badge className={entry.is_invoiced ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>{entry.is_invoiced ? 'Ja' : 'Offen'}</Badge></TableCell>
                  <TableCell>{formatDate(entry.created_at)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Invoice Dialog */}
      <CreateInvoiceDialog
        organizationId={selectedOrganization}
        open={showInvoiceDialog}
        onClose={() => {
          setShowInvoiceDialog(false)
          setSelectedOrganization(null)
        }}
        onCreated={() => {
          loadEntries()
          toast.success('Rechnungsentwurf erstellt')
        }}
      />
    </div>
  )
}

function CreateTimeEntryForm({ tickets, organizations, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({ description: '', duration_minutes: 30, ticket_id: '', organization_id: '', is_billable: true })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.description && formData.duration_minutes) onSubmit(formData); }} className="space-y-4">
      <div><Label>Beschreibung *</Label><Textarea value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Dauer (Minuten) *</Label><Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))} /></div>
        <div>
          <Label>Ticket</Label>
          <Select value={formData.ticket_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, ticket_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Ticket</SelectItem>
              {tickets.slice(0, 20).map((t) => <SelectItem key={t.id} value={t.id}>#{t.ticket_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="billable" checked={formData.is_billable} onChange={(e) => setFormData(f => ({ ...f, is_billable: e.target.checked }))} className="rounded" />
        <Label htmlFor="billable">Abrechenbar</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erfassen</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// LIVE TRANSCRIPTION PANEL COMPONENT
// ============================================

function LiveTranscriptionPanel({ callId, isActive }) {
  const [transcription, setTranscription] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [summary, setSummary] = useState(null)
  const [generating, setGenerating] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const chunkIndexRef = useRef(0)
  
  // Start/stop recording based on call status
  useEffect(() => {
    if (isActive && !isRecording) {
      startRecording()
    }
    return () => {
      stopRecording()
    }
  }, [isActive])
  
  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      chunkIndexRef.current = 0
      
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Send chunk for transcription every 5 seconds
          if (chunksRef.current.length >= 1) {
            await transcribeChunk()
          }
        }
      }
      
      mediaRecorder.start(5000) // Capture every 5 seconds
      setIsRecording(true)
      
      // Notify backend
      await api.fetch('/cti/transcription/start', {
        method: 'POST',
        body: JSON.stringify({ call_id: callId })
      })
      
      toast.success('Live-Transkription gestartet')
    } catch (error) {
      console.error('Microphone access error:', error)
      // Fallback to simulation mode
      simulateTranscription()
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
    setIsRecording(false)
  }
  
  const transcribeChunk = async () => {
    if (chunksRef.current.length === 0) return
    
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []
    
    // Convert to base64
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1]
      
      try {
        const result = await api.fetch('/cti/transcription/chunk', {
          method: 'POST',
          body: JSON.stringify({
            call_id: callId,
            audio_base64: base64,
            chunk_index: chunkIndexRef.current++,
          })
        })
        
        if (result.text) {
          setTranscription(prev => prev + ' ' + result.text)
        }
      } catch (e) {
        console.error('Transcription error:', e)
      }
    }
  }
  
  // Simulation mode for demo
  const simulateTranscription = () => {
    setIsRecording(true)
    const phrases = [
      "Guten Tag, IT REX Solutions, wie kann ich Ihnen helfen?",
      "Ja, ich habe ein Problem mit meinem Computer.",
      "Der startet nicht mehr richtig, bleibt beim Logo hängen.",
      "Verstehe. Haben Sie kürzlich Updates installiert?",
      "Ja, gestern Abend gab es ein Windows-Update.",
      "Das könnte das Problem sein. Ich werde einen Techniker schicken.",
      "Das wäre sehr hilfreich. Wann kann er kommen?",
      "Heute Nachmittag gegen 14 Uhr, passt das?",
      "Perfekt, ich bin im Büro. Vielen Dank!",
    ]
    
    let index = 0
    const interval = setInterval(() => {
      if (index < phrases.length && isActive) {
        setTranscription(prev => prev + (prev ? '\n' : '') + phrases[index])
        index++
      } else {
        clearInterval(interval)
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }
  
  const generateSummary = async () => {
    if (!transcription) {
      toast.error('Keine Transkription vorhanden')
      return
    }
    
    setGenerating(true)
    try {
      const result = await api.fetch('/cti/transcription/summary', {
        method: 'POST',
        body: JSON.stringify({ call_id: callId, transcription })
      })
      
      if (result.summary) {
        setSummary(result.summary)
        toast.success('Zusammenfassung generiert')
      } else if (result.fallback_summary) {
        setSummary(result.fallback_summary)
      }
    } catch (e) {
      toast.error('Fehler bei der Zusammenfassung')
    }
    setGenerating(false)
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
          <Label className="font-medium">Live-Transkription</Label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateSummary} disabled={!transcription || generating}>
            {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            KI-Zusammenfassung
          </Button>
        </div>
      </div>
      
      <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
        {transcription ? (
          <p className="text-sm whitespace-pre-line">{transcription}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {isRecording ? 'Warte auf Sprache...' : 'Transkription wird gestartet...'}
          </p>
        )}
      </div>
      
      {summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">KI-Zusammenfassung</span>
          </div>
          <div className="text-sm text-blue-900 space-y-1">
            {summary.problem && <p><strong>Problem:</strong> {summary.problem}</p>}
            {summary.sentiment && <p><strong>Stimmung:</strong> {summary.sentiment === 'positive' ? '😊 Positiv' : summary.sentiment === 'negative' ? '😟 Negativ' : '😐 Neutral'}</p>}
            {summary.nextSteps && Array.isArray(summary.nextSteps) && (
              <div>
                <strong>Nächste Schritte:</strong>
                <ul className="list-disc list-inside ml-2">
                  {summary.nextSteps.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
              </div>
            )}
            {summary.urgency && <p><strong>Dringlichkeit:</strong> {summary.urgency}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// TELEPHONY / CTI PAGE
// ============================================

function TelephonyPage({ currentUser }) {
  const [activeCall, setActiveCall] = useState(null)
  const [callHistory, setCallHistory] = useState([])
  const [lookupResult, setLookupResult] = useState(null)
  const [dialNumber, setDialNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [callNotes, setCallNotes] = useState('')
  const [showSimulator, setShowSimulator] = useState(false)
  const [simulateNumber, setSimulateNumber] = useState('+49 176 21911217')
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [newContact, setNewContact] = useState({ 
    first_name: '', last_name: '', email: '', organization_id: '',
    customer_type: 'business', status: 'lead', call_outcome: '', notes: '',
    position: '', mobile: '', new_organization_name: ''
  })
  const [organizations, setOrganizations] = useState([])
  const [showLinkTicket, setShowLinkTicket] = useState(false)
  const [existingTickets, setExistingTickets] = useState([])
  const [selectedTicketId, setSelectedTicketId] = useState('')
  
  useEffect(() => {
    loadCallHistory()
    loadOrganizations()
  }, [])
  
  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations()
      setOrganizations(orgs || [])
    } catch (e) {}
  }
  
  const loadCallHistory = async () => {
    setLoading(true)
    try {
      const calls = await api.fetch('/cti/calls?limit=20')
      setCallHistory(Array.isArray(calls) ? calls : [])
    } catch (e) {
      setCallHistory([])
    }
    setLoading(false)
  }
  
  const lookupNumber = async (number) => {
    if (!number) return
    try {
      const result = await api.fetch(`/cti/lookup?phone_number=${encodeURIComponent(number)}`)
      setLookupResult(result)
      return result
    } catch (e) {
      toast.error('Fehler bei der Suche')
      return null
    }
  }
  
  const simulateIncomingCall = async () => {
    if (!simulateNumber) {
      toast.error('Bitte Telefonnummer eingeben')
      return
    }
    try {
      const result = await api.fetch('/cti/simulate-incoming', {
        method: 'POST',
        body: JSON.stringify({ phone_number: simulateNumber })
      })
      setActiveCall(result)
      setLookupResult(result.lookup)
      setShowSimulator(false)
      toast.success('Eingehender Anruf simuliert!')
    } catch (e) {
      toast.error('Fehler bei der Simulation')
    }
  }
  
  const acceptCall = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, status: 'connected', connectedAt: new Date() })
      toast.success('Anruf angenommen')
    }
  }
  
  const endCall = async () => {
    if (activeCall) {
      const duration = activeCall.connectedAt 
        ? Math.round((new Date() - new Date(activeCall.connectedAt)) / 1000)
        : 0
      
      // Save call log
      try {
        await api.fetch('/cti/calls', {
          method: 'POST',
          body: JSON.stringify({
            phone_number: activeCall.phone_number,
            direction: 'inbound',
            user_id: currentUser?.id,
            contact_id: lookupResult?.contact?.id,
            organization_id: lookupResult?.organization?.id,
            status: 'completed',
            duration_seconds: duration,
            notes: callNotes,
          })
        })
        toast.success(`Anruf beendet (${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')})`)
        loadCallHistory()
      } catch (e) {
        toast.error('Fehler beim Speichern')
      }
      
      setActiveCall(null)
      setLookupResult(null)
      setCallNotes('')
    }
  }
  
  const makeOutboundCall = async () => {
    if (!dialNumber) {
      toast.error('Bitte Nummer eingeben')
      return
    }
    const lookup = await lookupNumber(dialNumber)
    setActiveCall({
      call_id: Date.now().toString(),
      phone_number: dialNumber,
      direction: 'outbound',
      status: 'dialing',
      lookup
    })
    
    // Simulate connection after 2s
    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'connected', connectedAt: new Date() } : null)
    }, 2000)
  }
  
  const createTicketFromCall = async () => {
    if (!lookupResult?.organization?.id) {
      toast.error('Keine Organisation zugeordnet')
      return
    }
    
    try {
      const ticket = await api.createTicket({
        subject: `Telefonanruf von ${activeCall?.phone_number || 'Unbekannt'}`,
        description: `Anruf am ${new Date().toLocaleString('de-DE')}\n\nNotizen:\n${callNotes || 'Keine Notizen'}`,
        organization_id: lookupResult.organization.id,
        created_by_id: currentUser?.id,
        source: 'phone',
        priority: 'medium',
      })
      toast.success(`Ticket #${ticket.ticket_number} erstellt`)
    } catch (e) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Telefonie / CTI</h1>
          <p className="text-muted-foreground">Anruferkennung und Call-Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSimulator(true)}>
            <Phone className="w-4 h-4 mr-2" />
            Anruf simulieren
          </Button>
          <Button variant="outline" onClick={loadCallHistory}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Call / Dialer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              {activeCall ? 'Aktiver Anruf' : 'Wählfeld'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCall ? (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                    activeCall.status === 'ringing' ? 'bg-yellow-100 animate-pulse' :
                    activeCall.status === 'connected' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <Phone className={`w-10 h-10 ${
                      activeCall.status === 'ringing' ? 'text-yellow-600' :
                      activeCall.status === 'connected' ? 'text-green-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <h3 className="text-2xl font-bold">{activeCall.phone_number}</h3>
                  <p className="text-muted-foreground">
                    {activeCall.status === 'ringing' && '📞 Eingehender Anruf...'}
                    {activeCall.status === 'dialing' && '📱 Wähle...'}
                    {activeCall.status === 'connected' && '🟢 Verbunden'}
                  </p>
                  {lookupResult?.found && (
                    <div className="mt-2">
                      <Badge className="bg-green-100 text-green-700">
                        {lookupResult.contact ? 
                          `${lookupResult.contact.first_name} ${lookupResult.contact.last_name}` :
                          lookupResult.organization?.name
                        }
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center gap-4">
                  {activeCall.status === 'ringing' && (
                    <>
                      <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={acceptCall}>
                        <Phone className="w-5 h-5 mr-2" />
                        Annehmen
                      </Button>
                      <Button size="lg" variant="destructive" onClick={endCall}>
                        <X className="w-5 h-5 mr-2" />
                        Ablehnen
                      </Button>
                    </>
                  )}
                  {(activeCall.status === 'connected' || activeCall.status === 'dialing') && (
                    <Button size="lg" variant="destructive" onClick={endCall}>
                      <Phone className="w-5 h-5 mr-2" />
                      Auflegen
                    </Button>
                  )}
                </div>
                
                {activeCall.status === 'connected' && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* Live Transcription Panel */}
                    <LiveTranscriptionPanel 
                      callId={activeCall.call_id} 
                      isActive={activeCall.status === 'connected'}
                    />
                    
                    <div>
                      <Label>Notizen zum Anruf</Label>
                      <Textarea 
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Notizen während des Gesprächs..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createTicketFromCall} disabled={!lookupResult?.organization?.id}>
                        <Ticket className="w-4 h-4 mr-2" />
                        Ticket aus Anruf erstellen
                      </Button>
                      <Button variant="outline" onClick={() => setShowLinkTicket(true)}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Mit Ticket verknüpfen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input 
                    value={dialNumber}
                    onChange={(e) => setDialNumber(e.target.value)}
                    placeholder="+49 176 12345678"
                    className="text-xl h-12"
                    onKeyDown={(e) => e.key === 'Enter' && makeOutboundCall()}
                  />
                  <Button size="lg" onClick={makeOutboundCall} className="bg-green-600 hover:bg-green-700">
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => lookupNumber(dialNumber)}>
                    <Search className="w-5 h-5" />
                  </Button>
                </div>
                
                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map(key => (
                    <Button 
                      key={key}
                      variant="outline" 
                      className="h-14 text-xl"
                      onClick={() => setDialNumber(d => d + key)}
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Caller Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Anrufer-Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lookupResult ? (
              lookupResult.found ? (
                <div className="space-y-4">
                  {lookupResult.contact && (
                    <div>
                      <h3 className="font-semibold">{lookupResult.contact.first_name} {lookupResult.contact.last_name}</h3>
                      <p className="text-sm text-muted-foreground">{lookupResult.contact.position}</p>
                      <p className="text-sm">{lookupResult.contact.email}</p>
                      <p className="text-sm">{lookupResult.contact.phone}</p>
                    </div>
                  )}
                  {lookupResult.organization && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">{lookupResult.organization.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{lookupResult.organization.phone}</p>
                    </div>
                  )}
                  {lookupResult.recent_tickets?.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="font-medium mb-2">Letzte Tickets</h4>
                      {lookupResult.recent_tickets.slice(0,3).map(ticket => (
                        <div key={ticket.id} className="text-sm py-1 border-b last:border-0">
                          <span className="font-mono">#{ticket.ticket_number}</span>
                          <span className="ml-2 truncate">{ticket.subject}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                  <p className="font-medium">Unbekannte Nummer</p>
                  <p className="text-sm text-muted-foreground">{lookupResult.phone_number}</p>
                  <Button className="mt-4" size="sm" onClick={() => setShowCreateContact(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Kontakt anlegen
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nummer eingeben oder Anruf entgegennehmen</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Anrufverlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : callHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Noch keine Anrufe protokolliert</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callHistory.map(call => (
                  <TableRow key={call.id}>
                    <TableCell>{new Date(call.started_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {call.direction === 'inbound' ? '📞 Eingehend' : '📱 Ausgehend'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{call.phone_number}</TableCell>
                    <TableCell>
                      {call.contact ? `${call.contact.first_name} ${call.contact.last_name}` : 
                       call.organization?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {call.duration_seconds ? 
                        `${Math.floor(call.duration_seconds/60)}:${String(call.duration_seconds%60).padStart(2,'0')}` :
                        '-'
                      }
                    </TableCell>
                    <TableCell>
                      {call.user ? `${call.user.first_name} ${call.user.last_name}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Simulate Call Dialog */}
      <Dialog open={showSimulator} onOpenChange={setShowSimulator}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eingehenden Anruf simulieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Telefonnummer des Anrufers</Label>
              <Input 
                value={simulateNumber}
                onChange={(e) => setSimulateNumber(e.target.value)}
                placeholder="+49 176 21911217"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tipp: +49 176 21911217 ist Max Mustermann (Testkontakt)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSimulator(false)}>Abbrechen</Button>
            <Button onClick={simulateIncomingCall} className="bg-green-600 hover:bg-green-700">
              <Phone className="w-4 h-4 mr-2" />
              Anruf simulieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Contact from Call Dialog - EXTENDED CRM */}
      <Dialog open={showCreateContact} onOpenChange={setShowCreateContact}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kontakt aus Anruf erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen vollständigen CRM-Kontakt für {lookupResult?.phone_number || activeCall?.phone_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Anrede</Label>
                <Select value={newContact.salutation || ''} onValueChange={(v) => setNewContact(c => ({ ...c, salutation: v }))}>
                  <SelectTrigger><SelectValue placeholder="Anrede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Herr">Herr</SelectItem>
                    <SelectItem value="Frau">Frau</SelectItem>
                    <SelectItem value="Divers">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vorname *</Label>
                <Input 
                  value={newContact.first_name}
                  onChange={(e) => setNewContact(c => ({ ...c, first_name: e.target.value }))}
                  placeholder="Max"
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input 
                  value={newContact.last_name}
                  onChange={(e) => setNewContact(c => ({ ...c, last_name: e.target.value }))}
                  placeholder="Mustermann"
                />
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-Mail</Label>
                <Input 
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact(c => ({ ...c, email: e.target.value }))}
                  placeholder="max@example.de"
                />
              </div>
              <div>
                <Label>Position</Label>
                <Input 
                  value={newContact.position}
                  onChange={(e) => setNewContact(c => ({ ...c, position: e.target.value }))}
                  placeholder="Geschäftsführer"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefon (aus Anruf)</Label>
                <Input 
                  value={lookupResult?.phone_number || activeCall?.phone_number || ''}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div>
                <Label>Mobiltelefon</Label>
                <Input 
                  value={newContact.mobile}
                  onChange={(e) => setNewContact(c => ({ ...c, mobile: e.target.value }))}
                  placeholder="+49 171 1234567"
                />
              </div>
            </div>
            
            <Separator />
            
            {/* CRM Classification */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kundentyp *</Label>
                <Select value={newContact.customer_type} onValueChange={(v) => setNewContact(c => ({ ...c, customer_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">🏠 Privatkunde</SelectItem>
                    <SelectItem value="business">🏢 Geschäftskunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={newContact.status} onValueChange={(v) => setNewContact(c => ({ ...c, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">🎯 Interessent (Lead)</SelectItem>
                    <SelectItem value="new_customer">✨ Neukunde</SelectItem>
                    <SelectItem value="existing_customer">✅ Bestandskunde</SelectItem>
                    <SelectItem value="lost">❌ Verloren</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Call Outcome */}
            <div>
              <Label>Anrufergebnis</Label>
              <Select value={newContact.call_outcome || ''} onValueChange={(v) => setNewContact(c => ({ ...c, call_outcome: v }))}>
                <SelectTrigger><SelectValue placeholder="Ergebnis auswählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interested">👍 Interessiert</SelectItem>
                  <SelectItem value="offer_requested">📋 Angebot angefordert</SelectItem>
                  <SelectItem value="complaint">⚠️ Beschwerde</SelectItem>
                  <SelectItem value="callback_requested">📞 Rückruf gewünscht</SelectItem>
                  <SelectItem value="attempted_to_reach">📵 Nicht erreicht</SelectItem>
                  <SelectItem value="resolved">✅ Erledigt</SelectItem>
                  <SelectItem value="other">📝 Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            {/* Organization */}
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select value={newContact.organization_id || 'new'} onValueChange={(v) => setNewContact(c => ({ ...c, organization_id: v === 'new' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Organisation wählen oder neu erstellen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">➕ Neue Organisation erstellen</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!newContact.organization_id && (
                <Input 
                  value={newContact.new_organization_name}
                  onChange={(e) => setNewContact(c => ({ ...c, new_organization_name: e.target.value }))}
                  placeholder="Name der neuen Organisation"
                  className="mt-2"
                />
              )}
            </div>
            
            {/* Notes */}
            <div>
              <Label>Notizen</Label>
              <Textarea 
                value={newContact.notes}
                onChange={(e) => setNewContact(c => ({ ...c, notes: e.target.value }))}
                placeholder="Zusätzliche Notizen zum Kontakt oder Anruf..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateContact(false)}>Abbrechen</Button>
            <Button onClick={async () => {
              if (!newContact.first_name) {
                toast.error('Bitte Vorname eingeben')
                return
              }
              try {
                const result = await api.fetch('/contacts/from-call', {
                  method: 'POST',
                  body: JSON.stringify({
                    call_id: activeCall?.call_id,
                    phone_number: lookupResult?.phone_number || activeCall?.phone_number,
                    first_name: newContact.first_name,
                    last_name: newContact.last_name,
                    email: newContact.email,
                    organization_id: newContact.organization_id || null,
                    customer_type: newContact.customer_type,
                    status: newContact.status,
                    call_outcome: newContact.call_outcome,
                    notes: newContact.notes,
                    position: newContact.position,
                    mobile: newContact.mobile,
                    salutation: newContact.salutation,
                    new_organization_name: newContact.new_organization_name,
                    new_organization_type: newContact.customer_type,
                    assigned_owner_id: currentUser?.id,
                  })
                })
                if (result.contact) {
                  setLookupResult({
                    found: true,
                    contact: result.contact,
                    organization: result.contact.organization,
                    phone_number: result.contact.phone,
                  })
                  toast.success(`Kontakt ${result.contact.first_name} ${result.contact.last_name} erstellt`)
                  setShowCreateContact(false)
                  setNewContact({ 
                    first_name: '', last_name: '', email: '', organization_id: '',
                    customer_type: 'business', status: 'lead', call_outcome: '', notes: '',
                    position: '', mobile: '', new_organization_name: ''
                  })
                  loadCallHistory()
                }
              } catch (e) {
                toast.error('Fehler beim Erstellen des Kontakts')
              }
            }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Kontakt erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// AI DAILY ASSISTANT PAGE
// ============================================

function DailyAssistantPage({ currentUser }) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [urgentItems, setUrgentItems] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [draftReplies, setDraftReplies] = useState([])
  const [stats, setStats] = useState({})
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  
  useEffect(() => {
    loadDailyBriefing()
  }, [currentUser])
  
  const loadDailyBriefing = async () => {
    setLoading(true)
    try {
      // Load various data for AI analysis
      const [tickets, timeEntries, statsData] = await Promise.all([
        api.getTickets({ status: 'open,in_progress', limit: 50 }),
        api.fetch('/time-entries?limit=10'),
        api.fetch('/stats'),
      ])
      
      setStats(statsData)
      
      // Identify urgent items
      const urgent = tickets.filter(t => 
        t.priority === 'critical' || t.priority === 'high' ||
        (t.sla_response_due && new Date(t.sla_response_due) < new Date(Date.now() + 2*60*60*1000))
      ).slice(0, 5)
      setUrgentItems(urgent)
      
      // Generate AI suggestions
      const aiSuggestions = [
        { type: 'follow_up', text: `${tickets.filter(t => t.status === 'pending').length} Tickets warten auf Kundenrückmeldung`, action: 'Tickets prüfen', link: '/tickets?status=pending' },
        { type: 'workload', text: `${tickets.filter(t => !t.assignee_id).length} Tickets sind nicht zugewiesen`, action: 'Zuweisung prüfen', link: '/tickets?unassigned=true' },
        { type: 'sla', text: urgent.filter(t => t.sla_response_due).length > 0 ? `${urgent.filter(t => t.sla_response_due).length} SLA-kritische Tickets` : 'Alle SLAs im grünen Bereich', action: urgent.length > 0 ? 'Priorisieren' : null, link: '/tickets?priority=critical,high' },
      ]
      setSuggestions(aiSuggestions)
      
      // Generate summary
      const summaryText = `
Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}.

**Ticket-Übersicht:**
- ${statsData.tickets?.open || 0} offene Tickets
- ${statsData.tickets?.in_progress || 0} in Bearbeitung
- ${urgent.length} mit hoher Priorität

**Dringende Aufgaben:**
${urgent.length > 0 ? urgent.map(t => `- #${t.ticket_number}: ${t.subject}`).join('\n') : '- Keine dringenden Aufgaben'}

**Empfehlung:** ${urgent.length > 0 ? 'Beginne mit den kritischen Tickets' : 'Arbeite die offenen Tickets nach Priorität ab'}
      `.trim()
      setSummary(summaryText)
      
      // Draft replies for pending tickets
      const pendingTickets = tickets.filter(t => t.status === 'pending').slice(0, 3)
      const drafts = pendingTickets.map(t => ({
        ticket: t,
        draft: `Guten Tag,\n\nvielen Dank für Ihre Geduld. Bezüglich Ihrer Anfrage "${t.subject}" möchten wir nachfragen, ob Sie noch weitere Informationen benötigen.\n\nMit freundlichen Grüßen,\n${currentUser?.first_name || 'Ihr'} ${currentUser?.last_name || 'IT-Team'}`
      }))
      setDraftReplies(drafts)
      
    } catch (e) {
      console.error('Error loading briefing:', e)
    }
    setLoading(false)
  }
  
  const runAIAnalysis = async () => {
    setAnalyzing(true)
    try {
      const result = await api.fetch('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUser?.id,
          filters: {}
        })
      })
      setAnalysisResult(result)
      toast.success('KI-Analyse abgeschlossen')
    } catch (e) {
      console.error('AI Analysis error:', e)
      toast.error('KI-Analyse fehlgeschlagen')
    }
    setAnalyzing(false)
  }
  
  const handleQuickAssign = async (ticketId) => {
    try {
      const result = await api.fetch(`/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
          assignee_id: currentUser?.id,
          user_id: currentUser?.id
        })
      })
      if (result.success) {
        toast.success(result.message || 'Ticket zugewiesen')
        runAIAnalysis() // Refresh analysis
      }
    } catch (e) {
      toast.error('Zuweisung fehlgeschlagen')
    }
  }
  
  const handleQuickStatus = async (ticketId, newStatus) => {
    try {
      const result = await api.fetch(`/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          user_id: currentUser?.id
        })
      })
      if (result.success) {
        toast.success(result.message || 'Status geändert')
        loadDailyBriefing() // Refresh
        runAIAnalysis()
      }
    } catch (e) {
      toast.error('Status-Änderung fehlgeschlagen')
    }
  }
  
  const handleAddNote = async (ticketId, note) => {
    try {
      const result = await api.fetch(`/tickets/${ticketId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          content: note,
          user_id: currentUser?.id,
          is_internal: true
        })
      })
      if (result.success) {
        toast.success('Notiz hinzugefügt')
      }
    } catch (e) {
      toast.error('Notiz fehlgeschlagen')
    }
  }
  
  const generateAISummary = async () => {
    setLoading(true)
    try {
      // Try to get AI-generated summary
      const result = await api.fetch('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({
          content: `Erstelle eine Zusammenfassung für den Arbeitstag. Offene Tickets: ${stats.tickets?.open || 0}, In Bearbeitung: ${stats.tickets?.in_progress || 0}, Dringende Items: ${urgentItems.length}`,
          type: 'daily_briefing'
        })
      })
      if (result.content) {
        setSummary(result.content)
        toast.success('KI-Zusammenfassung generiert')
      }
    } catch (e) {
      toast.error('KI-Zusammenfassung nicht verfügbar')
    }
    setLoading(false)
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" />
            Guten Morgen, {currentUser?.first_name || 'Kollege'}!
          </h1>
          <p className="text-muted-foreground">
            Dein KI-Assistent für den Tag - {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAIAnalysis} disabled={analyzing} variant="default">
            {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
            Analyse starten
          </Button>
          <Button onClick={generateAISummary} disabled={loading} variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            KI-Zusammenfassung
          </Button>
          <Button onClick={loadDailyBriefing} variant="ghost">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* AI Analysis Result Panel */}
      {analysisResult && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Brain className="w-5 h-5" />
              KI-Analyse Ergebnis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Offene Tickets</p>
                <p className="text-2xl font-bold">{analysisResult.summary?.total_open || 0}</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Kritisch</p>
                <p className="text-2xl font-bold text-red-600">{analysisResult.summary?.critical || 0}</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">SLA-gefährdet</p>
                <p className="text-2xl font-bold text-orange-600">{analysisResult.summary?.sla_at_risk || 0}</p>
              </div>
            </div>
            
            {analysisResult.ai_recommendation && (
              <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-purple-500">
                <p className="text-sm font-medium text-purple-700 mb-1">KI-Empfehlung:</p>
                <p className="text-sm">{analysisResult.ai_recommendation}</p>
              </div>
            )}
            
            {analysisResult.priorities?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Prioritäten:</p>
                {analysisResult.priorities.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-white rounded">
                    <Badge className="bg-red-100 text-red-700">P{p.priority}</Badge>
                    <span className="flex-1 text-sm">{p.message}</span>
                    <Button size="sm" variant="outline" onClick={() => toast.info(`Aktion: ${p.action}`)}>{p.action}</Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Clickable Critical Tickets */}
            {analysisResult.ticket_details?.critical?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Kritische Tickets (klickbar)
                </p>
                <div className="space-y-2">
                  {analysisResult.ticket_details.critical.map((ticket) => (
                    <div key={ticket.id} className="bg-white p-3 rounded-lg border-l-4 border-red-500 hover:bg-red-50 cursor-pointer transition-colors" onClick={() => {
                      // Navigate to ticket
                      window.dispatchEvent(new CustomEvent('navigate-ticket', { detail: ticket.id }))
                      toast.success(`Öffne Ticket #${ticket.number}`)
                    }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">#{ticket.number}: {ticket.subject}</span>
                          {ticket.organization && <span className="text-xs text-muted-foreground ml-2">({ticket.organization})</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={(e) => {
                            e.stopPropagation()
                            handleQuickAssign(ticket.id)
                          }}>
                            <UserPlus className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => {
                            e.stopPropagation()
                            handleQuickStatus(ticket.id, 'in_progress')
                          }}>
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysisResult.recommended_actions?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Empfohlene Aktionen:</p>
                {analysisResult.recommended_actions.map((action, i) => (
                  <Button key={i} variant="outline" size="sm" className="mr-2">
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-muted-foreground">Analysiere deinen Arbeitstag...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Offene Tickets</p>
                    <p className="text-3xl font-bold text-blue-700">{stats.tickets?.open || 0}</p>
                  </div>
                  <Ticket className="w-10 h-10 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600">In Bearbeitung</p>
                    <p className="text-3xl font-bold text-yellow-700">{stats.tickets?.in_progress || 0}</p>
                  </div>
                  <Clock className="w-10 h-10 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Dringend</p>
                    <p className="text-3xl font-bold text-red-700">{urgentItems.length}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Gelöst (heute)</p>
                    <p className="text-3xl font-bold text-green-700">{stats.tickets?.closed || 0}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Tagesbriefing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap bg-slate-50 p-4 rounded-lg text-sm font-sans">
                    {summary}
                  </pre>
                </div>
              </CardContent>
            </Card>
            
            {/* Urgent Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Dringende Aufgaben
                </CardTitle>
              </CardHeader>
              <CardContent>
                {urgentItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>Keine dringenden Aufgaben!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {urgentItems.map(ticket => (
                      <div key={ticket.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">#{ticket.ticket_number} - {ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">{ticket.organizations?.name}</p>
                        </div>
                        <Button size="sm" variant="outline">Öffnen</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* AI Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-600" />
                  KI-Empfehlungen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm">{s.text}</p>
                      {s.action && <Button size="sm" variant="outline">{s.action}</Button>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Draft Replies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  Vorgeschlagene Antworten
                </CardTitle>
              </CardHeader>
              <CardContent>
                {draftReplies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Keine ausstehenden Antworten</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {draftReplies.map((item, i) => (
                      <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium">#{item.ticket.ticket_number} - {item.ticket.subject}</p>
                          <Badge variant="outline">Entwurf</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{item.draft}</p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm">Senden</Button>
                          <Button size="sm" variant="outline">Bearbeiten</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// CHATWOOT PAGE (Embedded Omnichannel)
// ============================================

function ChatwootPage({ currentUser }) {
  const [chatwootUrl, setChatwootUrl] = useState('')
  const [ssoUrl, setSsoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  
  useEffect(() => {
    loadChatwootSettings()
  }, [currentUser])
  
  const loadChatwootSettings = async () => {
    setLoading(true)
    try {
      // Get Chatwoot settings
      const settings = await api.getSettings()
      const url = settings.find(s => s.key === 'chatwoot_api_url')?.value
      const enabled = settings.find(s => s.key === 'chatwoot_enabled')?.value
      
      if (url && enabled === 'true') {
        setChatwootUrl(url)
        setConfigured(true)
        
        // Get SSO URL if user is logged in
        if (currentUser?.id) {
          try {
            const ssoResult = await api.fetch(`/chatwoot/sso?user_id=${currentUser.id}`)
            if (ssoResult.embed_url) {
              setSsoUrl(ssoResult.embed_url)
            }
          } catch (e) {
            // SSO not configured, use direct URL
            setSsoUrl(`${url}/app/accounts/1/dashboard`)
          }
        }
      }
    } catch (error) {
      console.error('Chatwoot settings error:', error)
    }
    setLoading(false)
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }
  
  if (!configured) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <MessageSquare className="h-8 w-8 text-orange-600" />
              </div>
              <div>
                <CardTitle>Chatwoot Integration</CardTitle>
                <CardDescription>Omnichannel-Kommunikation (WhatsApp, Chat, E-Mail)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Nicht konfiguriert</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Chatwoot ist noch nicht eingerichtet. Bitte konfigurieren Sie die Verbindung in den Einstellungen.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">So richten Sie Chatwoot ein:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                <li>Gehen Sie zu <strong>Einstellungen → Integrationen</strong></li>
                <li>Aktivieren Sie <strong>Chatwoot</strong></li>
                <li>Tragen Sie Ihre Chatwoot-URL, Account-ID und API-Token ein</li>
                <li>Speichern Sie die Einstellungen</li>
              </ol>
            </div>
            <Button onClick={() => window.location.hash = '#settings'} className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Zu den Einstellungen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-medium">Chatwoot - Omnichannel Inbox</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white hover:bg-orange-600" onClick={() => window.open(chatwootUrl, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-1" />
            In neuem Tab öffnen
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-orange-600" onClick={loadChatwootSettings}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <iframe
          src={ssoUrl || `${chatwootUrl}/app/accounts/1/dashboard`}
          className="w-full h-full border-0"
          title="Chatwoot"
          allow="microphone; camera; clipboard-write"
        />
      </div>
    </div>
  )
}

// ============================================
// CRM - CONTACTS PAGE
// ============================================

function ContactsPage({ currentUser }) {
  const [contacts, setContacts] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState(null)
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [contactsData, orgsData] = await Promise.all([
        api.getContacts(),
        api.getOrganizations()
      ])
      setContacts(contactsData || [])
      setOrganizations(orgsData || [])
    } catch (error) {
      toast.error('Fehler beim Laden')
    }
    setLoading(false)
  }
  
  const handleCreate = async (data) => {
    try {
      await api.createContact(data)
      toast.success('Kontakt erstellt')
      setShowCreateDialog(false)
      loadData()
    } catch (error) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  const handleUpdate = async (data) => {
    try {
      await api.updateContact(editingContact.id, data)
      toast.success('Kontakt aktualisiert')
      setEditingContact(null)
      loadData()
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Kontakt wirklich löschen?')) return
    try {
      await api.deleteContact(id)
      toast.success('Kontakt gelöscht')
      loadData()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const filteredContacts = contacts.filter(c => 
    `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Kontakte</h1>
          <p className="text-muted-foreground">CRM-Kontaktverwaltung</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Neuer Kontakt</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neuer Kontakt</DialogTitle></DialogHeader>
            <CRMContactForm organizations={organizations} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Suchen..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Lead-Status</TableHead>
                <TableHead className="w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedContact(contact)}>
                  <TableCell className="font-medium">{contact.first_name} {contact.last_name}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>{organizations.find(o => o.id === contact.organization_id)?.name || '-'}</TableCell>
                  <TableCell>{contact.position || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      contact.lead_status === 'qualified' ? 'bg-green-100 text-green-700' :
                      contact.lead_status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                      contact.lead_status === 'customer' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100'
                    }>
                      {contact.lead_status || 'Neu'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingContact(contact)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Kontakt bearbeiten</DialogTitle></DialogHeader>
          {editingContact && (
            <CRMContactForm 
              contact={editingContact}
              organizations={organizations} 
              onSubmit={handleUpdate} 
              onCancel={() => setEditingContact(null)}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Contact Detail Sidebar */}
      {selectedContact && (
        <ContactDetailPanel 
          contact={selectedContact}
          organizations={organizations}
          onClose={() => setSelectedContact(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  )
}

function CRMContactForm({ contact, organizations = [], onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    organization_id: contact?.organization_id || '',
    position: contact?.position || '',
    department: contact?.department || '',
    lead_status: contact?.lead_status || 'new',
    source: contact?.source || '',
    notes: contact?.notes || '',
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.first_name || !formData.last_name) {
      toast.error('Vor- und Nachname sind erforderlich')
      return
    }
    onSubmit({ ...formData, organization_id: formData.organization_id || null })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Vorname *</Label><Input value={formData.first_name} onChange={(e) => setFormData(f => ({ ...f, first_name: e.target.value }))} /></div>
        <div><Label>Nachname *</Label><Input value={formData.last_name} onChange={(e) => setFormData(f => ({ ...f, last_name: e.target.value }))} /></div>
      </div>
      <div><Label>E-Mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><Label>Mobil</Label><Input value={formData.mobile} onChange={(e) => setFormData(f => ({ ...f, mobile: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unternehmen</Label>
          <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Unternehmen</SelectItem>
              {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Position</Label><Input value={formData.position} onChange={(e) => setFormData(f => ({ ...f, position: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lead-Status</Label>
          <Select value={formData.lead_status} onValueChange={(v) => setFormData(f => ({ ...f, lead_status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Neu</SelectItem>
              <SelectItem value="prospect">Interessent</SelectItem>
              <SelectItem value="qualified">Qualifiziert</SelectItem>
              <SelectItem value="customer">Kunde</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quelle</Label>
          <Select value={formData.source || 'other'} onValueChange={(v) => setFormData(f => ({ ...f, source: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="referral">Empfehlung</SelectItem>
              <SelectItem value="event">Veranstaltung</SelectItem>
              <SelectItem value="cold_call">Kaltakquise</SelectItem>
              <SelectItem value="social">Social Media</SelectItem>
              <SelectItem value="other">Sonstige</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notizen</Label><Textarea value={formData.notes} onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </form>
  )
}

function ContactDetailPanel({ contact, organizations, onClose, onUpdate }) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">{contact.first_name} {contact.last_name}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><Label className="text-slate-500">E-Mail</Label><p>{contact.email || '-'}</p></div>
          <div><Label className="text-slate-500">Telefon</Label><p>{contact.phone || '-'}</p></div>
          <div><Label className="text-slate-500">Mobil</Label><p>{contact.mobile || '-'}</p></div>
          <div><Label className="text-slate-500">Position</Label><p>{contact.position || '-'}</p></div>
        </div>
        <div>
          <Label className="text-slate-500">Unternehmen</Label>
          <p>{organizations.find(o => o.id === contact.organization_id)?.name || '-'}</p>
        </div>
        {contact.notes && (
          <div>
            <Label className="text-slate-500">Notizen</Label>
            <p className="whitespace-pre-wrap text-sm">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// CRM - COMPANIES PAGE (Uses Organizations)
// ============================================

function CompaniesPage({ currentUser }) {
  // Reuse OrganizationsPage but with CRM-focused UI
  return <OrganizationsPage />
}

// ============================================
// CRM - DEALS/PIPELINE PAGE
// ============================================

function DealsPage({ currentUser }) {
  const [deals, setDeals] = useState([])
  const [pipelines, setPipelines] = useState([
    { id: 'default', name: 'Vertrieb', stages: [
      { id: 'lead', name: 'Lead', color: 'bg-slate-100', probability: 10 },
      { id: 'qualified', name: 'Qualifiziert', color: 'bg-blue-100', probability: 25 },
      { id: 'proposal', name: 'Angebot', color: 'bg-yellow-100', probability: 50 },
      { id: 'negotiation', name: 'Verhandlung', color: 'bg-orange-100', probability: 75 },
      { id: 'won', name: 'Gewonnen', color: 'bg-green-100', probability: 100 },
      { id: 'lost', name: 'Verloren', color: 'bg-red-100', probability: 0 },
    ]},
    { id: 'services', name: 'IT-Services', stages: [
      { id: 'inquiry', name: 'Anfrage', color: 'bg-slate-100', probability: 10 },
      { id: 'assessment', name: 'Analyse', color: 'bg-blue-100', probability: 30 },
      { id: 'proposal', name: 'Angebot', color: 'bg-yellow-100', probability: 60 },
      { id: 'contract', name: 'Vertrag', color: 'bg-purple-100', probability: 90 },
      { id: 'won', name: 'Gewonnen', color: 'bg-green-100', probability: 100 },
      { id: 'lost', name: 'Verloren', color: 'bg-red-100', probability: 0 },
    ]}
  ])
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState('default')
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [editingDeal, setEditingDeal] = useState(null)
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'list' | 'forecast'
  const [filter, setFilter] = useState({ search: '', owner: 'all' })
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [dealsData, contactsData, orgsData] = await Promise.all([
        api.fetch('/deals').catch(() => []),
        api.getContacts(),
        api.getOrganizations()
      ])
      setDeals(Array.isArray(dealsData) ? dealsData : [])
      setContacts(contactsData || [])
      setOrganizations(orgsData || [])
    } catch (error) {
      console.error('Load error:', error)
    }
    setLoading(false)
  }
  
  const handleCreateDeal = async (data) => {
    try {
      await api.fetch('/deals', { method: 'POST', body: JSON.stringify({ ...data, owner_id: currentUser?.id }) })
      toast.success('Deal erstellt')
      setShowCreateDialog(false)
      loadData()
    } catch (error) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  const handleUpdateDeal = async (data) => {
    try {
      await api.fetch(`/deals/${editingDeal.id}`, { method: 'PUT', body: JSON.stringify(data) })
      toast.success('Deal aktualisiert')
      setEditingDeal(null)
      setSelectedDeal(null)
      loadData()
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }
  
  const handleMoveDeal = async (dealId, newStage) => {
    const stage = currentPipeline?.stages.find(s => s.id === newStage)
    try {
      await api.fetch(`/deals/${dealId}`, { 
        method: 'PUT', 
        body: JSON.stringify({ 
          stage: newStage,
          probability: stage?.probability || 50,
          won_at: newStage === 'won' ? new Date().toISOString() : null,
          lost_at: newStage === 'lost' ? new Date().toISOString() : null,
        }) 
      })
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
      if (newStage === 'won') toast.success('🎉 Deal gewonnen!')
      else if (newStage === 'lost') toast.info('Deal als verloren markiert')
      else toast.success('Deal verschoben')
    } catch (error) {
      toast.error('Fehler beim Verschieben')
    }
  }
  
  const handleDeleteDeal = async (dealId) => {
    if (!confirm('Deal wirklich löschen?')) return
    try {
      await api.fetch(`/deals/${dealId}`, { method: 'DELETE' })
      toast.success('Deal gelöscht')
      setSelectedDeal(null)
      loadData()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const currentPipeline = pipelines.find(p => p.id === selectedPipeline)
  
  // Filter deals
  const filteredDeals = deals.filter(d => {
    if (filter.search && !d.name?.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.owner !== 'all' && d.owner_id !== filter.owner) return false
    return true
  })
  
  // Calculate totals per stage
  const stageTotals = currentPipeline?.stages.reduce((acc, stage) => {
    const stageDeals = filteredDeals.filter(d => d.stage === stage.id)
    acc[stage.id] = {
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      weighted: stageDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || stage.probability) / 100), 0)
    }
    return acc
  }, {}) || {}
  
  // Overall statistics
  const totalStats = {
    openDeals: filteredDeals.filter(d => !['won', 'lost'].includes(d.stage)).length,
    openValue: filteredDeals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((sum, d) => sum + (d.value || 0), 0),
    wonDeals: filteredDeals.filter(d => d.stage === 'won').length,
    wonValue: filteredDeals.filter(d => d.stage === 'won').reduce((sum, d) => sum + (d.value || 0), 0),
    lostDeals: filteredDeals.filter(d => d.stage === 'lost').length,
    lostValue: filteredDeals.filter(d => d.stage === 'lost').reduce((sum, d) => sum + (d.value || 0), 0),
    weightedPipeline: Object.values(stageTotals).reduce((sum, s) => sum + (s.weighted || 0), 0),
  }
  
  const winRate = totalStats.wonDeals + totalStats.lostDeals > 0 
    ? Math.round((totalStats.wonDeals / (totalStats.wonDeals + totalStats.lostDeals)) * 100) 
    : 0
  
  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  return (
    <div className="h-full flex flex-col p-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Deals & Pipeline</h1>
          <p className="text-muted-foreground">HubSpot-ähnliches CRM mit Vertriebspipeline</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>
              <KanbanSquare className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <LayoutDashboard className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'forecast' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('forecast')}>
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Neuer Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Neuer Deal</DialogTitle></DialogHeader>
              <DealForm 
                contacts={contacts}
                organizations={organizations}
                stages={currentPipeline?.stages || []}
                onSubmit={handleCreateDeal}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-600">Offene Deals</p>
            <p className="text-2xl font-bold text-blue-700">{totalStats.openDeals}</p>
            <p className="text-sm text-blue-600">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.openValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-purple-600">Gewichtete Pipeline</p>
            <p className="text-2xl font-bold text-purple-700">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.weightedPipeline)}</p>
            <p className="text-sm text-purple-600">Erwarteter Umsatz</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-green-600">Gewonnen</p>
            <p className="text-2xl font-bold text-green-700">{totalStats.wonDeals}</p>
            <p className="text-sm text-green-600">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.wonValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-red-600">Verloren</p>
            <p className="text-2xl font-bold text-red-700">{totalStats.lostDeals}</p>
            <p className="text-sm text-red-600">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.lostValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-600">Win-Rate</p>
            <p className="text-2xl font-bold text-yellow-700">{winRate}%</p>
            <p className="text-sm text-yellow-600">Abschlussquote</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filter Bar */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-10"
            placeholder="Deal suchen..."
            value={filter.search}
            onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>
      
      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full min-w-max pb-4">
            {currentPipeline?.stages.map((stage) => (
              <div 
                key={stage.id}
                className={`w-72 flex flex-col rounded-lg ${stage.color} border`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const dealId = e.dataTransfer.getData('dealId')
                  if (dealId) handleMoveDeal(dealId, stage.id)
                }}
              >
                <div className="p-3 border-b bg-white/50 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge variant="secondary">{stageTotals[stage.id]?.count || 0}</Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-1">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stageTotals[stage.id]?.value || 0)}
                  </p>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-400px)]">
                  {filteredDeals.filter(d => d.stage === stage.id).map((deal) => {
                    const contact = contacts.find(c => c.id === deal.contact_id)
                    const org = organizations.find(o => o.id === deal.organization_id)
                    return (
                      <Card 
                        key={deal.id}
                        className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-all bg-white"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('dealId', deal.id)}
                        onClick={() => setSelectedDeal(deal)}
                      >
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm line-clamp-1">{deal.name}</h4>
                          {org && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {org.name}
                            </p>
                          )}
                          {contact && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {contact.first_name} {contact.last_name}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3 pt-2 border-t">
                            <span className="text-sm font-bold text-green-600">
                              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(deal.value || 0)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{deal.probability || stage.probability}%</span>
                              {deal.expected_close_date && (
                                <span className="text-xs text-slate-500">
                                  {new Date(deal.expected_close_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {filteredDeals.filter(d => d.stage === stage.id).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Keine Deals
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* List View */}
      {viewMode === 'list' && (
        <Card className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Wert</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Wahrsch.</TableHead>
                <TableHead>Abschluss</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.filter(d => !['won', 'lost'].includes(d.stage)).map(deal => {
                const contact = contacts.find(c => c.id === deal.contact_id)
                const org = organizations.find(o => o.id === deal.organization_id)
                const stage = currentPipeline?.stages.find(s => s.id === deal.stage)
                return (
                  <TableRow key={deal.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedDeal(deal)}>
                    <TableCell className="font-medium">{deal.name}</TableCell>
                    <TableCell>{org?.name || '-'}</TableCell>
                    <TableCell>{contact ? `${contact.first_name} ${contact.last_name}` : '-'}</TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(deal.value || 0)}
                    </TableCell>
                    <TableCell><Badge className={stage?.color}>{stage?.name}</Badge></TableCell>
                    <TableCell>{deal.probability || stage?.probability}%</TableCell>
                    <TableCell>
                      {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('de-DE') : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingDeal(deal); }}>
                        <Settings className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Forecast View */}
      {viewMode === 'forecast' && (
        <div className="flex-1 grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline nach Phase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentPipeline?.stages.filter(s => !['won', 'lost'].includes(s.id)).map(stage => {
                  const total = stageTotals[stage.id]?.value || 0
                  const maxValue = Math.max(...Object.values(stageTotals).map(s => s.value || 0)) || 1
                  const width = (total / maxValue) * 100
                  return (
                    <div key={stage.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{stage.name}</span>
                        <span className="font-medium">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total)}</span>
                      </div>
                      <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Umsatzprognose</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center p-6 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 mb-2">Gewichtete Pipeline</p>
                  <p className="text-4xl font-bold text-purple-700">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.weightedPipeline)}
                  </p>
                  <p className="text-sm text-purple-600 mt-2">Erwarteter Umsatz basierend auf Wahrscheinlichkeiten</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600">Beste-Fall</p>
                    <p className="text-2xl font-bold text-green-700">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.openValue)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-600">Konservativ</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalStats.weightedPipeline * 0.7)}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Deals mit nahem Abschluss</h4>
                  {filteredDeals
                    .filter(d => d.expected_close_date && new Date(d.expected_close_date) <= new Date(Date.now() + 30*24*60*60*1000) && !['won', 'lost'].includes(d.stage))
                    .slice(0, 5)
                    .map(deal => (
                      <div key={deal.id} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm">{deal.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-600">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(deal.value || 0)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {new Date(deal.expected_close_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                          </Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl">
          {selectedDeal && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedDeal.name}</DialogTitle>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(selectedDeal.value || 0)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingDeal(selectedDeal)}>
                      <Settings className="w-4 h-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeleteDeal(selectedDeal.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500">Phase</Label>
                    <Select value={selectedDeal.stage} onValueChange={(v) => handleMoveDeal(selectedDeal.id, v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {currentPipeline?.stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-500">Wahrscheinlichkeit</Label>
                    <p className="font-medium">{selectedDeal.probability || currentPipeline?.stages.find(s => s.id === selectedDeal.stage)?.probability}%</p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Erwarteter Abschluss</Label>
                    <p className="font-medium">
                      {selectedDeal.expected_close_date ? new Date(selectedDeal.expected_close_date).toLocaleDateString('de-DE') : 'Nicht festgelegt'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500">Unternehmen</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {organizations.find(o => o.id === selectedDeal.organization_id)?.name || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Kontakt</Label>
                    <p className="font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {(() => { const c = contacts.find(c => c.id === selectedDeal.contact_id); return c ? `${c.first_name} ${c.last_name}` : '-' })()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Quelle</Label>
                    <p className="font-medium">{selectedDeal.source || '-'}</p>
                  </div>
                </div>
              </div>
              
              {selectedDeal.notes && (
                <div className="border-t pt-4">
                  <Label className="text-slate-500">Notizen</Label>
                  <p className="mt-1 whitespace-pre-wrap">{selectedDeal.notes}</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleMoveDeal(selectedDeal.id, 'won')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Als gewonnen markieren
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => handleMoveDeal(selectedDeal.id, 'lost')}>
                    <X className="w-4 h-4 mr-2" />
                    Als verloren markieren
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Deal Dialog */}
      <Dialog open={!!editingDeal} onOpenChange={(open) => !open && setEditingDeal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Deal bearbeiten</DialogTitle></DialogHeader>
          {editingDeal && (
            <DealForm 
              deal={editingDeal}
              contacts={contacts}
              organizations={organizations}
              stages={currentPipeline?.stages || []}
              onSubmit={handleUpdateDeal}
              onCancel={() => setEditingDeal(null)}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DealForm({ contacts, organizations, stages, deal, onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    name: deal?.name || '',
    value: deal?.value || '',
    stage: deal?.stage || stages[0]?.id || 'lead',
    contact_id: deal?.contact_id || '',
    organization_id: deal?.organization_id || '',
    expected_close_date: deal?.expected_close_date?.split('T')[0] || '',
    probability: deal?.probability || 50,
    source: deal?.source || '',
    notes: deal?.notes || '',
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Name ist erforderlich')
      return
    }
    onSubmit({
      ...formData,
      value: parseFloat(formData.value) || 0,
      probability: parseInt(formData.probability) || 50,
      contact_id: formData.contact_id || null,
      organization_id: formData.organization_id || null,
    })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Deal-Name *</Label><Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="z.B. IT-Infrastruktur Musterfirma" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Wert (€)</Label><Input type="number" value={formData.value} onChange={(e) => setFormData(f => ({ ...f, value: e.target.value }))} /></div>
        <div>
          <Label>Phase</Label>
          <Select value={formData.stage} onValueChange={(v) => setFormData(f => ({ ...f, stage: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kontakt</Label>
          <Select value={formData.contact_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, contact_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Kontakt</SelectItem>
              {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unternehmen</Label>
          <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Unternehmen</SelectItem>
              {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Erwarteter Abschluss</Label><Input type="date" value={formData.expected_close_date} onChange={(e) => setFormData(f => ({ ...f, expected_close_date: e.target.value }))} /></div>
        <div>
          <Label>Wahrscheinlichkeit ({formData.probability}%)</Label>
          <Input type="range" min="0" max="100" value={formData.probability} onChange={(e) => setFormData(f => ({ ...f, probability: e.target.value }))} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </form>
  )
}

// ============================================
// RMM PAGE - Remote Monitoring & Management
// ============================================

function RMMPage({ currentUser, subPage }) {
  const [activeTab, setActiveTab] = useState(subPage?.replace('rmm-', '') || 'dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [devices, setDevices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [sessions, setSessions] = useState([])
  const [softwareCatalog, setSoftwareCatalog] = useState([])
  const [deploymentJobs, setDeploymentJobs] = useState([])
  const [enrollmentTokens, setEnrollmentTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [newToken, setNewToken] = useState({ organization_id: '', name: '', device_type: 'workstation' })
  const [newJob, setNewJob] = useState({ name: '', job_type: 'script', target_device_ids: [], script_content: '' })
  
  useEffect(() => {
    loadData()
    loadOrganizations()
  }, [])
  
  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage.replace('rmm-', '') || 'dashboard')
    }
  }, [subPage])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [dashData, devData, alertData, sessionData, catalogData, jobData, tokenData] = await Promise.all([
        api.fetch('/rmm/dashboard'),
        api.fetch('/assets?limit=100'),
        api.fetch('/rmm/alerts'),
        api.fetch('/rmm/remote-sessions?limit=20'),
        api.fetch('/rmm/software-catalog'),
        api.fetch('/rmm/deployment-jobs'),
        api.fetch('/rmm/enrollment-tokens'),
      ])
      
      setDashboard(dashData)
      setDevices(Array.isArray(devData) ? devData : devData?.data || [])
      setAlerts(Array.isArray(alertData) ? alertData : [])
      setSessions(Array.isArray(sessionData) ? sessionData : [])
      setSoftwareCatalog(Array.isArray(catalogData) ? catalogData : [])
      setDeploymentJobs(Array.isArray(jobData) ? jobData : [])
      setEnrollmentTokens(Array.isArray(tokenData) ? tokenData : [])
    } catch (e) {
      console.error('RMM load error:', e)
    }
    setLoading(false)
  }
  
  const loadOrganizations = async () => {
    try {
      const data = await api.fetch('/organizations')
      setOrganizations(Array.isArray(data) ? data : [])
    } catch (e) {}
  }
  
  const createEnrollmentToken = async () => {
    if (!newToken.organization_id) {
      toast.error('Bitte Organisation auswählen')
      return
    }
    try {
      const result = await api.fetch('/rmm/enrollment-tokens', {
        method: 'POST',
        body: JSON.stringify({
          ...newToken,
          created_by_id: currentUser?.id,
        })
      })
      if (result.id) {
        toast.success('Enrollment-Token erstellt')
        setShowTokenDialog(false)
        setNewToken({ organization_id: '', name: '', device_type: 'workstation' })
        loadData()
      }
    } catch (e) {
      toast.error('Fehler beim Erstellen des Tokens')
    }
  }
  
  const startRemoteSession = async (device) => {
    try {
      const result = await api.fetch('/rmm/remote-sessions', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: device.id,
          user_id: currentUser?.id,
          session_type: 'remote_desktop',
        })
      })
      if (result.success) {
        toast.success('Remote-Sitzung gestartet')
        if (result.connection_url) {
          window.open(result.connection_url, '_blank')
        }
        loadData()
      }
    } catch (e) {
      toast.error('Fehler beim Starten der Remote-Sitzung')
    }
  }
  
  const acknowledgeAlert = async (alertId) => {
    try {
      await api.fetch(`/rmm/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser?.id })
      })
      toast.success('Alert bestätigt')
      loadData()
    } catch (e) {
      toast.error('Fehler')
    }
  }
  
  const resolveAlert = async (alertId) => {
    try {
      await api.fetch(`/rmm/alerts/${alertId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser?.id })
      })
      toast.success('Alert gelöst')
      loadData()
    } catch (e) {
      toast.error('Fehler')
    }
  }
  
  const createDeploymentJob = async () => {
    if (!newJob.name) {
      toast.error('Bitte Name eingeben')
      return
    }
    try {
      const result = await api.fetch('/rmm/deployment-jobs', {
        method: 'POST',
        body: JSON.stringify({
          ...newJob,
          created_by_id: currentUser?.id,
        })
      })
      if (result.id) {
        toast.success('Deployment-Job erstellt')
        setShowDeployDialog(false)
        setNewJob({ name: '', job_type: 'script', target_device_ids: [], script_content: '' })
        loadData()
      }
    } catch (e) {
      toast.error('Fehler beim Erstellen des Jobs')
    }
  }
  
  const getStatusBadge = (status) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      maintenance: 'bg-yellow-500',
      active: 'bg-green-500',
      warning: 'bg-yellow-500',
      critical: 'bg-red-500',
      acknowledged: 'bg-blue-500',
      resolved: 'bg-gray-500',
    }
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Remote Monitoring & Management</h1>
          <p className="text-muted-foreground">Geräte überwachen, verwalten und warten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button onClick={() => setShowTokenDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Enrollment-Token
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Übersicht
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Geräte ({devices.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alerts ({alerts.filter(a => a.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="remote" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" /> Remote
          </TabsTrigger>
          <TabsTrigger value="deployment" className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Software
          </TabsTrigger>
        </TabsList>
        
        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Geräte</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard?.devices?.total || 0}</div>
                <div className="flex items-center gap-4 text-sm mt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {dashboard?.devices?.online || 0} Online
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {dashboard?.devices?.offline || 0} Offline
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Aktive Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{dashboard?.alerts?.total || 0}</div>
                <div className="flex items-center gap-4 text-sm mt-2">
                  <span className="text-red-600">{dashboard?.alerts?.critical || 0} Kritisch</span>
                  <span className="text-yellow-600">{dashboard?.alerts?.warning || 0} Warnung</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Remote-Sitzungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{dashboard?.active_sessions || 0}</div>
                <p className="text-sm text-muted-foreground mt-2">Aktive Verbindungen</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deployment-Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{dashboard?.pending_jobs || 0}</div>
                <p className="text-sm text-muted-foreground mt-2">Ausstehende Jobs</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Enrollment Tokens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enrollment-Tokens</CardTitle>
              <CardDescription>Tokens zur Agent-Installation auf Kundengeräten</CardDescription>
            </CardHeader>
            <CardContent>
              {enrollmentTokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Noch keine Enrollment-Tokens erstellt</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowTokenDialog(true)}>
                    Token erstellen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {enrollmentTokens.slice(0, 5).map(token => (
                    <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{token.name || 'Token'}</p>
                        <p className="text-sm font-mono text-muted-foreground">{token.token}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{token.device_type}</Badge>
                        <Badge variant={token.is_active ? 'default' : 'secondary'}>
                          {token.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => {
                          navigator.clipboard.writeText(token.token)
                          toast.success('Token kopiert')
                        }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Gerät</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Zuletzt gesehen</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Keine Geräte gefunden. Erstellen Sie einen Enrollment-Token und installieren Sie den Agent.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map(device => (
                      <TableRow key={device.id}>
                        <TableCell>
                          {getStatusBadge(device.agent_status || 'offline')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{device.name || device.hostname || 'Unbenannt'}</p>
                            <p className="text-xs text-muted-foreground">{device.ip_address || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{device.device_type || device.asset_type?.name || 'Unbekannt'}</Badge>
                        </TableCell>
                        <TableCell>{device.organization?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{device.os_type || '-'}</p>
                            <p className="text-xs text-muted-foreground">{device.os_version || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {device.last_seen ? new Date(device.last_seen).toLocaleString('de-DE') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startRemoteSession(device)} title="Remote-Verbindung">
                              <Monitor className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDevice(device)} title="Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p>Keine aktiven Alerts - alles läuft normal!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schweregrad</TableHead>
                      <TableHead>Gerät</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Meldung</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map(alert => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <Badge className={
                            alert.severity === 'critical' ? 'bg-red-500' :
                            alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                          }>
                            {alert.severity === 'critical' ? '🔴 Kritisch' : alert.severity === 'warning' ? '🟡 Warnung' : 'ℹ️ Info'}
                          </Badge>
                        </TableCell>
                        <TableCell>{alert.asset?.hostname || alert.asset_id?.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.alert_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{alert.title}</TableCell>
                        <TableCell>{new Date(alert.created_at).toLocaleString('de-DE')}</TableCell>
                        <TableCell>
                          <Badge variant={alert.status === 'active' ? 'destructive' : 'secondary'}>
                            {alert.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {alert.status === 'active' && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => resolveAlert(alert.id)}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Remote Tab */}
        <TabsContent value="remote" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Remote-Sitzungen</CardTitle>
              <CardDescription>Aktuelle und vergangene Fernwartungssitzungen</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Keine Remote-Sitzungen</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Gerät</TableHead>
                      <TableHead>Benutzer</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Gestartet</TableHead>
                      <TableHead>Dauer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map(session => (
                      <TableRow key={session.id}>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>{session.asset?.hostname || session.asset_id?.slice(0, 8)}</TableCell>
                        <TableCell>{session.user?.first_name} {session.user?.last_name}</TableCell>
                        <TableCell>{session.session_type}</TableCell>
                        <TableCell>{new Date(session.started_at).toLocaleString('de-DE')}</TableCell>
                        <TableCell>
                          {session.duration_seconds ? `${Math.round(session.duration_seconds / 60)} Min.` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Deployment Tab */}
        <TabsContent value="deployment" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Software-Katalog & Deployment</h3>
            <Button onClick={() => setShowDeployDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Job
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Software Catalog */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Software-Katalog</CardTitle>
              </CardHeader>
              <CardContent>
                {softwareCatalog.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Katalog ist leer</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {softwareCatalog.map(sw => (
                      <div key={sw.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{sw.name}</p>
                          <p className="text-xs text-muted-foreground">{sw.vendor} • {sw.current_version || '-'}</p>
                        </div>
                        <Badge variant="outline">{sw.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Deployment Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deployment-Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {deploymentJobs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Keine Jobs vorhanden</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {deploymentJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{job.name}</p>
                          <p className="text-xs text-muted-foreground">{job.job_type}</p>
                        </div>
                        <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Create Enrollment Token Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Enrollment-Token erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen Token zur Agent-Installation auf Kundengeräten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Organisation *</Label>
              <Select value={newToken.organization_id} onValueChange={(v) => setNewToken(t => ({ ...t, organization_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Organisation wählen" /></SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name / Beschreibung</Label>
              <Input 
                value={newToken.name}
                onChange={(e) => setNewToken(t => ({ ...t, name: e.target.value }))}
                placeholder="z.B. Workstations Firma ABC"
              />
            </div>
            <div className="space-y-2">
              <Label>Gerätetyp</Label>
              <Select value={newToken.device_type} onValueChange={(v) => setNewToken(t => ({ ...t, device_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workstation">🖥️ Workstation</SelectItem>
                  <SelectItem value="laptop">💻 Laptop</SelectItem>
                  <SelectItem value="server">🖧 Server</SelectItem>
                  <SelectItem value="vm">☁️ Virtuelle Maschine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenDialog(false)}>Abbrechen</Button>
            <Button onClick={createEnrollmentToken}>Token erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Deployment Job Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neuen Deployment-Job erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen Job zur Software-Installation oder Skript-Ausführung
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  value={newJob.name}
                  onChange={(e) => setNewJob(j => ({ ...j, name: e.target.value }))}
                  placeholder="z.B. Chrome installieren"
                />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select value={newJob.job_type} onValueChange={(v) => setNewJob(j => ({ ...j, job_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="install">📦 Software installieren</SelectItem>
                    <SelectItem value="uninstall">🗑️ Software deinstallieren</SelectItem>
                    <SelectItem value="update">🔄 Software aktualisieren</SelectItem>
                    <SelectItem value="script">📜 Skript ausführen</SelectItem>
                    <SelectItem value="patch">🔧 Patch anwenden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zielgeräte</Label>
              <Select value={newJob.target_device_ids[0] || ''} onValueChange={(v) => setNewJob(j => ({ ...j, target_device_ids: v ? [v] : [] }))}>
                <SelectTrigger><SelectValue placeholder="Gerät auswählen" /></SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name || device.hostname || device.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newJob.job_type === 'script' && (
              <div className="space-y-2">
                <Label>Skript (PowerShell/Bash)</Label>
                <Textarea 
                  value={newJob.script_content}
                  onChange={(e) => setNewJob(j => ({ ...j, script_content: e.target.value }))}
                  placeholder="Write-Host 'Hello World'"
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>Abbrechen</Button>
            <Button onClick={createDeploymentJob}>Job erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// REPORTS PAGE
// ============================================

function ReportsPage() {
  const [reportType, setReportType] = useState('tickets')
  const [reportData, setReportData] = useState(null)
  const [onboardingReport, setOnboardingReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  
  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateRange.from) params.start_date = dateRange.from
      if (dateRange.to) params.end_date = dateRange.to
      
      if (reportType === 'onboarding') {
        const data = await api.fetch(`/reports/onboarding?${new URLSearchParams(params)}`)
        setOnboardingReport(data)
      } else {
        // Load original reports
        params.type = reportType
        if (dateRange.from) params.from_date = dateRange.from
        if (dateRange.to) params.to_date = dateRange.to
        setReportData(await api.getReports(params))
      }
    } catch { toast.error('Fehler beim Laden des Reports') }
    finally { setLoading(false) }
  }, [reportType, dateRange])
  
  useEffect(() => { loadReport() }, [loadReport])
  
  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      await import('jspdf-autotable')
      
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Header
      doc.setFontSize(20)
      doc.setTextColor(40, 40, 40)
      doc.text('IT REX Solutions - Report', pageWidth / 2, 20, { align: 'center' })
      
      doc.setFontSize(12)
      doc.setTextColor(100)
      const reportTitle = reportType === 'tickets' ? 'Ticket-Report' : 
                          reportType === 'time' ? 'Zeiterfassungs-Report' :
                          reportType === 'sla' ? 'SLA-Report' : 'Asset-Report'
      doc.text(reportTitle, pageWidth / 2, 28, { align: 'center' })
      
      // Date range
      doc.setFontSize(10)
      const dateStr = dateRange.from && dateRange.to 
        ? `Zeitraum: ${new Date(dateRange.from).toLocaleDateString('de-DE')} - ${new Date(dateRange.to).toLocaleDateString('de-DE')}`
        : `Erstellt am: ${new Date().toLocaleDateString('de-DE')}`
      doc.text(dateStr, pageWidth / 2, 35, { align: 'center' })
      
      let yPos = 50
      
      // Summary section
      doc.setFontSize(14)
      doc.setTextColor(40)
      doc.text('Zusammenfassung', 14, yPos)
      yPos += 10
      
      if (reportData) {
        doc.setFontSize(10)
        doc.setTextColor(60)
        
        if (reportType === 'tickets') {
          doc.text(`Gesamt Tickets: ${reportData.total || 0}`, 14, yPos)
          doc.text(`Offene Tickets: ${reportData.open || 0}`, 80, yPos)
          doc.text(`Gelöste Tickets: ${reportData.resolved || 0}`, 140, yPos)
          yPos += 8
          doc.text(`Durchschnittliche Lösungszeit: ${reportData.avg_resolution_time?.toFixed(1) || 0} Stunden`, 14, yPos)
          yPos += 15
          
          // Status distribution table
          if (reportData.by_status) {
            doc.setFontSize(12)
            doc.text('Verteilung nach Status', 14, yPos)
            yPos += 5
            
            const statusData = Object.entries(reportData.by_status).map(([status, count]) => [
              status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
              count.toString()
            ])
            
            doc.autoTable({
              startY: yPos,
              head: [['Status', 'Anzahl']],
              body: statusData,
              theme: 'striped',
              headStyles: { fillColor: [59, 130, 246] }
            })
            yPos = doc.lastAutoTable.finalY + 15
          }
          
          // Priority distribution
          if (reportData.by_priority) {
            doc.setFontSize(12)
            doc.text('Verteilung nach Priorität', 14, yPos)
            yPos += 5
            
            const priorityData = Object.entries(reportData.by_priority).map(([priority, count]) => [
              priority.charAt(0).toUpperCase() + priority.slice(1),
              count.toString()
            ])
            
            doc.autoTable({
              startY: yPos,
              head: [['Priorität', 'Anzahl']],
              body: priorityData,
              theme: 'striped',
              headStyles: { fillColor: [59, 130, 246] }
            })
          }
        } else if (reportType === 'time') {
          doc.text(`Gesamt Stunden: ${((reportData.total_minutes || 0) / 60).toFixed(1)}h`, 14, yPos)
          doc.text(`Abrechenbar: ${((reportData.billable_minutes || 0) / 60).toFixed(1)}h`, 80, yPos)
          yPos += 8
          doc.text(`Einträge: ${reportData.entry_count || 0}`, 14, yPos)
          yPos += 15
          
          if (reportData.by_organization?.length > 0) {
            doc.setFontSize(12)
            doc.text('Zeit nach Organisation', 14, yPos)
            yPos += 5
            
            const orgData = reportData.by_organization.map(org => [
              org.organization_name || 'Unbekannt',
              ((org.total_minutes || 0) / 60).toFixed(1) + 'h',
              ((org.billable_minutes || 0) / 60).toFixed(1) + 'h'
            ])
            
            doc.autoTable({
              startY: yPos,
              head: [['Organisation', 'Gesamt', 'Abrechenbar']],
              body: orgData,
              theme: 'striped',
              headStyles: { fillColor: [59, 130, 246] }
            })
          }
        } else if (reportType === 'assets') {
          doc.text(`Gesamt Assets: ${reportData.total || 0}`, 14, yPos)
          doc.text(`Aktiv: ${reportData.active || 0}`, 80, yPos)
          doc.text(`Gesamt Wert: ${(reportData.total_value || 0).toFixed(2)} €`, 140, yPos)
          yPos += 15
          
          if (reportData.by_type) {
            doc.setFontSize(12)
            doc.text('Assets nach Typ', 14, yPos)
            yPos += 5
            
            const typeData = Object.entries(reportData.by_type).map(([type, count]) => [type, count.toString()])
            
            doc.autoTable({
              startY: yPos,
              head: [['Typ', 'Anzahl']],
              body: typeData,
              theme: 'striped',
              headStyles: { fillColor: [59, 130, 246] }
            })
          }
        }
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`Seite ${i} von ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })
        doc.text('IT REX Solutions ServiceDesk', 14, doc.internal.pageSize.getHeight() - 10)
      }
      
      doc.save(`report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF erfolgreich erstellt')
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error('Fehler beim PDF-Export')
    } finally {
      setExporting(false)
    }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reports & Auswertungen</h2>
        <div className="flex items-center gap-4">
          <Input type="date" value={dateRange.from} onChange={(e) => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-40" />
          <span>bis</span>
          <Input type="date" value={dateRange.to} onChange={(e) => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-40" />
          <Button onClick={loadReport} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
          <Button onClick={exportToPDF} disabled={exporting || !reportData}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            PDF Export
          </Button>
        </div>
      </div>
      
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList>
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-2" />Tickets</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-2" />Zeiterfassung</TabsTrigger>
          <TabsTrigger value="sla"><TrendingUp className="h-4 w-4 mr-2" />SLA</TabsTrigger>
          <TabsTrigger value="assets"><Package className="h-4 w-4 mr-2" />Assets</TabsTrigger>
        </TabsList>
        
        {loading ? (
          <div className="flex justify-center h-64 mt-6"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : reportData ? (
          <>
            <TabsContent value="tickets">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <StatsCard title="Gesamt" value={reportData.total} icon={Ticket} color="blue" />
                <StatsCard title="Offen" value={reportData.byStatus?.open || 0} icon={AlertCircle} color="orange" />
                <StatsCard title="Gelöst" value={reportData.byStatus?.resolved || 0} icon={CheckCircle2} color="green" />
                <StatsCard title="Ø Lösungszeit" value={`${(reportData.avgResolutionTime || 0).toFixed(1)}h`} icon={Clock} color="purple" />
              </div>
              <Card className="mt-6">
                <CardHeader><CardTitle>Verteilung nach Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(reportData.byStatus || {}).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-slate-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count / reportData.total) * 100}%` }} />
                          </div>
                          <span className="font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="time">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <StatsCard title="Gesamtstunden" value={`${(reportData.totalHours || 0).toFixed(1)}h`} icon={Clock} color="blue" />
                <StatsCard title="Abrechenbar" value={`${(reportData.billableHours || 0).toFixed(1)}h`} icon={Timer} color="green" />
                <StatsCard title="Umsatz" value={`€${(reportData.totalRevenue || 0).toFixed(2)}`} icon={TrendingUp} color="purple" />
              </div>
              {reportData.byUser && Object.keys(reportData.byUser).length > 0 && (
                <Card className="mt-6">
                  <CardHeader><CardTitle>Zeit pro Mitarbeiter</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(reportData.byUser).map(([user, minutes]) => (
                        <div key={user} className="flex items-center justify-between">
                          <span>{user}</span>
                          <span className="font-medium">{formatDuration(minutes)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="sla">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <StatsCard title="Tickets mit SLA" value={reportData.total} icon={Ticket} color="blue" />
                <StatsCard title="Antwort-Compliance" value={`${(reportData.responseCompliance || 0).toFixed(0)}%`} icon={TrendingUp} color={reportData.responseCompliance >= 90 ? 'green' : 'orange'} />
                <StatsCard title="Lösungs-Compliance" value={`${(reportData.resolutionCompliance || 0).toFixed(0)}%`} icon={CheckCircle2} color={reportData.resolutionCompliance >= 90 ? 'green' : 'orange'} />
                <StatsCard title="SLA-Verstöße" value={(reportData.responseMissed || 0) + (reportData.resolutionMissed || 0)} icon={AlertCircle} color="orange" />
              </div>
            </TabsContent>
            
            <TabsContent value="assets">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <StatsCard title="Gesamt Assets" value={reportData.total} icon={Package} color="blue" />
                <StatsCard title="Aktive Assets" value={reportData.byStatus?.active || 0} icon={CheckCircle2} color="green" />
              </div>
              {reportData.byType && Object.keys(reportData.byType).length > 0 && (
                <Card className="mt-6">
                  <CardHeader><CardTitle>Assets nach Typ</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(reportData.byType).map(([type, count]) => {
                        const IconComponent = ASSET_ICONS[type] || Box
                        return (
                          <div key={type} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                            <IconComponent className="h-8 w-8 text-slate-400" />
                            <div>
                              <p className="font-medium">{type}</p>
                              <p className="text-2xl font-bold">{count}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  )
}

// ============================================
// CUSTOMER PORTAL
// ============================================

function CustomerPortal({ user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('portal-tickets')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const PAGE_TITLES = {
    'portal-tickets': 'Meine Tickets',
    'portal-new': 'Neues Ticket erstellen',
  }
  
  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user} isCustomerPortal />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} user={user} onLogout={onLogout} />
        <main className="flex-1 overflow-auto">
          {currentPage === 'portal-tickets' && <CustomerTicketsPage user={user} />}
          {currentPage === 'portal-new' && <CustomerNewTicketPage user={user} onCreated={() => setCurrentPage('portal-tickets')} />}
        </main>
      </div>
    </div>
  )
}

function CustomerTicketsPage({ user }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  
  useEffect(() => {
    api.getTickets({ created_by_id: user.id })
      .then(setTickets)
      .catch(() => toast.error('Fehler'))
      .finally(() => setLoading(false))
  }, [user.id])
  
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Ihre Support-Tickets</h2>
      {loading ? (
        <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Ticket className="h-12 w-12 mx-auto text-slate-300" /><p className="mt-4 text-slate-500">Keine Tickets vorhanden</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTicket(ticket.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">#{ticket.ticket_number}</span>
                      <h3 className="font-medium">{ticket.subject}</h3>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Erstellt am {formatDateTime(ticket.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <TicketDetailDialog ticketId={selectedTicket} currentUser={user} open={!!selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  )
}

function CustomerNewTicketPage({ user, onCreated }) {
  const [formData, setFormData] = useState({ subject: '', description: '', priority: 'medium' })
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.subject) { toast.error('Betreff ist erforderlich'); return }
    setLoading(true)
    try {
      await api.createTicket({ ...formData, created_by_id: user.id, source: 'portal' })
      toast.success('Ticket erstellt')
      onCreated()
    } catch { toast.error('Fehler') }
    finally { setLoading(false) }
  }
  
  return (
    <div className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Neues Support-Ticket</CardTitle>
          <CardDescription>Beschreiben Sie Ihr Problem oder Ihre Anfrage</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Betreff *</Label><Input value={formData.subject} onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))} placeholder="Kurze Beschreibung" /></div>
            <div><Label>Beschreibung</Label><Textarea value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Detaillierte Beschreibung" rows={6} /></div>
            <div>
              <Label>Priorität</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ticket erstellen</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// INBOX PAGE (Central Inbox / Posteingang)
// ============================================

function InboxPage({ currentUser }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [filter, setFilter] = useState('all')
  const [classifying, setClassifying] = useState(false)
  const [ticketTypes, setTicketTypes] = useState([])
  
  // M365 Mailbox State
  const [mailboxes, setMailboxes] = useState([])
  const [selectedMailbox, setSelectedMailbox] = useState(null)
  const [mailboxEmails, setMailboxEmails] = useState([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [mailboxStats, setMailboxStats] = useState(null)
  const [activeView, setActiveView] = useState('conversations') // 'conversations' | 'mailbox'
  
  const loadConversations = useCallback(async () => {
    setLoading(true)
    const params = filter !== 'all' ? `?status=${filter}` : ''
    const data = await api.fetch(`/conversations${params}`)
    setConversations(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filter])
  
  const loadTicketTypes = useCallback(async () => {
    const data = await api.fetch('/ticket-types')
    setTicketTypes(Array.isArray(data) ? data : [])
  }, [])
  
  const loadMailboxes = useCallback(async () => {
    try {
      const data = await api.fetch('/m365/mailboxes')
      setMailboxes(Array.isArray(data) ? data : [])
      
      // Also load dashboard stats
      const stats = await api.fetch('/m365/dashboard')
      setMailboxStats(stats)
    } catch (error) {
      console.error('Failed to load mailboxes:', error)
    }
  }, [])
  
  const loadMailboxEmails = useCallback(async (mailboxId, filterType = 'all') => {
    if (!mailboxId) return
    setLoadingEmails(true)
    try {
      const params = filterType !== 'all' ? `?filter=${filterType}` : ''
      const data = await api.fetch(`/m365/mailboxes/${mailboxId}/messages${params}`)
      setMailboxEmails(data.messages || [])
    } catch (error) {
      toast.error('E-Mails konnten nicht geladen werden')
      setMailboxEmails([])
    }
    setLoadingEmails(false)
  }, [])
  
  useEffect(() => {
    loadConversations()
    loadTicketTypes()
    loadMailboxes()
  }, [loadConversations, loadTicketTypes, loadMailboxes])
  
  useEffect(() => {
    if (selectedMailbox) {
      loadMailboxEmails(selectedMailbox.id)
    }
  }, [selectedMailbox, loadMailboxEmails])
  
  const handleSelectMailbox = (mailbox) => {
    setSelectedMailbox(mailbox)
    setActiveView('mailbox')
    setSelectedConversation(null)
  }
  
  const handleClassify = async (conversation) => {
    if (!conversation.body) return
    setClassifying(true)
    try {
      const result = await api.fetch('/ai/classify', {
        method: 'POST',
        body: JSON.stringify({ 
          text: `${conversation.subject || ''}\n\n${conversation.body}`,
          conversation_id: conversation.id
        })
      })
      if (result.classification) {
        toast.success(`Klassifiziert als: ${result.classification.type}`)
        loadConversations()
      }
    } catch (error) {
      toast.error('Klassifizierung fehlgeschlagen')
    }
    setClassifying(false)
  }
  
  const handleCreateTicket = async (conversation) => {
    try {
      const classification = conversation.ai_classification || {}
      const ticket = await api.fetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: conversation.subject || 'Neue Anfrage',
          description: conversation.body,
          priority: classification.priority || 'medium',
          status: 'open',
          ticket_type_code: classification.type,
          organization_id: conversation.organization_id,
          contact_id: conversation.contact_id,
          conversation_id: conversation.id,
        })
      })
      
      await api.fetch(`/conversations/${conversation.id}/process`, {
        method: 'POST',
        body: JSON.stringify({ ticket_id: ticket.id, processed_by_id: currentUser?.id })
      })
      
      toast.success(`Ticket #${ticket.ticket_number} erstellt`)
      loadConversations()
    } catch (error) {
      toast.error('Fehler beim Erstellen des Tickets')
    }
  }
  
  const handleEmailToTicket = async (email) => {
    if (!selectedMailbox) return
    try {
      const result = await api.fetch(`/m365/mailboxes/${selectedMailbox.id}/messages/${email.id}/to-ticket`, {
        method: 'POST',
        body: JSON.stringify({ created_by_id: currentUser?.id })
      })
      toast.success(`Ticket #${result.ticket_number} erstellt`)
      loadMailboxEmails(selectedMailbox.id)
    } catch (error) {
      toast.error('Ticket konnte nicht erstellt werden')
    }
  }
  
  const handleMarkAsRead = async (email, isRead = true) => {
    if (!selectedMailbox) return
    try {
      await api.fetch(`/m365/mailboxes/${selectedMailbox.id}/messages/${email.id}/read`, {
        method: 'POST',
        body: JSON.stringify({ isRead })
      })
      loadMailboxEmails(selectedMailbox.id)
    } catch (error) {
      toast.error('Status konnte nicht geändert werden')
    }
  }
  
  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'phone': return <PhoneCall className="w-4 h-4" />
      case 'chat': return <MessageSquare className="w-4 h-4" />
      case 'portal': return <Globe className="w-4 h-4" />
      default: return <Inbox className="w-4 h-4" />
    }
  }
  
  const getTypeColor = (type) => {
    const colors = {
      lead: 'bg-blue-100 text-blue-700',
      support: 'bg-green-100 text-green-700',
      onboarding: 'bg-purple-100 text-purple-700',
      offboarding: 'bg-orange-100 text-orange-700',
      order: 'bg-cyan-100 text-cyan-700',
      project: 'bg-indigo-100 text-indigo-700',
      invoice: 'bg-yellow-100 text-yellow-700',
      inquiry: 'bg-slate-100 text-slate-700',
    }
    return colors[type] || 'bg-slate-100 text-slate-700'
  }
  
  const getMailboxIcon = (type) => {
    switch (type) {
      case 'service': return <Cog className="w-4 h-4" />
      case 'shared': return <Users className="w-4 h-4" />
      default: return <Mail className="w-4 h-4" />
    }
  }
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'token_expired': return 'text-amber-500'
      case 'disconnected': return 'text-red-500'
      default: return 'text-slate-400'
    }
  }
  
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Sidebar - Mailboxes */}
      <div className="w-64 border-r bg-slate-50 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">Posteingänge</h2>
        </div>
        
        {/* General Inbox */}
        <div 
          className={`px-4 py-3 cursor-pointer hover:bg-slate-100 flex items-center gap-3 ${activeView === 'conversations' ? 'bg-slate-100 border-l-2 border-blue-500' : ''}`}
          onClick={() => { setActiveView('conversations'); setSelectedMailbox(null); }}
        >
          <Inbox className="w-5 h-5 text-slate-600" />
          <div className="flex-1">
            <span className="font-medium text-sm">Alle Nachrichten</span>
            <p className="text-xs text-muted-foreground">{conversations.length} Konversationen</p>
          </div>
        </div>
        
        <Separator />
        
        {/* M365 Mailboxes */}
        <div className="px-4 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Microsoft 365</span>
        </div>
        
        <ScrollArea className="flex-1">
          {mailboxes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              <p>Keine Mailboxen verbunden</p>
              <Button variant="link" size="sm" className="p-0 h-auto mt-1" onClick={() => window.location.href = '/settings?tab=email'}>
                Mailbox verbinden →
              </Button>
            </div>
          ) : (
            mailboxes.map((mailbox) => (
              <div 
                key={mailbox.id}
                className={`px-4 py-3 cursor-pointer hover:bg-slate-100 flex items-center gap-3 ${selectedMailbox?.id === mailbox.id ? 'bg-slate-100 border-l-2 border-blue-500' : ''}`}
                onClick={() => handleSelectMailbox(mailbox)}
              >
                <div className={getStatusColor(mailbox.status)}>
                  {getMailboxIcon(mailbox.mailbox_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">{mailbox.display_name || mailbox.email}</span>
                  <p className="text-xs text-muted-foreground truncate">{mailbox.email}</p>
                </div>
                {mailbox.unread_count > 0 && (
                  <Badge className="bg-blue-500 text-white text-xs">{mailbox.unread_count}</Badge>
                )}
              </div>
            ))
          )}
        </ScrollArea>
        
        {/* Dashboard Stats */}
        {mailboxStats && (
          <div className="p-4 border-t bg-white">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{mailboxStats.total_unread}</div>
                <div className="text-xs text-muted-foreground">Ungelesen</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">{mailboxStats.active_mailboxes}</div>
                <div className="text-xs text-muted-foreground">Verbunden</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeView === 'conversations' ? (
          /* Conversations View */
          <div className="p-6 flex-1 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">Posteingang</h1>
                <p className="text-muted-foreground">Zentrale Inbox für alle eingehenden Nachrichten</p>
              </div>
              <div className="flex gap-2">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="new">Neu</SelectItem>
                    <SelectItem value="read">Gelesen</SelectItem>
                    <SelectItem value="processed">Verarbeitet</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadConversations}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Aktualisieren
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Conversation List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Nachrichten ({conversations.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-320px)]">
                      {loading ? (
                        <div className="p-4 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Keine Nachrichten vorhanden</p>
                          <p className="text-sm mt-2">Neue E-Mails und Anfragen erscheinen hier</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {conversations.map((conv) => (
                            <div
                              key={conv.id}
                              className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                                selectedConversation?.id === conv.id ? 'bg-slate-100' : ''
                              } ${conv.status === 'new' ? 'bg-blue-50' : ''}`}
                              onClick={() => setSelectedConversation(conv)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1">{getChannelIcon(conv.channel)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{conv.from_name || conv.from_address || 'Unbekannt'}</span>
                                    {conv.status === 'new' && <Badge className="bg-blue-500 text-white text-xs">Neu</Badge>}
                                  </div>
                                  <p className="text-sm font-medium truncate">{conv.subject || '(Kein Betreff)'}</p>
                                  <p className="text-xs text-muted-foreground truncate">{conv.body?.substring(0, 80)}...</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {conv.ai_classification?.type && (
                                      <Badge className={`text-xs ${getTypeColor(conv.ai_classification.type)}`}>
                                        {conv.ai_classification.type}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(conv.created_at).toLocaleString('de-DE')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              {/* Conversation Detail */}
              <div className="lg:col-span-2">
                {selectedConversation ? (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{selectedConversation.subject || '(Kein Betreff)'}</CardTitle>
                          <CardDescription>
                            Von: {selectedConversation.from_name || selectedConversation.from_address} • 
                            {new Date(selectedConversation.created_at).toLocaleString('de-DE')}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {!selectedConversation.ticket_id && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleClassify(selectedConversation)}
                                disabled={classifying}
                              >
                                {classifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                                KI-Klassifizierung
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleCreateTicket(selectedConversation)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Ticket erstellen
                              </Button>
                            </>
                          )}
                          {selectedConversation.ticket_id && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Ticket verknüpft
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedConversation.ai_classification && Object.keys(selectedConversation.ai_classification).length > 0 && (
                        <div className="mb-4 p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-purple-700">KI-Analyse</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Typ:</span>
                              <Badge className={`ml-2 ${getTypeColor(selectedConversation.ai_classification.type)}`}>
                                {selectedConversation.ai_classification.type}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Priorität:</span>
                              <Badge className={`ml-2 ${PRIORITY_COLORS[selectedConversation.ai_classification.priority] || ''}`}>
                                {PRIORITY_LABELS[selectedConversation.ai_classification.priority] || selectedConversation.ai_classification.priority}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Konfidenz:</span>
                              <span className="ml-2 font-medium">{Math.round((selectedConversation.ai_classification.confidence || 0) * 100)}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Queue:</span>
                              <span className="ml-2">{selectedConversation.ai_classification.suggested_queue || '-'}</span>
                            </div>
                          </div>
                          {selectedConversation.ai_classification.suggested_response && (
                            <div className="mt-3 pt-3 border-t border-purple-200">
                              <span className="text-muted-foreground text-sm">Vorgeschlagene Antwort:</span>
                              <p className="mt-1 text-sm">{selectedConversation.ai_classification.suggested_response}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap bg-white border rounded-lg p-4">
                          {selectedConversation.body}
                        </div>
                      </div>
                      
                      {selectedConversation.attachments?.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Anhänge</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedConversation.attachments.map((att, idx) => (
                              <Badge key={idx} variant="outline" className="cursor-pointer">
                                <FileText className="w-3 h-3 mr-1" />
                                {att.name || `Anhang ${idx + 1}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-[calc(100vh-320px)] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p>Wählen Sie eine Nachricht aus der Liste</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* M365 Mailbox View */
          <div className="p-6 flex-1 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">{selectedMailbox?.display_name || selectedMailbox?.email}</h1>
                <p className="text-muted-foreground">{selectedMailbox?.email}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => loadMailboxEmails(selectedMailbox?.id)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Aktualisieren
                </Button>
              </div>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-240px)]">
                  {loadingEmails ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                      <p className="mt-2 text-muted-foreground">E-Mails werden geladen...</p>
                    </div>
                  ) : mailboxEmails.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Keine E-Mails vorhanden</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {mailboxEmails.map((email) => (
                        <div
                          key={email.id}
                          className={`p-4 hover:bg-slate-50 cursor-pointer ${!email.isRead ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 ${!email.isRead ? 'text-blue-600' : 'text-slate-400'}`}>
                              <Mail className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                                  {email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unbekannt'}
                                </span>
                                {!email.isRead && <Badge className="bg-blue-500 text-white text-xs">Neu</Badge>}
                                {email.hasAttachments && <Paperclip className="w-4 h-4 text-slate-400" />}
                                {email.importance === 'high' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              </div>
                              <p className={`text-sm truncate ${!email.isRead ? 'font-medium' : ''}`}>{email.subject || '(Kein Betreff)'}</p>
                              <p className="text-xs text-muted-foreground truncate mt-1">{email.bodyPreview?.substring(0, 120)}...</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(email.receivedDateTime).toLocaleString('de-DE')}
                                </span>
                                <div className="flex gap-1 ml-auto">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleMarkAsRead(email, !email.isRead); }}
                                  >
                                    {email.isRead ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleEmailToTicket(email); }}
                                  >
                                    <Plus className="w-4 h-4" />
                                    Ticket
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// ONBOARDING PAGE
// ============================================

function OnboardingPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('onboarding')
  const [requests, setRequests] = useState([])
  const [offboardingRequests, setOffboardingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [newRequest, setNewRequest] = useState({
    first_name: '', last_name: '', email: '', start_date: '',
    job_title: '', department: '', manager_name: '', manager_email: '',
    location: 'office', needs_email: true, m365_license_type: 'e3',
    needs_teams: true, needs_sharepoint: true, vpn_required: false,
    special_requirements: '', organization_id: ''
  })
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    const [onReq, offReq, orgs] = await Promise.all([
      api.fetch('/onboarding-requests'),
      api.fetch('/offboarding-requests'),
      api.fetch('/organizations')
    ])
    setRequests(Array.isArray(onReq) ? onReq : [])
    setOffboardingRequests(Array.isArray(offReq) ? offReq : [])
    setOrganizations(Array.isArray(orgs) ? orgs : [])
    setLoading(false)
  }
  
  const handleCreateOnboarding = async () => {
    if (!newRequest.first_name || !newRequest.last_name || !newRequest.start_date || !newRequest.organization_id) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }
    
    try {
      // First create a ticket
      const ticket = await api.fetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: `Onboarding: ${newRequest.first_name} ${newRequest.last_name}`,
          description: `Neuer Mitarbeiter: ${newRequest.first_name} ${newRequest.last_name}\nStartdatum: ${newRequest.start_date}\nPosition: ${newRequest.job_title || '-'}`,
          priority: 'high',
          status: 'open',
          ticket_type_code: 'onboarding',
          organization_id: newRequest.organization_id,
        })
      })
      
      // Then create the onboarding request
      const result = await api.fetch('/onboarding-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...newRequest,
          ticket_id: ticket.id
        })
      })
      
      toast.success('Onboarding-Anfrage erstellt')
      setShowNewDialog(false)
      setNewRequest({
        first_name: '', last_name: '', email: '', start_date: '',
        job_title: '', department: '', manager_name: '', manager_email: '',
        location: 'office', needs_email: true, m365_license_type: 'e3',
        needs_teams: true, needs_sharepoint: true, vpn_required: false,
        special_requirements: '', organization_id: ''
      })
      loadData()
    } catch (error) {
      toast.error('Fehler beim Erstellen der Anfrage')
    }
  }
  
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      form_sent: 'bg-blue-100 text-blue-700',
      form_completed: 'bg-purple-100 text-purple-700',
      processing: 'bg-orange-100 text-orange-700',
      completed: 'bg-green-100 text-green-700',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }
  
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Ausstehend',
      form_sent: 'Formular gesendet',
      form_completed: 'Formular ausgefüllt',
      processing: 'In Bearbeitung',
      completed: 'Abgeschlossen',
    }
    return labels[status] || status
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mitarbeiter On-/Offboarding</h1>
          <p className="text-muted-foreground">Automatisierte Prozesse für neue und ausscheidende Mitarbeiter</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Neues Onboarding
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Onboarding ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="offboarding" className="flex items-center gap-2">
            <UserMinus className="w-4 h-4" />
            Offboarding ({offboardingRequests.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="onboarding">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-12 text-center">
              <UserPlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Keine Onboarding-Anfragen</h3>
              <p className="text-muted-foreground mb-4">Erstellen Sie eine neue Anfrage für einen neuen Mitarbeiter</p>
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Onboarding starten
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((req) => (
                <Card key={req.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-purple-100 text-purple-700">
                            {req.first_name?.[0]}{req.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{req.first_name} {req.last_name}</h3>
                          <p className="text-sm text-muted-foreground">{req.job_title || 'Keine Position'} • {req.department || 'Keine Abteilung'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusColor(req.status)}>{getStatusLabel(req.status)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Start: {new Date(req.start_date).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {req.needs_email && <Mail className="w-4 h-4" title="E-Mail" />}
                            {req.needs_teams && <MessageSquare className="w-4 h-4" title="Teams" />}
                            {req.vpn_required && <Shield className="w-4 h-4" title="VPN" />}
                          </div>
                          <p className="mt-1">{req.m365_license_type?.toUpperCase() || '-'}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRequest(req)}>
                          Details
                        </Button>
                      </div>
                    </div>
                    
                    {req.checklist?.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Fortschritt</p>
                        <div className="flex flex-wrap gap-2">
                          {req.checklist.map((item, idx) => (
                            <Badge 
                              key={idx}
                              variant="outline"
                              className={item.status === 'completed' ? 'border-green-500 text-green-700' : ''}
                            >
                              {item.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
                              {item.task}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="offboarding">
          {offboardingRequests.length === 0 ? (
            <Card className="p-12 text-center">
              <UserMinus className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Keine Offboarding-Anfragen</h3>
              <p className="text-muted-foreground">Offboarding-Anfragen werden hier angezeigt</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {offboardingRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-orange-100 text-orange-700">
                            {req.employee_name?.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{req.employee_name}</h3>
                          <p className="text-sm text-muted-foreground">{req.employee_email}</p>
                          <Badge className={getStatusColor(req.status)}>{getStatusLabel(req.status)}</Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">Letzter Tag:</p>
                        <p>{new Date(req.last_day).toLocaleDateString('de-DE')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* New Onboarding Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neues Mitarbeiter-Onboarding</DialogTitle>
            <DialogDescription>Erfassen Sie die Daten des neuen Mitarbeiters</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vorname *</Label>
                <Input 
                  value={newRequest.first_name}
                  onChange={(e) => setNewRequest({...newRequest, first_name: e.target.value})}
                  placeholder="Max"
                />
              </div>
              <div>
                <Label>Nachname *</Label>
                <Input 
                  value={newRequest.last_name}
                  onChange={(e) => setNewRequest({...newRequest, last_name: e.target.value})}
                  placeholder="Mustermann"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Startdatum *</Label>
                <Input 
                  type="date"
                  value={newRequest.start_date}
                  onChange={(e) => setNewRequest({...newRequest, start_date: e.target.value})}
                />
              </div>
              <div>
                <Label>Organisation *</Label>
                <Select value={newRequest.organization_id} onValueChange={(v) => setNewRequest({...newRequest, organization_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Position</Label>
                <Input 
                  value={newRequest.job_title}
                  onChange={(e) => setNewRequest({...newRequest, job_title: e.target.value})}
                  placeholder="Software Developer"
                />
              </div>
              <div>
                <Label>Abteilung</Label>
                <Input 
                  value={newRequest.department}
                  onChange={(e) => setNewRequest({...newRequest, department: e.target.value})}
                  placeholder="IT"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vorgesetzter Name</Label>
                <Input 
                  value={newRequest.manager_name}
                  onChange={(e) => setNewRequest({...newRequest, manager_name: e.target.value})}
                />
              </div>
              <div>
                <Label>Vorgesetzter E-Mail</Label>
                <Input 
                  type="email"
                  value={newRequest.manager_email}
                  onChange={(e) => setNewRequest({...newRequest, manager_email: e.target.value})}
                />
              </div>
            </div>
            
            <Separator />
            
            <h4 className="font-medium">IT-Anforderungen</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Arbeitsort</Label>
                <Select value={newRequest.location} onValueChange={(v) => setNewRequest({...newRequest, location: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Büro</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Microsoft 365 Lizenz</Label>
                <Select value={newRequest.m365_license_type} onValueChange={(v) => setNewRequest({...newRequest, m365_license_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="e1">E1</SelectItem>
                    <SelectItem value="e3">E3</SelectItem>
                    <SelectItem value="e5">E5</SelectItem>
                    <SelectItem value="f3">F3</SelectItem>
                    <SelectItem value="business_basic">Business Basic</SelectItem>
                    <SelectItem value="business_standard">Business Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newRequest.needs_email}
                  onCheckedChange={(v) => setNewRequest({...newRequest, needs_email: v})}
                />
                <Label>E-Mail</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newRequest.needs_teams}
                  onCheckedChange={(v) => setNewRequest({...newRequest, needs_teams: v})}
                />
                <Label>Teams</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newRequest.needs_sharepoint}
                  onCheckedChange={(v) => setNewRequest({...newRequest, needs_sharepoint: v})}
                />
                <Label>SharePoint</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={newRequest.vpn_required}
                  onCheckedChange={(v) => setNewRequest({...newRequest, vpn_required: v})}
                />
                <Label>VPN</Label>
              </div>
            </div>
            
            <div>
              <Label>Besondere Anforderungen</Label>
              <Textarea 
                value={newRequest.special_requirements}
                onChange={(e) => setNewRequest({...newRequest, special_requirements: e.target.value})}
                placeholder="Z.B. spezielle Software, Zugriffsrechte, Hardware..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreateOnboarding}>
              <UserPlus className="w-4 h-4 mr-2" />
              Onboarding starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Request Detail Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedRequest.first_name} {selectedRequest.last_name}</DialogTitle>
              <DialogDescription>Onboarding-Details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Position:</span> {selectedRequest.job_title || '-'}</div>
                <div><span className="text-muted-foreground">Abteilung:</span> {selectedRequest.department || '-'}</div>
                <div><span className="text-muted-foreground">Startdatum:</span> {new Date(selectedRequest.start_date).toLocaleDateString('de-DE')}</div>
                <div><span className="text-muted-foreground">Arbeitsort:</span> {selectedRequest.location}</div>
                <div><span className="text-muted-foreground">M365 Lizenz:</span> {selectedRequest.m365_license_type?.toUpperCase()}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={getStatusColor(selectedRequest.status)}>{getStatusLabel(selectedRequest.status)}</Badge></div>
              </div>
              
              {selectedRequest.special_requirements && (
                <div>
                  <h4 className="font-medium mb-2">Besondere Anforderungen</h4>
                  <p className="text-sm bg-slate-50 p-3 rounded">{selectedRequest.special_requirements}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>Schließen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ============================================
// KNOWLEDGE BASE PAGE
// ============================================

function KnowledgeBasePage({ currentUser }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterVisibility, setFilterVisibility] = useState('all')
  
  useEffect(() => {
    loadArticles()
    api.getOrganizations().then(setOrganizations).catch(() => {})
  }, [])
  
  const loadArticles = async () => {
    setLoading(true)
    try {
      const data = await api.fetch('/kb-articles')
      // Filter out archived articles
      setArticles(Array.isArray(data) ? data.filter(a => !a.is_archived) : [])
    } catch {
      setArticles([])
    }
    setLoading(false)
  }
  
  const handleCreateArticle = async (articleData) => {
    try {
      await api.fetch('/kb-articles', {
        method: 'POST',
        body: JSON.stringify({
          ...articleData,
          created_by_id: currentUser?.id
        })
      })
      toast.success('Artikel erstellt')
      setShowNewDialog(false)
      loadArticles()
    } catch (error) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  const handleUpdateArticle = async (articleData) => {
    try {
      await api.fetch(`/kb-articles/${editingArticle.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...articleData,
          updated_by_id: currentUser?.id
        })
      })
      toast.success('Artikel aktualisiert')
      setEditingArticle(null)
      setSelectedArticle(null)
      loadArticles()
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }
  
  const handleDeleteArticle = async (id) => {
    if (!confirm('Artikel wirklich löschen?')) return
    try {
      await api.fetch(`/kb-articles/${id}?user_id=${currentUser?.id}`, { method: 'DELETE' })
      toast.success('Artikel gelöscht')
      setSelectedArticle(null)
      loadArticles()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const filteredArticles = articles.filter(a => {
    const matchesSearch = 
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesOrg = filterOrg === 'all' || 
      (filterOrg === 'global' && !a.organization_id) ||
      a.organization_id === filterOrg
    
    const matchesVisibility = filterVisibility === 'all' ||
      (filterVisibility === 'internal' && a.is_internal) ||
      (filterVisibility === 'public' && !a.is_internal)
    
    return matchesSearch && matchesOrg && matchesVisibility
  })
  
  const isAdmin = currentUser?.user_type === 'internal'
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Wissensdatenbank</h1>
          <p className="text-muted-foreground">Lösungen, Anleitungen und Best Practices</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Neuer Artikel
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Organisation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Organisationen</SelectItem>
                <SelectItem value="global">Global (Alle)</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sichtbarkeit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="public">Öffentlich</SelectItem>
                <SelectItem value="internal">Nur intern</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Keine Artikel gefunden</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'Keine Ergebnisse für Ihre Suche' : 'Erstellen Sie den ersten Wissensartikel'}
          </p>
          {isAdmin && !searchQuery && (
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Artikel erstellen
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Card 
              key={article.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedArticle(article)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{article.title}</CardTitle>
                  <div className="flex gap-1">
                    {article.is_internal && (
                      <Badge variant="outline" className="text-xs bg-yellow-50">Intern</Badge>
                    )}
                    {article.organization_id && (
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        <Building2 className="w-3 h-3 mr-1" />
                        {article.organization?.name || 'Org'}
                      </Badge>
                    )}
                  </div>
                </div>
                {article.category && (
                  <Badge className="w-fit bg-blue-100 text-blue-700">{article.category}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {article.content?.substring(0, 150)}...
                </p>
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>
                    {article.created_by ? `${article.created_by.first_name} ${article.created_by.last_name}` : ''} · 
                    {new Date(article.created_at).toLocaleDateString('de-DE')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Eye className="w-3 h-3" /> {article.views || 0}
                    {article.version > 1 && <Badge variant="outline" className="text-xs">v{article.version}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* New Article Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neuer Wissensartikel</DialogTitle>
          </DialogHeader>
          <KBArticleForm 
            organizations={organizations}
            onSubmit={handleCreateArticle}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Article Dialog */}
      <Dialog open={!!editingArticle} onOpenChange={(open) => !open && setEditingArticle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Artikel bearbeiten</DialogTitle>
          </DialogHeader>
          {editingArticle && (
            <KBArticleForm 
              article={editingArticle}
              organizations={organizations}
              onSubmit={handleUpdateArticle}
              onCancel={() => setEditingArticle(null)}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Article Detail Dialog */}
      {selectedArticle && (
        <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <DialogTitle>{selectedArticle.title}</DialogTitle>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingArticle(selectedArticle); }}>
                      <Settings className="w-4 h-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteArticle(selectedArticle.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Löschen
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {selectedArticle.category && (
                  <Badge className="bg-blue-100 text-blue-700">{selectedArticle.category}</Badge>
                )}
                {selectedArticle.is_internal && (
                  <Badge variant="outline" className="bg-yellow-50">Nur intern</Badge>
                )}
                {selectedArticle.organization_id && (
                  <Badge variant="outline" className="bg-blue-50">
                    <Building2 className="w-3 h-3 mr-1" />
                    {selectedArticle.organization?.name || 'Organisation'}
                  </Badge>
                )}
                {!selectedArticle.organization_id && (
                  <Badge variant="outline" className="bg-green-50">
                    <Globe className="w-3 h-3 mr-1" />
                    Global
                  </Badge>
                )}
                {selectedArticle.version > 1 && (
                  <Badge variant="outline">Version {selectedArticle.version}</Badge>
                )}
              </div>
            </DialogHeader>
            <div className="py-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {selectedArticle.content}
              </div>
              
              {selectedArticle.tags?.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
                <p>Erstellt von: {selectedArticle.created_by?.first_name} {selectedArticle.created_by?.last_name}</p>
                <p>Erstellt am: {new Date(selectedArticle.created_at).toLocaleString('de-DE')}</p>
                {selectedArticle.updated_at && selectedArticle.updated_at !== selectedArticle.created_at && (
                  <p>Zuletzt aktualisiert: {new Date(selectedArticle.updated_at).toLocaleString('de-DE')}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedArticle(null)}>Schließen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function KBArticleForm({ article, organizations = [], onSubmit, onCancel, isEdit }) {
  const [formData, setFormData] = useState({
    title: article?.title || '',
    content: article?.content || '',
    category: article?.category || '',
    tags: article?.tags ? article.tags.join(', ') : '',
    is_internal: article?.is_internal || false,
    organization_id: article?.organization_id || '',
    visibility: article?.visibility || 'all'
  })
  
  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast.error('Titel und Inhalt sind erforderlich')
      return
    }
    onSubmit({
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      organization_id: formData.organization_id || null
    })
  }
  
  return (
    <div className="grid gap-4 py-4">
      <div>
        <Label>Titel *</Label>
        <Input 
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          placeholder="Wie man..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kategorie</Label>
          <Input 
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            placeholder="Z.B. Netzwerk, Office 365"
          />
        </div>
        <div>
          <Label>Tags (kommagetrennt)</Label>
          <Input 
            value={formData.tags}
            onChange={(e) => setFormData({...formData, tags: e.target.value})}
            placeholder="vpn, remote, zugang"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Organisation (optional)</Label>
          <Select value={formData.organization_id || 'global'} onValueChange={(v) => setFormData({...formData, organization_id: v === 'global' ? '' : v})}>
            <SelectTrigger>
              <SelectValue placeholder="Global (alle)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global (alle Organisationen)</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Artikel nur für bestimmte Organisation sichtbar machen
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch 
              checked={formData.is_internal}
              onCheckedChange={(v) => setFormData({...formData, is_internal: v})}
            />
            <Label>Nur für Mitarbeiter sichtbar</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Interne Artikel sind für Kunden nicht sichtbar
          </p>
        </div>
      </div>
      <div>
        <Label>Inhalt *</Label>
        <Textarea 
          value={formData.content}
          onChange={(e) => setFormData({...formData, content: e.target.value})}
          placeholder="Beschreiben Sie die Lösung..."
          rows={12}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button onClick={handleSubmit}>{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </DialogFooter>
    </div>
  )
}

// ============================================
// BACKUP MANAGEMENT COMPONENT
// ============================================

function BackupManagement() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState(null)
  
  useEffect(() => {
    loadBackups()
  }, [])
  
  const loadBackups = async () => {
    setLoading(true)
    try {
      const data = await api.fetch('/backups')
      setBackups(Array.isArray(data) ? data : [])
    } catch (e) {
      setBackups([])
    }
    setLoading(false)
  }
  
  const createBackup = async (type = 'manual') => {
    setCreating(true)
    try {
      const result = await api.fetch('/backups/full', {
        method: 'POST',
        body: JSON.stringify({ 
          backup_type: type,
          name: `${type === 'manual' ? 'Manuelles' : type} Backup - ${new Date().toLocaleString('de-DE')}`
        })
      })
      if (result.id || result.success) {
        toast.success('Backup erfolgreich erstellt!')
        loadBackups()
      }
    } catch (e) {
      toast.error('Fehler beim Erstellen des Backups')
    }
    setCreating(false)
  }
  
  const downloadBackup = async (backup) => {
    try {
      const result = await api.fetch(`/backups/${backup.id}/download`)
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename || `backup_${backup.id}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Backup heruntergeladen')
      }
    } catch (e) {
      toast.error('Fehler beim Herunterladen')
    }
  }
  
  const restoreBackup = async (backup, testMode = true) => {
    setRestoring(backup.id)
    try {
      const result = await api.fetch(`/backups/${backup.id}/restore-full`, {
        method: 'POST',
        body: JSON.stringify({ test_mode: testMode })
      })
      if (result.success) {
        toast.success(testMode ? 'Backup-Validierung erfolgreich!' : 'Backup wiederhergestellt!')
      }
    } catch (e) {
      toast.error('Fehler bei der Wiederherstellung')
    }
    setRestoring(null)
    setShowRestoreDialog(false)
  }
  
  const deleteBackup = async (backup) => {
    if (!confirm(`Backup "${backup.notes || backup.id}" wirklich löschen?`)) return
    try {
      await api.fetch(`/backups/${backup.id}`, { method: 'DELETE' })
      toast.success('Backup gelöscht')
      loadBackups()
    } catch (e) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Backup-Verwaltung</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBackups}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={() => createBackup('manual')} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Neues Backup
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Noch keine Backups vorhanden</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => createBackup('manual')}>
            Erstes Backup erstellen
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Backup</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Größe</TableHead>
                <TableHead>Tabellen</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.slice(0, 10).map(backup => (
                <TableRow key={backup.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{backup.notes || backup.file_name || 'Backup'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{backup.checksum?.slice(0, 12)}...</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {backup.backup_type === 'manual' ? '✋ Manuell' : 
                       backup.backup_type === 'daily' ? '📅 Täglich' :
                       backup.backup_type === 'weekly' ? '📆 Wöchentlich' : backup.backup_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatBytes(backup.file_size_bytes)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{backup.tables_included?.length || 0} Tabellen</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {backup.created_at ? new Date(backup.created_at).toLocaleString('de-DE') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => downloadBackup(backup)} title="Herunterladen">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedBackup(backup); setShowRestoreDialog(true); }} title="Wiederherstellen">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteBackup(backup)} title="Löschen" className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      <p className="text-xs text-slate-500">
        Backups enthalten: Benutzer, Organisationen, Kontakte, Tickets, Assets, Zeiteinträge, Einstellungen und mehr.
        Checksumme (SHA-256) garantiert Datenintegrität.
      </p>
      
      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup wiederherstellen</DialogTitle>
            <DialogDescription>
              {selectedBackup?.notes || selectedBackup?.file_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Achtung</p>
                  <p className="text-sm text-yellow-700">
                    Eine vollständige Wiederherstellung überschreibt bestehende Daten. 
                    Führen Sie zuerst einen Test durch.
                  </p>
                </div>
              </div>
            </div>
            {selectedBackup && (
              <div className="text-sm space-y-1">
                <p><strong>Erstellt:</strong> {new Date(selectedBackup.created_at).toLocaleString('de-DE')}</p>
                <p><strong>Größe:</strong> {formatBytes(selectedBackup.file_size_bytes)}</p>
                <p><strong>Tabellen:</strong> {selectedBackup.tables_included?.join(', ')}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Abbrechen</Button>
            <Button variant="outline" onClick={() => restoreBackup(selectedBackup, true)} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Validieren (Test)
            </Button>
            <Button variant="destructive" onClick={() => restoreBackup(selectedBackup, false)} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Wiederherstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// SYSTEM DIAGNOSTICS PAGE
// ============================================

function SystemDiagnosticsPage() {
  const [health, setHealth] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const loadHealth = async () => {
    try {
      const data = await api.fetch('/system/health')
      setHealth(data)
    } catch (e) {
      console.error('Health check error:', e)
    }
  }
  
  const loadLogs = async () => {
    try {
      const data = await api.fetch('/system/logs?limit=50')
      setLogs(data.logs || [])
    } catch (e) {
      console.error('Logs error:', e)
    }
  }
  
  useEffect(() => {
    Promise.all([loadHealth(), loadLogs()]).finally(() => setLoading(false))
  }, [])
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadHealth(), loadLogs()])
    setRefreshing(false)
    toast.success('System-Status aktualisiert')
  }
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': case 'active': case 'configured': case 'ready': return 'bg-green-100 text-green-700'
      case 'degraded': case 'partial': return 'bg-yellow-100 text-yellow-700'
      case 'error': case 'offline': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': case 'active': case 'configured': case 'ready': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'degraded': case 'partial': return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'error': case 'offline': return <AlertTriangle className="h-5 w-5 text-red-500" />
      default: return <CircleDot className="h-5 w-5 text-slate-400" />
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            System-Diagnose & Health
          </h2>
          <p className="text-sm text-muted-foreground">Überwachung aller Systemkomponenten</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>
      
      {/* Overall Status */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Gesamtstatus</CardTitle>
            <Badge className={getStatusColor(health?.status)}>
              {health?.status === 'healthy' ? 'Alle Systeme OK' : health?.status?.toUpperCase()}
            </Badge>
          </div>
          <CardDescription>Letzte Prüfung: {health?.timestamp ? new Date(health.timestamp).toLocaleString('de-DE') : '-'}</CardDescription>
        </CardHeader>
      </Card>
      
      {/* Module Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">Datenbank</p>
                  <p className="text-sm text-muted-foreground">Supabase PostgreSQL</p>
                </div>
              </div>
              {getStatusIcon(health?.database?.status)}
            </div>
            {health?.database?.ticket_count !== undefined && (
              <p className="text-xs text-muted-foreground mt-2">
                {health.database.ticket_count} Tickets in DB
              </p>
            )}
          </CardContent>
        </Card>
        
        {/* AI */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="font-medium">KI-Assistent</p>
                  <p className="text-sm text-muted-foreground">{health?.ai?.model || 'OpenAI GPT'}</p>
                </div>
              </div>
              {getStatusIcon(health?.ai?.status)}
            </div>
            <Badge className={`mt-2 ${getStatusColor(health?.ai?.status)}`}>
              {health?.ai?.status === 'configured' ? 'Konfiguriert' : health?.ai?.status === 'not_configured' ? 'Nicht konfiguriert' : health?.ai?.status}
            </Badge>
          </CardContent>
        </Card>
        
        {/* CTI */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PhoneCall className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium">Telefonie / CTI</p>
                  <p className="text-sm text-muted-foreground">{health?.cti?.provider || 'Simulation'}</p>
                </div>
              </div>
              {getStatusIcon(health?.cti?.status)}
            </div>
            <Badge className={`mt-2 ${getStatusColor(health?.cti?.status)}`}>
              {health?.cti?.status === 'configured' ? 'Aktiv' : 'Simulation'}
            </Badge>
          </CardContent>
        </Card>
        
        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Search className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="font-medium">Suche & Index</p>
                  <p className="text-sm text-muted-foreground">Globale Suche</p>
                </div>
              </div>
              {getStatusIcon(health?.search?.status)}
            </div>
            {health?.search?.indexed_count && (
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <p>Tickets: {health.search.indexed_count.tickets}</p>
                <p>Kontakte: {health.search.indexed_count.contacts}</p>
                <p>KB-Artikel: {health.search.indexed_count.kb_articles}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Storage */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cloud className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="font-medium">Speicher</p>
                  <p className="text-sm text-muted-foreground">Datei-Uploads</p>
                </div>
              </div>
              {getStatusIcon(health?.storage?.status || 'ready')}
            </div>
            <Badge className="mt-2 bg-green-100 text-green-700">Bereit</Badge>
          </CardContent>
        </Card>
        
        {/* Email */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-medium">E-Mail</p>
                  <p className="text-sm text-muted-foreground">SMTP / M365</p>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <Badge className="mt-2 bg-green-100 text-green-700">Konfiguriert</Badge>
          </CardContent>
        </Card>
      </div>
      
      {/* Modules Status */}
      <Card>
        <CardHeader>
          <CardTitle>Modul-Status</CardTitle>
          <CardDescription>Aktive Features und Funktionen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {health?.modules && Object.entries(health.modules).map(([module, info]) => (
              <div key={module} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{module.replace('_', ' ')}</span>
                  <Badge className={getStatusColor(info.status)} variant="outline">
                    {info.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {info.features?.map(f => (
                    <span key={f} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivitätsprotokoll</CardTitle>
          <CardDescription>Letzte System-Aktivitäten</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Keine Aktivitäten</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 20).map((log, idx) => (
                  <div key={log.id || idx} className="flex items-center gap-3 text-sm p-2 hover:bg-slate-50 rounded">
                    <span className="text-xs text-muted-foreground w-32">
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </span>
                    <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                    <span className="flex-1">{log.action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// SETTINGS PAGE
// ============================================

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [automations, setAutomations] = useState([])
  const [recurringTickets, setRecurringTickets] = useState([])
  const [showPassword, setShowPassword] = useState({})
  const [testingConnection, setTestingConnection] = useState(null)
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [slaProfiles, setSlaProfiles] = useState([])
  
  // Form states for dialogs
  const [showAutomationDialog, setShowAutomationDialog] = useState(false)
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState(null)
  const [editingRecurring, setEditingRecurring] = useState(null)
  
  // Form state for new automation
  const [automationForm, setAutomationForm] = useState({
    name: '',
    description: '',
    trigger_type: 'ticket_created',
    trigger_conditions: {},
    action_type: 'assign',
    action_config: {},
    is_active: true
  })
  
  // Form state for recurring ticket
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    subject: '',
    description: '',
    priority: 'medium',
    schedule_type: 'weekly',
    schedule_day: 1,
    schedule_time: '09:00',
    organization_id: '',
    assignee_id: '',
    is_active: true
  })

  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [settingsData, automationsData, recurringData, usersData, orgsData, slaData] = await Promise.all([
        api.getSettings().catch(() => ({})),
        api.getAutomations().catch(() => []),
        api.getRecurringTickets().catch(() => []),
        api.getUsers().catch(() => []),
        api.getOrganizations().catch(() => []),
        api.getSLAProfiles().catch(() => [])
      ])
      
      // Parse settings values
      const parsedSettings = {}
      Object.entries(settingsData).forEach(([key, value]) => {
        try {
          parsedSettings[key] = typeof value === 'string' ? JSON.parse(value) : value
        } catch {
          parsedSettings[key] = value
        }
      })
      
      setSettings(parsedSettings)
      setAutomations(automationsData)
      setRecurringTickets(recurringData)
      setUsers(usersData)
      setOrganizations(orgsData)
      setSlaProfiles(slaData)
    } catch (error) {
      toast.error('Fehler beim Laden der Einstellungen')
    }
    setLoading(false)
  }
  
  const updateSetting = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }
  
  const saveSetting = async (key, value) => {
    try {
      await api.updateSetting({ key, value: JSON.stringify(value) })
      toast.success('Einstellung gespeichert')
    } catch (error) {
      toast.error('Fehler beim Speichern')
    }
  }
  
  const saveAllSettings = async (category) => {
    setSaving(true)
    try {
      const categorySettings = {}
      const categoryKeys = {
        general: ['company_name', 'company_email', 'company_phone', 'timezone', 'locale'],
        tickets: ['default_ticket_priority', 'default_ticket_status', 'auto_assign_enabled', 'sla_enabled'],
        integrations: ['openai_api_key', 'openai_model', 'openai_enabled', 'placetel_api_key', 'placetel_enabled', 'lexoffice_api_key', 'lexoffice_enabled'],
        email: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_address', 'imap_host', 'imap_port', 'imap_user', 'imap_password', 'email_to_ticket_enabled'],
        audit: ['log_retention_days', 'backup_enabled', 'backup_schedule'],
        rmm: ['rmm_enabled', 'rmm_heartbeat_interval', 'rmm_offline_threshold', 'rmm_auto_ticket_on_critical', 'tacticalrmm_enabled', 'tacticalrmm_api_url', 'tacticalrmm_api_key', 'tacticalrmm_sync_agents', 'tacticalrmm_sync_alerts', 'tacticalrmm_auto_ticket', 'rustdesk_enabled', 'rustdesk_id_server', 'rustdesk_relay_server', 'rustdesk_public_key', 'rustdesk_is_pro', 'rustdesk_api_server', 'rustdesk_api_key']
      }
      
      const keysToSave = categoryKeys[category] || []
      keysToSave.forEach(key => {
        if (settings[key] !== undefined) {
          categorySettings[key] = settings[key]
        }
      })
      
      await api.bulkUpdateSettings({ settings: categorySettings })
      toast.success('Einstellungen gespeichert')
    } catch (error) {
      toast.error('Fehler beim Speichern')
    }
    setSaving(false)
  }
  
  const testConnection = async (type) => {
    setTestingConnection(type)
    try {
      const config = {}
      if (type === 'smtp') {
        config.host = settings.smtp_host
        config.port = settings.smtp_port
        config.user = settings.smtp_user
        config.password = settings.smtp_password
      } else if (type === 'lexoffice') {
        config.api_key = settings.lexoffice_api_key
      } else if (type === 'placetel') {
        config.api_key = settings.placetel_api_key
      } else if (type === 'openai') {
        config.api_key = settings.openai_api_key
      }
      
      const result = await api.testConnection({ type, config })
      if (result.success) {
        toast.success(result.message || 'Verbindung erfolgreich')
      } else {
        toast.error(result.message || 'Verbindung fehlgeschlagen')
      }
    } catch (error) {
      toast.error('Verbindungstest fehlgeschlagen')
    }
    setTestingConnection(null)
  }
  
  const handleCreateAutomation = async () => {
    try {
      if (editingAutomation) {
        await api.updateAutomation(editingAutomation.id, automationForm)
        toast.success('Automation aktualisiert')
      } else {
        await api.createAutomation(automationForm)
        toast.success('Automation erstellt')
      }
      setShowAutomationDialog(false)
      setEditingAutomation(null)
      setAutomationForm({
        name: '',
        description: '',
        trigger_type: 'ticket_created',
        trigger_conditions: {},
        action_type: 'assign',
        action_config: {},
        is_active: true
      })
      loadData()
    } catch (error) {
      toast.error('Fehler beim Speichern der Automation')
    }
  }
  
  const handleDeleteAutomation = async (id) => {
    if (!confirm('Automation wirklich löschen?')) return
    try {
      await api.deleteAutomation(id)
      toast.success('Automation gelöscht')
      loadData()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const handleToggleAutomation = async (automation) => {
    try {
      await api.updateAutomation(automation.id, { is_active: !automation.is_active })
      loadData()
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }
  
  const handleCreateRecurring = async () => {
    try {
      if (editingRecurring) {
        await api.updateRecurringTicket(editingRecurring.id, recurringForm)
        toast.success('Wiederkehrendes Ticket aktualisiert')
      } else {
        await api.createRecurringTicket(recurringForm)
        toast.success('Wiederkehrendes Ticket erstellt')
      }
      setShowRecurringDialog(false)
      setEditingRecurring(null)
      setRecurringForm({
        name: '',
        subject: '',
        description: '',
        priority: 'medium',
        schedule_type: 'weekly',
        schedule_day: 1,
        schedule_time: '09:00',
        organization_id: '',
        assignee_id: '',
        is_active: true
      })
      loadData()
    } catch (error) {
      toast.error('Fehler beim Speichern')
    }
  }
  
  const handleDeleteRecurring = async (id) => {
    if (!confirm('Wiederkehrendes Ticket wirklich löschen?')) return
    try {
      await api.deleteRecurringTicket(id)
      toast.success('Gelöscht')
      loadData()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  const editAutomation = (automation) => {
    setEditingAutomation(automation)
    setAutomationForm({
      name: automation.name,
      description: automation.description || '',
      trigger_type: automation.trigger_type,
      trigger_conditions: automation.trigger_conditions || {},
      action_type: automation.action_type,
      action_config: automation.action_config || {},
      is_active: automation.is_active
    })
    setShowAutomationDialog(true)
  }
  
  const editRecurring = (recurring) => {
    setEditingRecurring(recurring)
    setRecurringForm({
      name: recurring.name,
      subject: recurring.subject,
      description: recurring.description || '',
      priority: recurring.priority || 'medium',
      schedule_type: recurring.schedule_type,
      schedule_day: recurring.schedule_day || 1,
      schedule_time: recurring.schedule_time || '09:00',
      organization_id: recurring.organization_id || '',
      assignee_id: recurring.assignee_id || '',
      is_active: recurring.is_active
    })
    setShowRecurringDialog(true)
  }
  
  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }))
  }
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('In Zwischenablage kopiert')
  }
  
  const TRIGGER_TYPES = {
    ticket_created: 'Ticket erstellt',
    ticket_updated: 'Ticket aktualisiert',
    status_changed: 'Status geändert',
    sla_breach: 'SLA-Verletzung',
    scheduled: 'Zeitgesteuert',
    task_due: 'Aufgabe fällig'
  }
  
  const ACTION_TYPES = {
    assign: 'Zuweisen',
    change_status: 'Status ändern',
    change_priority: 'Priorität ändern',
    add_tag: 'Tag hinzufügen',
    send_notification: 'Benachrichtigung senden',
    create_task: 'Aufgabe erstellen',
    escalate: 'Eskalieren'
  }
  
  const SCHEDULE_TYPES = {
    daily: 'Täglich',
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    yearly: 'Jährlich'
  }
  
  const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {[
                  { id: 'general', label: 'Allgemein', icon: Settings },
                  { id: 'tickets', label: 'Ticket-Standards', icon: Ticket },
                  { id: 'integrations', label: 'Integrationen', icon: Cloud },
                  { id: 'email', label: 'E-Mail', icon: Mail },
                  { id: 'rmm', label: 'RMM & Remote', icon: Monitor },
                  { id: 'automations', label: 'Automationen', icon: Zap },
                  { id: 'recurring', label: 'Wiederkehrende Tickets', icon: Repeat },
                  { id: 'audit', label: 'Audit & Backup', icon: Shield },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      activeTab === item.id 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Allgemeine Einstellungen
                </CardTitle>
                <CardDescription>Grundlegende Systemkonfiguration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Firmenname</Label>
                    <Input
                      value={settings.company_name || ''}
                      onChange={(e) => updateSetting('company_name', e.target.value)}
                      placeholder="IT REX Solutions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support E-Mail</Label>
                    <Input
                      type="email"
                      value={settings.company_email || ''}
                      onChange={(e) => updateSetting('company_email', e.target.value)}
                      placeholder="support@example.de"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefonnummer</Label>
                    <Input
                      value={settings.company_phone || ''}
                      onChange={(e) => updateSetting('company_phone', e.target.value)}
                      placeholder="+49 123 456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zeitzone</Label>
                    <Select
                      value={settings.timezone || 'Europe/Berlin'}
                      onValueChange={(v) => updateSetting('timezone', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="Europe/Vienna">Europe/Vienna</SelectItem>
                        <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sprache</Label>
                    <Select
                      value={settings.locale || 'de-DE'}
                      onValueChange={(v) => updateSetting('locale', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de-DE">Deutsch</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => saveAllSettings('general')} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Ticket Standards */}
          {activeTab === 'tickets' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Ticket-Standards
                </CardTitle>
                <CardDescription>Standardwerte und Verhaltensweisen für Tickets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Standard-Priorität</Label>
                    <Select
                      value={settings.default_ticket_priority || 'medium'}
                      onValueChange={(v) => updateSetting('default_ticket_priority', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                        <SelectItem value="critical">Kritisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Standard-Status</Label>
                    <Select
                      value={settings.default_ticket_status || 'open'}
                      onValueChange={(v) => updateSetting('default_ticket_status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Offen</SelectItem>
                        <SelectItem value="pending">Wartend</SelectItem>
                        <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Automatische Zuweisung</Label>
                      <p className="text-sm text-slate-500">Tickets automatisch an verfügbare Agenten zuweisen</p>
                    </div>
                    <Switch
                      checked={settings.auto_assign_enabled === true || settings.auto_assign_enabled === 'true'}
                      onCheckedChange={(v) => updateSetting('auto_assign_enabled', v)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">SLA-Überwachung</Label>
                      <p className="text-sm text-slate-500">SLA-Zeiten automatisch berechnen und überwachen</p>
                    </div>
                    <Switch
                      checked={settings.sla_enabled !== false && settings.sla_enabled !== 'false'}
                      onCheckedChange={(v) => updateSetting('sla_enabled', v)}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => saveAllSettings('tickets')} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Integrations */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* OpenAI Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Zap className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">OpenAI</CardTitle>
                        <CardDescription>KI-gestützte Funktionen (Zusammenfassungen, Diktat)</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.openai_enabled === true || settings.openai_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('openai_enabled', v)
                        saveSetting('openai_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API-Schlüssel</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword.openai ? 'text' : 'password'}
                          value={settings.openai_api_key || ''}
                          onChange={(e) => updateSetting('openai_api_key', e.target.value)}
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('openai')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => testConnection('openai')}
                        disabled={testingConnection === 'openai'}
                      >
                        {testingConnection === 'openai' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testen'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Wird für Ticket-Zusammenfassungen und Sprach-zu-Text verwendet
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Modell</Label>
                    <Select
                      value={settings.openai_model || 'gpt-4o-mini'}
                      onValueChange={(v) => {
                        updateSetting('openai_model', v)
                        saveSetting('openai_model', v)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (schnell, günstig)</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (beste Qualität)</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => saveSetting('openai_api_key', settings.openai_api_key)} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      API-Key speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Placetel Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <PhoneCall className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Placetel</CardTitle>
                        <CardDescription>Telefonie-Integration (Anrufe, Webhooks, CTI)</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.placetel_enabled === true || settings.placetel_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('placetel_enabled', v)
                        saveSetting('placetel_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API-Token</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword.placetel ? 'text' : 'password'}
                          value={settings.placetel_api_token || settings.placetel_api_key || ''}
                          onChange={(e) => {
                            updateSetting('placetel_api_token', e.target.value)
                            updateSetting('placetel_api_key', e.target.value)
                          }}
                          placeholder="Placetel API Token..."
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('placetel')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.placetel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => testConnection('placetel')}
                        disabled={testingConnection === 'placetel'}
                      >
                        {testingConnection === 'placetel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testen'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">API-Token aus dem Placetel Kundencenter → API-Zugang</p>
                  </div>
                  <div className="space-y-2">
                    <Label>SIP-Benutzer / Nebenstelle</Label>
                    <Input
                      value={settings.placetel_sip_user || ''}
                      onChange={(e) => updateSetting('placetel_sip_user', e.target.value)}
                      placeholder="z.B. 123456789"
                    />
                    <p className="text-xs text-slate-500">Ihre Placetel SIP-Nummer für ausgehende Anrufe</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook-URL für Placetel</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/cti/placetel/webhook`}
                        className="bg-slate-50 font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/cti/placetel/webhook`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Im Placetel Kundencenter unter "Einstellungen → Webhooks" eintragen
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook-Secret (optional)</Label>
                    <Input
                      type="password"
                      value={settings.placetel_webhook_secret || ''}
                      onChange={(e) => updateSetting('placetel_webhook_secret', e.target.value)}
                      placeholder="Optionales Secret zur Webhook-Verifizierung"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => saveSetting('placetel_api_key', settings.placetel_api_key)} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      API-Key speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Lexoffice Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Lexoffice</CardTitle>
                        <CardDescription>Buchhaltung & Rechnungen</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.lexoffice_enabled === true || settings.lexoffice_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('lexoffice_enabled', v)
                        saveSetting('lexoffice_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API-Schlüssel</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword.lexoffice ? 'text' : 'password'}
                          value={settings.lexoffice_api_key || ''}
                          onChange={(e) => updateSetting('lexoffice_api_key', e.target.value)}
                          placeholder="Lexoffice API Key..."
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('lexoffice')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.lexoffice ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => testConnection('lexoffice')}
                        disabled={testingConnection === 'lexoffice'}
                      >
                        {testingConnection === 'lexoffice' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testen'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Für automatische Rechnungserstellung aus Zeiteinträgen
                    </p>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => saveSetting('lexoffice_api_key', settings.lexoffice_api_key)} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      API-Key speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Chatwoot Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Chatwoot</CardTitle>
                        <CardDescription>Omnichannel-Chat (WhatsApp, Web, E-Mail)</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.chatwoot_enabled === true || settings.chatwoot_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('chatwoot_enabled', v)
                        saveSetting('chatwoot_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chatwoot URL</Label>
                      <Input
                        value={settings.chatwoot_api_url || ''}
                        onChange={(e) => updateSetting('chatwoot_api_url', e.target.value)}
                        placeholder="https://app.chatwoot.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account ID</Label>
                      <Input
                        value={settings.chatwoot_account_id || ''}
                        onChange={(e) => updateSetting('chatwoot_account_id', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>API Token</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword.chatwoot ? 'text' : 'password'}
                          value={settings.chatwoot_api_token || ''}
                          onChange={(e) => updateSetting('chatwoot_api_token', e.target.value)}
                          placeholder="Chatwoot API Token..."
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('chatwoot')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.chatwoot ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>SSO Secret</Label>
                    <Input
                      type="password"
                      value={settings.chatwoot_sso_secret || ''}
                      onChange={(e) => updateSetting('chatwoot_sso_secret', e.target.value)}
                      placeholder="Für Single Sign-On..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook-URL (in Chatwoot eintragen)</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/chatwoot`}
                        className="bg-slate-50"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/chatwoot`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.chatwoot_auto_create_ticket === true || settings.chatwoot_auto_create_ticket === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('chatwoot_auto_create_ticket', v)
                        saveSetting('chatwoot_auto_create_ticket', v)
                      }}
                    />
                    <Label>Automatisch Ticket bei neuer Konversation erstellen</Label>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={async () => {
                      await saveSetting('chatwoot_api_url', settings.chatwoot_api_url)
                      await saveSetting('chatwoot_api_token', settings.chatwoot_api_token)
                      await saveSetting('chatwoot_account_id', settings.chatwoot_account_id)
                      await saveSetting('chatwoot_sso_secret', settings.chatwoot_sso_secret)
                      toast.success('Chatwoot-Einstellungen gespeichert')
                    }} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* n8n Automation Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Webhook className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">n8n Automation</CardTitle>
                        <CardDescription>Workflow-Automatisierung & Webhooks</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.n8n_enabled === true || settings.n8n_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('n8n_enabled', v)
                        saveSetting('n8n_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>n8n URL (optional)</Label>
                    <Input
                      value={settings.n8n_url || ''}
                      onChange={(e) => updateSetting('n8n_url', e.target.value)}
                      placeholder="https://n8n.example.com"
                    />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <Label className="font-medium">Verfügbare Webhook-Endpoints:</Label>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <code className="text-xs bg-slate-200 px-2 py-1 rounded">/api/webhooks/n8n/ticket-created</code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/n8n/ticket-created`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex justify-between items-center">
                        <code className="text-xs bg-slate-200 px-2 py-1 rounded">/api/webhooks/n8n/ticket-updated</code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/n8n/ticket-updated`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex justify-between items-center">
                        <code className="text-xs bg-slate-200 px-2 py-1 rounded">/api/webhooks/n8n/message-received</code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/n8n/message-received`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex justify-between items-center">
                        <code className="text-xs bg-slate-200 px-2 py-1 rounded">/api/webhooks/n8n/contact-updated</code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/n8n/contact-updated`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Diese Endpoints können in n8n als HTTP-Trigger verwendet werden, um Automatisierungen auszulösen.
                  </p>
                </CardContent>
              </Card>
              
              {/* Microsoft 365 OAuth Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Cloud className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Microsoft 365 OAuth</CardTitle>
                        <CardDescription>OAuth-Login für Kunden und E-Mail-Integration</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.m365_oauth_enabled === true || settings.m365_oauth_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('m365_oauth_enabled', v)
                        saveSetting('m365_oauth_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Application (Client) ID</Label>
                    <Input
                      value={settings.m365_client_id || ''}
                      onChange={(e) => updateSetting('m365_client_id', e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <div className="relative">
                      <Input
                        type={showPassword.m365 ? 'text' : 'password'}
                        value={settings.m365_client_secret || ''}
                        onChange={(e) => updateSetting('m365_client_secret', e.target.value)}
                        placeholder="Client Secret..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => ({ ...p, m365: !p.m365 }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword.m365 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tenant ID (optional)</Label>
                    <Input
                      value={settings.m365_tenant_id || ''}
                      onChange={(e) => updateSetting('m365_tenant_id', e.target.value)}
                      placeholder="common (für Multi-Tenant)"
                    />
                    <p className="text-xs text-slate-500">Leer lassen oder "common" für Multi-Tenant Apps</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Redirect URIs für Azure App:</h4>
                    <code className="text-xs bg-white p-1 rounded block mb-1">{process.env.NEXT_PUBLIC_BASE_URL}/api/auth/m365/callback</code>
                    <code className="text-xs bg-white p-1 rounded block">{process.env.NEXT_PUBLIC_BASE_URL}/api/m365/email/callback</code>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <h4 className="font-medium text-sm text-amber-800 mb-2">📋 Azure App-Registrierung (Anleitung):</h4>
                    <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                      <li>Gehen Sie zu <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" className="underline">Azure Portal → App-Registrierungen</a></li>
                      <li>Klicken Sie auf "Neue Registrierung"</li>
                      <li>Name: "IT REX ServiceDesk" (o.ä.)</li>
                      <li>Unterstützte Kontotypen: "Konten in einem beliebigen Organisationsverzeichnis"</li>
                      <li>Redirect URI: Kopieren Sie die obigen URIs</li>
                      <li>Nach Erstellung: Kopieren Sie die "Anwendungs-ID (Client)" hier ein</li>
                      <li>Unter "Zertifikate & Geheimnisse" → Neuer geheimer Clientschlüssel erstellen</li>
                      <li>API-Berechtigungen hinzufügen: User.Read, Mail.Read, Mail.Send</li>
                    </ol>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const { url } = await api.fetch('/m365/email/connect', {
                            method: 'POST',
                            body: JSON.stringify({ organization_id: null, user_id: null })
                          })
                          if (url) window.location.href = url
                        } catch { toast.error('Verbindung fehlgeschlagen') }
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      E-Mail-Konto verbinden
                    </Button>
                    <Button onClick={() => saveAllSettings('m365')} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* SMTP */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    SMTP (Ausgehende E-Mails)
                  </CardTitle>
                  <CardDescription>Konfiguration für den E-Mail-Versand</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP-Server</Label>
                      <Input
                        value={settings.smtp_host || ''}
                        onChange={(e) => updateSetting('smtp_host', e.target.value)}
                        placeholder="smtp.example.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        value={settings.smtp_port || '587'}
                        onChange={(e) => updateSetting('smtp_port', e.target.value)}
                        placeholder="587"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Benutzername</Label>
                      <Input
                        value={settings.smtp_user || ''}
                        onChange={(e) => updateSetting('smtp_user', e.target.value)}
                        placeholder="user@example.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passwort</Label>
                      <div className="relative">
                        <Input
                          type={showPassword.smtp ? 'text' : 'password'}
                          value={settings.smtp_password || ''}
                          onChange={(e) => updateSetting('smtp_password', e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('smtp')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.smtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Absender-Adresse</Label>
                      <Input
                        type="email"
                        value={settings.smtp_from_address || ''}
                        onChange={(e) => updateSetting('smtp_from_address', e.target.value)}
                        placeholder="support@example.de"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => testConnection('smtp')}
                      disabled={testingConnection === 'smtp'}
                    >
                      {testingConnection === 'smtp' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Verbindung testen
                    </Button>
                    <Button onClick={() => saveAllSettings('smtp')}>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg mt-4">
                    <h4 className="font-medium text-sm text-blue-800 mb-2">💡 SMTP-Einstellungen für Microsoft 365:</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Server: <code className="bg-white px-1 rounded">smtp.office365.com</code></li>
                      <li>• Port: <code className="bg-white px-1 rounded">587</code></li>
                      <li>• Benutzername: Ihre vollständige E-Mail-Adresse</li>
                      <li>• Passwort: App-Passwort (nicht Ihr normales Passwort!)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              
              {/* IMAP */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        IMAP (E-Mail zu Ticket)
                      </CardTitle>
                      <CardDescription>Eingehende E-Mails automatisch als Tickets anlegen</CardDescription>
                    </div>
                    <Switch
                      checked={settings.email_to_ticket_enabled === true || settings.email_to_ticket_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('email_to_ticket_enabled', v)
                        saveSetting('email_to_ticket_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IMAP-Server</Label>
                      <Input
                        value={settings.imap_host || ''}
                        onChange={(e) => updateSetting('imap_host', e.target.value)}
                        placeholder="imap.example.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        value={settings.imap_port || '993'}
                        onChange={(e) => updateSetting('imap_port', e.target.value)}
                        placeholder="993"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Benutzername</Label>
                      <Input
                        value={settings.imap_user || ''}
                        onChange={(e) => updateSetting('imap_user', e.target.value)}
                        placeholder="user@example.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passwort</Label>
                      <div className="relative">
                        <Input
                          type={showPassword.imap ? 'text' : 'password'}
                          value={settings.imap_password || ''}
                          onChange={(e) => updateSetting('imap_password', e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('imap')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword.imap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => testConnection('imap')}
                      disabled={testingConnection === 'imap'}
                    >
                      {testingConnection === 'imap' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Verbindung testen
                    </Button>
                    <Button onClick={() => saveAllSettings('imap')}>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg mt-4">
                    <h4 className="font-medium text-sm text-blue-800 mb-2">💡 IMAP-Einstellungen für Microsoft 365:</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Server: <code className="bg-white px-1 rounded">outlook.office365.com</code></li>
                      <li>• Port: <code className="bg-white px-1 rounded">993</code> (SSL)</li>
                      <li>• Benutzername: Ihre vollständige E-Mail-Adresse</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    const email = prompt('Test-E-Mail senden an:')
                    if (!email) return
                    try {
                      await api.fetch('/email/send', {
                        method: 'POST',
                        body: JSON.stringify({
                          to: email,
                          subject: 'IT REX ServiceDesk - Test-E-Mail',
                          body: 'Diese E-Mail bestätigt, dass Ihre SMTP-Einstellungen korrekt konfiguriert sind.\n\nMit freundlichen Grüßen,\nIT REX Solutions'
                        })
                      })
                      toast.success('Test-E-Mail wurde gesendet!')
                    } catch (error) {
                      toast.error('Fehler beim Senden: ' + (error.message || 'Unbekannter Fehler'))
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test-E-Mail senden
                </Button>
                <Button onClick={() => saveAllSettings('email')} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Alle E-Mail-Einstellungen speichern
                </Button>
              </div>
            </div>
          )}
          
          {/* RMM & Remote Settings */}
          {activeTab === 'rmm' && (
            <div className="space-y-6">
              {/* RMM Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        RMM-Einstellungen
                      </CardTitle>
                      <CardDescription>Remote Monitoring & Management Konfiguration</CardDescription>
                    </div>
                    <Switch
                      checked={settings.rmm_enabled === true || settings.rmm_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rmm_enabled', v)
                        saveSetting('rmm_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Heartbeat-Intervall (Sekunden)</Label>
                      <Input
                        type="number"
                        value={settings.rmm_heartbeat_interval || 60}
                        onChange={(e) => updateSetting('rmm_heartbeat_interval', parseInt(e.target.value))}
                        onBlur={() => saveSetting('rmm_heartbeat_interval', settings.rmm_heartbeat_interval)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Offline-Schwellwert (Sekunden)</Label>
                      <Input
                        type="number"
                        value={settings.rmm_offline_threshold || 300}
                        onChange={(e) => updateSetting('rmm_offline_threshold', parseInt(e.target.value))}
                        onBlur={() => saveSetting('rmm_offline_threshold', settings.rmm_offline_threshold)}
                      />
                      <p className="text-xs text-muted-foreground">Zeit bis Gerät als offline gilt</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.rmm_auto_ticket_on_critical === true || settings.rmm_auto_ticket_on_critical === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rmm_auto_ticket_on_critical', v)
                        saveSetting('rmm_auto_ticket_on_critical', v)
                      }}
                    />
                    <Label>Automatisch Ticket bei kritischen Alerts erstellen</Label>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Agent-Installation</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Um Geräte zu überwachen, installieren Sie den IT REX RMM Agent auf den Kundengeräten.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open('/agent/itrex-rmm-agent.ps1', '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        Windows Agent
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open('/agent/itrex-rmm-agent.sh', '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        Linux Agent
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* TacticalRMM Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-green-600" />
                        TacticalRMM Integration
                      </CardTitle>
                      <CardDescription>
                        Verbindung zu Ihrer selbst-gehosteten TacticalRMM-Instanz
                      </CardDescription>
                    </div>
                    <Switch
                      checked={settings.tacticalrmm_enabled === true || settings.tacticalrmm_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('tacticalrmm_enabled', v)
                        saveSetting('tacticalrmm_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>TacticalRMM API URL</Label>
                      <Input
                        value={settings.tacticalrmm_api_url || ''}
                        onChange={(e) => updateSetting('tacticalrmm_api_url', e.target.value)}
                        onBlur={() => saveSetting('tacticalrmm_api_url', settings.tacticalrmm_api_url)}
                        placeholder="https://api.tacticalrmm.ihredomain.de"
                      />
                      <p className="text-xs text-muted-foreground">Die API-URL Ihrer TacticalRMM-Installation</p>
                    </div>
                    <div className="space-y-2">
                      <Label>TacticalRMM API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={settings.tacticalrmm_api_key || ''}
                          onChange={(e) => updateSetting('tacticalrmm_api_key', e.target.value)}
                          onBlur={() => saveSetting('tacticalrmm_api_key', settings.tacticalrmm_api_key)}
                          placeholder="Ihr TacticalRMM API Key"
                        />
                        <Button variant="outline" onClick={async () => {
                          if (!settings.tacticalrmm_api_url || !settings.tacticalrmm_api_key) {
                            toast.error('Bitte API URL und Key eingeben')
                            return
                          }
                          try {
                            const result = await api.fetch('/tacticalrmm/sync', {
                              method: 'POST',
                              body: JSON.stringify({ sync_type: 'clients' })
                            })
                            if (result.success) {
                              toast.success(`Verbindung OK! ${result.stats?.processed || 0} Clients gefunden`)
                            }
                          } catch (e) {
                            toast.error('Verbindung fehlgeschlagen')
                          }
                        }}>
                          Testen
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_sync_agents === true || settings.tacticalrmm_sync_agents === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_sync_agents', v)
                          saveSetting('tacticalrmm_sync_agents', v)
                        }}
                      />
                      <Label className="text-sm">Agents sync</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_sync_alerts === true || settings.tacticalrmm_sync_alerts === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_sync_alerts', v)
                          saveSetting('tacticalrmm_sync_alerts', v)
                        }}
                      />
                      <Label className="text-sm">Alerts sync</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_auto_ticket === true || settings.tacticalrmm_auto_ticket === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_auto_ticket', v)
                          saveSetting('tacticalrmm_auto_ticket', v)
                        }}
                      />
                      <Label className="text-sm">Auto-Ticket</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* RustDesk Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-orange-600" />
                        RustDesk Integration
                      </CardTitle>
                      <CardDescription>Selbst-gehosteter Remote-Desktop</CardDescription>
                    </div>
                    <Switch
                      checked={settings.rustdesk_enabled === true || settings.rustdesk_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rustdesk_enabled', v)
                        saveSetting('rustdesk_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RustDesk ID Server</Label>
                      <Input
                        value={settings.rustdesk_id_server || ''}
                        onChange={(e) => updateSetting('rustdesk_id_server', e.target.value)}
                        onBlur={() => saveSetting('rustdesk_id_server', settings.rustdesk_id_server)}
                        placeholder="rustdesk.ihredomain.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RustDesk Relay Server</Label>
                      <Input
                        value={settings.rustdesk_relay_server || ''}
                        onChange={(e) => updateSetting('rustdesk_relay_server', e.target.value)}
                        onBlur={() => saveSetting('rustdesk_relay_server', settings.rustdesk_relay_server)}
                        placeholder="(gleich wie ID Server)"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>RustDesk Public Key</Label>
                    <Textarea
                      value={settings.rustdesk_public_key || ''}
                      onChange={(e) => updateSetting('rustdesk_public_key', e.target.value)}
                      onBlur={() => saveSetting('rustdesk_public_key', settings.rustdesk_public_key)}
                      placeholder="Public Key aus id_ed25519.pub"
                      rows={2}
                    />
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800 mb-2">RustDesk Downloads</h4>
                    <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/rustdesk/rustdesk/releases', '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      RustDesk Client herunterladen
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex justify-end">
                <Button onClick={() => saveSettingsCategory('rmm')}>
                  <Save className="h-4 w-4 mr-2" />
                  Alle RMM-Einstellungen speichern
                </Button>
              </div>
            </div>
          )}
          
          {/* Automations */}
          {activeTab === 'automations' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Automationen
                    </CardTitle>
                    <CardDescription>Automatische Aktionen basierend auf Triggern (WENN... DANN...)</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingAutomation(null)
                    setAutomationForm({
                      name: '',
                      description: '',
                      trigger_type: 'ticket_created',
                      trigger_conditions: {},
                      action_type: 'assign',
                      action_config: {},
                      is_active: true
                    })
                    setShowAutomationDialog(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Neue Automation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {automations.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Zap className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Noch keine Automationen konfiguriert</p>
                    <p className="text-sm">Erstellen Sie Regeln, um wiederkehrende Aufgaben zu automatisieren</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {automations.map(automation => (
                      <div 
                        key={automation.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          automation.is_active ? 'bg-white' : 'bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={automation.is_active}
                            onCheckedChange={() => handleToggleAutomation(automation)}
                          />
                          <div>
                            <div className="font-medium">{automation.name}</div>
                            <div className="text-sm text-slate-500">
                              WENN <Badge variant="secondary">{TRIGGER_TYPES[automation.trigger_type]}</Badge>
                              {' → '}
                              DANN <Badge variant="secondary">{ACTION_TYPES[automation.action_type]}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => editAutomation(automation)}>
                            Bearbeiten
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteAutomation(automation.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Recurring Tickets */}
          {activeTab === 'recurring' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Repeat className="h-5 w-5" />
                      Wiederkehrende Tickets
                    </CardTitle>
                    <CardDescription>Automatisch erstellte Tickets nach Zeitplan</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingRecurring(null)
                    setRecurringForm({
                      name: '',
                      subject: '',
                      description: '',
                      priority: 'medium',
                      schedule_type: 'weekly',
                      schedule_day: 1,
                      schedule_time: '09:00',
                      organization_id: '',
                      assignee_id: '',
                      is_active: true
                    })
                    setShowRecurringDialog(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Neues wiederkehrendes Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recurringTickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Repeat className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Keine wiederkehrenden Tickets konfiguriert</p>
                    <p className="text-sm">Erstellen Sie Tickets, die automatisch nach Zeitplan erstellt werden</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aktiv</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Betreff</TableHead>
                        <TableHead>Zeitplan</TableHead>
                        <TableHead>Nächste Ausführung</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurringTickets.map(recurring => (
                        <TableRow key={recurring.id} className={!recurring.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <Switch
                              checked={recurring.is_active}
                              onCheckedChange={async () => {
                                await api.updateRecurringTicket(recurring.id, { is_active: !recurring.is_active })
                                loadData()
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{recurring.name}</TableCell>
                          <TableCell>{recurring.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {SCHEDULE_TYPES[recurring.schedule_type]}
                              {recurring.schedule_type === 'weekly' && `, ${WEEKDAYS[recurring.schedule_day]}`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {recurring.next_run_at ? formatDateTime(recurring.next_run_at) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => editRecurring(recurring)}>
                                Bearbeiten
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteRecurring(recurring.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Audit & Backup */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit-Protokollierung
                  </CardTitle>
                  <CardDescription>Einstellungen für Protokollierung und Datenhaltung</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Log-Aufbewahrungsdauer (Tage)</Label>
                    <Select
                      value={String(settings.log_retention_days || '90')}
                      onValueChange={(v) => {
                        updateSetting('log_retention_days', parseInt(v))
                        saveSetting('log_retention_days', parseInt(v))
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Tage</SelectItem>
                        <SelectItem value="60">60 Tage</SelectItem>
                        <SelectItem value="90">90 Tage</SelectItem>
                        <SelectItem value="180">180 Tage</SelectItem>
                        <SelectItem value="365">1 Jahr</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Ältere Protokolleinträge werden automatisch gelöscht
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Archive className="h-5 w-5" />
                        Backup-Einstellungen
                      </CardTitle>
                      <CardDescription>Datensicherung und Wiederherstellung</CardDescription>
                    </div>
                    <Switch
                      checked={settings.backup_enabled === true || settings.backup_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('backup_enabled', v)
                        saveSetting('backup_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Backup-Zeitplan</Label>
                    <Select
                      value={settings.backup_schedule || 'daily'}
                      onValueChange={(v) => {
                        updateSetting('backup_schedule', v)
                        saveSetting('backup_schedule', v)
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Täglich</SelectItem>
                        <SelectItem value="weekly">Wöchentlich</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <BackupManagement />
                </CardContent>
              </Card>
              
              {/* RMM Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        RMM-Einstellungen
                      </CardTitle>
                      <CardDescription>Remote Monitoring & Management Konfiguration</CardDescription>
                    </div>
                    <Switch
                      checked={settings.rmm_enabled === true || settings.rmm_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rmm_enabled', v)
                        saveSetting('rmm_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Heartbeat-Intervall (Sekunden)</Label>
                      <Input
                        type="number"
                        value={settings.rmm_heartbeat_interval || 60}
                        onChange={(e) => updateSetting('rmm_heartbeat_interval', parseInt(e.target.value))}
                        onBlur={() => saveSetting('rmm_heartbeat_interval', settings.rmm_heartbeat_interval)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Offline-Schwellwert (Sekunden)</Label>
                      <Input
                        type="number"
                        value={settings.rmm_offline_threshold || 300}
                        onChange={(e) => updateSetting('rmm_offline_threshold', parseInt(e.target.value))}
                        onBlur={() => saveSetting('rmm_offline_threshold', settings.rmm_offline_threshold)}
                      />
                      <p className="text-xs text-muted-foreground">Zeit bis Gerät als offline gilt</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.rmm_auto_ticket_on_critical === true || settings.rmm_auto_ticket_on_critical === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rmm_auto_ticket_on_critical', v)
                        saveSetting('rmm_auto_ticket_on_critical', v)
                      }}
                    />
                    <Label>Automatisch Ticket bei kritischen Alerts erstellen</Label>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Agent-Installation</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Um Geräte zu überwachen, installieren Sie den IT REX RMM Agent auf den Kundengeräten.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open('/agent/itrex-rmm-agent.ps1', '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        Windows Agent (PowerShell)
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open('/agent/itrex-rmm-agent.sh', '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        Linux Agent (Bash)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* TacticalRMM Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-green-600" />
                        TacticalRMM Integration
                      </CardTitle>
                      <CardDescription>
                        Verbindung zu Ihrer selbst-gehosteten TacticalRMM-Instanz
                        <a href="https://docs.tacticalrmm.com/" target="_blank" rel="noopener" className="ml-1 text-blue-500 hover:underline">
                          (Dokumentation)
                        </a>
                      </CardDescription>
                    </div>
                    <Switch
                      checked={settings.tacticalrmm_enabled === true || settings.tacticalrmm_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('tacticalrmm_enabled', v)
                        saveSetting('tacticalrmm_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>TacticalRMM API URL</Label>
                      <Input
                        value={settings.tacticalrmm_api_url || ''}
                        onChange={(e) => updateSetting('tacticalrmm_api_url', e.target.value)}
                        onBlur={() => saveSetting('tacticalrmm_api_url', settings.tacticalrmm_api_url)}
                        placeholder="https://api.tacticalrmm.ihredomain.de"
                      />
                      <p className="text-xs text-muted-foreground">Die API-URL Ihrer TacticalRMM-Installation (ohne trailing slash)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>TacticalRMM API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={settings.tacticalrmm_api_key || ''}
                          onChange={(e) => updateSetting('tacticalrmm_api_key', e.target.value)}
                          onBlur={() => saveSetting('tacticalrmm_api_key', settings.tacticalrmm_api_key)}
                          placeholder="Ihr TacticalRMM API Key"
                        />
                        <Button variant="outline" onClick={async () => {
                          if (!settings.tacticalrmm_api_url || !settings.tacticalrmm_api_key) {
                            toast.error('Bitte API URL und Key eingeben')
                            return
                          }
                          try {
                            const result = await api.fetch('/tacticalrmm/sync', {
                              method: 'POST',
                              body: JSON.stringify({ sync_type: 'clients' })
                            })
                            if (result.success) {
                              toast.success(`Verbindung OK! ${result.stats?.processed || 0} Clients gefunden`)
                            }
                          } catch (e) {
                            toast.error('Verbindung fehlgeschlagen: ' + e.message)
                          }
                        }}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Testen
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        API Key erstellen unter: TacticalRMM → Settings → Global Settings → API Keys
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_sync_agents === true || settings.tacticalrmm_sync_agents === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_sync_agents', v)
                          saveSetting('tacticalrmm_sync_agents', v)
                        }}
                      />
                      <Label className="text-sm">Agents synchronisieren</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_sync_alerts === true || settings.tacticalrmm_sync_alerts === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_sync_alerts', v)
                          saveSetting('tacticalrmm_sync_alerts', v)
                        }}
                      />
                      <Label className="text-sm">Alerts synchronisieren</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.tacticalrmm_auto_ticket === true || settings.tacticalrmm_auto_ticket === 'true'}
                        onCheckedChange={(v) => {
                          updateSetting('tacticalrmm_auto_ticket', v)
                          saveSetting('tacticalrmm_auto_ticket', v)
                        }}
                      />
                      <Label className="text-sm">Auto-Ticket bei Alert</Label>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={async () => {
                      try {
                        const result = await api.fetch('/tacticalrmm/sync', {
                          method: 'POST',
                          body: JSON.stringify({ sync_type: 'full' })
                        })
                        toast.success(`Sync abgeschlossen: ${result.stats?.processed || 0} Items verarbeitet`)
                      } catch (e) {
                        toast.error('Sync fehlgeschlagen: ' + e.message)
                      }
                    }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Jetzt synchronisieren
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* RustDesk Integration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-orange-600" />
                        RustDesk Integration
                      </CardTitle>
                      <CardDescription>
                        Selbst-gehosteter Remote-Desktop (Alternative zu TeamViewer/AnyDesk)
                        <a href="https://rustdesk.com/docs/" target="_blank" rel="noopener" className="ml-1 text-blue-500 hover:underline">
                          (Dokumentation)
                        </a>
                      </CardDescription>
                    </div>
                    <Switch
                      checked={settings.rustdesk_enabled === true || settings.rustdesk_enabled === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rustdesk_enabled', v)
                        saveSetting('rustdesk_enabled', v)
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RustDesk ID Server</Label>
                      <Input
                        value={settings.rustdesk_id_server || ''}
                        onChange={(e) => updateSetting('rustdesk_id_server', e.target.value)}
                        onBlur={() => saveSetting('rustdesk_id_server', settings.rustdesk_id_server)}
                        placeholder="rustdesk.ihredomain.de"
                      />
                      <p className="text-xs text-muted-foreground">Hostname oder IP des ID-Servers (hbbs)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>RustDesk Relay Server</Label>
                      <Input
                        value={settings.rustdesk_relay_server || ''}
                        onChange={(e) => updateSetting('rustdesk_relay_server', e.target.value)}
                        onBlur={() => saveSetting('rustdesk_relay_server', settings.rustdesk_relay_server)}
                        placeholder="(gleich wie ID Server wenn leer)"
                      />
                      <p className="text-xs text-muted-foreground">Hostname oder IP des Relay-Servers (hbbr)</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>RustDesk Public Key</Label>
                    <Textarea
                      value={settings.rustdesk_public_key || ''}
                      onChange={(e) => updateSetting('rustdesk_public_key', e.target.value)}
                      onBlur={() => saveSetting('rustdesk_public_key', settings.rustdesk_public_key)}
                      placeholder="Der Public Key aus id_ed25519.pub"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Public Key für End-to-End-Verschlüsselung (Optional, aber empfohlen)
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.rustdesk_is_pro === true || settings.rustdesk_is_pro === 'true'}
                      onCheckedChange={(v) => {
                        updateSetting('rustdesk_is_pro', v)
                        saveSetting('rustdesk_is_pro', v)
                      }}
                    />
                    <Label>RustDesk Pro (mit API-Zugang)</Label>
                  </div>
                  
                  {(settings.rustdesk_is_pro === true || settings.rustdesk_is_pro === 'true') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>RustDesk Pro API Server</Label>
                        <Input
                          value={settings.rustdesk_api_server || ''}
                          onChange={(e) => updateSetting('rustdesk_api_server', e.target.value)}
                          onBlur={() => saveSetting('rustdesk_api_server', settings.rustdesk_api_server)}
                          placeholder="https://api.rustdesk.ihredomain.de"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key (Pro)</Label>
                        <Input
                          type="password"
                          value={settings.rustdesk_api_key || ''}
                          onChange={(e) => updateSetting('rustdesk_api_key', e.target.value)}
                          onBlur={() => saveSetting('rustdesk_api_key', settings.rustdesk_api_key)}
                          placeholder="RustDesk Pro API Key"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800 mb-2">RustDesk Client installieren</h4>
                    <p className="text-sm text-orange-700 mb-3">
                      Auf Kundengeräten muss der RustDesk Client installiert sein.
                      Die Server-Einstellungen werden automatisch über den Enrollment-Prozess konfiguriert.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/rustdesk/rustdesk/releases', '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        RustDesk Downloads
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      {/* Automation Dialog */}
      <Dialog open={showAutomationDialog} onOpenChange={setShowAutomationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? 'Automation bearbeiten' : 'Neue Automation'}</DialogTitle>
            <DialogDescription>
              Definieren Sie Trigger und Aktionen für automatische Workflows
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={automationForm.name}
                onChange={(e) => setAutomationForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Kritische Tickets automatisch eskalieren"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={automationForm.description}
                onChange={(e) => setAutomationForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung der Automation..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WENN (Trigger)</Label>
                <Select
                  value={automationForm.trigger_type}
                  onValueChange={(v) => setAutomationForm(prev => ({ ...prev, trigger_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DANN (Aktion)</Label>
                <Select
                  value={automationForm.action_type}
                  onValueChange={(v) => setAutomationForm(prev => ({ ...prev, action_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={automationForm.is_active}
                onCheckedChange={(v) => setAutomationForm(prev => ({ ...prev, is_active: v }))}
              />
              <Label>Automation aktivieren</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreateAutomation} disabled={!automationForm.name}>
              {editingAutomation ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Recurring Ticket Dialog */}
      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecurring ? 'Wiederkehrendes Ticket bearbeiten' : 'Neues wiederkehrendes Ticket'}</DialogTitle>
            <DialogDescription>
              Definieren Sie ein Ticket, das automatisch nach Zeitplan erstellt wird
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Interner Name</Label>
              <Input
                value={recurringForm.name}
                onChange={(e) => setRecurringForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Wöchentliche Server-Wartung"
              />
            </div>
            <div className="space-y-2">
              <Label>Ticket-Betreff</Label>
              <Input
                value={recurringForm.subject}
                onChange={(e) => setRecurringForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="z.B. Server-Wartung KW {week}"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={recurringForm.description}
                onChange={(e) => setRecurringForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ticket-Beschreibung..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zeitplan</Label>
                <Select
                  value={recurringForm.schedule_type}
                  onValueChange={(v) => setRecurringForm(prev => ({ ...prev, schedule_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCHEDULE_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {recurringForm.schedule_type === 'weekly' && (
                <div className="space-y-2">
                  <Label>Wochentag</Label>
                  <Select
                    value={String(recurringForm.schedule_day)}
                    onValueChange={(v) => setRecurringForm(prev => ({ ...prev, schedule_day: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {recurringForm.schedule_type === 'monthly' && (
                <div className="space-y-2">
                  <Label>Tag im Monat</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={recurringForm.schedule_day}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, schedule_day: parseInt(e.target.value) }))}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Uhrzeit</Label>
                <Input
                  type="time"
                  value={recurringForm.schedule_time}
                  onChange={(e) => setRecurringForm(prev => ({ ...prev, schedule_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Priorität</Label>
                <Select
                  value={recurringForm.priority}
                  onValueChange={(v) => setRecurringForm(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Select
                  value={recurringForm.organization_id || 'none'}
                  onValueChange={(v) => setRecurringForm(prev => ({ ...prev, organization_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Keine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zugewiesen an</Label>
                <Select
                  value={recurringForm.assignee_id || 'none'}
                  onValueChange={(v) => setRecurringForm(prev => ({ ...prev, assignee_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nicht zugewiesen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht zugewiesen</SelectItem>
                    {users.filter(u => u.user_type === 'internal').map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={recurringForm.is_active}
                onCheckedChange={(v) => setRecurringForm(prev => ({ ...prev, is_active: v }))}
              />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecurringDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreateRecurring} disabled={!recurringForm.name || !recurringForm.subject}>
              {editingRecurring ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Check for OAuth callback token
    const urlParams = new URLSearchParams(window.location.search)
    const authToken = urlParams.get('auth_token')
    const newUser = urlParams.get('new_user')
    const assignment = urlParams.get('assignment')
    const error = urlParams.get('error')
    
    if (error) {
      toast.error(`Login-Fehler: ${error}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    if (authToken) {
      try {
        const tokenData = JSON.parse(atob(authToken))
        if (tokenData.exp > Date.now()) {
          // Fetch full user data
          api.fetch(`/users?id=${tokenData.user_id}`).then(users => {
            if (users && users[0]) {
              setCurrentUser(users[0])
              localStorage.setItem('servicedesk_user', JSON.stringify(users[0]))
              if (newUser === 'true') {
                if (assignment === 'unassigned') {
                  toast.info('Willkommen! Ihr Konto wartet auf Zuweisung durch einen Administrator.')
                } else {
                  toast.success('Willkommen! Ihr Konto wurde erfolgreich erstellt.')
                }
              } else {
                toast.success('Erfolgreich angemeldet!')
              }
            }
          })
        }
      } catch (e) {
        console.error('OAuth token error:', e)
      }
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    // Check for saved user in localStorage
    const savedUser = localStorage.getItem('servicedesk_user')
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])
  
  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('servicedesk_user', JSON.stringify(user))
  }
  
  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('servicedesk_user')
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }
  
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />
  }
  
  // Customer Portal for customer users
  if (currentUser.user_type === 'customer') {
    return <CustomerPortal user={currentUser} onLogout={handleLogout} />
  }
  
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    kanban: 'Kanban-Board',
    organizations: 'Organisationen',
    users: 'Benutzer',
    assets: 'Assets / CMDB',
    time: 'Zeiterfassung',
    reports: 'Reports',
    diagnostics: 'System-Diagnose',
    settings: 'Einstellungen',
    inbox: 'Posteingang',
    knowledge: 'Wissensdatenbank',
    telephony: 'Telefonie',
    contacts: 'Kontakte',
    companies: 'Unternehmen',
    deals: 'Deals & Pipeline',
    chatwoot: 'Chatwoot',
    'daily-assistant': 'KI-Assistent',
  }
  
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />
      case 'inbox': return <InboxPage currentUser={currentUser} />
      case 'chatwoot': return <ChatwootPage currentUser={currentUser} />
      case 'telephony': return <TelephonyPage currentUser={currentUser} />
      case 'contacts': return <ContactsPage currentUser={currentUser} />
      case 'companies': return <CompaniesPage currentUser={currentUser} />
      case 'deals': return <DealsPage currentUser={currentUser} />
      case 'tickets': return <TicketsPage currentUser={currentUser} onOpenTicket={setSelectedTicketId} />
      case 'kanban': return <KanbanPage currentUser={currentUser} />
      case 'organizations': return <OrganizationsPage />
      case 'users': return <UsersPage />
      case 'assets': return <AssetsPage />
      case 'time': return <TimePage currentUser={currentUser} />
      case 'knowledge': return <KnowledgeBasePage currentUser={currentUser} />
      case 'reports': return <ReportsPage />
      case 'diagnostics': return <SystemDiagnosticsPage />
      case 'settings': return <SettingsPage />
      case 'daily-assistant': return <DailyAssistantPage currentUser={currentUser} />
      case 'rmm-dashboard':
      case 'rmm-devices':
      case 'rmm-alerts':
      case 'rmm-remote':
      case 'rmm-deployment':
      case 'rmm': return <RMMPage currentUser={currentUser} subPage={currentPage} />
      default: return <DashboardPage />
    }
  }
  
  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} user={currentUser} onLogout={handleLogout} onNavigate={setCurrentPage} setSelectedTicketId={setSelectedTicketId} />
        <main className="flex-1 overflow-auto">{renderPage()}</main>
      </div>
      <TicketDetailDialog ticketId={selectedTicketId} currentUser={currentUser} open={!!selectedTicketId} onClose={() => setSelectedTicketId(null)} />
    </div>
  )
}
