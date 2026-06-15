import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/upload — UploadedFile CRUD + Processing Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: detect file type from MIME / extension ──────────────────────────
function detectFileType(mimeType: string | null, fileName: string): string {
  if (mimeType) {
    if (mimeType.includes('pdf')) return 'pdf'
    if (mimeType.includes('csv')) return 'csv'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('xls')) return 'excel'
    if (mimeType.includes('json')) return 'json'
    if (mimeType.includes('image')) return 'image'
    if (mimeType.includes('xml')) return 'xml'
    if (mimeType.includes('zip')) return 'zip'
  }
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'pdf',
    csv: 'csv',
    xls: 'excel',
    xlsx: 'excel',
    json: 'json',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    xml: 'xml',
    zip: 'zip',
  }
  return map[ext] ?? 'other'
}

// ─── Helper: determine how many invoices a file type can yield ───────────────
function simulatedInvoiceCount(fileType: string): number {
  const structuredTypes = ['csv', 'excel', 'json']
  if (structuredTypes.includes(fileType)) {
    return Math.floor(Math.random() * 6) // 0–5
  }
  // PDF / image — OCR extraction
  return Math.floor(Math.random() * 3) // 0–2
}

// ─── Background processing pipeline (fire-and-forget) ───────────────────────
function startProcessingPipeline(fileId: string, fileType: string) {
  // Step 1: uploading — progress 0→25 (immediate)
  db.uploadedFile.update({
    where: { id: fileId },
    data: { processingStep: 'uploading', progress: 25 },
  }).catch((err: unknown) => console.error('Pipeline step 1 error:', err))

  // Step 2: extracting — progress 25→50 (after 2s)
  setTimeout(() => {
    db.uploadedFile.update({
      where: { id: fileId },
      data: { processingStep: 'extracting', progress: 50 },
    }).catch((err: unknown) => console.error('Pipeline step 2 error:', err))
  }, 2000)

  // Step 3: validating — progress 50→75 (after 4s)
  setTimeout(() => {
    db.uploadedFile.update({
      where: { id: fileId },
      data: { processingStep: 'validating', progress: 75 },
    }).catch((err: unknown) => console.error('Pipeline step 3 error:', err))
  }, 4000)

  // Step 4: completed / failed — progress 75→100 (after 6s)
  setTimeout(() => {
    const willSucceed = Math.random() > 0.1 // 90% success rate
    const invoiceCount = simulatedInvoiceCount(fileType)

    if (willSucceed) {
      const extractedSample = JSON.stringify({
        source: fileType,
        invoicesFound: invoiceCount,
        extractedAt: new Date().toISOString(),
        summary: `Successfully extracted ${invoiceCount} invoice(s) from ${fileType} file`,
      })

      db.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'completed',
          processingStep: 'completed',
          progress: 100,
          invoicesCreated: invoiceCount,
          extractedData: extractedSample,
        },
      }).catch((err: unknown) => console.error('Pipeline step 4 (success) error:', err))
    } else {
      db.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          processingStep: 'failed',
          progress: 75,
          errorMessage: 'Processing failed: unable to parse file content. Please verify the file format and try again.',
          errorsCount: 1,
        },
      }).catch((err: unknown) => console.error('Pipeline step 4 (failure) error:', err))
    }
  }, 6000)
}

// ─── GET /api/upload — List uploaded files ───────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = {}
    if (clientId) {
      where.clientId = clientId
    }

    const files = await db.uploadedFile.findMany({
      where,
      include: {
        client: {
          select: { id: true, tradeName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('GET /api/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch uploaded files' },
      { status: 500 }
    )
  }
}

// ─── POST /api/upload — Upload a file with processing pipeline ──────────────
export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const period = formData.get('period') as string | null
    const tags = formData.get('tags') as string | null
    const uploadedBy = formData.get('uploadedBy') as string | null

    // Build the original name — either from the File object or a fallback
    const originalName = file?.name ?? (formData.get('originalName') as string | null) ?? 'unknown-file'

    // Detect file metadata
    const mimeType = file?.type ?? null
    const fileSize = file?.size ?? 0
    const fileType = detectFileType(mimeType, originalName)

    // Generate a stored name (simulated — in production this would be a cloud path)
    const storedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = `/uploads/${storedName}`

    // Create the database record
    const uploadedFile = await db.uploadedFile.create({
      data: {
        clientId: clientId ?? null,
        uploadedBy: uploadedBy ?? null,
        originalName,
        storedName,
        fileType,
        fileSize,
        mimeType,
        filePath,
        status: 'uploaded',
        processingStep: 'upload',
        progress: 0,
        period: period ?? null,
        tags: tags ?? null,
      },
      include: {
        client: {
          select: { id: true, tradeName: true },
        },
      },
    })

    // Create audit log for the upload
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        userId: uploadedBy ?? null,
        action: 'File Uploaded',
        entity: 'uploadedFile',
        entityId: uploadedFile.id,
        details: `File "${originalName}" uploaded (${fileType}, ${fileSize} bytes)`,
      },
    })

    // Kick off the background processing pipeline (fire-and-forget)
    startProcessingPipeline(uploadedFile.id, fileType)

    return NextResponse.json({ file: uploadedFile }, { status: 201 })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/upload — Update an uploaded file's status ────────────────────
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      status,
      processingStep,
      progress,
      extractedData,
      errorMessage,
      invoicesCreated,
      errorsCount,
      warningsCount,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.uploadedFile.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Uploaded file not found' },
        { status: 404 }
      )
    }

    // Build update data — only include fields that were provided
    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (processingStep !== undefined) data.processingStep = processingStep
    if (progress !== undefined) data.progress = progress
    if (extractedData !== undefined) data.extractedData = extractedData
    if (errorMessage !== undefined) data.errorMessage = errorMessage
    if (invoicesCreated !== undefined) data.invoicesCreated = invoicesCreated
    if (errorsCount !== undefined) data.errorsCount = errorsCount
    if (warningsCount !== undefined) data.warningsCount = warningsCount

    const updatedFile = await db.uploadedFile.update({
      where: { id },
      data,
    })

    return NextResponse.json({ file: updatedFile })
  } catch (error) {
    console.error('PATCH /api/upload error:', error)
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Uploaded file not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update uploaded file' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/upload?id=xxx — Delete an uploaded file ─────────────────────
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    const existing = await db.uploadedFile.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Uploaded file not found' },
        { status: 404 }
      )
    }

    await db.uploadedFile.delete({ where: { id } })

    // Create audit log for the deletion
    await db.auditLog.create({
      data: {
        clientId: existing.clientId ?? null,
        userId: existing.uploadedBy ?? null,
        action: 'File Deleted',
        entity: 'uploadedFile',
        entityId: id,
        details: `File "${existing.originalName}" deleted`,
        oldValue: JSON.stringify({
          status: existing.status,
          processingStep: existing.processingStep,
          invoicesCreated: existing.invoicesCreated,
        }),
      },
    })

    return NextResponse.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete uploaded file' },
      { status: 500 }
    )
  }
}
