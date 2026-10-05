import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, provisionUser } from '@/lib/enterprise'
import { requireAuth, friendlyApiError } from '@/lib/auth/session'
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit'
import { parseBody, schemas } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * SCIM-style automatic user provisioning — provisions a user from an
 * identity provider (Google/Microsoft/SAML/Okta/etc.) into the tenant.
 *
 * SECURITY (POLISH-06):
 *   • requireAuth — must be signed in.
 *   • zod validation (schemas.provision).
 *   • Rate-limited via RATE_LIMIT_PRESETS.admin (20 req/min).
 *   • Errors go through friendlyApiError so raw messages never leak.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req, RATE_LIMIT_PRESETS.admin, 'provision')
  if (rl.denied) return rateLimitedResponse(rl.retryAfterSec)

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult

    const [body, validationErr] = await parseBody(req, schemas.provision)
    if (validationErr) return validationErr

    await seedEnterprise()
    const tenant = await resolveTenant()
    const result = await provisionUser(tenant.id, {
      email: body.email,
      name: body.name,
      providerKey: body.providerKey,
      roleKey: body.roleKey,
      title: body.title,
    })
    return NextResponse.json({ provisioned: result })
  } catch (err) {
    console.error('[api/provision] error:', err)
    return friendlyApiError(err, 'We could not provision this user right now. Please try again.')
  }
}
