// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Page · Shared Types
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure type module — no runtime code. Imported by every ZohoBooks* component
// so they share one source of truth for module metadata, derived KPIs, and
// sync-history entry shapes.
//
// All values are DERIVED from the `useZohoBooks` hook state — never invented.
// If the hook does not expose a value, the UI shows "—" with an
// "Awaiting first sync" subtitle (see RULE 9 of the redesign spec).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ComponentType } from 'react';
import {
  Users,
  FileText,
  ReceiptText,
  CreditCard,
  Wallet,
  BookOpen,
  Percent,
  Landmark,
} from 'lucide-react';
import type { ZohoSyncEntity } from '@/hooks/useZohoBooks';

// ─── Module metadata ─────────────────────────────────────────────────────────
// The 8 modules the redesigned dashboard renders (one card each). This is the
// ONLY place this list is defined; the KPI row + modules grid both consume it.
//
// NOTE on icon tones: every module uses a BLUE-tinted icon to comply with the
// "BLUE theme throughout — no green except Connected pill, no indigo, no
// random colors" rule. We vary the tint intensity (blue-400 / blue-500) so
// the cards still feel distinguishable without breaking the design system.

export interface ZohoModuleMeta {
  /** The hook's `ZohoSyncEntity` key — used to read counts from syncStatus. */
  key: ZohoSyncEntity;
  /** Display name (singular, e.g. "Customers"). */
  label: string;
  /** Lucide icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon tile background + icon color. */
  tone: string;
}

export const ZOHO_MODULES: ZohoModuleMeta[] = [
  { key: 'customer',         label: 'Customers',  icon: Users,       tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'invoice',          label: 'Invoices',   icon: FileText,    tone: 'bg-[#3B82F6]/12 text-[#93C5FD]' },
  { key: 'bill',             label: 'Bills',      icon: ReceiptText, tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'payment',          label: 'Payments',   icon: CreditCard,  tone: 'bg-[#3B82F6]/12 text-[#93C5FD]' },
  { key: 'expense',          label: 'Expenses',   icon: Wallet,      tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'journal',          label: 'Journals',   icon: BookOpen,    tone: 'bg-[#3B82F6]/12 text-[#93C5FD]' },
  { key: 'tax',              label: 'Taxes',      icon: Percent,     tone: 'bg-[#2563EB]/12 text-[#60A5FA]' },
  { key: 'bank_account',     label: 'Bank',       icon: Landmark,    tone: 'bg-[#3B82F6]/12 text-[#93C5FD]' },
];

// Total module count — used by the "Modules Synced" KPI.
export const ZOHO_MODULE_TOTAL = ZOHO_MODULES.length; // = 8

// ─── Derived KPI shape ───────────────────────────────────────────────────────
// Computed once in ZohoKpiRow from the hook state.

export interface ZohoKpi {
  /** Stable id for React keys. */
  id: 'total-records' | 'modules-synced' | 'last-duration' | 'health';
  label: string;
  /** Display value (already formatted, e.g. "1,247", "5/8", "12s", "92"). */
  value: string;
  /** Subtitle shown beneath the value (e.g. "Awaiting first sync"). */
  subtitle: string;
  /** Whether the value is meaningful (false = show "—" with awaiting subtitle). */
  hasData: boolean;
  /** Sparkline data — empty array hides the sparkline. */
  sparkline: number[];
  /** Trend percentage (positive = up/blue, negative = down/red). null = neutral. */
  change: number | null;
  /** Change label (e.g. "vs last sync"). */
  changeLabel: string;
  /** Lucide icon for the corner tile. */
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the icon tile. */
  iconTone: string;
}

// ─── Sync-history timeline entry ─────────────────────────────────────────────
// Currently the hook exposes only the MOST RECENT sync (syncStatus.lastSync).
// We surface that as a single timeline entry. When the hook starts exposing a
// full history list, this interface is already in the right shape — just map
// the entries.

export interface ZohoSyncHistoryEntry {
  id: string;
  /** ISO timestamp the sync started. */
  startedAt: string;
  /** 'completed' | 'partial' | 'failed' — never 'running' (running is shown on the Sync button). */
  status: 'completed' | 'partial' | 'failed';
  /** Human description of what was synced. */
  description: string;
  /** Duration label, e.g. "12s" or "—". */
  durationLabel: string;
}

// ─── Helper: relative time formatter ─────────────────────────────────────────
// Shared by Header / KPI / Modules / Timeline. Returns "—" for null inputs,
// "just now" for <60s, "Xm/h/d ago" for short ranges, and a localized date for
// anything older than 30 days. NEVER returns "Loading..." or raw ISO strings.

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Absolute time-of-day for timeline rows, e.g. "Today, 2:34 PM". */
export function formatTimelineWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const dayLabel =
    d >= startOfToday
      ? 'Today'
      : d >= startOfYesterday
        ? 'Yesterday'
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeLabel = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dayLabel}, ${timeLabel}`;
}

/** Duration formatter, e.g. 12300 ms → "12s", 75000 ms → "1m 15s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}
