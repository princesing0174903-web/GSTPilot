// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connect/whatsapp
// Connect WhatsApp Business — stores connection for Oracle awareness
// Body: { userId, phoneNumber, messages? }
//
// If `messages` (array of message objects) is provided, they are parsed + stored
// — enabling "which clients are ignoring reminders?" detection.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createWhatsAppMetadata,
  validatePhoneNumber,
  classifyMessage,
} from '@/lib/connectors/whatsapp';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';

export async function POST(request: NextRequest) {
  let body: {
    userId?: string;
    phoneNumber?: string;
    messages?: Array<{
      contactName: string;
      contactPhone: string;
      direction: 'outbound' | 'inbound';
      messageText: string;
      timestamp: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const phoneNumber = body.phoneNumber;
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (!phoneNumber) return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });

  const { valid, formatted, display } = validatePhoneNumber(phoneNumber);
  if (!valid) {
    return NextResponse.json({
      error: 'Invalid phone number — must be a valid Indian mobile number (10 digits, starts with 6-9)',
    }, { status: 400 });
  }

  const metadata = createWhatsAppMetadata(phoneNumber);

  try {
    const existing = await db.dataConnection.findFirst({
      where: { userId, type: 'whatsapp', identifier: formatted },
    });

    let connectionId: string;

    if (existing) {
      await db.syncedRecord.deleteMany({
        where: { connectionId: existing.id, sourceType: 'whatsapp_msg' },
      }).catch(() => {});
      await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          label: `WhatsApp ${display}`,
          identifier: formatted,
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
          type: 'whatsapp',
          status: 'connected',
          label: `WhatsApp ${display}`,
          identifier: formatted,
          metadata: JSON.stringify(metadata),
          lastSyncAt: new Date(),
          syncInterval: '15m',
        },
      });
      connectionId = conn.id;
    }

    // Store messages
    const messages = body.messages ?? [];
    for (const msg of messages) {
      const type = classifyMessage(msg.messageText);
      await db.syncedRecord.create({
        data: {
          connectionId,
          userId,
          sourceType: 'whatsapp_msg',
          externalId: `wa_${msg.timestamp}_${msg.contactPhone}_${msg.direction}`,
          title: msg.messageText,
          amount: null,
          date: msg.timestamp,
          rawData: JSON.stringify({
            contactName: msg.contactName,
            contactPhone: msg.contactPhone,
            direction: msg.direction,
            type,
          }),
          category: type,
          processed: true,
        },
      }).catch(() => {});
      // ── Real Business Graph Engine™ — live event for inbound WhatsApp messages ──
      if (msg.direction === 'inbound') {
        graphEvents.whatsappReceived(`wa_${msg.timestamp}`, msg.contactPhone, msg.messageText);
      }
    }

    const remindersSent = messages.filter(
      (m) => classifyMessage(m.messageText) === 'payment_reminder' && m.direction === 'outbound',
    ).length;

    // ── Real Business Graph Engine™ — WhatsApp connection builds graph; log + refresh ──
    graphEvents.connectorSynced('whatsapp', `WhatsApp ${display}`);
    invalidateGraph();

    return NextResponse.json({
      success: true,
      connectionId,
      phoneNumber: formatted,
      display,
      messagesImported: messages.length,
      remindersSent,
      message: messages.length > 0
        ? `WhatsApp connected — imported ${messages.length} messages (${remindersSent} payment reminders tracked)`
        : `WhatsApp ${display} connected — Oracle now tracks client communication`,
    });
  } catch (err) {
    console.error('[WhatsApp] Connect error:', err);
    return NextResponse.json({ error: 'Failed to save WhatsApp connection' }, { status: 500 });
  }
}
