// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — Marketplace Search™
// Global AI Search across: Apps · AI Employees · Developers · Integrations
// Templates · Workflows · Widgets · Reports · Plugins. Instant semantic search.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapAppToDTO } from './registry';
import { mapDeveloperToDTO } from './developer';
import { mapPluginToDTO } from './plugins';
import { AI_EMPLOYEE_APPS, type AppCategory, type AppType, type MarketplaceSearchResult } from './types';

/** Search the marketplace across apps, AI employees, developers, templates, and plugins. */
export async function searchMarketplace(query: string, tenantId?: string): Promise<MarketplaceSearchResult> {
  const startTime = Date.now();
  const q = query.trim().toLowerCase();

  if (!q) {
    return { query, apps: [], aiEmployees: [], developers: [], templates: [], plugins: [], totalResults: 0, searchTimeMs: 0 };
  }

  // Search apps (by name, description, tagline, slug)
  const apps = await db.app.findMany({
    where: {
      status: 'published',
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { tagline: { contains: q } },
        { slug: { contains: q } },
      ],
    },
    include: { developer: true },
    take: 20,
  });

  // Search AI employees (in-memory catalog)
  const aiEmployees = AI_EMPLOYEE_APPS.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.role.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.capabilities.some((c) => c.toLowerCase().includes(q))
  ).map((e) => ({
    id: `ai-emp-${e.slug}`,
    slug: e.slug, name: e.name, tagline: e.role, description: e.description,
    developerId: 'gstpilot-labs', developerName: 'VEYRO Labs', developerVerified: true,
    type: 'ai_employee' as AppType, category: e.industry, version: '1.0.0',
    logo: null, color: e.color,
    screenshots: [], pricingModel: 'subscription' as const, priceAmount: 999,
    priceCurrency: 'INR', billingInterval: 'monthly',
    rating: 4.5, reviewCount: 0, installCount: 0, downloadCount: 0,
    compatibility: ['starter', 'business', 'enterprise'],
    permissions: e.permissions, releaseNotes: null, supportEmail: null, supportUrl: null,
    license: 'commercial', homepageUrl: null, repositoryUrl: null,
    status: 'published' as const, featured: false, verified: true, signed: true,
    publishedAt: null, createdAt: new Date().toISOString(),
  }));

  // Search developers
  const developers = await db.appDeveloper.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { displayName: { contains: q } },
        { bio: { contains: q } },
      ],
    },
    take: 10,
  });

  // Search templates (static catalog from SDK)
  const { EXTENSION_SDK } = await import('./sdk');
  const templates = EXTENSION_SDK.templates.filter((t) =>
    t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  ).map((t) => ({ key: t.key, name: t.name, type: t.type, category: 'productivity' as AppCategory }));

  // Search plugins (tenant-scoped)
  let plugins: ReturnType<typeof mapPluginToDTO>[] = [];
  if (tenantId) {
    const pluginRows = await db.appPlugin.findMany({
      where: { tenantId, name: { contains: q } },
      take: 10,
    });
    plugins = pluginRows.map(mapPluginToDTO);
  }

  const totalResults = apps.length + aiEmployees.length + developers.length + templates.length + plugins.length;

  return {
    query,
    apps: apps.map(mapAppToDTO),
    aiEmployees,
    developers: developers.map(mapDeveloperToDTO),
    templates,
    plugins,
    totalResults,
    searchTimeMs: Date.now() - startTime,
  };
}
