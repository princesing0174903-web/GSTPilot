// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connect/gmail
// Connect Gmail — REAL email sync using a Google OAuth access token
// Body: { userId, accessToken }
//
// The access token is obtained on the frontend via Google Identity Services (GIS)
// with the gmail.readonly scope. It is used ONCE for this sync, then discarded.
// Only the parsed email DATA is stored — never the token.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncGmailEmails, emailsToRecords } from '@/lib/connectors/gmail';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';

export async function POST(request: NextRequest) {
  let body: { userId?: string; accessToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const accessToken = body.accessToken;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'accessToken is required (obtain via Google Identity Services with gmail.readonly scope)' }, { status: 400 });
  }

  // ── REAL Gmail sync ──
  const { profile, emails, errors } = await syncGmailEmails(accessToken);
  if (!profile) {
    return NextResponse.json({
      error: 'Gmail sync failed — token may be expired or missing gmail.readonly scope',
      details: errors,
    }, { status: 502 });
  }

  try {
    // Check for existing Gmail connection with the same email
    const existing = await db.dataConnection.findFirst({
      where: { userId, type: 'gmail' },
    });

    const metadata = JSON.stringify({
      email: profile.emailAddress,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      messageCount: profile.messagesTotal,
      lastMessageDate: new Date().toISOString(),
    });

    let connectionId: string;

    if (existing) {
      // Update + clear old synced records
      await db.syncedRecord.deleteMany({
        where: { connectionId: existing.id, sourceType: 'email' },
      }).catch(() => {});
      await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          label: profile.emailAddress,
          identifier: profile.emailAddress,
          metadata,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      connectionId = existing.id;
    } else {
      const conn = await db.dataConnection.create({
        data: {
          userId,
          type: 'gmail',
          status: 'connected',
          label: profile.emailAddress,
          identifier: profile.emailAddress,
          metadata,
          lastSyncAt: new Date(),
          syncInterval: '15m',
        },
      });
      connectionId = conn.id;
    }

    // Store synced emails
    const records = emailsToRecords(emails, connectionId, userId);
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

    // Categorize counts
    const gstNotices = emails.filter((e) => e.category === 'gst_notice').length;
    const vendorInvoices = emails.filter((e) => e.category === 'vendor_invoice').length;
    const clientInvoices = emails.filter((e) => e.category === 'client_invoice').length;
    const taxComms = emails.filter((e) => e.category === 'tax_communication').length;

    // ── Real Business Graph Engine™ — live event per synced email + connection refresh ──
    for (const e of emails) {
      graphEvents.emailReceived(e.messageId, e.from, e.subject);
    }
    graphEvents.connectorSynced('gmail', profile.emailAddress);
    invalidateGraph();

    return NextResponse.json({
      success: true,
      connectionId,
      email: profile.emailAddress,
      totalEmails: profile.messagesTotal,
      syncedEmails: emails.length,
      breakdown: {
        gstNotices,
        vendorInvoices,
        clientInvoices,
        taxCommunications: taxComms,
      },
      message: `Gmail connected — synced ${emails.length} GST-related emails (${gstNotices} notices, ${vendorInvoices} vendor invoices)`,
    });
  } catch (err) {
    console.error('[Gmail] Connect error:', err);
    return NextResponse.json({ error: 'Failed to save Gmail connection' }, { status: 500 });
  }
}
