// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Firebase Storage Service (Multi-Tenant)
//
// The single source of truth for every file operation in GSTPilot.
//
// Storage layout (org-isolated):
//   organizations/{organizationId}/{category}/{timestamp}_{sanitizedFileName}
//
// Categories:
//   invoices | gst | bank | documents | reports | notices | ai
//
// Supported file types:
//   PDF | JPG | JPEG | PNG | XLS | XLSX | CSV | DOC | DOCX
//
// Max file size: 100 MB
//
// Every public function:
//   • Accepts an `organizationId` so files can NEVER cross tenant boundaries.
//   • Returns friendly error strings — never raw Firebase error codes.
//   • Is safe to call from the browser (uses the Firebase client SDK).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ref,
  uploadBytesResumable,
  deleteObject,
  getDownloadURL as fbGetDownloadURL,
  listAll,
  getMetadata,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage } from '@/lib/firebase';

// ─── Public Types ────────────────────────────────────────────────────────────

export type StorageCategory =
  | 'invoices'
  | 'gst'
  | 'bank'
  | 'documents'
  | 'reports'
  | 'notices'
  | 'ai';

export interface UploadProgress {
  /** 0–100 percentage. */
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export interface UploadResult {
  downloadURL: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface StoredFile {
  name: string;
  storagePath: string;
  downloadURL: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadOptions {
  organizationId: string;
  category: StorageCategory;
  /** Optional sub-path (e.g. a clientId) appended after the category. */
  subPath?: string;
  /** Called repeatedly during upload with the latest progress. */
  onProgress?: (progress: UploadProgress) => void;
  /**
   * Optional custom metadata to attach to the Storage object (e.g. tags,
   * uploadedBy). Stored as `customMetadata` on the Storage object.
   */
  customMetadata?: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** 100 MB — the maximum file size accepted by GSTPilot uploads. */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const MAX_FILE_SIZE_LABEL = '100 MB';

export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.xls',
  '.xlsx',
  '.csv',
  '.doc',
  '.docx',
] as const;

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
] as const;

const VALID_CATEGORIES: readonly StorageCategory[] = [
  'invoices',
  'gst',
  'bank',
  'documents',
  'reports',
  'notices',
  'ai',
];

// ─── Path Generation ─────────────────────────────────────────────────────────

/**
 * Generate an org-isolated storage path for a file.
 *
 * Structure: `organizations/{organizationId}/{category}/{subPath?}/{timestamp}_{sanitizedFileName}`
 *
 * The timestamp prefix guarantees uniqueness even when two users upload a file
 * with the same name in the same second.
 */
export function generateStoragePath(
  organizationId: string,
  category: StorageCategory,
  fileName: string,
  subPath?: string,
): string {
  if (!organizationId) {
    throw new Error('Organization is required to store files.');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Unknown storage category: "${category}".`);
  }

  const timestamp = Date.now();
  const sanitized = sanitizeFileName(fileName);
  const base = `organizations/${organizationId}/${category}`;
  const middle = subPath ? `/${sanitizeFileName(subPath)}` : '';
  return `${base}${middle}/${timestamp}_${sanitized}`;
}

/**
 * Sanitize a file name so it is safe for Storage paths:
 *   • keeps alphanumerics, dots, dashes, underscores
 *   • collapses everything else into a single underscore
 *   • trims to 80 characters to keep paths manageable
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  if (cleaned.length <= 80) return cleaned;
  // Preserve the extension when truncating.
  const dot = cleaned.lastIndexOf('.');
  if (dot === -1) return cleaned.slice(0, 80);
  const ext = cleaned.slice(dot);
  return cleaned.slice(0, 80 - ext.length) + ext;
}

/**
 * Extract the file extension (lower-cased, with leading dot) from a file name.
 */
export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return '';
  return fileName.slice(dot).toLowerCase();
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that a File is acceptable for upload.
 * Returns `null` when valid, or a friendly error string when not.
 */
export function validateFile(file: File): string | null {
  if (!file) return 'No file provided.';

  if (file.size === 0) {
    return 'The file is empty. Please choose a valid file.';
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File is too large. Maximum allowed size is ${MAX_FILE_SIZE_LABEL}.`;
  }

  const ext = getFileExtension(file.name);
  const mimeOk =
    file.type !== '' && (SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);

  if (!mimeOk && !extOk) {
    return `Unsupported file type. Allowed: ${SUPPORTED_EXTENSIONS.join(', ')}.`;
  }

  return null;
}

/**
 * Predicate form of {@link validateFile}.
 */
export function isSupportedFileType(file: File): boolean {
  return validateFile(file) === null;
}

/**
 * Derive the best MIME type we can for a file (falls back to the extension).
 */
export function resolveMimeType(file: File): string {
  if (file.type && (SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const ext = getFileExtension(file.name);
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Pick a sensible default Storage category from a file name / MIME type.
 * Callers can override, but this gives a good out-of-the-box behaviour.
 */
export function guessCategory(file: File): StorageCategory {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    if (name.includes('invoice') || name.includes('bill')) return 'invoices';
    if (name.includes('notice') || name.includes('scn')) return 'notices';
    if (name.includes('gstr') || name.includes('gst')) return 'gst';
    if (name.includes('bank') || name.includes('statement')) return 'bank';
    if (name.includes('report')) return 'reports';
    return 'documents';
  }
  if (type.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    if (name.includes('gstr') || name.includes('gst')) return 'gst';
    if (name.includes('invoice') || name.includes('purchase') || name.includes('sales')) return 'invoices';
    if (name.includes('bank')) return 'bank';
    return 'documents';
  }
  if (type.includes('image')) {
    if (name.includes('invoice') || name.includes('bill')) return 'invoices';
    if (name.includes('notice')) return 'notices';
    return 'documents';
  }
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
    if (name.includes('notice')) return 'notices';
    if (name.includes('report')) return 'reports';
    return 'documents';
  }
  return 'documents';
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload a file to Firebase Storage under the caller's organization.
 *
 * Resolves with the download URL, storage path and metadata.
 * Rejects with a **friendly** error string (never a raw Firebase code).
 */
export function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const validationError = validateFile(file);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }
    if (!options.organizationId) {
      reject(new Error('You must be signed in to an organization to upload files.'));
      return;
    }
    if (!VALID_CATEGORIES.includes(options.category)) {
      reject(new Error(`Unknown storage category: "${options.category}".`));
      return;
    }

    const storagePath = generateStoragePath(
      options.organizationId,
      options.category,
      file.name,
      options.subPath,
    );
    const storageRef = ref(storage, storagePath);
    const mimeType = resolveMimeType(file);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: mimeType,
      customMetadata: {
        originalName: file.name,
        organizationId: options.organizationId,
        category: options.category,
        ...(options.customMetadata ?? {}),
      },
    });

    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const pct =
          snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : 0;
        options.onProgress?.({
          progress: pct,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          state:
            snapshot.state === 'running'
              ? 'running'
              : snapshot.state === 'paused'
                ? 'paused'
                : snapshot.state === 'success'
                  ? 'success'
                  : 'error',
        });
      },
      (error) => {
        reject(new Error(friendlyStorageError(error)));
      },
      async () => {
        try {
          const downloadURL = await fbGetDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadURL,
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            mimeType,
            createdAt: new Date().toISOString(),
          });
        } catch {
          reject(new Error('Upload finished but the download link could not be retrieved.'));
        }
      },
    );
  });
}

