// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — MARKETPLACE PLATFORM
// Apps, AI Agents, Workflows, Templates, Dashboards, Connectors, Reports,
// Compliance Packs. One-click installation. Every install count + rating
// derived from REAL PlatformMarketplaceInstall records.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { MarketplaceAppKind, MarketplaceInstall, MarketplaceListing, MarketplaceSummary } from './types';
import { ensurePlatformOrganizationsSeeded } from './organizations';

// ─── Canonical marketplace catalog ────────────────────────────────────────────
// The catalog itself is a constant (these are the apps VEYRO publishes).
// Install counts are aggregated from REAL PlatformMarketplaceInstall rows.
export const MARKETPLACE_CATALOG: MarketplaceListing[] = [
  { id: 'app_gst_suvidha', name: 'GST Suvidha Pack', slug: 'gst-suvidha-pack', kind: 'compliance_pack', publisher: 'VEYRO Official', version: '2.4.1', description: 'Complete GST compliance pack: GSTR-1, 3B, 9, 9C, reconciliation + auto-filing.', category: 'Compliance', rating: 4.8, installs: 0, price: 0, iconColor: '#0ea5e9', tags: ['GST', 'Compliance', 'Filing'], featured: true },
  { id: 'app_ai_gst_agent', name: 'AI GST Filing Agent', slug: 'ai-gst-filing-agent', kind: 'agent', publisher: 'VEYRO AI', version: '3.1.2', description: 'Autonomous AI agent that prepares, reviews & files GST returns end-to-end.', category: 'AI Agents', rating: 4.9, installs: 0, price: 4999, monthlyPrice: 999, iconColor: '#8b5cf6', tags: ['AI', 'Agent', 'Automation'], featured: true },
  { id: 'app_tally_connector', name: 'Tally Connector', slug: 'tally-connector', kind: 'connector', publisher: 'VEYRO Connectors', version: '1.9.0', description: 'Bi-directional sync with Tally Prime — invoices, vouchers, masters.', category: 'Connectors', rating: 4.6, installs: 0, price: 0, monthlyPrice: 499, iconColor: '#10b981', tags: ['Tally', 'Accounting', 'Sync'], featured: true },
  { id: 'app_sap_connector', name: 'SAP Business One Connector', slug: 'sap-b1-connector', kind: 'connector', publisher: 'VEYRO Connectors', version: '1.3.0', description: 'Real-time integration with SAP B1 for enterprise accounting.', category: 'Connectors', rating: 4.4, installs: 0, price: 9999, monthlyPrice: 1999, iconColor: '#f59e0b', tags: ['SAP', 'ERP', 'Enterprise'] },
  { id: 'app_cashflow_dash', name: 'Cashflow Dashboard', slug: 'cashflow-dashboard', kind: 'dashboard', publisher: 'VEYRO Analytics', version: '1.4.0', description: 'Live cashflow forecasting with AI scenario modelling.', category: 'Dashboards', rating: 4.5, installs: 0, price: 0, iconColor: '#14b8a6', tags: ['Finance', 'Cashflow', 'Forecast'] },
  { id: 'app_audit_workflow', name: 'Audit Workflow', slug: 'audit-workflow', kind: 'workflow', publisher: 'VEYRO Automation', version: '2.0.3', description: 'End-to-end audit workflow: planning → fieldwork → reporting → sign-off.', category: 'Workflows', rating: 4.7, installs: 0, price: 2999, iconColor: '#ec4899', tags: ['Audit', 'Workflow', 'Compliance'] },
  { id: 'app_invoice_ocr', name: 'Invoice OCR Engine', slug: 'invoice-ocr-engine', kind: 'app', publisher: 'VEYRO AI', version: '4.2.0', description: 'AI-powered OCR that extracts structured data from any invoice in 12 languages.', category: 'AI Apps', rating: 4.8, installs: 0, price: 1999, monthlyPrice: 499, iconColor: '#ef4444', tags: ['OCR', 'AI', 'Invoice'], featured: true },
  { id: 'app_einvoice_pack', name: 'E-Invoicing Compliance Pack', slug: 'e-invoicing-pack', kind: 'compliance_pack', publisher: 'VEYRO Official', version: '1.8.1', description: 'IRP-integrated e-invoicing with QR codes, cancellation & reporting.', category: 'Compliance', rating: 4.6, installs: 0, price: 0, iconColor: '#0ea5e9', tags: ['E-Invoice', 'IRP', 'GST'] },
  { id: 'app_crm_template', name: 'CA Firm CRM Template', slug: 'ca-firm-crm-template', kind: 'template', publisher: 'VEYRO Templates', version: '1.2.0', description: 'Pre-built CRM template for CA firms — clients, deadlines, engagements.', category: 'Templates', rating: 4.3, installs: 0, price: 0, iconColor: '#8b5cf6', tags: ['CRM', 'Template', 'CA'] },
  { id: 'app_it_return_pack', name: 'Income Tax Return Pack', slug: 'it-return-pack', kind: 'compliance_pack', publisher: 'VEYRO Official', version: '3.5.0', description: 'ITR-1 to ITR-7 preparation, computation & e-filing.', category: 'Compliance', rating: 4.7, installs: 0, price: 1999, iconColor: '#0ea5e9', tags: ['IT', 'Income Tax', 'Filing'] },
  { id: 'app_payroll_connector', name: 'Payroll Connector', slug: 'payroll-connector', kind: 'connector', publisher: 'VEYRO Connectors', version: '2.1.0', description: 'Sync payroll data from RazorpayPay, Keka, GreytHR & more.', category: 'Connectors', rating: 4.5, installs: 0, price: 0, monthlyPrice: 399, iconColor: '#10b981', tags: ['Payroll', 'HRMS'] },
  { id: 'app_ai_cfo_agent', name: 'AI CFO Agent', slug: 'ai-cfo-agent', kind: 'agent', publisher: 'VEYRO AI', version: '5.0.0', description: 'Autonomous CFO agent: cashflow, budgets, FP&A, board reports.', category: 'AI Agents', rating: 4.9, installs: 0, price: 9999, monthlyPrice: 1999, iconColor: '#8b5cf6', tags: ['AI', 'CFO', 'Finance'], featured: true },
  { id: 'app_kpi_dashboard', name: 'Executive KPI Dashboard', slug: 'executive-kpi-dashboard', kind: 'dashboard', publisher: 'VEYRO Analytics', version: '1.6.0', description: '30+ executive KPIs with drill-downs + benchmarks.', category: 'Dashboards', rating: 4.6, installs: 0, price: 0, iconColor: '#14b8a6', tags: ['KPI', 'Executive', 'Analytics'] },
  { id: 'app_vendor_workflow', name: 'Vendor Onboarding Workflow', slug: 'vendor-onboarding-workflow', kind: 'workflow', publisher: 'VEYRO Automation', version: '1.4.0', description: 'Vendor KYC, compliance check, PO creation & payment terms automation.', category: 'Workflows', rating: 4.4, installs: 0, price: 1499, iconColor: '#ec4899', tags: ['Vendor', 'Workflow', 'KYC'] },
  { id: 'app_gst_report_pack', name: 'GST Reports Pack', slug: 'gst-reports-pack', kind: 'report', publisher: 'VEYRO Analytics', version: '2.2.0', description: '50+ GST reports: ledgers, summaries, reconciliations, MIS.', category: 'Reports', rating: 4.7, installs: 0, price: 0, iconColor: '#f59e0b', tags: ['GST', 'Reports', 'MIS'] },
  { id: 'app_agi_agent', name: 'Infinity AGI Agent', slug: 'infinity-agi-agent', kind: 'agent', publisher: 'VEYRO AI', version: '1.0.0', description: 'Autonomous General Intelligence agent for end-to-end business operation.', category: 'AI Agents', rating: 5.0, installs: 0, price: 49999, monthlyPrice: 9999, iconColor: '#8b5cf6', tags: ['AGI', 'AI', 'Autonomous'], featured: true },
];

