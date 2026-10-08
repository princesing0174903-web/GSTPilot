'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Gauge, TrendingUp, AlertTriangle, AlertOctagon, ShieldAlert,
  Users, CheckCircle, Activity, Eye, Zap, ArrowUpRight,
  ArrowDownRight, Radio, Brain, Building, Wallet,
  FileText, Clock, ListChecks, Target, ChevronRight,
  Lightbulb, Star, XCircle, Info, Loader2,
} from 'lucide-react'
import {
  useFirmExecutiveScores, useFireNotifications,
  useFireAIRecommendations, useFireClients, useFireReturns,
} from '@/hooks/use-firestore'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'

// ── Helpers ──
const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN')

const fmtDate = (d: string | null | unknown) => {
  if (!d) return '—'
  try {
    const dt = new Date(d as string)
    if (isNaN(dt.getTime())) return '—'
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '—' }
}

const pct = (n: number, decimals = 1) => n.toFixed(decimals) + '%'

// ── Animation ──
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const stagger = {
  initial: { opacity: 0, y: 12 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
}

// ── SVG Gauge Chart (0-100) ──
function ExecutiveGauge({ value, label, icon: Icon, size = 140 }: {
  value: number; label: string; icon: React.ElementType; size?: number
}) {
  const r = (size - 20) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const pctVal = Math.max(0, Math.min(100, value))
  const fill = (pctVal / 100) * circumference

  const color = pctVal > 70 ? '#2563EB' : pctVal > 40 ? '#f59e0b' : '#ef4444'
  const bgColor = pctVal > 70 ? '#d1fae5' : pctVal > 40 ? '#fef3c7' : '#fee2e2'

  const statusLabel = pctVal > 70 ? 'Healthy' : pctVal > 40 ? 'Warning' : 'Critical'

  return (
    <motion.div
      {...fadeUp}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
          {/* Animated fill */}
          <motion.circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: circumference - fill }}
            transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.2 }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <Icon className={`h-5 w-5 mb-1 ${pctVal > 70 ? 'text-emerald-500' : pctVal > 40 ? 'text-amber-500' : 'text-red-500'}`} />
          <span className="text-2xl font-bold text-slate-800">{Math.round(pctVal)}</span>
          <span className="text-[10px] font-medium" style={{ color }}>{statusLabel}</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center">{label}</span>
    </motion.div>
  )
}

// ── Small Gauge for inline use ──
function MiniGauge({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const cx = size / 2
  const cy = size / 2
  const c = Math.PI * 2 * r
  const pctVal = Math.max(0, Math.min(100, value))
  const fill = (pctVal / 100) * c
  const color = pctVal > 70 ? '#2563EB' : pctVal > 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <motion.circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        animate={{ strokeDashoffset: c - fill }}
        transition={{ duration: 0.8, ease: 'easeOut' as const }}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        className="fill-slate-700 text-[9px] font-bold"
        transform={`rotate(90, ${cx}, ${cy})`}
      >
        {Math.round(pctVal)}
      </text>
    </svg>
  )
}

// ── Skeleton Components ──
function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

function SkeletonGauge() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Skeleton className="h-[140px] w-[140px] rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

// ── Empty State ──
function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div {...fadeUp} className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-1">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs">{desc}</p>
    </motion.div>
  )
}

