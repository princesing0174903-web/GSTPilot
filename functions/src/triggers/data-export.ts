/**
 * data-export — onCall function for exporting an organization's data as a
 * JSON payload (GDPR/staten "Right to Access" compliance).
 *
 * Requires the caller to be an `owner` or `admin`. Streams the export back
 * as a single JSON object inside the onCall response (sized for orgs up to
 * ~25k docs — beyond that the client should request a per-collection export
 * or an async Storage-delivered bundle).
 *
 * Sensitive fields (PAN, GSTIN, bank account numbers) are encrypted at rest
 * in Firestore; this function does NOT decrypt them in the export — it
 * returns them still-encrypted so the export file remains safe at rest on
 * the requester's machine. The requester's client UI surfaces a note about
 * this.
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';

interface ExportInput {
  orgId: string;
  collections?: string[]; // subset; default = all known collections
}

const DEFAULT_COLLECTIONS = [
  'documents',
  'invoices',
  'returns',
  'payments',
  'auditLogs',
  'usage',
  'bankTransactions',
  'members',
];

export const dataExport = onCall(
  { region: 'asia-south1', memory: '1GiB', timeoutSeconds: 300 },
  async (req) => {
    const callerUid = req.auth?.uid;
    const { orgId, collections } = (req.data ?? {}) as ExportInput;

    if (!orgId) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId required.' } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, orgId, 'owner', 'admin');
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    const targetCollections = collections && collections.length > 0
      ? collections
      : DEFAULT_COLLECTIONS;

    try {
      const orgSnap = await adminDb.doc(`orgs/${orgId}`).get();
      const exportPayload: Record<string, unknown> = {
        exportMeta: {
          orgId,
          exportedAt: Date.now(),
          exportedBy: callerUid ?? null,
          schemaVersion: 1,
        },
        org: orgSnap.exists ? orgSnap.data() : null,
        collections: {} as Record<string, unknown[]>,
      };

      for (const coll of targetCollections) {
        const snap = await adminDb.collection(`orgs/${orgId}/${coll}`).get();
        (exportPayload.collections as Record<string, unknown[]>)[coll] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }

      // Audit-log the export action itself.
      await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
        orgId,
        actorUid: callerUid ?? null,
        actorEmail: null,
        action: 'data.exported',
        targetType: 'org',
        targetId: orgId,
        metadata: { collections: targetCollections },
        timestamp: Date.now(),
      });

      logger.info(
        `dataExport: org=${orgId} caller=${callerUid} collections=${targetCollections.length}`,
      );
      return { ok: true, data: exportPayload };
    } catch (err) {
      logger.error('dataExport failed', err);
      return {
        ok: false,
        error: { code: 'EXPORT_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  },
);
