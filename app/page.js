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
  GripVertical, MoreVertical, ArrowRight, CircleDot
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
  { id: 'inbox', label: 'Posteingang', icon: Mail },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'onboarding', label: 'Onboarding', icon: Users },
  { id: 'organizations', label: 'Organisationen', icon: Building2 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'assets', label: 'Assets', icon: Package },
  { id: 'time', label: 'Zeiterfassung', icon: Clock },
  { id: 'knowledge', label: 'Wissensdatenbank', icon: HelpCircle },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
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
      
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={currentPage === item.id ? 'secondary' : 'ghost'}
            className={`w-full justify-start mb-1 ${collapsed ? 'px-2' : ''} ${
              currentPage === item.id 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => setCurrentPage(item.id)}
          >
            <item.icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
            {!collapsed && item.label}
          </Button>
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

function Header({ title, user, onLogout }) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Suchen..." className="w-64 pl-10" />
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
  
  useEffect(() => {
    if (open && ticketId) {
      setLoading(true)
      Promise.all([
        api.getTicket(ticketId),
        api.getUsers()
      ]).then(([ticketData, usersData]) => {
        setTicket(ticketData)
        setUsers(usersData)
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
  
  const handleAssigneeChange = async (assigneeId) => {
    try {
      const id = assigneeId === 'none' ? null : assigneeId
      await api.updateTicket(ticket.id, { assignee_id: id }, currentUser.id)
      const assignee = users.find(u => u.id === assigneeId)
      setTicket(t => ({ ...t, assignee_id: id, assignee }))
      toast.success('Zuweisung aktualisiert')
    } catch { toast.error('Fehler beim Aktualisieren') }
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
                  {ticket.subject}
                </DialogTitle>
                <div className="flex items-center gap-2">
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
                  </TabsContent>
                  
                  <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                      <div className="space-y-4 p-2">
                        {ticket.ticket_comments?.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">Keine Kommentare</p>
                        ) : (
                          ticket.ticket_comments?.map((comment) => (
                            <div key={comment.id} className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{comment.users?.first_name?.[0]}{comment.users?.last_name?.[0]}</AvatarFallback></Avatar>
                                  <span className="font-medium text-sm">{comment.users?.first_name} {comment.users?.last_name}</span>
                                  {comment.is_internal && <Badge variant="outline" className="text-yellow-700">Intern</Badge>}
                                </div>
                                <span className="text-xs text-slate-500">{formatDateTime(comment.created_at)}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
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
  
  const loadOrganizations = useCallback(async () => {
    try { setOrganizations(await api.getOrganizations()) }
    catch { toast.error('Fehler') }
    finally { setLoading(false) }
  }, [])
  
  useEffect(() => { loadOrganizations() }, [loadOrganizations])
  
  const handleCreate = async (data) => {
    try { await api.createOrganization(data); toast.success('Erstellt'); setShowCreateDialog(false); loadOrganizations(); }
    catch { toast.error('Fehler') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Wirklich löschen?')) return
    try { await api.deleteOrganization(id); toast.success('Gelöscht'); loadOrganizations(); }
    catch { toast.error('Fehler') }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Organisationen</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neue Organisation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Organisation</DialogTitle></DialogHeader>
            <CreateOrganizationForm onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? <div className="flex justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <Card key={org.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    {org.short_name && <CardDescription>{org.short_name}</CardDescription>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {org.email && <p className="text-slate-500">{org.email}</p>}
                  {org.phone && <p className="text-slate-500">{org.phone}</p>}
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
    </div>
  )
}

function CreateOrganizationForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({ name: '', short_name: '', email: '', phone: '', website: '' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.name) onSubmit(formData); }} className="space-y-4">
      <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
      <div><Label>Kurzname</Label><Input value={formData.short_name} onChange={(e) => setFormData(f => ({ ...f, short_name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>E-Mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
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
  const [roles, setRoles] = useState([])
  
  useEffect(() => {
    Promise.all([api.getUsers(), api.getRoles()])
      .then(([usersData, rolesData]) => { setUsers(usersData); setRoles(rolesData); })
      .catch(() => toast.error('Fehler'))
      .finally(() => setLoading(false))
  }, [])
  
  const handleCreate = async (data) => {
    try { await api.createUser(data); toast.success('Erstellt'); setShowCreateDialog(false); setUsers(await api.getUsers()); }
    catch { toast.error('Fehler') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Deaktivieren?')) return
    try { await api.deleteUser(id); toast.success('Deaktiviert'); setUsers(await api.getUsers()); }
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
            <CreateUserForm roles={roles} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
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
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant="outline">{user.user_type === 'internal' ? 'Intern' : 'Kunde'}</Badge></TableCell>
                  <TableCell>{user.user_roles?.[0]?.roles?.display_name || '-'}</TableCell>
                  <TableCell><Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>{user.is_active ? 'Aktiv' : 'Inaktiv'}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function CreateUserForm({ roles, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({ email: '', first_name: '', last_name: '', phone: '', user_type: 'internal', role_id: '' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.email && formData.first_name && formData.last_name) onSubmit(formData); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Vorname *</Label><Input value={formData.first_name} onChange={(e) => setFormData(f => ({ ...f, first_name: e.target.value }))} /></div>
        <div><Label>Nachname *</Label><Input value={formData.last_name} onChange={(e) => setFormData(f => ({ ...f, last_name: e.target.value }))} /></div>
      </div>
      <div><Label>E-Mail *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Benutzertyp</Label>
          <Select value={formData.user_type} onValueChange={(v) => setFormData(f => ({ ...f, user_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Intern</SelectItem>
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
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
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [filter, setFilter] = useState({ type_id: 'all', status: 'all' })
  
  const loadAssets = useCallback(async () => {
    try {
      const params = {}
      if (filter.type_id && filter.type_id !== 'all') params.type_id = filter.type_id
      if (filter.status && filter.status !== 'all') params.status = filter.status
      setAssets(await api.getAssets(params))
    } catch { toast.error('Fehler') }
    finally { setLoading(false) }
  }, [filter])
  
  useEffect(() => {
    Promise.all([api.getAssetTypes(), api.getOrganizations()])
      .then(([types, orgs]) => { setAssetTypes(types); setOrganizations(orgs); })
    loadAssets()
  }, [loadAssets])
  
  const handleCreate = async (data) => {
    try { await api.createAsset(data); toast.success('Asset erstellt'); setShowCreateDialog(false); loadAssets(); }
    catch { toast.error('Fehler') }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Wirklich löschen?')) return
    try { await api.deleteAsset(id); toast.success('Gelöscht'); loadAssets(); }
    catch { toast.error('Fehler') }
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
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neues Asset</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neues Asset</DialogTitle></DialogHeader>
            <CreateAssetForm assetTypes={assetTypes} organizations={organizations} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
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
                <TableHead>Seriennummer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const IconComponent = ASSET_ICONS[asset.asset_types?.name] || Box
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
                    <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
                    <TableCell><Badge className={ASSET_STATUS_COLORS[asset.status]}>{ASSET_STATUS_LABELS[asset.status]}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function CreateAssetForm({ assetTypes, organizations, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({ asset_type_id: '', name: '', asset_tag: '', serial_number: '', manufacturer: '', model: '', organization_id: '', status: 'active' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (formData.asset_type_id && formData.name) onSubmit(formData); }} className="space-y-4">
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
          <Select value={formData.organization_id || 'none'} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine</SelectItem>
              {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
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
// REPORTS PAGE
// ============================================

function ReportsPage() {
  const [reportType, setReportType] = useState('tickets')
  const [reportData, setReportData] = useState(null)
  const [onboardingReport, setOnboardingReport] = useState(null)
  const [loading, setLoading] = useState(false)
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
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reports & Auswertungen</h2>
        <div className="flex items-center gap-4">
          <Input type="date" value={dateRange.from} onChange={(e) => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-40" />
          <span>bis</span>
          <Input type="date" value={dateRange.to} onChange={(e) => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-40" />
          <Button onClick={loadReport}><RefreshCw className="h-4 w-4 mr-2" />Aktualisieren</Button>
        </div>
      </div>
      
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList>
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-2" />Tickets</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-2" />Zeiterfassung</TabsTrigger>
          <TabsTrigger value="onboarding"><UserPlus className="h-4 w-4 mr-2" />On-/Offboarding</TabsTrigger>
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
            
            <TabsContent value="onboarding">
              {onboardingReport && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <StatsCard title="Onboardings" value={onboardingReport.total_onboardings} icon={UserPlus} color="green" />
                    <StatsCard title="Offboardings" value={onboardingReport.total_offboardings} icon={UserMinus} color="orange" />
                    <StatsCard title="Ø Bearbeitungszeit" value={`${onboardingReport.avg_onboarding_completion_days} Tage`} icon={Clock} color="blue" />
                    <StatsCard title="Anstehend (30 Tage)" value={(onboardingReport.upcoming_starts?.length || 0) + (onboardingReport.upcoming_exits?.length || 0)} icon={Calendar} color="purple" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* Upcoming Starts */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5 text-green-500" />
                          Anstehende Eintritte
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {onboardingReport.upcoming_starts?.length > 0 ? (
                          <div className="space-y-3">
                            {onboardingReport.upcoming_starts.slice(0, 5).map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">{item.organization} • {item.department || '-'}</p>
                                </div>
                                <Badge className="bg-green-100 text-green-700">
                                  {new Date(item.start_date).toLocaleDateString('de-DE')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4">Keine anstehenden Eintritte</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Upcoming Exits */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <UserMinus className="h-5 w-5 text-orange-500" />
                          Anstehende Austritte
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {onboardingReport.upcoming_exits?.length > 0 ? (
                          <div className="space-y-3">
                            {onboardingReport.upcoming_exits.slice(0, 5).map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">{item.organization}</p>
                                </div>
                                <Badge className="bg-orange-100 text-orange-700">
                                  {new Date(item.last_day).toLocaleDateString('de-DE')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4">Keine anstehenden Austritte</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* By Status */}
                    <Card>
                      <CardHeader><CardTitle>Onboarding nach Status</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(onboardingReport.onboarding_by_status || {}).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <span className="capitalize">{status.replace('_', ' ')}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                          {Object.keys(onboardingReport.onboarding_by_status || {}).length === 0 && (
                            <p className="text-muted-foreground text-center">Keine Daten</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* License Distribution */}
                    <Card>
                      <CardHeader><CardTitle>M365 Lizenzen</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(onboardingReport.license_distribution || {}).map(([license, count]) => (
                            <div key={license} className="flex items-center justify-between">
                              <Badge variant="outline">{license}</Badge>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                          {Object.keys(onboardingReport.license_distribution || {}).length === 0 && (
                            <p className="text-muted-foreground text-center">Keine Daten</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* By Department */}
                    <Card className="md:col-span-2">
                      <CardHeader><CardTitle>Onboardings nach Abteilung</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(onboardingReport.onboarding_by_department || {}).map(([dept, count]) => (
                            <div key={dept} className="p-3 bg-slate-50 rounded text-center">
                              <p className="font-medium text-lg">{count}</p>
                              <p className="text-sm text-muted-foreground">{dept}</p>
                            </div>
                          ))}
                          {Object.keys(onboardingReport.onboarding_by_department || {}).length === 0 && (
                            <p className="text-muted-foreground col-span-4 text-center py-4">Keine Daten</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
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
  
  useEffect(() => {
    loadConversations()
    loadTicketTypes()
  }, [loadConversations, loadTicketTypes])
  
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
      
      // Update conversation with ticket link
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
  
  return (
    <div className="p-6">
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
              <ScrollArea className="h-[calc(100vh-280px)]">
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
            <Card className="h-[calc(100vh-200px)] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Wählen Sie eine Nachricht aus der Liste</p>
              </div>
            </Card>
          )}
        </div>
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
  const [newArticle, setNewArticle] = useState({
    title: '', content: '', category: '', tags: '', is_internal: true
  })
  
  useEffect(() => {
    loadArticles()
  }, [])
  
  const loadArticles = async () => {
    setLoading(true)
    const data = await api.fetch('/kb-articles')
    setArticles(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  
  const handleCreateArticle = async () => {
    if (!newArticle.title || !newArticle.content) {
      toast.error('Titel und Inhalt sind erforderlich')
      return
    }
    
    try {
      await api.fetch('/kb-articles', {
        method: 'POST',
        body: JSON.stringify({
          ...newArticle,
          tags: newArticle.tags ? newArticle.tags.split(',').map(t => t.trim()) : [],
          created_by_id: currentUser?.id
        })
      })
      toast.success('Artikel erstellt')
      setShowNewDialog(false)
      setNewArticle({ title: '', content: '', category: '', tags: '', is_internal: true })
      loadArticles()
    } catch (error) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  const filteredArticles = articles.filter(a => 
    a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Wissensdatenbank</h1>
          <p className="text-muted-foreground">Lösungen, Anleitungen und Best Practices</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Neuer Artikel
        </Button>
      </div>
      
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Keine Artikel gefunden</h3>
          <p className="text-muted-foreground mb-4">Erstellen Sie den ersten Wissensartikel</p>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Artikel erstellen
          </Button>
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
                  {article.is_internal && (
                    <Badge variant="outline" className="text-xs">Intern</Badge>
                  )}
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
                  <span>{new Date(article.created_at).toLocaleDateString('de-DE')}</span>
                  <div className="flex items-center gap-2">
                    <Eye className="w-3 h-3" /> {article.views || 0}
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
          <div className="grid gap-4 py-4">
            <div>
              <Label>Titel *</Label>
              <Input 
                value={newArticle.title}
                onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                placeholder="Wie man..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategorie</Label>
                <Input 
                  value={newArticle.category}
                  onChange={(e) => setNewArticle({...newArticle, category: e.target.value})}
                  placeholder="Z.B. Netzwerk, Office 365"
                />
              </div>
              <div>
                <Label>Tags (kommagetrennt)</Label>
                <Input 
                  value={newArticle.tags}
                  onChange={(e) => setNewArticle({...newArticle, tags: e.target.value})}
                  placeholder="vpn, remote, zugang"
                />
              </div>
            </div>
            <div>
              <Label>Inhalt *</Label>
              <Textarea 
                value={newArticle.content}
                onChange={(e) => setNewArticle({...newArticle, content: e.target.value})}
                placeholder="Beschreiben Sie die Lösung..."
                rows={10}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={newArticle.is_internal}
                onCheckedChange={(v) => setNewArticle({...newArticle, is_internal: v})}
              />
              <Label>Nur für interne Nutzung</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreateArticle}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Article Detail Dialog */}
      {selectedArticle && (
        <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedArticle.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                {selectedArticle.category && (
                  <Badge className="bg-blue-100 text-blue-700">{selectedArticle.category}</Badge>
                )}
                {selectedArticle.is_internal && (
                  <Badge variant="outline">Intern</Badge>
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
        audit: ['log_retention_days', 'backup_enabled', 'backup_schedule']
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
                        <CardDescription>Telefonie-Integration (Anrufe, Webhooks)</CardDescription>
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
                    <Label>API-Schlüssel</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword.placetel ? 'text' : 'password'}
                          value={settings.placetel_api_key || ''}
                          onChange={(e) => updateSetting('placetel_api_key', e.target.value)}
                          placeholder="Placetel API Key..."
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
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook-URL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/placetel`}
                        className="bg-slate-50"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/placetel`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Diese URL in Placetel als Webhook-Empfänger eintragen
                    </p>
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
                  
                  <div className="space-y-4">
                    <Label>Manuelles Backup</Label>
                    <div className="flex gap-4">
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Backup erstellen
                      </Button>
                      <Button variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Backup wiederherstellen
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Hinweis: Backups werden über Supabase verwaltet. Diese Funktionen sind derzeit im Test-Modus.
                    </p>
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
    settings: 'Einstellungen',
    inbox: 'Posteingang',
    onboarding: 'Mitarbeiter On-/Offboarding',
    knowledge: 'Wissensdatenbank',
  }
  
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />
      case 'inbox': return <InboxPage currentUser={currentUser} />
      case 'tickets': return <TicketsPage currentUser={currentUser} onOpenTicket={setSelectedTicketId} />
      case 'kanban': return <KanbanPage currentUser={currentUser} />
      case 'onboarding': return <OnboardingPage currentUser={currentUser} />
      case 'organizations': return <OrganizationsPage />
      case 'users': return <UsersPage />
      case 'assets': return <AssetsPage />
      case 'time': return <TimePage currentUser={currentUser} />
      case 'knowledge': return <KnowledgeBasePage currentUser={currentUser} />
      case 'reports': return <ReportsPage />
      case 'settings': return <SettingsPage />
      default: return <DashboardPage />
    }
  }
  
  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} user={currentUser} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">{renderPage()}</main>
      </div>
      <TicketDetailDialog ticketId={selectedTicketId} currentUser={currentUser} open={!!selectedTicketId} onClose={() => setSelectedTicketId(null)} />
    </div>
  )
}
