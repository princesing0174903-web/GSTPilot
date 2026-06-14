import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Run the processing pipeline in the background using setTimeout
// Step timings from spec:
//   After 1s: status="processing", processingStep="parsing", progress=20
//   After 3s: processingStep="extracting", progress=50
//   After 5s: processingStep="validating", progress=80
//   After 7s: status="completed", processingStep="completed", progress=100, invoicesCreated=0
async function runProcessingPipeline(fileId: string, originalName: string, clientId: string | null) {
  try {
    // Step 1: After 1s → status=processing, processingStep=parsing, progress=20
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await db.uploadedFile.update({
      where: { id: fileId },
      data: {
        status: 'processing',
        processingStep: 'parsing',
        progress: 20,
      },
    })

    // Step 2: After 3s (2s more) → processingStep=extracting, progress=50
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await db.uploadedFile.update({
      where: { id: fileId },
      data: {
        processingStep: 'extracting',
        progress: 50,
      },
    })

    // Step 3: After 5s (2s more) → processingStep=validating, progress=80
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await db.uploadedFile.update({
      where: { id: fileId },
      data: {
        processingStep: 'validating',
        progress: 80,
      },
    })

    // Step 4: After 7s (2s more) → status=completed, processingStep=completed, progress=100, invoicesCreated=0
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await db.uploadedFile.update({
      where: { id: fileId },
      data: {
        status: 'completed',
        processingStep: 'completed',
        progress: 100,
        invoicesCreated: 0,
      },
    })

    // Create audit log for processing completion
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'File Processed',
        entity: 'uploaded_file',
        entityId: fileId,
        details: `File "${originalName}" processed successfully`,
      },
    })
  } catch (error) {
    // Mark file as failed if any step fails
    const errorMessage = error instanceof Error ? error.message : 'Processing failed'
    try {
      await db.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'failed',
          processingStep: 'failed',
          errorMessage,
        },
      })
    } catch {
      // File might have been deleted during processing — ignore
    }
  }
}

// GET /api/upload — Get uploaded files
// Query params: clientId, status
// Returns { files: [...] }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')

    const where: any = {}

    if (clientId) {
      where.clientId = clientId
    }
    if (status) {
      where.status = status
    }

    const files = await db.uploadedFile.findMany({
      where,
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

// POST /api/upload — Upload file with processing pipeline
// Accepts FormData with: file, clientId, period, tags
// Creates UploadedFile record with status="uploaded", processingStep="upload", progress=0
// Then simulates processing steps using setTimeout
// Returns { file: UploadedFile }
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const period = formData.get('period') as string | null
    const tags = formData.get('tags') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate client if provided
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        )
      }
    }

    // Determine file type from extension
    const fileName = file.name
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'pdf'
    const mimeType = file.type || 'application/octet-stream'
    const storedName = `upload_${Date.now()}_${fileName}`
    const filePath = `/uploads/${Date.now()}_${fileName}`

    // Create the UploadedFile record with status="uploaded", processingStep="upload", progress=0
    const uploadedFile = await db.uploadedFile.create({
      data: {
        clientId: clientId ?? null,
        originalName: fileName,
        storedName,
        fileType: extension,
        fileSize: file.size,
        mimeType,
        filePath,
        status: 'uploaded',
        processingStep: 'upload',
        progress: 0,
        period: period ?? null,
        tags: tags ?? null,
        invoicesCreated: 0,
        errorsCount: 0,
        warningsCount: 0,
      },
    })

    // Create audit log for upload
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'File Uploaded',
        entity: 'uploaded_file',
        entityId: uploadedFile.id,
        details: `File "${fileName}" uploaded (${(file.size / 1024).toFixed(1)} KB)`,
      },
    })

    // Start the processing pipeline in the background (non-blocking)
    runProcessingPipeline(uploadedFile.id, fileName, clientId).catch((err) => {
      console.error('Processing pipeline error for file', uploadedFile.id, err)
    })

    return NextResponse.json({ file: uploadedFile }, { status: 201 })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
