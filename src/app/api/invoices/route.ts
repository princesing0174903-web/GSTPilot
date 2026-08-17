import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  calculateInvoiceTotals,
  derivePaymentStatus,
  generateInvoiceNumber,
  type InvoiceLineItem,
} from '@/lib/invoices/invoices';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';
import { emitInvoiceNode } from '@/lib/graph/auto-emit';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';
import { assertInvoiceTenantAccess } from './_helpers';

// ─── Multi-tenant scoping ───────────────────────────────────────────────────
// The Prisma `Invoice` model has NO `firmId` field — it reaches the tenant
// through `client.firmId`. The modern org model uses `organizationId`
// (Firestore). The orgId IS the firmId in this app's current state. When
// neither is provided on GET, we return an empty list instead of leaking ALL
// invoices platform-wide.

/**
 * Resolve the organizationId for a newly-created invoice. Checks (in order):
 *   1. The `x-gstpilot-orgid` request header (set by the dashboard shell)
 *   2. `organizationId` / `firmId` in the request body
 *   3. `Client.firmId` via a one-row Prisma lookup on `clientId`
 * Returns null if no org scope can be determined (the timeline emit is skipped
 * — the parent create still succeeds).
 */
async function resolveOrgForInvoice(
  req: Request,
  body: { organizationId?: string; firmId?: string; clientId?: string },
  clientId?: string,
): Promise<string | null> {
  const headerOrg = req.headers.get('x-gstpilot-orgid');
  if (headerOrg && headerOrg.trim()) return headerOrg.trim();
  const bodyOrg = body.organizationId || body.firmId;
  if (bodyOrg && typeof bodyOrg === 'string' && bodyOrg.trim()) return bodyOrg.trim();
  const cid = clientId ?? body.clientId;
  if (cid) {
    try {
      const client = await db.client.findUnique({
        where: { id: cid },
        select: { firmId: true },
      });
      if (client?.firmId) return client.firmId;
    } catch {
      /* ignore — best-effort */
    }
  }
  return null;
}

/** Parse the `x-gstpilot-actor` request header (JSON { uid, email }). */
function parseActorHeader(req: Request): { userId?: string; userName?: string } | undefined {
  const raw = req.headers.get('x-gstpilot-actor');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { uid?: string; email?: string; displayName?: string };
    if (!parsed.uid && !parsed.email) return undefined;
    return {
      userId: parsed.uid,
      userName: parsed.displayName ?? parsed.email,
    };
  } catch {
    return undefined;
  }
}

