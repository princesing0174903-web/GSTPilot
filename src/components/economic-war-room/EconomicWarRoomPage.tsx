'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, Shield, Users,
  IndianRupee, Zap, Brain, BarChart3, Globe, Clock,
  CheckCircle, AlertOctagon, Target, Gauge, Radio, Sparkles,
  ArrowUpRight, ArrowDownRight, Building2, Wallet, Landmark,
  AlertCircle, Flame, Cpu, Factory, Truck, ChevronRight, MapPin,
  Server, Cpu as CpuIcon, Network,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — Indian number / currency formatting
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

const fmtINRShort = (n: number) => {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'L Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L Cr'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K Cr'
  return '₹' + n.toFixed(0) + ' Cr'
}

const fmtLakhCr = (n: number) => '₹' + n.toFixed(2) + 'L Cr'

const fmtNumber = (n: number) => n.toLocaleString('en-IN')

const fmtPct = (n: number, decimals = 1) => n.toFixed(decimals) + '%'

const riskColor = (v: number) => {
  if (v <= 1.2) return '#10b981' // emerald-500
  if (v <= 2.0) return '#84cc16' // lime-500
  if (v <= 2.8) return '#eab308' // yellow-500
  if (v <= 3.5) return '#f59e0b' // amber-500
  if (v <= 4.2) return '#f97316' // orange-500
  return '#ef4444' // red-500
}

const healthColor = (v: number) => {
  if (v >= 80) return '#10b981' // emerald — healthy
  if (v >= 65) return '#84cc16' // lime — moderate
  if (v >= 50) return '#f59e0b' // amber — watch
  return '#ef4444' // red — at risk
}

const healthLabel = (v: number) => {
  if (v >= 80) return 'Healthy'
  if (v >= 65) return 'Moderate'
  if (v >= 50) return 'Watch'
  return 'At Risk'
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerChild = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
}

const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(16, 185, 129, 0)',
      '0 0 18px rgba(16, 185, 129, 0.18)',
      '0 0 0px rgba(16, 185, 129, 0)',
    ],
  },
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
}

const scanLine = {
  animate: { top: ['0%', '100%'] },
  transition: { duration: 8, repeat: Infinity, ease: 'linear' as const },
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target

    const start = count
    const startTime = Date.now()
    const diff = target - start

    const step = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(start + diff * eased)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])

  return count
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE IST CLOCK HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useIstClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return useMemo(() => {
    const time = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const date = now.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const hourStr = now.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    })
    const dayStr = now.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    })
    const hour = parseInt(hourStr, 10)
    const isWeekday = !['Sat', 'Sun'].includes(dayStr)
    const isMarketOpen = isWeekday && hour >= 9 && hour < 16
    return { time, date, isMarketOpen }
  }, [now])
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const TICKER_ITEMS: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[] = [
  { label: 'GDP Growth', value: '7.2%', trend: 'up' },
  { label: 'Manufacturing PMI', value: '56.4', trend: 'up' },
  { label: 'GST Collection', value: '₹1.87L Cr', trend: 'up' },
  { label: 'Nifty 50', value: '24,580', trend: 'up' },
  { label: 'USD/INR', value: '83.45', trend: 'down' },
  { label: 'Brent Crude', value: '$82.30', trend: 'up' },
  { label: 'Sensex', value: '80,245', trend: 'up' },
  { label: 'Repo Rate', value: '6.50%', trend: 'flat' },
  { label: 'CPI Inflation', value: '4.8%', trend: 'down' },
  { label: 'IIP Growth', value: '5.2%', trend: 'up' },
  { label: 'Forex Reserves', value: '$685B', trend: 'up' },
  { label: '10Y Bond Yield', value: '6.85%', trend: 'flat' },
  { label: 'Bank Credit Growth', value: '14.2%', trend: 'up' },
  { label: 'FII Inflow', value: '₹12,450Cr', trend: 'up' },
  { label: 'Gold (10g)', value: '₹74,200', trend: 'up' },
  { label: 'Services PMI', value: '58.5', trend: 'up' },
  { label: 'Core Sector', value: '6.3%', trend: 'up' },
  { label: 'UPI Txns', value: '14.2B', trend: 'up' },
]

type HeroKpi = {
  title: string
  value: number
  formatted: string
  trend: 'up' | 'down'
  trendLabel: string
  trendGood: boolean
  sparkData: number[]
  icon: React.ElementType
  color: string
  sublabel: string
}

const HERO_KPIS: HeroKpi[] = [
  {
    title: 'GDP Growth Rate',
    value: 7.2,
    formatted: '7.2%',
    trend: 'up',
    trendLabel: '0.4% QoQ',
    trendGood: true,
    sparkData: [4.1, 6.2, 4.5, 6.1, 7.8, 8.3, 7.6, 7.0, 6.7, 8.4, 7.2],
    icon: TrendingUp,
    color: '#10b981',
    sublabel: 'FY25 Q1 Estimate',
  },
  {
    title: 'GST Collection (MTD)',
    value: 187234,
    formatted: '₹1,87,234 Cr',
    trend: 'up',
    trendLabel: '12% YoY',
    trendGood: true,
    sparkData: [148000, 156000, 162000, 168000, 171000, 175000, 178000, 182000, 187234],
    icon: IndianRupee,
    color: '#10b981',
    sublabel: 'Sep 2025 (live)',
  },
  {
    title: 'Business Formation',
    value: 124500,
    formatted: '1,24,500',
    trend: 'up',
    trendLabel: '18% YoY',
    trendGood: true,
    sparkData: [82000, 91000, 98000, 105000, 112000, 118000, 124500],
    icon: Building2,
    color: '#10b981',
    sublabel: 'New registrations (MTD)',
  },
  {
    title: 'Credit Deployment',
    value: 342500,
    formatted: '₹3,42,500 Cr',
    trend: 'up',
    trendLabel: '8% YoY',
    trendGood: true,
    sparkData: [285000, 298000, 312000, 325000, 332000, 338000, 342500],
    icon: Wallet,
    color: '#f59e0b',
    sublabel: 'Bank credit (FY25)',
  },
  {
    title: 'NPA Ratio',
    value: 2.8,
    formatted: '2.8%',
    trend: 'down',
    trendLabel: '0.2% QoQ',
    trendGood: true,
    sparkData: [4.5, 4.1, 3.8, 3.5, 3.3, 3.1, 3.0, 2.9, 2.8],
    icon: Shield,
    color: '#10b981',
    sublabel: 'Banking system',
  },
  {
    title: 'Manufacturing PMI',
    value: 56.4,
    formatted: '56.4',
    trend: 'up',
    trendLabel: '1.2 pts MoM',
    trendGood: true,
    sparkData: [52.1, 53.4, 54.2, 55.1, 55.8, 56.4],
    icon: Factory,
    color: '#10b981',
    sublabel: 'Sep 2025 reading',
  },
]

