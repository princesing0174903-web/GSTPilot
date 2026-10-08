'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { escapeHtml } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageSquare,
  Send,
  Brain,
  Sparkles,
  BarChart3,
  TrendingUp,
  Users,
  IndianRupee,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Lightbulb,
  ArrowRight,
  Bot,
  User,
  Activity,
  FileText,
} from 'lucide-react'
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireDocuments,
  useFireReconciliations,
  useFireActivities,
} from '@/hooks/use-firestore'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  dataRefs?: string[]
}

interface ConversationSummary {
  id: string
  title: string
  preview: string
  timestamp: Date
  messageCount: number
}

// ─── Suggested Questions ─────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  { text: 'Why did revenue fall?', icon: TrendingUp },
  { text: 'Which clients are risky?', icon: AlertTriangle },
  { text: 'How much cash will I have next month?', icon: IndianRupee },
  { text: 'Which invoices may not be collected?', icon: FileText },
  { text: 'What should I do today?', icon: Zap },
  { text: 'Show me pending GSTR-1 filings', icon: FileText },
  { text: "What's my compliance score?", icon: CheckCircle },
  { text: 'Compare this month vs last month', icon: BarChart3 },
]

// ─── Utility: Indian Number Formatting ──────────────────────────────────────────

function formatINR(amount: number): string {
  const str = amount.toFixed(0)
  const parts = str.split('.')
  let intPart = parts[0]
  const decPart = parts[1]
  const isNegative = intPart.startsWith('-')
  if (isNegative) intPart = intPart.slice(1)

  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  }

  const formatted = isNegative ? '-' + intPart : intPart
  return '₹' + formatted + (decPart ? '.' + decPart : '')
}

function formatDate(date: Date): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// ─── Message Formatting ─────────────────────────────────────────────────────────

function formatMessageContent(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    // SECURITY (POLISH-06): escapeHtml before applying markdown so any HTML
    // in the AI / user content is rendered as text, not executed.
    const escaped = escapeHtml(line)
    // Process bold markers
    const formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Process bullet points
    if (formatted.startsWith('•') || formatted.startsWith('- ') || formatted.startsWith('* ')) {
      const cleaned = formatted.replace(/^[•\-\*]\s*/, '')
      return (
        <div key={i} className="ml-3 flex items-start gap-1.5">
          <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: cleaned }} />
        </div>
      )
    }

    // Numbered list
    if (/^\d+\./.test(formatted)) {
      return (
        <div key={i} className="ml-2" dangerouslySetInnerHTML={{ __html: formatted }} />
      )
    }

    // Empty line
    if (formatted.trim() === '') {
      return <div key={i} className="h-2" />
    }

    return (
      <React.Fragment key={i}>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })
}

