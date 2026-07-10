'use client'

import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { motion } from 'framer-motion'
import { Zap, ArrowRight, Play, Pause, Plus, Copy, Pencil, Trash2, FileScan, Shield, Bell, GitCompare, Brain, FileCheck, Send } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutomationStatus = 'active' | 'paused' | 'disabled'

export interface AutomationTrigger {
  type: 'invoice_uploaded' | 'return_ready' | 'due_date_tomorrow' | 'mismatch_detected' | 'client_risk_high' | 'document_processed' | 'reconciliation_completed'
  conditions: Record<string, string | number | boolean>
}

export interface AutomationAction {
  type: 'extract_invoice' | 'notify_manager' | 'create_notification' | 'assign_task' | 'generate_recommendation' | 'run_reconciliation' | 'create_task' | 'send_email'
  params: Record<string, string | number | boolean>
}

export interface FirestoreAutomation {
  automationId: string
  firmId: string
  name: string
  description: string
  trigger: AutomationTrigger
  actions: AutomationAction[]
  status: AutomationStatus
  runCount: number
  lastRunAt: unknown | null
  createdBy: string
  createdAt: unknown
  updatedAt: unknown
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<AutomationTrigger['type'], string> = {
  invoice_uploaded: 'Invoice Uploaded',
  return_ready: 'Return Ready',
  due_date_tomorrow: 'Due Date Tomorrow',
  mismatch_detected: 'Mismatch Detected',
  client_risk_high: 'Client Risk High',
  document_processed: 'Document Processed',
  reconciliation_completed: 'Reconciliation Completed',
}

const TRIGGER_DESCRIPTIONS: Record<AutomationTrigger['type'], string> = {
  invoice_uploaded: 'Triggers when a new invoice is uploaded to the system',
  return_ready: 'Triggers when a GST return is ready for filing',
  due_date_tomorrow: 'Triggers when a filing due date is tomorrow',
  mismatch_detected: 'Triggers when a reconciliation mismatch is found',
  client_risk_high: 'Triggers when a client health score drops below threshold',
  document_processed: 'Triggers when a document has been processed',
  reconciliation_completed: 'Triggers when a reconciliation run completes',
}

const TRIGGER_ICONS: Record<AutomationTrigger['type'], React.ReactNode> = {
  invoice_uploaded: <FileScan className="h-4 w-4" />,
  return_ready: <FileCheck className="h-4 w-4" />,
  due_date_tomorrow: <Bell className="h-4 w-4" />,
  mismatch_detected: <GitCompare className="h-4 w-4" />,
  client_risk_high: <Shield className="h-4 w-4" />,
  document_processed: <FileScan className="h-4 w-4" />,
  reconciliation_completed: <GitCompare className="h-4 w-4" />,
}

const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  extract_invoice: 'Extract Invoice',
  notify_manager: 'Notify Manager',
  create_notification: 'Create Notification',
  assign_task: 'Assign Task',
  generate_recommendation: 'Generate AI Recommendation',
  run_reconciliation: 'Run Reconciliation',
  create_task: 'Create Task',
  send_email: 'Send Email',
}

const ACTION_ICONS: Record<AutomationAction['type'], React.ReactNode> = {
  extract_invoice: <FileScan className="h-4 w-4" />,
  notify_manager: <Bell className="h-4 w-4" />,
  create_notification: <Bell className="h-4 w-4" />,
  assign_task: <Send className="h-4 w-4" />,
  generate_recommendation: <Brain className="h-4 w-4" />,
  run_reconciliation: <GitCompare className="h-4 w-4" />,
  create_task: <Plus className="h-4 w-4" />,
  send_email: <Send className="h-4 w-4" />,
}

