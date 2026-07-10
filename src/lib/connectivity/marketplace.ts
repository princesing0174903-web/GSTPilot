// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL CONNECTIVITY FABRIC™ — CONNECTOR MARKETPLACE
// Developers publish connectors. Organizations install them. Supports
// certification, reviews, versioning, revenue sharing, enterprise licensing.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { CONNECTOR_CATALOG } from './registry';
import type { ConnectorCategory, MarketplaceListing } from './types';
import { classifyCategory } from './engine';

// ─── Seed marketplace listings from catalog if empty ─────────────────────────────
export async function seedMarketplaceIfEmpty(): Promise<void> {
  const count = await db.marketplaceConnector.count();
  if (count > 0) return;

  // Convert catalog connectors into marketplace listings
  const listings = CONNECTOR_CATALOG.map((c, idx) => ({
    slug: c.key.replace(/\./g, '-'),
    name: c.name,
    tagline: c.description.slice(0, 80) + (c.description.length > 80 ? '…' : ''),
    description: c.description,
    developerName: c.certified ? 'GSTPilot Certified' : 'Community Developer',
    developerHandle: c.certified ? 'gstpilot' : `dev-${idx}`,
    category: c.category,
    provider: c.provider,
    version: '1.0.0',
    pricingModel: c.certified ? 'freemium' : 'free',
    priceUsd: 0,
    certification: c.certified ? 'certified' : 'community',
    capabilities: JSON.stringify(c.capabilities),
    authMethods: JSON.stringify(c.authMethods),
    regions: JSON.stringify(c.regions),
    rating: 4 + Math.min(1, c.popularity / 100), // 4.0..5.0
    reviewCount: Math.floor(c.popularity / 2),
    installCount: Math.floor(c.popularity * 7),
    activeInstalls: Math.floor(c.popularity * 5),
    revenueSharePct: 30,
    licenseType: c.certified ? 'standard' : 'standard',
  }));

  // SQLite doesn't support skipDuplicates on createMany — seed one-by-one instead
  for (const listing of listings) {
    try {
      await db.marketplaceConnector.create({ data: listing });
    } catch {
      // slug already exists — skip
    }
  }
}

