'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Banking Intelligence UI — shared helpers, hooks, formatters, chart builders
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleSlash,
  Sparkles,
} from 'lucide-react';
import type {
  TransactionCategory,
  TransactionStatus,
  AccountType,
} from '@/lib/banking-service/types';

// ─── Money formatting (Indian numbering system) ───────────────────────────────

/** Compact ₹ formatting: ≥1Cr → ₹X.XX Cr, ≥1L → ₹X.XX L, ≥1K → ₹X.XXK */
export function fmtINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Full ₹ formatting with Indian grouping: ₹1,23,456 */
export function fmtINRFull(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN')}`;
}

/** Percentage with sign for deltas: +12.3% / -4.5% / 0.0% */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** Date → DD MMM YYYY (e.g. "05 Nov 2024") */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Date+time → DD MMM YYYY, HH:mm (e.g. "05 Nov 2024, 14:32") */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date}, ${hh}:${mm}`;
}

/** Relative time: "2h ago", "3d ago", "just now" */
export function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** YYYY-MM-DD for <input type="date"> defaults */
export function isoDay(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Display metadata ─────────────────────────────────────────────────────────

export const STATUS_META: Record<
  TransactionStatus,
  { label: string; color: string; dot: string; icon: typeof CheckCircle2 }
> = {
  reconciled: {
    label: 'Reconciled',
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  unreconciled: {
    label: 'Unreconciled',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    dot: 'bg-amber-500',
    icon: AlertCircle,
  },
  pending: {
    label: 'Pending',
    color:
      'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
    dot: 'bg-sky-500',
    icon: Clock,
  },
  ignored: {
    label: 'Ignored',
    color:
      'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
    icon: CircleSlash,
  },
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  savings: 'Savings',
  current: 'Current',
  overdraft: 'Overdraft',
  credit_card: 'Credit Card',
};

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  sales: 'Sales',
  payment_received: 'Payment Received',
  vendor_payment: 'Vendor Payment',
  salary: 'Salary',
  rent: 'Rent',
  utilities: 'Utilities',
  tax: 'Tax',
  fees: 'Fees',
  refund: 'Refund',
  transfer: 'Transfer',
  interest: 'Interest',
  misc: 'Miscellaneous',
};

/** Hex color per category — used in SVG charts (not Tailwind classes). */
export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  sales: '#10b981',
  payment_received: '#22c55e',
  vendor_payment: '#f59e0b',
  salary: '#fb923c',
  rent: '#f97316',
  utilities: '#eab308',
  tax: '#8b5cf6',
  fees: '#a855f7',
  refund: '#06b6d4',
  transfer: '#64748b',
  interest: '#14b8a6',
  misc: '#94a3b8',
};

/** Ordered list of categories for selects + legends. */
export const CATEGORY_LIST: TransactionCategory[] = [
  'sales',
  'payment_received',
  'vendor_payment',
  'salary',
  'rent',
  'utilities',
  'tax',
  'fees',
  'refund',
  'transfer',
  'interest',
  'misc',
];

/** Tailwind badge class for a category badge. */
export function categoryBadgeClass(category?: TransactionCategory): string {
  if (!category) return 'bg-muted text-muted-foreground border-border';
  const map: Record<TransactionCategory, string> = {
    sales:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    payment_received:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    vendor_payment:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    salary:
      'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    rent:
      'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    utilities:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30',
    tax:
      'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
    fees:
      'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
    refund:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
    transfer:
      'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
    interest:
      'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
    misc:
      'bg-muted text-muted-foreground border-border',
  };
  return map[category];
}

export const ACCOUNT_STATUS_META: Record<
  'connected' | 'syncing' | 'error' | 'disconnected',
  { label: string; color: string; dot: string }
> = {
  connected: {
    label: 'Connected',
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  syncing: {
    label: 'Syncing',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    dot: 'bg-amber-500 animate-pulse',
  },
  error: {
    label: 'Error',
    color:
      'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    dot: 'bg-rose-500',
  },
  disconnected: {
    label: 'Disconnected',
    color: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

export const RECONCILE_STATUS_META: Record<
  'matched' | 'partial' | 'unmatched' | 'suggested',
  { label: string; color: string }
> = {
  matched: {
    label: 'Matched',
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  partial: {
    label: 'Partial',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  unmatched: {
    label: 'Unmatched',
    color: 'bg-muted text-muted-foreground border-border',
  },
  suggested: {
    label: 'Suggested',
    color:
      'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  },
};

/** Tag used to label AI-suggested categories in the UI. */
export const AI_TAG_ICON = Sparkles;

// ─── Tiny fetch hooks ─────────────────────────────────────────────────────────

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * useFetch — minimal data-fetching hook with AbortController + refetch.
 * Re-fetches whenever the URL changes (or `deps` change).
 */
export function useFetch<T>(url: string | null, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState<boolean>(!!url);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const memoDeps = JSON.stringify(deps);

  React.useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            (json && typeof json === 'object' && 'error' in json && String((json as { error: unknown }).error)) ||
              `Request failed (${r.status})`,
          );
        }
        return json as T;
      })
      .then((j) => {
        setData(j);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : 'Network error';
        setError(msg);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [url, tick, memoDeps]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}

/** POST JSON; throws on non-ok. Returns parsed JSON. */
export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!r.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${r.status})`);
  }
  return json as T;
}

