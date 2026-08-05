// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GSP Errors
// ═══════════════════════════════════════════════════════════════════════════════
// Typed errors so callers can distinguish auth failures, rate limits, GSTN
// outages, and configuration errors.
// ═══════════════════════════════════════════════════════════════════════════════

export class GSPError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'GSPError';
  }
}

export class GSPAuthError extends GSPError {
  constructor(provider: string, message = 'GSP authentication failed') {
    super(message, 'GSP_AUTH_FAILED', provider, 401);
    this.name = 'GSPAuthError';
  }
}

export class GSPRateLimitError extends GSPError {
  constructor(provider: string, message = 'GSP rate limit exceeded') {
    super(message, 'GSP_RATE_LIMIT', provider, 429);
    this.name = 'GSPRateLimitError';
  }
}

export class GSPGSTNOutageError extends GSPError {
  constructor(provider: string, message = 'GSTN portal is unavailable') {
    super(message, 'GSTN_OUTAGE', provider, 503);
    this.name = 'GSPGSTNOutageError';
  }
}

export class GSPConfigError extends GSPError {
  constructor(provider: string, message = 'GSP is not configured') {
    super(message, 'GSP_NOT_CONFIGURED', provider, 400);
    this.name = 'GSPConfigError';
  }
}

export class GSPNotFoundError extends GSPError {
  constructor(provider: string, message = 'GSTR-2B not available for this period') {
    super(message, 'GSTR2B_NOT_AVAILABLE', provider, 404);
    this.name = 'GSPNotFoundError';
  }
}
