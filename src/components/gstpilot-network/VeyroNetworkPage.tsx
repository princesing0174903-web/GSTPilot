'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Users, Share2, IndianRupee, Award, TrendingUp, Zap,
  Crown, Star, Target, BarChart3, Activity, Send, Link2,
  Building2, Rocket, Gift, Trophy, ChevronRight, ArrowRight,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtINR = (n: number): string => {
  const s = Math.abs(n).toString()
  if (s.length <= 3) return (n < 0 ? '-' : '') + '₹' + s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
  return (n < 0 ? '-' : '') + '₹' + formatted
}

const fmtNum = (n: number): string => {
  const s = Math.abs(n).toString()
  if (s.length <= 3) return (n < 0 ? '-' : '') + s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
  return (n < 0 ? '-' : '') + formatted
}

// ── Demo Data ────────────────────────────────────────────────────────────────
const NETWORK_TARGETS = [
  { label: 'CA Firms', icon: Building2, current: 12347, target: 100000, color: '#2563EB' },
  { label: 'Businesses', icon: Users, current: 567890, target: 5000000, color: '#1D4ED8' },
  { label: 'Invoices', icon: BarChart3, current: 123456789, target: 500000000, color: '#047857' },
  { label: 'Monthly Transactions', icon: Activity, current: 34567890, target: 50000000, color: '#065f46' },
]

const GROWTH_LOOP = [
  { step: 1, from: 'CA', to: 'Business', label: 'CA invites clients', avg: 15, conversion: 0.72, time: '2.3 days', color: '#2563EB' },
  { step: 2, from: 'Business', to: 'Vendor', label: 'Clients invite vendors', avg: 8, conversion: 0.65, time: '3.1 days', color: '#1D4ED8' },
  { step: 3, from: 'Vendor', to: 'Accountant', label: 'Vendors invite accountants', avg: 3, conversion: 0.58, time: '4.7 days', color: '#047857' },
  { step: 4, from: 'Accountant', to: 'CA', label: 'Accountants invite CAs', avg: 2, conversion: 0.45, time: '5.2 days', color: '#065f46' },
]

const NETWORK_DEPTH = [
  { degree: '1st', count: 156, label: 'Direct connections', color: '#2563EB' },
  { degree: '2nd', count: 2340, label: 'Friends of friends', color: '#1D4ED8' },
  { degree: '3rd', count: 35100, label: 'Extended network', color: '#047857' },
  { degree: '4th', count: 526500, label: 'Viral reach', color: '#065f46' },
]

const LEADERBOARD = [
  { rank: 1, name: 'Rajesh K.', firm: 'Sharma & Associates', referrals: 347, earnings: 234500, badge: 'crown' },
  { rank: 2, name: 'Priya M.', firm: 'Mehta Tax Solutions', referrals: 312, earnings: 198700, badge: 'gold' },
  { rank: 3, name: 'Amit S.', firm: 'Singh Consulting', referrals: 289, earnings: 176300, badge: 'silver' },
  { rank: 4, name: 'Sunita P.', firm: 'Patel Financial Services', referrals: 267, earnings: 154200, badge: 'bronze' },
  { rank: 5, name: 'Vikram D.', firm: 'Desai & Co.', referrals: 245, earnings: 142800, badge: 'bronze' },
  { rank: 6, name: 'Anita R.', firm: 'Rao Advisory', referrals: 223, earnings: 128900, badge: 'bronze' },
  { rank: 7, name: 'Sanjay G.', firm: 'Gupta Associates', referrals: 201, earnings: 115600, badge: 'bronze' },
  { rank: 8, name: 'Meera J.', firm: 'Joshi Tax Firm', referrals: 189, earnings: 104500, badge: 'bronze' },
  { rank: 9, name: 'Ramesh T.', firm: 'Thakur Consulting', referrals: 176, earnings: 97200, badge: 'bronze' },
  { rank: 10, name: 'Kavita N.', firm: 'Nair Financial Group', referrals: 164, earnings: 89400, badge: 'bronze' },
  { rank: 11, name: 'Deepak V.', firm: 'Verma & Partners', referrals: 152, earnings: 82100, badge: 'bronze' },
  { rank: 12, name: 'Sarla B.', firm: 'Bhat Accounting', referrals: 141, earnings: 76300, badge: 'bronze' },
  { rank: 13, name: 'Nikhil C.', firm: 'Chopra Services', referrals: 130, earnings: 69800, badge: 'bronze' },
  { rank: 14, name: 'Usha L.', firm: 'Lakshmi Tax Pro', referrals: 119, earnings: 63500, badge: 'bronze' },
  { rank: 15, name: 'Arjun W.', firm: 'Wardekar Corp', referrals: 108, earnings: 57200, badge: 'bronze' },
  { rank: 16, name: 'Pooja F.', firm: 'Fernandes Advisory', referrals: 97, earnings: 50900, badge: 'bronze' },
  { rank: 17, name: 'Kiran O.', firm: 'Oak Associates', referrals: 86, earnings: 44600, badge: 'bronze' },
  { rank: 18, name: 'Ritu A.', firm: 'Agarwal Consulting', referrals: 75, earnings: 38300, badge: 'bronze' },
  { rank: 19, name: 'Mahesh E.', firm: 'Eshwar Tax', referrals: 64, earnings: 32000, badge: 'bronze' },
  { rank: 20, name: 'Nandini I.', firm: 'Iyer Financial', referrals: 53, earnings: 25700, badge: 'bronze' },
]

