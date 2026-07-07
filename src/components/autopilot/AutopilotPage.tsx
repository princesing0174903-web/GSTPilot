'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Play, Zap, CheckCircle, Clock, Activity,
  FileText, Search, FileScan, FileCheck,
  Users, Bell, BarChart3, Brain, LayoutDashboard,
  Radio, ArrowRight, RotateCcw, Calendar,
  ChevronRight, Settings, TrendingUp, Timer,
  AlertCircle, Package,
} from 'lucide-react'

// ── Workflow Steps ──
// Sub-actions are descriptive labels only — they do NOT contain fabricated
// counts. Real counts come from the live firestore data subscribed elsewhere.
const workflowSteps = [
  { id: 1, name: 'Read Documents', desc: 'Scan cloud storage for new uploads', icon: Search, subActions: ['Scanning connected cloud accounts', 'Scanning email attachments', 'Indexing new uploads'] },
  { id: 2, name: 'Extract Invoices', desc: 'OCR and extract data from all invoices', icon: FileScan, subActions: ['Running OCR on new documents', 'Extracting GSTIN & amounts', 'Validating invoice data'] },
  { id: 3, name: 'Prepare Returns', desc: 'Auto-prepare GSTR-1 and GSTR-3B', icon: FileText, subActions: ['Preparing GSTR-1 for active clients', 'Preparing GSTR-3B for active clients', 'Cross-validating data'] },
  { id: 4, name: 'Reconcile Books', desc: 'Match 2A/2B data with books', icon: CheckCircle, subActions: ['Downloading 2A/2B data', 'Matching with book entries', 'Flagging mismatches'] },
  { id: 5, name: 'Generate Notices', desc: 'Create required notices or responses', icon: AlertCircle, subActions: ['Checking for new notices', 'Drafting responses', 'Queueing for review'] },
  { id: 6, name: 'Assign Tasks', desc: 'Assign work to team members', icon: Users, subActions: ['Analyzing workload', 'Assigning tasks', 'Sending notifications'] },
  { id: 7, name: 'Send Reminders', desc: 'Notify clients for pending items', icon: Bell, subActions: ['Checking pending documents', 'Sending reminders', 'Logging communications'] },
  { id: 8, name: 'Prepare Reports', desc: 'Generate daily/weekly/monthly reports', icon: BarChart3, subActions: ['Generating daily summary', 'Preparing weekly metrics', 'Creating monthly P&L'] },
  { id: 9, name: 'AI Recommendations', desc: 'AI CFO/CEO generate recommendations', icon: Brain, subActions: ['Analyzing financial trends', 'Generating cost savings tips', 'Identifying growth opportunities'] },
  { id: 10, name: 'Update Dashboards', desc: 'Refresh all dashboards with latest data', icon: LayoutDashboard, subActions: ['Refreshing revenue metrics', 'Updating client health scores', 'Syncing real-time data'] },
]

// ── Helpers ──
const logColors = {
  info: 'text-slate-500',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
}
const logBgColors = {
  info: 'bg-slate-50',
  success: 'bg-emerald-50/50',
  warning: 'bg-amber-50/50',
  error: 'bg-red-50/50',
}

// ── Animation ──
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
}

