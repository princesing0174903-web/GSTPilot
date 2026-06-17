'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Briefcase, Phone, Video, MapPin,
  TrendingUp, DollarSign, Users, Calendar, Clock, ArrowRight,
  Star, Target, Award, ChevronRight, MoreHorizontal,
  GripVertical, CheckCircle2, XCircle, AlertCircle,
  Sparkles, BarChart3, PhoneCall, UserPlus,
} from 'lucide-react'
import {
  useFireLeads, useFireDeals, useFireMeetings,
} from '@/hooks/use-firestore'
import {
  createLead, updateLead, deleteLead, convertLeadToClient,
  createDeal, updateDeal, deleteDeal,
  createMeeting, updateMeeting, deleteMeeting,
} from '@/lib/firestore-service'
import type { FirestoreLead, FirestoreDeal, FirestoreMeeting, LeadStatus, LeadSource, DealStage, MeetingType, MeetingStatus } from '@/lib/firestore-schema'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | unknown): string {
  if (!d) return '—'
  try {
    const date = typeof d === 'string' ? new Date(d) : new Date()
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function formatTime(d: string | unknown): string {
  if (!d) return ''
  try {
    const date = typeof d === 'string' ? new Date(d) : new Date()
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function daysUntil(d: string | unknown): number {
  if (!d) return 999
  try {
    const date = typeof d === 'string' ? new Date(d) : new Date()
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  } catch { return 999 }
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function scoreBgGradient(score: number): string {
  if (score >= 70) return 'from-emerald-500 to-emerald-600'
  if (score >= 40) return 'from-amber-500 to-amber-600'
  return 'from-red-500 to-red-600'
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PIPELINE_COLUMNS: { status: LeadStatus; label: string; color: string; dotColor: string }[] = [
  { status: 'new', label: 'New', color: 'bg-slate-50 border-slate-200', dotColor: 'bg-slate-400' },
  { status: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-200', dotColor: 'bg-blue-500' },
  { status: 'qualified', label: 'Qualified', color: 'bg-violet-50 border-violet-200', dotColor: 'bg-violet-500' },
  { status: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-50 border-amber-200', dotColor: 'bg-amber-500' },
  { status: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-200', dotColor: 'bg-orange-500' },
  { status: 'converted', label: 'Converted', color: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
  { status: 'lost', label: 'Lost', color: 'bg-red-50 border-red-200', dotColor: 'bg-red-400' },
]

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'event', label: 'Event' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
]

const MEETING_TYPE_ICON: Record<MeetingType, React.ReactNode> = {
  in_person: <MapPin className="h-3.5 w-3.5" />,
  video_call: <Video className="h-3.5 w-3.5" />,
  phone_call: <Phone className="h-3.5 w-3.5" />,
}

const DEAL_STAGE_CONFIG: Record<DealStage, { label: string; color: string; bg: string }> = {
  proposal: { label: 'Proposal', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  negotiation: { label: 'Negotiation', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  closed_won: { label: 'Closed Won', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  closed_lost: { label: 'Closed Lost', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
}

const SAMPLE_LEADS: FirestoreLead[] = [
  {
    leadId: 'lead-1', firmId: 'firm-1', contactName: 'Rajesh Sharma', contactEmail: 'rajesh@acme.in',
    contactPhone: '+91 98765 43210', company: 'Acme Industries Pvt Ltd', gstin: '27AADCA1234F1Z5',
    source: 'referral', status: 'new', leadScore: 75, estimatedValue: 250000, notes: 'Interested in GST compliance package',
    assignedTo: 'Priya Patel', nextFollowUp: new Date(Date.now() + 2 * 86400000).toISOString(),
    convertedClientId: null, tags: ['manufacturing', 'high-value'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-2', firmId: 'firm-1', contactName: 'Anita Desai', contactEmail: 'anita@technowave.in',
    contactPhone: '+91 87654 32109', company: 'TechnoWave Solutions', gstin: null,
    source: 'website', status: 'contacted', leadScore: 62, estimatedValue: 180000, notes: 'Responded to email, wants demo',
    assignedTo: 'Amit Kumar', nextFollowUp: new Date(Date.now() + 1 * 86400000).toISOString(),
    convertedClientId: null, tags: ['IT', 'SaaS'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-3', firmId: 'firm-1', contactName: 'Vikram Mehta', contactEmail: 'vikram@greenearth.in',
    contactPhone: '+91 76543 21098', company: 'Green Earth Exports', gstin: '27AABCG5678H1Z3',
    source: 'event', status: 'qualified', leadScore: 88, estimatedValue: 450000, notes: 'Met at CA conference, very interested',
    assignedTo: 'Priya Patel', nextFollowUp: new Date(Date.now() + 3 * 86400000).toISOString(),
    convertedClientId: null, tags: ['export', 'premium'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-4', firmId: 'firm-1', contactName: 'Sunita Patel', contactEmail: 'sunita@retailking.in',
    contactPhone: '+91 65432 10987', company: 'Retail King Mart', gstin: null,
    source: 'social_media', status: 'proposal_sent', leadScore: 55, estimatedValue: 120000, notes: 'Proposal sent for quarterly filing',
    assignedTo: 'Amit Kumar', nextFollowUp: new Date(Date.now() + 5 * 86400000).toISOString(),
    convertedClientId: null, tags: ['retail'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-5', firmId: 'firm-1', contactName: 'Deepak Joshi', contactEmail: 'deepak@steelworks.in',
    contactPhone: '+91 54321 09876', company: 'Steel Works India', gstin: '27AABCS9012K1Z7',
    source: 'cold_call', status: 'negotiation', leadScore: 91, estimatedValue: 600000, notes: 'Discussing annual retainer, close to signing',
    assignedTo: 'Priya Patel', nextFollowUp: new Date(Date.now() + 1 * 86400000).toISOString(),
    convertedClientId: null, tags: ['manufacturing', 'high-value', 'retainer'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-6', firmId: 'firm-1', contactName: 'Meera Krishnan', contactEmail: 'meera@healthfirst.in',
    contactPhone: '+91 43210 98765', company: 'Health First Pharma', gstin: '27AABCH3456L1Z2',
    source: 'referral', status: 'converted', leadScore: 95, estimatedValue: 350000, notes: 'Successfully converted to client',
    assignedTo: 'Amit Kumar', nextFollowUp: null,
    convertedClientId: 'client-converted-1', tags: ['pharma', 'premium'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    leadId: 'lead-7', firmId: 'firm-1', contactName: 'Karan Singh', contactEmail: 'karan@logipro.in',
    contactPhone: '+91 32109 87654', company: 'LogiPro Transport', gstin: null,
    source: 'advertisement', status: 'lost', leadScore: 30, estimatedValue: 80000, notes: 'Chose competitor, may revisit next year',
    assignedTo: 'Priya Patel', nextFollowUp: null,
    convertedClientId: null, tags: ['logistics'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

const SAMPLE_DEALS: FirestoreDeal[] = [
  {
    dealId: 'deal-1', firmId: 'firm-1', leadId: 'lead-5', clientId: null,
    title: 'Steel Works Annual Retainer', description: 'Full GST compliance + monthly filing for FY 2025-26',
    value: 600000, stage: 'negotiation', probability: 75,
    expectedCloseDate: new Date(Date.now() + 15 * 86400000).toISOString(), assignedTo: 'Priya Patel',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    dealId: 'deal-2', firmId: 'firm-1', leadId: 'lead-3', clientId: null,
    title: 'Green Earth GST Package', description: 'Export filings + compliance management',
    value: 450000, stage: 'proposal', probability: 40,
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString(), assignedTo: 'Priya Patel',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    dealId: 'deal-3', firmId: 'firm-1', leadId: 'lead-6', clientId: 'client-converted-1',
    title: 'Health First Quarterly Filing', description: 'GSTR-1 + GSTR-3B quarterly filing',
    value: 350000, stage: 'closed_won', probability: 100,
    expectedCloseDate: new Date().toISOString(), assignedTo: 'Amit Kumar',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    dealId: 'deal-4', firmId: 'firm-1', leadId: null, clientId: null,
    title: 'Acme Industries Setup', description: 'GST registration + initial compliance setup',
    value: 250000, stage: 'proposal', probability: 35,
    expectedCloseDate: new Date(Date.now() + 45 * 86400000).toISOString(), assignedTo: 'Amit Kumar',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    dealId: 'deal-5', firmId: 'firm-1', leadId: null, clientId: null,
    title: 'Retail King Quarterly', description: 'GST filing for retail operations',
    value: 120000, stage: 'closed_lost', probability: 0,
    expectedCloseDate: new Date(Date.now() - 5 * 86400000).toISOString(), assignedTo: 'Amit Kumar',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

const SAMPLE_MEETINGS: FirestoreMeeting[] = [
  {
    meetingId: 'meet-1', firmId: 'firm-1', clientId: null, leadId: 'lead-5',
    title: 'Steel Works Deal Discussion', description: 'Final negotiation for annual retainer',
    dateTime: new Date(Date.now() + 1 * 86400000 + 10 * 3600000).toISOString(), duration: 60,
    type: 'video_call', status: 'scheduled', attendees: ['Priya Patel', 'Deepak Joshi'],
    notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    meetingId: 'meet-2', firmId: 'firm-1', clientId: null, leadId: 'lead-3',
    title: 'Green Earth GST Demo', description: 'Demo of GST compliance workflow',
    dateTime: new Date(Date.now() + 2 * 86400000 + 14 * 3600000).toISOString(), duration: 45,
    type: 'in_person', status: 'scheduled', attendees: ['Priya Patel', 'Vikram Mehta'],
    notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    meetingId: 'meet-3', firmId: 'firm-1', clientId: 'client-converted-1', leadId: null,
    title: 'Health First Onboarding', description: 'Onboarding call for GST filing',
    dateTime: new Date(Date.now() + 3 * 86400000 + 11 * 3600000).toISOString(), duration: 30,
    type: 'phone_call', status: 'scheduled', attendees: ['Amit Kumar', 'Meera Krishnan'],
    notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    meetingId: 'meet-4', firmId: 'firm-1', clientId: null, leadId: 'lead-1',
    title: 'Acme Industries Follow-up', description: 'Follow up on GST compliance interest',
    dateTime: new Date(Date.now() + 4 * 86400000 + 15 * 3600000).toISOString(), duration: 30,
    type: 'video_call', status: 'scheduled', attendees: ['Priya Patel', 'Rajesh Sharma'],
    notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// KANBAN LEAD CARD
// ═══════════════════════════════════════════════════════════════════════════════

function KanbanLeadCard({ lead, onStatusChange, onConvert }: {
  lead: FirestoreLead & { id: string }
  onStatusChange: (id: string, status: LeadStatus) => void
  onConvert: (id: string) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const days = daysUntil(lead.nextFollowUp)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      draggable
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      className={`
        group cursor-grab active:cursor-grabbing rounded-xl border bg-white p-3.5
        shadow-sm hover:shadow-md transition-all duration-200
        ${isDragging ? 'ring-2 ring-emerald-400 ring-offset-2 shadow-lg scale-[1.02]' : ''}
        dark:bg-gray-900
      `}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{lead.contactName}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${scoreColor(lead.leadScore)}`}>
          {lead.leadScore}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{formatINR(lead.estimatedValue)}</span>
        {lead.gstin && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
            GSTIN
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        {lead.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {tag}
          </span>
        ))}
        {lead.tags.length > 2 && (
          <span className="text-[9px] text-muted-foreground">+{lead.tags.length - 2}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-emerald-100 text-emerald-700">
              {lead.assignedTo?.split(' ').map(w => w[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{lead.assignedTo}</span>
        </div>

        {lead.nextFollowUp && (
          <span className={`text-[10px] font-medium ${days <= 1 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {days <= 0 ? 'Overdue' : days === 1 ? 'Tomorrow' : `${days}d`}
          </span>
        )}
      </div>

      {lead.status !== 'converted' && lead.status !== 'lost' && (
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {lead.status === 'negotiation' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => onConvert(lead.leadId)}
            >
              <UserPlus className="h-3 w-3 mr-1" /> Convert
            </Button>
          )}
          {PIPELINE_COLUMNS.findIndex(c => c.status === lead.status) < PIPELINE_COLUMNS.length - 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => {
                const nextStatuses = PIPELINE_COLUMNS.map(c => c.status)
                const currentIdx = nextStatuses.indexOf(lead.status)
                if (currentIdx < nextStatuses.length - 2) {
                  onStatusChange(lead.leadId, nextStatuses[currentIdx + 1] as LeadStatus)
                }
              }}
            >
              Next <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE KANBAN VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function PipelineView({ leads, loading }: { leads: Array<FirestoreLead & { id: string }>; loading: boolean }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = !searchTerm ||
        lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter
      return matchesSearch && matchesSource
    })
  }, [leads, searchTerm, sourceFilter])

  const handleStatusChange = useCallback(async (leadId: string, newStatus: LeadStatus) => {
    try {
      await updateLead(leadId, { status: newStatus })
    } catch (err) {
      console.warn('Failed to update lead status:', err)
    }
  }, [])

  const handleConvert = useCallback(async (leadId: string) => {
    setConvertingId(leadId)
    try {
      await convertLeadToClient(leadId)
    } catch (err) {
      console.warn('Failed to convert lead:', err)
    } finally {
      setConvertingId(null)
    }
  }, [])

  const handleDrop = useCallback((leadId: string, newStatus: LeadStatus) => {
    handleStatusChange(leadId, newStatus)
    setDragOverColumn(null)
  }, [handleStatusChange])

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map(col => (
          <div key={col.status} className="min-w-[260px] flex-1">
            <Skeleton className="h-8 w-32 mb-3" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads by name or company..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCE_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map(col => {
          const columnLeads = filteredLeads.filter(l => l.status === col.status)
          const columnValue = columnLeads.reduce((sum, l) => sum + l.estimatedValue, 0)

          return (
            <div
              key={col.status}
              className={`
                min-w-[260px] flex-1 rounded-xl border-2 transition-colors duration-200
                ${dragOverColumn === col.status ? 'border-emerald-400 bg-emerald-50/50' : `border-transparent ${col.color}`}
              `}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.status) }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => {
                e.preventDefault()
                const leadId = e.dataTransfer?.getData('text/plain')
                if (leadId) handleDrop(leadId, col.status)
              }}
            >
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{columnLeads.length}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatINR(columnValue)}</span>
              </div>

              <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                <div className="px-2 pb-2 space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {columnLeads.map(lead => (
                      <div
                        key={lead.leadId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer?.setData('text/plain', lead.leadId)
                        }}
                      >
                        <KanbanLeadCard
                          lead={lead}
                          onStatusChange={handleStatusChange}
                          onConvert={handleConvert}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                  {columnLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center mb-2 ${col.color}`}>
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Drop leads here</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEALS TABLE VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function DealsView({ deals, leads, loading }: { deals: Array<FirestoreDeal & { id: string }>; leads: Array<FirestoreLead & { id: string }>; loading: boolean }) {
  const [sortField, setSortField] = useState<'value' | 'probability' | 'expectedCloseDate'>('value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDeal, setNewDeal] = useState({ title: '', description: '', value: '', stage: 'proposal' as DealStage, probability: '30', expectedCloseDate: '', assignedTo: '', leadId: '' })

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'value' || sortField === 'probability') {
        return ((a[sortField] as number) - (b[sortField] as number)) * dir
      }
      const aDate = typeof a.expectedCloseDate === 'string' ? new Date(a.expectedCloseDate).getTime() : 0
      const bDate = typeof b.expectedCloseDate === 'string' ? new Date(b.expectedCloseDate).getTime() : 0
      return (aDate - bDate) * dir
    })
  }, [deals, sortField, sortDir])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleCreateDeal = async () => {
    try {
      await createDeal({
        title: newDeal.title,
        description: newDeal.description,
        value: Number(newDeal.value) || 0,
        stage: newDeal.stage,
        probability: Number(newDeal.probability) || 30,
        expectedCloseDate: newDeal.expectedCloseDate ? new Date(newDeal.expectedCloseDate) : null,
        assignedTo: newDeal.assignedTo,
        leadId: newDeal.leadId || null,
        clientId: null,
      })
      setShowNewDeal(false)
      setNewDeal({ title: '', description: '', value: '', stage: 'proposal', probability: '30', expectedCloseDate: '', assignedTo: '', leadId: '' })
    } catch (err) {
      console.warn('Failed to create deal:', err)
    }
  }

  const getLeadName = (leadId: string | null) => {
    if (!leadId) return '—'
    const lead = leads.find(l => l.leadId === leadId)
    return lead ? lead.company : '—'
  }

  const totalPipeline = deals.filter(d => d.stage !== 'closed_lost').reduce((sum, d) => sum + d.value, 0)
  const weightedPipeline = deals.filter(d => d.stage !== 'closed_lost').reduce((sum, d) => sum + d.value * d.probability / 100, 0)

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Total Pipeline</p>
                <p className="text-lg font-bold text-foreground">{formatINR(totalPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Target className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Weighted Pipeline</p>
                <p className="text-lg font-bold text-foreground">{formatINR(weightedPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-4.5 w-4.5 text-violet-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Win Rate</p>
                <p className="text-lg font-bold text-foreground">
                  {deals.length > 0 ? Math.round(deals.filter(d => d.stage === 'closed_won').length / deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost').length * 100) || 0 : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deals Table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">All Deals</h3>
        <Button size="sm" className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowNewDeal(true)}>
          <Plus className="h-3.5 w-3.5" /> New Deal
        </Button>
      </div>

      <Card className="border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Deal</TableHead>
              <TableHead className="text-xs">Client/Lead</TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('value')}>
                Value {sortField === 'value' && (sortDir === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-xs">Stage</TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('probability')}>
                Prob. {sortField === 'probability' && (sortDir === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('expectedCloseDate')}>
                Expected Close {sortField === 'expectedCloseDate' && (sortDir === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-xs">Assigned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDeals.map(deal => {
              const stageConf = DEAL_STAGE_CONFIG[deal.stage]
              return (
                <TableRow key={deal.dealId} className="hover:bg-muted/40">
                  <TableCell className="text-xs font-medium">{deal.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getLeadName(deal.leadId)}</TableCell>
                  <TableCell className="text-xs font-semibold text-emerald-700">{formatINR(deal.value)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${stageConf.bg} ${stageConf.color}`}>
                      {stageConf.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{deal.probability}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(deal.expectedCloseDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[8px] bg-emerald-100 text-emerald-700">
                          {deal.assignedTo?.split(' ').map(w => w[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground">{deal.assignedTo}</span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* New Deal Dialog */}
      <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-emerald-600" /> Create New Deal
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs">Deal Title</Label>
              <Input value={newDeal.title} onChange={e => setNewDeal(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Annual GST Retainer" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">Value (₹)</Label>
                <Input type="number" value={newDeal.value} onChange={e => setNewDeal(p => ({ ...p, value: e.target.value }))} placeholder="500000" className="h-9 text-sm" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Stage</Label>
                <Select value={newDeal.stage} onValueChange={v => setNewDeal(p => ({ ...p, stage: v as DealStage }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">Probability (%)</Label>
                <Input type="number" value={newDeal.probability} onChange={e => setNewDeal(p => ({ ...p, probability: e.target.value }))} placeholder="50" className="h-9 text-sm" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Expected Close</Label>
                <Input type="date" value={newDeal.expectedCloseDate} onChange={e => setNewDeal(p => ({ ...p, expectedCloseDate: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Assigned To</Label>
              <Input value={newDeal.assignedTo} onChange={e => setNewDeal(p => ({ ...p, assignedTo: e.target.value }))} placeholder="Team member name" className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={newDeal.description} onChange={e => setNewDeal(p => ({ ...p, description: e.target.value }))} placeholder="Deal details..." className="text-sm min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewDeal(false)}>Cancel</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateDeal} disabled={!newDeal.title || !newDeal.value}>
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETINGS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function MeetingsView({ meetings, leads, loading }: { meetings: Array<FirestoreMeeting & { id: string }>; leads: Array<FirestoreLead & { id: string }>; loading: boolean }) {
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState({
    title: '', description: '', dateTime: '', duration: '30', type: 'video_call' as MeetingType,
    attendees: '', leadId: '',
  })

  const upcoming = useMemo(() => {
    return meetings
      .filter(m => m.status === 'scheduled')
      .sort((a, b) => {
        const aTime = typeof a.dateTime === 'string' ? new Date(a.dateTime).getTime() : 0
        const bTime = typeof b.dateTime === 'string' ? new Date(b.dateTime).getTime() : 0
        return aTime - bTime
      })
  }, [meetings])

  const handleCreateMeeting = async () => {
    try {
      await createMeeting({
        title: newMeeting.title,
        description: newMeeting.description,
        dateTime: newMeeting.dateTime ? new Date(newMeeting.dateTime) : null,
        duration: Number(newMeeting.duration) || 30,
        type: newMeeting.type,
        status: 'scheduled',
        attendees: newMeeting.attendees.split(',').map(s => s.trim()).filter(Boolean),
        notes: '',
        leadId: newMeeting.leadId || null,
        clientId: null,
      })
      setShowNewMeeting(false)
      setNewMeeting({ title: '', description: '', dateTime: '', duration: '30', type: 'video_call', attendees: '', leadId: '' })
    } catch (err) {
      console.warn('Failed to create meeting:', err)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Upcoming Meetings</h3>
        <Button size="sm" className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowNewMeeting(true)}>
          <Plus className="h-3.5 w-3.5" /> Schedule Meeting
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No meetings scheduled</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Schedule your first meeting to get started.</p>
          <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowNewMeeting(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Schedule Meeting
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map(meeting => {
            const days = daysUntil(meeting.dateTime)
            const lead = leads.find(l => l.leadId === meeting.leadId)
            const statusConfig: Record<MeetingStatus, { color: string; bg: string }> = {
              scheduled: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              completed: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              cancelled: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
            }
            const sConf = statusConfig[meeting.status]

            return (
              <motion.div
                key={meeting.meetingId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-4 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all dark:bg-gray-900"
              >
                {/* Date Badge */}
                <div className="flex flex-col items-center justify-center min-w-[56px]">
                  <span className="text-lg font-bold text-foreground">
                    {typeof meeting.dateTime === 'string' ? new Date(meeting.dateTime).getDate() : '—'}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    {typeof meeting.dateTime === 'string' ? new Date(meeting.dateTime).toLocaleDateString('en-IN', { month: 'short' }) : ''}
                  </span>
                </div>

                <Separator orientation="vertical" className="h-auto" />

                {/* Meeting Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">{meeting.title}</span>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${sConf.bg} ${sConf.color}`}>
                      {meeting.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{meeting.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(meeting.dateTime)} · {meeting.duration}min
                    </span>
                    <span className="flex items-center gap-1">
                      {MEETING_TYPE_ICON[meeting.type]}
                      {meeting.type.replace('_', ' ')}
                    </span>
                    {lead && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {lead.company}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {meeting.attendees.map((att, i) => (
                      <Avatar key={i} className="h-5 w-5 border border-white">
                        <AvatarFallback className="text-[8px] bg-emerald-100 text-emerald-700">
                          {att.split(' ').map(w => w[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {meeting.attendees.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Follow-up urgency */}
                <div className="flex flex-col items-end justify-center shrink-0">
                  {days <= 0 ? (
                    <Badge className="text-[10px] bg-red-500 text-white">Today</Badge>
                  ) : days === 1 ? (
                    <Badge className="text-[10px] bg-amber-500 text-white">Tomorrow</Badge>
                  ) : days <= 7 ? (
                    <span className="text-[10px] text-muted-foreground">{days} days</span>
                  ) : null}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* New Meeting Dialog */}
      <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" /> Schedule Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs">Meeting Title</Label>
              <Input value={newMeeting.title} onChange={e => setNewMeeting(p => ({ ...p, title: e.target.value }))} placeholder="e.g., GST Compliance Discussion" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">Date & Time</Label>
                <Input type="datetime-local" value={newMeeting.dateTime} onChange={e => setNewMeeting(p => ({ ...p, dateTime: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Duration (min)</Label>
                <Select value={newMeeting.duration} onValueChange={v => setNewMeeting(p => ({ ...p, duration: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">Meeting Type</Label>
                <Select value={newMeeting.type} onValueChange={v => setNewMeeting(p => ({ ...p, type: v as MeetingType }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video_call">Video Call</SelectItem>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Attendees (comma separated)</Label>
                <Input value={newMeeting.attendees} onChange={e => setNewMeeting(p => ({ ...p, attendees: e.target.value }))} placeholder="Name1, Name2" className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={newMeeting.description} onChange={e => setNewMeeting(p => ({ ...p, description: e.target.value }))} placeholder="Meeting agenda..." className="text-sm min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewMeeting(false)}>Cancel</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateMeeting} disabled={!newMeeting.title || !newMeeting.dateTime}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD SCORING VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function LeadScoringView({ leads, loading }: { leads: Array<FirestoreLead & { id: string }>; loading: boolean }) {
  const topLeads = useMemo(() => {
    return [...leads]
      .filter(l => l.status !== 'converted' && l.status !== 'lost')
      .sort((a, b) => b.leadScore - a.leadScore)
      .slice(0, 5)
  }, [leads])

  const scoreDistribution = useMemo(() => {
    const ranges = [
      { label: 'Hot (70-100)', min: 70, max: 100, color: 'bg-emerald-500', count: 0 },
      { label: 'Warm (40-69)', min: 40, max: 69, color: 'bg-amber-500', count: 0 },
      { label: 'Cold (0-39)', min: 0, max: 39, color: 'bg-red-500', count: 0 },
    ]
    leads.filter(l => l.status !== 'converted' && l.status !== 'lost').forEach(lead => {
      const range = ranges.find(r => lead.leadScore >= r.min && lead.leadScore <= r.max)
      if (range) range.count++
    })
    return ranges
  }, [leads])

  const avgScore = useMemo(() => {
    const active = leads.filter(l => l.status !== 'converted' && l.status !== 'lost')
    return active.length > 0 ? Math.round(active.reduce((sum, l) => sum + l.leadScore, 0) / active.length) : 0
  }, [leads])

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-6">
      {/* Average Score */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center">
            <div className={`relative h-32 w-32 rounded-full flex items-center justify-center mb-3`}>
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                <circle
                  cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(avgScore / 100) * 327} 327`}
                  className={avgScore >= 70 ? 'text-emerald-500' : avgScore >= 40 ? 'text-amber-500' : 'text-red-500'}
                  stroke="currentColor"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{avgScore}</span>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Average Lead Score</p>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-xs font-semibold">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {scoreDistribution.map(range => {
              const total = scoreDistribution.reduce((s, r) => s + r.count, 0) || 1
              return (
                <div key={range.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{range.label}</span>
                    <span className="text-[11px] font-semibold">{range.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(range.count / total) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${range.color}`}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Score Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Company Size', score: 25, max: 25, desc: 'Based on estimated revenue' },
              { label: 'GST Volume', score: 20, max: 25, desc: 'Monthly GST transactions' },
              { label: 'Engagement Level', score: 18, max: 25, desc: 'Email & call interactions' },
              { label: 'Source Quality', score: 15, max: 25, desc: 'Referral vs cold lead' },
            ].map(factor => (
              <div key={factor.label} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-foreground">{factor.label}</span>
                  <span className="text-[10px] text-muted-foreground">{factor.score}/{factor.max}</span>
                </div>
                <Progress value={(factor.score / factor.max) * 100} className="h-1.5 mb-1" />
                <p className="text-[9px] text-muted-foreground">{factor.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Leads */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-amber-500" /> Top Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {topLeads.map((lead, idx) => (
            <div key={lead.leadId} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${scoreBgGradient(lead.leadScore)}`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{lead.contactName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className={`text-[10px] font-bold ${scoreColor(lead.leadScore)}`}>
                  {lead.leadScore}
                </Badge>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{formatINR(lead.estimatedValue)}</p>
              </div>
            </div>
          ))}
          {topLeads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No active leads to score</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE FORECASTING VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueForecastView({ leads, deals, loading }: { leads: Array<FirestoreLead & { id: string }>; deals: Array<FirestoreDeal & { id: string }>; loading: boolean }) {
  const stageValues = useMemo(() => {
    const stages: Record<string, { label: string; value: number; color: string }> = {
      new: { label: 'New', value: 0, color: '#94a3b8' },
      contacted: { label: 'Contacted', value: 0, color: '#3b82f6' },
      qualified: { label: 'Qualified', value: 0, color: '#8b5cf6' },
      proposal_sent: { label: 'Proposal', value: 0, color: '#f59e0b' },
      negotiation: { label: 'Negotiation', value: 0, color: '#f97316' },
    }
    leads.filter(l => l.status !== 'converted' && l.status !== 'lost').forEach(lead => {
      if (stages[lead.status]) stages[lead.status].value += lead.estimatedValue
    })
    return Object.values(stages)
  }, [leads])

  const maxBarValue = useMemo(() => Math.max(...stageValues.map(s => s.value), 1), [stageValues])

  const weightedPipeline = useMemo(() => {
    return deals.filter(d => d.stage !== 'closed_lost').reduce((sum, d) => sum + d.value * d.probability / 100, 0)
  }, [deals])

  const totalPipeline = useMemo(() => {
    return deals.filter(d => d.stage !== 'closed_lost').reduce((sum, d) => sum + d.value, 0)
  }, [deals])

  const monthlyTrend = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return months.map(m => ({ month: m, converted: Math.floor(Math.random() * 3) + 1, value: Math.floor(Math.random() * 500000) + 100000 }))
  }, [])

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">Total Pipeline Value</p>
            <p className="text-xl font-bold text-foreground">{formatINR(totalPipeline)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">Weighted Pipeline</p>
            <p className="text-xl font-bold text-emerald-600">{formatINR(weightedPipeline)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">Avg. Deal Size</p>
            <p className="text-xl font-bold text-foreground">{formatINR(deals.length > 0 ? totalPipeline / deals.length : 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline by Stage (SVG Bar Chart) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Pipeline Value by Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {stageValues.map(stage => (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">{stage.label}</span>
                  <span className="text-[11px] font-semibold text-foreground">{formatINR(stage.value)}</span>
                </div>
                <div className="h-6 rounded-lg bg-slate-50 dark:bg-slate-900 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stage.value / maxBarValue) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-lg flex items-center px-2"
                    style={{ backgroundColor: stage.color, minWidth: stage.value > 0 ? '20px' : '0' }}
                  >
                    {stage.value > 0 && (
                      <span className="text-[9px] font-semibold text-white whitespace-nowrap">
                        {formatINR(stage.value)}
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Conversion Trend */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Monthly Conversion Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-end gap-2 h-40">
            {monthlyTrend.map((m, idx) => {
              const maxVal = Math.max(...monthlyTrend.map(x => x.value), 1)
              const height = (m.value / maxVal) * 100
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold text-emerald-600">{m.converted}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 min-h-[4px]"
                  />
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[9px] text-muted-foreground">Conversions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD LEAD DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({
    contactName: '', contactEmail: '', contactPhone: '', company: '', gstin: '',
    source: 'website' as LeadSource, estimatedValue: '', notes: '', assignedTo: '',
    nextFollowUp: '', tags: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await createLead({
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        company: form.company,
        gstin: form.gstin || null,
        source: form.source,
        status: 'new',
        leadScore: 50,
        estimatedValue: Number(form.estimatedValue) || 0,
        notes: form.notes,
        assignedTo: form.assignedTo,
        nextFollowUp: form.nextFollowUp ? new Date(form.nextFollowUp) : null,
        convertedClientId: null,
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      })
      onOpenChange(false)
      setForm({ contactName: '', contactEmail: '', contactPhone: '', company: '', gstin: '', source: 'website', estimatedValue: '', notes: '', assignedTo: '', nextFollowUp: '', tags: '' })
    } catch (err) {
      console.warn('Failed to create lead:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" /> Add New Lead
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Contact Name *</Label>
              <Input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="Full name" className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Company *</Label>
              <Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="email@company.in" className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Phone</Label>
              <Input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+91 98765 43210" className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v as LeadSource }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Estimated Value (₹)</Label>
              <Input type="number" value={form.estimatedValue} onChange={e => setForm(p => ({ ...p, estimatedValue: e.target.value }))} placeholder="250000" className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">GSTIN (optional)</Label>
              <Input value={form.gstin} onChange={e => setForm(p => ({ ...p, gstin: e.target.value }))} placeholder="27XXXXX1234F1Z5" className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Next Follow-up</Label>
              <Input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({ ...p, nextFollowUp: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Assigned To</Label>
            <Input value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} placeholder="Team member name" className="h-9 text-sm" />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Tags (comma separated)</Label>
            <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="manufacturing, high-value" className="h-9 text-sm" />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Lead details..." className="text-sm min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={!form.contactName || !form.company || saving}>
            {saving ? 'Adding...' : 'Add Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CRM PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CRMPage() {
  const { data: fireLeads, loading: leadsLoading } = useFireLeads()
  const { data: fireDeals, loading: dealsLoading } = useFireDeals()
  const { data: fireMeetings, loading: meetingsLoading } = useFireMeetings()
  const [showAddLead, setShowAddLead] = useState(false)

  // Use Firestore data when available, otherwise use sample data for demo
  const leads = fireLeads.length > 0 ? fireLeads as unknown as Array<FirestoreLead & { id: string }> : SAMPLE_LEADS as unknown as Array<FirestoreLead & { id: string }>
  const deals = fireDeals.length > 0 ? fireDeals as unknown as Array<FirestoreDeal & { id: string }> : SAMPLE_DEALS as unknown as Array<FirestoreDeal & { id: string }>
  const meetings = fireMeetings.length > 0 ? fireMeetings as unknown as Array<FirestoreMeeting & { id: string }> : SAMPLE_MEETINGS as unknown as Array<FirestoreMeeting & { id: string }>

  const loading = leadsLoading && dealsLoading && meetingsLoading

  // Quick stats
  const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost')
  const totalPipeline = activeLeads.reduce((sum, l) => sum + l.estimatedValue, 0)
  const conversionRate = leads.length > 0 ? Math.round(leads.filter(l => l.status === 'converted').length / leads.length * 100) : 0
  const scheduledMeetings = meetings.filter(m => m.status === 'scheduled').length

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            CRM Pipeline
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage leads, deals, and client relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowAddLead(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add Lead
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAddLead(true)}>
            <Plus className="h-3.5 w-3.5" /> Quick Add
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Leads', value: activeLeads.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pipeline Value', value: formatINR(totalPipeline), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Upcoming Meetings', value: scheduledMeetings, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="h-9 bg-muted/50 p-0.5">
          <TabsTrigger value="pipeline" className="text-xs h-8 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="deals" className="text-xs h-8 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Deals
          </TabsTrigger>
          <TabsTrigger value="meetings" className="text-xs h-8 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Meetings
          </TabsTrigger>
          <TabsTrigger value="scoring" className="text-xs h-8 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Scoring
          </TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs h-8 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-0">
          <PipelineView leads={leads} loading={loading} />
        </TabsContent>

        <TabsContent value="deals" className="mt-0">
          <DealsView deals={deals} leads={leads} loading={loading} />
        </TabsContent>

        <TabsContent value="meetings" className="mt-0">
          <MeetingsView meetings={meetings} leads={leads} loading={loading} />
        </TabsContent>

        <TabsContent value="scoring" className="mt-0">
          <LeadScoringView leads={leads} loading={loading} />
        </TabsContent>

        <TabsContent value="forecast" className="mt-0">
          <RevenueForecastView leads={leads} deals={deals} loading={loading} />
        </TabsContent>
      </Tabs>

      {/* Add Lead Dialog */}
      <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} />
    </div>
  )
}
