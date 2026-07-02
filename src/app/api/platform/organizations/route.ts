// GET /api/platform/organizations — list all customer organisations (real data)
import { NextResponse } from 'next/server';
import { listOrganizations } from '@/lib/platform/organizations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const organizations = await listOrganizations(100);
    return NextResponse.json(
      { count: organizations.length, organizations },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list organisations', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
