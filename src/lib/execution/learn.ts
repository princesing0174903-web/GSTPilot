// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 6: Learning Engine™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// Remembers user-specific preferences + behavioural patterns so the engine gets
// sharper with every interaction. Stores five memory classes:
//
//   • User approvals   — "approves filings only after ITC review"
//   • User rejections  — "no reminder calls after 7pm"
//   • Preferred times  — "morning 9am for daily reports"
//   • Payment behaviour — "Sharma Enterprises pays on 47th day, not 30th"
//   • Filing patterns   — "files GSTR-3B on 18th, not the 20th statutory date"
//
// Exports:
//   • seedUserBehaviours   — 13 learned behaviour memories across the 6 actions
//   • getLearningSummary   — totals + high-confidence + byAction + topPreferences + insights
//   • learnFromOutcome     — factory: create a fresh behaviour memory from an observation
//   • LEARNING_INSIGHTS    — per-action insight-text generators (used by Oracle)
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BehaviourAction,
  LearnedPattern,
  LearningSummary,
  UserBehaviour,
} from './types';

// ─── Confidence formula ───────────────────────────────────────────────────────
// Each observation reinforces a behaviour memory. New memories start at
// evidence=1 → confidence = min(0.98, 0.5 + 1*0.04) = 0.54. Each subsequent
// observation increments evidence by 1; confidence approaches 0.98 asymptotically
// (capped so we never claim 100% certainty about human behaviour).
const CONFIDENCE_FLOOR = 0.5;
const CONFIDENCE_STEP = 0.04; // per observation
const CONFIDENCE_CEIL = 0.98;

/** Computes confidence from evidence count using the Learning Engine formula. */
export function confidenceFromEvidence(evidence: number): number {
  return Math.min(CONFIDENCE_CEIL, CONFIDENCE_FLOOR + evidence * CONFIDENCE_STEP);
}

/** Threshold above which a behaviour is considered "high confidence". */
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

// ─── Behaviour Recipe — declarative spec for each seed memory ─────────────────
interface BehaviourRecipe {
  action: BehaviourAction;
  preference: string;
  confidence: number;
  evidence: number;
  hoursAgoCreated: number;
  hoursAgoUpdated: number;
}

// 13 learned behaviours spanning all 6 BehaviourAction types. Preferences use
// natural English (not snake_case) so LEARNING_INSIGHTS can drop them verbatim
// into human-readable insight strings. Indian context throughout: ITC, 26AS,
// GSTR-3B, 194C, DSO, MSME, IBC, etc.
const SEED_BEHAVIOUR_RECIPE: BehaviourRecipe[] = [
  // ── approve_filing — 3 memories ────────────────────────────────────────────
  {
    action: 'approve_filing',
    preference: 'only after ITC reconciliation review',
    confidence: 0.92,
    evidence: 14,
    hoursAgoCreated: 720,
    hoursAgoUpdated: 6,
  },
  {
    action: 'approve_filing',
    preference: 'only after cash ledger balance check',
    confidence: 0.89,
    evidence: 12,
    hoursAgoCreated: 480,
    hoursAgoUpdated: 18,
  },
  {
    action: 'approve_filing',
    preference: 'TDS only after 26AS reconciliation',
    confidence: 0.86,
    evidence: 9,
    hoursAgoCreated: 360,
    hoursAgoUpdated: 30,
  },
  // ── reject_reminder — 2 memories ───────────────────────────────────────────
  {
    action: 'reject_reminder',
    preference: 'no calls after 7pm IST',
    confidence: 0.85,
    evidence: 8,
    hoursAgoCreated: 240,
    hoursAgoUpdated: 12,
  },
  {
    action: 'reject_reminder',
    preference: 'no WhatsApp on weekends (Sundays off)',
    confidence: 0.79,
    evidence: 6,
    hoursAgoCreated: 200,
    hoursAgoUpdated: 40,
  },
  // ── prefer_time — 2 memories ───────────────────────────────────────────────
  {
    action: 'prefer_time',
    preference: 'morning 9am IST for daily reports',
    confidence: 0.78,
    evidence: 11,
    hoursAgoCreated: 600,
    hoursAgoUpdated: 4,
  },
  {
    action: 'prefer_time',
    preference: 'Sunday evening 6pm for weekly review',
    confidence: 0.67,
    evidence: 5,
    hoursAgoCreated: 144,
    hoursAgoUpdated: 36,
  },
  // ── payment_behaviour — 3 memories ─────────────────────────────────────────
  {
    action: 'payment_behaviour',
    preference: 'Sharma Enterprises LLP pays on 47th day vs 30-day terms',
    confidence: 0.92,
    evidence: 12,
    hoursAgoCreated: 720,
    hoursAgoUpdated: 24,
  },
  {
    action: 'payment_behaviour',
    preference: 'Verma Industries pays on 7th day after invoice receipt',
    confidence: 0.81,
    evidence: 9,
    hoursAgoCreated: 360,
    hoursAgoUpdated: 48,
  },
  {
    action: 'payment_behaviour',
    preference: 'Patel & Sons captures 2% early-pay discount on Day 4',
    confidence: 0.74,
    evidence: 7,
    hoursAgoCreated: 280,
    hoursAgoUpdated: 60,
  },
  // ── filing_pattern — 2 memories ────────────────────────────────────────────
  {
    action: 'filing_pattern',
    preference: 'files GSTR-3B on 18th not 20th of month',
    confidence: 0.88,
    evidence: 6,
    hoursAgoCreated: 360,
    hoursAgoUpdated: 8,
  },
  {
    action: 'filing_pattern',
    preference: 'GSTR-1 filed on 3rd of every month without fail',
    confidence: 0.91,
    evidence: 8,
    hoursAgoCreated: 400,
    hoursAgoUpdated: 14,
  },
  // ── delay_payment — 1 memory ───────────────────────────────────────────────
  {
    action: 'delay_payment',
    preference: 'defers capex during cash crisis to preserve runway',
    confidence: 0.83,
    evidence: 4,
    hoursAgoCreated: 96,
    hoursAgoUpdated: 4,
  },
];

