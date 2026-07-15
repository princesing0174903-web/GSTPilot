/**
 * AI CFO — generates a strategic financial briefing or scenario analysis
 * on demand. The frontend calls this with a `topic` (e.g. "Q2 forecast",
 * "working capital optimization", "GST liability for August") and gets back
 * a structured LLM analysis tailored to the company's actual KPIs.
 */

import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import {
  company,
  executiveKpis,
  revenueTrend,
  cashFlow,
  gstReturns,
  complianceItems,
  aiInsights,
  invoices,
  bills,
  bankAccounts,
} from '@/lib/finos/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTEXT = `# Company
${company.name} | ${company.industry} | GSTIN ${company.gstin}
Annual revenue: ₹${(company.annualRevenue / 10000000).toFixed(2)} Cr | Employees: ${company.employees}

# KPIs (current)
${executiveKpis.map((k) => `- ${k.label}: ${k.value} | ${k.changePct >= 0 ? '+' : ''}${k.changePct}% MoM | ${k.insight}`).join('\n')}

# 12-month revenue trend (₹)
${revenueTrend.map((t) => `- ${t.month}: Rev ₹${(t.revenue / 100000).toFixed(1)}L | Exp ₹${(t.expense / 100000).toFixed(1)}L | Profit ₹${(t.profit / 100000).toFixed(1)}L`).join('\n')}

# 6-month cash flow (₹)
${cashFlow.map((c) => `- ${c.month}: In ₹${(c.inflow / 100000).toFixed(1)}L | Out ₹${(c.outflow / 100000).toFixed(1)}L | Net ₹${(c.net / 100000).toFixed(1)}L`).join('\n')}

# Outstanding receivables
${invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').map((i) => `- ${i.number} ${i.customer} ₹${(i.total / 100000).toFixed(2)}L ${i.status} (due ${i.dueDate})`).join('\n')}

# Outstanding payables
${bills.filter((b) => b.status === 'Pending' || b.status === 'Overdue').map((b) => `- ${b.number} ${b.vendor} ₹${(b.total / 100000).toFixed(2)}L ${b.status} (due ${b.dueDate})`).join('\n')}

# Bank balances
${bankAccounts.map((b) => `- ${b.bank} ${b.type}: ₹${(b.balance / 100000).toFixed(2)}L`).join('\n')}

# GST returns
${gstReturns.map((r) => `- ${r.type} ${r.period}: ${r.status} | Net ₹${(r.netPayable / 100000).toFixed(2)}L | due ${r.dueDate}`).join('\n')}

# Compliance items
${complianceItems.map((c) => `- ${c.title} (${c.category}) ${c.status} ${c.severity} | ${c.description}`).join('\n')}

# Pre-existing AI insights
${aiInsights.map((i) => `- ${i.title}: ${i.summary} | Impact: ${i.impact}`).join('\n')}
`

export async function POST(req: NextRequest) {
  try {
    const { topic, followUp } = (await req.json()) as { topic: string; followUp?: string }

    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const systemPrompt = `You are the AI CFO inside GSTPilot FinOS. You produce sharp, decision-grade financial analyses for the CEO/CFO of ${company.name}.

Use ONLY the data provided below. If data is missing, say so — do NOT fabricate.

Output format (markdown):
1. **Headline insight** (1 sentence)
2. **Analysis** (3-4 bullet points with specific numbers from the context)
3. **Recommendation** (2-3 numbered actions with owner + ETA)
4. **Risk watch** (1-2 specific risks to monitor)
5. **Expected impact** (1 sentence — quantified where possible)

Keep under 350 words. Use Indian formatting (₹, Lakhs, Crores).

${CONTEXT}`

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
    return new Response(JSON.stringify({ ok: true, content }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cfo-insights] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
