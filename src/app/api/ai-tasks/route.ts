import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

type TaskStatus = 'pending' | 'in_progress' | 'completed'
type SourceType = 'notice' | 'risk_alert' | 'missing_document' | 'pending_reconciliation' | 'pending_approval'

async function generateTasksFromData(): Promise<void> {
  // Generate tasks from open notices
  const openNotices = await db.notice.findMany({
    where: { status: 'open' },
    include: {
      client: { select: { tradeName: true } },
    },
  })

  for (const notice of openNotices) {
    await db.aITask.create({
      data: {
        clientId: notice.clientId,
        source: 'ai',
        sourceType: 'notice',
        sourceId: notice.id,
        title: `Respond to ${notice.noticeType} — ${notice.subject}`,
        description: notice.description
          ? `Notice for ${notice.client.tradeName}: ${notice.description}`
          : `GST notice for ${notice.client.tradeName} requires attention. Subject: ${notice.subject}`,
        priority: notice.priority,
        status: 'pending',
        dueDate: notice.dueDate,
        assignedTo: notice.assignedTo,
        autoAssigned: !!notice.assignedTo,
      },
    })
  }

  // Generate tasks from high/critical risk scores
  const highRisks = await db.riskScore.findMany({
    where: { riskLevel: { in: ['high', 'critical'] } },
    include: {
      client: { select: { tradeName: true } },
    },
  })

  for (const risk of highRisks) {
    await db.aITask.create({
      data: {
        clientId: risk.clientId,
        source: 'ai',
        sourceType: 'risk_alert',
        sourceId: risk.id,
        title: `Address ${risk.riskLevel} risk for ${risk.client.tradeName}`,
        description: `${risk.client.tradeName} has a ${risk.riskLevel} risk score of ${risk.overallScore}/100. Key factors: lateFilings=${risk.lateFilings}, gstMismatches=${risk.gstMismatches}, noticeFrequency=${risk.noticeFrequency}. ${risk.recommendations ?? 'Immediate review recommended.'}`,
        priority: risk.riskLevel === 'critical' ? 'critical' : 'high',
        status: 'pending',
        autoAssigned: false,
      },
    })
  }

  // Generate tasks from unmatched invoices (reconciliation)
  const unmatchedInvoices = await db.invoice.findMany({
    where: { matchStatus: 'unmatched' },
    include: {
      client: { select: { tradeName: true } },
    },
    take: 50,
  })

  // Group unmatched invoices by client for efficient task creation
  const unmatchedByClient = new Map<string, { clientName: string; count: number; invoiceIds: string[] }>()
  for (const inv of unmatchedInvoices) {
    const existing = unmatchedByClient.get(inv.clientId)
    if (existing) {
      existing.count++
      existing.invoiceIds.push(inv.id)
    } else {
      unmatchedByClient.set(inv.clientId, {
        clientName: inv.client.tradeName,
        count: 1,
        invoiceIds: [inv.id],
      })
    }
  }

  for (const [clientId, data] of unmatchedByClient) {
    await db.aITask.create({
      data: {
        clientId,
        source: 'ai',
        sourceType: 'pending_reconciliation',
        title: `Reconcile ${data.count} unmatched invoice${data.count > 1 ? 's' : ''} for ${data.clientName}`,
        description: `${data.clientName} has ${data.count} unmatched invoice(s) requiring reconciliation with GSTR-2B data. Unmatched invoices may result in ITC loss or compliance gaps. Invoice IDs: ${data.invoiceIds.slice(0, 5).join(', ')}${data.invoiceIds.length > 5 ? ` ... and ${data.invoiceIds.length - 5} more` : ''}`,
        priority: data.count > 10 ? 'high' : 'medium',
        status: 'pending',
        autoAssigned: false,
      },
    })
  }

  // Generate tasks from pending workload assignments (approval tasks)
  const pendingApprovals = await db.workloadAssignment.findMany({
    where: { status: 'pending', entityType: 'approval' },
    include: {
      teamMember: { select: { name: true } },
    },
  })

  for (const assignment of pendingApprovals) {
    await db.aITask.create({
      data: {
        clientId: assignment.clientId,
        source: 'ai',
        sourceType: 'pending_approval',
        sourceId: assignment.id,
        title: `Approve: ${assignment.title}`,
        description: assignment.description
          ? `Pending approval assigned to ${assignment.teamMember.name}: ${assignment.description}`
          : `Pending approval assigned to ${assignment.teamMember.name}: ${assignment.title}`,
        priority: assignment.priority,
        status: 'pending',
        assignedTo: assignment.teamMemberId,
        dueDate: assignment.dueDate,
        autoAssigned: true,
      },
    })
  }
}

