/**
 * Shared types used across Cloud Functions triggers.
 *
 * These mirror the shapes written by the Next.js client/service layer
 * (see src/lib/billing-provider/types.ts, src/lib/erp-provider/types.ts,
 * src/lib/communication-provider/types.ts in the Next.js app).
 * Kept minimal — only fields the server actually touches.
 */

export type OrgRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export interface OrgMembership {
  uid: string;
  orgId: string;
  role: OrgRole;
  status: 'active' | 'invited' | 'suspended';
  joinedAt: number;
}

export interface Org {
  id: string;
  name: string;
  ownerId: string;
  planId: string;
  createdAt: number;
}

/** Audit log entry stored under /orgs/{orgId}/auditLogs/{logId}. */
export interface AuditLogEntry {
  orgId: string;
  actorUid: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  ip?: string;
  userAgent?: string;
}

/** Razorpay webhook payload (subset of fields we read). */
export interface RazorpayWebhookEvent {
  entity: 'event';
  account_id?: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id?: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        email?: string;
        contact?: string;
        notes?: Record<string, string>;
      };
    };
    subscription?: {
      entity: {
        id: string;
        entity_id?: string;
        status: string;
        current_end?: number;
      };
    };
  };
}

/** Stripe webhook event (minimal subset). */
export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/** onCall request envelope (subset of CallableRequest we depend on). */
export interface CallRequest<T = unknown> {
  data: T;
  auth?: {
    uid: string;
    token?: {
      email?: string;
      name?: string;
      [k: string]: unknown;
    };
  } | null;
  rawRequest?: unknown;
}

/** Result envelope for onCall functions that need to surface errors safely. */
export interface CallResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/** Sensitive credential field stored encrypted at rest. */
export interface EncryptedField {
  /** Base64-encoded ciphertext (includes IV + auth tag prepended). */
  v: string;
  /** Always 'aes-256-gcm'. */
  alg: 'aes-256-gcm';
  /** ISO timestamp of last rotation, optional. */
  rotatedAt?: string;
}
