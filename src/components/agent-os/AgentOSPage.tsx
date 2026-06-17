'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bot, Brain, Cpu, Zap, Play, Pause, Plus, Trash2, Settings, Eye,
  Code, Database, Clock, Target, Sparkles, Workflow, MessageSquare,
  FileText, Shield, Activity, ChevronRight, Copy, CheckCircle, AlertTriangle,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' },
  }),
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — Pre-built Agent Templates
// ═══════════════════════════════════════════════════════════════════════════════

type AgentStatus = 'Active' | 'Paused' | 'Draft' | 'Running' | 'Error'

interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  capabilities: string[]
  status: AgentStatus
  runs: number
  successRate: number
  category: string
}

const agentTemplates: AgentTemplate[] = [
  {
    id: 'gst-agent',
    name: 'GST Agent',
    description: 'Files returns, checks compliance, manages deadlines automatically',
    icon: FileText,
    color: 'emerald',
    capabilities: ['GSTR-1 Filing', 'GSTR-3B Filing', 'Compliance Checks', 'Deadline Tracking', 'ARN Verification'],
    status: 'Active',
    runs: 1284,
    successRate: 98.7,
    category: 'Tax & Compliance',
  },
  {
    id: 'accounting-agent',
    name: 'Accounting Agent',
    description: 'Journal entries, reconciliation, P&L generation with double-entry accuracy',
    icon: Database,
    color: 'teal',
    capabilities: ['Journal Entries', 'Bank Reconciliation', 'P&L Generation', 'Balance Sheet', 'Trial Balance'],
    status: 'Active',
    runs: 876,
    successRate: 99.1,
    category: 'Accounting',
  },
  {
    id: 'invoice-agent',
    name: 'Invoice Agent',
    description: 'Creates, tracks, follows up on invoices with smart reminders',
    icon: FileText,
    color: 'amber',
    capabilities: ['Invoice Creation', 'Payment Tracking', 'Follow-up Reminders', 'E-Invoice Generation', 'Aging Analysis'],
    status: 'Active',
    runs: 2341,
    successRate: 97.3,
    category: 'Billing',
  },
  {
    id: 'compliance-agent',
    name: 'Compliance Agent',
    description: 'Monitors compliance, alerts on deadlines, tracks regulatory changes',
    icon: Shield,
    color: 'red',
    capabilities: ['Compliance Monitoring', 'Deadline Alerts', 'Regulatory Updates', 'Risk Assessment', 'Audit Trail'],
    status: 'Active',
    runs: 654,
    successRate: 99.5,
    category: 'Compliance',
  },
  {
    id: 'collection-agent',
    name: 'Collection Agent',
    description: 'Follows up payments, sends reminders, manages receivables pipeline',
    icon: Target,
    color: 'orange',
    capabilities: ['Payment Follow-up', 'Reminder Scheduling', 'Receivables Tracking', 'Dunning Management', 'Settlement Offers'],
    status: 'Paused',
    runs: 432,
    successRate: 94.2,
    category: 'Finance',
  },
  {
    id: 'sales-agent',
    name: 'Sales Agent',
    description: 'Lead qualification, proposal generation, pipeline management',
    icon: Zap,
    color: 'yellow',
    capabilities: ['Lead Qualification', 'Proposal Generation', 'Pipeline Management', 'Follow-up Emails', 'CRM Sync'],
    status: 'Draft',
    runs: 89,
    successRate: 91.0,
    category: 'Sales',
  },
  {
    id: 'audit-agent',
    name: 'Audit Agent',
    description: 'Audit trail, anomaly detection, risk assessment with AI insights',
    icon: Eye,
    color: 'purple',
    capabilities: ['Audit Trail', 'Anomaly Detection', 'Risk Assessment', 'Internal Controls', 'Compliance Verification'],
    status: 'Active',
    runs: 567,
    successRate: 96.8,
    category: 'Audit',
  },
  {
    id: 'hr-agent',
    name: 'HR Agent',
    description: 'Payroll, attendance, onboarding automation for firm teams',
    icon: Brain,
    color: 'cyan',
    capabilities: ['Payroll Processing', 'Attendance Tracking', 'Onboarding', 'Leave Management', 'Compliance Filing'],
    status: 'Draft',
    runs: 45,
    successRate: 88.5,
    category: 'HR',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — My Custom Agents
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomAgent {
  id: string
  name: string
  status: 'Running' | 'Paused' | 'Error'
  lastRun: string
  runsToday: number
  successRate: number
  icon: React.ElementType
  color: string
  trigger: string
  recentRuns: { id: string; time: string; duration: string; status: 'Success' | 'Failed'; output: string }[]
  memoryCount: number
  config: Record<string, string>
}

const customAgents: CustomAgent[] = [
  {
    id: 'ca-1',
    name: 'Monthly GST Reconciler',
    status: 'Running',
    lastRun: '5 min ago',
    runsToday: 12,
    successRate: 98.5,
    icon: Bot,
    color: 'emerald',
    trigger: 'Schedule: Daily 9:00 AM',
    recentRuns: [
      { id: 'r1', time: '09:00 AM', duration: '2m 14s', status: 'Success', output: 'Reconciled 47 clients, 3 mismatches flagged' },
      { id: 'r2', time: '09:00 AM (yesterday)', duration: '1m 58s', status: 'Success', output: 'Reconciled 45 clients, all matched' },
    ],
    memoryCount: 234,
    config: { category: 'Tax', tools: 'Read Data, Write Data, Send Notification', schedule: 'Daily 9:00 AM' },
  },
  {
    id: 'ca-2',
    name: 'Client Onboarding Bot',
    status: 'Running',
    lastRun: '1 hr ago',
    runsToday: 3,
    successRate: 100,
    icon: Sparkles,
    color: 'teal',
    trigger: 'Event: New Client Created',
    recentRuns: [
      { id: 'r3', time: '11:30 AM', duration: '45s', status: 'Success', output: 'Onboarded Sharma & Associates' },
      { id: 'r4', time: '10:15 AM', duration: '38s', status: 'Success', output: 'Onboarded Patel Traders' },
    ],
    memoryCount: 89,
    config: { category: 'CRM', tools: 'Write Data, Send Notification, Create Task', schedule: 'Event-based' },
  },
  {
    id: 'ca-3',
    name: 'Payment Reminder Engine',
    status: 'Paused',
    lastRun: '2 days ago',
    runsToday: 0,
    successRate: 94.2,
    icon: Clock,
    color: 'amber',
    trigger: 'Schedule: Mon/Wed/Fri 10:00 AM',
    recentRuns: [
      { id: 'r5', time: 'Mon 10:00 AM', duration: '1m 22s', status: 'Success', output: 'Sent 12 reminders, 3 acknowledged' },
      { id: 'r6', time: 'Fri 10:00 AM', duration: '1m 05s', status: 'Failed', output: 'SMTP connection timeout' },
    ],
    memoryCount: 156,
    config: { category: 'Finance', tools: 'Read Data, Send Notification', schedule: 'Mon/Wed/Fri 10:00 AM' },
  },
  {
    id: 'ca-4',
    name: 'E-Invoice Generator',
    status: 'Running',
    lastRun: '15 min ago',
    runsToday: 28,
    successRate: 99.1,
    icon: Code,
    color: 'orange',
    trigger: 'Event: Invoice Created',
    recentRuns: [
      { id: 'r7', time: '11:45 AM', duration: '8s', status: 'Success', output: 'IRN generated: ABC12345' },
      { id: 'r8', time: '11:42 AM', duration: '6s', status: 'Success', output: 'IRN generated: DEF67890' },
    ],
    memoryCount: 567,
    config: { category: 'Billing', tools: 'Read Data, Write Data, File Return', schedule: 'Event-based' },
  },
  {
    id: 'ca-5',
    name: 'Audit Anomaly Scanner',
    status: 'Error',
    lastRun: '3 hrs ago',
    runsToday: 1,
    successRate: 86.4,
    icon: AlertTriangle,
    color: 'red',
    trigger: 'Schedule: Daily 6:00 PM',
    recentRuns: [
      { id: 'r9', time: '06:00 PM', duration: '5m 33s', status: 'Failed', output: 'Data source connection refused' },
      { id: 'r10', time: 'Yesterday 6:00 PM', duration: '4m 12s', status: 'Success', output: 'Scanned 1,234 entries, 5 anomalies found' },
    ],
    memoryCount: 312,
    config: { category: 'Audit', tools: 'Read Data, Generate Report', schedule: 'Daily 6:00 PM' },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — Run History
// ═══════════════════════════════════════════════════════════════════════════════

interface RunEntry {
  id: string
  agentName: string
  startTime: string
  duration: string
  status: 'Success' | 'Failed' | 'Running'
  inputSummary: string
  outputSummary: string
  tokensUsed: number
  latency: string
  actionsTaken: string[]
}

const runHistory: RunEntry[] = [
  { id: 'RUN-001', agentName: 'Monthly GST Reconciler', startTime: '04 Mar 2026, 09:00 AM', duration: '2m 14s', status: 'Success', inputSummary: '47 client GSTR-2A data', outputSummary: '3 mismatches flagged, ₹4,56,000 ITC at risk', tokensUsed: 4520, latency: '340ms', actionsTaken: ['Read 2A data', 'Compare with books', 'Flag mismatches', 'Send notification'] },
  { id: 'RUN-002', agentName: 'Client Onboarding Bot', startTime: '04 Mar 2026, 11:30 AM', duration: '45s', status: 'Success', inputSummary: 'New client: Sharma & Associates', outputSummary: 'GSTIN verified, compliance profile created, 3 draft returns generated', tokensUsed: 2890, latency: '220ms', actionsTaken: ['Verify GSTIN', 'Create profile', 'Generate returns', 'Send welcome email'] },
  { id: 'RUN-003', agentName: 'E-Invoice Generator', startTime: '04 Mar 2026, 11:45 AM', duration: '8s', status: 'Success', inputSummary: 'Invoice INV-2026-0891', outputSummary: 'IRN: 12ABCD12345EFGH, e-invoice generated', tokensUsed: 580, latency: '95ms', actionsTaken: ['Validate invoice', 'Generate IRN', 'Create e-invoice'] },
  { id: 'RUN-004', agentName: 'Audit Anomaly Scanner', startTime: '04 Mar 2026, 06:00 PM', duration: '5m 33s', status: 'Failed', inputSummary: 'Full ledger scan for Q4 2025', outputSummary: 'Error: Data source connection refused after 3 retries', tokensUsed: 1200, latency: '5000ms', actionsTaken: ['Attempt connection', 'Retry x3', 'Log error', 'Send alert'] },
  { id: 'RUN-005', agentName: 'Monthly GST Reconciler', startTime: '03 Mar 2026, 09:00 AM', duration: '1m 58s', status: 'Success', inputSummary: '45 client GSTR-2A data', outputSummary: 'All matched. ITC claimed: ₹12,34,567', tokensUsed: 4100, latency: '310ms', actionsTaken: ['Read 2A data', 'Compare with books', 'Confirm match', 'Update records'] },
  { id: 'RUN-006', agentName: 'Payment Reminder Engine', startTime: '03 Mar 2026, 10:00 AM', duration: '1m 22s', status: 'Success', inputSummary: 'Outstanding invoices > 30 days', outputSummary: 'Sent 12 reminders, 3 acknowledged, ₹8,90,000 pending', tokensUsed: 3200, latency: '280ms', actionsTaken: ['Query overdue', 'Generate reminders', 'Send emails', 'Log responses'] },
  { id: 'RUN-007', agentName: 'Client Onboarding Bot', startTime: '03 Mar 2026, 10:15 AM', duration: '38s', status: 'Success', inputSummary: 'New client: Patel Traders', outputSummary: 'GSTIN verified, compliance profile created, welcome kit sent', tokensUsed: 2650, latency: '210ms', actionsTaken: ['Verify GSTIN', 'Create profile', 'Send welcome kit'] },
  { id: 'RUN-008', agentName: 'E-Invoice Generator', startTime: '03 Mar 2026, 02:30 PM', duration: '7s', status: 'Success', inputSummary: 'Invoice INV-2026-0876', outputSummary: 'IRN: 34FGH56789IJKL, e-invoice generated', tokensUsed: 540, latency: '88ms', actionsTaken: ['Validate invoice', 'Generate IRN'] },
  { id: 'RUN-009', agentName: 'Monthly GST Reconciler', startTime: '02 Mar 2026, 09:00 AM', duration: '2m 05s', status: 'Success', inputSummary: '51 client GSTR-2A data', outputSummary: '2 mismatches found, ₹1,23,000 ITC difference', tokensUsed: 4680, latency: '350ms', actionsTaken: ['Read 2A data', 'Compare with books', 'Flag mismatches'] },
  { id: 'RUN-010', agentName: 'Payment Reminder Engine', startTime: '01 Mar 2026, 10:00 AM', duration: '1m 05s', status: 'Failed', inputSummary: 'Outstanding invoices > 30 days', outputSummary: 'SMTP connection timeout after 30s', tokensUsed: 800, latency: '30000ms', actionsTaken: ['Query overdue', 'Attempt email send', 'Connection failed', 'Log error'] },
  { id: 'RUN-011', agentName: 'Audit Anomaly Scanner', startTime: '03 Mar 2026, 06:00 PM', duration: '4m 12s', status: 'Success', inputSummary: 'Full ledger scan for Q4 2025', outputSummary: '5 anomalies found, 2 high-risk, ₹6,78,900 in questioned entries', tokensUsed: 8900, latency: '420ms', actionsTaken: ['Scan ledger', 'Detect anomalies', 'Score risk', 'Generate report'] },
  { id: 'RUN-012', agentName: 'Monthly GST Reconciler', startTime: '01 Mar 2026, 09:00 AM', duration: '1m 48s', status: 'Success', inputSummary: '43 client GSTR-2A data', outputSummary: '1 mismatch, ₹45,000 ITC difference in GSTR-2B', tokensUsed: 3900, latency: '295ms', actionsTaken: ['Read 2A data', 'Compare with books', 'Flag mismatch'] },
  { id: 'RUN-013', agentName: 'E-Invoice Generator', startTime: '01 Mar 2026, 04:15 PM', duration: '6s', status: 'Success', inputSummary: 'Invoice INV-2026-0854', outputSummary: 'IRN: 56KLM01234NOPQ, e-invoice generated', tokensUsed: 520, latency: '82ms', actionsTaken: ['Validate', 'Generate IRN'] },
  { id: 'RUN-014', agentName: 'Client Onboarding Bot', startTime: '28 Feb 2026, 03:00 PM', duration: '42s', status: 'Success', inputSummary: 'New client: Reddy Enterprises', outputSummary: 'GSTIN verified, compliance profile created, 2 draft returns', tokensUsed: 2750, latency: '230ms', actionsTaken: ['Verify GSTIN', 'Create profile', 'Generate returns'] },
  { id: 'RUN-015', agentName: 'Monthly GST Reconciler', startTime: '28 Feb 2026, 09:00 AM', duration: '2m 30s', status: 'Success', inputSummary: '38 client GSTR-2A data', outputSummary: 'All matched. ITC claimed: ₹9,87,654', tokensUsed: 4250, latency: '360ms', actionsTaken: ['Read 2A', 'Compare', 'Confirm match'] },
  { id: 'RUN-016', agentName: 'Payment Reminder Engine', startTime: '28 Feb 2026, 10:00 AM', duration: '1m 15s', status: 'Success', inputSummary: 'Outstanding invoices > 30 days', outputSummary: 'Sent 9 reminders, ₹5,67,000 in overdue payments', tokensUsed: 3100, latency: '275ms', actionsTaken: ['Query overdue', 'Send reminders'] },
  { id: 'RUN-017', agentName: 'E-Invoice Generator', startTime: '28 Feb 2026, 11:20 AM', duration: '9s', status: 'Success', inputSummary: 'Invoice INV-2026-0832', outputSummary: 'IRN: 78RST56789TUVW, e-invoice generated', tokensUsed: 590, latency: '92ms', actionsTaken: ['Validate', 'Generate IRN', 'Create e-invoice'] },
  { id: 'RUN-018', agentName: 'Audit Anomaly Scanner', startTime: '02 Mar 2026, 06:00 PM', duration: '3m 45s', status: 'Success', inputSummary: 'Ledger scan for March 2026', outputSummary: '3 anomalies detected, 1 high-risk duplicate entry of ₹2,34,500', tokensUsed: 7800, latency: '390ms', actionsTaken: ['Scan ledger', 'Detect anomalies', 'Score risk'] },
  { id: 'RUN-019', agentName: 'Monthly GST Reconciler', startTime: '27 Feb 2026, 09:00 AM', duration: '—', status: 'Failed', inputSummary: 'Scheduled reconciliation', outputSummary: 'GST portal API rate limit exceeded', tokensUsed: 450, latency: '1200ms', actionsTaken: ['Attempt connection', 'Rate limited', 'Log error'] },
  { id: 'RUN-020', agentName: 'Client Onboarding Bot', startTime: '27 Feb 2026, 09:30 AM', duration: '50s', status: 'Success', inputSummary: 'New client: Kumar Industries', outputSummary: 'GSTIN verified, compliance profile created', tokensUsed: 2500, latency: '225ms', actionsTaken: ['Verify GSTIN', 'Create profile'] },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — Memory Entries
// ═══════════════════════════════════════════════════════════════════════════════

interface MemoryEntry {
  id: string
  agentName: string
  content: string
  timestamp: string
  category: string
  type: 'Conversation' | 'Long-term' | 'Working'
}

const memoryEntries: MemoryEntry[] = [
  { id: 'MEM-001', agentName: 'Monthly GST Reconciler', content: 'Sharma & Associates consistently has 2A mismatch in March — likely reverse charge entries not accounted', timestamp: '04 Mar 2026, 09:02 AM', category: 'Pattern', type: 'Long-term' },
  { id: 'MEM-002', agentName: 'Monthly GST Reconciler', content: 'Client Patel Traders switched to quarterly filing from Feb 2026', timestamp: '04 Mar 2026, 09:01 AM', category: 'Client Change', type: 'Long-term' },
  { id: 'MEM-003', agentName: 'Monthly GST Reconciler', content: 'ITC claim for Reddy Enterprises: ₹3,45,670 (March 2026)', timestamp: '04 Mar 2026, 09:03 AM', category: 'Financial', type: 'Working' },
  { id: 'MEM-004', agentName: 'Client Onboarding Bot', content: 'Sharma & Associates prefers email communication, weekly digest format', timestamp: '04 Mar 2026, 11:31 AM', category: 'Preference', type: 'Long-term' },
  { id: 'MEM-005', agentName: 'Client Onboarding Bot', content: 'Standard onboarding now includes GSTR-1, GSTR-3B, and GSTR-9 setup', timestamp: '04 Mar 2026, 11:30 AM', category: 'Process', type: 'Long-term' },
  { id: 'MEM-006', agentName: 'E-Invoice Generator', content: 'IRN generation for INV-2026-0891 completed in 8s, below SLA target of 10s', timestamp: '04 Mar 2026, 11:46 AM', category: 'Performance', type: 'Working' },
  { id: 'MEM-007', agentName: 'Audit Anomaly Scanner', content: 'Duplicate entry pattern detected in Kumar Industries journal — same vendor, same amount 3 months in a row', timestamp: '03 Mar 2026, 06:05 PM', category: 'Anomaly', type: 'Long-term' },
  { id: 'MEM-008', agentName: 'Payment Reminder Engine', content: '3 clients acknowledged payment reminders — average response time: 2.5 hours', timestamp: '03 Mar 2026, 10:02 AM', category: 'Response', type: 'Working' },
  { id: 'MEM-009', agentName: 'Monthly GST Reconciler', content: 'GST portal maintenance scheduled for 5th March — adjust reconciliation timing', timestamp: '03 Mar 2026, 09:00 AM', category: 'System', type: 'Conversation' },
  { id: 'MEM-010', agentName: 'Client Onboarding Bot', content: 'Patel Traders GSTIN: 24ABCPD1234F1Z5 — verified active on portal', timestamp: '03 Mar 2026, 10:16 AM', category: 'Verification', type: 'Working' },
  { id: 'MEM-011', agentName: 'Monthly GST Reconciler', content: 'Optimal ITC claim timing: file GSTR-3B by 18th to maximize working capital cycle', timestamp: '02 Mar 2026, 09:04 AM', category: 'Optimization', type: 'Long-term' },
  { id: 'MEM-012', agentName: 'Audit Anomaly Scanner', content: 'High-risk entry in Q4: ₹6,78,900 journal adjustment without supporting documentation', timestamp: '03 Mar 2026, 06:08 PM', category: 'Anomaly', type: 'Long-term' },
  { id: 'MEM-013', agentName: 'E-Invoice Generator', content: 'Average IRN generation time this week: 7.2s — improved from 8.5s last week', timestamp: '03 Mar 2026, 02:31 PM', category: 'Performance', type: 'Working' },
  { id: 'MEM-014', agentName: 'Payment Reminder Engine', content: 'Best reminder time for responses: Tuesday 10:00 AM (78% response rate)', timestamp: '28 Feb 2026, 10:03 AM', category: 'Optimization', type: 'Long-term' },
  { id: 'MEM-015', agentName: 'Monthly GST Reconciler', content: 'Current reconciliation coverage: 47/52 clients (90.4%) — 5 pending document uploads', timestamp: '01 Mar 2026, 09:02 AM', category: 'Coverage', type: 'Working' },
  { id: 'MEM-016', agentName: 'Client Onboarding Bot', content: 'Reddy Enterprises requires TDS return setup in addition to GST', timestamp: '28 Feb 2026, 03:02 PM', category: 'Client Need', type: 'Long-term' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — Marketplace
// ═══════════════════════════════════════════════════════════════════════════════

interface MarketAgent {
  id: string
  name: string
  author: string
  description: string
  downloads: number
  rating: number
  icon: React.ElementType
  tags: string[]
}

const marketAgents: MarketAgent[] = [
  { id: 'mk-1', name: 'GST Late Fee Calculator', author: 'Rajesh Kumar, CA', description: 'Automatically calculates late fees for delayed GST returns with interest computation', downloads: 4523, rating: 4.8, icon: Calculator, tags: ['GST', 'Compliance', 'Fees'] },
  { id: 'mk-2', name: 'ITC Reconciliation Bot', author: 'Priya Sharma & Co', description: 'Cross-verifies ITC claimed vs available in GSTR-2A/2B with auto-adjustment suggestions', downloads: 3876, rating: 4.9, icon: Database, tags: ['ITC', 'Reconciliation', '2A/2B'] },
  { id: 'mk-3', name: 'Client Onboarding Agent', author: 'GSTPilot Team', description: 'Complete client onboarding: GSTIN verification, compliance profile, return setup, welcome kit', downloads: 5210, rating: 4.7, icon: Sparkles, tags: ['Onboarding', 'CRM', 'Setup'] },
  { id: 'mk-4', name: 'Monthly Report Generator', author: 'Deepak Verma, CA', description: 'Generates comprehensive monthly reports: P&L, compliance summary, client health, cash flow', downloads: 2934, rating: 4.6, icon: FileText, tags: ['Reports', 'Analytics', 'Monthly'] },
  { id: 'mk-5', name: 'Payment Reminder Bot', author: 'Mehta Associates', description: 'Smart payment reminders with escalation, follow-up scheduling, and acknowledgment tracking', downloads: 3456, rating: 4.5, icon: Clock, tags: ['Payments', 'Reminders', 'Finance'] },
  { id: 'mk-6', name: 'Compliance Checker', author: 'Singh & Partners', description: 'Real-time compliance monitoring across GST, TDS, ROC with deadline prediction and alerts', downloads: 4102, rating: 4.8, icon: Shield, tags: ['Compliance', 'Monitoring', 'Alerts'] },
]

// Placeholder for the Calculator icon
function Calculator(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10.01" />
      <line x1="12" y1="10" x2="12" y2="10.01" />
      <line x1="16" y1="10" x2="16" y2="10.01" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="16" y2="18" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR MAP — Emerald + Slate Palette (NO indigo/blue)
// ═══════════════════════════════════════════════════════════════════════════════

const colorMap: Record<string, { bg: string; text: string; border: string; light: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-200', light: 'bg-teal-50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50' },
  red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-200', light: 'bg-red-50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200', light: 'bg-orange-50' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-200', light: 'bg-yellow-50' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-200', light: 'bg-cyan-50' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-200', light: 'bg-slate-50' },
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Paused: 'bg-amber-100 text-amber-700',
  Draft: 'bg-slate-100 text-slate-600',
  Running: 'bg-emerald-100 text-emerald-700',
  Error: 'bg-red-100 text-red-700',
}

const runStatusColors: Record<string, string> = {
  Success: 'bg-emerald-100 text-emerald-700',
  Failed: 'bg-red-100 text-red-700',
  Running: 'bg-amber-100 text-amber-700',
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG SPARKLINE
// ═══════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = 'emerald', width = 80, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const strokeColor = color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : '#64748b'
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" points={points.join(' ')} />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDER STATE
// ═══════════════════════════════════════════════════════════════════════════════

interface BuilderState {
  name: string
  description: string
  category: string
  iconColor: string
  triggerType: 'schedule' | 'event' | 'manual'
  scheduleFreq: string
  eventName: string
  cronExpr: string
  systemPrompt: string
  userContext: string
  tools: string[]
  memoryEnabled: boolean
  memoryType: string
  memorySize: string
  knowledgeDocs: string[]
  knowledgeSources: string[]
  actions: string[]
  dataAccess: string
  approvalRequired: boolean
  rateLimit: string
  schedule: string
  businessHoursOnly: boolean
  priority: string
}

const defaultBuilder: BuilderState = {
  name: '',
  description: '',
  category: 'Tax & Compliance',
  iconColor: 'emerald',
  triggerType: 'schedule',
  scheduleFreq: 'daily',
  eventName: '',
  cronExpr: '',
  systemPrompt: '',
  userContext: '',
  tools: [],
  memoryEnabled: true,
  memoryType: 'Long-term',
  memorySize: '100 MB',
  knowledgeDocs: [],
  knowledgeSources: [],
  actions: [],
  dataAccess: 'Read Only',
  approvalRequired: false,
  rateLimit: '100/hour',
  schedule: 'Daily 9:00 AM',
  businessHoursOnly: true,
  priority: 'Medium',
}

const builderSteps = [
  { id: 1, name: 'Name & Description', icon: Bot },
  { id: 2, name: 'Trigger', icon: Zap },
  { id: 3, name: 'Prompt', icon: Brain },
  { id: 4, name: 'Memory', icon: Database },
  { id: 5, name: 'Knowledge Base', icon: FileText },
  { id: 6, name: 'Actions', icon: Workflow },
  { id: 7, name: 'Permissions', icon: Shield },
  { id: 8, name: 'Schedule', icon: Clock },
]

const availableTools = ['Read Data', 'Write Data', 'Send Notification', 'Create Task', 'File Return', 'Generate Report']
const availableActions = ['Send Email', 'Create Task', 'Update Record', 'Trigger Webhook', 'Generate Report']
const triggerEvents = ['Invoice Created', 'Payment Received', 'Client Added', 'Return Filed', 'Compliance Alert', 'Document Uploaded', 'Deadline Approaching', 'Anomaly Detected']

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: AGENT GALLERY
// ═══════════════════════════════════════════════════════════════════════════════

function AgentGalleryTab({ onBuildCustom }: { onBuildCustom: () => void }) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-800 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="h-5 w-5 text-emerald-300" />
            <span className="text-emerald-200 text-sm font-medium tracking-wide">AI AGENT OPERATING SYSTEM™</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Build Custom AI Employees</h1>
          <p className="text-emerald-100/80 max-w-2xl text-sm md:text-base">
            Design, deploy, and manage intelligent agents that handle your firm&apos;s workflows autonomously. From GST filing to client onboarding — build it once, run it forever.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={onBuildCustom} className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold gap-2">
              <Plus className="h-4 w-4" /> Build Custom Agent
            </Button>
            <Button variant="outline" className="border-emerald-300 text-emerald-100 hover:bg-emerald-600/30 gap-2">
              <Eye className="h-4 w-4" /> Watch Demo
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pre-built Agents', value: '8', icon: Bot, color: 'emerald' },
          { label: 'Total Runs Today', value: fmt(1284), icon: Activity, color: 'teal' },
          { label: 'Avg Success Rate', value: '97.2%', icon: CheckCircle, color: 'amber' },
          { label: 'Active Agents', value: '5', icon: Zap, color: 'orange' },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="border-slate-200/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorMap[stat.color].light}`}>
                  <stat.icon className={`h-4 w-4 ${colorMap[stat.color].text}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agent Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Pre-built Agent Templates</h2>
          <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 border-slate-200">
            <Settings className="h-3.5 w-3.5" /> Filter
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {agentTemplates.map((agent, i) => {
            const c = colorMap[agent.color]
            return (
              <motion.div key={agent.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                <Card className="border-slate-200/60 hover:shadow-md transition-shadow h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`p-2.5 rounded-xl ${c.light} ${c.border} border`}>
                        <agent.icon className={`h-5 w-5 ${c.text}`} />
                      </div>
                      <Badge className={`${statusColors[agent.status]} text-[10px] font-medium`}>
                        {agent.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-800 mt-2">{agent.name}</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">{agent.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Capabilities</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.capabilities.slice(0, 3).map(cap => (
                          <Badge key={cap} variant="secondary" className="text-[10px] bg-slate-50 text-slate-600 border border-slate-100">
                            {cap}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] bg-slate-50 text-slate-500">
                            +{agent.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {fmt(agent.runs)} runs</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> {agent.successRate}%</span>
                    </div>
                    <Button size="sm" className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Copy className="h-3.5 w-3.5" /> Use Template
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: AGENT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function AgentBuilderTab() {
  const [step, setStep] = useState(1)
  const [builder, setBuilder] = useState<BuilderState>({ ...defaultBuilder })
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const update = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setBuilder(prev => ({ ...prev, [key]: value }))

  const toggleTool = (tool: string) => {
    setBuilder(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool],
    }))
  }

  const toggleAction = (action: string) => {
    setBuilder(prev => ({
      ...prev,
      actions: prev.actions.includes(action)
        ? prev.actions.filter(a => a !== action)
        : [...prev.actions, action],
    }))
  }

  const handleTest = () => {
    setIsTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setIsTesting(false)
      setTestResult(`✅ Agent "${builder.name || 'Untitled'}" test completed successfully.\n\nTrigger: ${builder.triggerType === 'schedule' ? builder.scheduleFreq : builder.triggerType === 'event' ? builder.eventName : 'Manual'}\nTools: ${builder.tools.length} enabled\nActions: ${builder.actions.length} configured\nMemory: ${builder.memoryEnabled ? builder.memoryType : 'Disabled'}\n\nSimulated response time: 245ms\nTokens used: 1,234\nOutput: "Processed 47 client records, 3 items flagged for review"`)
    }, 2500)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Agent Name</label>
              <Input
                placeholder="e.g., Monthly GST Reconciler"
                value={builder.name}
                onChange={e => update('name', e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</label>
              <Textarea
                placeholder="Describe what this agent does..."
                value={builder.description}
                onChange={e => update('description', e.target.value)}
                className="border-slate-200 min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Category</label>
              <Select value={builder.category} onValueChange={v => update('category', v)}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Tax & Compliance', 'Accounting', 'Billing', 'Finance', 'CRM', 'Audit', 'HR', 'Operations'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Icon Color</label>
              <div className="flex gap-2">
                {Object.keys(colorMap).map(color => (
                  <button
                    key={color}
                    onClick={() => update('iconColor', color)}
                    className={`w-8 h-8 rounded-lg ${colorMap[color].bg} transition-all ${builder.iconColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-3 block">When should this agent run?</label>
              <div className="grid grid-cols-3 gap-3">
                {(['schedule', 'event', 'manual'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => update('triggerType', type)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      builder.triggerType === type
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Zap className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-sm font-medium capitalize">{type}</p>
                  </button>
                ))}
              </div>
            </div>
            {builder.triggerType === 'schedule' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Frequency</label>
                  <Select value={builder.scheduleFreq} onValueChange={v => update('scheduleFreq', v)}>
                    <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Daily', 'Weekly', 'Monthly', 'Cron Expression'].map(f => (
                        <SelectItem key={f} value={f.toLowerCase()}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {builder.scheduleFreq === 'cron' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Cron Expression</label>
                    <Input placeholder="0 9 * * 1-5" value={builder.cronExpr} onChange={e => update('cronExpr', e.target.value)} className="border-slate-200 font-mono" />
                  </div>
                )}
              </div>
            )}
            {builder.triggerType === 'event' && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Event Trigger</label>
                <Select value={builder.eventName} onValueChange={v => update('eventName', v)}>
                  <SelectTrigger className="border-slate-200"><SelectValue placeholder="Select event..." /></SelectTrigger>
                  <SelectContent>
                    {triggerEvents.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {builder.triggerType === 'manual' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Manual Trigger</p>
                <p>This agent will only run when you explicitly trigger it from the My Agents panel or via API.</p>
              </div>
            )}
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">System Prompt</label>
              <Textarea
                placeholder="You are a GST compliance expert. Your role is to reconcile GSTR-2A data with client books, identify mismatches, and generate actionable reports..."
                value={builder.systemPrompt}
                onChange={e => update('systemPrompt', e.target.value)}
                className="border-slate-200 min-h-[120px] font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">User Context</label>
              <Textarea
                placeholder="Client data, period, specific instructions..."
                value={builder.userContext}
                onChange={e => update('userContext', e.target.value)}
                className="border-slate-200 min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Available Tools</label>
              <div className="grid grid-cols-2 gap-2">
                {availableTools.map(tool => (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                      builder.tools.includes(tool)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {builder.tools.includes(tool) ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded border border-slate-300" />}
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Enable Memory</label>
                <p className="text-xs text-slate-500">Allow agent to remember context across runs</p>
              </div>
              <Switch checked={builder.memoryEnabled} onCheckedChange={v => update('memoryEnabled', v)} />
            </div>
            {builder.memoryEnabled && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Memory Type</label>
                  <Select value={builder.memoryType} onValueChange={v => update('memoryType', v)}>
                    <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Conversation', 'Long-term', 'Working'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Memory Size Limit</label>
                  <Select value={builder.memorySize} onValueChange={v => update('memorySize', v)}>
                    <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['50 MB', '100 MB', '250 MB', '500 MB', '1 GB'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Upload Documents</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-300 transition-colors cursor-pointer">
                <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, CSV, XLSX — Max 25 MB each</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Connect Data Sources</label>
              <div className="grid grid-cols-2 gap-2">
                {['GST Portal', 'Tally ERP', 'Zoho Books', 'Bank Statements', 'Google Drive', 'Custom API'].map(src => (
                  <button
                    key={src}
                    onClick={() => setBuilder(prev => ({
                      ...prev,
                      knowledgeSources: prev.knowledgeSources.includes(src)
                        ? prev.knowledgeSources.filter(s => s !== src)
                        : [...prev.knowledgeSources, src],
                    }))}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                      builder.knowledgeSources.includes(src)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Database className="h-4 w-4" />
                    {src}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Define Context</label>
              <Textarea
                placeholder="Provide additional context about the data sources, formats, and specific business rules..."
                className="border-slate-200 min-h-[80px]"
              />
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Define what happens when this agent produces output:</p>
            <div className="grid grid-cols-1 gap-2">
              {availableActions.map(action => {
                const icons: Record<string, React.ElementType> = {
                  'Send Email': MessageSquare,
                  'Create Task': Plus,
                  'Update Record': Database,
                  'Trigger Webhook': Zap,
                  'Generate Report': FileText,
                }
                const ActionIcon = icons[action] || Zap
                return (
                  <button
                    key={action}
                    onClick={() => toggleAction(action)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-all ${
                      builder.actions.includes(action)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {builder.actions.includes(action) ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded border border-slate-300" />}
                    <ActionIcon className="h-4 w-4" />
                    <span className="font-medium">{action}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      case 7:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Data Access Level</label>
              <Select value={builder.dataAccess} onValueChange={v => update('dataAccess', v)}>
                <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Read Only', 'Read + Write', 'Full Access'].map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-700">Require Approval</p>
                <p className="text-xs text-slate-500">Agent actions need human approval before execution</p>
              </div>
              <Switch checked={builder.approvalRequired} onCheckedChange={v => update('approvalRequired', v)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Rate Limit</label>
              <Select value={builder.rateLimit} onValueChange={v => update('rateLimit', v)}>
                <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['50/hour', '100/hour', '500/hour', '1000/hour', 'Unlimited'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      case 8:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Run Schedule</label>
              <Input
                placeholder="e.g., Daily 9:00 AM"
                value={builder.schedule}
                onChange={e => update('schedule', e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-700">Business Hours Only</p>
                <p className="text-xs text-slate-500">Agent only runs during 9 AM - 7 PM IST</p>
              </div>
              <Switch checked={builder.businessHoursOnly} onCheckedChange={v => update('businessHoursOnly', v)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Priority Level</label>
              <Select value={builder.priority} onValueChange={v => update('priority', v)}>
                <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Builder Steps */}
      <div className="lg:col-span-2 space-y-4">
        {/* Step Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {builderSteps.map(s => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                step === s.id
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : step > s.id
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.name}</span>
              <span className="sm:hidden">{s.id}</span>
            </button>
          ))}
        </div>

        {/* Progress */}
        <Progress value={(step / 8) * 100} className="h-1.5" />

        {/* Step Content */}
        <Card className="border-slate-200/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                {React.createElement(builderSteps[step - 1].icon, { className: 'h-4 w-4 text-emerald-600' })}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Step {step}: {builderSteps[step - 1].name}
                </CardTitle>
                <p className="text-xs text-slate-500">Configure the {builderSteps[step - 1].name.toLowerCase()} for your agent</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="border-slate-200 text-slate-600"
          >
            ← Previous
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1.5"
            >
              {isTesting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Test Agent
                </>
              )}
            </Button>
            {step < 8 ? (
              <Button onClick={() => setStep(step + 1)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="border-slate-200 text-slate-600 gap-1.5">
                  <Settings className="h-3.5 w-3.5" /> Save Draft
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Deploy Agent
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Test Result */}
        <AnimatePresence>
          {testResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Test Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-emerald-700 whitespace-pre-wrap font-mono">{testResult}</pre>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Preview Panel */}
      <div className="lg:col-span-1">
        <Card className="border-slate-200/60 sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" /> Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${colorMap[builder.iconColor].light} ${colorMap[builder.iconColor].border} border`}>
                <Bot className={`h-5 w-5 ${colorMap[builder.iconColor].text}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{builder.name || 'Untitled Agent'}</p>
                <p className="text-xs text-slate-500 truncate">{builder.category}</p>
              </div>
            </div>
            <Separator />
            {builder.description && (
              <p className="text-xs text-slate-600">{builder.description}</p>
            )}
            <div className="space-y-2">
              {[
                { label: 'Trigger', value: builder.triggerType === 'schedule' ? `Schedule (${builder.scheduleFreq})` : builder.triggerType === 'event' ? `Event (${builder.eventName || '—'})` : 'Manual' },
                { label: 'Tools', value: builder.tools.length > 0 ? builder.tools.join(', ') : 'None selected' },
                { label: 'Memory', value: builder.memoryEnabled ? `${builder.memoryType} (${builder.memorySize})` : 'Disabled' },
                { label: 'Actions', value: builder.actions.length > 0 ? builder.actions.join(', ') : 'None selected' },
                { label: 'Data Access', value: builder.dataAccess },
                { label: 'Approval', value: builder.approvalRequired ? 'Required' : 'Auto-approved' },
                { label: 'Rate Limit', value: builder.rateLimit },
                { label: 'Schedule', value: builder.schedule },
                { label: 'Business Hours', value: builder.businessHoursOnly ? 'Only' : 'Any time' },
                { label: 'Priority', value: builder.priority },
              ].map(item => (
                <div key={item.label} className="flex items-start justify-between text-xs">
                  <span className="text-slate-500 font-medium">{item.label}</span>
                  <span className="text-slate-700 text-right max-w-[60%] truncate">{item.value}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Config Completeness</span>
              <span className="text-emerald-600 font-medium">
                {Math.round([
                  builder.name, builder.description, builder.systemPrompt,
                  builder.tools.length > 0, builder.actions.length > 0,
                ].filter(Boolean).length / 5 * 100)}%
              </span>
            </div>
            <Progress value={[
              builder.name, builder.description, builder.systemPrompt,
              builder.tools.length > 0, builder.actions.length > 0,
            ].filter(Boolean).length / 5 * 100} className="h-1.5" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: MY AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

function MyAgentsTab() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  // Sparkline data per agent
  const sparkData: Record<string, number[]> = {
    'ca-1': [85, 92, 88, 95, 91, 98, 96, 94, 99, 97, 98, 95],
    'ca-2': [100, 100, 100, 95, 100, 100, 100, 100, 100, 98, 100, 100],
    'ca-3': [90, 88, 95, 92, 94, 0, 0, 96, 89, 93, 0, 0],
    'ca-4': [99, 98, 99, 97, 100, 99, 98, 99, 100, 99, 99, 98],
    'ca-5': [80, 85, 82, 78, 90, 87, 0, 86, 88, 84, 0, 75],
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Running', value: '3', icon: Play, color: 'emerald' },
          { label: 'Paused', value: '1', icon: Pause, color: 'amber' },
          { label: 'Errors', value: '1', icon: AlertTriangle, color: 'red' },
          { label: 'Total Runs Today', value: fmt(44), icon: Activity, color: 'teal' },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200/60">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${colorMap[stat.color].light}`}>
                <stat.icon className={`h-3.5 w-3.5 ${colorMap[stat.color].text}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {customAgents.map((agent, i) => {
          const c = colorMap[agent.color]
          const isExpanded = expandedAgent === agent.id
          return (
            <motion.div key={agent.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
              <Card className={`border-slate-200/60 transition-all ${isExpanded ? 'ring-1 ring-emerald-200' : ''}`}>
                <CardContent className="p-4">
                  {/* Agent Row */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${c.light} ${c.border} border`}>
                      <agent.icon className={`h-4 w-4 ${c.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{agent.name}</p>
                        <Badge className={`${statusColors[agent.status]} text-[10px]`}>{agent.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{agent.trigger}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
                      <div className="text-center">
                        <p className="font-semibold text-slate-700">{agent.runsToday}</p>
                        <p className="text-[10px]">Runs Today</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-emerald-600">{agent.successRate}%</p>
                        <p className="text-[10px]">Success</p>
                      </div>
                      <Sparkline data={sparkData[agent.id] || [50, 60, 55]} color={agent.status === 'Error' ? 'red' : 'emerald'} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-600">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600">
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <Separator className="my-3" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Configuration */}
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Configuration</p>
                            {Object.entries(agent.config).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-xs py-1">
                                <span className="text-slate-500 capitalize">{k}</span>
                                <span className="text-slate-700 font-medium">{v}</span>
                              </div>
                            ))}
                          </div>
                          {/* Recent Runs */}
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Recent Runs</p>
                            {agent.recentRuns.map(run => (
                              <div key={run.id} className="flex items-start gap-2 py-1.5 text-xs">
                                <Badge className={`${run.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} text-[9px] px-1.5`}>
                                  {run.status}
                                </Badge>
                                <div>
                                  <p className="text-slate-700">{run.time} · {run.duration}</p>
                                  <p className="text-slate-500 truncate max-w-[200px]">{run.output}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Memory */}
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Memory</p>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Database className="h-3.5 w-3.5 text-slate-400" />
                              <span>{agent.memoryCount} items stored</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button variant="outline" size="sm" className="h-6 text-[10px] border-slate-200 text-slate-600 gap-1">
                                <Copy className="h-3 w-3" /> Duplicate
                              </Button>
                              <Button variant="outline" size="sm" className="h-6 text-[10px] border-red-200 text-red-600 gap-1 hover:bg-red-50">
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
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
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: AGENT MEMORY & RUNS
// ═══════════════════════════════════════════════════════════════════════════════

function MemoryRunsTab() {
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [searchMemory, setSearchMemory] = useState('')
  const [selectedRun, setSelectedRun] = useState<RunEntry | null>(null)

  const filteredMemory = useMemo(() => {
    let entries = memoryEntries
    if (selectedAgent !== 'all') {
      entries = entries.filter(e => e.agentName === selectedAgent)
    }
    if (searchMemory) {
      const q = searchMemory.toLowerCase()
      entries = entries.filter(e => e.content.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
    }
    return entries
  }, [selectedAgent, searchMemory])

  const filteredRuns = useMemo(() => {
    if (selectedAgent === 'all') return runHistory
    return runHistory.filter(r => r.agentName === selectedAgent)
  }, [selectedAgent])

  // Memory stats
  const totalMemoryItems = memoryEntries.length
  const memorySize = '2.4 MB'
  const lastCleaned = '01 Mar 2026'

  return (
    <div className="space-y-4">
      {/* Agent Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[220px] border-slate-200">
            <SelectValue placeholder="Select Agent..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {customAgents.map(a => (
              <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Memory Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Memory Items', value: fmt(totalMemoryItems), icon: Database, color: 'emerald' },
          { label: 'Total Size', value: memorySize, icon: FileText, color: 'teal' },
          { label: 'Last Cleaned', value: lastCleaned, icon: Clock, color: 'amber' },
          { label: 'Active Types', value: '3', icon: Brain, color: 'orange' },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200/60">
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${colorMap[stat.color].light}`}>
                <stat.icon className={`h-3.5 w-3.5 ${colorMap[stat.color].text}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column: Memory + Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Memory Browser */}
        <Card className="border-slate-200/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" /> Memory Browser
              </CardTitle>
            </div>
            <Input
              placeholder="Search memories..."
              value={searchMemory}
              onChange={e => setSearchMemory(e.target.value)}
              className="h-8 text-xs border-slate-200 mt-2"
            />
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="px-4 pb-4 space-y-2">
                {filteredMemory.map(mem => (
                  <div key={mem.id} className="p-3 rounded-lg border border-slate-100 bg-white hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge className="text-[9px] bg-slate-100 text-slate-600">{mem.category}</Badge>
                      <Badge className={`text-[9px] ${
                        mem.type === 'Long-term' ? 'bg-emerald-100 text-emerald-700' :
                        mem.type === 'Working' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {mem.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{mem.content}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-slate-400">{mem.agentName}</p>
                      <p className="text-[10px] text-slate-400">{mem.timestamp}</p>
                    </div>
                  </div>
                ))}
                {filteredMemory.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">No memories found</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Run History */}
        <Card className="border-slate-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" /> Run History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="px-4 pb-4 space-y-2">
                {filteredRuns.map(run => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className="w-full text-left p-3 rounded-lg border border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${runStatusColors[run.status]} text-[9px]`}>{run.status}</Badge>
                        <span className="text-xs font-mono text-slate-500">{run.id}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{run.duration}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700">{run.agentName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{run.outputSummary}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{run.startTime}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Run Detail Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-lg">
          {selectedRun && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Run Detail: {selectedRun.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Agent</p>
                    <p className="font-medium text-slate-800">{selectedRun.agentName}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Status</p>
                    <Badge className={`${runStatusColors[selectedRun.status]} text-[10px]`}>{selectedRun.status}</Badge>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Start Time</p>
                    <p className="font-medium text-slate-800">{selectedRun.startTime}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Duration</p>
                    <p className="font-medium text-slate-800">{selectedRun.duration}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Tokens Used</p>
                    <p className="font-medium text-slate-800">{fmt(selectedRun.tokensUsed)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50">
                    <p className="text-slate-500 mb-0.5">Latency</p>
                    <p className="font-medium text-slate-800">{selectedRun.latency}</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs">
                  <p className="text-slate-500 mb-1">Input Summary</p>
                  <p className="text-slate-700">{selectedRun.inputSummary}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs">
                  <p className="text-slate-500 mb-1">Output Summary</p>
                  <p className="text-slate-700">{selectedRun.outputSummary}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs">
                  <p className="text-slate-500 mb-1">Actions Taken</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRun.actionsTaken.map(action => (
                      <Badge key={action} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: AGENT MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

function MarketplaceTab() {
  const [installed, setInstalled] = useState<Set<string>>(new Set())

  const toggleInstall = (id: string) => {
    setInstalled(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Agent Marketplace</h2>
          <p className="text-sm text-slate-500">Community-built agents you can install and customize</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Share2 className="h-4 w-4" /> Share Your Agent
        </Button>
      </div>

      {/* Marketplace Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {marketAgents.map((agent, i) => (
          <motion.div key={agent.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="border-slate-200/60 hover:shadow-md transition-shadow h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <agent.icon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    {'★'.repeat(Math.floor(agent.rating))}
                    <span className="font-medium">{agent.rating}</span>
                  </div>
                </div>
                <CardTitle className="text-base font-semibold text-slate-800 mt-2">{agent.name}</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{agent.description}</p>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1.5">by {agent.author}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {agent.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] bg-slate-50 text-slate-600 border border-slate-100">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Copy className="h-3 w-3" /> {fmt(agent.downloads)} installs
                  </span>
                  <Button
                    size="sm"
                    onClick={() => toggleInstall(agent.id)}
                    className={`gap-1.5 ${
                      installed.has(agent.id)
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {installed.has(agent.id) ? (
                      <><CheckCircle className="h-3.5 w-3.5" /> Installed</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5" /> Install</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Need Share2 icon for marketplace
function Share2(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AgentOSPage() {
  const [activeTab, setActiveTab] = useState('gallery')

  const handleBuildCustom = () => setActiveTab('builder')

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AI Agent Operating System™</h1>
            <p className="text-xs text-slate-500">Build, deploy & manage custom AI employees</p>
          </div>
        </div>
        <Button onClick={handleBuildCustom} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> New Agent
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 h-9 p-0.5">
          <TabsTrigger value="gallery" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 gap-1.5 px-3">
            <Bot className="h-3.5 w-3.5" /> Gallery
          </TabsTrigger>
          <TabsTrigger value="builder" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 gap-1.5 px-3">
            <Plus className="h-3.5 w-3.5" /> Builder
          </TabsTrigger>
          <TabsTrigger value="my-agents" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 gap-1.5 px-3">
            <Settings className="h-3.5 w-3.5" /> My Agents
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 gap-1.5 px-3">
            <Database className="h-3.5 w-3.5" /> Memory & Runs
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 gap-1.5 px-3">
            <Sparkles className="h-3.5 w-3.5" /> Marketplace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-4">
          <AgentGalleryTab onBuildCustom={handleBuildCustom} />
        </TabsContent>

        <TabsContent value="builder" className="mt-4">
          <AgentBuilderTab />
        </TabsContent>

        <TabsContent value="my-agents" className="mt-4">
          <MyAgentsTab />
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <MemoryRunsTab />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-4">
          <MarketplaceTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
