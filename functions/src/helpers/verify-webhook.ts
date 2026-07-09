/**
 * Webhook signature verification helpers.
 *
 * Razorpay uses HMAC-SHA256 of the raw body, hex-encoded, header `X-Razorpay-Signature`.
 * Stripe uses `t=<timestamp>,v1=<hex-signature>` header `Stripe-Signature`,
 * where the signature is HMAC-SHA256 of `${timestamp}.${rawBody}`.
 *
 * Both use `crypto.timingSafeEqual` to prevent timing attacks.
 */
import crypto from 'crypto';

/**
 * Verify a Razorpay webhook signature.
 *
 * @param rawBody  Raw request body (string or Buffer).
 * @param signature Value of the `X-Razorpay-Signature` header.
 * @param secret   The webhook secret configured in the Razorpay dashboard.
 * @returns true if the signature matches.
 */
export function verifyRazorpaySignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return safeEqualHex(expected, signature);
}

/**
 * Verify a Stripe webhook signature.
 *
 * @param rawBody       Raw request body (string or Buffer).
 * @param signatureHeader Value of the `Stripe-Signature` header (e.g. "t=12345,v1=abc").
 * @param secret        The webhook signing secret (whsec_...).
 * @param toleranceSec  Maximum allowed clock skew in seconds (default 300).
 * @returns true if the signature is valid and within tolerance.
 */
export function verifyStripeSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = parseStripeHeader(signatureHeader);
  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Reject stale timestamps to prevent replay attacks.
  const ageSec = Math.abs(Date.now() / 1000 - parts.timestamp);
  if (ageSec > toleranceSec) return false;

  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const signedPayload = `${parts.timestamp}.${body.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return parts.signatures.some((sig) => safeEqualHex(expected, sig));
}

interface ParsedStripeHeader {
  timestamp: number | null;
  signatures: string[];
}

function parseStripeHeader(header: string): ParsedStripeHeader {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't' && v) timestamp = Number(v);
    if (k === 'v1' && v) signatures.push(v);
  }
  return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}
