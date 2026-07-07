'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Building2,
  FileText,
  CheckSquare,
  FileCheck2,
  Users,
  MessagesSquare,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Hash,
  CornerDownLeft,
  X,
  Database,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  COMPANIES,
  ENTERPRISE_DOCUMENTS,
  ENTERPRISE_TASKS,
  WORKFLOW_APPROVALS,
  TEAM_MEMBERS,
  CHAT_MESSAGES,
  fmtINR,
} from '@/lib/enterprise/data'

// ─── category config ───────────────────────────────────────────────────────────
type CategoryKey =
  | 'all'
  | 'companies'
  | 'documents'
  | 'tasks'
  | 'approvals'
  | 'people'
  | 'conversations'

const CATEGORIES: { key: CategoryKey; label: string; icon: typeof Search; accent: string }[] = [
  { key: 'all', label: 'All', icon: Search, accent: '#10b981' },
  { key: 'companies', label: 'Companies', icon: Building2, accent: '#06b6d4' },
  { key: 'documents', label: 'Documents', icon: FileText, accent: '#f59e0b' },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, accent: '#8b5cf6' },
  { key: 'approvals', label: 'Approvals', icon: FileCheck2, accent: '#14b8a6' },
  { key: 'people', label: 'People', icon: Users, accent: '#ec4899' },
  { key: 'conversations', label: 'Conversations', icon: MessagesSquare, accent: '#a855f7' },
]

const CAT_ICON: Record<CategoryKey, typeof Search> = {
  all: Search,
  companies: Building2,
  documents: FileText,
  tasks: CheckSquare,
  approvals: FileCheck2,
  people: Users,
  conversations: MessagesSquare,
}

const CAT_ACCENT: Record<CategoryKey, string> = {
  all: '#10b981',
  companies: '#06b6d4',
  documents: '#f59e0b',
  tasks: '#8b5cf6',
  approvals: '#14b8a6',
  people: '#ec4899',
  conversations: '#a855f7',
}

const RECENT_SEARCHES = [
  'GSTR-3B Aurora Retail',
  'overdue invoices',
  'ITC reconciliation',
  'Vikram Mehta approvals',
]

const SUGGESTED_SEARCHES = [
  { label: 'GSTR-3B filings', icon: FileText, accent: '#ef4444' },
  { label: 'Overdue invoices', icon: TrendingUp, accent: '#f97316' },
  { label: 'Aurora Tech', icon: Building2, accent: '#06b6d4' },
  { label: 'Pending approvals', icon: FileCheck2, accent: '#14b8a6' },
  { label: 'Vendor KYC', icon: Users, accent: '#8b5cf6' },
  { label: 'Payroll September', icon: FileText, accent: '#10b981' },
  { label: 'ITC reversal', icon: Zap, accent: '#f59e0b' },
  { label: 'Critical tasks', icon: CheckSquare, accent: '#ec4899' },
]

// ─── helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function highlight(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-emerald-500/25 px-0.5 text-emerald-200">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const AVATAR_COLORS: Record<string, string> = {
  'Vikram Mehta': '#8b5cf6',
  'Anita Desai': '#06b6d4',
  'Rajesh Kumar': '#f59e0b',
  'Priya Sharma': '#ec4899',
  'Suresh Iyer': '#f97316',
  'Meena Krishnan': '#14b8a6',
  'Karthik Nair': '#f97316',
  'Deepika Rao': '#a855f7',
  'Arjun Gupta': '#64748b',
  'Neha Singh': '#64748b',
  'AI Copilot': '#10b981',
  'AI Risk Engine': '#ef4444',
  'System': '#64748b',
  'Legal Bot': '#06b6d4',
}

