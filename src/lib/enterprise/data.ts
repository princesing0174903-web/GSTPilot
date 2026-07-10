// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 13: Enterprise Collaboration & Multi-Company
// Data Layer — companies, org tree, workflows, roles, notifications, documents
// ═══════════════════════════════════════════════════════════════════════════════

export const fmtINR = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN')

// ─── Company ───────────────────────────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  legalName: string
  gstin: string
  pan: string
  type: 'Holding' | 'Subsidiary' | 'Branch' | 'Division' | 'Independent'
  parentId: string | null
  industry: string
  state: string
  revenue: number
  expenses: number
  gstLiability: number
  outstandingInvoices: number
  complianceScore: number
  growthScore: number
  riskScore: number
  aiScore: number
  cashFlow: number
  status: 'Healthy' | 'Watch' | 'Critical'
  gstStatus: 'Filed' | 'Pending' | 'Overdue'
  employees: number
  branches: number
  color: string
}

export const COMPANIES: Company[] = [
  {
    id: 'c1', name: 'Aurora Holdings', legalName: 'Aurora Holdings Pvt Ltd',
    gstin: '27AABCA1234F1Z5', pan: 'AABCA1234F', type: 'Holding', parentId: null,
    industry: 'Conglomerate', state: 'Maharashtra', revenue: 482000000, expenses: 318000000,
    gstLiability: 24800000, outstandingInvoices: 18700000, complianceScore: 96, growthScore: 88,
    riskScore: 12, aiScore: 94, cashFlow: 164000000, status: 'Healthy', gstStatus: 'Filed',
    employees: 1240, branches: 18, color: '#10b981',
  },
  {
    id: 'c2', name: 'Aurora Tech', legalName: 'Aurora Technologies Pvt Ltd',
    gstin: '27AABCA1234F2Z3', pan: 'AABCA1234F', type: 'Subsidiary', parentId: 'c1',
    industry: 'Technology', state: 'Maharashtra', revenue: 187000000, expenses: 112000000,
    gstLiability: 9400000, outstandingInvoices: 6200000, complianceScore: 98, growthScore: 92,
    riskScore: 8, aiScore: 97, cashFlow: 75000000, status: 'Healthy', gstStatus: 'Filed',
    employees: 420, branches: 4, color: '#06b6d4',
  },
  {
    id: 'c3', name: 'Aurora Retail', legalName: 'Aurora Retail Ventures Pvt Ltd',
    gstin: '29AABCA1234F3Z1', pan: 'AABCA1234F', type: 'Subsidiary', parentId: 'c1',
    industry: 'Retail', state: 'Karnataka', revenue: 142000000, expenses: 98000000,
    gstLiability: 12800000, outstandingInvoices: 9400000, complianceScore: 84, growthScore: 76,
    riskScore: 24, aiScore: 78, cashFlow: 44000000, status: 'Watch', gstStatus: 'Pending',
    employees: 380, branches: 12, color: '#f59e0b',
  },
  {
    id: 'c4', name: 'Aurora Manufacturing', legalName: 'Aurora Industries Pvt Ltd',
    gstin: '07AABCA1234F4Z9', pan: 'AABCA1234F', type: 'Subsidiary', parentId: 'c1',
    industry: 'Manufacturing', state: 'Delhi', revenue: 96000000, expenses: 71000000,
    gstLiability: 7200000, outstandingInvoices: 4800000, complianceScore: 91, growthScore: 82,
    riskScore: 16, aiScore: 85, cashFlow: 25000000, status: 'Healthy', gstStatus: 'Filed',
    employees: 290, branches: 2, color: '#8b5cf6',
  },
  {
    id: 'c5', name: 'Aurora Finance', legalName: 'Aurora Financial Services Pvt Ltd',
    gstin: '33AABCA1234F5Z7', pan: 'AABCA1234F', type: 'Subsidiary', parentId: 'c1',
    industry: 'Financial Services', state: 'Tamil Nadu', revenue: 57000000, expenses: 37000000,
    gstLiability: 0, outstandingInvoices: 2100000, complianceScore: 99, growthScore: 85,
    riskScore: 6, aiScore: 96, cashFlow: 20000000, status: 'Healthy', gstStatus: 'Filed',
    employees: 150, branches: 1, color: '#ec4899',
  },
  {
    id: 'c6', name: 'Standalone Traders', legalName: 'Standalone Traders LLP',
    gstin: '27AALCS5678H1Z2', pan: 'AALCS5678H', type: 'Independent', parentId: null,
    industry: 'Trading', state: 'Maharashtra', revenue: 38000000, expenses: 31000000,
    gstLiability: 3400000, outstandingInvoices: 5200000, complianceScore: 72, growthScore: 54,
    riskScore: 38, aiScore: 61, cashFlow: 7000000, status: 'Critical', gstStatus: 'Overdue',
    employees: 85, branches: 1, color: '#ef4444',
  },
]

// ─── Workflow / Approvals ──────────────────────────────────────────────────────
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'in-review'

