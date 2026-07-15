// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectors/[id]/sync?userId=<firebase_uid>
// Triggers a manual sync for a connection.
// ── Gmail: re-syncs emails using a fresh access token (provided in body)
// ── GSTN:  re-validates GSTIN + refreshes profile + creates GSTR-1/3B/2B stub records
// ── Bank:  refreshes transactions + creates 5–10 bank_tx stub records
// ── WhatsApp: creates whatsapp_msg stub records
// ── Tally/Zoho/QB: creates accounting_invoice + accounting_ledger stub records
//
// All stub records are real SyncedRecord rows in the DB — Oracle + Business Graph
// + Data Quality Engine can read them.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncGmailEmails, emailsToRecords } from '@/lib/connectors/gmail';
import { validateGstin, deriveGstProfile } from '@/lib/connectors/gstn';
import { runDataQualityChecks } from '@/lib/data-quality/engine';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';
import { safeAudit } from '@/lib/audit/safe-write';

// ─── Stub data generators ────────────────────────────────────────────────────
// REAL CONNECTOR SYNC PENDING — returns empty. Stubs removed to prevent fake
// data in production DB. Each generator previously returned hardcoded mock
// records (Acme Industries, Sample Customer, Tally Solutions, WeWork Mumbai,
// etc.) which were persisted as SyncedRecord rows on every connector sync.
// They now return `[]` so the route continues to compile + report `0 records`
// honestly. Real connector sync (live GSTN/bank/WhatsApp/accounting APIs) is a
// future enterprise phase.

interface StubRecord {
  sourceType: string;
  externalId: string;
  title: string;
  amount: number | null;
  date: string;
  category: string | null;
  rawData: Record<string, unknown>;
  processed: boolean;
}

// REAL CONNECTOR SYNC PENDING — returns [].
function gstnStubRecords(_gstin: string): StubRecord[] {
  // TODO: wire to real GSTN API (returns / e-invoices / e-way bills / notices).
  void _gstin;
  return [];
}

// REAL CONNECTOR SYNC PENDING — returns [].
function bankStubRecords(_bankName: string, _accountLast4: string): StubRecord[] {
  // TODO: wire to real bank API (Razorpay / Decentro / MBS / Anumati).
  void _bankName;
  void _accountLast4;
  return [];
}

// REAL CONNECTOR SYNC PENDING — returns [].
function whatsappStubRecords(_phone: string): StubRecord[] {
  // TODO: wire to real WhatsApp Business API.
  void _phone;
  return [];
}

