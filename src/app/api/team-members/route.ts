import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/team-members — List team members with latest performance
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const department = searchParams.get('department')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (role) where.role = role
    if (department) where.department = department
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const teamMembers = await db.teamMember.findMany({
      where,
      include: {
        performances: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const enriched = teamMembers.map((member) => {
      const latestPerformance = member.performances[0] ?? null

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        department: member.department,
        avatar: member.avatar,
        isActive: member.isActive,
        joinedAt: member.joinedAt,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        latestPerformance: latestPerformance
          ? {
              period: latestPerformance.period,
              invoicesProcessed: latestPerformance.invoicesProcessed,
              reviewsCompleted: latestPerformance.reviewsCompleted,
              approvalsCompleted: latestPerformance.approvalsCompleted,
              averageAccuracy: latestPerformance.averageAccuracy,
              averageTurnaround: latestPerformance.averageTurnaround,
              totalActions: latestPerformance.totalActions,
              score: latestPerformance.score,
            }
          : null,
        totalAssignments: member._count.assignments,
      }
    })

    return NextResponse.json({ teamMembers: enriched })
  } catch (error) {
    console.error('GET /api/team-members error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

// POST /api/team-members — Create new team member
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, role, department, avatar } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'name and email are required' },
        { status: 400 }
      )
    }

    // Check for duplicate email
    const existing = await db.teamMember.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 409 }
      )
    }

    const teamMember = await db.teamMember.create({
      data: {
        name,
        email,
        role: role ?? 'staff',
        department: department ?? 'general',
        avatar: avatar ?? null,
      },
    })

    return NextResponse.json({ teamMember }, { status: 201 })
  } catch (error) {
    console.error('POST /api/team-members error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create team member' },
      { status: 500 }
    )
  }
}
