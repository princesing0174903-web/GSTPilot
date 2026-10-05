'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Search, Building2, ShieldCheck, Fingerprint, QrCode, BadgeCheck,
  TrendingUp, Users, IndianRupee, MapPin, Landmark, Network, Activity,
  Sparkles, Crown, ChevronRight, CheckCircle2, AlertTriangle, ArrowUpRight,
  ArrowRight, FileCheck, CreditCard, Link2, BarChart3, Globe2, Layers,
  Zap, Award, Briefcase, Stethoscope, ShoppingBag, Wheat, Wrench, Cpu,
  Gauge, Waypoints, ScanLine, Hash, LineChart, PieChart, Target,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Indian number / currency formatting
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L'
  return '₹' + n.toLocaleString('en-IN')
}

const fmtNum = (n: number) => n.toLocaleString('en-IN')

const fmtDate = (d: string) => {
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

// Score → color (emerald / amber / red)
const scoreColor = (s: number) => {
  if (s >= 75) return { hex: '#2563EB', text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'Excellent' }
  if (s >= 50) return { hex: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200', label: 'Moderate' }
  return { hex: '#ef4444', text: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-200', label: 'High Risk' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerChild = (i: number) => ({
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
})

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const start = fromRef.current
    const startTime = performance.now()
    const diff = target - start
    let raf = 0
    const step = (t: number) => {
      const elapsed = t - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(start + diff * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return count
}

function AnimatedScore({ value, decimals = 0, prefix = '', suffix = '' }: {
  value: number; decimals?: number; prefix?: string; suffix?: string
}) {
  const c = useCountUp(value)
  return <>{prefix}{c.toFixed(decimals)}{suffix}</>
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS DIRECTORY DATA
// ═══════════════════════════════════════════════════════════════════════════════
// Previously this module shipped a hardcoded array of 12 REAL Indian listed
// companies (TCS, Infosys, HDFC, Reliance, SBI, Bharti Airtel, Maruti Suzuki,
// Asian Paints, Bajaj Finance, Wipro, Mahindra & Mahindra, Adani Power) with
// fabricated trust / compliance / payment / growth scores, fabricated turnover,
// employee counts, and loan counts. Publishing fabricated financial scores for
// real, named companies is defamatory and presents fake data as real.
// The array is now empty until the user connects real partners.
// TODO: Replace with real data from /api/business-network when available.

interface Business {
  ubid: string
  name: string
  gstin: string
  pan: string
  cin: string
  incorporated: string
  industry: string
  industryKey: string
  hq: string
  state: string
  trustScore: number
  complianceScore: number
  paymentScore: number
  growthScore: number
  verified: boolean
  verificationTier: 'Platinum' | 'Gold' | 'Silver' | 'Verified'
  employees: number
  annualTurnover: number
  bankAccounts: number
  activeLoans: number
  tradePartners: number
  scoreHistory: number[]
}

const BUSINESSES: Business[] = []

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST NETWORK DATA (pre-computed positions)
// ═══════════════════════════════════════════════════════════════════════════════

interface NetNode {
  id: string
  label: string
  type: 'vendor' | 'customer' | 'bank' | 'nbfc' | 'ca' | 'gov' | 'insurance' | 'logistics'
  x: number
  y: number
  score: number
  strength: number
}

const RELATION_COLORS: Record<NetNode['type'], { hex: string; label: string }> = {
  vendor:     { hex: '#2563EB', label: 'Vendor' },
  customer:   { hex: '#1D4ED8', label: 'Customer' },
  bank:       { hex: '#2563EB', label: 'Bank' },
  nbfc:       { hex: '#0f766e', label: 'NBFC' },
  ca:         { hex: '#65a30d', label: 'CA Firm' },
  gov:        { hex: '#475569', label: 'Govt Body' },
  insurance:  { hex: '#2563EB', label: 'Insurance' },
  logistics:  { hex: '#7c3aed', label: 'Logistics' },
}

// Polar coordinates: center at (300, 240), radius ~175
function makeNetwork(): { nodes: NetNode[]; center: { x: number; y: number } } {
  const cx = 300, cy = 240, R = 175
  const angleSpread = (Math.PI * 2) / 10
  const defs: Omit<NetNode, 'x' | 'y'>[] = [
    { id: 'v1', label: 'Tata Steel', type: 'vendor', score: 88, strength: 92 },
    { id: 'v2', label: 'Aditya Birla Chem', type: 'vendor', score: 84, strength: 85 },
    { id: 'c1', label: 'Future Retail', type: 'customer', score: 79, strength: 78 },
    { id: 'c2', label: 'DMart (Avenue)', type: 'customer', score: 91, strength: 94 },
    { id: 'b1', label: 'ICICI Bank', type: 'bank', score: 95, strength: 90 },
    { id: 'b2', label: 'Axis Bank', type: 'bank', score: 90, strength: 82 },
    { id: 'n1', label: 'Bajaj Finance', type: 'nbfc', score: 86, strength: 70 },
    { id: 'ca1', label: 'Deloitte India', type: 'ca', score: 93, strength: 88 },
    { id: 'g1', label: 'GSTN Network', type: 'gov', score: 99, strength: 100 },
    { id: 'l1', label: 'BlueDart Express', type: 'logistics', score: 81, strength: 75 },
  ]
  const nodes = defs.map((d, i) => {
    const angle = i * angleSpread - Math.PI / 2
    return { ...d, x: cx + Math.cos(angle) * R, y: cy + Math.sin(angle) * R }
  })
  return { nodes, center: { x: cx, y: cy } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE DISTRIBUTION DATA (Gaussian bell curve)
// ═══════════════════════════════════════════════════════════════════════════════

const BELL_MEAN = 75
const BELL_STD = 12
const BELL_BUCKETS = 20 // 0-100 in 5-pt buckets

function gaussianPDF(x: number, mean: number, std: number) {
  return Math.exp(-0.5 * Math.pow((x - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI))
}

const BELL_CURVE: { score: number; count: number; cumulativePct: number }[] = (() => {
  const total = 500000
  const buckets: { score: number; count: number; cumulativePct: number }[] = []
  let cum = 0
  for (let i = 0; i < BELL_BUCKETS; i++) {
    const lo = i * 5
    const mid = lo + 2.5
    const pdf = gaussianPDF(mid, BELL_MEAN, BELL_STD)
    const count = Math.round(pdf * 5 * total)
    cum += count
    buckets.push({ score: lo + 2, count, cumulativePct: (cum / total) * 100 })
  }
  return buckets
})()

// Industry averages — previously 10 hardcoded mock industries (IT Services,
// Banking, Pharmaceuticals, Automobile, Telecom, Manufacturing, Energy, Retail,
// Real Estate, Agriculture) with fabricated avg scores / business counts /
// growth rates. Removed during mock-data audit (Task 7). Empty until a real
// industry-benchmark API is wired.
const INDUSTRY_AVG: { name: string; key: string; icon: React.ElementType; avg: number; businesses: number; growth: number }[] = []

// Indian States Heatmap (simplified grid layout)
const STATE_GRID: { name: string; abbr: string; row: number; col: number; score: number; businesses: number }[] = [
  { name: 'J&K',          abbr: 'JK', row: 0, col: 3, score: 72.1, businesses: 8420 },
  { name: 'Himachal',     abbr: 'HP', row: 1, col: 2, score: 76.4, businesses: 6210 },
  { name: 'Punjab',       abbr: 'PB', row: 1, col: 3, score: 78.9, businesses: 18400 },
  { name: 'Haryana',      abbr: 'HR', row: 2, col: 3, score: 82.6, businesses: 24800 },
  { name: 'Delhi',        abbr: 'DL', row: 2, col: 4, score: 86.3, businesses: 38400 },
  { name: 'Rajasthan',    abbr: 'RJ', row: 2, col: 2, score: 74.2, businesses: 32100 },
  { name: 'Uttar Pradesh',abbr: 'UP', row: 3, col: 4, score: 71.8, businesses: 64800 },
  { name: 'Bihar',        abbr: 'BR', row: 4, col: 5, score: 65.4, businesses: 28400 },
  { name: 'Gujarat',      abbr: 'GJ', row: 3, col: 1, score: 84.7, businesses: 58200 },
  { name: 'Maharashtra',  abbr: 'MH', row: 4, col: 1, score: 87.5, businesses: 94600 },
  { name: 'Goa',          abbr: 'GA', row: 5, col: 1, score: 80.2, businesses: 4200 },
  { name: 'Karnataka',    abbr: 'KA', row: 5, col: 2, score: 86.8, businesses: 72400 },
  { name: 'Telangana',    abbr: 'TG', row: 5, col: 3, score: 85.1, businesses: 38200 },
  { name: 'Andhra Pradesh',abbr:'AP',row: 6, col: 3, score: 78.3, businesses: 24100 },
  { name: 'Tamil Nadu',   abbr: 'TN', row: 6, col: 2, score: 84.6, businesses: 64800 },
  { name: 'Kerala',       abbr: 'KL', row: 6, col: 1, score: 79.4, businesses: 18400 },
  { name: 'Odisha',       abbr: 'OD', row: 4, col: 4, score: 72.6, businesses: 16200 },
  { name: 'West Bengal',  abbr: 'WB', row: 4, col: 6, score: 74.8, businesses: 42600 },
  { name: 'Madhya Pradesh',abbr:'MP',row: 3, col: 2, score: 73.1, businesses: 28400 },
  { name: 'Chhattisgarh', abbr: 'CG', row: 4, col: 2, score: 70.8, businesses: 12400 },
]

// Top 10 Most Trusted Businesses leaderboard
const LEADERBOARD: { rank: number; name: string; ubid: string; score: number; industry: string; tier: string }[] = [
  { rank: 1,  name: 'HDFC Bank',                 ubid: 'UBID-27-HDF1-0234', score: 97, industry: 'Banking',       tier: 'Platinum' },
  { rank: 2,  name: 'State Bank of India',       ubid: 'UBID-27-SBI0-1001', score: 96, industry: 'Banking',       tier: 'Platinum' },
  { rank: 3,  name: 'Tata Consultancy Services', ubid: 'UBID-27-TCS1-0017', score: 96, industry: 'IT Services',   tier: 'Platinum' },
  { rank: 4,  name: 'Infosys Limited',           ubid: 'UBID-29-INF1-0089', score: 95, industry: 'IT Services',   tier: 'Platinum' },
  { rank: 5,  name: 'Reliance Industries',       ubid: 'UBID-28-RIL2-0042', score: 94, industry: 'Conglomerate',  tier: 'Platinum' },
  { rank: 6,  name: 'ICICI Bank',                ubid: 'UBID-27-ICI2-0312', score: 93, industry: 'Banking',       tier: 'Platinum' },
  { rank: 7,  name: 'Axis Bank',                 ubid: 'UBID-27-AXI2-0398', score: 92, industry: 'Banking',       tier: 'Platinum' },
  { rank: 8,  name: 'Asian Paints',              ubid: 'UBID-27-ASN1-0528', score: 90, industry: 'Manufacturing', tier: 'Gold' },
  { rank: 9,  name: 'Maruti Suzuki India',       ubid: 'UBID-06-MSU2-0411', score: 89, industry: 'Automobile',    tier: 'Gold' },
  { rank: 10, name: 'Wipro Limited',             ubid: 'UBID-29-WIP1-0791', score: 88, industry: 'IT Services',   tier: 'Gold' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DECORATIVE QR-STYLE SVG (decorative grid pattern)
// ═══════════════════════════════════════════════════════════════════════════════

function QrPattern({ size = 88, seed = 17 }: { size?: number; seed?: number }) {
  const cells = 13
  const cellSize = size / cells
  // Deterministic pseudo-random based on seed
  const rng = (i: number, j: number) => {
    const v = Math.sin((i + 1) * 9.7 + (j + 1) * 13.3 + seed * 2.1) * 43758.5453
    return v - Math.floor(v)
  }
  const isFinder = (i: number, j: number) => {
    const inBox = (oi: number, oj: number) => i >= oi && i < oi + 3 && j >= oj && j < oj + 3
    return inBox(0, 0) || inBox(0, cells - 3) || inBox(cells - 3, 0)
  }
  const finderBorder = (i: number, j: number) => {
    const onBox = (oi: number, oj: number) =>
      (i === oi && j >= oj && j < oj + 3) || (i === oi + 2 && j >= oj && j < oj + 3) ||
      (j === oj && i >= oi && i < oi + 3) || (j === oj + 2 && i >= oi && i < oi + 3)
    return onBox(0, 0) || onBox(0, cells - 3) || onBox(cells - 3, 0)
  }
  const finderCore = (i: number, j: number) => {
    const inCore = (oi: number, oj: number) => i === oi + 1 && j === oj + 1
    return inCore(0, 0) || inCore(0, cells - 3) || inCore(cells - 3, 0)
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
      <rect width={size} height={size} fill="#ffffff" />
      {Array.from({ length: cells }).map((_, i) =>
        Array.from({ length: cells }).map((_, j) => {
          let fill: string | null = '#0f172a'
          if (isFinder(i, j)) {
            fill = (finderBorder(i, j) || finderCore(i, j)) ? '#0f172a' : null
          } else {
            fill = rng(i, j) > 0.5 ? '#0f172a' : null
          }
          if (fill === null) return null
          return (
            <rect
              key={`${i}-${j}`}
              x={j * cellSize + 0.5}
              y={i * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={fill}
              rx={1}
            />
          )
        })
      )}
      {/* Center accent dot */}
      <circle cx={size / 2} cy={size / 2} r={cellSize * 1.1} fill="#2563EB" opacity={0.85} />
      <circle cx={size / 2} cy={size / 2} r={cellSize * 0.55} fill="#ffffff" />
      <circle cx={size / 2} cy={size / 2} r={cellSize * 0.3} fill="#2563EB" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE GAUGE — Circular SVG gauge (0-100)
// ═══════════════════════════════════════════════════════════════════════════════

function ScoreGauge({ value, label, size = 130, icon: Icon }: {
  value: number; label: string; size?: number; icon?: React.ElementType
}) {
  const c = useCountUp(value)
  const stroke = 10
  const r = (size - stroke - 4) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.min(c / 100, 1)
  const dash = circumference * progress
  const color = scoreColor(value)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
          {/* Progress */}
          <motion.circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color.hex}
            strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${dash} ${circumference}` }}
            transition={{ duration: 1.2, ease: 'easeOut' as const }}
          />
          {/* Tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2
            const x1 = cx + Math.cos(a) * (r + stroke / 2 + 2)
            const y1 = cy + Math.sin(a) * (r + stroke / 2 + 2)
            const x2 = cx + Math.cos(a) * (r + stroke / 2 + 5)
            const y2 = cy + Math.sin(a) * (r + stroke / 2 + 5)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1} />
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon className={`w-4 h-4 mb-0.5 ${color.text}`} />}
          <span className="text-2xl font-bold text-slate-800 tabular-nums">
            {c.toFixed(0)}
          </span>
          <span className={`text-[10px] font-medium ${color.text}`}>{color.label}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-600 text-center">{label}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLINE — 12-month score history mini chart
// ═══════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = '#2563EB', w = 280, h = 56 }: {
  data: number[]; color?: string; w?: number; h?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data) - 2
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (w - 16) + 8,
    y: h - 8 - ((v - min) / range) * (h - 16),
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${h - 4} L${pts[0].x},${h - 4} Z`
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D']

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace('#','')})`} />
      <motion.path
        d={linePath} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' as const }}
      />
      {pts.map((p, i) => (
        <motion.circle
          key={i} cx={p.x} cy={p.y} r="2.5"
          fill="#ffffff" stroke={color} strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.05 }}
        />
      ))}
      {pts.map((p, i) => (
        <text key={`m${i}`} x={p.x} y={h - 1} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 7 }}>
          {months[i] || ''}
        </text>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function VerificationBadge({ label, verified = true, icon: Icon }: {
  label: string; verified?: boolean; icon: React.ElementType
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-help ${
            verified
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <Icon className={`w-3 h-3 ${verified ? 'text-emerald-600' : 'text-slate-400'}`} />
            {label}
            {verified && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {verified ? `${label} verified via government records` : `${label} not yet verified`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST NETWORK GRAPH — SVG with animated dashed trust flow
// ═══════════════════════════════════════════════════════════════════════════════

function TrustNetworkGraph({ business }: { business: Business }) {
  const { nodes, center } = useMemo(() => makeNetwork(), [])
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="w-full overflow-x-auto">
      <svg width="600" height="480" viewBox="0 0 600 480" className="mx-auto" style={{ maxWidth: 600 }}>
        <defs>
          <radialGradient id="net-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="net-center-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>

        {/* Center glow */}
        <circle cx={center.x} cy={center.y} r="120" fill="url(#net-center-glow)" />

        {/* Edges */}
        {nodes.map((n) => {
          const color = RELATION_COLORS[n.type].hex
          const isActive = hovered === n.id || selected === n.id
          return (
            <g key={`edge-${n.id}`}>
              <line
                x1={center.x} y1={center.y}
                x2={n.x} y2={n.y}
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.4}
                strokeOpacity={isActive ? 0.9 : 0.45}
              />
              {/* Animated dashed trust flow overlay */}
              <motion.line
                x1={center.x} y1={center.y}
                x2={n.x} y2={n.y}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="3,9"
                strokeOpacity={0.85}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: [-24, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' as const }}
              />
              {/* Trust particle */}
              <motion.circle
                r="3"
                fill={color}
                initial={{ cx: center.x, cy: center.y }}
                animate={{ cx: [center.x, n.x], cy: [center.y, n.y] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const, delay: n.score % 1 }}
              />
            </g>
          )
        })}

        {/* Center node */}
        <g>
          <circle cx={center.x} cy={center.y} r="38" fill="url(#net-center-fill)" />
          <circle cx={center.x} cy={center.y} r="38" fill="none" stroke="#2563EB" strokeWidth="2" opacity="0.5">
            <animate attributeName="r" values="38;46;38" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <text x={center.x} y={center.y - 4} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 11 }}>
            {business.name.length > 18 ? business.name.substring(0, 16) + '…' : business.name}
          </text>
          <text x={center.x} y={center.y + 10} textAnchor="middle" className="fill-emerald-100" style={{ fontSize: 9 }}>
            Trust {business.trustScore}
          </text>
        </g>

        {/* Connected nodes */}
        {nodes.map((n) => {
          const color = RELATION_COLORS[n.type].hex
          const isActive = hovered === n.id || selected === n.id
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(selected === n.id ? null : n.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={n.x} cy={n.y} r={isActive ? 26 : 22}
                fill="#ffffff" stroke={color}
                strokeWidth={isActive ? 3 : 2}
                style={{ transition: 'r 0.2s' }}
              />
              <circle cx={n.x} cy={n.y} r="6" fill={color} opacity={0.85} />
              <text x={n.x} y={n.y + 38} textAnchor="middle" className="fill-slate-700 font-medium" style={{ fontSize: 10 }}>
                {n.label.length > 16 ? n.label.substring(0, 14) + '…' : n.label}
              </text>
              <text x={n.x} y={n.y + 50} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8 }}>
                {RELATION_COLORS[n.type].label} · {n.score}
              </text>
            </g>
          )
        })}

        {/* Legend */}
        <g transform="translate(16, 16)">
          <rect width="120" height="148" rx="6" fill="#ffffff" fillOpacity="0.95" stroke="#e2e8f0" />
          <text x="10" y="18" className="fill-slate-600 font-semibold" style={{ fontSize: 10 }}>Relationship Types</text>
          {Object.entries(RELATION_COLORS).map(([key, v], i) => (
            <g key={key} transform={`translate(10, ${30 + i * 14})`}>
              <circle cx="4" cy="-3" r="4" fill={v.hex} />
              <text x="14" y="0" className="fill-slate-600" style={{ fontSize: 9 }}>{v.label}</text>
            </g>
          ))}
        </g>
      </svg>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
        >
          {(() => {
            const n = nodes.find(x => x.id === selected)
            if (!n) return null
            return (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Badge variant="outline" style={{ color: RELATION_COLORS[n.type].hex, borderColor: RELATION_COLORS[n.type].hex }}>
                  {RELATION_COLORS[n.type].label}
                </Badge>
                <span className="font-semibold text-slate-800">{n.label}</span>
                <span className="text-slate-500">Trust Score: <span className="font-semibold text-slate-700">{n.score}</span></span>
                <span className="text-slate-500">Relationship Strength: <span className="font-semibold text-slate-700">{n.strength}%</span></span>
              </div>
            )
          })()}
        </motion.div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BELL CURVE — SVG distribution
// ═══════════════════════════════════════════════════════════════════════════════

function BellCurve({ highlightScore }: { highlightScore?: number }) {
  const w = 640, h = 240
  const padL = 36, padR = 16, padT = 16, padB = 36
  const chartW = w - padL - padR
  const chartH = h - padT - padB
  const maxCount = Math.max(...BELL_CURVE.map(b => b.count))
  const xStep = chartW / BELL_CURVE.length

  const pts = BELL_CURVE.map((b, i) => ({
    x: padL + i * xStep + xStep / 2,
    y: padT + chartH - (b.count / maxCount) * chartH,
  }))

  // Smooth path
  const linePath = pts.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`
    const prev = pts[i - 1]
    const cx = (prev.x + p.x) / 2
    return `Q${prev.x},${prev.y} ${cx},${(prev.y + p.y) / 2} T${p.x},${p.y}`
  }).join(' ')
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`

  const highlightX = highlightScore !== undefined
    ? padL + (highlightScore / 100) * chartW
    : null

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="bell-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line
          key={i}
          x1={padL} y1={padT + chartH - f * chartH}
          x2={w - padR} y2={padT + chartH - f * chartH}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,4"
        />
      ))}

      {/* Area + Line */}
      <motion.path
        d={areaPath} fill="url(#bell-grad)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
      />
      <motion.path
        d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' as const }}
      />

      {/* Mean line */}
      <line
        x1={padL + (BELL_MEAN / 100) * chartW} y1={padT}
        x2={padL + (BELL_MEAN / 100) * chartW} y2={padT + chartH}
        stroke="#1D4ED8" strokeWidth="1.5" strokeDasharray="4,4"
      />
      <text
        x={padL + (BELL_MEAN / 100) * chartW}
        y={padT - 4} textAnchor="middle"
        className="fill-emerald-600 font-semibold" style={{ fontSize: 10 }}
      >
        Mean: 75
      </text>

      {/* Highlight score */}
      {highlightX !== null && (
        <g>
          <line
            x1={highlightX} y1={padT} x2={highlightX} y2={padT + chartH}
            stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,3"
          />
          <circle cx={highlightX} cy={padT + chartH - 4} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
        </g>
      )}

      {/* X-axis labels */}
      {[0, 25, 50, 75, 100].map((s, i) => (
        <text
          key={i}
          x={padL + (s / 100) * chartW}
          y={h - padB + 18}
          textAnchor="middle"
          className="fill-slate-500" style={{ fontSize: 10 }}
        >
          {s}
        </text>
      ))}
      <text x={w / 2} y={h - 4} textAnchor="middle" className="fill-slate-600 font-medium" style={{ fontSize: 11 }}>
        Trust Score (0–100)
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE HEATMAP — SVG grid of Indian states colored by avg trust score
// ═══════════════════════════════════════════════════════════════════════════════

function StateHeatmap() {
  const cellW = 56, cellH = 44, gap = 4
  const cols = 8, rows = 7
  const w = cols * (cellW + gap) + gap
  const h = rows * (cellH + gap) + gap

  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h} className="mx-auto" style={{ maxWidth: w }}>
        {STATE_GRID.map((s) => {
          const sc = scoreColor(s.score)
          const opacity = 0.3 + (s.score / 100) * 0.7
          return (
            <TooltipProvider key={s.abbr}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <g>
                    <rect
                      x={s.col * (cellW + gap) + gap}
                      y={s.row * (cellH + gap) + gap}
                      width={cellW}
                      height={cellH}
                      rx={6}
                      fill={sc.hex}
                      fillOpacity={opacity}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="cursor-pointer transition-all hover:stroke-emerald-700 hover:stroke-2"
                    />
                    <text
                      x={s.col * (cellW + gap) + gap + cellW / 2}
                      y={s.row * (cellH + gap) + gap + cellH / 2 - 4}
                      textAnchor="middle"
                      className="fill-white font-bold pointer-events-none"
                      style={{ fontSize: 11 }}
                    >
                      {s.abbr}
                    </text>
                    <text
                      x={s.col * (cellW + gap) + gap + cellW / 2}
                      y={s.row * (cellH + gap) + gap + cellH / 2 + 10}
                      textAnchor="middle"
                      className="fill-white pointer-events-none"
                      style={{ fontSize: 9, opacity: 0.85 }}
                    >
                      {s.score.toFixed(0)}
                    </text>
                  </g>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-slate-500">Avg Trust: <span className="font-semibold text-slate-700">{s.score}</span></div>
                    <div className="text-slate-500">Verified: {fmtNum(s.businesses)}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function HeroBanner() {
  return (
    <motion.div {...fadeUp}>
      <Card className="relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #2563EB 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                  <Fingerprint className="w-3 h-3" />
                  BUSINESS IDENTITY LAYER
                </div>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                  <Sparkles className="w-3 h-3 mr-1" /> Aadhaar for Businesses
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Universal Business ID
              </h1>
              <p className="mt-2 text-sm md:text-base text-slate-600 max-w-2xl">
                India&apos;s unified business identity layer — every registered business gets a
                single verifiable UBID that aggregates GSTIN, PAN, CIN, Udyam, banking, and
                trade partner trust signals into one portable credit profile.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Government-grade verification
                </div>
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                  Bank-grade trust scoring
                </div>
                <div className="flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-emerald-600" />
                  Real-time trust network
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-emerald-400/20 blur-2xl"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
                />
                <div className="relative w-32 h-32 rounded-2xl bg-white border-2 border-emerald-200 flex items-center justify-center shadow-lg">
                  <div className="text-center">
                    <QrCode className="w-8 h-8 mx-auto text-emerald-600 mb-1" />
                    <div className="text-[10px] font-mono text-slate-500">UBID</div>
                    <div className="text-xs font-bold text-emerald-700">28-XXXX-XXXX</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS ROW
// ═══════════════════════════════════════════════════════════════════════════════

function StatsRow() {
  const stats = [
    { label: 'Verified Businesses', value: 500000, suffix: '+', icon: Building2, color: '#2563EB' },
    { label: 'GSTIN Linked', value: 480000, suffix: '+', icon: FileCheck, color: '#1D4ED8' },
    { label: 'Trust Score Avg', value: 99.2, suffix: '%', decimals: 1, icon: ShieldCheck, color: '#2563EB' },
    { label: 'Transaction Volume', value: 50000, suffix: '+ Cr', icon: IndianRupee, color: '#2563EB' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div key={s.label} {...staggerChild(i)}>
          <Card className="border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: s.color + '1a' }}
                >
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 tabular-nums">
                <AnimatedScore
                  value={s.value}
                  decimals={s.decimals ?? 0}
                  suffix={s.suffix}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECTORY TABLE — 12 businesses
// ═══════════════════════════════════════════════════════════════════════════════

function TierBadge({ tier }: { tier: Business['verificationTier'] }) {
  const cfg: Record<Business['verificationTier'], { cls: string; label: string }> = {
    Platinum: { cls: 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-emerald-300', label: 'Platinum' },
    Gold:     { cls: 'bg-amber-50 text-amber-700 border-amber-300', label: 'Gold' },
    Silver:   { cls: 'bg-slate-100 text-slate-700 border-slate-300', label: 'Silver' },
    Verified: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Verified' },
  }
  const c = cfg[tier]
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>
}

function TrustScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${c.bg} ${c.text}`}>
      <AnimatedScore value={score} />
      <span className="text-[9px] opacity-70">/100</span>
    </span>
  )
}

function ScoreDot({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="w-12">
        <div className="text-xs font-semibold text-slate-700 tabular-nums">
          <AnimatedScore value={score} />
        </div>
        <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: c.hex }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.2 }}
          />
        </div>
      </div>
    </div>
  )
}

function DirectoryTable({ onSelect }: { onSelect: (b: Business) => void }) {
  const [query, setQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    return BUSINESSES.filter((b) => {
      const q = query.trim().toLowerCase()
      const matchesQ = !q ||
        b.ubid.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.gstin.toLowerCase().includes(q) ||
        b.pan.toLowerCase().includes(q)
      const matchesInd = industryFilter === 'all' || b.industryKey === industryFilter
      return matchesQ && matchesInd
    })
  }, [query, industryFilter])

  const industries = [
    { key: 'all', label: 'All Industries' },
    { key: 'it', label: 'IT Services' },
    { key: 'banking', label: 'Banking' },
    { key: 'auto', label: 'Automobile' },
    { key: 'mfg', label: 'Manufacturing' },
    { key: 'energy', label: 'Energy' },
    { key: 'nbfc', label: 'NBFC' },
    { key: 'telecom', label: 'Telecom' },
    { key: 'conglomerate', label: 'Conglomerate' },
  ]

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              UBID Directory
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtNum(filtered.length)} of {fmtNum(BUSINESSES.length)} businesses shown · Live registry
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search by UBID, GSTIN, PAN, or name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {industries.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50/60">
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs">UBID</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs">Business</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs hidden md:table-cell">GSTIN</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs hidden lg:table-cell">Industry</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs">Trust</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs hidden md:table-cell">Compliance</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs hidden lg:table-cell">Payment</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2.5 text-xs">Status</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-2.5 text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <motion.tr
                  key={b.ubid}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-slate-100 hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                  onClick={() => onSelect(b)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-[11px] font-semibold text-emerald-700">{b.ubid}</div>
                    <div className="text-[10px] text-slate-400">{b.hq}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{b.name}</div>
                    <div className="text-[10px] text-slate-400 md:hidden">{b.gstin}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-600">{b.gstin}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant="outline" className="text-[10px] font-normal">{b.industry}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <TrustScoreBadge score={b.trustScore} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ScoreDot score={b.complianceScore} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <ScoreDot score={b.paymentScore} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <TierBadge tier={b.verificationTier} />
                      {b.verified && (
                        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Verified
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 ml-auto transition-colors" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            No businesses match your search.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS PROFILE CARD — Tab 2 main content
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessProfileCard({ business }: { business: Business }) {
  const trustC = scoreColor(business.trustScore)
  const meta = [
    { label: 'Employees', value: fmtNum(business.employees), icon: Users },
    { label: 'Annual Turnover', value: fmtINR(business.annualTurnover), icon: IndianRupee },
    { label: 'Bank Accounts', value: fmtNum(business.bankAccounts), icon: Landmark },
    { label: 'Active Loans', value: fmtNum(business.activeLoans), icon: CreditCard },
    { label: 'Trade Partners', value: fmtNum(business.tradePartners), icon: Link2 },
    { label: 'HQ Location', value: `${business.hq}, ${business.state}`, icon: MapPin },
  ]

  return (
    <div className="space-y-4">
      {/* Top profile card */}
      <motion.div key={business.ubid} {...fadeUp}>
        <Card className="border-slate-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left: QR + UBID */}
              <div className="flex flex-col items-center gap-3 md:w-44">
                <div className="p-2 bg-white border-2 border-emerald-200 rounded-xl">
                  <QrPattern size={88} seed={business.trustScore + business.name.length} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Universal Business ID</div>
                  <div className="font-mono text-sm font-bold text-emerald-700">{business.ubid}</div>
                </div>
                <TierBadge tier={business.verificationTier} />
              </div>

              {/* Middle: business details */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-800">{business.name}</h2>
                    {business.verified && (
                      <BadgeCheck className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {business.industry} · Incorporated {fmtDate(business.incorporated)}
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex justify-between sm:block">
                    <span className="text-slate-500">GSTIN</span>
                    <span className="font-mono text-slate-700 sm:block">{business.gstin}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-slate-500">PAN</span>
                    <span className="font-mono text-slate-700 sm:block">{business.pan}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-slate-500">CIN</span>
                    <span className="font-mono text-slate-700 sm:block">{business.cin}</span>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-slate-500">Udyam</span>
                    <span className="font-mono text-slate-700 sm:block">UDYAM-{business.state.slice(0,2).toUpperCase()}-{String(100000 + business.employees % 899999)}</span>
                  </div>
                </div>
              </div>

              {/* Right: overall trust score */}
              <div className="md:w-40 flex md:flex-col items-center justify-center gap-2">
                <div className={`relative px-4 py-3 rounded-xl ${trustC.bg} ${trustC.ring} ring-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Overall Trust</div>
                  <div className={`text-3xl font-bold tabular-nums ${trustC.text}`}>
                    <AnimatedScore value={business.trustScore} />
                  </div>
                  <div className={`text-[10px] font-medium ${trustC.text}`}>{trustC.label}</div>
                </div>
              </div>
            </div>

            {/* Verification badges */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Verification Status
              </div>
              <div className="flex flex-wrap gap-2">
                <VerificationBadge label="GSTIN Verified" icon={FileCheck} />
                <VerificationBadge label="PAN Verified" icon={Hash} />
                <VerificationBadge label="Bank Verified" icon={Landmark} />
                <VerificationBadge label="Aadhaar Verified" icon={Fingerprint} />
                <VerificationBadge label="Udyam Verified" icon={Briefcase} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Score gauges (4) */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-600" />
              Credit Profile Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreGauge value={business.trustScore} label="Trust Score" icon={ShieldCheck} />
              <ScoreGauge value={business.complianceScore} label="Compliance Score" icon={FileCheck} />
              <ScoreGauge value={business.paymentScore} label="Payment Behaviour" icon={CreditCard} />
              <ScoreGauge value={business.growthScore} label="Growth Score" icon={TrendingUp} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metadata grid + history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="lg:col-span-2">
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                Business Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {meta.map((m) => (
                  <div key={m.label} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                      <m.icon className="w-3 h-3" />
                      {m.label}
                    </div>
                    <div className="text-sm font-semibold text-slate-800">{m.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Trust Score History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-xs text-slate-500 mb-2">
                Last 12 months · Trend{' '}
                <span className="text-emerald-600 font-semibold inline-flex items-center">
                  <ArrowUpRight className="w-3 h-3" />
                  +{(business.scoreHistory[11] - business.scoreHistory[0]).toFixed(0)} pts
                </span>
              </div>
              <Sparkline data={business.scoreHistory} color={trustC.hex} w={260} h={70} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-slate-50">
                  <div className="text-[10px] text-slate-500">Low</div>
                  <div className="text-sm font-semibold text-slate-700">{Math.min(...business.scoreHistory)}</div>
                </div>
                <div className="p-2 rounded-md bg-slate-50">
                  <div className="text-[10px] text-slate-500">Avg</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {(business.scoreHistory.reduce((a,b) => a+b, 0) / business.scoreHistory.length).toFixed(0)}
                  </div>
                </div>
                <div className="p-2 rounded-md bg-emerald-50">
                  <div className="text-[10px] text-emerald-600">High</div>
                  <div className="text-sm font-semibold text-emerald-700">{Math.max(...business.scoreHistory)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST NETWORK TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TrustPathExplorer({ business }: { business: Business }) {
  const otherBusinesses = BUSINESSES.filter((b) => b.ubid !== business.ubid)
  const [target, setTarget] = useState(otherBusinesses[0].ubid)
  const targetB = BUSINESSES.find((b) => b.ubid === target)!

  // Fake path: business → partner bank → target
  const hops = [
    { label: business.name, role: 'Source', score: business.trustScore, color: '#2563EB' },
    { label: 'HDFC Bank', role: 'Common Banking Partner', score: 97, color: '#2563EB' },
    { label: 'GSTN Network', role: 'Government Verification', score: 99, color: '#475569' },
    { label: targetB.name, role: 'Target', score: targetB.trustScore, color: scoreColor(targetB.trustScore).hex },
  ]

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-800 flex items-center gap-2">
          <Waypoints className="w-4 h-4 text-emerald-600" />
          Trust Path Explorer
        </CardTitle>
        <p className="text-xs text-slate-500">
          Shortest trust path between two businesses via shared partners.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">From</div>
            <div className="px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-700">
              {business.name}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 self-end sm:self-center mb-2 sm:mb-0" />
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">To</div>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {otherBusinesses.map((b) => (
                <option key={b.ubid} value={b.ubid}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Separator />

        {/* Path visualization */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {hops.map((hop, i) => (
            <React.Fragment key={i}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i }}
                className="flex flex-col items-center text-center min-w-[120px]"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: hop.color }}
                >
                  {hop.score}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1 leading-tight">{hop.label}</div>
                <div className="text-[10px] text-slate-400">{hop.role}</div>
              </motion.div>
              {i < hops.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1 * (i + 0.5) }}
                  className="flex-1 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-300 origin-left min-w-[24px]"
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Hops</div>
            <div className="text-lg font-bold text-slate-800">{hops.length - 1}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Path Trust</div>
            <div className="text-lg font-bold text-emerald-700">
              {Math.round(hops.reduce((a, h) => a + h.score, 0) / hops.length)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Shared Partners</div>
            <div className="text-lg font-bold text-slate-800">3</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Confidence</div>
            <div className="text-lg font-bold text-emerald-700">94%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TrustNetworkTab({ business }: { business: Business }) {
  const stats = [
    { label: 'Network Trust Score', value: business.trustScore + 1, suffix: '', icon: ShieldCheck, color: '#2563EB' },
    { label: 'Avg Partner Score', value: 87.4, suffix: '', decimals: 1, icon: Users, color: '#1D4ED8' },
    { label: 'High-Risk Connections', value: 1, suffix: '', icon: AlertTriangle, color: '#f59e0b' },
    { label: 'Verified Connections', value: 9, suffix: '/10', icon: BadgeCheck, color: '#2563EB' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} {...staggerChild(i)}>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: s.color + '1a' }}
                  >
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                </div>
                <div className="text-xl font-bold text-slate-800 tabular-nums">
                  <AnimatedScore value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix} />
                </div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeUp}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-600" />
                  Trust Network Graph
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {business.name} at center · 10 connected entities · animated trust flow
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <TrustNetworkGraph business={business} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <TrustPathExplorer business={business} />
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE DISTRIBUTION & ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PercentileCalculator() {
  const [score, setScore] = useState(75)
  const percentile = useMemo(() => {
    // Find cumulative % below this score
    const idx = Math.floor(score / 5)
    if (idx <= 0) return 0
    if (idx >= BELL_BUCKETS) return 99.9
    const bucket = BELL_CURVE[idx - 1]
    return bucket.cumulativePct
  }, [score])

  const c = scoreColor(score)

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600" />
          Score Percentile Calculator
        </CardTitle>
        <p className="text-xs text-slate-500">
          Find where a business stands among 5,00,000+ verified entities.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">Trust Score</label>
            <span className={`text-lg font-bold tabular-nums ${c.text}`}>{score}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${c.hex} 0%, ${c.hex} ${score}%, #e2e8f0 ${score}%, #e2e8f0 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0 (High Risk)</span>
            <span>50 (Moderate)</span>
            <span>100 (Excellent)</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl ${c.bg} ${c.ring} ring-2 text-center`}>
          <div className="text-xs text-slate-600 mb-1">Percentile Rank</div>
          <div className={`text-3xl font-bold tabular-nums ${c.text}`}>
            <AnimatedScore value={percentile} decimals={1} suffix="%" key={percentile} />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {percentile < 25 && 'Below average — higher risk profile'}
            {percentile >= 25 && percentile < 75 && 'Around average — standard risk'}
            {percentile >= 75 && percentile < 95 && 'Above average — premium profile'}
            {percentile >= 95 && 'Top tier — elite business credit'}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Distribution Context
          </div>
          <BellCurve highlightScore={score} />
        </div>
      </CardContent>
    </Card>
  )
}

function IndustryTable() {
  const sorted = [...INDUSTRY_AVG].sort((a, b) => b.avg - a.avg)
  const max = sorted.length > 0 ? Math.max(...sorted.map(s => s.avg)) : 0

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-600" />
          Industry-wise Average Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto custom-scroll">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left font-semibold text-slate-600 px-4 py-2 text-xs">Industry</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2 text-xs hidden sm:table-cell">Businesses</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2 text-xs">Avg Score</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-2 text-xs hidden md:table-cell">YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ind, i) => {
                const c = scoreColor(ind.avg)
                return (
                  <motion.tr
                    key={ind.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-slate-100 hover:bg-emerald-50/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
                          <ind.icon className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <span className="font-medium text-slate-700">{ind.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-slate-600 tabular-nums">
                      {fmtNum(ind.businesses)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: c.hex }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(ind.avg / max) * 100}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                          />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${c.text}`}>{ind.avg.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <ArrowUpRight className="w-3 h-3" /> {ind.growth.toFixed(1)}%
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function Leaderboard() {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          Top 10 Most Trusted Businesses
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto custom-scroll">
          {LEADERBOARD.map((b, i) => {
            const c = scoreColor(b.score)
            const crownColor =
              b.rank === 1 ? 'text-amber-500' :
              b.rank === 2 ? 'text-slate-400' :
              b.rank === 3 ? 'text-orange-400' : 'text-slate-300'
            return (
              <motion.div
                key={b.ubid}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-emerald-50/30 ${
                  b.rank <= 3 ? 'bg-gradient-to-r from-emerald-50/50 to-transparent' : ''
                }`}
              >
                <div className="flex items-center gap-2 w-8">
                  <span className="text-sm font-bold text-slate-400 tabular-nums">{b.rank}</span>
                  {b.rank <= 3 && <Crown className={`w-4 h-4 ${crownColor}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{b.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-mono">{b.ubid}</span>
                    <span>·</span>
                    <span>{b.industry}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] hidden sm:inline-flex">
                  {b.tier}
                </Badge>
                <div className={`px-2 py-1 rounded-md text-xs font-bold tabular-nums ${c.bg} ${c.text}`}>
                  {b.score}
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function DistributionTab() {
  return (
    <div className="space-y-4">
      {/* Bell curve card */}
      <motion.div {...fadeUp}>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-emerald-600" />
                  Trust Score Distribution
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gaussian distribution across 5,00,000+ verified businesses
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                <div>
                  <div className="text-slate-400">Mean</div>
                  <div className="font-bold text-emerald-700">75.0</div>
                </div>
                <div>
                  <div className="text-slate-400">Std Dev</div>
                  <div className="font-bold text-slate-700">12.0</div>
                </div>
                <div>
                  <div className="text-slate-400">Median</div>
                  <div className="font-bold text-slate-700">76.0</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <BellCurve />
          </CardContent>
        </Card>
      </motion.div>

      {/* Percentile + Industry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <PercentileCalculator />
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
          <IndustryTable />
        </motion.div>
      </div>

      {/* Heatmap + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-emerald-600" />
                Geographic Trust Heatmap
              </CardTitle>
              <p className="text-xs text-slate-500">
                Average trust score by state · darker = higher trust
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <StateHeatmap />
              <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-500">
                <span>Low (60)</span>
                <div className="flex gap-0.5">
                  {[0.3, 0.45, 0.6, 0.75, 0.9].map((o) => (
                    <div key={o} className="w-6 h-3 rounded-sm" style={{ backgroundColor: '#2563EB', opacity: o }} />
                  ))}
                </div>
                <span>High (90)</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
          <Leaderboard />
        </motion.div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE DIALOG (from directory row click)
// ═══════════════════════════════════════════════════════════════════════════════

function ProfileDialog({ business, open, onClose }: {
  business: Business | null; open: boolean; onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="w-4 h-4 text-emerald-600" />
            Business Profile · {business?.ubid}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Snapshot view — switch to &quot;Business Credit Profile&quot; tab for full details.
          </DialogDescription>
        </DialogHeader>
        {business && (
          <div className="space-y-4">
            <BusinessProfileCard business={business} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function UniversalBusinessIDPage() {
  const [tab, setTab] = useState('directory')
  const [selected, setSelected] = useState<Business | null>(BUSINESSES[0] ?? null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogBusiness, setDialogBusiness] = useState<Business | null>(null)

  const openProfile = (b: Business) => {
    setDialogBusiness(b)
    setDialogOpen(true)
  }

  const selectAndViewFull = (b: Business) => {
    setSelected(b)
    setTab('credit')
  }

  // Empty state — no businesses in the user's network yet. The previous
  // implementation hardcoded 12 REAL Indian listed companies with fabricated
  // trust / compliance / payment / growth scores. We now show an honest empty
  // state until the user connects real partners.
  // TODO: Replace with real data from /api/business-network when available.
  if (BUSINESSES.length === 0) {
    return (
      <div className="space-y-6">
        <HeroBanner />
        <Card className="border-dashed border-slate-200 bg-slate-50/50">
          <CardContent className="p-10 md:p-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <Network className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              No businesses in your network yet
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md">
              Connect with partners to see their trust scores, compliance history,
              and credit profiles. Verified GSTIN / PAN / CIN data appears here once
              you add a business to your network.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link2 className="w-4 h-4 mr-1.5" /> Connect a partner
              </Button>
              <Button variant="outline" className="border-slate-300">
                <Search className="w-4 h-4 mr-1.5" /> Search by GSTIN
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #2563EB; cursor: pointer;
          border: 2px solid #ffffff; box-shadow: 0 0 0 1px #2563EB;
        }
        input[type='range']::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: #2563EB; cursor: pointer; border: 2px solid #ffffff;
        }
      `}</style>

      <HeroBanner />

      <StatsRow />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-slate-100/80 h-10 p-1 w-full md:w-auto inline-flex">
            <TabsTrigger
              value="directory"
              className="text-xs h-8 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              UBID Directory
            </TabsTrigger>
            <TabsTrigger
              value="credit"
              className="text-xs h-8 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm gap-1.5"
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Business Credit Profile
            </TabsTrigger>
            <TabsTrigger
              value="network"
              className="text-xs h-8 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm gap-1.5"
            >
              <Network className="w-3.5 h-3.5" />
              Trust Network
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="text-xs h-8 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Score Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1 — UBID Directory */}
        <TabsContent value="directory" className="mt-4 space-y-4">
          <DirectoryTable onSelect={openProfile} />
          <Card className="border-dashed border-slate-200 bg-slate-50/50">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    Need a deeper view?
                  </div>
                  <div className="text-xs text-slate-500">
                    Open any business in the Credit Profile tab to view all 4 score gauges, verification badges, and full trade history.
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                disabled={!selected}
                onClick={() => selected && selectAndViewFull(selected)}
              >
                Open Featured Profile <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 — Business Credit Profile */}
        <TabsContent value="credit" className="mt-4 space-y-4">
          {/* Featured selector */}
          <Card className="border-slate-200 bg-slate-50/40">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
                  Featured Business:
                </div>
                <select
                  value={selected?.ubid ?? ''}
                  onChange={(e) => {
                    const b = BUSINESSES.find((x) => x.ubid === e.target.value)
                    if (b) setSelected(b)
                  }}
                  className="flex-1 h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {BUSINESSES.map((b) => (
                    <option key={b.ubid} value={b.ubid}>
                      {b.name} · {b.ubid}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
          {selected && <BusinessProfileCard business={selected} />}
        </TabsContent>

        {/* TAB 3 — Trust Network */}
        <TabsContent value="network" className="mt-4 space-y-4">
          <Card className="border-slate-200 bg-slate-50/40">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-emerald-600" />
                  Center Business:
                </div>
                <select
                  value={selected?.ubid ?? ''}
                  onChange={(e) => {
                    const b = BUSINESSES.find((x) => x.ubid === e.target.value)
                    if (b) setSelected(b)
                  }}
                  className="flex-1 h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {BUSINESSES.map((b) => (
                    <option key={b.ubid} value={b.ubid}>
                      {b.name} · {b.ubid}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
          {selected && <TrustNetworkTab business={selected} />}
        </TabsContent>

        {/* TAB 4 — Score Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <DistributionTab />
        </TabsContent>
      </Tabs>

      <ProfileDialog
        business={dialogBusiness}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
