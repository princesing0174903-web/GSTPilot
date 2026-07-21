'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  User,
  HelpCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  apiPost,
  fmtDate,
  renderMarkdown,
  SCROLLBAR_CLASS,
} from './helpers';
import type { BankingInsightAnswer } from '@/lib/banking-service/types';

interface ChatItem {
  id: string;
  question: string;
  answer?: BankingInsightAnswer;
  loading?: boolean;
  error?: string;
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTED: { label: string; question: string; icon: typeof Wallet }[] = [
  { label: 'How much money do I have?', question: 'How much money do I have?', icon: Wallet },
  { label: "Show this month's expenses", question: "Show this month's expenses", icon: TrendingDown },
  { label: 'Which invoices are unpaid?', question: 'Which invoices are unpaid?', icon: HelpCircle },
  { label: 'How much cash next week?', question: 'How much cash will I have next week?', icon: TrendingUp },
  { label: 'Why is cash flow decreasing?', question: 'Why is cash flow decreasing?', icon: TrendingDown },
  { label: 'Show suspicious transactions', question: 'Show suspicious transactions', icon: AlertCircle },
  { label: 'What are my largest expenses?', question: 'What are my largest expenses?', icon: TrendingUp },
  { label: 'Which customer pays late?', question: 'Which customer pays late?', icon: User },
];

// ─── Answer card ──────────────────────────────────────────────────────────────

function toneClasses(tone?: 'positive' | 'negative' | 'neutral') {
  switch (tone) {
    case 'positive':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
    case 'negative':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function AnswerCard({ answer }: { answer: BankingInsightAnswer }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
          <Sparkles className="h-3 w-3" />
          {answer.label}
        </Badge>
      </div>

      {/* Narrative */}
      <div className="space-y-1.5 text-foreground">{renderMarkdown(answer.answer)}</div>

      {/* Metrics */}
      {answer.metrics && answer.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {answer.metrics.map((m, i) => (
            <div key={i} className={`rounded-md border p-2 ${toneClasses(m.tone)}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-80">{m.label}</div>
              <div className="text-sm font-semibold">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {answer.table && answer.table.rows.length > 0 && (
        <div className={`max-h-[300px] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                {answer.table.columns.map((c) => (
                  <TableHead key={c} className="text-[11px]">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {answer.table.rows.map((row, i) => (
                <TableRow key={i} className="text-xs">
                  {answer.table!.columns.map((c) => (
                    <TableCell key={c} className="whitespace-nowrap">{String(row[c] ?? '—')}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Chat message ─────────────────────────────────────────────────────────────

function ChatMessage({ item }: { item: ChatItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200">
          {item.question}
        </div>
      </div>

      {/* AI answer */}
      <div className="flex justify-start">
        <div className="w-full max-w-[95%] rounded-lg border bg-card p-3">
          {item.loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-violet-500" />
              Thinking…
            </div>
          ) : item.error ? (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {item.error}
            </div>
          ) : item.answer ? (
            <AnswerCard answer={item.answer} />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function AIInsightsTab() {
  const [items, setItems] = React.useState<ChatItem[]>([]);
  const [question, setQuestion] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new items
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items]);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setQuestion('');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem: ChatItem = { id, question: trimmed, loading: true };
    setItems((prev) => [...prev, newItem]);

    try {
      const res = await apiPost<{ ok: boolean; answer: BankingInsightAnswer }>(
        '/api/banking-intel/insights',
        { question: trimmed },
      );
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, loading: false, answer: res.answer } : it)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to get answer';
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, loading: false, error: msg } : it)),
      );
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  const retry = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      ask(item.question);
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── Header note ─── */}
      <Card className="border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Powered by Oracle Banking Intelligence</p>
            <p className="text-xs text-muted-foreground">
              Answers from your live banking data. Try one of the suggested questions below or ask your own.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Suggested chips ─── */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              disabled={pending}
              onClick={() => ask(s.question)}
              className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-violet-500" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ─── Chat history ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription className="text-xs">
            {items.length === 0
              ? 'No questions yet — ask one above'
              : `${items.length} question${items.length === 1 ? '' : 's'} asked`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            className={`max-h-[500px] space-y-4 overflow-y-auto pr-1 ${SCROLLBAR_CLASS}`}
          >
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ChatMessage key={item.id} item={item} />
              ))}
            </AnimatePresence>

            {items.length === 0 && (
              <ProfessionalEmptyState
                icon={Sparkles}
                title="Ask anything about your banking"
                description="Total balance, expenses, unpaid invoices, cash forecast, suspicious activity — try a chip above or type your question below."
                accent="violet"
                compact
              />
            )}

            {/* Retry button for errored items */}
            {items.some((i) => i.error) && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => {
                  const errItem = items.find((i) => i.error);
                  if (errItem) retry(errItem.id);
                }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry last
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Input bar ─── */}
      <Card>
        <CardContent className="py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your banking… (e.g. 'How much did I spend on rent last month?')"
              disabled={pending}
              className="flex-1"
            />
            <Button type="submit" loading={pending} disabled={!question.trim()}>
              {!pending && <Send className="h-4 w-4" />}
              Ask
            </Button>
          </form>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Tip: questions are matched to 8 canonical banking queries; free-text questions get a generic summary.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIInsightsTab;

// ─── Skeleton (kept for shell fallback parity) ────────────────────────────────

export function AIInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