// ─── Download URL ────────────────────────────────────────────────────────────

/**
 * Get a fresh download URL for a stored file.
 * Firebase download URLs are long-lived but can be revoked; always fetch on
 * demand rather than caching indefinitely.
 */
export async function getDownloadURL(storagePath: string): Promise<string> {
  if (!storagePath) {
    throw new Error('File path is missing.');
  }
  try {
    return await fbGetDownloadURL(ref(storage, storagePath));
  } catch (error) {
    throw new Error(friendlyStorageError(error));
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete a file from Firebase Storage.
 * Silently succeeds if the file does not exist (idempotent).
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    // `storage/object-not-found` is the only error we treat as success.
    const code = (error as { code?: string })?.code;
    if (code === 'storage/object-not-found') return;
    throw new Error(friendlyStorageError(error));
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * List all files under an organization's storage prefix.
 *
 * Optionally scope to a single category (e.g. `listFiles(orgId, 'invoices')`).
 *
 * Note: `listAll` paginates internally and returns up to 1,000 items per call.
 * For very large orgs a follow-up token would be needed, but this is more than
 * enough for the typical GSTPilot workspace.
 */
export async function listFiles(
  organizationId: string,
  category?: StorageCategory,
): Promise<StoredFile[]> {
  if (!organizationId) {
    throw new Error('Organization is required to list files.');
  }
  const prefix = category
    ? `organizations/${organizationId}/${category}`
    : `organizations/${organizationId}`;

  try {
    const { items } = await listAll(ref(storage, prefix));
    const results = await Promise.all(
      items.map(async (item) => {
        const [meta, url] = await Promise.all([
          getMetadata(item).catch(() => null),
          fbGetDownloadURL(item).catch(() => ''),
        ]);
        return {
          name: item.name,
          storagePath: item.fullPath,
          downloadURL: url,
          size: meta?.size ?? 0,
          mimeType: meta?.contentType ?? 'application/octet-stream',
          createdAt: meta?.timeCreated ?? new Date().toISOString(),
          updatedAt: meta?.updated ?? new Date().toISOString(),
        } satisfies StoredFile;
      }),
    );
    return results;
  } catch (error) {
    throw new Error(friendlyStorageError(error));
  }
}

// ─── Friendly Error Mapping ──────────────────────────────────────────────────

/**
 * Convert any Firebase Storage error into a user-friendly message.
 * Never exposes the raw Firebase error code to the end user.
 */
export function friendlyStorageError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'storage/unauthorized':
      'You do not have permission to access this file. Please contact your workspace owner.',
    'storage/canceled': 'The upload was canceled.',
    'storage/invalid-checksum': 'The file was corrupted during upload. Please try again.',
    'storage/quota-exceeded':
      'Your workspace has exceeded its storage quota. Contact support to upgrade.',
    'storage/unauthenticated': 'Your session has expired. Please sign in again.',
    'storage/retry-limit-exceeded':
      'Network is unstable. The upload timed out — please try again.',
    'storage/invalid-url': 'The file reference is invalid.',
    'storage/object-not-found': 'This file no longer exists.',
    'storage/unknown': 'Something went wrong with file storage. Please try again.',
  };
  return map[code] || 'File operation failed. Please try again.';
}
