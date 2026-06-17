'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/contexts/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, List, LayoutGrid, Calendar, User, Tag, Filter, CheckCircle2, Clock, AlertTriangle, Circle } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed'

export interface Task {
  taskId: string
  firmId: string
  clientId: string | null
  assignedTo: string | null
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  tags: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface NewTaskForm {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  tags: string
  assignedTo: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; icon: React.ReactNode; colBg: string }> = {
  todo: {
    label: 'Todo',
    color: 'text-slate-700',
    bg: 'bg-slate-100 border-slate-200',
    icon: <Circle className="h-3.5 w-3.5" />,
    colBg: 'bg-slate-50/80',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <Clock className="h-3.5 w-3.5" />,
    colBg: 'bg-blue-50/50',
  },
  review: {
    label: 'Review',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    colBg: 'bg-amber-50/50',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    colBg: 'bg-emerald-50/50',
  },
}

const INITIAL_TASKS: Task[] = [
  {
    taskId: 'task-1',
    firmId: 'firm-1',
    clientId: 'client-1',
    assignedTo: 'Rajesh Kumar',
    title: 'Review GSTR-1 for ABC Traders — March 2025',
    description: 'Verify all outward supplies are correctly reported in GSTR-1. Cross-check with sales register and e-invoice data. Ensure all B2B invoices are captured with correct GSTINs.',
    priority: 'high',
    status: 'in_progress',
    dueDate: '2025-03-20',
    tags: ['GSTR-1', 'Filing', 'Monthly'],
    createdBy: 'admin',
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-03-05T14:30:00Z',
  },
  {
    taskId: 'task-2',
    firmId: 'firm-1',
    clientId: 'client-2',
    assignedTo: 'Priya Sharma',
    title: 'Resolve ITC mismatch for XYZ Industries',
    description: 'ITC claimed in GSTR-3B does not match with GSTR-2A. Identify the mismatch amounts and communicate with the supplier for corrections. Prepare reconciliation report.',
    priority: 'urgent',
    status: 'todo',
    dueDate: '2025-03-15',
    tags: ['ITC', 'Reconciliation', 'GSTR-2A'],
    createdBy: 'admin',
    createdAt: '2025-03-02T09:00:00Z',
    updatedAt: '2025-03-02T09:00:00Z',
  },
  {
    taskId: 'task-3',
    firmId: 'firm-1',
    clientId: 'client-3',
    assignedTo: 'Rajesh Kumar',
    title: 'File GSTR-3B for Sharma & Co.',
    description: 'Prepare and file GSTR-3B for the month of February 2025. Ensure all input tax credits are correctly claimed and tax liability is computed accurately.',
    priority: 'high',
    status: 'todo',
    dueDate: '2025-03-18',
    tags: ['GSTR-3B', 'Filing', 'Monthly'],
    createdBy: 'admin',
    createdAt: '2025-03-03T11:00:00Z',
    updatedAt: '2025-03-03T11:00:00Z',
  },
  {
    taskId: 'task-4',
    firmId: 'firm-1',
    clientId: 'client-4',
    assignedTo: 'Anita Desai',
    title: 'Upload purchase register for Patel Enterprises',
    description: 'Upload the purchase register for February 2025 in the required format. Validate all GSTINs and invoice numbers before upload.',
    priority: 'medium',
    status: 'in_progress',
    dueDate: '2025-03-12',
    tags: ['Purchase Register', 'Upload'],
    createdBy: 'admin',
    createdAt: '2025-03-04T08:30:00Z',
    updatedAt: '2025-03-06T16:00:00Z',
  },
  {
    taskId: 'task-5',
    firmId: 'firm-1',
    clientId: null,
    assignedTo: 'Priya Sharma',
    title: 'Verify GSTIN validity for new client',
    description: 'Verify the GSTIN of the prospective new client (Mehta Group) using the GST portal. Check registration status, constitution, and compliance rating.',
    priority: 'medium',
    status: 'review',
    dueDate: '2025-03-10',
    tags: ['GSTIN', 'Verification', 'Onboarding'],
    createdBy: 'admin',
    createdAt: '2025-03-05T10:00:00Z',
    updatedAt: '2025-03-07T12:00:00Z',
  },
  {
    taskId: 'task-6',
    firmId: 'firm-1',
    clientId: null,
    assignedTo: 'Rajesh Kumar',
    title: 'Prepare filing summary for Q4 2024',
    description: 'Compile the quarterly filing summary for all clients covering October-December 2024. Include filing status, tax paid, and pending returns for each client.',
    priority: 'low',
    status: 'completed',
    dueDate: '2025-03-08',
    tags: ['Quarterly', 'Summary', 'Report'],
    createdBy: 'admin',
    createdAt: '2025-02-25T09:00:00Z',
    updatedAt: '2025-03-07T18:00:00Z',
  },
  {
    taskId: 'task-7',
    firmId: 'firm-1',
    clientId: 'client-5',
    assignedTo: 'Anita Desai',
    title: 'Follow up on pending documents from Kumar Ltd',
    description: 'Follow up with Kumar Ltd for the pending purchase invoices and credit notes for January 2025. These are required for GSTR-3B reconciliation.',
    priority: 'high',
    status: 'todo',
    dueDate: '2025-03-14',
    tags: ['Documents', 'Follow-up', 'Client'],
    createdBy: 'admin',
    createdAt: '2025-03-01T14:00:00Z',
    updatedAt: '2025-03-01T14:00:00Z',
  },
  {
    taskId: 'task-8',
    firmId: 'firm-1',
    clientId: 'client-6',
    assignedTo: 'Priya Sharma',
    title: 'Run reconciliation for Mehta Group — Feb 2025',
    description: 'Run auto-reconciliation for Mehta Group for February 2025. Compare GSTR-2A data with purchase register. Flag any mismatches exceeding ₹10,000.',
    priority: 'medium',
    status: 'in_progress',
    dueDate: '2025-03-22',
    tags: ['Reconciliation', 'GSTR-2A', 'Monthly'],
    createdBy: 'admin',
    createdAt: '2025-03-06T10:00:00Z',
    updatedAt: '2025-03-08T11:30:00Z',
  },
  {
    taskId: 'task-9',
    firmId: 'firm-1',
    clientId: 'client-7',
    assignedTo: null,
    title: 'Review annual return GSTR-9 for Agarwal & Sons',
    description: 'Review the draft GSTR-9 annual return for FY 2023-24. Verify all monthly figures match with GSTR-3B filings. Check for any amendments or corrections needed.',
    priority: 'low',
    status: 'todo',
    dueDate: '2025-04-30',
    tags: ['GSTR-9', 'Annual Return', 'FY2023-24'],
    createdBy: 'admin',
    createdAt: '2025-03-07T09:00:00Z',
    updatedAt: '2025-03-07T09:00:00Z',
  },
  {
    taskId: 'task-10',
    firmId: 'firm-1',
    clientId: 'client-2',
    assignedTo: 'Rajesh Kumar',
    title: 'Respond to GST notice for XYZ Industries',
    description: 'Draft and submit a response to the show-cause notice received from the GST department regarding excess ITC claimed in Q2 2024. Include supporting documents and computation sheets.',
    priority: 'urgent',
    status: 'review',
    dueDate: '2025-03-11',
    tags: ['Notice', 'Response', 'Legal'],
    createdBy: 'admin',
    createdAt: '2025-03-03T16:00:00Z',
    updatedAt: '2025-03-08T10:00:00Z',
  },
]

const EMPTY_FORM: NewTaskForm = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
  tags: '',
  assignedTo: '',
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getDaysUntilDue(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getDueDateColor(dateStr: string | null, status: TaskStatus): string {
  if (!dateStr || status === 'completed') return 'text-muted-foreground'
  const days = getDaysUntilDue(dateStr)
  if (days === null) return 'text-muted-foreground'
  if (days < 0) return 'text-red-600 font-medium'
  if (days <= 3) return 'text-amber-600 font-medium'
  return 'text-muted-foreground'
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIORITY BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} text-xs font-medium border gap-1.5 px-2 py-0.5`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} text-xs font-medium border gap-1.5 px-2 py-0.5`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNEE AVATAR
// ═══════════════════════════════════════════════════════════════════════════════

function AssigneeAvatar({ name }: { name: string | null }) {
  const initials = getInitials(name)
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
    'bg-teal-100 text-teal-700',
  ]
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0
  return (
    <div className={`h-7 w-7 rounded-full ${colors[colorIndex]} flex items-center justify-center text-xs font-semibold shrink-0`} title={name || 'Unassigned'}>
      {initials}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TasksPage() {
  const { currentView } = useApp()
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [form, setForm] = useState<NewTaskForm>(EMPTY_FORM)

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // ═════════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═════════════════════════════════════════════════════════════════════════════

  const assignees = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => { if (t.assignedTo) set.add(t.assignedTo) })
    return Array.from(set).sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterAssignee !== 'all' && t.assignedTo !== filterAssignee) return false
      return true
    })
  }, [tasks, filterPriority, filterStatus, filterAssignee])

  const taskCounts = useMemo(() => {
    const counts = { total: tasks.length, todo: 0, in_progress: 0, review: 0, completed: 0 }
    tasks.forEach(t => { counts[t.status]++ })
    return counts
  }, [tasks])

  const boardColumns = useMemo(() => {
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'completed']
    return statuses.map(status => ({
      status,
      tasks: filteredTasks.filter(t => t.status === status),
    }))
  }, [filteredTasks])

  // ═════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═════════════════════════════════════════════════════════════════════════════

  const handleCreateTask = () => {
    if (!form.title.trim()) return
    const newTask: Task = {
      taskId: `task-${Date.now()}`,
      firmId: 'firm-1',
      clientId: null,
      assignedTo: form.assignedTo.trim() || null,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTasks(prev => [newTask, ...prev])
    setForm(EMPTY_FORM)
    setDialogOpen(false)
  }

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.taskId === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
    ))
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTask(prev => prev === taskId ? null : taskId)
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW
  // ═════════════════════════════════════════════════════════════════════════════

  const renderListView = () => (
    <div className="space-y-2">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-[100px_1fr_130px_120px_110px_160px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
        <span>Priority</span>
        <span>Title</span>
        <span>Status</span>
        <span>Assigned To</span>
        <span>Due Date</span>
        <span>Tags</span>
      </div>

      <AnimatePresence mode="popLayout">
        {filteredTasks.map((task) => {
          const isExpanded = expandedTask === task.taskId
          return (
            <motion.div
              key={task.taskId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: task.priority === 'urgent' ? '#ef4444' : task.priority === 'high' ? '#f59e0b' : task.priority === 'medium' ? '#3b82f6' : '#94a3b8' }}
                onClick={() => toggleExpand(task.taskId)}
              >
                <CardContent className="p-4">
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                        <h3 className="font-medium text-sm truncate">{task.title}</h3>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <AssigneeAvatar name={task.assignedTo} />
                        <span>{task.assignedTo || 'Unassigned'}</span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className={getDueDateColor(task.dueDate, task.status)}>{formatDate(task.dueDate)}</span>
                        </div>
                      )}
                    </div>
                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                        {task.tags.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{task.tags.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-[100px_1fr_130px_120px_110px_160px] gap-3 items-center">
                    <PriorityBadge priority={task.priority} />
                    <h3 className="font-medium text-sm truncate">{task.title}</h3>
                    <div onClick={e => e.stopPropagation()}>
                      <Select value={task.status} onValueChange={(v) => handleStatusChange(task.taskId, v as TaskStatus)}>
                        <SelectTrigger className="h-7 text-xs border-0 p-0 w-auto">
                          <StatusBadge status={task.status} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <AssigneeAvatar name={task.assignedTo} />
                      <span className="text-xs text-muted-foreground truncate">{task.assignedTo || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className={`text-xs ${getDueDateColor(task.dueDate, task.status)}`}>{formatDate(task.dueDate)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {task.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      {task.tags.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{task.tags.length - 2}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                            <p className="text-sm text-foreground">{task.description || 'No description provided.'}</p>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5" />
                              <span>{task.tags.length > 0 ? task.tags.join(', ') : 'No tags'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              <span>Created by: {task.createdBy}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Created: {formatDate(task.createdAt)}</span>
                            </div>
                          </div>
                          {/* Mobile Status Change */}
                          <div className="md:hidden">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Change Status</p>
                            <div className="flex gap-2">
                              {(['todo', 'in_progress', 'review', 'completed'] as TaskStatus[]).map(s => (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant={task.status === s ? 'default' : 'outline'}
                                  className="text-xs h-7"
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(task.taskId, s) }}
                                >
                                  {STATUS_CONFIG[s].label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Filter className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No tasks match your filters</p>
          <p className="text-xs mt-1">Try adjusting or clearing the filters</p>
        </div>
      )}
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: BOARD VIEW
  // ═════════════════════════════════════════════════════════════════════════════

  const renderBoardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {boardColumns.map(({ status, tasks: columnTasks }) => {
        const cfg = STATUS_CONFIG[status]
        return (
          <div key={status} className={`rounded-xl ${cfg.colBg} border p-3 min-h-[300px]`}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`${cfg.color}`}>{cfg.icon}</div>
                <h3 className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</h3>
              </div>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">{columnTasks.length}</Badge>
            </div>

            {/* Column Cards */}
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <div className="space-y-2.5 pr-1">
                <AnimatePresence mode="popLayout">
                  {columnTasks.map((task) => (
                    <motion.div
                      key={task.taskId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-md transition-all duration-200 group"
                        onClick={() => toggleExpand(task.taskId)}
                      >
                        <CardContent className="p-3 space-y-2">
                          {/* Priority dot + Title */}
                          <div className="flex items-start gap-2">
                            <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                            <h4 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">{task.title}</h4>
                          </div>

                          {/* Tags */}
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
                              ))}
                              {task.tags.length > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">+{task.tags.length - 2}</Badge>
                              )}
                            </div>
                          )}

                          {/* Footer: Assignee + Due Date */}
                          <div className="flex items-center justify-between pt-1">
                            <AssigneeAvatar name={task.assignedTo} />
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className={`text-[11px] ${getDueDateColor(task.dueDate, task.status)}`}>
                                  {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {expandedTask === task.taskId && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-2 border-t space-y-2">
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                                  )}
                                  <div className="flex flex-wrap gap-1.5">
                                    {(['todo', 'in_progress', 'review', 'completed'] as TaskStatus[]).map(s => (
                                      <Button
                                        key={s}
                                        size="sm"
                                        variant={task.status === s ? 'default' : 'outline'}
                                        className="text-[10px] h-6 px-2"
                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(task.taskId, s) }}
                                      >
                                        {STATUS_CONFIG[s].label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {columnTasks.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-xs">No tasks</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: NEW TASK DIALOG
  // ═════════════════════════════════════════════════════════════════════════════

  const renderNewTaskDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Task</span>
          <span className="sm:hidden">New</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title <span className="text-red-500">*</span></label>
            <Input
              placeholder="e.g. Review GSTR-1 for client — March 2025"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="Describe the task details..."
              rows={3}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v as TaskPriority }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm(prev => ({ ...prev, status: v as TaskStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Assign To</label>
              <Input
                placeholder="e.g. Rajesh Kumar"
                value={form.assignedTo}
                onChange={e => setForm(prev => ({ ...prev, assignedTo: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <Input
              placeholder="Comma-separated, e.g. GSTR-1, Filing, Monthly"
              value={form.tags}
              onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setForm(EMPTY_FORM); setDialogOpen(false) }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateTask} disabled={!form.title.trim()}>Create Task</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: MAIN
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage your firm&apos;s GST workflow tasks</p>
        </div>
        {renderNewTaskDialog()}
      </div>

      {/* Summary Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs px-3 py-1 border-slate-300">
          <span className="text-muted-foreground mr-1.5">Total</span>
          <span className="font-semibold">{taskCounts.total}</span>
        </Badge>
        <Badge variant="outline" className="text-xs px-3 py-1 border-slate-200">
          <Circle className="h-3 w-3 mr-1 text-slate-500" />
          <span className="text-muted-foreground mr-1">Todo</span>
          <span className="font-semibold">{taskCounts.todo}</span>
        </Badge>
        <Badge variant="outline" className="text-xs px-3 py-1 border-blue-200">
          <Clock className="h-3 w-3 mr-1 text-blue-500" />
          <span className="text-muted-foreground mr-1">In Progress</span>
          <span className="font-semibold">{taskCounts.in_progress}</span>
        </Badge>
        <Badge variant="outline" className="text-xs px-3 py-1 border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
          <span className="text-muted-foreground mr-1">Review</span>
          <span className="font-semibold">{taskCounts.review}</span>
        </Badge>
        <Badge variant="outline" className="text-xs px-3 py-1 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
          <span className="text-muted-foreground mr-1">Completed</span>
          <span className="font-semibold">{taskCounts.completed}</span>
        </Badge>
      </div>

      {/* Filters + View Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters:</span>
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {assignees.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterPriority !== 'all' || filterStatus !== 'all' || filterAssignee !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => { setFilterPriority('all'); setFilterStatus('all'); setFilterAssignee('all') }}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* View Toggle */}
            <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'board')}>
              <TabsList className="h-8">
                <TabsTrigger value="list" className="text-xs gap-1.5 px-3">
                  <List className="h-3.5 w-3.5" />
                  List
                </TabsTrigger>
                <TabsTrigger value="board" className="text-xs gap-1.5 px-3">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Board
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* View Content */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'board')}>
        <TabsContent value="list" className="mt-0">
          {renderListView()}
        </TabsContent>
        <TabsContent value="board" className="mt-0">
          {renderBoardView()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