// GET /api/ai-tasks — List AI Tasks grouped by status and source type
export async function GET() {
  try {
    // Check if tasks exist
    let taskCount = await db.aITask.count()

    // Generate tasks from current data if none exist
    if (taskCount === 0) {
      await generateTasksFromData()
    }

    const tasks = await db.aITask.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    // Enrich with client info
    const clientIds = [...new Set(tasks.map((t) => t.clientId).filter(Boolean))] as string[]
    const clients = await db.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, tradeName: true, gstin: true },
    })
    const clientMap = new Map(clients.map((c) => [c.id, c]))

    const enrichedTasks = tasks.map((task) => ({
      ...task,
      clientName: task.clientId ? clientMap.get(task.clientId)?.tradeName ?? null : null,
      clientGstin: task.clientId ? clientMap.get(task.clientId)?.gstin ?? null : null,
    }))

    // Group by status
    const byStatus: Record<TaskStatus, typeof enrichedTasks> = {
      pending: [],
      in_progress: [],
      completed: [],
    }

    for (const task of enrichedTasks) {
      const status = task.status as TaskStatus
      if (byStatus[status]) {
        byStatus[status].push(task)
      } else {
        byStatus.pending.push(task)
      }
    }

    // Group by sourceType
    const byType: Record<SourceType, typeof enrichedTasks> = {
      notice: [],
      risk_alert: [],
      missing_document: [],
      pending_reconciliation: [],
      pending_approval: [],
    }

    for (const task of enrichedTasks) {
      const sourceType = task.sourceType as SourceType
      if (byType[sourceType]) {
        byType[sourceType].push(task)
      }
    }

    return NextResponse.json({
      tasks: enrichedTasks,
      byStatus,
      byType,
    })
  } catch (error) {
    console.error('GET /api/ai-tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI tasks' },
      { status: 500 }
    )
  }
}

// POST /api/ai-tasks — Create a new AI Task
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      clientId,
      sourceType,
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      autoAssigned,
    } = body

    if (!sourceType || !title) {
      return NextResponse.json(
        { error: 'sourceType and title are required' },
        { status: 400 }
      )
    }

    // Verify client exists if provided
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        )
      }
    }

    const task = await db.aITask.create({
      data: {
        clientId: clientId ?? null,
        source: 'manual',
        sourceType,
        title,
        description: description ?? null,
        priority: priority ?? 'medium',
        status: 'pending',
        assignedTo: assignedTo ?? null,
        dueDate: dueDate ?? null,
        autoAssigned: autoAssigned ?? false,
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('POST /api/ai-tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create AI task' },
      { status: 500 }
    )
  }
}

// PATCH /api/ai-tasks — Update task status
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, assignedTo, completedAt } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Task id is required' },
        { status: 400 }
      )
    }

    const existing = await db.aITask.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (completedAt !== undefined) {
      updateData.completedAt = completedAt
    } else if (status === 'completed') {
      updateData.completedAt = new Date().toISOString()
    }

    const task = await db.aITask.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('PATCH /api/ai-tasks error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update AI task' },
      { status: 500 }
    )
  }
}
