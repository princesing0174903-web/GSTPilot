import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

type KnowledgeCategory = 'rule' | 'circular' | 'notification' | 'case_law' | 'department_update'

const VALID_CATEGORIES: KnowledgeCategory[] = [
  'rule',
  'circular',
  'notification',
  'case_law',
  'department_update',
]

// GET /api/ai-knowledge — List Knowledge Entries with search and filter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    // Category filter
    if (category && VALID_CATEGORIES.includes(category as KnowledgeCategory)) {
      where.category = category
    }

    // Search filter — search in title, content, summary, tags
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim()
      where.OR = [
        { title: { contains: searchTerm } },
        { content: { contains: searchTerm } },
        { summary: { contains: searchTerm } },
        { tags: { contains: searchTerm } },
      ]
    }

    const entries = await db.knowledgeEntry.findMany({
      where,
      orderBy: { relevanceScore: 'desc' },
    })

    // Compute category counts
    const allEntries = await db.knowledgeEntry.findMany({
      select: { category: true },
    })

    const categories: Record<string, number> = {}
    for (const entry of allEntries) {
      categories[entry.category] = (categories[entry.category] ?? 0) + 1
    }

    return NextResponse.json({
      entries,
      categories,
    })
  } catch (error) {
    console.error('GET /api/ai-knowledge error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch knowledge entries' },
      { status: 500 }
    )
  }
}

// POST /api/ai-knowledge — Create a new Knowledge Entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      title,
      category,
      content,
      summary,
      tags,
      source,
      effectiveDate,
      referenceNumber,
    } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      )
    }

    // Validate category if provided
    const entryCategory = category ?? 'rule'
    if (!VALID_CATEGORIES.includes(entryCategory as KnowledgeCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate relevance score based on content completeness
    let relevanceScore = 0.5 // base score
    if (title) relevanceScore += 0.1
    if (summary) relevanceScore += 0.1
    if (tags) relevanceScore += 0.1
    if (source) relevanceScore += 0.05
    if (effectiveDate) relevanceScore += 0.05
    if (referenceNumber) relevanceScore += 0.05
    if (content.length > 500) relevanceScore += 0.05
    relevanceScore = Math.min(relevanceScore, 1.0)

    const entry = await db.knowledgeEntry.create({
      data: {
        title,
        category: entryCategory,
        content,
        summary: summary ?? null,
        tags: tags ?? null,
        source: source ?? null,
        effectiveDate: effectiveDate ?? null,
        referenceNumber: referenceNumber ?? null,
        relevanceScore,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('POST /api/ai-knowledge error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create knowledge entry' },
      { status: 500 }
    )
  }
}
