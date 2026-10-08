// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — Seed Data
// Seeds: 5 developers · 25 starter apps · 12 AI employee apps · 8 installs
// 15 reviews · 6 plugins · 10 webhooks · analytics events · payouts
// Idempotent — safe to run multiple times.
//
// GATING: Disabled by default. Set `GSTPILOT_ALLOW_SEED=true` in env (and
// `NODE_ENV !== 'production'`) to enable. Real apps / developers / installs
// should come from the marketplace publisher + install flows — this seed file
// previously persisted 17 fake developers (VEYRO Labs, TaxTech India, Tally
// Solutions, Intuit Partner, etc.), 25 starter apps, 12 AI employee apps,
// installs, reviews, plugins, webhooks, analytics events, and payouts — all
// with Math.random()-derived install counts / ratings / review counts. Now
// no-ops unless explicitly enabled.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { AI_EMPLOYEE_APPS, EXTENSION_POINTS_META, STANDARD_WEBHOOK_EVENTS, type AppPermission, type ExtensionPoint } from './types';
import { STARTER_APPS } from './catalog';
import { resolveDefaultTenantId } from './registry';

/** Seed the entire App Marketplace catalog + tenant-scoped data. Idempotent. */
export async function seedAppMarketplace(): Promise<{ developers: number; apps: number; aiEmployees: number; installs: number; reviews: number; plugins: number; webhooks: number; analytics: number; payouts: number }> {
  // GATING: Real apps / developers / installs come from the marketplace flows.
  // Set GSTPILOT_ALLOW_SEED=true (and NODE_ENV !== 'production') to re-enable.
  if (process.env.GSTPILOT_ALLOW_SEED !== 'true') return { developers: 0, apps: 0, aiEmployees: 0, installs: 0, reviews: 0, plugins: 0, webhooks: 0, analytics: 0, payouts: 0 };
  if (process.env.NODE_ENV === 'production') return { developers: 0, apps: 0, aiEmployees: 0, installs: 0, reviews: 0, plugins: 0, webhooks: 0, analytics: 0, payouts: 0 };

  // 1. Seed developers (17 — covers all STARTER_APPS developer slugs)
  const developerDefs = [
    { slug: 'gstpilot-labs', name: 'VEYRO Labs', displayName: 'VEYRO Labs', email: 'labs@gstpilot.com', website: 'https://labs.gstpilot.com', bio: 'Official VEYRO first-party apps and AI tools.', verified: true, partnerLevel: 'strategic', revenueSharePct: 100, country: 'India' },
    { slug: 'taxtech-india', name: 'TaxTech India', displayName: 'TaxTech India', email: 'hello@taxtech.in', website: 'https://taxtech.in', bio: 'GST and tax compliance specialists.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'India' },
    { slug: 'tally-solutions', name: 'Tally Solutions', displayName: 'Tally Solutions', email: 'partners@tallysolutions.com', website: 'https://tallysolutions.com', bio: 'Official Tally Prime integration partner.', verified: true, partnerLevel: 'platinum', revenueSharePct: 80, country: 'India' },
    { slug: 'intuit-partner', name: 'Intuit Partner', displayName: 'Intuit Partner Network', email: 'partners@intuit.com', website: 'https://intuit.com', bio: 'QuickBooks integration partner.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'USA' },
    { slug: 'conversa-tech', name: 'Conversa Tech', displayName: 'Conversa Tech', email: 'team@conversa.tech', website: 'https://conversa.tech', bio: 'Conversational commerce and messaging integrations.', verified: false, partnerLevel: 'silver', revenueSharePct: 70, country: 'India' },
    { slug: 'growthforge', name: 'GrowthForge', displayName: 'GrowthForge', email: 'hi@growthforge.io', website: 'https://growthforge.io', bio: 'Growth marketing and analytics tools.', verified: false, partnerLevel: 'standard', revenueSharePct: 70, country: 'USA' },
    { slug: 'hrtech-india', name: 'HRTech India', displayName: 'HRTech India', email: 'contact@hrtech.in', website: 'https://hrtech.in', bio: 'HR and payroll technology for Indian businesses.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'India' },
    { slug: 'opsware', name: 'Opsware', displayName: 'Opsware Systems', email: 'hello@opsware.io', website: 'https://opsware.io', bio: 'Operations optimization software.', verified: false, partnerLevel: 'silver', revenueSharePct: 70, country: 'India' },
    { slug: 'factoryos', name: 'FactoryOS', displayName: 'FactoryOS', email: 'team@factoryos.com', website: 'https://factoryos.com', bio: 'Manufacturing execution systems.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'India' },
    { slug: 'retailtech', name: 'RetailTech', displayName: 'RetailTech Solutions', email: 'sales@retailtech.in', website: 'https://retailtech.in', bio: 'Retail POS and inventory technology.', verified: false, partnerLevel: 'standard', revenueSharePct: 70, country: 'India' },
    { slug: 'healthtech', name: 'HealthTech', displayName: 'HealthTech Partners', email: 'partners@healthtech.io', website: 'https://healthtech.io', bio: 'Healthcare practice technology.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'India' },
    { slug: 'buildtech', name: 'BuildTech', displayName: 'BuildTech Solutions', email: 'info@buildtech.in', website: 'https://buildtech.in', bio: 'Construction project technology.', verified: false, partnerLevel: 'silver', revenueSharePct: 70, country: 'India' },
    { slug: 'edutech-india', name: 'EduTech India', displayName: 'EduTech India', email: 'hello@edutech.in', website: 'https://edutech.in', bio: 'Education technology for schools and institutes.', verified: true, partnerLevel: 'silver', revenueSharePct: 70, country: 'India' },
    { slug: 'hospitality-os', name: 'HospitalityOS', displayName: 'Hospitality OS', email: 'team@hospitalityos.com', website: 'https://hospitalityos.com', bio: 'Hotel and hospitality management.', verified: false, partnerLevel: 'standard', revenueSharePct: 70, country: 'India' },
    { slug: 'legaltech', name: 'LegalTech', displayName: 'LegalTech India', email: 'contact@legaltech.in', website: 'https://legaltech.in', bio: 'Legal practice management technology.', verified: true, partnerLevel: 'silver', revenueSharePct: 70, country: 'India' },
    { slug: 'logistech', name: 'Logistech', displayName: 'Logistech Solutions', email: 'info@logistech.in', website: 'https://logistech.in', bio: 'Logistics and supply chain technology.', verified: false, partnerLevel: 'standard', revenueSharePct: 70, country: 'India' },
    { slug: 'secureforge', name: 'SecureForge', displayName: 'SecureForge', email: 'security@secureforge.io', website: 'https://secureforge.io', bio: 'Security audit and compliance tools.', verified: true, partnerLevel: 'gold', revenueSharePct: 75, country: 'USA' },
  ];

  const developerMap: Record<string, string> = {};
  for (const def of developerDefs) {
    const existing = await db.appDeveloper.findUnique({ where: { slug: def.slug } });
    if (existing) {
      developerMap[def.slug] = existing.id;
    } else {
      const dev = await db.appDeveloper.create({ data: def });
      developerMap[def.slug] = dev.id;
    }
  }

  // 2. Seed 25 starter apps
  let appsSeeded = 0;
  for (const def of STARTER_APPS) {
    const existing = await db.app.findUnique({ where: { slug: def.slug } });
    if (existing) continue;
    const developerId = developerMap[def.developerSlug];
    if (!developerId) continue;

    await db.app.create({
      data: {
        developerId,
        slug: def.slug, name: def.name, tagline: def.tagline, description: def.description,
        type: def.type, category: def.category, version: def.version, color: def.color,
        pricingModel: def.pricingModel, priceAmount: def.priceAmount,
        billingInterval: def.billingInterval ?? null,
        permissions: JSON.stringify(def.permissions),
        releaseNotes: def.releaseNotes,
        license: 'commercial',
        status: 'published', publishedAt: new Date(),
        featured: def.featured ?? false, verified: def.verified ?? false,
        signed: true,
        installCount: Math.floor(Math.random() * 5000) + 100,
        downloadCount: Math.floor(Math.random() * 10000) + 500,
        rating: Math.round((3.8 + Math.random() * 1.2) * 10) / 10,
        reviewCount: Math.floor(Math.random() * 200) + 10,
        compatibility: JSON.stringify(['starter', 'business', 'enterprise']),
      },
    });

    // Initial version record
    await db.appVersion.create({
      data: {
        appId: (await db.app.findUnique({ where: { slug: def.slug } }))!.id,
        version: def.version, releaseNotes: def.releaseNotes,
        status: 'released', fileSizeBytes: Math.floor(Math.random() * 5000000) + 500000,
      },
    });

    appsSeeded++;
  }

  // Also seed the 12 AI Employee apps into the App table (type = ai_employee)
  let aiEmployeesSeeded = 0;
  for (const ai of AI_EMPLOYEE_APPS) {
    const existing = await db.app.findUnique({ where: { slug: ai.slug } });
    if (existing) continue;
    await db.app.create({
      data: {
        developerId: developerMap['gstpilot-labs'],
        slug: ai.slug, name: ai.name, tagline: ai.role, description: ai.description,
        type: 'ai_employee', category: ai.industry, version: '1.0.0', color: ai.color,
        pricingModel: 'subscription', priceAmount: 999, billingInterval: 'monthly',
        permissions: JSON.stringify(ai.permissions),
        releaseNotes: 'Initial release — auto-connects with AI CEO™, AI Workforce™, Digital Twin™, Business Graph™, Automation™, and Knowledge Graph™.',
        license: 'commercial',
        status: 'published', publishedAt: new Date(),
        featured: false, verified: true, signed: true,
        installCount: Math.floor(Math.random() * 2000) + 50,
        downloadCount: Math.floor(Math.random() * 3000) + 100,
        rating: Math.round((4.2 + Math.random() * 0.7) * 10) / 10,
        reviewCount: Math.floor(Math.random() * 80) + 5,
        compatibility: JSON.stringify(['business', 'enterprise']),
      },
    });
    aiEmployeesSeeded++;
  }

  // 3. Seed tenant-scoped data (installs, reviews, plugins, webhooks, analytics, payouts)
  let tenantId: string;
  try {
    tenantId = await resolveDefaultTenantId();
  } catch {
    return { developers: Object.keys(developerMap).length, apps: appsSeeded, aiEmployees: aiEmployeesSeeded, installs: 0, reviews: 0, plugins: 0, webhooks: 0, analytics: 0, payouts: 0 };
  }

  // Pick 8 apps to install
  const allApps = await db.app.findMany({ take: 8, orderBy: { installCount: 'desc' }, include: { developer: true } });
  let installsSeeded = 0;
  for (const app of allApps) {
    const existing = await db.appInstall.findFirst({ where: { tenantId, appId: app.id, status: 'active' } });
    if (existing) continue;

    const declaredPerms = JSON.parse(app.permissions) as AppPermission[];
    const install = await db.appInstall.create({
      data: {
        tenantId, appId: app.id, version: app.version, status: 'active', scope: 'tenant',
        config: '{}', grantedPermissions: JSON.stringify(declaredPerms),
        sandboxEnabled: true, memoryLimitMb: 256, cpuLimitPct: 25, storageQuotaMb: 512,
        apiQuotaPerMin: 100, networkRestricted: true, autoUpdate: true,
        installedAt: new Date(Date.now() - Math.random() * 30 * 86400000),
      },
    });

    // Track install event
    await db.appAnalyticsEvent.create({
      data: {
        tenantId, appId: app.id, installId: install.id,
        eventType: 'install', metric: 1,
        metadata: JSON.stringify({ version: app.version, scope: 'tenant' }),
      },
    });

    // Seed some API calls + revenue events for variety
    const eventCount = Math.floor(Math.random() * 20) + 5;
    for (let i = 0; i < eventCount; i++) {
      const types = ['api_call', 'ai_usage', 'automation_usage', 'revenue'];
      const type = types[Math.floor(Math.random() * types.length)];
      await db.appAnalyticsEvent.create({
        data: {
          tenantId, appId: app.id, installId: install.id,
          eventType: type,
          metric: type === 'revenue' ? app.priceAmount : Math.floor(Math.random() * 100) + 1,
          severity: 'info',
          metadata: '{}',
          createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        },
      });
    }
    installsSeeded++;
  }

  // 4. Seed 15 reviews
  let reviewsSeeded = 0;
  const reviewApps = await db.app.findMany({ take: 10, orderBy: { rating: 'desc' } });
  const reviewTexts = [
    { rating: 5, title: 'Game changer!', comment: 'This app transformed our workflow. Highly recommended.' },
    { rating: 5, title: 'Excellent', comment: 'Saves us hours every week. The AI features are incredible.' },
    { rating: 4, title: 'Very useful', comment: 'Great app, would love a few more features.' },
    { rating: 5, title: 'Must have', comment: 'Cannot imagine running our business without it now.' },
    { rating: 4, title: 'Solid product', comment: 'Does what it promises. Support is responsive.' },
    { rating: 3, title: 'Good but pricey', comment: 'Works well but the subscription is steep for small businesses.' },
    { rating: 5, title: 'Fantastic', comment: 'Best in its category. Integration was seamless.' },
    { rating: 4, title: 'Recommend', comment: 'Good value for money. Regular updates.' },
  ];
  for (let i = 0; i < 15; i++) {
    const app = reviewApps[i % reviewApps.length];
    const review = reviewTexts[i % reviewTexts.length];
    const existing = await db.appReview.findFirst({
      where: { appId: app.id, reviewerName: `Verified User ${i + 1}` },
    });
    if (existing) continue;
    await db.appReview.create({
      data: {
        appId: app.id, reviewerName: `Verified User ${i + 1}`,
        reviewerTenantId: tenantId, rating: review.rating, title: review.title,
        comment: review.comment, verifiedPurchase: true, status: 'published',
        createdAt: new Date(Date.now() - Math.random() * 60 * 86400000),
      },
    });
    reviewsSeeded++;
  }

  // 5. Seed 6 plugins
  let pluginsSeeded = 0;
  const pluginDefs = [
    { pluginKey: 'custom-nav-finance', name: 'Finance Nav Extension', extensionPoints: ['navigation', 'dashboard'] as ExtensionPoint[] },
    { pluginKey: 'sales-widget-pack', name: 'Sales Widget Pack', extensionPoints: ['widget', 'dashboard'] as ExtensionPoint[] },
    { pluginKey: 'crm-report-templates', name: 'CRM Report Templates', extensionPoints: ['report'] as ExtensionPoint[] },
    { pluginKey: 'ai-sales-agent', name: 'AI Sales Agent', extensionPoints: ['ai_agent', 'command'] as ExtensionPoint[] },
    { pluginKey: 'automation-triggers', name: 'Automation Triggers Pro', extensionPoints: ['automation', 'notification'] as ExtensionPoint[] },
    { pluginKey: 'global-search-pro', name: 'Global Search Pro', extensionPoints: ['search', 'command'] as ExtensionPoint[] },
  ];
  for (const def of pluginDefs) {
    const existing = await db.appPlugin.findFirst({ where: { tenantId, pluginKey: def.pluginKey } });
    if (existing) continue;
    await db.appPlugin.create({
      data: {
        tenantId, pluginKey: def.pluginKey, name: def.name,
        extensionPoints: JSON.stringify(def.extensionPoints),
        config: '{}', status: 'active', enabled: true,
      },
    });
    pluginsSeeded++;
  }

  // 6. Seed 10 webhooks
  let webhooksSeeded = 0;
  const webhookDefs = [
    { name: 'CRM Lead Sync', events: ['lead.created', 'customer.created'], url: 'https://hooks.example.com/crm-sync' },
    { name: 'Invoice Webhook', events: ['invoice.paid', 'invoice.created'], url: 'https://hooks.example.com/invoices' },
    { name: 'GST Filing Webhook', events: ['gst.filed'], url: 'https://hooks.example.com/gst' },
    { name: 'Task Assignment Webhook', events: ['task.assigned'], url: 'https://hooks.example.com/tasks' },
    { name: 'Workflow Webhook', events: ['workflow.completed', 'automation.executed'], url: 'https://hooks.example.com/workflows' },
    { name: 'AI Decision Webhook', events: ['ai.decision'], url: 'https://hooks.example.com/ai' },
    { name: 'Approval Webhook', events: ['approval.granted'], url: 'https://hooks.example.com/approvals' },
    { name: 'Organization Webhook', events: ['organization.created', 'employee.added'], url: 'https://hooks.example.com/org' },
    { name: 'Payment Webhook', events: ['payment.received'], url: 'https://hooks.example.com/payments' },
    { name: 'App Lifecycle Webhook', events: ['app.installed', 'app.uninstalled'], url: 'https://hooks.example.com/apps' },
  ];
  for (const def of webhookDefs) {
    const existing = await db.appWebhook.findFirst({ where: { tenantId, name: def.name } });
    if (existing) continue;
    await db.appWebhook.create({
      data: {
        tenantId, name: def.name, targetUrl: def.url,
        eventTypes: JSON.stringify(def.events),
        secret: 'whsec_' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        status: 'active',
        deliveryCount: Math.floor(Math.random() * 500) + 50,
        successCount: Math.floor(Math.random() * 450) + 40,
        failureCount: Math.floor(Math.random() * 30),
        lastDeliveryAt: new Date(Date.now() - Math.random() * 86400000),
        lastResponseCode: 200,
      },
    });
    webhooksSeeded++;
  }

  // 7. Seed payouts (2 developers, current period)
  let payoutsSeeded = 0;
  const period = new Date().toISOString().slice(0, 7);
  const devIds = [developerMap['gstpilot-labs'], developerMap['tally-solutions']].filter(Boolean);
  for (const devId of devIds) {
    const existing = await db.appPayout.findFirst({ where: { developerId: devId, period } });
    if (existing) continue;
    const gross = Math.floor(Math.random() * 200000) + 50000;
    const platformFee = Math.round(gross * 0.3);
    await db.appPayout.create({
      data: {
        developerId: devId, period, grossRevenue: gross, platformFee,
        netPayout: gross - platformFee, transactionCount: Math.floor(Math.random() * 100) + 20,
        status: Math.random() > 0.5 ? 'paid' : 'pending',
        paidAt: Math.random() > 0.5 ? new Date() : null,
      },
    });
    payoutsSeeded++;
  }

  // Count total analytics events
  const analyticsCount = await db.appAnalyticsEvent.count();

  return {
    developers: Object.keys(developerMap).length,
    apps: appsSeeded,
    aiEmployees: aiEmployeesSeeded,
    installs: installsSeeded,
    reviews: reviewsSeeded,
    plugins: pluginsSeeded,
    webhooks: webhooksSeeded,
    analytics: analyticsCount,
    payouts: payoutsSeeded,
  };
}