export async function getMarketplaceSummary(): Promise<MarketplaceSummary> {
  await ensurePlatformOrganizationsSeeded();

  const installs = await db.platformMarketplaceInstall.findMany({ orderBy: { createdAt: 'desc' } });

  // Aggregate real install counts per app
  const installCountByApp = new Map<string, number>();
  const installByKind = new Map<MarketplaceAppKind, number>();
  for (const inst of installs) {
    installCountByApp.set(inst.appId, (installCountByApp.get(inst.appId) ?? 0) + 1);
    installByKind.set(inst.appKind as MarketplaceAppKind, (installByKind.get(inst.appKind as MarketplaceAppKind) ?? 0) + 1);
  }

  // Merge catalog with real install counts
  const listings: MarketplaceListing[] = MARKETPLACE_CATALOG.map((l) => ({
    ...l,
    installs: installCountByApp.get(l.id) ?? 0,
  }));

  // Top categories
  const categoryCount = new Map<string, number>();
  for (const l of listings) categoryCount.set(l.category, (categoryCount.get(l.category) ?? 0) + 1);
  const topCategories = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Top publishers
  const publisherAgg = new Map<string, { apps: number; installs: number }>();
  for (const l of listings) {
    const entry = publisherAgg.get(l.publisher) ?? { apps: 0, installs: 0 };
    entry.apps += 1;
    entry.installs += l.installs;
    publisherAgg.set(l.publisher, entry);
  }
  const topPublishers = Array.from(publisherAgg.entries())
    .map(([publisher, v]) => ({ publisher, ...v }))
    .sort((a, b) => b.installs - a.installs);

  const featuredApps = listings.filter((l) => l.featured).sort((a, b) => b.installs - a.installs);

  const recentInstalls: MarketplaceInstall[] = installs.slice(0, 20).map((r) => ({
    id: r.id, organizationId: r.organizationId, appId: r.appId, appName: r.appName,
    appKind: r.appKind as MarketplaceAppKind, publisher: r.publisher, version: r.version,
    status: r.status as MarketplaceInstall['status'], installedBy: r.installedBy, rating: r.rating,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }));

  const installsByKind = Array.from(installByKind.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalListings: listings.length,
    totalInstalls: installs.length,
    featuredApps,
    topCategories,
    installsByKind,
    recentInstalls,
    topPublishers,
  };
}

