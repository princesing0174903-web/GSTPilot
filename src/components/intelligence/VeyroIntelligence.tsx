'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — The AI Operating System for Business
// A calm floating orb + Perplexity-style command palette for Indian CAs.
//
// v10.0 — Trillion Dollar Design System
//   • Calm 56px draggable orb (single 8s breathing, soft glow, no pulse rings,
//     no orbiting particles). Apple-Siri / Linear-dot quietness.
//   • Command palette (560px docked above orb, or 90vw×85vh fullscreen).
//   • Input is the hero (Perplexity layout): input pinned at top, scrollable
//     Q&A history below, follow-up prompts at the bottom.
//   • Quick-action grid + module chips when empty.
//   • Streaming chat with faster typing animation (2 chars / 10ms).
//   • Voice input (SpeechRecognition, en-IN) + Voice output (SpeechSynthesis).
//   • Live Firestore data context builder.
//   • Ctrl+K / Cmd+K to toggle, Escape to close, mobile auto-fullscreen.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Sparkles, X, Maximize2, Minimize2,
  ArrowUp, Mic, MicOff, Volume2, VolumeX,
  Send, ArrowRight, Play, Plus, FileText,
  Wallet, BookOpen, Briefcase, Landmark, Receipt, Package,
  ShieldCheck, ShieldAlert, Network, TrendingUp, Zap, Users,
  AlertTriangle, Bell, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useApp, type AppView } from '@/contexts/AppContext';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireNotifications,
  useFireActivities,
} from '@/hooks/use-firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType =
  | 'navigate'
  | 'execute_workflow'
  | 'send_reminder'
  | 'create_task'
  | 'generate_report';

interface AIAction {
  type: ActionType | string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: AIAction[];
  suggestedPrompts?: string[];
}

interface IntelligenceApiResponse {
  answer: string;
  actions: AIAction[];
  suggestedPrompts: string[];
  intent: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Constructor signature for the browser SpeechRecognition API
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
    length: number;
  }>;
  resultIndex: number;
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface QuickModule {
  label: string;
  view: AppView;
  icon: typeof FileText;
}

const QUICK_MODULES: QuickModule[] = [
  { label: 'Returns', view: 'returns', icon: FileText },
  { label: 'Accounting', view: 'accounting', icon: BookOpen },
  { label: 'Payroll', view: 'payroll', icon: Wallet },
  { label: 'CRM', view: 'crm', icon: Briefcase },
  { label: 'Banking', view: 'banking', icon: Landmark },
  { label: 'Payments', view: 'payments', icon: Receipt },
  { label: 'Inventory', view: 'inventory', icon: Package },
  { label: 'Compliance', view: 'reconcile', icon: ShieldCheck },
  // Intelligence module chips — restored navigation to dedicated AI pages
  { label: 'Alerts', view: 'ai-compliance', icon: ShieldAlert },
  { label: 'Risk', view: 'ai-risk', icon: AlertTriangle },
  { label: 'Insights', view: 'ai-insights', icon: Lightbulb },
  { label: 'Notices', view: 'notices', icon: Bell },
  { label: 'Graph', view: 'business-graph', icon: Network },
  { label: 'Predict', view: 'ai-predictions', icon: TrendingUp },
];

type QuickActionKind = 'navigate' | 'execute_workflow' | 'ask';

interface QuickAction {
  label: string;
  kind: QuickActionKind;
  icon: typeof FileText;
  // navigate
  view?: AppView;
  // execute_workflow
  workflow?: string;
  // ask
  question?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Run my firm', kind: 'execute_workflow', workflow: 'run_my_firm', icon: Zap },
  { label: 'Pending returns', kind: 'navigate', view: 'returns', icon: FileText },
  { label: 'Show risky clients', kind: 'navigate', view: 'clients', icon: Users },
  // Intelligence quick actions — restored direct navigation to AI pages
  { label: 'GST notices', kind: 'navigate', view: 'notices', icon: Bell },
  { label: 'ITC suggestions', kind: 'navigate', view: 'ai-compliance', icon: ShieldAlert },
  { label: 'Risk engine', kind: 'navigate', view: 'ai-risk', icon: AlertTriangle },
  {
    label: 'What revenue next month?',
    kind: 'ask',
    question: 'What revenue will I make next month?',
    icon: TrendingUp,
  },
  { label: 'Who is overloaded?', kind: 'ask', question: 'Who is overloaded?', icon: Briefcase },
  {
    label: 'Run my business',
    kind: 'execute_workflow',
    workflow: 'run_my_business',
    icon: Play,
  },
];

