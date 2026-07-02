import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents } from '@/lib/graph/live-update'
import { safeAudit, safeNotify } from '@/lib/audit/safe-write'

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
      orderBy: { createdAt: 'desc' },
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

// POST /api/team-members — Invite a new team member
// Body: { name?, email, role, department?, permissions?, invitedBy?, avatar? }
// Creates a TeamMember row with isActive=false (status='invited'), writes an
// AuditLog entry (action='TEAM_INVITE'), and creates a Notification for the
// invited user. The TeamMember isActive flag remains false until the invitee
// accepts — that's our 'invited' status.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      role,
      department,
      permissions,
      invitedBy,
      avatar,
    } = body

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const roleKey = (role ?? 'staff').toString().toLowerCase()

    // Derive a display name from email if not provided
    const displayName = name && String(name).trim()
      ? String(name).trim()
      : normalizedEmail.split('@')[0]

    // Check for duplicate email
    const existing = await db.teamMember.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 409 }
      )
    }

    // Persist permissions as JSON string on the avatar column? No — we don't have
    // a permissions column. Use department to encode role-department combo and
    // store permissions in a Notification payload for audit. The TeamMember row
    // itself stores role + department.
    const dept = department ?? 'general'

    const teamMember = await db.teamMember.create({
      data: {
        name: displayName,
        email: normalizedEmail,
        role: roleKey,
        department: dept,
        avatar: avatar ?? null,
        isActive: false, // 'invited' status — pending acceptance
      },
    })

    // Build a Notification for the invited user.
    // We don't know the invitee's userId (they may not have a GSTPilot account
    // yet). Resolve a fallback recipient: if invitedBy is set, notify that user
    // (the inviter) so they can track the invitation status; otherwise leave
    // userId null and the notification surfaces in firm-wide inboxes.
    const permissionsList: string[] = Array.isArray(permissions)
      ? permissions.map((p: unknown) => String(p))
      : []
    const notificationTitle = `Team invitation sent to ${displayName}`
    const notificationMessage = `${displayName} has been invited as ${roleKey.toUpperCase()}${permissionsList.length > 0 ? ` with permissions: ${permissionsList.join(', ')}` : ''}. Awaiting acceptance.`

    try {
      await safeNotify({
        userId: invitedBy ?? null,
        type: 'info',
        category: 'team',
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: '/team',
        priority: 'medium',
        sentAt: new Date(),
      })
    } catch (notifErr) {
      console.warn('[TeamMembers] Notification write failed:', notifErr)
    }

    // AuditLog entry — TEAM_INVITE
    try {
      await safeAudit({
        userId: invitedBy ?? null,
        action: 'TEAM_INVITE',
        entity: 'TeamMember',
        entityId: teamMember.id,
        newValue: JSON.stringify({
          name: displayName,
          email: normalizedEmail,
          role: roleKey,
          department: dept,
          permissions: permissionsList,
        }),
        details: `Invited ${normalizedEmail} as ${roleKey}`,
      })
    } catch (auditErr) {
      console.warn('[TeamMembers] AuditLog write failed:', auditErr)
    }

    // ── Real Business Graph Engine™ — auto-create employee node + live event ──
    try {
      graphEvents.teamMemberAdded(teamMember.id, teamMember.name, teamMember.role)
    } catch {}

    return NextResponse.json({
      teamMember: {
        ...teamMember,
        status: 'invited',
        permissions: permissionsList,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/team-members error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create team member' },
      { status: 500 }
    )
  }
}
