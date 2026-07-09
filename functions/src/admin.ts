/**
 * firebase-admin singleton initialization.
 *
 * In Cloud Functions runtime, the default application credentials are
 * automatically available — we use `applicationDefault()` so the same code
 * works in production (Cloud Functions), the emulator, and locally when
 * `GOOGLE_APPLICATION_CREDENTIALS` is set.
 *
 * Initialization must happen exactly once per cold-start; the guard below
 * prevents the "Firebase App named '[DEFAULT]' already exists" error.
 */
import admin from 'firebase-admin';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';

let app: App;

if (getApps().length === 0) {
  // Prefer an explicit service-account JSON if provided (local dev / emulator),
  // otherwise fall back to ADC (works inside Cloud Functions automatically).
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    app = initializeApp({ credential: cert(serviceAccountPath) });
  } else {
    app = initializeApp({ credential: applicationDefault() });
  }
} else {
  app = getApps()[0] as App;
}

export const adminApp = app;
export const adminDb = admin.firestore(app);
export const adminAuth = admin.auth(app);
export const adminStorage = admin.storage(app);
export { admin };
export default admin;
