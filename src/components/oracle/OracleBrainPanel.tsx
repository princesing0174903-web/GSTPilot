'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Brain Panel (PROMPT 6)
//
// A full-screen memory side panel showing everything Oracle remembers:
//   • Recent Memories   • Business Facts   • Pinned Facts
//   • Recent Decisions  • Active Tasks     • Learning
//   • Semantic Search   • Memory Timeline
//
// Premium Apple + Linear + OpenAI quality: glass, animations, timeline,
// memory cards, task cards, pinned notes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, Pin, PinOff, Archive, Trash2, X, Clock,
  TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, ListTodo,
  FileText, Bell, Sparkles, ArrowRight, Database,
} from 'lucide-react';

// ─── Types (mirrors of the backend Brain types) ───────────────────────────────

interface BrainMemory {
  id: string;
  type: string;
  subtype?: string | null;
  title: string;
  content: string;
  summary?: string | null;
  tags: string[];
  importance: number;
  pinned: boolean;
  source: string;
  createdAt: string;
}

interface BrainTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  autonomous: boolean;
  createdAt: string;
}

interface BrainDecision {
  id: string;
  title: string;
  recommendation: string;
  reason: string;
  evidence: string[];
  expectedOutcome: string;
  confidence: number;
  priority: string;
  status: string;
  createdAt: string;
}

interface BrainLearning {
  id: string;
  signal: string;
  pattern: string;
  observation: string;
  weight: number;
  occurrenceCount: number;
  updatedAt: string;
}

interface BrainReminder {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  createdAt: string;
}

interface DailySummary {
  date: string;
  yesterdaySummary: string;
  todayPriorities: string[];
  pendingTasks: BrainTask[];
  upcomingGst: { title: string; dueDate: string; daysLeft: number }[];
  businessHealthChanges: { metric: string; change: string; direction: string }[];
  activeReminders: BrainReminder[];
}

interface SearchResult {
  memory: BrainMemory;
  score: number;
}

