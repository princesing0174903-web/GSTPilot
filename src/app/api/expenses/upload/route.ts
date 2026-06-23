import { NextRequest, NextResponse } from 'next/server'

// POST /api/expenses/upload — Simulate receipt OCR.
// Accepts FormData (with a file) or JSON `{ fileName }`.
// Returns a deterministic mock extraction — real OCR intentionally stubbed.
export async function POST(request: NextRequest) {
  try {
    let fileName = 'receipt.jpg'

    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      fileName = (file instanceof File && file.name) || fileName
    } else {
      try {
        const body = await request.json()
        fileName = body?.fileName ?? fileName
      } catch {
        // Non-JSON body — proceed with default
      }
    }

    const amount = 2400
    const gst = Math.round(amount * 0.18 * 100) / 100

    const extracted = {
      fileName,
      vendor: 'Swiggy',
      amount,
      gst,
      date: new Date().toISOString().split('T')[0],
      category: 'Miscellaneous',
      paymentMode: 'upi',
      confidence: 0.91,
    }

    return NextResponse.json({ extracted }, { status: 200 })
  } catch (error) {
    console.error('POST /api/expenses/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract receipt' },
      { status: 500 }
    )
  }
}
