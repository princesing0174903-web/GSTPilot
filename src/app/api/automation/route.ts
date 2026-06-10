import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const VALID_TRIGGERS = ['invoice_uploaded', 'return_ready', 'return_filed', 'notice_received']

// GET /api/automation — List all AutomationRules with latest logs
export async function GET() {
  try {
    const rules = await db.automationRule.findMany({
      include: {
        logs: {
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('GET /api/automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch automation rules' },
      { status: 500 }
    )
  }
}

// POST /api/automation — Create a new AutomationRule
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, trigger, conditions, actions, createdBy } = body

    if (!name || !trigger || !actions) {
      return NextResponse.json(
        { error: 'name, trigger, and actions are required' },
        { status: 400 }
      )
    }

    if (!VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(', ')}` },
        { status: 400 }
      )
    }

    const rule = await db.automationRule.create({
      data: {
        name,
        description: description ?? null,
        trigger,
        conditions: conditions ?? null,
        actions,
        createdBy: createdBy ?? null,
      },
      include: {
        logs: {
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('POST /api/automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create automation rule' },
      { status: 500 }
    )
  }
}

// PATCH /api/automation — Update an AutomationRule
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, description, isActive, conditions, actions } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.automationRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (isActive !== undefined) data.isActive = isActive
    if (conditions !== undefined) data.conditions = conditions
    if (actions !== undefined) data.actions = actions

    const rule = await db.automationRule.update({
      where: { id },
      data,
      include: {
        logs: {
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('PATCH /api/automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update automation rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/automation — Delete an AutomationRule
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

    const existing = await db.automationRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      )
    }

    // Delete associated logs first
    await db.automationLog.deleteMany({ where: { ruleId: id } })
    await db.automationRule.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Automation rule deleted' })
  } catch (error) {
    console.error('DELETE /api/automation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete automation rule' },
      { status: 500 }
    )
  }
}
