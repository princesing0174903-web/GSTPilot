import { NextResponse } from 'next/server';
import { grantConsent, revokeConsent, getAAState } from '@/lib/banking/aggregator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getAAState();
    return NextResponse.json(state);
  } catch (err) {
    console.error('[API /aa/consent] GET error:', err);
    return NextResponse.json({ error: 'Failed to load AA state', consents: [], linkedAccounts: [], totalLinked: 0, totalBalance: 0, hasLiveData: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (body.action === 'revoke') {
      const result = await revokeConsent(body.accountId);
      return NextResponse.json({ success: true, ...result, message: "I've revoked AA consent for this account." });
    }
    const result = await grantConsent(body.accountId);
    return NextResponse.json({
      success: true,
      ...result,
      message: "I've granted AA consent — data will sync automatically.",
    });
  } catch (err) {
    console.error('[API /aa/consent] POST error:', err);
    return NextResponse.json({ error: 'Failed to manage consent' }, { status: 500 });
  }
}