export interface WorkflowApproval {
  id: string
  type: 'Invoice' | 'Expense' | 'Payment' | 'GST Filing' | 'Vendor' | 'Purchase Order' | 'Salary' | 'Document'
  title: string
  amount: number
  company: string
  submittedBy: string
  submittedByAvatar: string
  submittedAt: string
  currentLevel: number
  totalLevels: number
  approvers: { name: string; role: string; status: ApprovalStatus; avatar: string; actedAt?: string }[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: ApprovalStatus
  description: string
}

export const WORKFLOW_APPROVALS: WorkflowApproval[] = [
  {
    id: 'wf-001', type: 'Invoice', title: 'INV-2024-0892 — Raw Materials Procurement',
    amount: 4800000, company: 'Aurora Manufacturing', submittedBy: 'Priya Sharma',
    submittedByAvatar: 'PS', submittedAt: '2h ago', currentLevel: 2, totalLevels: 3,
    approvers: [
      { name: 'Rajesh Kumar', role: 'Accountant', status: 'approved', avatar: 'RK', actedAt: '1h ago' },
      { name: 'Anita Desai', role: 'Finance Manager', status: 'in-review', avatar: 'AD' },
      { name: 'Vikram Mehta', role: 'CFO', status: 'pending', avatar: 'VM' },
    ],
    priority: 'high', status: 'in-review',
    description: 'Procurement of steel coils from Tata Steel — Q3 production batch. PO matched, GRN verified.',
  },
  {
    id: 'wf-002', type: 'GST Filing', title: 'GSTR-3B — August 2024 — Aurora Retail',
    amount: 12800000, company: 'Aurora Retail', submittedBy: 'Suresh Iyer',
    submittedByAvatar: 'SI', submittedAt: '4h ago', currentLevel: 1, totalLevels: 2,
    approvers: [
      { name: 'Meena Krishnan', role: 'GST Executive', status: 'in-review', avatar: 'MK' },
      { name: 'Anita Desai', role: 'Finance Manager', status: 'pending', avatar: 'AD' },
    ],
    priority: 'critical', status: 'in-review',
    description: 'Monthly GSTR-3B return. Due in 3 days. ITC reconciliation 94% matched.',
  },
  {
    id: 'wf-003', type: 'Payment', title: 'Vendor Payment — Cloud Infrastructure',
    amount: 2200000, company: 'Aurora Tech', submittedBy: 'Karthik Nair',
    submittedByAvatar: 'KN', submittedAt: '6h ago', currentLevel: 1, totalLevels: 2,
    approvers: [
      { name: 'Rajesh Kumar', role: 'Accountant', status: 'approved', avatar: 'RK', actedAt: '5h ago' },
      { name: 'Vikram Mehta', role: 'CFO', status: 'in-review', avatar: 'VM' },
    ],
    priority: 'medium', status: 'in-review',
    description: 'AWS cloud infrastructure invoice — monthly recurring. Auto-flagged for CFO approval (amount > ₹20L).',
  },
  {
    id: 'wf-004', type: 'Expense', title: 'Travel & Conference — Leadership Summit',
    amount: 385000, company: 'Aurora Holdings', submittedBy: 'Deepika Rao',
    submittedByAvatar: 'DR', submittedAt: '1d ago', currentLevel: 2, totalLevels: 2,
    approvers: [
      { name: 'Suresh Iyer', role: 'Department Head', status: 'approved', avatar: 'SI', actedAt: '20h ago' },
      { name: 'Anita Desai', role: 'Finance Manager', status: 'approved', avatar: 'AD', actedAt: '2h ago' },
    ],
    priority: 'low', status: 'approved',
    description: 'Leadership team travel to Mumbai Tech Summit — 4 attendees, 3 days.',
  },
  {
    id: 'wf-005', type: 'Purchase Order', title: 'PO-2024-0341 — Office Equipment',
    amount: 1450000, company: 'Aurora Finance', submittedBy: 'Priya Sharma',
    submittedByAvatar: 'PS', submittedAt: '1d ago', currentLevel: 1, totalLevels: 3,
    approvers: [
      { name: 'Rajesh Kumar', role: 'Accountant', status: 'pending', avatar: 'RK' },
      { name: 'Meena Krishnan', role: 'GST Executive', status: 'pending', avatar: 'MK' },
      { name: 'Vikram Mehta', role: 'CFO', status: 'pending', avatar: 'VM' },
    ],
    priority: 'medium', status: 'pending',
    description: 'Workstations and monitors for new Chennai office — 25 units.',
  },
  {
    id: 'wf-006', type: 'Salary', title: 'Payroll — September 2024 — Aurora Tech',
    amount: 8400000, company: 'Aurora Tech', submittedBy: 'HR Bot',
    submittedByAvatar: 'HR', submittedAt: '2d ago', currentLevel: 1, totalLevels: 2,
    approvers: [
      { name: 'Deepika Rao', role: 'HR', status: 'approved', avatar: 'DR', actedAt: '1d ago' },
      { name: 'Vikram Mehta', role: 'CFO', status: 'pending', avatar: 'VM' },
    ],
    priority: 'high', status: 'in-review',
    description: 'Monthly payroll for 420 employees. TDS deducted, PF deposited, PT filed.',
  },
  {
    id: 'wf-007', type: 'Vendor', title: 'New Vendor Onboarding — GlobalLogix',
    amount: 0, company: 'Aurora Manufacturing', submittedBy: 'Karthik Nair',
    submittedByAvatar: 'KN', submittedAt: '3d ago', currentLevel: 2, totalLevels: 3,
    approvers: [
      { name: 'Rajesh Kumar', role: 'Accountant', status: 'approved', avatar: 'RK', actedAt: '2d ago' },
      { name: 'Suresh Iyer', role: 'Department Head', status: 'in-review', avatar: 'SI' },
      { name: 'Anita Desai', role: 'Finance Manager', status: 'pending', avatar: 'AD' },
    ],
    priority: 'medium', status: 'in-review',
    description: 'Logistics vendor onboarding. GSTIN verified, PAN verified, bank verified.',
  },
  {
    id: 'wf-008', type: 'Document', title: 'Board Resolution — Q3 Dividend Declaration',
    amount: 0, company: 'Aurora Holdings', submittedBy: 'Legal Bot',
    submittedByAvatar: 'LB', submittedAt: '3d ago', currentLevel: 1, totalLevels: 2,
    approvers: [
      { name: 'Deepika Rao', role: 'Auditor', status: 'in-review', avatar: 'DR' },
      { name: 'Vikram Mehta', role: 'CFO', status: 'pending', avatar: 'VM' },
    ],
    priority: 'high', status: 'in-review',
    description: 'Board resolution for Q3 interim dividend. Drafted by legal, requires audit + CFO sign-off.',
  },
]

// ─── Team Members & Presence ───────────────────────────────────────────────────
export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  company: string
  status: 'online' | 'away' | 'busy' | 'offline'
  currentActivity?: string
  color: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'u1', name: 'Vikram Mehta', role: 'CFO', avatar: 'VM', company: 'Aurora Holdings', status: 'online', currentActivity: 'Reviewing GSTR-3B filings', color: '#10b981' },
  { id: 'u2', name: 'Anita Desai', role: 'Finance Manager', avatar: 'AD', company: 'Aurora Holdings', status: 'online', currentActivity: 'Approving invoices', color: '#06b6d4' },
  { id: 'u3', name: 'Rajesh Kumar', role: 'Accountant', avatar: 'RK', company: 'Aurora Tech', status: 'busy', currentActivity: 'In a meeting — Q3 review', color: '#f59e0b' },
  { id: 'u4', name: 'Priya Sharma', role: 'GST Executive', avatar: 'PS', company: 'Aurora Retail', status: 'online', currentActivity: 'Filing GSTR-1', color: '#8b5cf6' },
  { id: 'u5', name: 'Suresh Iyer', role: 'Department Head', avatar: 'SI', company: 'Aurora Manufacturing', status: 'away', currentActivity: 'Lunch break', color: '#ec4899' },
  { id: 'u6', name: 'Meena Krishnan', role: 'CA', avatar: 'MK', company: 'Aurora Holdings', status: 'online', currentActivity: 'Reconciling ITC', color: '#14b8a6' },
  { id: 'u7', name: 'Karthik Nair', role: 'Accountant', avatar: 'KN', company: 'Aurora Tech', status: 'busy', currentActivity: 'Vendor onboarding', color: '#f97316' },
  { id: 'u8', name: 'Deepika Rao', role: 'HR', avatar: 'DR', company: 'Aurora Holdings', status: 'online', currentActivity: 'Processing payroll', color: '#a855f7' },
  { id: 'u9', name: 'Arjun Gupta', role: 'Auditor', avatar: 'AG', company: 'Aurora Holdings', status: 'offline', color: '#64748b' },
  { id: 'u10', name: 'Neha Singh', role: 'GST Executive', avatar: 'NS', company: 'Aurora Retail', status: 'offline', color: '#64748b' },
]

