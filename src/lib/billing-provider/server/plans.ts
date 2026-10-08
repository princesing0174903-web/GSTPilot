// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Subscription Plans (SERVER-ONLY)
//
// The 5 canonical subscription plans for VEYRO. These are seeded into
// Firestore `subscription_plans/{planId}` (a GLOBAL collection). The values
// here are the source of truth — the service layer reads from Firestore, but
// the orchestrator + invoice engine consult these constants directly to avoid
// a round-trip on every billing op.
//
// Pricing: realistic Indian SaaS pricing in INR.
//   • Free          — ₹0/mo       (entry-level)
//   • Starter       — ₹1,499/mo   (small businesses)
//   • Professional  — ₹4,999/mo   (most popular)
//   • Business      — ₹14,999/mo  (growing teams)
//   • Enterprise    — ₹49,999/mo  (large orgs)
//
// Yearly = ~10× monthly (2 months free).
// ═══════════════════════════════════════════════════════════════════════════════

import type { BillingCycle, SubscriptionPlan, SubscriptionPlanId } from '../types';

const NOW = '2025-01-01T00:00:00.000Z';

/**
 * The 5 canonical subscription plans. Order matches sortOrder 0..4.
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    planId: 'free',
    name: 'Free',
    tagline: 'For solo founders getting started',
    description:
      'Everything you need to file your first GST return. Limited usage — perfect for trying VEYRO.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'INR',
    trialDays: 0,
    features: [
      'GSTR-1 & GSTR-3B preparation',
      '50 AI Oracle credits / month',
      '100 MB document storage',
      '1 team member',
      '10 invoices / month',
      '1 GST return / month',
      '10 Oracle requests / month',
      'Community support',
    ],
    limits: {
      storageBytes: 100 * 1024 * 1024, // 100 MB
      aiCreditsMonthly: 50,
      teamMembers: 1,
      automationRunsMonthly: 0,
      apiCallsMonthly: 100,
      invoicesMonthly: 10,
      returnsMonthly: 1,
      oracleRequestsMonthly: 10,
    },
    isPopular: false,
    sortOrder: 0,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'starter',
    planId: 'starter',
    name: 'Starter',
    tagline: 'For small businesses & freelancers',
    description:
      'Automate GST filing, reconcile bank transactions, and chat with the AI Oracle for day-to-day questions.',
    priceMonthly: 1499,
    priceYearly: 14990, // 2 months free
    currency: 'INR',
    trialDays: 14,
    features: [
      'Everything in Free',
      'GSTR-1 / 3B auto-prep',
      'Bank reconciliation',
      '1,000 AI Oracle credits / month',
      '5 GB document storage',
      '3 team members',
      '100 automation runs / month',
      '100 invoices / month',
      '5 GST returns / month',
      '500 Oracle requests / month',
      'Email support',
    ],
    limits: {
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      aiCreditsMonthly: 1_000,
      teamMembers: 3,
      automationRunsMonthly: 100,
      apiCallsMonthly: 1_000,
      invoicesMonthly: 100,
      returnsMonthly: 5,
      oracleRequestsMonthly: 500,
    },
    isPopular: false,
    sortOrder: 1,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'professional',
    planId: 'professional',
    name: 'Professional',
    tagline: 'For growing CA firms & businesses',
    description:
      'AI Oracle™ chat, GSTR-1/3B auto-prep, bank reconciliation, Tally/Zoho sync, WhatsApp reminders, priority support.',
    priceMonthly: 4999,
    priceYearly: 49990, // 2 months free
    currency: 'INR',
    trialDays: 14,
    features: [
      'Everything in Starter',
      'AI Oracle™ chat',
      'GSTR-1 / 3B auto-prep',
      'Bank reconciliation',
      'Tally / Zoho sync',
      'WhatsApp reminders',
      '10,000 AI Oracle credits / month',
      '50 GB document storage',
      '10 team members',
      '1,000 automation runs / month',
      '1,000 invoices / month',
      '50 GST returns / month',
      '5,000 Oracle requests / month',
      'Priority support',
      'Custom branding',
    ],
    limits: {
      storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      aiCreditsMonthly: 10_000,
      teamMembers: 10,
      automationRunsMonthly: 1_000,
      apiCallsMonthly: 10_000,
      invoicesMonthly: 1_000,
      returnsMonthly: 50,
      oracleRequestsMonthly: 5_000,
    },
    isPopular: true,
    sortOrder: 2,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'business',
    planId: 'business',
    name: 'Business',
    tagline: 'For multi-entity CA practices',
    description:
      'Scale across multiple GSTINs with advanced automation, deep ERP integration, and dedicated success management.',
    priceMonthly: 14999,
    priceYearly: 149990, // 2 months free
    currency: 'INR',
    trialDays: 14,
    features: [
      'Everything in Professional',
      '50,000 AI Oracle credits / month',
      '250 GB document storage',
      '50 team members',
      '10,000 automation runs / month',
      '10,000 invoices / month',
      '500 GST returns / month',
      '25,000 Oracle requests / month',
      '50,000 API calls / month',
      'Dedicated success manager',
      'Audit log export',
      'SSO-ready',
    ],
    limits: {
      storageBytes: 250 * 1024 * 1024 * 1024, // 250 GB
      aiCreditsMonthly: 50_000,
      teamMembers: 50,
      automationRunsMonthly: 10_000,
      apiCallsMonthly: 50_000,
      invoicesMonthly: 10_000,
      returnsMonthly: 500,
      oracleRequestsMonthly: 25_000,
    },
    isPopular: false,
    sortOrder: 3,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'enterprise',
    planId: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large enterprises & conglomerates',
    description:
      'Unlimited everything, on-prem deployment options, custom SLAs, and a 24/7 dedicated support pod.',
    priceMonthly: 49999,
    priceYearly: 499990, // 2 months free
    currency: 'INR',
    trialDays: 14,
    features: [
      'Everything in Business',
      'Unlimited AI Oracle credits',
      '2 TB document storage',
      'Unlimited team members',
      'Unlimited automation runs',
      'Unlimited invoices',
      'Unlimited GST returns',
      'Unlimited Oracle requests',
      'Unlimited API calls',
      '24/7 phone support',
      'Dedicated support pod',
      'Custom integrations',
      'On-prem deployment option',
      'Custom SLA',
    ],
    limits: {
      storageBytes: 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
      aiCreditsMonthly: Infinity,
      teamMembers: Infinity,
      automationRunsMonthly: Infinity,
      apiCallsMonthly: Infinity,
      invoicesMonthly: Infinity,
      returnsMonthly: Infinity,
      oracleRequestsMonthly: Infinity,
    },
    isPopular: false,
    sortOrder: 4,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Get a plan by id. Returns undefined if not found. */