/** Maps an InvoiceType to its GSTR-1 section (b2b / b2cl / b2cs / exp / cdnr / nil). */
function invoiceTypeToSection(invoiceType: string | undefined | null): string {
  switch ((invoiceType ?? 'B2B').toUpperCase()) {
    case 'B2B': return 'b2b';
    case 'B2C LARGE': return 'b2cl';
    case 'B2C SMALL': return 'b2cs';
    case 'EXPORT': return 'exp';
    case 'CREDIT NOTE': return 'cdnr';
    case 'DEBIT NOTE': return 'cdnr';
    case 'NIL RATED': return 'nil';
    case 'EXEMPTED': return 'nil';
    default: return 'b2b';
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const period = searchParams.get('period');
    const cloud = searchParams.get('cloud') === 'true';
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId');

    // Defensive empty-state: no tenant scope → no data.
    if (!tenantId) {
      return NextResponse.json({ invoices: [] });
    }

    const memberResult = await requireOrgMembership(uid, tenantId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Build a where clause scoped by the tenant via the client relation.
    const where: Record<string, unknown> = { client: { firmId: tenantId } };
    if (clientId) where.clientId = clientId;
    if (period) where.period = period;

    // ── Invoice Cloud™ branch ────────────────────────────────────────────────
    // Returns invoices with the new financial fields. Includes line items +
    // client so the frontend can render a real Items tab + show client info
    // without an extra round-trip. Empty array when the DB is empty.
    if (cloud && !clientId && !period) {
      const invoices = await db.invoice.findMany({
        where,
        include: {
          client: true,
          items: { orderBy: { lineNumber: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ invoices: invoices ?? [] });
    }

    const invoices = await db.invoice.findMany({
      where,
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return friendlyApiError(error, 'We could not load your invoices right now. Please try again.');
  }
}

// POST /api/invoices — Create a new invoice
// Branches on `body.cloud === true` to invoke the Invoice Cloud™ creation
// flow. When `cloud` is not set, the original GST invoice flow runs unchanged.
//
// Cloud branch accepts:
//   { cloud:true, clientId?, customerName, buyerGstin?, sellerGstin?, date?,
//     dueDate?, items:[{ description?, hsnCode?, quantity, unitPrice, gstRate,
//     discount?, cessRate?, unit? }], invoiceType?, notes?, recurring?,
//     recurringCycle?, notesFinance?, isInterState?, organizationId? }
//
// Also supports `duplicateFrom: <id>` — clones an existing invoice's line
// items + client into a new draft with a fresh invoice number.
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await request.json();

    // ── Duplicate branch (clone an existing invoice) ──────────────────────
    if (body?.duplicateFrom && typeof body.duplicateFrom === 'string') {
      const source = await db.invoice.findUnique({
        where: { id: body.duplicateFrom },
        include: { items: true, client: true },
      });
      // FIX 10: orphan source invoices (null firmId) → 404 (not 403).
      const dupAccessErr = await assertInvoiceTenantAccess(uid, source);
      if (dupAccessErr) return dupAccessErr;

      const existing = await db.invoice.findMany({
        where: {
          invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` },
          client: { firmId: source.client?.firmId ?? '' },
        },
        select: { invoiceNumber: true },
      });
      const invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber));
      const today = new Date().toISOString().split('T')[0];

      const cloned = await db.invoice.create({
        data: {
          clientId: source.clientId,
          invoiceNumber,
          invoiceDate: today,
          sellerGstin: source.sellerGstin,
          buyerGstin: source.buyerGstin,
          buyerName: source.buyerName,
          invoiceType: source.invoiceType,
          gstr1Section: source.gstr1Section,
          taxableValue: source.taxableValue,
          cgst: source.cgst,
          sgst: source.sgst,
          igst: source.igst,
          cess: source.cess,
          totalAmount: source.totalAmount,
          hsnCode: source.hsnCode,
          reverseCharge: source.reverseCharge,
          status: 'draft',
          matchStatus: 'unmatched',
          riskLevel: 'low',
          riskScore: 0,
          period: today.slice(0, 7),
          notes: source.notes,
          dueDate: source.dueDate,
          gstAmount: source.gstAmount,
          paidAmount: 0,
          balanceAmount: source.totalAmount,
          paymentStatus: 'unpaid',
          recurring: false,
          recurringCycle: null,
          notesFinance: source.notesFinance,
          sentToCustomer: false,
          items: source.items.length > 0 ? {
            create: source.items.map((it, idx) => ({
              lineNumber: idx + 1,
              description: it.description,
              hsnCode: it.hsnCode,
              quantity: it.quantity,
              unit: it.unit,
              unitPrice: it.unitPrice,
              taxableValue: it.taxableValue,
              cgstRate: it.cgstRate,
              sgstRate: it.sgstRate,
              igstRate: it.igstRate,
              cessRate: it.cessRate,
              cgst: it.cgst,
              sgst: it.sgst,
              igst: it.igst,
              cess: it.cess,
              totalAmount: it.totalAmount,
            })),
          } : undefined,
        },
        include: { items: true, client: true },
      });

      await db.auditLog.create({
        data: {
          clientId: source.clientId,
          action: 'Invoice Duplicated',
          entity: 'invoice',
          entityId: cloned.id,
          details: `Invoice ${invoiceNumber} duplicated from ${source.invoiceNumber}`,
        },
      });

      graphEvents.invoiceCreated(cloned.id, cloned.invoiceNumber, cloned.totalAmount, cloned.buyerGstin ?? undefined);
      try { await emitInvoiceNode(cloned.id); } catch (e) { console.error('[graph] emitInvoiceNode failed', e); }

      const dupOrgId = await resolveOrgForInvoice(request, body, source.clientId);
      // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
      // so every dashboard / Oracle / AI CFO / report reflects the new invoice
      // immediately (no 30s TTL wait).
      if (dupOrgId) invalidateBusinessSnapshotCache(dupOrgId);
      if (dupOrgId) {
        const memberResult2 = await requireOrgMembership(uid, dupOrgId);
        if (memberResult2 instanceof NextResponse) return memberResult2;
        await emitTimelineEvent({
          organizationId: dupOrgId,
          type: 'invoice.created',
          title: `Invoice ${invoiceNumber} duplicated`,
          description: `Duplicated from ${source.invoiceNumber} — ₹${cloned.totalAmount.toLocaleString('en-IN')} draft.`,
          actor: parseActorHeader(request),
          metadata: { invoiceId: cloned.id, invoiceNumber, sourceInvoiceId: source.id, sourceInvoiceNumber: source.invoiceNumber, amount: cloned.totalAmount },
          severity: 'info',
        });
      }

      return NextResponse.json({ invoice: cloned }, { status: 201 });
    }

    // ── Invoice Cloud™ branch ──────────────────────────────────────────────
    if (body?.cloud === true) {
      const {
        clientId: cloudClientId,
        invoiceNumber: cloudInvoiceNumber,
        customerName,
        buyerGstin: cloudBuyerGstin,
        date,
        dueDate,
        items,
        sellerGstin: cloudSellerGstin,
        isInterState,
        notes: cloudNotes,
        recurring,
        recurringCycle,
        notesFinance,
        invoiceType: cloudInvoiceType,
        terms,
        bankDetails,
        placeOfSupply,
        reverseCharge,
      } = body ?? {}

      if (!customerName || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'customerName and at least one line item are required for Invoice Cloud creation' },
          { status: 400 }
        );
      }

      // ── Validate line items: reject malformed financial data ──
      const VALID_GST_RATES = [0, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const qty = Number(it?.quantity);
        const price = Number(it?.unitPrice);
        const rate = Number(it?.gstRate);
        if (!Number.isFinite(qty) || qty < 0) {
          return NextResponse.json(
            { error: `Line ${i + 1}: quantity must be a non-negative number.` },
            { status: 400 },
          );
        }
        if (!Number.isFinite(price) || price < 0) {
          return NextResponse.json(
            { error: `Line ${i + 1}: unit price must be a non-negative number.` },
            { status: 400 },
          );
        }
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
          return NextResponse.json(
            { error: `Line ${i + 1}: GST rate must be between 0 and 100.` },
            { status: 400 },
          );
        }
        if (!VALID_GST_RATES.includes(rate)) {
          return NextResponse.json(
            { error: `Line ${i + 1}: GST rate ${rate}% is not a valid Indian GST slab. Allowed: ${VALID_GST_RATES.join(', ')}%.` },
            { status: 400 },
          );
        }
      }

      // Determine inter-state vs intra-state from GSTIN state codes (first 2 digits)
      // unless explicitly provided via `isInterState`.
      const sellerState = cloudSellerGstin?.slice(0, 2) ?? '';
      const buyerState = cloudBuyerGstin?.slice(0, 2) ?? '';
      const interState =
        typeof isInterState === 'boolean'
          ? isInterState
          : Boolean(sellerState && buyerState && sellerState !== buyerState);

      // Convert the API's line-item shape ({ description, quantity, unitPrice,
      // gstRate, discount, cessRate }) to the engine's shape + compute per-line
      // totals. Discount is a percentage off the gross (qty*price). cessRate is
      // a percentage on the taxable value.
      const lineItems: InvoiceLineItem[] = items.map((it: {
        quantity?: number;
        unitPrice?: number;
        gstRate?: number;
        discount?: number;
        cessRate?: number;
      }) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unitPrice) || 0;
        const gross = qty * price;
        const disc = Math.min(Math.max(Number(it.discount) || 0, 0), 100);
        const taxable = Math.round((gross * (1 - disc / 100)) * 100) / 100;
        const rate = Number(it.gstRate) || 0;
        return {
          taxableValue: taxable,
          cgstRate: interState ? 0 : rate / 2,
          sgstRate: interState ? 0 : rate / 2,
          igstRate: interState ? rate : 0,
          cessRate: Number(it.cessRate) || 0,
        };
      });

      const totals = calculateInvoiceTotals(lineItems, items);

      // ── Resolve a clientId (required by the Invoice model). ──
      // CRITICAL: scope the lookup to the resolved org's firmId — never call
      // `db.client.findFirst({})` (which would adopt the FIRST client across
      // ALL tenants). When no org can be resolved we 400 — orphan invoices
      // are not allowed in the cloud branch.
      let cloudOrgId = await resolveOrgForInvoice(request, body, undefined);
      // If an explicit clientId was provided and no org was resolvable from
      // header/body, fall back to the client's firmId — then verify membership.
      if (!cloudOrgId && cloudClientId) {
        const explicitClient = await db.client.findUnique({
          where: { id: cloudClientId },
          select: { firmId: true },
        });
        if (explicitClient?.firmId) cloudOrgId = explicitClient.firmId;
      }
      if (!cloudOrgId) {
        return NextResponse.json(
          { error: 'A client or organization is required to create an invoice.' },
          { status: 400 },
        );
      }

      // Tenant scope check before create — verifies the caller is a member of
      // the resolved org. Done here so a 403 short-circuits before any write.
      {
        const memberResult = await requireOrgMembership(uid, cloudOrgId);
        if (memberResult instanceof NextResponse) return memberResult;
      }

      // Generate the next invoice number if not provided — ORG-SCOPED so two
      // tenants can both have INV-2025-001. Uses the resolved org's firmId.
      // (Moved AFTER org resolution so cloudOrgId is initialized.)
      let invoiceNumber = cloudInvoiceNumber
      if (!invoiceNumber) {
        const existing = await db.invoice.findMany({
          where: {
            invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` },
            client: { firmId: cloudOrgId },
          },
          select: { invoiceNumber: true },
        })
        invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber))
      }

      let resolvedClientId = cloudClientId as string | undefined
      if (!resolvedClientId) {
        const firstClient = await db.client.findFirst({
          where: { firmId: cloudOrgId },
          select: { id: true },
        })
        if (firstClient) {
          resolvedClientId = firstClient.id
        } else {
          // Auto-create an orphan client SCOPED to the resolved org — never null.
          const created = await db.client.create({
            data: {
              gstin: `29CLOUD${Date.now().toString().slice(-6)}Z1Z5`,
              tradeName: customerName || 'Invoice Cloud Customer',
              legalName: customerName || 'Invoice Cloud Customer',
              status: 'active',
              healthScore: 100,
              firmId: cloudOrgId,
            },
          })
          resolvedClientId = created.id
        }
      }

      const invType = (cloudInvoiceType ?? 'B2B').toString();
      const gstr1Section = invoiceTypeToSection(invType);

      // Build the InvoiceItem.create[] payload — persists real line items.
      const itemsCreate = items.map((it: {
        description?: string;
        hsnCode?: string;
        quantity?: number;
        unit?: string;
        unitPrice?: number;
        gstRate?: number;
        discount?: number;
        cessRate?: number;
      }, idx: number) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unitPrice) || 0;
        const gross = qty * price;
        const disc = Math.min(Math.max(Number(it.discount) || 0, 0), 100);
        const taxable = Math.round((gross * (1 - disc / 100)) * 100) / 100;
        const rate = Number(it.gstRate) || 0;
        const cessR = Number(it.cessRate) || 0;
        const cgstR = interState ? 0 : rate / 2;
        const sgstR = interState ? 0 : rate / 2;
        const igstR = interState ? rate : 0;
        return {
          lineNumber: idx + 1,
          description: it.description ?? null,
          hsnCode: it.hsnCode ?? null,
          quantity: qty,
          unit: it.unit ?? 'NOS',
          unitPrice: price,
          taxableValue: taxable,
          cgstRate: cgstR,
          sgstRate: sgstR,
          igstRate: igstR,
          cessRate: cessR,
          cgst: Math.round(taxable * cgstR) / 100,
          sgst: Math.round(taxable * sgstR) / 100,
          igst: Math.round(taxable * igstR) / 100,
          cess: Math.round(taxable * cessR) / 100,
          totalAmount: Math.round((taxable + (taxable * rate / 100) + (taxable * cessR / 100)) * 100) / 100,
        };
      });

      const invoice = await db.invoice.create({
        data: {
          clientId: resolvedClientId,
          invoiceNumber,
          invoiceDate: date ?? new Date().toISOString().split('T')[0],
          sellerGstin: cloudSellerGstin ?? '',
          buyerGstin: cloudBuyerGstin ?? null,
          buyerName: customerName,
          invoiceType: invType,
          gstr1Section,
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: totals.cess,
          totalAmount: totals.totalAmount,
          hsnCode: itemsCreate[0]?.hsnCode ?? null,
          reverseCharge: Boolean(reverseCharge),
          status: 'draft',
          matchStatus: 'unmatched',
          riskLevel: 'low',
          riskScore: 0,
          period: (date ?? new Date().toISOString().split('T')[0]).slice(0, 7),
          notes: cloudNotes ?? null,
          // Invoice Cloud™ financial fields
          dueDate: dueDate ?? null,
          gstAmount: totals.gstAmount,
          paidAmount: 0,
          balanceAmount: totals.totalAmount,
          paymentStatus: 'unpaid',
          recurring: Boolean(recurring),
          recurringCycle: recurringCycle ?? null,
          notesFinance: notesFinance ?? null,
          sentToCustomer: false,
          // Invoice Cloud™ document fields
          terms: terms ?? null,
          bankDetails: bankDetails ?? null,
          placeOfSupply: placeOfSupply ?? null,
          items: { create: itemsCreate },
        },
        include: { items: true, client: true },
      });

      await db.auditLog.create({
        data: {
          clientId: resolvedClientId,
          action: 'Invoice Created',
          entity: 'invoice',
          entityId: invoice.id,
          details: `Invoice Cloud™ ${invoiceNumber} created for ${customerName} (₹${totals.totalAmount})`,
        },
      });

      // ── Real Business Graph Engine™ — auto-create invoice node + live event ──
      graphEvents.invoiceCreated(invoice.id, invoice.invoiceNumber, totals.totalAmount, cloudBuyerGstin ?? undefined);

      // PT-2-b: canonical graph node emit (verifies entity + pushes live event + invalidates cache)
      try { await emitInvoiceNode(invoice.id); } catch (e) { console.error('[graph] emitInvoiceNode failed', e); }

      // ── Business Timeline — emit invoice.created (fire-and-forget) ──
      if (cloudOrgId) {
        // Unified SaaS: invalidate the canonical snapshot cache so every
        // dependent module (Dashboard, Oracle, Reports, GST) reflects the new
        // invoice immediately — no 30s TTL wait.
        invalidateBusinessSnapshotCache(cloudOrgId);

        await emitTimelineEvent({
          organizationId: cloudOrgId,
          type: 'invoice.created',
          title: `Invoice ${invoiceNumber} created`,
          description: `₹${totals.totalAmount.toLocaleString('en-IN')} invoice issued for ${customerName}.`,
          actor: parseActorHeader(request),
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber,
            customerId: resolvedClientId,
            customerName,
            amount: totals.totalAmount,
            taxableValue: totals.taxableValue,
            gstAmount: totals.gstAmount,
            dueDate: dueDate ?? null,
            terms: terms ?? null,
          },
          severity: 'info',
        });
      }

      return NextResponse.json({ invoice }, { status: 201 });
    }

    // ── Original GST invoice flow (unchanged) ──────────────────────────────
    const {
      clientId,
      invoiceNumber,
      invoiceDate,
      sellerGstin,
      buyerGstin,
      buyerName,
      invoiceType,
      gstr1Section,
      taxableValue,
      cgst,
      sgst,
      igst,
      cess,
      totalAmount,
      hsnCode,
      reverseCharge,
      status,
      matchStatus,
      riskLevel,
      riskScore,
      period,
      notes,
    } = body;

    if (!clientId || !invoiceNumber) {
      return NextResponse.json(
        { error: 'clientId and invoiceNumber are required' },
        { status: 400 }
      );
    }

    // Tenant scope check on the legacy branch — REQUIRED (never skip).
    // If no org can be resolved, the invoice has no tenant owner and must
    // not be created (prevents orphan/cross-tenant invoices).
    const legacyOrgId = await resolveOrgForInvoice(request, body, clientId);
    if (!legacyOrgId) {
      return NextResponse.json(
        { error: 'An organization context is required to create an invoice.' },
        { status: 400 },
      );
    }
    const memberResult = await requireOrgMembership(uid, legacyOrgId);
    if (memberResult instanceof NextResponse) return memberResult;

    const invoice = await db.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        invoiceDate: invoiceDate ?? new Date().toISOString().split('T')[0],
        sellerGstin: sellerGstin ?? '',
        buyerGstin: buyerGstin ?? null,
        buyerName: buyerName ?? null,
        invoiceType: invoiceType ?? 'B2B',
        gstr1Section: gstr1Section ?? 'b2b',
        taxableValue: taxableValue ?? 0,
        cgst: cgst ?? 0,
        sgst: sgst ?? 0,
        igst: igst ?? 0,
        cess: cess ?? 0,
        totalAmount: totalAmount ?? 0,
        hsnCode: hsnCode ?? null,
        reverseCharge: reverseCharge ?? false,
        status: status ?? 'draft',
        matchStatus: matchStatus ?? 'unmatched',
        riskLevel: riskLevel ?? 'low',
        riskScore: riskScore ?? 0,
        period: period ?? null,
        notes: notes ?? null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Invoice Created',
        entity: 'invoice',
        entityId: invoice.id,
        details: `New invoice ${invoiceNumber} created for client ${clientId}`,
      },
    });

    // ── Real Business Graph Engine™ — auto-create invoice node + live event ──
    graphEvents.invoiceCreated(invoice.id, invoice.invoiceNumber, invoice.totalAmount, buyerGstin ?? undefined);

    // PT-2-b: canonical graph node emit (verifies entity + pushes live event + invalidates cache)
    try { await emitInvoiceNode(invoice.id); } catch (e) { console.error('[graph] emitInvoiceNode failed', e); }

    // ── Business Timeline — emit invoice.created (fire-and-forget) ──
    if (legacyOrgId) {
      // Unified SaaS: invalidate the canonical snapshot cache so every
      // dependent module reflects the new invoice immediately.
      invalidateBusinessSnapshotCache(legacyOrgId);

      await emitTimelineEvent({
        organizationId: legacyOrgId,
        type: 'invoice.created',
        title: `Invoice ${invoiceNumber} created`,
        description: `₹${Number(totalAmount ?? 0).toLocaleString('en-IN')} invoice issued${buyerName ? ` for ${buyerName}` : ''}.`,
        actor: parseActorHeader(request),
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber,
          customerId: clientId,
          customerName: buyerName ?? null,
          amount: Number(totalAmount ?? 0),
          taxableValue: Number(taxableValue ?? 0),
          period: period ?? null,
        },
        severity: 'info',
      });
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoices error:', error);
    return friendlyApiError(error, 'We could not create the invoice right now. Please try again.');
  }
}

