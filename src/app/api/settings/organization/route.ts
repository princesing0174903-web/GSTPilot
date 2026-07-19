// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/organization
//
// GET  — read the current organization's Firm row (name, gstin, pan, address,
//        state, contactEmail, contactPhone, website, logoUrl, subscriptionPlan)
// PUT  — upsert the Firm row with the provided fields. Works for BOTH real
//        Firestore orgs AND local- workspace orgs (Prisma is the source of
//        truth for the Firm table, so this route never touches Firestore).
//
// Tenant scoping: the org id comes from the `x-gstpilot-orgid` header or the
// `organizationId` query param. Every read/write is scoped to that org.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveOrg(request: Request): { orgId: string | null; userId: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  let userId: string | null = null;
  if (actorHeader) {
    try {
      userId = JSON.parse(actorHeader).uid ?? null;
    } catch { /* ignore */ }
  }
  const url = new URL(request.url);
  const headerOrg = request.headers.get('x-gstpilot-orgid');
  const queryOrg = url.searchParams.get('organizationId');
  const orgId = (headerOrg && headerOrg.trim()) || (queryOrg && queryOrg.trim()) || null;
  return { orgId, userId };
}

// GET /api/settings/organization
export async function GET(request: Request) {
  try {
    const { orgId } = resolveOrg(request);
    if (!orgId) {
      return NextResponse.json({ error: 'organizationId is required', organization: null }, { status: 400 });
    }

    const firm = await db.firm.findUnique({ where: { id: orgId } });
    if (!firm) {
      // Return an empty shell so the form can populate defaults — do NOT invent
      // a fake name or GSTIN. The user fills in real values.
      return NextResponse.json({
        organization: {
          id: orgId,
          name: '',
          gstin: '',
          pan: '',
          address: '',
          state: '',
          stateCode: '',
          contactEmail: '',
          contactPhone: '',
          website: '',
          logoUrl: null,
          subscriptionPlan: 'free',
        },
      });
    }

    return NextResponse.json({ organization: firm });
  } catch (error) {
    console.error('[/api/settings/organization] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load organization' },
      { status: 500 },
    );
  }
}

// PUT /api/settings/organization
// Body: { name?, gstin?, pan?, address?, state?, stateCode?, contactEmail?,
//         contactPhone?, website?, logoUrl? }
export async function PUT(request: Request) {
  try {
    const { orgId, userId } = resolveOrg(request);
    if (!orgId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const allowed: Record<string, unknown> = {};
    for (const k of ['name', 'gstin', 'pan', 'address', 'state', 'stateCode', 'contactEmail', 'contactPhone', 'website', 'logoUrl']) {
      if (body[k] !== undefined && body[k] !== null) {
        const v = String(body[k]).trim();
        allowed[k] = v;
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Upsert: create the Firm row if it doesn't exist (local- workspace orgs
    // may not have a Firm row yet).
    const firm = await db.firm.upsert({
      where: { id: orgId },
      create: {
        id: orgId,
        name: (allowed.name as string) || 'My Organization',
        ...allowed,
      },
      update: allowed,
    });

    try {
      await safeAudit({
        userId: userId ?? null,
        action: 'ORGANIZATION_UPDATED',
        entity: 'Firm',
        entityId: firm.id,
        newValue: JSON.stringify(allowed),
        details: `Organization settings updated — ${Object.keys(allowed).join(', ')}`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/organization] audit write failed:', auditErr);
    }

    return NextResponse.json({ organization: firm });
  } catch (error) {
    console.error('[/api/settings/organization] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update organization' },
      { status: 500 },
    );
  }
}
