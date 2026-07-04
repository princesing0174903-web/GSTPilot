// GET /api/communication/gmail/status — provider health + diagnostics.
import { NextResponse } from 'next/server';
import { gmailProviderHealth } from '@/lib/communication-provider/server/orchestrator';
import { getGmailProviderName } from '@/lib/communication-provider/server/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const health = await gmailProviderHealth();
  return NextResponse.json({
    ok: true,
    provider: getGmailProviderName(),
    ...health,
  });
}
