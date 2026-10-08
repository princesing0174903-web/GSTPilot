/**
 * AI Accountant — answers questions about a transaction or set of transactions.
 * Used for "what category is this?", "what's the journal entry?", "is this GST-able?".
 *
 * Context is sourced from the real Business Snapshot service
 * (@/lib/business/snapshot) — never fabricated. If the org has no data,
 * the route returns an honest "no data yet" response.
 *
 * Request body:
 *   {
 *     question: string,
 *     organizationId?: string  // optional tenant scope
 *   }
 *
 * Response (200, data available):
 *   { ok: true, content: string, hasLiveData: true }
 *
 * Response (200, no data):
 *   { ok: false, message: "...", data: null }
 */

import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function snapshotHasLiveData(s: BusinessSnapshot): boolean {
  return (
    s.revenue > 0 ||
    s.expenses > 0 ||
    s.cash > 0 ||
    s.invoiceCount > 0 ||
    s.billCount > 0 ||
    s.expenseRecordCount > 0 ||
    s.customerCount > 0 ||
    s.vendorCount > 0 ||
    s.receivables > 0 ||
    s.payables > 0 ||
    s.outputTax > 0 ||
    s.inputTax > 0
  )
}

function buildContextBlock(s: BusinessSnapshot): string {
  return `# Live business data (from the database)
- Organization: ${s.organizationId}
- Snapshot generated: ${s.generatedAt}

# Aggregate financials (this financial year)
- Revenue (invoiced sales): ₹${s.revenue.toLocaleString('en-IN')} across ${s.invoiceCount} invoices
- Purchases + operating expenses: ₹${s.expenses.toLocaleString('en-IN')} across ${s.billCount} bills + ${s.expenseRecordCount} expense records
- Receivables (unpaid invoice balance): ₹${s.receivables.toLocaleString('en-IN')}
- Payables (unpaid bill balance): ₹${s.payables.toLocaleString('en-IN')}
- GST collected (output tax): ₹${s.outputTax.toLocaleString('en-IN')}
- ITC available (input tax): ₹${s.inputTax.toLocaleString('en-IN')}
- GST liability (net payable): ₹${s.gstLiability.toLocaleString('en-IN')}
- Customers: ${s.customerCount} | Vendors: ${s.vendorCount}

NOTE: Per-transaction line items (individual invoices, bills, bank transactions)
are NOT included in this lightweight context. If the user asks about a specific
transaction, ask them to paste the transaction details (date, amount, party,
description) and classify it using the GST treatment rules below.

Indian accounting references:
- Ind AS / Schedule III heads for classification.
- GST taxable vs exempt: GST Act Schedules I–III.
- ITC eligibility: Section 16 of CGST Act, 2017.
- Use ₹, Lakhs, Crores formatting.`
}

const BASE_INSTRUCTIONS = `You are the AI Accountant inside VEYRO FinOS.

Your role:
- Classify transactions into Indian accounting heads (Ind AS / Schedule III).
- Suggest correct journal entries (debit/credit).
- Determine GST treatment (taxable/exempt, rate, ITC eligibility).
- Flag mismatches or potential compliance issues.

Respond in markdown. Cite specific transactions when relevant. Keep under 250 words.
Never invent data — if you don't have a specific transaction, ask the user for it.`

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      question?: string
      organizationId?: string
    }

    const { question, organizationId: bodyOrgId } = body

    if (!question) {
      return new Response(JSON.stringify({ error: 'question required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const organizationId =
      bodyOrgId ||
      url.searchParams.get('organizationId') ||
      url.searchParams.get('firmId') ||
      req.headers.get('x-gstpilot-orgid') ||
      ''

    if (!organizationId) {
      return new Response(
        JSON.stringify({
          ok: false,
          message:
            'No business data available yet. Connect Google or Zoho Books, or create your first invoice, to activate AI insights.',
          data: null,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    const snapshot = await getBusinessSnapshot(organizationId)

    if (!snapshotHasLiveData(snapshot)) {
      return new Response(
        JSON.stringify({
          ok: false,
          message:
            'No business data available yet. Connect Google or Zoho Books, or create your first invoice, to activate AI insights.',
          data: null,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    const systemPrompt = `${BASE_INSTRUCTIONS}

${buildContextBlock(snapshot)}`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: question },
      ],
      thinking: { type: 'disabled' },
    })

    const content = completion.choices?.[0]?.message?.content ?? ''
    return new Response(
      JSON.stringify({ ok: true, content, hasLiveData: true }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[accountant] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
