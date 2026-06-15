import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

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
 * Upload a file to Firebase Storage
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
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          progress,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          state: snapshot.state === 'running' ? 'running' :
                 snapshot.state === 'paused' ? 'paused' :
                 snapshot.state === 'success' ? 'success' : 'error',
        });
      },
      (error) => {
        console.error('[Storage] Upload error:', error);
        reject(new Error(getUploadErrorMessage(error)));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadURL,
            filePath: path,
            fileName: file.name,
            fileSize: file.size,
          });
        } catch (error) {
          reject(new Error('Failed to get download URL'));
        }
      }
    );
  });
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
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
function getUploadErrorMessage(error: { code?: string }): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'storage/unauthorized': 'You do not have permission to upload files.',
    'storage/canceled': 'Upload was canceled.',
    'storage/unknown': 'An unknown error occurred during upload.',
    'storage/quota-exceeded': 'Storage quota exceeded.',
    'storage/invalid-checksum': 'File upload failed - checksum mismatch.',
  };
  return messages[code] || 'File upload failed. Please try again.';
}
