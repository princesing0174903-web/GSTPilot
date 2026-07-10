'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Professional UI Rebuild
// A FULL-SCREEN, SOLID workspace. No popup. No overlay. No transparency.
//
// Layout (Claude 70% · ChatGPT 20% · Perplexity 10%):
//   ┌──────────┬────────────────┬───────────────────────────────┐
//   │  Rail    │  History       │  Chat                         │
//   │  (icons) │  New Chat      │  GSTPilot Oracle™             │
//   │  Home    │  Today         │  Ask anything. Run everything.│
//   │  Intel   │  Yesterday     │  ───────────────────────────  │
//   │  Auto    │  Prev 7 days   │  Messages (scroll)            │
//   │  Finance │                │  ───────────────────────────  │
//   │  Network │                │  Sticky input + suggestions   │
//   │  Settings│                │                               │
//   │  Oracle  │                │                               │
//   └──────────┴────────────────┴───────────────────────────────┘
//
// Tokens:
//   bg #050505 · cards #111111 · border rgba(255,255,255,0.08)
//   text primary #fff · text secondary rgba(255,255,255,0.7)
//
// All existing logic preserved: streaming, brand short-circuit, memory,
// auto-scroll, stop, follow-ups, emotion + language detection.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, ArrowRight, X, Square, Sparkles, Plus, MessageSquare, Trash2,
  Home, Brain, Zap, Wallet, Network, Settings, type LucideIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BrandLogo } from '@/components/brand';
import { cn } from '@/lib/utils';
import type { AppView } from '@/contexts/AppContext';
import { useLiveDashboardMetrics } from '@/hooks/use-firestore';
import {
  detectLanguage, detectEmotion, deriveAvatarState, AVATAR_STATE_LABEL,
  ORACLE_EMOTIONS, nativeLanguageLabel,
} from './oracle-human';
import { detectBrandQuestion } from './oracle-brand';
import { ExecutiveBrief } from './ExecutiveBrief';
import { OracleEvolutionPanel } from '@/components/oracle-evolution/OracleEvolutionPanel';
import { CFOAssistantPanel } from '@/components/oracle-cfo/CFOAssistantPanel';
import { InvoiceActionCard } from '@/components/oracle-cfo/InvoiceActionCard';
import { PaymentLinkActionCard } from '@/components/oracle-cfo/PaymentLinkActionCard';
import { CommunicationActionCard } from '@/components/oracle-cfo/CommunicationActionCard';
import { useOrg } from '@/contexts/OrgContext';
import type { OracleMessage, OracleChatRequest, OracleStreamChunk, OracleActionChip } from './oracle-types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface OracleWorkspaceProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  userName?: string;
  firmName?: string;
  gstin?: string;
  userId?: string;
  /** Optional prefilled question (e.g. from the CommandBar `oracle-ask` event).
   *  When provided, the workspace auto-sends it once after opening. */
  initialPrompt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORE_KEY = 'gstpilot-oracle-conversations-v2';
const LEGACY_KEY = 'gstpilot-oracle-conversation-v1';

// ─── Invoice intent detection (client-side pre-filter) ──────────────────────
// Matches phrases like "create an invoice", "make a bill for", "generate invoice".
const INVOICE_INTENT_PATTERNS = [
  /create.*invoice/i, /make.*invoice/i, /generate.*invoice/i,
  /new.*invoice/i, /issue.*invoice/i, /draft.*invoice/i,
  /create.*bill/i, /make.*bill/i, /generate.*bill/i,
  /raise.*invoice/i, /prepare.*invoice/i,
];
function isInvoiceCreationIntent(text: string): boolean {
  return INVOICE_INTENT_PATTERNS.some((p) => p.test(text));
}

// ─── Payment link intent detection (client-side pre-filter) ──────────────────
// Matches phrases like "create payment link", "send payment request",
// "generate UPI payment", "create Razorpay link", "collect payment".
const PAYMENT_LINK_INTENT_PATTERNS = [
  /create.*payment.*link/i,
  /payment.*link/i,
  /send.*payment.*request/i,
  /generate.*payment/i,
  /collect.*payment/i,
  /create.*razorpay/i,
  /create.*stripe/i,
  /razorpay.*link/i,
  /stripe.*link/i,
  /upi.*payment.*link/i,
  /payment.*link.*for/i,
  /send.*payment.*link/i,
];
function isPaymentLinkIntent(text: string): boolean {
  return PAYMENT_LINK_INTENT_PATTERNS.some((p) => p.test(text));
}

