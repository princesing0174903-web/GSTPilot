// ═══════════════════════════════════════════════════════════════════════════
// GSTPILOT MARKETPLACE™ & APP ECOSYSTEM™ — Data Layer
// Phase 10: Turn VEYRO from a SaaS into a Platform.
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PRODUCTION SAFETY ──────────────────────────────────────────────────────
// Previously this module shipped ~615 lines of fabricated "platform scale"
// data: MARKETPLACE_APPS (with fake developer names / ratings / installs /
// prices), DEVELOPERS, API_PRODUCTS, WORKFLOW_TEMPLATES (with fake installs
// and ratings), REVENUE_RECORDS (with fabricated ₹12,38,400 payouts),
// ENTERPRISE_EXTENSIONS (with fake "2,400+ users" claims), AI_SKILLS (with
// fabricated "99.2% accuracy"), BILLING_PLANS, ECOSYSTEM_STATS (fake "147
// apps, 89 developers, 2.8M installs, ₹18.4 Cr revenue"), and
// PLATFORM_TRANSFORMATION. All of these presented fabricated platform metrics
// as real, which is misleading to users. The arrays/objects are now empty
// until real data is wired up from the App Marketplace DB.
// REVENUE_SPLIT (developer/gstpilot revenue share) is kept as a config ratio.
// TODO: Replace each export with real data from /api/marketplace/* when the
// App Marketplace DB integration lands.
// ═══════════════════════════════════════════════════════════════════════════

// ── MODULE 1: APP STORE ────────────────────────────────────────────────────
export interface MarketplaceApp {
  id: string;
  name: string;
  developer: string;
  category: 'GST' | 'Banking' | 'Accounting' | 'Payments' | 'Payroll' | 'Communication' | 'Compliance' | 'Analytics';
  tagline: string;
  description: string;
  rating: number;
  reviews: number;
  installs: string;
  price: string;
  pricePeriod: 'free' | 'month' | 'one-time';
  featured: boolean;
  verified: boolean;
  iconBg: string; // gradient class
  iconSymbol: string; // emoji or short text
  capabilities: string[];
}

export const MARKETPLACE_APPS: MarketplaceApp[] = [];

// ── MODULE 2: DEVELOPER PLATFORM ───────────────────────────────────────────
export interface Developer {
  id: string;
  name: string;
  avatar: string;
  appsPublished: number;
  totalInstalls: string;
  revenue: string;
  rating: number;
  status: 'verified' | 'pending' | 'suspended';
  joinedAt: string;
}

export const DEVELOPERS: Developer[] = [];

// ── MODULE 3: API MARKETPLACE ──────────────────────────────────────────────
export interface ApiProduct {
  id: string;
  name: string;
  category: 'GST' | 'Invoice' | 'CFO' | 'Forecast' | 'Compliance' | 'Oracle';
  description: string;
  endpoints: number;
  calls: string; // monthly calls
  pricing: { tier: string; price: string; calls: string; features: string[] }[];
  latency: string;
  uptime: string;
  popular: boolean;
}

export const API_PRODUCTS: ApiProduct[] = [];

// ── MODULE 4: AUTOMATION MARKETPLACE ───────────────────────────────────────
export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: number;
  trigger: string;
  actions: string[];
  installs: string;
  rating: number;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [];

// ── MODULE 5: REVENUE SHARING ──────────────────────────────────────────────
export interface RevenueRecord {
  developer: string;
  app: string;
  grossRevenue: string;
  developerShare: string; // 70%
  gstpilotShare: string;  // 30%
  status: 'paid' | 'pending' | 'processing';
  period: string;
}

export const REVENUE_RECORDS: RevenueRecord[] = [];

export const REVENUE_SPLIT = { developer: 70, gstpilot: 30 };

// ── MODULE 6: ENTERPRISE EXTENSIONS ────────────────────────────────────────
export interface EnterpriseExtension {
  id: string;
  name: string;
  industry: string;
  description: string;
  modules: string[];
  users: string;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const ENTERPRISE_EXTENSIONS: EnterpriseExtension[] = [];

// ── MODULE 7: AI SKILL STORE ───────────────────────────────────────────────
export interface AiSkill {
  id: string;
  name: string;
  domain: string;
  description: string;
  capabilities: string[];
  accuracy: string;
  installs: string;
  rating: number;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const AI_SKILLS: AiSkill[] = [];

// ── MODULE 8: BILLING ENGINE ───────────────────────────────────────────────
export interface BillingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
  appAllowance: string;
  apiCalls: string;
}

export const BILLING_PLANS: BillingPlan[] = [];

// ── MODULE 9: ECOSYSTEM ANALYTICS ──────────────────────────────────────────
export const ECOSYSTEM_STATS = {};

// ── MODULE 10: PLATFORM MODE TRANSFORMATION ────────────────────────────────
export const PLATFORM_TRANSFORMATION = {};