const ACHIEVEMENTS = [
  { name: 'Early Adopter', icon: Zap, desc: 'Joined in the first year', earned: true, color: '#f59e0b' },
  { name: 'Network Builder', icon: Share2, desc: '50+ referrals', earned: true, color: '#2563EB' },
  { name: 'Growth Champion', icon: TrendingUp, desc: '100+ referrals', earned: true, color: '#1D4ED8' },
  { name: 'Top 1%', icon: Crown, desc: 'Top 1% of referrers', earned: false, color: '#8b5cf6' },
  { name: 'Century Club', icon: Star, desc: '100 businesses invited', earned: true, color: '#ec4899' },
  { name: 'Viral Velocity', icon: Rocket, desc: '5 network loops completed', earned: false, color: '#f97316' },
]

const COMMISSION_TIERS = [
  { name: 'Bronze', multiplier: '1x', minReferrals: 0, color: '#b45309', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { name: 'Silver', multiplier: '1.5x', minReferrals: 25, color: '#6b7280', bg: 'bg-slate-100 dark:bg-slate-800/30' },
  { name: 'Gold', multiplier: '2x', minReferrals: 75, color: '#d97706', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { name: 'Platinum', multiplier: '3x', minReferrals: 200, color: '#7c3aed', bg: 'bg-violet-100 dark:bg-violet-900/30' },
]

const PARTNER_TYPES = [
  { type: 'CA Firms', icon: Building2, count: 4235, commission: '20-30%', desc: 'Tax & compliance partners who bring clients onto the platform' },
  { type: 'Technology Partners', icon: Link2, count: 189, commission: '15-25%', desc: 'SaaS companies integrating VEYRO APIs into their products' },
  { type: 'Resellers', icon: Share2, count: 567, commission: '25-35%', desc: 'Distribution partners selling VEYRO licenses' },
  { type: 'API Partners', icon: Globe, count: 312, commission: '10-20%', desc: 'Developers building on the VEYRO API platform' },
  { type: 'Government Bodies', icon: Award, count: 34, commission: 'N/A', desc: 'GSTN integration and compliance partnerships' },
  { type: 'NBFCs', icon: IndianRupee, count: 78, commission: '15-25%', desc: 'Embedded lending and working capital distribution' },
]

const PARTNER_STORIES = [
  {
    name: 'Sharma & Associates',
    type: 'CA Firm',
    revenue: '₹24,50,000',
    growth: '+340%',
    quote: 'VEYRO Network transformed our practice. We went from 50 clients to 500+ in 18 months.',
  },
  {
    name: 'TaxTech Solutions',
    type: 'Technology Partner',
    revenue: '₹18,75,000',
    growth: '+280%',
    quote: 'Our API integration drives 2,000+ new businesses to VEYRO every month.',
  },
  {
    name: 'FinServe Capital',
    type: 'NBFC Partner',
    revenue: '₹45,00,000',
    growth: '+190%',
    quote: 'Embedded lending through VEYRO has become our fastest-growing channel.',
  },
]

const MONTHLY_CHALLENGES = [
  { title: 'Invite 10 businesses this month', reward: '₹5,000', progress: 7, target: 10, icon: Gift },
  { title: 'Complete 3 network loops', reward: '₹10,000', progress: 1, target: 3, icon: Trophy },
  { title: 'Reach 50 total referrals', reward: '₹15,000 + Gold Tier', progress: 43, target: 50, icon: Crown },
]

// ── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 2000, prefix = '', suffix = '' }: {
  target: number; duration?: number; prefix?: string; suffix?: string
}) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [target, duration])
  return <span>{prefix}{fmtNum(count)}{suffix}</span>
}

