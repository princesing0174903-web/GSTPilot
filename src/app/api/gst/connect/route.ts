// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/connect
// ═══════════════════════════════════════════════════════════════════════════════
// Save a GSP provider configuration for an org. Credentials are encrypted at
// rest with AES-256-GCM (server-only master key). The response NEVER includes
// the decrypted secrets — only masked indicators.
//
// Body: {
//   organizationId, providerKey, mode: 'sandbox'|'production',
//   gstin?, clientId?, clientSecret?, apikey?, apiEndpoint?, authEndpoint?,
// }
// Returns: { ok: true, configId, masked: { clientId, hasSecret, hasApikey } }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { encryptString } from '@/lib/gstn-provider/server/crypto';
import { getProviderMeta } from '@/lib/gst-reconciliation/server/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const connectSchema = z.object({
  organizationId: z.string().min(1),
  providerKey: z.string().min(1).max(40),
  mode: z.enum(['sandbox', 'production']).default('sandbox'),
  gstin: z.string().length(15).optional(),
  clientId: z.string().max(256).optional(),
  clientSecret: z.string().max(512).optional(),
  apikey: z.string().max(512).optional(),
  apiEndpoint: z.string().max(512).optional(),
  authEndpoint: z.string().max(512).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    let body: z.infer<typeof connectSchema>;
    try {
      body = connectSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? 'Invalid request.', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }
      throw err;
    }

    const member = await requireOrgMembership(uid, body.organizationId);
    if (member instanceof NextResponse) return member;

    const meta = getProviderMeta(body.providerKey);
    if (!meta) {
      return NextResponse.json(
        { error: `Unknown provider '${body.providerKey}'.`, code: 'UNKNOWN_PROVIDER' },
        { status: 400 },
      );
    }

    // Validate required fields are present
    for (const f of meta.fields) {
      if (f.required) {
        const val = (body as Record<string, string | undefined>)[f.key];
        if (!val || val.trim().length === 0) {
          return NextResponse.json(
            { error: `${f.label} is required for ${meta.displayName}.`, code: 'MISSING_FIELD' },
            { status: 400 },
          );
        }
      }
    }

    // Encrypt secrets at rest
    const encryptedSecret = body.clientSecret ? encryptString(body.clientSecret) : null;
    const encryptedApikey = body.apikey ? encryptString(body.apikey) : null;

    // Resolve the display name + endpoint defaults
    const apiEndpoint = body.apiEndpoint ?? (body.mode === 'production' ? meta.defaults?.productionUrl : meta.defaults?.sandboxUrl) ?? null;

    // Upsert the config (one per org+provider)
    const existing = await db.gSPProviderConfig.findUnique({
      where: { organizationId_providerKey: { organizationId: body.organizationId, providerKey: body.providerKey } },
    });

    // Disable other providers for this org (only one active at a time)
    if (!existing) {
      await db.gSPProviderConfig.updateMany({
        where: { organizationId: body.organizationId, providerKey: { not: body.providerKey } },
        data: { enabled: false },
      });
    }

    const config = await db.gSPProviderConfig.upsert({
      where: { organizationId_providerKey: { organizationId: body.organizationId, providerKey: body.providerKey } },
      create: {
        organizationId: body.organizationId,
        providerKey: body.providerKey,
        displayName: meta.displayName,
        clientId: body.clientId ?? null,
        clientSecret: encryptedSecret,
        apikey: encryptedApikey,
        apiEndpoint,
        authEndpoint: body.authEndpoint ?? null,
        mode: body.mode,
        gstin: body.gstin ?? null,
        enabled: true,
        lastTestOk: false,
      },
      update: {
        displayName: meta.displayName,
        clientId: body.clientId ?? existing?.clientId ?? null,
        clientSecret: encryptedSecret ?? existing?.clientSecret ?? null,
        apikey: encryptedApikey ?? existing?.apikey ?? null,
        apiEndpoint: apiEndpoint ?? existing?.apiEndpoint ?? null,
        authEndpoint: body.authEndpoint ?? existing?.authEndpoint ?? null,
        mode: body.mode,
        gstin: body.gstin ?? existing?.gstin ?? null,
        enabled: true,
        // Reset test status — must re-test after config change
        lastTestOk: false,
        lastTestMessage: null,
        lastConnectedAt: null,
      },
    });

    // Return ONLY masked indicators — NEVER the secret
    return NextResponse.json({
      ok: true,
      configId: config.id,
      masked: {
        clientId: config.clientId ? config.clientId.slice(0, 4) + '••••' + config.clientId.slice(-4) : null,
        hasSecret: !!config.clientSecret,
        hasApikey: !!config.apikey,
        apiEndpoint: config.apiEndpoint,
      },
    });
  } catch (error) {
    return friendlyApiError(error, 'Unable to save GST provider configuration.');
  }
}
