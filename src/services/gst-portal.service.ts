/**
 * GST Portal API Integration Service
 *
 * Provides an adapter layer for connecting to the official GST Portal APIs.
 * Currently implements stub methods with local GSTIN validation.
 * Will be connected to real GST Portal APIs in V2.
 *
 * Capabilities (V2 roadmap):
 * - GSTIN validation via official API
 * - GSTR-2B data fetching from GST Portal
 * - Return filing (GSTR-1, GSTR-3B) via API
 * - Filing status tracking with ARN
 */

export interface GSTPortalConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

export interface GSTINValidationResult {
  gstin: string;
  valid: boolean;
  tradeName: string | null;
  legalName: string | null;
  state: string | null;
  stateCode: string | null;
  entityType: string | null;
  status: 'active' | 'cancelled' | 'provisional' | 'inactive';
  registrationDate: string | null;
  cancellationDate: string | null;
  error?: string;
}

export interface GSTR2BData {
  gstin: string;
  period: string;
  sections: GSTR2BSection[];
}

export interface GSTR2BSection {
  key: string;
  count: number;
  taxableValue: number;
  tax: number;
}

class GSTPortalService {
  private config: GSTPortalConfig | null = null;

  /**
   * Configure the GST Portal service with API credentials.
   * Will be used when connecting to the real GST Portal API in V2.
   */
  configure(config: GSTPortalConfig) {
    this.config = config;
  }

  /**
   * Validate a GSTIN number.
   * Currently performs local regex validation only.
   * V2 will call the official GST API for full business details.
   */
  async validateGSTIN(gstin: string): Promise<GSTINValidationResult> {
    // Stub — will call real GST API in V2
    // For now, perform local validation
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const valid = regex.test(gstin.toUpperCase());
    if (!valid) {
      return {
        gstin,
        valid: false,
        tradeName: null,
        legalName: null,
        state: null,
        stateCode: null,
        entityType: null,
        status: 'inactive',
        registrationDate: null,
        cancellationDate: null,
        error: 'Invalid GSTIN format',
      };
    }
    const stateCode = gstin.substring(0, 2);
    return {
      gstin,
      valid: true,
      tradeName: null,
      legalName: null,
      state: null,
      stateCode,
      entityType: null,
      status: 'active',
      registrationDate: null,
      cancellationDate: null,
    };
  }

  /**
   * Fetch GSTR-2B data for a given GSTIN and period.
   * V2 will connect to the real GST Portal API.
   */
  async fetchGSTR2B(gstin: string, period: string): Promise<GSTR2BData> {
    // Stub — will fetch from real GST Portal in V2
    throw new Error('GSTR-2B fetch not implemented. Connect GST Portal API first.');
  }

  /**
   * File a GST return via the portal API.
   * V2 will file returns through the official GST Portal.
   */
  async fileReturn(
    gstin: string,
    returnType: string,
    period: string,
    payload: string
  ): Promise<{ arn: string; status: string }> {
    // Stub — will file via real GST Portal in V2
    throw new Error('Return filing not implemented. Connect GST Portal API first.');
  }

  /**
   * Check the filing status for a given ARN (Acknowledgement Reference Number).
   * V2 will poll the real GST Portal for status updates.
   */
  async getFilingStatus(
    arn: string
  ): Promise<{ status: string; acknowledgementDate: string | null }> {
    throw new Error('Filing status check not implemented. Connect GST Portal API first.');
  }
}

export const gstPortalService = new GSTPortalService();
