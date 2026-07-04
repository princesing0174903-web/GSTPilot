// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global AI App Marketplace™ — Monetization™
// Free Apps · Paid Apps · Subscriptions · Usage Billing · Revenue Sharing
// Coupons · Trials · Enterprise Licensing · Invoices · Tax Calculation · Payouts
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { PLATFORM_REVENUE_SHARE_PCT, type AppPayoutDTO, type MonetizationSummary, type PayoutStatus } from './types';

/** Map a Prisma AppPayout row to a DTO. */
export function mapPayoutToDTO(payout: {
  id: string; developerId: string; period: string; grossRevenue: number;
  platformFee: number; netPayout: number; currency: string; transactionCount: number;
  status: string; paidAt: Date | null; invoiceUrl: string | null; createdAt: Date;
  developer?: { displayName: string };
}): AppPayoutDTO {
  return {
    id: payout.id, developerId: payout.developerId,
    developerName: payout.developer?.displayName ?? 'Unknown',
    period: payout.period, grossRevenue: payout.grossRevenue, platformFee: payout.platformFee,
    netPayout: payout.netPayout, currency: payout.currency, transactionCount: payout.transactionCount,
    status: payout.status as PayoutStatus, paidAt: payout.paidAt?.toISOString() ?? null,
    invoiceUrl: payout.invoiceUrl, createdAt: payout.createdAt.toISOString(),
  };
}

/** Calculate the pricing breakdown for an app purchase/subscription. */
export function calculatePricing(opts: {
  priceAmount: number; pricingModel: string; billingInterval?: string;
  quantity?: number; couponPct?: number; taxPct?: number;
}): {
  subtotal: number; discount: number; taxableAmount: number; tax: number; total: number;
  developerShare: number; platformFee: number;
} {
  const quantity = opts.quantity ?? 1;
  const subtotal = opts.priceAmount * quantity;
  const discount = opts.couponPct ? Math.round((subtotal * opts.couponPct) / 100) : 0;
  const taxableAmount = subtotal - discount;
  const tax = opts.taxPct ? Math.round((taxableAmount * opts.taxPct) / 100) : 0;
  const total = taxableAmount + tax;
  const platformFee = Math.round((total * PLATFORM_REVENUE_SHARE_PCT) / 100);
  const developerShare = total - platformFee;
  return { subtotal, discount, taxableAmount, tax, total, developerShare, platformFee };
}

/** Get the platform monetization summary. */
export async function getMonetizationSummary(): Promise<MonetizationSummary> {
  const [apps, payouts, events, installs] = await Promise.all([
    db.app.findMany({ where: { status: 'published' } }),
    db.appPayout.findMany({ include: { developer: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.appAnalyticsEvent.findMany({ where: { eventType: 'revenue' } }),
    db.appInstall.findMany({ where: { status: 'active' } }),
  ]);

  const grossRevenue = events.reduce((s, e) => s + e.metric, 0);
  const platformFee = Math.round((grossRevenue * PLATFORM_REVENUE_SHARE_PCT) / 100);
  const developerPayouts = grossRevenue - platformFee;
  const pendingPayouts = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.netPayout, 0);
  const totalTransactions = events.length;
  const activeSubscriptions = installs.filter((i) => i.status === 'active').length;

  const freeApps = apps.filter((a) => a.pricingModel === 'free').length;
  const paidApps = apps.filter((a) => a.pricingModel === 'paid').length;
  const subscriptionApps = apps.filter((a) => a.pricingModel === 'subscription').length;
  const enterpriseApps = apps.filter((a) => a.pricingModel === 'enterprise').length;
  const avgRevenuePerApp = apps.length > 0 ? Math.round(grossRevenue / apps.length) : 0;

  // Top earners (developers)
  const devRevenue: Record<string, { name: string; revenue: number; apps: number }> = {};
  for (const app of apps) {
    const devId = app.developerId;
    const devRevenueForApp = events.filter((e) => e.appId === app.id).reduce((s, e) => s + e.metric, 0);
    if (!devRevenue[devId]) {
      const dev = payouts.find((p) => p.developerId === devId)?.developer;
      devRevenue[devId] = { name: dev?.displayName ?? 'Unknown', revenue: 0, apps: 0 };
    }
    devRevenue[devId].revenue += devRevenueForApp;
    devRevenue[devId].apps += 1;
  }
  const topEarners = Object.entries(devRevenue)
    .map(([developerId, data]) => ({ developerId, name: data.name, revenue: data.revenue, apps: data.apps }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    grossRevenue, platformFee, developerPayouts, pendingPayouts,
    totalTransactions, activeSubscriptions, freeApps, paidApps, subscriptionApps,
    enterpriseApps, avgRevenuePerApp, topEarners,
    recentPayouts: payouts.map(mapPayoutToDTO),
  };
}

/** Create a developer payout for a period. */
export async function createPayout(opts: {
  developerId: string; period: string; grossRevenue: number; transactionCount: number;
}): Promise<AppPayoutDTO> {
  const platformFee = Math.round((opts.grossRevenue * PLATFORM_REVENUE_SHARE_PCT) / 100);
  const netPayout = opts.grossRevenue - platformFee;
  const payout = await db.appPayout.create({
    data: {
      developerId: opts.developerId, period: opts.period,
      grossRevenue: opts.grossRevenue, platformFee, netPayout,
      transactionCount: opts.transactionCount, status: 'pending',
    },
    include: { developer: true },
  });
  // Update developer's total revenue
  await db.appDeveloper.update({
    where: { id: opts.developerId },
    data: { totalRevenue: { increment: netPayout } },
  });
  return mapPayoutToDTO(payout);
}

/** Mark a payout as paid. */
export async function markPayoutPaid(payoutId: string): Promise<AppPayoutDTO> {
  const payout = await db.appPayout.update({
    where: { id: payoutId },
    data: { status: 'paid', paidAt: new Date() },
    include: { developer: true },
  });
  return mapPayoutToDTO(payout);
}

/** List payouts for a developer. */
export async function listDeveloperPayouts(developerId: string): Promise<AppPayoutDTO[]> {
  const payouts = await db.appPayout.findMany({
    where: { developerId }, include: { developer: true },
    orderBy: { createdAt: 'desc' },
  });
  return payouts.map(mapPayoutToDTO);
}
