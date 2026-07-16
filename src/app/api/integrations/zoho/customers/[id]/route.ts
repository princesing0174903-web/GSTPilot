// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/integrations/zoho/customers/[id]
//
// Update a customer inside GSTPilot:
//   1. Look up the local ZohoCustomer row by [id] → get zohoContactId.
//   2. PUT /books/v3/contacts/{contact_id} to Zoho Books (real API call).
//   3. Update the local ZohoCustomer row with the returned fields.
//
// If the local row doesn't exist (404), return an actionable error telling
// the caller to sync first or create the customer via POST.
//
// If Zoho returns 404 (contact deleted), we surface that — the caller can
// then POST to recreate.
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required) — JSON: { uid, email, name, role }
//   - Zoho Books must be connected.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
} from '@/lib/integrations/zoho-books';
import {
  updateZohoCustomer,
  type ZohoCustomerInput,
} from '@/lib/integrations/zoho-books/customers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // Verify Zoho Books is connected.
    const status = await getConnectionStatus(orgId, userId);
    if (!status.connected || !status.zohoOrgId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Zoho Books is not connected. Connect your account first.',
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    // Resolve a valid (auto-refreshed) access token.
    const { accessToken, error: tokenErr } = await getValidAccessToken(orgId, userId);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: tokenErr ?? 'No access token.', needsReconnect: true },
        { status: 401 },
      );
    }

    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? status.zohoOrgId;

    // Look up the local ZohoCustomer row to get the zohoContactId.
    const local = await db.zohoCustomer.findFirst({
      where: { id, organizationId: orgId, zohoOrgId },
      select: { id: true, zohoContactId: true, contactName: true },
    });
    if (!local) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Customer not found locally. Run "Sync Customers" first, or create it via POST /api/integrations/zoho/customers.',
        },
        { status: 404 },
      );
    }

    // Parse the update input.
    let input: ZohoCustomerInput;
    try {
      const body = (await req.json()) as Partial<ZohoCustomerInput>;
      if (!body.contactName || typeof body.contactName !== 'string' || !body.contactName.trim()) {
        return NextResponse.json(
          { ok: false, error: 'contactName is required.' },
          { status: 400 },
        );
      }
      input = {
        contactName: body.contactName.trim(),
        companyName: body.companyName ?? null,
        gstNumber: body.gstNumber ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        currency: body.currency ?? null,
        paymentTerms: typeof body.paymentTerms === 'number' ? body.paymentTerms : null,
        billingAddress: body.billingAddress ?? null,
        shippingAddress: body.shippingAddress ?? null,
      };
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body. Expected a customer object.' },
        { status: 400 },
      );
    }

    // PUT to Zoho Books + update local row.
    const result = await updateZohoCustomer({
      organizationId: orgId,
      userId,
      zohoOrgId,
      accessToken,
      zohoContactId: local.zohoContactId,
      input,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : result.httpStatus === 0 ? 502 : 200 });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers/[id] PUT] error:', err);
    return NextResponse.json(
      {
        ok: false,
        httpStatus: 0,
        customer: null,
        error: err instanceof Error ? err.message : 'Failed to update customer.',
        zohoCode: null,
        zohoMessage: null,
      },
      { status: 500 },
    );
  }
}