// 10 industries for Industry Health Monitor
const INDUSTRIES: {
  name: string
  score: number
  trend: 'up' | 'down' | 'flat'
  delta: string
  sparkData: number[]
}[] = [
  { name: 'Manufacturing', score: 78, trend: 'up', delta: '+4.2', sparkData: [70, 72, 71, 74, 75, 77, 78] },
  { name: 'IT & Services', score: 82, trend: 'up', delta: '+2.8', sparkData: [76, 77, 79, 80, 81, 82, 82] },
  { name: 'Pharma', score: 74, trend: 'flat', delta: '-0.4', sparkData: [75, 74, 76, 75, 74, 74, 74] },
  { name: 'Automobile', score: 68, trend: 'down', delta: '-3.1', sparkData: [74, 72, 71, 70, 69, 68, 68] },
  { name: 'Textiles', score: 58, trend: 'down', delta: '-5.6', sparkData: [66, 64, 62, 61, 60, 59, 58] },
  { name: 'Agriculture', score: 65, trend: 'up', delta: '+1.8', sparkData: [60, 61, 62, 63, 64, 64, 65] },
  { name: 'Banking', score: 80, trend: 'up', delta: '+3.5', sparkData: [73, 74, 76, 77, 78, 79, 80] },
  { name: 'Retail', score: 72, trend: 'flat', delta: '+0.6', sparkData: [70, 71, 71, 72, 71, 72, 72] },
  { name: 'Construction', score: 70, trend: 'up', delta: '+2.4', sparkData: [65, 66, 67, 68, 69, 70, 70] },
  { name: 'Telecom', score: 76, trend: 'up', delta: '+1.9', sparkData: [72, 73, 74, 74, 75, 76, 76] },
]

// 5x5 Risk Matrix
const RISK_MATRIX = {
  industries: ['Manufacturing', 'IT & Services', 'Pharma', 'Automobile', 'Textiles'],
  riskTypes: ['Credit', 'Market', 'Liquidity', 'Operational', 'Compliance'],
  // values: [industry][riskType], 0-5 (5 = highest risk)
  values: [
    [1.2, 1.8, 1.5, 2.1, 0.9],
    [0.8, 1.5, 1.0, 1.4, 0.7],
    [1.5, 1.2, 2.3, 2.8, 1.1],
    [2.4, 2.0, 1.8, 3.2, 1.5],
    [3.8, 2.5, 3.5, 2.9, 2.0],
  ],
  // sample affected counts (per cell)
  affected: [
    [120, 85, 64, 142, 38],
    [42, 88, 51, 70, 25],
    [85, 60, 110, 168, 44],
    [205, 142, 96, 245, 78],
    [412, 280, 358, 318, 188],
  ],
}

// 8 critical supply chains
const SUPPLY_CHAINS: {
  name: string
  risk: 'Low' | 'Medium' | 'High' | 'Critical'
  affected: number
  rootCause: string
}[] = [
  { name: 'Semiconductor → Automobile', risk: 'High', affected: 12500, rootCause: 'Taiwan supply tightening, 8-week lead time' },
  { name: 'API Imports → Pharma', risk: 'Critical', affected: 8200, rootCause: 'China export controls on key APIs' },
  { name: 'Lithium Cells → EV Manufacturing', risk: 'Critical', affected: 5600, rootCause: 'Global lithium price surge 22%' },
  { name: 'Cotton → Textiles', risk: 'Medium', affected: 3400, rootCause: 'Domestic crop shortfall, MSP revision pending' },
  { name: 'Solar Panels → Renewable Energy', risk: 'High', affected: 9800, rootCause: 'ALMM list revisions disrupting imports' },
  { name: 'Edible Oil → FMCG', risk: 'Medium', affected: 2100, rootCause: 'Indonesia palm export levy adjustment' },
  { name: 'Coal → Power Generation', risk: 'Medium', affected: 18700, rootCause: 'Monsoon impacting domestic mine output' },
  { name: 'Steel → Construction', risk: 'Low', affected: 980, rootCause: 'Normal — domestic capacity sufficient' },
]

// 12 quarters of GDP growth
const GDP_QUARTERS: { label: string; value: number; current?: boolean }[] = [
  { label: 'Q1 FY23', value: 13.1 },
  { label: 'Q2 FY23', value: 6.2 },
  { label: 'Q3 FY23', value: 4.5 },
  { label: 'Q4 FY23', value: 4.4 },
  { label: 'Q1 FY24', value: 7.8 },
  { label: 'Q2 FY24', value: 8.3 },
  { label: 'Q3 FY24', value: 8.5 },
  { label: 'Q4 FY24', value: 7.6 },
  { label: 'Q1 FY25', value: 6.7 },
  { label: 'Q2 FY25', value: 6.4 },
  { label: 'Q3 FY25', value: 7.8 },
  { label: 'Q4 FY25', value: 7.2, current: true },
]

// 12 months of GST collection (in ₹ Cr)
const GST_MONTHS: { label: string; value: number; yoy: number }[] = [
  { label: 'Oct', value: 152000, yoy: 9 },
  { label: 'Nov', value: 167000, yoy: 11 },
  { label: 'Dec', value: 165000, yoy: 8 },
  { label: 'Jan', value: 173000, yoy: 10 },
  { label: 'Feb', value: 168000, yoy: 12 },
  { label: 'Mar', value: 187000, yoy: 13 },
  { label: 'Apr', value: 202000, yoy: 14 },
  { label: 'May', value: 158000, yoy: 10 },
  { label: 'Jun', value: 165000, yoy: 9 },
  { label: 'Jul', value: 178000, yoy: 11 },
  { label: 'Aug', value: 174000, yoy: 10 },
  { label: 'Sep', value: 187234, yoy: 12 },
]

// 30 days of business health index (0-100)
const BUSINESS_HEALTH_DAYS: number[] = Array.from({ length: 30 }, (_, i) => {
  const base = 72
  const trend = i * 0.3
  const noise = Math.sin(i * 0.7) * 2 + Math.cos(i * 0.4) * 1.5
  return Math.round(base + trend + noise)
})

// 8 sectors by credit deployment (in ₹ Cr)
const CREDIT_SECTORS: { name: string; value: number; growth: number }[] = [
  { name: 'Manufacturing', value: 1245000, growth: 9.2 },
  { name: 'Services', value: 1450000, growth: 11.4 },
  { name: 'Agriculture', value: 845000, growth: 7.8 },
  { name: 'Retail Trade', value: 620000, growth: 14.6 },
  { name: 'Infrastructure', value: 980000, growth: 8.1 },
  { name: 'MSME', value: 520000, growth: 14.0 },
  { name: 'Real Estate', value: 480000, growth: 5.4 },
  { name: 'Technology', value: 365000, growth: 16.8 },
]

