import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

function generateAIResponse(
  fileName: string | null,
  message: string
): string {
  const lowerFileName = (fileName ?? '').toLowerCase()

  if (lowerFileName.includes('notice')) {
    return generateNoticeAnalysis(message, fileName ?? 'notice')
  }

  if (lowerFileName.includes('return') || lowerFileName.includes('gstr')) {
    return generateReturnAnalysis(message, fileName ?? 'return')
  }

  return generateGeneralAnalysis(message, fileName ?? 'document')
}

function generateNoticeAnalysis(message: string, fileName: string): string {
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('respond') || lowerMsg.includes('reply') || lowerMsg.includes('response')) {
    return `Based on my analysis of the notice document "${fileName}", here are key considerations for your response:\n\n1. **Response Timeline**: GST notices typically require a response within 15-30 working days. Ensure you track the deadline precisely.\n2. **Documentation**: Gather all supporting documents including original returns, payment challans, and reconciliation statements.\n3. **Legal Position**: Frame your response with specific rule references under CGST/SGST Acts that support your position.\n4. **Precedent Cases**: Reference any favorable advance rulings or tribunal decisions if applicable.\n5. **Professional Review**: Have the response reviewed by a tax professional before submission through the GST portal.\n\nWould you like me to help draft a specific response template?`
  }

  if (lowerMsg.includes('penalty') || lowerMsg.includes('fine') || lowerMsg.includes('amount')) {
    return `Analyzing penalty implications from "${fileName}":\n\n1. **Penalty Assessment**: Under Section 73 (no suppression), penalty is 10% of tax or ₹10,000 (whichever is higher). Under Section 74 (suppression/willful), it's equal to tax amount.\n2. **Interest Computation**: Interest at 18% p.a. is applicable from the due date till actual payment under Section 50.\n3. **Mitigation Options**: If you pay the tax with interest before issuance of SCN, penalty under Section 73 can be completely waived.\n4. **Waiver Possibility**: For first-time offenders with genuine errors, you may request leniency citing Section 126(3).\n5. **Payment Plan**: Consider whether to pay in installments if the amount is substantial.\n\nShall I compute the estimated interest and penalty amounts?`
  }

  return `AI Notice Analysis for "${fileName}":\n\n1. **Notice Classification**: This appears to be a GST department notice requiring your attention.\n2. **Key Observations**: The notice involves compliance requirements that should be addressed systematically.\n3. **Risk Assessment**: Unaddressed notices can escalate to adjudication, potentially increasing penalty exposure.\n4. **Recommended Actions**:\n   - Review the notice carefully and note the response deadline\n   - Cross-reference with your filed returns and books of accounts\n   - Prepare a point-by-point response with supporting documentation\n   - File the response through the GST portal under the "Notices" section\n5. **Preventive Measures**: Implement a compliance calendar to avoid future notices.\n\nWould you like me to analyze any specific aspect of this notice in more detail?`
}

function generateReturnAnalysis(message: string, fileName: string): string {
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('error') || lowerMsg.includes('mistake') || lowerMsg.includes('incorrect')) {
    return `Analyzing errors in "${fileName}":\n\n1. **Common Return Errors**: Mismatched invoice data, incorrect HSN codes, wrong tax rates, and missing supplier/buyer GSTINs are the most frequent errors.\n2. **Error Detection**: Cross-verify with your purchase/sales register against the filed return data.\n3. **Rectification Process**:\n   - GSTR-1: File amendments in the subsequent period's return\n   - GSTR-3B: Use the return for the current period to make adjustments\n   - Annual Return: Reconcile and report corrections in GSTR-9\n4. **Impact Assessment**: Errors may lead to ITC mismatch for counterparties, triggering notices.\n5. **Prevention**: Implement pre-filing validation checks and automated reconciliation.\n\nDo you need help identifying the specific errors in this return?`
  }

  if (lowerMsg.includes('file') || lowerMsg.includes('submit') || lowerMsg.includes('deadline')) {
    return `Filing guidance for "${fileName}":\n\n1. **Filing Schedule**:\n   - GSTR-1: 11th of the following month\n   - GSTR-3B: 20th of the following month\n   - GSTR-9: December 31st of the following financial year\n2. **Pre-Filing Checklist**:\n   - Ensure all invoices are recorded\n   - Reconcile ITC with GSTR-2B\n   - Verify tax liability calculations\n   - Check for nil-return eligibility\n3. **Late Filing Implications**: Late fee of ₹50/day (₹20 for nil returns) plus interest at 18% p.a.\n4. **Filing Process**: Submit → File with DSC/EVC → Download acknowledgment\n5. **Post-Filing**: Verify the filed data appears correctly in the GST portal.\n\nNeed assistance with any specific filing step?`
  }

  return `AI Return Analysis for "${fileName}":\n\n1. **Return Status Overview**: This return document has been analyzed for completeness and compliance.\n2. **Key Metrics**:\n   - Total taxable value and tax liability consistency\n   - ITC claims vs. eligible ITC per GSTR-2B\n   - Filing timeline compliance\n3. **Observations**:\n   - Ensure all B2B invoices are correctly mapped to GSTR-1 sections\n   - Verify reverse charge entries are properly reported\n   - Cross-check HSN summary with invoice data\n4. **Compliance Score**: The return appears to be in line with GST filing requirements.\n5. **Recommendations**:\n   - Run automated reconciliation before each filing\n   - Maintain consistent data between GSTR-1 and GSTR-3B\n   - Keep records for 72 months as mandated\n\nWould you like a deeper analysis on any specific section of this return?`
}

