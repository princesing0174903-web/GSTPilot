// GET /api/communication/whatsapp/status — provider health + diagnostics.
import { NextResponse } from 'next/server';
import { whatsappProviderHealth } from '@/lib/communication-provider/server/orchestrator';
import { getWhatsAppProviderName } from '@/lib/communication-provider/server/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const health = await whatsappProviderHealth();
  return NextResponse.json({
    ok: true,
    provider: getWhatsAppProviderName(),
    ...health,
  });
}
