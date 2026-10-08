// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Enterprise Operating System™
// Performance™ — In-memory TTL cache with scale presets (100M orgs, 1B tx/day).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

const CACHE = new Map<string, CacheEntry<unknown>>();

// TTL presets tuned for the global enterprise workload.
export const TTL_PRESETS = {
  HOT: 30_000,        // 30s — dashboard, treasury
  WARM: 120_000,      // 2m — consolidation, payroll
  COLD: 600_000,      // 10m — country registry, tax rules, compliance
  FROZEN: 3_600_000,  // 1h — historical FX (immutable once persisted)
} as const;

export const ENDPOINT_TTL: Record<string, number> = {
  '/api/global/dashboard': TTL_PRESETS.HOT,
  '/api/global/countries': TTL_PRESETS.COLD,
  '/api/global/entities': TTL_PRESETS.WARM,
  '/api/global/compliance': TTL_PRESETS.WARM,
  '/api/global/currency': TTL_PRESETS.HOT,
  '/api/global/payroll': TTL_PRESETS.WARM,
  '/api/global/consolidation': TTL_PRESETS.WARM,
  '/api/global/treasury': TTL_PRESETS.HOT,
  '/api/global/expansion': TTL_PRESETS.COLD,
};

export function cacheGet<T>(key: string): { value: T; cached: true } | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return { value: entry.value as T, cached: true };
}

export function cacheSet<T>(key: string, value: T, ttlMs: number = TTL_PRESETS.WARM): void {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    cachedAt: Date.now(),
  });
}

export function cacheInvalidate(prefix: string): number {
  let n = 0;
  for (const key of CACHE.keys()) {
    if (key.startsWith(prefix)) {
      CACHE.delete(key);
      n++;
    }
  }
  return n;
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: CACHE.size, keys: Array.from(CACHE.keys()) };
}

// Background cleanup — runs on every cacheSet to evict expired entries.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of CACHE.entries()) {
      if (now > entry.expiresAt) CACHE.delete(key);
    }
  }, 60_000).unref?.();
}

// ─── Cache key builder ───────────────────────────────────────────────────────

export function buildKey(endpoint: string, params: Record<string, string | number | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
  return `${endpoint}?${sorted}`;
}
