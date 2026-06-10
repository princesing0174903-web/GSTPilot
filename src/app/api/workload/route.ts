import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/workload — List workload assignments grouped by team member
export async function GET() {
  try {
    const assignments = await db.workloadAssignment.findMany({
      include: {
        teamMember: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { assignedAt: 'desc' }],
    })

    // Group by teamMemberId
    const grouped = new Map<string, {
      teamMember: NonNullable<typeof assignments[0]['teamMember']>
      assignments: typeof assignments
      summary: {
        invoicesAssigned: number
        invoicesPending: number
        reviewsPending: number
        approvalsPending: number
        totalPending: number
        totalCompleted: number
        totalInProgress: number
        byStatus: Record<string, number>
        byPriority: Record<string, number>
      }
    }>()

    for (const assignment of assignments) {
      const memberId = assignment.teamMemberId

      if (!grouped.has(memberId)) {
        grouped.set(memberId, {
          teamMember: assignment.teamMember,
          assignments: [],
          summary: {
            invoicesAssigned: 0,
            invoicesPending: 0,
            reviewsPending: 0,
            approvalsPending: 0,
            totalPending: 0,
            totalCompleted: 0,
            totalInProgress: 0,
            byStatus: {},
            byPriority: {},
          },
        })
      }

      const group = grouped.get(memberId)!
      group.assignments.push(assignment)

      // Status breakdown
      group.summary.byStatus[assignment.status] =
        (group.summary.byStatus[assignment.status] ?? 0) + 1

      // Priority breakdown
      group.summary.byPriority[assignment.priority] =
        (group.summary.byPriority[assignment.priority] ?? 0) + 1

      // Type-specific counts
      if (assignment.entityType === 'invoice') {
        group.summary.invoicesAssigned++
        if (assignment.status === 'pending') {
          group.summary.invoicesPending++
        }
      } else if (assignment.entityType === 'review') {
        if (assignment.status === 'pending') {
          group.summary.reviewsPending++
        }
      } else if (assignment.entityType === 'approval') {
        if (assignment.status === 'pending') {
          group.summary.approvalsPending++
        }
      }

      // Overall status counts
      if (assignment.status === 'pending') group.summary.totalPending++
      else if (assignment.status === 'completed') group.summary.totalCompleted++
      else if (assignment.status === 'in_progress') group.summary.totalInProgress++
    }

    const result = Array.from(grouped.values())

    return NextResponse.json({ workload: result, totalAssignments: assignments.length })
  } catch (error) {
    console.error('GET /api/workload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workload' },
      { status: 500 }
    )
  }
}

// POST /api/workload — Create new workload assignment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      teamMemberId,
      entityType,
      title,
      description,
      clientId,
      priority,
      dueDate,
      assignedBy,
    } = body

    if (!teamMemberId || !entityType || !title) {
      return NextResponse.json(
        { error: 'teamMemberId, entityType, and title are required' },
        { status: 400 }
      )
    }

    // Verify team member exists
    const member = await db.teamMember.findUnique({ where: { id: teamMemberId } })
    if (!member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    const assignment = await db.workloadAssignment.create({
      data: {
        teamMemberId,
        entityType,
        title,
        description: description ?? null,
        clientId: clientId ?? null,
        priority: priority ?? 'medium',
        dueDate: dueDate ?? null,
        assignedBy: assignedBy ?? null,
      },
      include: {
        teamMember: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/workload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workload assignment' },
      { status: 500 }
    )
  }
}

// PATCH /api/workload — Update assignment status
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, completedAt, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment id is required' },
        { status: 400 }
      )
    }

    const existing = await db.workloadAssignment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (completedAt !== undefined) updateData.completedAt = completedAt
    else if (status === 'completed') updateData.completedAt = new Date().toISOString()
    if (notes !== undefined) updateData.notes = notes

    const assignment = await db.workloadAssignment.update({
      where: { id },
      data: updateData,
      include: {
        teamMember: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('PATCH /api/workload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workload assignment' },
      { status: 500 }
    )
  }
}
