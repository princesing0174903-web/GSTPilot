// ═══════════════════════════════════════════════════════════════════════════════
// PATCH   /api/team-members/[id]
//   Body: { role?, department?, isActive?, name?, avatar?, updatedBy? }
//   Updates a TeamMember row + writes an AuditLog entry.
//   Used by the "Edit role" / "Remove member" actions in SettingsPage + TeamPage.
//
// DELETE  /api/team-members/[id]
//   Removes a TeamMember + writes an AuditLog entry.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeAudit } from '@/lib/audit/safe-write'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { role, department, isActive, name, avatar, updatedBy } = body

    const existing = await db.teamMember.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 },
      )
    }

    const data: Record<string, unknown> = {}
    if (typeof role === 'string' && role.trim()) data.role = role.trim().toLowerCase()
    if (typeof department === 'string' && department.trim()) data.department = department.trim()
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (typeof name === 'string' && name.trim()) data.name = name.trim()
    if (typeof avatar === 'string') data.avatar = avatar || null

    const updated = await db.teamMember.update({
      where: { id },
      data,
    })

    // AuditLog
    try {
      const actionLabel = data.isActive === false
        ? 'TEAM_MEMBER_DEACTIVATED'
        : data.role
          ? 'TEAM_MEMBER_ROLE_CHANGED'
          : 'TEAM_MEMBER_UPDATED'
      await safeAudit({
        userId: updatedBy ?? null,
        action: actionLabel,
        entity: 'TeamMember',
        entityId: id,
        oldValue: JSON.stringify({
          role: existing.role,
          department: existing.department,
          isActive: existing.isActive,
        }),
        newValue: JSON.stringify(data),
        details: `Updated team member ${existing.email} — ${Object.keys(data).join(', ')}`,
      })
    } catch (auditErr) {
      console.warn('[TeamMembers] AuditLog write failed:', auditErr)
    }

    return NextResponse.json({ teamMember: updated })
  } catch (error) {
    console.error('PATCH /api/team-members/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update team member' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const removedBy = searchParams.get('removedBy')

    const existing = await db.teamMember.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 },
      )
    }

    // Unassign notices + delete workload assignments before removing the member.
    await db.notice.updateMany({
      where: { assignedTo: id },
      data: { assignedTo: null },
    }).catch(() => {})
    await db.workloadAssignment.deleteMany({
      where: { teamMemberId: id },
    }).catch(() => {})

    await db.teamMember.delete({ where: { id } })

    // AuditLog
    try {
      await safeAudit({
        userId: removedBy ?? null,
        action: 'TEAM_MEMBER_REMOVED',
        entity: 'TeamMember',
        entityId: id,
        oldValue: JSON.stringify({
          name: existing.name,
          email: existing.email,
          role: existing.role,
        }),
        details: `Removed team member ${existing.email}`,
      })
    } catch (auditErr) {
      console.warn('[TeamMembers] AuditLog write failed:', auditErr)
    }

    return NextResponse.json({ success: true, message: 'Team member removed' })
  } catch (error) {
    console.error('DELETE /api/team-members/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove team member' },
      { status: 500 },
    )
  }
}
