/**
 * Firebase Admin SDK — SERVER-ONLY initialization (singleton).
 *
 * NEVER import this module from a client component, a use client file,
 * or any code that ships to the browser. The Admin SDK bypasses all security
 * rules and uses service-account credentials — exposing it on the client would
 * compromise the entire project. Restrict imports to:
 *   - Next.js route handlers (app/api/route.ts files)
 *   - Next.js server actions (use server functions)
 *   - Server components (server-rendered page.tsx files)
 *   - Server-side lib code under src/lib/providers/server folders
 *
 * Credentials resolution order:
 *   1. applicationDefault() — picks up GOOGLE_APPLICATION_CREDENTIALS env
 *      var or the metadata server when running on GCP/Cloud Run/Functions.
 *   2. Falls back to cert() built from explicit env vars:
 *        FIREBASE_PROJECT_ID
 *        FIREBASE_CLIENT_EMAIL
 *        FIREBASE_PRIVATE_KEY   (the JSON key private_key field — set with
 *                                literal backslash-n escapes inside a single-line
 *                                env value; we replace them with real newlines)
 */

import admin, { type App, type ServiceAccount } from "firebase-admin";

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  try {
    // 1. Try Application Default Credentials (GCP metadata or GOOGLE_APPLICATION_CREDENTIALS).
    adminApp = admin.initializeApp({ credential: admin.applicationDefault() });
    return adminApp;
  } catch {
    // 2. Fall back to explicit service-account env vars.
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error(
        "firebase-admin: no credentials available. Set GOOGLE_APPLICATION_CREDENTIALS, " +
          "or provide FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars."
      );
    }

    // Env vars store the PEM key with literal `\n` escapes; rehydrate real newlines.
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const serviceAccount: ServiceAccount = {
      projectId,
      clientEmail,
      privateKey,
    };

    adminApp = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "gstpilot1.firebasestorage.app",
    });
    return adminApp;
  }
}

/** Singleton Firestore instance (server-side, bypasses security rules). */
export const adminDb = () => admin.firestore(getAdminApp());

/** Singleton Auth instance (server-side, can mint custom tokens / verify ID tokens). */
export const adminAuth = () => admin.auth(getAdminApp());

/** Singleton Storage instance (server-side, bypasses storage.rules). */
export const adminStorage = () => admin.storage(getAdminApp());

export { admin };