export function getPlan(planId: SubscriptionPlanId): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.planId === planId);
}

/** Get all 5 plans, sorted by sortOrder. */
export function getAllPlans(): SubscriptionPlan[] {
  return [...SUBSCRIPTION_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The default plan for new orgs (Free). */
export function getDefaultPlan(): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[0];
}

/** Whether the plan is a paid plan (price > 0). */
export function isPaidPlan(planId: SubscriptionPlanId): boolean {
  const plan = getPlan(planId);
  return plan ? plan.priceMonthly > 0 : false;
}

/** Get the price for a plan + cycle (monthly or yearly). */
export function getPlanPrice(planId: SubscriptionPlanId, cycle: BillingCycle): number {
  const plan = getPlan(planId);
  if (!plan) return 0;
  return cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
}

/** Comparison result for two plans. */
export type PlanComparison = 'higher' | 'lower' | 'same';

/**
 * Compare two plans by sortOrder. Returns 'higher' if `a` is a higher tier
 * than `b`, 'lower' if lower, 'same' if equal.
 */
export function comparePlans(a: SubscriptionPlanId, b: SubscriptionPlanId): PlanComparison {
  const planA = getPlan(a);
  const planB = getPlan(b);
  if (!planA || !planB) return 'same';
  if (planA.sortOrder > planB.sortOrder) return 'higher';
  if (planA.sortOrder < planB.sortOrder) return 'lower';
  return 'same';
}