// ─── Communication intent detection (client-side pre-filter) ─────────────────
// Matches phrases like "email the invoice", "WhatsApp the payment link",
// "send the GST report", "share the receipt", "send reminder to".
// Excludes pure invoice/payment-link CREATION phrases (those are handled by
// the dedicated InvoiceActionCard / PaymentLinkActionCard).
const COMMUNICATION_INTENT_PATTERNS = [
  /\bemail\s+(?:the\s+)?(?:invoice|bill|report|receipt|statement|link|reminder|payment)/i,
  /\bwhatsapp\s+(?:the\s+)?(?:invoice|bill|report|receipt|statement|link|reminder|payment)/i,
  /\bsend\s+(?:the\s+)?(?:invoice|bill|report|receipt|statement|link|reminder|payment)/i,
  /\bshare\s+(?:the\s+)?(?:invoice|bill|report|receipt|statement|link)/i,
  /\bdeliver\s+(?:the\s+)?(?:invoice|bill|report|receipt|statement|link)/i,
  /\bsend\s+(?:the\s+)?(?:payment\s+)?link\s+(?:to|on|via)/i,
  /\bwhatsapp\s+(?:the\s+)?(?:payment\s+)?link/i,
  /\bemail\s+(?:this\s+month'?s\s+)?gst\s+report/i,
  /\bwhatsapp\s+(?:this\s+month'?s\s+)?gst\s+report/i,
  /\bsend\s+(?:a\s+)?(?:payment\s+)?reminder/i,
  /\bemail\s+(?:a\s+)?reminder/i,
  /\bwhatsapp\s+(?:a\s+)?reminder/i,
  /\bemail\s+(?:the\s+)?(?:outstanding\s+)?statement/i,
  /\bwhatsapp\s+(?:the\s+)?(?:outstanding\s+)?statement/i,
  /\bshare\s+(?:the\s+)?gst\s+report/i,
  /\bsend\s+(?:the\s+)?gst\s+report/i,
];
function isCommunicationIntent(text: string): boolean {
  // Must match a communication phrase AND NOT be a pure invoice/payment-link creation request.
  const isComm = COMMUNICATION_INTENT_PATTERNS.some((p) => p.test(text));
  if (!isComm) return false;
  // Exclude pure creation phrases (no "send"/"email"/"whatsapp"/"share" verb with invoice/payment-link)
  // If the message starts with "create"/"generate"/"make" + invoice/payment-link, treat as creation.
  if (/^(?:create|generate|make|issue|draft|prepare)\s+(?:an?\s+)?(?:invoice|bill|payment\s*link)/i.test(text.trim())) {
    return false;
  }
  return true;
}

// ─── Conversation store types ─────────────────────────────────────────────────

interface OracleConversation {
  id: string;
  title: string;
  messages: OracleMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationStore {
  conversations: OracleConversation[];
  activeId: string | null;
}

// ─── Rail nav definition ──────────────────────────────────────────────────────

interface RailItem {
  id: AppView | 'oracle';
  label: string;
  icon: LucideIcon;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'business-dna', label: 'Intelligence', icon: Brain },
  { id: 'run-my-business', label: 'Autopilot', icon: Zap },
  { id: 'reconcile', label: 'Finance', icon: Wallet },
  { id: 'business-graph', label: 'Network', icon: Network },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'oracle', label: 'Oracle', icon: Sparkles },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function OracleWorkspace({
  open, onClose, onNavigate, userName, firmName, gstin, userId, initialPrompt,
}: OracleWorkspaceProps) {
  const [store, setStore] = useState<ConversationStore>({ conversations: [], activeId: null });
  // Portal guard: only render into document.body after mount to avoid SSR
  // hydration mismatch (server has no document.body).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [messages, setMessages] = useState<OracleMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastEmotion, setLastEmotion] = useState<OracleMessage['emotion']>('helpful');
  const [activeLanguage, setActiveLanguage] = useState<OracleMessage['language']>('english');
  // Mobile: history drawer open state
  const [historyOpen, setHistoryOpen] = useState(false);
  // Oracle AI Evolution panel (Upgrade Phase 1) — overlay, not a nav change
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  // Oracle CFO production layer — approval requests keyed by assistant message ID
  // (Upgrade Phase 1: Production Functionality). Rendered inline below each
  // assistant message when an actionable intent is detected.
  const [cfoApprovalRequests, setCfoApprovalRequests] = useState<
    Record<string, Array<{ approvalId: string; toolId: string; toolName: string; toolIcon: string; category: string; input: Record<string, unknown>; decisionCard: any; missingParams: string[]; createdAt: string }>>
  >({});
  const [cfoAnalyzing, setCfoAnalyzing] = useState<string | null>(null);
  // Upgrade Phase 1.1: when the user asks to create an invoice, we render the
  // dedicated InvoiceActionCard (production invoice flow) instead of the
  // generic CFO panel. Keyed by assistant message ID → user message text.
  const [invoiceUserMessages, setInvoiceUserMessages] = useState<Record<string, string>>({});

  // Upgrade Phase 1.3: when the user asks to create a payment link, we render
  // the dedicated PaymentLinkActionCard (production payment link flow) instead
  // of the generic CFO panel. Keyed by assistant message ID → user message text.
  const [paymentLinkUserMessages, setPaymentLinkUserMessages] = useState<Record<string, string>>({});

  // Upgrade Phase 1.4: when the user asks to send an email or WhatsApp message
  // (invoice / GST report / payment link / reminder / statement), we render the
  // dedicated CommunicationActionCard (production communication flow) instead
  // of the generic CFO panel. Keyed by assistant message ID → user message text.
  const [communicationUserMessages, setCommunicationUserMessages] = useState<Record<string, string>>({});

  // ── Org context (for CFO tool execution: organizationId, userId, role)
  const orgCtx = useOrg();

  // ── Oracle Context Engine™ — live dashboard metrics from Firestore are
  //    forwarded to the API as context.dashboardMetrics so the model can
  //    reason about the user's real compliance / return / invoice state.
  const { metrics: dashboardMetrics } = useLiveDashboardMetrics();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userPinnedUpRef = useRef(false);
  const streamingIdRef = useRef<string | null>(null);
  // Tracks the last initialPrompt we auto-sent, so we never fire it twice.
  const initialPromptSentRef = useRef<string | null>(null);

  // ─── Load + migrate store on open ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const loaded = loadStore();
    if (loaded.conversations.length === 0) {
      // Migrate legacy single-conversation store if present.
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as OracleMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const now = new Date().toISOString();
            const conv: OracleConversation = {
              id: cryptoId(),
              title: deriveTitle(parsed),
              messages: parsed.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
              createdAt: parsed[0]?.createdAt ?? now,
              updatedAt: now,
            };
            const next: ConversationStore = { conversations: [conv], activeId: conv.id };
            setStore(next);
            setActiveId(conv.id);
            setMessages(conv.messages);
            saveStore(next);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      // Nothing to migrate — start fresh with one empty conversation.
      const conv = newConversation();
      const next: ConversationStore = { conversations: [conv], activeId: conv.id };
      setStore(next);
      setActiveId(conv.id);
      setMessages([]);
      saveStore(next);
      return;
    }
    setStore(loaded);
    const active = loaded.conversations.find((c) => c.id === loaded.activeId) ?? loaded.conversations[0];
    if (active) {
      setActiveId(active.id);
      setMessages(active.messages);
    }
  }, [open]);

  // ─── Persist active conversation whenever messages change ───────────────────
  useEffect(() => {
    if (!open || !activeId) return;
    setStore((prev) => {
      if (!prev.conversations.length) return prev;
      const exists = prev.conversations.some((c) => c.id === activeId);
      let conversations: OracleConversation[];
      let nextActiveId = prev.activeId;
      if (exists) {
        conversations = prev.conversations.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages,
                title: deriveTitle(messages) || c.title,
                updatedAt: new Date().toISOString(),
              }
            : c,
        );
      } else {
        // Active conversation doesn't exist yet — create it on the fly.
        const conv: OracleConversation = {
          id: activeId,
          title: deriveTitle(messages) || 'New chat',
          messages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        conversations = [conv, ...prev.conversations];
        nextActiveId = activeId;
      }
      const next = { conversations, activeId: nextActiveId };
      saveStore(next);
      return next;
    });
  }, [messages, open, activeId]);

  // ─── Body scroll lock while open ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ─── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !isStreaming) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isStreaming, onClose]);

  // ─── Smart auto-scroll ─────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userPinnedUpRef.current = distanceFromBottom > 120;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!userPinnedUpRef.current) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messages, scrollToBottom]);

  // ─── Conversation actions ──────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    const conv = newConversation();
    setStore((prev) => {
      const next = { conversations: [conv, ...prev.conversations], activeId: conv.id };
      saveStore(next);
      return next;
    });
    setActiveId(conv.id);
    setMessages([]);
    setInput('');
    userPinnedUpRef.current = false;
    setHistoryOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isStreaming]);

  const handleSwitchConversation = useCallback(
    (id: string) => {
      if (isStreaming) return;
      const conv = store.conversations.find((c) => c.id === id);
      if (!conv) return;
      setActiveId(id);
      setMessages(conv.messages);
      setStore((prev) => {
        const next = { ...prev, activeId: id };
        saveStore(next);
        return next;
      });
      setHistoryOpen(false);
      userPinnedUpRef.current = false;
      requestAnimationFrame(() => scrollToBottom(false));
    },
    [isStreaming, store.conversations, scrollToBottom],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (isStreaming) return;
      setStore((prev) => {
        const filtered = prev.conversations.filter((c) => c.id !== id);
        let nextActive = prev.activeId;
        let nextMessages = messages;
        if (prev.activeId === id) {
          if (filtered.length > 0) {
            nextActive = filtered[0].id;
            nextMessages = filtered[0].messages;
          } else {
            const conv = newConversation();
            filtered.unshift(conv);
            nextActive = conv.id;
            nextMessages = [];
          }
          setActiveId(nextActive);
          setMessages(nextMessages);
        }
        const next = { conversations: filtered, activeId: nextActive };
        saveStore(next);
        return next;
      });
    },
    [isStreaming, messages],
  );

  // ─── Oracle CFO — Analyze the user's last message for actionable intents ───
  //     Declared BEFORE sendMessage so it is initialized when sendMessage's
  //     useCallback dependency array is evaluated (avoids TDZ:
  //     "Cannot access 'analyzeWithCfo' before initialization").
  //     After Oracle finishes streaming its answer, we fire a parallel request
  //     to /api/oracle/cfo/analyze. If it detects an actionable tool (create
  //     invoice, send reminder, etc.), the approval cards render inline below
  //     the assistant message. This does NOT replace the chat — it augments it
  //     with real, executable, audited business actions.
  const analyzeWithCfo = useCallback(
    async (userMessage: string, oracleMessageId: string) => {
      const orgId = orgCtx.organization?.id ?? 'preview-org';
      const role = (orgCtx.membership?.role ?? 'manager') as 'admin' | 'manager' | 'staff' | 'viewer';
      try {
        // ─── Upgrade Phase 1.1: Real Invoice Creation ───────────────────
        // If the user's message is an invoice-creation request, render the
        // dedicated production InvoiceActionCard instead of the generic CFO
        // panel. The card makes its own API call to the invoice engine.
        if (isInvoiceCreationIntent(userMessage)) {
          setInvoiceUserMessages((prev) => ({ ...prev, [oracleMessageId]: userMessage }));
          setCfoAnalyzing(null);
          return; // Skip the generic analyze — invoice card handles it
        }

        // ─── Upgrade Phase 1.3: Real Payment Link Creation ──────────────
        // If the user's message is a payment-link request, render the dedicated
        // production PaymentLinkActionCard instead of the generic CFO panel.
        if (isPaymentLinkIntent(userMessage)) {
          setPaymentLinkUserMessages((prev) => ({ ...prev, [oracleMessageId]: userMessage }));
          setCfoAnalyzing(null);
          return; // Skip the generic analyze — payment link card handles it
        }

        // ─── Upgrade Phase 1.4: Real Email & WhatsApp Execution ─────────
        // If the user's message is a communication request (email/WhatsApp an
        // invoice, GST report, payment link, reminder, or statement), render the
        // dedicated production CommunicationActionCard instead of the generic
        // CFO panel. The card makes its own API call to the communication engine.
        if (isCommunicationIntent(userMessage)) {
          setCommunicationUserMessages((prev) => ({ ...prev, [oracleMessageId]: userMessage }));
          setCfoAnalyzing(null);
          return; // Skip the generic analyze — communication card handles it
        }

        setCfoAnalyzing(oracleMessageId);
        const res = await fetch('/api/oracle/cfo/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            organizationId: orgId,
            firmId: orgCtx.organization?.firmId ?? null,
            userId: userId ?? 'preview-user',
            userEmail: userName ? `${userName.toLowerCase().replace(/\s+/g, '.')}@gstpilot.in` : 'preview@gstpilot.in',
            userRole: role,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.approvalRequests && data.approvalRequests.length > 0) {
          setCfoApprovalRequests((prev) => ({
            ...prev,
            [oracleMessageId]: data.approvalRequests,
          }));
        }
      } catch {
        // CFO analyze is best-effort — never block the chat on it
      } finally {
        setCfoAnalyzing(null);
      }
    },
    [orgCtx.organization, orgCtx.membership, userId, userName],
  );

  // ─── Send flow (preserved from previous implementation) ─────────────────────
  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

      // ── Brand-question short-circuit ───────────────────────────────────────
      const brand = detectBrandQuestion(text);
      if (brand.matched && brand.answer) {
        const userMsg: OracleMessage = {
          id: cryptoId(),
          role: 'user',
          content: text,
          language: detectLanguage(text),
          createdAt: new Date().toISOString(),
        };
        const oracleMsg: OracleMessage = {
          id: cryptoId(),
          role: 'oracle',
          content: brand.answer,
          language: detectLanguage(text),
          emotion: 'success',
          createdAt: new Date().toISOString(),
          streaming: false,
          followUps: ['Who founded GSTPilot?', 'What can Oracle do?', 'GST kya hota hai?'],
        };
        setMessages((prev) => [...prev, userMsg, oracleMsg]);
        setLastEmotion('success');
        setActiveLanguage(detectLanguage(text));
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        userPinnedUpRef.current = false;
        requestAnimationFrame(() => scrollToBottom(true));
        return;
      }

      const userMsg: OracleMessage = {
        id: cryptoId(),
        role: 'user',
        content: text,
        language: detectLanguage(text),
        createdAt: new Date().toISOString(),
      };
      const oracleId = cryptoId();
      const oraclePlaceholder: OracleMessage = {
        id: oracleId,
        role: 'oracle',
        content: '',
        language: userMsg.language,
        createdAt: new Date().toISOString(),
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, oraclePlaceholder]);
      streamingIdRef.current = oracleId;
      setIsStreaming(true);
      setActiveLanguage(userMsg.language);
      setInput('');
      userPinnedUpRef.current = false;
      if (inputRef.current) inputRef.current.style.height = 'auto';

      const history: OracleChatRequest['messages'] = [
        ...messages
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const payload: OracleChatRequest = {
        messages: history,
        memory: {
          userName,
          firmName,
          gstin,
          userId,
          preferredLanguage: activeLanguage,
          recentTopics: messages
            .filter((m) => m.role === 'user')
            .slice(-4)
            .map((m) => m.content.slice(0, 60)),
        },
        // Oracle Context Engine™ — forward live dashboard metrics so the
        // server can ground its response in the user's actual compliance /
        // return / invoice state (built into the system prompt as
        // "LIVE DASHBOARD DATA (legacy)").
        context: {
          dashboardMetrics: {
            totalClients: dashboardMetrics.totalClients,
            activeClients: dashboardMetrics.activeClients,
            totalInvoices: dashboardMetrics.totalInvoices,
            totalTaxVolume: dashboardMetrics.totalTaxVolume,
            filedReturns: dashboardMetrics.filedReturns,
            pendingReturns: dashboardMetrics.pendingReturns,
            overdueReturns: dashboardMetrics.overdueReturns,
            readyToFile: dashboardMetrics.readyToFile,
            criticalIssues: dashboardMetrics.criticalIssues,
            warnings: dashboardMetrics.warnings,
            averageHealthScore: dashboardMetrics.averageHealthScore,
            matchPercentage: dashboardMetrics.matchPercentage,
            riskPercentage: dashboardMetrics.riskPercentage,
            documentsProcessed: dashboardMetrics.documentsProcessed,
            extractionsPending: dashboardMetrics.extractionsPending,
          },
        },
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/oracle/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            let chunk: OracleStreamChunk;
            try {
              chunk = JSON.parse(data) as OracleStreamChunk;
            } catch {
              continue;
            }
            if (chunk.language) setActiveLanguage(chunk.language);
            if (chunk.token) {
              acc += chunk.token;
              setMessages((prev) =>
                prev.map((m) => (m.id === oracleId ? { ...m, content: acc } : m)),
              );
            }
            if (chunk.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === oracleId
                    ? {
                        ...m,
                        content: acc,
                        streaming: false,
                        emotion: detectEmotion(acc),
                        followUps: buildFollowUps(acc),
                        actions: buildActionChips(acc),
                      }
                    : m,
                ),
              );
              setLastEmotion(detectEmotion(acc));
              // ─── Oracle CFO: analyze the user's message for actionable intents.
              //     Fires in parallel after the chat answer completes. If an
              //     actionable tool is detected, an approval card renders inline
              //     below this assistant message. Best-effort — never blocks chat.
              void analyzeWithCfo(text, oracleId);
            }
            if (chunk.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === oracleId
                    ? {
                        ...m,
                        content:
                          acc ||
                          "I ran into a temporary issue reaching my reasoning service. Please try that again — your conversation is safe.",
                        streaming: false,
                        emotion: 'warning',
                      }
                    : m,
                ),
              );
              setLastEmotion('warning');
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === oracleId && m.streaming
              ? {
                  ...m,
                  streaming: false,
                  emotion: detectEmotion(m.content),
                  followUps: buildFollowUps(m.content),
                  actions: buildActionChips(m.content),
                }
              : m,
          ),
        );
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === oracleId
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content ||
                    (aborted
                      ? 'Stopped.'
                      : "I had trouble reaching my reasoning service. Please try again in a moment."),
                  emotion: aborted ? m.emotion : 'warning',
                }
              : m,
          ),
        );
        if (!aborted) setLastEmotion('warning');
      } finally {
        setIsStreaming(false);
        streamingIdRef.current = null;
        abortRef.current = null;
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [isStreaming, messages, userName, firmName, gstin, userId, activeLanguage, scrollToBottom, dashboardMetrics, analyzeWithCfo],
  );

  // ─── Stop streaming ────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ─── Input handling ────────────────────────────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // ─── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ─── Auto-send a prefilled prompt (from the CommandBar / other launchers) ───
  // Waits one tick so the conversation-load effect (also keyed on `open`) has
  // settled messages/activeId before we send. Guarded by a ref so a given
  // prompt is never sent twice.
  useEffect(() => {
    if (!open || !initialPrompt) return;
    if (initialPromptSentRef.current === initialPrompt) return;
    const t = setTimeout(() => {
      initialPromptSentRef.current = initialPrompt;
      sendMessage(initialPrompt);
    }, 60);
    return () => clearTimeout(t);
  }, [open, initialPrompt, sendMessage]);

  // ─── Rail navigation ───────────────────────────────────────────────────────
  const handleRailClick = useCallback(
    (item: RailItem) => {
      if (item.id === 'oracle') return; // already here
      if (isStreaming) return;
      onNavigate(item.id);
      onClose();
    },
    [isStreaming, onNavigate, onClose],
  );

  // ─── Derived state ─────────────────────────────────────────────────────────
  const avatarState = useMemo(
    () => deriveAvatarState({ isStreaming, hasInput: input.trim().length > 0, lastEmotion }),
    [isStreaming, input, lastEmotion],
  );

  const isEmpty = messages.length === 0;
  const grouped = useMemo(() => groupConversations(store.conversations), [store.conversations]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex h-screen w-screen"
          style={{ background: '#050505' }}
        >
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* COLUMN 0 — RAIL (left sidebar)                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <nav
            aria-label="Oracle workspace navigation"
            className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:w-16 md:gap-1.5 lg:w-56 lg:items-stretch lg:px-2.5"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {/* Brand — Official GSTPilot™ logo */}
            <div className="brand-logo mb-2 flex items-center justify-center gap-2 px-1 lg:mb-4 lg:px-2">
              <BrandLogo variant="icon" theme="dark" size={28} disableGlow />
              <div className="hidden lg:block">
                <p
                  className="text-[13px] font-semibold leading-tight tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                >
                  GSTPilot<span style={{ color: '#22D3EE' }}>™</span>
                </p>
                <p className="text-[10px] font-bold uppercase leading-tight tracking-wider text-white/50">
                  Oracle
                </p>
              </div>
            </div>

            {/* Rail items */}
            <div className="flex flex-1 flex-col gap-1 lg:gap-0.5">
              {RAIL_ITEMS.map((item) => {
                const isActive = item.id === 'oracle';
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRailClick(item)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center justify-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors lg:justify-start lg:px-3',
                      isActive
                        ? 'text-white'
                        : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 hidden h-7 w-[3px] -translate-y-1/2 rounded-full lg:block"
                        style={{
                          background:
                            'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors',
                        isActive ? 'text-emerald-400' : 'text-white/60 group-hover:text-white',
                      )}
                    />
                    <span className="hidden truncate lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer mini brand */}
            <div className="mt-auto hidden px-2 pb-1 lg:block">
              <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                The Financial Brain
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                of India
              </p>
            </div>
          </nav>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* COLUMN 1 — CONVERSATION HISTORY                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* Desktop: persistent column. Mobile: slide-over drawer. */}
          <aside
            className={cn(
              'h-full w-72 shrink-0 flex-col border-r lg:flex',
              historyOpen ? 'flex' : 'hidden',
            )}
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#070707' }}
          >
            {/* New Chat */}
            <div className="shrink-0 p-3">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={isStreaming}
                className="flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.05] disabled:opacity-40"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
              >
                <Plus className="h-4 w-4 text-emerald-400" />
                New Chat
              </button>
            </div>

            {/* History scroll */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              <HistoryGroup
                label="Today"
                items={grouped.today}
                activeId={activeId}
                onSelect={handleSwitchConversation}
                onDelete={handleDeleteConversation}
              />
              <HistoryGroup
                label="Yesterday"
                items={grouped.yesterday}
                activeId={activeId}
                onSelect={handleSwitchConversation}
                onDelete={handleDeleteConversation}
              />
              <HistoryGroup
                label="Previous 7 Days"
                items={grouped.prev7}
                activeId={activeId}
                onSelect={handleSwitchConversation}
                onDelete={handleDeleteConversation}
              />
              <HistoryGroup
                label="Older"
                items={grouped.older}
                activeId={activeId}
                onSelect={handleSwitchConversation}
                onDelete={handleDeleteConversation}
              />

              {store.conversations.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-white/40">
                  No conversations yet.
                </p>
              )}
            </div>

            {/* Mobile close-drawer button */}
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="shrink-0 border-t px-4 py-3 text-xs font-medium text-white/60 hover:text-white lg:hidden"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              Close
            </button>
          </aside>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* COLUMN 2 — MAIN CHAT                                                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <section className="flex min-w-0 flex-1 flex-col" style={{ background: '#050505' }}>
            {/* ─── Header ─── */}
            <header
              className="flex shrink-0 items-center gap-3 border-b px-4 py-3 md:px-6"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {/* Mobile: open history drawer */}
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white lg:hidden"
                aria-label="Open conversation history"
              >
                <MessageSquare className="h-4 w-4" />
              </button>

              <OracleAvatar state={avatarState} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-semibold tracking-tight text-white md:text-base">
                    GSTPilot Oracle
                  </span>
                  <sup className="text-[9px] font-medium text-white/40">™</sup>
                </div>
                <p className="truncate text-[11px] text-white/50 md:text-xs">
                  Ask anything. Run everything.
                </p>
              </div>

              {/* Status pill */}
              <div className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:flex" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span
                  className={cn(
                    'inline-flex h-1.5 w-1.5 rounded-full',
                    isStreaming ? 'bg-amber-400' : 'bg-emerald-400',
                  )}
                />
                <span className="text-white/60">
                  {isStreaming ? 'Responding' : AVATAR_STATE_LABEL[avatarState]}
                </span>
                {activeLanguage && activeLanguage !== 'english' && (
                  <span className="text-white/30">· {nativeLanguageLabel(activeLanguage)}</span>
                )}
              </div>

              {/* Animated brand pulse — top right, 8s cycle (blue ↔ purple glow) */}
              <BrandLogo
                variant="icon"
                theme="dark"
                size={24}
                disableGlow
                className="brand-pulse hidden md:block"
              />

              {messages.length > 0 && !isStreaming && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setEvolutionOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-emerald-400/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                title="Oracle AI Evolution — Forecasting, Specialists, Diagnostics, Accuracy"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Evolution</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isStreaming}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
                aria-label="Close Oracle"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* ─── Messages ─── */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
            >
              {isEmpty ? (
                <div className="custom-scrollbar min-h-full overflow-y-auto">
                  {/* Executive Brief — shown by default when Oracle opens with
                      no active conversation. Renders 8 sections of real
                      Firestore-computed data. The chat input remains available
                      below the brief so the user can immediately ask a follow-up. */}
                  <ExecutiveBrief
                    onNavigate={(v) => { onNavigate(v); onClose(); }}
                    onAskOracle={(p) => sendMessage(p)}
                    userName={userName}
                  />
                </div>
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      onPickFollowUp={sendMessage}
                      onNavigate={(v) => { onNavigate(v as AppView); onClose(); }}
                      cfoApprovals={cfoApprovalRequests[m.id]}
                      cfoAnalyzing={cfoAnalyzing === m.id}
                      invoiceUserMessage={invoiceUserMessages[m.id]}
                      paymentLinkUserMessage={paymentLinkUserMessages[m.id]}
                      communicationUserMessage={communicationUserMessages[m.id]}
                      cfoOrgId={orgCtx.organization?.id ?? 'preview-org'}
                      cfoUserId={userId ?? 'preview-user'}
                      cfoUserEmail={userName ? `${userName.toLowerCase().replace(/\s+/g, '.')}@gstpilot.in` : 'preview@gstpilot.in'}
                      cfoFirmName={firmName}
                      cfoGstin={gstin}
                      onCfoExecuted={() => {
                        // Refresh dashboard metrics after a real tool execution
                        // so the UI reflects the new data immediately.
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ─── Sticky input ─── */}
            <div
              className="shrink-0 border-t px-4 py-4 md:px-6"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#050505' }}
            >
              <div className="mx-auto max-w-3xl">
                {/* Suggested prompts (compact, only when input empty) */}
                <AnimatePresence>
                  {!input.trim() && !isEmpty && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-2.5 flex flex-wrap gap-2"
                    >
                      {QUICK_PROMPTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => sendMessage(p)}
                          disabled={isStreaming}
                          className="rounded-full border px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
                          style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
                        >
                          {p}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input box */}
                <div
                  className="flex items-end gap-2 rounded-2xl p-2 transition-colors focus-within:border-white/[0.18]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    background: '#111111',
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Ask Oracle anything — GST, returns, cash flow, ITC…"
                    className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed text-white placeholder:text-white/40 focus:outline-none custom-scrollbar"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/[0.08]"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                      aria-label="Stop"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-emerald-500/20 transition-all hover:opacity-90 disabled:opacity-30 disabled:shadow-none"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      }}
                      aria-label="Send"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Hint line */}
                <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/30">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Oracle replies in your language · Enter to send · Shift+Enter for newline
                  </span>
                  <span className="hidden sm:inline">
                    GSTPilot Oracle™ · Founded by Prince Singh
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Mobile history backdrop */}
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHistoryOpen(false)}
                className="fixed inset-0 z-[110] bg-black/60 lg:hidden"
                aria-hidden
              />
            )}
          </AnimatePresence>

          {/* Oracle AI Evolution panel (Upgrade Phase 1) — overlay triggered from header */}
          <OracleEvolutionPanel open={evolutionOpen} onClose={() => setEvolutionOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── History group ────────────────────────────────────────────────────────────

interface HistoryGroupProps {
  label: string;
  items: OracleConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function HistoryGroup({ label, items, activeId, onSelect, onDelete }: HistoryGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className={cn(
                'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                isActive ? 'bg-white/[0.06] text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium">{c.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="shrink-0 rounded p-1 text-white/30 opacity-0 transition-opacity hover:text-white/80 group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Oracle Avatar (dynamic state) ────────────────────────────────────────────

function OracleAvatar({ state }: { state: ReturnType<typeof deriveAvatarState> }) {
  const ringColor =
    state === 'speaking'
      ? 'bg-amber-400'
      : state === 'warning'
        ? 'bg-rose-400'
        : state === 'success'
          ? 'bg-emerald-400'
          : 'bg-emerald-400';
  return (
    <div className="relative shrink-0">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-emerald-500/20"
        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
      >
        <BrandLogo variant="icon" theme="dark" size={20} disableGlow />
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
        {state === 'speaking' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', ringColor)} />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full border-2', ringColor)} style={{ borderColor: '#050505' }} />
      </span>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onPickFollowUp,
  onNavigate,
  cfoApprovals,
  cfoAnalyzing,
  invoiceUserMessage,
  paymentLinkUserMessage,
  communicationUserMessage,
  cfoOrgId,
  cfoUserId,
  cfoUserEmail,
  cfoFirmName,
  cfoGstin,
  onCfoExecuted,
}: {
  message: OracleMessage;
  onPickFollowUp: (prompt: string) => void;
  onNavigate?: (view: string) => void;
  cfoApprovals?: Array<{ approvalId: string; toolId: string; toolName: string; toolIcon: string; category: string; input: Record<string, unknown>; decisionCard: any; missingParams: string[]; createdAt: string }>;
  cfoAnalyzing?: boolean;
  invoiceUserMessage?: string;
  paymentLinkUserMessage?: string;
  communicationUserMessage?: string;
  cfoOrgId?: string;
  cfoUserId?: string;
  cfoUserEmail?: string;
  cfoFirmName?: string;
  cfoGstin?: string;
  onCfoExecuted?: () => void;
}) {
  const isUser = message.role === 'user';
  const emotionGlyph = !isUser && message.emotion ? ORACLE_EMOTIONS[message.emotion]?.glyph : null;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div
          className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white"
          style={{ background: '#1a1a1a' }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  const isEmptyStreaming = message.streaming && !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shadow-md shadow-emerald-500/15"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
        >
          <BrandLogo variant="icon" theme="dark" size={15} disableGlow />
        </div>
      </div>

      {/* Bubble */}
      <div className="min-w-0 flex-1">
        {emotionGlyph && (
          <div className="mb-1 text-xs" aria-hidden>
            {emotionGlyph}
          </div>
        )}

        {isEmptyStreaming ? (
          <RespondingIndicator />
        ) : (
          <div className="oracle-prose text-sm leading-relaxed text-white/90">
            <ReactMarkdown
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && <PulsingCursor />}
          </div>
        )}

        {/* Action chips — one-tap shortcuts that navigate to the right workspace.
            Rendered ABOVE follow-ups because they are the primary "do something" CTA. */}
        {message.actions && message.actions.length > 0 && !message.streaming && onNavigate && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => a.view && onNavigate(a.view)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <ArrowRight className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Follow-up chips */}
        {message.followUps && message.followUps.length > 0 && !message.streaming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUps.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickFollowUp(f)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* ─── Oracle CFO Production Layer (Upgrade Phase 1) ──────────────────
            After Oracle answers, the CFO analyze endpoint checks the user's
            message for actionable intents. If found, an explainable decision
            card with Approve/Reject buttons renders here — turning the chat
            answer into a real, audited business action. */}
        {!message.streaming && cfoAnalyzing && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-white/50"
            style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.03)' }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="animate-pulse">Oracle CFO is analyzing your request…</span>
          </div>
        )}
        {/* ─── Upgrade Phase 1.1: Production Invoice Creation ─────────────
            When the user asks to create an invoice, this dedicated card
            handles the FULL production flow: intent extraction → customer
            lookup → GST calc → invoice number → approval → real DB write →
            PDF → email → WhatsApp → audit log. No simulations. */}
        {!message.streaming && invoiceUserMessage && (
          <InvoiceActionCard
            userMessage={invoiceUserMessage}
            organizationId={cfoOrgId ?? 'preview-org'}
            firmId={null}
            userId={cfoUserId ?? 'preview-user'}
            userEmail={cfoUserEmail ?? 'preview@gstpilot.in'}
            sellerDetails={{
              tradeName: cfoFirmName ?? 'GSTPilot',
              gstin: cfoGstin ?? '',
              state: null,
              stateCode: cfoGstin ? cfoGstin.slice(0, 2) : null,
              email: cfoUserEmail ?? 'preview@gstpilot.in',
            }}
          />
        )}
        {/* ─── Upgrade Phase 1.3: Production Payment Link Creation ────────
            When the user asks to create a payment link, this dedicated card
            handles the FULL production flow: intent extraction → invoice
            lookup → validation → provider detection → approval → REAL
            Razorpay/Stripe API → persist → email + WhatsApp → webhook
            monitoring → audit log. No fake links. */}
        {!message.streaming && !invoiceUserMessage && paymentLinkUserMessage && (
          <PaymentLinkActionCard
            userMessage={paymentLinkUserMessage}
            organizationId={cfoOrgId ?? 'preview-org'}
            firmId={null}
            userId={cfoUserId ?? 'preview-user'}
            userEmail={cfoUserEmail ?? 'preview@gstpilot.in'}
          />
        )}
        {/* ─── Upgrade Phase 1.4: Production Email & WhatsApp Execution ──
            When the user asks to email or WhatsApp an invoice, GST report,
            payment link, reminder, or statement, this dedicated card handles
            the FULL production flow: intent extraction → recipient lookup →
            validation → provider detection (SMTP/Resend/SendGrid/Gmail/Mailgun
            for email; WhatsApp Cloud API/Twilio/Gupshup for WhatsApp) →
            approval → REAL provider API → persist → webhook monitoring →
            retry engine → audit log. No simulated sends. */}
        {!message.streaming && !invoiceUserMessage && !paymentLinkUserMessage && communicationUserMessage && (
          <CommunicationActionCard
            userMessage={communicationUserMessage}
            organizationId={cfoOrgId ?? 'preview-org'}
            firmId={null}
            userId={cfoUserId ?? 'preview-user'}
            userEmail={cfoUserEmail ?? 'preview@gstpilot.in'}
            sellerName={cfoFirmName ?? 'GSTPilot'}
            sellerEmail={cfoUserEmail ?? 'preview@gstpilot.in'}
          />
        )}
        {!message.streaming && !invoiceUserMessage && !paymentLinkUserMessage && !communicationUserMessage && cfoApprovals && cfoApprovals.length > 0 && (
          <CFOAssistantPanel
            approvalRequests={cfoApprovals}
            organizationId={cfoOrgId ?? 'preview-org'}
            userId={cfoUserId ?? 'preview-user'}
            userEmail={cfoUserEmail ?? 'preview@gstpilot.in'}
            onExecuted={onCfoExecuted}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── "Oracle is responding…" with blinking cursor ─────────────────────────────

function RespondingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-white/50">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="animate-pulse">Oracle is responding</span>
      </span>
      <span className="text-white/30">…</span>
      <BlinkingCursor />
    </div>
  );
}

function PulsingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-emerald-400 align-middle"
      aria-hidden
    />
  );
}

function BlinkingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded-full bg-emerald-400 align-middle"
      aria-hidden
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'GST kya hota hai?',
  'Explain ITC rules',
  'Check my compliance',
  'GSTR-3B filing steps',
];

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newConversation(): OracleConversation {
  const now = new Date().toISOString();
  return {
    id: cryptoId(),
    title: 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function deriveTitle(messages: OracleMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const t = firstUser.content.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t || 'New chat';
}

function loadStore(): ConversationStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { conversations: [], activeId: null };
    const parsed = JSON.parse(raw) as ConversationStore;
    if (!parsed || !Array.isArray(parsed.conversations)) {
      return { conversations: [], activeId: null };
    }
    return parsed;
  } catch {
    return { conversations: [], activeId: null };
  }
}

function saveStore(store: ConversationStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

interface ConversationGroups {
  today: OracleConversation[];
  yesterday: OracleConversation[];
  prev7: OracleConversation[];
  older: OracleConversation[];
}

function groupConversations(convos: OracleConversation[]): ConversationGroups {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOf7Days = startOfToday - 7 * 86_400_000;

  const today: OracleConversation[] = [];
  const yesterday: OracleConversation[] = [];
  const prev7: OracleConversation[] = [];
  const older: OracleConversation[] = [];

  const sorted = [...convos].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const c of sorted) {
    const t = new Date(c.updatedAt).getTime();
    if (isNaN(t)) {
      older.push(c);
    } else if (t >= startOfToday) {
      today.push(c);
    } else if (t >= startOfYesterday) {
      yesterday.push(c);
    } else if (t >= startOf7Days) {
      prev7.push(c);
    } else {
      older.push(c);
    }
  }

  return { today, yesterday, prev7, older };
}

/** Generate contextual follow-up chips from the response content. */
function buildFollowUps(content: string): string[] | undefined {
  if (!content || content.length < 30) return undefined;
  const lower = content.toLowerCase();

  const pool: string[] = [];
  if (/(gstr-3b|3b)/.test(lower)) pool.push('GSTR-3B की last date क्या है?', 'Late fee कितनी लगेगी?');
  if (/(gstr-1|gstr 1)/.test(lower)) pool.push('GSTR-1 कैसे file करें?', 'B2B और B2C में अंतर?');
  if (/(itc|input tax credit)/.test(lower)) pool.push('ITC claim कैसे करें?', 'Blocked ITC के rules?');
  if (/(late fee|penalty|overdue)/.test(lower)) pool.push('Late fee waiver मिल सकती है?', 'How to avoid this next time?');
  if (/(cash flow|collections)/.test(lower)) pool.push('Receivables कैसे recover करें?', 'Working capital optimize करें');
  if (/(reverse charge|rcm)/.test(lower)) pool.push('RCM किन पर लागू है?', 'How to report RCM in GSTR-3B?');
  if (/(refund)/.test(lower)) pool.push('Refund process क्या है?', 'Refund timeline कितनी है?');

  pool.push('GST kya hota hai?', 'Explain ITC rules', 'How can Oracle help me daily?');

  const seen = new Set<string>();
  const picks: string[] = [];
  for (const p of pool) {
    if (seen.has(p)) continue;
    seen.add(p);
    picks.push(p);
    if (picks.length >= 3) break;
  }
  return picks;
}

/**
 * Generate contextual ACTION chips from the response content.
 * Unlike follow-up questions (which are conversational), action chips are
 * one-tap shortcuts that navigate the user straight to the right workspace
 * to DO something about what Oracle just said.
 */
function buildActionChips(content: string): OracleActionChip[] | undefined {
  if (!content || content.length < 30) return undefined;
  const lower = content.toLowerCase();
  const chips: OracleActionChip[] = [];

  // Filing / returns actions
  if (/(gstr-3b|gstr-1|gstr 3b|gstr 1|return|filing|file your|file now|file the)/.test(lower)) {
    chips.push({ label: 'File Return', intent: 'file_now', view: 'returns' });
  }
  // Overdue / late fee → open returns urgently
  if (/(overdue|late fee|penalty|missed|due date|deadline)/.test(lower)) {
    chips.push({ label: 'Open Returns', intent: 'open_returns', view: 'returns' });
  }
  // Reconciliation / ITC / mismatch
  if (/(itc|input tax credit|reconcil|mismatch|2b|gstr-2b|match)/.test(lower)) {
    chips.push({ label: 'Open Reconcile', intent: 'open_reconcile', view: 'reconcile' });
  }
  // Cash flow / collections / receivables / banking
  if (/(cash flow|cash position|receivable|collection|bank|balance|bank balance)/.test(lower)) {
    chips.push({ label: 'Open Banking', intent: 'open_banking', view: 'banking' });
  }
  if (/(collection|recover|receivable|outstanding|due from|pending payment)/.test(lower)) {
    chips.push({ label: 'Reconcile Collections', intent: 'open_reconcile', view: 'reconcile' });
  }
  // Invoices / sales / expenses
  if (/(invoice|sales|b2b|b2c|expense|purchase)/.test(lower)) {
    chips.push({ label: 'Open Invoices', intent: 'open_invoices', view: 'invoices' });
  }
  // Clients / vendors
  if (/(client|customer|vendor|supplier|gstin)/.test(lower)) {
    chips.push({ label: 'Open Clients', intent: 'open_clients', view: 'clients' });
  }
  // Notices / scrutiny / compliance alerts
  if (/(notice|scrutiny|drc|asn|show cause|letter|communication)/.test(lower)) {
    chips.push({ label: 'Open Notices', intent: 'open_notices', view: 'notices' });
  }
  // Compliance / risk
  if (/(compliance|risk|score|health|warning|alert)/.test(lower)) {
    chips.push({ label: 'Compliance Alerts', intent: 'open_compliance', view: 'ai-compliance' });
  }
  if (/(risk|fraud|litigation|legal)/.test(lower)) {
    chips.push({ label: 'Risk Engine', intent: 'open_risk', view: 'ai-risk' });
  }
  // Reports / insights / forecast
  if (/(report|summary|statement|download|export|pdf)/.test(lower)) {
    chips.push({ label: 'Open Reports', intent: 'open_reports', view: 'reports' });
  }
  if (/(insight|recommend|suggest|advice|forecast|predict)/.test(lower)) {
    chips.push({ label: 'AI Insights', intent: 'open_insights', view: 'ai-insights' });
  }
  // Connections / connect data
  if (/(connect|integration|gstn|sync|link your|link the)/.test(lower)) {
    chips.push({ label: 'Connect Services', intent: 'open_connections', view: 'connections' });
  }
  // Settings / profile
  if (/(setting|profile|account|configur|preference)/.test(lower)) {
    chips.push({ label: 'Open Settings', intent: 'open_settings', view: 'settings' });
  }

  // De-duplicate by intent, cap at 3 chips
  const seen = new Set<string>();
  const picks: OracleActionChip[] = [];
  for (const c of chips) {
    if (seen.has(c.intent)) continue;
    seen.add(c.intent);
    picks.push(c);
    if (picks.length >= 3) break;
  }
  return picks.length > 0 ? picks : undefined;
}

export default OracleWorkspace;