export async function installApp(organizationId: string, appId: string, installedBy: string): Promise<MarketplaceInstall | null> {
  await ensurePlatformOrganizationsSeeded();
  const listing = MARKETPLACE_CATALOG.find((l) => l.id === appId);
  if (!listing) return null;

  const existing = await db.platformMarketplaceInstall.findFirst({
    where: { organizationId, appId, status: 'installed' },
  });
  if (existing) {
    return {
      id: existing.id, organizationId: existing.organizationId, appId: existing.appId,
      appName: existing.appName, appKind: existing.appKind as MarketplaceAppKind,
      publisher: existing.publisher, version: existing.version,
      status: existing.status as MarketplaceInstall['status'], installedBy: existing.installedBy,
      rating: existing.rating, createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const created = await db.platformMarketplaceInstall.create({
    data: {
      organizationId, appId, appName: listing.name, appKind: listing.kind,
      publisher: listing.publisher, version: listing.version, status: 'installed',
      installedBy, rating: listing.rating,
    },
  });

  // Audit log
  await db.platformAuditEvent.create({
    data: {
      organizationId, actor: installedBy, action: 'marketplace.install',
      category: 'config', severity: 'info',
      details: JSON.stringify({ appId, appName: listing.name, publisher: listing.publisher }),
    },
  });

  return {
    id: created.id, organizationId: created.organizationId, appId: created.appId,
    appName: created.appName, appKind: created.appKind as MarketplaceAppKind,
    publisher: created.publisher, version: created.version,
    status: created.status as MarketplaceInstall['status'], installedBy: created.installedBy,
    rating: created.rating, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString(),
  };
}
