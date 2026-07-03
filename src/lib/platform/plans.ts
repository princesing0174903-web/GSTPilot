// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — SUBSCRIPTION PLANS
// 6 tiers: Starter, Professional, Business, Enterprise, Enterprise Plus, Custom.
// Each plan carries explicit limits + feature matrix + SLA + support tier.
// All pricing in INR. Seed-data baseline anchored to the firm's REAL plan.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PlanDefinition, PlanKey, PlanLimits } from './types';

export const PLATFORM_PLANS: PlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For solo practitioners getting started with GST compliance.',
    monthlyPrice: 2999,
    annualPrice: 29990,            // ~2 months free
    seatPrice: 999,
    limits: {
      seats: 3,
      storageGb: 5,
      apiCallsPerMonth: 10000,
      aiCreditsPerMonth: 1000,
      workflowExecutions: 500,
      agiExecutions: 50,
      connectors: 3,
      marketplaceApps: 5,
      environments: 2,
    },
    features: [
      'Up to 3 team members',
      '5 GB encrypted storage',
      'GST returns (GSTR-1, 3B, 9)',
      'Reconciliation engine',
      'Basic AI insights',
      'Email support (48h SLA)',
    ],
    support: 'Email — 48h response',
  },
  {
    key: 'professional',
    name: 'Professional',
    tagline: 'For growing CA & accounting firms.',
    monthlyPrice: 7999,
    annualPrice: 79990,
    seatPrice: 1499,
    recommended: true,
    highlight: 'Most Popular',
    limits: {
      seats: 10,
      storageGb: 50,
      apiCallsPerMonth: 100000,
      aiCreditsPerMonth: 10000,
      workflowExecutions: 5000,
      agiExecutions: 500,
      connectors: 10,
      marketplaceApps: 25,
      environments: 3,
    },
    features: [
      'Up to 10 team members',
      '50 GB encrypted storage',
      'All GST returns + TDS + Payroll',
      'AI CFO™ + AI Compliance™',
      'Digital Twin™ simulator',
      'Marketplace access',
      'Priority email support (12h SLA)',
    ],
    support: 'Priority — 12h response',
  },
  {
    key: 'business',
    name: 'Business',
    tagline: 'For mid-sized enterprises with multiple branches.',
    monthlyPrice: 19999,
    annualPrice: 199990,
    seatPrice: 1999,
    limits: {
      seats: 50,
      storageGb: 250,
      apiCallsPerMonth: 1000000,
      aiCreditsPerMonth: 100000,
      workflowExecutions: 50000,
      agiExecutions: 5000,
      connectors: 25,
      marketplaceApps: 100,
      environments: 5,
    },
    features: [
      'Up to 50 team members',
      '250 GB encrypted storage',
      'AI CEO™ + full executive suite',
      'Business Graph™ + Knowledge Graph™',
      'Multi-branch + subsidiaries',
      'White-label branding',
      'API platform + webhooks',
      'Phone + email support (4h SLA)',
    ],
    support: 'Phone + email — 4h response',
    sla: '99.9% uptime',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations running autonomous operations.',
    monthlyPrice: 49999,
    annualPrice: 499990,
    seatPrice: 2499,
    limits: {
      seats: 250,
      storageGb: 1000,
      apiCallsPerMonth: 10000000,
      aiCreditsPerMonth: 1000000,
      workflowExecutions: 500000,
      agiExecutions: 50000,
      connectors: 100,
      marketplaceApps: 500,
      environments: 10,
    },
    features: [
      'Up to 250 team members',
      '1 TB encrypted storage',
      'Autonomous Enterprise™ + Infinity AGI™',
      'Command Network™ + Execution Cloud™',
      'SAML / Azure AD / Okta SSO',
      'Custom AI training',
      'Dedicated success manager',
      '24/7 phone + chat (1h SLA)',
    ],
    support: '24/7 — 1h response',
    sla: '99.95% uptime',
  },
  {
    key: 'enterprise_plus',
    name: 'Enterprise Plus',
    tagline: 'For global enterprises needing unlimited scale + isolation.',
    monthlyPrice: 149999,
    annualPrice: 1499990,
    seatPrice: 2999,
    limits: {
      seats: null,                 // unlimited
      storageGb: 10000,
      apiCallsPerMonth: 100000000,
      aiCreditsPerMonth: 10000000,
      workflowExecutions: 5000000,
      agiExecutions: 500000,
      connectors: null,
      marketplaceApps: null,
      environments: 50,
    },
    features: [
      'Unlimited team members',
      '10 TB encrypted storage',
      'Dedicated infrastructure + single-tenant',
      'Custom AGI agents + private models',
      'On-prem / regional deployment',
      'SOC 2 Type II + ISO 27001',
      'Custom contracts + DPA',
      'White-glove onboarding',
      'Dedicated SRE + TAM',
    ],
    support: 'White-glove — 15min response',
    sla: '99.99% uptime',
  },
  {
    key: 'custom',
    name: 'Custom',
    tagline: 'Tailored for unique requirements. Talk to sales.',
    monthlyPrice: 0,
    annualPrice: 0,
    seatPrice: 0,
    limits: {
      seats: null,
      storageGb: 0,
      apiCallsPerMonth: 0,
      aiCreditsPerMonth: 0,
      workflowExecutions: 0,
      agiExecutions: 0,
      connectors: null,
      marketplaceApps: null,
      environments: 0,
    },
    features: [
      'Custom seat & usage pricing',
      'Custom SLAs & compliance',
      'Custom integrations',
      'Co-development roadmap',
      'Private cloud / hybrid deployment',
    ],
    support: 'Dedicated account team',
    sla: 'Custom',
  },
];

export const PLAN_MAP: Record<PlanKey, PlanDefinition> = PLATFORM_PLANS.reduce(
  (acc, plan) => {
    acc[plan.key] = plan;
    return acc;
  },
  {} as Record<PlanKey, PlanDefinition>,
);

export function getPlan(key: PlanKey): PlanDefinition {
  return PLAN_MAP[key] ?? PLATFORM_PLANS[0];
}

export function getPlanLimits(key: PlanKey): PlanLimits {
  return getPlan(key).limits;
}

export function formatINR(amount: number): string {
  if (amount === 0) return 'Custom';
  return '₹' + amount.toLocaleString('en-IN');
}
