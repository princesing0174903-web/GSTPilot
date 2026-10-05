/**
 * AI CFO — generates a strategic financial briefing or scenario analysis
 * on demand. The frontend calls this with a `topic` (e.g. "Q2 forecast",
 * "working capital optimization", "GST liability for August") and gets back
 * a structured LLM analysis tailored to the company's actual KPIs.
 *
 * Context is sourced from the real Business Snapshot service
 * (@/lib/business/snapshot) — never fabricated. If the org has no data,
 * the route returns an honest "no data yet" response.
 *
 * Request body:
 *   {
 *     topic: string,
 *     followUp?: string,
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
    s.receivables > 0 ||
    s.payables > 0 ||
    s.outputTax > 0 ||
    s.inputTax > 0 ||
    s.filedReturns > 0 ||
    s.pendingReturns > 0
  )
}

function buildContextBlock(s: BusinessSnapshot): string {
  const inrL = (n: number) => `₹${(n / 100000).toFixed(2)}L`
  const trend = s.forecast.trend
  const trendLabel = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return `# Company snapshot (real data from database)
- Organization: ${s.organizationId}
- Generated at: ${s.generatedAt}

# Headline financials (this financial year)
- Revenue: ${inrL(s.revenue)} (from ${s.invoiceCount} invoices)
- Expenses: ${inrL(s.expenses)} (purchases + opex)
- Profit: ${inrL(s.profit)} | Margin: ${(s.profitMargin * 100).toFixed(1)}%
- Cash position: ${inrL(s.cash)}
- Working capital: ${inrL(s.workingCapital)}
- Runway: ${s.runwayDays === Infinity ? 'unlimited (no burn)' : s.runwayDays + ' days'}

# Receivables & payables
- Outstanding receivables: ${inrL(s.receivables)}
- Outstanding payables: ${inrL(s.payables)}
- Collection rate: ${(s.collectionRate * 100).toFixed(1)}%

# GST
- Output tax (GST collected): ${inrL(s.outputTax)}
- Input tax (ITC available): ${inrL(s.inputTax)}
- Net GST liability: ${inrL(s.gstLiability)}
- Filed returns: ${s.filedReturns} | Pending: ${s.pendingReturns} | Overdue: ${s.overdueReturns}

# Forecast (next month)
- Projected revenue: ${inrL(s.forecast.nextMonthRevenue)} ${trendLabel}
- Projected expenses: ${inrL(s.forecast.nextMonthExpenses)}
- Confidence: ${(s.forecast.confidence * 100).toFixed(0)}%

# Health
- Health score: ${s.healthScore}/100
- Risk score: ${s.riskScore}/100

# Data sources
- Last sync: ${s.lastSyncStatus}${s.lastSyncAt ? ' at ' + new Date(s.lastSyncAt).toLocaleString('en-IN') : ''}
- Zoho Books synced entities: ${s.perEntity.zohoCustomers} customers, ${s.perEntity.zohoVendors} vendors, ${s.perEntity.zohoInvoices} invoices, ${s.perEntity.zohoBills} bills, ${s.perEntity.zohoBankAccounts} bank accounts.`
}

const BASE_INSTRUCTIONS = `You are the AI CFO inside GSTPilot FinOS. You produce sharp, decision-grade financial analyses for the CEO/CFO.

Use ONLY the data provided below. If data is missing, say so — do NOT fabricate.

Output format (markdown):
1. **Headline insight** (1 sentence)
2. **Analysis** (3-4 bullet points with specific numbers from the context)
3. **Recommendation** (2-3 numbered actions with owner + ETA)
4. **Risk watch** (1-2 specific risks to monitor)
5. **Expected impact** (1 sentence — quantified where possible)

Keep under 350 words. Use Indian formatting (₹, Lakhs, Crores).`

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      topic?: string
      followUp?: string
      organizationId?: string
    }

    const { topic, followUp, organizationId: bodyOrgId } = body

    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic required' }), {
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

    const userPrompt = followUp
      ? `Topic: ${topic}\n\nFollow-up question: ${followUp}`
      : `Topic: ${topic}`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
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
    console.error('[cfo-insights] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