// AI brief bullets
const AI_BRIEF: { icon: React.ElementType; color: string; text: string }[] = [
  { icon: Factory, color: '#10b981', text: 'Manufacturing sector shows robust 8.4% growth, driven by capital goods and electronics — highest in 6 quarters.' },
  { icon: IndianRupee, color: '#10b981', text: 'GST collection momentum (₹1.87L Cr, +12% YoY) suggests strong Q3 GDP print and consumption recovery.' },
  { icon: AlertTriangle, color: '#f59e0b', text: 'Pharma supply chain risk elevated due to API imports from China — recommend accelerating PLI scheme for 23 critical molecules.' },
  { icon: Building2, color: '#10b981', text: 'Credit growth to MSMEs up 14% YoY, indicating healthy small business sentiment and improved bank appetite.' },
  { icon: Landmark, color: '#84cc16', text: 'RBI may consider rate pause at October policy given easing inflation (4.8%) and stable growth outlook.' },
]

// Critical alerts
const CRITICAL_ALERTS: {
  severity: 'Critical' | 'High' | 'Medium'
  icon: string
  title: string
  detail: string
  time: string
}[] = [
  { severity: 'Critical', icon: '🔴', title: '2,341 businesses at high default risk in Textiles sector', detail: 'NPA cluster forming in Tirupur and Surat clusters — immediate restructuring recommended.', time: '4 min ago' },
  { severity: 'High', icon: '🟠', title: 'Semiconductor shortage may impact 12,500 Auto units', detail: 'Q3 production risk for top 6 OEMs — combined revenue impact estimated ₹840 Cr.', time: '12 min ago' },
  { severity: 'High', icon: '🟠', title: 'GST compliance dip detected in 3 states', detail: 'Kerala, Punjab, Jharkhand show 8-12% drop in timely GSTR-1 filings vs 30-day avg.', time: '38 min ago' },
  { severity: 'Medium', icon: '🟡', title: 'NBFC liquidity tightening may slow credit growth', detail: '10-day CP spreads widened 18 bps — monitor Q3 disbursement momentum to MSMEs.', time: '1 hr ago' },
  { severity: 'Medium', icon: '🟡', title: 'Export growth slowing in IT sector', detail: 'Sep IT exports +3.2% vs 6-month avg of 8.5% — US discretionary spend softening.', time: '2 hr ago' },
]

// India states for economic map (stylized coordinates on 400x520 viewBox)
type IndiaState = {
  name: string
  x: number
  y: number
  health: number
  gdp: number // in ₹ Cr
  businesses: number
  growth: number
}

const INDIA_STATES: IndiaState[] = [
  { name: 'Maharashtra', x: 165, y: 290, health: 86, gdp: 3250000, businesses: 1240000, growth: 8.4 },
  { name: 'Tamil Nadu', x: 235, y: 395, health: 84, gdp: 2480000, businesses: 850000, growth: 7.8 },
  { name: 'Karnataka', x: 175, y: 360, health: 88, gdp: 2240000, businesses: 620000, growth: 8.7 },
  { name: 'Gujarat', x: 115, y: 235, health: 90, gdp: 2015000, businesses: 580000, growth: 9.2 },
  { name: 'Uttar Pradesh', x: 230, y: 195, health: 62, gdp: 1875000, businesses: 950000, growth: 6.5 },
  { name: 'West Bengal', x: 305, y: 245, health: 68, gdp: 1620000, businesses: 720000, growth: 7.1 },
  { name: 'Rajasthan', x: 155, y: 180, health: 74, gdp: 1380000, businesses: 410000, growth: 8.0 },
  { name: 'Madhya Pradesh', x: 200, y: 240, health: 70, gdp: 1240000, businesses: 380000, growth: 7.4 },
  { name: 'Telangana', x: 215, y: 315, health: 82, gdp: 1180000, businesses: 320000, growth: 8.6 },
  { name: 'Andhra Pradesh', x: 245, y: 340, health: 76, gdp: 1080000, businesses: 290000, growth: 7.9 },
  { name: 'Kerala', x: 190, y: 415, health: 72, gdp: 980000, businesses: 280000, growth: 6.8 },
  { name: 'Delhi', x: 225, y: 170, health: 85, gdp: 920000, businesses: 410000, growth: 8.3 },
  { name: 'Punjab', x: 210, y: 130, health: 70, gdp: 680000, businesses: 195000, growth: 6.9 },
  { name: 'Haryana', x: 225, y: 155, health: 78, gdp: 720000, businesses: 215000, growth: 7.6 },
  { name: 'Odisha', x: 285, y: 275, health: 66, gdp: 740000, businesses: 220000, growth: 7.2 },
  { name: 'Bihar', x: 285, y: 195, health: 55, gdp: 620000, businesses: 305000, growth: 5.8 },
  { name: 'Jharkhand', x: 270, y: 220, health: 58, gdp: 410000, businesses: 145000, growth: 6.4 },
  { name: 'Chhattisgarh', x: 245, y: 255, health: 64, gdp: 380000, businesses: 125000, growth: 7.0 },
  { name: 'Assam', x: 325, y: 165, health: 60, gdp: 320000, businesses: 110000, growth: 6.2 },
  { name: 'Uttarakhand', x: 220, y: 155, health: 75, gdp: 280000, businesses: 95000, growth: 7.7 },
]

const TOP_STATES = [...INDIA_STATES]
  .sort((a, b) => b.gdp - a.gdp)
  .slice(0, 5)

// Activity feed templates
const ACTIVITY_TEMPLATES: { icon: string; text: string; category: 'positive' | 'routine' | 'warning' | 'critical' | 'info' }[] = [
  { icon: '🟢', text: 'Reliance Industries paid ₹45Cr to vendor', category: 'positive' },
  { icon: '🟡', text: 'TCS filed GSTR-1 for Sep 2025', category: 'routine' },
  { icon: '🔴', text: 'Warning: Pharma supply chain disruption detected', category: 'warning' },
  { icon: '🟢', text: '₹125Cr invoice financed on Invoice Exchange', category: 'positive' },
  { icon: '🟣', text: 'New business registered in Bangalore', category: 'info' },
  { icon: '🟢', text: 'HDFC Bank disbursed ₹250Cr working capital loan', category: 'positive' },
  { icon: '🟡', text: 'Infosys filed GSTR-3B for Q2 2025', category: 'routine' },
  { icon: '🔴', text: 'Critical: 3,200 textile units flagged at high default risk', category: 'critical' },
  { icon: '🟢', text: 'Maruti Suzuki paid ₹78Cr to component suppliers', category: 'positive' },
  { icon: '🟡', text: 'SBI collected ₹1,450Cr GST from corporate clients', category: 'routine' },
  { icon: '🟢', text: 'Adani Group invested ₹500Cr in renewable energy', category: 'positive' },
  { icon: '🔴', text: 'Warning: API imports delayed at Mumbai port', category: 'warning' },
  { icon: '🟢', text: '₹340Cr trade receivables discounting executed on TReDS', category: 'positive' },
  { icon: '🟡', text: 'Bharti Airtel filed income tax return for Q2', category: 'routine' },
  { icon: '🟢', text: 'Bajaj Finance disbursed 12,500 MSME loans worth ₹450Cr', category: 'positive' },
  { icon: '🟢', text: 'Tata Steel completed ₹120Cr vendor payment cycle', category: 'positive' },
  { icon: '🟡', text: 'ICICI Bank processed ₹890Cr GST collections today', category: 'routine' },
  { icon: '🔴', text: 'Critical: Semiconductor shortage escalates — 15% production impact', category: 'critical' },
  { icon: '🟢', text: '₹95Cr GSTR-1 filed by Mahindra & Mahindra', category: 'positive' },
  { icon: '🟣', text: 'Coal India paid ₹230Cr royalty to state governments', category: 'info' },
  { icon: '🟢', text: 'L&T won ₹2,400Cr infrastructure contract', category: 'positive' },
  { icon: '🟡', text: 'Axis Bank reconciled 4,500 invoices via TReDS', category: 'routine' },
  { icon: '🟣', text: '18,400 new MSME registrations in Tier-2 cities today', category: 'info' },
  { icon: '🔴', text: 'Warning: Cotton prices spike 7% — textile margins at risk', category: 'warning' },
]

