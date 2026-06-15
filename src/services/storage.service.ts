/**
 * Cloud Storage Service
 *
 * Provides an adapter layer for file storage operations across multiple
 * cloud providers: local filesystem, AWS S3, Google Cloud Storage, and Azure.
 *
 * Current state:
 * - Upload returns a mock result with local path
 * - Download and delete throw not-implemented errors
 *
 * V2 roadmap:
 * - S3 integration for production file storage
 * - GCS and Azure Blob support
 * - Pre-signed URLs for secure uploads
 * - File versioning and metadata
 * - Automatic cleanup of expired files
 */

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface UploadedFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

class StorageService {
  private config: StorageConfig = { provider: 'local' };

  /**
   * Configure the storage provider and credentials.
   * Switch between local, S3, GCS, or Azure storage.
   */
  configure(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Upload a file to the configured storage provider.
   * Currently returns a mock result — V2 will use real cloud storage.
   */
  async upload(file: File | Blob, path: string): Promise<UploadedFile> {
    // Stub — will use real cloud storage in V2
    // For now, just return a mock result
    return {
      key: path,
      url: `/storage/${path}`,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Download a file from storage by its key.
   * V2 will stream files from the configured cloud provider.
   */
  async download(key: string): Promise<Blob> {
    throw new Error(
      'Storage download not implemented. Configure cloud storage first.'
    );
  }

  /**
   * Delete a file from storage by its key.
   * V2 will delete from the configured cloud provider.
   */
  async delete(key: string): Promise<void> {
    throw new Error(
      'Storage delete not implemented. Configure cloud storage first.'
    );
  }

  /**
   * Get the public URL for a stored file.
   * Returns a local path by default — V2 will return cloud URLs.
   */
  getPublicUrl(key: string): string {
    return `/storage/${key}`;
  }
}

export const storageService = new StorageService();
