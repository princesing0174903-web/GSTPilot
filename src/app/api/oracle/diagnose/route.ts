// POST /api/oracle/diagnose — Run a multi-step diagnostic chain
// Body: { query?: string, chainId?: ChainId }
// If query is provided, auto-detects the chain. If chainId is provided, runs that chain.
import { NextRequest, NextResponse } from 'next/server';
import { runDiagnosticChain, detectChain, DIAGNOSTIC_CHAINS, type ChainId } from '@/lib/oracle-evolution/diagnostic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // List available chains
  const chains = Object.entries(DIAGNOSTIC_CHAINS).map(([id, c]) => ({
    id: id as ChainId,
    name: c.name,
    trigger: c.trigger,
    stepCount: c.steps.length,
    leadAgent: c.leadAgent,
  }));
  return NextResponse.json({ chains, total: chains.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query as string | undefined;
    const explicitChainId = body.chainId as ChainId | undefined;

    let chainId: ChainId | null = explicitChainId ?? null;
    if (!chainId && query) {
      chainId = detectChain(query);
    }

    if (!chainId) {
      return NextResponse.json({
        error: 'Could not determine diagnostic chain. Provide chainId or a query that matches a known pattern.',
        availableChains: Object.keys(DIAGNOSTIC_CHAINS),
      }, { status: 400 });
    }

    const result = await runDiagnosticChain(chainId, query);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