const categoryColor = (cat: string) => {
  switch (cat) {
    case 'positive': return 'text-emerald-400'
    case 'routine': return 'text-amber-400'
    case 'warning': return 'text-orange-400'
    case 'critical': return 'text-red-400'
    case 'info': return 'text-violet-400'
    default: return 'text-slate-400'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = '#10b981', w = 100, h = 28 }: {
  data: number[]; color?: string; w?: number; h?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x},${y}`
  })
  const areaPath = `M0,${h} ` + data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `L${x},${y}`
  }).join(' ') + ` L${w},${h} Z`

  const gradId = `spark-${color.replace('#', '')}`

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={pts.join(' ')}
        fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function GdpLineChart({ data }: { data: { label: string; value: number; current?: boolean }[] }) {
  const w = 360
  const h = 200
  const padL = 40, padR = 16, padT = 16, padB = 36
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const values = data.map(d => d.value)
  const max = Math.max(...values) * 1.15
  const min = Math.min(...values) * 0.7
  const range = max - min || 1

  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * chartW,
    y: padT + chartH - ((d.value - min) / range) * chartH,
    value: d.value,
    current: d.current,
    label: d.label,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => padT + chartH - f * chartH)

  return (
    <svg width={w} height={h} className="w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gdp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridLines.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500" style={{ fontSize: 9 }}>
            {(min + (1 - i / 4) * range).toFixed(1)}%
          </text>
        </g>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill="url(#gdp-area)" />
      {/* Line */}
      <motion.path
        d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' as const }}
      />
      {/* Data points */}
      {pts.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x} cy={p.y}
          r={p.current ? 5 : 3}
          fill={p.current ? '#10b981' : '#0f172a'}
          stroke={p.current ? '#34d399' : '#10b981'}
          strokeWidth={p.current ? 3 : 2}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + i * 0.05 }}
        />
      ))}
      {/* Current quarter highlight */}
      {pts.find(p => p.current) && (
        <line
          x1={pts.find(p => p.current)!.x}
          y1={padT}
          x2={pts.find(p => p.current)!.x}
          y2={padT + chartH}
          stroke="#34d399" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"
        />
      )}
      {/* Labels */}
      {pts.map((p, i) => {
        if (i % 2 !== 0 && i !== pts.length - 1) return null
        return (
          <text key={`l${i}`} x={p.x} y={h - 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 8.5 }}>
            {p.label.replace(' FY', '')}
          </text>
        )
      })}
    </svg>
  )
}

function GstBarChart({ data }: { data: { label: string; value: number; yoy: number }[] }) {
  const w = 360
  const h = 200
  const padL = 50, padR = 16, padT = 16, padB = 36
  const chartW = w - padL - padR
  const chartH = h - padT - padB
  const max = Math.max(...data.map(d => d.value)) * 1.1
  const barW = (chartW / data.length) * 0.6
  const gap = (chartW / data.length) * 0.4

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => padT + chartH - f * chartH)

  return (
    <svg width={w} height={h} className="w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gst-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="gst-bar-current" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridLines.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500" style={{ fontSize: 9 }}>
            {(max * (1 - i / 4) / 1000).toFixed(0)}K
          </text>
        </g>
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.value / max) * chartH
        const x = padL + i * (barW + gap) + gap / 2
        const y = padT + chartH - barH
        const isCurrent = i === data.length - 1
        return (
          <g key={i}>
            <motion.rect
              x={x} y={y} width={barW} height={barH}
              rx="2"
              fill={isCurrent ? 'url(#gst-bar-current)' : 'url(#gst-bar)'}
              initial={{ height: 0, y: padT + chartH }}
              animate={{ height: barH, y }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: 'easeOut' as const }}
            />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9 }}>
              {d.label}
            </text>
            {isCurrent && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-amber-400" style={{ fontSize: 9, fontWeight: 700 }}>
                +{d.yoy}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function BusinessHealthAreaChart({ data }: { data: number[] }) {
  const w = 360
  const h = 200
  const padL = 36, padR = 16, padT = 16, padB = 28
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const max = 100
  const min = Math.min(...data) - 5
  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * chartW,
    y: padT + chartH - ((v - min) / range) * chartH,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => padT + chartH - f * chartH)

  return (
    <svg width={w} height={h} className="w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bh-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {gridLines.map((y, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500" style={{ fontSize: 9 }}>
            {Math.round(min + (1 - i / 4) * range)}
          </text>
        </g>
      ))}
      {/* Area */}
      <path d={areaPath} fill="url(#bh-area)" />
      {/* Line */}
      <motion.path
        d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, ease: 'easeOut' as const }}
      />
      {/* End dot */}
      <motion.circle
        cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
        r="4" fill="#10b981" stroke="#34d399" strokeWidth="2"
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 1.6, type: 'spring' }}
      />
      {/* Labels */}
      <text x={padL} y={h - 6} className="fill-slate-500" style={{ fontSize: 9 }}>Day 1</text>
      <text x={w - padR} y={h - 6} textAnchor="end" className="fill-slate-500" style={{ fontSize: 9 }}>Day 30</text>
    </svg>
  )
}

function CreditDeploymentBarChart({ data }: { data: { name: string; value: number; growth: number }[] }) {
  const w = 360
  const h = 220
  const padL = 110, padR = 50, padT = 8, padB = 8
  const chartW = w - padL - padR
  const chartH = h - padT - padB
  const rowH = chartH / data.length
  const max = Math.max(...data.map(d => d.value))

  return (
    <svg width={w} height={h} className="w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="cd-bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const barW = (d.value / max) * chartW
        const y = padT + i * rowH + rowH * 0.18
        const barH = rowH * 0.64
        return (
          <g key={i}>
            <text x={padL - 8} y={y + barH / 2 + 3} textAnchor="end" className="fill-slate-300" style={{ fontSize: 10, fontWeight: 500 }}>
              {d.name}
            </text>
            <rect x={padL} y={y} width={chartW} height={barH} fill="#1e293b" rx="3" />
            <motion.rect
              x={padL} y={y} width={barW} height={barH}
              rx="3" fill="url(#cd-bar)"
              initial={{ width: 0 }}
              animate={{ width: barW }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: 'easeOut' as const }}
            />
            <text x={padL + barW + 6} y={y + barH / 2 + 3} className="fill-slate-200" style={{ fontSize: 9, fontWeight: 600 }}>
              ₹{(d.value / 100000).toFixed(2)}L Cr
            </text>
            <text x={w - padR + 4} y={y + barH / 2 + 3} textAnchor="end" className="fill-emerald-400" style={{ fontSize: 9, fontWeight: 700 }}>
              +{d.growth}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function IndiaEconomicMapSVG({ states, hoveredState, onHover }: {
  states: IndiaState[]
  hoveredState: string | null
  onHover: (name: string | null) => void
}) {
  // Stylized India outline path on 400x490 viewBox
  const indiaPath = `M 215,55
    C 245,60 275,75 295,95
    C 315,115 330,140 340,170
    C 348,195 350,220 345,245
    C 340,270 330,295 315,320
    C 300,345 285,370 270,395
    C 258,415 245,432 232,442
    C 222,448 215,448 208,442
    C 195,432 182,415 170,395
    C 155,370 140,345 128,318
    C 115,290 105,260 100,230
    C 95,200 100,170 115,140
    C 130,110 155,85 180,70
    C 195,62 205,57 215,55 Z`

  return (
    <svg viewBox="0 0 400 490" className="w-full h-auto" style={{ maxHeight: 480 }}>
      <defs>
        <filter id="india-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="india-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Outer glow */}
      <motion.path
        d={indiaPath}
        fill="none"
        stroke="#10b981"
        strokeWidth="1"
        opacity="0.4"
        filter="url(#india-glow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' as const }}
      />
      {/* India fill */}
      <path
        d={indiaPath}
        fill="url(#india-fill)"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />
      {/* Grid pattern overlay */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`h${i}`} x1="100" y1={70 + i * 32} x2="350" y2={70 + i * 32} stroke="#10b981" strokeWidth="0.3" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={100 + i * 28} y1="55" x2={100 + i * 28} y2="445" stroke="#10b981" strokeWidth="0.3" />
        ))}
      </motion.g>
      {/* State markers */}
      {states.map((s, i) => {
        const isHovered = hoveredState === s.name
        const r = isHovered ? 12 : 9
        const color = healthColor(s.health)
        return (
          <Tooltip key={s.name}>
            <TooltipTrigger asChild>
              <g
                onMouseEnter={() => onHover(s.name)}
                onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <motion.circle
                  cx={s.x} cy={s.y} r={r + 3}
                  fill={color} opacity={isHovered ? 0.25 : 0.12}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.04 }}
                />
                <motion.circle
                  cx={s.x} cy={s.y} r={r}
                  fill={color}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke={color} strokeWidth="1.5"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.04, type: 'spring' }}
                  style={{ filter: isHovered ? 'url(#india-glow)' : 'none' }}
                />
                <text
                  x={s.x} y={s.y + r + 11}
                  textAnchor="middle"
                  className="fill-slate-300"
                  style={{ fontSize: 8.5, fontWeight: isHovered ? 700 : 500 }}
                >
                  {s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}
                </text>
              </g>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-slate-900 border-slate-700 text-slate-100 p-3 shadow-xl"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: healthColor(s.health) }}
                  />
                  <span className="font-semibold text-sm">{s.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{ borderColor: healthColor(s.health), color: healthColor(s.health) }}
                  >
                    {healthLabel(s.health)}
                  </Badge>
                </div>
                <div className="text-xs text-slate-300 space-y-0.5 pt-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">GSP:</span>
                    <span className="font-medium">₹{(s.gdp / 100000).toFixed(2)}L Cr</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Businesses:</span>
                    <span className="font-medium">{fmtNumber(s.businesses)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Growth:</span>
                    <span className="font-medium text-emerald-400">+{s.growth}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Health Score:</span>
                    <span className="font-medium" style={{ color: healthColor(s.health) }}>
                      {s.health}/100
                    </span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
      {/* Scanning dot */}
      <motion.circle
        r="3" fill="#34d399" filter="url(#india-glow)"
        animate={{
          cx: [165, 235, 305, 235, 165],
          cy: [290, 395, 245, 130, 290],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' as const }}
      />
    </svg>
  )
}

function RiskHeatmapSVG({ matrix }: { matrix: typeof RISK_MATRIX }) {
  const cellW = 56
  const cellH = 44
  const labelW = 100
  const headerH = 24
  const w = labelW + matrix.riskTypes.length * cellW + 8
  const h = headerH + matrix.industries.length * cellH + 8

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 260 }}>
      {/* Column headers */}
      {matrix.riskTypes.map((rt, i) => (
        <text
          key={rt}
          x={labelW + i * cellW + cellW / 2}
          y={headerH - 6}
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 9, fontWeight: 600 }}
        >
          {rt}
        </text>
      ))}
      {/* Rows */}
      {matrix.industries.map((ind, ri) => (
        <g key={ind}>
          {/* Row label */}
          <text
            x={labelW - 8}
            y={headerH + ri * cellH + cellH / 2 + 3}
            textAnchor="end"
            className="fill-slate-300"
            style={{ fontSize: 9.5, fontWeight: 500 }}
          >
            {ind}
          </text>
          {/* Cells */}
          {matrix.riskTypes.map((rt, ci) => {
            const v = matrix.values[ri][ci]
            const affected = matrix.affected[ri][ci]
            const color = riskColor(v)
            return (
              <Tooltip key={rt}>
                <TooltipTrigger asChild>
                  <motion.rect
                    x={labelW + ci * cellW + 2}
                    y={headerH + ri * cellH + 2}
                    width={cellW - 4}
                    height={cellH - 4}
                    rx="3"
                    fill={color}
                    fillOpacity="0.65"
                    stroke={color}
                    strokeWidth="1"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + (ri * 5 + ci) * 0.025, duration: 0.3 }}
                    style={{ cursor: 'pointer' }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-slate-900 border-slate-700 text-slate-100 p-2 shadow-xl"
                >
                  <div className="text-xs">
                    <div className="font-semibold">{ind} — {rt} Risk</div>
                    <div className="text-slate-400 mt-1">Risk Level: <span style={{ color }}>{v.toFixed(1)}/5.0</span></div>
                    <div className="text-slate-400">Affected Businesses: <span className="text-slate-200">{fmtNumber(affected)}</span></div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {/* Cell value text */}
          {matrix.riskTypes.map((rt, ci) => {
            const v = matrix.values[ri][ci]
            return (
              <text
                key={`v${rt}`}
                x={labelW + ci * cellW + cellW / 2}
                y={headerH + ri * cellH + cellH / 2 + 3}
                textAnchor="middle"
                className="fill-slate-950"
                style={{ fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}
              >
                {v.toFixed(1)}
              </text>
            )
          })}
        </g>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP BAR + TICKER
// ═══════════════════════════════════════════════════════════════════════════════

function ScrollingTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="relative overflow-hidden bg-slate-950 border-b border-emerald-500/20 h-9 flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="flex items-center gap-2 px-3 md:px-4 shrink-0 z-20 border-r border-emerald-500/20 h-full bg-slate-950">
        <motion.div
          className="w-2 h-2 rounded-full bg-emerald-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[11px] font-bold text-emerald-400 tracking-wider hidden sm:inline">LIVE FEED</span>
      </div>
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' as const }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-5 text-[11px] text-slate-300">
            <span className="text-slate-500 font-medium">{item.label}</span>
            <span className={
              item.trend === 'up' ? 'text-emerald-400 font-semibold' :
              item.trend === 'down' ? 'text-red-400 font-semibold' :
              'text-amber-400 font-semibold'
            }>
              {item.value}
            </span>
            {item.trend === 'up' && <span className="text-emerald-500">▲</span>}
            {item.trend === 'down' && <span className="text-red-500">▼</span>}
            {item.trend === 'flat' && <span className="text-amber-500">●</span>}
            <span className="text-slate-700">|</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

function TopBar() {
  const { time, date, isMarketOpen } = useIstClock()
  return (
    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-emerald-500/20">
      <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-50 tracking-tight">
              ECONOMIC WAR ROOM
              <span className="text-emerald-400 text-xs ml-2 font-mono">™</span>
            </h1>
            <p className="text-[11px] md:text-xs text-slate-400 hidden sm:block">
              India&apos;s Business Intelligence Command Center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[11px] font-bold text-emerald-300 tracking-wider">LIVE</span>
          </div>

          {/* Market status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            isMarketOpen
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-slate-800/50 border-slate-700'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span className={`text-[11px] font-semibold ${isMarketOpen ? 'text-emerald-300' : 'text-slate-400'}`}>
              {isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-slate-100 tabular-nums">{time}</span>
              <span className="text-[9px] text-slate-500 -mt-0.5 hidden sm:block">IST · {date}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════

function HeroKpiCard({ kpi, index }: { kpi: HeroKpi; index: number }) {
  const animatedValue = useCountUp(kpi.value)
  const Icon = kpi.icon
  const displayValue = kpi.value >= 1000
    ? (kpi.title.includes('GST') || kpi.title.includes('Credit'))
      ? '₹' + Math.round(animatedValue).toLocaleString('en-IN') + ' Cr'
      : Math.round(animatedValue).toLocaleString('en-IN')
    : animatedValue.toFixed(1) + (kpi.formatted.endsWith('%') ? '%' : '')

  return (
    <motion.div
      custom={index}
      variants={staggerChild}
      initial="initial"
      animate="animate"
    >
      <motion.div
        {...glowPulse}
        className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-950 p-4 hover:border-emerald-500/40 transition-colors h-full group"
      >
        {/* Scan line effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
            {...scanLine}
          />
        </div>

        <div className="relative">
          {/* Icon + label */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}20`, border: `1px solid ${kpi.color}40` }}
              >
                <Icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-tight">
                {kpi.title}
              </span>
            </div>
          </div>

          {/* Value */}
          <div className="mb-2">
            <div className="text-xl md:text-2xl font-bold text-slate-50 tabular-nums tracking-tight">
              {displayValue}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{kpi.sublabel}</div>
          </div>

          {/* Trend */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              {kpi.trend === 'up' ? (
                <ArrowUpRight className={`w-3.5 h-3.5 ${kpi.trendGood ? 'text-emerald-400' : 'text-red-400'}`} />
              ) : (
                <ArrowDownRight className={`w-3.5 h-3.5 ${kpi.trendGood ? 'text-emerald-400' : 'text-red-400'}`} />
              )}
              <span className={`text-[11px] font-semibold ${kpi.trendGood ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.trendLabel}
              </span>
            </div>
            <div className="opacity-70">
              <Sparkline data={kpi.sparkData} color={kpi.color} w={56} h={18} />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIA ECONOMIC MAP CARD
// ═══════════════════════════════════════════════════════════════════════════════

function IndiaEconomicMapCard() {
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              India Economic Health Map
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Healthy</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-400">Moderate</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-400">At Risk</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TooltipProvider delayDuration={150}>
              <div className="relative">
                <IndiaEconomicMapSVG
                  states={INDIA_STATES}
                  hoveredState={hoveredState}
                  onHover={setHoveredState}
                />
                {/* Corner stats overlay */}
                <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm border border-emerald-500/20 rounded-md px-2.5 py-1.5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">States Tracked</div>
                  <div className="text-sm font-bold text-emerald-400">{INDIA_STATES.length}</div>
                </div>
                <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-sm border border-emerald-500/20 rounded-md px-2.5 py-1.5 text-right">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Avg Health</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {Math.round(INDIA_STATES.reduce((s, x) => s + x.health, 0) / INDIA_STATES.length)}
                  </div>
                </div>
              </div>
            </TooltipProvider>

            {/* Top 5 contributing states */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Top 5 Contributing States</h4>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">by GSP</Badge>
              </div>
              <div className="space-y-2">
                {TOP_STATES.map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    onMouseEnter={() => setHoveredState(s.name)}
                    onMouseLeave={() => setHoveredState(null)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      hoveredState === s.name
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      i === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' :
                      i === 2 ? 'bg-orange-700/20 text-orange-500 border border-orange-700/30' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{s.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{fmtNumber(s.businesses)} businesses</span>
                        <span>·</span>
                        <span className="text-emerald-400">+{s.growth}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-100 tabular-nums">
                        ₹{(s.gdp / 100000).toFixed(2)}L Cr
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: healthColor(s.health) }}
                        />
                        <span className="text-[9px] text-slate-500">{s.health}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 pt-2 mt-3 border-t border-slate-800">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">Total GSP</div>
                  <div className="text-xs font-bold text-slate-100">₹2.4Cr+ Cr</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">Businesses</div>
                  <div className="text-xs font-bold text-slate-100">85L+</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">Avg Growth</div>
                  <div className="text-xs font-bold text-emerald-400">7.6%</div>
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
// LIVE ACTIVITY FEED CARD
// ═══════════════════════════════════════════════════════════════════════════════

type FeedItem = { id: number; icon: string; text: string; category: string; time: string }

// Module-level counter for unique feed item IDs (avoids ref-in-render lint error)
let _feedIdSeq = 0
const nextFeedId = () => {
  _feedIdSeq += 1
  return _feedIdSeq
}

function LiveActivityFeedCard() {
  const [items, setItems] = useState<FeedItem[]>(() => {
    // Seed with 8 items via lazy initializer (avoids setState-in-effect)
    const seed: FeedItem[] = []
    for (let i = 0; i < 8; i++) {
      const tpl = ACTIVITY_TEMPLATES[i % ACTIVITY_TEMPLATES.length]
      seed.push({
        id: nextFeedId(),
        icon: tpl.icon,
        text: tpl.text,
        category: tpl.category,
        time: 'just now',
      })
    }
    return seed
  })

  useEffect(() => {
    // Live activity feed fabrication removed. The feed now shows only real
    // items (initial seed). Real activities should arrive via Firestore
    // subscription or webhook — not Math.random fabrication.
    return
  }, [])

  // Update "time ago" labels periodically
  useEffect(() => {
    const t = setInterval(() => {
      setItems(prev => prev.map((item, idx) => {
        if (idx === 0) return { ...item, time: 'just now' }
        const sec = idx * 2
        if (sec < 60) return { ...item, time: `${sec}s ago` }
        return { ...item, time: `${Math.floor(sec / 60)}m ago` }
      }))
    }, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.15 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full flex flex-col">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Live Economic Activity Feed
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-[10px] font-medium text-emerald-400">STREAMING</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
            <AnimatePresence initial={false}>
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-start gap-2.5 px-4 py-2.5 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${
                    i === 0 ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 leading-snug">{item.text}</p>
                    <p className={`text-[10px] mt-0.5 ${categoryColor(item.category)}`}>
                      {item.category.toUpperCase()} · {item.time}
                    </p>
                  </div>
                  {i === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[9px] font-bold text-emerald-400 mt-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 shrink-0"
                    >
                      NEW
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY HEALTH MONITOR
// ═══════════════════════════════════════════════════════════════════════════════

function IndustryHealthMonitor() {
  const avgScore = Math.round(INDUSTRIES.reduce((s, x) => s + x.score, 0) / INDUSTRIES.length)
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Industry Health Monitor
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-slate-500">Avg</div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{avgScore}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1.5">
            {INDUSTRIES.map((ind, i) => {
              const color = healthColor(ind.score)
              return (
                <motion.div
                  key={ind.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                >
                  {/* Rank/Icon */}
                  <div className="text-[10px] text-slate-600 font-mono w-5">
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  {/* Name */}
                  <div className="w-24 shrink-0">
                    <div className="text-xs font-medium text-slate-200 truncate">{ind.name}</div>
                  </div>

                  {/* Sparkline */}
                  <div className="shrink-0">
                    <Sparkline data={ind.sparkData} color={color} w={60} h={20} />
                  </div>

                  {/* Score bar */}
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${ind.score}%` }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.8, ease: 'easeOut' as const }}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold tabular-nums" style={{ color }}>
                      {ind.score}
                    </div>
                    <div className={`text-[9px] flex items-center justify-end gap-0.5 ${
                      ind.trend === 'up' ? 'text-emerald-400' :
                      ind.trend === 'down' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {ind.trend === 'up' && <ArrowUpRight className="w-2.5 h-2.5" />}
                      {ind.trend === 'down' && <ArrowDownRight className="w-2.5 h-2.5" />}
                      {ind.delta}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT RISK HEAT MAP
// ═══════════════════════════════════════════════════════════════════════════════

function CreditRiskHeatMap() {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.25 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Credit Risk Heat Map
            </CardTitle>
            <div className="flex items-center gap-2 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: riskColor(0.8) }} />
                <span className="text-slate-500">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: riskColor(2.5) }} />
                <span className="text-slate-500">Med</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: riskColor(4.5) }} />
                <span className="text-slate-500">High</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <TooltipProvider delayDuration={150}>
            <RiskHeatmapSVG matrix={RISK_MATRIX} />
          </TooltipProvider>
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Total Risks</div>
              <div className="text-sm font-bold text-slate-100">25</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Critical</div>
              <div className="text-sm font-bold text-red-400">4</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Affected</div>
              <div className="text-sm font-bold text-amber-400">3,420</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLY CHAIN RISK MONITOR
// ═══════════════════════════════════════════════════════════════════════════════

const riskBadgeStyle = (risk: string) => {
  switch (risk) {
    case 'Critical': return 'bg-red-500/15 text-red-400 border-red-500/40'
    case 'High': return 'bg-orange-500/15 text-orange-400 border-orange-500/40'
    case 'Medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/40'
    case 'Low': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
    default: return 'bg-slate-700 text-slate-300 border-slate-600'
  }
}

const riskDot = (risk: string) => {
  switch (risk) {
    case 'Critical': return 'bg-red-500'
    case 'High': return 'bg-orange-500'
    case 'Medium': return 'bg-amber-500'
    case 'Low': return 'bg-emerald-500'
    default: return 'bg-slate-500'
  }
}

function SupplyChainRiskMonitor() {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              Supply Chain Risk Monitor
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">
              {SUPPLY_CHAINS.filter(s => s.risk === 'Critical' || s.risk === 'High').length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2">
            {SUPPLY_CHAINS.map((sc, i) => (
              <motion.div
                key={sc.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${riskDot(sc.risk)} shrink-0`} />
                    <span className="text-xs font-medium text-slate-200 truncate">{sc.name}</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${riskBadgeStyle(sc.risk)}`}>
                    {sc.risk}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug mb-2 pl-3.5">
                  {sc.rootCause}
                </p>
                <div className="flex items-center justify-between pl-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Building2 className="w-3 h-3" />
                    <span>{fmtNumber(sc.affected)} affected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Investigate
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROW 4 — KPI CHART CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function GdpTrendCard() {
  const current = GDP_QUARTERS.find(q => q.current)
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.35 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              GDP Trend
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              QoQ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-50 tabular-nums">{current?.value}%</span>
            <span className="text-[11px] text-slate-500">{current?.label}</span>
            <Badge className="ml-auto text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" variant="outline">
              CURRENT
            </Badge>
          </div>
          <GdpLineChart data={GDP_QUARTERS} />
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">12Q Avg</div>
              <div className="text-xs font-bold text-slate-200">
                {(GDP_QUARTERS.reduce((s, q) => s + q.value, 0) / GDP_QUARTERS.length).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Peak</div>
              <div className="text-xs font-bold text-emerald-400">
                {Math.max(...GDP_QUARTERS.map(q => q.value)).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Low</div>
              <div className="text-xs font-bold text-amber-400">
                {Math.min(...GDP_QUARTERS.map(q => q.value)).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function GstCollectionCard() {
  const latest = GST_MONTHS[GST_MONTHS.length - 1]
  const prev = GST_MONTHS[GST_MONTHS.length - 2]
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.4 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
              GST Collection
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
              +{latest.yoy}% YoY
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-50 tabular-nums">
              ₹{(latest.value / 1000).toFixed(1)}K Cr
            </span>
            <span className="text-[11px] text-slate-500">Sep 2025</span>
            <div className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400">
              <ArrowUpRight className="w-3 h-3" />
              +{((latest.value - prev.value) / prev.value * 100).toFixed(1)}% MoM
            </div>
          </div>
          <GstBarChart data={GST_MONTHS} />
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase">12M Avg</div>
              <div className="text-xs font-bold text-slate-200">
                ₹{Math.round(GST_MONTHS.reduce((s, m) => s + m.value, 0) / GST_MONTHS.length / 1000)}K Cr
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">Peak</div>
              <div className="text-xs font-bold text-emerald-400">
                ₹{Math.round(Math.max(...GST_MONTHS.map(m => m.value)) / 1000)}K Cr
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase">FY25 YTD</div>
              <div className="text-xs font-bold text-emerald-400">
                ₹{(GST_MONTHS.slice(-6).reduce((s, m) => s + m.value, 0) / 100000).toFixed(2)}L Cr
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function BusinessHealthCard() {
  const latest = BUSINESS_HEALTH_DAYS[BUSINESS_HEALTH_DAYS.length - 1]
  const first = BUSINESS_HEALTH_DAYS[0]
  const delta = latest - first
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.45 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Business Health Index
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              30 days
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-50 tabular-nums">{latest}</span>
            <span className="text-[11px] text-slate-500">/ 100</span>
            <div className={`ml-auto flex items-center gap-1 text-[11px] ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(delta)} pts
            </div>
          </div>
          <BusinessHealthAreaChart data={BUSINESS_HEALTH_DAYS} />
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Profitability</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }} />
                </div>
                <span className="text-emerald-400 font-medium w-8 text-right">82</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Liquidity</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '76%' }} />
                </div>
                <span className="text-emerald-400 font-medium w-8 text-right">76</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Solvency</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '68%' }} />
                </div>
                <span className="text-amber-400 font-medium w-8 text-right">68</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function CreditDeploymentCard() {
  const total = CREDIT_SECTORS.reduce((s, x) => s + x.value, 0)
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.5 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Credit by Sector
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              Top 8
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-50 tabular-nums">
              ₹{(total / 100000).toFixed(2)}L Cr
            </span>
            <span className="text-[11px] text-slate-500">Total deployed</span>
            <div className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400">
              <ArrowUpRight className="w-3 h-3" />
              +9.6% YoY
            </div>
          </div>
          <CreditDeploymentBarChart data={CREDIT_SECTORS} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ECONOMIC BRIEF
// ═══════════════════════════════════════════════════════════════════════════════

function AiEconomicBrief() {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.55 }}>
      <Card className="relative overflow-hidden border-slate-700/50 h-full">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-emerald-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(245,158,11,0.08),transparent_50%)]" />

        <CardHeader className="relative pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              AI Economic Brief
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 ml-1"
              >
                <Sparkles className="w-3 h-3" />
                Generated
              </motion.span>
            </CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
              <CpuIcon className="w-3 h-3 mr-1" />
              GSTPilot AI
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative p-4 md:p-6">
          <div className="space-y-3">
            {AI_BRIEF.map((b, i) => {
              const Icon = b.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${b.color}20`, border: `1px solid ${b.color}40` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                      {b.text}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span>Updated 2 min ago</span>
              </div>
              <span className="text-slate-700">·</span>
              <span>Next refresh in 4 min</span>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Generated by GSTPilot AI Economic Intelligence Engine
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

const severityStyle = (s: string) => {
  switch (s) {
    case 'Critical': return { badge: 'bg-red-500/15 text-red-400 border-red-500/40', icon: 'text-red-400', border: 'border-red-500/30' }
    case 'High': return { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/40', icon: 'text-orange-400', border: 'border-orange-500/30' }
    case 'Medium': return { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/40', icon: 'text-amber-400', border: 'border-amber-500/30' }
    default: return { badge: 'bg-slate-700 text-slate-300 border-slate-600', icon: 'text-slate-400', border: 'border-slate-700' }
  }
}

function CriticalAlerts() {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.6 }}>
      <Card className="bg-white/5 backdrop-blur-sm border-slate-700/50 overflow-hidden h-full">
        <CardHeader className="pb-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              Critical Alerts
            </CardTitle>
            <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">
              {CRITICAL_ALERTS.filter(a => a.severity === 'Critical').length} Critical
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="space-y-2">
            {CRITICAL_ALERTS.map((alert, i) => {
              const style = severityStyle(alert.severity)
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className={`p-3 rounded-lg border ${style.border} bg-slate-900/40 hover:bg-slate-800/40 transition-all group cursor-pointer`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm shrink-0 mt-0.5">{alert.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-slate-200 leading-snug">
                          {alert.title}
                        </p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${style.badge}`}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug mb-1.5">
                        {alert.detail}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-600 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {alert.time}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-5 text-[10px] px-1.5 ${style.icon} hover:bg-slate-800`}
                        >
                          Resolve
                          <ChevronRight className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER STATUS BAR
// ═══════════════════════════════════════════════════════════════════════════════

function FooterStatusBar() {
  return (
    <div className="mt-auto border-t border-slate-800 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-[10px]">
        <div className="flex items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3 text-emerald-500" />
            <span>System Operational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Network className="w-3 h-3 text-emerald-500" />
            <span>Data Sources: 24/24 Online</span>
          </div>
          <div className="flex items-center gap-1.5 hidden md:flex">
            <Cpu className="w-3 h-3 text-emerald-500" />
            <span>AI Engine: Active</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <span>Latency: 142ms</span>
          <span className="text-slate-700">·</span>
          <span>v8.0.0</span>
          <span className="text-slate-700">·</span>
          <span className="text-emerald-500">GSTPilot FIN NET™</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EconomicWarRoomPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Custom scrollbar styling via injected style tag */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15,23,42,0.4); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.5); }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(16,185,129,0.3) rgba(15,23,42,0.4); }
      `}</style>

      {/* Top scrolling ticker */}
      <ScrollingTicker />

      {/* Top bar with clock + market status */}
      <TopBar />

      <main className="flex-1 max-w-[1800px] w-full mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Row 1 — 6 Hero KPI Cards */}
        <section
          aria-label="Key Economic Indicators"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4"
        >
          {HERO_KPIS.map((kpi, i) => (
            <HeroKpiCard key={kpi.title} kpi={kpi} index={i} />
          ))}
        </section>

        {/* Row 2 — India Economic Map (col-span-8) + Live Activity Feed (col-span-4) */}
        <section
          aria-label="National Economic Map and Live Activity"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6"
        >
          <div className="lg:col-span-8">
            <IndiaEconomicMapCard />
          </div>
          <div className="lg:col-span-4">
            <LiveActivityFeedCard />
          </div>
        </section>

        {/* Row 3 — 3-column panels: Industry / Credit Risk / Supply Chain */}
        <section
          aria-label="Industry, Credit and Supply Chain Risk"
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6"
        >
          <IndustryHealthMonitor />
          <CreditRiskHeatMap />
          <SupplyChainRiskMonitor />
        </section>

        {/* Row 4 — 4 KPI chart panels */}
        <section
          aria-label="Macro Trend Analytics"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6"
        >
          <GdpTrendCard />
          <GstCollectionCard />
          <BusinessHealthCard />
          <CreditDeploymentCard />
        </section>

        {/* Row 5 — AI Brief + Critical Alerts */}
        <section
          aria-label="AI Brief and Critical Alerts"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6"
        >
          <div className="lg:col-span-8">
            <AiEconomicBrief />
          </div>
          <div className="lg:col-span-4">
            <CriticalAlerts />
          </div>
        </section>
      </main>

      {/* Footer status bar */}
      <FooterStatusBar />
    </div>
  )
}