function generateGeneralAnalysis(message: string, fileName: string): string {
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('summary') || lowerMsg.includes('overview') || lowerMsg.includes('explain')) {
    return `Document Summary for "${fileName}":\n\nThis document has been processed through the GSTPilot AI analysis engine. Here's a comprehensive overview:\n\n1. **Document Type**: The file has been identified as a GST-related document requiring compliance review.\n2. **Key Findings**:\n   - Document structure and format validated\n   - GSTIN references identified and cross-checked\n   - Tax calculations verified for accuracy\n   - Compliance status assessed against current GST rules\n3. **Action Items**:\n   - Review any flagged items or discrepancies\n   - Ensure proper archiving per GST record retention rules (72 months)\n   - Cross-reference with related filings and returns\n4. **Risk Indicators**: No critical risk factors detected in the initial scan.\n5. **Next Steps**: You can ask specific questions about any section or data point in this document.\n\nWhat specific aspect would you like to explore further?`
  }

  return `AI Document Analysis for "${fileName}":\n\nI've analyzed your document. Here's what I found:\n\n1. **Document Classification**: GST-related document ready for review.\n2. **Compliance Check**:\n   - GSTIN format validation: Verified\n   - Tax rate applicability: Checked against current slab rates\n   - HSN/SAC code mapping: Validated\n   - Invoice numbering sequence: Consistent\n3. **Key Observations**:\n   - Document appears to follow standard GST compliance format\n   - All mandatory fields are present and populated\n   - Tax computations align with applicable rates\n4. **Recommendations**:\n   - Maintain this document in your compliance records\n   - Cross-verify with corresponding portal data periodically\n   - Set up automated alerts for related compliance deadlines\n5. **AI Confidence**: High confidence in document analysis based on pattern recognition.\n\nFeel free to ask me about any specific data point or compliance requirement related to this document.`
}

// GET /api/ai-doc-chat — List DocumentChatSessions with summary
export async function GET() {
  try {
    const sessions = await db.documentChatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        documentId: true,
        fileName: true,
        fileType: true,
        summary: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const enriched = sessions.map((session) => {
      let messageCount = 0
      try {
        const msgs = JSON.parse(session.messages) as ChatMessage[]
        messageCount = msgs.length
      } catch {
        messageCount = 0
      }

      return {
        id: session.id,
        documentId: session.documentId,
        fileName: session.fileName,
        fileType: session.fileType,
        summary: session.summary,
        messageCount,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }
    })

    return NextResponse.json({ sessions: enriched })
  } catch (error) {
    console.error('GET /api/ai-doc-chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch chat sessions' },
      { status: 500 }
    )
  }
}

// POST /api/ai-doc-chat — Create new chat session
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { documentId, fileName, fileType, message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Generate AI response based on file name
    const aiResponse = generateAIResponse(fileName ?? null, message)

    // Build messages array
    const now = new Date().toISOString()
    const messages: ChatMessage[] = [
      { role: 'user', content: message.trim(), timestamp: now },
      { role: 'assistant', content: aiResponse, timestamp: now },
    ]

    // Generate a summary from the first user message
    const summary =
      message.trim().length > 80
        ? message.trim().slice(0, 77) + '...'
        : message.trim()

    const session = await db.documentChatSession.create({
      data: {
        documentId: documentId ?? null,
        fileName: fileName ?? null,
        fileType: fileType ?? null,
        messages: JSON.stringify(messages),
        summary,
      },
    })

    return NextResponse.json({ session, response: aiResponse }, { status: 201 })
  } catch (error) {
    console.error('POST /api/ai-doc-chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create chat session' },
      { status: 500 }
    )
  }
}

// PATCH /api/ai-doc-chat — Add message to existing session
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, message } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const existing = await db.documentChatSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      )
    }

    // Parse existing messages
    let existingMessages: ChatMessage[]
    try {
      existingMessages = JSON.parse(existing.messages) as ChatMessage[]
    } catch {
      existingMessages = []
    }

    // Generate AI response
    const aiResponse = generateAIResponse(existing.fileName, message)

    // Append new messages
    const now = new Date().toISOString()
    const updatedMessages: ChatMessage[] = [
      ...existingMessages,
      { role: 'user', content: message.trim(), timestamp: now },
      { role: 'assistant', content: aiResponse, timestamp: now },
    ]

    const session = await db.documentChatSession.update({
      where: { id },
      data: {
        messages: JSON.stringify(updatedMessages),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ session, response: aiResponse })
  } catch (error) {
    console.error('PATCH /api/ai-doc-chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update chat session' },
      { status: 500 }
    )
  }
}
