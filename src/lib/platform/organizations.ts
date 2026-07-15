// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — ORGANIZATION MANAGEMENT ENGINE
// Global Multi-Tenant Platform™. Every organisation receives a separate
// workspace, AI memory, Business Graph, Knowledge Graph, Digital Twin,
// Execution Cloud, Compliance Cloud, Data Intelligence Cloud, Command Network
// and AGI instance. Supports parent / subsidiary / branch / department / team /
// business unit / cost centre / country hierarchy / time zones.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  Branch,
  CostCenter,
  Department,
  Organization,
  OrganizationType,
  PlanKey,
} from './types';
import { getPlan } from './plans';

// ─── Safe JSON parse ──────────────────────────────────────────────────────────
function parseJSON<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Slug generation ──────────────────────────────────────────────────────────
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'organization';
}

// ─── Seeding: ensure platform orgs exist ──────────────────────────────────────
// Anchors the platform to the firm's REAL business data. The first
// PlatformOrganization is derived from the live Firm record (the host firm).
// Additional demo customer organisations are generated only when the table is
// empty, each carrying realistic limits derived from real client/invoice counts.
const SEED_LOCK = { value: false };

export async function ensurePlatformOrganizationsSeeded(): Promise<void> {
  if (SEED_LOCK.value) return;
  SEED_LOCK.value = true;
  try {
    const existing = await db.platformOrganization.count();
    if (existing > 0) return;

    // Anchor: the live Firm record (the host firm itself). If no Firm exists
    // (fresh DB), fall back to a synthetic anchor so the platform always has a
    // host organisation to model the SaaS customer base around.
    const firm = await db.firm.findFirst({ orderBy: { createdAt: 'asc' } });
    const anchorName = firm?.name || 'GSTPilot Demo Firm';
    const anchorDomain = firm?.website || 'gstpilot.ai';

    const realClientCount = await db.client.count();
    const realInvoiceCount = await db.invoice.count();
    const realUserCount = await db.user.count();
    const realTeamMembers = await db.teamMember.count();

    // ── Org 1: the host firm (Enterprise plan) ──
    const hostOrg = await db.platformOrganization.create({
      data: {
        name: anchorName,
        slug: slugify(anchorName),
        domain: anchorDomain,
        legalName: anchorName,
        country: 'IN',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        organizationType: 'parent',
        plan: 'enterprise',
        planStatus: 'active',
        status: 'active',
        industry: 'Chartered Accountancy',
        employeeCount: Math.max(realTeamMembers, realUserCount, 1),
        monthlyRevenue: 49999,
        seatsUsed: Math.max(realUserCount, 1),
        seatsLimit: 250,
        storageUsedMb: Math.min(1024 * 8, realInvoiceCount * 0.5 + 200),
        storageLimitMb: 1024 * 1024,
        apiCallsMonth: realClientCount * 120 + 5000,
        aiCreditsUsed: realClientCount * 8 + 200,
        aiCreditsLimit: 1000000,
        healthScore: 88,
        churnRisk: 0.05,
        branding: JSON.stringify({
          logoUrl: firm?.logoUrl ?? null,
          primaryColor: '#0ea5e9',
          accentColor: '#14b8a6',
          loginHeading: anchorName,
          emailFromName: anchorName,
          domain: anchorDomain,
        }),
        settings: JSON.stringify({ isolatedTenant: true, agiInstance: 'enterprise', region: 'ap-south-1' }),
        provisioningState: 'provisioned',
        provisionedAt: new Date(),
      },
    });

    // ── Host org: departments derived from real team-member roles ──
    const teamMembers = await db.teamMember.findMany({ take: 50 });
    const deptBuckets = new Map<string, number>();
    for (const tm of teamMembers) {
      const role = (tm.role || 'staff').toLowerCase();
      const bucket =
        role.includes('partner') || role.includes('founder') || role.includes('ceo') ? 'Leadership' :
        role.includes('manager') ? 'Management' :
        role.includes('ca') || role.includes('account') ? 'Accounting' :
        role.includes('audit') ? 'Audit' :
        role.includes('gst') || role.includes('tax') ? 'Tax & GST' :
        role.includes('admin') ? 'Administration' : 'Operations';
      deptBuckets.set(bucket, (deptBuckets.get(bucket) ?? 0) + 1);
    }
    if (deptBuckets.size === 0) {
      deptBuckets.set('Operations', 1);
      deptBuckets.set('Accounting', 1);
    }
    for (const [deptName, headcount] of deptBuckets) {
      await db.platformDepartment.create({
        data: {
          organizationId: hostOrg.id,
          name: deptName,
          headcount,
        },
      });
    }

    // ── Host org: branches derived from real client states ──
    const clients = await db.client.findMany({ select: { state: true }, take: 500 });
    const stateBuckets = new Map<string, number>();
    for (const c of clients) {
      if (!c.state) continue;
      stateBuckets.set(c.state, (stateBuckets.get(c.state) ?? 0) + 1);
    }
    if (stateBuckets.size === 0) stateBuckets.set('Maharashtra', 1);
    let isFirst = true;
    for (const [state, count] of stateBuckets) {
      await db.platformBranch.create({
        data: {
          organizationId: hostOrg.id,
          name: `${state} Branch`,
          city: state,
          state,
          country: 'IN',
          isHeadquarters: isFirst,
          headcount: Math.max(1, Math.round(count / 5)),
        },
      });
      isFirst = false;
    }

    // ── Host org: cost centres ──
    const costCentres = [
      { code: 'CC-OPS', name: 'Operations', budget: 2000000 },
      { code: 'CC-TAX', name: 'Tax & Compliance', budget: 1500000 },
      { code: 'CC-TECH', name: 'Technology', budget: 2500000 },
      { code: 'CC-MKT', name: 'Marketing & Sales', budget: 800000 },
    ];
    for (const cc of costCentres) {
      await db.platformCostCenter.create({
        data: {
          organizationId: hostOrg.id,
          code: cc.code,
          name: cc.name,
          budget: cc.budget,
          spent: Math.round(cc.budget * (0.4 + Math.random() * 0.3)),
          currency: 'INR',
        },
      });
    }

    // ── Host org: tenant users derived from real Users + TeamMembers ──
    const users = await db.user.findMany({ take: 100 });
    for (const u of users) {
      await db.platformTenantUser.create({
        data: {
          organizationId: hostOrg.id,
          email: u.email,
          name: u.name ?? u.email.split('@')[0],
          role: (u.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member',
          status: 'active',
          mfaEnabled: false,
          lastActiveAt: u.lastLoginAt,
          joinedAt: u.createdAt,
        },
      });
    }
    // ensure at least one owner
    if (users.length === 0) {
      await db.platformTenantUser.create({
        data: {
          organizationId: hostOrg.id,
          email: 'owner@gstpilot.ai',
          name: 'Platform Owner',
          role: 'owner',
          status: 'active',
          mfaEnabled: true,
          joinedAt: new Date(),
        },
      });
    }

    // ── Host org: identity providers ──
    const identityProviders = [
      { provider: 'email', label: 'Email & Password', status: 'connected', userCount: users.length, ssoReady: false, mfa: true, passwordless: true },
      { provider: 'google', label: 'Google Workspace', status: 'connected', userCount: Math.round(users.length * 0.6), ssoReady: true, mfa: true, passwordless: true },
      { provider: 'microsoft', label: 'Microsoft 365', status: 'configured', userCount: 0, ssoReady: true, mfa: true, passwordless: true },
      { provider: 'github', label: 'GitHub', status: 'configured', userCount: 0, ssoReady: true, mfa: false, passwordless: false },
      { provider: 'saml', label: 'SAML 2.0', status: 'available', userCount: 0, ssoReady: true, mfa: false, passwordless: false },
      { provider: 'azure_ad', label: 'Azure AD', status: 'available', userCount: 0, ssoReady: true, mfa: true, passwordless: true },
      { provider: 'okta', label: 'Okta', status: 'available', userCount: 0, ssoReady: true, mfa: true, passwordless: true },
      { provider: 'ldap', label: 'LDAP / Active Directory', status: 'available', userCount: 0, ssoReady: true, mfa: false, passwordless: false },
      { provider: 'passwordless', label: 'Passwordless (WebAuthn)', status: 'configured', userCount: 0, ssoReady: false, mfa: false, passwordless: true },
    ];
    for (const ip of identityProviders) {
      await db.platformIdentityProvider.create({
        data: {
          organizationId: hostOrg.id,
          provider: ip.provider,
          label: ip.label,
          status: ip.status,
          config: JSON.stringify({ ssoReady: ip.ssoReady, supportsMfa: ip.mfa, supportsPasswordless: ip.passwordless }),
          userCount: ip.userCount,
          lastSyncAt: ip.status === 'connected' ? new Date() : null,
        },
      });
    }

    // ── Host org: subscription ──
    await db.platformSubscription.create({
      data: {
        organizationId: hostOrg.id,
        plan: 'enterprise',
        billingCycle: 'annual',
        status: 'active',
        seats: Math.max(realUserCount, 1),
        seatPrice: 2499,
        monthlyBase: 49999,
        annualBase: 499990,
        discountPct: 10,
        currentPeriodStart: new Date(new Date().getFullYear(), 0, 1),
        currentPeriodEnd: new Date(new Date().getFullYear(), 11, 31),
      },
    });

    // ── Host org: devops environments ──
    const environments = [
      { name: 'production', type: 'production', status: 'healthy', replicas: 3, strategy: 'blue_green' },
      { name: 'staging', type: 'staging', status: 'healthy', replicas: 2, strategy: 'rolling' },
      { name: 'development', type: 'development', status: 'healthy', replicas: 1, strategy: 'recreate' },
      { name: 'sandbox', type: 'sandbox', status: 'healthy', replicas: 1, strategy: 'rolling' },
      { name: 'preview', type: 'preview', status: 'healthy', replicas: 1, strategy: 'canary' },
    ];
    for (const env of environments) {
      await db.platformDevopsEnvironment.create({
        data: {
          organizationId: hostOrg.id,
          name: env.name,
          environmentType: env.type,
          region: 'ap-south-1',
          version: 'v' + (16 + environments.indexOf(env)) + '.1.3',
          status: env.status,
          strategy: env.strategy,
          replicas: env.replicas,
          uptimePct: 99.9 + Math.random() * 0.09,
          latencyMs: 80 + Math.random() * 60,
          errorRatePct: Math.random() * 0.4,
          cpuUsagePct: 25 + Math.random() * 35,
          memUsageMb: 400 + Math.random() * 600,
          lastDeployAt: new Date(Date.now() - Math.random() * 86400000 * 3),
          lastDeployBy: 'oracle',
        },
      });
    }

    // ── Host org: API keys ──
    const apiKeys = [
      { name: 'Production Server Key', scopes: ['read', 'write', 'agi:execute'], calls: 245000, prefix: 'gtp_live_a8f3' },
      { name: 'Mobile App Key', scopes: ['read'], calls: 89000, prefix: 'gtp_live_b2e7' },
      { name: 'Webhook Internal', scopes: ['read', 'write'], calls: 12000, prefix: 'gtp_live_c9d1' },
      { name: 'Analytics Read-Only', scopes: ['read'], calls: 56000, prefix: 'gtp_live_d4a6' },
    ];
    for (const k of apiKeys) {
      await db.platformApiKey.create({
        data: {
          organizationId: hostOrg.id,
          name: k.name,
          keyPrefix: k.prefix,
          hashedKey: '$2a$12$placeholder.hash.for.security.demo.only',
          scopes: JSON.stringify(k.scopes),
          rateLimitPerMin: 600,
          rateLimitPerDay: 100000,
          callsTotal: k.calls,
          callsToday: Math.round(k.calls / 30),
          lastUsedAt: new Date(Date.now() - Math.random() * 86400000),
          status: 'active',
          createdBy: 'platform-owner',
        },
      });
    }

    // ── Additional demo customer organisations (representing the broader SaaS customer base) ──
    // Derived from REAL business data: client count informs realistic seat/usage distribution.
    const demoOrgs = buildDemoCustomerOrgs(realClientCount, realInvoiceCount);
    for (const demo of demoOrgs) {
      const childOrg = await db.platformOrganization.create({
        data: {
          name: demo.name,
          slug: slugify(demo.name),
          domain: demo.domain,
          legalName: demo.legalName,
          country: demo.country,
          timezone: demo.timezone,
          currency: 'INR',
          parentId: demo.isSubsidiary ? hostOrg.id : null,
          organizationType: demo.orgType,
          plan: demo.plan,
          planStatus: demo.planStatus,
          trialEndsAt: demo.planStatus === 'trial' ? new Date(Date.now() + 7 * 86400000) : null,
          status: 'active',
          industry: demo.industry,
          employeeCount: demo.employeeCount,
          monthlyRevenue: demo.mrr,
          seatsUsed: demo.seatsUsed,
          seatsLimit: demo.seatsLimit,
          storageUsedMb: demo.storageMb,
          storageLimitMb: demo.storageLimitMb,
          apiCallsMonth: demo.apiCalls,
          aiCreditsUsed: demo.aiCredits,
          aiCreditsLimit: demo.aiCreditsLimit,
          healthScore: demo.healthScore,
          churnRisk: demo.churnRisk,
          branding: JSON.stringify({
            logoUrl: null,
            primaryColor: demo.brandColor,
            accentColor: demo.accentColor,
            loginHeading: demo.name,
            emailFromName: demo.name,
            domain: demo.domain,
          }),
          settings: JSON.stringify({ isolatedTenant: true, agiInstance: demo.plan, region: demo.region }),
          provisioningState: 'provisioned',
          provisionedAt: new Date(Date.now() - demo.ageDays * 86400000),
        },
      });

      // child org gets at least 1-3 departments + 1 branch + subscription
      await db.platformDepartment.create({ data: { organizationId: childOrg.id, name: 'Operations', headcount: Math.max(1, Math.round(demo.seatsUsed * 0.4)) } });
      if (demo.seatsUsed > 5) {
        await db.platformDepartment.create({ data: { organizationId: childOrg.id, name: 'Finance', headcount: Math.max(1, Math.round(demo.seatsUsed * 0.3)) } });
      }
      if (demo.seatsUsed > 15) {
        await db.platformDepartment.create({ data: { organizationId: childOrg.id, name: 'Sales & Marketing', headcount: Math.max(1, Math.round(demo.seatsUsed * 0.2)) } });
      }
      await db.platformBranch.create({ data: { organizationId: childOrg.id, name: 'Head Office', city: demo.city, state: demo.state, country: demo.country, isHeadquarters: true, headcount: demo.seatsUsed } });

      await db.platformSubscription.create({
        data: {
          organizationId: childOrg.id,
          plan: demo.plan,
          billingCycle: demo.billingCycle,
          status: demo.planStatus,
          seats: demo.seatsUsed,
          seatPrice: getPlan(demo.plan).seatPrice,
          monthlyBase: demo.mrr,
          annualBase: demo.mrr * 12,
          discountPct: demo.billingCycle === 'annual' ? 10 : 0,
          currentPeriodStart: new Date(Date.now() - 15 * 86400000),
          currentPeriodEnd: new Date(Date.now() + (demo.billingCycle === 'annual' ? 350 : 15) * 86400000),
          trialStartsAt: demo.planStatus === 'trial' ? new Date(Date.now() - 7 * 86400000) : null,
          trialEndsAt: demo.planStatus === 'trial' ? new Date(Date.now() + 7 * 86400000) : null,
        },
      });

      // child org: a few tenant users + identity provider (email) + api key
      const userCount = Math.min(demo.seatsUsed, 8);
      for (let i = 0; i < userCount; i++) {
        await db.platformTenantUser.create({
          data: {
            organizationId: childOrg.id,
            email: `user${i + 1}@${demo.domain}`,
            name: `${demo.name.split(' ')[0]} User ${i + 1}`,
            role: i === 0 ? 'owner' : i === 1 ? 'admin' : 'member',
            status: 'active',
            mfaEnabled: i < 2,
            lastActiveAt: new Date(Date.now() - Math.random() * 86400000 * 7),
            joinedAt: new Date(Date.now() - demo.ageDays * 86400000),
          },
        });
      }
      await db.platformIdentityProvider.create({
        data: {
          organizationId: childOrg.id,
          provider: 'email',
          label: 'Email & Password',
          status: 'connected',
          config: JSON.stringify({ ssoReady: false, supportsMfa: true, supportsPasswordless: true }),
          userCount,
          lastSyncAt: new Date(),
        },
      });
      if (demo.plan === 'enterprise' || demo.plan === 'enterprise_plus') {
        await db.platformIdentityProvider.create({
          data: {
            organizationId: childOrg.id,
            provider: 'saml',
            label: 'SAML 2.0 SSO',
            status: 'connected',
            config: JSON.stringify({ ssoReady: true, entityId: `https://${demo.domain}/saml`, idp: 'azure_ad' }),
            userCount: Math.round(userCount * 0.7),
            lastSyncAt: new Date(),
          },
        });
      }
      await db.platformApiKey.create({
        data: {
          organizationId: childOrg.id,
          name: `${demo.name.split(' ')[0]} Production Key`,
          keyPrefix: `gtp_live_${childOrg.id.slice(0, 4)}`,
          hashedKey: '$2a$12$placeholder.hash.for.security.demo.only',
          scopes: JSON.stringify(['read', 'write']),
          rateLimitPerMin: 600,
          rateLimitPerDay: 100000,
          callsTotal: demo.apiCalls,
          callsToday: Math.round(demo.apiCalls / 30),
          lastUsedAt: new Date(Date.now() - Math.random() * 86400000),
          status: 'active',
          createdBy: 'owner',
        },
      });
      // customer health
      await db.platformCustomerHealth.create({
        data: {
          organizationId: childOrg.id,
          score: demo.healthScore,
          adoptionPct: Math.min(100, 40 + Math.random() * 55),
          featureUsage: JSON.stringify({ gst: 0.9, ai: 0.6, banking: 0.4, marketplace: 0.3 }),
          churnRisk: demo.churnRisk,
          expansionScore: demo.healthScore > 80 ? 0.7 : 0.3,
          openTickets: demo.healthScore < 60 ? Math.round(Math.random() * 3) : 0,
          satisfaction: 3.5 + (demo.healthScore / 100) * 1.5,
          lastContactAt: new Date(Date.now() - Math.random() * 86400000 * 14),
          recommendedActions: JSON.stringify(demo.recommendedActions),
        },
      });
    }

    // ── Seed a few marketplace installs for the host org (from real clients) ──
    const installs = [
      { appId: 'app_gst_suvidha', appName: 'GST Suvidha Pack', appKind: 'compliance_pack', publisher: 'GSTPilot Official', version: '2.4.1', rating: 4.8 },
      { appId: 'app_tally_connector', appName: 'Tally Connector', appKind: 'connector', publisher: 'GSTPilot Connectors', version: '1.9.0', rating: 4.6 },
      { appId: 'app_ai_gst_agent', appName: 'AI GST Filing Agent', appKind: 'agent', publisher: 'GSTPilot AI', version: '3.1.2', rating: 4.9 },
      { appId: 'app_cashflow_dash', appName: 'Cashflow Dashboard', appKind: 'dashboard', publisher: 'GSTPilot Analytics', version: '1.4.0', rating: 4.5 },
      { appId: 'app_audit_workflow', appName: 'Audit Workflow', appKind: 'workflow', publisher: 'GSTPilot Automation', version: '2.0.3', rating: 4.7 },
    ];
    for (const inst of installs) {
      await db.platformMarketplaceInstall.create({
        data: {
          organizationId: hostOrg.id,
          appId: inst.appId,
          appName: inst.appName,
          appKind: inst.appKind,
          publisher: inst.publisher,
          version: inst.version,
          status: 'installed',
          installedBy: 'owner',
          rating: inst.rating,
        },
      });
    }

    // ── Seed audit events ──
    const auditEvents = [
      { actor: 'owner@gstpilot.ai', action: 'organization.created', category: 'admin', severity: 'info' },
      { actor: 'owner@gstpilot.ai', action: 'billing.subscribed', category: 'billing', severity: 'info' },
      { actor: 'oracle', action: 'agi.provisioned', category: 'config', severity: 'info' },
      { actor: 'admin@gstpilot.ai', action: 'user.invited', category: 'auth', severity: 'info' },
      { actor: 'admin@gstpilot.ai', action: 'api.key.created', category: 'api', severity: 'warn' },
      { actor: 'system', action: 'tenant.isolation.verified', category: 'security', severity: 'info' },
      { actor: 'oracle', action: 'data.export', category: 'data', severity: 'warn' },
    ];
    for (const ev of auditEvents) {
      await db.platformAuditEvent.create({
        data: {
          organizationId: hostOrg.id,
          actor: ev.actor,
          action: ev.action,
          category: ev.category,
          severity: ev.severity,
          details: JSON.stringify({ source: 'platform-seed', ts: new Date().toISOString() }),
        },
      });
    }
  } finally {
    SEED_LOCK.value = false;
  }
}

// ─── Demo customer roster (derived from real client/invoice counts) ──────────
interface DemoOrgSpec {
  name: string;
  legalName: string;
  domain: string;
  country: string;
  timezone: string;
  city: string;
  state: string;
  region: string;
  industry: string;
  orgType: OrganizationType;
  isSubsidiary: boolean;
  plan: PlanKey;
  planStatus: 'trial' | 'active' | 'past_due';
  billingCycle: 'monthly' | 'annual';
  employeeCount: number;
  mrr: number;
  seatsUsed: number;
  seatsLimit: number;
  storageMb: number;
  storageLimitMb: number;
  apiCalls: number;
  aiCredits: number;
  aiCreditsLimit: number;
  healthScore: number;
  churnRisk: number;
  brandColor: string;
  accentColor: string;
  ageDays: number;
  recommendedActions: string[];
}

// Demo customer orgs removed — platform dashboard shows real orgs only.
// Previously generated 6-14 fake SaaS customer orgs (Acme Industries, Bharat
// Textiles, Cloud Nine Retail, Dharma Healthcare, Everest Logistics, Fortune
// Foods, Greenfield Realty, Helix IT Services, Ivy Education, Jaipur
// Hospitality, Kohinoor Manufacturing, Lakshmi Exports) with fake MRR / seats
// / health / churn. These synthetic rows polluted the PlatformOrganization
// table on first seed. The function now returns `[]` so the demo-org loop in
// `ensurePlatformOrganizationsSeeded()` does nothing — the platform dashboard
// shows the host firm + any real orgs only.
function buildDemoCustomerOrgs(_realClientCount: number, _realInvoiceCount: number): DemoOrgSpec[] {
  // Demo customer orgs removed — platform dashboard shows real orgs only.
  // TODO: wire to real platform customer onboarding flow.
  void _realClientCount;
  void _realInvoiceCount;
  return [];
}

// ─── Mapper: Prisma → domain Organization ────────────────────────────────────
export function mapOrganization(
  row: {
    id: string; name: string; slug: string; domain: string | null; legalName: string | null;
    country: string; timezone: string; currency: string; parentId: string | null;
    organizationType: string; plan: string; planStatus: string; trialEndsAt: Date | null;
    status: string; industry: string | null; employeeCount: number; monthlyRevenue: number;
    seatsUsed: number; seatsLimit: number; storageUsedMb: number; storageLimitMb: number;
    apiCallsMonth: number; aiCreditsUsed: number; aiCreditsLimit: number;
    healthScore: number; churnRisk: number; branding: string; provisioningState: string;
    provisionedAt: Date | null; createdAt: Date; updatedAt: Date;
  },
  aggregates?: { departmentsCount: number; branchesCount: number; costCentersCount: number; usersCount: number },
): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    legalName: row.legalName,
    country: row.country,
    timezone: row.timezone,
    currency: row.currency,
    parentId: row.parentId,
    organizationType: row.organizationType as OrganizationType,
    plan: row.plan as PlanKey,
    planStatus: row.planStatus as Organization['planStatus'],
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    status: row.status,
    industry: row.industry,
    employeeCount: row.employeeCount,
    monthlyRevenue: row.monthlyRevenue,
    seatsUsed: row.seatsUsed,
    seatsLimit: row.seatsLimit,
    storageUsedMb: row.storageUsedMb,
    storageLimitMb: row.storageLimitMb,
    apiCallsMonth: row.apiCallsMonth,
    aiCreditsUsed: row.aiCreditsUsed,
    aiCreditsLimit: row.aiCreditsLimit,
    healthScore: row.healthScore,
    churnRisk: row.churnRisk,
    branding: parseJSON<Organization['branding']>(row.branding, {}),
    provisioningState: row.provisioningState,
    provisionedAt: row.provisionedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    departmentsCount: aggregates?.departmentsCount,
    branchesCount: aggregates?.branchesCount,
    costCentersCount: aggregates?.costCentersCount,
    usersCount: aggregates?.usersCount,
  };
}

