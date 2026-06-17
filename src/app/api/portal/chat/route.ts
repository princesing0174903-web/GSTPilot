// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Client Portal AI Chat Assistant
// Uses z-ai-web-dev-sdk LLM to answer client questions about GST filings
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `You are the AI assistant for GSTPilot's Client Portal. You help clients of a Chartered Accountancy firm understand their GST compliance, returns, invoices, and documents.

You can:
- Explain GST return statuses and what they mean
- Help clients understand their compliance score
- Answer questions about invoice details and tax amounts
- Explain what documents are needed for filing
- Guide clients through the approval process
- Explain GST notice details
- Help with payment-related queries

Keep responses concise and professional. Use Indian number formatting (₹1,23,456). If you don't know something specific, suggest the client contact their CA.

Always be helpful, professional, and clear. Avoid jargon where possible.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, clientContext, history } = body as {
      message: string;
      clientContext?: Record<string, unknown>;
      history?: Array<{ role: string; content: string }>;
    };

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const messages = [
      { role: 'assistant' as const, content: SYSTEM_PROMPT },
    ];

    // Add context about the client if provided
    if (clientContext) {
      messages.push({
        role: 'assistant' as const,
        content: `Client context: ${JSON.stringify(clientContext)}`,
      });
    }

    // Add conversation history
    if (history && history.length > 0) {
      for (const msg of history.slice(-6)) {
        messages.push({
          role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user' as const, content: message });

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, I could not process your request. Please try again.';

    return NextResponse.json({
      success: true,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Portal Chat API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
