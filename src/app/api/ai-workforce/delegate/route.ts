// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — DELEGATE TASK API
// POST /api/ai-workforce/delegate
//
// Body: {
//   from: EmployeeRole,                          // one of 17 AI Employee roles
//   to: ManagementRole | 'admin' | 'owner' | 'founder' | 'accountant' | 'finance',
//   toUserId?: string,
//   task: string,
//   reason: string,
//   priority: 'critical' | 'high' | 'medium' | 'low',
//   deadline: string,
//   businessImpact: string,
//   aiConfidence: number
// }
//
// Creates a Human+AI Management™ delegation: an AI Employee hands off a task
// to a human role (CEO, CFO, Manager, Employee, or Auditor). The delegation
// enters `pending` status and is visible in the dashboard's delegations feed
// until a human accepts, declines, or escalates it.
//
// Validation:
//   • `from` must be one of the 17 EmployeeRole values (via getAllRoles()).
//   • `to` must be one of the 5 management roles (admin/owner/founder aliases
//     are accepted and normalized via resolveRole()).
//   • `task` and `reason` must be non-empty strings.
//   • `priority` must be one of critical | high | medium | low.
//   • `deadline`, `businessImpact` must be non-empty strings.
//   • `aiConfidence` must be a finite number (typically 0–100).
//
// After creation the Workforce dashboard cache is invalidated.
//
// Tagline: VEYRO AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createDelegation, invalidateWorkforceCache } from '@/lib/workforce/orchestrator';
import { resolveRole } from '@/lib/ceo/policy';
import { getAllRoles } from '@/lib/workforce/organization';
import { WORKFORCE_TAGLINE } from '@/lib/workforce/types';
import type { DelegateRequest, EmployeeRole, ManagementRole } from '@/lib/workforce/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The 17 valid AI Employee roles (loaded once at module init).
const VALID_EMPLOYEE_ROLES: ReadonlySet<EmployeeRole> = new Set(getAllRoles());

// Accepted `to` role inputs: the 5 management roles plus the aliases handled
// by resolveRole() (admin/owner/founder → ceo, accountant/finance → cfo).
const VALID_TO_ROLE_INPUTS: ReadonlySet<string> = new Set([
  'ceo',
  'cfo',
  'manager',
  'employee',
  'auditor',
  'admin',
  'owner',
  'founder',
  'accountant',
  'finance',
]);

const VALID_PRIORITIES: ReadonlySet<string> = new Set(['critical', 'high', 'medium', 'low']);

/** Helper: emit a 400 INVALID_BODY response with the standard envelope. */
function badRequest(message: string) {
  return NextResponse.json(
    {
      error: 'INVALID_BODY',
      message,
      tagline: WORKFORCE_TAGLINE,
    },
    {
      status: 400,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-AI-Workforce': 'true',
      },
    },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badRequest('Request body must be a JSON object.');
    }

    const {
      from,
      to,
      toUserId,
      task,
      reason,
      priority,
      deadline,
      businessImpact,
      aiConfidence,
    } = body as Record<string, unknown>;

    // ── Validate `from` (must be a valid EmployeeRole) ──────────────────────
    if (typeof from !== 'string' || !VALID_EMPLOYEE_ROLES.has(from.toLowerCase() as EmployeeRole)) {
      return badRequest(
        `from must be one of the 17 AI Employee roles: ${Array.from(VALID_EMPLOYEE_ROLES).join(', ')}.`,
      );
    }
    const normalizedFrom: EmployeeRole = from.toLowerCase() as EmployeeRole;

    // ── Validate `to` (must be a valid ManagementRole or alias) ─────────────
    if (typeof to !== 'string' || !VALID_TO_ROLE_INPUTS.has(to.toLowerCase())) {
      return badRequest(
        `to must be one of: ceo, cfo, manager, employee, auditor (aliases: admin/owner/founder → ceo, accountant/finance → cfo).`,
      );
    }
    const normalizedTo: ManagementRole = resolveRole(to) as ManagementRole;

    // ── Validate `task` (non-empty string) ──────────────────────────────────
    if (typeof task !== 'string' || task.trim() === '') {
      return badRequest('task is required and must be a non-empty string.');
    }

    // ── Validate `reason` (non-empty string) ────────────────────────────────
    if (typeof reason !== 'string' || reason.trim() === '') {
      return badRequest('reason is required and must be a non-empty string.');
    }

    // ── Validate `priority` (one of critical|high|medium|low) ───────────────
    if (
      typeof priority !== 'string' ||
      !VALID_PRIORITIES.has(priority.toLowerCase())
    ) {
      return badRequest(
        `priority must be one of: ${Array.from(VALID_PRIORITIES).join(', ')}.`,
      );
    }
    const normalizedPriority = priority.toLowerCase() as DelegateRequest['priority'];

    // ── Validate `deadline` (non-empty string) ──────────────────────────────
    if (typeof deadline !== 'string' || deadline.trim() === '') {
      return badRequest('deadline is required and must be a non-empty string (ISO date recommended).');
    }

    // ── Validate `businessImpact` (non-empty string) ────────────────────────
    if (typeof businessImpact !== 'string' || businessImpact.trim() === '') {
      return badRequest('businessImpact is required and must be a non-empty string.');
    }

    // ── Validate `aiConfidence` (finite number) ─────────────────────────────
    if (typeof aiConfidence !== 'number' || !Number.isFinite(aiConfidence)) {
      return badRequest('aiConfidence is required and must be a finite number (typically 0–100).');
    }

    // ── Validate optional `toUserId` (non-empty string if provided) ─────────
    const normalizedToUserId: string | undefined =
      typeof toUserId === 'string' && toUserId.trim() !== '' ? toUserId.trim() : undefined;

    const delegateReq: DelegateRequest = {
      from: normalizedFrom,
      to: normalizedTo,
      toUserId: normalizedToUserId,
      task: task.trim(),
      reason: reason.trim(),
      priority: normalizedPriority,
      deadline: deadline.trim(),
      businessImpact: businessImpact.trim(),
      aiConfidence,
    };

    const result = createDelegation(delegateReq);

    // Invalidate cache so the next dashboard GET shows the new delegation
    invalidateWorkforceCache();

    return NextResponse.json(
      { result, tagline: WORKFORCE_TAGLINE },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
          'X-Workforce-Delegation-Status': result.status,
        },
      },
    );
  } catch (error) {
    console.error('[Workforce-Delegate] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create delegation',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: WORKFORCE_TAGLINE,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-Workforce': 'true',
        },
      },
    );
  }
}
