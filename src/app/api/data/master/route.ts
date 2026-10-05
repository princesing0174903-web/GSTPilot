// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/master?entityType=<MasterEntityType>&duplicates=true
// Master Data Management™ — returns golden records + summary, OR duplicate
// clusters when duplicates=true. All data is REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getMasterData,
  getMasterDataSummary,
  detectDuplicates,
} from '@/lib/data-intelligence';
import type { MasterEntityType } from '@/lib/data-intelligence/types';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const duplicates = params.get('duplicates') === 'true';
    const entityTypeParam = params.get('entityType');
    const entityType = (entityTypeParam || undefined) as
      | MasterEntityType
      | undefined;

    if (duplicates) {
      const duplicatesResult = await detectDuplicates();
      return NextResponse.json({ ok: true, duplicates: duplicatesResult });
    }

    const [records, summary] = await Promise.all([
      getMasterData(entityType),
      getMasterDataSummary(),
    ]);

    return NextResponse.json({ ok: true, records, summary });
  } catch (err) {
    console.error('[/api/data/master] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load master data',
        records: [],
        summary: null,
        duplicates: [],
      },
      { status: 500 },
    );
  }
}
