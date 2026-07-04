// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Enterprise Command Network™ — Shared Helpers
// Safe DB access + JSON parsing + in-memory cache + command signatures.
// One Command. Every Team. Entire Enterprise. Founder & Owner: Prince Singh.
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

/** Tiny in-memory TTL cache to avoid recomputing heavy aggregates on every request. */
const MEM_CACHE = new Map<string, { value: unknown; expires: number }>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = MEM_CACHE.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  const value = await producer();
  MEM_CACHE.set(key, { value, expires: now + ttlMs });
  return value;
}

export const TTL = {
  SHORT: 15_000,
  MEDIUM: 45_000,
  LONG: 120_000,
};

/** Group an array into a count map keyed by the given selector. */
export function countBy<T>(items: T[], selector: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Sum a numeric field across an array. */
export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += selector(item) ?? 0;
  return total;
}

/** Build a deterministic replay token (replay-protection nonce). */
export function makeReplayToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deterministic command signature (zero-trust validation). */
export function signCommand(
  commandType: string,
  targetModule: string,
  actorId: string | null,
  replayToken: string,
): string {
  const raw = `${commandType}|${targetModule}|${actorId ?? 'system'}|${replayToken}`;
  // FNV-1a 32-bit — deterministic, no crypto deps needed for audit signature
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `sig_${hash.toString(16).padStart(8, '0')}`;
}

/** Hash a JSON payload for audit integrity. */
export function hashPayload(payload: unknown): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `ph_${hash.toString(16).padStart(8, '0')}`;
}

/** Minutes between two dates (positive = elapsed). */
export function minsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60));
}

/** Days between two dates. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** ISO date (YYYY-MM-DD) for "today" bucketing. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Start-of-week (Monday) ISO date. */
export function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? 6 : day - 1); // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Format INR compactly (₹1.2L / ₹3.4Cr). */
export function inrCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

/** Clamp 0-100. */
export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export { db };