/** PATCH JSON; throws on non-ok. Returns parsed JSON. */
export async function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!r.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${r.status})`);
  }
  return json as T;
}

/** DELETE JSON; throws on non-ok. Body optional. Returns parsed JSON. */
export async function apiDelete<T = unknown>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(url, init);
  const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!r.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${r.status})`);
  }
  return json as T;
}

// ─── Chart path builders (pure SVG) ───────────────────────────────────────────

export interface Pt {
  x: number;
  y: number;
  v: number;
}

interface BuildOpts {
  w: number;
  h: number;
  padding?: number;
}

/** Map a series of numbers to SVG coordinates given width/height/padding. */
export function toPoints(values: number[], opts: BuildOpts): Pt[] {
  const { w, h, padding = 8 } = opts;
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  return values.map((v, i) => ({
    x: padding + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: padding + (1 - (v - min) / range) * innerH,
    v,
  }));
}

/** Build an SVG `d` path for a polyline through `pts`. */
export function buildLinePath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** Build an SVG `d` path for a closed area under `pts` down to `baselineY`. */
export function buildAreaPath(pts: Pt[], baselineY: number): string {
  if (pts.length === 0) return '';
  const head = `M${pts[0].x.toFixed(2)},${baselineY.toFixed(2)}`;
  const line = pts
    .map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  const tail = `L${pts[pts.length - 1].x.toFixed(2)},${baselineY.toFixed(2)} Z`;
  return `${head} ${line} ${tail}`;
}

/** Build an SVG `d` path for a smooth cubic-bezier line through `pts`. */
export function buildSmoothPath(pts: Pt[]): string {
  if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx1 = p0.x + (p1.x - p0.x) / 3;
    const cy1 = p0.y;
    const cx2 = p1.x - (p1.x - p0.x) / 3;
    const cy2 = p1.y;
    d += ` C${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }
  return d;
}

/** Donut arc path for a single segment given start/end angles (radians) + radius. */
export function buildDonutArc(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);
  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${rOuter},${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${rInner},${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
}

// ─── Misc small UI helpers ────────────────────────────────────────────────────

/** Custom scrollbar styling for tall scroll containers. */
export const SCROLLBAR_CLASS =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50';

/** Convert markdown-ish text (paragraphs, **bold**, lists) to React nodes. */
export function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let listItems: string[] = [];
  const flushList = (key: number) => {
    if (listItems.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} className="ml-4 list-disc space-y-1 text-sm">
        {listItems.map((li, i) => (
          <li key={`li-${key}-${i}`}>{renderInline(li)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else if (line === '') {
      flushList(i);
    } else {
      flushList(i);
      out.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  });
  flushList(lines.length);
  return out;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
