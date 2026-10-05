import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, requireOrgMembership } from '@/lib/auth/session'

// GET /api/documents — List documents, tenant-scoped.
// Accepts organizationId (preferred) or clientId. If NEITHER is provided,
// returns empty (prevents cross-tenant data leak).
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder')
    const clientId = searchParams.get('clientId')
    const search = searchParams.get('search')
    const organizationId = searchParams.get('organizationId') ?? searchParams.get('firmId')
    const orgResult = await requireOrgMembership(uid, organizationId)
    if (orgResult instanceof NextResponse) return orgResult

    const where: Record<string, unknown> = { isLatest: true }

    if (clientId) {
      where.clientId = clientId
    } else if (organizationId) {
      // Client has firmId (not organizationId) — fix the previous cross-tenant leak.
      where.client = { firmId: organizationId }
    } else {
      // No tenant scope — return empty rather than leak cross-tenant data
      return NextResponse.json({ documents: [] })
    }

    if (folder) {
      where.folder = folder
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    const documents = await db.document.findMany({
      where,
      include: {
        client: { select: { id: true, tradeName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('GET /api/documents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST /api/documents — Create a new Document
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      clientId,
      folder,
      name,
      fileType,
      size,
      path,
      tags,
      description,
      uploadedBy,
      parentId,
    } = body

    if (!name || !fileType) {
      return NextResponse.json(
        { error: 'name and fileType are required' },
        { status: 400 }
      )
    }

    let version = 1
    if (parentId) {
      const parent = await db.document.findUnique({ where: { id: parentId } })
      if (parent) {
        version = parent.version + 1
        // Mark parent as no longer latest
        await db.document.update({
          where: { id: parentId },
          data: { isLatest: false },
        })
      }
    }

    const document = await db.document.create({
      data: {
        clientId: clientId ?? null,
        folder: folder ?? 'general',
        name,
        fileType,
        size: size ?? 0,
        path: path ?? null,
        tags: tags ?? null,
        description: description ?? null,
        uploadedBy: uploadedBy ?? null,
        version,
        isLatest: true,
        parentId: parentId ?? null,
      },
      include: {
        client: clientId
          ? { select: { id: true, tradeName: true } }
          : false,
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('POST /api/documents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create document' },
      { status: 500 }
    )
  }
}

// PATCH /api/documents — Update a document
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, tags, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = {}
    if (tags !== undefined) data.tags = tags
    if (description !== undefined) data.description = description

    const document = await db.document.update({
      where: { id },
      data,
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('PATCH /api/documents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update document' },
      { status: 500 }
    )
  }
}

// DELETE /api/documents — Delete a document
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    await db.document.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    console.error('DELETE /api/documents error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}
