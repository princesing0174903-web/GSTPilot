// POST /api/communication/whatsapp/connect
import { NextRequest, NextResponse } from 'next/server';
import {
  connectWhatsApp,
  completeWhatsAppConnection,
} from '@/lib/communication-provider/server/orchestrator';
import { getWhatsAppProviderName } from '@/lib/communication-provider/server/registry';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';
import type { WhatsAppProviderName } from '@/lib/communication-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, phoneNumber, businessName, provider, createdBy } = body as {
      organizationId?: string;
      phoneNumber?: string;
      businessName?: string;
      provider?: WhatsAppProviderName;
      createdBy?: { uid: string; name: string; email: string };
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!phoneNumber || !/^\+?\d{10,15}$/.test(phoneNumber.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { ok: false, error: 'A valid phone number (10-15 digits) is required.' },
        { status: 400 },
      );
    }

    const providerName: WhatsAppProviderName = provider ?? getWhatsAppProviderName();

    const result = await connectWhatsApp({
      organizationId,
      phoneNumber: phoneNumber.trim(),
      businessName: businessName?.trim() || undefined,
      createdBy: createdBy ?? { uid: '', name: businessName?.trim() ?? '', email: '' },
    });

    let complete: {
      encryptedConnection: string;
      sessionExpiry: string;
      profile: {
        phoneNumber: string;
        displayPhoneNumber: string | null;
        businessName: string | null;
        qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
        messagingLimitTier: string | null;
      };
    } | null = null;
    try {
      complete = await completeWhatsAppConnection(organizationId, result.connectionRef);
    } catch (err) {
      console.warn('[api/communication/whatsapp/connect] complete deferred:', friendlyCommunicationError(err));
    }

    return NextResponse.json({ ok: true, result, complete, provider: providerName });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/whatsapp/connect] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
