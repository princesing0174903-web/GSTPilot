/**
 * Service Layer — Barrel Export
 *
 * Central import point for all GSTPilot service adapters.
 * Each service provides a stubbed architecture for external integrations
 * that will be connected to real APIs in V2.
 *
 * Available services:
 * - gstPortalService  → GST Portal API (GSTIN validation, return filing)
 * - ocrService        → OCR & document processing (invoice extraction)
 * - jsonGeneratorService → GST return JSON generation (GSTR-1, GSTR-3B)
 * - notificationService  → Email, WhatsApp, in-app notifications
 * - storageService    → Cloud file storage (local, S3, GCS, Azure)
 */

export { gstPortalService } from './gst-portal.service';
export type {
  GSTPortalConfig,
  GSTINValidationResult,
  GSTR2BData,
  GSTR2BSection,
} from './gst-portal.service';

export { ocrService } from './ocr.service';
export type { OCRResult } from './ocr.service';

export { jsonGeneratorService } from './json-generator.service';
export type { GSTR1JsonPayload } from './json-generator.service';

export { notificationService } from './notification.service';
export type {
  NotificationChannel,
  NotificationPayload,
} from './notification.service';

export { storageService } from './storage.service';
export type { StorageConfig, UploadedFile } from './storage.service';