// ─── seedUserBehaviours — materialise 13 demo behaviour memories ──────────────
export function seedUserBehaviours(): UserBehaviour[] {
  const now = Date.now();
  return SEED_BEHAVIOUR_RECIPE.map((r, idx) => {
    const createdAt = new Date(now - r.hoursAgoCreated * 3600 * 1000).toISOString();
    const updatedAt = new Date(now - r.hoursAgoUpdated * 3600 * 1000).toISOString();
    return {
      id: `beh_${String(idx + 1).padStart(3, '0')}`,
      userId: null,
      action: r.action,
      preference: r.preference,
      confidence: r.confidence,
      evidence: r.evidence,
      createdAt,
      updatedAt,
    } satisfies UserBehaviour;
  });
}

// ─── LEARNING_INSIGHTS — per-action insight-text generators ───────────────────
// Each function takes a UserBehaviour and returns a human-readable insight
// sentence suitable for Oracle responses, dashboards, or audit logs. The Oracle
// uses these to explain *why* GSTPilot is taking a particular action ("because
// you've approved filings after ITC review 14 times with 92% consistency").
export const LEARNING_INSIGHTS: Record<BehaviourAction, (b: UserBehaviour) => string> = {
  approve_filing: (b) =>
    `User consistently approves GST filings ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,

  reject_reminder: (b) =>
    `User rejects reminders ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,

  delay_payment: (b) =>
    `User tends to delay payments when ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,

  prefer_time: (b) =>
    `User prefers ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,

  payment_behaviour: (b) =>
    `Observed payment pattern: ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,

  filing_pattern: (b) =>
    `Observed filing pattern: ${b.preference} — ` +
    `${Math.round(b.confidence * 100)}% confidence over ${b.evidence} observations`,
};

// ─── getLearningSummary — derive rollup metrics from a behaviour stream ───────
// Returns totalMemories, highConfidence count (>= 0.8), byAction breakdown,
// topPreferences (top 5 by confidence), and learnedPatterns (insights derived
// from each behaviour via LEARNING_INSIGHTS).
export function getLearningSummary(behaviours: UserBehaviour[]): LearningSummary {
  const byAction: Record<string, number> = {};
  let highConfidence = 0;

  for (const b of behaviours) {
    byAction[b.action] = (byAction[b.action] ?? 0) + 1;
    if (b.confidence >= HIGH_CONFIDENCE_THRESHOLD) highConfidence += 1;
  }

  // Top 5 preferences by confidence (ties broken by evidence, then recency).
  const topPreferences = [...behaviours]
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.evidence !== a.evidence) return b.evidence - a.evidence;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5);

  // Derive an insight per behaviour — sorted by confidence desc so the strongest
  // learned patterns surface at the top of the dashboard.
  const learnedPatterns: LearnedPattern[] = behaviours
    .map((b) => ({
      action: b.action,
      pattern: b.preference,
      confidence: b.confidence,
      evidence: b.evidence,
      insight: LEARNING_INSIGHTS[b.action](b),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    totalMemories: behaviours.length,
    highConfidence,
    byAction,
    topPreferences,
    learnedPatterns,
  };
}

// ─── learnFromOutcome — factory: create a fresh behaviour memory ──────────────
// Records ONE observation of user behaviour. The `outcome` param labels the type
// of observation (approve / reject / prefer / delay / pattern); it does not
// affect the confidence formula but is useful for upstream audit logs.
//
// New memory starts at evidence=1, confidence = min(0.98, 0.5 + 1*0.04) = 0.54.
// As the caller re-runs this factory for the same action+preference and merges
// the result into an existing memory (incrementing evidence and recomputing
// confidence via confidenceFromEvidence), confidence moves toward 0.98.
export function learnFromOutcome(
  action: BehaviourAction,
  outcome: 'approve' | 'reject' | 'prefer' | 'delay' | 'pattern',
  preference: string,
): UserBehaviour {
  const now = new Date().toISOString();
  const evidence = 1;
  const confidence = confidenceFromEvidence(evidence);
  // Outcome is metadata for the caller; we don't store it on UserBehaviour
  // (no field for it in the type contract), but it influences the id prefix
  // for traceability in logs.
  const outcomeTag = outcome.slice(0, 3); // 'app' | 'rej' | 'pre' | 'del' | 'pat'
  return {
    id: `beh_live_${outcomeTag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: null,
    action,
    preference,
    confidence,
    evidence,
    createdAt: now,
    updatedAt: now,
  } satisfies UserBehaviour;
}
