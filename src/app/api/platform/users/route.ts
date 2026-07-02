// GET /api/platform/users — list tenant users across organisations
import { NextResponse } from 'next/server';
import { getTenantUsers } from '@/lib/platform/identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const users = await getTenantUsers();
    return NextResponse.json(
      { count: users.length, users },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list tenant users', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
