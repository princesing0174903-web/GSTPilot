'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Play, Pause, CheckCircle, AlertTriangle, Zap, Brain, FileText,
  IndianRupee, Users, Shield, Clock, Activity, ArrowRight, Sparkles,
  Bot, Workflow, Rocket, Target, Gauge, Send, TrendingUp, Eye, Cpu,
  Square, RotateCcw, ChevronRight, Bell, BarChart3, Calendar,
  Settings, Mail, MessageSquare, AlertCircle, CircleDot, Link2,
  FileSearch, Wallet, LineChart, ClipboardCheck, Lightbulb,
  ChevronDown, ChevronUp, X, ExternalLink, FileSpreadsheet,
  Flame,
} from 'lucide-react'
import {
  useFireClients, useFireInvoices, useFireReturns,
  useFireDocuments, useFireReconciliations, useFireActivities,
} from '@/hooks/use-firestore'
import { useApp } from '@/contexts/AppContext'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN')

const fmtTime = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

const fmtDateIN = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE STEPS DEFINITION
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
  { id: 1, name: 'Read Documents', icon: FileSearch, emoji: '📄', description: 'Scan all uploaded documents', output: '23 documents scanned, 5 new invoices detected', duration: 2200 },
  { id: 2, name: 'Update Graph', icon: Link2, emoji: '🔗', description: 'Update Business Graph relationships', output: '47 entities updated, 12 new connections created', duration: 1800 },
  { id: 3, name: 'Extract Invoices', icon: FileText, emoji: '📊', description: 'Process and extract invoice data', output: '5 invoices extracted, ₹12,34,500 total value', duration: 2600 },
  { id: 4, name: 'Collect Payments', icon: IndianRupee, emoji: '💰', description: 'Send payment reminders, process collections', output: '8 reminders sent, 2 payments confirmed (₹3,45,000)', duration: 2000 },
  { id: 5, name: 'Predict Cash Flow', icon: TrendingUp, emoji: '📈', description: 'Generate cash flow predictions', output: 'Cash flow: Healthy. ₹8,90,000 expected next week', duration: 2400 },
  { id: 6, name: 'Prepare Returns', icon: ClipboardCheck, emoji: '📋', description: 'Auto-prepare GST returns', output: '3 GSTR-1 prepared, 2 GSTR-3B prepared', duration: 2800 },
  { id: 7, name: 'Send Reminders', icon: Bell, emoji: '🔔', description: 'Remind clients about deadlines', output: '12 deadline reminders sent, 5 document requests sent', duration: 1600 },
  { id: 8, name: 'Generate Reports', icon: BarChart3, emoji: '📑', description: 'Create compliance & financial reports', output: '4 reports generated (Compliance, Revenue, Collections, Risk)', duration: 2200 },
  { id: 9, name: 'Forecast Revenue', icon: LineChart, emoji: '🔮', description: 'Generate revenue forecasts', output: 'Revenue forecast: ₹56,78,900 next month (+12%)', duration: 2000 },
  { id: 10, name: 'Recommend Actions', icon: Lightbulb, emoji: '✅', description: 'AI-powered action recommendations', output: '5 actions recommended (3 high priority, 2 medium)', duration: 1800 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO RUN HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

interface RunHistory {
  id: number
  date: string
  startTime: string
  duration: string
  tasks: number
  revenue: string
  status: 'completed' | 'failed' | 'partial'
}

const DEMO_RUN_HISTORY: RunHistory[] = [
  { id: 1, date: '04/03/2026', startTime: '09:30 AM', duration: '2m 34s', tasks: 23, revenue: '₹12,34,500', status: 'completed' },
  { id: 2, date: '03/03/2026', startTime: '09:30 AM', duration: '2m 18s', tasks: 21, revenue: '₹9,87,600', status: 'completed' },
  { id: 3, date: '02/03/2026', startTime: '09:30 AM', duration: '2m 45s', tasks: 25, revenue: '₹15,23,400', status: 'completed' },
  { id: 4, date: '01/03/2026', startTime: '09:30 AM', duration: '1m 52s', tasks: 19, revenue: '₹7,65,300', status: 'partial' },
  { id: 5, date: '28/02/2026', startTime: '09:30 AM', duration: '0m 34s', tasks: 3, revenue: '—', status: 'failed' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION ITEMS (Demo)
// ═══════════════════════════════════════════════════════════════════════════════

interface ActionItem {
  id: number
  priority: 'high' | 'medium' | 'low'
  action: string
  client: string
  dueDate: string
  status: 'pending' | 'in-progress' | 'done'
}

const DEMO_ACTIONS: ActionItem[] = [
  { id: 1, priority: 'high', action: 'File GSTR-1 for March 2026', client: 'Sharma Enterprises', dueDate: '11/03/2026', status: 'pending' },
  { id: 2, priority: 'high', action: 'Resolve ITC mismatch of ₹45,000', client: 'Patel & Sons', dueDate: '12/03/2026', status: 'pending' },
  { id: 3, priority: 'high', action: 'Respond to GST notice SCN-2026-089', client: 'Krishna Traders', dueDate: '10/03/2026', status: 'in-progress' },
  { id: 4, priority: 'medium', action: 'Collect outstanding payment ₹2,34,000', client: 'Mehta Industries', dueDate: '15/03/2026', status: 'pending' },
  { id: 5, priority: 'medium', action: 'Update compliance documents for KYC', client: 'Reddy Corp', dueDate: '18/03/2026', status: 'pending' },
  { id: 6, priority: 'low', action: 'Review quarterly financial statements', client: 'Gupta Associates', dueDate: '31/03/2026', status: 'pending' },
]

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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RunMyBusinessPage() {
  const { currentView } = useApp()
  const { data: clients } = useFireClients()
  const { data: invoices } = useFireInvoices()
  const { data: returns } = useFireReturns()
  const { data: documents } = useFireDocuments()
  const { data: reconciliations } = useFireReconciliations()
  const { data: activities } = useFireActivities()

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
  const [configOpen, setConfigOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [logFilter, setLogFilter] = useState<number | null>(null)

  // ── Config State ──
  const [enabledSteps, setEnabledSteps] = useState<boolean[]>(PIPELINE_STEPS.map(() => true))
  const [schedule, setSchedule] = useState<'one-time' | 'daily' | 'weekly' | 'custom'>('one-time')
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifWhatsapp, setNotifWhatsapp] = useState(false)
  const [notifInApp, setNotifInApp] = useState(true)
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(100000)
  const [escalationErrors, setEscalationErrors] = useState(true)

  const logIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef(false)

  // ── Computed data for realistic outputs ──
  const liveClientCount = clients?.length || 47
  const liveInvoiceCount = invoices?.length || 94
  const liveReturnCount = returns?.length || 23
  const liveDocCount = documents?.length || 23
  const liveReconCount = reconciliations?.length || 12

  // ── Elapsed Timer ──
  useEffect(() => {
    if (runStatus === 'running' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime())
      }, 100)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [runStatus, startTime])

  // ── Add Log Entry ──
  const addLog = useCallback((stepId: number, message: string, type: LogEntry['type']) => {
    logIdRef.current++
    const entry: LogEntry = {
      id: logIdRef.current,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      stepId,
      message,
      type,
    }
    setLogEntries(prev => [...prev, entry])
  }, [])

  // ── Run Pipeline ──
  const runPipeline = useCallback(async () => {
    if (runStatus === 'paused') {
      // Resume
      setRunStatus('running')
      return
    }

    // Fresh start
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

    addLog(0, '🚀 RUN MY BUSINESS™ pipeline initiated', 'info')

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      if (abortRef.current) break
      if (!enabledSteps[i]) {
        setStepStatuses(prev => {
          const next = [...prev]
          next[i] = 'completed'
          return next
        })
        continue
      }

      setCurrentStep(i)
      setStepStatuses(prev => {
        const next = [...prev]
        next[i] = 'running'
        return next
      })
      setStepProgress(0)

      addLog(i + 1, `${PIPELINE_STEPS[i].emoji} Starting: ${PIPELINE_STEPS[i].name}`, 'info')

      // Simulate progress
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

      setStepStatuses(prev => {
        const next = [...prev]
        next[i] = 'completed'
        return next
      })
      setStepProgress(100)
      addLog(i + 1, `✓ ${step.name}: ${step.output}`, 'success')
    }

    if (!abortRef.current) {
      setOverallProgress(100)
      setRunStatus('completed')
      setCurrentStep(-1)
      addLog(0, '🎉 Pipeline completed successfully! All tasks finished.', 'success')
      // Show results after brief delay
      setTimeout(() => setShowResults(true), 800)
    }
  }, [runStatus, enabledSteps, addLog])

  // ── Pause Pipeline ──
  const pausePipeline = useCallback(() => {
    setRunStatus('paused')
    if (progressRef.current) clearInterval(progressRef.current)
    addLog(0, '⏸ Pipeline paused by user', 'warning')
  }, [addLog])

  // ── Stop Pipeline ──
  const stopPipeline = useCallback(() => {
    abortRef.current = true
    if (progressRef.current) clearInterval(progressRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRunStatus('idle')
    setCurrentStep(-1)
    addLog(0, '⏹ Pipeline stopped by user', 'error')
  }, [addLog])

  // ── Reset ──
  const resetPipeline = useCallback(() => {
    setRunStatus('idle')
    setStepStatuses(PIPELINE_STEPS.map(() => 'pending'))
    setCurrentStep(-1)
    setStepProgress(0)
    setOverallProgress(0)
    setLogEntries([])
    setStartTime(null)
    setElapsedTime(0)
    setShowResults(false)
  }, [])

  // ── Toggle Step ──
  const toggleStep = (index: number) => {
    setEnabledSteps(prev => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  // ── Format elapsed ──
  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec.toString().padStart(2, '0')}s`
  }

  // ── Filtered logs ──
  const filteredLogs = useMemo(() => {
    if (logFilter === null) return logEntries
    return logEntries.filter(l => l.stepId === logFilter)
  }, [logEntries, logFilter])

  // ── Status Badge Color ──
  const statusColor = useMemo(() => {
    switch (runStatus) {
      case 'idle': return 'bg-slate-100 text-slate-600'
      case 'running': return 'bg-emerald-100 text-emerald-700'
      case 'paused': return 'bg-amber-100 text-amber-700'
      case 'completed': return 'bg-emerald-500 text-white'
    }
  }, [runStatus])

  const statusText = useMemo(() => {
    switch (runStatus) {
      case 'idle': return 'Ready'
      case 'running': return 'Running...'
      case 'paused': return 'Paused'
      case 'completed': return 'Completed'
    }
  }, [runStatus])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <ScrollArea className="h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

          {/* ═══════════════════════════════════════════════════════════════════
              HERO SECTION: THE BUTTON
              ═══════════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative flex flex-col items-center justify-center py-12 sm:py-16"
          >
            {/* Ambient glow background */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              animate={runStatus === 'running' ? {
                scale: [1, 1.2, 1],
                opacity: [0.15, 0.3, 0.15],
              } : {
                scale: [1, 1.05, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: runStatus === 'running' ? 1.5 : 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div className={`w-[500px] h-[500px] rounded-full blur-3xl ${
                runStatus === 'running'
                  ? 'bg-emerald-400'
                  : runStatus === 'completed'
                  ? 'bg-emerald-300'
                  : 'bg-emerald-200'
              }`} />
            </motion.div>

            {/* THE BUTTON */}
            <div className="relative">
              {/* Progress ring around button */}
              {(runStatus === 'running' || runStatus === 'completed') && (
                <svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)] -rotate-90 pointer-events-none">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                  />
                  <motion.circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke={runStatus === 'completed' ? '#10b981' : '#34d399'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 0.48 * 200}`}
                    strokeDashoffset={2 * Math.PI * 0.48 * 200 * (1 - overallProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                </svg>
              )}

              {/* Main button */}
              <motion.button
                onClick={() => {
                  if (runStatus === 'idle' || runStatus === 'completed') runPipeline()
                  else if (runStatus === 'running') pausePipeline()
                  else if (runStatus === 'paused') runPipeline()
                }}
                className={`
                  relative z-10 group flex flex-col items-center justify-center
                  w-56 h-56 sm:w-64 sm:h-64 rounded-full
                  font-bold text-white text-lg sm:text-xl
                  shadow-2xl cursor-pointer select-none
                  transition-all duration-300
                  ${runStatus === 'idle'
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 hover:shadow-emerald-300/50'
                    : runStatus === 'running'
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-400/50'
                    : runStatus === 'paused'
                    ? 'bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600'
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                animate={runStatus === 'running' ? {
                  boxShadow: [
                    '0 0 0 0 rgba(16, 185, 129, 0.4)',
                    '0 0 0 20px rgba(16, 185, 129, 0)',
                    '0 0 0 0 rgba(16, 185, 129, 0)',
                  ],
                } : {}}
                transition={runStatus === 'running' ? {
                  boxShadow: { duration: 1.5, repeat: Infinity },
                } : {}}
              >
                {/* Inner content */}
                {runStatus === 'running' ? (
                  <motion.div
                    className="flex flex-col items-center gap-3"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Cpu className="h-12 w-12" />
                  </motion.div>
                ) : runStatus === 'paused' ? (
                  <Pause className="h-12 w-12 mb-2" />
                ) : runStatus === 'completed' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <CheckCircle className="h-12 w-12" />
                  </motion.div>
                ) : (
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Rocket className="h-12 w-12" />
                  </motion.div>
                )}

                <span className="mt-2 text-center leading-tight tracking-wide">
                  {runStatus === 'idle' || runStatus === 'completed'
                    ? 'RUN MY\nBUSINESS™'
                    : runStatus === 'running'
                    ? 'RUNNING...'
                    : 'PAUSED'}
                </span>
              </motion.button>
            </div>

            {/* Status text below button */}
            <motion.div
              className="mt-6 flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge className={`text-sm px-4 py-1 ${statusColor}`}>
                {statusText}
              </Badge>

              {runStatus === 'running' && (
                <motion.p
                  className="text-sm text-slate-500"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {currentStep >= 0 ? `Step ${currentStep + 1}/${PIPELINE_STEPS.length}: ${PIPELINE_STEPS[currentStep].name}` : 'Initializing...'}
                </motion.p>
              )}

              {runStatus === 'running' && startTime && (
                <p className="text-xs text-slate-400 font-mono">
                  Elapsed: {formatElapsed(elapsedTime)}
                </p>
              )}

              {runStatus === 'idle' && (
                <p className="text-sm text-slate-400">
                  Last run: Today 09:30 AM — 23 tasks completed
                </p>
              )}

              {runStatus === 'completed' && startTime && (
                <p className="text-sm text-emerald-600 font-medium">
                  Completed in {formatElapsed(elapsedTime)} — {PIPELINE_STEPS.length} tasks finished
                </p>
              )}
            </motion.div>

            {/* Control buttons */}
            <div className="mt-6 flex items-center gap-3">
              {runStatus === 'running' && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={pausePipeline}
                    className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                </motion.div>
              )}
              {runStatus === 'paused' && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <Button
                    size="sm"
                    onClick={() => runPipeline()}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                </motion.div>
              )}
              {(runStatus === 'running' || runStatus === 'paused') && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopPipeline}
                    className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </motion.div>
              )}
              {runStatus === 'completed' && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-3">
                  <Button
                    size="sm"
                    onClick={resetPipeline}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <RotateCcw className="h-4 w-4" /> Run Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryOpen(true)}
                    className="gap-2"
                  >
                    <Clock className="h-4 w-4" /> History
                  </Button>
                </motion.div>
              )}
              {runStatus === 'idle' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfigOpen(true)}
                    className="gap-2 text-slate-500"
                  >
                    <Settings className="h-4 w-4" /> Configure
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Overall progress bar */}
            {(runStatus === 'running' || runStatus === 'paused') && (
              <motion.div
                className="mt-6 w-full max-w-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Overall Progress</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                    style={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════════
              PIPELINE VISUALIZATION
              ═══════════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Workflow className="h-5 w-5 text-emerald-600" />
                Pipeline Steps
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                  className="text-slate-500 gap-1"
                >
                  <Clock className="h-3.5 w-3.5" /> Run History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfigOpen(true)}
                  className="text-slate-500 gap-1"
                >
                  <Settings className="h-3.5 w-3.5" /> Config
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const status = stepStatuses[i]
                const isActive = currentStep === i
                const Icon = step.icon
                const enabled = enabledSteps[i]

                return (
                  <React.Fragment key={step.id}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className={`relative rounded-xl border transition-all duration-300 ${
                        !enabled
                          ? 'border-slate-200 bg-slate-50/50 opacity-50'
                          : isActive
                          ? 'border-emerald-300 bg-emerald-50/50 shadow-lg shadow-emerald-100/50'
                          : status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : status === 'failed'
                          ? 'border-red-300 bg-red-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-4 p-4">
                        {/* Step number + icon */}
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                          ${status === 'completed'
                            ? 'bg-emerald-100 text-emerald-600'
                            : isActive
                            ? 'bg-emerald-500 text-white'
                            : status === 'failed'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-slate-100 text-slate-400'
                          }
                        `}>
                          {status === 'completed' ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            >
                              <CheckCircle className="h-5 w-5" />
                            </motion.div>
                          ) : isActive ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <Icon className="h-5 w-5" />
                            </motion.div>
                          ) : status === 'failed' ? (
                            <AlertTriangle className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-bold">{step.id}</span>
                          )}
                        </div>

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">{step.emoji} {step.name}</span>
                            {!enabled && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">SKIPPED</Badge>
                            )}
                            {status === 'running' && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700">RUNNING</Badge>
                            )}
                            {status === 'completed' && enabled && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600">DONE</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>

                          {/* Step progress */}
                          {isActive && (
                            <div className="mt-2">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                                  style={{ width: `${stepProgress}%` }}
                                  transition={{ duration: 0.1 }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Output */}
                          {status === 'completed' && enabled && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-xs text-emerald-600 mt-1 font-medium"
                            >
                              → {step.output}
                            </motion.p>
                          )}
                        </div>

                        {/* Duration / status indicator */}
                        <div className="flex-shrink-0 text-right">
                          {status === 'completed' && enabled && (
                            <span className="text-xs text-slate-400">
                              {(step.duration / 1000).toFixed(1)}s
                            </span>
                          )}
                          {isActive && (
                            <motion.span
                              className="text-xs text-emerald-500 font-medium"
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              {Math.round(stepProgress)}%
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Connection line */}
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className="flex justify-center">
                        <motion.div
                          className={`w-0.5 h-3 rounded-full ${
                            stepStatuses[i] === 'completed' && stepStatuses[i + 1] !== 'pending' || stepStatuses[i + 1] === 'completed'
                              ? 'bg-emerald-300'
                              : stepStatuses[i] === 'completed' && currentStep === i + 1
                              ? 'bg-emerald-400'
                              : 'bg-slate-200'
                          }`}
                          animate={currentStep === i + 1 && stepStatuses[i] === 'completed' ? {
                            scaleY: [1, 1.3, 1],
                            opacity: [0.5, 1, 0.5],
                          } : {}}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════════
              RESULTS DASHBOARD (after completion)
              ═══════════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showResults && (
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="space-y-6"
              >
                {/* Summary Cards */}
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-emerald-600" />
                    Run Results
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Tasks Completed', value: '10/10', icon: CheckCircle, color: 'emerald', change: '+3' },
                      { label: 'Revenue Processed', value: fmtINR(1234500), icon: IndianRupee, color: 'emerald', change: '+₹2,34,000' },
                      { label: 'Returns Prepared', value: '5', icon: FileText, color: 'emerald', change: '+2' },
                      { label: 'Reminders Sent', value: '17', icon: Bell, color: 'emerald', change: '+5' },
                    ].map((card, i) => (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.4 }}
                      >
                        <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <card.icon className="h-5 w-5 text-emerald-500" />
                              <Badge className="text-[10px] bg-emerald-50 text-emerald-600 border-0">
                                {card.change}
                              </Badge>
                            </div>
                            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                            <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* AI Daily Brief */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        AI Daily Brief
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3 text-sm text-slate-700">
                        <p className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">●</span>
                          <span><strong>Revenue outlook is positive.</strong> Expected ₹56,78,900 next month, up 12% from last month. Top contributors: Sharma Enterprises (₹12,34,500), Patel & Sons (₹9,87,600).</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">●</span>
                          <span><strong>3 compliance deadlines approaching.</strong> GSTR-1 for March due on 11/03, GSTR-3B due on 20/03. Krishna Traders has an outstanding SCN response due 10/03.</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">●</span>
                          <span><strong>Cash flow is healthy.</strong> ₹8,90,000 expected next week from 2 confirmed payments. Outstanding receivables: ₹4,56,000 across 3 clients.</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">●</span>
                          <span><strong>1 ITC mismatch detected.</strong> ₹45,000 mismatch for Patel & Sons — GSTR-2A vs books. Needs resolution before filing GSTR-3B.</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Action Items Table */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        Action Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Priority</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Action</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Client</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Due Date</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {DEMO_ACTIONS.map((action, i) => (
                              <motion.tr
                                key={action.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.05 }}
                                className="border-b border-slate-50 hover:bg-slate-50/50"
                              >
                                <td className="py-2.5 px-3">
                                  <Badge className={`text-[10px] ${
                                    action.priority === 'high' ? 'bg-red-50 text-red-600 border-red-200'
                                    : action.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}>
                                    {action.priority.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium">{action.action}</td>
                                <td className="py-2.5 px-3 text-slate-600">{action.client}</td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">{action.dueDate}</td>
                                <td className="py-2.5 px-3">
                                  <Badge variant="outline" className={`text-[10px] ${
                                    action.status === 'done' ? 'border-emerald-300 text-emerald-600'
                                    : action.status === 'in-progress' ? 'border-amber-300 text-amber-600'
                                    : 'border-slate-300 text-slate-500'
                                  }`}>
                                    {action.status === 'done' ? 'Done' : action.status === 'in-progress' ? 'In Progress' : 'Pending'}
                                  </Badge>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Performance Comparison */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-emerald-500" />
                        vs Last Run
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: 'Duration', current: '2m 34s', last: '2m 18s', better: false },
                          { label: 'Tasks', current: '23', last: '21', better: true },
                          { label: 'Revenue', current: '₹12,34,500', last: '₹9,87,600', better: true },
                          { label: 'Errors', current: '0', last: '1', better: true },
                        ].map((item, i) => (
                          <div key={item.label} className="text-center p-3 rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                            <p className="text-lg font-bold text-slate-800">{item.current}</p>
                            <p className={`text-xs flex items-center justify-center gap-1 ${
                              item.better ? 'text-emerald-500' : 'text-amber-500'
                            }`}>
                              {item.better ? <TrendingUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              vs {item.last}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════════════════════
              CONFIGURATION + ACTIVITY LOG (side by side on desktop)
              ═══════════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-500" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-5">
                  {/* Step toggles */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pipeline Steps</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {PIPELINE_STEPS.map((step, i) => (
                        <div key={step.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <span className="text-sm text-slate-700 flex items-center gap-2">
                            <span>{step.emoji}</span>
                            <span>{step.name}</span>
                          </span>
                          <Switch
                            checked={enabledSteps[i]}
                            onCheckedChange={() => toggleStep(i)}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Schedule */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Schedule</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['one-time', 'daily', 'weekly', 'custom'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setSchedule(s)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            schedule === s
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s === 'one-time' ? 'One-time' : s === 'daily' ? 'Daily' : s === 'weekly' ? 'Weekly' : 'Custom'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Notifications */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notifications</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" /> Email
                        </span>
                        <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-slate-400" /> WhatsApp
                        </span>
                        <Switch checked={notifWhatsapp} onCheckedChange={setNotifWhatsapp} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 flex items-center gap-2">
                          <Bell className="h-4 w-4 text-slate-400" /> In-app
                        </span>
                        <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Auto-approve & Escalation */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rules</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm text-slate-700 font-medium">Auto-approve threshold</p>
                          <p className="text-xs text-slate-500">Auto-prepare returns under {fmtINR(autoApproveThreshold)}</p>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-600 border-0">
                          {fmtINR(autoApproveThreshold)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" /> Alert on return errors
                        </span>
                        <Switch checked={escalationErrors} onCheckedChange={setEscalationErrors} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Activity Log
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLogFilter(null)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                          logFilter === null ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        All
                      </button>
                      {PIPELINE_STEPS.slice(0, 5).map((step, i) => (
                        <button
                          key={step.id}
                          onClick={() => setLogFilter(logFilter === step.id ? null : step.id)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            logFilter === step.id ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {step.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-96">
                    {filteredLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Cpu className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No activity yet</p>
                        <p className="text-xs mt-1">Run the pipeline to see live logs</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <AnimatePresence>
                          {filteredLogs.map((entry, i) => (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className={`flex items-start gap-3 py-2 px-3 rounded-lg text-xs ${
                                entry.type === 'success' ? 'bg-emerald-50/50' :
                                entry.type === 'warning' ? 'bg-amber-50/50' :
                                entry.type === 'error' ? 'bg-red-50/50' :
                                'bg-slate-50/50'
                              }`}
                            >
                              <span className="text-slate-400 font-mono flex-shrink-0 mt-0.5">{entry.timestamp}</span>
                              <span className={`flex-shrink-0 mt-0.5 ${
                                entry.type === 'success' ? 'text-emerald-500' :
                                entry.type === 'warning' ? 'text-amber-500' :
                                entry.type === 'error' ? 'text-red-500' :
                                'text-slate-400'
                              }`}>
                                {entry.type === 'success' ? '✓' : entry.type === 'warning' ? '⚠' : entry.type === 'error' ? '✕' : '›'}
                              </span>
                              <span className={`${
                                entry.type === 'success' ? 'text-emerald-700' :
                                entry.type === 'warning' ? 'text-amber-700' :
                                entry.type === 'error' ? 'text-red-700' :
                                'text-slate-600'
                              }`}>
                                {entry.message}
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              LAST 5 RUNS (always visible)
              ═══════════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Recent Runs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Date</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Start</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Duration</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Tasks</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Revenue</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_RUN_HISTORY.map((run, i) => (
                        <motion.tr
                          key={run.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + i * 0.05 }}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td className="py-2.5 px-3 text-slate-700 font-mono">{run.date}</td>
                          <td className="py-2.5 px-3 text-slate-600">{run.startTime}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono">{run.duration}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">{run.tasks}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">{run.revenue}</td>
                          <td className="py-2.5 px-3">
                            <Badge className={`text-[10px] ${
                              run.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-0' :
                              run.status === 'partial' ? 'bg-amber-50 text-amber-600 border-0' :
                              'bg-red-50 text-red-600 border-0'
                            }`}>
                              {run.status === 'completed' ? 'Completed' : run.status === 'partial' ? 'Partial' : 'Failed'}
                            </Badge>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </ScrollArea>

      {/* ═══════════════════════════════════════════════════════════════════
          CONFIG DIALOG (mobile-friendly)
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-500" />
              Pipeline Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Step toggles */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Steps to Include</p>
              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={step.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <span className="text-sm text-slate-700 flex items-center gap-2">
                      <span>{step.emoji}</span>
                      <span>{step.name}</span>
                    </span>
                    <Switch checked={enabledSteps[i]} onCheckedChange={() => toggleStep(i)} className="data-[state=checked]:bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            {/* Schedule */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Schedule</p>
              <div className="grid grid-cols-2 gap-2">
                {(['one-time', 'daily', 'weekly', 'custom'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSchedule(s)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      schedule === s
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {s === 'one-time' ? 'One-time' : s === 'daily' ? 'Daily' : s === 'weekly' ? 'Weekly' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            {/* Notifications */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notifications</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> Email</span>
                  <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-slate-400" /> WhatsApp</span>
                  <Switch checked={notifWhatsapp} onCheckedChange={setNotifWhatsapp} className="data-[state=checked]:bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex items-center gap-2"><Bell className="h-4 w-4 text-slate-400" /> In-app</span>
                  <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-500" />
                </div>
              </div>
            </div>
            <Separator />
            {/* Rules */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rules</p>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700 font-medium">Auto-approve threshold</p>
                  <p className="text-xs text-slate-500 mt-0.5">Auto-prepare returns under {fmtINR(autoApproveThreshold)}</p>
                  <div className="flex gap-2 mt-2">
                    {[50000, 100000, 200000, 500000].map(val => (
                      <button
                        key={val}
                        onClick={() => setAutoApproveThreshold(val)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          autoApproveThreshold === val
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                      >
                        {fmtINR(val)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" /> Alert me if any return has errors
                  </span>
                  <Switch checked={escalationErrors} onCheckedChange={setEscalationErrors} className="data-[state=checked]:bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          RUN HISTORY DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              Run History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {DEMO_RUN_HISTORY.map((run, i) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800 text-sm">{run.date}</span>
                  <Badge className={`text-[10px] ${
                    run.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-0' :
                    run.status === 'partial' ? 'bg-amber-50 text-amber-600 border-0' :
                    'bg-red-50 text-red-600 border-0'
                  }`}>
                    {run.status === 'completed' ? 'Completed' : run.status === 'partial' ? 'Partial' : 'Failed'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Start</span>
                    <p className="text-slate-700 font-medium">{run.startTime}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Duration</span>
                    <p className="text-slate-700 font-medium font-mono">{run.duration}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Tasks</span>
                    <p className="text-slate-700 font-medium">{run.tasks}</p>
                  </div>
                </div>
                {run.revenue !== '—' && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">Revenue Processed: </span>
                    <span className="text-xs text-emerald-600 font-semibold">{run.revenue}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  )
}
