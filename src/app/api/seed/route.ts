import { NextResponse } from 'next/server'

// ─── POST handler ───────────────────────────────────────────────────────────
//
// SECURITY: This route wipes the entire Prisma database and reseeds it. It MUST
// never be callable in production. We gate it behind THREE independent guards:
//
//   1. Environment: process.env.NODE_ENV !== 'production' (hard block in prod).
//   2. Env var:     process.env.GSTPILOT_ALLOW_SEED === 'true' (must be set
//                   explicitly by a developer with shell access).
//   3. Confirm:     ?confirm=WIPE_ALL_DATA query param (defence-in-depth against
//                   accidental triggers from curl/scripts without the explicit
//                   confirmation token — also blocks naive POSTs with no body
//                   that previously could wipe everything).
//
// All three must pass before any DB row is deleted.
export async function POST(request: Request) {
  // ── Guard 1: never available in production ──
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, message: 'Seed route is disabled in production.' },
      { status: 403 }
    )
  }

  // ── Guard 2: explicit env var must be set ──
  if (process.env.GSTPILOT_ALLOW_SEED !== 'true') {
    return NextResponse.json(
      {
        success: false,
        message:
          'Seed route is disabled. Set GSTPILOT_ALLOW_SEED=true in your .env to enable it during development.',
      },
      { status: 403 }
    )
  }

  // ── Guard 3: explicit ?confirm=WIPE_ALL_DATA query param ──
  const { searchParams } = new URL(request.url)
  if (searchParams.get('confirm') !== 'WIPE_ALL_DATA') {
    return NextResponse.json(
      {
        success: false,
        message:
          'Confirmation required. Re-issue the request with ?confirm=WIPE_ALL_DATA to acknowledge the wipe-and-reseed operation.',
      },
      { status: 403 }
    )
  }

  try {
    // Lazy-import db only when seeding is explicitly enabled.
    const { db } = await import('@/lib/db')

    // 1. Clear existing data (respect foreign key order)
    await db.clientBenchmark.deleteMany()
    await db.executiveReport.deleteMany()
    await db.documentChatSession.deleteMany()
    await db.knowledgeEntry.deleteMany()
    await db.aITask.deleteMany()
    await db.clientInsight.deleteMany()
    await db.complianceForecast.deleteMany()
    await db.riskScore.deleteMany()
    await db.aIPrediction.deleteMany()
    await db.automationLog.deleteMany()
    await db.automationRule.deleteMany()
    await db.workloadAssignment.deleteMany()
    await db.teamPerformance.deleteMany()
    await db.notice.deleteMany()
    await db.document.deleteMany()
    await db.firmMetrics.deleteMany()
    await db.firmSettings.deleteMany()
    await db.teamMember.deleteMany()
    await db.filingEvent.deleteMany()
    await db.reconciliationResult.deleteMany()
    await db.reconciliationRun.deleteMany()
    await db.issue.deleteMany()
    await db.auditLog.deleteMany()
    await db.healthScore.deleteMany()
    await db.gSTRFiling.deleteMany()
    await db.invoice.deleteMany()
    await db.client.deleteMany()
    await db.user.deleteMany()
    await db.firm.deleteMany()

    // 2. Create default CA Firm
    const firm = await db.firm.create({
      data: {
        name: 'VEYRO Demo Firm',
        state: 'Maharashtra',
      },
    })

    // 3. Create default admin user
    await db.user.create({
      data: {
        email: 'admin@gstpilot.ai',
        name: 'Rajesh Kumar',
        role: 'admin',
        firmId: firm.id,
      },
    })

    // 4. Create default FirmSettings
    await db.firmSettings.create({
      data: {
        firmId: firm.id,
        firmName: 'VEYRO Demo Firm',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Database cleared and default firm created',
    })
  } catch (error) {
    console.error('[SEED ERROR]', error)
    return NextResponse.json(
      { success: false, message: 'Seed failed', error: String(error) },
      { status: 500 }
    )
  }
}
