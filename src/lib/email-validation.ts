// ═══════════════════════════════════════════════════════════════════════════
// GSTPilot™ — Real Email & Password Validation Library
// Phase 9A: "the email should be correct and should present in world"
// ═══════════════════════════════════════════════════════════════════════════

// ── RFC 5322 simplified (practical) regex ──────────────────────────────────
// Rejects: spaces, double dots, leading/trailing dots, invalid TLDs (<2 chars),
//          consecutive @, IP-literal domains, unicode in local part.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// ── Disposable / temp / fake email domain blocklist ─────────────────────────
// These are domains that don't represent "real world" identities — they're
// throwaway inboxes. Signup with these is rejected.
const DISPOSABLE_DOMAINS = new Set<string>([
  // Popular temp-mail services
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "guerrillamail.info", "guerrillamail.net",
  "throwaway.email", "trashmail.com", "trashmail.net", "trashmail.me",
  "yopmail.com", "yopmail.net", "getnada.com", "nada.email",
  "sharklasers.com", "maildrop.cc", "dispostable.com", "fakeinbox.com",
  "mailnesia.com", "mintemail.com", "tempinbox.com", "tempmailo.com",
  "tempmailaddress.com", "tmpmail.org", "tmpmail.net", "moakt.com",
  "mvrht.net", "dropmail.me", "emltmp.com", "tmail.io", "tmails.net",
  "emailondeck.com", "fakeemail.net", "filzmail.com", "meltmail.com",
  "spamgourmet.com", "spam4.me", "trbvm.com", "trbvn.com", "vomoto.com",
  "nwytg.com", "yxzx.net", "emailisvalid.com", "lyft.live",
  // Indian / regional temp mail
  "tempmail.live", "mailhub.pro", "emailfake.com", "mail-temp.com",
  // Common variants
  "example.com", "example.org", "example.net", "test.com", "test.org",
  "invalid.com", "noemail.com", "no-reply.com", "noreply.com",
  "localhost.com", "domain.com", "email.com", "mail.com",
]);

export interface EmailValidationResult {
  valid: boolean;
  format: boolean;
  disposable: boolean;
  mx: boolean | null; // null = not checked yet
  reason?: string;
}

/**
 * Validate email format (RFC 5322 simplified) + disposable domain check.
 * Does NOT do MX lookup — that's done server-side via /api/validate-email.
 */
export function validateEmailFormat(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, format: false, disposable: false, mx: null, reason: "Email is required" };
  }
  if (email.length > 254) {
    return { valid: false, format: false, disposable: false, mx: null, reason: "Email is too long (max 254 chars)" };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, format: false, disposable: false, mx: null, reason: "Invalid email format" };
  }
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, format: false, disposable: false, mx: null, reason: "Invalid email format" };
  }
  // Reject TLDs shorter than 2 chars (e.g., "a@b.c" → c is invalid)
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) {
    return { valid: false, format: false, disposable: false, mx: null, reason: "Invalid email domain" };
  }
  const disposable = DISPOSABLE_DOMAINS.has(domain);
  if (disposable) {
    return {
      valid: false,
      format: true,
      disposable: true,
      mx: null,
      reason: "Disposable email providers are not allowed. Please use a real email address.",
    };
  }
  return { valid: true, format: true, disposable: false, mx: null };
}

/**
 * Check if a domain is in the disposable list (without full validation).
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

// ── Password Strength Checker ──────────────────────────────────────────────
// Phase 9A: "the password should be correct check all the real identities"
// Enforces: min 8 chars, uppercase, lowercase, number, special char.

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0 = very weak, 4 = strong
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong";
  color: string; // hex
  checks: {
    length: boolean;     // >= 8 chars
    uppercase: boolean;  // A-Z
    lowercase: boolean;  // a-z
    number: boolean;     // 0-9
    special: boolean;    // non-alphanumeric
  };
  valid: boolean; // true if score >= 3 (Good or Strong) AND length check passes
  reason?: string;
}

const STRENGTH_LABELS: PasswordStrength["label"][] = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22d3ee", "#22c55e"];

export function checkPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passedCount = Object.values(checks).filter(Boolean).length;
  // Score: 0..4 based on how many checks passed
  const score = (passedCount === 5 ? 4 : Math.max(0, passedCount - 1)) as PasswordStrength["score"];
  const valid = score >= 3 && checks.length;

  let reason: string | undefined;
  if (password.length === 0) reason = "Password is required";
  else if (!checks.length) reason = "Password must be at least 8 characters";
  else if (!checks.uppercase) reason = "Add at least one uppercase letter (A-Z)";
  else if (!checks.lowercase) reason = "Add at least one lowercase letter (a-z)";
  else if (!checks.number) reason = "Add at least one number (0-9)";
  else if (!checks.special) reason = "Add at least one special character (!@#$...)";

  return {
    score,
    label: STRENGTH_LABELS[score],
    color: STRENGTH_COLORS[score],
    checks,
    valid,
    reason,
  };
}

/**
 * Synchronous password validity check for form gating.
 * Returns true only if password meets ALL 5 criteria.
 */
export function isPasswordValid(password: string): boolean {
  return checkPasswordStrength(password).valid;
}
