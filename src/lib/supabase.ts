// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Supabase Client (Storage)
//
// Replaces Firebase Storage. Reads credentials exclusively from environment
// variables — NOTHING is hardcoded.
//
// Required env vars (set in .env.local / Vercel project settings):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// The `NEXT_PUBLIC_` prefix makes them available on the client (required,
// because VEYRO uploads run client-side under the authenticated user's
// context — same pattern as the existing Firestore onSnapshot hooks).
//
// Bucket: "gstpilot-files"
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** The Supabase Storage bucket used by VEYRO for all file uploads. */
export const GSTPILOT_STORAGE_BUCKET = 'gstpilot-files';

/**
 * Resolve the Supabase URL from the environment. Throws a clear, actionable
 * error if the variable is missing so a misconfigured Vercel deployment fails
 * loudly instead of silently uploading to nowhere.
 */
export function resolveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL in your environment.',
    );
  }
  return url;
}

/**
 * Resolve the Supabase anon key from the environment.
 */
export function resolveSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.',
    );
  }
  return key;
}

/**
 * Lazily-initialized singleton Supabase client.
 *
 * The client is created on first access (not at module load) so that the env
 * vars are guaranteed to be populated — Next.js inlines `NEXT_PUBLIC_*` vars at
 * build time, and lazy init avoids any cold-start ordering surprises.
 */
let _client: SupabaseClient | null = null;

/** Get the singleton Supabase client (creates it on first call). */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(resolveSupabaseUrl(), resolveSupabaseAnonKey(), {
    auth: {
      // VEYRO uses Firebase Auth — Supabase Auth is not used, so we disable
      // session persistence to avoid unnecessary localStorage writes.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _client;
}

/**
 * Convenience accessor for the Supabase Storage API bound to the VEYRO
 * bucket. Every upload/download/delete/list call in the codebase goes through
 * here so the bucket name lives in exactly one place.
 */
export function getSupabaseStorage() {
  return getSupabase().storage.from(GSTPILOT_STORAGE_BUCKET);
}
