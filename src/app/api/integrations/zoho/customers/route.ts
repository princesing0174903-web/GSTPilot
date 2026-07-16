// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/customers
// POST /api/integrations/zoho/customers
//
// GET — List customers that have been synced from Zoho Books into our DB.
//       Supports `?search=`, `?status=active|inactive|all`, `?limit=`, `?offset=`.
//
// POST — Create a customer inside GSTPilot:
//          1. POST /books/v3/contacts to Zoho Books (real API call).
//          2. Save the returned contact_id + fields into ZohoCustomer.
//        If the customer already exists in Zoho (matched by contact_name or
//        gstin), Zoho will return an error — we surface it to the caller so
//        they can use PUT /customers/{id} to update instead.
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required) — JSON: { uid, email, name, role }
//   - Zoho Books must be connected (for POST).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
} from '@/lib/integrations/zoho-books';
import {
  listLocalCustomers,
  createZohoCustomer,
  type ZohoCustomerInput,
} from '@/lib/integrations/zoho-books/customers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── GET — list synced customers from DB ──────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // We need zohoOrgId to scope the query. Load from the token row.
    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? null;
    if (!zohoOrgId) {
      return NextResponse.json({
        ok: true,
        customers: [],
        total: 0,
        zohoOrgId: null,
        message: 'Zoho Books organization is not mapped. Reconnect to resolve.',
      });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') ?? null;
    const statusParam = url.searchParams.get('status');
    const status: 'active' | 'inactive' | 'all' =
      statusParam === 'inactive' ? 'inactive' : statusParam === 'all' ? 'all' : 'active';
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const { rows, total } = await listLocalCustomers({
      organizationId: orgId,
      zohoOrgId,
      search,
      status,
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    return NextResponse.json({ ok: true, customers: rows, total, zohoOrgId });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers GET] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to list customers.' },
      { status: 500 },
    );
  }
}

// ─── POST — create a customer (POST /contacts to Zoho) ────────────────────────

export async function POST(req: Request) {
  try {
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

    // Parse the customer input.
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

    // POST to Zoho Books + persist locally.
    const result = await createZohoCustomer({
      organizationId: orgId,
      userId,
      zohoOrgId,
      accessToken,
      input,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : result.httpStatus === 0 ? 502 : 200 });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers POST] error:', err);
    return NextResponse.json(
      {
        ok: false,
        httpStatus: 0,
        customer: null,
        error: err instanceof Error ? err.message : 'Failed to create customer.',
        zohoCode: null,
        zohoMessage: null,
      },
      { status: 500 },
    );
  }
}
