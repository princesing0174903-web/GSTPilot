// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global AI App Marketplace™ — App Analytics™
// Tracks: Installs · Uninstalls · Revenue · Retention · Errors · Performance
// User Engagement · API Calls · AI Usage · Automation Usage · Crash Reports
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { APP_CATEGORY_META, type AppAnalyticsSummary, type AppCategory, type AppType } from './types';

/** Track an analytics event for an app. */
export async function trackEvent(opts: {
  tenantId: string; appId?: string; installId?: string;
  eventType: string; severity?: 'info' | 'warning' | 'critical';
  metric?: number; metadata?: Record<string, unknown>; userId?: string;
}): Promise<void> {
  await db.appAnalyticsEvent.create({
    data: {
      tenantId: opts.tenantId, appId: opts.appId ?? null, installId: opts.installId ?? null,
      eventType: opts.eventType, severity: opts.severity ?? 'info',
      metric: opts.metric ?? 1, metadata: JSON.stringify(opts.metadata ?? {}),
      userId: opts.userId ?? null,
    },
  });
}

/** Get the platform-wide analytics summary. */
export async function getPlatformAnalytics(): Promise<AppAnalyticsSummary> {
  const [apps, installs, events, reviews] = await Promise.all([
    db.app.findMany({ where: { status: 'published' }, include: { developer: true } }),
    db.appInstall.findMany(),
    db.appAnalyticsEvent.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }),
    db.appReview.findMany({ where: { status: 'published' } }),
  ]);

  const totalInstalls = events.filter((e) => e.eventType === 'install').length;
  const totalUninstalls = events.filter((e) => e.eventType === 'uninstall').length;
  const activeInstalls = installs.filter((i) => i.status === 'active').length;
  const totalRevenue = events.filter((e) => e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0);
  const totalApiCalls = events.filter((e) => e.eventType === 'api_call').reduce((s, e) => s + e.metric, 0);
  const totalErrors = events.filter((e) => e.eventType === 'error' || e.eventType === 'crash').length;
  const totalCrashes = events.filter((e) => e.eventType === 'crash').length;
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const aiUsageCalls = events.filter((e) => e.eventType === 'ai_usage').reduce((s, e) => s + e.metric, 0);
  const automationRuns = events.filter((e) => e.eventType === 'automation_usage').reduce((s, e) => s + e.metric, 0);
  const retentionRate = totalInstalls > 0 ? Math.round(((totalInstalls - totalUninstalls) / totalInstalls) * 100) : 100;

  // By category
  const categoryMap: Record<string, { installs: number; revenue: number; apps: number }> = {};
  for (const app of apps) {
    const cat = app.category as AppCategory;
    if (!categoryMap[cat]) categoryMap[cat] = { installs: 0, revenue: 0, apps: 0 };
    categoryMap[cat].apps += 1;
    categoryMap[cat].installs += app.installCount;
    categoryMap[cat].revenue += events.filter((e) => e.appId === app.id && e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0);
  }
  const byCategory = Object.entries(categoryMap).map(([category, data]) => ({
    category: category as AppCategory,
    label: APP_CATEGORY_META[category as AppCategory]?.label ?? category,
    installs: data.installs, revenue: data.revenue, apps: data.apps,
  })).sort((a, b) => b.installs - a.installs);

  // By type
  const typeMap: Record<string, number> = {};
  for (const app of apps) typeMap[app.type] = (typeMap[app.type] ?? 0) + 1;
  const byType = Object.entries(typeMap).map(([type, count]) => ({
    type: type as AppType, label: type.replace('_', ' '), count,
  })).sort((a, b) => b.count - a.count);

  // Timeseries (last 30 days)
  const timeseries: { date: string; installs: number; revenue: number; apiCalls: number; errors: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => e.createdAt.toISOString().slice(0, 10) === dateStr);
    timeseries.push({
      date: dateStr,
      installs: dayEvents.filter((e) => e.eventType === 'install').length,
      revenue: dayEvents.filter((e) => e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0),
      apiCalls: dayEvents.filter((e) => e.eventType === 'api_call').reduce((s, e) => s + e.metric, 0),
      errors: dayEvents.filter((e) => e.eventType === 'error' || e.eventType === 'crash').length,
    });
  }

  // Top apps
  const topApps = apps
    .map((a) => ({
      appId: a.id, name: a.name,
      installs: a.installCount,
      revenue: events.filter((e) => e.appId === a.id && e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0),
      rating: a.rating,
    }))
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 10);

  return {
    totalInstalls, totalUninstalls, activeInstalls, totalRevenue, totalApiCalls,
    totalErrors, totalCrashes, avgRating: Math.round(avgRating * 10) / 10,
    totalReviews: reviews.length, retentionRate, aiUsageCalls, automationRuns,
    byCategory, byType, timeseries, topApps,
  };
}

/** Get analytics for a single app. */
export async function getAppAnalytics(appId: string): Promise<{
  appId: string; installs: number; uninstalls: number; revenue: number;
  apiCalls: number; errors: number; crashes: number; avgRating: number;
  reviews: number; retentionRate: number; aiUsage: number; automationRuns: number;
  timeseries: { date: string; installs: number; revenue: number; apiCalls: number }[];
}> {
  const [app, events, reviews] = await Promise.all([
    db.app.findUnique({ where: { id: appId } }),
    db.appAnalyticsEvent.findMany({ where: { appId }, take: 2000, orderBy: { createdAt: 'desc' } }),
    db.appReview.findMany({ where: { appId, status: 'published' } }),
  ]);

  const installs = events.filter((e) => e.eventType === 'install').length;
  const uninstalls = events.filter((e) => e.eventType === 'uninstall').length;
  const revenue = events.filter((e) => e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0);
  const apiCalls = events.filter((e) => e.eventType === 'api_call').reduce((s, e) => s + e.metric, 0);
  const errors = events.filter((e) => e.eventType === 'error').length;
  const crashes = events.filter((e) => e.eventType === 'crash').length;
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : (app?.rating ?? 0);
  const aiUsage = events.filter((e) => e.eventType === 'ai_usage').reduce((s, e) => s + e.metric, 0);
  const automationRuns = events.filter((e) => e.eventType === 'automation_usage').reduce((s, e) => s + e.metric, 0);
  const retentionRate = installs > 0 ? Math.round(((installs - uninstalls) / installs) * 100) : 100;

  const timeseries: { date: string; installs: number; revenue: number; apiCalls: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => e.createdAt.toISOString().slice(0, 10) === dateStr);
    timeseries.push({
      date: dateStr,
      installs: dayEvents.filter((e) => e.eventType === 'install').length,
      revenue: dayEvents.filter((e) => e.eventType === 'revenue').reduce((s, e) => s + e.metric, 0),
      apiCalls: dayEvents.filter((e) => e.eventType === 'api_call').reduce((s, e) => s + e.metric, 0),
    });
  }

  return {
    appId, installs, uninstalls, revenue, apiCalls, errors, crashes,
    avgRating: Math.round(avgRating * 10) / 10, reviews: reviews.length,
    retentionRate, aiUsage, automationRuns, timeseries,
  };
}
