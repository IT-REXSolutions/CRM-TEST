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
  History, Archive, Repeat
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
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'organizations', label: 'Organisationen', icon: Building2 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'assets', label: 'Assets', icon: Package },
  { id: 'time', label: 'Zeiterfassung', icon: Clock },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
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
          <div className="w-16 h-16 bg-blue-500 rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">SD</span>
          </div>
          <CardTitle className="text-2xl">ServiceDesk Pro</CardTitle>
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
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">
              SD
            </div>
            <span className="font-semibold">{isCustomerPortal ? 'Kundenportal' : 'ServiceDesk'}</span>
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
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          <Button variant="outline" onClick={loadTickets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
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
          ) : (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenTicket(ticket.id)}>
                    <TableCell className="font-mono text-slate-500">{ticket.ticket_number}</TableCell>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>{ticket.organizations?.name || '-'}</TableCell>
                    <TableCell>
                      {ticket.assignee ? `${ticket.assignee.first_name} ${ticket.assignee.last_name}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ticket.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Gesamt diese Woche" value={formatDuration(totalMinutes)} icon={Clock} color="blue" />
        <StatsCard title="Abrechenbar" value={formatDuration(billableMinutes)} icon={Timer} color="green" />
        <StatsCard title="Einträge" value={entries.length} icon={FileText} color="purple" />
      </div>
      
      {/* Header */}
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Zeiteinträge</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Manuell erfassen</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Zeit erfassen</DialogTitle></DialogHeader>
            <CreateTimeEntryForm tickets={tickets} organizations={organizations} onSubmit={handleCreate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
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
                  <TableCell>{formatDate(entry.created_at)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
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
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  
  const loadReport = async () => {
    setLoading(true)
    try {
      const params = { type: reportType }
      if (dateRange.from) params.from_date = dateRange.from
      if (dateRange.to) params.to_date = dateRange.to
      setReportData(await api.getReports(params))
    } catch { toast.error('Fehler beim Laden des Reports') }
    finally { setLoading(false) }
  }
  
  useEffect(() => { loadReport() }, [reportType])
  
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
// SETTINGS PAGE
// ============================================

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
          Einstellungen werden in der nächsten Phase implementiert
        </CardContent>
      </Card>
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
  }
  
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />
      case 'tickets': return <TicketsPage currentUser={currentUser} onOpenTicket={setSelectedTicketId} />
      case 'kanban': return <KanbanPage currentUser={currentUser} />
      case 'organizations': return <OrganizationsPage />
      case 'users': return <UsersPage />
      case 'assets': return <AssetsPage />
      case 'time': return <TimePage currentUser={currentUser} />
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
