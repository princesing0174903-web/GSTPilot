/**
 * OCR & Document Processing Service
 *
 * Provides an adapter layer for extracting structured data from invoices and
 * documents using Optical Character Recognition (OCR).
 *
 * V2 roadmap:
 * - PDF OCR via z-ai-web-dev-sdk VLM
 * - Image OCR via z-ai-web-dev-sdk VLM
 * - Excel parsing with xlsx library
 * - Batch processing for multiple documents
 * - Confidence scoring and validation
 */

export interface OCRResult {
  success: boolean;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  sellerGstin: string | null;
  buyerGstin: string | null;
  taxableValue: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  totalAmount: number | null;
  hsnCode: string | null;
  confidence: number;
  rawText: string | null;
  error?: string;
}

class OCRService {
  /**
   * Extract invoice data from a PDF file.
   * V2 will use z-ai-web-dev-sdk VLM for real OCR extraction.
   */
  async extractFromPDF(file: File | Blob): Promise<OCRResult> {
    // Stub — will use z-ai-web-dev-sdk VLM for real OCR
    throw new Error('OCR extraction not implemented. Connect VLM service first.');
  }

  /**
   * Extract invoice data from an image file (JPG, PNG, etc.).
   * V2 will use z-ai-web-dev-sdk VLM for image-based extraction.
   */
  async extractFromImage(file: File | Blob): Promise<OCRResult> {
    throw new Error('Image OCR not implemented. Connect VLM service first.');
  }

  /**
   * Parse invoice data from an Excel file.
   * Can be done client-side with xlsx library in V2.
   */
  async extractFromExcel(file: File | Blob): Promise<OCRResult[]> {
    // Excel parsing can be done client-side with xlsx library
    throw new Error('Excel parsing not implemented. Add xlsx library first.');
  }

  /**
   * Validate extracted OCR data for completeness and correctness.
   * Checks for required fields, GSTIN format, and confidence threshold.
   */
  async validateExtractedData(
    result: OCRResult
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    if (!result.invoiceNumber) issues.push('Missing invoice number');
    if (!result.sellerGstin) issues.push('Missing seller GSTIN');
    if (
      result.sellerGstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        result.sellerGstin
      )
    )
      issues.push('Invalid seller GSTIN format');
    if (result.confidence < 0.7)
      issues.push(`Low confidence: ${(result.confidence * 100).toFixed(0)}%`);
    return { valid: issues.length === 0, issues };
  }
}

export const ocrService = new OCRService();
