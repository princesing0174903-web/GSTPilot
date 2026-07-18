// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/billing
//
// GET — read the current organization's billing/plan info from the Firm row
//       (subscriptionPlan, maxClients) + real usage counts (clients, invoices,
//       Zoho-synced records). No mock plans, no fake usage numbers.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLAN_LIMITS: Record<string, { maxClients: number; label: string; price: number }> = {
  free: { maxClients: 50, label: 'Free', price: 0 },
  starter: { maxClients: 200, label: 'Starter', price: 999 },
  pro: { maxClients: 1000, label: 'Professional', price: 2999 },
  enterprise: { maxClients: 10000, label: 'Enterprise', price: 9999 },
};

function resolveOrg(request: Request): { orgId: string | null } {
  const url = new URL(request.url);
  const headerOrg = request.headers.get('x-gstpilot-orgid');
  const queryOrg = url.searchParams.get('organizationId');
  return { orgId: (headerOrg && headerOrg.trim()) || (queryOrg && queryOrg.trim()) || null };
}

export async function GET(request: Request) {
  try {
    const { orgId } = resolveOrg(request);
    if (!orgId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const firm = await db.firm.findUnique({ where: { id: orgId } });
    const plan = firm?.subscriptionPlan ?? 'free';
    const planInfo = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    // Real usage counts from Prisma (tenant-scoped).
    const [clientsCount, invoicesCount, zohoInvoicesCount, zohoCustomersCount] = await Promise.all([
      db.client.count({ where: { firmId: orgId } }).catch(() => 0),
      db.invoice.count({ where: { client: { firmId: orgId } } }).catch(() => 0),
      db.zohoInvoice.count({ where: { organizationId: orgId } }).catch(() => 0),
      db.zohoCustomer.count({ where: { organizationId: orgId } }).catch(() => 0),
    ]);

    return NextResponse.json({
      plan: {
        id: plan,
        label: planInfo.label,
        price: planInfo.price,
        maxClients: planInfo.maxClients,
      },
      usage: {
        clients: clientsCount,
        invoices: invoicesCount + zohoInvoicesCount,
        customers: zohoCustomersCount,
        maxClients: firm?.maxClients ?? planInfo.maxClients,
      },
      availablePlans: Object.entries(PLAN_LIMITS).map(([id, info]) => ({
        id,
        label: info.label,
        price: info.price,
        maxClients: info.maxClients,
        current: id === plan,
      })),
    });
  } catch (error) {
    console.error('[/api/settings/billing] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load billing info' },
      { status: 500 },
    );
  }
}
