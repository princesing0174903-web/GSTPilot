// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — AI Scaling Layer (SERVER-ONLY)
//
// A scaling layer on top of the VEYRO AI orchestrator
// (`@/lib/ai-provider/server/orchestrator`). Provides:
//   • AIContextCache — LRU + TTL cache keyed by SHA-256(prompt + contextFingerprint)
//   • aiRequestQueue — in-memory priority queue (max 500)
//   • submitAIRequest — bounded-concurrency execution with cache + token budget
//   • enforceTokenBudget — 4-chars-per-token truncation
//   • tokenUsageTracker — per-org per-day token budget enforcement
//
// Persisted nowhere — process-local state. A new serverless instance starts
// cold (cache miss, empty queue, zero usage).
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import * as orchestrator from '@/lib/ai-provider/server/orchestrator';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIRequestPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AICacheEntry<T = unknown> {
  value: T;
  expiresAt: Date;
}

export interface AICacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  defaultTtlMs: number;
}

export interface AIRequestPayload {
  /** Which orchestrator function to invoke. */
  kind:
    | 'analyzeBusiness'
    | 'analyzeCashFlow'
    | 'analyzeGST'
    | 'analyzeInvoices'
    | 'analyzeExpenses'
    | 'predictRevenue'
    | 'predictCashFlow'
    | 'generateInsights'
    | 'generateRecommendations'
    | 'generateAlerts'
    | 'computeBusinessScore'
    | 'computeRiskScore'
    | 'answerBusinessQuestion'
    | 'generateBrief';
  organizationId: string;
  /** Extra args for the chosen function (e.g. question for answerBusinessQuestion). */
  args?: Record<string, unknown>;
}

export interface AIRequest {
  id: string;
  priority: AIRequestPriority;
  prompt: string;
  contextFingerprint: string;
  payload: AIRequestPayload;
  enqueuedAt: number;
  maxTokens?: number;
}

export interface AIRequestStats {
  total: number;
  byPriority: Record<AIRequestPriority, number>;
  avgWaitMs: number;
  processed: number;
  rejected: number;
}

export interface AIRequestResult {
  id: string;
  status: 'success' | 'error' | 'queued';
  result?: unknown;
  error?: string;
  fromCache: boolean;
  tokensUsed: number;
  durationMs: number;
}

export interface TokenBudgetResult {
  truncated: boolean;
  originalLength: number;
  truncatedLength: number;
  prompt: string;
}

// Internal extended request shape that carries pre-computed cache key + the
// budget-truncated prompt so worker functions don't need to re-compute them
// (and don't need a closure over the submitting caller's scope).
export interface PreparedAIRequest extends AIRequest {
  /** SHA-256 of (effectivePrompt + contextFingerprint). */
  cacheKey: string;
  /** Prompt after `enforceTokenBudget` was applied. */
  effectivePrompt: string;
  /** Max tokens enforced at submit time. */
  enforcedMaxTokens: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AIQueueFullError extends Error {
  constructor(message: string = 'AI request queue is full (max 500)') {
    super(message);
    this.name = 'AIQueueFullError';
  }
}

// ─── Priority weights ────────────────────────────────────────────────────────

/** Lower weight = processed first. critical=0, high=1, normal=2, low=3. */
export function priorityWeight(priority: AIRequestPriority): number {
  switch (priority) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'normal':
      return 2;
    case 'low':
      return 3;
    default:
      return 2;
  }
}

// ─── Token Budget Enforcement ────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

/**
 * Truncate a prompt so it fits within `maxTokens` using the rough
 * 4-chars-per-token estimate. Returns the (possibly-truncated) prompt plus
 * metadata about the truncation.
 */
export function enforceTokenBudget(
  prompt: string,
  maxTokens: number,
): TokenBudgetResult {
  const originalLength = prompt.length;
  const maxChars = Math.max(0, maxTokens * CHARS_PER_TOKEN);
  if (originalLength <= maxChars) {
    return {
      truncated: false,
      originalLength,
      truncatedLength: originalLength,
      prompt,
    };
  }
  // Truncate at a character boundary; if possible end on a word boundary
  // to avoid splitting a word awkwardly.
  let cut = maxChars;
  const prevSpace = prompt.lastIndexOf(' ', cut);
  if (prevSpace > cut * 0.8) cut = prevSpace; // prefer word boundary if close
  const truncatedPrompt = prompt.slice(0, cut);
  return {
    truncated: true,
    originalLength,
    truncatedLength: truncatedPrompt.length,
    prompt: truncatedPrompt,
  };
}

