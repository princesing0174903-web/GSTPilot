// POST /api/reconcile — Run ITC reconciliation (Books vs GSTR-2B).
// GET  /api/reconcile?gstin=XXX — Get stored mismatches.

import { NextResponse } from 'next/server';
import { reconcileGstr2b, getStoredMismatches, resolveMismatch } from '@/lib/gstn/reconcile';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gstin = (searchParams.get('gstin') ?? '').toUpperCase().trim();
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  try {
    const mismatches = await getStoredMismatches(gstin);
    const totalMissing = mismatches.filter(m => m.reason === 'missing_invoice').reduce((s, m) => s + m.amount, 0);
    const totalMismatch = mismatches.filter(m => m.reason === 'value_difference').reduce((s, m) => s + m.amount, 0);
    return NextResponse.json({
      gstin,
      mismatchCount: mismatches.length,
      missingITC: totalMissing,
      mismatchValue: totalMismatch,
      openCount: mismatches.filter(m => m.status === 'open').length,
      mismatches,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch mismatches', detail: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { gstin?: string; period?: string; action?: 'reconcile' | 'resolve'; mismatchId?: string; resolution?: 'resolved' | 'ignored' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const gstin = (body.gstin ?? '').toUpperCase().trim();
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });

  try {
    if (body.action === 'resolve' && body.mismatchId) {
      const updated = await resolveMismatch(body.mismatchId, body.resolution ?? 'resolved');
      return NextResponse.json({ ok: true, mismatch: updated, message: `Mismatch ${body.mismatchId} marked as ${body.resolution}.` }, { status: 200 });
    }
    const period = body.period ?? new Date().toISOString().slice(0, 7);
    const result = await reconcileGstr2b(gstin, period);
    return NextResponse.json({
      ok: true,
      result,
      message: `I've reconciled your GSTR-2B for ${period}. ${result.matched} matched, ${result.mismatched} mismatched, ${result.unmatched} unmatched. Missing ITC: ₹${result.missingITC.toLocaleString('en-IN')}. Risk: ${result.riskLevel}.`,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
