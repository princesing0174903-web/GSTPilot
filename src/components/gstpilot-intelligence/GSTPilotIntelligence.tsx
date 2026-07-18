'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useApp } from '@/contexts/AppContext'
import {
  Sparkles,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Brain,
  Zap,
  FileText,
  AlertTriangle,
  CreditCard,
  Bell,
  Activity,
  Rocket,
  TrendingUp,
  Users,
  Briefcase,
  Wallet,
  BookOpen,
  Banknote,
  Package,
  ShieldCheck,
  Network,
  Settings,
  Trash2,
  Square,
} from 'lucide-react'

// ═════════════════════════════════════════════════════════════════════════════
// GSTPilot Intelligence™ — Global Floating AI Assistant
// "The AI Brain of Your Business."
// Jarvis + ChatGPT + Palantir + Cursor for Indian CAs and Businesses
// ═════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  actions?: ActionSuggestion[]
  isTyping?: boolean
  // V16 structured response fields
  insights?: Array<{ text: string; tone: 'positive' | 'neutral' | 'warning' }>
  sources?: Array<{ name: string; count: number; icon?: string }>
  thinkingSteps?: Array<{ label: string; duration: number }>
}

interface ActionSuggestion {
  type: 'navigate' | 'task' | 'reminder' | 'report' | 'create_task' | 'send_reminder' | 'generate_report' | 'execute_workflow'
  label: string
  title?: string
  description?: string
  view?: string
  icon?: string
  payload?: Record<string, unknown>
}

interface LiveStats {
  totalClients: number
  pendingReturns: number
  pendingCollections: number
  complianceScore: number
  atRiskClients: number
  unreadNotifications: number
}

// --- Helpers ---------------------------------------------------------------