// PATCH /api/invoices — Update an existing invoice
// Auth + tenant-scoped: the caller must be a member of the org that owns the
// invoice's client.firmId. Prevents cross-tenant edits.
export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await request.json();
    const { id, items: newItems, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice id is required' },
        { status: 400 }
      );
    }

    // Fetch existing to verify tenant scope.
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { client: true },
    });
    // FIX 10: orphan invoices (null firmId) → 404 (not 403).
    const accessErr = await assertInvoiceTenantAccess(uid, existing);
    if (accessErr) return accessErr;

    // Remove fields that shouldn't be directly updated.
    // FIX 4: `clientId` is stripped to prevent cross-tenant invoice moves.
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.id;
    delete updates.clientId;

    // ── Status transition validation ──
    // Prevent logically invalid transitions:
    //   • cancelled → paid/sent/overdue  (must restore first)
    //   • paid → draft                   (must un-pay first)
    // Allowed transitions: draft→sent, draft→paid, sent→paid, sent→overdue,
    //   any→cancelled, paid→cancelled (refund), overdue→paid.
    const VALID_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (updates.status !== undefined) {
      const newStatus = String(updates.status);
      if (!VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
          { error: `"${newStatus}" is not a valid invoice status. Allowed: ${VALID_STATUSES.join(', ')}.` },
          { status: 400 },
        );
      }
      const oldStatus = existing.status;
      if (oldStatus === 'cancelled' && newStatus !== 'cancelled' && newStatus !== 'draft') {
        return NextResponse.json(
          { error: 'A cancelled invoice must be restored to draft before transitioning to another status.' },
          { status: 409 },
        );
      }
      if (oldStatus === 'paid' && newStatus === 'draft') {
        return NextResponse.json(
          { error: 'A paid invoice cannot be reverted to draft. Adjust the payment first.' },
          { status: 409 },
        );
      }
    }

    // ── If line items are supplied, replace them atomically ──
    if (Array.isArray(newItems)) {
      await db.invoiceItem.deleteMany({ where: { invoiceId: id } });
      let itemsCreate: Array<Record<string, unknown>> = [];
      if (newItems.length > 0) {
        const interState = updates.igst !== undefined
          ? Number(updates.igst) > 0
          : (Number(existing.igst) > 0);
        itemsCreate = newItems.map((it: {
          description?: string;
          hsnCode?: string;
          quantity?: number;
          unit?: string;
          unitPrice?: number;
          gstRate?: number;
          discount?: number;
          cessRate?: number;
        }, idx: number) => {
          const qty = Number(it.quantity) || 0;
          const price = Number(it.unitPrice) || 0;
          const gross = qty * price;
          const disc = Math.min(Math.max(Number(it.discount) || 0, 0), 100);
          const taxable = Math.round((gross * (1 - disc / 100)) * 100) / 100;
          const rate = Number(it.gstRate) || 0;
          const cessR = Number(it.cessRate) || 0;
          const cgstR = interState ? 0 : rate / 2;
          const sgstR = interState ? 0 : rate / 2;
          const igstR = interState ? rate : 0;
          return {
            invoiceId: id,
            lineNumber: idx + 1,
            description: it.description ?? null,
            hsnCode: it.hsnCode ?? null,
            quantity: qty,
            unit: it.unit ?? 'NOS',
            unitPrice: price,
            taxableValue: taxable,
            cgstRate: cgstR,
            sgstRate: sgstR,
            igstRate: igstR,
            cessRate: cessR,
            cgst: Math.round(taxable * cgstR) / 100,
            sgst: Math.round(taxable * sgstR) / 100,
            igst: Math.round(taxable * igstR) / 100,
            cess: Math.round(taxable * cessR) / 100,
            totalAmount: Math.round((taxable + (taxable * rate / 100) + (taxable * cessR / 100)) * 100) / 100,
          };
        });
        await db.invoiceItem.createMany({ data: itemsCreate });
      }

      // FIX 5: when items[] is replaced, recompute totals from the new line
      // items so the invoice header stays consistent. Merges taxableValue,
      // cgst, sgst, igst, cess, gstAmount, totalAmount into `updates`.
      const lineItemsForTotals: InvoiceLineItem[] = itemsCreate.map((it) => ({
        taxableValue: Number(it.taxableValue) || 0,
        cgstRate: Number(it.cgstRate) || 0,
        sgstRate: Number(it.sgstRate) || 0,
        igstRate: Number(it.igstRate) || 0,
        cessRate: Number(it.cessRate) || 0,
      }));
      const totals = calculateInvoiceTotals(lineItemsForTotals, newItems as Array<{ cessRate?: number }> );
      updates.taxableValue = totals.taxableValue;
      updates.cgst = totals.cgst;
      updates.sgst = totals.sgst;
      updates.igst = totals.igst;
      updates.cess = totals.cess;
      updates.gstAmount = totals.gstAmount;
      updates.totalAmount = totals.totalAmount;
    }

    // Recompute balanceAmount if paidAmount or totalAmount changed (or items replaced).
    if (updates.paidAmount !== undefined || updates.totalAmount !== undefined) {
      const paid = Number(updates.paidAmount ?? existing.paidAmount);
      const total = Number(updates.totalAmount ?? existing.totalAmount);
      updates.balanceAmount = Math.max(0, Math.round((total - paid) * 100) / 100);
      // Derive paymentStatus via the shared engine helper.
      const due = (updates.dueDate !== undefined ? String(updates.dueDate) : existing.dueDate) || undefined;
      updates.paymentStatus = derivePaymentStatus(paid, total, due);
    }

    const invoice = await db.invoice.update({
      where: { id },
      data: updates,
      include: { client: true, items: { orderBy: { lineNumber: 'asc' } } },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: invoice.clientId,
        action: 'Invoice Updated',
        entity: 'invoice',
        entityId: invoice.id,
        details: `Invoice ${invoice.invoiceNumber} updated`,
      },
    });

    // ── Real Business Graph Engine™ — invalidate cache so edits reflect instantly ──
    invalidateGraph();

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Invoice totals/status changed → revenue, receivables, GST, health score
    // all need recomputation. Clears the 30s server cache for this org.
    if (existing.client?.firmId) {
      invalidateBusinessSnapshotCache(existing.client.firmId);
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('PATCH /api/invoices error:', error);
    return friendlyApiError(error, 'We could not update the invoice right now. Please try again.');
  }
}

// DELETE /api/invoices — Delete an invoice
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice id is required' },
        { status: 400 }
      );
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { client: true },
    });

    // FIX 10: orphan invoices (null firmId) → 404 (not 403).
    const delAccessErr = await assertInvoiceTenantAccess(uid, existing);
    if (delAccessErr) return delAccessErr;

    // Create audit log + delete invoice atomically. InvoiceItem rows are
    // removed automatically via the onDelete: Cascade relation — no need
    // to deleteMany first (and no "referential constraint" failure).
    await db.$transaction([
      db.auditLog.create({
        data: {
          clientId: existing.clientId,
          action: 'Invoice Deleted',
          entity: 'invoice',
          entityId: id,
          details: `Invoice ${existing.invoiceNumber} deleted for ${existing.client.tradeName}`,
        },
      }),
      db.invoice.delete({ where: { id } }),
    ]);

    // Invalidate graph cache so live dashboards reflect the deletion.
    invalidateGraph();

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Invoice deleted → revenue, receivables, GST, customer balances all
    // need recomputation.
    if (existing.client?.firmId) {
      invalidateBusinessSnapshotCache(existing.client.firmId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/invoices error:', error);
    return friendlyApiError(error, 'We could not delete the invoice right now. Please try again.');
  }
}
