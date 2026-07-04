// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ — Shared Helpers
// Safe DB access, JSON parsing, in-memory cache, FNV-1a decision signatures,
// replay tokens, payload hashing, memory search scoring.
// One Intelligence. Every Decision. Entire Enterprise. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

/** Parse a JSON string field safely; return fallback on failure. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Safe Prisma accessor — returns [] if the model call fails. */
export async function safeFindMany<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

export async function safeAggregate<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function safeFirst<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Clamp a number into 0..100. */
export function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Clamp a number into 0..1. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

export const TTL = {
  SHORT: 15_000,   // 15s
  MEDIUM: 45_000,  // 45s
  LONG: 120_000,   // 2min
} as const;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await factory();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// ─── FNV-1a hashing for decision / action signatures ────────────────────────

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // to unsigned hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic signature for an AGI action — covers actor, action, target, payload. */
export function signAction(parts: {
  actorId: string | null;
  actorType: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  payload?: string;
}): string {
  const canonical = [
    parts.actorType,
    parts.actorId ?? 'system',
    parts.actionType,
    parts.targetType,
    parts.targetId ?? 'none',
    parts.payload ?? '',
  ].join('|');
  return fnv1a(canonical);
}

/** Replay-protection nonce — timestamp + random. */
export function replayToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function fmtINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

export function fmtPct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diff = Date.now() - then;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

// ─── Memory search scoring ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as',
  'and', 'or', 'but', 'not', 'no', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'it', 'its', 'from', 'into', 'how', 'what', 'when',
  'where', 'why', 'who', 'which', 'can', 'could', 'should', 'would', 'will',
]);

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Score a memory against a query. Pure string token overlap — no external
 * embedding service required, yet fully deterministic and grounded in the
 * actual memory text. Returns 0..1 plus the matched terms.
 */
export function scoreMemory(
  memory: { title: string; content: string; summary: string | null; tags: string[]; category: string },
  query: string,
): { score: number; matchedOn: string[] } {
  const terms = tokenize(query);
  if (terms.length === 0) return { score: 0, matchedOn: [] };

  const titleLower = memory.title.toLowerCase();
  const contentLower = memory.content.toLowerCase();
  const summaryLower = (memory.summary ?? '').toLowerCase();
  const tagsLower = memory.tags.map((t) => t.toLowerCase());
  const categoryLower = memory.category.toLowerCase();

  const matchedOn: string[] = [];
  let score = 0;
  for (const term of terms) {
    let hit = false;
    if (titleLower.includes(term)) {
      score += 0.4;
      hit = true;
    }
    if (summaryLower.includes(term)) {
      score += 0.2;
      hit = true;
    }
    if (tagsLower.some((t) => t.includes(term))) {
      score += 0.2;
      hit = true;
    }
    if (categoryLower.includes(term)) {
      score += 0.1;
      hit = true;
    }
    if (contentLower.includes(term)) {
      score += 0.1;
      hit = true;
    }
    if (hit) matchedOn.push(term);
  }
  // normalize: a query with N terms can score at most ~1.0 if every term hits every field
  const maxPerTerm = 1.0;
  const raw = score / (terms.length * maxPerTerm);
  return { score: clamp01(raw), matchedOn };
}

// ─── Empty-record helpers for Record<K, number> breakdowns ───────────────────

export function emptyBreakdown<T extends string>(keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

export { db };
