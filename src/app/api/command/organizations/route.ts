// GET /api/command/organizations
// Returns the cross-module coordination state across all departments + legal entities.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getCrossModuleSync } from '@/lib/command-network';
import { db, safeFindMany } from '@/lib/command-network/helpers';

export async function GET(_request: NextRequest) {
  try {
    const [coordination, entities] = await Promise.all([
      getCrossModuleSync(),
      safeFindMany(() => db.globalEntity.findMany({
        where: { status: 'active' },
        select: { id: true, legalName: true, tradeName: true, countryIso: true, entityKind: true, baseCurrency: true },
        take: 50,
      })),
    ]);
    return NextResponse.json({ ok: true, coordination, legalEntities: entities });
  } catch (err) {
    console.error('[command/organizations] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load organizations';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
