'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Network, Search, ZoomIn, ZoomOut, Maximize2, Layers,
  Users, FileText, FileScan, ArrowRightLeft, Building2,
  CircleDot, ChevronRight, AlertTriangle, Sparkles,
  Link2, Unlink, Eye, Database, IndianRupee, Clock,
  TrendingUp, Shield, Bot, Activity, Radio, Target,
  X, Info, CheckCircle, AlertOctagon, Lightbulb,
  Share2, GitBranch,
} from 'lucide-react'
import {
  useFireClients, useFireInvoices, useFireReturns,
  useFireDocuments, useFireReconciliations, useFireActivities,
} from '@/hooks/use-firestore'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(n: number): string {
  const s = Math.abs(Math.round(n)).toString()
  let result = ''
  let count = 0
  for (let i = s.length - 1; i >= 0; i--) {
    result = s[i] + result
    count++
    if (count === 3 && i > 0) { result = ',' + result; count = 0 }
    else if (count > 3 && count % 2 === 1 && i > 0) { result = ',' + result }
  }
  return '₹' + (n < 0 ? '-' : '') + result
}

function formatDate(iso: string | null | unknown): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso as string)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '—' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY TYPES & COLORS
// ═══════════════════════════════════════════════════════════════════════════════

type EntityType =
  | 'organization' | 'firm' | 'client' | 'vendor' | 'employee'
  | 'invoice' | 'payment' | 'bank_account' | 'gst_return' | 'document'
  | 'task' | 'notice' | 'approval'

interface EntityColor {
  bg: string
  text: string
  border: string
  hex: string
  dot: string
}

const ENTITY_COLORS: Record<EntityType, EntityColor> = {
  organization: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', hex: '#10b981', dot: 'bg-emerald-500' },
  firm: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', hex: '#64748b', dot: 'bg-slate-500' },
  client: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', hex: '#f59e0b', dot: 'bg-amber-500' },
  vendor: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', hex: '#8b5cf6', dot: 'bg-purple-500' },
  employee: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', hex: '#06b6d4', dot: 'bg-cyan-500' },
  invoice: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', hex: '#f43f5e', dot: 'bg-rose-500' },
  payment: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', hex: '#22c55e', dot: 'bg-green-500' },
  bank_account: { bg: 'bg-blue-gray-100', text: 'text-slate-600', border: 'border-slate-400', hex: '#78909c', dot: 'bg-slate-400' },
  gst_return: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', hex: '#f97316', dot: 'bg-orange-500' },
  document: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', hex: '#14b8a6', dot: 'bg-teal-500' },
  task: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', hex: '#eab308', dot: 'bg-yellow-500' },
  notice: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', hex: '#ef4444', dot: 'bg-red-500' },
  approval: { bg: 'bg-gray-800', text: 'text-gray-100', border: 'border-gray-600', hex: '#1f2937', dot: 'bg-gray-700' },
}

const ENTITY_LABELS: Record<EntityType, string> = {
  organization: 'Organizations',
  firm: 'Firms',
  client: 'Clients',
  vendor: 'Vendors',
  employee: 'Employees',
  invoice: 'Invoices',
  payment: 'Payments',
  bank_account: 'Bank Accounts',
  gst_return: 'GST Returns',
  document: 'Documents',
  task: 'Tasks',
  notice: 'Notices',
  approval: 'Approvals',
}

const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  organization: Building2,
  firm: Building2,
  client: Users,
  vendor: Share2,
  employee: Users,
  invoice: FileScan,
  payment: IndianRupee,
  bank_account: Database,
  gst_return: FileText,
  document: FileText,
  task: CheckCircle,
  notice: AlertTriangle,
  approval: Shield,
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GraphNode {
  id: string
  type: EntityType
  label: string
  subtitle: string
  x: number
  y: number
  connections: number
  status: string
  lastUpdated: string
  metadata: Record<string, string | number>
}

interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  type: 'belongs_to' | 'has_invoice' | 'has_return' | 'has_document' | 'has_payment' | 'references' | 'notifies' | 'assigned_to'
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateDemoData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const clients = [
    { id: 'c1', name: 'ABC Traders', gstin: '27AABCT1234F1ZH', status: 'active' },
    { id: 'c2', name: 'XYZ Industries', gstin: '27AABCX5678G2ZK', status: 'active' },
    { id: 'c3', name: 'PQR Exports Pvt Ltd', gstin: '06AABCP9012H3ZM', status: 'active' },
    { id: 'c4', name: 'LMN Enterprises', gstin: '09AABCL3456I4ZN', status: 'inactive' },
    { id: 'c5', name: 'DEF Constructions', gstin: '33AABCD7890J5ZO', status: 'active' },
    { id: 'c6', name: 'GHI Logistics', gstin: '27AABCG2345K6ZP', status: 'active' },
    { id: 'c7', name: 'JKL Pharma Ltd', gstin: '27AABCJ6789L7ZQ', status: 'active' },
    { id: 'c8', name: 'MNO Textiles', gstin: '24AABCM0123M8ZR', status: 'active' },
    { id: 'c9', name: 'STU Chemicals', gstin: '27AABCS4567N9ZS', status: 'active' },
    { id: 'c10', name: 'VWX Foods Pvt Ltd', gstin: '27AABCV8901O0ZT', status: 'active' },
    { id: 'c11', name: 'Rajesh Kumar & Co', gstin: '27AABCR2345P1ZU', status: 'active' },
    { id: 'c12', name: 'Patel Brothers', gstin: '24AABCP6789Q2ZV', status: 'active' },
    { id: 'c13', name: 'Sharma Associates', gstin: '09AABCS0123R3ZW', status: 'active' },
    { id: 'c14', name: 'Maharashtra Traders', gstin: '27AABCM4567S4ZX', status: 'active' },
    { id: 'c15', name: 'Singh & Sons', gstin: '06AABCS8901T5ZY', status: 'active' },
  ]

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Organization node
  nodes.push({
    id: 'org1', type: 'organization', label: 'GSTPilot Corp',
    subtitle: 'Enterprise Plan', x: 500, y: 60, connections: 3,
    status: 'active', lastUpdated: '2026-03-03T10:00:00Z',
    metadata: { firms: 3, plan: 'enterprise' },
  })

  // Firm node
  nodes.push({
    id: 'firm1', type: 'firm', label: 'Sharma & Associates',
    subtitle: 'CA Firm — Mumbai', x: 500, y: 160, connections: 22,
    status: 'active', lastUpdated: '2026-03-03T10:00:00Z',
    metadata: { clients: 15, gstin: '27AABCS1234F1ZH' },
  })

  edges.push({ id: 'e-org-firm', source: 'org1', target: 'firm1', label: 'owns', type: 'belongs_to' })

  // Client nodes
  const angleStep = (2 * Math.PI) / clients.length
  const radius = 220
  clients.forEach((c, i) => {
    const angle = angleStep * i - Math.PI / 2
    const x = 500 + radius * Math.cos(angle)
    const y = 380 + radius * Math.sin(angle)
    nodes.push({
      id: c.id, type: 'client', label: c.name,
      subtitle: c.gstin, x, y,
      connections: Math.floor(Math.random() * 5) + 2,
      status: c.status, lastUpdated: '2026-03-02T14:30:00Z',
      metadata: { gstin: c.gstin, invoices: Math.floor(Math.random() * 10) + 1 },
    })
    edges.push({ id: `e-firm-${c.id}`, source: 'firm1', target: c.id, label: 'manages', type: 'belongs_to' })
  })

  // Invoice nodes
  const invoices = [
    { id: 'inv1', num: 'INV-2026-001', clientId: 'c1', amt: 2450000, status: 'filed' },
    { id: 'inv2', num: 'INV-2026-002', clientId: 'c2', amt: 1870000, status: 'pending' },
    { id: 'inv3', num: 'INV-2026-003', clientId: 'c3', amt: 3210000, status: 'filed' },
    { id: 'inv4', num: 'INV-2026-004', clientId: 'c1', amt: 890000, status: 'reviewed' },
    { id: 'inv5', num: 'INV-2026-005', clientId: 'c5', amt: 1560000, status: 'filed' },
    { id: 'inv6', num: 'INV-2026-006', clientId: 'c6', amt: 4230000, status: 'draft' },
    { id: 'inv7', num: 'INV-2026-007', clientId: 'c7', amt: 670000, status: 'filed' },
    { id: 'inv8', num: 'INV-2026-008', clientId: 'c8', amt: 2100000, status: 'pending' },
    { id: 'inv9', num: 'INV-2026-009', clientId: 'c9', amt: 945000, status: 'filed' },
    { id: 'inv10', num: 'INV-2026-010', clientId: 'c10', amt: 1780000, status: 'reviewed' },
    { id: 'inv11', num: 'INV-2026-011', clientId: 'c2', amt: 3250000, status: 'filed' },
    { id: 'inv12', num: 'INV-2026-012', clientId: 'c11', amt: 1100000, status: 'pending' },
    { id: 'inv13', num: 'INV-2026-013', clientId: 'c12', amt: 560000, status: 'filed' },
    { id: 'inv14', num: 'INV-2026-014', clientId: 'c13', amt: 2900000, status: 'draft' },
    { id: 'inv15', num: 'INV-2026-015', clientId: 'c14', amt: 1450000, status: 'filed' },
    { id: 'inv16', num: 'INV-2026-016', clientId: 'c15', amt: 780000, status: 'reviewed' },
    { id: 'inv17', num: 'INV-2026-017', clientId: 'c4', amt: 1890000, status: 'pending' },
    { id: 'inv18', num: 'INV-2026-018', clientId: 'c5', amt: 3100000, status: 'filed' },
    { id: 'inv19', num: 'INV-2026-019', clientId: 'c6', amt: 430000, status: 'filed' },
    { id: 'inv20', num: 'INV-2026-020', clientId: 'c3', amt: 2750000, status: 'pending' },
    { id: 'inv21', num: 'INV-2026-021', clientId: 'c7', amt: 1620000, status: 'filed' },
    { id: 'inv22', num: 'INV-2026-022', clientId: 'c8', amt: 980000, status: 'reviewed' },
    { id: 'inv23', num: 'INV-2026-023', clientId: 'c9', amt: 4500000, status: 'filed' },
    { id: 'inv24', num: 'INV-2026-024', clientId: 'c10', amt: 1340000, status: 'draft' },
    { id: 'inv25', num: 'INV-2026-025', clientId: 'c1', amt: 890000, status: 'filed' },
  ]

  const invAngleStep = (2 * Math.PI) / invoices.length
  const invRadius = 160
  invoices.forEach((inv, i) => {
    const angle = invAngleStep * i - Math.PI / 2
    const parentNode = nodes.find(n => n.id === inv.clientId)
    const cx = parentNode ? parentNode.x : 500
    const cy = parentNode ? parentNode.y : 380
    nodes.push({
      id: inv.id, type: 'invoice', label: inv.num,
      subtitle: formatINR(inv.amt), x: cx + invRadius * 0.4 * Math.cos(angle), y: cy + invRadius * 0.4 * Math.sin(angle),
      connections: 2, status: inv.status, lastUpdated: '2026-03-01T09:15:00Z',
      metadata: { amount: inv.amt, client: inv.clientId },
    })
    edges.push({ id: `e-${inv.clientId}-${inv.id}`, source: inv.clientId, target: inv.id, label: 'has invoice', type: 'has_invoice' })
  })

  // Return nodes
  const returns = [
    { id: 'ret1', type: 'GSTR-1' as const, period: '02/2026', clientId: 'c1', status: 'filed' },
    { id: 'ret2', type: 'GSTR-3B' as const, period: '02/2026', clientId: 'c1', status: 'filed' },
    { id: 'ret3', type: 'GSTR-1' as const, period: '02/2026', clientId: 'c2', status: 'pending' },
    { id: 'ret4', type: 'GSTR-3B' as const, period: '02/2026', clientId: 'c3', status: 'filed' },
    { id: 'ret5', type: 'GSTR-1' as const, period: '02/2026', clientId: 'c5', status: 'draft' },
    { id: 'ret6', type: 'GSTR-3B' as const, period: '02/2026', clientId: 'c6', status: 'validated' },
    { id: 'ret7', type: 'GSTR-1' as const, period: '02/2026', clientId: 'c7', status: 'filed' },
    { id: 'ret8', type: 'GSTR-3B' as const, period: '02/2026', clientId: 'c8', status: 'reviewed' },
    { id: 'ret9', type: 'GSTR-1' as const, period: '01/2026', clientId: 'c9', status: 'filed' },
    { id: 'ret10', type: 'GSTR-1' as const, period: '02/2026', clientId: 'c10', status: 'pending' },
  ]

  returns.forEach((ret, i) => {
    const parentNode = nodes.find(n => n.id === ret.clientId)
    const cx = parentNode ? parentNode.x : 500
    const cy = parentNode ? parentNode.y : 380
    nodes.push({
      id: ret.id, type: 'gst_return', label: `${ret.type} — ${ret.period}`,
      subtitle: ret.status, x: cx + 60 + i * 8, y: cy - 80 - i * 5,
      connections: 1, status: ret.status, lastUpdated: '2026-02-28T16:00:00Z',
      metadata: { returnType: ret.type, period: ret.period },
    })
    edges.push({ id: `e-${ret.clientId}-${ret.id}`, source: ret.clientId, target: ret.id, label: 'has return', type: 'has_return' })
  })

  // Vendor nodes
  const vendors = [
    { id: 'v1', name: 'Krishna Suppliers', gstin: '27AABCK1111A1ZA' },
    { id: 'v2', name: 'Mehta Distributors', gstin: '06AABCM2222B2ZB' },
    { id: 'v3', name: 'Shah & Co Traders', gstin: '24AABCS3333C3ZC' },
    { id: 'v4', name: 'Patel Wholesale Mart', gstin: '09AABCP4444D4ZD' },
    { id: 'v5', name: 'Gupta Raw Materials', gstin: '33AABCG5555E5ZE' },
  ]

  vendors.forEach((v) => {
    nodes.push({
      id: v.id, type: 'vendor', label: v.name,
      subtitle: v.gstin, x: 100 + Math.random() * 200, y: 500 + Math.random() * 150,
      connections: Math.floor(Math.random() * 4) + 1,
      status: 'active', lastUpdated: '2026-03-01T11:00:00Z',
      metadata: { gstin: v.gstin },
    })
  })

  // Connect vendors to invoices
  edges.push({ id: 'e-v1-inv3', source: 'v1', target: 'inv3', label: 'supplied', type: 'references' })
  edges.push({ id: 'e-v2-inv6', source: 'v2', target: 'inv6', label: 'supplied', type: 'references' })
  edges.push({ id: 'e-v3-inv9', source: 'v3', target: 'inv9', label: 'supplied', type: 'references' })
  edges.push({ id: 'e-v4-inv14', source: 'v4', target: 'inv14', label: 'supplied', type: 'references' })
  edges.push({ id: 'e-v5-inv20', source: 'v5', target: 'inv20', label: 'supplied', type: 'references' })

  // Payment nodes
  const payments = [
    { id: 'pay1', label: 'PAY-2026-001', amt: 1200000, invoiceId: 'inv1' },
    { id: 'pay2', label: 'PAY-2026-002', amt: 890000, invoiceId: 'inv3' },
    { id: 'pay3', label: 'PAY-2026-003', amt: 2340000, invoiceId: 'inv5' },
  ]

  payments.forEach((p) => {
    nodes.push({
      id: p.id, type: 'payment', label: p.label,
      subtitle: formatINR(p.amt), x: 750 + Math.random() * 100, y: 450 + Math.random() * 100,
      connections: 1, status: 'completed', lastUpdated: '2026-02-28T12:00:00Z',
      metadata: { amount: p.amt },
    })
    edges.push({ id: `e-${p.invoiceId}-${p.id}`, source: p.invoiceId, target: p.id, label: 'paid by', type: 'has_payment' })
  })

  // Bank account nodes
  const banks = [
    { id: 'bank1', label: 'HDFC Current A/C', bank: 'HDFC' },
    { id: 'bank2', label: 'SBI Business A/C', bank: 'SBI' },
    { id: 'bank3', label: 'ICICI Corporate A/C', bank: 'ICICI' },
  ]

  banks.forEach((b) => {
    nodes.push({
      id: b.id, type: 'bank_account', label: b.label,
      subtitle: b.bank, x: 850, y: 200 + Math.random() * 200,
      connections: 2, status: 'active', lastUpdated: '2026-03-03T08:00:00Z',
      metadata: { bank: b.bank },
    })
  })

  edges.push({ id: 'e-pay1-bank1', source: 'pay1', target: 'bank1', label: 'deposited in', type: 'references' })
  edges.push({ id: 'e-pay2-bank2', source: 'pay2', target: 'bank2', label: 'deposited in', type: 'references' })
  edges.push({ id: 'e-pay3-bank3', source: 'pay3', target: 'bank3', label: 'deposited in', type: 'references' })

  // Document nodes
  const docs = [
    { id: 'doc1', label: 'Purchase Register Feb 2026', clientId: 'c1' },
    { id: 'doc2', label: 'Sales Register Feb 2026', clientId: 'c2' },
    { id: 'doc3', label: 'GSTR-2B Download Feb 2026', clientId: 'c3' },
  ]

  docs.forEach((d) => {
    nodes.push({
      id: d.id, type: 'document', label: d.label,
      subtitle: 'Extracted', x: 150, y: 250 + Math.random() * 100,
      connections: 1, status: 'extracted', lastUpdated: '2026-03-02T10:00:00Z',
      metadata: { clientId: d.clientId },
    })
    edges.push({ id: `e-${d.clientId}-${d.id}`, source: d.clientId, target: d.id, label: 'uploaded', type: 'has_document' })
  })

  // Task, Notice, Approval nodes
  nodes.push({
    id: 'task1', type: 'task', label: 'File GSTR-1 for ABC Traders',
    subtitle: 'Due: 11/03/2026', x: 300, y: 620, connections: 1,
    status: 'pending', lastUpdated: '2026-03-03T07:00:00Z',
    metadata: { priority: 'high' },
  })
  edges.push({ id: 'e-c1-task1', source: 'c1', target: 'task1', label: 'assigned', type: 'assigned_to' })

  nodes.push({
    id: 'notice1', type: 'notice', label: 'ASN-2026-045',
    subtitle: 'ITC Mismatch — ₹2,34,500', x: 700, y: 620, connections: 1,
    status: 'open', lastUpdated: '2026-02-27T15:00:00Z',
    metadata: { severity: 'high' },
  })
  edges.push({ id: 'e-c2-notice1', source: 'c2', target: 'notice1', label: 'received', type: 'notifies' })

  nodes.push({
    id: 'app1', type: 'approval', label: 'GSTR-3B Filing Approval',
    subtitle: 'Awaiting CA Sign-off', x: 500, y: 680, connections: 1,
    status: 'pending', lastUpdated: '2026-03-03T06:00:00Z',
    metadata: { requestedBy: 'Staff' },
  })
  edges.push({ id: 'e-ret2-app1', source: 'ret2', target: 'app1', label: 'requires approval', type: 'assigned_to' })

  // Recalculate connections count
  const connectionCounts: Record<string, number> = {}
  edges.forEach(e => {
    connectionCounts[e.source] = (connectionCounts[e.source] || 0) + 1
    connectionCounts[e.target] = (connectionCounts[e.target] || 0) + 1
  })
  nodes.forEach(n => {
    n.connections = connectionCounts[n.id] || 0
  })

  return { nodes, edges }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE FORCE-DIRECTED LAYOUT (no external libs)
