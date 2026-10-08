// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Storage Service (Multi-Tenant) — Supabase Storage
//
// The single source of truth for every file operation in VEYRO.
//
// Backed by Supabase Storage (bucket: "gstpilot-files"). Firebase
// Authentication, Firestore, and Firebase Functions are NOT touched — only the
// file-storage layer was migrated from Firebase Storage to Supabase Storage.
//
// Storage layout (org-isolated, unchanged from the Firebase era):
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
//   • Returns friendly error strings — never raw SDK error codes.
//   • Is safe to call from the browser (uses the Supabase anon key).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getSupabaseStorage,
  resolveSupabaseUrl,
  resolveSupabaseAnonKey,
  GSTPILOT_STORAGE_BUCKET,
} from '@/lib/supabase';

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
   * uploadedBy). Stored via Supabase object metadata (`metadata` option).
   */
  customMetadata?: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** 100 MB — the maximum file size accepted by VEYRO uploads. */
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

/** Signed-URL expiry (seconds) for on-demand download URLs. */
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

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
 * Build the Supabase Storage REST URL for a direct object upload.
 *
 * Supabase exposes a REST endpoint that accepts a raw PUT/POST body, which lets
 * us wire `XMLHttpRequest.upload.onprogress` for real progress reporting — the
 * JS SDK's `upload()` does not expose progress.
 */
function buildUploadUrl(storagePath: string): string {
  const base = resolveSupabaseUrl().replace(/\/$/, '');
  const encoded = encodeURIComponent(storagePath).replace(/%2F/g, '/');
  return `${base}/storage/v1/object/${GSTPILOT_STORAGE_BUCKET}/${encoded}`;
}

/**
 * Upload a file to Supabase Storage under the caller's organization.
 *
 * Uses XMLHttpRequest so we can report real upload progress through the
 * `onProgress` callback (matching the previous Firebase contract exactly).
 *
 * Resolves with the download URL, storage path and metadata.
 * Rejects with a **friendly** error string (never a raw SDK error).
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
    const mimeType = resolveMimeType(file);
    const uploadUrl = buildUploadUrl(storagePath);
    const anonKey = resolveSupabaseAnonKey();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('Content-Type', mimeType);
    // Don't overwrite an existing object at the same path — fail instead. The
    // timestamp prefix in `generateStoragePath` makes collisions near-impossible,
    // but `x-upsert: false` keeps the semantic identical to Firebase's default.
    xhr.setRequestHeader('x-upsert', 'false');

    // Report progress throughout the upload.
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = event.total > 0 ? (event.loaded / event.total) * 100 : 0;
      options.onProgress?.({
        progress: pct,
        bytesTransferred: event.loaded,
        totalBytes: event.total,
        state: 'running',
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Upload succeeded — mint a signed download URL for the result.
        options.onProgress?.({
          progress: 100,
          bytesTransferred: file.size,
          totalBytes: file.size,
          state: 'success',
        });
        getDownloadURL(storagePath)
          .then((downloadURL) => {
            resolve({
              downloadURL,
              storagePath,
              fileName: file.name,
              fileSize: file.size,
              mimeType,
              createdAt: new Date().toISOString(),
            });
          })
          .catch(() => {
            reject(
              new Error(
                'Upload finished but the download link could not be retrieved.',
              ),
            );
          });
        return;
      }
      // Non-2xx — translate to a friendly error.
      options.onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'error',
      });
      reject(new Error(friendlyStorageError({ status: xhr.status, body: xhr.responseText })));
    };

    xhr.onerror = () => {
      options.onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'error',
      });
      reject(
        new Error(
          'Network error during upload. Please check your connection and try again.',
        ),
      );
    };

    xhr.onabort = () => {
      reject(new Error('The upload was canceled.'));
    };

    xhr.send(file);
  });
}

// ─── Download URL ────────────────────────────────────────────────────────────

/**
 * Get a fresh signed download URL for a stored file.
 *
 * Supabase signed URLs expire after {@link SIGNED_URL_EXPIRY_SECONDS}, so
 * callers should always fetch on demand rather than caching indefinitely —
 * exactly the same guidance the previous Firebase implementation documented.
 */