const TRIGGER_CONDITIONS: Record<AutomationTrigger['type'], { key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }[]> = {
  invoice_uploaded: [
    { key: 'fileTypes', label: 'File Types', type: 'text' },
    { key: 'clientFilter', label: 'Client Filter', type: 'select', options: ['All Clients', 'Active Only', 'High Value'] },
  ],
  return_ready: [
    { key: 'returnType', label: 'Return Type', type: 'select', options: ['GSTR-1', 'GSTR-3B', 'All'] },
    { key: 'period', label: 'Period', type: 'text' },
  ],
  due_date_tomorrow: [
    { key: 'returnType', label: 'Return Type', type: 'select', options: ['GSTR-1', 'GSTR-3B', 'All'] },
    { key: 'minPenaltyAmount', label: 'Min Penalty Amount', type: 'number' },
  ],
  mismatch_detected: [
    { key: 'severity', label: 'Severity', type: 'select', options: ['All', 'High', 'Medium', 'Low'] },
    { key: 'minAmount', label: 'Min Mismatch Amount', type: 'number' },
  ],
  client_risk_high: [
    { key: 'healthThreshold', label: 'Health Score Below', type: 'number' },
    { key: 'riskCategory', label: 'Risk Category', type: 'select', options: ['All', 'Critical', 'High', 'Medium'] },
  ],
  document_processed: [
    { key: 'docType', label: 'Document Type', type: 'select', options: ['All', 'Invoice', 'GST Return', 'Notice'] },
    { key: 'extractionStatus', label: 'Extraction Status', type: 'select', options: ['Any', 'Success', 'Failed'] },
  ],
  reconciliation_completed: [
    { key: 'matchRate', label: 'Match Rate Below (%)', type: 'number' },
    { key: 'period', label: 'Period', type: 'text' },
  ],
}