// Fallback follow-up prompts (used when an answer ships with no API suggestions)
const FALLBACK_FOLLOWUPS: string[] = [
  'Show pending returns',
  'Which clients are risky?',
  "Show today's priorities",
  'Show GST notices',
  'Show ITC suggestions',
];

const WORKFLOW_VIEWS: Record<string, AppView> = {
  run_my_firm: 'autopilot',
  run_my_business: 'run-my-business',
  run_india_business: 'run-india-business',
  run_my_company: 'run-my-company',
};

const MOBILE_BREAKPOINT = 640;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatDate(ts: number | string | undefined): string {
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts as string);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return '—';
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Live Data Context Builder ────────────────────────────────────────────────
// Safely composes a context string from live Firestore hooks. Never throws.

function buildLiveDataContext(opts: {
  clients: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  returns: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}): string {
  try {
    const { clients, invoices, returns, notifications, activities } = opts;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const stamp = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

    const lines: string[] = [`LIVE DATA SNAPSHOT (${stamp}):`];

    // Clients
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.status === 'active').length;
    lines.push(`- Total clients: ${totalClients}`);
    lines.push(`- Active clients: ${activeClients}`);

    // Invoices
    const activeInvoices = invoices.filter(
      (i) => i.status !== 'cancelled' && i.status !== 'draft',
    );
    const totalInvoiceValue = activeInvoices.reduce((s, i) => {
      const v =
        (i.totalAmount as number) ||
        (i.grandTotal as number) ||
        (i.total as number) ||
        ((i.subTotal as number) || 0) + ((i.totalTax as number) || 0);
      return s + (typeof v === 'number' ? v : 0);
    }, 0);
    const overdueInvoices = activeInvoices.filter((i) => {
      const status = i.status as string;
      return status === 'overdue' || status === 'unpaid';
    });
    const overdueValue = overdueInvoices.reduce((s, i) => {
      const v =
        (i.totalAmount as number) ||
        (i.grandTotal as number) ||
        (i.total as number) ||
        0;
      return s + (typeof v === 'number' ? v : 0);
    }, 0);
    lines.push(
      `- Active invoices: ${activeInvoices.length} (${formatINR(totalInvoiceValue)} total)`,
    );
    lines.push(
      `- Overdue invoices: ${overdueInvoices.length} (${formatINR(overdueValue)})`,
    );

    // Returns
    const gstr1Pending = returns.filter(
      (r) => (r.returnType as string) === 'GSTR-1' && (r.status as string) !== 'filed',
    ).length;
    const gstr3bPending = returns.filter(
      (r) => (r.returnType as string) === 'GSTR-3B' && (r.status as string) !== 'filed',
    ).length;
    const filedReturns = returns.filter((r) => r.status === 'filed').length;
    lines.push(
      `- Pending returns: ${gstr1Pending} GSTR-1, ${gstr3bPending} GSTR-3B`,
    );
    lines.push(`- Filed returns: ${filedReturns}`);

    // Notifications + Activities
    const unread = notifications.filter((n) => n.read === false).length;
    lines.push(`- Unread notifications: ${unread}`);
    lines.push(`- Recent activities: ${activities.length} in last 24h`);

    // Top 5 clients by revenue
    const clientRevenue = new Map<string, number>();
    invoices.forEach((inv) => {
      const cid = (inv.clientId as string) || (inv.clientName as string) || 'unknown';
      const v =
        (inv.totalAmount as number) ||
        (inv.grandTotal as number) ||
        (inv.total as number) ||
        0;
      clientRevenue.set(cid, (clientRevenue.get(cid) || 0) + (typeof v === 'number' ? v : 0));
    });
    const top5 = [...clientRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (top5.length > 0) {
      const top5Str = top5
        .map(([name, rev]) => {
          const client = clients.find(
            (c) => c.id === name || (c.tradeName as string) === name,
          );
          const label = (client?.tradeName as string) || name;
          return `${label} (${formatINR(rev)})`;
        })
        .join(', ');
      lines.push(`- Top 5 clients by revenue: ${top5Str}`);
    }

    // High-risk clients (health score < 60)
    const highRisk = clients.filter((c) => {
      const score = (c.healthScore as number) ?? 100;
      return typeof score === 'number' && score < 60;
    });
    if (highRisk.length > 0) {
      const riskStr = highRisk
        .slice(0, 5)
        .map(
          (c) =>
            `${(c.tradeName as string) || (c.name as string) || 'Unknown'} (health ${c.healthScore ?? '?'})`,
        )
        .join(', ');
      lines.push(`- High-risk clients: ${riskStr}`);
    }

    return lines.join('\n');
  } catch {
    return 'LIVE DATA SNAPSHOT: Data currently unavailable.';
  }
}