export async function getDownloadURL(storagePath: string): Promise<string> {
  if (!storagePath) {
    throw new Error('File path is missing.');
  }
  try {
    const { data, error } = await getSupabaseStorage().createSignedUrl(
      storagePath,
      SIGNED_URL_EXPIRY_SECONDS,
    );
    if (error) {
      throw new Error(friendlyStorageError(error));
    }
    if (!data?.signedUrl) {
      throw new Error('File operation failed. Please try again.');
    }
    return data.signedUrl;
  } catch (error) {
    // Re-throw if it's already a friendly Error we constructed.
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(friendlyStorageError(error));
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete a file from Supabase Storage.
 * Silently succeeds if the file does not exist (idempotent).
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    const { error } = await getSupabaseStorage().remove([storagePath]);
    if (error) {
      // "not found" style errors are treated as success (idempotent delete).
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist')) return;
      throw new Error(friendlyStorageError(error));
    }
  } catch (error) {
    const msg =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes('not found') || msg.includes('does not exist')) return;
    throw new Error(friendlyStorageError(error));
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * List all files under an organization's storage prefix.
 *
 * Optionally scope to a single category (e.g. `listFiles(orgId, 'invoices')`).
 *
 * Note: Supabase `list()` returns up to 1,000 items per call. For very large
 * orgs a follow-up token would be needed, but this is more than enough for the
 * typical VEYRO workspace.
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
    const { data, error } = await getSupabaseStorage().list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) {
      throw new Error(friendlyStorageError(error));
    }
    if (!data || data.length === 0) return [];

    // Supabase `list()` returns item names relative to the prefix. Rebuild the
    // full storage path and fetch a signed URL + metadata for each in parallel.
    const results = await Promise.all(
      data.map(async (item) => {
        const fullPath = prefix.endsWith('/')
          ? `${prefix}${item.name}`
          : `${prefix}/${item.name}`;
        const [urlResult] = await Promise.all([
          getSupabaseStorage()
            .createSignedUrl(fullPath, SIGNED_URL_EXPIRY_SECONDS)
            .then((r) => (r.data?.signedUrl ?? ''))
            .catch(() => ''),
        ]);
        const meta = (item.metadata ?? {}) as {
          size?: number;
          mimetype?: string;
        };
        return {
          name: item.name,
          storagePath: fullPath,
          downloadURL: urlResult,
          size: Number(meta.size ?? 0),
          mimeType: meta.mimetype ?? 'application/octet-stream',
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? new Date().toISOString(),
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
 * Convert any Supabase Storage error into a user-friendly message.
 * Never exposes the raw SDK error to the end user.
 */
export function friendlyStorageError(error: unknown): string {
  if (!error) return 'File operation failed. Please try again.';

  // Supabase errors typically carry a `message` and sometimes an `error` code
  // string (e.g. "InvalidApiKey", "Unauthorized", "NotFound").
  const err = error as {
    message?: string;
    error?: string;
    statusCode?: number | string;
    status?: number;
    body?: string;
  };

  const rawMessage =
    (typeof err.message === 'string' && err.message) ||
    (typeof err.body === 'string' && err.body) ||
    '';

  const code = (err.error || '').toLowerCase();
  const status = Number(err.statusCode ?? err.status ?? 0);
  const msg = rawMessage.toLowerCase();

  // Auth / permission errors.
  if (
    code.includes('invalidapikey') ||
    code.includes('unauthorized') ||
    status === 401 ||
    status === 403 ||
    msg.includes('permission') ||
    msg.includes('denied') ||
    msg.includes('unauthorized') ||
    msg.includes('not allowed')
  ) {
    return 'You do not have permission to access this file. Please contact your workspace owner.';
  }

  // Not found.
  if (
    code.includes('notfound') ||
    status === 404 ||
    msg.includes('not found') ||
    msg.includes('does not exist')
  ) {
    return 'This file no longer exists.';
  }

  // Quota / billing.
  if (
    code.includes('quota') ||
    code.includes('billing') ||
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('exceeded')
  ) {
    return 'Your workspace has exceeded its storage quota. Contact support to upgrade.';
  }

  // Payload too large.
  if (status === 413 || code.includes('payloadtoolarge') || msg.includes('too large')) {
    return 'File is too large. Maximum allowed size is 100 MB.';
  }

  // Network / retry.
  if (
    code.includes('network') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('retry')
  ) {
    return 'Network is unstable. The upload timed out — please try again.';
  }

  return 'File operation failed. Please try again.';
}