const ACTION_PARAMS: Record<AutomationAction['type'], { key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }[]> = {
  extract_invoice: [
    { key: 'extractMethod', label: 'Extraction Method', type: 'select', options: ['AI Auto', 'Rule Based', 'Hybrid'] },
  ],
  notify_manager: [
    { key: 'channel', label: 'Channel', type: 'select', options: ['In-App', 'Email', 'Both'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
  ],
  create_notification: [
    { key: 'notificationType', label: 'Type', type: 'select', options: ['Info', 'Warning', 'Alert'] },
    { key: 'recipient', label: 'Recipient', type: 'select', options: ['Manager', 'Team', 'Client'] },
  ],
  assign_task: [
    { key: 'assignTo', label: 'Assign To', type: 'select', options: ['Manager', 'Available Team Member', 'Specific Person'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Urgent', 'High', 'Medium'] },
  ],
  generate_recommendation: [
    { key: 'aiModel', label: 'AI Model', type: 'select', options: ['GPT-4', 'Claude', 'Auto'] },
    { key: 'contextDepth', label: 'Context Depth', type: 'select', options: ['Full', 'Summary', 'Minimal'] },
  ],
  run_reconciliation: [
    { key: 'reconType', label: 'Reconciliation Type', type: 'select', options: ['GSTR-2A vs Books', 'GSTR-1 vs Books', 'Full'] },
    { key: 'period', label: 'Period', type: 'text' },
  ],
  create_task: [
    { key: 'taskType', label: 'Task Type', type: 'select', options: ['Follow Up', 'Review', 'Correction'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Urgent', 'High', 'Medium', 'Low'] },
  ],
  send_email: [
    { key: 'template', label: 'Email Template', type: 'select', options: ['Filing Reminder', 'Mismatch Alert', 'Custom'] },
    { key: 'recipient', label: 'Recipient', type: 'select', options: ['Client', 'Manager', 'Team'] },
  ],
}

// ─── Sample Data ────────────────────────────────────────────────────────────

const INITIAL_AUTOMATIONS: FirestoreAutomation[] = [
  {
    automationId: 'auto-001',
    firmId: 'firm-001',
    name: 'Invoice Auto-Extract',
    description: 'Automatically extract data from uploaded invoices',
    trigger: { type: 'invoice_uploaded', conditions: { fileTypes: 'All', clientFilter: 'Active Only' } },
    actions: [{ type: 'extract_invoice', params: { extractMethod: 'AI Auto' } }],
    status: 'active',
    runCount: 147,
    lastRunAt: new Date(Date.now() - 3600000),
    createdBy: 'user-001',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2025-01-10'),
  },
  {
    automationId: 'auto-002',
    firmId: 'firm-001',
    name: 'Filing Reminder',
    description: 'Send notifications when filing due date is tomorrow',
    trigger: { type: 'due_date_tomorrow', conditions: { returnType: 'All', minPenaltyAmount: 0 } },
    actions: [
      { type: 'create_notification', params: { notificationType: 'Warning', recipient: 'Manager' } },
      { type: 'notify_manager', params: { channel: 'Both', priority: 'High' } },
    ],
    status: 'active',
    runCount: 52,
    lastRunAt: new Date(Date.now() - 86400000),
    createdBy: 'user-001',
    createdAt: new Date('2024-12-05'),
    updatedAt: new Date('2025-01-08'),
  },
  {
    automationId: 'auto-003',
    firmId: 'firm-001',
    name: 'Mismatch Alert',
    description: 'Auto-assign tasks and generate recommendations when mismatches are detected',
    trigger: { type: 'mismatch_detected', conditions: { severity: 'High', minAmount: 1000 } },
    actions: [
      { type: 'assign_task', params: { assignTo: 'Available Team Member', priority: 'Urgent' } },
      { type: 'generate_recommendation', params: { aiModel: 'Auto', contextDepth: 'Full' } },
    ],
    status: 'active',
    runCount: 28,
    lastRunAt: new Date(Date.now() - 172800000),
    createdBy: 'user-001',
    createdAt: new Date('2024-12-10'),
    updatedAt: new Date('2025-01-05'),
  },
  {
    automationId: 'auto-004',
    firmId: 'firm-001',
    name: 'Risk Watch',
    description: 'Generate AI recommendations for high-risk clients',
    trigger: { type: 'client_risk_high', conditions: { healthThreshold: 40, riskCategory: 'All' } },
    actions: [{ type: 'generate_recommendation', params: { aiModel: 'GPT-4', contextDepth: 'Full' } }],
    status: 'active',
    runCount: 19,
    lastRunAt: new Date(Date.now() - 259200000),
    createdBy: 'user-001',
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date('2025-01-02'),
  },
  {
    automationId: 'auto-005',
    firmId: 'firm-001',
    name: 'Return Ready Notify',
    description: 'Notify manager when a GST return is ready for filing',
    trigger: { type: 'return_ready', conditions: { returnType: 'All', period: 'Current' } },
    actions: [{ type: 'notify_manager', params: { channel: 'In-App', priority: 'High' } }],
    status: 'active',
    runCount: 34,
    lastRunAt: new Date(Date.now() - 43200000),
    createdBy: 'user-001',
    createdAt: new Date('2024-12-20'),
    updatedAt: new Date('2025-01-09'),
  },
  {
    automationId: 'auto-006',
    firmId: 'firm-001',
    name: 'Recon Auto-Run',
    description: 'Automatically run reconciliation when documents are processed',
    trigger: { type: 'document_processed', conditions: { docType: 'Invoice', extractionStatus: 'Success' } },
    actions: [{ type: 'run_reconciliation', params: { reconType: 'Full', period: 'Current' } }],
    status: 'active',
    runCount: 63,
    lastRunAt: new Date(Date.now() - 7200000),
    createdBy: 'user-001',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-10'),
  },
]

// ─── Template Data ──────────────────────────────────────────────────────────

interface AutomationTemplate {
  name: string
  description: string
  trigger: AutomationTrigger
  actions: AutomationAction[]
  icon: React.ReactNode
}

const TEMPLATES: AutomationTemplate[] = [
  {
    name: 'Invoice Auto-Extract',
    description: 'WHEN invoice uploaded → THEN extract invoice data automatically',
    trigger: { type: 'invoice_uploaded', conditions: {} },
    actions: [{ type: 'extract_invoice', params: {} }],
    icon: <FileScan className="h-5 w-5" />,
  },
  {
    name: 'Filing Reminder',
    description: 'WHEN due date tomorrow → THEN create notification + notify manager',
    trigger: { type: 'due_date_tomorrow', conditions: {} },
    actions: [
      { type: 'create_notification', params: {} },
      { type: 'notify_manager', params: {} },
    ],
    icon: <Bell className="h-5 w-5" />,
  },
  {
    name: 'Mismatch Alert',
    description: 'WHEN mismatch detected → THEN assign task + generate recommendation',
    trigger: { type: 'mismatch_detected', conditions: {} },
    actions: [
      { type: 'assign_task', params: {} },
      { type: 'generate_recommendation', params: {} },
    ],
    icon: <GitCompare className="h-5 w-5" />,
  },
  {
    name: 'Risk Watch',
    description: 'WHEN client risk high → THEN generate AI recommendation',
    trigger: { type: 'client_risk_high', conditions: {} },
    actions: [{ type: 'generate_recommendation', params: {} }],
    icon: <Shield className="h-5 w-5" />,
  },
  {
    name: 'Return Ready Notify',
    description: 'WHEN return ready → THEN notify manager',
    trigger: { type: 'return_ready', conditions: {} },
    actions: [{ type: 'notify_manager', params: {} }],
    icon: <FileCheck className="h-5 w-5" />,
  },
  {
    name: 'Recon Auto-Run',
    description: 'WHEN document processed → THEN run reconciliation',
    trigger: { type: 'document_processed', conditions: {} },
    actions: [{ type: 'run_reconciliation', params: {} }],
    icon: <GitCompare className="h-5 w-5" />,
  },
]

// ─── Helper ─────────────────────────────────────────────────────────────────

function formatLastRun(date: unknown): string {
  if (!date) return 'Never'
  const d = date instanceof Date ? date : new Date(date as string | number)
  if (isNaN(d.getTime())) return 'Never'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function statusDot(status: AutomationStatus) {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'paused') return 'bg-amber-500'
  return 'bg-gray-400'
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FlowNode({ label, icon, variant }: { label: string; icon: React.ReactNode; variant: 'trigger' | 'action' }) {
  const bg = variant === 'trigger' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
  const iconBg = variant === 'trigger' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg} text-sm font-medium`}>
      <span className={`flex items-center justify-center h-6 w-6 rounded-md ${iconBg}`}>{icon}</span>
      <span className="truncate max-w-[140px]">{label}</span>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex items-center px-1">
      <div className="h-px w-4 bg-gray-300" />
      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
    </div>
  )
}

function AutomationFlow({ trigger, actions }: { trigger: AutomationTrigger; actions: AutomationAction[] }) {
  return (
    <div className="flex items-center gap-0 flex-wrap">
      <FlowNode label={TRIGGER_LABELS[trigger.type]} icon={TRIGGER_ICONS[trigger.type]} variant="trigger" />
      <FlowArrow />
      {actions.map((action, i) => (
        <div key={i} className="flex items-center gap-0">
          {i > 0 && <FlowArrow />}
          <FlowNode label={ACTION_LABELS[action.type]} icon={ACTION_ICONS[action.type]} variant="action" />
        </div>
      ))}
    </div>
  )
}

// ─── Context Menu for Automation ────────────────────────────────────────────

function AutomationContextMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setOpen(!open)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
          <circle cx="4" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="12" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white dark:bg-gray-900 border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => { setOpen(false); onEdit() }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => { setOpen(false); onDuplicate() }}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
            <Separator />
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              onClick={() => { setOpen(false); onDelete() }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Create Automation Dialog ───────────────────────────────────────────────

function CreateAutomationDialog({
  open,
  onOpenChange,
  onSave,
  editAutomation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (automation: Omit<FirestoreAutomation, 'automationId' | 'firmId' | 'runCount' | 'lastRunAt' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void
  editAutomation: FirestoreAutomation | null
}) {
  const [step, setStep] = useState(1)
  const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>('invoice_uploaded')
  const [conditions, setConditions] = useState<Record<string, string | number | boolean>>({})
  const [actionType, setActionType] = useState<AutomationAction['type']>('extract_invoice')
  const [actionParams, setActionParams] = useState<Record<string, string | number | boolean>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Reset form when dialog opens or editAutomation changes
  const resetForm = () => {
    if (editAutomation) {
      setTriggerType(editAutomation.trigger.type)
      setConditions({ ...editAutomation.trigger.conditions })
      setActionType(editAutomation.actions[0]?.type || 'extract_invoice')
      setActionParams({ ...editAutomation.actions[0]?.params })
      setName(editAutomation.name)
      setDescription(editAutomation.description)
      setStep(5) // jump to name step for editing
    } else {
      setTriggerType('invoice_uploaded')
      setConditions({})
      setActionType('extract_invoice')
      setActionParams({})
      setName('')
      setDescription('')
      setStep(1)
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the automation')
      return
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      trigger: { type: triggerType, conditions },
      actions: [{ type: actionType, params: actionParams }],
      status: editAutomation?.status || 'active',
    })
    onOpenChange(false)
    setStep(1)
  }

  const steps = [
    { num: 1, label: 'Trigger' },
    { num: 2, label: 'Conditions' },
    { num: 3, label: 'Action' },
    { num: 4, label: 'Parameters' },
    { num: 5, label: 'Save' },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) resetForm() }}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {editAutomation ? 'Edit Automation' : 'Create Automation'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 transition-colors ${step >= s.num ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                {s.num}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${step > s.num ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        <ScrollArea className="max-h-[50vh] pr-2">
          {/* Step 1: Choose Trigger */}
          {step === 1 && (
            <div className="space-y-2 py-2">
              <h3 className="text-sm font-semibold mb-3">Choose a Trigger</h3>
              <p className="text-xs text-muted-foreground mb-3">What event should start this automation?</p>
              <div className="grid gap-2">
                {(Object.keys(TRIGGER_LABELS) as AutomationTrigger['type'][]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTriggerType(t)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${triggerType === t ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-400' : 'border-border hover:border-amber-200'}`}
                  >
                    <span className={`flex items-center justify-center h-8 w-8 rounded-lg ${triggerType === t ? 'bg-amber-200 text-amber-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                      {TRIGGER_ICONS[t]}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{TRIGGER_LABELS[t]}</p>
                      <p className="text-xs text-muted-foreground">{TRIGGER_DESCRIPTIONS[t]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure Conditions */}
          {step === 2 && (
            <div className="space-y-3 py-2">
              <h3 className="text-sm font-semibold">Configure Trigger Conditions</h3>
              <p className="text-xs text-muted-foreground">Set conditions for the &ldquo;{TRIGGER_LABELS[triggerType]}&rdquo; trigger</p>
              <div className="space-y-3">
                {TRIGGER_CONDITIONS[triggerType].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                    {field.type === 'select' ? (
                      <Select
                        value={String(conditions[field.key] || field.options?.[0] || '')}
                        onValueChange={(v) => setConditions({ ...conditions, [field.key]: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'number' ? (
                      <Input
                        type="number"
                        value={String(conditions[field.key] || '')}
                        onChange={(e) => setConditions({ ...conditions, [field.key]: Number(e.target.value) || 0 })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <Input
                        value={String(conditions[field.key] || '')}
                        onChange={(e) => setConditions({ ...conditions, [field.key]: e.target.value })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
                {TRIGGER_CONDITIONS[triggerType].length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No conditions needed for this trigger type.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Choose Action */}
          {step === 3 && (
            <div className="space-y-2 py-2">
              <h3 className="text-sm font-semibold mb-3">Choose an Action</h3>
              <p className="text-xs text-muted-foreground mb-3">What should happen when the trigger fires?</p>
              <div className="grid gap-2">
                {(Object.keys(ACTION_LABELS) as AutomationAction['type'][]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setActionType(a)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${actionType === a ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-400' : 'border-border hover:border-emerald-200'}`}
                  >
                    <span className={`flex items-center justify-center h-8 w-8 rounded-lg ${actionType === a ? 'bg-emerald-200 text-emerald-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                      {ACTION_ICONS[a]}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{ACTION_LABELS[a]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Configure Action Parameters */}
          {step === 4 && (
            <div className="space-y-3 py-2">
              <h3 className="text-sm font-semibold">Configure Action Parameters</h3>
              <p className="text-xs text-muted-foreground">Set parameters for the &ldquo;{ACTION_LABELS[actionType]}&rdquo; action</p>
              <div className="space-y-3">
                {ACTION_PARAMS[actionType].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                    {field.type === 'select' ? (
                      <Select
                        value={String(actionParams[field.key] || field.options?.[0] || '')}
                        onValueChange={(v) => setActionParams({ ...actionParams, [field.key]: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'number' ? (
                      <Input
                        type="number"
                        value={String(actionParams[field.key] || '')}
                        onChange={(e) => setActionParams({ ...actionParams, [field.key]: Number(e.target.value) || 0 })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <Input
                        value={String(actionParams[field.key] || '')}
                        onChange={(e) => setActionParams({ ...actionParams, [field.key]: e.target.value })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
                {ACTION_PARAMS[actionType].length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No parameters needed for this action type.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Name & Save */}
          {step === 5 && (
            <div className="space-y-4 py-2">
              <h3 className="text-sm font-semibold">Name & Save</h3>
              <p className="text-xs text-muted-foreground">Give your automation a name and description</p>

              {/* Preview flow */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                <AutomationFlow
                  trigger={{ type: triggerType, conditions }}
                  actions={[{ type: actionType, params: actionParams }]}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Automation Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Invoice Auto-Extract"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this automation does..."
                  rows={2}
                />
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 5 ? (
            <Button onClick={() => setStep(step + 1)} className="bg-amber-500 hover:bg-amber-600 text-white">
              Next
            </Button>
          ) : (
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {editAutomation ? 'Save Changes' : 'Create Automation'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { currentView } = useApp()
  const [automations, setAutomations] = useState<FirestoreAutomation[]>(INITIAL_AUTOMATIONS)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editAutomation, setEditAutomation] = useState<FirestoreAutomation | null>(null)

  // Toggle automation status
  const handleToggle = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => {
        if (a.automationId !== id) return a
        const newStatus: AutomationStatus = a.status === 'active' ? 'paused' : 'active'
        toast.success(`"${a.name}" ${newStatus === 'active' ? 'activated' : 'paused'}`, {
          description: newStatus === 'active' ? 'Automation will now run on triggers' : 'Automation is paused and will not run',
        })
        return { ...a, status: newStatus, updatedAt: new Date() }
      })
    )
  }

  // Duplicate automation
  const handleDuplicate = (a: FirestoreAutomation) => {
    const newAuto: FirestoreAutomation = {
      ...a,
      automationId: `auto-${Date.now()}`,
      name: `${a.name} (Copy)`,
      runCount: 0,
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setAutomations((prev) => [...prev, newAuto])
    toast.success(`Duplicated "${a.name}"`)
  }

  // Delete automation
  const handleDelete = (id: string) => {
    const auto = automations.find((a) => a.automationId === id)
    setAutomations((prev) => prev.filter((a) => a.automationId !== id))
    toast.success(`Deleted "${auto?.name}"`)
  }

  // Create or update automation
  const handleSave = (data: Omit<FirestoreAutomation, 'automationId' | 'firmId' | 'runCount' | 'lastRunAt' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    if (editAutomation) {
      setAutomations((prev) =>
        prev.map((a) =>
          a.automationId === editAutomation.automationId
            ? { ...a, ...data, updatedAt: new Date() }
            : a
        )
      )
      toast.success(`Updated "${data.name}"`)
      setEditAutomation(null)
    } else {
      const newAuto: FirestoreAutomation = {
        ...data,
        automationId: `auto-${Date.now()}`,
        firmId: 'firm-001',
        runCount: 0,
        lastRunAt: null,
        createdBy: 'user-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setAutomations((prev) => [...prev, newAuto])
      toast.success(`Created "${data.name}"`)
    }
  }

  // Create from template
  const handleUseTemplate = (template: AutomationTemplate) => {
    setEditAutomation(null)
    setCreateDialogOpen(true)
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Automation Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build Zapier-style automations for your GST workflow
          </p>
        </div>
        <Button
          onClick={() => { setEditAutomation(null); setCreateDialogOpen(true) }}
          className="bg-amber-500 hover:bg-amber-600 text-white gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Automation
        </Button>
      </motion.div>

      {/* ─── Pre-built Templates ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Pre-built Templates</h2>
          <Badge variant="secondary" className="text-xs">{TEMPLATES.length}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template, i) => (
            <motion.div
              key={template.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="group hover:shadow-md transition-shadow border-border/60 h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/50">
                        {template.icon}
                      </span>
                      <CardTitle className="text-sm font-semibold">{template.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <div className="flex items-center justify-between">
                    <AutomationFlow trigger={template.trigger} actions={template.actions} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 shrink-0 text-xs h-7"
                      onClick={() => handleUseTemplate(template)}
                    >
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ─── Automation List ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">My Automations</h2>
            <Badge variant="secondary" className="text-xs">{automations.length}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Active: {automations.filter(a => a.status === 'active').length}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Paused: {automations.filter(a => a.status === 'paused').length}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> Disabled: {automations.filter(a => a.status === 'disabled').length}</span>
          </div>
        </div>

        <div className="space-y-3">
          {automations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No automations yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Create one from a template or build your own</p>
                <Button
                  className="mt-4 bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  size="sm"
                  onClick={() => { setEditAutomation(null); setCreateDialogOpen(true) }}
                >
                  <Plus className="h-3.5 w-3.5" /> Create Automation
                </Button>
              </CardContent>
            </Card>
          ) : (
            automations.map((automation, i) => (
              <motion.div
                key={automation.automationId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Card className={`group hover:shadow-sm transition-all border-border/60 ${automation.status === 'paused' ? 'opacity-75' : ''}`}>
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Left: Name + Flow */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot(automation.status)}`} />
                          <h3 className="text-sm font-semibold truncate">{automation.name}</h3>
                          {automation.description && (
                            <span className="text-xs text-muted-foreground truncate hidden md:block">— {automation.description}</span>
                          )}
                        </div>
                        <AutomationFlow trigger={automation.trigger} actions={automation.actions} />
                      </div>

                      {/* Right: Meta + Controls */}
                      <div className="flex items-center gap-4 shrink-0">
                        <Badge variant="outline" className="text-xs font-mono tabular-nums">
                          {automation.runCount} runs
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatLastRun(automation.lastRunAt)}
                        </span>
                        <Switch
                          checked={automation.status === 'active'}
                          onCheckedChange={() => handleToggle(automation.automationId)}
                          aria-label={`Toggle ${automation.name}`}
                        />
                        <AutomationContextMenu
                          onEdit={() => {
                            setEditAutomation(automation)
                            setCreateDialogOpen(true)
                          }}
                          onDuplicate={() => handleDuplicate(automation)}
                          onDelete={() => handleDelete(automation.automationId)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* ─── Create/Edit Dialog ──────────────────────────────────────────── */}
      <CreateAutomationDialog
        open={createDialogOpen}
        onOpenChange={(v) => {
          setCreateDialogOpen(v)
          if (!v) setEditAutomation(null)
        }}
        onSave={handleSave}
        editAutomation={editAutomation}
      />
    </div>
  )
}