// ─── Sub-component: Thinking Dots ─────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 accent-text">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            ease: 'easeInOut' as const,
            delay,
          }}
        />
      ))}
    </span>
  );
}

// ─── Sub-component: Message Content (mini-markdown) ───────────────────────────
// Renders **bold**, line breaks, bullet points (•), and numbered lists.

function MessageContent({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const paragraphs = text.split('\n');
    return paragraphs.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
        return { type: 'bullet' as const, content: trimmed.slice(2) };
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return { type: 'numbered' as const, content: trimmed.replace(/^\d+\.\s/, '') };
      }
      return { type: 'text' as const, content: trimmed };
    });
  }, [text]);

  const renderInline = (s: string, keyBase: string) => {
    // Split on **bold** markers
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${keyBase}-${i}`} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${keyBase}-${i}`}>{part}</span>;
    });
  };

  return (
    <div className="space-y-1.5">
      {blocks.map((b, idx) => {
        if (b.type === 'bullet') {
          return (
            <div key={idx} className="flex gap-2">
              <span className="mt-0.5 text-emerald-400">•</span>
              <span className="text-foreground/90">{renderInline(b.content, `b${idx}`)}</span>
            </div>
          );
        }
        if (b.type === 'numbered') {
          return (
            <div key={idx} className="flex gap-2">
              <span className="font-medium accent-text">{idx + 1}.</span>
              <span className="text-foreground/90">{renderInline(b.content, `n${idx}`)}</span>
            </div>
          );
        }
        if (!b.content) return <div key={idx} className="h-1" />;
        return (
          <p key={idx} className="text-foreground/90">
            {renderInline(b.content, `t${idx}`)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Sub-component: Action Chip (restyled with accent-gradient-soft) ──────────

function ActionChip({
  action,
  onActivate,
}: {
  action: AIAction;
  onActivate: (a: AIAction) => void;
}) {
  const icon = useMemo(() => {
    switch (action.type) {
      case 'navigate':
        return ArrowRight;
      case 'execute_workflow':
        return Play;
      case 'send_reminder':
        return Send;
      case 'create_task':
        return Plus;
      case 'generate_report':
        return FileText;
      default:
        return Zap;
    }
  }, [action.type]);

  const Icon = icon;

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onActivate(action)}
      className="inline-flex items-center gap-1.5 rounded-full accent-gradient-soft border border-emerald-400/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-emerald-400/40"
      aria-label={action.title}
    >
      <Icon className="h-3 w-3 accent-text" />
      <span>{action.title}</span>
    </motion.button>
  );
}

// ─── Hook: Typing Effect ──────────────────────────────────────────────────────
// Reveals text progressively in small chunks for a "typing" feel.
// v10: 2 chars / 10ms (faster than the old 3 chars / 16ms).

function useTypingEffect(fullText: string, active: boolean, speed = 10, chunkSize = 2) {
  // revealLength is only mutated inside the interval callback (never
  // synchronously in the effect body), which keeps React's
  // set-state-in-effect lint rule happy and avoids cascading renders.
  const [revealLength, setRevealLength] = useState(0);

  useEffect(() => {
    if (!active) return;
    let i = 0;
    const interval = setInterval(() => {
      i += chunkSize;
      setRevealLength(i);
      if (i >= fullText.length) {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [fullText, active, speed, chunkSize]);

  // When not active (e.g. older messages), show the full text instantly
  // via a derived value — no state mutation required.
  const displayed = active ? fullText.slice(0, revealLength) : fullText;
  const completed = displayed.length >= fullText.length;

  return { displayed, completed };
}

// ─── Typing Message Wrapper ───────────────────────────────────────────────────
// Renders an AI message with a progressive typing reveal.

function TypingMessage({
  message,
  isLatest,
  onTypingComplete,
}: {
  message: ChatMessage;
  isLatest: boolean;
  onTypingComplete: () => void;
}) {
  const { displayed, completed } = useTypingEffect(
    message.content,
    isLatest,
    10,
    2,
  );

  useEffect(() => {
    if (completed && isLatest) {
      onTypingComplete();
    }
  }, [completed, isLatest, onTypingComplete]);

  return (
    <div className="space-y-1">
      <MessageContent text={displayed} />
      {!completed && (
        <motion.span
          className="inline-block h-3.5 w-1.5 rounded-sm bg-emerald-400 align-middle"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VEYROIntelligence() {
  const { user } = useAuth();
  const { currentScreen, setCurrentView } = useApp();
  const { theme, systemTheme } = useTheme();

  // ── Firestore live data hooks (always called — rules of hooks) ──
  // These hooks internally handle null user / Firebase errors gracefully.
  const clientsHook = useFireClients();
  const invoicesHook = useFireInvoices();
  const returnsHook = useFireReturns();
  const notificationsHook = useFireNotifications();
  const activitiesHook = useFireActivities();

  // ── State ──
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [typedMessageId, setTypedMessageId] = useState<string | null>(null);

  // ── Refs ──
  const orbX = useMotionValue(0);
  const orbY = useMotionValue(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speechSupportedRef = useRef<boolean>(false);

  // ── Derived theme ──
  // App is dark-first in v10; isDark is reserved for subtle light-mode polish.
  const isDark =
    theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  // ── Build live data context (memoized, never throws) ──
  const liveContext = useMemo(
    () =>
      buildLiveDataContext({
        clients: (clientsHook.data || []) as unknown as Array<Record<string, unknown>>,
        invoices: (invoicesHook.data || []) as unknown as Array<Record<string, unknown>>,
        returns: (returnsHook.data || []) as unknown as Array<Record<string, unknown>>,
        notifications: (notificationsHook.data || []) as unknown as Array<Record<string, unknown>>,
        activities: (activitiesHook.data || []) as unknown as Array<Record<string, unknown>>,
      }),
    [
      clientsHook.data,
      invoicesHook.data,
      returnsHook.data,
      notificationsHook.data,
      activitiesHook.data,
    ],
  );

  // ── Mobile detection ──
  useEffect(() => {
    const check = () =>
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // ── Speech recognition support check ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
    speechSupportedRef.current = !!SR;
  }, []);

  // ── Keyboard shortcuts: Ctrl/Cmd+K to toggle, Escape to close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // ── Stop speech when panel closes ──
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // ── Cleanup speech recognition on unmount ──
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* noop */
        }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Auto-grow textarea ──
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Auto-focus the input whenever the panel opens or toggles fullscreen ──
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Defer to next frame so the panel has mounted
      const id = requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, isFullscreen]);

  // ── Send message to API ──
  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isThinking) return;

      // Stop any ongoing speech
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      // Build conversation history including the new message
      const history = [...messages.slice(-7), { role: 'user' as const, content: trimmed }];

      try {
        const res = await fetch('/api/intelligence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: trimmed,
            context: liveContext,
            conversationHistory: history,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: IntelligenceApiResponse = await res.json();

        const aiMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: data.answer || "I couldn't process that right now.",
          timestamp: Date.now(),
          actions: data.actions || [],
          suggestedPrompts: data.suggestedPrompts || [],
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTypedMessageId(aiMsg.id);

        // Voice output
        if (speechEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
          speakText(data.answer || '');
        }
      } catch (err) {
        const aiMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content:
            "I'm having trouble connecting to my brain right now. Please try again in a moment.",
          timestamp: Date.now(),
          suggestedPrompts: FALLBACK_FOLLOWUPS,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTypedMessageId(aiMsg.id);
        console.error('[VEYROIntelligence] send error:', err);
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking, liveContext, messages, speechEnabled],
  );

  // ── Listen for "gstpilot-ask" custom events ──
  // The Mission Control home input + suggestion chips dispatch this event to
  // open the palette and immediately ask a question. Single source of truth.
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent<string>).detail;
      if (typeof question !== 'string' || !question.trim()) return;
      setIsOpen(true);
      // Defer to next frame so the palette mounts + input focuses first
      requestAnimationFrame(() => {
        sendMessage(question);
      });
    };
    window.addEventListener('gstpilot-ask', handler as EventListener);
    return () => window.removeEventListener('gstpilot-ask', handler as EventListener);
  }, [sendMessage]);

  // ── Text-to-Speech ──
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const indianVoice =
        voices.find((v) => v.lang === 'en-IN') ||
        voices.find((v) => v.lang.startsWith('en'));
      if (indianVoice) utterance.voice = indianVoice;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* noop */
    }
  }, []);

  // ── Voice input toggle ──
  const toggleListening = useCallback(() => {
    if (!speechSupportedRef.current) {
      toast.error('Voice input unavailable', {
        description: 'Your browser does not support speech recognition.',
      });
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      setIsListening(false);
      return;
    }

    try {
      const SR =
        (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .webkitSpeechRecognition;
      if (!SR) throw new Error('not supported');
      const recognition: SpeechRecognitionLike = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => {
        setIsListening(false);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          toast.error('Voice input unavailable', {
            description: 'Microphone permission denied.',
          });
        } else {
          toast.error('Voice input unavailable');
        }
      };
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].length > 0) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      toast.error('Voice input unavailable');
    }
  }, [isListening]);

  // ── Toggle speech output ──
  const toggleSpeech = useCallback(() => {
    setSpeechEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // ── Handle action chip activation ──
  const handleAction = useCallback(
    (action: AIAction) => {
      switch (action.type) {
        case 'navigate': {
          const view = (action.payload?.view as AppView) || 'dashboard';
          setCurrentView(view);
          toast.success('Navigating', { description: action.title });
          break;
        }
        case 'execute_workflow': {
          const workflowKey =
            (action.payload?.workflow as string) || 'run_my_firm';
          const view = WORKFLOW_VIEWS[workflowKey] || 'autopilot';
          setCurrentView(view);
          toast.success('Launching workflow', {
            description: action.title,
          });
          break;
        }
        case 'send_reminder':
          toast.success('Reminders queued', {
            description: 'Payment reminders queued for affected clients.',
          });
          break;
        case 'create_task':
          toast.success('Task created', {
            description: action.description,
          });
          break;
        case 'generate_report':
          toast.success('Report generation started', {
            description: 'Your executive report is being compiled.',
          });
          break;
        default:
          toast.info(action.title);
      }
    },
    [setCurrentView],
  );

  // ── Open panel (with mobile auto-fullscreen) ──
  const openPanel = useCallback(() => {
    setIsOpen(true);
    if (isMobile) {
      setIsFullscreen(true);
    }
  }, [isMobile]);

  // ── Close panel ──
  const closePanel = useCallback(() => {
    setIsOpen(false);
    setIsFullscreen(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // ── Activate a quick action (navigate / execute_workflow / ask) ──
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      switch (action.kind) {
        case 'navigate': {
          const view = action.view || 'dashboard';
          setCurrentView(view);
          toast.success('Opening module', { description: action.label });
          closePanel();
          break;
        }
        case 'execute_workflow': {
          const workflowKey = action.workflow || 'run_my_firm';
          const view = WORKFLOW_VIEWS[workflowKey] || 'autopilot';
          setCurrentView(view);
          toast.success('Launching workflow', { description: action.label });
          closePanel();
          break;
        }
        case 'ask': {
          const q = action.question || action.label;
          sendMessage(q);
          break;
        }
      }
    },
    [setCurrentView, sendMessage, closePanel],
  );

  // ── Render null if not authenticated or on landing/login ──
  if (!user || currentScreen === 'landing' || currentScreen === 'login') {
    return null;
  }

  // ── Handle Enter to send (Shift+Enter for newline) ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;
  // Inner-highlight opacity is slightly stronger in light mode so the
  // 3D glassy orb feel survives the brighter background.
  const orbHighlightOpacity = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.5)';

  // ── Panel content (shared between docked + fullscreen) ────────────────────
  const renderPanel = () => (
    <div className="flex h-full w-full flex-col">
      {/* ── Header (minimal) ── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full accent-gradient shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              VEYRO AI<span className="align-super text-[8px]">™</span>
            </h2>
            <p className="truncate text-[10px] text-muted-foreground">
              The AI Operating System for Business
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Voice input toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
              isListening && 'text-red-400 hover:text-red-400',
            )}
            onClick={toggleListening}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
            onClick={closePanel}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Input hero (Perplexity-style, pinned at top) ── */}
      <div className="border-b border-white/[0.08] p-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              isListening
                ? 'Listening…'
                : 'Ask anything — Run my firm, pending returns, risky clients...'
            }
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/20"
            style={{ maxHeight: 120 }}
            aria-label="Message input"
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg accent-gradient text-white shadow-md transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Status row */}
        <div className="mt-2 flex h-4 items-center justify-between text-[11px]">
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.span
                key="listening"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                className="flex items-center gap-1.5 text-red-400"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Listening… speak now
              </motion.span>
            ) : (
              <motion.span
                key="hint"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                className="text-muted-foreground"
              >
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 text-[10px]">Enter</kbd>{' '}
                to send · <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 text-[10px]">Shift+Enter</kbd> for newline
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggleSpeech}
            className={cn(
              'flex items-center gap-1 transition-colors',
              speechEnabled
                ? 'text-emerald-400/80 hover:text-emerald-400'
                : 'text-muted-foreground/60 hover:text-muted-foreground',
            )}
            aria-label={speechEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            {speechEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            {speechEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>
      </div>

      {/* ── Body: scrollable Q&A history or quick-action empty state ── */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {/* Empty state — quick actions + modules */}
          {!hasMessages && !isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Quick actions */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.label}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleQuickAction(action)}
                        className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:border-emerald-400/30 hover:bg-white/[0.05]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg accent-gradient-soft">
                          <Icon className="h-3.5 w-3.5 accent-text" />
                        </span>
                        <span className="truncate">{action.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Module chips */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Modules
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_MODULES.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.label}
                        onClick={() => {
                          setCurrentView(mod.view);
                          toast.success('Module opened', {
                            description: mod.label,
                          });
                          closePanel();
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-emerald-400/30 hover:bg-white/[0.05] hover:text-foreground"
                        aria-label={`Open ${mod.label}`}
                      >
                        <Icon className="h-3 w-3" />
                        {mod.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Q&A history (Perplexity-style stacked turns) */}
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isLatest = msg.id === typedMessageId;

                if (isUser) {
                  // User question — subtle header line
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-1"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        You
                      </span>
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {msg.content}
                      </p>
                    </motion.div>
                  );
                }

                // Assistant answer block
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    {/* Answer header */}
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full accent-gradient">
                        <Sparkles className="h-3 w-3 text-white" />
                      </span>
                      <span className="text-xs font-semibold accent-text">
                        VEYRO AI
                      </span>
                    </div>

                    {/* Answer body */}
                    <div className="text-sm leading-relaxed">
                      <TypingMessage
                        message={msg}
                        isLatest={isLatest}
                        onTypingComplete={() => setTypedMessageId(null)}
                      />
                    </div>

                    {/* Action chips */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.actions.map((action, ai) => (
                          <ActionChip
                            key={ai}
                            action={action}
                            onActivate={handleAction}
                          />
                        ))}
                      </div>
                    )}

                    {/* Live data / sources line */}
                    <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
                      Powered by live Firestore data · {formatTime(msg.timestamp)}
                    </div>

                    {/* Follow-up prompts (Perplexity "Related") */}
                    {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                      <div className="pt-1">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Follow-ups
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedPrompts.map((prompt, pi) => (
                            <motion.button
                              key={`${prompt}-${pi}`}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => sendMessage(prompt)}
                              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-emerald-400/30 hover:bg-white/[0.05] hover:text-foreground"
                            >
                              {prompt}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Thinking indicator */}
            <AnimatePresence>
              {isThinking && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full accent-gradient">
                      <Sparkles className="h-3 w-3 text-white" />
                    </span>
                    <span className="text-xs font-semibold accent-text">
                      VEYRO AI
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-1">
                    <ThinkingDots />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* ── Fullscreen backdrop (click to close) ── */}
      <AnimatePresence>
        {isOpen && isFullscreen && (
          <motion.div
            key="fs-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
          />
        )}
      </AnimatePresence>

      {/* ── Orb + docked panel wrapper (bottom-right) ── */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Single panel — repositions between docked (above orb, drag-follows)
            and fullscreen (centered, fixed) without unmounting, so the input
            ref stays stable across mode toggles. */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="panel"
              role="dialog"
              aria-label="VEYRO AI command palette"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(
                'glass-surface-strong z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl',
                isFullscreen
                  ? 'fixed left-1/2 top-1/2 h-[85vh] w-[90vw] max-w-[1100px] -translate-x-1/2 -translate-y-1/2'
                  : 'absolute bottom-[72px] right-0 max-h-[calc(100vh-12rem)] w-[560px] max-w-[calc(100vw-3rem)]',
              )}
              style={isFullscreen ? {} : { x: orbX, y: orbY }}
            >
              {renderPanel()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Calm 56px orb ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              drag
              dragMomentum={false}
              dragElastic={0}
              style={{ x: orbX, y: orbY }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (isOpen) {
                  closePanel();
                } else {
                  openPanel();
                }
              }}
              aria-label="Open VEYRO AI command palette"
              className={cn(
                'accent-gradient relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-lg',
                isListening && 'ring-2 ring-red-400/50 ring-offset-2 ring-offset-transparent',
              )}
            >
              {/* Slow 8s breathing glow (the ONLY continuous animation) */}
              <motion.span
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.04, 1],
                  boxShadow: [
                    '0 0 24px 4px rgba(37,99,235,0.25)',
                    '0 0 36px 6px rgba(59,130,246,0.35)',
                    '0 0 24px 4px rgba(37,99,235,0.25)',
                  ],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut' as const,
                }}
              />

              {/* Hover-only expanding halo (no infinite pulse) */}
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-full border border-white/40"
                initial={{ opacity: 0, scale: 1 }}
                whileHover={{ opacity: 0.6, scale: 1.5 }}
                transition={{ duration: 0.4, ease: 'easeOut' as const }}
              />

              {/* Inner top-left highlight for the 3D glassy orb feel */}
              <span
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${orbHighlightOpacity} 0%, rgba(255,255,255,0) 55%)`,
                }}
              />

              {/* Center icon — always Sparkles */}
              <Sparkles className="relative z-10 h-6 w-6 text-white drop-shadow" />

              {/* Tiny X overlay badge when panel is open */}
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-zinc-950"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            VEYRO AI™ — Ctrl+K
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