// ─── AIContextCache (LRU + TTL) ──────────────────────────────────────────────

export class AIContextCache {
  private store = new Map<string, AICacheEntry>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(opts: { maxSize?: number; defaultTtlMs?: number } = {}) {
    this.maxSize = opts.maxSize ?? 1000;
    this.defaultTtlMs = opts.defaultTtlMs ?? 5 * 60 * 1000; // 5 min
  }

  /**
   * Compose a SHA-256 key from the prompt + contextFingerprint. Callers
   * SHOULD pre-hash via `computeCacheKey()` and pass the digest to `get`/`set`,
   * but we also accept raw strings (and hash them here for safety).
   */
  static hashKey(prompt: string, contextFingerprint: string): string {
    return createHash('sha256')
      .update(`${prompt}\u0000${contextFingerprint}`)
      .digest('hex');
  }

  get<T = unknown>(key: string): AICacheEntry<T> | null {
    const entry = this.store.get(key) as AICacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return null;
    }
    // TTL check.
    if (entry.expiresAt.getTime() < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    // LRU: move to end (most-recently-used) by re-inserting.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry;
  }

  set<T = unknown>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entry if at capacity and this is a new key.
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions++;
      }
    }
    this.store.set(key, {
      value,
      expiresAt: new Date(Date.now() + (ttlMs ?? this.defaultTtlMs)),
    });
  }

  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  stats(): AICacheStats {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      defaultTtlMs: this.defaultTtlMs,
    };
  }
}

// ─── AIRequestQueue (priority queue, max 500) ────────────────────────────────

const MAX_QUEUE_SIZE = 500;

type QueuedRequest = PreparedAIRequest & { weight: number };

export class AIRequestQueue {
  /** 4 buckets, one per priority weight — O(1) enqueue/dequeue. */
  private buckets: QueuedRequest[][] = [[], [], [], []];
  private total = 0;
  private processed = 0;
  private rejected = 0;
  private cumulativeWaitMs = 0;

  get size(): number {
    return this.total;
  }

  enqueue(req: PreparedAIRequest): string {
    if (this.total >= MAX_QUEUE_SIZE) {
      this.rejected++;
      throw new AIQueueFullError();
    }
    const weight = priorityWeight(req.priority);
    const queued: QueuedRequest = { ...req, weight };
    this.buckets[weight].push(queued);
    this.total++;
    return req.id;
  }

  /**
   * Dequeue the highest-priority (lowest weight) request. Within the same
   * priority, FIFO order is preserved (shift from the front).
   */
  dequeue(): QueuedRequest | null {
    for (let w = 0; w < this.buckets.length; w++) {
      if (this.buckets[w].length > 0) {
        const req = this.buckets[w].shift()!;
        this.total--;
        this.processed++;
        this.cumulativeWaitMs += Date.now() - req.enqueuedAt;
        return req;
      }
    }
    return null;
  }

  getStats(): AIRequestStats {
    const avgWaitMs = this.processed > 0 ? this.cumulativeWaitMs / this.processed : 0;
    return {
      total: this.total,
      byPriority: {
        critical: this.buckets[0].length,
        high: this.buckets[1].length,
        normal: this.buckets[2].length,
        low: this.buckets[3].length,
      },
      avgWaitMs,
      processed: this.processed,
      rejected: this.rejected,
    };
  }

  clear(): void {
    this.buckets = [[], [], [], []];
    this.total = 0;
  }
}

// ─── Token Usage Tracker (per-org, per-day) ──────────────────────────────────

interface OrgUsage {
  date: string; // YYYY-MM-DD (UTC)
  tokens: number;
}

/**
 * Default per-org daily token budget. In production, this is overridden by
 * the org's subscription plan via `getDailyLimit(orgId)` — which checks for a
 * plan-specific limit in the orgs Firestore document and falls back to this
 * default if no plan is found.
 *
 * The default corresponds to roughly ~10 Oracle deep-dives per day on a
 * mid-tier plan (≈50k tokens per analysis).
 */
const DEFAULT_DAILY_TOKEN_LIMIT = 500_000;

export class TokenUsageTracker {
  private orgs = new Map<string, OrgUsage>();
  private planOverrides = new Map<string, number>();

  /** Returns today's date key in UTC YYYY-MM-DD. */
  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Lazily get or create today's usage entry for an org, resetting if stale. */
  private entry(orgId: string): OrgUsage {
    const today = this.todayKey();
    const existing = this.orgs.get(orgId);
    if (existing && existing.date === today) return existing;
    const fresh: OrgUsage = { date: today, tokens: 0 };
    this.orgs.set(orgId, fresh);
    return fresh;
  }