// ─── Tasks ─────────────────────────────────────────────────────────────────────
export interface EnterpriseTask {
  id: string
  title: string
  description: string
  company: string
  assignee: string
  assigneeAvatar: string
  dueDate: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'todo' | 'in-progress' | 'review' | 'done'
  comments: number
  mentions: number
  tags: string[]
}

export const ENTERPRISE_TASKS: EnterpriseTask[] = [
  { id: 't1', title: 'File GSTR-3B for Aurora Retail', description: 'Complete and file August GSTR-3B before deadline', company: 'Aurora Retail', assignee: 'Priya Sharma', assigneeAvatar: 'PS', dueDate: 'In 3 days', priority: 'critical', status: 'in-progress', comments: 4, mentions: 2, tags: ['GST', 'Filing', 'Urgent'] },
  { id: 't2', title: 'Reconcile ITC — Q2', description: 'Match 2A/2B with purchase register for Q2', company: 'Aurora Holdings', assignee: 'Meena Krishnan', assigneeAvatar: 'MK', dueDate: 'In 5 days', priority: 'high', status: 'in-progress', comments: 2, mentions: 1, tags: ['ITC', 'Reconciliation'] },
  { id: 't3', title: 'Approve vendor onboarding', description: 'Review GlobalLogix documents and approve', company: 'Aurora Manufacturing', assignee: 'Suresh Iyer', assigneeAvatar: 'SI', dueDate: 'In 2 days', priority: 'medium', status: 'review', comments: 6, mentions: 3, tags: ['Vendor', 'Approval'] },
  { id: 't4', title: 'Q3 board report preparation', description: 'Compile financials for all subsidiaries', company: 'Aurora Holdings', assignee: 'Vikram Mehta', assigneeAvatar: 'VM', dueDate: 'In 7 days', priority: 'high', status: 'todo', comments: 0, mentions: 0, tags: ['Reporting', 'Board'] },
  { id: 't5', title: 'Payroll processing — September', description: 'Process payroll for all 420 employees', company: 'Aurora Tech', assignee: 'Deepika Rao', assigneeAvatar: 'DR', dueDate: 'In 1 day', priority: 'critical', status: 'in-progress', comments: 1, mentions: 1, tags: ['Payroll', 'HR'] },
  { id: 't6', title: 'Audit compliance — Delhi branch', description: 'Internal audit for compliance gaps', company: 'Aurora Manufacturing', assignee: 'Arjun Gupta', assigneeAvatar: 'AG', dueDate: 'In 10 days', priority: 'medium', status: 'todo', comments: 0, mentions: 0, tags: ['Audit', 'Compliance'] },
  { id: 't7', title: 'TDS payment — Q2', description: 'Pay TDS for Q2 and file Form 26Q', company: 'Aurora Finance', assignee: 'Karthik Nair', assigneeAvatar: 'KN', dueDate: 'In 4 days', priority: 'high', status: 'review', comments: 3, mentions: 1, tags: ['TDS', 'Payment'] },
  { id: 't8', title: 'Overdue GST — Standalone Traders', description: 'Resolve overdue GSTR-3B filing immediately', company: 'Standalone Traders', assignee: 'Neha Singh', assigneeAvatar: 'NS', dueDate: 'Overdue', priority: 'critical', status: 'todo', comments: 8, mentions: 4, tags: ['GST', 'Overdue', 'Critical'] },
]