// ── Network Map SVG ──────────────────────────────────────────────────────────
function NetworkMapSVG() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [])

  const nodes = [
    { id: 'CA', cx: 300, cy: 80, label: 'CA Firm', color: '#2563EB', icon: '⚖️' },
    { id: 'Business', cx: 520, cy: 200, label: 'Business', color: '#1D4ED8', icon: '🏢' },
    { id: 'Vendor', cx: 440, cy: 370, label: 'Vendor', color: '#047857', icon: '🤝' },
    { id: 'Accountant', cx: 160, cy: 370, label: 'Accountant', color: '#065f46', icon: '📊' },
  ]

  const edges = [
    { from: nodes[0], to: nodes[1] },
    { from: nodes[1], to: nodes[2] },
    { from: nodes[2], to: nodes[3] },
    { from: nodes[3], to: nodes[0] },
  ]

  const particleCount = 6

  return (
    <svg viewBox="0 0 600 440" className="w-full h-full" style={{ maxHeight: 320 }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background grid */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`vg${i}`} x1={i * 50} y1={0} x2={i * 50} y2={440} stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3" />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`hg${i}`} x1={0} y1={i * 50} x2={600} y2={i * 50} stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3" />
      ))}

      {/* Edges */}
      {edges.map((edge, ei) => {
        const dx = edge.to.cx - edge.from.cx
        const dy = edge.to.cy - edge.from.cy
        return (
          <g key={`edge-${ei}`}>
            <line
              x1={edge.from.cx} y1={edge.from.cy}
              x2={edge.to.cx} y2={edge.to.cy}
              stroke="#2563EB" strokeWidth="2" opacity="0.25"
            />
            <line
              x1={edge.from.cx} y1={edge.from.cy}
              x2={edge.to.cx} y2={edge.to.cy}
              stroke="#2563EB" strokeWidth="2" opacity="0.15"
              strokeDasharray="8 6"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite" />
            </line>
            {/* Particles */}
            {Array.from({ length: particleCount }).map((_, pi) => {
              const t = ((tick * 3 + pi * (200 / particleCount) + ei * 50) % 200) / 200
              const px = edge.from.cx + dx * t
              const py = edge.from.cy + dy * t
              return (
                <circle
                  key={`p-${ei}-${pi}`}
                  cx={px} cy={py} r={2.5}
                  fill="#2563EB" opacity={0.8 * (1 - Math.abs(t - 0.5) * 2)}
                  filter="url(#glow)"
                />
              )
            })}
          </g>
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <g key={node.id}>
          <circle cx={node.cx} cy={node.cy} r={40} fill="url(#nodeGlow)" />
          <circle
            cx={node.cx} cy={node.cy} r={28}
            fill="white" stroke={node.color} strokeWidth="2.5"
          />
          <text x={node.cx} y={node.cy - 4} textAnchor="middle" fontSize="18">{node.icon}</text>
          <text x={node.cx} y={node.cy + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill={node.color}>
            {node.label}
          </text>
        </g>
      ))}

      {/* Arrow labels on edges */}
      {edges.map((edge, ei) => {
        const mx = (edge.from.cx + edge.to.cx) / 2
        const my = (edge.from.cy + edge.to.cy) / 2
        const labels = ['15 clients', '8 vendors', '3 accountants', '2 CAs']
        return (
          <g key={`el-${ei}`}>
            <rect x={mx - 30} y={my - 8} width={60} height={16} rx={8} fill="white" stroke="#2563EB" strokeWidth="1" opacity="0.9" />
            <text x={mx} y={my + 3} textAnchor="middle" fontSize="8" fontWeight="600" fill="#047857">
              {labels[ei]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Metcalfe's Law Chart ─────────────────────────────────────────────────────
function MetcalfeChart() {
  const data = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
  const maxVal = 100
  const w = 280
  const h = 120
  const padX = 30
  const padY = 10

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * (w - padX * 2)
    const y = h - padY - (v / maxVal) * (h - padY * 2)
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `${padX},${h - padY} ${points} ${w - padX},${h - padY}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 140 }}>
      <defs>
        <linearGradient id="metcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#metcGrad)" />
      <polyline points={points} fill="none" stroke="#2563EB" strokeWidth="2" />
      {data.map((v, i) => {
        const x = padX + (i / (data.length - 1)) * (w - padX * 2)
        const y = h - padY - (v / maxVal) * (h - padY * 2)
        return i % 2 === 0 ? (
          <g key={`m${i}`}>
            <circle cx={x} cy={y} r={3} fill="#2563EB" />
            <text x={x} y={h - padY + 10} textAnchor="middle" fontSize="7" fill="#64748b">{i * 10}K</text>
          </g>
        ) : null
      })}
      <text x={w / 2} y={10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#475569">
        Network Value (n²) — Metcalfe&apos;s Law
      </text>
    </svg>
  )
}

// ── Growth Loop Step Card ────────────────────────────────────────────────────
function GrowthLoopStep({ step, isActive, onClick }: {
  step: typeof GROWTH_LOOP[0]; isActive: boolean; onClick: () => void
}) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
        isActive
          ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100 dark:bg-emerald-950/30 dark:shadow-emerald-900/20'
          : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-900'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-sm"
          style={{ backgroundColor: step.color }}
        >
          {step.step}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{step.label}</p>
          <p className="text-xs text-slate-500">
            {step.from} → {step.to}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{step.avg}x</p>
          <p className="text-[10px] text-slate-400">avg invites</p>
        </div>
      </div>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 space-y-1"
        >
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Conversion rate</span>
            <span className="font-semibold text-emerald-600">{(step.conversion * 100).toFixed(0)}%</span>
          </div>
          <Progress value={step.conversion * 100} className="h-1.5" />
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Avg time</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{step.time}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Growth Calculator ────────────────────────────────────────────────────────
function GrowthCalculator() {
  const [directInvites, setDirectInvites] = useState(10)
  const loopMultiplier = 15 * 8 * 3 * 2 * 0.72 * 0.65 * 0.58 * 0.45

  const projections = [
    { degree: '1st', count: directInvites },
    { degree: '2nd', count: Math.round(directInvites * 15 * 0.72) },
    { degree: '3rd', count: Math.round(directInvites * 15 * 8 * 0.72 * 0.65) },
    { degree: '4th', count: Math.round(directInvites * loopMultiplier) },
  ]

  const totalNetwork = projections.reduce((s, p) => s + p.count, 0)
  const totalEarnings = directInvites * 500 + projections[1].count * 200 + projections[2].count * 100

  return (
    <Card className="border-emerald-200 dark:border-emerald-800/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-500" />
          Growth Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Your direct invites</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={directInvites}
            onChange={e => setDirectInvites(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          {projections.map((p, i) => (
            <div key={p.degree} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{p.degree} degree</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <motion.div
                    className="h-2 rounded-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (p.count / projections[3].count) * 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-16 text-right">{fmtNum(p.count)}</span>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Projected Network</span>
          <span className="text-lg font-bold text-emerald-600">{fmtNum(totalNetwork)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Projected Earnings</span>
          <span className="text-lg font-bold text-emerald-600">{fmtINR(totalEarnings)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Leaderboard Row ──────────────────────────────────────────────────────────
function LeaderboardRow({ entry, isYou = false }: { entry: typeof LEADERBOARD[0]; isYou?: boolean }) {
  const badgeColors: Record<string, string> = {
    crown: 'text-amber-500',
    gold: 'text-yellow-500',
    silver: 'text-slate-400',
    bronze: 'text-amber-700',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isYou
          ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <div className="w-8 text-center">
        {entry.rank <= 3 ? (
          <Crown className={`h-4 w-4 mx-auto ${badgeColors[entry.badge]}`} />
        ) : (
          <span className="text-xs font-bold text-slate-400">{entry.rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold truncate ${isYou ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
            {entry.name}
          </span>
          {isYou && (
            <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              YOU
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-slate-400 truncate">{entry.firm}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600">{fmtNum(entry.referrals)}</p>
        <p className="text-[10px] text-slate-400">referrals</p>
      </div>
      <div className="text-right min-w-[70px]">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{fmtINR(entry.earnings)}</p>
      </div>
    </motion.div>
  )
}

// ── Partner Card ─────────────────────────────────────────────────────────────
function PartnerCard({ partner }: { partner: typeof PARTNER_TYPES[0] }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
          <partner.icon className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{partner.type}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{partner.desc}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="text-[10px] h-5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
              {fmtNum(partner.count)} partners
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 border-slate-200 text-slate-600 dark:border-slate-700">
              {partner.commission} commission
            </Badge>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function VEYRONetworkPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeLoopStep, setActiveLoopStep] = useState(0)

  // Auto-cycle growth loop animation
  useEffect(() => {
    if (activeTab !== 'growth-loop') return
    const id = setInterval(() => {
      setActiveLoopStep(s => (s + 1) % 4)
    }, 3000)
    return () => clearInterval(id)
  }, [activeTab])

  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  GSTPILOT NETWORK™
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The viral growth engine powering India&apos;s financial network
                </p>
              </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <Activity className="h-3 w-3 mr-1" />
                23.4% MoM Growth
              </Badge>
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                <Share2 className="h-3 w-3 mr-1" />
                Viral Coeff: 2.3
              </Badge>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-slate-100 dark:bg-slate-800 h-10 p-1 mb-4">
            <TabsTrigger value="overview" className="text-xs h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              <Globe className="h-3.5 w-3.5 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="growth-loop" className="text-xs h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              <Zap className="h-3.5 w-3.5 mr-1.5" />Growth Loop
            </TabsTrigger>
            <TabsTrigger value="rewards" className="text-xs h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              <Trophy className="h-3.5 w-3.5 mr-1.5" />Rewards
            </TabsTrigger>
            <TabsTrigger value="partners" className="text-xs h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />Partners
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Network Overview ─────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Network Map */}
            <Card className="border-emerald-200 dark:border-emerald-800/40 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-emerald-500" />
                  Viral Growth Loop
                  <span className="text-[10px] font-normal text-slate-400 ml-1">CA → Business → Vendor → Accountant → CA</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <NetworkMapSVG />
              </CardContent>
            </Card>

            {/* Network Targets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {NETWORK_TARGETS.map((t, i) => {
                const pct = ((t.current / t.target) * 100).toFixed(1)
                return (
                  <motion.div
                    key={t.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="border-slate-200 dark:border-slate-700 h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                            <t.icon className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="text-xs font-medium text-slate-500">{t.label}</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          <AnimatedCounter target={t.current} />
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={parseFloat(pct)} className="h-1.5 flex-1" />
                          <span className="text-[10px] font-semibold text-emerald-600">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Target: {fmtNum(t.target)}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-emerald-200 dark:border-emerald-800/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">23.4%</p>
                    <p className="text-xs text-slate-500">Network Growth Rate (MoM)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
                    <Share2 className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">2.3</p>
                    <p className="text-xs text-slate-500">Viral Coefficient (each user → 2.3 new)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">
                      <AnimatedCounter target={580237} />
                    </p>
                    <p className="text-xs text-slate-500">Total Network Members</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Metcalfe's Law */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  Network Value — Metcalfe&apos;s Law
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetcalfeChart />
                <p className="text-[10px] text-slate-400 mt-2">
                  As the network grows, its value increases quadratically. Each new user adds value for every existing user.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: Growth Loop ──────────────────────────────────────────── */}
          <TabsContent value="growth-loop" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Loop Steps */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  4-Step Viral Growth Loop
                </h3>
                {GROWTH_LOOP.map((step) => (
                  <GrowthLoopStep
                    key={step.step}
                    step={step}
                    isActive={activeLoopStep === step.step - 1}
                    onClick={() => setActiveLoopStep(step.step - 1)}
                  />
                ))}
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="h-px flex-1 bg-emerald-200 dark:bg-emerald-800" />
                  <span className="text-xs font-bold text-emerald-600">LOOP REPEATS ↻</span>
                  <div className="h-px flex-1 bg-emerald-200 dark:bg-emerald-800" />
                </div>
              </div>

              {/* Right side: Depth + Calculator */}
              <div className="space-y-4">
                {/* Network Depth */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      Network Depth Visualization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {NETWORK_DEPTH.map((d, i) => (
                      <motion.div
                        key={d.degree}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                          <span className="text-xs font-bold text-emerald-600">{d.degree}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{d.label}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{fmtNum(d.count)}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                            <motion.div
                              className="h-2 rounded-full"
                              style={{ backgroundColor: d.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (d.count / NETWORK_DEPTH[3].count) * 100)}%` }}
                              transition={{ duration: 0.8, delay: i * 0.15 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-slate-500">Total Viral Reach</span>
                      <span className="text-sm font-bold text-emerald-600">{fmtNum(NETWORK_DEPTH.reduce((s, d) => s + d.count, 0))}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Growth Calculator */}
                <GrowthCalculator />

                {/* Viral Loop Metrics */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Viral Loop Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                        <p className="text-lg font-bold text-emerald-600">15.3 days</p>
                        <p className="text-[10px] text-slate-500">Avg loop time</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                        <p className="text-lg font-bold text-amber-600">72%</p>
                        <p className="text-[10px] text-slate-500">Step 1 conversion</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                        <p className="text-lg font-bold text-emerald-600">2.3x</p>
                        <p className="text-[10px] text-slate-500">Viral coefficient</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                        <p className="text-lg font-bold text-emerald-600">3.7</p>
                        <p className="text-[10px] text-slate-500">Avg loops per user</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Rewards & Leaderboards ───────────────────────────────── */}
          <TabsContent value="rewards" className="space-y-4">
            {/* Referral Rewards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'CA Firm', reward: 500, icon: Building2, color: 'emerald' },
                { type: 'Business', reward: 200, icon: Users, color: 'emerald' },
                { type: 'Vendor', reward: 100, icon: Link2, color: 'emerald' },
              ].map((r, i) => (
                <motion.div
                  key={r.type}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-emerald-200 dark:border-emerald-800/40 text-center">
                    <CardContent className="p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 mx-auto mb-2">
                        <r.icon className="h-6 w-6 text-emerald-600" />
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{fmtINR(r.reward)}</p>
                      <p className="text-xs text-slate-500 mt-1">Per {r.type} referral</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Your Rewards Dashboard */}
            <Card className="border-emerald-200 dark:border-emerald-800/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                  Your Rewards Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                    <p className="text-xl font-bold text-emerald-600">{fmtINR(89500)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Total Earned</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                    <p className="text-xl font-bold text-amber-600">{fmtINR(12300)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Pending</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{fmtINR(77200)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Redeemed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Commission Tiers */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-500" />
                  Commission Tiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {COMMISSION_TIERS.map((tier) => (
                    <div key={tier.name} className={`rounded-xl p-4 text-center ${tier.bg}`}>
                      <p className="text-lg font-bold" style={{ color: tier.color }}>{tier.multiplier}</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{tier.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{tier.minReferrals}+ referrals</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard + Achievements Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Leaderboard */}
              <div className="lg:col-span-2">
                <Card className="border-slate-200 dark:border-slate-700 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Leaderboard — Top Referrers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-96">
                      <div className="px-3 pb-3 space-y-0.5">
                        {LEADERBOARD.map(entry => (
                          <LeaderboardRow key={entry.rank} entry={entry} />
                        ))}
                        <Separator className="my-2" />
                        <LeaderboardRow
                          entry={{ rank: 47, name: 'You', firm: 'Your Firm', referrals: 43, earnings: 28900, badge: 'bronze' }}
                          isYou
                        />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Achievements + Challenges */}
              <div className="space-y-4">
                {/* Achievement Badges */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      Achievement Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ACHIEVEMENTS.map((a) => (
                      <div
                        key={a.name}
                        className={`flex items-center gap-3 p-2.5 rounded-lg ${
                          a.earned
                            ? 'bg-emerald-50 dark:bg-emerald-950/20'
                            : 'bg-slate-50 dark:bg-slate-800/50 opacity-60'
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                          style={{ backgroundColor: a.earned ? `${a.color}20` : '#f1f5f9' }}
                        >
                          <a.icon className="h-4 w-4" style={{ color: a.earned ? a.color : '#94a3b8' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${a.earned ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                            {a.name}
                          </p>
                          <p className="text-[10px] text-slate-400">{a.desc}</p>
                        </div>
                        {a.earned && (
                          <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 shrink-0">
                            EARNED
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Monthly Challenges */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Gift className="h-4 w-4 text-amber-500" />
                      Monthly Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {MONTHLY_CHALLENGES.map((ch) => (
                      <div key={ch.title} className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <ch.icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{ch.title}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Win {ch.reward}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(ch.progress / ch.target) * 100} className="h-1.5 flex-1" />
                          <span className="text-[10px] font-semibold text-slate-500">{ch.progress}/{ch.target}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 4: Partner Ecosystem ────────────────────────────────────── */}
          <TabsContent value="partners" className="space-y-4">
            {/* Partner Types Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PARTNER_TYPES.map((p, i) => (
                <motion.div
                  key={p.type}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <PartnerCard partner={p} />
                </motion.div>
              ))}
            </div>

            {/* Revenue Sharing */}
            <Card className="border-emerald-200 dark:border-emerald-800/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                  Revenue Sharing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-5 text-center">
                    <p className="text-3xl font-bold text-emerald-600">70/30</p>
                    <p className="text-xs text-slate-500 mt-1">Default revenue split</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">You keep 70% of all generated revenue</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-5 text-center">
                    <p className="text-3xl font-bold text-amber-600">80/20</p>
                    <p className="text-xs text-slate-500 mt-1">Platinum partner split</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">200+ referrals unlocks premium terms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Partner Success Stories */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Partner Success Stories
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PARTNER_STORIES.map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="border-slate-200 dark:border-slate-700 h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                            <Building2 className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</p>
                            <p className="text-[10px] text-slate-400">{s.type}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic mb-3">&ldquo;{s.quote}&rdquo;</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-400">Revenue shared</p>
                            <p className="text-sm font-bold text-emerald-600">{s.revenue}</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            <TrendingUp className="h-3 w-3 mr-1" />{s.growth}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Partner Metrics */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  Partner Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600"><AnimatedCounter target={5415} /></p>
                    <p className="text-[10px] text-slate-500 mt-1">Total Partners</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600"><AnimatedCounter target={3892} /></p>
                    <p className="text-[10px] text-slate-500 mt-1">Active Partners</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{fmtINR(23400000)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Revenue Shared</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Become a Partner CTA */}
            <Card className="border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
                    <Rocket className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Become a VEYRO Partner</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Join 5,400+ partners earning through the VEYRO Network. Get up to 80% revenue share.
                    </p>
                  </div>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 h-11 px-6">
                    Apply Now <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