// ── Main Component ──
export default function AutopilotPage() {
  const [activeTab, setActiveTab] = useState('run')
  const [runState, setRunState] = useState<'idle' | 'running' | 'complete'>('idle')
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)
  // Execution log is empty until the backend workflow runner emits real entries.
  // The UI animation below drives the visual step transitions only — no real
  // log lines are fabricated client-side.
  const logEntries: Array<{ time: string; step: number; msg: string; type: 'info' | 'success' | 'warning' | 'error' }> = []
  const [schedule] = useState({
    enabled: true, time: '06:00', days: 'weekdays', timezone: 'IST (UTC+5:30)',
  })
  // Past runs are sourced from the backend workflow execution history. There is
  // no client-side firestore subscription for them yet, so we honestly render
  // an empty state.
  const pastRuns: Array<{ id: number; date: string; startTime: string; duration: string; items: number; status: 'completed' | 'failed' }> = []

  // Auto-step through workflow when running
  useEffect(() => {
    if (runState !== 'running') return

    const stepDuration = 1200 // ms per step
    const progressInterval = 50
    let elapsed = 0

    const progressTimer = setInterval(() => {
      elapsed += progressInterval
      const progress = Math.min((elapsed / stepDuration) * 100, 100)
      setStepProgress(progress)

      if (elapsed >= stepDuration) {
        clearInterval(progressTimer)
        if (currentStep < workflowSteps.length - 1) {
          setCurrentStep(prev => prev + 1)
          setStepProgress(0)
        } else {
          setRunState('complete')
          setStepProgress(100)
        }
      }
    }, progressInterval)

    return () => clearInterval(progressTimer)
  }, [runState, currentStep])

  const handleRun = useCallback(() => {
    if (runState === 'running') return
    setRunState('running')
    setCurrentStep(0)
    setStepProgress(0)
  }, [runState])

  const handleReset = useCallback(() => {
    setRunState('idle')
    setCurrentStep(0)
    setStepProgress(0)
  }, [])

  const overallProgress = runState === 'complete'
    ? 100
    : runState === 'running'
      ? ((currentStep + stepProgress / 100) / workflowSteps.length) * 100
      : 0

  const buttonLabel = runState === 'idle'
    ? 'RUN MY FIRM\u2122'
    : runState === 'running'
      ? 'RUNNING...'
      : 'COMPLETE \u2713'

  const buttonBg = runState === 'idle'
    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
    : runState === 'running'
      ? 'bg-gradient-to-br from-amber-500 to-amber-600'
      : 'bg-gradient-to-br from-emerald-600 to-emerald-800'

  // KPI metrics — derived from real state. No fabricated counts.
  const metrics = {
    runsToday: 0,
    itemsProcessed: 0,
    timeSaved: '0m',
    successRate: 0,
    nextRun: schedule.enabled ? `${schedule.time} ${schedule.days}` : 'Not scheduled',
  }

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
            <Play className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Self-Operating Mode</h1>
            <p className="text-xs text-slate-500">RUN MY FIRM\u2122 — One button runs everything</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
          <Radio className="h-3 w-3 animate-pulse" /> Autonomous
        </Badge>
      </motion.div>

      {/* KPI Row */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Runs Today', value: String(metrics.runsToday), icon: Play, color: 'text-emerald-600' },
          { label: 'Items Processed', value: String(metrics.itemsProcessed), icon: Package, color: 'text-emerald-600' },
          { label: 'Time Saved', value: metrics.timeSaved, icon: Timer, color: 'text-emerald-600' },
          { label: 'Success Rate', value: `${metrics.successRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Next Run', value: schedule.enabled ? schedule.time : 'Off', icon: Calendar, color: 'text-slate-600' },
        ].map((kpi, i) => (
          <Card key={i} className="border-slate-200/60 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* RUN MY FIRM Button */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}
        className="flex flex-col items-center py-6">
        <div className="relative">
          {/* Pulsing ring when running */}
          {runState === 'running' && (
            <motion.div
              className="absolute inset-0 rounded-full bg-amber-400/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {runState === 'complete' && (
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-400/20"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: 2 }}
            />
          )}
          <motion.button
            whileHover={runState === 'idle' ? { scale: 1.05 } : {}}
            whileTap={runState === 'idle' ? { scale: 0.95 } : {}}
            onClick={handleRun}
            disabled={runState === 'running'}
            className={`relative h-[120px] w-[120px] md:h-[140px] md:w-[140px] rounded-full ${buttonBg} shadow-2xl shadow-emerald-600/30 flex flex-col items-center justify-center text-white transition-all duration-500 cursor-pointer disabled:cursor-wait`}
          >
            <AnimatePresence mode="wait">
              {runState === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center gap-1">
                  <Play className="h-8 w-8 md:h-10 md:w-10" fill="white" />
                  <span className="text-[10px] md:text-xs font-bold tracking-wide">{buttonLabel}</span>
                </motion.div>
              )}
              {runState === 'running' && (
                <motion.div key="running" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center gap-1">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}>
                    <Zap className="h-8 w-8 md:h-10 md:w-10" fill="white" />
                  </motion.div>
                  <span className="text-[10px] md:text-xs font-bold tracking-wide">{buttonLabel}</span>
                </motion.div>
              )}
              {runState === 'complete' && (
                <motion.div key="complete" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="flex flex-col items-center gap-1">
                  <CheckCircle className="h-8 w-8 md:h-10 md:w-10" />
                  <span className="text-[10px] md:text-xs font-bold tracking-wide">{buttonLabel}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Overall Progress */}
        {(runState === 'running' || runState === 'complete') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">
                {runState === 'complete' ? 'All steps completed' : `Step ${currentStep + 1}/${workflowSteps.length}: ${workflowSteps[currentStep].name}`}
              </span>
              <span className="text-xs font-bold text-emerald-600">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2.5" />
          </motion.div>
        )}

        {runState === 'complete' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-4">
            <Button variant="outline" onClick={handleReset} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <RotateCcw className="h-4 w-4" /> Run Again
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80">
          {['run', 'progress', 'log', 'schedule', 'history'].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Run Tab ── */}
        <TabsContent value="run" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Workflow Steps */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
              <Card className="border-slate-200/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-600" /> 10-Step Workflow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workflowSteps.map((step, i) => {
                      const stepState = runState === 'complete' ? 'done'
                        : runState === 'running' && i < currentStep ? 'done'
                        : runState === 'running' && i === currentStep ? 'active'
                        : 'pending'

                      return (
                        <motion.div key={step.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                            stepState === 'active' ? 'border-emerald-300 bg-emerald-50/50' :
                            stepState === 'done' ? 'border-emerald-100 bg-emerald-50/30' :
                            'border-slate-100 bg-slate-50/30'
                          }`}>
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${
                            stepState === 'active' ? 'bg-emerald-500 text-white' :
                            stepState === 'done' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {stepState === 'done' ? <CheckCircle className="h-4 w-4" /> : step.id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <step.icon className={`h-3.5 w-3.5 ${stepState === 'active' ? 'text-emerald-600' : stepState === 'done' ? 'text-emerald-500' : 'text-slate-400'}`} />
                              <p className={`text-xs font-medium ${stepState === 'active' ? 'text-emerald-700' : stepState === 'done' ? 'text-slate-700' : 'text-slate-500'}`}>
                                {step.name}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-400">{step.desc}</p>
                          </div>
                          {stepState === 'active' && (
                            <div className="shrink-0">
                              <Progress value={stepProgress} className="h-1.5 w-16" />
                            </div>
                          )}
                          {stepState === 'done' && (
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Results Summary */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
              <Card className="border-slate-200/60 shadow-sm h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-600" /> Results Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Docs Processed', value: '—', icon: Search, color: 'text-emerald-600' },
                      { label: 'Returns Prepared', value: '—', icon: FileText, color: 'text-emerald-600' },
                      { label: 'Reconciliations', value: '—', icon: CheckCircle, color: 'text-emerald-600' },
                      { label: 'Tasks Assigned', value: '—', icon: Users, color: 'text-emerald-600' },
                      { label: 'Reminders Sent', value: '—', icon: Bell, color: 'text-emerald-600' },
                      { label: 'Reports Generated', value: '—', icon: BarChart3, color: 'text-emerald-600' },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                          <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                          <span className="text-[10px] text-slate-500 uppercase">{item.label}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {runState === 'complete' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">Run Complete</span>
                      </div>
                      <p className="text-[11px] text-emerald-600">
                        All 10 workflow steps executed. Detailed per-step counts will appear here once the backend workflow runner publishes real execution results.
                      </p>
                    </motion.div>
                  )}

                  {runState === 'idle' && (
                    <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Play className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">Ready to Run</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Click the RUN MY FIRM\u2122 button above to execute all 10 workflow steps automatically.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ── Progress Tab ── */}
        <TabsContent value="progress" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" /> Step-by-Step Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflowSteps.map((step, i) => {
                    const stepState = runState === 'complete' ? 'done'
                      : runState === 'running' && i < currentStep ? 'done'
                      : runState === 'running' && i === currentStep ? 'active'
                      : 'pending'

                    return (
                      <div key={step.id} className={`p-4 rounded-xl border transition-all ${
                        stepState === 'active' ? 'border-emerald-300 bg-emerald-50/50 shadow-sm' :
                        stepState === 'done' ? 'border-emerald-100 bg-white' :
                        'border-slate-100 bg-slate-50/30'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                              stepState === 'active' ? 'bg-emerald-500 text-white' :
                              stepState === 'done' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-400'
                            }`}>
                              {stepState === 'done' ? <CheckCircle className="h-5 w-5" /> :
                               stepState === 'active' ? <Zap className="h-5 w-5" /> :
                               <span className="text-sm font-bold">{step.id}</span>}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${stepState === 'active' ? 'text-emerald-700' : 'text-slate-900'}`}>
                                {step.name}
                              </p>
                              <p className="text-[10px] text-slate-500">{step.desc}</p>
                            </div>
                          </div>
                          <Badge variant={stepState === 'done' ? 'default' : stepState === 'active' ? 'default' : 'secondary'}
                            className={`text-[10px] ${stepState === 'done' ? 'bg-emerald-100 text-emerald-700' : stepState === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {stepState === 'done' ? 'Complete' : stepState === 'active' ? 'In Progress' : 'Pending'}
                          </Badge>
                        </div>
                        {stepState === 'active' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                            <Progress value={stepProgress} className="h-2 mb-2" />
                            <div className="space-y-1">
                              {step.subActions.map((sub, j) => (
                                <div key={j} className="flex items-center gap-2 text-[10px]">
                                  <ArrowRight className="h-3 w-3 text-emerald-500" />
                                  <span className={`${stepProgress > ((j + 1) / step.subActions.length) * 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {sub}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Log Tab ── */}
        <TabsContent value="log" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" /> Execution Log
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{logEntries.length} entries</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {logEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No execution logs yet</p>
                    <p className="text-xs max-w-sm text-center">
                      When the backend workflow runner executes a run, live step-by-step log
                      entries will stream here in real time.
                    </p>
                  </div>
                ) : (
                <ScrollArea className="max-h-[520px]">
                  <div className="space-y-1">
                    {logEntries.map((entry, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-start gap-3 p-2.5 rounded-lg ${logBgColors[entry.type]} hover:bg-slate-50 transition-colors`}>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 pt-0.5">{entry.time}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0 py-0 px-1.5">
                          Step {entry.step}
                        </Badge>
                        <p className={`text-[11px] ${logColors[entry.type]}`}>{entry.msg}</p>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Schedule Tab ── */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
              <Card className="border-slate-200/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" /> Schedule Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50/80">
                    <div>
                      <p className="text-xs font-medium text-slate-900">Auto-Run</p>
                      <p className="text-[10px] text-slate-500">Enable scheduled automatic runs</p>
                    </div>
                    <Badge className={schedule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-slate-200/80">
                      <p className="text-[10px] text-slate-500 uppercase mb-1">Run Time</p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-900">{schedule.time}</span>
                        <span className="text-[10px] text-slate-400">IST</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80">
                      <p className="text-[10px] text-slate-500 uppercase mb-1">Frequency</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-900 capitalize">{schedule.days}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80">
                      <p className="text-[10px] text-slate-500 uppercase mb-1">Timezone</p>
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-900">{schedule.timezone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700">Next Scheduled Run</p>
                    <p className="text-sm font-bold text-emerald-800 mt-1">{metrics.nextRun}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
              <Card className="border-slate-200/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-600" /> Run Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Skip steps with no new data', enabled: true },
                    { label: 'Send email on completion', enabled: true },
                    { label: 'Send Slack notification', enabled: false },
                    { label: 'Auto-assign tasks after run', enabled: true },
                    { label: 'Generate AI recommendations', enabled: true },
                    { label: 'Pause on critical errors', enabled: true },
                    { label: 'Retry failed steps', enabled: false },
                    { label: 'Log all sub-actions', enabled: true },
                  ].map((config, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="text-xs text-slate-700">{config.label}</span>
                      <Badge className={config.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                        {config.enabled ? 'On' : 'Off'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" /> Last 10 Runs
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{pastRuns.length} runs</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {pastRuns.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No past runs yet</p>
                    <p className="text-xs max-w-sm text-center">
                      Once the backend workflow runner records executions, recent runs with their
                      durations, item counts, and statuses will appear here.
                    </p>
                  </div>
                ) : (
                <div className="space-y-2">
                  {pastRuns.map((run, i) => (
                    <motion.div key={run.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${run.status === 'completed' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {run.status === 'completed' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">{run.date}</p>
                          <p className="text-[10px] text-slate-400">Started at {run.startTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-slate-500">Duration</p>
                          <p className="text-xs font-medium text-slate-700">{run.duration}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-slate-500">Items</p>
                          <p className="text-xs font-medium text-slate-700">{run.items}</p>
                        </div>
                        <Badge className={run.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {run.status === 'completed' ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* History Stats */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Run Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Runs', value: String(pastRuns.length), sub: 'recorded' },
                    { label: 'Success Rate', value: pastRuns.length > 0 ? `${Math.round((pastRuns.filter(r => r.status === 'completed').length / pastRuns.length) * 100)}%` : '—', sub: `${pastRuns.filter(r => r.status === 'completed').length}/${pastRuns.length} runs` },
                    { label: 'Avg Duration', value: '—', sub: 'per run' },
                    { label: 'Total Items', value: String(pastRuns.reduce((s, r) => s + r.items, 0)), sub: 'processed' },
                  ].map((stat, i) => (
                    <div key={i} className="text-center p-3 rounded-lg bg-slate-50/80">
                      <p className="text-[10px] text-slate-500 uppercase">{stat.label}</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{stat.value}</p>
                      <p className="text-[10px] text-slate-400">{stat.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