// ─── Activity Feed ─────────────────────────────────────────────────────────────
export interface ActivityItem {
  id: string
  user: string
  avatar: string
  action: string
  target: string
  company: string
  timestamp: string
  type: 'approval' | 'comment' | 'mention' | 'filing' | 'payment' | 'document' | 'ai-alert'
}

export const ACTIVITY_FEED: ActivityItem[] = [
  { id: 'a1', user: 'Vikram Mehta', avatar: 'VM', action: 'approved', target: 'Payment — Cloud Infrastructure', company: 'Aurora Tech', timestamp: '5m ago', type: 'approval' },
  { id: 'a2', user: 'AI Copilot', avatar: 'AI', action: 'flagged risk on', target: 'GSTR-3B — Aurora Retail', company: 'Aurora Retail', timestamp: '12m ago', type: 'ai-alert' },
  { id: 'a3', user: 'Priya Sharma', avatar: 'PS', action: 'commented on', target: 'ITC Reconciliation Task', company: 'Aurora Holdings', timestamp: '23m ago', type: 'comment' },
  { id: 'a4', user: 'Meena Krishnan', avatar: 'MK', action: 'filed', target: 'GSTR-1 — August 2024', company: 'Aurora Manufacturing', timestamp: '1h ago', type: 'filing' },
  { id: 'a5', user: 'Anita Desai', avatar: 'AD', action: 'mentioned you in', target: 'Q3 Board Report', company: 'Aurora Holdings', timestamp: '1h ago', type: 'mention' },
  { id: 'a6', user: 'Karthik Nair', avatar: 'KN', action: 'uploaded', target: 'Audit Report Q2.pdf', company: 'Aurora Finance', timestamp: '2h ago', type: 'document' },
  { id: 'a7', user: 'Deepika Rao', avatar: 'DR', action: 'processed', target: 'Payroll — September', company: 'Aurora Tech', timestamp: '2h ago', type: 'payment' },
  { id: 'a8', user: 'Suresh Iyer', avatar: 'SI', action: 'requested approval on', target: 'Vendor Onboarding — GlobalLogix', company: 'Aurora Manufacturing', timestamp: '3h ago', type: 'approval' },
  { id: 'a9', user: 'AI Risk Engine', avatar: 'AI', action: 'detected anomaly in', target: 'Cash Flow — Standalone Traders', company: 'Standalone Traders', timestamp: '3h ago', type: 'ai-alert' },
  { id: 'a10', user: 'Rajesh Kumar', avatar: 'RK', action: 'completed', target: 'Bank Reconciliation — August', company: 'Aurora Tech', timestamp: '4h ago', type: 'document' },
]

// ─── Chat Messages ─────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  user: string
  avatar: string
  message: string
  timestamp: string
  channel: string
  reactions?: { emoji: string; count: number }[]
}