// ═══════════════════════════════════════════════════════════════════════════════

function applyForceLayout(nodes: GraphNode[], edges: GraphEdge[], iterations: number = 60): GraphNode[] {
  const positioned = nodes.map(n => ({ ...n }))
  const width = 1000
  const height = 700

  // Initialize positions if they're clustered
  positioned.forEach((n, i) => {
    if (n.x === 0 && n.y === 0) {
      n.x = width / 2 + (Math.random() - 0.5) * 400
      n.y = height / 2 + (Math.random() - 0.5) * 300
    }
  })

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - (iter / iterations)
    const k = Math.sqrt((width * height) / positioned.length) * 0.8

    // Repulsive forces between all nodes
    const dx: Record<string, number> = {}
    const dy: Record<string, number> = {}
    positioned.forEach(n => { dx[n.id] = 0; dy[n.id] = 0 })

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const ni = positioned[i]
        const nj = positioned[j]
        let diffX = ni.x - nj.x
        let diffY = ni.y - nj.y
        const dist = Math.max(1, Math.sqrt(diffX * diffX + diffY * diffY))
        const force = (k * k) / dist
        diffX = (diffX / dist) * force * temperature
        diffY = (diffY / dist) * force * temperature
        dx[ni.id] += diffX
        dy[ni.id] += diffY
        dx[nj.id] -= diffX
        dy[nj.id] -= diffY
      }
    }

    // Attractive forces for connected nodes
    edges.forEach(e => {
      const source = positioned.find(n => n.id === e.source)
      const target = positioned.find(n => n.id === e.target)
      if (!source || !target) return
      let diffX = source.x - target.x
      let diffY = source.y - target.y
      const dist = Math.max(1, Math.sqrt(diffX * diffX + diffY * diffY))
      const force = (dist * dist) / k
      diffX = (diffX / dist) * force * temperature * 0.3
      diffY = (diffY / dist) * force * temperature * 0.3
      dx[source.id] -= diffX
      dy[source.id] -= diffY
      dx[target.id] += diffX
      dy[target.id] += diffY
    })

    // Apply forces
    positioned.forEach(n => {
      const disp = Math.sqrt(dx[n.id] * dx[n.id] + dy[n.id] * dy[n.id])
      if (disp > 0) {
        n.x += (dx[n.id] / disp) * Math.min(disp, 10 * temperature)
        n.y += (dy[n.id] / disp) * Math.min(disp, 10 * temperature)
      }
      // Keep in bounds
      n.x = Math.max(40, Math.min(width - 40, n.x))
      n.y = Math.max(40, Math.min(height - 40, n.y))
    })
  }

  return positioned
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD GRAPH FROM FIRESTORE DATA
// ═══════════════════════════════════════════════════════════════════════════════

