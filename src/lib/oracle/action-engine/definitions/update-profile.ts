// ═══════════════════════════════════════════════════════════════════════════════
// Action: Update Profile
// ═══════════════════════════════════════════════════════════════════════════════
//
// Updates the calling user's UserProfile. The UserProfile table is keyed by
// `userEmail` (NOT userId) — there is no userId column on the model (verified
// in prisma/schema.prisma). So this action resolves the email from ctx.userId:
//   1. If ctx.userId already looks like an email, use it directly.
//   2. Otherwise, look up UserProfile by userEmail = ctx.userId (covers the
//      edge case where the caller passed the email as userId).
//   3. If neither resolves, hard-error and ask the user to update from Settings.
//
// Prisma model: UserProfile { id, userEmail(unique), name?, role?, designation?,
//   firmName?, industry?, city?, timezone?, preferredLanguage?, createdAt, updatedAt }
//   NOTE: there is NO `phone` field on UserProfile — the phone param is accepted
//   for forward-compat but currently not persisted (called out in the result).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const updateProfileAction: OracleAction = {
  name: 'updateProfile',
  displayName: 'Update Profile',
  description: 'Update your user profile (name, designation, role, phone). Resolves your email from the caller context. Phone is accepted but not currently stored on the UserProfile table.',
  category: 'operations',
  icon: 'Settings',
  intentKeywords: [
    'update profile', 'edit profile', 'update my profile', 'change my name', 'update settings',
  ],
  paramSchema: [
    { key: 'name', label: 'Name', type: 'string', required: false, description: 'Display name' },
    { key: 'designation', label: 'Designation', type: 'string', required: false, description: 'Job title' },
    { key: 'role', label: 'Role', type: 'string', required: false, description: 'Role in the firm' },
    { key: 'phone', label: 'Phone', type: 'string', required: false, description: 'Phone (accepted but not currently stored)' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── At least one field ──
    const provided = ['name', 'designation', 'role', 'phone'].filter(
      (k) => args[k] !== undefined && args[k] !== null && String(args[k]).trim() !== '',
    );
    if (provided.length === 0) {
      fields.push({ key: 'name', label: 'Fields', status: 'error', message: 'Provide at least one field to update' });
      errors.push('Provide at least one field to update (name, designation, role, or phone).');
    } else {
      fields.push({ key: 'name', label: 'Fields', status: 'ok', message: `${provided.length} field(s) will be updated`, resolvedValue: provided.join(', ') });
    }

    // ── Email resolution (from ctx — but ctx isn't passed to validate, so we
    //     defer the actual email resolution to execute; here we just surface
    //     the per-field preview) ──
    if (args.name) fields.push({ key: 'name', label: 'Name', status: 'ok', resolvedValue: String(args.name) });
    if (args.designation) fields.push({ key: 'designation', label: 'Designation', status: 'ok', resolvedValue: String(args.designation) });
    if (args.role) fields.push({ key: 'role', label: 'Role', status: 'ok', resolvedValue: String(args.role) });
    if (args.phone) {
      fields.push({ key: 'phone', label: 'Phone', status: 'warn', message: 'Accepted but not stored on UserProfile table', resolvedValue: String(args.phone) });
      warnings.push('Phone is accepted but not currently persisted — the UserProfile table has no phone column. Use Settings for full contact management.');
    }

    resolvedRefs.hasFields = provided.length > 0;
    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const rows: Array<{ label: string; value: string; emphasize?: boolean }> = [];
    if (args.name) rows.push({ label: 'Name', value: String(args.name), emphasize: true });
    if (args.designation) rows.push({ label: 'Designation', value: String(args.designation) });
    if (args.role) rows.push({ label: 'Role', value: String(args.role) });
    if (args.phone) rows.push({ label: 'Phone', value: `${String(args.phone)} (not stored)` });
    if (rows.length === 0) rows.push({ label: 'Fields', value: '—' });
    return {
      title: 'Update your profile',
      fields: rows,
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'Your UserProfile row will be upserted by email.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    // ── Resolve the caller's email ──
    const userIdRaw = String(ctx.userId ?? '').trim();
    let userEmail = '';
    if (EMAIL_REGEX.test(userIdRaw)) {
      userEmail = userIdRaw;
    } else {
      // TryUserProfile lookup by userEmail (covers the case where the email
      // was passed as userId) — there is no userId column on UserProfile.
      const existing = await db.userProfile.findFirst({
        where: { userEmail: userIdRaw },
        select: { userEmail: true },
      }).catch(() => null);
      if (existing?.userEmail) {
        userEmail = existing.userEmail;
      }
    }

    if (!userEmail) {
      return { ok: false, summary: 'Could not resolve your user profile — please update it from Settings.' };
    }

    // ── Build the update payload (only fields UserProfile actually has) ──
    const data: Record<string, string> = {};
    if (args.name !== undefined && args.name !== null && String(args.name).trim() !== '') {
      data.name = String(args.name).trim();
    }
    if (args.designation !== undefined && args.designation !== null && String(args.designation).trim() !== '') {
      data.designation = String(args.designation).trim();
    }
    if (args.role !== undefined && args.role !== null && String(args.role).trim() !== '') {
      data.role = String(args.role).trim();
    }
    // NOTE: phone is intentionally NOT persisted — UserProfile has no phone column.

    if (Object.keys(data).length === 0) {
      return { ok: false, summary: 'No updatable fields provided (phone is not stored on UserProfile — supply name, designation, or role).' };
    }

    const profile = await db.userProfile.upsert({
      where: { userEmail },
      update: data,
      create: { userEmail, ...data },
      select: { id: true, userEmail: true, name: true, designation: true, role: true },
    }).catch((e) => {
      console.error('[updateProfile] userProfile.upsert failed:', e);
      return null;
    });

    if (!profile) {
      return { ok: false, summary: 'Failed to update profile. Database error.' };
    }

    await logActivity(orgId, 'settings', `Profile updated (${Object.keys(data).join(', ')})`, {
      userEmail, updatedFields: Object.keys(data),
    });

    const updatedList = Object.entries(data).map(([k, v]) => `${k}="${v}"`).join(', ');
    const phoneNote = args.phone ? ' Phone was accepted but not stored (UserProfile has no phone column).' : '';

    return {
      ok: true,
      summary: `✅ Updated your profile (${updatedList}).${phoneNote}`,
      data: {
        id: profile.id,
        userEmail: profile.userEmail,
        name: profile.name,
        designation: profile.designation,
        role: profile.role,
        updatedFields: Object.keys(data),
        phoneAccepted: Boolean(args.phone),
        phoneStored: false,
      },
      viewIn: { label: 'View in Settings', href: '/settings' },
    };
  },
};

registerAction(updateProfileAction);