export const CHAT_CHANNELS = [
  { id: 'general', name: 'general', members: 10, unread: 2, lastActivity: '5m ago' },
  { id: 'gst-filings', name: 'gst-filings', members: 6, unread: 5, lastActivity: '12m ago' },
  { id: 'approvals', name: 'approvals', members: 4, unread: 0, lastActivity: '1h ago' },
  { id: 'aurora-tech', name: 'aurora-tech', members: 5, unread: 1, lastActivity: '23m ago' },
  { id: 'aurora-retail', name: 'aurora-retail', members: 4, unread: 0, lastActivity: '2h ago' },
  { id: 'audit-team', name: 'audit-team', members: 3, unread: 0, lastActivity: '3h ago' },
]

export const CHAT_MESSAGES: ChatMessage[] = [
  { id: 'm1', user: 'Vikram Mehta', avatar: 'VM', message: '@Priya can you prioritize the Aurora Retail GSTR-3B? It\'s due in 3 days and ITC match is only 94%.', timestamp: '10:32 AM', channel: 'gst-filings', reactions: [{ emoji: '👍', count: 2 }] },
  { id: 'm2', user: 'Priya Sharma', avatar: 'PS', message: 'On it! I found 12 unmatched entries — mostly from July carry-over. Cleaning up now.', timestamp: '10:35 AM', channel: 'gst-filings' },
  { id: 'm3', user: 'Meena Krishnan', avatar: 'MK', message: 'I can help reconcile after my 2B download finishes. ETA 10 mins.', timestamp: '10:36 AM', channel: 'gst-filings', reactions: [{ emoji: '🙏', count: 3 }] },
  { id: 'm4', user: 'AI Copilot', avatar: 'AI', message: '⚠️ I detected a potential ITC reversal of ₹4.2L in Aurora Retail. 3 vendors have cancelled their invoices. Please verify before filing.', timestamp: '10:38 AM', channel: 'gst-filings', reactions: [{ emoji: '⚠️', count: 4 }, { emoji: '🎯', count: 1 }] },
  { id: 'm5', user: 'Anita Desai', avatar: 'AD', message: 'Good catch AI. @Priya add those to the reversal list and adjust the liability.', timestamp: '10:40 AM', channel: 'gst-filings' },
  { id: 'm6', user: 'Karthik Nair', avatar: 'KN', message: 'Anyone reviewed the GlobalLogix vendor docs? @Suresh waiting on your sign-off.', timestamp: '9:15 AM', channel: 'approvals' },
  { id: 'm7', user: 'Suresh Iyer', avatar: 'SI', message: 'Reviewing now. GSTIN and PAN verified. Bank details pending — asked them to resend.', timestamp: '9:42 AM', channel: 'approvals' },
]

// ─── Roles & Permissions (RBAC) ────────────────────────────────────────────────
export interface Role {
  id: string
  name: string
  level: number
  users: number
  color: string
  permissions: { module: string; access: 'full' | 'view' | 'limited' | 'none' }[]
}

export const ENTERPRISE_ROLES: Role[] = [
  {
    id: 'r1', name: 'CEO', level: 10, users: 1, color: '#f59e0b',
    permissions: [
      { module: 'Financials', access: 'full' }, { module: 'GST', access: 'full' },
      { module: 'HR', access: 'full' }, { module: 'Approvals', access: 'full' },
      { module: 'Audit', access: 'full' }, { module: 'Settings', access: 'full' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'full' },
    ],
  },
  {
    id: 'r2', name: 'CFO', level: 9, users: 1, color: '#8b5cf6',
    permissions: [
      { module: 'Financials', access: 'full' }, { module: 'GST', access: 'full' },
      { module: 'HR', access: 'view' }, { module: 'Approvals', access: 'full' },
      { module: 'Audit', access: 'full' }, { module: 'Settings', access: 'limited' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'full' },
    ],
  },
  {
    id: 'r3', name: 'Finance Manager', level: 7, users: 2, color: '#06b6d4',
    permissions: [
      { module: 'Financials', access: 'full' }, { module: 'GST', access: 'full' },
      { module: 'HR', access: 'view' }, { module: 'Approvals', access: 'full' },
      { module: 'Audit', access: 'view' }, { module: 'Settings', access: 'limited' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'full' },
    ],
  },
  {
    id: 'r4', name: 'CA', level: 7, users: 1, color: '#14b8a6',
    permissions: [
      { module: 'Financials', access: 'full' }, { module: 'GST', access: 'full' },
      { module: 'HR', access: 'none' }, { module: 'Approvals', access: 'full' },
      { module: 'Audit', access: 'full' }, { module: 'Settings', access: 'limited' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'full' },
    ],
  },
  {
    id: 'r5', name: 'Accountant', level: 5, users: 3, color: '#10b981',
    permissions: [
      { module: 'Financials', access: 'full' }, { module: 'GST', access: 'view' },
      { module: 'HR', access: 'none' }, { module: 'Approvals', access: 'limited' },
      { module: 'Audit', access: 'none' }, { module: 'Settings', access: 'none' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'view' },
    ],
  },
  {
    id: 'r6', name: 'GST Executive', level: 4, users: 2, color: '#ec4899',
    permissions: [
      { module: 'Financials', access: 'view' }, { module: 'GST', access: 'full' },
      { module: 'HR', access: 'none' }, { module: 'Approvals', access: 'limited' },
      { module: 'Audit', access: 'none' }, { module: 'Settings', access: 'none' },
      { module: 'Documents', access: 'limited' }, { module: 'Reports', access: 'view' },
    ],
  },
  {
    id: 'r7', name: 'HR', level: 5, users: 1, color: '#a855f7',
    permissions: [
      { module: 'Financials', access: 'view' }, { module: 'GST', access: 'none' },
      { module: 'HR', access: 'full' }, { module: 'Approvals', access: 'limited' },
      { module: 'Audit', access: 'view' }, { module: 'Settings', access: 'limited' },
      { module: 'Documents', access: 'limited' }, { module: 'Reports', access: 'view' },
    ],
  },
  {
    id: 'r8', name: 'Auditor', level: 6, users: 1, color: '#f97316',
    permissions: [
      { module: 'Financials', access: 'view' }, { module: 'GST', access: 'view' },
      { module: 'HR', access: 'view' }, { module: 'Approvals', access: 'view' },
      { module: 'Audit', access: 'full' }, { module: 'Settings', access: 'none' },
      { module: 'Documents', access: 'view' }, { module: 'Reports', access: 'full' },
    ],
  },
  {
    id: 'r9', name: 'Department Head', level: 6, users: 1, color: '#3b82f6',
    permissions: [
      { module: 'Financials', access: 'view' }, { module: 'GST', access: 'view' },
      { module: 'HR', access: 'limited' }, { module: 'Approvals', access: 'full' },
      { module: 'Audit', access: 'view' }, { module: 'Settings', access: 'limited' },
      { module: 'Documents', access: 'full' }, { module: 'Reports', access: 'view' },
    ],
  },
]

