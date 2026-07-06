import { NextResponse } from 'next/server'

// ─── POST handler ───────────────────────────────────────────────────────────
//
// SECURITY: This route wipes the entire Prisma database and reseeds it. It MUST
// never be callable in production. We gate it behind an explicit env var so
// only a developer with shell access to the server can trigger it.
//
// In production (NODE_ENV=production), this route is permanently disabled.
export async function POST() {
  // Hard block in production — no exceptions.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, message: 'Seed route is disabled in production.' },
      { status: 403 }
    )
  }

  // In development, require an explicit env var to be set. This prevents
  // accidental triggers from the browser or automated tools.
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
        name: 'GSTPilot Demo Firm',
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
        firmName: 'GSTPilot Demo Firm',
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
