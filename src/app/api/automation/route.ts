import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { safeAudit } from '@/lib/audit/safe-write'

const VALID_TRIGGERS = ['invoice_uploaded', 'return_ready', 'return_filed', 'notice_received']

// ─── Oracle Activation ─────────────────────────────────────────────────────
// POST /api/automation with body { type: 'oracle_activation', enabled: true,
// schedule: 'daily', createdBy? } is a shortcut that creates an AutomationRule
// representing the daily Oracle analytics job. It also writes an AuditLog entry
// (action='ORACLE_ACTIVATED') so the activation is fully traceable.
const ORACLE_SCHEDULE_TO_TRIGGER: Record<string, string> = {
  daily: 'return_ready',
  hourly: 'invoice_uploaded',
  weekly: 'return_filed',
  monthly: 'notice_received',
}

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
// Two accepted shapes:
//   1. { name, description?, trigger, conditions?, actions, createdBy? }
//   2. { type: 'oracle_activation', enabled?, schedule?, createdBy? } — shortcut
//      that creates an AutomationRule named "Oracle Daily Analytics Job" with a
//      daily schedule + an AuditLog entry (action='ORACLE_ACTIVATED').
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ── Oracle activation shortcut ──
    if (body?.type === 'oracle_activation') {
      const schedule = (body.schedule ?? 'daily').toString().toLowerCase()
      const enabled = body.enabled !== false // default true
      const trigger = ORACLE_SCHEDULE_TO_TRIGGER[schedule] ?? 'return_ready'
      const ruleName = `Oracle ${schedule.charAt(0).toUpperCase() + schedule.slice(1)} Analytics Job`
      const description = `Autopilot Oracle activated — runs ${schedule} analytics across all connected data sources (GSTN, Bank, Accounting, WhatsApp, Gmail).`

      // Reuse an existing Oracle rule if present (idempotent activate)
      const existing = await db.automationRule.findFirst({
        where: { name: { startsWith: 'Oracle ' } },
      })

      let rule
      if (existing) {
        rule = await db.automationRule.update({
          where: { id: existing.id },
          data: {
            description,
            trigger,
            actions: JSON.stringify({
              type: 'oracle_activation',
              schedule,
              enabled,
              jobs: ['gst_recon', 'itc_match', 'cash_position', 'compliance_score'],
            }),
            isActive: enabled,
            lastRunAt: enabled ? new Date() : existing.lastRunAt,
          },
          include: {
            logs: {
              orderBy: { executedAt: 'desc' },
              take: 5,
            },
          },
        })
      } else {
        rule = await db.automationRule.create({
          data: {
            name: ruleName,
            description,
            trigger,
            conditions: JSON.stringify({ schedule, type: 'oracle_activation' }),
            actions: JSON.stringify({
              type: 'oracle_activation',
              schedule,
              enabled,
              jobs: ['gst_recon', 'itc_match', 'cash_position', 'compliance_score'],
            }),
            isActive: enabled,
            createdBy: body.createdBy ?? null,
          },
          include: {
            logs: {
              orderBy: { executedAt: 'desc' },
              take: 5,
            },
          },
        })
      }

      // AuditLog entry — ORACLE_ACTIVATED
      try {
        await safeAudit({
          userId: body.createdBy ?? null,
          action: 'ORACLE_ACTIVATED',
          entity: 'AutomationRule',
          entityId: rule.id,
          newValue: JSON.stringify({
            schedule,
            enabled,
            type: 'oracle_activation',
          }),
          details: `Oracle ${schedule} analytics job ${enabled ? 'activated' : 'deactivated'}`,
        })
      } catch (auditErr) {
        console.warn('[Automation] AuditLog write failed:', auditErr)
      }

      return NextResponse.json({
        rule,
        oracleActivated: enabled,
        message: `Oracle ${enabled ? 'activated' : 'deactivated'}. ${schedule.charAt(0).toUpperCase() + schedule.slice(1)} analytics job ${enabled ? 'scheduled' : 'cancelled'}.`,
      }, { status: 201 })
    }

    // ── Standard automation-rule shape ──
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
