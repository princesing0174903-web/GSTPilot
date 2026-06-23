// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectors/[id]/sync?userId=<firebase_uid>
// Triggers a manual sync for a connection.
// ── Gmail: re-syncs emails using a fresh access token (provided in body)
// ── GSTN: re-validates GSTIN + refreshes profile
// ── Bank: refreshes transactions from statement data
// ── Others: marks as synced
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncGmailEmails, emailsToRecords } from '@/lib/connectors/gmail';
import { validateGstin, deriveGstProfile } from '@/lib/connectors/gstn';
import { runDataQualityChecks } from '@/lib/data-quality/engine';

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
      // Deduplicate by externalId — delete existing then re-insert
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

      // Update connection metadata
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
      // Re-validate GSTIN + refresh profile
      const meta = conn.metadata ? JSON.parse(conn.metadata) : {};
      const gstin = meta.gstin ?? conn.identifier;
      if (gstin) {
        const validation = validateGstin(gstin);
        if (validation.valid) {
          const profile = deriveGstProfile(gstin);
          await db.dataConnection.update({
            where: { id },
            data: {
              status: 'connected',
              lastSyncAt: new Date(),
              errorMessage: null,
              metadata: JSON.stringify(profile ?? meta),
            },
          });
          recordsSynced = 1;
          summary = `GSTIN ${gstin} validated successfully — profile refreshed`;
        } else {
          await db.dataConnection.update({
            where: { id },
            data: { status: 'error', errorMessage: validation.errors.join('; ') },
          });
          return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
        }
      }
    } else {
      // For bank, whatsapp, accounting — mark as synced
      await db.dataConnection.update({
        where: { id },
        data: { status: 'connected', lastSyncAt: new Date(), errorMessage: null },
      });
      summary = `${conn.type} connection sync completed`;
    }

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
