'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Conversation Persistence
//
// All Oracle conversations live in localStorage (per-user key). This keeps
// Oracle fully functional offline / without Firestore writes, and lets us
// load conversation history instantly on every page mount.
//
// Public API:
//   • listConversations()           → OracleConversation[] (newest first)
//   • loadConversation(id)          → OracleConversation | null
//   • saveConversation(conv)        → void (upsert)
//   • deleteConversation(id)        → void
//   • createConversation()          → OracleConversation (empty, persisted)
//   • loadPinnedInsights()          → string[]
//   • savePinnedInsights(insights)  → void
// ═══════════════════════════════════════════════════════════════════════════════

import type { OracleConversation, OracleMessage } from './oracle-types';

const STORAGE_KEY_PREFIX = 'gstpilot.oracle.';
const CONVERSATIONS_KEY = STORAGE_KEY_PREFIX + 'conversations';
const PINNED_KEY = STORAGE_KEY_PREFIX + 'pinned';
const MAX_CONVERSATIONS = 50;

// ─── ID Generators ───────────────────────────────────────────────────────────

export function newConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Safe JSON read/write ────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────

export function listConversations(): OracleConversation[] {
  const all = safeRead<OracleConversation[]>(CONVERSATIONS_KEY, []);
  // Sort by updatedAt descending (newest first).
  return [...all].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadConversation(id: string): OracleConversation | null {
  const all = safeRead<OracleConversation[]>(CONVERSATIONS_KEY, []);
  return all.find((c) => c.id === id) ?? null;
}

export function saveConversation(conv: OracleConversation): void {
  const all = safeRead<OracleConversation[]>(CONVERSATIONS_KEY, []);
  const idx = all.findIndex((c) => c.id === conv.id);
  if (idx >= 0) {
    all[idx] = conv;
  } else {
    all.unshift(conv);
  }
  // Trim to MAX_CONVERSATIONS (drop oldest).
  const trimmed = all.slice(0, MAX_CONVERSATIONS);
  safeWrite(CONVERSATIONS_KEY, trimmed);
}

export function deleteConversation(id: string): void {
  const all = safeRead<OracleConversation[]>(CONVERSATIONS_KEY, []);
  const filtered = all.filter((c) => c.id !== id);
  safeWrite(CONVERSATIONS_KEY, filtered);
}

export function createConversation(): OracleConversation {
  const now = new Date().toISOString();
  const conv: OracleConversation = {
    id: newConversationId(),
    title: 'New conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  saveConversation(conv);
  return conv;
}

/** Append a message to a conversation and persist. Returns the updated conversation. */
export function appendMessage(
  conv: OracleConversation,
  message: OracleMessage,
): OracleConversation {
  const updated: OracleConversation = {
    ...conv,
    messages: [...conv.messages, message],
    updatedAt: new Date().toISOString(),
  };
  // Auto-title from first user message.
  if (conv.messages.length === 0 && message.role === 'user') {
    updated.title =
      message.content.trim().slice(0, 60) + (message.content.length > 60 ? '…' : '');
  }
  saveConversation(updated);
  return updated;
}

/** Update the last oracle message in-place (used during streaming). */
export function updateLastOracleMessage(
  conv: OracleConversation,
  patch: Partial<OracleMessage>,
): OracleConversation {
  if (conv.messages.length === 0) return conv;
  const lastIdx = conv.messages.length - 1;
  const last = conv.messages[lastIdx];
  if (last.role !== 'oracle') return conv;
  const updatedMessages = [...conv.messages];
  updatedMessages[lastIdx] = { ...last, ...patch };
  const updated: OracleConversation = {
    ...conv,
    messages: updatedMessages,
    updatedAt: new Date().toISOString(),
  };
  saveConversation(updated);
  return updated;
}

// ─── Pinned Insights ─────────────────────────────────────────────────────────

export function loadPinnedInsights(): string[] {
  return safeRead<string[]>(PINNED_KEY, []);
}

export function savePinnedInsights(insights: string[]): void {
  safeWrite(PINNED_KEY, insights.slice(0, 20));
}

// ─── Time Grouping (Today / Yesterday / Previous 7 Days / Older) ─────────────

export type TimeGroup = 'today' | 'yesterday' | 'previous7' | 'older';

export function getTimeGroup(iso: string): TimeGroup {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return 'older';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const t = then.getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfYesterday) return 'yesterday';
  if (t >= startOf7DaysAgo) return 'previous7';
  return 'older';
}

export const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  previous7: 'Previous 7 Days',
  older: 'Older',
};

export const TIME_GROUP_ORDER: TimeGroup[] = ['today', 'yesterday', 'previous7', 'older'];