// ─── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string
  type: 'assignment' | 'approval' | 'ai-alert' | 'gst-deadline' | 'payment' | 'document' | 'risk' | 'compliance'
  title: string
  message: string
  company: string
  timestamp: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
}

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'gst-deadline', title: 'GSTR-3B Due in 3 Days', message: 'Aurora Retail — August 2024 return filing deadline approaching', company: 'Aurora Retail', timestamp: '5m ago', priority: 'critical', read: false },
  { id: 'n2', type: 'ai-alert', title: 'ITC Reversal Detected', message: 'AI flagged ₹4.2L potential ITC reversal — 3 cancelled vendor invoices', company: 'Aurora Retail', timestamp: '12m ago', priority: 'high', read: false },
  { id: 'n3', type: 'approval', title: 'Approval Required', message: 'Cloud Infrastructure payment ₹22L awaiting your sign-off', company: 'Aurora Tech', timestamp: '30m ago', priority: 'high', read: false },
  { id: 'n4', type: 'assignment', title: 'New Task Assigned', message: 'Q3 Board Report compilation assigned to you', company: 'Aurora Holdings', timestamp: '1h ago', priority: 'medium', read: false },
  { id: 'n5', type: 'risk', title: 'Critical Risk — Cash Flow', message: 'Standalone Traders cash flow dropped 34% this month', company: 'Standalone Traders', timestamp: '2h ago', priority: 'critical', read: false },
  { id: 'n6', type: 'payment', title: 'Payment Received', message: '₹18.7L received from Reliance Industries — INV-2024-0892', company: 'Aurora Manufacturing', timestamp: '3h ago', priority: 'medium', read: true },
  { id: 'n7', type: 'compliance', title: 'Compliance Gap', message: 'TDS payment for Q2 due in 4 days — Aurora Finance', company: 'Aurora Finance', timestamp: '4h ago', priority: 'high', read: true },
  { id: 'n8', type: 'document', title: 'Document Shared', message: 'Karthik shared "Audit Report Q2.pdf" with you', company: 'Aurora Finance', timestamp: '5h ago', priority: 'low', read: true },
  { id: 'n9', type: 'ai-alert', title: 'Anomaly Detected', message: 'Unusual expense pattern in Aurora Retail — 28% above average', company: 'Aurora Retail', timestamp: '6h ago', priority: 'medium', read: true },
  { id: 'n10', type: 'gst-deadline', title: 'GSTR-1 Filed', message: 'Aurora Manufacturing — August GSTR-1 filed successfully', company: 'Aurora Manufacturing', timestamp: '8h ago', priority: 'low', read: true },
]

// ─── Documents ─────────────────────────────────────────────────────────────────
export interface EnterpriseDocument {
  id: string
  name: string
  type: 'pdf' | 'xlsx' | 'docx' | 'img' | 'folder'
  folder: string
  company: string
  size: string
  modifiedBy: string
  modifiedAt: string
  version: string
  sharedWith: number
  status: 'draft' | 'in-review' | 'approved' | 'archived'
  ocrProcessed: boolean
}

