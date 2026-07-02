// GET /api/network/organizations
// Lists all organisations (nodes) in the world business graph. Supports search,
// verified filter, nodeType filter, and limit.

import { NextResponse } from 'next/server';
import { listNodes } from '@/lib/network/organizations';
import type { NodeType } from '@/lib/network/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_NODE_TYPES: ReadonlySet<string> = new Set([
  'organization',
  'customer',
  'vendor',
  'supplier',
  'partner',
  'government',
  'bank',
  'investor',
  'accountant',
  'auditor',
  'logistics',
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const verified = url.searchParams.get('verified'); // 'true' | 'false'
    const nodeTypeParam = url.searchParams.get('nodeType') ?? undefined;

    const limit = limitParam ? Number(limitParam) || 100 : 100;
    const verifiedOnly = verified === 'true';
    const nodeType: NodeType | undefined =
      nodeTypeParam && VALID_NODE_TYPES.has(nodeTypeParam)
        ? (nodeTypeParam as NodeType)
        : undefined;

    const organizations = await listNodes({
      search,
      limit,
      verifiedOnly,
      nodeType,
    });

    return NextResponse.json(
      { organizations, total: organizations.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' } },
    );
  } catch (error) {
    console.error('[Network organizations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load organizations', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
