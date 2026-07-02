import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { safeAudit } from '@/lib/audit/safe-write'

const DEFAULT_SETTINGS = {
  firmName: 'GSTPilot Firm',
  logoUrl: null,
  primaryColor: '#059669',
  accentColor: '#7c3aed',
  customDomain: null,
  emailFromName: null,
  emailTemplate: null,
}

// GET /api/firm-settings — Return current FirmSettings
export async function GET() {
  try {
    const settings = await db.firmSettings.findFirst()

    if (!settings) {
      // Return defaults if no record exists
      return NextResponse.json({ settings: DEFAULT_SETTINGS })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('GET /api/firm-settings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch firm settings' },
      { status: 500 }
    )
  }
}

// PUT /api/firm-settings — Update FirmSettings (upsert)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      firmName,
      logoUrl,
      primaryColor,
      accentColor,
      customDomain,
      emailFromName,
      emailTemplate,
      updatedBy,
    } = body

    const existing = await db.firmSettings.findFirst()

    const data: Record<string, unknown> = {}
    if (firmName !== undefined) data.firmName = firmName
    if (logoUrl !== undefined) data.logoUrl = logoUrl
    if (primaryColor !== undefined) data.primaryColor = primaryColor
    if (accentColor !== undefined) data.accentColor = accentColor
    if (customDomain !== undefined) data.customDomain = customDomain
    if (emailFromName !== undefined) data.emailFromName = emailFromName
    if (emailTemplate !== undefined) data.emailTemplate = emailTemplate

    let settings

    if (existing) {
      settings = await db.firmSettings.update({
        where: { id: existing.id },
        data,
      })
    } else {
      settings = await db.firmSettings.create({
        data: {
          firmName: (firmName as string) ?? DEFAULT_SETTINGS.firmName,
          logoUrl: (logoUrl as string | null) ?? DEFAULT_SETTINGS.logoUrl,
          primaryColor: (primaryColor as string) ?? DEFAULT_SETTINGS.primaryColor,
          accentColor: (accentColor as string) ?? DEFAULT_SETTINGS.accentColor,
          customDomain: (customDomain as string | null) ?? DEFAULT_SETTINGS.customDomain,
          emailFromName: (emailFromName as string | null) ?? DEFAULT_SETTINGS.emailFromName,
          emailTemplate: (emailTemplate as string | null) ?? DEFAULT_SETTINGS.emailTemplate,
        },
      })
    }

    // AuditLog entry
    try {
      await safeAudit({
        userId: updatedBy ?? null,
        action: 'FIRM_SETTINGS_UPDATED',
        entity: 'FirmSettings',
        entityId: settings.id,
        newValue: JSON.stringify(data),
        details: `Firm settings updated — ${Object.keys(data).join(', ')}`,
      })
    } catch (auditErr) {
      console.warn('[FirmSettings] AuditLog write failed:', auditErr)
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('PUT /api/firm-settings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update firm settings' },
      { status: 500 }
    )
  }
}

// PATCH /api/firm-settings — alias for PUT (partial update, upsert)
// Same body shape as PUT. Provided so the frontend can use a semantic PATCH
// verb for partial updates (per the Production Transformation spec).
export async function PATCH(request: Request) {
  return PUT(request)
}
