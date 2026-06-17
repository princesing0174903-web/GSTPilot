'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Network, Globe, Building2, IndianRupee, TrendingUp,
  ZoomIn, ZoomOut, Maximize2, Layers, Share2, Sparkles, AlertTriangle,
  CircleDot, ArrowRight, Link2, Database, Clock, Target,
  Lightbulb, Boxes, Factory, Truck, Store, Users, CheckCircle,
  Zap, GitBranch, Cpu, Gauge, BarChart3,
  Workflow, AlertOctagon, Eye, Waypoints,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Indian number / currency formatting
// ═══════════════════════════════════════════════════════════════════════════════

const formatINR = (n: number): string => {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

const formatNum = (n: number): string => Math.round(n).toLocaleString('en-IN')

const formatCompact = (n: number): string => {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
}

const staggerChild = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration = 1400): number {
  const [count, setCount] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target === prev.current) return
    prev.current = target
    const start = count
    const startT = Date.now()
    const diff = target - start
    const step = () => {
      const el = Date.now() - startT
      const p = Math.min(el / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(start + diff * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — 10 INDUSTRY CLUSTERS (positions in 700x500 SVG)
// ═══════════════════════════════════════════════════════════════════════════════

type IndustryId =
  | 'mfg' | 'it' | 'pharma' | 'auto' | 'textile'
  | 'agri' | 'bank' | 'retail' | 'const' | 'telecom'

interface IndustryCluster {
  id: IndustryId
  name: string
  shortName: string
  cx: number
  cy: number
  color: string
  fill: string
  companies: number
  revenue: number
  growth: number
  health: number
  avgRevenue: number
  connectedIndustries: number
  topCompanies: string[]
}

const INDUSTRY_CLUSTERS: IndustryCluster[] = [
  {
    id: 'mfg', name: 'Manufacturing', shortName: 'MFG',
    cx: 130, cy: 120, color: '#10b981', fill: 'rgba(16, 185, 129, 0.08)',
    companies: 84520, revenue: 1845000, growth: 12.4, health: 82, avgRevenue: 21.8, connectedIndustries: 8,
    topCompanies: ['Tata Steel Ltd', 'JSW Steel', 'Larsen & Toubro'],
  },
  {
    id: 'it', name: 'IT / ITeS', shortName: 'IT',
    cx: 560, cy: 95, color: '#14b8a6', fill: 'rgba(20, 184, 166, 0.08)',
    companies: 42180, revenue: 1450000, growth: 18.7, health: 91, avgRevenue: 34.4, connectedIndustries: 9,
    topCompanies: ['TCS Ltd', 'Infosys', 'Wipro Technologies'],
  },
  {
    id: 'pharma', name: 'Pharma', shortName: 'PHARMA',
    cx: 360, cy: 75, color: '#059669', fill: 'rgba(5, 150, 105, 0.08)',
    companies: 28940, revenue: 680000, growth: 14.2, health: 88, avgRevenue: 23.5, connectedIndustries: 6,
    topCompanies: ['Sun Pharma', 'Dr Reddy\'s Labs', 'Cipla Ltd'],
  },
  {
    id: 'auto', name: 'Automobile', shortName: 'AUTO',
    cx: 230, cy: 270, color: '#0d9488', fill: 'rgba(13, 148, 136, 0.08)',
    companies: 18650, revenue: 920000, growth: 8.9, health: 74, avgRevenue: 49.3, connectedIndustries: 7,
    topCompanies: ['Maruti Suzuki', 'Tata Motors', 'Mahindra & Mahindra'],
  },
  {
    id: 'textile', name: 'Textiles', shortName: 'TEXT',
    cx: 470, cy: 230, color: '#16a34a', fill: 'rgba(22, 163, 74, 0.08)',
    companies: 64210, revenue: 380000, growth: 9.6, health: 78, avgRevenue: 5.9, connectedIndustries: 6,
    topCompanies: ['Reliance Industries', 'Arvind Ltd', 'Welspun India'],
  },
  {
    id: 'agri', name: 'Agriculture', shortName: 'AGRI',
    cx: 110, cy: 380, color: '#65a30d', fill: 'rgba(101, 163, 13, 0.08)',
    companies: 124800, revenue: 540000, growth: 6.8, health: 65, avgRevenue: 4.3, connectedIndustries: 5,
    topCompanies: ['ITC Agri', 'UPL Ltd', 'Coromandel Intl'],
  },
  {
    id: 'bank', name: 'Banking', shortName: 'BANK',
    cx: 590, cy: 385, color: '#0f766e', fill: 'rgba(15, 118, 110, 0.08)',
    companies: 12450, revenue: 2150000, growth: 11.2, health: 86, avgRevenue: 172.7, connectedIndustries: 10,
    topCompanies: ['HDFC Bank', 'State Bank of India', 'ICICI Bank'],
  },
  {
    id: 'retail', name: 'Retail', shortName: 'RETAIL',
    cx: 360, cy: 175, color: '#22c55e', fill: 'rgba(34, 197, 94, 0.08)',
    companies: 98740, revenue: 410000, growth: 15.3, health: 72, avgRevenue: 4.2, connectedIndustries: 7,
    topCompanies: ['Reliance Retail', 'DMart', 'Trent Ltd'],
  },
  {
    id: 'const', name: 'Construction', shortName: 'CONST',
    cx: 80, cy: 255, color: '#15803d', fill: 'rgba(21, 128, 61, 0.08)',
    companies: 35680, revenue: 620000, growth: 7.4, health: 68, avgRevenue: 17.4, connectedIndustries: 6,
    topCompanies: ['L&T Construction', 'UltraTech', 'Shapoorji Pallonji'],
  },
  {
    id: 'telecom', name: 'Telecom', shortName: 'TEL',
    cx: 620, cy: 250, color: '#34d399', fill: 'rgba(52, 211, 153, 0.08)',
    companies: 8920, revenue: 720000, growth: 5.8, health: 80, avgRevenue: 80.7, connectedIndustries: 8,
    topCompanies: ['Reliance Jio', 'Bharti Airtel', 'Vodafone Idea'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — ~40 COMPANY NODES (with cluster offsets, Indian names)
// ═══════════════════════════════════════════════════════════════════════════════

type EdgeType = 'payment' | 'invoice' | 'risk' | 'ownership'

interface CompanyNode {
  id: string
  cluster: IndustryId
  name: string
  dx: number
  dy: number
  revenue: number
  connections: number
  industry: string
  hq: string
  status: 'healthy' | 'watch' | 'risk'
  gstin: string
}

const COMPANY_NODES: CompanyNode[] = [
  // Manufacturing (4)
  { id: 'c1', cluster: 'mfg', name: 'Tata Steel Ltd', dx: -32, dy: -28, revenue: 230000, connections: 18, industry: 'Steel', hq: 'Mumbai', status: 'healthy', gstin: '27AAACT1234F1Z5' },
  { id: 'c2', cluster: 'mfg', name: 'JSW Steel', dx: 38, dy: -22, revenue: 145000, connections: 12, industry: 'Steel', hq: 'Mumbai', status: 'healthy', gstin: '27AAACJ5678K1Z2' },
  { id: 'c3', cluster: 'mfg', name: 'Bharat Forge', dx: -25, dy: 25, revenue: 48000, connections: 9, industry: 'Forging', hq: 'Pune', status: 'healthy', gstin: '27AAACB9012F1Z9' },
  { id: 'c4', cluster: 'mfg', name: 'Cummins India', dx: 30, dy: 28, revenue: 32000, connections: 7, industry: 'Engines', hq: 'Pune', status: 'watch', gstin: '27AAACC3456I1Z4' },

  // IT/ITeS (5)
  { id: 'c5', cluster: 'it', name: 'TCS Ltd', dx: -34, dy: -25, revenue: 195000, connections: 24, industry: 'IT Services', hq: 'Mumbai', status: 'healthy', gstin: '27AAACT1234F1Z5' },
  { id: 'c6', cluster: 'it', name: 'Infosys', dx: 28, dy: -30, revenue: 142000, connections: 21, industry: 'IT Services', hq: 'Bengaluru', status: 'healthy', gstin: '29AAACI4764K1Z5' },
  { id: 'c7', cluster: 'it', name: 'Wipro Tech', dx: -32, dy: 20, revenue: 89000, connections: 15, industry: 'IT Services', hq: 'Bengaluru', status: 'healthy', gstin: '29AAACW5678L1Z3' },
  { id: 'c8', cluster: 'it', name: 'HCL Technologies', dx: 35, dy: 18, revenue: 78000, connections: 13, industry: 'IT Services', hq: 'Noida', status: 'healthy', gstin: '07AAACH7890M1Z8' },
  { id: 'c9', cluster: 'it', name: 'Tech Mahindra', dx: 0, dy: 30, revenue: 52000, connections: 11, industry: 'IT Services', hq: 'Pune', status: 'watch', gstin: '27AAACT2345N1Z7' },

  // Pharma (4)
  { id: 'c10', cluster: 'pharma', name: 'Sun Pharma', dx: -28, dy: -22, revenue: 38000, connections: 14, industry: 'Pharma', hq: 'Mumbai', status: 'healthy', gstin: '27AAACS3456P1Z1' },
  { id: 'c11', cluster: 'pharma', name: 'Dr Reddy\'s Labs', dx: 30, dy: -25, revenue: 24500, connections: 10, industry: 'Pharma', hq: 'Hyderabad', status: 'healthy', gstin: '36AAACD5678Q1Z9' },
  { id: 'c12', cluster: 'pharma', name: 'Cipla Ltd', dx: -30, dy: 22, revenue: 21800, connections: 9, industry: 'Pharma', hq: 'Mumbai', status: 'healthy', gstin: '27AAACC9012R1Z3' },
  { id: 'c13', cluster: 'pharma', name: 'Lupin Ltd', dx: 28, dy: 24, revenue: 16400, connections: 8, industry: 'Pharma', hq: 'Mumbai', status: 'watch', gstin: '27AAACL3456S1Z6' },

  // Automobile (4)
  { id: 'c14', cluster: 'auto', name: 'Maruti Suzuki', dx: -30, dy: -28, revenue: 88000, connections: 16, industry: 'Automobile', hq: 'New Delhi', status: 'healthy', gstin: '06AAACM1234T1Z8' },
  { id: 'c15', cluster: 'auto', name: 'Tata Motors', dx: 32, dy: -22, revenue: 78000, connections: 14, industry: 'Automobile', hq: 'Mumbai', status: 'watch', gstin: '27AAACT5678U1Z2' },
  { id: 'c16', cluster: 'auto', name: 'Mahindra & Mahindra', dx: -28, dy: 26, revenue: 65000, connections: 11, industry: 'Automobile', hq: 'Mumbai', status: 'healthy', gstin: '27AAACM9012V1Z5' },
  { id: 'c17', cluster: 'auto', name: 'Bajaj Auto', dx: 30, dy: 24, revenue: 34200, connections: 9, industry: 'Automobile', hq: 'Pune', status: 'healthy', gstin: '27AAACB3456W1Z7' },

  // Textiles (4)
  { id: 'c18', cluster: 'textile', name: 'Arvind Ltd', dx: -30, dy: -25, revenue: 8200, connections: 11, industry: 'Textiles', hq: 'Ahmedabad', status: 'watch', gstin: '24AAACA1234X1Z4' },
  { id: 'c19', cluster: 'textile', name: 'Welspun India', dx: 32, dy: -20, revenue: 7400, connections: 9, industry: 'Textiles', hq: 'Mumbai', status: 'healthy', gstin: '27AAACW5678Y1Z3' },
  { id: 'c20', cluster: 'textile', name: 'Raymond Ltd', dx: -28, dy: 25, revenue: 5800, connections: 7, industry: 'Textiles', hq: 'Mumbai', status: 'healthy', gstin: '27AAACR9012Z1Z9' },
  { id: 'c21', cluster: 'textile', name: 'Trident Group', dx: 28, dy: 24, revenue: 5400, connections: 8, industry: 'Textiles', hq: 'Barnala', status: 'watch', gstin: '03AAACT3456A1Z6' },

  // Agriculture (4)
  { id: 'c22', cluster: 'agri', name: 'UPL Ltd', dx: -32, dy: -25, revenue: 38400, connections: 12, industry: 'Agrochem', hq: 'Mumbai', status: 'healthy', gstin: '27AAACU1234B1Z1' },
  { id: 'c23', cluster: 'agri', name: 'Coromandel Intl', dx: 30, dy: -22, revenue: 14200, connections: 9, industry: 'Fertilizers', hq: 'Hyderabad', status: 'healthy', gstin: '36AAACC5678C1Z8' },
  { id: 'c24', cluster: 'agri', name: 'ITC Agri Bus', dx: -28, dy: 24, revenue: 11800, connections: 8, industry: 'Agri Trading', hq: 'Hyderabad', status: 'healthy', gstin: '36AAACI9012D1Z4' },
  { id: 'c25', cluster: 'agri', name: 'PI Industries', dx: 28, dy: 25, revenue: 6200, connections: 6, industry: 'Agrochem', hq: 'Mumbai', status: 'watch', gstin: '27AAACP3456E1Z7' },

  // Banking (4)
  { id: 'c26', cluster: 'bank', name: 'HDFC Bank', dx: -30, dy: -28, revenue: 168000, connections: 22, industry: 'Banking', hq: 'Mumbai', status: 'healthy', gstin: '27AAACH2702H1Z4' },
  { id: 'c27', cluster: 'bank', name: 'SBI', dx: 32, dy: -22, revenue: 142000, connections: 25, industry: 'Banking', hq: 'Mumbai', status: 'healthy', gstin: '27AAACS5678F1Z9' },
  { id: 'c28', cluster: 'bank', name: 'ICICI Bank', dx: -28, dy: 24, revenue: 98000, connections: 18, industry: 'Banking', hq: 'Mumbai', status: 'healthy', gstin: '27AAACI9012G1Z3' },
  { id: 'c29', cluster: 'bank', name: 'Axis Bank', dx: 28, dy: 26, revenue: 68000, connections: 14, industry: 'Banking', hq: 'Mumbai', status: 'healthy', gstin: '27AAACU3456H1Z6' },

  // Retail (4)
  { id: 'c30', cluster: 'retail', name: 'Reliance Retail', dx: -30, dy: -25, revenue: 26000, connections: 17, industry: 'Retail', hq: 'Mumbai', status: 'healthy', gstin: '27AAACR1234I1Z2' },
  { id: 'c31', cluster: 'retail', name: 'DMart (Avenue)', dx: 32, dy: -22, revenue: 30400, connections: 13, industry: 'Retail', hq: 'Mumbai', status: 'healthy', gstin: '27AAACD5678J1Z5' },
  { id: 'c32', cluster: 'retail', name: 'Trent Ltd', dx: -28, dy: 24, revenue: 8200, connections: 8, industry: 'Retail', hq: 'Mumbai', status: 'watch', gstin: '27AAACT9012K1Z8' },
  { id: 'c33', cluster: 'retail', name: 'V-Mart Retail', dx: 28, dy: 25, revenue: 2300, connections: 6, industry: 'Retail', hq: 'New Delhi', status: 'risk', gstin: '07AAACV3456L1Z3' },

  // Construction (3)
  { id: 'c34', cluster: 'const', name: 'UltraTech', dx: -28, dy: -22, revenue: 58000, connections: 13, industry: 'Cement', hq: 'Mumbai', status: 'healthy', gstin: '27AAACU1234M1Z7' },
  { id: 'c35', cluster: 'const', name: 'Shapoorji Pallonji', dx: 30, dy: -25, revenue: 12400, connections: 9, industry: 'Construction', hq: 'Mumbai', status: 'watch', gstin: '27AAACS5678N1Z4' },
  { id: 'c36', cluster: 'const', name: 'Ambuja Cements', dx: 0, dy: 26, revenue: 28600, connections: 10, industry: 'Cement', hq: 'Mumbai', status: 'healthy', gstin: '27AAACA9012O1Z1' },

  // Telecom (3)
  { id: 'c37', cluster: 'telecom', name: 'Reliance Jio', dx: -30, dy: -25, revenue: 89000, connections: 19, industry: 'Telecom', hq: 'Mumbai', status: 'healthy', gstin: '27AAACR3456P1Z2' },
  { id: 'c38', cluster: 'telecom', name: 'Bharti Airtel', dx: 32, dy: -22, revenue: 116000, connections: 21, industry: 'Telecom', hq: 'New Delhi', status: 'healthy', gstin: '07AAACB6789Q1Z5' },
  { id: 'c39', cluster: 'telecom', name: 'Vodafone Idea', dx: 0, dy: 26, revenue: 38000, connections: 11, industry: 'Telecom', hq: 'Gandhinagar', status: 'risk', gstin: '24AAACV9012R1Z8' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — EDGES (trade relationships between companies)
// ═══════════════════════════════════════════════════════════════════════════════

interface GraphEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  volume: number
}

const GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', source: 'c5', target: 'c1', type: 'payment', volume: 4500 },
  { id: 'e2', source: 'c6', target: 'c1', type: 'invoice', volume: 3200 },
  { id: 'e3', source: 'c7', target: 'c3', type: 'payment', volume: 1800 },
  { id: 'e4', source: 'c8', target: 'c14', type: 'invoice', volume: 2400 },
  { id: 'e5', source: 'c9', target: 'c15', type: 'payment', volume: 1200 },
  { id: 'e6', source: 'c14', target: 'c2', type: 'payment', volume: 5600 },
  { id: 'e7', source: 'c15', target: 'c4', type: 'invoice', volume: 2100 },
  { id: 'e8', source: 'c16', target: 'c4', type: 'payment', volume: 1500 },
  { id: 'e9', source: 'c26', target: 'c1', type: 'ownership', volume: 12000 },
  { id: 'e10', source: 'c27', target: 'c2', type: 'ownership', volume: 9800 },
  { id: 'e11', source: 'c28', target: 'c5', type: 'payment', volume: 8400 },
  { id: 'e12', source: 'c29', target: 'c6', type: 'payment', volume: 4200 },
  { id: 'e13', source: 'c10', target: 'c12', type: 'invoice', volume: 2200 },
  { id: 'e14', source: 'c11', target: 'c13', type: 'payment', volume: 1800 },
  { id: 'e15', source: 'c13', target: 'c17', type: 'risk', volume: 600 },
  { id: 'e16', source: 'c30', target: 'c18', type: 'payment', volume: 3400 },
  { id: 'e17', source: 'c31', target: 'c19', type: 'invoice', volume: 2800 },
  { id: 'e18', source: 'c32', target: 'c20', type: 'payment', volume: 1200 },
  { id: 'e19', source: 'c33', target: 'c21', type: 'risk', volume: 400 },
  { id: 'e20', source: 'c37', target: 'c5', type: 'payment', volume: 6800 },
  { id: 'e21', source: 'c38', target: 'c6', type: 'payment', volume: 5400 },
  { id: 'e22', source: 'c39', target: 'c7', type: 'risk', volume: 800 },
  { id: 'e23', source: 'c34', target: 'c35', type: 'invoice', volume: 2400 },
  { id: 'e24', source: 'c36', target: 'c35', type: 'payment', volume: 1900 },
  { id: 'e25', source: 'c22', target: 'c24', type: 'invoice', volume: 2200 },
  { id: 'e26', source: 'c23', target: 'c24', type: 'payment', volume: 1600 },
  { id: 'e27', source: 'c25', target: 'c23', type: 'risk', volume: 500 },
  { id: 'e28', source: 'c26', target: 'c14', type: 'payment', volume: 8800 },
  { id: 'e29', source: 'c27', target: 'c37', type: 'ownership', volume: 15000 },
  { id: 'e30', source: 'c28', target: 'c10', type: 'payment', volume: 3400 },
  { id: 'e31', source: 'c29', target: 'c30', type: 'payment', volume: 2600 },
  { id: 'e32', source: 'c30', target: 'c22', type: 'invoice', volume: 1900 },
]

const EDGE_COLORS: Record<EdgeType, { stroke: string; label: string; desc: string }> = {
  payment: { stroke: '#22c55e', label: 'Payment Flow', desc: 'Money movement' },
  invoice: { stroke: '#f59e0b', label: 'Invoice / Trade', desc: 'B2B invoicing' },
  risk: { stroke: '#ef4444', label: 'Risk Linkage', desc: 'Distress propagation' },
  ownership: { stroke: '#64748b', label: 'Ownership / Equity', desc: 'Holding structure' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — SUPPLY CHAINS (per industry)
// ═══════════════════════════════════════════════════════════════════════════════

interface SupplyChainNode {
  id: string
  name: string
  revenue: number
  health: number
  stage: 'raw' | 'mfg' | 'dist' | 'retail' | 'consumer'
  volume: number
}

interface SupplyChainStage {
  stage: SupplyChainNode['stage']
  label: string
  icon: React.ElementType
  companies: SupplyChainNode[]
}

interface SupplyChain {
  industryId: IndustryId
  industryName: string
  stages: SupplyChainStage[]
  criticalVendors: number
  upstreamPct: number
  riskNodes: number
  alternatives: { atRisk: string; suggestions: string[] }[]
}

const SUPPLY_CHAINS: SupplyChain[] = [
  {
    industryId: 'pharma', industryName: 'Pharmaceuticals',
    criticalVendors: 3, upstreamPct: 67, riskNodes: 2,
    alternatives: [
      { atRisk: 'Active Pharma Imports (China)', suggestions: ['Aarti Industries (Domestic API)', 'Mylan Labs (Hyderabad)', 'Cipla API Division'] },
      { atRisk: 'Solvent Suppliers', suggestions: ['Reliance Industries (Petrochem)', 'Indian Oil Corporation', 'GACL Vadodara'] },
    ],
    stages: [
      { stage: 'raw', label: 'Raw Materials', icon: Boxes, companies: [
        { id: 'p-r1', name: 'Aarti Industries', revenue: 4200, health: 78, stage: 'raw', volume: 1200 },
        { id: 'p-r2', name: 'Chinese API Imports', revenue: 8800, health: 42, stage: 'raw', volume: 2400 },
        { id: 'p-r3', name: 'Mylan Labs', revenue: 2600, health: 72, stage: 'raw', volume: 800 },
      ]},
      { stage: 'mfg', label: 'Manufacturers', icon: Factory, companies: [
        { id: 'p-m1', name: 'Sun Pharma', revenue: 38000, health: 88, stage: 'mfg', volume: 5400 },
        { id: 'p-m2', name: 'Dr Reddy\'s Labs', revenue: 24500, health: 86, stage: 'mfg', volume: 3200 },
        { id: 'p-m3', name: 'Cipla Ltd', revenue: 21800, health: 84, stage: 'mfg', volume: 2900 },
      ]},
      { stage: 'dist', label: 'Distributors', icon: Truck, companies: [
        { id: 'p-d1', name: 'API Holdings', revenue: 8400, health: 75, stage: 'dist', volume: 4100 },
        { id: 'p-d2', name: 'MedPlus Mart', revenue: 4600, health: 80, stage: 'dist', volume: 2200 },
        { id: 'p-d3', name: 'Apollo Pharmacy', revenue: 9200, health: 82, stage: 'dist', volume: 3400 },
      ]},
      { stage: 'retail', label: 'Retailers', icon: Store, companies: [
        { id: 'p-r4', name: 'Apollo Stores', revenue: 6800, health: 78, stage: 'retail', volume: 1800 },
        { id: 'p-r5', name: 'Wellness Forever', revenue: 2400, health: 73, stage: 'retail', volume: 900 },
      ]},
      { stage: 'consumer', label: 'End Consumers', icon: Users, companies: [
        { id: 'p-c1', name: 'Hospitals (12,400+)', revenue: 0, health: 0, stage: 'consumer', volume: 6800 },
        { id: 'p-c2', name: 'Pharmacies (8.5L+)', revenue: 0, health: 0, stage: 'consumer', volume: 5200 },
        { id: 'p-c3', name: 'Direct Patients', revenue: 0, health: 0, stage: 'consumer', volume: 9400 },
      ]},
    ],
  },
  {
    industryId: 'auto', industryName: 'Automobiles',
    criticalVendors: 4, upstreamPct: 71, riskNodes: 3,
    alternatives: [
      { atRisk: 'Semiconductor Chips (Taiwan)', suggestions: ['Tata Electronics (Dholavira fab)', 'ISRO Semiconductor Div', 'Tower Semiconductor JV'] },
      { atRisk: 'Steel Supply', suggestions: ['Tata Steel Long Products', 'JSW Steel Coil Division', 'SAIL Long Products'] },
      { atRisk: 'Lithium Cells', suggestions: ['Exide Energy Solutions', 'Tata Chemicals (Battery)', 'Reliance New Energy'] },
    ],
    stages: [
      { stage: 'raw', label: 'Raw Materials', icon: Boxes, companies: [
        { id: 'a-r1', name: 'Tata Steel', revenue: 230000, health: 85, stage: 'raw', volume: 14200 },
        { id: 'a-r2', name: 'Semiconductor Imports', revenue: 48000, health: 38, stage: 'raw', volume: 8800 },
        { id: 'a-r3', name: 'Hindalco Aluminium', revenue: 32000, health: 82, stage: 'raw', volume: 3400 },
      ]},
      { stage: 'mfg', label: 'Manufacturers', icon: Factory, companies: [
        { id: 'a-m1', name: 'Maruti Suzuki', revenue: 88000, health: 86, stage: 'mfg', volume: 6400 },
        { id: 'a-m2', name: 'Tata Motors', revenue: 78000, health: 64, stage: 'mfg', volume: 5200 },
        { id: 'a-m3', name: 'Mahindra & Mahindra', revenue: 65000, health: 78, stage: 'mfg', volume: 4100 },
      ]},
      { stage: 'dist', label: 'Distributors', icon: Truck, companies: [
        { id: 'a-d1', name: 'CarTrade Tech', revenue: 1800, health: 75, stage: 'dist', volume: 2200 },
        { id: 'a-d2', name: 'Mahindra First Choice', revenue: 2200, health: 80, stage: 'dist', volume: 1800 },
      ]},
      { stage: 'retail', label: 'Dealerships', icon: Store, companies: [
        { id: 'a-r4', name: 'Maruti ARENA Network', revenue: 12400, health: 82, stage: 'retail', volume: 3200 },
        { id: 'a-r5', name: 'Tata Motors Dealers', revenue: 8600, health: 74, stage: 'retail', volume: 2100 },
        { id: 'a-r6', name: 'Mahindra Dealers', revenue: 6800, health: 76, stage: 'retail', volume: 1700 },
      ]},
      { stage: 'consumer', label: 'End Consumers', icon: Users, companies: [
        { id: 'a-c1', name: 'Fleet Operators', revenue: 0, health: 0, stage: 'consumer', volume: 2400 },
        { id: 'a-c2', name: 'Individual Buyers', revenue: 0, health: 0, stage: 'consumer', volume: 9800 },
      ]},
    ],
  },
  {
    industryId: 'textile', industryName: 'Textiles & Garments',
    criticalVendors: 2, upstreamPct: 54, riskNodes: 1,
    alternatives: [
      { atRisk: 'Cotton Supply (Monsoon)', suggestions: ['Cotton Corp of India', 'Vardhman Textiles', 'Welspun Cotton'] },
    ],
    stages: [
      { stage: 'raw', label: 'Raw Materials', icon: Boxes, companies: [
        { id: 't-r1', name: 'Cotton Corp of India', revenue: 18000, health: 76, stage: 'raw', volume: 6400 },
        { id: 't-r2', name: 'Reliance Petrochemicals', revenue: 142000, health: 88, stage: 'raw', volume: 4200 },
      ]},
      { stage: 'mfg', label: 'Manufacturers', icon: Factory, companies: [
        { id: 't-m1', name: 'Arvind Ltd', revenue: 8200, health: 70, stage: 'mfg', volume: 2200 },
        { id: 't-m2', name: 'Welspun India', revenue: 7400, health: 78, stage: 'mfg', volume: 1900 },
        { id: 't-m3', name: 'Raymond Ltd', revenue: 5800, health: 75, stage: 'mfg', volume: 1400 },
      ]},
      { stage: 'dist', label: 'Distributors', icon: Truck, companies: [
        { id: 't-d1', name: 'Vardhman Textiles', revenue: 4200, health: 82, stage: 'dist', volume: 1800 },
        { id: 't-d2', name: 'Trident Group', revenue: 5400, health: 71, stage: 'dist', volume: 1200 },
      ]},
      { stage: 'retail', label: 'Retailers', icon: Store, companies: [
        { id: 't-r4', name: 'Reliance Trends', revenue: 6800, health: 80, stage: 'retail', volume: 1600 },
        { id: 't-r5', name: 'Shoppers Stop', revenue: 3200, health: 73, stage: 'retail', volume: 900 },
      ]},
      { stage: 'consumer', label: 'End Consumers', icon: Users, companies: [
        { id: 't-c1', name: 'Domestic Market', revenue: 0, health: 0, stage: 'consumer', volume: 4800 },
        { id: 't-c2', name: 'Export Market', revenue: 0, health: 0, stage: 'consumer', volume: 3200 },
      ]},
    ],
  },
  {
    industryId: 'mfg', industryName: 'Heavy Manufacturing',
    criticalVendors: 3, upstreamPct: 62, riskNodes: 2,
    alternatives: [
      { atRisk: 'Iron Ore (Hospet)', suggestions: ['NMDC Ltd', 'Vedanta Sesa Goa', 'Sandur Manganese'] },
      { atRisk: 'Coking Coal Imports', suggestions: ['Coal India Ltd', 'Tata Steel Long Products', 'JSW Steel Captive'] },
    ],
    stages: [
      { stage: 'raw', label: 'Raw Materials', icon: Boxes, companies: [
        { id: 'm-r1', name: 'NMDC Ltd', revenue: 22000, health: 84, stage: 'raw', volume: 8200 },
        { id: 'm-r2', name: 'Coal India', revenue: 138000, health: 78, stage: 'raw', volume: 12400 },
        { id: 'm-r3', name: 'Hindustan Zinc', revenue: 28000, health: 86, stage: 'raw', volume: 3400 },
      ]},
      { stage: 'mfg', label: 'Manufacturers', icon: Factory, companies: [
        { id: 'm-m1', name: 'Tata Steel', revenue: 230000, health: 85, stage: 'mfg', volume: 18200 },
        { id: 'm-m2', name: 'JSW Steel', revenue: 145000, health: 82, stage: 'mfg', volume: 12400 },
        { id: 'm-m3', name: 'Bharat Forge', revenue: 48000, health: 79, stage: 'mfg', volume: 4100 },
      ]},
      { stage: 'dist', label: 'Distributors', icon: Truck, companies: [
        { id: 'm-d1', name: 'Mistry Distributors', revenue: 2200, health: 73, stage: 'dist', volume: 1800 },
        { id: 'm-d2', name: 'Steel-Mart India', revenue: 1800, health: 70, stage: 'dist', volume: 1400 },
      ]},
      { stage: 'retail', label: 'Industrial Buyers', icon: Store, companies: [
        { id: 'm-r4', name: 'L&T Construction', revenue: 142000, health: 84, stage: 'retail', volume: 8400 },
        { id: 'm-r5', name: 'BHEL', revenue: 32000, health: 72, stage: 'retail', volume: 3200 },
      ]},
      { stage: 'consumer', label: 'End Consumers', icon: Users, companies: [
        { id: 'm-c1', name: 'Infrastructure Projects', revenue: 0, health: 0, stage: 'consumer', volume: 6800 },
        { id: 'm-c2', name: 'Capital Goods Makers', revenue: 0, health: 0, stage: 'consumer', volume: 4200 },
      ]},
    ],
  },
  {
    industryId: 'agri', industryName: 'Agriculture & Food',
    criticalVendors: 3, upstreamPct: 58, riskNodes: 2,
    alternatives: [
      { atRisk: 'Fertilizer Imports', suggestions: ['Coromandel International', 'Chambal Fertilisers', 'RCF Ltd'] },
      { atRisk: 'MSP Procurement', suggestions: ['FCI Godowns', 'NAFED Procurement', 'CWC Storage'] },
    ],
    stages: [
      { stage: 'raw', label: 'Raw Materials', icon: Boxes, companies: [
        { id: 'g-r1', name: 'Coromandel Intl', revenue: 14200, health: 78, stage: 'raw', volume: 3400 },
        { id: 'g-r2', name: 'UPL Ltd', revenue: 38400, health: 80, stage: 'raw', volume: 5800 },
        { id: 'g-r3', name: 'Seeds Corp India', revenue: 4200, health: 72, stage: 'raw', volume: 1200 },
      ]},
      { stage: 'mfg', label: 'Processors', icon: Factory, companies: [
        { id: 'g-m1', name: 'ITC Foods', revenue: 18000, health: 86, stage: 'mfg', volume: 3200 },
        { id: 'g-m2', name: 'Nestle India', revenue: 14200, health: 88, stage: 'mfg', volume: 2400 },
        { id: 'g-m3', name: 'Britannia', revenue: 12800, health: 84, stage: 'mfg', volume: 2100 },
      ]},
      { stage: 'dist', label: 'Distributors', icon: Truck, companies: [
        { id: 'g-d1', name: 'Reliance Fresh', revenue: 3400, health: 76, stage: 'dist', volume: 1900 },
        { id: 'g-d2', name: 'DMart Groceries', revenue: 5200, health: 80, stage: 'dist', volume: 2400 },
      ]},
      { stage: 'retail', label: 'Retailers', icon: Store, companies: [
        { id: 'g-r4', name: 'Big Bazaar Network', revenue: 2400, health: 62, stage: 'retail', volume: 1400 },
        { id: 'g-r5', name: 'Spencer\'s Retail', revenue: 1800, health: 71, stage: 'retail', volume: 900 },
      ]},
      { stage: 'consumer', label: 'End Consumers', icon: Users, companies: [
        { id: 'g-c1', name: 'Households (28 Cr+)', revenue: 0, health: 0, stage: 'consumer', volume: 18400 },
      ]},
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — INDUSTRY RELATIONSHIP MATRIX (10×10)
// ═══════════════════════════════════════════════════════════════════════════════

const INDUSTRY_IDS: IndustryId[] = ['mfg', 'it', 'pharma', 'auto', 'textile', 'agri', 'bank', 'retail', 'const', 'telecom']

const INDUSTRY_MATRIX: Record<IndustryId, Record<IndustryId, number>> = {
  mfg:    { mfg: 100, it: 62, pharma: 38, auto: 84, textile: 48, agri: 28, bank: 78, retail: 32, const: 76, telecom: 22 },
  it:     { mfg: 62, it: 100, pharma: 56, auto: 72, textile: 38, agri: 44, bank: 88, retail: 78, const: 48, telecom: 92 },
  pharma: { mfg: 38, it: 56, pharma: 100, auto: 18, textile: 12, agri: 42, bank: 64, retail: 58, const: 16, telecom: 28 },
  auto:   { mfg: 84, it: 72, pharma: 18, auto: 100, textile: 24, agri: 14, bank: 72, retail: 68, const: 38, telecom: 52 },
  textile:{ mfg: 48, it: 38, pharma: 12, auto: 24, textile: 100, agri: 64, bank: 56, retail: 82, const: 22, telecom: 18 },
  agri:   { mfg: 28, it: 44, pharma: 42, auto: 14, textile: 64, agri: 100, bank: 68, retail: 76, const: 18, telecom: 22 },
  bank:   { mfg: 78, it: 88, pharma: 64, auto: 72, textile: 56, agri: 68, bank: 100, retail: 82, const: 74, telecom: 86 },
  retail: { mfg: 32, it: 78, pharma: 58, auto: 68, textile: 82, agri: 76, bank: 82, retail: 100, const: 28, telecom: 64 },
  const:  { mfg: 76, it: 48, pharma: 16, auto: 38, textile: 22, agri: 18, bank: 74, retail: 28, const: 100, telecom: 32 },
  telecom:{ mfg: 22, it: 92, pharma: 28, auto: 52, textile: 18, agri: 22, bank: 86, retail: 64, const: 32, telecom: 100 },
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — EMERGING INDUSTRIES
// ═══════════════════════════════════════════════════════════════════════════════

interface EmergingIndustry {
  id: string
  name: string
  icon: React.ElementType
  growth: number
  companies: number
  revenue: number
  investment: number
  trend: 'hot' | 'rising' | 'stable'
}

const EMERGING_INDUSTRIES: EmergingIndustry[] = [
  { id: 'ev', name: 'EV Manufacturing', icon: Zap, growth: 42.8, companies: 248, revenue: 38000, investment: 124000, trend: 'hot' },
  { id: 'renew', name: 'Renewable Energy', icon: Sparkles, growth: 34.6, companies: 412, revenue: 68000, investment: 285000, trend: 'hot' },
  { id: 'd2c', name: 'D2C Brands', icon: Store, growth: 28.4, companies: 1820, revenue: 24000, investment: 38000, trend: 'rising' },
  { id: 'saas', name: 'SaaS / Cloud', icon: Cpu, growth: 31.2, companies: 980, revenue: 42000, investment: 76000, trend: 'rising' },
  { id: 'fintech', name: 'FinTech', icon: IndianRupee, growth: 26.8, companies: 1240, revenue: 56000, investment: 94000, trend: 'rising' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

const COMPANIES_PER_DAY: number[] = [
  342, 410, 388, 452, 396, 478, 524, 488, 446, 412,
  468, 502, 538, 492, 456, 524, 578, 542, 488, 510,
  562, 598, 542, 510, 588, 624, 578, 532, 568, 612,
]

const NETWORK_DENSITY: number[] = [18.4, 19.2, 20.8, 22.1, 23.4, 25.2, 26.8, 28.4, 30.1, 31.6, 32.9, 34.2]
const NETWORK_DENSITY_LABELS: string[] = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

const TOP_CONNECTED: { name: string; connections: number; industry: string }[] = [
  { name: 'State Bank of India', connections: 1842, industry: 'Banking' },
  { name: 'HDFC Bank', connections: 1654, industry: 'Banking' },
  { name: 'Reliance Industries', connections: 1486, industry: 'Conglomerate' },
  { name: 'TCS Ltd', connections: 1342, industry: 'IT' },
  { name: 'Tata Steel', connections: 1198, industry: 'Manufacturing' },
  { name: 'ICICI Bank', connections: 1086, industry: 'Banking' },
  { name: 'Bharti Airtel', connections: 972, industry: 'Telecom' },
  { name: 'Infosys', connections: 894, industry: 'IT' },
  { name: 'Maruti Suzuki', connections: 812, industry: 'Automobile' },
  { name: 'Larsen & Toubro', connections: 748, industry: 'Construction' },
]

const BRIDGE_COMPANIES: { name: string; clusters: string[]; bridgingScore: number; industry: string }[] = [
  { name: 'Reliance Industries', clusters: ['Petrochem', 'Telecom', 'Retail'], bridgingScore: 94, industry: 'Conglomerate' },
  { name: 'Tata Sons', clusters: ['Steel', 'Auto', 'IT'], bridgingScore: 91, industry: 'Conglomerate' },
  { name: 'Aditya Birla Group', clusters: ['Cement', 'Textile', 'Telecom'], bridgingScore: 87, industry: 'Conglomerate' },
  { name: 'Bharti Enterprises', clusters: ['Telecom', 'Banking'], bridgingScore: 82, industry: 'Telecom' },
  { name: 'Mahindra Group', clusters: ['Auto', 'IT', 'Banking'], bridgingScore: 79, industry: 'Conglomerate' },
  { name: 'L&T Group', clusters: ['Construction', 'IT', 'Mfg'], bridgingScore: 76, industry: 'Construction' },
  { name: 'JSW Group', clusters: ['Steel', 'Energy', 'Cement'], bridgingScore: 72, industry: 'Manufacturing' },
  { name: 'Adani Group', clusters: ['Logistics', 'Energy', 'Ports'], bridgingScore: 70, industry: 'Infrastructure' },
  { name: 'Bajaj Group', clusters: ['Auto', 'Finance', 'Insurance'], bridgingScore: 68, industry: 'Conglomerate' },
  { name: 'Hinduja Group', clusters: ['Banking', 'Auto', 'IT'], bridgingScore: 64, industry: 'Conglomerate' },
]

const AI_INSIGHTS: { title: string; description: string; severity: 'info' | 'warning' | 'critical' | 'success'; icon: React.ElementType }[] = [
  { title: 'Manufacturing cluster shows 23% increase in cross-industry connections this month',
    description: 'Manufacturing is now linking with 8 industries (up from 6), driven by Tata Steel and JSW expanding into renewables and EV supply chains.',
    severity: 'success', icon: TrendingUp },
  { title: 'Pharma supply chain has 2 critical single points of failure',
    description: 'Active Pharma Ingredient (API) imports and solvent supply both depend on a single Chinese vendor — alternative domestic sourcing recommended.',
    severity: 'critical', icon: AlertTriangle },
  { title: 'IT / ITeS industry has highest network centrality',
    description: 'Betweenness centrality 0.84 — IT firms act as the primary bridge between Banking, Telecom and Retail clusters in the graph.',
    severity: 'info', icon: Network },
  { title: '342 new companies joined the Banking cluster this week',
    description: 'Driven by FinTech NBFC registrations and PM Vishwakarma Yojana enrollments — Banking now connects to all 9 other industries.',
    severity: 'success', icon: Users },
  { title: 'Automobile supply chain risk up 12% due to chip shortage propagation',
    description: 'Vodafone Idea distress + Taiwan chip dependency is cascading — 4 downstream auto vendors flagged amber, expect 18-22 day delays.',
    severity: 'warning', icon: AlertOctagon },
]

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE UPDATES COUNTER (Tab 1 hero)
// ═══════════════════════════════════════════════════════════════════════════════

function useLiveUpdates(initialPerSec: number) {
  const [perSec, setPerSec] = useState(initialPerSec)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setPerSec(prev => Math.max(8, Math.min(48, prev + Math.round((Math.random() - 0.5) * 8))))
      setTotal(prev => prev + perSec)
    }, 1000)
    return () => clearInterval(id)
  }, [perSec])
  return { perSec, total }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL SVG COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HealthGauge({ value, size = 56 }: { value: number; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c - (pct / 100) * c
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {Math.round(pct)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: LIVE ECONOMIC GRAPH SVG
// ═══════════════════════════════════════════════════════════════════════════════

interface GraphTooltip {
  x: number
  y: number
  content: { name: string; revenue: number; connections: number; industry: string; hq: string }
}

function LiveEconomicGraph() {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<CompanyNode | null>(null)
  const [tooltip, setTooltip] = useState<GraphTooltip | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const { perSec, total } = useLiveUpdates(24)
  const totalCompanies = useCountUp(5000000)
  const totalRelationships = useCountUp(1000000000)

  const nodes = useMemo(() => COMPANY_NODES.map(n => {
    const cluster = INDUSTRY_CLUSTERS.find(c => c.id === n.cluster)!
    return { ...n, x: cluster.cx + n.dx, y: cluster.cy + n.dy, clusterColor: cluster.color }
  }), [])

  const nodeById = useMemo(() => {
    const map: Record<string, typeof nodes[number]> = {}
    nodes.forEach(n => { map[n.id] = n })
    return map
  }, [nodes])

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
  }
  const handleMouseUp = () => { dragging.current = false; setIsDragging(false) }

  const handleNodeHover = (e: React.MouseEvent, node: typeof nodes[number]) => {
    setHovered(node.id)
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        content: { name: node.name, revenue: node.revenue, connections: node.connections, industry: node.industry, hq: node.hq },
      })
    }
  }

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const selectedNode = selected ? nodeById[selected.id] : null

  return (
    <div className="space-y-4">
      {/* Hero */}
      <motion.div {...fadeUp}>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 overflow-hidden relative">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1" fill="#10b981" opacity="0.4" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-grid)" />
            </svg>
          </div>
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                    <span className="inline-block w-2 h-2 rounded-full bg-white mr-1.5 animate-pulse" />
                    LIVE
                  </Badge>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">Real-Time Economic Graph</Badge>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                  India&apos;s Economic Graph — Real-Time Business Ecosystem Map
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Palantir Foundry + Bloomberg Terminal for Indian business. Mapping every company, invoice, payment and supply chain in the nation — AI understands the entire business ecosystem.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">Live Updates / sec</div>
                <div className="flex items-baseline gap-2">
                  <motion.span
                    key={perSec}
                    initial={{ opacity: 0.5, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold text-emerald-600 tabular-nums"
                  >
                    {perSec}
                  </motion.span>
                  <span className="text-xs text-slate-500">events/sec</span>
                </div>
                <div className="text-xs text-slate-500">{formatNum(total)} processed this session</div>
              </div>
            </div>

            <Separator className="my-4 bg-emerald-200/60" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HeroStat label="Companies Mapped" value={`${(totalCompanies / 100000).toFixed(2)} L+`} sub="50,00,000+ live entities" />
              <HeroStat label="Relationships" value={`${(totalRelationships / 100000000).toFixed(0)} Cr+`} sub="100 Crore+ edges" />
              <HeroStat label="Industries Tracked" value="5,000+" sub="Across 28 states" />
              <HeroStat label="Graph Health" value="94.2%" sub="Network integrity" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Graph visualization */}
        <motion.div className="lg:col-span-2" custom={1} variants={staggerChild} initial="initial" animate="animate">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4 text-emerald-600" />
                  Economic Graph Topology
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetView}>
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div
                className="relative w-full overflow-hidden rounded-md bg-slate-50 border border-slate-200"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHovered(null); setTooltip(null) }}
              >
                <svg
                  ref={svgRef}
                  viewBox="0 0 700 500"
                  className="w-full h-auto"
                  style={{ aspectRatio: '700 / 500' }}
                >
                  <defs>
                    <radialGradient id="cluster-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </radialGradient>
                    <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.25" />
                    </filter>
                  </defs>

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Cluster background circles */}
                    {INDUSTRY_CLUSTERS.map(c => (
                      <g key={`bg-${c.id}`}>
                        <circle cx={c.cx} cy={c.cy} r={62} fill={c.fill} stroke={c.color} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="3,4" />
                        <circle cx={c.cx} cy={c.cy} r={70} fill="url(#cluster-glow)" />
                      </g>
                    ))}

                    {/* Edges */}
                    {GRAPH_EDGES.map(e => {
                      const s = nodeById[e.source]
                      const t = nodeById[e.target]
                      if (!s || !t) return null
                      const col = EDGE_COLORS[e.type].stroke
                      const isActive = hovered === e.source || hovered === e.target || selected?.id === e.source || selected?.id === e.target
                      return (
                        <g key={e.id}>
                          <line
                            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                            stroke={col}
                            strokeWidth={isActive ? 2.5 : 1.2}
                            strokeOpacity={isActive ? 0.85 : 0.32}
                          />
                          {/* Animated pulse overlay */}
                          <motion.line
                            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                            stroke={col}
                            strokeWidth={isActive ? 2.5 : 1.5}
                            strokeDasharray="3,9"
                            strokeOpacity={isActive ? 0.95 : 0.55}
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: [-24, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                          />
                        </g>
                      )
                    })}

                    {/* Cluster labels */}
                    {INDUSTRY_CLUSTERS.map(c => (
                      <g key={`lbl-${c.id}`} pointerEvents="none">
                        <text x={c.cx} y={c.cy - 48} textAnchor="middle" className="fill-slate-700 font-semibold" style={{ fontSize: 10 }}>
                          {c.name}
                        </text>
                        <text x={c.cx} y={c.cy - 36} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8 }}>
                          {formatCompact(c.companies)} cos
                        </text>
                      </g>
                    ))}

                    {/* Cluster centers (industry nodes) */}
                    {INDUSTRY_CLUSTERS.map(c => (
                      <g key={`cn-${c.id}`}>
                        <circle cx={c.cx} cy={c.cy} r={14} fill={c.color} fillOpacity={0.9} stroke="white" strokeWidth={2} filter="url(#node-shadow)" />
                        <text x={c.cx} y={c.cy + 3} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 8 }}>
                          {c.shortName}
                        </text>
                      </g>
                    ))}

                    {/* Company nodes */}
                    {nodes.map(n => {
                      const isHovered = hovered === n.id
                      const isSelected = selected?.id === n.id
                      const r = 6 + Math.min(4, n.connections / 6)
                      const fill = n.status === 'risk' ? '#ef4444' : n.status === 'watch' ? '#f59e0b' : '#ffffff'
                      const stroke = n.status === 'risk' ? '#ef4444' : n.clusterColor
                      return (
                        <g
                          key={n.id}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => handleNodeHover(e, n)}
                          onMouseMove={(e) => handleNodeHover(e, n)}
                          onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                          onClick={() => setSelected(n)}
                        >
                          {(isHovered || isSelected) && (
                            <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke={stroke} strokeWidth={1.5} strokeOpacity={0.5}>
                              <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="1.8s" repeatCount="indefinite" />
                              <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" />
                            </circle>
                          )}
                          <circle
                            cx={n.x} cy={n.y} r={r}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isHovered || isSelected ? 2.5 : 1.6}
                            filter="url(#node-shadow)"
                          />
                          {n.status === 'risk' && (
                            <circle cx={n.x + r - 1} cy={n.y - r + 1} r={2.5} fill="#ef4444" stroke="white" strokeWidth={0.8} />
                          )}
                          {(isHovered || isSelected) && (
                            <text x={n.x} y={n.y - r - 5} textAnchor="middle" className="fill-slate-700 font-medium" style={{ fontSize: 8 }}>
                              {n.name.length > 16 ? n.name.substring(0, 14) + '…' : n.name}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                </svg>

                {/* Floating tooltip */}
                {tooltip && (
                  <div
                    className="absolute pointer-events-none z-20 bg-white border border-slate-200 shadow-lg rounded-md p-2 text-xs min-w-[160px]"
                    style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
                  >
                    <div className="font-semibold text-slate-900">{tooltip.content.name}</div>
                    <div className="text-slate-500 mt-0.5">{tooltip.content.industry} · {tooltip.content.hq}</div>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <div className="text-slate-500">Revenue:</div>
                      <div className="font-medium text-emerald-700 text-right">{formatINR(tooltip.content.revenue)}</div>
                      <div className="text-slate-500">Connections:</div>
                      <div className="font-medium text-slate-800 text-right">{tooltip.content.connections}</div>
                    </div>
                  </div>
                )}

                {/* Zoom indicator */}
                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-600 font-mono border border-slate-200">
                  {Math.round(zoom * 100)}% · {nodes.length} nodes · {GRAPH_EDGES.length} edges
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column: legend + selected node panel */}
        <motion.div className="space-y-4" custom={2} variants={staggerChild} initial="initial" animate="animate">
          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Edge Types</div>
                <div className="space-y-1.5">
                  {Object.entries(EDGE_COLORS).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <svg width="28" height="10" className="flex-shrink-0">
                        <line x1="0" y1="5" x2="28" y2="5" stroke={val.stroke} strokeWidth="2.5" strokeDasharray="3,4" />
                      </svg>
                      <span className="text-slate-700 font-medium">{val.label}</span>
                      <span className="text-slate-400 text-[10px] ml-auto">{val.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Node Types</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-slate-700">Industry Cluster Center</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-white border-2 border-emerald-500 inline-block" />
                    <span className="text-slate-700">Healthy Company</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-white border-2 border-amber-500 inline-block" />
                    <span className="text-slate-700">Watch List</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    <span className="text-slate-700">At-Risk Company</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Node Size</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  Proportional to connection count (degree centrality). Larger nodes have more trade relationships.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected node panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-600" />
                Company Profile
              </CardTitle>
              <CardDescription className="text-xs">
                {selected ? 'Click any node to inspect' : 'Click any node to inspect'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <AnimatePresence mode="wait">
                {selectedNode ? (
                  <motion.div
                    key={selectedNode.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: selectedNode.clusterColor }}
                      >
                        {selectedNode.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm leading-tight">{selectedNode.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{selectedNode.industry}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{selectedNode.gstin}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-[10px] uppercase text-slate-500">Revenue</div>
                        <div className="text-sm font-bold text-emerald-700">{formatINR(selectedNode.revenue)}</div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-[10px] uppercase text-slate-500">Connections</div>
                        <div className="text-sm font-bold text-slate-800">{selectedNode.connections}</div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-[10px] uppercase text-slate-500">HQ</div>
                        <div className="text-sm font-medium text-slate-800">{selectedNode.hq}</div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-[10px] uppercase text-slate-500">Status</div>
                        <Badge variant="outline" className={
                          selectedNode.status === 'risk' ? 'border-red-300 text-red-700 bg-red-50' :
                          selectedNode.status === 'watch' ? 'border-amber-300 text-amber-700 bg-amber-50' :
                          'border-emerald-300 text-emerald-700 bg-emerald-50'
                        }>
                          {selectedNode.status === 'risk' ? 'At-Risk' : selectedNode.status === 'watch' ? 'Watch' : 'Healthy'}
                        </Badge>
                      </div>
                    </div>

                    {/* Connected entities */}
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">Connected Entities</div>
                      <ScrollArea className="max-h-32">
                        <div className="space-y-1">
                          {GRAPH_EDGES
                            .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                            .slice(0, 6)
                            .map(e => {
                              const other = nodeById[e.source === selectedNode.id ? e.target : e.source]
                              if (!other) return null
                              return (
                                <div key={e.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50">
                                  <span className="text-slate-700 truncate">{other.name}</span>
                                  <Badge variant="outline" className="ml-2 text-[10px] flex-shrink-0" style={{ color: EDGE_COLORS[e.type].stroke, borderColor: EDGE_COLORS[e.type].stroke }}>
                                    {e.type}
                                  </Badge>
                                </div>
                              )
                            })}
                        </div>
                      </ScrollArea>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-slate-400"
                  >
                    <CircleDot className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div className="text-xs">Click a company node in the graph to view its profile</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white/60 backdrop-blur rounded-lg p-3 border border-emerald-200/50">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: SUPPLY CHAIN EXPLORER
// ═══════════════════════════════════════════════════════════════════════════════

function SupplyChainExplorer() {
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryId>('pharma')
  const chain = useMemo(() => SUPPLY_CHAINS.find(s => s.industryId === selectedIndustry)!, [selectedIndustry])

  const STAGE_X = [110, 280, 450, 620, 790]
  const STAGE_Y = 250
  const STAGE_W = 140
  const STAGE_H = 240

  const stageNodes = useMemo(() => {
    return chain.stages.map((stage, si) => {
      const companies = stage.companies
      const spacing = STAGE_H / (companies.length + 1)
      return companies.map((c, i) => ({
        ...c,
        x: STAGE_X[si],
        y: STAGE_Y - STAGE_H / 2 + spacing * (i + 1),
      }))
    })
  }, [chain])

  return (
    <div className="space-y-4">
      <motion.div {...fadeUp}>
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-xl font-bold text-slate-900">Supply Chain Explorer</h2>
                </div>
                <p className="text-sm text-slate-600">Trace the full value chain — from raw materials to end consumers — for any Indian industry.</p>
              </div>
              <div className="w-full sm:w-72">
                <Select value={selectedIndustry} onValueChange={(v) => setSelectedIndustry(v as IndustryId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLY_CHAINS.map(s => (
                      <SelectItem key={s.industryId} value={s.industryId}>{s.industryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Risk + Critical dependency cards */}
      <motion.div custom={1} variants={staggerChild} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={chain.riskNodes > 0 ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${chain.riskNodes > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
              <span className="text-xs uppercase font-semibold text-slate-600">Supply Chain Risk</span>
            </div>
            <div className={`text-2xl font-bold ${chain.riskNodes > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {chain.riskNodes > 0 ? `${chain.riskNodes} At-Risk Nodes` : 'Healthy'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {chain.riskNodes > 0
                ? `${chain.riskNodes} vendor${chain.riskNodes > 1 ? 's' : ''} flagged for distress propagation`
                : 'No critical risk nodes detected in this chain'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-amber-600" />
              <span className="text-xs uppercase font-semibold text-slate-600">Critical Dependency</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">{chain.criticalVendors} Vendors</div>
            <div className="text-xs text-slate-500 mt-1">
              This supply chain depends on {chain.criticalVendors} critical vendors representing <span className="font-semibold text-amber-700">{chain.upstreamPct}%</span> of upstream supply
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-emerald-600" />
              <span className="text-xs uppercase font-semibold text-slate-600">Chain Stages</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{chain.stages.length}</div>
            <div className="text-xs text-slate-500 mt-1">
              {chain.stages.reduce((acc, s) => acc + s.companies.length, 0)} companies mapped across the full chain
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Supply chain flow SVG */}
      <motion.div custom={2} variants={staggerChild} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-emerald-600" />
              {chain.industryName} — End-to-End Value Chain
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 900 480" className="w-full h-auto" style={{ minWidth: 760 }}>
                <defs>
                  <linearGradient id="stage-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0fdf4" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                  <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#10b981" opacity="0.6" />
                  </marker>
                </defs>

                {/* Stage columns */}
                {chain.stages.map((stage, si) => (
                  <g key={stage.stage}>
                    <rect
                      x={STAGE_X[si] - STAGE_W / 2} y={STAGE_Y - STAGE_H / 2 - 30}
                      width={STAGE_W} height={STAGE_H + 40}
                      fill="url(#stage-bg)"
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      rx={8}
                    />
                    {/* Stage header */}
                    <g>
                      <rect x={STAGE_X[si] - STAGE_W / 2 + 8} y={STAGE_Y - STAGE_H / 2 - 22} width={STAGE_W - 16} height={26} rx={4} fill="#10b981" />
                      <text x={STAGE_X[si]} y={STAGE_Y - STAGE_H / 2 - 5} textAnchor="middle" className="fill-white font-semibold" style={{ fontSize: 10 }}>
                        {stage.label}
                      </text>
                    </g>
                    {/* Connector arrows between stages */}
                    {si < chain.stages.length - 1 && (
                      <motion.line
                        x1={STAGE_X[si] + STAGE_W / 2} y1={STAGE_Y}
                        x2={STAGE_X[si + 1] - STAGE_W / 2} y2={STAGE_Y}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeOpacity={0.5}
                        markerEnd="url(#flow-arrow)"
                        strokeDasharray="6,4"
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: [-20, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    {/* Companies in stage */}
                    {stageNodes[si].map(node => {
                      const isRisk = node.health > 0 && node.health < 50
                      const isWatch = node.health >= 50 && node.health < 75
                      const fill = isRisk ? '#fef2f2' : isWatch ? '#fffbeb' : '#ffffff'
                      const stroke = isRisk ? '#ef4444' : isWatch ? '#f59e0b' : '#10b981'
                      return (
                        <g key={node.id}>
                          <rect
                            x={STAGE_X[si] - STAGE_W / 2 + 8} y={node.y - 18}
                            width={STAGE_W - 16} height={36}
                            rx={5}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isRisk ? 1.8 : 1.2}
                          />
                          <text x={STAGE_X[si]} y={node.y - 4} textAnchor="middle" className="fill-slate-800 font-medium" style={{ fontSize: 9 }}>
                            {node.name.length > 18 ? node.name.substring(0, 16) + '…' : node.name}
                          </text>
                          {node.revenue > 0 ? (
                            <text x={STAGE_X[si]} y={node.y + 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 8 }}>
                              {formatINR(node.revenue)} · {node.health}%
                            </text>
                          ) : (
                            <text x={STAGE_X[si]} y={node.y + 8} textAnchor="middle" className="fill-emerald-700 font-semibold" style={{ fontSize: 8 }}>
                              {formatCompact(node.volume)} volume
                            </text>
                          )}
                          {isRisk && (
                            <circle cx={STAGE_X[si] + STAGE_W / 2 - 12} cy={node.y - 14} r={3} fill="#ef4444">
                              <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                            </circle>
                          )}
                        </g>
                      )
                    })}
                  </g>
                ))}

                {/* Inter-stage transaction flows (curved connectors) */}
                {chain.stages.slice(0, -1).map((_, si) => {
                  const fromNodes = stageNodes[si]
                  const toNodes = stageNodes[si + 1]
                  const lines = Math.min(3, fromNodes.length, toNodes.length)
                  return Array.from({ length: lines }).map((_, li) => {
                    const from = fromNodes[Math.floor((li / lines) * fromNodes.length)]
                    const to = toNodes[Math.floor((li / lines) * toNodes.length)]
                    if (!from || !to) return null
                    const midX = (from.x + to.x) / 2
                    return (
                      <motion.path
                        key={`flow-${si}-${li}`}
                        d={`M ${from.x + STAGE_W / 2 - 8} ${from.y} Q ${midX} ${(from.y + to.y) / 2 + (li - 1) * 8} ${to.x - STAGE_W / 2 + 8} ${to.y}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={1}
                        strokeOpacity={0.3}
                        strokeDasharray="3,5"
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: [-16, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: li * 0.3 }}
                      />
                    )
                  })
                })}

                {/* Volume labels */}
                {chain.stages.slice(0, -1).map((_, si) => (
                  <text key={`vol-${si}`} x={(STAGE_X[si] + STAGE_X[si + 1]) / 2} y={STAGE_Y - STAGE_H / 2 - 35} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8 }}>
                    {formatCompact(stageNodes[si].reduce((a, n) => a + n.volume, 0))} tx
                  </text>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Alternative suppliers */}
      {chain.alternatives.length > 0 && (
        <motion.div custom={3} variants={staggerChild} initial="initial" animate="animate">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Alternative Supplier Suggestions
              </CardTitle>
              <CardDescription className="text-xs">
                AI-recommended domestic alternatives for at-risk nodes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chain.alternatives.map((alt, i) => (
                  <div key={i} className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700">At-Risk: {alt.atRisk}</span>
                    </div>
                    <div className="text-[10px] uppercase text-slate-500 font-medium mb-2">Suggested Alternatives</div>
                    <div className="space-y-1.5">
                      {alt.suggestions.map((s, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded px-2 py-1.5">
                          <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700">{s}</span>
                          <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-[10px]">Connect</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: INDUSTRY NETWORK INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

function IndustryNetworkIntelligence() {
  return (
    <div className="space-y-4">
      {/* Industry cards grid */}
      <motion.div {...fadeUp}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {INDUSTRY_CLUSTERS.map((ind, i) => (
            <motion.div key={ind.id} custom={i} variants={staggerChild} initial="initial" animate="animate">
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ind.color + '20' }}>
                        <Building2 className="h-4 w-4" style={{ color: ind.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{ind.name}</div>
                        <div className="text-[10px] text-slate-500">{formatCompact(ind.companies)} companies</div>
                      </div>
                    </div>
                    <HealthGauge value={ind.health} size={44} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-[10px] uppercase text-slate-500">Total Revenue</div>
                      <div className="text-sm font-bold text-slate-900">{formatINR(ind.revenue)}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-[10px] uppercase text-slate-500">Avg Growth</div>
                      <div className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +{ind.growth}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-medium mb-1.5">Top Companies</div>
                    <div className="space-y-1">
                      {ind.topCompanies.map((c, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-mono w-3">{j + 1}.</span>
                          <span className="text-slate-700 truncate">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Link2 className="h-3 w-3" />
                      <span>{ind.connectedIndustries} connected industries</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <IndianRupee className="h-3 w-3" />
                      <span>₹{ind.avgRevenue}L avg</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Industry relationship matrix */}
      <motion.div custom={INDUSTRY_CLUSTERS.length} variants={staggerChild} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-emerald-600" />
              Industry Relationship Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Heatmap of inter-industry connection strength (0–100). Darker cells = stronger trade relationships.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 540 460" className="w-full h-auto" style={{ minWidth: 480 }}>
                {/* Column headers */}
                {INDUSTRY_IDS.map((id, i) => {
                  const ind = INDUSTRY_CLUSTERS.find(c => c.id === id)!
                  return (
                    <text
                      key={`col-${id}`}
                      x={120 + i * 40 + 20}
                      y={86}
                      textAnchor="end"
                      transform={`rotate(-45, ${120 + i * 40 + 20}, 86)`}
                      className="fill-slate-600 font-medium"
                      style={{ fontSize: 9 }}
                    >
                      {ind.shortName}
                    </text>
                  )
                })}
                {/* Row headers + cells */}
                {INDUSTRY_IDS.map((rowId, ri) => {
                  const rowInd = INDUSTRY_CLUSTERS.find(c => c.id === rowId)!
                  return (
                    <g key={`row-${rowId}`}>
                      <text x={114} y={100 + ri * 32 + 18} textAnchor="end" className="fill-slate-700 font-medium" style={{ fontSize: 10 }}>
                        {rowInd.shortName}
                      </text>
                      {INDUSTRY_IDS.map((colId, ci) => {
                        const val = INDUSTRY_MATRIX[rowId][colId]
                        const opacity = val / 100
                        const isDiagonal = rowId === colId
                        const color = isDiagonal ? '#64748b' : '#10b981'
                        return (
                          <g key={`cell-${rowId}-${colId}`}>
                            <motion.rect
                              x={120 + ci * 40}
                              y={100 + ri * 32}
                              width={36}
                              height={28}
                              rx={3}
                              fill={color}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: isDiagonal ? 0.15 : 0.15 + opacity * 0.85 }}
                              transition={{ delay: (ri * 10 + ci) * 0.012, duration: 0.4 }}
                            />
                            {!isDiagonal && val > 0 && (
                              <text x={120 + ci * 40 + 18} y={100 + ri * 32 + 18} textAnchor="middle" className="fill-white font-medium" style={{ fontSize: 9 }}>
                                {val}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
                {/* Legend */}
                <g transform="translate(120, 432)">
                  <text x={0} y={0} className="fill-slate-500" style={{ fontSize: 9 }}>Weak</text>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <rect key={i} x={32 + i * 14} y={-10} width={14} height={10} fill="#10b981" opacity={0.15 + (i / 10) * 0.85} />
                  ))}
                  <text x={184} y={0} className="fill-slate-500" style={{ fontSize: 9 }}>Strong</text>
                </g>
              </svg>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Emerging industries */}
      <motion.div custom={INDUSTRY_CLUSTERS.length + 1} variants={staggerChild} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Emerging Industries
            </CardTitle>
            <CardDescription className="text-xs">
              High-growth sectors reshaping the Indian economy — newly mapped nodes in the graph
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {EMERGING_INDUSTRIES.map((e, i) => (
                <motion.div
                  key={e.id}
                  custom={i}
                  variants={staggerChild}
                  initial="initial"
                  animate="animate"
                  className="border border-emerald-200 rounded-lg p-3 bg-gradient-to-br from-emerald-50/60 to-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
                      <e.icon className="h-4 w-4 text-emerald-700" />
                    </div>
                    {e.trend === 'hot' && (
                      <Badge className="bg-red-500 hover:bg-red-500 text-white text-[9px] px-1.5 py-0">HOT</Badge>
                    )}
                  </div>
                  <div className="font-semibold text-sm text-slate-900 leading-tight">{e.name}</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1.5">+{e.growth}%</div>
                  <div className="text-[10px] text-slate-500">YoY growth</div>
                  <Separator className="my-2" />
                  <div className="space-y-0.5 text-[10px] text-slate-600">
                    <div className="flex justify-between"><span>Companies:</span><span className="font-medium text-slate-800">{formatNum(e.companies)}</span></div>
                    <div className="flex justify-between"><span>Revenue:</span><span className="font-medium text-slate-800">{formatINR(e.revenue)}</span></div>
                    <div className="flex justify-between"><span>Investment:</span><span className="font-medium text-emerald-700">{formatINR(e.investment)}</span></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: GRAPH ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function CompaniesAddedLineChart() {
  const data = COMPANIES_PER_DAY
  const w = 720, h = 220
  const padL = 50, padR = 16, padT = 16, padB = 36
  const cw = w - padL - padR
  const ch = h - padT - padB
  const max = Math.max(...data) * 1.15
  const min = Math.min(...data) * 0.85

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * cw,
    y: padT + ch - ((v - min) / (max - min)) * ch,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${padT + ch} L${pts[0].x},${padT + ch} Z`

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(f => padT + ch - f * ch)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="companies-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeWidth={1} />
          <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 9 }}>
            {Math.round(max - (max - min) * (i / 4))}
          </text>
        </g>
      ))}
      {/* X axis labels */}
      {[0, 6, 12, 18, 24, 29].map(i => (
        <text key={i} x={padL + (i / 29) * cw} y={h - 12} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
          Day {i + 1}
        </text>
      ))}
      {/* Area */}
      <motion.path
        d={areaPath}
        fill="url(#companies-grad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      />
      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />
      {/* Data points */}
      {pts.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === pts.length - 1 ? 4 : 2}
          fill="#10b981"
          stroke="white"
          strokeWidth={1}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.02 }}
        />
      ))}
      {/* Latest value label */}
      <text x={pts[pts.length - 1].x - 6} y={pts[pts.length - 1].y - 8} textAnchor="end" className="fill-emerald-700 font-bold" style={{ fontSize: 10 }}>
        {data[data.length - 1]} cos
      </text>
    </svg>
  )
}

function TopConnectedBarChart() {
  const data = TOP_CONNECTED
  const max = Math.max(...data.map(d => d.connections))
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <motion.div
          key={d.name}
          custom={i}
          variants={staggerChild}
          initial="initial"
          animate="animate"
          className="flex items-center gap-3"
        >
          <div className="flex-shrink-0 w-6 text-xs font-mono text-slate-400">#{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-xs font-medium text-slate-800 truncate">{d.name}</span>
              <span className="text-xs text-slate-500 flex-shrink-0">{d.industry}</span>
            </div>
            <div className="relative h-4 bg-slate-100 rounded overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded"
                initial={{ width: 0 }}
                animate={{ width: `${(d.connections / max) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-white tabular-nums">
                {d.connections}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function NetworkDensityChart() {
  const data = NETWORK_DENSITY
  const labels = NETWORK_DENSITY_LABELS
  const w = 720, h = 200
  const padL = 40, padR = 16, padT = 16, padB = 30
  const cw = w - padL - padR
  const ch = h - padT - padB
  const max = Math.max(...data) * 1.1
  const min = 0

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * cw,
    y: padT + ch - ((v - min) / (max - min)) * ch,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="density-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={padL} y1={padT + ch - f * ch} x2={w - padR} y2={padT + ch - f * ch} stroke="#e2e8f0" strokeWidth={1} />
          <text x={padL - 6} y={padT + ch - f * ch + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 9 }}>
            {Math.round(max * f)}%
          </text>
        </g>
      ))}
      {/* Area */}
      <path
        d={`${linePath} L${pts[pts.length - 1].x},${padT + ch} L${pts[0].x},${padT + ch} Z`}
        fill="url(#density-grad)"
      />
      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />
      {/* Points + labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <motion.circle
            cx={p.x} cy={p.y} r={3}
            fill="#0d9488" stroke="white" strokeWidth={1}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.05 }}
          />
          <text x={p.x} y={h - 10} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}

function GraphAnalytics() {
  const metrics = [
    { label: 'Avg Degree', value: '12.4', sub: 'Connections per node', icon: Link2, color: '#10b981' },
    { label: 'Clustering Coefficient', value: '0.34', sub: 'Triangle density', icon: Network, color: '#14b8a6' },
    { label: 'Graph Diameter', value: '6 hops', sub: 'Max shortest path', icon: Waypoints, color: '#0d9488' },
    { label: 'Components', value: '1', sub: 'Fully connected', icon: GitBranch, color: '#059669' },
  ]

  return (
    <div className="space-y-4">
      {/* Graph metric cards */}
      <motion.div {...fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} custom={i} variants={staggerChild} initial="initial" animate="animate">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: m.color + '20' }}>
                    <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                  </div>
                  <span className="text-xs uppercase font-semibold text-slate-600">{m.label}</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">{m.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{m.sub}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div custom={1} variants={staggerChild} initial="initial" animate="animate">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Companies Added to Graph (30 Days)
              </CardTitle>
              <CardDescription className="text-xs">
                {formatNum(COMPANIES_PER_DAY.reduce((a, b) => a + b, 0))} new nodes added in last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <CompaniesAddedLineChart />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={2} variants={staggerChild} initial="initial" animate="animate">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                Top 10 Most Connected Companies
              </CardTitle>
              <CardDescription className="text-xs">
                Highest degree centrality — these entities act as economic hubs
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <ScrollArea className="max-h-[260px]">
                <TopConnectedBarChart />
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Network density chart + AI insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div className="lg:col-span-2" custom={3} variants={staggerChild} initial="initial" animate="animate">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-600" />
                Network Density Over Time (12 Months)
              </CardTitle>
              <CardDescription className="text-xs">
                Density = actual edges ÷ possible edges. Higher = more interconnected economy.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <NetworkDensityChart />
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Insights */}
        <motion.div custom={4} variants={staggerChild} initial="initial" animate="animate">
          <Card className="h-full border-emerald-200 bg-gradient-to-b from-emerald-50/40 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                AI Insights
              </CardTitle>
              <CardDescription className="text-xs">
                Generated by Economic Graph AI
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ScrollArea className="max-h-[280px] pr-3">
                <div className="space-y-2.5">
                  {AI_INSIGHTS.map((ins, i) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={staggerChild}
                      initial="initial"
                      animate="animate"
                      className={`border rounded-md p-2.5 ${
                        ins.severity === 'critical' ? 'border-red-200 bg-red-50/50' :
                        ins.severity === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                        ins.severity === 'success' ? 'border-emerald-200 bg-emerald-50/50' :
                        'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <ins.icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                          ins.severity === 'critical' ? 'text-red-600' :
                          ins.severity === 'warning' ? 'text-amber-600' :
                          ins.severity === 'success' ? 'text-emerald-600' :
                          'text-slate-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 leading-snug">{ins.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-snug">{ins.description}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top 10 bridge companies */}
      <motion.div custom={5} variants={staggerChild} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-emerald-600" />
              Top 10 Bridge Companies
            </CardTitle>
            <CardDescription className="text-xs">
              Entities that connect otherwise-disconnected industry clusters — critical to graph integrity
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BRIDGE_COMPANIES.map((b, i) => (
                <motion.div
                  key={b.name}
                  custom={i}
                  variants={staggerChild}
                  initial="initial"
                  animate="animate"
                  className="border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{b.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                      Score {b.bridgingScore}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2">{b.industry}</div>
                  <div className="flex flex-wrap gap-1">
                    {b.clusters.map(c => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EconomicGraphPage() {
  const [tab, setTab] = useState('live-graph')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {/* Page header */}
        <motion.div {...fadeUp} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">GSTPilot Economic Graph</h1>
                <p className="text-xs text-slate-500">Real-Time Business Ecosystem Map of India</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Graph Live
            </Badge>
            <Badge variant="outline" className="border-slate-300 text-slate-600">
              <Clock className="h-3 w-3 mr-1" />
              Sync: just now
            </Badge>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="live-graph" className="flex items-center gap-1.5 py-2">
              <Network className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Live Economic Graph</span>
              <span className="sm:hidden">Live Graph</span>
            </TabsTrigger>
            <TabsTrigger value="supply-chain" className="flex items-center gap-1.5 py-2">
              <Workflow className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Supply Chain Explorer</span>
              <span className="sm:hidden">Supply Chain</span>
            </TabsTrigger>
            <TabsTrigger value="industry-network" className="flex items-center gap-1.5 py-2">
              <Boxes className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Industry Network</span>
              <span className="sm:hidden">Industries</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 py-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Graph Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live-graph" className="space-y-4 mt-0">
            <LiveEconomicGraph />
          </TabsContent>
          <TabsContent value="supply-chain" className="space-y-4 mt-0">
            <SupplyChainExplorer />
          </TabsContent>
          <TabsContent value="industry-network" className="space-y-4 mt-0">
            <IndustryNetworkIntelligence />
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4 mt-0">
            <GraphAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
