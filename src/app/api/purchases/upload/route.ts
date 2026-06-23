import { NextRequest, NextResponse } from 'next/server'

// POST /api/purchases/upload — Simulate OCR extraction from an uploaded bill.
// Accepts either FormData (with a file field) or JSON `{ fileName, vendorName, amount }`.
// Returns a deterministic mock OCR payload — real OCR (z-ai-web-dev-sdk) is
// intentionally left as a stub per Phase 8 Step 3 scope.
export async function POST(request: NextRequest) {
  try {
    let fileName = 'uploaded-bill.pdf'
    let vendorName: string | undefined
    let amount: number | undefined

    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      fileName = (file instanceof File && file.name) || fileName
      vendorName = (formData.get('vendorName') as string) || undefined
      const amt = formData.get('amount')
      amount = amt ? Number(amt) : undefined
    } else {
      try {
        const body = await request.json()
        fileName = body?.fileName ?? fileName
        vendorName = body?.vendorName
        amount = body?.amount !== undefined ? Number(body.amount) : undefined
      } catch {
        // Non-JSON body — proceed with defaults
      }
    }

    // Deterministic mock extraction (confidence ~0.94 for clean PDFs)
    const taxableValue = amount && Number.isFinite(amount) ? amount : 50000
    const gstAmount = Math.round(taxableValue * 0.18 * 100) / 100
    const totalAmount = Math.round((taxableValue + gstAmount) * 100) / 100

    const extracted = {
      fileName,
      vendorName: vendorName ?? 'Reliance Industries Ltd',
      vendorGstin: '27AAACR5055K1Z5',
      invoiceNo: `OCR-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      date: new Date().toISOString().split('T')[0],
      taxableValue,
      gstAmount,
      totalAmount,
      hsnCode: '2710',
      category: 'Raw Material',
      confidence: 0.94,
    }

    return NextResponse.json({ extracted }, { status: 200 })
  } catch (error) {
    console.error('POST /api/purchases/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract purchase bill' },
      { status: 500 }
    )
  }
}
