import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let question = ''
  try {
    const body = await req.json()
    question = body.question || ''
    const context = body.context || ''

    // Use z-ai-web-dev-sdk for LLM
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const systemPrompt = `You are VEYRO AI Business Copilot — an expert financial advisor for Indian CA firms and businesses.
Answer questions about GST, compliance, invoices, payments, cash flow, and business operations.
Use the provided live data context to give accurate, data-driven answers.
Always use Indian number formatting (₹1,23,456) and DD/MM/YYYY dates.
Be concise but thorough. Provide actionable insights.
When analyzing data, reference specific numbers from the context.
If you detect risks or opportunities, highlight them clearly.
If the provided context is empty or lacks the data needed to answer the question, say so honestly — do NOT fabricate numbers or client names.
Format your responses with clear sections using bullet points and line breaks for readability.`

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Live Business Data Context:\n${context}\n\nQuestion: ${question}` }
      ],
    })

    const answer = response.choices[0]?.message?.content || 'Unable to generate response.'
    return NextResponse.json({ answer })
  } catch (error: any) {
    console.error('[Business Copilot] Error:', error?.message || error)
    // No fabricated fallback — return an honest empty-state response so the UI
    // can render a proper message instead of fake numbers and client names.
    return NextResponse.json({
      answer:
        'I\u2019m unable to reach the AI service right now. Please try again in a moment. Once live data is available, I can provide specific insights based on your invoices, returns, and payments.',
    })
  }
}