export const ENTERPRISE_DOCUMENTS: EnterpriseDocument[] = [
  { id: 'd1', name: 'Q3 Board Report.docx', type: 'docx', folder: 'Board / Q3 2024', company: 'Aurora Holdings', size: '2.4 MB', modifiedBy: 'Vikram Mehta', modifiedAt: '1h ago', version: 'v4', sharedWith: 6, status: 'in-review', ocrProcessed: false },
  { id: 'd2', name: 'GSTR-3B August.pdf', type: 'pdf', folder: 'GST / August 2024', company: 'Aurora Retail', size: '1.1 MB', modifiedBy: 'Priya Sharma', modifiedAt: '2h ago', version: 'v2', sharedWith: 4, status: 'in-review', ocrProcessed: true },
  { id: 'd3', name: 'ITC Reconciliation.xlsx', type: 'xlsx', folder: 'GST / Q2 2024', company: 'Aurora Holdings', size: '890 KB', modifiedBy: 'Meena Krishnan', modifiedAt: '3h ago', version: 'v7', sharedWith: 5, status: 'approved', ocrProcessed: false },
  { id: 'd4', name: 'Audit Report Q2.pdf', type: 'pdf', folder: 'Audit / Q2 2024', company: 'Aurora Finance', size: '4.2 MB', modifiedBy: 'Karthik Nair', modifiedAt: '5h ago', version: 'v1', sharedWith: 3, status: 'approved', ocrProcessed: true },
  { id: 'd5', name: 'Vendor KYC GlobalLogix.pdf', type: 'pdf', folder: 'Vendors / GlobalLogix', company: 'Aurora Manufacturing', size: '1.8 MB', modifiedBy: 'Karthik Nair', modifiedAt: '1d ago', version: 'v3', sharedWith: 4, status: 'in-review', ocrProcessed: true },
  { id: 'd6', name: 'Payroll September.xlsx', type: 'xlsx', folder: 'HR / Payroll', company: 'Aurora Tech', size: '1.5 MB', modifiedBy: 'Deepika Rao', modifiedAt: '1d ago', version: 'v2', sharedWith: 3, status: 'approved', ocrProcessed: false },
  { id: 'd7', name: 'Board Resolution.pdf', type: 'pdf', folder: 'Board / Resolutions', company: 'Aurora Holdings', size: '320 KB', modifiedBy: 'Legal Bot', modifiedAt: '2d ago', version: 'v1', sharedWith: 8, status: 'draft', ocrProcessed: true },
  { id: 'd8', name: 'TDS Form 26Q.pdf', type: 'pdf', folder: 'TDS / Q2 2024', company: 'Aurora Finance', size: '680 KB', modifiedBy: 'Karthik Nair', modifiedAt: '2d ago', version: 'v1', sharedWith: 2, status: 'approved', ocrProcessed: true },
  { id: 'd9', name: 'Invoice INV-2024-0892.pdf', type: 'pdf', folder: 'Invoices / August', company: 'Aurora Manufacturing', size: '140 KB', modifiedBy: 'Priya Sharma', modifiedAt: '3d ago', version: 'v1', sharedWith: 3, status: 'approved', ocrProcessed: true },
  { id: 'd10', name: 'Bank Statements.zip', type: 'folder', folder: 'Banking / Statements', company: 'Aurora Tech', size: '12.4 MB', modifiedBy: 'Rajesh Kumar', modifiedAt: '3d ago', version: '—', sharedWith: 2, status: 'archived', ocrProcessed: false },
]

export const DOCUMENT_FOLDERS = [
  { id: 'f1', name: 'Board', documents: 8, color: '#f59e0b' },
  { id: 'f2', name: 'GST', documents: 24, color: '#10b981' },
  { id: 'f3', name: 'Audit', documents: 12, color: '#8b5cf6' },
  { id: 'f4', name: 'HR', documents: 18, color: '#ec4899' },
  { id: 'f5', name: 'Vendors', documents: 31, color: '#06b6d4' },
  { id: 'f6', name: 'TDS', documents: 9, color: '#f97316' },
  { id: 'f7', name: 'Invoices', documents: 142, color: '#14b8a6' },
  { id: 'f8', name: 'Banking', documents: 6, color: '#3b82f6' },
]

// ─── Calendar Events ───────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string
  title: string
  type: 'gst-deadline' | 'meeting' | 'approval' | 'task' | 'payment' | 'compliance' | 'ai-reminder'
  company: string
  date: number
  time: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee?: string
}

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'GSTR-3B Filing Deadline', type: 'gst-deadline', company: 'Aurora Retail', date: 20, time: '11:59 PM', priority: 'critical', assignee: 'Priya Sharma' },
  { id: 'e2', title: 'Q3 Board Meeting', type: 'meeting', company: 'Aurora Holdings', date: 20, time: '10:00 AM', priority: 'high' },
  { id: 'e3', title: 'CFO Approval — Cloud Payment', type: 'approval', company: 'Aurora Tech', date: 19, time: '2:00 PM', priority: 'high', assignee: 'Vikram Mehta' },
  { id: 'e4', title: 'TDS Payment Due', type: 'compliance', company: 'Aurora Finance', date: 22, time: '11:59 PM', priority: 'high', assignee: 'Karthik Nair' },
  { id: 'e5', title: 'Payroll Processing', type: 'task', company: 'Aurora Tech', date: 19, time: '9:00 AM', priority: 'critical', assignee: 'Deepika Rao' },
  { id: 'e6', title: 'AI Reminder — ITC Review', type: 'ai-reminder', company: 'Aurora Holdings', date: 21, time: '9:00 AM', priority: 'medium' },
  { id: 'e7', title: 'Vendor Payment Run', type: 'payment', company: 'Aurora Manufacturing', date: 23, time: '3:00 PM', priority: 'medium' },
  { id: 'e8', title: 'GSTR-1 Filing Deadline', type: 'gst-deadline', company: 'All Companies', date: 11, time: '11:59 PM', priority: 'critical' },
  { id: 'e9', title: 'Internal Audit — Delhi', type: 'task', company: 'Aurora Manufacturing', date: 25, time: '10:00 AM', priority: 'medium', assignee: 'Arjun Gupta' },
  { id: 'e10', title: 'Compliance Review', type: 'compliance', company: 'Standalone Traders', date: 19, time: '4:00 PM', priority: 'critical' },
]