// REAL CONNECTOR SYNC PENDING — returns [].
function accountingStubRecords(_software: string, _companyName: string): StubRecord[] {
  // TODO: wire to real ERP (Zoho Books customer sync is available via
  // /api/integrations/zoho/customers; Tally/Busy/QuickBooks pending).
  void _software;
  void _companyName;
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const conn = await db.dataConnection.findUnique({ where: { id } });
    if (!conn || conn.userId !== userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Mark as syncing
    await db.dataConnection.update({
      where: { id },
      data: { status: 'syncing' },
    });

    let recordsSynced = 0;
    let summary = '';

    if (conn.type === 'gmail') {
      // Gmail sync requires a fresh access token in the body
      const body = await request.json().catch(() => ({}));
      const accessToken = body.accessToken;
      if (!accessToken) {
        await db.dataConnection.update({
          where: { id },
          data: { status: 'error', errorMessage: 'No access token provided for Gmail sync' },
        });
        return NextResponse.json({ error: 'accessToken is required for Gmail sync' }, { status: 400 });
      }

      const { profile, emails, errors } = await syncGmailEmails(accessToken);
      if (errors.length > 0 && !profile) {
        await db.dataConnection.update({
          where: { id },
          data: { status: 'error', errorMessage: errors[0] },
        });
        return NextResponse.json({ error: errors[0] }, { status: 502 });
      }

      // Store synced emails
      const records = emailsToRecords(emails, id, userId);
      if (records.length > 0) {
        await db.syncedRecord.deleteMany({
          where: { connectionId: id, sourceType: 'email' },
        }).catch(() => {});
        for (const rec of records) {
          await db.syncedRecord.create({
            data: {
              connectionId: rec.connectionId,
              userId: rec.userId,
              sourceType: rec.sourceType,
              externalId: rec.externalId,
              title: rec.title,
              amount: rec.amount,
              date: rec.date,
              rawData: JSON.stringify(rec.rawData),
              category: rec.category,
              processed: rec.processed,
            },
          }).catch(() => {});
        }
      }

      recordsSynced = emails.length;
      summary = `Synced ${emails.length} GST-related emails from ${profile?.emailAddress ?? 'Gmail'}`;

      await db.dataConnection.update({
        where: { id },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          errorMessage: null,
          metadata: JSON.stringify({
            ...JSON.parse(conn.metadata ?? '{}'),
            email: profile?.emailAddress,
            messageCount: profile?.messagesTotal,
          }),
        },
      });
    } else if (conn.type === 'gstn') {
      const meta = conn.metadata ? JSON.parse(conn.metadata) : {};
      const gstin = meta.gstin ?? conn.identifier;
      if (gstin) {
        const validation = validateGstin(gstin);
        if (validation.valid) {
          const profile = deriveGstProfile(gstin);
          // Generate stub GSTR records
          const stubs = gstnStubRecords(gstin);
          await db.syncedRecord.deleteMany({
            where: { connectionId: id, sourceType: 'gst_return' },
          }).catch(() => {});
          for (const rec of stubs) {
            await db.syncedRecord.create({
              data: {
                connectionId: id,
                userId,
                sourceType: rec.sourceType,
                externalId: rec.externalId,
                title: rec.title,
                amount: rec.amount,
                date: rec.date,
                rawData: JSON.stringify(rec.rawData),
                category: rec.category,
                processed: rec.processed,
              },
            }).catch(() => {});
          }
          recordsSynced = stubs.length;
          summary = `GSTIN ${gstin} synced — discovered ${stubs.length} GSTR filings`;

          await db.dataConnection.update({
            where: { id },
            data: {
              status: 'connected',
              lastSyncAt: new Date(),
              errorMessage: null,
              metadata: JSON.stringify({ ...(profile ?? meta), lastSyncSummary: summary }),
            },
          });
        } else {
          await db.dataConnection.update({
            where: { id },
            data: { status: 'error', errorMessage: validation.errors.join('; ') },
          });
          return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
        }
      }
    } else if (conn.type === 'bank') {
      const meta = conn.metadata ? JSON.parse(conn.metadata) : {};
      const bankName = meta.bankName ?? 'Bank';
      const accountLast4 = meta.accountNumberMasked?.slice(-4) ?? '0000';
      const stubs = bankStubRecords(bankName, accountLast4);
      await db.syncedRecord.deleteMany({
        where: { connectionId: id, sourceType: 'bank_tx' },
      }).catch(() => {});
      for (const rec of stubs) {
        await db.syncedRecord.create({
          data: {
            connectionId: id,
            userId,
            sourceType: rec.sourceType,
            externalId: rec.externalId,
            title: rec.title,
            amount: rec.amount,
            date: rec.date,
            rawData: JSON.stringify(rec.rawData),
            category: rec.category,
            processed: rec.processed,
          },
        }).catch(() => {});
      }
      recordsSynced = stubs.length;
      summary = `${bankName} •••${accountLast4} synced — imported ${stubs.length} transactions`;

      await db.dataConnection.update({
        where: { id },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      try {
        graphEvents.bankSynced(bankName, stubs.length);
      } catch {}
    } else if (conn.type === 'whatsapp') {
      const meta = conn.metadata ? JSON.parse(conn.metadata) : {};
      const phone = meta.phoneNumber ?? conn.identifier ?? '';
      const stubs = whatsappStubRecords(phone);
      await db.syncedRecord.deleteMany({
        where: { connectionId: id, sourceType: 'whatsapp_msg' },
      }).catch(() => {});
      for (const rec of stubs) {
        await db.syncedRecord.create({
          data: {
            connectionId: id,
            userId,
            sourceType: rec.sourceType,
            externalId: rec.externalId,
            title: rec.title,
            amount: rec.amount,
            date: rec.date,
            rawData: JSON.stringify(rec.rawData),
            category: rec.category,
            processed: rec.processed,
          },
        }).catch(() => {});
      }
      recordsSynced = stubs.length;
      summary = `WhatsApp ${phone} synced — imported ${stubs.length} messages`;

      await db.dataConnection.update({
        where: { id },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
    } else if (conn.type === 'tally' || conn.type === 'zoho' || conn.type === 'quickbooks') {
      const meta = conn.metadata ? JSON.parse(conn.metadata) : {};
      const companyName = meta.companyName ?? 'Company';
      const stubs = accountingStubRecords(conn.type, companyName);
      await db.syncedRecord.deleteMany({
        where: { connectionId: id, sourceType: 'accounting_invoice' },
      }).catch(() => {});
      for (const rec of stubs) {
        await db.syncedRecord.create({
          data: {
            connectionId: id,
            userId,
            sourceType: rec.sourceType,
            externalId: rec.externalId,
            title: rec.title,
            amount: rec.amount,
            date: rec.date,
            rawData: JSON.stringify(rec.rawData),
            category: rec.category,
            processed: rec.processed,
          },
        }).catch(() => {});
      }
      recordsSynced = stubs.length;
      summary = `${conn.type.toUpperCase()} (${companyName}) synced — imported ${stubs.length} invoices`;

      await db.dataConnection.update({
        where: { id },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
    } else {
      // Unknown type — mark as synced
      await db.dataConnection.update({
        where: { id },
        data: { status: 'connected', lastSyncAt: new Date(), errorMessage: null },
      });
      summary = `${conn.type} connection sync completed`;
    }

    // AuditLog — CONNECTOR_SYNCED
    await safeAudit({
      userId,
      action: 'CONNECTOR_SYNCED',
      entity: 'DataConnection',
      entityId: id,
      newValue: JSON.stringify({ recordsSynced, summary }),
      details: `Synced ${conn.type.toUpperCase()} — ${recordsSynced} records`,
    });

    // ── Real Business Graph Engine™ — refresh graph after sync ──
    try {
      graphEvents.connectorSynced(conn.type, conn.label);
      invalidateGraph();
    } catch {}

    // Run data quality checks after sync
    const qualityReport = await runDataQualityChecks(userId);

    return NextResponse.json({
      success: true,
      recordsSynced,
      summary,
      dataQuality: {
        totalAlerts: qualityReport.totalAlerts,
        critical: qualityReport.critical,
        high: qualityReport.high,
      },
    });
  } catch (err) {
    console.error('[Sync] Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
