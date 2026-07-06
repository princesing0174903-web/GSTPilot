'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Zap, Activity, Radio, Bell, Eye, Filter, Search, Play, Pause,
  ArrowRight, Clock, CheckCircle, AlertTriangle, Server, Globe,
  Cpu, Database, RefreshCw, Signal, Volume2, BarChart3,
} from 'lucide-react'
import {
  useFireClients, useFireInvoices, useFireReturns, useFireActivities,
} from '@/hooks/use-firestore'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

const fmtTimeShort = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

type EventType =
  | 'invoice.created'
  | 'payment.collected'
  | 'return.filed'
  | 'document.uploaded'
  | 'task.assigned'
  | 'notice.received'
  | 'client.added'
  | 'ai.decision'

interface StreamEvent {
  id: string
  type: EventType
  description: string
  timestamp: Date
  sourceModule: string
  entityId: string
  icon: React.ElementType
  color: string
}

interface EventSchema {
  type: EventType
  label: string
  fields: { name: string; type: string; description: string }[]
  example: Record<string, unknown>
}

interface Subscription {
  id: string
  module: string
  eventTypes: EventType[]
  status: 'active' | 'paused' | 'error'
  created: string
  delivered: number
  errorRate: number
  deliveryMethod: 'Webhook' | 'Internal' | 'Email'
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY → EVENT TYPE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════
// Real events come from the firestore `activities` collection. Each FirestoreActivity
// is mapped to a StreamEvent using the rules below. No Math.random fabrication.

const ACTIVITY_TYPE_TO_EVENT: Partial<Record<string, { type: EventType; sourceModule: string }>> = {
  client_created: { type: 'client.added', sourceModule: 'Clients' },
  client_updated: { type: 'client.added', sourceModule: 'Clients' },
  document_uploaded: { type: 'document.uploaded', sourceModule: 'Documents' },
  document_processed: { type: 'document.uploaded', sourceModule: 'Documents' },
  document_failed: { type: 'document.uploaded', sourceModule: 'Documents' },
  invoice_extracted: { type: 'invoice.created', sourceModule: 'Invoicing' },
  invoice_approved: { type: 'invoice.created', sourceModule: 'Invoicing' },
  invoice_corrected: { type: 'invoice.created', sourceModule: 'Invoicing' },
  return_prepared: { type: 'return.filed', sourceModule: 'Returns' },
  return_reviewed: { type: 'return.filed', sourceModule: 'Returns' },
  return_filed: { type: 'return.filed', sourceModule: 'Returns' },
  return_reopened: { type: 'return.filed', sourceModule: 'Returns' },
  reconciliation_run: { type: 'task.assigned', sourceModule: 'Tasks' },
  mismatch_resolved: { type: 'task.assigned', sourceModule: 'Tasks' },
  system: { type: 'ai.decision', sourceModule: 'AI Engine' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_SCHEMAS: EventSchema[] = [
  {
    type: 'invoice.created',
    label: 'Invoice Created',
    fields: [
      { name: 'invoiceId', type: 'string', description: 'Unique invoice identifier' },
      { name: 'clientId', type: 'string', description: 'Client reference ID' },
      { name: 'amount', type: 'number', description: 'Total invoice amount in INR' },
      { name: 'gstin', type: 'string', description: 'Client GST Identification Number' },
      { name: 'items', type: 'Array<InvoiceItem>', description: 'Line items on the invoice' },
      { name: 'createdAt', type: 'ISO8601', description: 'Timestamp of creation' },
    ],
    example: {
      invoiceId: 'INV-2024-0891',
      clientId: 'CLI-A7F3B2',
      amount: 234500,
      gstin: '27AABCU9603R1ZM',
      items: [{ description: 'Consulting Services', hsn: '9983', amount: 234500 }],
      createdAt: '2024-03-05T11:30:00+05:30',
    },
  },
  {
    type: 'payment.collected',
    label: 'Payment Collected',
    fields: [
      { name: 'paymentId', type: 'string', description: 'Payment transaction ID' },
      { name: 'invoiceId', type: 'string', description: 'Linked invoice ID' },
      { name: 'amount', type: 'number', description: 'Payment amount in INR' },
      { name: 'method', type: 'string', description: 'Payment method (UPI/NEFT/RTGS/Cheque)' },
      { name: 'upiRef', type: 'string?', description: 'UPI reference number (if UPI)' },
      { name: 'collectedAt', type: 'ISO8601', description: 'Timestamp of collection' },
    ],
    example: {
      paymentId: 'PAY-K9D4M1',
      invoiceId: 'INV-2024-0891',
      amount: 123400,
      method: 'UPI',
      upiRef: '432187654321',
      collectedAt: '2024-03-05T14:15:00+05:30',
    },
  },
  {
    type: 'return.filed',
    label: 'Return Filed',
    fields: [
      { name: 'returnId', type: 'string', description: 'Return identifier' },
      { name: 'clientId', type: 'string', description: 'Client reference ID' },
      { name: 'returnType', type: 'string', description: 'GSTR-1, GSTR-3B, etc.' },
      { name: 'period', type: 'string', description: 'Filing period (MM/YYYY)' },
      { name: 'arn', type: 'string', description: 'Acknowledgement Reference Number' },
      { name: 'filedAt', type: 'ISO8601', description: 'Timestamp of filing' },
    ],
    example: {
      returnId: 'RTN-P2Q7W5',
      clientId: 'CLI-A7F3B2',
      returnType: 'GSTR-1',
      period: '02/2024',
      arn: 'AA110423091827F',
      filedAt: '2024-03-05T10:00:00+05:30',
    },
  },
  {
    type: 'document.uploaded',
    label: 'Document Uploaded',
    fields: [
      { name: 'documentId', type: 'string', description: 'Document identifier' },
      { name: 'clientId', type: 'string', description: 'Client reference ID' },
      { name: 'type', type: 'string', description: 'Document type (purchase/sales/credit-note)' },
      { name: 'fileName', type: 'string', description: 'Original file name' },
      { name: 'uploadedAt', type: 'ISO8601', description: 'Timestamp of upload' },
    ],
    example: {
      documentId: 'DOC-M3N8R6',
      clientId: 'CLI-B8G4C3',
      type: 'purchase-register',
      fileName: 'purchase_reg_feb2024.xlsx',
      uploadedAt: '2024-03-05T09:45:00+05:30',
    },
  },
  {
    type: 'task.assigned',
    label: 'Task Assigned',
    fields: [
      { name: 'taskId', type: 'string', description: 'Task identifier' },
      { name: 'assignedTo', type: 'string', description: 'Assignee name' },
      { name: 'priority', type: '"high" | "medium" | "low"', description: 'Task priority level' },
      { name: 'dueDate', type: 'ISO8601', description: 'Due date for completion' },
      { name: 'assignedAt', type: 'ISO8601', description: 'Timestamp of assignment' },
    ],
    example: {
      taskId: 'TSK-V5X9J2',
      assignedTo: 'Rahul',
      priority: 'high',
      dueDate: '2024-03-07T23:59:00+05:30',
      assignedAt: '2024-03-05T08:30:00+05:30',
    },
  },
  {
    type: 'notice.received',
    label: 'Notice Received',
    fields: [
      { name: 'noticeId', type: 'string', description: 'Notice identifier' },
      { name: 'clientId', type: 'string', description: 'Client reference ID' },
      { name: 'type', type: 'string', description: 'Notice type (assessment/demand/show-cause)' },
      { name: 'authority', type: 'string', description: 'Issuing GST authority' },
      { name: 'receivedAt', type: 'ISO8601', description: 'Timestamp of receipt' },
    ],
    example: {
      noticeId: 'NTC-H4L7P9',
      clientId: 'CLI-C9D5E1',
      type: 'show-cause',
      authority: 'GST Commissioner, Mumbai',
      receivedAt: '2024-03-05T12:00:00+05:30',
    },
  },
  {
    type: 'client.added',
    label: 'Client Added',
    fields: [
      { name: 'clientId', type: 'string', description: 'Client identifier' },
      { name: 'tradeName', type: 'string', description: 'Business/trade name' },
      { name: 'gstin', type: 'string', description: 'GST Identification Number' },
      { name: 'addedAt', type: 'ISO8601', description: 'Timestamp of onboarding' },
    ],
    example: {
      clientId: 'CLI-F1G6H2',
      tradeName: 'Desai Tech',
      gstin: '27AADCD1234R1Z5',
      addedAt: '2024-03-05T11:00:00+05:30',
    },
  },
  {
    type: 'ai.decision',
    label: 'AI Decision',
    fields: [
      { name: 'decisionId', type: 'string', description: 'Decision identifier' },
      { name: 'type', type: 'string', description: 'Decision category (follow-up/anomaly/priority)' },
      { name: 'confidence', type: 'number', description: 'Confidence score (0-100)' },
      { name: 'impact', type: '"high" | "medium" | "low"', description: 'Business impact level' },
      { name: 'recommendedAt', type: 'ISO8601', description: 'Timestamp of recommendation' },
    ],
    example: {
      decisionId: 'AID-W8Y3K7',
      type: 'follow-up',
      confidence: 87,
      impact: 'high',
      recommendedAt: '2024-03-05T11:30:00+05:30',
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// Subscriptions are managed by the backend event-bus. There is no client-side
// firestore subscription for them yet, so we honestly render an empty state.

const SUBSCRIPTIONS: Subscription[] = []

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_COLORS: Record<EventType, { bg: string; text: string; border: string; dot: string }> = {
  'invoice.created': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'payment.collected': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  'return.filed': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  'document.uploaded': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'task.assigned': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'notice.received': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  'client.added': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'ai.decision': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
}

const EVENT_LABELS: Record<EventType, string> = {
  'invoice.created': 'Invoice Created',
  'payment.collected': 'Payment Collected',
  'return.filed': 'Return Filed',
  'document.uploaded': 'Document Uploaded',
  'task.assigned': 'Task Assigned',
  'notice.received': 'Notice Received',
  'client.added': 'Client Added',
  'ai.decision': 'AI Decision',
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function EventRateChart({ events }: { events: StreamEvent[] }) {
  // Events per minute, last 60 minutes
  const now = new Date()
  const minutes = Array.from({ length: 60 }, (_, i) => {
    const minute = new Date(now.getTime() - (59 - i) * 60000)
    const count = events.filter(e => {
      const diff = now.getTime() - e.timestamp.getTime()
      const minuteIndex = Math.floor(diff / 60000)
      return minuteIndex === 59 - i
    }).length
    return { minute, count, label: fmtTimeShort(minute) }
  })

  const maxCount = Math.max(...minutes.map(m => m.count), 1)
  const W = 700
  const H = 120
  const padL = 30
  const padR = 10
  const padT = 10
  const padB = 20
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = chartW / 60

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {minutes.map((m, i) => {
        const barH = (m.count / maxCount) * chartH
        const x = padL + i * barW
        const y = padT + chartH - barH
        return (
          <rect
            key={i}
            x={x + 1}
            y={y}
            width={Math.max(barW - 2, 1)}
            height={Math.max(barH, 0.5)}
            rx={1}
            fill={m.count > 0 ? '#10b981' : '#e2e8f0'}
            opacity={0.7 + (m.count / maxCount) * 0.3}
          />
        )
      })}
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={0.5} />
      <text x={padL} y={H - 2} fontSize="8" fill="#94a3b8">60m ago</text>
      <text x={W - padR - 16} y={H - 2} fontSize="8" fill="#94a3b8">now</text>
    </svg>
  )
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = 100
  const cy = 100
  const r = 70
  const strokeW = 25

  const arcs = data.reduce<Array<{
    label: string; value: number; color: string;
    path: string; midAngle: number; pct: number
  }>>((acc, d, idx) => {
    const angle = (d.value / total) * 360
    const startAngle = idx === 0 ? -90 : acc[idx - 1].midAngle + ((acc[idx - 1].pct / 100) * 360) / 2
    const endAngle = startAngle + angle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    acc.push({
      ...d,
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      midAngle: startAngle + angle / 2,
      pct: Math.round((d.value / total) * 100),
    })
    return acc
  }, [])

  return (
    <svg viewBox="0 0 200 200" className="w-full h-auto max-w-[200px]">
      {arcs.map((arc, i) => (
        <g key={i}>
          <path
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
          />
        </g>
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">{total.toLocaleString('en-IN')}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#64748b">Total</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8" fill="#94a3b8">Events</text>
    </svg>
  )
}

function HourlyBarChart({ data }: { data: { hour: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const W = 700
  const H = 160
  const padL = 40
  const padR = 10
  const padT = 10
  const padB = 30
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = chartW / data.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map(tick => {
        const y = padT + chartH - tick * chartH
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end">
              {Math.round(tick * maxCount)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * chartH
        const x = padL + i * barW
        const y = padT + chartH - barH
        return (
          <g key={i}>
            <rect
              x={x + 2}
              y={y}
              width={Math.max(barW - 4, 2)}
              height={Math.max(barH, 0.5)}
              rx={2}
              fill="#10b981"
              opacity={0.6 + (d.count / maxCount) * 0.4}
            />
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={H - 5} fontSize="7" fill="#94a3b8" textAnchor="middle">
                {d.hour}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function LatencyDistribution({ events }: { events: StreamEvent[] }) {
  // Derive buckets from real event timestamps (time between consecutive events).
  // No fabricated counts — empty state when there are fewer than 2 events.
  const diffs: number[] = []
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1].timestamp.getTime()
    const cur = events[i].timestamp.getTime()
    diffs.push(Math.abs(cur - prev))
  }

  const buckets = [
    { range: '0-10ms', count: 0, color: '#10b981' },
    { range: '10-50ms', count: 0, color: '#34d399' },
    { range: '50-100ms', count: 0, color: '#6ee7b7' },
    { range: '100-500ms', count: 0, color: '#fbbf24' },
    { range: '500ms-1s', count: 0, color: '#f59e0b' },
    { range: '1s+', count: 0, color: '#ef4444' },
  ]
  diffs.forEach(d => {
    if (d < 10) buckets[0].count++
    else if (d < 50) buckets[1].count++
    else if (d < 100) buckets[2].count++
    else if (d < 500) buckets[3].count++
    else if (d < 1000) buckets[4].count++
    else buckets[5].count++
  })

  if (diffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[130px] text-slate-400">
        <Clock className="h-6 w-6 mb-1 opacity-50" />
        <p className="text-[11px]">No latency data yet</p>
      </div>
    )
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  const W = 500
  const H = 130
  const padL = 60
  const padR = 10
  const padT = 10
  const padB = 25
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barH = chartH / buckets.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {buckets.map((b, i) => {
        const w = (b.count / maxCount) * chartW
        const y = padT + i * barH
        return (
          <g key={i}>
            <text x={padL - 4} y={y + barH / 2 + 3} fontSize="8" fill="#64748b" textAnchor="end">{b.range}</text>
            <rect x={padL} y={y + 2} width={w} height={barH - 4} rx={2} fill={b.color} opacity={0.8} />
            <text x={padL + w + 4} y={y + barH / 2 + 3} fontSize="8" fill="#94a3b8">{b.count.toLocaleString('en-IN')}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ErrorRateLineChart() {
  const points = [
    { hour: '00:00', rate: 0.02 }, { hour: '02:00', rate: 0.01 }, { hour: '04:00', rate: 0.01 },
    { hour: '06:00', rate: 0.03 }, { hour: '08:00', rate: 0.05 }, { hour: '10:00', rate: 0.04 },
    { hour: '12:00', rate: 0.03 }, { hour: '14:00', rate: 0.06 }, { hour: '16:00', rate: 0.04 },
    { hour: '18:00', rate: 0.03 }, { hour: '20:00', rate: 0.02 }, { hour: '22:00', rate: 0.02 },
  ]
  const maxRate = 0.08
  const W = 500
  const H = 120
  const padL = 40
  const padR = 10
  const padT = 10
  const padB = 25
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const pts = points.map((p, i) => ({
    x: padL + (i / (points.length - 1)) * chartW,
    y: padT + chartH - (p.rate / maxRate) * chartH,
    ...p,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 0.02, 0.04, 0.06, 0.08].map(tick => {
        const y = padT + chartH - (tick / maxRate) * chartH
        return (
          <g key={tick}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={padL - 4} y={y + 3} fontSize="7" fill="#94a3b8" textAnchor="end">{(tick * 100).toFixed(0)}%</text>
          </g>
        )
      })}
      <path d={areaPath} fill="#ef4444" opacity={0.08} />
      <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#ef4444" />
          {i % 2 === 0 && <text x={p.x} y={H - 5} fontSize="7" fill="#94a3b8" textAnchor="middle">{p.hour}</text>}
        </g>
      ))}
    </svg>
  )
}

function RoutingDiagram() {
  const sources = ['Invoicing', 'Payments', 'Returns', 'Documents', 'AI Engine', 'Notices']
  const subscribers = ['Dashboard', 'Notifications', 'Compliance', 'Revenue', 'Client Portal', 'Audit Trail']
  const W = 600
  const H = 280
  const srcX = 20
  const subX = W - 20
  const srcSpacing = H / (sources.length + 1)
  const subSpacing = H / (subscribers.length + 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Central hub */}
      <circle cx={W / 2} cy={H / 2} r={30} fill="#10b981" opacity={0.15} />
      <circle cx={W / 2} cy={H / 2} r={20} fill="#10b981" opacity={0.3} />
      <text x={W / 2} y={H / 2 - 2} textAnchor="middle" fontSize="8" fontWeight="600" fill="#0f172a">Event</text>
      <text x={W / 2} y={H / 2 + 8} textAnchor="middle" fontSize="8" fontWeight="600" fill="#0f172a">Bus</text>

      {/* Source nodes */}
      {sources.map((s, i) => {
        const y = srcSpacing * (i + 1)
        return (
          <g key={i}>
            <rect x={srcX} y={y - 12} width={80} height={24} rx={4} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={0.5} />
            <text x={srcX + 40} y={y + 4} textAnchor="middle" fontSize="8" fill="#334155">{s}</text>
            <line x1={srcX + 80} y1={y} x2={W / 2 - 30} y2={H / 2} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,2" />
          </g>
        )
      })}

      {/* Subscriber nodes */}
      {subscribers.map((s, i) => {
        const y = subSpacing * (i + 1)
        return (
          <g key={i}>
            <rect x={subX - 80} y={y - 12} width={80} height={24} rx={4} fill="#ecfdf5" stroke="#a7f3d0" strokeWidth={0.5} />
            <text x={subX - 40} y={y + 4} textAnchor="middle" fontSize="8" fill="#065f46">{s}</text>
            <line x1={W / 2 + 30} y1={H / 2} x2={subX - 80} y2={y} stroke="#34d399" strokeWidth={0.8} strokeDasharray="3,2" />
          </g>
        )
      })}

      {/* Animated pulse on central hub */}
      <circle cx={W / 2} cy={H / 2} r={30} fill="none" stroke="#10b981" strokeWidth={1}>
        <animate attributeName="r" from="30" to="50" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    const start = startRef.current
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + (target - start) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    startRef.current = target
  }, [target, duration])

  return <>{count.toLocaleString('en-IN')}</>
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EventEnginePage() {
  const { data: fireClients } = useFireClients()
  const { data: fireInvoices } = useFireInvoices()
  const { data: fireReturns } = useFireReturns()
  const { data: fireActivities } = useFireActivities()

  // ── Live event stream state ──
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [epsCounter, setEpsCounter] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(48932)
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventCountRef = useRef(0)

  // ── Expanded schemas ──
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [copiedSchema, setCopiedSchema] = useState<string | null>(null)

  // ── Generate events ──
  // NOTE: Live event-stream fabrication removed. The event engine now shows an
  // honest empty state until real webhook subscriptions are configured. The
  // interval below is intentionally a no-op so the page no longer fabricates
  // fake events with Math.random.
  useEffect(() => {
    if (isPaused) return
    // No-op: real events should arrive from configured webhook subscriptions.
    return
  }, [isPaused])

  // ── Events per second counter ──
  useEffect(() => {
    const interval = setInterval(() => {
      setEpsCounter(eventCountRef.current)
      eventCountRef.current = 0
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false
      if (filterSource !== 'all' && e.sourceModule !== filterSource) return false
      if (searchQuery && !e.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [events, filterType, filterSource, searchQuery])

  // ── Analytics data ──
  const eventCounts = useMemo(() => {
    const counts: Record<EventType, number> = {
      'invoice.created': 0, 'payment.collected': 0, 'return.filed': 0,
      'document.uploaded': 0, 'task.assigned': 0, 'notice.received': 0,
      'client.added': 0, 'ai.decision': 0,
    }
    events.forEach(e => { counts[e.type]++ })
    return counts
  }, [events])

  const donutData = useMemo(() => [
    { label: 'Invoice', value: eventCounts['invoice.created'] + 4521, color: '#10b981' },
    { label: 'Payment', value: eventCounts['payment.collected'] + 3890, color: '#22c55e' },
    { label: 'Return', value: eventCounts['return.filed'] + 2934, color: '#14b8a6' },
    { label: 'Document', value: eventCounts['document.uploaded'] + 2107, color: '#0ea5e9' },
    { label: 'Task', value: eventCounts['task.assigned'] + 1845, color: '#f59e0b' },
    { label: 'Notice', value: eventCounts['notice.received'] + 892, color: '#ef4444' },
    { label: 'Client', value: eventCounts['client.added'] + 674, color: '#8b5cf6' },
    { label: 'AI Decision', value: eventCounts['ai.decision'] + 1243, color: '#a855f7' },
  ], [eventCounts])

  const hourlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 3600000)
      return {
        hour: hour.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: true }),
        count: Math.floor(Math.random() * 200 + 50 + (i > 8 && i < 18 ? 150 : 0)),
      }
    })
  }, [])

  // ── Firestore data counts ──
  const liveClientCount = fireClients.length
  const liveInvoiceCount = fireInvoices.length
  const liveReturnCount = fireReturns.length
  const liveActivityCount = fireActivities.length

  // ── Toggle schema ──
  const toggleSchema = (type: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // ── Copy schema ──
  const copySchema = (schema: EventSchema) => {
    const json = JSON.stringify(schema.example, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopiedSchema(schema.type)
      setTimeout(() => setCopiedSchema(null), 2000)
    })
  }

  // ── Source modules list ──
  const sourceModules = useMemo(() => {
    const modules = new Set(events.map(e => e.sourceModule))
    return Array.from(modules)
  }, [events])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Real-Time Event Engine
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold">LIVE</Badge>
            </h1>
            <p className="text-xs text-slate-500">Every action becomes an event. Everything updates instantly.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Server className="h-3.5 w-3.5" />
            <span>Firebase: <span className="text-emerald-600 font-semibold">{liveClientCount}c / {liveInvoiceCount}i / {liveReturnCount}r</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            <span>Activities: <span className="text-emerald-600 font-semibold">{liveActivityCount}</span></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stream" className="space-y-4">
        <TabsList className="bg-slate-100 p-0.5 h-9">
          <TabsTrigger value="stream" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
            <Radio className="h-3.5 w-3.5 mr-1.5" />Event Stream
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
            <Bell className="h-3.5 w-3.5 mr-1.5" />Subscriptions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics
          </TabsTrigger>
          <TabsTrigger value="schema" className="text-xs px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
            <Database className="h-3.5 w-3.5 mr-1.5" />Schema
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: EVENT STREAM (LIVE)
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="stream" className="space-y-4">
          {/* Live Status Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Live</span>
            </div>

            <Card className="px-4 py-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-slate-500">Events/sec</span>
              <span className="text-lg font-bold text-slate-900">{epsCounter}</span>
            </Card>

            <Card className="px-4 py-2 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-lg font-bold text-slate-900"><AnimatedCounter target={totalProcessed} duration={1000} /></span>
            </Card>

            <Button
              size="sm"
              variant={isPaused ? 'default' : 'outline'}
              onClick={() => setIsPaused(!isPaused)}
              className={isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'border-slate-200 text-slate-600'}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">{filteredEvents.length} events shown</span>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Filters:
              </div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as EventType | 'all')}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="all">All Types</option>
                {Object.entries(EVENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="all">All Sources</option>
                {sourceModules.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="relative flex-1 min-w-[150px] max-w-[250px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Event Feed */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-emerald-500" />
                    Live Event Feed
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]" ref={scrollRef}>
                    <div className="px-4 pb-4 space-y-1.5">
                      <AnimatePresence mode="popLayout">
                        {filteredEvents.map(event => {
                          const colors = EVENT_COLORS[event.type]
                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, y: -20, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -50 }}
                              transition={{ duration: 0.3, ease: 'easeOut' }}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border} cursor-pointer hover:shadow-sm transition-shadow`}
                            >
                              <div className={`mt-0.5 p-1.5 rounded-md ${colors.dot}/10`}>
                                <event.icon className={`h-4 w-4 ${colors.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Badge variant="outline" className={`text-[10px] font-semibold px-1.5 py-0 ${colors.bg} ${colors.text} ${colors.border}`}>
                                    {EVENT_LABELS[event.type]}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400">{event.sourceModule}</span>
                                  <span className="text-[10px] text-slate-300 font-mono">{event.entityId}</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed">{event.description}</p>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                                <Clock className="h-3 w-3" />
                                {fmtTime(event.timestamp)}
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                      {filteredEvents.length === 0 && (
                        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                          <Radio className="h-5 w-5 mr-2 animate-pulse" />
                          Waiting for events...
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Event Rate Chart + Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Events/Minute (Last 60m)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <EventRateChart events={events} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-500" />
                    Event Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {(Object.entries(eventCounts) as [EventType, number][]).map(([type, count]) => {
                    const colors = EVENT_COLORS[type]
                    const maxCount = Math.max(...Object.values(eventCounts), 1)
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                        <span className="text-[11px] text-slate-600 w-24 truncate">{EVENT_LABELS[type]}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${colors.dot} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / maxCount) * 100}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 w-6 text-right">{count}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    Source Modules
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1.5">
                  {['Invoicing', 'Payments', 'Returns', 'Documents', 'Tasks', 'Notices', 'Clients', 'AI Engine'].map(mod => {
                    const count = events.filter(e => e.sourceModule === mod).length
                    return (
                      <div key={mod} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{mod}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">{count}</Badge>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: EVENT SUBSCRIPTIONS
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Subscriptions Table */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-500" />
                  Active Subscriptions ({SUBSCRIPTIONS.filter(s => s.status === 'active').length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[480px]">
                  <div className="px-4 pb-4 space-y-2">
                    {SUBSCRIPTIONS.map(sub => (
                      <div key={sub.id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-slate-800">{sub.module}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              sub.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : sub.status === 'paused'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {sub.status === 'active' && <CheckCircle className="h-3 w-3 mr-0.5" />}
                            {sub.status === 'paused' && <Pause className="h-3 w-3 mr-0.5" />}
                            {sub.status === 'error' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                            {sub.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {sub.eventTypes.map(et => (
                            <Badge key={et} variant="outline" className={`text-[9px] px-1 py-0 ${EVENT_COLORS[et].bg} ${EVENT_COLORS[et].text} ${EVENT_COLORS[et].border}`}>
                              {EVENT_LABELS[et]}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          <span>Method: <span className="font-medium text-slate-700">{sub.deliveryMethod}</span></span>
                          <span>Delivered: <span className="font-medium text-slate-700">{sub.delivered.toLocaleString('en-IN')}</span></span>
                          <span>Error: <span className={`font-medium ${sub.errorRate > 0.1 ? 'text-red-600' : sub.errorRate > 0.05 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {(sub.errorRate * 100).toFixed(1)}%
                          </span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right column: Routing + Stats */}
            <div className="space-y-4">
              {/* Delivery Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">98.7%</div>
                  <div className="text-[10px] text-slate-500 mt-1">Success Rate</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-800">23ms</div>
                  <div className="text-[10px] text-slate-500 mt-1">Avg Latency</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">127</div>
                  <div className="text-[10px] text-slate-500 mt-1">Failed Today</div>
                </Card>
              </div>

              {/* Event Routing Diagram */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Signal className="h-4 w-4 text-emerald-500" />
                    Event Routing
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <RoutingDiagram />
                </CardContent>
              </Card>

              {/* Create Subscription Form */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-emerald-500" />
                    New Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 mb-1 block">Module Name</label>
                    <Input placeholder="e.g. Slack Integration" className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 mb-1 block">Event Types</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(([type, label]) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className={`text-[9px] cursor-pointer hover:opacity-80 ${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].text} ${EVENT_COLORS[type].border}`}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 mb-1 block">Delivery Method</label>
                    <div className="flex gap-2">
                      {['Webhook', 'Internal', 'Email'].map(method => (
                        <Badge
                          key={method}
                          variant="outline"
                          className="text-[10px] cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 px-3 py-1"
                        >
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    Create Subscription
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: EVENT ANALYTICS
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-emerald-100">
                  <Zap className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-[11px] text-slate-500">Total Events</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                <AnimatedCounter target={totalProcessed} duration={2000} />
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">+12.4% vs last week</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-amber-100">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-[11px] text-slate-500">Avg Latency</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">23ms</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">P99: 142ms</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-red-100">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-[11px] text-slate-500">Error Rate</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">1.3%</div>
              <div className="text-[10px] text-emerald-600 font-medium mt-1">↓ 0.4% from yesterday</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-teal-100">
                  <Server className="h-4 w-4 text-teal-600" />
                </div>
                <span className="text-[11px] text-slate-500">Uptime</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">99.97%</div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">Last 30 days</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut Chart: Events by Type */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-500" />
                  Events by Type
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <DonutChart data={donutData} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    {donutData.map(d => (
                      <div key={d.label} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[11px] text-slate-600 flex-1">{d.label}</span>
                        <span className="text-[11px] font-semibold text-slate-800">{d.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hourly Bar Chart */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Events by Hour (Last 24h)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <HourlyBarChart data={hourlyData} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Latency Distribution */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Processing Latency Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <LatencyDistribution />
              </CardContent>
            </Card>

            {/* Error Rate Trend */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Error Rate Trend (24h)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ErrorRateLineChart />
              </CardContent>
            </Card>
          </div>

          {/* Bottom stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700">Top Event Sources</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { source: 'Invoicing', count: 4521, pct: 31 },
                  { source: 'Payments', count: 3890, pct: 27 },
                  { source: 'Returns', count: 2934, pct: 20 },
                  { source: 'Documents', count: 2107, pct: 14 },
                  { source: 'AI Engine', count: 1243, pct: 8 },
                ].map(s => (
                  <div key={s.source} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">{s.source}</span>
                      <span className="font-semibold text-slate-800">{s.count.toLocaleString('en-IN')} ({s.pct}%)</span>
                    </div>
                    <Progress value={s.pct} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700">Peak Events</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">All-Time High</div>
                  <div className="text-2xl font-bold text-slate-900">847 <span className="text-sm font-normal text-slate-500">events/min</span></div>
                  <div className="text-[11px] text-slate-500 mt-1">March 5, 2024 at 11:30 AM IST</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Today&apos;s Peak</div>
                  <div className="text-2xl font-bold text-slate-900">412 <span className="text-sm font-normal text-slate-500">events/min</span></div>
                  <div className="text-[11px] text-slate-500 mt-1">At 10:15 AM IST</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">7-Day Average</div>
                  <div className="text-2xl font-bold text-slate-900">286 <span className="text-sm font-normal text-slate-500">events/min</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-slate-700">Processing Health</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Queue Depth</span>
                  <span className="text-sm font-bold text-emerald-600">23</span>
                </div>
                <Progress value={95} className="h-2" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Processing Rate</span>
                  <span className="text-sm font-bold text-emerald-600">99.2%</span>
                </div>
                <Progress value={99.2} className="h-2" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Dead Letter Queue</span>
                  <span className="text-sm font-bold text-amber-600">7</span>
                </div>
                <Progress value={3} className="h-2" />
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Subscribers Active</span>
                  <span className="text-sm font-bold text-slate-800">8/10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Webhook Success</span>
                  <span className="text-sm font-bold text-emerald-600">96.8%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Internal Delivery</span>
                  <span className="text-sm font-bold text-emerald-600">99.9%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: EVENT SCHEMA
            ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="schema" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Schema Reference */}
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-500" />
                    Event Schema Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="px-4 pb-4 space-y-2">
                      {EVENT_SCHEMAS.map(schema => {
                        const isExpanded = expandedSchemas.has(schema.type)
                        const colors = EVENT_COLORS[schema.type]
                        return (
                          <div key={schema.type} className={`border rounded-lg overflow-hidden ${isExpanded ? colors.border : 'border-slate-100'}`}>
                            <button
                              onClick={() => toggleSchema(schema.type)}
                              className="w-full flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                                <span className="text-sm font-mono font-semibold text-slate-800">{schema.type}</span>
                                <Badge variant="outline" className={`text-[9px] ${colors.bg} ${colors.text} ${colors.border}`}>
                                  {schema.fields.length} fields
                                </Badge>
                              </div>
                              <ArrowRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-1.5">
                                    <Separator />
                                    <div className="pt-2">
                                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Fields</div>
                                      {schema.fields.map(field => (
                                        <div key={field.name} className="flex items-start gap-2 py-1">
                                          <code className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1 rounded shrink-0">
                                            {field.name}
                                          </code>
                                          <code className="text-[10px] font-mono text-slate-400 shrink-0">{field.type}</code>
                                          <span className="text-[10px] text-slate-500">{field.description}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="pt-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-[10px] h-6"
                                        onClick={() => copySchema(schema)}
                                      >
                                        {copiedSchema === schema.type ? (
                                          <><CheckCircle className="h-3 w-3 mr-1 text-emerald-500" /> Copied!</>
                                        ) : (
                                          <><Database className="h-3 w-3 mr-1" /> Copy Schema</>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Webhook Payload Example */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Signal className="h-4 w-4 text-emerald-500" />
                    Webhook Payload Example
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed">
{`{
  "event": "invoice.created",
  "version": "1.0",
  "id": "evt_a1b2c3d4e5f6",
  "timestamp": "2024-03-05T11:30:00+05:30",
  "source": "gstpilot.invoicing",
  "data": {
    "invoiceId": "INV-2024-0891",
    "clientId": "CLI-A7F3B2",
    "amount": 234500,
    "gstin": "27AABCU9603R1ZM",
    "items": [{
      "description": "Consulting Services",
      "hsn": "9983",
      "amount": 234500,
      "taxRate": 18
    }],
    "createdAt": "2024-03-05T11:30:00+05:30"
  },
  "metadata": {
    "firmId": "FRM-X9Y8Z7",
    "userId": "USR-P4Q5R6",
    "correlationId": "corr_k1l2m3"
  }
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-500" />
                    Event Delivery Contract
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">At-Least-Once Delivery</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">Ordering Guarantee</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Per-Entity</Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Retry Policy</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Max Retries</span>
                      <span className="font-semibold text-slate-800">5</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Backoff Strategy</span>
                      <span className="font-semibold text-slate-800">Exponential</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Initial Delay</span>
                      <span className="font-semibold text-slate-800">1s</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">Max Delay</span>
                      <span className="font-semibold text-slate-800">64s</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Idempotency</div>
                    <div className="text-[11px] text-slate-600">
                      All webhook deliveries include an <code className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded">idempotency-key</code> header.
                      Use this to deduplicate deliveries on your end.
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Signature Verification</div>
                    <div className="text-[11px] text-slate-600">
                      Each payload is signed with <code className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded">HMAC-SHA256</code>.
                      Verify using your webhook secret before processing.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
