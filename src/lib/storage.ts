// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Legacy Storage Helpers (Supabase Storage)
//
// A smaller, path-based upload helper that predates the org-scoped
// `storage-service.ts`. Kept for backwards compatibility. Internals now route
// through Supabase Storage (bucket: "gstpilot-files"); the public function
// signatures are unchanged.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getSupabaseStorage,
  resolveSupabaseUrl,
  resolveSupabaseAnonKey,
  GSTPILOT_STORAGE_BUCKET,
} from './supabase';

export interface UploadResult {
  downloadURL: string;
  filePath: string;
  fileName: string;
  fileSize: number;
}

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

/**
 * Build the Supabase Storage REST URL for a direct object upload.
 */
function buildUploadUrl(path: string): string {
  const base = resolveSupabaseUrl().replace(/\/$/, '');
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  return `${base}/storage/v1/object/${GSTPILOT_STORAGE_BUCKET}/${encoded}`;
}

/**
 * Upload a file to Supabase Storage.
 * @param file - The file to upload
 * @param path - Storage path (e.g., 'uploads/invoices/filename.pdf')
 * @param onProgress - Callback for progress updates
 * @returns Promise with download URL and metadata
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadUrl = buildUploadUrl(path);
    const anonKey = resolveSupabaseAnonKey();
    const mimeType = file.type || 'application/octet-stream';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = event.total > 0 ? (event.loaded / event.total) * 100 : 0;
      onProgress?.({
        progress,
        bytesTransferred: event.loaded,
        totalBytes: event.total,
        state: 'running',
      });
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { data, error } = await getSupabaseStorage().createSignedUrl(path, 3600);
          if (error || !data?.signedUrl) {
            throw new Error('Failed to get download URL');
          }
          onProgress?.({
            progress: 100,
            bytesTransferred: file.size,
            totalBytes: file.size,
            state: 'success',
          });
          resolve({
            downloadURL: data.signedUrl,
            filePath: path,
            fileName: file.name,
            fileSize: file.size,
          });
        } catch {
          reject(new Error('Failed to get download URL'));
        }
        return;
      }
      onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        state: 'error',
      });
      reject(new Error(getUploadErrorMessage(xhr.status, xhr.responseText)));
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload. Please try again.'));
    };

    xhr.send(file);
  });
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const { error } = await getSupabaseStorage().remove([filePath]);
    if (error) {
      console.warn('[Storage] Delete error:', error.message);
      throw new Error('Failed to delete file');
    }
  } catch (error) {
    console.warn('[Storage] Delete error:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Get the appropriate storage path for a file type
 */
export function getStoragePath(folder: 'invoices' | 'gstr' | 'excel' | 'json' | 'general', fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `uploads/${folder}/${timestamp}_${sanitized}`;
}

/**
 * Check if a file type is supported for upload
 */
export function isSupportedFileType(file: File): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'text/csv',
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.json', '.jpg', '.jpeg', '.png', '.webp'];

  if (supportedTypes.includes(file.type)) return true;

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  return supportedExtensions.includes(ext);
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(file: File): 'invoices' | 'gstr' | 'excel' | 'json' | 'general' {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return 'excel';
  }
  if (type.includes('pdf')) return 'invoices';
  if (type.includes('json')) return 'json';
  if (type.includes('image')) return 'general';
  if (name.includes('gstr') || name.includes('gstr-1') || name.includes('gstr-3b')) return 'gstr';
  return 'general';
}

// ── Error message helper ──
function getUploadErrorMessage(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'You do not have permission to upload files.';
  }
  if (status === 413) {
    return 'File is too large.';
  }
  if (status === 429) {
    return 'Too many requests. Please try again shortly.';
  }
  if (body && body.toLowerCase().includes('quota')) {
    return 'Storage quota exceeded.';
  }
  return 'File upload failed. Please try again.';
}
