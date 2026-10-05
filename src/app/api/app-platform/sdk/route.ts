import { NextResponse } from 'next/server';
import { EXTENSION_SDK } from '@/lib/app-platform/sdk';

/** GET /api/app-platform/sdk — Extension SDK info (languages, templates, CLI, emulator). */
export async function GET() {
  try {
    return NextResponse.json(EXTENSION_SDK);
  } catch (error) {
    console.error('[API /app-platform/sdk] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SDK info' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