  record(orgId: string, tokensUsed: number): void {
    if (!orgId || tokensUsed <= 0) return;
    const e = this.entry(orgId);
    e.tokens += tokensUsed;
  }

  getDailyUsage(orgId: string): number {
    return this.orgs.get(orgId)?.tokens ?? 0;
  }

  /**
   * Per-org daily token limit. Reads from an in-memory plan-override map
   * (set by subscription sync code) and falls back to the default. The
   * Firestore-backed subscription plan can be wired in by calling
   * `setPlanOverride(orgId, limit)` from the billing provider.
   */
  getDailyLimit(orgId: string): number {
    return this.planOverrides.get(orgId) ?? DEFAULT_DAILY_TOKEN_LIMIT;
  }

  /** Set or update the per-org token limit (e.g. when plan changes). */
  setPlanOverride(orgId: string, limit: number): void {
    this.planOverrides.set(orgId, limit);
  }

  canMakeRequest(orgId: string, estimatedTokens: number): boolean {
    const used = this.getDailyUsage(orgId);
    const limit = this.getDailyLimit(orgId);
    return used + estimatedTokens <= limit;
  }

  /** Snapshot for the /api/scaling/ai-stats endpoint. */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [orgId, e] of this.orgs.entries()) {
      out[orgId] = e.tokens;
    }
    return out;
  }

  clear(): void {
    this.orgs.clear();
    this.planOverrides.clear();
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────

let _cache: AIContextCache | null = null;
let _queue: AIRequestQueue | null = null;
let _tokens: TokenUsageTracker | null = null;

export function getAIContextCache(): AIContextCache {
  if (!_cache) _cache = new AIContextCache();
  return _cache;
}

export function getAIRequestQueue(): AIRequestQueue {
  if (!_queue) _queue = new AIRequestQueue();
  return _queue;
}

export function getTokenUsageTracker(): TokenUsageTracker {
  if (!_tokens) _tokens = new TokenUsageTracker();
  return _tokens;
}

// ─── Request Submission (bounded-concurrency worker pool) ────────────────────

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface PendingRequest {
  req: PreparedAIRequest;
  resolve: (r: AIRequestResult) => void;
  reject: (err: Error) => void;
}

const pending = new Map<string, PendingRequest>();
let workersRunning = 0;
let concurrency = DEFAULT_CONCURRENCY;

/** Override the worker-pool concurrency (admin/test helper). */
export function setConcurrency(n: number): void {
  concurrency = Math.max(1, n);
}

/**
 * Submit an AI request for processing.
 *
 *   1. Apply `enforceTokenBudget()` to the prompt.
 *   2. Check `AIContextCache` for a cached result keyed by SHA-256(prompt +
 *      contextFingerprint). If hit, return immediately.
 *   3. Otherwise enqueue into the priority queue and process via the
 *      bounded-concurrency worker pool.
 *   4. On success, store the result in the cache and record token usage in
 *      `tokenUsageTracker`.
 *
 * Returns `{id, status, result?, fromCache, tokensUsed, durationMs}`.
 */
export async function submitAIRequest(req: AIRequest): Promise<AIRequestResult> {
  const cache = getAIContextCache();
  const queue = getAIRequestQueue();
  const t0 = Date.now();

  // ── 1. Enforce token budget ──
  const maxTokens = req.maxTokens ?? DEFAULT_MAX_TOKENS;
  const budget = enforceTokenBudget(req.prompt, maxTokens);
  const effectivePrompt = budget.prompt;

  // ── 2. Check cache (keyed by SHA-256 of effectivePrompt + fingerprint) ──
  const cacheKey = AIContextCache.hashKey(effectivePrompt, req.contextFingerprint);
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      id: req.id,
      status: 'success',
      result: cached.value,
      fromCache: true,
      tokensUsed: 0,
      durationMs: Date.now() - t0,
    };
  }

  // ── 3. Prepare + enqueue ──
  const prepared: PreparedAIRequest = {
    ...req,
    cacheKey,
    effectivePrompt,
    enforcedMaxTokens: maxTokens,
  };

  try {
    queue.enqueue(prepared);
  } catch (err) {
    if (err instanceof AIQueueFullError) {
      return {
        id: req.id,
        status: 'error',
        error: 'queue_full',
        fromCache: false,
        tokensUsed: 0,
        durationMs: Date.now() - t0,
      };
    }
    throw err;
  }

  // ── 4. Schedule worker pump + await ──
  void pumpWorkers();

  return new Promise<AIRequestResult>((resolve, reject) => {
    pending.set(req.id, { req: prepared, resolve, reject });
  });
}

