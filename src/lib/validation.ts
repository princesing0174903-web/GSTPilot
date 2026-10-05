// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Shared Zod Schemas + Validation Helpers
//
// Centralised zod schemas for the most-used API routes so we don't redefine
// them per file. Plus a `parseBody` helper that converts a zod failure into a
// friendly 400 NextResponse.
//
// USAGE:
//   import { parseBody, schemas } from '@/lib/validation';
//   const [body, errorResp] = await parseBody(req, schemas.invoiceMarkPaid);
//   if (errorResp) return errorResp;
//   // body is now typed as InvoiceMarkPaidInput
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

// ─── parseBody helper ────────────────────────────────────────────────────────

/**
 * Validate `req.json()` against a zod schema. Returns either:
 *   - `[data, null]` on success (data is fully typed), OR
 *   - `[null, NextResponse]` on failure (400 with a friendly error envelope).
 *
 *   const [body, err] = await parseBody(req, schemas.invoiceMarkPaid);
 *   if (err) return err;
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<[T, null] | [null, NextResponse]> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return [
      null,
      NextResponse.json(
        { error: 'Invalid JSON body.', code: 'INVALID_JSON' },
        { status: 400 },
      ),
    ];
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first
      ? `${first.path.length ? first.path.join('.') + ': ' : ''}${first.message}`
      : 'Request body failed validation.';
    return [
      null,
      NextResponse.json(
        { error: message, code: 'VALIDATION_ERROR', issues: result.error.issues },
        { status: 400 },
      ),
    ];
  }
  return [result.data, null];
}

// ─── Shared schemas ──────────────────────────────────────────────────────────

const safeString = (max = 1024) =>
  z.string().trim().max(max).transform((s) => s.slice(0, max));

const optionalString = (max = 1024) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s.slice(0, max) : undefined));

/** GSTIN — 15 alphanumeric chars, all uppercase. */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'GSTIN must be a valid 15-character identifier.',
  });

/** Email — basic RFC-ish check. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email({ message: 'A valid email address is required.' });

/** Phone — 6-20 digits, optional leading +. */
export const phoneSchema = z
  .union([
    z.string().trim().max(20).regex(/^\+?[0-9]{6,20}$/, { message: 'Phone must be 6-20 digits.' }),
    z.literal(''),
  ])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** UUID/cuid — Prisma IDs. */
export const idSchema = z
  .string()
  .trim()
  .min(1, { message: 'id is required.' })
  .max(64);

export const schemas = {
  // POST /api/invoices/mark-paid
  invoiceMarkPaid: z.object({
    id: idSchema,
    paidAmount: z.number().nonnegative().finite().optional(),
    paymentMode: safeString(64).optional(),
    paymentDate: safeString(20).optional(),
  }),

  // POST /api/clients — create a new client
  clientCreate: z.object({
    gstin: gstinSchema,
    tradeName: safeString(200),
    legalName: safeString(200).optional(),
    address: safeString(2000).optional(),
    state: safeString(100).optional(),
    stateCode: safeString(10).optional(),
    contactEmail: emailSchema.optional(),
    contactPhone: phoneSchema.optional(),
    entityType: safeString(50).optional(),
    returnPeriod: safeString(20).optional(),
    organizationId: safeString(128).optional(),
    firmId: safeString(128).optional(),
  }),

  // PATCH /api/clients — update a client (id + partial fields)
  clientUpdate: z.object({
    id: idSchema,
    gstin: gstinSchema.optional(),
    tradeName: safeString(200).optional(),
    legalName: safeString(200).optional(),
    address: safeString(2000).optional(),
    state: safeString(100).optional(),
    stateCode: safeString(10).optional(),
    contactEmail: emailSchema.optional(),
    contactPhone: phoneSchema.optional(),
    entityType: safeString(50).optional(),
    returnPeriod: safeString(20).optional(),
  }),

  // PUT /api/settings/profile
  profileUpdate: z
    .object({
      name: optionalString(200),
      role: optionalString(100),
      designation: optionalString(100),
      firmName: optionalString(200),
      industry: optionalString(100),
      city: optionalString(100),
      timezone: optionalString(100),
      preferredLanguage: optionalString(50),
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), {
      message: 'No valid fields to update.',
    }),

  // POST /api/admin/invite + /api/invite
  invite: z.object({
    email: emailSchema,
    name: safeString(200).optional(),
    roleKey: safeString(64),
    organizationId: safeString(128).optional(),
    title: safeString(200).optional(),
  }),

  // POST /api/provision
  provision: z.object({
    email: emailSchema,
    name: safeString(200),
    providerKey: safeString(64),
    roleKey: safeString(64).optional(),
    title: safeString(200).optional(),
  }),

  // POST /api/gstn/verify-otp
  gstnVerifyOtp: z.object({
    organizationId: safeString(128),
    gstin: gstinSchema,
    username: safeString(100),
    otp: z.string().trim().min(4).max(16),
  }),

  // POST /api/settings/api-keys
  apiKeyCreate: z.object({
    name: safeString(100),
    scopes: z.array(safeString(64)).optional(),
    rateLimitPerMin: z.number().int().positive().max(10_000).optional(),
    rateLimitPerDay: z.number().int().positive().max(10_000_000).optional(),
    expiresInDays: z.number().int().positive().max(3650).optional(),
    createdBy: safeString(128).optional(),
    organizationId: safeString(128).optional(),
  }),

  // POST /api/oracle/chat — robust shape (the engine accepts more, we just
  // enforce a safe envelope so attackers can't smuggle weird types through).
  oracleChat: z
    .object({
      messages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant', 'oracle', 'system']).optional(),
            content: z.string().max(20_000),
          }),
        )
        .max(50)
        .optional(),
      message: z.string().max(20_000).optional(),
      context: z
        .object({ organizationId: safeString(128).optional() })
        .passthrough()
        .optional(),
      memory: z
        .object({
          userName: safeString(200).optional(),
          userId: safeString(128).optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),

  // POST /api/oracle-ai/chat
  oracleAiChat: z.object({
    sessionId: safeString(200),
    message: z.string().max(20_000),
    agentId: safeString(128).optional(),
    model: safeString(64).optional(),
    dryRun: z.boolean().optional(),
    attachments: z
      .array(
        z.object({
          name: safeString(200).optional(),
          type: safeString(100).optional(),
          size: z.number().int().nonnegative().max(20_000_000).optional(),
          dataUri: z.string().max(2_000_000).optional(),
        }),
      )
      .max(10)
      .optional(),
  }),
} as const;