const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`

const SUGGESTED_QUESTIONS = [
  { label: 'Show pending returns', icon: FileText, color: 'text-amber-600' },
  { label: 'Which clients are risky?', icon: AlertTriangle, color: 'text-red-600' },
  { label: 'What revenue will I make next month?', icon: TrendingUp, color: 'text-emerald-600' },
  { label: 'Run my firm', icon: Rocket, color: 'text-violet-600' },
  { label: 'Run my business', icon: Zap, color: 'text-cyan-600' },
  { label: 'Who is overloaded?', icon: Users, color: 'text-orange-600' },
  { label: 'Why did collections drop?', icon: Wallet, color: 'text-rose-600' },
  { label: 'Open War Room', icon: Activity, color: 'text-emerald-700' },
]

const MODULE_SHORTCUTS = [
  { label: 'GST', view: 'returns', icon: FileText },
  { label: 'Accounting', view: 'accounting', icon: BookOpen },
  { label: 'Payroll', view: 'payroll', icon: Wallet },
  { label: 'CRM', view: 'crm', icon: Briefcase },
  { label: 'Banking', view: 'banking', icon: Banknote },
  { label: 'Payments', view: 'payments', icon: CreditCard },
  { label: 'Inventory', view: 'inventory', icon: Package },
  { label: 'Compliance', view: 'roc-compliance', icon: ShieldCheck },
  { label: 'Business Graph', view: 'business-graph', icon: Network },
  { label: 'Predictions', view: 'ai-predictions', icon: TrendingUp },
]

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  AlertTriangle,
  CreditCard,
  Bell,
  Activity,
  Rocket,
  Brain,
  Zap,
  TrendingUp,
  Users,
  Wallet,
}

// --- Animated Particles (around the orb) -----------------------------------

function OrbParticles({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        angle: (i / 12) * Math.PI * 2,
        radius: 38 + Math.random() * 18,
        size: 2 + Math.random() * 3,
        duration: 3 + Math.random() * 2,
        delay: Math.random() * 2,
      })),
    []
  )

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            boxShadow: '0 0 8px rgba(37,99,235, 0.8)',
            left: '50%',
            top: '50%',
          }}
          animate={
            active
              ? {
                  x: [
                    Math.cos(p.angle) * 20,
                    Math.cos(p.angle) * p.radius,
                    Math.cos(p.angle + 0.3) * 20,
                  ],
                  y: [
                    Math.sin(p.angle) * 20,
                    Math.sin(p.angle) * p.radius,
                    Math.sin(p.angle + 0.3) * 20,
                  ],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }
              : { opacity: 0 }
          }
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        />
      ))}
    </div>
  )
}

// --- Floating Orb Button (draggable) ---------------------------------------

interface OrbProps {
  onClick: () => void
  isOpen: boolean
  isListening: boolean
  isThinking: boolean
}

function FloatingOrb({ onClick, isOpen, isListening, isThinking }: OrbProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const orbRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setHasMoved(false)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setHasMoved(true)
    setPosition({
      x: dragStart.current.posX + dx,
      y: dragStart.current.posY + dy,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!hasMoved) onClick()
  }

  return (
    <motion.div
      ref={orbRef}
      className="fixed z-[9998] cursor-grab active:cursor-grabbing"
      style={{
        right: '24px',
        bottom: '24px',
        x: position.x,
        y: position.y,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      title="GSTPilot Intelligence™ — Ctrl+K"
    >
      <div className="relative h-16 w-16">
        {/* Outer pulsing glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(37,99,235,0.4) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.6, 0.2, 0.6],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        />

        {/* Breathing aura */}
        <motion.div
          className="absolute -inset-2 rounded-full blur-md"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #3B82F6, #3b82f6)',
            opacity: 0.5,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        />

        {/* Animated particles */}
        <OrbParticles active={!isOpen || isListening || isThinking} />

        {/* Main orb with gradient */}
        <motion.div
          className="relative h-16 w-16 rounded-full overflow-hidden"
          style={{
            background:
              'conic-gradient(from 0deg, #2563EB, #3B82F6, #3b82f6, #3B82F6, #2563EB)',
            boxShadow:
              '0 8px 32px rgba(37,99,235, 0.5), 0 0 0 2px rgba(255,255,255,0.2) inset, 0 0 20px rgba(59,130,246, 0.4) inset',
          }}
          animate={{
            rotate: isOpen ? 0 : 360,
          }}
          transition={{
            duration: 8,
            repeat: isOpen ? 0 : Infinity,
            ease: 'linear' as const,
          }}
        >
          {/* Inner glossy sphere */}
          <div
            className="absolute inset-1.5 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
            }}
          />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isThinking ? (
                <motion.div
                  key="thinking"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                >
                  <Brain className="h-6 w-6 text-white drop-shadow-lg" />
                </motion.div>
              ) : isListening ? (
                <motion.div
                  key="listening"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Mic className="h-6 w-6 text-white drop-shadow-lg" />
                </motion.div>
              ) : isOpen ? (
                <motion.div
                  key="open"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                >
                  <Sparkles className="h-6 w-6 text-white drop-shadow-lg" />
                </motion.div>
              ) : (
                <motion.div
                  key="closed"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                >
                  <Sparkles className="h-6 w-6 text-white drop-shadow-lg" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Listening pulse rings */}
          {isListening && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' as const }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' as const, delay: 0.4 }}
              />
            </>
          )}
        </motion.div>

        {/* Tooltip label */}
        <motion.div
          className="absolute right-full top-1/2 -translate-y-1/2 mr-3 pointer-events-none whitespace-nowrap"
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
        >
          <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl border border-white/10">
            GSTPilot Oracle™
            <span className="block text-[10px] text-emerald-400 font-normal">Ctrl + K</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// --- AI Thinking Indicator (V16 — Perplexity-style multi-step) ----------------

function ThinkingIndicator({ steps }: { steps?: Array<{ label: string; duration: number }> }) {
  const [currentStep, setCurrentStep] = useState(0)
  const stepLabels = steps && steps.length > 0
    ? steps.map(s => s.label)
    : ['Thinking...', 'Generating answer...']

  useEffect(() => {
    if (!steps || steps.length === 0) return
    let stepIdx = 0
    const runStep = () => {
      if (stepIdx >= steps.length - 1) return
      setTimeout(() => {
        stepIdx++
        setCurrentStep(stepIdx)
        runStep()
      }, steps[stepIdx]?.duration || 500)
    }
    runStep()
    return () => setCurrentStep(0)
  }, [steps])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5"
    >
      <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
        <Brain className="h-4 w-4 text-white animate-pulse" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-sm glass-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut' as const,
                  }}
                />
              ))}
            </div>
            <motion.span
              key={currentStep}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-medium accent-text"
            >
              {stepLabels[currentStep] || stepLabels[0]}
            </motion.span>
          </div>
          {/* Step progress dots */}
          {stepLabels.length > 1 && (
            <div className="mt-2 flex gap-1">
              {stepLabels.map((_, i) => (
                <div
                  key={i}
                  className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                    i <= currentStep ? 'accent-gradient' : 'bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// --- Typing Animation Hook -------------------------------------------------

function useTypewriter(text: string, enabled: boolean, speed = 12) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setDone(true)
      return
    }
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, enabled, speed])

  return { displayed, done }
}

// --- Markdown-ish renderer (lightweight) -----------------------------------

function renderMarkdown(text: string) {
  // Split by lines, render basic formatting
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  lines.forEach((line, idx) => {
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2" />)
      return
    }
    // Headings (## or #)
    if (line.startsWith('## ')) {
      elements.push(
        <div key={idx} className="font-bold text-sm mt-2 mb-1 text-slate-900 dark:text-slate-100">
          {line.replace(/^##\s+/, '')}
        </div>
      )
      return
    }
    if (line.startsWith('# ')) {
      elements.push(
        <div key={idx} className="font-bold text-base mt-2 mb-1 text-slate-900 dark:text-slate-100">
          {line.replace(/^#\s+/, '')}
        </div>
      )
      return
    }
    // Bullet points
    if (line.startsWith('• ') || line.startsWith('- ')) {
      const content = line.replace(/^[•-]\s+/, '')
      elements.push(
        <div key={idx} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-emerald-500 mt-0.5">•</span>
          <span className="flex-1">{renderInline(content)}</span>
        </div>
      )
      return
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex gap-2 text-sm leading-relaxed">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 min-w-[1.2rem]">{numMatch[1]}.</span>
          <span className="flex-1">{renderInline(numMatch[2])}</span>
        </div>
      )
      return
    }
    // Regular paragraph
    elements.push(
      <div key={idx} className="text-sm leading-relaxed">
        {renderInline(line)}
      </div>
    )
  })
  return elements
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** and `code`
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-bold text-slate-900 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length > 0 ? parts : text
}

// --- Message Bubble --------------------------------------------------------

interface MessageBubbleProps {
  message: Message
  onAction: (action: ActionSuggestion) => void
  voiceEnabled: boolean
}

function MessageBubble({ message, onAction, voiceEnabled }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const { displayed, done } = useTypewriter(
    message.content,
    !isUser && message.isTyping ? true : false,
    8
  )

  // Speak the response when voice is enabled and message arrives
  useEffect(() => {
    if (!isUser && voiceEnabled && message.content && !message.isTyping) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(message.content.replace(/[*#`•]/g, ''))
        utter.rate = 1
        utter.pitch = 1
        utter.lang = 'en-IN'
        try {
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(utter)
        } catch {
          // ignore
        }
      }
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [message.id])

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-500 to-cyan-600 text-white px-4 py-2.5 shadow-lg">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2.5"
    >
      <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
        <Brain className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 max-w-[88%]">
        {/* V16 Answer card — Obsidian Black 2.0 glass */}
        <div className="rounded-2xl rounded-tl-sm glass-surface px-4 py-3">
          {/* Answer section */}
          <div className="text-zinc-200 space-y-0.5">
            {renderMarkdown(displayed)}
            {!done && <span className="inline-block w-1.5 h-3.5 bg-emerald-500 ml-0.5 animate-pulse" />}
          </div>
        </div>

        {/* V16 Insights section */}
        {done && message.insights && message.insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-2 rounded-2xl glass-surface px-4 py-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Insights</p>
            <div className="space-y-1">
              {message.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    insight.tone === 'warning' ? 'bg-amber-400' :
                    insight.tone === 'positive' ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`} />
                  <span className="text-xs text-zinc-300 leading-relaxed">{insight.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* V16 Sources section */}
        {done && message.sources && message.sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2 flex flex-wrap items-center gap-1.5"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources:</span>
            {message.sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-zinc-400"
              >
                {src.name}
                {src.count > 0 && <span className="accent-text">{src.count}</span>}
              </span>
            ))}
          </motion.div>
        )}

        {/* V16 Actions section */}
        {done && message.actions && message.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {message.actions.map((action, idx) => {
              const Icon = ICON_MAP[action.icon || ''] || Zap
              const label = action.label || action.title || 'Action'
              return (
                <button
                  key={idx}
                  onClick={() => onAction(action)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg accent-gradient-soft accent-text border border-white/[0.08] hover:bg-white/[0.06] transition-colors hover-lift"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              )
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// --- Live Stats Bar --------------------------------------------------------

function LiveStatsBar({ stats }: { stats: LiveStats | null }) {
  if (!stats) return null
  const items = [
    { label: 'Clients', value: stats.totalClients, icon: Users, color: 'text-emerald-600' },
    { label: 'Pending', value: stats.pendingReturns, icon: FileText, color: 'text-amber-600' },
    { label: 'Collections', value: formatINR(stats.pendingCollections), icon: CreditCard, color: 'text-cyan-600' },
    { label: 'Compliance', value: `${stats.complianceScore}%`, icon: ShieldCheck, color: 'text-violet-600' },
    { label: 'At Risk', value: stats.atRiskClients, icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Alerts', value: stats.unreadNotifications, icon: Bell, color: 'text-orange-600' },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50"
        >
          <item.icon className={`h-3 w-3 ${item.color}`} />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.value}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// --- Command Center Panel --------------------------------------------------

interface CommandCenterProps {
  isOpen: boolean
  isFullscreen: boolean
  isListening: boolean
  setIsListening: (v: boolean) => void
  isThinking: boolean
  setIsThinking: (v: boolean) => void
  onClose: () => void
  onToggleFullscreen: () => void
  onMinimize: () => void
}

function CommandCenter({
  isOpen,
  isFullscreen,
  isListening,
  setIsListening,
  isThinking,
  setIsThinking,
  onClose,
  onToggleFullscreen,
  onMinimize,
}: CommandCenterProps) {
  const { setCurrentView } = useApp()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "**GSTPilot Oracle™**\n\nThe Financial Brain of Your Business.\n\nI'm connected to your live data — clients, invoices, returns, payments, predictions, and priorities across every module.\n\nAsk me anything, or tap a suggestion below.",
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen, isFullscreen])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-IN'
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
        // Auto-send after voice input
        setTimeout(() => handleSend(transcript), 200)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch {
        // already started
      }
    }
  }

  const [thinkingSteps, setThinkingSteps] = useState<Array<{ label: string; duration: number }>>([])

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isThinking) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsThinking(true)
    // Start with default thinking steps; will update when API responds
    setThinkingSteps([
      { label: 'Thinking...', duration: 400 },
      { label: 'Generating answer...', duration: 500 },
    ])
    historyRef.current.push({ role: 'user', content: text })

    try {
      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          context: '', // Live context is gathered server-side
          conversationHistory: historyRef.current.slice(-6),
        }),
      })
      const data = await res.json()

      // Update thinking steps from API response (V16)
      if (data.thinkingSteps && data.thinkingSteps.length > 0) {
        setThinkingSteps(data.thinkingSteps)
      }

      // Mark previous assistant message as fully typed
      setMessages((prev) =>
        prev.map((m) => (m.isTyping ? { ...m, isTyping: false, content: m.content } : m))
      )

      // Build V16 actions from API response — map new action types to ActionSuggestion
      const apiActions = (data.actions || []).map((a: any) => ({
        type: a.type || 'navigate',
        label: a.title || a.label || 'Action',
        title: a.title,
        description: a.description,
        view: a.payload?.view || a.view,
        icon: a.type === 'send_reminder' ? 'Bell' :
              a.type === 'generate_report' ? 'FileText' :
              a.type === 'execute_workflow' ? 'Rocket' :
              a.type === 'create_task' ? 'Activity' : 'Zap',
        payload: a.payload,
      }))

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'I could not process that request.',
        timestamp: Date.now(),
        actions: apiActions,
        insights: data.insights || [],
        sources: data.sources || [],
        thinkingSteps: data.thinkingSteps || [],
        isTyping: true,
      }
      setMessages((prev) => [...prev, assistantMsg])
      historyRef.current.push({ role: 'assistant', content: data.answer })

      // Update live stats
      if (data.stats) {
        setLiveStats(data.stats)
      }

      // After typing completes, mark as done
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, isTyping: false } : m))
        )
      }, Math.min(8000, (data.answer?.length || 100) * 8))
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'I had trouble connecting to your live data. Please try again in a moment.',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const handleAction = (action: ActionSuggestion) => {
    // V16: support all action types
    if ((action.type === 'navigate' || action.type === 'execute_workflow') && action.view) {
      setCurrentView(action.view as any)
      onMinimize()
    }
    // For other action types (send_reminder, generate_report, create_task),
    // we could trigger workflows here in the future. For now, navigate if view exists.
    if (action.view && action.type !== 'navigate' && action.type !== 'execute_workflow') {
      setCurrentView(action.view as any)
      onMinimize()
    }
  }

  const handleModuleShortcut = (view: string) => {
    setCurrentView(view as any)
    onMinimize()
  }

  const handleSuggested = (q: string) => {
    handleSend(q)
  }

  const clearConversation = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "**Conversation cleared.** How can I help you now?",
        timestamp: Date.now(),
      },
    ])
    historyRef.current = []
  }

  const toggleVoice = () => {
    if (voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setVoiceEnabled(!voiceEnabled)
  }

  // Panel sizing
  const panelSize = isFullscreen
    ? { width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: '0' }
    : {
        width: 'min(440px, calc(100vw - 32px))',
        height: 'min(640px, calc(100vh - 120px))',
        maxWidth: '440px',
        maxHeight: '640px',
        borderRadius: '1.25rem',
      }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="fixed z-[9999] right-4 bottom-4 md:right-6 md:bottom-6"
          style={{
            width: panelSize.width,
            height: panelSize.height,
            maxWidth: panelSize.maxWidth,
            maxHeight: panelSize.maxHeight,
          }}
        >
          <div
            className="relative w-full h-full flex flex-col overflow-hidden shadow-2xl"
            style={{
              borderRadius: panelSize.borderRadius,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow:
                '0 24px 64px -12px rgba(37,99,235, 0.25), 0 0 0 1px rgba(37,99,235, 0.08)',
            }}
          >
            {/* Decorative gradient header bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: 'linear-gradient(90deg, #2563EB, #3B82F6, #3b82f6)',
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="relative h-9 w-9">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, #2563EB, #3B82F6, #3b82f6, #2563EB)',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' as const }}
                  />
                  <div className="absolute inset-0.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    GSTPilot Oracle™
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    Ask anything. Run everything.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleVoice}
                  className={`p-1.5 rounded-lg transition-colors ${
                    voiceEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={voiceEnabled ? 'Voice output on' : 'Voice output off'}
                >
                  {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={clearConversation}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showSettings
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onToggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={onMinimize}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Minimize"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Live Stats Bar */}
            <LiveStatsBar stats={liveStats} />

            {/* Module Shortcuts */}
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30">
              {MODULE_SHORTCUTS.map((m) => (
                <button
                  key={m.view}
                  onClick={() => handleModuleShortcut(m.view)}
                  className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                  title={m.label}
                >
                  <m.icon className="h-3 w-3 text-emerald-600" />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Settings panel (collapsible) */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm"
                >
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Voice Output</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Speak AI responses aloud</p>
                      </div>
                      <button
                        onClick={toggleVoice}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          voiceEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <motion.div
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                          animate={{ left: voiceEnabled ? '18px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Keyboard:</span> Ctrl+K to toggle ·
                      <span className="font-semibold text-slate-600 dark:text-slate-300"> Voice:</span> Mic button for speech input
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onAction={handleAction}
                  voiceEnabled={voiceEnabled}
                />
              ))}
              {isThinking && <ThinkingIndicator steps={thinkingSteps} />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested questions (only when few messages) */}
            {messages.length <= 2 && !isThinking && (
              <div className="px-3 py-2 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleSuggested(q.label)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    >
                      <q.icon className={`h-3 w-3 ${q.color}`} />
                      <span className="text-slate-600 dark:text-slate-300">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="px-3 py-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <div className="flex items-end gap-2">
                <button
                  onClick={toggleListening}
                  className={`shrink-0 p-2.5 rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={isListening ? 'Listening…' : 'Ask GSTPilot Oracle anything…'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all"
                    disabled={isThinking}
                  />
                  {isListening && (
                    <motion.div
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-red-500 rounded-full"
                          animate={{ height: [4, 12, 4] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isThinking}
                  className="shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 disabled:opacity-40 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 text-center">
                GSTPilot Oracle™ reads live data · Ctrl+K to toggle · Voice + Speech enabled
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Main Component --------------------------------------------------------

export function GSTPilotIntelligence() {
  const [isOpen, setIsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  const handleMinimize = () => {
    setIsOpen(false)
    setIsFullscreen(false)
  }

  return (
    <>
      <FloatingOrb
        onClick={() => setIsOpen((prev) => !prev)}
        isOpen={isOpen}
        isListening={isListening}
        isThinking={isThinking}
      />
      <CommandCenter
        isOpen={isOpen}
        isFullscreen={isFullscreen}
        isListening={isListening}
        setIsListening={setIsListening}
        isThinking={isThinking}
        setIsThinking={setIsThinking}
        onClose={() => {
          setIsOpen(false)
          setIsFullscreen(false)
        }}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onMinimize={handleMinimize}
      />
    </>
  )
}

export default GSTPilotIntelligence
