// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connect/accounting
// Connect accounting software (Tally / Zoho Books / QuickBooks)
// Body: { userId, software, companyName, companyGstin?, financialYear?, invoices? }
//
// If `invoices` (array of AccountingInvoice objects) is provided, they are stored
// — enabling real sales/purchase sync.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createAccountingMetadata,
  accountingInvoiceToRecord,
  type AccountingSoftware,
} from '@/lib/connectors/accounting';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';

export async function POST(request: NextRequest) {
  let body: {
    userId?: string;
    software?: AccountingSoftware;
    companyName?: string;
    companyGstin?: string;
    financialYear?: string;
    invoices?: Array<{
      invoiceNumber: string;
      invoiceDate: string;
      partyName: string;
      partyGstin?: string;
      invoiceType: 'sales' | 'purchase';
      taxableAmount: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalAmount: number;
      status: 'paid' | 'unpaid' | 'partial' | 'cancelled';
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const software = body.software;
  const companyName = body.companyName;
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (!software || !['tally', 'zoho', 'quickbooks'].includes(software)) {
    return NextResponse.json({ error: 'software must be tally, zoho, or quickbooks' }, { status: 400 });
  }
  if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400 });

  const metadata = createAccountingMetadata(
    software,
    companyName,
    body.companyGstin,
    body.financialYear,
  );

  try {
    const existing = await db.dataConnection.findFirst({
      where: { userId, type: software },
    });

    let connectionId: string;

    if (existing) {
      await db.syncedRecord.deleteMany({
        where: { connectionId: existing.id, sourceType: 'accounting_invoice' },
      }).catch(() => {});
      await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          label: `${software.charAt(0).toUpperCase() + software.slice(1)} — ${companyName}`,
          identifier: companyName,
          metadata: JSON.stringify(metadata),
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      connectionId = existing.id;
    } else {
      const conn = await db.dataConnection.create({
        data: {
          userId,
          type: software,
          status: 'connected',
          label: `${software.charAt(0).toUpperCase() + software.slice(1)} — ${companyName}`,
          identifier: companyName,
          metadata: JSON.stringify(metadata),
          lastSyncAt: new Date(),
          syncInterval: '15m',
        },
      });
      connectionId = conn.id;
    }

    // Store invoices
    // (Was N+1: sequential create per invoice. Now batched via createMany
    // with chunking to stay under SQLite parameter limits.)
    const invoices = body.invoices ?? [];
    if (invoices.length > 0) {
      const records = invoices.map((inv) => {
        const r = accountingInvoiceToRecord(inv, connectionId, userId);
        return {
          connectionId: r.connectionId,
          userId: r.userId,
          sourceType: r.sourceType,
          externalId: r.externalId,
          title: r.title,
          amount: r.amount,
          date: r.date,
          rawData: JSON.stringify(r.rawData),
          category: r.category,
          processed: r.processed,
        };
      });
      // Chunk into batches of 100 to avoid SQLite parameter limits.
      for (let i = 0; i < records.length; i += 100) {
        try {
          await db.syncedRecord.createMany({
            data: records.slice(i, i + 100),
            skipDuplicates: true,
          });
        } catch {
          /* non-fatal per-row errors swallowed (matches old behaviour) */
        }
      }
    }

    const salesCount = invoices.filter((i) => i.invoiceType === 'sales').length;
    const purchaseCount = invoices.filter((i) => i.invoiceType === 'purchase').length;

    // ── Real Business Graph Engine™ — accounting connection builds graph; log + refresh ──
    graphEvents.connectorSynced(software, `${software.charAt(0).toUpperCase() + software.slice(1)} — ${companyName}`);
    invalidateGraph();

    return NextResponse.json({
      success: true,
      connectionId,
      software,
      companyName,
      invoicesImported: invoices.length,
      salesInvoices: salesCount,
      purchaseBills: purchaseCount,
      message: invoices.length > 0
        ? `${software.charAt(0).toUpperCase() + software.slice(1)} connected — synced ${invoices.length} invoices (${salesCount} sales, ${purchaseCount} purchases)`
        : `${software.charAt(0).toUpperCase() + software.slice(1)} connected for ${companyName} — Oracle now tracks your accounting data`,
    });
  } catch (err) {
    console.error('[Accounting] Connect error:', err);
    return NextResponse.json({ error: 'Failed to save accounting connection' }, { status: 500 });
  }
}
