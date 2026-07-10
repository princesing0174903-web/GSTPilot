import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { safeAudit } from '@/lib/audit/safe-write'

// POST /api/firm-settings/logo — multipart upload (field: "file"); writes the
// file to /public/uploads/logos/{firmId-or-'firm'}.png and persists the URL on
// FirmSettings.logoUrl. Returns the new logoUrl.
//
// Query params:
//   firmId — optional org id. When provided, the FirmSettings row is scoped to
//            that org (and the file is named after it). When omitted, the
//            singleton FirmSettings row is updated.
// Body (multipart/form-data):
//   file — File (PNG / JPG / WebP, ≤ 2 MB)
//   updatedBy — optional user id (string)
export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png'
    case 'image/jpeg':
    case 'image/jpg': return 'jpg'
    case 'image/webp': return 'webp'
    default: return 'png'
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const firmId = searchParams.get('firmId') ?? undefined

    const form = await req.formData()
    const file = form.get('file')
    const updatedBy = form.get('updatedBy')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Logo must be a PNG, JPG, or WebP file' },
        { status: 415 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Logo must be under 2 MB' },
        { status: 413 }
      )
    }

    // Resolve the target filename — prefer the firmId so re-uploads overwrite
    // the previous logo (avoids stale files accumulating).
    const safeId = (firmId && /^[a-zA-Z0-9_-]+$/.test(firmId)) ? firmId : 'firm'
    const ext = extFromMime(file.type)
    const fileName = `${safeId}.${ext}`

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    await fs.mkdir(uploadsDir, { recursive: true })
    const filePath = path.join(uploadsDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Public URL path (Next.js serves /public at the root).
    const logoUrl = `/uploads/logos/${fileName}`

    // Persist on FirmSettings (upsert).
    const existing = firmId
      ? await db.firmSettings.findUnique({ where: { firmId } })
      : await db.firmSettings.findFirst()

    let settings
    if (existing) {
      settings = await db.firmSettings.update({
        where: { id: existing.id },
        data: { logoUrl },
      })
    } else {
      settings = await db.firmSettings.create({
        data: {
          firmId: firmId ?? null,
          logoUrl,
        },
      })
    }

    // AuditLog entry
    try {
      await safeAudit({
        userId: typeof updatedBy === 'string' ? updatedBy : null,
        action: 'FIRM_LOGO_UPDATED',
        entity: 'FirmSettings',
        entityId: settings.id,
        newValue: JSON.stringify({ logoUrl }),
        details: `Firm logo updated — ${logoUrl}`,
      })
    } catch (auditErr) {
      console.warn('[FirmSettings/Logo] AuditLog write failed:', auditErr)
    }

    return NextResponse.json({ logoUrl, settings })
  } catch (error) {
    console.error('POST /api/firm-settings/logo error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload logo' },
      { status: 500 }
    )
  }
}
