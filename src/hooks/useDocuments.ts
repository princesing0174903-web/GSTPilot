'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useDocuments() Hook
//
// The single hook every GSTPilot component uses to:
//   • LIST documents for the current organization (real-time, org-scoped)
//   • UPLOAD files to Firebase Storage (+ write Firestore metadata)
//   • DELETE a document (Storage file + Firestore metadata)
//   • DOWNLOAD / PREVIEW a stored file
//
// All tenant scoping is automatic — components never touch `organizationId`
// directly. If the user has no organization yet, every operation no-ops safely.
//
// Upload progress is tracked per-file in `uploads` so any UI can render a
// progress bar without wiring its own state machine.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadFile as storageUploadFile,
  deleteFile as storageDeleteFile,
  getDownloadURL as storageGetDownloadURL,
  validateFile,
  guessCategory,
  friendlyStorageError,
  type StorageCategory,
  type UploadProgress,
} from '@/lib/firebase/storage-service';
import {
  subscribeToDocuments,
  createDocument,
  deleteDocumentWithFile,
  type DocumentMetadata,
  type CreateDocumentInput,
} from '@/lib/firebase/documents-service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadEntry {
  /** Stable id for React keys (file name + start time). */
  id: string;
  fileName: string;
  category: StorageCategory;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'uploading' | 'success' | 'error';
  error?: string;
  startedAt: number;
}

export interface UploadDocumentParams {
  file: File;
  category?: StorageCategory;
  tags?: string[];
  subPath?: string;
  linkedTo?: DocumentMetadata['linkedTo'];
}

export interface UseDocumentsResult {
  /** Documents for the current org (real-time). */
  documents: DocumentMetadata[];
  loading: boolean;
  error: string | null;
  /** Active + recent uploads (kept until the component unmounts). */
  uploads: UploadEntry[];
  /** True while any upload is in-flight. */
  isUploading: boolean;

  /** Upload a single file. Resolves with the created metadata. */
  upload: (params: UploadDocumentParams) => Promise<DocumentMetadata | null>;
  /** Upload many files in parallel. Returns only the successful ones. */
  uploadMany: (
    files: File[],
    options?: { category?: StorageCategory; tags?: string[]; subPath?: string },
  ) => Promise<DocumentMetadata[]>;
  /** Delete a document (Storage + Firestore). */
  remove: (documentId: string) => Promise<void>;
  /** Get a fresh download URL for a document (for preview / download). */
  getDownloadUrl: (documentId: string) => Promise<string | null>;
  /** Convenience: validate a File the same way `upload` does. */
  validate: (file: File) => string | null;
  /** Clear completed / errored uploads from the UI. */
  clearUploads: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDocuments(
  categoryFilter?: StorageCategory,
): UseDocumentsResult {
  const { organization, profile, isPreviewMode } = useOrg();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  // The current organization id (read directly from context).
  const orgId = organization?.id ?? null;

  // ── Real-time subscription to the org's documents ──
  useEffect(() => {
    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      // Genuine sign-out / no-org / preview state — clear synchronously. This mirrors
      // the pattern used in OrgContext for the same auth-driven reset.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocuments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDocuments(
      orgId,
      (docs) => {
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      {
        category: categoryFilter,
        onError: (err) => {
          console.warn('[useDocuments] subscription error:', err);
          setError('Could not load documents. Please refresh the page.');
          setLoading(false);
        },
      },
    );

    return () => unsubscribe();
  }, [orgId, isPreviewMode, categoryFilter]);

  // ── Upload ──
  // Plain async function — the React Compiler (Next.js 16) auto-memoizes it
  // based on its actual dependencies (orgId, user, profile?.name). This avoids
  // the "memoization could not be preserved" error that useCallback hits on
  // complex async bodies with multiple setState calls.
  const upload = async (
    params: UploadDocumentParams,
  ): Promise<DocumentMetadata | null> => {
    if (!orgId) {
      setError('You need an organization before uploading files.');
      return null;
    }
    if (!user) {
      setError('Please sign in to upload files.');
      return null;
    }

    const { file } = params;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    const category = params.category ?? guessCategory(file);
    const uploadId = `${file.name}-${Date.now()}`;

    // Seed the upload entry so the UI can render a progress bar instantly.
    setUploads((prev) => [
      ...prev,
      {
        id: uploadId,
        fileName: file.name,
        category,
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'uploading',
        startedAt: Date.now(),
      },
    ]);

    const onProgress = (p: UploadProgress) => {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                progress: p.progress,
                bytesTransferred: p.bytesTransferred,
                totalBytes: p.totalBytes,
              }
            : u,
        ),
      );
    };

    try {
      const uploaded = await storageUploadFile(file, {
        organizationId: orgId,
        category,
        subPath: params.subPath,
        onProgress,
        customMetadata: {
          uploadedByUid: user.id,
          uploadedByEmail: user.email,
        },
      });

      const input: CreateDocumentInput = {
        organizationId: orgId,
        uploadedBy: {
          uid: user.id,
          name: profile?.name || user.name,
          email: user.email,
        },
        category,
        originalName: file.name,
        storagePath: uploaded.storagePath,
        downloadURL: uploaded.downloadURL,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        tags: params.tags ?? [],
        linkedTo: params.linkedTo,
      };

      const metadata = await createDocument(input);

      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, state: 'success', progress: 100 } : u,
        ),
      );

      return metadata;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : friendlyStorageError(err);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, state: 'error', error: message } : u,
        ),
      );
      setError(message);
      return null;
    }
  };

  // ── Upload many (parallel) ──
  const uploadMany = async (
    files: File[],
    options?: {
      category?: StorageCategory;
      tags?: string[];
      subPath?: string;
    },
  ): Promise<DocumentMetadata[]> => {
    // Upload in parallel — Firebase handles concurrent uploads efficiently.
    const results = await Promise.all(
      files.map((file) =>
        upload({
          file,
          category: options?.category,
          tags: options?.tags,
          subPath: options?.subPath,
        }),
      ),
    );
    return results.filter((r): r is DocumentMetadata => r !== null);
  };

  // ── Delete ──
  const remove = useCallback(async (documentId: string): Promise<void> => {
    if (!orgId) {
      setError('You need an organization to delete files.');
      return;
    }
    try {
      await deleteDocumentWithFile(documentId, orgId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : friendlyStorageError(err);
      setError(message);
      throw new Error(message);
    }
  }, [orgId]);

  // ── Get download URL ──
  const getDownloadUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      if (!orgId) return null;
      const doc = documents.find((d) => d.id === documentId);
      if (!doc) return null;
      try {
        return await storageGetDownloadURL(doc.storagePath);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : friendlyStorageError(err);
        setError(message);
        return null;
      }
    },
    [orgId, documents],
  );

  // ── Validate (exposed for pre-flight UI checks) ──
  const validate = useCallback((file: File): string | null => {
    return validateFile(file);
  }, []);

  // ── Clear finished uploads ──
  const clearUploads = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.state === 'uploading'));
  }, []);

  const isUploading = uploads.some((u) => u.state === 'uploading');

  return {
    documents,
    loading,
    error,
    uploads,
    isUploading,
    upload,
    uploadMany,
    remove,
    getDownloadUrl,
    validate,
    clearUploads,
  };
}
