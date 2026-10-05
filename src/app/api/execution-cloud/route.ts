// GET /api/execution-cloud
// Returns the full Execution Cloud state (all 8 modules).

import { NextResponse } from 'next/server';
import { getExecutionCloudState } from '@/lib/execution-cloud/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const state = await getExecutionCloudState(null);
    return NextResponse.json(state, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to build Execution Cloud state', detail: String(err) },
      { status: 500 },
    );
  }
}