function buildGraphFromFirestore(
  clients: Array<{ id: string; tradeName?: string; gstin?: string; status?: string; healthScore?: number; invoiceCount?: number; updatedAt?: unknown }>,
  invoices: Array<{ id: string; invoiceNumber?: string; clientId?: string; totalAmount?: number; status?: string; updatedAt?: unknown }>,
  returns: Array<{ id: string; returnType?: string; period?: string; clientId?: string; status?: string; updatedAt?: unknown }>,
  documents: Array<{ id: string; fileName?: string; clientId?: string; status?: string; updatedAt?: unknown }>,
  reconciliations: Array<{ id: string; sources?: string; clientId?: string; status?: string; updatedAt?: unknown }>,
  activities: Array<{ id: string; type?: string; title?: string; clientId?: string; createdAt?: unknown }>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (clients.length === 0 && invoices.length === 0) {
    return generateDemoData()
  }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  let nodeIdx = 0

  // Firm node
  nodes.push({
    id: 'firm1', type: 'firm', label: 'Your Firm',
    subtitle: 'CA Practice', x: 500, y: 80, connections: 0,
    status: 'active', lastUpdated: new Date().toISOString(),
    metadata: {},
  })

  // Client nodes
  clients.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(clients.length, 1) - Math.PI / 2
    const r = 200
    nodes.push({
      id: `client-${c.id}`, type: 'client', label: c.tradeName || 'Unknown Client',
      subtitle: c.gstin || '—', x: 500 + r * Math.cos(angle), y: 300 + r * Math.sin(angle),
      connections: 0, status: c.status || 'active', lastUpdated: c.updatedAt ? String(c.updatedAt) : new Date().toISOString(),
      metadata: { healthScore: c.healthScore || 0, invoiceCount: c.invoiceCount || 0 },
    })
    edges.push({ id: `e-firm-c${c.id}`, source: 'firm1', target: `client-${c.id}`, label: 'manages', type: 'belongs_to' })
  })

  // Invoice nodes
  invoices.forEach((inv, i) => {
    const clientId = inv.clientId ? `client-${inv.clientId}` : null
    const parentNode = clientId ? nodes.find(n => n.id === clientId) : null
    const cx = parentNode ? parentNode.x : 500
    const cy = parentNode ? parentNode.y : 400
    const angle = (2 * Math.PI * i) / Math.max(invoices.length, 1)
    const r = 80

    nodes.push({
      id: `inv-${inv.id}`, type: 'invoice', label: inv.invoiceNumber || `INV-${i + 1}`,
      subtitle: formatINR(inv.totalAmount || 0), x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle),
      connections: 0, status: inv.status || 'draft', lastUpdated: inv.updatedAt ? String(inv.updatedAt) : new Date().toISOString(),
      metadata: { amount: inv.totalAmount || 0 },
    })
    if (clientId) {
      edges.push({ id: `e-c${inv.clientId}-i${inv.id}`, source: clientId, target: `inv-${inv.id}`, label: 'has invoice', type: 'has_invoice' })
    }
  })

  // Return nodes
  returns.forEach((ret, i) => {
    const clientId = ret.clientId ? `client-${ret.clientId}` : null
    const parentNode = clientId ? nodes.find(n => n.id === clientId) : null
    const cx = parentNode ? parentNode.x : 500
    const cy = parentNode ? parentNode.y : 400

    nodes.push({
      id: `ret-${ret.id}`, type: 'gst_return', label: `${ret.returnType || 'GSTR-1'} — ${ret.period || '—'}`,
      subtitle: ret.status || 'draft', x: cx + 60 + (i % 3) * 40, y: cy - 90 - (i % 2) * 50,
      connections: 0, status: ret.status || 'draft', lastUpdated: ret.updatedAt ? String(ret.updatedAt) : new Date().toISOString(),
      metadata: { returnType: ret.returnType, period: ret.period },
    })
    if (clientId) {
      edges.push({ id: `e-c${ret.clientId}-r${ret.id}`, source: clientId, target: `ret-${ret.id}`, label: 'has return', type: 'has_return' })
    }
  })

  // Document nodes
  documents.forEach((doc, i) => {
    const clientId = doc.clientId ? `client-${doc.clientId}` : null
    nodes.push({
      id: `doc-${doc.id}`, type: 'document', label: doc.fileName || `Document ${i + 1}`,
      subtitle: doc.status || 'uploaded', x: 80 + (i % 4) * 100, y: 550 + Math.floor(i / 4) * 60,
      connections: 0, status: doc.status || 'uploaded', lastUpdated: doc.updatedAt ? String(doc.updatedAt) : new Date().toISOString(),
      metadata: {},
    })
    if (clientId) {
      edges.push({ id: `e-c${doc.clientId}-d${doc.id}`, source: clientId, target: `doc-${doc.id}`, label: 'uploaded', type: 'has_document' })
    }
  })

  // Recalculate connections
  const connectionCounts: Record<string, number> = {}
  edges.forEach(e => {
    connectionCounts[e.source] = (connectionCounts[e.source] || 0) + 1
    connectionCounts[e.target] = (connectionCounts[e.target] || 0) + 1
  })
  nodes.forEach(n => {
    n.connections = connectionCounts[n.id] || 0
  })

  return { nodes, edges }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BusinessGraphPage() {
  const [activeTab, setActiveTab] = useState('graph')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Firestore hooks
  const { data: fireClients } = useFireClients()
  const { data: fireInvoices } = useFireInvoices()
  const { data: fireReturns } = useFireReturns()
  const { data: fireDocuments } = useFireDocuments()
  const { data: fireReconciliations } = useFireReconciliations()
  const { data: fireActivities } = useFireActivities()

  // Build graph data
  const graphData = useMemo(() => {
    const hasData = fireClients.length > 0 || fireInvoices.length > 0
    if (!hasData) {
      const demo = generateDemoData()
      return { ...demo, nodes: applyForceLayout(demo.nodes, demo.edges, 40) }
    }
    const built = buildGraphFromFirestore(
      fireClients as any[],
      fireInvoices as any[],
      fireReturns as any[],
      fireDocuments as any[],
      fireReconciliations as any[],
      fireActivities as any[],
    )
    return { ...built, nodes: applyForceLayout(built.nodes, built.edges, 40) }
  }, [fireClients, fireInvoices, fireReturns, fireDocuments, fireReconciliations, fireActivities])

  const { nodes, edges } = graphData

  // Selected node detail
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId])
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return []
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
  }, [edges, selectedNodeId])
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    selectedNodeEdges.forEach(e => {
      ids.add(e.source)
      ids.add(e.target)
    })
    ids.delete(selectedNodeId || '')
    return ids
  }, [selectedNodeEdges, selectedNodeId])

  // Stats
  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    nodes.forEach(n => {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1
    })
    const totalEntities = nodes.length
    const totalConnections = edges.length
    const connectedEntities = new Set<string>()
    edges.forEach(e => { connectedEntities.add(e.source); connectedEntities.add(e.target) })
    const coverage = totalEntities > 0 ? Math.round((connectedEntities.size / totalEntities) * 100) : 0
    const orphanCount = nodes.filter(n => n.connections === 0).length
    const mostConnected = nodes.reduce((max, n) => n.connections > max.connections ? n : max, nodes[0])
    const qualityScore = totalEntities > 0 ? Math.round(((totalEntities - orphanCount) / totalEntities) * 100) : 0

    return { totalEntities, totalConnections, coverage, qualityScore, typeCounts, orphanCount, mostConnected }
  }, [nodes, edges])

  // Filtered entities for explorer
  const filteredEntities = useMemo(() => {
    let filtered = nodes
    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(n =>
        n.label.toLowerCase().includes(q) ||
        n.subtitle.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => b.connections - a.connections)
  }, [nodes, filterType, searchQuery])

  // Graph Intelligence computations
  const intelligence = useMemo(() => {
    // Clusters: group clients by connection patterns
    const clientNodes = nodes.filter(n => n.type === 'client')
    const clusters: Array<{ name: string; entities: GraphNode[]; color: string }> = []

    // Active clients cluster
    const activeClients = clientNodes.filter(c => c.status === 'active')
    if (activeClients.length > 0) {
      clusters.push({ name: 'Active Client Network', entities: activeClients, color: '#10b981' })
    }

    // Vendor network
    const vendorNodes = nodes.filter(n => n.type === 'vendor')
    if (vendorNodes.length > 0) {
      clusters.push({ name: 'Vendor Supply Chain', entities: vendorNodes, color: '#8b5cf6' })
    }

    // Invoice cluster
    const invoiceNodes = nodes.filter(n => n.type === 'invoice')
    if (invoiceNodes.length > 3) {
      clusters.push({ name: 'Invoice Processing Hub', entities: invoiceNodes.slice(0, 8), color: '#f43f5e' })
    }

    // Anomalies
    const anomalies: Array<{ type: 'warning' | 'error' | 'info'; title: string; description: string; entityId?: string }> = []

    const orphans = nodes.filter(n => n.connections === 0)
    orphans.forEach(n => {
      anomalies.push({
        type: 'warning',
        title: `Orphan Entity: ${n.label}`,
        description: `${ENTITY_LABELS[n.type]} "${n.label}" has no connections in the graph. Consider linking it to related entities.`,
        entityId: n.id,
      })
    })

    // Check for clients without returns
    clientNodes.forEach(c => {
      const hasReturns = edges.some(e => e.source === c.id && e.type === 'has_return')
      if (!hasReturns && c.status === 'active') {
        anomalies.push({
          type: 'error',
          title: `Missing Returns: ${c.label}`,
          description: `Active client "${c.label}" has no GST returns linked. Filing compliance at risk.`,
          entityId: c.id,
        })
      }
    })

    // Check for invoices without payments
    invoiceNodes.forEach(inv => {
      const hasPayment = edges.some(e => e.source === inv.id && e.type === 'has_payment')
      if (!hasPayment && inv.status === 'filed') {
        anomalies.push({
          type: 'info',
          title: `Unpaid Invoice: ${inv.label}`,
          description: `Invoice "${inv.label}" is filed but no payment is recorded. Verify payment status.`,
          entityId: inv.id,
        })
      }
    })

    // Recommendations
    const recommendations: Array<{ title: string; description: string; confidence: number; action: string }> = []

    orphans.forEach(n => {
      recommendations.push({
        title: `Connect ${n.label}`,
        description: `Link ${ENTITY_LABELS[n.type].toLowerCase()} "${n.label}" to its parent entity to improve graph coverage.`,
        confidence: 85 + Math.floor(Math.random() * 10),
        action: 'Create Link',
      })
    })

    if (vendorNodes.length > 0) {
      recommendations.push({
        title: 'Map Vendor → Purchase Register',
        description: `${vendorNodes.length} vendors are not connected to the purchase register. Auto-link for better ITC tracking.`,
        confidence: 92,
        action: 'Auto-Link Vendors',
      })
    }

    const pendingNotices = nodes.filter(n => n.type === 'notice' && n.status === 'open')
    if (pendingNotices.length > 0) {
      recommendations.push({
        title: 'Link Notices to Clients',
        description: `${pendingNotices.length} open notices need client association for timely resolution.`,
        confidence: 88,
        action: 'Link Notices',
      })
    }

    const draftReturns = nodes.filter(n => n.type === 'gst_return' && (n.status === 'draft' || n.status === 'pending'))
    if (draftReturns.length > 0) {
      recommendations.push({
        title: 'Accelerate Return Filing',
        description: `${draftReturns.length} returns are in draft/pending status. Prioritize filing to avoid penalties.`,
        confidence: 95,
        action: 'View Returns',
      })
    }

    return { clusters, anomalies, recommendations }
  }, [nodes, edges])

  // SVG drag for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleZoomIn = () => setZoom(z => Math.min(2.5, z + 0.2))
  const handleZoomOut = () => setZoom(z => Math.max(0.3, z - 0.2))
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50">
      <motion.div {...fadeUp} className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Business Graph Engine</h1>
              <p className="text-xs text-slate-500">Visualize how every business entity connects</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 bg-emerald-50">
            <Radio className="h-3 w-3 animate-pulse" />
            Live Graph · {stats.totalEntities} entities
          </Badge>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Entities', value: stats.totalEntities, icon: Database, color: '#10b981' },
            { label: 'Total Connections', value: stats.totalConnections, icon: Link2, color: '#f59e0b' },
            { label: 'Graph Coverage', value: stats.coverage + '%', icon: Eye, color: '#06b6d4' },
            { label: 'Data Quality', value: stats.qualityScore + '%', icon: Shield, color: '#8b5cf6' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                    <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
                    <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm h-10 p-1">
            <TabsTrigger value="graph" className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Network className="h-3.5 w-3.5" /> Graph Visualization
            </TabsTrigger>
            <TabsTrigger value="explorer" className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Search className="h-3.5 w-3.5" /> Entity Explorer
            </TabsTrigger>
            <TabsTrigger value="relations" className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <GitBranch className="h-3.5 w-3.5" /> Relationship Map
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" /> Intelligence
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════════════════════════════
              TAB 1: GRAPH VISUALIZATION
              ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="graph" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              {/* SVG Graph */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Interactive Entity Graph
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleResetView}>
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    className="relative w-full bg-slate-50/50 border-t cursor-grab active:cursor-grabbing select-none"
                    style={{ minHeight: 650 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <svg
                      ref={svgRef}
                      width="100%"
                      height="650"
                      viewBox="0 0 1000 700"
                      className="w-full"
                    >
                      <defs>
                        {/* Arrow marker */}
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                        </marker>
                        {/* Glow filter */}
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        {/* Pulse animation */}
                        <radialGradient id="pulseGrad">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        {/* Edges */}
                        {edges.map(e => {
                          const source = nodes.find(n => n.id === e.source)
                          const target = nodes.find(n => n.id === e.target)
                          if (!source || !target) return null
                          const isHighlighted = selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId)
                          return (
                            <g key={e.id}>
                              <motion.line
                                x1={source.x} y1={source.y}
                                x2={target.x} y2={target.y}
                                stroke={isHighlighted ? '#10b981' : '#cbd5e1'}
                                strokeWidth={isHighlighted ? 2 : 1}
                                strokeDasharray={isHighlighted ? 'none' : '4,4'}
                                markerEnd={isHighlighted ? 'url(#arrowhead)' : undefined}
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: isHighlighted ? 1 : 0.5 }}
                                transition={{ duration: 1, delay: 0.1 }}
                              />
                              {/* Edge label */}
                              {isHighlighted && (
                                <text
                                  x={(source.x + target.x) / 2}
                                  y={(source.y + target.y) / 2 - 5}
                                  textAnchor="middle"
                                  className="text-[8px] fill-emerald-600 font-medium"
                                >
                                  {e.label}
                                </text>
                              )}
                            </g>
                          )
                        })}

                        {/* Animated particles along edges */}
                        {selectedNodeId && selectedNodeEdges.slice(0, 10).map(e => {
                          const source = nodes.find(n => n.id === e.source)
                          const target = nodes.find(n => n.id === e.target)
                          if (!source || !target) return null
                          return (
                            <motion.circle
                              key={`particle-${e.id}`}
                              r={2.5}
                              fill="#10b981"
                              filter="url(#glow)"
                              initial={{ cx: source.x, cy: source.y, opacity: 0 }}
                              animate={{
                                cx: [source.x, target.x],
                                cy: [source.y, target.y],
                                opacity: [0, 1, 1, 0],
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'linear',
                                delay: Math.random() * 0.5,
                              }}
                            />
                          )
                        })}

                        {/* Nodes */}
                        {nodes.map((n, i) => {
                          const colors = ENTITY_COLORS[n.type]
                          const isSelected = n.id === selectedNodeId
                          const isConnected = connectedNodeIds.has(n.id)
                          const isFaded = selectedNodeId && !isSelected && !isConnected
                          const nodeRadius = n.type === 'firm' || n.type === 'organization' ? 24
                            : n.type === 'client' ? 18
                            : n.type === 'invoice' ? 12
                            : 14

                          return (
                            <g
                              key={n.id}
                              className="cursor-pointer"
                              onClick={() => setSelectedNodeId(isSelected ? null : n.id)}
                            >
                              {/* Pulse ring for selected */}
                              {isSelected && (
                                <motion.circle
                                  cx={n.x} cy={n.y}
                                  r={nodeRadius + 8}
                                  fill="none"
                                  stroke={colors.hex}
                                  strokeWidth={2}
                                  initial={{ r: nodeRadius, opacity: 0.8 }}
                                  animate={{ r: nodeRadius + 16, opacity: 0 }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                />
                              )}
                              {/* Outer glow for connected */}
                              {isConnected && (
                                <motion.circle
                                  cx={n.x} cy={n.y}
                                  r={nodeRadius + 4}
                                  fill={colors.hex}
                                  fillOpacity={0.15}
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                />
                              )}
                              {/* Node circle */}
                              <motion.circle
                                cx={n.x} cy={n.y}
                                r={nodeRadius}
                                fill={isFaded ? '#f1f5f9' : colors.hex}
                                fillOpacity={isFaded ? 0.5 : 0.15}
                                stroke={isFaded ? '#e2e8f0' : colors.hex}
                                strokeWidth={isSelected ? 3 : isConnected ? 2 : 1.5}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: i * 0.01, duration: 0.4, ease: 'backOut' }}
                                whileHover={{ scale: 1.15 }}
                              />
                              {/* Node icon/label */}
                              <text
                                x={n.x} y={n.y + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={isFaded ? '#94a3b8' : colors.hex}
                                fontSize={nodeRadius > 16 ? 9 : 7}
                                fontWeight="600"
                                className="pointer-events-none"
                              >
                                {n.label.slice(0, nodeRadius > 16 ? 10 : 6)}
                              </text>
                              {/* Sub-label for larger nodes */}
                              {(n.type === 'firm' || n.type === 'organization') && (
                                <text
                                  x={n.x} y={n.y + nodeRadius + 14}
                                  textAnchor="middle"
                                  fill={isFaded ? '#94a3b8' : '#64748b'}
                                  fontSize={8}
                                  className="pointer-events-none"
                                >
                                  {n.subtitle}
                                </text>
                              )}
                              {/* Connection count badge */}
                              {n.connections > 2 && (
                                <>
                                  <circle
                                    cx={n.x + nodeRadius - 2} cy={n.y - nodeRadius + 2}
                                    r={7}
                                    fill={isFaded ? '#e2e8f0' : '#10b981'}
                                  />
                                  <text
                                    x={n.x + nodeRadius - 2} y={n.y - nodeRadius + 3}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="white"
                                    fontSize={7}
                                    fontWeight="700"
                                    className="pointer-events-none"
                                  >
                                    {n.connections}
                                  </text>
                                </>
                              )}
                            </g>
                          )
                        })}
                      </g>
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg border shadow-sm p-3 max-w-[280px]">
                      <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Entity Types</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {(Object.entries(ENTITY_COLORS) as [EntityType, EntityColor][]).map(([type, colors]) => {
                          const count = stats.typeCounts[type] || 0
                          if (count === 0) return null
                          return (
                            <div key={type} className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors.hex }} />
                              <span className="text-[9px] text-slate-600 truncate">{ENTITY_LABELS[type]}</span>
                              <span className="text-[8px] text-slate-400 ml-auto">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Controls hint */}
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg border shadow-sm px-3 py-2">
                      <p className="text-[9px] text-slate-400">Click node to inspect · Drag to pan · Scroll to zoom</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detail Panel */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {selectedNode ? (
                    <motion.div
                      key={selectedNode.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge className={`${ENTITY_COLORS[selectedNode.type].bg} ${ENTITY_COLORS[selectedNode.type].text} border-0 text-[10px]`}>
                              {ENTITY_LABELS[selectedNode.type]}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNodeId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <CardTitle className="text-sm font-bold text-slate-800 mt-1">{selectedNode.label}</CardTitle>
                          <p className="text-[11px] text-slate-500">{selectedNode.subtitle}</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 rounded-lg p-2.5">
                              <p className="text-[9px] text-slate-400 uppercase font-medium">Status</p>
                              <Badge variant="outline" className="mt-0.5 text-[10px]">{selectedNode.status}</Badge>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2.5">
                              <p className="text-[9px] text-slate-400 uppercase font-medium">Connections</p>
                              <p className="text-sm font-bold text-slate-700">{selectedNode.connections}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2.5 col-span-2">
                              <p className="text-[9px] text-slate-400 uppercase font-medium">Last Updated</p>
                              <p className="text-xs font-medium text-slate-700">{formatDate(selectedNode.lastUpdated)}</p>
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                              Connections ({selectedNodeEdges.length})
                            </p>
                            <ScrollArea className="max-h-52">
                              <div className="space-y-1.5">
                                {selectedNodeEdges.map(e => {
                                  const otherNodeId = e.source === selectedNodeId ? e.target : e.source
                                  const otherNode = nodes.find(n => n.id === otherNodeId)
                                  if (!otherNode) return null
                                  const otherColor = ENTITY_COLORS[otherNode.type]
                                  const Icon = ENTITY_ICONS[otherNode.type]
                                  const direction = e.source === selectedNodeId ? '→' : '←'
                                  return (
                                    <motion.div
                                      key={e.id}
                                      className="flex items-center gap-2 p-2 rounded-lg bg-white border hover:border-emerald-200 cursor-pointer transition-colors"
                                      whileHover={{ x: 3 }}
                                      onClick={() => setSelectedNodeId(otherNodeId)}
                                    >
                                      <div className={`h-6 w-6 rounded flex items-center justify-center ${otherColor.bg}`}>
                                        <Icon className="h-3 w-3" style={{ color: otherColor.hex }} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-slate-700 truncate">{otherNode.label}</p>
                                        <p className="text-[9px] text-slate-400">{direction} {e.label}</p>
                                      </div>
                                      <ChevronRight className="h-3 w-3 text-slate-300" />
                                    </motion.div>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CircleDot className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Select a Node</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Click any entity on the graph to inspect its connections and details</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Quick Stats */}
                      <Card className="border-0 shadow-sm mt-4">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-600">Graph Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {Object.entries(stats.typeCounts)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 6)
                            .map(([type, count]) => {
                              const et = type as EntityType
                              const colors = ENTITY_COLORS[et]
                              const maxCount = Math.max(...Object.values(stats.typeCounts))
                              return (
                                <div key={type} className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors.hex }} />
                                  <span className="text-[11px] text-slate-600 w-24 truncate">{ENTITY_LABELS[et]}</span>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: colors.hex }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(count / maxCount) * 100}%` }}
                                      transition={{ duration: 0.8, delay: 0.2 }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-500 w-6 text-right">{count}</span>
                                </div>
                              )
                            })}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════════
              TAB 2: ENTITY EXPLORER
              ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="explorer" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Search className="h-4 w-4 text-emerald-500" />
                    Entity Explorer
                  </CardTitle>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-8 text-xs pl-8 w-full sm:w-56"
                      />
                    </div>
                    <select
                      value={filterType}
                      onChange={e => setFilterType(e.target.value as EntityType | 'all')}
                      className="h-8 text-xs border rounded-md px-2 bg-white text-slate-600"
                    >
                      <option value="all">All Types</option>
                      {(Object.keys(ENTITY_LABELS) as EntityType[]).map(type => (
                        <option key={type} value={type}>{ENTITY_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-4">
                  {(Object.entries(stats.typeCounts) as [EntityType, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const colors = ENTITY_COLORS[type]
                      return (
                        <motion.button
                          key={type}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            filterType === type ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'
                          }`}
                          onClick={() => setFilterType(filterType === type ? 'all' : type)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: colors.hex }} />
                          <div className="text-left min-w-0">
                            <p className="text-[10px] text-slate-500 truncate">{ENTITY_LABELS[type]}</p>
                            <p className="text-sm font-bold text-slate-700">{count}</p>
                          </div>
                        </motion.button>
                      )
                    })}
                </div>

                <p className="text-[11px] text-slate-400 mb-2">{filteredEntities.length} entities found</p>

                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-1.5">
                    {filteredEntities.map((n, i) => {
                      const colors = ENTITY_COLORS[n.type]
                      const Icon = ENTITY_ICONS[n.type]
                      const nodeEdges = edges.filter(e => e.source === n.id || e.target === n.id)
                      return (
                        <motion.div
                          key={n.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white border hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => {
                            setSelectedNodeId(n.id)
                            setActiveTab('graph')
                          }}
                          whileHover={{ x: 2 }}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colors.bg}`}>
                            <Icon className="h-4 w-4" style={{ color: colors.hex }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{n.label}</p>
                            <p className="text-[10px] text-slate-400 truncate">{n.subtitle}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{ENTITY_LABELS[n.type]}</Badge>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-semibold text-slate-600">{n.connections} links</p>
                            <p className="text-[9px] text-slate-400">{formatDate(n.lastUpdated)}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Relationship Cards */}
                {selectedNodeId && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-500" />
                      Relationships for {selectedNode?.label || selectedNodeId}
                    </p>
                    <div className="space-y-2">
                      {selectedNodeEdges.map(e => {
                        const source = nodes.find(n => n.id === e.source)
                        const target = nodes.find(n => n.id === e.target)
                        if (!source || !target) return null
                        const srcColor = ENTITY_COLORS[source.type]
                        const tgtColor = ENTITY_COLORS[target.type]
                        return (
                          <motion.div
                            key={e.id}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                          >
                            <Badge className={`${srcColor.bg} ${srcColor.text} border-0 text-[9px]`}>
                              {ENTITY_LABELS[source.type]}
                            </Badge>
                            <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]">{source.label}</span>
                            <ArrowRightLeft className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="text-[9px] text-emerald-600 font-medium">{e.label}</span>
                            <ArrowRightLeft className="h-3 w-3 text-slate-400 shrink-0" />
                            <Badge className={`${tgtColor.bg} ${tgtColor.text} border-0 text-[9px]`}>
                              {ENTITY_LABELS[target.type]}
                            </Badge>
                            <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]">{target.label}</span>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════════
              TAB 3: RELATIONSHIP MAP
              ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="relations" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-emerald-500" />
                    Relationship Map
                    {selectedNodeId && <span className="text-slate-400 font-normal">— {selectedNode?.label}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative w-full bg-slate-50/50 border-t" style={{ minHeight: 500 }}>
                    <svg width="100%" height="500" viewBox="0 0 800 500">
                      <defs>
                        <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                        </marker>
                      </defs>

                      {(() => {
                        if (!selectedNodeId || !selectedNode) {
                          return (
                                            <text x="400" y="250" textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="500">
                          Select an entity to see connections
                        </text>
                          )
                        }

                        // Build relationship sub-graph
                        const firstDegree = new Set<string>()
                        const secondDegree = new Set<string>()
                        firstDegree.add(selectedNodeId)

                        edges.forEach(e => {
                          if (e.source === selectedNodeId) { firstDegree.add(e.target); secondDegree.add(e.target) }
                          if (e.target === selectedNodeId) { firstDegree.add(e.source); secondDegree.add(e.source) }
                        })

                        // Second degree
                        const firstDegreeArr = Array.from(firstDegree)
                        firstDegreeArr.forEach(nId => {
                          edges.forEach(e => {
                            if (e.source === nId) secondDegree.add(e.target)
                            if (e.target === nId) secondDegree.add(e.source)
                          })
                        })

                        const subNodes = nodes.filter(n => secondDegree.has(n.id))
                        const centerX = 400
                        const centerY = 250

                        // Position: center node in middle, 1st degree around it, 2nd degree further out
                        const positioned: Record<string, { x: number; y: number }> = {}
                        positioned[selectedNodeId] = { x: centerX, y: centerY }

                        const firstRing = subNodes.filter(n => n.id !== selectedNodeId && firstDegree.has(n.id))
                        const secondRing = subNodes.filter(n => !firstDegree.has(n.id))

                        firstRing.forEach((n, i) => {
                          const angle = (2 * Math.PI * i) / Math.max(firstRing.length, 1) - Math.PI / 2
                          positioned[n.id] = { x: centerX + 160 * Math.cos(angle), y: centerY + 160 * Math.sin(angle) }
                        })

                        secondRing.forEach((n, i) => {
                          const angle = (2 * Math.PI * i) / Math.max(secondRing.length, 1)
                          positioned[n.id] = { x: centerX + 300 * Math.cos(angle), y: centerY + 300 * Math.sin(angle) }
                        })

                        const relEdges = edges.filter(e => secondDegree.has(e.source) && secondDegree.has(e.target))

                        return (
                          <>
                            {/* Edges */}
                            {relEdges.map(e => {
                              const s = positioned[e.source]
                              const t = positioned[e.target]
                              if (!s || !t) return null
                              const isPrimary = e.source === selectedNodeId || e.target === selectedNodeId
                              return (
                                <g key={e.id}>
                                  <motion.line
                                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                                    stroke={isPrimary ? '#10b981' : '#d1d5db'}
                                    strokeWidth={isPrimary ? 2.5 : 1}
                                    markerEnd={isPrimary ? 'url(#arrowR)' : undefined}
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 0.8 }}
                                  />
                                  <text
                                    x={(s.x + t.x) / 2}
                                    y={(s.y + t.y) / 2 - 6}
                                    textAnchor="middle"
                                    fill={isPrimary ? '#059669' : '#94a3b8'}
                                    fontSize="8"
                                    fontWeight="500"
                                  >
                                    {e.label}
                                  </text>
                                </g>
                              )
                            })}

                            {/* Nodes */}
                            {subNodes.map(n => {
                              const pos = positioned[n.id]
                              if (!pos) return null
                              const colors = ENTITY_COLORS[n.type]
                              const isCenter = n.id === selectedNodeId
                              const is1st = firstDegree.has(n.id) && !isCenter
                              const r = isCenter ? 28 : is1st ? 18 : 12

                              return (
                                <g key={n.id} className="cursor-pointer" onClick={() => setSelectedNodeId(n.id)}>
                                  {isCenter && (
                                    <motion.circle
                                      cx={pos.x} cy={pos.y}
                                      r={r + 6}
                                      fill="none"
                                      stroke="#10b981"
                                      strokeWidth={2}
                                      initial={{ r: r, opacity: 0.6 }}
                                      animate={{ r: r + 14, opacity: 0 }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                    />
                                  )}
                                  <motion.circle
                                    cx={pos.x} cy={pos.y}
                                    r={r}
                                    fill={colors.hex}
                                    fillOpacity={isCenter ? 0.2 : 0.12}
                                    stroke={colors.hex}
                                    strokeWidth={isCenter ? 3 : is1st ? 2 : 1}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.4, ease: 'backOut' }}
                                  />
                                  <text
                                    x={pos.x} y={pos.y + 1}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill={colors.hex}
                                    fontSize={r > 16 ? 9 : 7}
                                    fontWeight="600"
                                  >
                                    {n.label.slice(0, r > 16 ? 12 : 8)}
                                  </text>
                                  {/* Degree label */}
                                  <text
                                    x={pos.x} y={pos.y + r + 12}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize="7"
                                  >
                                    {isCenter ? 'SELECTED' : is1st ? '1st Degree' : '2nd Degree'}
                                  </text>
                                </g>
                              )
                            })}
                          </>
                        )
                      })()}
                    </svg>
                  </div>
                </CardContent>
              </Card>

              {/* Side Panel */}
              <div className="space-y-4">
                {/* Entity Selector */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600">Select Entity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <select
                      value={selectedNodeId || ''}
                      onChange={e => setSelectedNodeId(e.target.value || null)}
                      className="w-full h-8 text-xs border rounded-md px-2 bg-white text-slate-600"
                    >
                      <option value="">Choose an entity...</option>
                      {nodes.sort((a, b) => b.connections - a.connections).map(n => (
                        <option key={n.id} value={n.id}>{n.label} ({n.connections} links)</option>
                      ))}
                    </select>
                  </CardContent>
                </Card>

                {/* Stats */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600">Graph Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Total Entities', value: stats.totalEntities, icon: Database },
                      { label: 'Total Connections', value: stats.totalConnections, icon: Link2 },
                      { label: 'Most Connected', value: stats.mostConnected?.label || '—', icon: Target },
                      { label: 'Orphan Entities', value: stats.orphanCount, icon: Unlink },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
                          <s.icon className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-400">{s.label}</p>
                          <p className="text-xs font-semibold text-slate-700 truncate">{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Degree info */}
                {selectedNodeId && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-slate-600">Connection Degrees</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">1st Degree</span>
                        <Badge variant="outline" className="text-[10px]">{selectedNodeEdges.length}</Badge>
                      </div>
                      <Progress value={Math.min(100, selectedNodeEdges.length * 10)} className="h-1.5" />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-500">2nd Degree</span>
                        <Badge variant="outline" className="text-[10px]">{connectedNodeIds.size}</Badge>
                      </div>
                      <Progress value={Math.min(100, connectedNodeIds.size * 5)} className="h-1.5" />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════════
              TAB 4: GRAPH INTELLIGENCE
              ════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="intelligence" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Graph Health Score */}
              <Card className="border-0 shadow-sm md:col-span-2 lg:col-span-3">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="relative">
                      <svg width="160" height="160">
                        <circle cx="80" cy="80" r="65" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                        <motion.circle
                          cx="80" cy="80" r="65" fill="none"
                          stroke={stats.qualityScore > 70 ? '#10b981' : stats.qualityScore > 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 65}
                          strokeDashoffset={2 * Math.PI * 65}
                          animate={{ strokeDashoffset: 2 * Math.PI * 65 * (1 - stats.qualityScore / 100) }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className="-rotate-90 origin-center"
                          style={{ transformOrigin: '80px 80px' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-800">{stats.qualityScore}</span>
                        <span className="text-[10px] font-medium text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">Graph Health Score</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {stats.qualityScore > 80
                            ? 'Excellent data connectivity. Most entities are well-linked.'
                            : stats.qualityScore > 60
                              ? 'Good connectivity but some entities need linking.'
                              : 'Significant gaps detected. Connect orphan entities to improve.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-emerald-600">{stats.totalEntities}</p>
                          <p className="text-[9px] text-emerald-500 font-medium">Entities</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-amber-600">{stats.totalConnections}</p>
                          <p className="text-[9px] text-amber-500 font-medium">Links</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-red-600">{stats.orphanCount}</p>
                          <p className="text-[9px] text-red-500 font-medium">Orphans</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Clusters */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    Auto-Detected Clusters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {intelligence.clusters.map((cluster, i) => (
                        <motion.div
                          key={cluster.name}
                          className="p-3 rounded-lg border hover:border-emerald-200 transition-colors"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cluster.color }} />
                            <span className="text-xs font-semibold text-slate-700">{cluster.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mb-1.5">{cluster.entities.length} entities</p>
                          <div className="flex flex-wrap gap-1">
                            {cluster.entities.slice(0, 5).map(e => (
                              <Badge key={e.id} variant="outline" className="text-[8px] px-1.5 py-0">
                                {e.label.slice(0, 15)}
                              </Badge>
                            ))}
                            {cluster.entities.length > 5 && (
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0">
                                +{cluster.entities.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Anomalies */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Anomalies Detected
                    <Badge variant="outline" className="text-[9px] ml-auto">{intelligence.anomalies.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {intelligence.anomalies.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">No anomalies detected</p>
                        </div>
                      ) : (
                        intelligence.anomalies.map((a, i) => (
                          <motion.div
                            key={i}
                            className="p-3 rounded-lg border cursor-pointer hover:border-amber-200 transition-colors"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            onClick={() => {
                              if (a.entityId) {
                                setSelectedNodeId(a.entityId)
                                setActiveTab('graph')
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {a.type === 'error' ? (
                                <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
                              ) : a.type === 'warning' ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Info className="h-3.5 w-3.5 text-blue-500" />
                              )}
                              <span className="text-[11px] font-semibold text-slate-700">{a.title}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{a.description}</p>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-emerald-500" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {intelligence.recommendations.map((rec, i) => (
                        <motion.div
                          key={i}
                          className="p-3 rounded-lg border hover:border-emerald-200 transition-colors"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="h-3 w-3 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-700">{rec.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{rec.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[8px]">
                                  {rec.confidence}% confidence
                                </Badge>
                                <Button size="sm" className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white px-2">
                                  {rec.action}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
