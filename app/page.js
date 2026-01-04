'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  LayoutDashboard, Ticket, KanbanSquare, Building2, Users, 
  Clock, Package, Settings, ChevronLeft, ChevronRight, Plus,
  Search, Bell, User, Filter, MoreVertical, Calendar, Tag,
  MessageSquare, Paperclip, AlertCircle, CheckCircle2, XCircle,
  Timer, ArrowUpRight, TrendingUp, Loader2, Mic, MicOff, X,
  GripVertical, Trash2, Edit, Eye
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

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'organizations', label: 'Organisationen', icon: Building2 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'assets', label: 'Assets', icon: Package },
  { id: 'time', label: 'Zeiterfassung', icon: Clock },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
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
  
  // Users
  getUsers: () => api.fetch('/users'),
  createUser: (data) => api.fetch('/users', { method: 'POST', body: JSON.stringify(data) }),
  
  // Organizations
  getOrganizations: () => api.fetch('/organizations'),
  createOrganization: (data) => api.fetch('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  deleteOrganization: (id) => api.fetch(`/organizations/${id}`, { method: 'DELETE' }),
  
  // Tickets
  getTickets: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/tickets${query ? `?${query}` : ''}`)
  },
  getTicket: (id) => api.fetch(`/tickets/${id}`),
  createTicket: (data) => api.fetch('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id, data, userId) => api.fetch(`/tickets/${id}?user_id=${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  
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
  moveTask: (data) => api.fetch('/tasks/move', { method: 'POST', body: JSON.stringify(data) }),
  
  // Assets
  getAssets: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/assets${query ? `?${query}` : ''}`)
  },
  getAssetTypes: () => api.fetch('/asset-types'),
  createAsset: (data) => api.fetch('/assets', { method: 'POST', body: JSON.stringify(data) }),
  
  // Time Entries
  getTimeEntries: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.fetch(`/time-entries${query ? `?${query}` : ''}`)
  },
  createTimeEntry: (data) => api.fetch('/time-entries', { method: 'POST', body: JSON.stringify(data) }),
  
  // Stats
  getStats: () => api.fetch('/stats'),
  
  // Roles
  getRoles: () => api.fetch('/roles'),
  
  // SLA Profiles
  getSLAProfiles: () => api.fetch('/sla-profiles'),
  
  // AI
  aiSummarize: (data) => api.fetch('/ai/summarize', { method: 'POST', body: JSON.stringify(data) }),
  aiParseDictation: (data) => api.fetch('/ai/parse-dictation', { method: 'POST', body: JSON.stringify(data) }),
}

// ============================================
// COMPONENTS
// ============================================

// --- Sidebar ---
function Sidebar({ currentPage, setCurrentPage, collapsed, setCollapsed }) {
  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-300`}>
      <div className="p-4 flex items-center justify-between border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">
              SD
            </div>
            <span className="font-semibold">ServiceDesk</span>
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
        {NAV_ITEMS.map((item) => (
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
      
      {!collapsed && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600">AD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-slate-400 truncate">admin@servicedesk.de</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Header ---
function Header({ title }) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Suchen..."
            className="w-64 pl-10"
          />
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
            3
          </span>
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback>AD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

// --- Stats Card ---
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

// --- Dashboard Page ---
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
      {/* Stats */}
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
          title="Gelöst heute"
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
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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
            <CardTitle>Zeiterfassung</CardTitle>
            <CardDescription>Übersicht der erfassten Zeiten</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Gesamte Zeit</span>
                <span className="font-semibold">{Math.round((stats?.time?.totalMinutes || 0) / 60)} Stunden</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Abrechenbar</span>
                <span className="font-semibold">{Math.round((stats?.time?.billableMinutes || 0) / 60)} Stunden</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Umsatz</span>
                <span className="font-semibold text-green-600">€{(stats?.time?.totalRevenue || 0).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Aktuelle Tickets</CardTitle>
          <CardDescription>Die neuesten Support-Anfragen</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTickets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Keine Tickets vorhanden</p>
          ) : (
            <div className="space-y-4">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-500">#{ticket.ticket_number}</div>
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

// --- Tickets Page ---
function TicketsPage({ currentUser, onOpenTicket }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', priority: '' })
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [slaProfiles, setSlaProfiles] = useState([])
  const [tags, setTags] = useState([])
  
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (filter.status) params.status = filter.status
      if (filter.priority) params.priority = filter.priority
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
    // Load additional data for create dialog
    Promise.all([
      api.getOrganizations(),
      api.getSLAProfiles(),
      api.getTags()
    ]).then(([orgs, slas, tagsData]) => {
      setOrganizations(orgs)
      setSlaProfiles(slas)
      setTags(tagsData)
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
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Status</SelectItem>
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
              <SelectItem value="">Alle Prioritäten</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <DialogDescription>Erstellen Sie ein neues Support-Ticket</DialogDescription>
            </DialogHeader>
            <CreateTicketForm
              organizations={organizations}
              slaProfiles={slaProfiles}
              tags={tags}
              onSubmit={handleCreateTicket}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Tickets List */}
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
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erstes Ticket erstellen
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onOpenTicket(ticket.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 font-mono">#{ticket.ticket_number}</span>
                        <h3 className="font-medium">{ticket.subject}</h3>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        {ticket.organizations && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ticket.organizations.name}
                          </span>
                        )}
                        {ticket.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ticket.assignee.first_name} {ticket.assignee.last_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(ticket.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                      <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                    </div>
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

// --- Create Ticket Form ---
function CreateTicketForm({ organizations, slaProfiles, tags, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    organization_id: '',
    sla_profile_id: '',
    tags: [],
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
    })
  }
  
  const handleDictation = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Mikrofon nicht verfügbar')
      return
    }
    
    try {
      if (!isRecording) {
        setIsRecording(true)
        // Use Web Speech API for simplicity
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
        recognition.lang = 'de-DE'
        recognition.continuous = false
        recognition.interimResults = false
        
        recognition.onresult = async (event) => {
          const transcript = event.results[0][0].transcript
          setIsRecording(false)
          setIsProcessing(true)
          
          try {
            // Parse dictation with AI
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
          } catch (error) {
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
      }
    } catch (error) {
      toast.error('Mikrofon-Zugriff verweigert')
      setIsRecording(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Betreff *</Label>
          <Input
            value={formData.subject}
            onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
            placeholder="Kurze Beschreibung des Problems"
          />
        </div>
        
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <Label>Beschreibung</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDictation}
              disabled={isProcessing}
            >
              {isRecording ? (
                <>
                  <MicOff className="h-4 w-4 mr-2 text-red-500 animate-pulse" />
                  Aufnahme...
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Diktieren
                </>
              )}
            </Button>
          </div>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
            placeholder="Detaillierte Beschreibung des Problems"
            rows={4}
          />
        </div>
        
        <div>
          <Label>Organisation</Label>
          <Select value={formData.organization_id} onValueChange={(v) => setFormData(f => ({ ...f, organization_id: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Organisation wählen" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Priorität</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>SLA-Profil</Label>
          <Select value={formData.sla_profile_id} onValueChange={(v) => setFormData(f => ({ ...f, sla_profile_id: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="SLA wählen" />
            </SelectTrigger>
            <SelectContent>
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

// --- Ticket Detail Dialog ---
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
      }).catch(() => {
        toast.error('Fehler beim Laden des Tickets')
      }).finally(() => {
        setLoading(false)
      })
    }
  }, [open, ticketId])
  
  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateTicket(ticket.id, { status: newStatus }, currentUser.id)
      setTicket(t => ({ ...t, status: newStatus }))
      toast.success('Status aktualisiert')
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
  }
  
  const handleAssigneeChange = async (assigneeId) => {
    try {
      await api.updateTicket(ticket.id, { assignee_id: assigneeId || null }, currentUser.id)
      const assignee = users.find(u => u.id === assigneeId)
      setTicket(t => ({ ...t, assignee_id: assigneeId, assignee }))
      toast.success('Zuweisung aktualisiert')
    } catch (error) {
      toast.error('Fehler beim Aktualisieren')
    }
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
      setTicket(t => ({
        ...t,
        ticket_comments: [...(t.ticket_comments || []), comment]
      }))
      setNewComment('')
      toast.success('Kommentar hinzugefügt')
    } catch (error) {
      toast.error('Fehler beim Hinzufügen des Kommentars')
    }
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
    } catch (error) {
      toast.error('Fehler bei der KI-Zusammenfassung')
    }
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
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">#{ticket.ticket_number}</span>
                    {ticket.subject}
                  </DialogTitle>
                  <DialogDescription>
                    Erstellt am {new Date(ticket.created_at).toLocaleString('de-DE')}
                    {ticket.creator && ` von ${ticket.creator.first_name} ${ticket.creator.last_name}`}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                  <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden grid grid-cols-3 gap-4">
              {/* Main Content */}
              <div className="col-span-2 flex flex-col overflow-hidden">
                <Tabs defaultValue="details" className="flex-1 flex flex-col">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="comments">
                      Kommentare ({ticket.ticket_comments?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="history">Verlauf</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="flex-1 overflow-auto">
                    <div className="space-y-4 p-2">
                      <div>
                        <Label className="text-slate-500">Beschreibung</Label>
                        <p className="mt-1 whitespace-pre-wrap">{ticket.description || 'Keine Beschreibung'}</p>
                      </div>
                      
                      {ticket.ai_summary && (
                        <div className="bg-blue-50 rounded-lg p-4">
                          <Label className="text-blue-700 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            KI-Zusammenfassung
                          </Label>
                          <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.ai_summary}</p>
                        </div>
                      )}
                      
                      <Button variant="outline" size="sm" onClick={handleAISummary}>
                        <AlertCircle className="h-4 w-4 mr-2" />
                        KI-Zusammenfassung erstellen
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                      <div className="space-y-4 p-2">
                        {ticket.ticket_comments?.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">Keine Kommentare</p>
                        ) : (
                          ticket.ticket_comments?.map((comment) => (
                            <div
                              key={comment.id}
                              className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {comment.users?.first_name?.[0]}{comment.users?.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">
                                    {comment.users?.first_name} {comment.users?.last_name}
                                  </span>
                                  {comment.is_internal && (
                                    <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                                      Intern
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">
                                  {new Date(comment.created_at).toLocaleString('de-DE')}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id="internal"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="internal" className="text-sm cursor-pointer">
                          Interne Notiz (nicht für Kunden sichtbar)
                        </Label>
                      </div>
                      <div className="flex gap-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Kommentar schreiben..."
                          rows={2}
                          className="flex-1"
                        />
                        <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="history" className="flex-1 overflow-auto">
                    <div className="space-y-2 p-2">
                      {ticket.ticket_history?.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">Kein Verlauf</p>
                      ) : (
                        ticket.ticket_history?.map((entry) => (
                          <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-medium">
                                  {entry.users?.first_name} {entry.users?.last_name}
                                </span>
                                {' '}{entry.action === 'created' && 'hat das Ticket erstellt'}
                                {entry.action === 'status_changed' && `hat den Status geändert: ${entry.old_value} → ${entry.new_value}`}
                                {entry.action === 'assigned' && `hat das Ticket zugewiesen`}
                                {entry.action === 'commented' && 'hat kommentiert'}
                                {entry.action === 'updated' && `hat ${entry.field_name} geändert`}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(entry.created_at).toLocaleString('de-DE')}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Sidebar */}
              <div className="space-y-4 border-l pl-4">
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <Select value={ticket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-slate-500">Zugewiesen an</Label>
                  <Select value={ticket.assignee_id || ''} onValueChange={handleAssigneeChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nicht zugewiesen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nicht zugewiesen</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {ticket.organizations && (
                  <div>
                    <Label className="text-slate-500">Organisation</Label>
                    <p className="mt-1 font-medium">{ticket.organizations.name}</p>
                    {ticket.organizations.email && (
                      <p className="text-sm text-slate-500">{ticket.organizations.email}</p>
                    )}
                  </div>
                )}
                
                {ticket.contacts && (
                  <div>
                    <Label className="text-slate-500">Kontakt</Label>
                    <p className="mt-1 font-medium">
                      {ticket.contacts.first_name} {ticket.contacts.last_name}
                    </p>
                    {ticket.contacts.email && (
                      <p className="text-sm text-slate-500">{ticket.contacts.email}</p>
                    )}
                  </div>
                )}
                
                {ticket.sla_profiles && (
                  <div>
                    <Label className="text-slate-500">SLA</Label>
                    <p className="mt-1 font-medium">{ticket.sla_profiles.name}</p>
                    {ticket.sla_response_due && (
                      <p className="text-sm text-slate-500">
                        Antwort bis: {new Date(ticket.sla_response_due).toLocaleString('de-DE')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-slate-500 py-8">Ticket nicht gefunden</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- Kanban Page ---
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
        // Refresh active board data
        const updated = data.find(b => b.id === activeBoard.id)
        if (updated) setActiveBoard(updated)
      }
    } catch (error) {
      toast.error('Fehler beim Laden der Boards')
    } finally {
      setLoading(false)
    }
  }, [activeBoard])
  
  useEffect(() => {
    loadBoards()
  }, [])
  
  const handleCreateBoard = async (data) => {
    try {
      await api.createBoard({ ...data, owner_id: currentUser.id })
      toast.success('Board erstellt')
      setShowCreateBoardDialog(false)
      loadBoards()
    } catch (error) {
      toast.error('Fehler beim Erstellen des Boards')
    }
  }
  
  const handleCreateTask = async (data) => {
    try {
      await api.createTask({
        ...data,
        board_id: activeBoard.id,
        column_id: selectedColumn.id,
        created_by_id: currentUser.id,
      })
      toast.success('Aufgabe erstellt')
      setShowCreateTaskDialog(false)
      setSelectedColumn(null)
      loadBoards()
    } catch (error) {
      toast.error('Fehler beim Erstellen der Aufgabe')
    }
  }
  
  const handleDragStart = (task) => {
    setDraggedTask(task)
  }
  
  const handleDragOver = (e) => {
    e.preventDefault()
  }
  
  const handleDrop = async (column) => {
    if (!draggedTask || draggedTask.column_id === column.id) {
      setDraggedTask(null)
      return
    }
    
    try {
      await api.moveTask({
        task_id: draggedTask.id,
        column_id: column.id,
        position: column.tasks?.length || 0,
      })
      loadBoards()
    } catch (error) {
      toast.error('Fehler beim Verschieben')
    } finally {
      setDraggedTask(null)
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={activeBoard?.id || ''}
            onValueChange={(id) => setActiveBoard(boards.find(b => b.id === id))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Board wählen" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showCreateBoardDialog} onOpenChange={setShowCreateBoardDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Neues Board
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Board erstellen</DialogTitle>
            </DialogHeader>
            <CreateBoardForm onSubmit={handleCreateBoard} onCancel={() => setShowCreateBoardDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Kanban Board */}
      {!activeBoard ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <KanbanSquare className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500">Kein Board ausgewählt</p>
            <Button className="mt-4" onClick={() => setShowCreateBoardDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Erstes Board erstellen
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {activeBoard.board_columns?.map((column) => (
              <div
                key={column.id}
                className="w-80 flex flex-col bg-slate-100 rounded-lg"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column)}
              >
                {/* Column Header */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <span className="font-medium">{column.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {column.tasks?.length || 0}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedColumn(column)
                      setShowCreateTaskDialog(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Tasks */}
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-2">
                    {column.tasks?.map((task) => (
                      <Card
                        key={task.id}
                        className={`cursor-grab active:cursor-grabbing ${
                          draggedTask?.id === task.id ? 'opacity-50' : ''
                        }`}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{task.title}</h4>
                            <Badge className={`${PRIORITY_COLORS[task.priority]} text-xs`}>
                              {PRIORITY_LABELS[task.priority]}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            {task.assignee && (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.due_date).toLocaleDateString('de-DE')}
                              </span>
                            )}
                            {task.tickets && (
                              <Badge variant="outline" className="text-xs">
                                #{task.tickets.ticket_number}
                              </Badge>
                            )}
                          </div>
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
      
      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
            {selectedColumn && (
              <DialogDescription>
                In Spalte: {selectedColumn.name}
              </DialogDescription>
            )}
          </DialogHeader>
          <CreateTaskForm
            onSubmit={handleCreateTask}
            onCancel={() => {
              setShowCreateTaskDialog(false)
              setSelectedColumn(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Create Board Form ---
function CreateBoardForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name) {
      toast.error('Name ist erforderlich')
      return
    }
    onSubmit({ name, description })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Sprint 1"
        />
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optionale Beschreibung"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Board erstellen</Button>
      </DialogFooter>
    </form>
  )
}

// --- Create Task Form ---
function CreateTaskForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  })
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title) {
      toast.error('Titel ist erforderlich')
      return
    }
    onSubmit({
      ...formData,
      due_date: formData.due_date || null,
    })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Titel *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
          placeholder="Aufgabentitel"
        />
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
          placeholder="Optionale Beschreibung"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Priorität</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fälligkeitsdatum</Label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData(f => ({ ...f, due_date: e.target.value }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Aufgabe erstellen</Button>
      </DialogFooter>
    </form>
  )
}

// --- Organizations Page ---
function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  const loadOrganizations = useCallback(async () => {
    try {
      const data = await api.getOrganizations()
      setOrganizations(data)
    } catch (error) {
      toast.error('Fehler beim Laden der Organisationen')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])
  
  const handleCreate = async (data) => {
    try {
      await api.createOrganization(data)
      toast.success('Organisation erstellt')
      setShowCreateDialog(false)
      loadOrganizations()
    } catch (error) {
      toast.error('Fehler beim Erstellen')
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Organisation wirklich löschen?')) return
    try {
      await api.deleteOrganization(id)
      toast.success('Organisation gelöscht')
      loadOrganizations()
    } catch (error) {
      toast.error('Fehler beim Löschen')
    }
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Organisationen</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Organisation</DialogTitle>
            </DialogHeader>
            <CreateOrganizationForm onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500">Keine Organisationen vorhanden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <Card key={org.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    {org.short_name && (
                      <CardDescription>{org.short_name}</CardDescription>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {org.email && (
                    <p className="text-slate-500">{org.email}</p>
                  )}
                  {org.phone && (
                    <p className="text-slate-500">{org.phone}</p>
                  )}
                  <div className="flex items-center gap-4 pt-2">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      {org.locations?.length || 0} Standorte
                    </span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      {org.contacts?.length || 0} Kontakte
                    </span>
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

// --- Create Organization Form ---
function CreateOrganizationForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    email: '',
    phone: '',
    website: '',
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
      <div>
        <Label>Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
          placeholder="Firmenname"
        />
      </div>
      <div>
        <Label>Kurzname</Label>
        <Input
          value={formData.short_name}
          onChange={(e) => setFormData(f => ({ ...f, short_name: e.target.value }))}
          placeholder="z.B. ACME"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>E-Mail</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
            placeholder="info@firma.de"
          />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
            placeholder="+49 ..."
          />
        </div>
      </div>
      <div>
        <Label>Website</Label>
        <Input
          value={formData.website}
          onChange={(e) => setFormData(f => ({ ...f, website: e.target.value }))}
          placeholder="https://firma.de"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit">Erstellen</Button>
      </DialogFooter>
    </form>
  )
}

// --- Placeholder Pages ---
function UsersPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Benutzer</CardTitle>
          <CardDescription>Benutzerverwaltung (in Entwicklung)</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          Diese Funktion wird in Phase 2 implementiert
        </CardContent>
      </Card>
    </div>
  )
}

function AssetsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Assets / CMDB</CardTitle>
          <CardDescription>IT-Asset-Verwaltung (in Entwicklung)</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          Diese Funktion wird in Phase 2 implementiert
        </CardContent>
      </Card>
    </div>
  )
}

function TimePage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Zeiterfassung</CardTitle>
          <CardDescription>Zeit- und Abrechnungsmanagement (in Entwicklung)</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          <Clock className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          Diese Funktion wird in Phase 2 implementiert
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Einstellungen</CardTitle>
          <CardDescription>Systemkonfiguration</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          <Settings className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          Diese Funktion wird in Phase 2 implementiert
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  
  // Mock current user (würde normalerweise aus Auth kommen)
  const [currentUser] = useState({
    id: 'demo-user-id',
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@servicedesk.de',
    role: 'admin',
  })
  
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    kanban: 'Kanban-Board',
    organizations: 'Organisationen',
    users: 'Benutzer',
    assets: 'Assets',
    time: 'Zeiterfassung',
    settings: 'Einstellungen',
  }
  
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />
      case 'tickets':
        return <TicketsPage currentUser={currentUser} onOpenTicket={setSelectedTicketId} />
      case 'kanban':
        return <KanbanPage currentUser={currentUser} />
      case 'organizations':
        return <OrganizationsPage />
      case 'users':
        return <UsersPage />
      case 'assets':
        return <AssetsPage />
      case 'time':
        return <TimePage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }
  
  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} />
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
      
      {/* Ticket Detail Dialog */}
      <TicketDetailDialog
        ticketId={selectedTicketId}
        currentUser={currentUser}
        open={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
      />
    </div>
  )
}