type Tab = 'overview' | 'memories' | 'decisions' | 'tasks' | 'learning' | 'search' | 'timeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrgId(): string {
  if (typeof window === 'undefined') return 'preview-org';
  return window.localStorage.getItem('gstpilot_org_id') || 'preview-org';
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const TYPE_COLORS: Record<string, string> = {
  conversation: 'text-sky-400 bg-sky-500/10',
  business: 'text-emerald-400 bg-emerald-500/10',
  user: 'text-emerald-400 bg-emerald-500/10',
  task: 'text-amber-400 bg-amber-500/10',
  decision: 'text-rose-400 bg-rose-500/10',
  reminder: 'text-orange-400 bg-orange-500/10',
  report: 'text-cyan-400 bg-cyan-500/10',
  learning: 'text-pink-400 bg-pink-500/10',
  fact: 'text-slate-400 bg-slate-500/10',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 ring-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 ring-orange-500/20',
  medium: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
  low: 'text-slate-400 bg-slate-500/10 ring-slate-500/20',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10',
  warn: 'text-orange-400 bg-orange-500/10',
  watch: 'text-amber-400 bg-amber-500/10',
  info: 'text-sky-400 bg-sky-500/10',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleBrainPanel({
  open,
  onClose,
  onSuggestion,
}: {
  open: boolean;
  onClose: () => void;
  onSuggestion?: (prompt: string) => void;
}) {
  const orgId = useMemo(() => getOrgId(), []);
  const [tab, setTab] = useState<Tab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [recentMemories, setRecentMemories] = useState<BrainMemory[]>([]);
  const [pinnedMemories, setPinnedMemories] = useState<BrainMemory[]>([]);
  const [businessFacts, setBusinessFacts] = useState<BrainMemory[]>([]);
  const [decisions, setDecisions] = useState<BrainDecision[]>([]);
  const [tasks, setTasks] = useState<BrainTask[]>([]);
  const [learnings, setLearnings] = useState<BrainLearning[]>([]);
  const [reminders, setReminders] = useState<BrainReminder[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── Data fetchers ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [recent, pinned, facts, decs, tks, lrns, rems, daily] = await Promise.all([
        fetch(`/api/oracle/brain/memory?firmId=${orgId}&action=recent&limit=20`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/memory?firmId=${orgId}&action=pinned`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/memory?firmId=${orgId}&type=business,fact&limit=10`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/decisions?firmId=${orgId}&limit=15`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/tasks?firmId=${orgId}&action=pending&limit=15`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/learning?firmId=${orgId}&limit=10`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/reminders?firmId=${orgId}&action=active&limit=10`).then((r) => r.json()).then((d) => d.data || []),
        fetch(`/api/oracle/brain/daily-summary?firmId=${orgId}`).then((r) => r.json()).then((d) => d.data || null),
      ]);
      setRecentMemories(recent);
      setPinnedMemories(pinned);
      setBusinessFacts(facts);
      setDecisions(decs);
      setTasks(tks);
      setLearnings(lrns);
      setReminders(rems);
      setDailySummary(daily);
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // ─── Semantic search ────────────────────────────────────────────────────────

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/oracle/brain/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: orgId, query: searchQuery, topK: 8, mode: 'hybrid' }),
      });
      const data = await res.json();
      setSearchResults(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  }, [orgId, searchQuery]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const togglePin = async (id: string, pinned: boolean) => {
    await fetch(`/api/oracle/brain/memory?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pin', pinned: !pinned }),
    });
    fetchAll();
  };

  const archiveMemory = async (id: string) => {
    await fetch(`/api/oracle/brain/memory?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    });
    fetchAll();
  };

  const completeTask = async (id: string) => {
    await fetch(`/api/oracle/brain/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', completedBy: 'user' }),
    });
    fetchAll();
  };

  const acceptDecision = async (id: string) => {
    await fetch(`/api/oracle/brain/decisions?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    fetchAll();
  };

  const dismissReminder = async (id: string) => {
    await fetch(`/api/oracle/brain/reminders?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    });
    fetchAll();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative flex h-full w-full max-w-3xl flex-col border-l border-[#1F1F1F] bg-gradient-to-b from-[#0A0A0A] to-[#050505] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1F1F1F] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/30">
                  <Brain className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Oracle Brain</h2>
                  <p className="text-xs text-white/50">Persistent memory · {recentMemories.length + pinnedMemories.length + businessFacts.length} memories · {decisions.length} decisions · {tasks.length} tasks</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-[#1F1F1F] px-4 py-2">
              {([
                { id: 'overview', label: 'Overview', icon: Sparkles },
                { id: 'memories', label: 'Memories', icon: Database },
                { id: 'decisions', label: 'Decisions', icon: FileText },
                { id: 'tasks', label: 'Tasks', icon: ListTodo },
                { id: 'learning', label: 'Learning', icon: Lightbulb },
                { id: 'search', label: 'Search', icon: Search },
              ] as { id: Tab; label: string; icon: typeof Brain }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    tab === t.id
                      ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading && (
                <div className="flex items-center justify-center py-12 text-white/40">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
                </div>
              )}

              {!loading && tab === 'overview' && dailySummary && (
                <div className="space-y-5">
                  {/* Daily Summary Hero */}
                  <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-white">Today&apos;s Brief</h3>
                      <span className="ml-auto text-xs text-white/40">{dailySummary.date}</span>
                    </div>
                    <p className="mb-3 text-sm text-white/70">{dailySummary.yesterdaySummary}</p>
                    {dailySummary.todayPriorities.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Priorities</p>
                        <ul className="space-y-1.5">
                          {dailySummary.todayPriorities.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {onSuggestion && (
                      <button
                        onClick={() => onSuggestion('What should I do today?')}
                        className="mt-4 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25"
                      >
                        Ask VEYRO AI for today&apos;s plan
                      </button>
                    )}
                  </div>

                  {/* Upcoming GST */}
                  {dailySummary.upcomingGst.length > 0 && (
                    <Section title="Upcoming GST Deadlines" icon={Clock}>
                      <div className="space-y-2">
                        {dailySummary.upcomingGst.map((g, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            <span className="text-sm text-white/80">{g.title}</span>
                            <span className={`text-xs font-medium ${g.daysLeft < 0 ? 'text-red-400' : g.daysLeft <= 3 ? 'text-orange-400' : 'text-amber-400'}`}>
                              {g.daysLeft < 0 ? `${Math.abs(g.daysLeft)}d overdue` : `${g.daysLeft}d left`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Active Reminders */}
                  {reminders.length > 0 && (
                    <Section title="Active Alerts" icon={Bell}>
                      <div className="space-y-2">
                        {reminders.slice(0, 5).map((r) => (
                          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white/90">{r.title}</p>
                              <p className="truncate text-xs text-white/50">{r.message}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.info}`}>
                                {r.severity}
                              </span>
                              <button
                                onClick={() => dismissReminder(r.id)}
                                className="text-white/30 transition hover:text-white/60"
                                aria-label="Dismiss"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Health Changes */}
                  {dailySummary.businessHealthChanges.length > 0 && (
                    <Section title="Health Changes" icon={TrendingUp}>
                      <div className="space-y-2">
                        {dailySummary.businessHealthChanges.map((h, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            <span className="text-sm text-white/80">{h.metric}</span>
                            <span className={`text-xs font-medium ${h.direction === 'up' ? 'text-emerald-400' : h.direction === 'down' ? 'text-red-400' : 'text-white/50'}`}>
                              {h.change}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Memories" value={recentMemories.length + businessFacts.length} icon={Database} />
                    <StatCard label="Decisions" value={decisions.length} icon={FileText} />
                    <StatCard label="Tasks" value={tasks.length} icon={ListTodo} />
                    <StatCard label="Learnings" value={learnings.length} icon={Lightbulb} />
                  </div>
                </div>
              )}

              {!loading && tab === 'overview' && !dailySummary && (
                <div className="py-12 text-center text-white/40">No summary available.</div>
              )}

              {!loading && tab === 'memories' && (
                <div className="space-y-5">
                  {pinnedMemories.length > 0 && (
                    <Section title="Pinned" icon={Pin}>
                      <div className="space-y-2">
                        {pinnedMemories.map((m) => (
                          <MemoryCard
                            key={m.id}
                            memory={m}
                            onPin={() => togglePin(m.id, m.pinned)}
                            onArchive={() => archiveMemory(m.id)}
                          />
                        ))}
                      </div>
                    </Section>
                  )}
                  <Section title="Business Facts" icon={Database}>
                    {businessFacts.length > 0 ? (
                      <div className="space-y-2">
                        {businessFacts.map((m) => (
                          <MemoryCard key={m.id} memory={m} onPin={() => togglePin(m.id, m.pinned)} onArchive={() => archiveMemory(m.id)} />
                        ))}
                      </div>
                    ) : (
                      <EmptyHint text="No business facts yet. Ask VEYRO AI about your business to start building memory." />
                    )}
                  </Section>
                  <Section title="Recent Memories" icon={Clock}>
                    {recentMemories.length > 0 ? (
                      <div className="space-y-2">
                        {recentMemories.map((m) => (
                          <MemoryCard key={m.id} memory={m} onPin={() => togglePin(m.id, m.pinned)} onArchive={() => archiveMemory(m.id)} />
                        ))}
                      </div>
                    ) : (
                      <EmptyHint text="No memories yet. Start a conversation with Oracle." />
                    )}
                  </Section>
                </div>
              )}

              {!loading && tab === 'decisions' && (
                <Section title="Decision Log" icon={FileText}>
                  {decisions.length > 0 ? (
                    <div className="space-y-3">
                      {decisions.map((d) => (
                        <DecisionCard key={d.id} decision={d} onAccept={() => acceptDecision(d.id)} />
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="No decisions logged. Oracle logs every recommendation with reason + evidence." />
                  )}
                </Section>
              )}

              {!loading && tab === 'tasks' && (
                <Section title="Active Tasks" icon={ListTodo}>
                  {tasks.length > 0 ? (
                    <div className="space-y-2">
                      {tasks.map((t) => (
                        <TaskCard key={t.id} task={t} onComplete={() => completeTask(t.id)} />
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="No pending tasks. Oracle auto-creates tasks from critical insights." />
                  )}
                </Section>
              )}

              {!loading && tab === 'learning' && (
                <Section title="Learned Preferences" icon={Lightbulb}>
                  {learnings.length > 0 ? (
                    <div className="space-y-2">
                      {learnings.map((l) => (
                        <div key={l.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white/90">{l.pattern}</span>
                            <span className="text-xs text-pink-400">×{l.occurrenceCount}</span>
                          </div>
                          {l.observation && <p className="mt-1 text-xs text-white/50">{l.observation}</p>}
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-gradient-to-r from-pink-500/60 to-pink-400" style={{ width: `${Math.min(100, (l.weight / 5) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint text="Oracle hasn't learned preferences yet. It learns from your behaviour — edits, exports, frequent queries." />
                  )}
                </Section>
              )}

              {!loading && tab === 'search' && (
                <Section title="Semantic Memory Search" icon={Search}>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                      placeholder="Search all memories… (e.g. 'GST discussion last week')"
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500/40"
                    />
                    <button
                      onClick={runSearch}
                      disabled={searching || !searchQuery.trim()}
                      className="rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-40"
                    >
                      {searching ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((r) => (
                        <div key={r.memory.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white/90">{r.memory.title}</span>
                            <span className="text-xs text-amber-400">{Math.round(r.score * 100)}% match</span>
                          </div>
                          {r.memory.summary && <p className="mt-1 text-xs text-white/50">{r.memory.summary.slice(0, 200)}</p>}
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
                            <span className={`rounded px-1.5 py-0.5 ${TYPE_COLORS[r.memory.type] || TYPE_COLORS.fact}`}>{r.memory.type}</span>
                            <span>{formatRelative(r.memory.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery && !searching ? (
                    <EmptyHint text="No matches. Try different keywords." />
                  ) : (
                    <EmptyHint text="Search across all memories using semantic + keyword matching. Ask 'What did we discuss last week?'" />
                  )}
                </Section>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Brain; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-400/70" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Brain }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center justify-between">
        <Icon className="h-4 w-4 text-white/30" />
        <span className="text-xl font-semibold text-white">{value}</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

function MemoryCard({ memory, onPin, onArchive }: { memory: BrainMemory; onPin: () => void; onArchive: () => void }) {
  return (
    <div className="group rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/90">{memory.title}</p>
          {memory.summary && <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{memory.summary}</p>}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
            <span className={`rounded px-1.5 py-0.5 ${TYPE_COLORS[memory.type] || TYPE_COLORS.fact}`}>{memory.type}</span>
            <span>{formatRelative(memory.createdAt)}</span>
            {memory.pinned && <span className="text-amber-400">pinned</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={onPin} className="rounded p-1 text-white/40 hover:text-amber-400" aria-label="Pin">
            {memory.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onArchive} className="rounded p-1 text-white/40 hover:text-white/70" aria-label="Archive">
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ decision, onAccept }: { decision: BrainDecision; onAccept: () => void }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white/90">{decision.title}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${PRIORITY_COLORS[decision.priority] || PRIORITY_COLORS.low}`}>{decision.priority}</span>
      </div>
      <p className="text-xs text-white/60">{decision.recommendation}</p>
      {decision.reason && (
        <p className="mt-1.5 text-xs text-white/40"><span className="text-white/30">Why:</span> {decision.reason}</p>
      )}
      {decision.expectedOutcome && (
        <p className="mt-0.5 text-xs text-white/40"><span className="text-white/30">Expected:</span> {decision.expectedOutcome}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-white/30">{decision.confidence}% confidence · {formatRelative(decision.createdAt)}</span>
        {decision.status === 'recommended' && (
          <button
            onClick={onAccept}
            className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
          >
            Accept
          </button>
        )}
        {decision.status !== 'recommended' && (
          <span className="text-[10px] text-white/40">{decision.status}</span>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete }: { task: BrainTask; onComplete: () => void }) {
  return (
    <div className="group rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/90">{task.title}</p>
          {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{task.description}</p>}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
            <span className={`rounded px-1.5 py-0.5 ring-1 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low}`}>{task.priority}</span>
            <span>{task.type}</span>
            {task.autonomous && <span className="text-amber-400">auto</span>}
            <span>{formatRelative(task.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={onComplete}
          className="shrink-0 rounded-md bg-emerald-500/15 p-1.5 text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
          aria-label="Complete"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-4 py-6 text-center">
      <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-white/20" />
      <p className="text-xs text-white/40">{text}</p>
    </div>
  );
}