// ── Severity Badge ──
function SeverityBadge({ level }: { level: string }) {
  const config: Record<string, { className: string; icon: React.ElementType }> = {
    urgent: { className: 'bg-red-100 text-red-700 border-red-200', icon: AlertOctagon },
    high: { className: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
    medium: { className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Info },
    low: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  }
  const c = config[level] || config.medium
  const Icon = c.icon
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${c.className}`}>
      <Icon className="h-3 w-3" /> {level}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIOperatingRoomPage() {
  const { setCurrentView } = useApp()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('scores')
  const [oracleDialogOpen, setOracleDialogOpen] = useState(false)
  const [oracleActivating, setOracleActivating] = useState(false)
  const [oracleActivated, setOracleActivated] = useState(false)

  // ── On mount, fetch current Oracle activation state from /api/automation ──
  useEffect(() => {
    let cancelled = false
    fetch('/api/automation')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.rules) return
        const oracleRule = data.rules.find((r: { name?: string; isActive?: boolean }) =>
          typeof r.name === 'string' && r.name.startsWith('Oracle ') && r.isActive === true,
        )
        if (oracleRule) setOracleActivated(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Activate Oracle — POST /api/automation { type: 'oracle_activation' } ──
  const handleActivateOracle = async () => {
    setOracleActivating(true)
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'oracle_activation',
          enabled: true,
          schedule: 'daily',
          createdBy: user?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to activate Oracle')
      }
      setOracleActivated(true)
      setOracleDialogOpen(false)
      toast.success(data?.message ?? 'Oracle activated. Daily analytics job scheduled.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate Oracle')
    } finally {
      setOracleActivating(false)
    }
  }

  // ── Live Firestore Data ──
  const { scores, loading: scoresLoading } = useFirmExecutiveScores()
  const { data: notifications, loading: notifsLoading } = useFireNotifications()
  const { data: recommendations, loading: recsLoading } = useFireAIRecommendations()
  const { data: clients, loading: clientsLoading } = useFireClients()
  const { data: returns, loading: returnsLoading } = useFireReturns()

  const isLoading = scoresLoading && notifsLoading && clientsLoading

  // ── Computed Data ──
  const criticalIssues = useMemo(() =>
    notifications.filter(n => n.priority === 'urgent'),
    [notifications]
  )

  const warnings = useMemo(() =>
    notifications.filter(n => n.priority === 'high'),
    [notifications]
  )

  const topOpportunities = useMemo(() =>
    clients
      .filter(c => (c.totalTaxPaid || 0) > 50000 && (c.healthScore || 0) < 75)
      .sort((a, b) => (b.totalTaxPaid || 0) - (a.totalTaxPaid || 0))
      .slice(0, 8),
    [clients]
  )

  const pendingReturns = useMemo(() =>
    returns.filter(r => r.status !== 'filed'),
    [returns]
  )

  const overdueReturns = useMemo(() =>
    returns.filter(r => r.status !== 'filed' && r.period),
    [returns]
  )

  const overallScore = useMemo(() => {
    const keys = ['firmHealth', 'revenue', 'compliance', 'teamEfficiency', 'clientSatisfaction', 'cashFlow'] as const
    const vals = keys.map(k => scores[k])
    const nonZero = vals.filter(v => v > 0)
    return nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0
  }, [scores])

  // ── Score definitions ──
  const scoreDefs = [
    { key: 'firmHealth' as const, label: 'Firm Health Score', icon: Gauge },
    { key: 'revenue' as const, label: 'Revenue Score', icon: Wallet },
    { key: 'compliance' as const, label: 'Compliance Score', icon: ShieldAlert },
    { key: 'teamEfficiency' as const, label: 'Team Efficiency', icon: Users },
    { key: 'clientSatisfaction' as const, label: 'Client Satisfaction', icon: Star },
    { key: 'cashFlow' as const, label: 'Cash Flow Score', icon: TrendingUp },
  ]

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20">
            <Gauge className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI Operating Room</h1>
            <p className="text-xs text-slate-500">Mission control — firm health at a glance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
            <Radio className="h-3 w-3 animate-pulse" /> Live
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Brain className="h-3 w-3" /> AI Active
          </Badge>
          {criticalIssues.length > 0 && (
            <Badge className="gap-1 bg-red-100 text-red-700 border border-red-200">
              <AlertOctagon className="h-3 w-3" /> {criticalIssues.length} Critical
            </Badge>
          )}
          <Button
            size="sm"
            className={
              oracleActivated
                ? 'gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200'
                : 'gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:opacity-90'
            }
            onClick={() => setOracleDialogOpen(true)}
          >
            {oracleActivated ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" /> Oracle Active
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" /> Activate Oracle
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* ── Activate Oracle Dialog ── */}
      <Dialog open={oracleDialogOpen} onOpenChange={setOracleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Brain className="h-5 w-5 text-emerald-600" />
              Activate VEYRO AI
            </DialogTitle>
            <DialogDescription>
              Oracle is your firm's autonomous analytics brain. When activated, it runs a
              daily job across all your connected data sources — GSTN, Bank, Accounting,
              WhatsApp, Gmail — to surface insights, detect compliance risks, and brief you
              on the day's priorities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                What you'll get:
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-emerald-700 dark:text-emerald-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" /> Daily GST reconciliation & ITC matching
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" /> Cash-position & compliance-score updates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" /> Auto-generated priorities in Mission Control
                </li>
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Schedule: <strong>Daily at 06:00 IST</strong>. You can change this anytime in
              Automations. A one-time AuditLog entry will record the activation.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOracleDialogOpen(false)}
              disabled={oracleActivating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleActivateOracle}
              disabled={oracleActivating || oracleActivated}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:opacity-90 gap-1.5"
            >
              {oracleActivating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Activating...
                </>
              ) : oracleActivated ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Already Active
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Activate Oracle
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Overall Score Banner ── */}
      {!scoresLoading && (
        <motion.div {...fadeUp}>
          <Card className={`border-2 ${overallScore > 70 ? 'border-emerald-200 bg-emerald-50/50' : overallScore > 40 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <svg width={80} height={80} className="-rotate-90">
                    <circle cx={40} cy={40} r={32} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <motion.circle
                      cx={40} cy={40} r={32} fill="none"
                      stroke={overallScore > 70 ? '#2563EB' : overallScore > 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={2 * Math.PI * 32}
                      animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - overallScore / 100) }}
                      transition={{ duration: 1, ease: 'easeOut' as const }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-800">{Math.round(overallScore)}</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Overall Firm Score</h2>
                  <p className="text-xs text-slate-500">
                    {overallScore > 70 ? 'Firm is operating well — keep it up!' : overallScore > 40 ? 'Some areas need attention — see below' : 'Critical issues detected — immediate action needed'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <AlertOctagon className="h-4 w-4 text-red-500" /> {criticalIssues.length} Critical
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {warnings.length} Warnings
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1">
                  <Lightbulb className="h-4 w-4 text-emerald-500" /> {recommendations.length} Recommendations
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
          <TabsTrigger value="warnings">Warnings</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        {/* ══════════ SCORES TAB ══════════ */}
        <TabsContent value="scores" className="space-y-6 mt-4">
          {/* 6 Executive Gauges */}
          {scoresLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonGauge key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {scoreDefs.map((s, i) => (
                <motion.div key={s.key} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center">
                      <ExecutiveGauge
                        value={scores[s.key]}
                        label={s.label}
                        icon={s.icon}
                        size={120}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Score Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {scoresLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {scoreDefs.map((s, i) => {
                    const val = scores[s.key]
                    const color = val > 70 ? 'bg-emerald-500' : val > 40 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <motion.div key={s.key} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="flex items-center gap-3"
                      >
                        <s.icon className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-600 w-32 shrink-0">{s.label}</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(val, 2)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' as const, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{Math.round(val)}</span>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" /> AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : recommendations.length === 0 ? (
                <EmptyState icon={Zap} title="No recommendations" desc="AI recommendations will appear as your firm data grows." />
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {recommendations.slice(0, 6).map((rec, i) => (
                      <motion.div key={rec.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 shrink-0 mt-0.5">
                          <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-medium text-slate-700 truncate">{rec.title}</p>
                            <Badge variant="outline" className="text-[10px] shrink-0">{rec.riskLevel}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{rec.suggestedAction}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{pct(rec.confidenceScore)}</span>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ CRITICAL TAB ══════════ */}
        <TabsContent value="critical" className="space-y-6 mt-4">
          {/* Critical Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-red-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-red-100 mb-2">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-700">{criticalIssues.length}</p>
                <p className="text-xs text-slate-500">Critical Issues</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-amber-100 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-700">{warnings.length}</p>
                <p className="text-xs text-slate-500">Warnings</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-slate-100 mb-2">
                  <FileText className="h-5 w-5 text-slate-600" />
                </div>
                <p className="text-2xl font-bold text-slate-700">{overdueReturns.length}</p>
                <p className="text-xs text-slate-500">Overdue Returns</p>
              </CardContent>
            </Card>
          </div>

          {/* Critical Issues Detail */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-red-500" /> Critical Issues — Immediate Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : criticalIssues.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-700">No critical issues!</p>
                  <p className="text-xs text-slate-400 mt-1">Your firm is operating smoothly. Keep monitoring.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {criticalIssues.map((n, i) => (
                      <motion.div key={n.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="border border-red-200 rounded-lg p-4 bg-red-50/50 hover:border-red-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 shrink-0 mt-0.5">
                              <AlertOctagon className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.createdAt)}</p>
                            </div>
                          </div>
                          <SeverityBadge level="urgent" />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => setCurrentView('tasks')}>
                            <ListChecks className="h-3 w-3 mr-1" /> Create Task
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => setCurrentView('reconcile')}>
                            <Activity className="h-3 w-3 mr-1" /> Investigate
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Overdue Returns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> Overdue / Pending Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : overdueReturns.length === 0 ? (
                <EmptyState icon={CheckCircle} title="All returns filed!" desc="No overdue or pending returns found." />
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {overdueReturns.slice(0, 10).map((r, i) => (
                      <motion.div key={r.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-amber-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                            <FileText className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700">{r.returnType} • {r.period}</p>
                            <p className="text-[10px] text-slate-400">{r.totalInvoices} invoices</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ WARNINGS TAB ══════════ */}
        <TabsContent value="warnings" className="space-y-6 mt-4">
          {/* Warning Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-500">Total Warnings</span>
                <p className="text-xl font-bold text-amber-700">{warnings.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-500">Unread</span>
                <p className="text-xl font-bold text-slate-700">{warnings.filter(w => !w.read).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-500">At-Risk Clients</span>
                <p className="text-xl font-bold text-amber-700">{clients.filter(c => (c.healthScore || 0) < 60).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-500">Pending Returns</span>
                <p className="text-xl font-bold text-slate-700">{pendingReturns.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Warning Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Warning Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifsLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : warnings.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-700">No warnings!</p>
                  <p className="text-xs text-slate-400 mt-1">Everything looks good. Warnings will appear when issues arise.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {warnings.map((n, i) => (
                      <motion.div key={n.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="flex items-start gap-3 p-3 rounded-lg border border-amber-100 hover:border-amber-200 bg-amber-50/30 transition-colors"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 shrink-0 mt-0.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-slate-700">{n.title}</p>
                            {!n.read && (
                              <span className="h-2 w-2 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.createdAt)}</p>
                        </div>
                        <SeverityBadge level="high" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations for Warnings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-500" /> AI-Generated Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : recommendations.length === 0 ? (
                <EmptyState icon={Brain} title="No AI insights" desc="AI insights will be generated from your firm operations." />
              ) : (
                <ScrollArea className="max-h-72">
                  <div className="space-y-3">
                    {recommendations.map((rec, i) => (
                      <motion.div key={rec.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="border border-slate-200 rounded-lg p-3 hover:border-emerald-200 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <MiniGauge value={rec.confidenceScore} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700">{rec.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{rec.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">{rec.type}</Badge>
                              <Badge variant="outline" className="text-[10px]">{rec.riskLevel}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2 ml-[52px]">
                          <Button size="sm" variant="outline" className="text-[10px] h-6"
                            onClick={() => setCurrentView('tasks')}>
                            <ListChecks className="h-3 w-3 mr-1" /> Create Task
                          </Button>
                          <Button size="sm" variant="outline" className="text-[10px] h-6"
                            onClick={() => setCurrentView('reconcile')}>
                            <Activity className="h-3 w-3 mr-1" /> Investigate
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ OPPORTUNITIES TAB ══════════ */}
        <TabsContent value="opportunities" className="space-y-6 mt-4">
          {/* Opportunity Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-emerald-100 mb-2">
                  <Lightbulb className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-700">{topOpportunities.length}</p>
                <p className="text-xs text-slate-500">Growth Opportunities</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-slate-100 mb-2">
                  <Wallet className="h-5 w-5 text-slate-600" />
                </div>
                <p className="text-2xl font-bold text-slate-700">
                  {fmtINR(topOpportunities.reduce((s, c) => s + (c.totalTaxPaid || 0), 0))}
                </p>
                <p className="text-xs text-slate-500">Revenue at Stake</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="p-4 text-center">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-amber-100 mb-2">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-700">{clients.filter(c => (c.healthScore || 0) < 75).length}</p>
                <p className="text-xs text-slate-500">Clients Need Attention</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Opportunities — High-value clients with low health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-emerald-500" /> Top Opportunities — High-Value Clients Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : topOpportunities.length === 0 ? (
                <EmptyState icon={Lightbulb} title="No opportunities identified" desc="Opportunities will appear when high-value clients need attention." />
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {topOpportunities.map((c, i) => (
                      <motion.div key={c.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="border border-slate-200 rounded-lg p-4 hover:border-emerald-200 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                              <span className="text-sm font-bold text-emerald-700">{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">{c.tradeName}</p>
                              <p className="text-[10px] text-slate-400">{c.gstin} • {c.entityType}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-800">{fmtINR(c.totalTaxPaid || 0)}</p>
                            <p className="text-[10px] text-slate-400">Revenue</p>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">Health:</span>
                              <div className="flex items-center gap-1">
                                <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      (c.healthScore || 0) > 70 ? 'bg-emerald-500' :
                                      (c.healthScore || 0) > 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.max(c.healthScore || 0, 2)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-700">{Math.round(c.healthScore || 0)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">Pending:</span>
                              <span className="text-xs font-medium text-slate-700">{c.pendingReturnCount || 0} returns</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-[10px] h-6"
                              onClick={() => {
                                setCurrentView('clients')
                              }}>
                              <Eye className="h-3 w-3 mr-1" /> View Client
                            </Button>
                            <Button size="sm" variant="outline" className="text-[10px] h-6"
                              onClick={() => setCurrentView('return-prep')}>
                              <FileText className="h-3 w-3 mr-1" /> Prepare Return
                            </Button>
                          </div>
                        </div>

                        {/* Opportunity Insight */}
                        <div className="mt-3 p-2 rounded bg-emerald-50 border border-emerald-100">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-emerald-700">
                              {c.healthScore < 40
                                ? `Critical: ${c.tradeName} generates ${fmtINR(c.totalTaxPaid || 0)} but has a health score of ${Math.round(c.healthScore || 0)}. Immediate engagement recommended.`
                                : `${c.tradeName} contributes significant revenue but has room for improvement. Proactive support could prevent churn.`
                              }
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Client Satisfaction Scores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" /> Client Health Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : clients.length === 0 ? (
                <EmptyState icon={Users} title="No clients yet" desc="Add clients to see health scores and opportunities." />
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {clients
                      .sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0))
                      .slice(0, 12)
                      .map((c, i) => (
                        <motion.div key={c.id} custom={i} variants={stagger} initial="initial" animate="animate"
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <MiniGauge value={c.healthScore || 0} size={36} />
                            <div>
                              <p className="text-xs font-medium text-slate-700">{c.tradeName}</p>
                              <p className="text-[10px] text-slate-400">{c.pendingReturnCount || 0} pending • {fmtINR(c.totalTaxPaid || 0)}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={
                            (c.healthScore || 0) >= 75 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                            (c.healthScore || 0) >= 40 ? 'text-amber-600 border-amber-200 bg-amber-50' :
                            'text-red-600 border-red-200 bg-red-50'
                          }>
                            {(c.healthScore || 0) >= 75 ? 'Healthy' : (c.healthScore || 0) >= 40 ? 'At Risk' : 'Critical'}
                          </Badge>
                        </motion.div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
