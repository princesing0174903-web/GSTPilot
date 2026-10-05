// GET /api/execution-cloud/mobile
// Returns the mobile app state (builds, devices, notifications).

import { NextResponse } from 'next/server';
import { buildMobileState } from '@/lib/execution-cloud/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const mobile = buildMobileState();
    return NextResponse.json(mobile, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/mobile] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to build mobile state', detail: String(err) },
      { status: 500 },
    );
  }
}
