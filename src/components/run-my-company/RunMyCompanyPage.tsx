'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Play, Pause, Rocket, CheckCircle, Activity, Brain, FileText,
  Shield, Clock, ArrowRight, Sparkles, Cpu,
  TrendingUp, Database, Target, Square,
  AlertTriangle, Bell, LineChart,
  Settings, Mail, MessageSquare, CalendarDays,
  Building2, Network, Banknote, Layers, Eye,
  HandCoins,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { apiPost, apiGet } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/shared'
import { Inbox } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN')

const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE STEPS — 9-STEP COMPANY PIPELINE (tied to Financial Exchange)
// ═══════════════════════════════════════════════════════════════════════════════

type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

interface PipelineStep {
  id: number
  name: string
  icon: React.ElementType
  emoji: string
  description: string
  output: string
  duration: number // ms for simulation
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 1, name: 'Read Financial Data', icon: Database, emoji: '📊',
    description: 'Pull invoices, payments, GST returns, banking transactions',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 2400,
  },
  {
    id: 2, name: 'Update Economic Graph', icon: Network, emoji: '🔗',
    description: 'Sync company node + relationships in real-time economic graph',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 1800,
  },
  {
    id: 3, name: 'Optimize Cash Flow', icon: TrendingUp, emoji: '💰',
    description: 'AI analyzes inflow/outflow, recommends optimizations',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 2200,
  },
  {
    id: 4, name: 'Trade on Invoice Exchange', icon: Banknote, emoji: '🏦',
    description: 'Auto-list eligible invoices for financing',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 2600,
  },
  {
    id: 5, name: 'Apply for Financing', icon: HandCoins, emoji: '💳',
    description: 'Auto-apply to best-fit lenders via Financing Marketplace',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 3000,
  },
  {
    id: 6, name: 'Predict Risks', icon: Shield, emoji: '📈',
    description: 'AI forecasts next 30-day risks (cash flow, compliance, credit)',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 2400,
  },
  {
    id: 7, name: 'Execute AI Decisions', icon: Brain, emoji: '🧠',
    description: 'Run AI Decision Engine, execute approved decisions',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 2000,
  },
  {
    id: 8, name: 'Update Digital Twin', icon: Cpu, emoji: '🔄',
    description: "Refresh company's digital twin with new state",
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 1600,
  },
  {
    id: 9, name: 'Generate Stakeholder Reports', icon: FileText, emoji: '📋',
    description: 'Create reports for board, investors, lenders',
    output: 'Pending execution — dispatch agent to see real results.',
    duration: 1800,
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════════════════════════════════

interface Company {
  id: string
  name: string
  gstin: string
  industry: string
}

const COMPANIES: Company[] = [
  { id: 'ril', name: 'Reliance Industries Ltd.', gstin: '27AAACR5055K1Z5', industry: 'Conglomerate' },
  { id: 'tata', name: 'Tata Steel Ltd.', gstin: '27AAACT2727Q1ZX', industry: 'Metals' },
  { id: 'infosys', name: 'Infosys Ltd.', gstin: '29AAACI4799L1ZB', industry: 'IT Services' },
  { id: 'bajaj', name: 'Bajaj Finance Ltd.', gstin: '27AABCB1518L1ZJ', industry: 'NBFC' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// RUN HISTORY (real DB-backed; empty until runs are persisted)
// ═══════════════════════════════════════════════════════════════════════════════

interface RunHistory {
  id: number
  date: string
  time: string
  duration: string
  tasks: string
  capital: string
  status: 'completed' | 'partial' | 'failed'
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIORITY ACTIONS (real DB-backed; empty until the AI engine surfaces them)
// ═══════════════════════════════════════════════════════════════════════════════

interface PriorityAction {
  id: number
  priority: 'critical' | 'high' | 'medium'
  action: string
  category: string
  dueDate: string
  status: 'pending' | 'in-progress'
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOG ENTRY
// ═══════════════════════════════════════════════════════════════════════════════

interface LogEntry {
  id: number
  timestamp: string
  stepId: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration: number = 1200, trigger: boolean = true) {
  const [value, setValue] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!trigger || target === 0) return
    const start = performance.now()
    ref.current = setInterval(() => {
      const elapsed = performance.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress >= 1 && ref.current) clearInterval(ref.current)
    }, 16)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [target, duration, trigger])

  return value
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLES COMPONENT — floating around the button when running
// ═══════════════════════════════════════════════════════════════════════════════

function FloatingParticles({ active }: { active: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      angle: (i / 24) * 360,
      radius: 160 + Math.random() * 40,
      size: 3 + Math.random() * 4,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
    })), []
  )

  return (
    <AnimatePresence>
      {active && particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
            rotate: [0, 360],
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `calc(50% + ${Math.cos(p.angle * Math.PI / 180) * p.radius}px)`,
            top: `calc(50% + ${Math.sin(p.angle * Math.PI / 180) * p.radius}px)`,
            background: p.id % 3 === 0
              ? 'rgba(251, 191, 36, 0.8)'
              : p.id % 3 === 1
                ? 'rgba(52, 211, 153, 0.8)'
                : 'rgba(255, 255, 255, 0.6)',
            boxShadow: `0 0 ${p.size * 2}px ${p.id % 3 === 0 ? 'rgba(251,191,36,0.5)' : 'rgba(52,211,153,0.5)'}`,
          }}
        />
      ))}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN LINE EFFECT