// ─── Map Prisma row → MarketplaceListing ─────────────────────────────────────────
type Row = Awaited<ReturnType<typeof db.marketplaceConnector.findFirst>>;
function mapListing(row: NonNullable<Row>): MarketplaceListing {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    developerName: row.developerName,
    developerHandle: row.developerHandle,
    category: classifyCategory(row.category),
    provider: row.provider,
    version: row.version,
    pricingModel: row.pricingModel as MarketplaceListing['pricingModel'],
    priceUsd: row.priceUsd,
    certification: row.certification as MarketplaceListing['certification'],
    capabilities: safeParse<string[]>(row.capabilities, []),
    authMethods: safeParse<string[]>(row.authMethods, []) as MarketplaceListing['authMethods'],
    regions: safeParse<string[]>(row.regions, []),
    rating: row.rating,
    reviewCount: row.reviewCount,
    installCount: row.installCount,
    activeInstalls: row.activeInstalls,
    revenueSharePct: row.revenueSharePct,
    licenseType: row.licenseType as MarketplaceListing['licenseType'],
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── List marketplace (with optional category filter) ────────────────────────────
export async function listMarketplace(limit = 50, category?: ConnectorCategory): Promise<MarketplaceListing[]> {
  await seedMarketplaceIfEmpty();
  const where = category ? { category } : {};
  const rows = await db.marketplaceConnector.findMany({
    where,
    orderBy: [{ installCount: 'desc' }, { rating: 'desc' }],
    take: limit,
  });
  return rows.map(mapListing);
}

// ─── Top marketplace (highest installs / ratings) ────────────────────────────────
export async function topMarketplace(limit = 8): Promise<MarketplaceListing[]> {
  await seedMarketplaceIfEmpty();
  const rows = await db.marketplaceConnector.findMany({
    orderBy: [{ activeInstalls: 'desc' }, { rating: 'desc' }],
    take: limit,
  });
  return rows.map(mapListing);
}

// ─── Get a single listing ────────────────────────────────────────────────────────
export async function getListing(slug: string): Promise<MarketplaceListing | null> {
  await seedMarketplaceIfEmpty();
  const row = await db.marketplaceConnector.findUnique({ where: { slug } });
  return row ? mapListing(row) : null;
}

// ─── Publish a new connector (developer flow) ────────────────────────────────────
export async function publishMarketplaceConnector(params: {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  developerName: string;
  developerHandle?: string;
  category: ConnectorCategory;
  provider: string;
  capabilities: string[];
  authMethods: string[];
  regions: string[];
  pricingModel?: 'free' | 'freemium' | 'paid' | 'usage_based' | 'enterprise';
  priceUsd?: number;
  licenseType?: 'standard' | 'enterprise' | 'exclusive' | 'white_label';
  revenueSharePct?: number;
}): Promise<{ success: boolean; id?: string; slug?: string; message: string }> {
  try {
    const row = await db.marketplaceConnector.create({
      data: {
        slug: params.slug,
        name: params.name,
        tagline: params.tagline ?? null,
        description: params.description,
        developerName: params.developerName,
        developerHandle: params.developerHandle ?? null,
        category: params.category,
        provider: params.provider,
        version: '1.0.0',
        pricingModel: params.pricingModel ?? 'free',
        priceUsd: params.priceUsd ?? 0,
        certification: 'community',
        capabilities: JSON.stringify(params.capabilities),
        authMethods: JSON.stringify(params.authMethods),
        regions: JSON.stringify(params.regions),
        rating: 0,
        reviewCount: 0,
        installCount: 0,
        activeInstalls: 0,
        revenueSharePct: params.revenueSharePct ?? 30,
        licenseType: params.licenseType ?? 'standard',
      },
    });
    return { success: true, id: row.id, slug: row.slug, message: `Published ${row.name} v${row.version}` };
  } catch (err) {
    return { success: false, message: `Publish failed: ${(err as Error).message}` };
  }
}

// ─── Review a connector ──────────────────────────────────────────────────────────
export async function reviewConnector(params: {
  connectorSlug: string;
  reviewerName: string;
  reviewerHandle?: string;
  rating: number;  // 1..5
  title?: string;
  body?: string;
}): Promise<{ success: boolean; id?: string; message: string }> {
  if (params.rating < 1 || params.rating > 5) {
    return { success: false, message: 'Rating must be between 1 and 5' };
  }
  try {
    const review = await db.connectorReview.create({
      data: {
        connectorSlug: params.connectorSlug,
        reviewerName: params.reviewerName,
        reviewerHandle: params.reviewerHandle ?? null,
        rating: params.rating,
        title: params.title ?? null,
        body: params.body ?? null,
        verified: false,
      },
    });

    // Recompute rating + reviewCount on the listing
    const reviews = await db.connectorReview.findMany({ where: { connectorSlug: params.connectorSlug } });
    const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await db.marketplaceConnector.update({
      where: { slug: params.connectorSlug },
      data: { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
    });

    return { success: true, id: review.id, message: 'Review submitted' };
  } catch (err) {
    return { success: false, message: `Review failed: ${(err as Error).message}` };
  }
}

// ─── Marketplace stats ───────────────────────────────────────────────────────────
export async function getMarketplaceStats(): Promise<{
  totalListings: number;
  certified: number;
  totalInstalls: number;
  totalActiveInstalls: number;
  totalReviews: number;
  avgRating: number;
  byCategory: Record<string, number>;
  developers: number;
}> {
  await seedMarketplaceIfEmpty();
  const [listings, reviews] = await Promise.all([
    db.marketplaceConnector.findMany(),
    db.connectorReview.count(),
  ]);

  const byCategory: Record<string, number> = {};
  let totalInstalls = 0;
  let totalActiveInstalls = 0;
  let ratingSum = 0;
  let ratedCount = 0;
  let certified = 0;
  const developerSet = new Set<string>();

  for (const l of listings) {
    byCategory[l.category] = (byCategory[l.category] ?? 0) + 1;
    totalInstalls += l.installCount;
    totalActiveInstalls += l.activeInstalls;
    if (l.rating > 0) {
      ratingSum += l.rating;
      ratedCount++;
    }
    if (l.certification === 'certified') certified++;
    developerSet.add(l.developerName);
  }

  return {
    totalListings: listings.length,
    certified,
    totalInstalls,
    totalActiveInstalls,
    totalReviews: reviews,
    avgRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : 0,
    byCategory,
    developers: developerSet.size,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────────
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
