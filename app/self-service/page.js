'use client'

import { useState, useEffect } from 'react'
import { 
  Search, HelpCircle, Ticket, Mail, Phone, User, Building2, 
  ChevronRight, CheckCircle2, Clock, AlertCircle, ArrowLeft,
  BookOpen, MessageSquare, Loader2, Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster, toast } from 'sonner'

const STATUS_LABELS = {
  new: 'Neu',
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  pending: 'Wartend',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700',
  pending: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
}

export default function SelfServicePortal() {
  const [activeTab, setActiveTab] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  
  // Ticket form
  const [ticketForm, setTicketForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: '',
    description: '',
    priority: 'medium',
  })
  const [submitting, setSubmitting] = useState(false)
  const [ticketCreated, setTicketCreated] = useState(null)
  
  // Status check
  const [statusForm, setStatusForm] = useState({ ticket_number: '', email: '' })
  const [ticketStatus, setTicketStatus] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  
  const handleSearch = async () => {
    if (searchQuery.length < 2) return
    setSearching(true)
    try {
      const response = await fetch(`/api/public/kb-search?query=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(Array.isArray(data) ? data : [])
    } catch (e) {
      setSearchResults([])
    }
    setSearching(false)
  }
  
  const handleSubmitTicket = async (e) => {
    e.preventDefault()
    if (!ticketForm.email || !ticketForm.subject) {
      toast.error('E-Mail und Betreff sind erforderlich')
      return
    }
    
    setSubmitting(true)
    try {
      const response = await fetch('/api/public/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketForm),
      })
      const data = await response.json()
      
      if (data.success) {
        setTicketCreated(data)
        toast.success(`Ticket #${data.ticket_number} erstellt!`)
      } else {
        toast.error(data.error || 'Fehler beim Erstellen')
      }
    } catch (e) {
      toast.error('Fehler beim Erstellen des Tickets')
    }
    setSubmitting(false)
  }
  
  const handleCheckStatus = async (e) => {
    e.preventDefault()
    if (!statusForm.ticket_number || !statusForm.email) {
      toast.error('Ticketnummer und E-Mail sind erforderlich')
      return
    }
    
    setCheckingStatus(true)
    try {
      const response = await fetch(`/api/public/ticket-status?ticket_number=${statusForm.ticket_number}&email=${encodeURIComponent(statusForm.email)}`)
      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
        setTicketStatus(null)
      } else {
        setTicketStatus(data)
      }
    } catch (e) {
      toast.error('Fehler beim Abrufen des Status')
    }
    setCheckingStatus(false)
  }
  
  const loadArticle = async (id) => {
    try {
      const response = await fetch(`/api/kb-articles/${id}`)
      const data = await response.json()
      if (data.id) {
        setSelectedArticle(data)
      }
    } catch (e) {
      toast.error('Artikel konnte nicht geladen werden')
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_v1-itsm-completion/artifacts/w6ojc37j_logo_itrex.png" 
                alt="IT REX Solutions" 
                className="h-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-slate-800">Self-Service Portal</h1>
                <p className="text-sm text-slate-500">Hilfe & Support rund um die Uhr</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zum Login
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {activeTab === 'home' && (
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Wie können wir Ihnen helfen?</h2>
            <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
              Durchsuchen Sie unsere Wissensdatenbank oder erstellen Sie ein Support-Ticket. 
              Unser Team ist für Sie da.
            </p>
            
            {/* Search Box */}
            <div className="max-w-xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  className="pl-12 h-14 text-lg"
                  placeholder="Suchen Sie nach Lösungen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={handleSearch}
                  disabled={searching}
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suchen'}
                </Button>
              </div>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-w-2xl mx-auto mb-8">
                <h3 className="text-left font-medium mb-4">Suchergebnisse:</h3>
                <div className="space-y-3">
                  {searchResults.map(article => (
                    <Card 
                      key={article.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow text-left"
                      onClick={() => loadArticle(article.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{article.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">{article.excerpt}</p>
                            {article.category && (
                              <Badge variant="outline" className="mt-2">{article.category}</Badge>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
                onClick={() => setActiveTab('new-ticket')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Neues Ticket erstellen</h3>
                  <p className="text-sm text-slate-500">Beschreiben Sie Ihr Anliegen und erhalten Sie Hilfe von unserem Team</p>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-300"
                onClick={() => setActiveTab('check-status')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Ticket-Status prüfen</h3>
                  <p className="text-sm text-slate-500">Überprüfen Sie den aktuellen Stand Ihres Support-Tickets</p>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-300"
                onClick={() => setActiveTab('knowledge')}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Wissensdatenbank</h3>
                  <p className="text-sm text-slate-500">Finden Sie Anleitungen und Lösungen für häufige Probleme</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        {/* New Ticket Form */}
        {activeTab === 'new-ticket' && (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" className="mb-4" onClick={() => setActiveTab('home')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            
            {ticketCreated ? (
              <Card className="text-center p-8">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-700 mb-2">Ticket erstellt!</h2>
                <p className="text-lg mb-4">Ihre Ticketnummer: <span className="font-bold">#{ticketCreated.ticket_number}</span></p>
                <p className="text-slate-600 mb-6">{ticketCreated.message}</p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => { setTicketCreated(null); setTicketForm({ name: '', email: '', phone: '', company: '', subject: '', description: '', priority: 'medium' }); }}>
                    Weiteres Ticket erstellen
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('home')}>
                    Zurück zur Startseite
                  </Button>
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-6 h-6" />
                    Neues Support-Ticket
                  </CardTitle>
                  <CardDescription>
                    Beschreiben Sie Ihr Anliegen und wir melden uns schnellstmöglich bei Ihnen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ihr Name</Label>
                        <Input 
                          value={ticketForm.name}
                          onChange={(e) => setTicketForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Max Mustermann"
                        />
                      </div>
                      <div>
                        <Label>Firma (optional)</Label>
                        <Input 
                          value={ticketForm.company}
                          onChange={(e) => setTicketForm(f => ({ ...f, company: e.target.value }))}
                          placeholder="Musterfirma GmbH"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>E-Mail *</Label>
                        <Input 
                          type="email"
                          value={ticketForm.email}
                          onChange={(e) => setTicketForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="ihre@email.de"
                          required
                        />
                      </div>
                      <div>
                        <Label>Telefon (optional)</Label>
                        <Input 
                          value={ticketForm.phone}
                          onChange={(e) => setTicketForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Betreff *</Label>
                      <Input 
                        value={ticketForm.subject}
                        onChange={(e) => setTicketForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Kurze Beschreibung Ihres Anliegens"
                        required
                      />
                    </div>
                    <div>
                      <Label>Beschreibung</Label>
                      <Textarea 
                        value={ticketForm.description}
                        onChange={(e) => setTicketForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich..."
                        rows={6}
                      />
                    </div>
                    <div>
                      <Label>Priorität</Label>
                      <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm(f => ({ ...f, priority: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Niedrig - Kann warten</SelectItem>
                          <SelectItem value="medium">Normal - Standardanfrage</SelectItem>
                          <SelectItem value="high">Hoch - Dringend</SelectItem>
                          <SelectItem value="critical">Kritisch - Betrieb eingeschränkt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Ticket absenden
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Check Status */}
        {activeTab === 'check-status' && (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" className="mb-4" onClick={() => setActiveTab('home')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-6 h-6" />
                  Ticket-Status prüfen
                </CardTitle>
                <CardDescription>
                  Geben Sie Ihre Ticketnummer und die E-Mail-Adresse ein, mit der das Ticket erstellt wurde.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckStatus} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Ticketnummer</Label>
                      <Input 
                        value={statusForm.ticket_number}
                        onChange={(e) => setStatusForm(f => ({ ...f, ticket_number: e.target.value }))}
                        placeholder="z.B. 10042"
                      />
                    </div>
                    <div>
                      <Label>E-Mail-Adresse</Label>
                      <Input 
                        type="email"
                        value={statusForm.email}
                        onChange={(e) => setStatusForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="ihre@email.de"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={checkingStatus}>
                    {checkingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                    Status abrufen
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {ticketStatus && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Ticket #{ticketStatus.ticket_number}</CardTitle>
                    <Badge className={STATUS_COLORS[ticketStatus.status]}>
                      {STATUS_LABELS[ticketStatus.status]}
                    </Badge>
                  </div>
                  <CardDescription>{ticketStatus.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Erstellt am:</span>
                        <p className="font-medium">{new Date(ticketStatus.created_at).toLocaleString('de-DE')}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Letzte Aktualisierung:</span>
                        <p className="font-medium">{new Date(ticketStatus.updated_at).toLocaleString('de-DE')}</p>
                      </div>
                    </div>
                    
                    {ticketStatus.comments?.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Kommunikationsverlauf</h4>
                        <div className="space-y-3">
                          {ticketStatus.comments.map((comment, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex justify-between text-sm text-slate-500 mb-1">
                                <span>{comment.from}</span>
                                <span>{new Date(comment.created_at).toLocaleString('de-DE')}</span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Knowledge Base */}
        {activeTab === 'knowledge' && (
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" className="mb-4" onClick={() => { setActiveTab('home'); setSelectedArticle(null); }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            
            {selectedArticle ? (
              <Card>
                <CardHeader>
                  <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setSelectedArticle(null)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück zur Übersicht
                  </Button>
                  <CardTitle>{selectedArticle.title}</CardTitle>
                  {selectedArticle.category && (
                    <Badge>{selectedArticle.category}</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none whitespace-pre-wrap">
                    {selectedArticle.content}
                  </div>
                  {selectedArticle.tags?.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex gap-2">
                        {selectedArticle.tags.map((tag, i) => (
                          <Badge key={i} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-6">Wissensdatenbank</h2>
                
                {/* Search */}
                <div className="mb-6">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      className="pl-10"
                      placeholder="Artikel suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                </div>
                
                {searchResults.length > 0 ? (
                  <div className="grid gap-4">
                    {searchResults.map(article => (
                      <Card 
                        key={article.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => loadArticle(article.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{article.title}</h3>
                              <p className="text-sm text-slate-500 mt-1">{article.excerpt}</p>
                              {article.category && (
                                <Badge variant="outline" className="mt-2">{article.category}</Badge>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Suchen Sie nach Artikeln in unserer Wissensdatenbank</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-100 border-t mt-auto py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© 2026 IT REX Solutions. Alle Rechte vorbehalten.</p>
          <p className="mt-2">
            <a href="mailto:support@itrex.de" className="hover:text-blue-600">support@itrex.de</a>
            {' · '}
            <a href="tel:+496131123456" className="hover:text-blue-600">+49 6131 123456</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