// ─── Typing Indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex justify-start"
    >
      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AIBusinessCopilotPage() {
  // Firestore live data
  const { data: clients, loading: clientsLoading } = useFireClients()
  const { data: invoices, loading: invoicesLoading } = useFireInvoices()
  const { data: returns, loading: returnsLoading } = useFireReturns()
  const { data: documents, loading: documentsLoading } = useFireDocuments()
  const { data: reconciliations, loading: reconciliationsLoading } = useFireReconciliations()
  const { data: activities, loading: activitiesLoading } = useFireActivities()

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [showSuggestions, setShowSuggestions] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  // ─── Computed Stats ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalClients = clients.length
    const activeClients = clients.filter(c => c.status === 'active').length
    const totalInvoices = invoices.length
    const pendingReturns = returns.filter(r => r.status !== 'filed').length
    const filedReturns = returns.filter(r => r.status === 'filed').length
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0) + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0), 0)
    const avgHealthScore = activeClients > 0
      ? Math.round(clients.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.healthScore || 0), 0) / activeClients)
      : 0
    const overdueInvoices = invoices.filter(inv => inv.matchStatus === 'mismatch' || inv.riskLevel === 'high').length
    const complianceRate = returns.length > 0 ? Math.round((filedReturns / returns.length) * 100) : 0

    return {
      totalClients,
      activeClients,
      totalInvoices,
      pendingReturns,
      filedReturns,
      totalRevenue,
      avgHealthScore,
      overdueInvoices,
      complianceRate,
      totalDocuments: documents.length,
      totalReconciliations: reconciliations.length,
    }
  }, [clients, invoices, returns, documents, reconciliations])

  // ─── Auto-generated Insights ────────────────────────────────────────────

  const insights = useMemo(() => {
    const result: Array<{ text: string; type: 'positive' | 'warning' | 'negative' | 'neutral'; icon: React.ElementType }> = []

    if (stats.complianceRate >= 90) {
      result.push({ text: `Compliance rate at ${stats.complianceRate}% — excellent`, type: 'positive', icon: CheckCircle })
    } else if (stats.complianceRate >= 70) {
      result.push({ text: `Compliance rate at ${stats.complianceRate}% — needs attention`, type: 'warning', icon: AlertTriangle })
    }

    if (stats.pendingReturns > 0) {
      result.push({ text: `${stats.pendingReturns} returns pending filing`, type: 'warning', icon: Clock })
    }

    if (stats.overdueInvoices > 0) {
      result.push({ text: `${stats.overdueInvoices} invoices flagged as high risk`, type: 'negative', icon: AlertTriangle })
    }

    if (stats.avgHealthScore >= 75) {
      result.push({ text: `Client health average: ${stats.avgHealthScore}/100`, type: 'positive', icon: Activity })
    } else if (stats.avgHealthScore > 0) {
      result.push({ text: `Client health below target: ${stats.avgHealthScore}/100`, type: 'warning', icon: Activity })
    }

    if (stats.totalRevenue > 0) {
      result.push({ text: `Monthly tax volume: ${formatINR(stats.totalRevenue)}`, type: 'neutral', icon: IndianRupee })
    }

    if (stats.totalClients > 0) {
      result.push({ text: `Managing ${stats.activeClients} active clients`, type: 'neutral', icon: Users })
    }

    // Collection rate insight
    const matchedInvoices = invoices.filter(i => i.matchStatus === 'matched').length
    const collectionRate = invoices.length > 0 ? Math.round((matchedInvoices / invoices.length) * 100) : 0
    if (collectionRate > 0) {
      result.push({ text: `Cash collection rate: ${collectionRate}%`, type: collectionRate >= 80 ? 'positive' : 'warning', icon: TrendingUp })
    }

    return result.slice(0, 6)
  }, [stats, invoices])

  // ─── Build Context for AI ───────────────────────────────────────────────

  const buildContext = useCallback(() => {
    const clientSummary = clients.slice(0, 20).map(c => ({
      name: c.tradeName,
      gstin: c.gstin,
      status: c.status,
      healthScore: c.healthScore,
      pendingReturns: c.pendingReturnCount,
      totalTaxPaid: c.totalTaxPaid,
    }))

    const invoiceSummary = {
      total: invoices.length,
      totalAmount: invoices.reduce((s, i) => s + (i.totalAmount || 0), 0),
      totalTax: invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0),
      highRisk: invoices.filter(i => i.riskLevel === 'high').length,
      mismatched: invoices.filter(i => i.matchStatus === 'mismatch').length,
    }

    const returnSummary = {
      total: returns.length,
      filed: returns.filter(r => r.status === 'filed').length,
      pending: returns.filter(r => r.status !== 'filed').length,
      draft: returns.filter(r => r.status === 'draft').length,
      ready: returns.filter(r => r.status === 'validated' || r.status === 'reviewed').length,
    }

    const reconSummary = {
      total: reconciliations.length,
      avgMatchRate: reconciliations.length > 0
        ? Math.round(reconciliations.reduce((s, r) => s + (r.totalRecords > 0 ? (r.matched / r.totalRecords) * 100 : 0), 0) / reconciliations.length)
        : 0,
    }

    return JSON.stringify({
      firm: {
        totalClients: stats.totalClients,
        activeClients: stats.activeClients,
        avgHealthScore: stats.avgHealthScore,
        complianceRate: stats.complianceRate,
      },
      clients: clientSummary,
      invoices: invoiceSummary,
      returns: returnSummary,
      reconciliations: reconSummary,
      recentActivities: activities.slice(0, 10).map(a => ({ type: a.type, description: a.description })),
    }, null, 2)
  }, [clients, invoices, returns, reconciliations, activities, stats])

  // ─── Initialize Welcome Message ─────────────────────────────────────────

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to VEYRO AI Business Copilot. I can answer questions about your clients, invoices, compliance, cash flow, and more.\n\nI have access to your live firm data — just ask me anything and I\'ll give you data-driven, actionable insights. What would you like to know?',
      timestamp: new Date(),
      dataRefs: ['clients', 'invoices', 'returns'],
    }])
  }, [])

  // ─── Auto-scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ─── Send Message ───────────────────────────────────────────────────────

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)

    try {
      const context = buildContext()
      const res = await fetch('/api/business-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: messageText, context }),
      })

      const data = await res.json()
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'I\'m having trouble processing your request. Please try again.',
        timestamp: new Date(),
        dataRefs: ['clients', 'invoices', 'returns'],
      }
      setMessages(prev => [...prev, assistantMsg])

      // Save conversation summary
      setConversations(prev => [{
        id: `conv-${Date.now()}`,
        title: messageText.slice(0, 40) + (messageText.length > 40 ? '...' : ''),
        preview: data.answer?.slice(0, 60) + '...',
        timestamp: new Date(),
        messageCount: 2,
      }, ...prev].slice(0, 5))
    } catch (error) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I encountered an issue processing your question. Let me try a simpler approach — could you rephrase your question or ask about a specific topic like compliance, revenue, or pending filings?',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, buildContext])

  // ─── Key Handler ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Quick Action Handler ───────────────────────────────────────────────

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'at-risk':
        handleSend('Which clients are risky?')
        break
      case 'pending-returns':
        handleSend('Show me pending GSTR-1 filings')
        break
      case 'generate-report':
        handleSend('Compare this month vs last month')
        break
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  const dataLoading = clientsLoading && invoicesLoading && returnsLoading

  if (dataLoading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Brain className="h-6 w-6 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          </div>
          <span className="text-sm text-slate-500 font-medium">Loading your business data...</span>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)]">
      {/* ─── Left Panel: Conversation Interface (60%) ─── */}
      <div className="flex flex-col w-full lg:w-[60%] border-r border-border/40">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border/40 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">AI Business Copilot</h2>
                <Badge className="h-5 px-1.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
                  LIVE DATA
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ask anything about your firm — powered by your live Firestore data
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Online</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' as const }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {msg.role === 'user'
                      ? <User className="h-3.5 w-3.5 text-white" />
                      : <Bot className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                    }
                  </div>

                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Badge className="h-4 px-1.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
                          AI
                        </Badge>
                        {msg.dataRefs && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">
                            Sources: {msg.dataRefs.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    <div>{formatMessageContent(msg.content)}</div>
                    <div className={`text-[9px] mt-1.5 ${
                      msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {formatDate(msg.timestamp)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        <AnimatePresence>
          {showSuggestions && messages.length <= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 pb-2 overflow-hidden"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Suggested Questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                  >
                    <q.icon className="h-3 w-3" />
                    {q.text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border/40 bg-white dark:bg-slate-950">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your business — revenue, clients, compliance, cash flow..."
                className="min-h-[44px] max-h-[120px] resize-none text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 pr-10 dark:border-emerald-800 dark:bg-slate-900"
                disabled={isLoading}
                rows={1}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="absolute right-2 bottom-2 h-7 w-7 p-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span className="text-[9px] text-muted-foreground">
                Powered by live Firestore data + AI
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Context & Insights (40%) ─── */}
      <div className="hidden lg:flex flex-col w-[40%] bg-slate-50/50 dark:bg-slate-950/50 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Live Data Summary */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Live Data Summary</h3>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-white dark:bg-slate-900">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium text-muted-foreground">Total Clients</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalClients}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{stats.activeClients} active</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-white dark:bg-slate-900">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium text-muted-foreground">Total Invoices</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalInvoices}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">{stats.overdueInvoices} at risk</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-white dark:bg-slate-900">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-medium text-muted-foreground">Pending Returns</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.pendingReturns}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{stats.filedReturns} filed</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-white dark:bg-slate-900">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <IndianRupee className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium text-muted-foreground">Revenue</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{stats.totalRevenue > 0 ? formatINR(stats.totalRevenue) : '₹0'}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Tax volume</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Recent Insights */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-foreground">Recent Insights</h3>
              <Badge className="h-4 px-1 text-[8px] font-bold bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
                AUTO
              </Badge>
            </div>
            <div className="space-y-2">
              {insights.length > 0 ? insights.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
                    insight.type === 'positive'
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : insight.type === 'warning'
                      ? 'border-amber-200 bg-amber-50/50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300'
                      : insight.type === 'negative'
                      ? 'border-red-200 bg-red-50/50 text-red-800 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300'
                  }`}
                >
                  <insight.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{insight.text}</span>
                </motion.div>
              )) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Insights will appear as your data grows
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Quick Actions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between h-9 text-xs border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                onClick={() => handleQuickAction('at-risk')}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  View at-risk clients
                </span>
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between h-9 text-xs border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                onClick={() => handleQuickAction('pending-returns')}
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Check pending returns
                </span>
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between h-9 text-xs border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                onClick={() => handleQuickAction('generate-report')}
              >
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Generate comparison report
                </span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Compliance Score */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Compliance Score</h3>
            </div>
            <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-white dark:bg-slate-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.complianceRate}
                  </span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.complianceRate}%` }}
                    transition={{ duration: 1, ease: 'easeOut' as const }}
                    className={`h-2 rounded-full ${
                      stats.complianceRate >= 90
                        ? 'bg-emerald-500'
                        : stats.complianceRate >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{stats.filedReturns} returns filed</span>
                  <span>{stats.pendingReturns} pending</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="bg-border/40" />

          {/* Conversation History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-foreground">Recent Conversations</h3>
            </div>
            <div className="space-y-2">
              {conversations.length > 0 ? conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="rounded-lg border border-border/40 px-3 py-2.5 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-medium text-foreground truncate">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{conv.preview}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{formatDate(conv.timestamp)}</p>
                </div>
              )) : (
                <div className="text-center py-4">
                  <MessageSquare className="h-6 w-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Start by asking a question</p>
                </div>
              )}
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-foreground">Connected Data Sources</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Clients', count: stats.totalClients, icon: Users },
                { name: 'Invoices', count: stats.totalInvoices, icon: FileText },
                { name: 'Returns', count: returns.length, icon: Clock },
                { name: 'Documents', count: stats.totalDocuments, icon: FileText },
                { name: 'Reconciliations', count: stats.totalReconciliations, icon: BarChart3 },
              ].map((source) => (
                <Badge
                  key={source.name}
                  variant="outline"
                  className="h-6 px-2 text-[10px] font-medium border-slate-200 dark:border-slate-700"
                >
                  <source.icon className="h-3 w-3 mr-1 text-slate-400" />
                  {source.name} ({source.count})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
