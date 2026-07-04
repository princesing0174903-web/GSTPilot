import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { buildBusinessGraph, buildGraphSummary, formatINR } from '@/lib/business-graph'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/business-graph/ai — AI Explain + natural-language graph Q&A (Phase 3)
//
//   POST { mode: 'explain' }
//     → AI explains the whole graph: what happened, why, what to do next.
//
//   POST { mode: 'ask', question: 'Why did collections drop?' }
//     → AI answers a question using the graph as context.
//
//   POST { mode: 'node', nodeId: '...' }
//     → AI generates a deeper insight for a specific node.
//
// Uses z-ai-web-dev-sdk. Reads ONLY real DB data via buildBusinessGraph().
// ═══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AIBody {
  mode?: 'explain' | 'ask' | 'node'
  question?: string
  nodeId?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIBody
    const mode = body.mode ?? 'explain'

    // ── Build the real graph once ──
    const graph = await buildBusinessGraph()

    if (!graph.hasData) {
      return NextResponse.json({
        answer:
          'Your Business Graph has no data yet. Connect GSTN, your bank, and import clients to activate the graph. Once connected, every client, invoice, payment, GST return, employee, task, document, notice, email and WhatsApp message will become a connected node — and I will be able to explain the relationships, risks, and dependencies across your entire business.',
      })
    }

    const summary = buildGraphSummary(graph)
    const zai = await ZAI.create()

    let systemPrompt = ''
    let userPrompt = ''

    if (mode === 'explain') {
      systemPrompt = `You are the GSTPilot Oracle™ Business Graph™ analyst — a fusion of Palantir-grade graph reasoning and a senior CFO/CA. You are given a live snapshot of a company's business graph (clients, invoices, payments, GST returns, employees, tasks, documents, bank accounts, notices, emails, WhatsApp messages and the relationships between them).

Your job: explain the business graph to the founder in plain, confident language. Answer three questions:
1. WHAT happened? — the current state of the business in one paragraph.
2. WHY does it matter? — the relationships and dependencies that create risk or opportunity.
3. WHAT should I do next? — 3-5 concrete prioritised actions.

Rules:
- Use ONLY the real data in the snapshot. Never invent numbers, client names, or relationships.
- Be specific: cite real client names, real amounts (₹ with Indian comma grouping), real overdue days.
- Reference the Business Health Engine metrics (Collection Risk, Compliance Risk, Customer Concentration, Revenue Dependency, Employee Dependency, Cash Flow Risk) with their scores.
- Explain relationships: e.g. "Client X's overdue invoice affects cash flow, which affects your ability to pay GST liability, which raises compliance risk."
- Keep it under 350 words. No markdown headers. Plain paragraphs + a short numbered action list at the end.
- Currency must use ₹ with Indian comma grouping (e.g. ₹1,23,456).`

      userPrompt = `Here is the live Business Graph snapshot:\n\n${summary}\n\nExplain this graph to me.`
    } else if (mode === 'ask') {
      const question = (body.question ?? '').trim()
      if (!question) {
        return NextResponse.json({ error: 'Question is required for ask mode.' }, { status: 400 })
      }
      systemPrompt = `You are the GSTPilot Oracle™ Business Graph™ analyst. You answer questions about a company's business graph by reasoning over the real relationships between clients, invoices, payments, GST returns, employees, tasks, documents, bank accounts, notices, emails and WhatsApp messages.

Rules:
- Use ONLY the real data in the snapshot. Never invent numbers, client names, or relationships.
- Be specific: cite real client names, real amounts (₹ with Indian comma grouping), real overdue days, real relationship counts.
- When asked "why did X happen", trace the causal chain across nodes (e.g. overdue invoices → lower collections → cash flow risk → GST liability risk).
- When asked "which clients are risky/connected/overdue", list the real clients from the snapshot with their risk scores and relationship counts.
- When asked about dependencies, explain how nodes connect (Client → Invoice → Payment → Cash Flow → GST → Compliance).
- Keep it under 300 words. Plain paragraphs + a short list where helpful.
- Currency must use ₹ with Indian comma grouping (e.g. ₹1,23,456). If the answer cannot be derived from the snapshot, say so honestly and suggest what data to connect.`

      userPrompt = `Here is the live Business Graph snapshot:\n\n${summary}\n\nQuestion: ${question}`
    } else {
      // mode === 'node'
      const node = graph.nodes.find((n) => n.id === body.nodeId)
      if (!node) {
        return NextResponse.json({ error: 'Node not found.' }, { status: 404 })
      }
      // Find this node's connections
      const connected = graph.edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => {
          const otherId = e.source === node.id ? e.target : e.source
          const other = graph.nodes.find((n) => n.id === otherId)
          return other ? `${e.type} → ${other.type}: "${other.label}"` : e.type
        })
      systemPrompt = `You are the GSTPilot Oracle™ Business Graph™ analyst. The user has clicked on a single node in their business graph. Generate a deep, specific insight for THIS node based on its real data and its real connections to other nodes.

Rules:
- Use ONLY the real data provided for this node and its connections. Never invent.
- Be specific: cite real amounts, dates, statuses, overdue days, relationship counts.
- Explain what this node means for the business, what risk or opportunity it represents, and what to do next.
- Keep it under 180 words. Plain paragraph + a short "Recommended actions" list.
- Currency must use ₹ with Indian comma grouping (e.g. ₹1,23,456).`

      userPrompt = `NODE:\n${JSON.stringify({ type: node.type, label: node.label, sublabel: node.sublabel, risk: node.risk, detail: node.detail }, null, 2)}\n\nCONNECTIONS (${connected.length}):\n${connected.slice(0, 20).join('\n')}${connected.length > 20 ? `\n...and ${connected.length - 20} more` : ''}\n\nGenerate a deep insight for this node.`
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const answer = completion?.choices?.[0]?.message?.content?.trim() || ''

    if (!answer) {
      return NextResponse.json({
        answer:
          graph.hasData
            ? `Your business graph contains ${graph.nodes.length} connected nodes across ${graph.stats.totalClients} clients, ${graph.stats.totalInvoices} invoices and ${graph.stats.totalPayments} payments. Total revenue: ${formatINR(graph.stats.totalRevenue)} with ${formatINR(graph.stats.totalOutstanding)} outstanding. I could not generate a detailed analysis right now — please try again.`
            : 'Connect your data sources to activate the Business Graph.',
      })
    }

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[/api/business-graph/ai] POST failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI analysis.' },
      { status: 500 },
    )
  }
}
