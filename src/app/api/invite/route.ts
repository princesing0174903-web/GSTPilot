import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, inviteUser } from '@/lib/enterprise'
import { requireAuth, friendlyApiError } from '@/lib/auth/session'
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit'
import { parseBody, schemas } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * Top-level invite endpoint (alias of /api/admin/invite).
 * Invites a user to the active tenant with a role + optional organization.
 *
 * SECURITY (POLISH-06):
 *   • requireAuth — must be signed in.
 *   • zod validation (schemas.invite).
 *   • Rate-limited via RATE_LIMIT_PRESETS.admin (20 req/min).
 *   • Errors go through friendlyApiError so raw messages never leak.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req, RATE_LIMIT_PRESETS.admin, 'invite')
  if (rl.denied) return rateLimitedResponse(rl.retryAfterSec)

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult

    const [body, validationErr] = await parseBody(req, schemas.invite)
    if (validationErr) return validationErr

    await seedEnterprise()
    const tenant = await resolveTenant()
    const member = await inviteUser(tenant.id, {
      email: body.email,
      name: body.name,
      roleKey: body.roleKey,
      organizationId: body.organizationId,
      title: body.title,
    })
    return NextResponse.json({ member, invited: true })
  } catch (err) {
    console.error('[api/invite] error:', err)
    return friendlyApiError(err, 'We could not send the invitation right now. Please try again.')
  }
}