// ─── Audit Log ─────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string
  user: string
  avatar: string
  action: string
  entity: string
  company: string
  timestamp: string
  ipAddress: string
  category: 'user' | 'organization' | 'approval' | 'change' | 'ai' | 'compliance'
  severity: 'info' | 'warning' | 'critical'
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'al1', user: 'Vikram Mehta', avatar: 'VM', action: 'approved payment', entity: 'PAY-2024-0341 ₹22L', company: 'Aurora Tech', timestamp: '2024-09-19 10:32:14', ipAddress: '103.21.x.x', category: 'approval', severity: 'info' },
  { id: 'al2', user: 'AI Risk Engine', avatar: 'AI', action: 'flagged anomaly', entity: 'Cash Flow — Standalone Traders', company: 'Standalone Traders', timestamp: '2024-09-19 09:18:42', ipAddress: 'system', category: 'ai', severity: 'critical' },
  { id: 'al3', user: 'Priya Sharma', avatar: 'PS', action: 'modified GSTR-3B', entity: 'Aurora Retail — August', company: 'Aurora Retail', timestamp: '2024-09-19 09:05:21', ipAddress: '49.36.x.x', category: 'change', severity: 'warning' },
  { id: 'al4', user: 'Karthik Nair', avatar: 'KN', action: 'downloaded document', entity: 'Audit Report Q2.pdf', company: 'Aurora Finance', timestamp: '2024-09-19 08:47:09', ipAddress: '49.36.x.x', category: 'user', severity: 'info' },
  { id: 'al5', user: 'System', avatar: 'SY', action: 'auto-filed GSTR-1', entity: 'Aurora Manufacturing — August', company: 'Aurora Manufacturing', timestamp: '2024-09-19 06:00:00', ipAddress: 'system', category: 'compliance', severity: 'info' },
  { id: 'al6', user: 'Anita Desai', avatar: 'AD', action: 'created workflow rule', entity: 'Auto-approve < ₹50K expenses', company: 'Aurora Holdings', timestamp: '2024-09-18 17:22:33', ipAddress: '103.21.x.x', category: 'organization', severity: 'info' },
  { id: 'al7', user: 'Deepika Rao', avatar: 'DR', action: 'updated role permissions', entity: 'GST Executive → limited approvals', company: 'Aurora Holdings', timestamp: '2024-09-18 15:10:55', ipAddress: '103.21.x.x', category: 'organization', severity: 'warning' },
  { id: 'al8', user: 'AI Copilot', avatar: 'AI', action: 'detected ITC reversal', entity: '₹4.2L — 3 cancelled invoices', company: 'Aurora Retail', timestamp: '2024-09-18 14:33:12', ipAddress: 'system', category: 'ai', severity: 'warning' },
  { id: 'al9', user: 'Suresh Iyer', avatar: 'SI', action: 'logged in', entity: 'Session started', company: 'Aurora Manufacturing', timestamp: '2024-09-18 09:00:01', ipAddress: '157.32.x.x', category: 'user', severity: 'info' },
  { id: 'al10', user: 'System', avatar: 'SY', action: 'failed login attempt', entity: '3 attempts — blocked', company: '—', timestamp: '2024-09-18 02:14:08', ipAddress: '45.113.x.x', category: 'user', severity: 'critical' },
]

// ─── Enterprise KPIs (aggregated) ──────────────────────────────────────────────
export const ENTERPRISE_KPIS = {
  totalCompanies: 6,
  totalGstins: 6,
  totalBranches: 38,
  totalUsers: 1240,
  totalRevenue: 1202000000,
  totalExpenses: 867000000,
  totalGstLiability: 56600000,
  totalOutstanding: 46400000,
  avgCompliance: 90,
  avgGrowth: 79.5,
  avgRisk: 17.3,
  avgAiScore: 85.2,
  netCashFlow: 335000000,
  pendingApprovals: 6,
  overdueFilings: 1,
  criticalAlerts: 2,
  tasksInProgress: 14,
}

// ─── Cross-Company Analytics ───────────────────────────────────────────────────
export const CROSS_COMPANY_METRICS = COMPANIES.map(c => ({
  company: c.name,
  revenue: c.revenue,
  expenses: c.expenses,
  profit: c.revenue - c.expenses,
  gst: c.gstLiability,
  compliance: c.complianceScore,
  growth: c.growthScore,
  cashFlow: c.cashFlow,
  risk: c.riskScore,
  aiScore: c.aiScore,
}))
