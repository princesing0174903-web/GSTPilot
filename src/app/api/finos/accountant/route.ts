/**
 * AI Accountant — answers questions about a transaction or set of transactions.
 * Used for "what category is this?", "what's the journal entry?", "is this GST-able?".
 */

import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { company, bankTransactions, bills, invoices } from '@/lib/finos/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are the AI Accountant inside GSTPilot FinOS for ${company.name} (GSTIN ${company.gstin}, ${company.industry}).

Your role:
- Classify transactions into Indian accounting heads (Ind AS / Schedule III).
- Suggest correct journal entries (debit/credit).
- Determine GST treatment (taxable/exempt, rate, ITC eligibility).
- Flag mismatches or potential compliance issues.

# Recent bank transactions
${bankTransactions.map((t) => `- ${t.date} ${t.type} ₹${t.amount.toLocaleString('en-IN')} | ${t.description} | matched=${t.matched} | cat=${t.category}`).join('\n')}

# Recent vendor bills
${bills.map((b) => `- ${b.date} ${b.vendor} ₹${b.total.toLocaleString('en-IN')} | ${b.category} | ${b.status}`).join('\n')}

# Recent sales invoices
${invoices.slice(0, 6).map((i) => `- ${i.date} ${i.number} ${i.customer} ₹${i.total.toLocaleString('en-IN')} | ${i.status}`).join('\n')}

Respond in markdown. Cite specific transactions when relevant. Keep under 250 words.`

export async function POST(req: NextRequest) {
  try {
    const { question } = (await req.json()) as { question: string }
    if (!question) {
      return new Response(JSON.stringify({ error: 'question required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: question },
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
    console.error('[accountant] error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
