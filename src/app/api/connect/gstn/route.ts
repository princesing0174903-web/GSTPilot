// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connect/gstn
// Connect a GSTIN — REAL validation (format + PAN + state code + entity + checksum)
// Body: { userId, gstin }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateGstin, deriveGstProfile } from '@/lib/connectors/gstn';

export async function POST(request: NextRequest) {
  let body: { userId?: string; gstin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const gstin = body.gstin;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!gstin) {
    return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  }

  // ── REAL GSTIN validation ──
  const validation = validateGstin(gstin);
  if (!validation.valid) {
    return NextResponse.json({
      error: 'Invalid GSTIN',
      details: validation.errors,
      gstin: validation.gstin,
    }, { status: 400 });
  }

  // ── Derive GST profile from the validated GSTIN ──
  const profile = deriveGstProfile(validation.gstin);
  if (!profile) {
    return NextResponse.json({ error: 'Could not derive GST profile' }, { status: 500 });
  }

  try {
    // Check if this GSTIN is already connected for this user
    const existing = await db.dataConnection.findFirst({
      where: { userId, type: 'gstn', identifier: validation.gstin },
    });

    if (existing) {
      // Update the existing connection
      const updated = await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          label: `GSTN: ${validation.gstin}`,
          identifier: validation.gstin,
          metadata: JSON.stringify(profile),
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      return NextResponse.json({
        success: true,
        connectionId: updated.id,
        gstin: validation.gstin,
        profile,
        message: 'GSTIN re-validated and connection refreshed',
      });
    }

    // Create new connection
    const conn = await db.dataConnection.create({
      data: {
        userId,
        type: 'gstn',
        status: 'connected',
        label: `GSTN: ${validation.gstin}`,
        identifier: validation.gstin,
        metadata: JSON.stringify(profile),
        lastSyncAt: new Date(),
        syncInterval: '15m',
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: conn.id,
      gstin: validation.gstin,
      profile,
      message: 'GSTIN connected successfully — Oracle now knows your GST profile',
    });
  } catch (err) {
    console.error('[GSTN] Connect error:', err);
    return NextResponse.json({ error: 'Failed to save GSTIN connection' }, { status: 500 });
  }
}