/**
 * Drain the queue with up to `concurrency` workers. Each finished worker
 * re-invokes this to keep the pool saturated.
 */
async function pumpWorkers(): Promise<void> {
  const queue = getAIRequestQueue();
  while (workersRunning < concurrency) {
    const next = queue.dequeue();
    if (!next) break;
    workersRunning++;
    void processOne(next).finally(() => {
      workersRunning--;
    });
  }
}

/**
 * Process a single dequeued request: dispatch to the orchestrator, record
 * token usage, cache the result, and resolve the submitter's Promise.
 */
async function processOne(qreq: QueuedRequest): Promise<void> {
  const cache = getAIContextCache();
  const tokens = getTokenUsageTracker();
  const startMs = Date.now();
  const p = pending.get(qreq.id);
  if (!p) return; // already cancelled / timed out

  let status: AIRequestResult['status'] = 'success';
  let result: unknown;
  let error: string | undefined;
  let tokensUsed = 0;

  try {
    // Dispatch to the orchestrator function named in the payload.
    const r = await dispatch(qreq.payload);
    result = r;
    // Rough token estimate: 4 chars per token, summed across prompt + JSON
    // of the result (capped to avoid pathological cases).
    const resultStr = safeStringify(r);
    const estInput = Math.ceil(qreq.effectivePrompt.length / CHARS_PER_TOKEN);
    const estOutput = Math.min(
      2000,
      Math.ceil(resultStr.length / CHARS_PER_TOKEN),
    );
    tokensUsed = estInput + estOutput;

    // Record usage + cache result (keyed by THIS request's prepared cache key).
    tokens.record(qreq.payload.organizationId, tokensUsed);
    cache.set(qreq.cacheKey, r, DEFAULT_TTL_MS);
  } catch (err) {
    status = 'error';
    error = err instanceof Error ? err.message : String(err);
  }

  const response: AIRequestResult = {
    id: qreq.id,
    status,
    result,
    error,
    fromCache: false,
    tokensUsed,
    durationMs: Date.now() - startMs,
  };

  pending.delete(qreq.id);
  p.resolve(response);

  // After finishing one, try to pump the next.
  void pumpWorkers();
}

// ─── Orchestrator dispatcher ─────────────────────────────────────────────────

async function dispatch(payload: AIRequestPayload): Promise<unknown> {
  const { kind, organizationId, args } = payload;
  switch (kind) {
    case 'analyzeBusiness':
      return orchestrator.analyzeBusiness(organizationId);
    case 'analyzeCashFlow':
      return orchestrator.analyzeCashFlow(organizationId);
    case 'analyzeGST':
      return orchestrator.analyzeGST(organizationId);
    case 'analyzeInvoices':
      return orchestrator.analyzeInvoices(organizationId);
    case 'analyzeExpenses':
      return orchestrator.analyzeExpenses(organizationId);
    case 'predictRevenue':
      return orchestrator.predictRevenue(
        organizationId,
        (args?.months as number | undefined) ?? 3,
      );
    case 'predictCashFlow':
      return orchestrator.predictCashFlow(
        organizationId,
        (args?.months as number | undefined) ?? 3,
      );
    case 'generateInsights':
      return orchestrator.generateInsights(organizationId);
    case 'generateRecommendations':
      return orchestrator.generateRecommendations(organizationId);
    case 'generateAlerts':
      return orchestrator.generateAlerts(organizationId);
    case 'computeBusinessScore':
      return orchestrator.computeBusinessScore(organizationId);
    case 'computeRiskScore':
      return orchestrator.computeRiskScore(organizationId);
    case 'answerBusinessQuestion':
      return orchestrator.answerBusinessQuestion(
        organizationId,
        String(args?.question ?? ''),
      );
    case 'generateBrief':
      return orchestrator.generateBrief(organizationId);
    default: {
      // exhaustive check at compile time; runtime guard for safety.
      const _exhaustive: never = kind;
      void _exhaustive;
      throw new Error(`[ai-scaling] unsupported orchestrator kind: ${String(kind)}`);
    }
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '';
  }
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

/**
 * Generate a new unique request ID (used by callers before calling
 * `submitAIRequest`).
 */
export function newRequestId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pre-compute the cache key for a (prompt, contextFingerprint) pair without
 * going through submitAIRequest — useful for cache invalidation flows.
 */
export function computeCacheKey(prompt: string, contextFingerprint: string): string {
  return AIContextCache.hashKey(prompt, contextFingerprint);
}
