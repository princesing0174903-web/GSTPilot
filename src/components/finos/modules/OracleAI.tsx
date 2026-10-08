'use client'

/**
 * OracleAI — ChatGPT-style conversational AI for business questions.
 * Left: conversation starters + capabilities. Right: chat interface.
 * Talks to /api/finos/oracle with the full message history.
 */

import * as React from 'react'
import {
  Sparkles, Send, Loader2, Brain, Receipt, AlertTriangle,
  TrendingUp, ShieldCheck, Zap, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHeader, accentClasses } from '@/components/finos/ui/primitives'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  { icon: Receipt, label: "What's my GST liability for August?" },
  { icon: TrendingUp, label: 'Show me my top 5 customers by outstanding' },
  { icon: AlertTriangle, label: 'Why did my profit drop in May?' },
  { icon: ShieldCheck, label: 'What compliance items are overdue?' },
  { icon: Brain, label: 'Forecast cash flow for next 30 days' },
  { icon: Zap, label: 'Explain my ITC reconciliation gap' },
]

const CAPABILITIES = [
  'Cite specific invoices, returns, and KPIs from your data',
  'Project cash flow, GST liability, and runway',
  'Recommend prioritized action lists with owners and ETAs',
  'Flag compliance risks and quantify penalties',
  'Explain Indian tax treatment (GST, TDS, ITC) with section references',
]

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi Rajesh — I'm Oracle, your AI CFO. I have full context on Aurum Industries' financials, GST filings, and compliance. Ask me anything.",
}

export function OracleAI() {
  const [messages, setMessages] = React.useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new message / loading state change.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = React.useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setError(null)
    const nextMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/finos/oracle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
      } else {
        setError(data.error || 'Oracle failed to respond')
        // Roll back the user message so they can retry.
        setMessages((prev) => prev.slice(0, -1))
        setInput(trimmed)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      setMessages((prev) => prev.slice(0, -1))
      setInput(trimmed)
    } finally {
      setLoading(false)
      // Refocus the textarea after sending.
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [loading, messages])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="VEYRO AI"
        subtitle="Conversational AI for any business question"
        icon={Sparkles}
        accent="violet"
        action={<Badge variant="secondary" className="hidden sm:inline-flex">Full company context</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        {/* ── Left column: starters + capabilities (3/10 = 30%) ──────────── */}
        <Card className="lg:col-span-3 border-border/60">
          <CardHeader className="space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Conversation starters</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Click any prompt to begin</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              {STARTERS.map((s) => {
                const a = accentClasses.violet
                return (
                  <button
                    key={s.label}
                    onClick={() => send(s.label)}
                    disabled={loading}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card p-3 text-left text-sm transition-colors',
                      'hover:border-violet-500/40 hover:bg-muted disabled:opacity-50',
                    )}
                  >
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', a.bg, a.text)}>
                      <s.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-foreground">{s.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Capabilities</p>
              </div>
              <ul className="mt-3 space-y-2">
                {CAPABILITIES.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* ── Right column: chat interface (7/10 = 70%) ──────────────────── */}
        <Card className="flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col lg:col-span-7 border-border/60">
          {/* Chat header */}
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border/60 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-emerald-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">VEYRO AI</CardTitle>
                <p className="text-[11px] text-muted-foreground">AI CFO · Aurum Industries</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-medium">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </Badge>
          </CardHeader>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {loading && <TypingIndicator />}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-border/60 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask VEYRO AI anything… (Enter to send, Shift+Enter for newline)"
                className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
              />
              <Button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="h-10 shrink-0 bg-violet-600 px-3 hover:bg-violet-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send message</span>
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Oracle has context on your KPIs, GST returns, compliance items, and recent activity. Responses may take 3–8 seconds.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[85%] gap-2.5', isUser && 'flex-row-reverse')}>
        {!isUser && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-600 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        )}
        <div
          className={cn(
            'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
          )}
        >
          <pre className="whitespace-pre-wrap break-words font-sans">{message.content}</pre>
        </div>
      </div>
    </div>
  )
}

// ─── Animated typing indicator ───────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-600 text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="flex items-center gap-1 rounded-xl bg-muted px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