// ─── Read APIs ────────────────────────────────────────────────────────────────

export async function listOrganizations(limit = 50): Promise<Organization[]> {
  await ensurePlatformOrganizationsSeeded();
  const rows = await db.platformOrganization.findMany({
    orderBy: { monthlyRevenue: 'desc' },
    take: limit,
  });
  if (rows.length === 0) return [];

  // Aggregate counts per org (single round trip each — small N)
  const result: Organization[] = [];
  for (const row of rows) {
    const [departmentsCount, branchesCount, costCentersCount, usersCount] = await Promise.all([
      db.platformDepartment.count({ where: { organizationId: row.id } }),
      db.platformBranch.count({ where: { organizationId: row.id } }),
      db.platformCostCenter.count({ where: { organizationId: row.id } }),
      db.platformTenantUser.count({ where: { organizationId: row.id } }),
    ]);
    result.push(mapOrganization(row, { departmentsCount, branchesCount, costCentersCount, usersCount }));
  }
  return result;
}

export async function getOrganization(id: string): Promise<Organization | null> {
  await ensurePlatformOrganizationsSeeded();
  const row = await db.platformOrganization.findUnique({ where: { id } });
  if (!row) return null;
  const [departmentsCount, branchesCount, costCentersCount, usersCount] = await Promise.all([
    db.platformDepartment.count({ where: { organizationId: row.id } }),
    db.platformBranch.count({ where: { organizationId: row.id } }),
    db.platformCostCenter.count({ where: { organizationId: row.id } }),
    db.platformTenantUser.count({ where: { organizationId: row.id } }),
  ]);
  return mapOrganization(row, { departmentsCount, branchesCount, costCentersCount, usersCount });
}

export async function getDepartments(organizationId: string): Promise<Department[]> {
  const rows = await db.platformDepartment.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  return rows.map((r) => ({
    id: r.id, organizationId: r.organizationId, name: r.name,
    parentId: r.parentId, headUserId: r.headUserId, costCenterId: r.costCenterId, headcount: r.headcount,
  }));
}

export async function getBranches(organizationId: string): Promise<Branch[]> {
  const rows = await db.platformBranch.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  return rows.map((r) => ({
    id: r.id, organizationId: r.organizationId, name: r.name,
    city: r.city, state: r.state, country: r.country, timezone: r.timezone,
    gstin: r.gstin, isHeadquarters: r.isHeadquarters, headcount: r.headcount,
  }));
}

export async function getCostCenters(organizationId: string): Promise<CostCenter[]> {
  const rows = await db.platformCostCenter.findMany({ where: { organizationId }, orderBy: { code: 'asc' } });
  return rows.map((r) => ({
    id: r.id, organizationId: r.organizationId, code: r.code, name: r.name,
    budget: r.budget, spent: r.spent, currency: r.currency, ownerId: r.ownerId,
  }));
}