// ─── result row component ──────────────────────────────────────────────────────
function ResultRow({
  icon: Icon,
  accent,
  title,
  subtitle,
  company,
  typeLabel,
  query,
  right,
}: {
  icon: typeof Search
  accent: string
  title: string
  subtitle?: string
  company?: string
  typeLabel: string
  query: string
  right?: React.ReactNode
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}1f` }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-white">
            {highlight(title, query)}
          </span>
          {company && (
            <Badge
              variant="outline"
              className="flex-shrink-0 border-white/10 bg-white/[0.03] px-1 py-0 text-[9px] text-zinc-400"
            >
              {company.replace('Aurora ', '')}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
            {highlight(subtitle, query)}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {right}
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.03] px-1.5 py-0 text-[9px] font-normal text-zinc-400"
        >
          {typeLabel}
        </Badge>
        <ArrowRight className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────
export default function EnterpriseSearch() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [searchTime, setSearchTime] = useState(12)

  // ─── compute filtered results with useMemo ────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return {
        companies: [],
        documents: [],
        tasks: [],
        approvals: [],
        people: [],
        conversations: [],
      }
    }

    return {
      companies: COMPANIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q),
      ),
      documents: ENTERPRISE_DOCUMENTS.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.folder.toLowerCase().includes(q) ||
          d.company.toLowerCase().includes(q) ||
          d.modifiedBy.toLowerCase().includes(q),
      ),
      tasks: ENTERPRISE_TASKS.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.company.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q),
      ),
      approvals: WORKFLOW_APPROVALS.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.company.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      ),
      people: TEAM_MEMBERS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q),
      ),
      conversations: CHAT_MESSAGES.filter(
        (m) =>
          m.message.toLowerCase().includes(q) ||
          m.user.toLowerCase().includes(q) ||
          m.channel.toLowerCase().includes(q),
      ),
    }
  }, [query])

  const totalCount =
    results.companies.length +
    results.documents.length +
    results.tasks.length +
    results.approvals.length +
    results.people.length +
    results.conversations.length

  // recompute "search time" — static-ish, scaled by query length
  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.trim()) {
      // deterministic pseudo-time based on query length (no Math.random)
      const t = 8 + (val.length % 9)
      setSearchTime(t)
    }
  }

  const setQuickQuery = (q: string) => {
    setQuery(q)
    handleQueryChange(q)
  }

  const hasQuery = query.trim().length > 0

  // Filter category sections — if not "all", only show the active one
  const visibleSections: { key: Exclude<CategoryKey, 'all'>; label: string; items: unknown[] }[] = [
    { key: 'companies', label: 'Companies', items: results.companies },
    { key: 'documents', label: 'Documents', items: results.documents },
    { key: 'tasks', label: 'Tasks', items: results.tasks },
    { key: 'approvals', label: 'Approvals', items: results.approvals },
    { key: 'people', label: 'People', items: results.people },
    { key: 'conversations', label: 'Conversations', items: results.conversations },
  ].filter((s) => activeCategory === 'all' || s.key === activeCategory) as {
    key: Exclude<CategoryKey, 'all'>
    label: string
    items: unknown[]
  }[]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Universal Search™
          </h2>
          <Badge className="border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300">
            AI-POWERED
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Search across invoices, companies, documents, tasks, people, and more
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search anything across all companies..."
          className="h-12 border-white/[0.08] bg-white/[0.03] pl-10 pr-24 text-sm text-white placeholder:text-zinc-500"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {hasQuery && (
            <button
              onClick={() => {
                setQuery('')
                setActiveCategory('all')
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {hasQuery ? (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"
            >
              <CornerDownLeft className="mr-1 h-2.5 w-2.5" /> Enter
            </Badge>
          ) : (
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Search stats + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          {hasQuery ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Database className="h-3 w-3" />
                Found{' '}
                <span className="font-semibold text-emerald-300">{totalCount}</span>{' '}
                results
              </span>
              <Separator orientation="vertical" className="h-3 bg-white/10" />
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3 w-3" />
                in <span className="font-semibold text-white">{searchTime}ms</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              Start typing to search across {COMPANIES.length} companies,{' '}
              {ENTERPRISE_DOCUMENTS.length} documents,{' '}
              {TEAM_MEMBERS.length} people
            </span>
          )}
        </div>
        {/* Category filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => {
            const active = activeCategory === c.key
            const Icon = c.icon
            const count =
              c.key === 'all'
                ? totalCount
                : results[c.key as keyof typeof results].length
            return (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  active
                    ? 'border-white/20 bg-white/[0.08] text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="h-3 w-3" style={{ color: c.accent }} />
                {c.label}
                {hasQuery && count > 0 && (
                  <span className="text-[9px] text-zinc-500">({count})</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content area */}
      <AnimatePresence mode="wait">
        {!hasQuery ? (
          /* Empty state: Recent + Suggested searches */
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 lg:grid-cols-2"
          >
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
                  <Clock className="h-4 w-4 text-zinc-400" />
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {RECENT_SEARCHES.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setQuickQuery(s)}
                      className="group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.04] text-[10px] text-zinc-500">
                        {i + 1}
                      </span>
                      <Search className="h-3 w-3 text-zinc-500" />
                      <span className="flex-1 text-xs text-zinc-300 group-hover:text-white">
                        {s}
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Suggested Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-1.5">
                  {SUGGESTED_SEARCHES.map((s) => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.label}
                        onClick={() => setQuickQuery(s.label)}
                        className="group flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <div
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                          style={{ background: `${s.accent}1f` }}
                        >
                          <Icon className="h-3 w-3" style={{ color: s.accent }} />
                        </div>
                        <span className="truncate text-[11px] text-zinc-300 group-hover:text-white">
                          {s.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : totalCount === 0 ? (
          /* No results state */
          <motion.div
            key="noresults"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
                  <Search className="h-6 w-6 text-zinc-500" />
                </div>
                <p className="text-sm font-medium text-white">
                  No results found for &quot;{query}&quot;
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Try a different keyword or check the spelling
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  {SUGGESTED_SEARCHES.slice(0, 4).map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setQuickQuery(s.label)}
                      className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Results — grouped by category */
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 lg:grid-cols-2"
          >
            {visibleSections.map((section) => {
              const Icon = CAT_ICON[section.key]
              const accent = CAT_ACCENT[section.key]
              return (
                <Card
                  key={section.key}
                  className="border-white/[0.06] bg-white/[0.02]"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-md"
                          style={{ background: `${accent}1f` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                        </div>
                        {section.label}
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.04] px-1.5 py-0 text-[10px] text-zinc-400"
                        >
                          {section.items.length}
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-96">
                      <div className="space-y-1.5 pr-1">
                        <AnimatePresence mode="popLayout">
                          {section.key === 'companies' &&
                            (section.items as typeof COMPANIES).map((c) => (
                              <ResultRow
                                key={c.id}
                                icon={Building2}
                                accent={accent}
                                title={c.name}
                                subtitle={`${c.gstin} · ${c.industry} · ${c.state}`}
                                typeLabel={c.type}
                                query={query}
                                right={
                                  <span
                                    className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                                    style={{
                                      background: `${c.color}1f`,
                                      color: c.color,
                                    }}
                                  >
                                    {c.status}
                                  </span>
                                }
                              />
                            ))}

                          {section.key === 'documents' &&
                            (section.items as typeof ENTERPRISE_DOCUMENTS).map((d) => (
                              <ResultRow
                                key={d.id}
                                icon={FileText}
                                accent={accent}
                                title={d.name}
                                subtitle={`${d.folder} · ${d.size} · ${d.version}`}
                                company={d.company}
                                typeLabel={d.type.toUpperCase()}
                                query={query}
                                right={
                                  <Badge
                                    variant="outline"
                                    className="border-white/10 bg-white/[0.03] px-1 py-0 text-[9px] text-zinc-400"
                                  >
                                    {d.status}
                                  </Badge>
                                }
                              />
                            ))}

                          {section.key === 'tasks' &&
                            (section.items as typeof ENTERPRISE_TASKS).map((t) => (
                              <ResultRow
                                key={t.id}
                                icon={CheckSquare}
                                accent={accent}
                                title={t.title}
                                subtitle={`Assigned to ${t.assignee} · Due ${t.dueDate}`}
                                company={t.company}
                                typeLabel={t.status}
                                query={query}
                                right={
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                      t.priority === 'critical'
                                        ? 'bg-red-500/15 text-red-300'
                                        : t.priority === 'high'
                                        ? 'bg-amber-500/15 text-amber-300'
                                        : 'bg-white/[0.04] text-zinc-400'
                                    }`}
                                  >
                                    {t.priority}
                                  </span>
                                }
                              />
                            ))}

                          {section.key === 'approvals' &&
                            (section.items as typeof WORKFLOW_APPROVALS).map((a) => (
                              <ResultRow
                                key={a.id}
                                icon={FileCheck2}
                                accent={accent}
                                title={a.title}
                                subtitle={`${a.type} · ${fmtINR(a.amount)}`}
                                company={a.company}
                                typeLabel={a.status}
                                query={query}
                              />
                            ))}

                          {section.key === 'people' &&
                            (section.items as typeof TEAM_MEMBERS).map((p) => (
                              <ResultRow
                                key={p.id}
                                icon={Users}
                                accent={accent}
                                title={p.name}
                                subtitle={`${p.role} · ${p.currentActivity ?? '—'}`}
                                company={p.company}
                                typeLabel={p.status}
                                query={query}
                                right={
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback
                                      className="text-[8px] font-semibold text-white"
                                      style={{
                                        background: AVATAR_COLORS[p.name] ?? '#64748b',
                                      }}
                                    >
                                      {initials(p.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                }
                              />
                            ))}

                          {section.key === 'conversations' &&
                            (section.items as typeof CHAT_MESSAGES).map((m) => (
                              <ResultRow
                                key={m.id}
                                icon={MessagesSquare}
                                accent={accent}
                                title={m.message.slice(0, 80) + (m.message.length > 80 ? '…' : '')}
                                subtitle={`By ${m.user} in #${m.channel} · ${m.timestamp}`}
                                typeLabel="message"
                                query={query}
                                right={
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback
                                      className="text-[8px] font-semibold text-white"
                                      style={{
                                        background: AVATAR_COLORS[m.user] ?? '#64748b',
                                      }}
                                    >
                                      {initials(m.user)}
                                    </AvatarFallback>
                                  </Avatar>
                                }
                              />
                            ))}
                        </AnimatePresence>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
