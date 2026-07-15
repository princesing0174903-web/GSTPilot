/**
 * Oracle AI — chat endpoint.
 *
 * Returns an LLM response with full FinOS business context (company profile,
 * KPIs, recent transactions, compliance status) injected as the system prompt.
 */

import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { company, executiveKpis, aiInsights, gstReturns, complianceItems } from '@/lib/finos/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Oracle AI — the chief financial advisor embedded inside GSTPilot FinOS, the AI Financial Operating System for Indian businesses. You are speaking with the CEO/CFO of ${company.name}.

# Company profile
- Legal name: ${company.legalName}
- GSTIN: ${company.gstin} | PAN: ${company.pan}
- Industry: ${company.industry}
- Employees: ${company.employees}
- Annual revenue: ₹${(company.annualRevenue / 10000000).toFixed(2)} Cr
- Financial year: ${company.financialYear}

# Current KPIs
${executiveKpis.map((k) => `- ${k.label}: ${k.value} (${k.changePct >= 0 ? '+' : ''}${k.changePct}% MoM). ${k.insight}`).join('\n')}

# Active AI insights
${aiInsights.map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.summary} → ${i.recommendation}`).join('\n')}

# GST returns status
${gstReturns.map((r) => `- ${r.type} ${r.period} — ${r.status} — net payable ₹${r.netPayable.toLocaleString('en-IN')} — due ${r.dueDate}`).join('\n')}

# Compliance calendar
${complianceItems.map((c) => `- ${c.title} (${c.category}) — ${c.status} — due ${c.dueDate}`).join('\n')}

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
    const { messages } = (await req.json()) as {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages[] required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        ...messages,
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
    console.error('[oracle] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
