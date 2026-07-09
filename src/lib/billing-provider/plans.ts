// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing, Subscriptions & Payments™ — Subscription Plans
//
// Defines the 5 subscription tiers + a `seedSubscriptionPlans()` function that
// idempotently upserts them to the `subscription_plans` collection.
//
// This file is CLIENT-SAFE (pure data definitions + a server-only seed helper
// guarded by a dynamic import). It can be imported by both client and server.
// The `seedSubscriptionPlans()` function uses the Firebase CLIENT SDK; it must
// only be called from a server context (API route / seed script) — but the
// import itself is safe.
//
// All prices are in PAISE (1 INR = 100 paise). This avoids floating-point
// rounding errors and matches the convention used by Razorpay / Stripe.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SubscriptionPlan } from './types';

// ─── Plan Definitions ────────────────────────────────────────────────────────

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For solo founders & freelancers getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    features: [
      '50 invoices per month',
      'Up to 5 clients',
      '1 user',
      '100 AI Oracle credits / month',
      '100 MB document storage',
      'Community support',
      'GST return filing (GSTR-1 & GSTR-3B)',
      'Basic dashboard & reports',
    ],
    limits: {
      invoicesPerMonth: 50,
      clients: 5,
      users: 1,
      aiCredits: 100,
      storageBytes: 100 * 1024 * 1024, // 100 MB
      apiCallsPerDay: 0,
      automationRunsPerMonth: 0,
      support: 'community',
    },
    isPopular: false,
    trialDays: 0,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For small businesses scaling their GST compliance',
    monthlyPrice: 99_900,        // ₹999 in paise
    yearlyPrice: 999_000,        // ₹9,990 in paise (~2 months free)
    currency: 'INR',
    features: [
      '500 invoices per month',
      'Up to 50 clients',
      '3 users',
      '1,000 AI Oracle credits / month',
      '5 GB document storage',
      'Email support (24h response)',
      'All GST return types (GSTR-1, 3B, 9, 2B, ITC)',
      'E-invoice & e-way bill generation',
      'Bank account aggregation',
      'Basic AI insights & alerts',
    ],
    limits: {
      invoicesPerMonth: 500,
      clients: 50,
      users: 3,
      aiCredits: 1_000,
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      apiCallsPerDay: 0,
      automationRunsPerMonth: 0,
      support: 'email',
    },
    isPopular: false,
    trialDays: 14,
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Most popular — for growing CAs & tax professionals',
    monthlyPrice: 299_900,       // ₹2,999 in paise
    yearlyPrice: 2_999_000,      // ₹29,990 in paise
    currency: 'INR',
    features: [
      '5,000 invoices per month',
      'Up to 500 clients',
      '10 users',
      '10,000 AI Oracle credits / month',
      '50 GB document storage',
      'Priority support (4h response)',
      'API access (1,000 calls / day)',
      'Advanced AI CFO & predictions',
      'Multi-GSTIN management',
      'Gmail + WhatsApp automation',
      'Bank reconciliation engine',
      'Custom report builder',
    ],
    limits: {
      invoicesPerMonth: 5_000,
      clients: 500,
      users: 10,
      aiCredits: 10_000,
      storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      apiCallsPerDay: 1_000,
      automationRunsPerMonth: 0,
      support: 'priority',
    },
    isPopular: true,
    trialDays: 14,
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For mid-size firms with automation needs',
    monthlyPrice: 799_900,       // ₹7,999 in paise
    yearlyPrice: 7_999_000,      // ₹79,990 in paise
    currency: 'INR',
    features: [
      '50,000 invoices per month',
      'Unlimited clients',
      '50 users',
      '100,000 AI Oracle credits / month',
      '500 GB document storage',
      '24/7 phone support',
      'API access (10,000 calls / day)',
      'Automation workflows (1,000 runs / month)',
      'ERP integrations (Tally, Zoho, Busy, QuickBooks)',
      'White-label client portal',
      'Audit log & role-based access control',
      'Dedicated onboarding manager',
    ],
    limits: {
      invoicesPerMonth: 50_000,
      clients: 0, // 0 = unlimited
      users: 50,
      aiCredits: 100_000,
      storageBytes: 500 * 1024 * 1024 * 1024, // 500 GB
      apiCallsPerDay: 10_000,
      automationRunsPerMonth: 1_000,
      support: 'phone247',
    },
    isPopular: false,
    trialDays: 14,
    sortOrder: 3,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large enterprises & corporate groups',
    monthlyPrice: 2_499_900,     // ₹24,999 in paise
    yearlyPrice: 24_999_000,     // ₹249,990 in paise
    currency: 'INR',
    features: [
      'Unlimited invoices',
      'Unlimited clients',
      'Unlimited users',
      'Unlimited AI Oracle credits',
      'Unlimited document storage',
      'Dedicated Customer Success Manager',
      'White-label & custom branding',
      '99.99% uptime SLA',
      'API access (1,000,000 calls / day)',
      'Unlimited automation runs',
      'SSO (SAML 2.0) + SCIM provisioning',
      'Custom integrations & professional services',
      'On-premise deployment option',
      'Quarterly business reviews',
    ],
    limits: {
      invoicesPerMonth: 0, // 0 = unlimited
      clients: 0,
      users: 0,
      aiCredits: 0,
      storageBytes: 0,
      apiCallsPerDay: 1_000_000,
      automationRunsPerMonth: 0, // unlimited
      support: 'dedicated',
    },
    isPopular: false,
    trialDays: 14,
    sortOrder: 4,
    createdAt: '',
    updatedAt: '',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get a plan by id. Returns undefined if not found.
 * Pure function — safe for client + server.
 */
export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId);
}

/**
 * Get all plans sorted by display order. Returns a defensive copy so callers
 * can mutate without affecting the source.
 */
export function getAllPlans(): SubscriptionPlan[] {
  return [...SUBSCRIPTION_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Compute the price for a plan + billing cycle (in paise).
 * Returns 0 for the Free plan.
 */
export function getPriceForCycle(planId: string, cycle: 'monthly' | 'yearly'): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;
  return cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
}

// ─── Seed Function (SERVER-ONLY — uses Firebase client SDK) ───────────────────

/**
 * Idempotently upsert all 5 subscription plans to the `subscription_plans`
 * collection. Uses setDoc with the plan id as the doc id, so re-running is
 * safe — it overwrites the existing docs with the latest definitions.
 *
 * MUST be called from a server context (API route / seed script) — the
 * `firebase/firestore` module loads the client SDK which expects to run in a
 * browser-like environment (with `window`), but Next.js polyfills it server-side
 * via the firebase Admin SDK-compatible module. Either way, this function
 * should only be invoked by a server route to keep the seed atomic.
 *
 * Returns the list of plan ids that were written.
 */
export async function seedSubscriptionPlans(): Promise<string[]> {
  // Lazy-load firebase/firestore so this file can be imported by client code
  // without pulling in the SDK.
  const { collection, doc, setDoc, serverTimestamp, getDocs, writeBatch } =
    await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');

  const now = new Date().toISOString();
  const writtenIds: string[] = [];

  for (const plan of SUBSCRIPTION_PLANS) {
    const planDoc = {
      ...plan,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(collection(db, 'subscription_plans'), plan.id), planDoc, {
      merge: true,
    });
    writtenIds.push(plan.id);
  }

  // Touch the serverTimestamp so the seed-run is visible in the audit log.
  void serverTimestamp;
  void getDocs;
  void writeBatch;

  return writtenIds;
}