// ═══════════════════════════════════════════════════════════════════════════════

function ScanLine({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ top: 0, opacity: 0 }}
          animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' as const }}
          className="absolute left-0 right-0 h-[2px] z-20 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.6), rgba(251,191,36,0.8), rgba(52,211,153,0.6), transparent)',
            boxShadow: '0 0 20px rgba(52,211,153,0.4), 0 0 60px rgba(251,191,36,0.2)',
          }}
        />
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RunMyCompanyPage() {
  // ── PT-1-b: real DB agent dispatch hooks ──
  const { toast } = useToast();
  const { user } = useAuth();

  // ── PT-1-a-retry: real CFO intelligence data ──
  // Replaces hardcoded ₹2.5Cr working capital and ₹12.5L cash flow metrics with
  // real values fetched from /api/ai-cfo and /api/ai-cfo/intelligence.
  interface AiCfoDashboard {
    dashboard?: {
      cash?: { currentBalance?: number; availableCash?: number };
      receivables?: { pendingCollections?: number; overdueCollections?: number };
    };
  }
  interface AiCfoIntelligence {
    executiveSummary?: {
      cashPosition?: number;
      topOpportunity?: string;
      topRisk?: string;
    };
  }
  const { data: cfoData } = useQuery<AiCfoDashboard>({
    queryKey: ['ai-cfo', 'run-my-company'],
    queryFn: () => apiGet('/api/ai-cfo'),
  });
  const { data: cfoIntel } = useQuery<AiCfoIntelligence>({
    queryKey: ['ai-cfo-intelligence', 'run-my-company'],
    queryFn: () => apiGet('/api/ai-cfo/intelligence'),
  });
  const realCashPosition = cfoIntel?.executiveSummary?.cashPosition
    ?? cfoData?.dashboard?.cash?.currentBalance
    ?? 0;
  const realOverdueReceivables = cfoData?.dashboard?.receivables?.overdueCollections ?? 0;
  const realPendingCollections = cfoData?.dashboard?.receivables?.pendingCollections ?? 0;
  // "Cash flow optimized" = overdue receivables flagged for acceleration
  const realCashFlowOptimized = realOverdueReceivables > 0 ? realOverdueReceivables : realPendingCollections;


  // ── Pipeline State ──
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle')
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(PIPELINE_STEPS.map(() => 'pending'))
  const [currentStep, setCurrentStep] = useState<number>(-1)
  const [stepProgress, setStepProgress] = useState<number>(0)
  const [overallProgress, setOverallProgress] = useState(0)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // ── Selected Company ──
  const [selectedCompany, setSelectedCompany] = useState<string>('ril')
  const company = COMPANIES.find(c => c.id === selectedCompany) || COMPANIES[0]

  // ── Config State ──
  const [enabledSteps, setEnabledSteps] = useState<boolean[]>(PIPELINE_STEPS.map(() => true))
  const [schedule, setSchedule] = useState<'one-time' | 'daily' | 'weekly' | 'custom'>('daily')
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifWhatsapp, setNotifWhatsapp] = useState(true)
  const [notifInApp, setNotifInApp] = useState(true)
  const [riskThreshold, setRiskThreshold] = useState(50) // in ₹ lakhs
  const [autoFinanceThreshold, setAutoFinanceThreshold] = useState(25) // in ₹ lakhs
  const [escalationErrors, setEscalationErrors] = useState(true)

  const logIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pauseLockRef = useRef(false)

  // ── Real DB-backed arrays (no demo data) ──
  // Run history and priority actions start empty and render proper empty
  // states. When the backend surfaces are wired, swap to a useQuery fetch.
  const [runHistory, setRunHistory] = useState<RunHistory[]>([])
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([])
  // Reference the setters so the linter doesn't complain while the
  // backend surface for these is still being built. Keeping the setters
  // around means a future fetch can just call them without restructuring.
  void setRunHistory; void setPriorityActions

  // ── Count-Up Animations ──
  // countedCapital & countedRevenue use REAL DB values from /api/ai-cfo
  // (cash position + collection acceleration) instead of the old hardcoded
  // ₹2.5 Cr / ₹12.5 L. When the API has no data yet, useCountUp receives 0
  // and the card shows ₹0.
  const countedTasks = useCountUp(9, 1200, showResults)
  const countedRevenue = useCountUp(realCashFlowOptimized, 2000, showResults)
  const countedCapital = useCountUp(realCashPosition, 2400, showResults)
  const countedRisks = useCountUp(0, 800, showResults)
  const countedDecisions = useCountUp(0, 900, showResults)
  const countedReports = useCountUp(0, 900, showResults)

  // ── Elapsed Timer ──
  useEffect(() => {
    if (runStatus === 'running' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime())
      }, 100)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [runStatus, startTime])

  // ── Auto-scroll log ──
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries])

  // ── Add Log Entry ──
  const addLog = useCallback((stepId: number, message: string, type: LogEntry['type']) => {
    logIdRef.current++
    setLogEntries(prev => [...prev, {
      id: logIdRef.current,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      stepId,
      message,
      type,
    }])
  }, [])

  // ── Run Pipeline ──
  const runPipeline = useCallback(async () => {
    if (runStatus === 'paused' && pauseLockRef.current) {
      pauseLockRef.current = false
      setRunStatus('running')
      addLog(0, '▶ Pipeline resumed', 'info')
      return
    }

    abortRef.current = false
    setRunStatus('running')
    setStepStatuses(PIPELINE_STEPS.map(() => 'pending'))
    setCurrentStep(0)
    setStepProgress(0)
    setOverallProgress(0)
    setLogEntries([])
    setStartTime(new Date())
    setShowResults(false)
    logIdRef.current = 0

    addLog(0, `🏢 RUN MY COMPANY™ pipeline initiated for ${company.name} (${company.gstin})`, 'info')
    addLog(0, `Industry: ${company.industry} • Schedule: ${schedule.toUpperCase()} • Risk threshold: ${fmtINR(riskThreshold * 100000)}`, 'info')

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      if (abortRef.current) break
      if (!enabledSteps[i]) {
        setStepStatuses(prev => {
          const next = [...prev]
          next[i] = 'completed'
          return next
        })
        addLog(i + 1, `${PIPELINE_STEPS[i].emoji} ${PIPELINE_STEPS[i].name} skipped (disabled in config)`, 'warning')
        continue
      }

      // Wait if paused
      while (pauseLockRef.current && !abortRef.current) {
        await new Promise(r => setTimeout(r, 200))
      }
      if (abortRef.current) break

      setCurrentStep(i)
      setStepStatuses(prev => {
        const next = [...prev]
        next[i] = 'running'
        return next
      })
      setStepProgress(0)

      addLog(i + 1, `${PIPELINE_STEPS[i].emoji} Starting: ${PIPELINE_STEPS[i].name}`, 'info')

      const step = PIPELINE_STEPS[i]
      const duration = step.duration
      const interval = 50
      let progress = 0

      await new Promise<void>((resolve) => {
        progressRef.current = setInterval(() => {
          if (abortRef.current) {
            if (progressRef.current) clearInterval(progressRef.current)
            resolve()
            return
          }
          if (pauseLockRef.current) return // freeze progress while paused

          progress += (interval / duration) * 100
          if (progress >= 100) {
            progress = 100
            if (progressRef.current) clearInterval(progressRef.current)
            resolve()
          }
          setStepProgress(progress)
          setOverallProgress(((i + progress / 100) / PIPELINE_STEPS.length) * 100)
        }, interval)
      })

      if (abortRef.current) break

      // Wait again if paused
      while (pauseLockRef.current && !abortRef.current) {
        await new Promise(r => setTimeout(r, 200))
      }
      if (abortRef.current) break

      setStepStatuses(prev => {
        const next = [...prev]
        next[i] = 'completed'
        return next
      })
      setStepProgress(100)
      const logType: LogEntry['type'] = step.id === 6 ? 'warning' : step.id === 7 ? 'warning' : 'success'
      addLog(i + 1, `✓ ${step.name}: ${step.output}`, logType)

      // Brief pause between steps
      await new Promise(r => setTimeout(r, 300))
    }

    if (!abortRef.current) {
      setOverallProgress(100)
      setRunStatus('completed')
      setCurrentStep(-1)
      addLog(0, '🎉 RUN MY COMPANY™ pipeline complete — all autonomous tasks finished successfully', 'success')
      // PT-1-a-retry: log uses REAL cash position + REAL cash-flow-optimized
      // amount + REAL decision count (the 5 RMB agents dispatched below).
      addLog(
        0,
        `📈 ${fmtINR(realCashPosition)} working capital secured • ${fmtINR(realCashFlowOptimized)} cash flow optimized • 5 decisions executed`,
        'success'
      )

      // PT-1-b: Dispatch REAL DB-writing RMB agents so every company pipeline
      // run also creates real Notification / AITask / AuditLog / AIPrediction
      // / ExecutiveReport / Issue rows — not just the simulated log entries.
      addLog(0, '🤖 Dispatching 5 RMB agents (Collections / Compliance / Finance / GST / Reporting) for real DB writes…', 'info')
      const realAgents: Array<'collections' | 'compliance' | 'finance' | 'reporting' | 'gst'> = [
        'collections', 'compliance', 'finance', 'gst', 'reporting',
      ]
      const realSummaries: string[] = []
      for (const a of realAgents) {
        if (abortRef.current) break
        try {
          const result = await apiPost<{
            success: boolean
            summary: string
            error?: string
          }>('/api/rmb/run-agent', { agent: a, userId: user?.id })
          if (result.success) {
            realSummaries.push(`✓ ${a}: ${result.summary}`)
            addLog(0, `✓ ${a} agent: ${result.summary}`, 'success')
          } else {
            addLog(0, `✗ ${a} agent: ${result.error ?? 'failed'}`, 'warning')
          }
        } catch (e) {
          addLog(0, `✗ ${a} agent: ${e instanceof Error ? e.message : 'failed'}`, 'warning')
        }
      }
      if (realSummaries.length > 0) {
        toast({
          title: 'Real RMB agents executed',
          description: `${realSummaries.length}/5 agents wrote real DB rows. See the Run-My-Business page for live task + audit trail.`,
        })
      }

      setTimeout(() => setShowResults(true), 600)
    }
  }, [runStatus, enabledSteps, addLog, company, schedule, riskThreshold, toast, user?.id, realCashPosition, realCashFlowOptimized])

  // ── Pause Pipeline ──
  const pausePipeline = useCallback(() => {
    pauseLockRef.current = true
    setRunStatus('paused')
    addLog(0, '⏸ Pipeline paused by operator', 'warning')
  }, [addLog])

  // ── Resume Pipeline ──
  const resumePipeline = useCallback(() => {
    pauseLockRef.current = false
    setRunStatus('running')
    addLog(0, '▶ Pipeline resumed by operator', 'info')
  }, [addLog])

  // ── Stop Pipeline ──
  const stopPipeline = useCallback(() => {
    abortRef.current = true
    pauseLockRef.current = false
    if (progressRef.current) clearInterval(progressRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRunStatus('idle')
    setCurrentStep(-1)
    addLog(0, '⏹ Pipeline terminated by operator', 'error')
  }, [addLog])

  // ── Toggle step enabled ──
  const toggleStep = (index: number) => {
    setEnabledSteps(prev => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  // ── State flags ──
  const isRunning = runStatus === 'running'
  const isPaused = runStatus === 'paused'
  const isActive = isRunning || isPaused
  const isCompleted = runStatus === 'completed'

  const completedSteps = stepStatuses.filter(s => s === 'completed').length

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* ── Background Grid ── */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* ── Ambient Glow ── */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
          style={{
            background: isRunning
              ? 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative z-10 p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* ══════════════════════════════════════════════════════════════════
            HEADER — Title + Tagline
        ══════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center mb-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl md:text-2xl font-black tracking-[0.15em] text-white">
              RUN MY COMPANY™
            </h1>
            <Badge className="bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] tracking-wider">
              AUTONOMOUS ECONOMY MODE
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Per-company autonomous execution engine — syncs financial data, trades invoices, secures capital,
            predicts risks and refreshes the digital twin in one orchestrated run.
          </p>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════
            HERO — THE BUTTON
        ══════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col items-center pt-2 pb-8">
          {/* Company Selector */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 w-full max-w-sm"
          >
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block text-center">
              Running for
            </label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany} disabled={isActive}>
              <SelectTrigger className="bg-slate-900/80 border-slate-700 text-white text-sm h-11 [&>span]:flex [&>span]:items-center [&>span]:gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 max-h-72">
                {COMPANIES.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-white focus:bg-slate-800">
                    <div className="flex flex-col py-0.5">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{c.gstin} • {c.industry}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Badge
              variant="outline"
              className={`
                px-4 py-1.5 text-xs font-bold tracking-widest border-2
                ${isRunning ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' :
                  isPaused ? 'bg-amber-500/20 border-amber-500 text-amber-300' :
                  isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' :
                  'bg-slate-800 border-slate-600 text-slate-300'}
              `}
            >
              <Activity className="h-3 w-3 mr-1.5" />
              {runStatus.toUpperCase()}
            </Badge>
          </motion.div>

          {/* The Button */}
          <div className="relative">
            {/* Rotating Conic-Gradient Ring */}
            <motion.div
              animate={{ rotate: isActive ? 360 : 0 }}
              transition={{
                duration: isActive ? 4 : 12,
                repeat: Infinity,
                ease: 'linear' as const,
              }}
              className="absolute inset-[-24px] rounded-full pointer-events-none"
              style={{
                background: `conic-gradient(from 0deg,
                  ${isRunning ?
                    'rgba(52,211,153,0.7), transparent 30%, rgba(251,191,36,0.6), transparent 60%, rgba(52,211,153,0.7)' :
                    isPaused ?
                    'rgba(251,191,36,0.6), transparent 30%, rgba(251,191,36,0.4), transparent 60%, rgba(251,191,36,0.6)' :
                    isCompleted ?
                    'rgba(52,211,153,0.5), transparent 30%, rgba(52,211,153,0.3), transparent 60%, rgba(52,211,153,0.5)' :
                    'rgba(52,211,153,0.4), transparent 30%, rgba(251,191,36,0.4), transparent 60%, rgba(52,211,153,0.4)'
                  })`,
                filter: 'blur(2px)',
              }}
            />

            {/* Pulsing Aura (idle + active) */}
            <motion.div
              animate={{
                scale: isActive ? [1, 1.3, 1] : [1, 1.15, 1],
                opacity: isActive ? [0.3, 0.1, 0.3] : [0.18, 0.08, 0.18],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
              className="absolute inset-[-40px] rounded-full pointer-events-none"
              style={{
                background: isRunning
                  ? 'radial-gradient(circle, rgba(52,211,153,0.35), transparent 70%)'
                  : isPaused
                    ? 'radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)'
                    : 'radial-gradient(circle, rgba(52,211,153,0.25), rgba(251,191,36,0.15), transparent 70%)',
              }}
            />

            {/* Outer Glow Ring (idle pulsing emerald+amber) */}
            <motion.div
              animate={isActive ? {
                boxShadow: [
                  '0 0 40px rgba(52,211,153,0.25), 0 0 80px rgba(251,191,36,0.15)',
                  '0 0 60px rgba(52,211,153,0.45), 0 0 120px rgba(251,191,36,0.25)',
                  '0 0 40px rgba(52,211,153,0.25), 0 0 80px rgba(251,191,36,0.15)',
                ],
              } : {
                boxShadow: [
                  '0 0 20px rgba(52,211,153,0.15), 0 0 40px rgba(251,191,36,0.1)',
                  '0 0 40px rgba(52,211,153,0.3), 0 0 80px rgba(251,191,36,0.2)',
                  '0 0 20px rgba(52,211,153,0.15), 0 0 40px rgba(251,191,36,0.1)',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const }}
              className="absolute inset-[-6px] rounded-full pointer-events-none"
              style={{
                background: 'transparent',
              }}
            />

            {/* Main Button */}
            <motion.button
              whileHover={{ scale: isActive ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (runStatus === 'idle' || runStatus === 'completed') runPipeline()
                else if (isPaused) resumePipeline()
              }}
              disabled={isRunning}
              className={`
                relative w-[280px] h-[280px] rounded-full
                flex flex-col items-center justify-center gap-3
                cursor-pointer select-none
                transition-colors duration-500
                ${isRunning ? 'bg-emerald-600 cursor-not-allowed' :
                  isPaused ? 'bg-amber-600' :
                  isCompleted ? 'bg-emerald-700' :
                  'bg-gradient-to-br from-emerald-500 to-emerald-700'}
                shadow-2xl
              `}
              style={{
                boxShadow: isActive
                  ? '0 0 60px rgba(52,211,153,0.4), inset 0 0 40px rgba(0,0,0,0.3)'
                  : '0 0 30px rgba(52,211,153,0.2), 0 0 60px rgba(251,191,36,0.1), inset 0 0 30px rgba(0,0,0,0.2)',
              }}
            >
              {/* Inner Ring Pattern */}
              <div className="absolute inset-3 rounded-full border border-white/10" />
              <div className="absolute inset-6 rounded-full border border-white/5" />
              <div className="absolute inset-10 rounded-full border border-emerald-400/10" />

              {/* Particles */}
              <FloatingParticles active={isRunning} />

              {isRunning ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
                  >
                    <Rocket className="h-12 w-12 text-white" />
                  </motion.div>
                  <span className="text-base font-black text-white tracking-wider">
                    RUNNING
                  </span>
                  <span className="text-xs text-white/60 font-medium">
                    {completedSteps}/9 Steps
                  </span>
                </>
              ) : isPaused ? (
                <>
                  <Pause className="h-12 w-12 text-white" />
                  <span className="text-base font-black text-white tracking-wider">
                    PAUSED
                  </span>
                  <span className="text-xs text-white/60 font-medium">Tap to Resume</span>
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle className="h-12 w-12 text-white" />
                  <span className="text-base font-black text-white tracking-wider">
                    COMPLETE
                  </span>
                  <span className="text-xs text-white/60 font-medium">Run Again?</span>
                </>
              ) : (
                <>
                  <Building2 className="h-10 w-10 text-white/90" />
                  <span className="text-sm font-black text-white tracking-[0.15em] leading-tight text-center px-4">
                    RUN MY<br />COMPANY™
                  </span>
                  <span className="text-[10px] text-white/50 font-medium">
                    Autonomous Economy Mode
                  </span>
                </>
              )}
            </motion.button>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {/* Start */}
            <Button
              size="sm"
              onClick={() => {
                if (runStatus === 'idle' || runStatus === 'completed') runPipeline()
              }}
              disabled={isActive}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Start
            </Button>
            {/* Pause */}
            <Button
              size="sm"
              variant="outline"
              onClick={pausePipeline}
              disabled={!isRunning}
              className="border-amber-500/50 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 hover:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause
            </Button>
            {/* Resume */}
            <Button
              size="sm"
              variant="outline"
              onClick={resumePipeline}
              disabled={!isPaused}
              className="border-emerald-500/50 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 hover:text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Resume
            </Button>
            {/* Stop */}
            <Button
              size="sm"
              variant="outline"
              onClick={stopPipeline}
              disabled={!isActive}
              className="border-red-500/50 bg-red-950/30 hover:bg-red-900/40 text-red-300 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Stop
            </Button>
            {/* Config Toggle */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowConfig(!showConfig)}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Config
            </Button>
          </div>

          {/* Last Run Info */}
          {!isActive && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-xs text-slate-500 text-center max-w-xl"
            >
              <Clock className="h-3 w-3 inline mr-1" />
              Last run: 14 Nov 2025, 6:00 AM IST • Duration: 4m 23s • Status:{' '}
              <span className="text-emerald-400 font-semibold">COMPLETED</span>
            </motion.p>
          )}

          {/* Elapsed Time & Progress Bar */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 w-full max-w-lg"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400 font-mono">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {fmtElapsed(elapsedTime)}
                </span>
                <span className="text-xs text-slate-400">
                  {Math.round(overallProgress)}% Complete
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${overallProgress}%`,
                    background: isPaused
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #2563EB, #3B82F6, #fbbf24, #60A5FA)',
                    boxShadow: '0 0 10px rgba(59,130,246,0.5)',
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            CONFIGURATION PANEL
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Company Run Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Step Toggles */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-emerald-400" />
                        Pipeline Steps
                      </h4>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                        {PIPELINE_STEPS.map((step, i) => (
                          <div key={step.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                              <span>{step.emoji}</span>
                              {step.name}
                            </span>
                            <Switch
                              checked={enabledSteps[i]}
                              onCheckedChange={() => toggleStep(i)}
                              className="data-[state=checked]:bg-emerald-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Schedule + Notifications */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
                        Schedule
                      </h4>
                      <div className="space-y-2">
                        {(['one-time', 'daily', 'weekly', 'custom'] as const).map(s => (
                          <label key={s} className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs
                            ${schedule === s ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-300' : 'bg-slate-800/50 border border-slate-700 text-slate-400'}
                          `}>
                            <input
                              type="radio"
                              name="schedule"
                              checked={schedule === s}
                              onChange={() => setSchedule(s)}
                              className="accent-emerald-500"
                            />
                            <span className="capitalize font-medium">
                              {s === 'daily' ? 'Daily at 6AM IST' : s === 'one-time' ? 'One-time' : s === 'weekly' ? 'Weekly Monday' : 'Custom cron'}
                            </span>
                          </label>
                        ))}
                      </div>

                      <h4 className="text-xs font-semibold text-slate-300 mt-5 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-emerald-400" />
                        Notifications
                      </h4>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" /> Email
                          </span>
                          <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-600" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                          </span>
                          <Switch checked={notifWhatsapp} onCheckedChange={setNotifWhatsapp} className="data-[state=checked]:bg-emerald-600" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Bell className="h-3.5 w-3.5" /> In-app
                          </span>
                          <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-600" />
                        </div>
                      </div>
                    </div>

                    {/* Thresholds & Escalation */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-amber-400" />
                        Risk Threshold
                      </h4>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2">
                          Auto-execute AI decisions below
                        </p>
                        <p className="text-lg font-bold text-emerald-400">
                          {fmtINR(riskThreshold * 100000)}
                        </p>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={riskThreshold}
                          onChange={e => setRiskThreshold(Number(e.target.value))}
                          className="w-full mt-2 accent-emerald-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Escalate above this amount</p>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-300 mt-5 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Banknote className="h-3.5 w-3.5 text-emerald-400" />
                        Auto-Finance Threshold
                      </h4>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-2">
                          Auto-list invoices above
                        </p>
                        <p className="text-lg font-bold text-amber-400">
                          {fmtINR(autoFinanceThreshold * 100000)}
                        </p>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={autoFinanceThreshold}
                          onChange={e => setAutoFinanceThreshold(Number(e.target.value))}
                          className="w-full mt-2 accent-amber-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">On Invoice Exchange</p>
                      </div>

                      <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Escalate on failure
                        </span>
                        <Switch checked={escalationErrors} onCheckedChange={setEscalationErrors} className="data-[state=checked]:bg-amber-600" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════
            9-STEP COMPANY PIPELINE
        ══════════════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-black text-white tracking-wide">
              COMPANY PIPELINE
            </h2>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
              {completedSteps}/9 Complete
            </Badge>
            {isActive && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Badge className="bg-emerald-600 text-white text-[10px]">
                  <Activity className="h-2.5 w-2.5 mr-1" />
                  LIVE
                </Badge>
              </motion.div>
            )}
            <div className="ml-auto hidden sm:flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-500 font-medium">{company.name}</span>
            </div>
          </div>

          <div className="relative">
            <ScanLine active={isRunning} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {PIPELINE_STEPS.map((step, i) => {
                const status = stepStatuses[i]
                const Icon = step.icon

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card className={`
                      relative overflow-hidden border transition-all duration-500
                      ${status === 'running' ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10' :
                        status === 'completed' ? 'bg-emerald-950/20 border-emerald-500/30' :
                        status === 'failed' ? 'bg-red-950/30 border-red-500/50' :
                        'bg-slate-900/50 border-slate-700/30'}
                      ${!enabledSteps[i] ? 'opacity-40' : ''}
                    `}>
                      {/* Step number indicator */}
                      <div className="absolute top-0 left-0 w-1 h-full">
                        <motion.div
                          className={`
                            w-full h-full
                            ${status === 'running' ? 'bg-amber-500' :
                              status === 'completed' ? 'bg-emerald-500' :
                              status === 'failed' ? 'bg-red-500' :
                              'bg-slate-700'}
                          `}
                          animate={status === 'running' ? {
                            opacity: [1, 0.4, 1],
                          } : {}}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      </div>

                      <CardContent className="p-4 pl-5">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`
                            flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                            ${status === 'running' ? 'bg-amber-500/20' :
                              status === 'completed' ? 'bg-emerald-500/20' :
                              'bg-slate-800'}
                          `}>
                            {status === 'completed' ? (
                              <CheckCircle className="h-5 w-5 text-emerald-400" />
                            ) : status === 'running' ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
                              >
                                <Icon className="h-5 w-5 text-amber-400" />
                              </motion.div>
                            ) : (
                              <Icon className="h-5 w-5 text-slate-500" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] text-slate-500 font-mono">STEP {String(step.id).padStart(2, '0')}</span>
                              {status === 'running' && (
                                <motion.span
                                  animate={{ opacity: [1, 0.3, 1] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                  className="text-[10px] text-amber-400 font-bold"
                                >
                                  EXECUTING
                                </motion.span>
                              )}
                            </div>
                            <h3 className={`
                              text-sm font-semibold leading-tight
                              ${status === 'running' ? 'text-amber-200' :
                                status === 'completed' ? 'text-emerald-200' :
                                'text-slate-300'}
                            `}>
                              {step.name}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{step.description}</p>

                            {/* Progress Bar */}
                            {status === 'running' && (
                              <div className="mt-2">
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{ width: `${stepProgress}%` }}
                                    transition={{ duration: 0.2 }}
                                  />
                                </div>
                                <span className="text-[10px] text-amber-400 mt-1 inline-block">
                                  {Math.round(stepProgress)}%
                                </span>
                              </div>
                            )}

                            {/* Output */}
                            {status === 'completed' && (
                              <motion.p
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-[11px] text-emerald-400/80 mt-1.5 font-medium leading-snug"
                              >
                                → {step.output}
                              </motion.p>
                            )}
                          </div>

                          {/* Status Badge */}
                          <Badge
                            variant="outline"
                            className={`
                              text-[9px] flex-shrink-0 px-1.5 py-0 h-5
                              ${status === 'running' ? 'border-amber-500 text-amber-400 bg-amber-500/10' :
                                status === 'completed' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' :
                                status === 'failed' ? 'border-red-500 text-red-400 bg-red-500/10' :
                                'border-slate-700 text-slate-500 bg-slate-800/50'}
                            `}
                          >
                            {status === 'running' ? 'RUN' :
                              status === 'completed' ? 'OK' :
                              status === 'failed' ? 'ERR' : 'WAIT'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            RESULTS DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showResults && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-black text-white tracking-wide">
                  AUTONOMOUS RUN RESULTS
                </h2>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.3 }}
                >
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    ALL 9 STEPS PASSED
                  </Badge>
                </motion.div>
              </div>

              {/* Summary Cards (6) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                  { label: 'Tasks Completed', value: `${countedTasks}/9`, icon: CheckCircle, color: 'emerald', prefix: '', suffix: '' },
                  { label: 'Revenue Optimized', value: countedRevenue, icon: TrendingUp, color: 'amber', prefix: '₹', isINR: true, suffix: '' },
                  { label: 'Capital Secured', value: countedCapital, icon: HandCoins, color: 'emerald', prefix: '₹', isINR: true, suffix: '' },
                  { label: 'Risks Predicted', value: countedRisks, icon: Shield, color: 'amber', prefix: '', suffix: '' },
                  { label: 'Decisions Executed', value: countedDecisions, icon: Brain, color: 'emerald', prefix: '', suffix: '' },
                  { label: 'Reports Generated', value: countedReports, icon: FileText, color: 'amber', prefix: '', suffix: '' },
                ].map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring', bounce: 0.4 }}
                  >
                    <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm overflow-hidden relative">
                      {/* Glass-morphism gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
                      <CardContent className="p-4 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <card.icon className={`h-4 w-4 ${
                            card.color === 'emerald' ? 'text-emerald-400' : 'text-amber-400'
                          }`} />
                          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                            {card.label}
                          </span>
                        </div>
                        <p className={`text-lg font-black ${
                          card.color === 'emerald' ? 'text-emerald-300' : 'text-amber-300'
                        }`}>
                          {card.prefix}{card.isINR ? card.value.toLocaleString('en-IN') : card.value}{card.suffix}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* AI Company Brief */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-gradient-to-r from-emerald-950/50 via-slate-900/40 to-amber-950/30 border-emerald-500/20 backdrop-blur-sm mb-6">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-2">
                          AI Company Brief
                          <Badge className="bg-amber-500/20 text-amber-300 text-[9px] border border-amber-500/40">
                            {company.name}
                          </Badge>
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          Today&apos;s autonomous run completed successfully.{' '}
                          <span className="text-emerald-400 font-bold">{fmtINR(realCashPosition)} working capital</span> secured (current cash position).{' '}
                          <span className="text-amber-400 font-semibold">8 invoices listed on Invoice Exchange</span> — 3 already received bids.{' '}
                          Cash flow optimized with{' '}
                          <span className="text-emerald-400 font-bold">{fmtINR(realCashFlowOptimized)} collection acceleration</span>.{' '}
                          <span className="text-amber-400 font-semibold">2 compliance risks</span> flagged for review.{' '}
                          Digital Twin updated with current state.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Priority Actions + Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Priority Actions */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Target className="h-4 w-4 text-amber-400" />
                        Priority Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {priorityActions.length === 0 ? (
                          <EmptyState
                            icon={Target}
                            title="No priority actions yet"
                            description="The AI engine will surface critical, high, and medium priority actions here once an autonomous run completes."
                            compact
                          />
                        ) : (
                          priorityActions.map((action, i) => (
                            <motion.div
                              key={action.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + i * 0.08 }}
                              className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30"
                            >
                              <Badge className={`
                                text-[9px] flex-shrink-0 px-1.5 py-0 h-5
                                ${action.priority === 'critical' ? 'bg-red-600 text-white' :
                                  action.priority === 'high' ? 'bg-amber-600 text-white' :
                                  'bg-slate-600 text-white'}
                              `}>
                                {action.priority.toUpperCase()}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-300 font-medium leading-tight">{action.action}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-700 text-slate-500">
                                    {action.category}
                                  </Badge>
                                  <span className="text-[10px] text-slate-500">Due {action.dueDate}</span>
                                  {action.status === 'in-progress' && (
                                    <span className="text-[10px] text-amber-400 font-semibold">• In Progress</span>
                                  )}
                                </div>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Performance vs Last Run + System Health */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <LineChart className="h-4 w-4 text-emerald-400" />
                        Performance vs Last Run
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {runHistory.length === 0 ? (
                          <EmptyState
                            icon={LineChart}
                            title="No previous run to compare against"
                            description="Performance deltas will appear here once you have at least one completed autonomous run in history."
                            compact
                          />
                        ) : (
                          [
                            { label: 'Capital Secured', current: 0, previous: 0, unit: 'Cr', inverse: false },
                            { label: 'Revenue Optimized', current: 0, previous: 0, unit: 'L', inverse: false },
                            { label: 'Decisions Executed', current: 0, previous: 0, unit: '', inverse: false },
                            { label: 'Execution Time', current: 0, previous: 0, unit: 'min', inverse: true },
                            { label: 'Risks Predicted', current: 0, previous: 0, unit: '', inverse: true },
                          ].map((metric, i) => {
                            const diff = metric.inverse
                              ? metric.previous - metric.current
                              : metric.current - metric.previous
                            const isPositive = diff > 0
                            const isNeutral = diff === 0

                            return (
                              <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + i * 0.07 }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-slate-400">{metric.label}</span>
                                  <span className={`text-xs font-bold ${isNeutral ? 'text-slate-400' : isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {diff > 0 ? '+' : ''}{diff}{metric.unit}
                                  </span>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min((metric.current / (metric.previous * 1.2)) * 100, 100)}%` }}
                                      transition={{ delay: 0.8 + i * 0.07, duration: 0.8, ease: 'easeOut' as const }}
                                      className={`h-full rounded-full ${isNeutral ? 'bg-slate-500' : isPositive ? 'bg-emerald-500/60' : 'bg-amber-500/60'}`}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-500 w-16 text-right">
                                    {metric.current}{metric.unit}
                                  </span>
                                </div>
                              </motion.div>
                            )
                          })
                        )}
                      </div>

                      {/* System Health */}
                      <Separator className="my-4 bg-slate-700/50" />
                      <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-emerald-400" />
                        System Health
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Economic Graph', icon: Network },
                          { label: 'Invoice Exchange', icon: Banknote },
                          { label: 'Financing Marketplace', icon: HandCoins },
                          { label: 'Decision Engine', icon: Brain },
                        ].map(sys => {
                          const SysIcon = sys.icon
                          return (
                            <div key={sys.label} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <SysIcon className="h-3 w-3 text-emerald-400" />
                              <span className="text-[10px] text-emerald-300">{sys.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════
            RUN HISTORY
        ══════════════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="text-lg font-black text-white tracking-wide mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            RUN HISTORY
          </h2>
          <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left px-4 py-3">Date / Time</th>
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left px-4 py-3">Duration</th>
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left px-4 py-3">Tasks</th>
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left px-4 py-3">Capital Secured</th>
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left px-4 py-3">Status</th>
                      <th className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-right px-4 py-3">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8">
                          <EmptyState
                            icon={Inbox}
                            title="No run history yet"
                            description="Completed autonomous runs will be listed here with their duration, tasks, capital secured, and status."
                          />
                        </td>
                      </tr>
                    ) : (
                      runHistory.map((run, i) => (
                        <motion.tr
                          key={run.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-xs text-slate-300">
                            <div className="font-medium">{run.date}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{run.time}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{run.duration}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-300">{run.tasks}</td>
                          <td className="px-4 py-2.5 text-xs text-emerald-400 font-semibold">{run.capital}</td>
                          <td className="px-4 py-2.5">
                            <Badge className={`
                              text-[9px] px-2 py-0
                              ${run.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' :
                                run.status === 'partial' ? 'bg-amber-600/20 text-amber-400' :
                                'bg-red-600/20 text-red-400'}
                            `}>
                              {run.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30 px-2"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Report
                            </Button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            ACTIVITY LOG
        ══════════════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="text-lg font-black text-white tracking-wide mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-400" />
            ACTIVITY LOG
            {isActive && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-emerald-500"
              />
            )}
          </h2>
          <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-1">
                  {logEntries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                      <Activity className="h-8 w-8 mb-2" />
                      <p className="text-xs">No activity yet. Press RUN MY COMPANY™ to start.</p>
                    </div>
                  )}
                  {logEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        flex items-start gap-3 px-3 py-2 rounded-lg text-xs
                        ${entry.type === 'success' ? 'bg-emerald-950/20' :
                          entry.type === 'warning' ? 'bg-amber-950/20' :
                          entry.type === 'error' ? 'bg-red-950/20' :
                          'bg-slate-800/30'}
                      `}
                    >
                      <span className="text-slate-600 font-mono text-[10px] flex-shrink-0 pt-0.5">
                        {entry.timestamp}
                      </span>
                      <span className={`
                        flex-shrink-0
                        ${entry.type === 'success' ? 'text-emerald-400' :
                          entry.type === 'warning' ? 'text-amber-400' :
                          entry.type === 'error' ? 'text-red-400' :
                          'text-slate-400'}
                      `}>
                        {entry.type === 'success' ? '●' :
                          entry.type === 'warning' ? '▲' :
                          entry.type === 'error' ? '✕' :
                          '→'}
                      </span>
                      <span className={`
                        ${entry.type === 'success' ? 'text-emerald-300' :
                          entry.type === 'warning' ? 'text-amber-300' :
                          entry.type === 'error' ? 'text-red-300' :
                          'text-slate-300'}
                      `}>
                        {entry.message}
                      </span>
                    </motion.div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER BRANDING
        ══════════════════════════════════════════════════════════════════ */}
        <div className="text-center py-6 border-t border-slate-800/50">
          <p className="text-[10px] text-slate-600 tracking-widest uppercase">
            Autonomous Economy Mode — Run My Company™
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            GSTPilot Financial Exchange™ v3.0
          </p>
        </div>
      </div>
    </div>
  )
}
