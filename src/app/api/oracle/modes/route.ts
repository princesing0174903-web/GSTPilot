// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/modes — List Oracle Copilot Modes
//
// Returns the list of available Copilot Modes (CFO, GST, Cash Flow, etc.) for
// the UI mode selector. This is a public list (no org-specific data) but still
// requires auth so unauthenticated users can't probe the API.
//
// Auth: requireAuth (no org membership needed — modes are global).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { listModes } from '@/lib/oracle/brain/copilot-modes';

export const runtime = 'nodejs';
export const revalidate = 3600; // modes don't change often — cache for 1 hour

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const modes = listModes();
    return NextResponse.json({ ok: true, modes });
  } catch (err) {
    return friendlyApiError(err, 'We could not load the Oracle modes right now.');
  }
}
