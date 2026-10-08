/**
 * VEYRO AI — chat endpoint (FinOS legacy).
 *
 * Returns an LLM response with real business context sourced from the
 * Business Snapshot service (@/lib/business/snapshot). The snapshot is
 * computed from real Prisma rows (Invoices, Bills, Expenses, Payments,
 * Zoho Books synced entities) — never fabricated.
 *
 * NOTE: This is the FinOS-era route kept for backwards compatibility.
 * The richer, current Oracle endpoint lives at /api/oracle/chat.
 *
 * Request body:
 *   {
 *     messages: Array<{ role: 'user'|'assistant'|'system'; content: string }>,
 *     organizationId?: string  // optional tenant scope (else from ?organizationId= or x-gstpilot-orgid header)
 *   }
 *
 * Response (200):
 *   { ok: true, content: string, hasLiveData: boolean }
 *
 * Response (200, no business data):
 *   {
 *     ok: false,
 *     message: "No business data available yet. Connect Google or Zoho Books, or create your first invoice, to activate AI insights.",
 *     data: null
 *   }
 */

import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Derive whether the snapshot contains any real business activity. */
function snapshotHasLiveData(s: BusinessSnapshot): boolean {
  return (
    s.revenue > 0 ||
    s.expenses > 0 ||
    s.cash > 0 ||
    s.invoiceCount > 0 ||
    s.billCount > 0 ||
    s.expenseRecordCount > 0 ||
    s.customerCount > 0 ||
    s.receivables > 0 ||
    s.payables > 0 ||
    s.outputTax > 0 ||
    s.inputTax > 0 ||
    s.filedReturns > 0 ||
    s.pendingReturns > 0
  )
}

/** Build the system-prompt context block from the real snapshot. */
function buildContextBlock(s: BusinessSnapshot): string {
  return `# Company business snapshot (real data from database)
- Organization ID: ${s.organizationId}
- Generated at: ${s.generatedAt}

# Current KPIs (this financial year)
- Revenue: ₹${s.revenue.toLocaleString('en-IN')}
- Expenses: ₹${s.expenses.toLocaleString('en-IN')}
- Profit: ₹${s.profit.toLocaleString('en-IN')} (margin ${(s.profitMargin * 100).toFixed(1)}%)
- Cash position: ₹${s.cash.toLocaleString('en-IN')}
- Customers: ${s.customerCount} | Vendors: ${s.vendorCount}
- Invoices: ${s.invoiceCount} | Bills: ${s.billCount} | Expense records: ${s.expenseRecordCount}
- Receivables (unpaid): ₹${s.receivables.toLocaleString('en-IN')}
- Payables (unpaid): ₹${s.payables.toLocaleString('en-IN')}
- Working capital: ₹${s.workingCapital.toLocaleString('en-IN')}
- GST collected (output tax): ₹${s.outputTax.toLocaleString('en-IN')}
- ITC available (input tax): ₹${s.inputTax.toLocaleString('en-IN')}
- GST liability (net payable): ₹${s.gstLiability.toLocaleString('en-IN')}
- Health score: ${s.healthScore}/100 | Risk score: ${s.riskScore}/100
- Collection rate: ${(s.collectionRate * 100).toFixed(1)}%
- Runway: ${s.runwayDays === Infinity ? 'unlimited (no burn)' : s.runwayDays + ' days'}
- Filed returns: ${s.filedReturns} | Pending: ${s.pendingReturns} | Overdue: ${s.overdueReturns}
- Forecast: next-month revenue ~₹${s.forecast.nextMonthRevenue.toLocaleString('en-IN')} (${s.forecast.trend})

# Data source status
- Last sync: ${s.lastSyncStatus}${s.lastSyncAt ? ' at ' + new Date(s.lastSyncAt).toLocaleString('en-IN') : ''}
- Zoho synced: ${s.perEntity.zohoCustomers} customers, ${s.perEntity.zohoVendors} vendors, ${s.perEntity.zohoInvoices} invoices, ${s.perEntity.zohoBills} bills, ${s.perEntity.zohoBankAccounts} bank accounts, ${s.perEntity.zohoBankTransactions} bank transactions.

NOTE: These numbers come from the real database. If a value is 0, it means
there is genuinely no data for that metric — do NOT invent a value.`
}

const BASE_INSTRUCTIONS = `You are VEYRO AI — the chief financial advisor embedded inside VEYRO FinOS, the AI Financial Operating System for Indian businesses.

# Your role
- Be concise, decisive, and finance-literate. Speak like a McKinsey-trained CFO who's also a CA.
- Always cite the specific number / invoice / return you're referencing.
- When the user asks "what should I do", give a numbered action list with owner + ETA.
- For tax questions (GST, TDS, Income Tax), cite the relevant section/rule when applicable.
- If a question is outside finance/business (e.g. politics, sports), politely redirect.
- Use Indian formatting (₹, Lakhs, Crores, dd-mmm-yyyy).
- Never invent data — if you don't know, say so and suggest checking the relevant module.
- Keep responses under 250 words unless the user explicitly asks for detail.
- Use markdown: **bold** for key numbers, bullet lists for actions.`

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      organizationId?: string
    }

    const { messages, organizationId: bodyOrgId } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages[] required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Resolve tenant scope: body field > query param > header
    const url = new URL(req.url)
    const organizationId =
      bodyOrgId ||
      url.searchParams.get('organizationId') ||
      url.searchParams.get('firmId') ||
      req.headers.get('x-gstpilot-orgid') ||
      ''

    // No org scope → honest "no data" response (never leak cross-tenant data,
    // never fabricate context)
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
        ...messages,
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
    console.error('[oracle] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
