// ═══════════════════════════════════════════════════════════════════════════════
// Action: Invite Team Member
// ═══════════════════════════════════════════════════════════════════════════════
//
// Creates a TeamMember row. The TeamMember table has NO firmId/orgId linkage
// (verified in prisma/schema.prisma) — membership is established via the
// `userId` (Firebase UID) once the invitee signs in. So this action just
// creates the record with isActive=true + joinedAt=now.
//
// Sending the actual email invite is a separate concern (handled by the
// auth/invites layer) — this action deliberately does NOT send email.
//
// Prisma model: TeamMember { id, userId?(unique), name, email(unique), role,
//   department?, avatar?, isActive, joinedAt, createdAt, updatedAt }
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_ROLES = ['admin', 'manager', 'accountant', 'viewer'] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const inviteTeamMemberAction: OracleAction = {
  name: 'inviteTeamMember',
  displayName: 'Invite Team Member',
  description: 'Invite a colleague to the workspace by creating a TeamMember record (name, email, role, department). Does NOT send an email — that is handled by the auth/invites layer.',
  category: 'operations',
  icon: 'UserPlus',
  intentKeywords: [
    'invite team member', 'add team member', 'invite user', 'add user',
    'invite colleague', 'add staff',
  ],
  paramSchema: [
    { key: 'name', label: 'Name', type: 'string', required: true, description: 'Full name of the invitee' },
    { key: 'email', label: 'Email', type: 'string', required: true, description: 'Email address (must be unique)' },
    { key: 'role', label: 'Role', type: 'enum', required: true, options: [...VALID_ROLES], description: 'admin / manager / accountant / viewer' },
    { key: 'department', label: 'Department', type: 'string', required: false, description: 'Optional department' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Name ──
    const name = String(args.name ?? '').trim();
    if (!name) {
      fields.push({ key: 'name', label: 'Name', status: 'error', message: 'Name is required' });
      errors.push('Name is required.');
    } else {
      fields.push({ key: 'name', label: 'Name', status: 'ok', resolvedValue: name });
      resolvedRefs.name = name;
    }

    // ── Email ──
    const email = String(args.email ?? '').trim().toLowerCase();
    if (!email) {
      fields.push({ key: 'email', label: 'Email', status: 'error', message: 'Email is required' });
      errors.push('Email is required.');
    } else if (!EMAIL_REGEX.test(email)) {
      fields.push({ key: 'email', label: 'Email', status: 'error', message: 'Invalid email format', resolvedValue: email });
      errors.push(`Email "${email}" is not a valid email address.`);
    } else {
      const dup = await db.teamMember.findFirst({
        where: { email },
        select: { id: true, name: true, email: true },
      }).catch(() => null);
      if (dup) {
        fields.push({ key: 'email', label: 'Email', status: 'error', message: 'A team member with this email already exists', resolvedValue: email });
        errors.push('A team member with this email already exists.');
      } else {
        fields.push({ key: 'email', label: 'Email', status: 'ok', resolvedValue: email });
        resolvedRefs.email = email;
      }
    }

    // ── Role ──
    const role = String(args.role ?? '').toLowerCase();
    if (!VALID_ROLES.includes(role as any)) {
      fields.push({ key: 'role', label: 'Role', status: 'error', message: `Must be one of: ${VALID_ROLES.join(', ')}`, resolvedValue: role });
      errors.push(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}.`);
    } else {
      fields.push({ key: 'role', label: 'Role', status: 'ok', resolvedValue: role });
      resolvedRefs.role = role;
    }

    // ── Department ──
    if (args.department) {
      fields.push({ key: 'department', label: 'Department', status: 'ok', resolvedValue: String(args.department) });
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const name = refs.name ?? String(args.name ?? '—');
    const email = refs.email ?? (args.email ? String(args.email) : '—');
    const role = refs.role ?? (args.role ? String(args.role) : '—');
    const department = args.department ? String(args.department) : '—';
    return {
      title: `Invite ${name} as ${role}`,
      fields: [
        { label: 'Name', value: name, emphasize: true },
        { label: 'Email', value: email, emphasize: true },
        { label: 'Role', value: role, emphasize: true },
        { label: 'Department', value: department },
      ],
      note: 'A TeamMember record will be created with status active. This does NOT send an invite email — use the Team page to send the actual invitation.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const name = String(args.name).trim();
    const email = String(args.email).trim().toLowerCase();
    const role = VALID_ROLES.includes(String(args.role).toLowerCase() as any)
      ? String(args.role).toLowerCase()
      : 'viewer';
    const department = args.department ? String(args.department).trim() : null;

    const member = await db.teamMember.create({
      data: {
        name,
        email,
        role,
        department,
        isActive: true,
        joinedAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, department: true, isActive: true },
    }).catch((e) => {
      console.error('[inviteTeamMember] teamMember.create failed:', e);
      return null;
    });

    if (!member) {
      return { ok: false, summary: `Failed to invite team member "${name}". Database error.` };
    }

    await logActivity(orgId, 'team', `Team member ${name} invited (role: ${role}${department ? `, dept: ${department}` : ''})`, {
      teamMemberId: member.id, name, email, role, department,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'team.member_invited',
      title: `Team member ${name} added`,
      description: `Role: ${role}${department ? ` · department: ${department}` : ''} · ${email}.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { teamMemberId: member.id, name, email, role, department },
    });

    return {
      ok: true,
      summary: `✅ Added team member **${name}** (${email}) as **${role}**${department ? ` in ${department}` : ''}. The record is active — send the actual invitation email from the Team page.`,
      data: { id: member.id, name: member.name, email: member.email, role: member.role, department: member.department, isActive: member.isActive },
      viewIn: { label: 'View in Team', href: '/team' },
    };
  },
};

registerAction(inviteTeamMemberAction);
