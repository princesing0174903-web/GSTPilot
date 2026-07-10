// ═══════════════════════════════════════════════════════════════════════════════
// drive.ts — Google Drive API v3 adapter
//
// Provider: Drive API v3 (https://developers.google.com/drive/api/v3)
// Endpoint: `www.googleapis.com/drive/v3/files`
// Auth: OAuth 2.0 access token + refresh token (Google Cloud project)
//
// STATUS: PLACEHOLDER. Method signatures + types defined. Throws
// IntegrationNotConfiguredError without creds. Throws Error('Drive adapter
// requires live Google OAuth creds...') with creds but unwired API. NO fake
// data.
//
// To make this adapter live:
//   1. Same Google Cloud project setup as gmail.ts (or share it).
//   2. Add the drive.metadata.readonly + drive.file scopes.
//   3. Wire listFiles() / downloadFile() / watchFolder() to the Drive API.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type ConnectionRecord,
  type DecryptedCredentials,
  type DriveCredentials,
  type ParsedDriveFile,
} from './types'
import { decryptCredentials } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ListFilesOptions {
  q?: string // Drive query, e.g. "'0B1234' in parents and mimeType='application/pdf'"
  pageSize?: number
  pageToken?: string
  fields?: string // `fields` param, defaults to standard file metadata
  orderBy?: string
}

export interface DriveFileRow {
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink?: string
  thumbnailLink?: string
  md5Checksum?: string
  parents?: string[]
  modifiedTime?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadCredentials(conn: ConnectionRecord): DriveCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('drive')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'drive',
      'Drive credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('drive', raw)
  if (!creds.accessToken && !creds.refreshToken) {
    throw new IntegrationNotConfiguredError(
      'drive',
      'Drive credentials are incomplete. Required: accessToken or refreshToken.',
    )
  }
  return creds
}

function requireGoogleOauthEnv(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Drive adapter requires live Google OAuth creds — configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI env vars.',
    )
  }
  return { clientId, clientSecret, redirectUri }
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * GET `/drive/v3/files?q=...&pageSize=...&pageToken=...&fields=...`
 * — list files in the connected Drive.
 */
export async function listFiles(
  conn: ConnectionRecord,
  opts: ListFilesOptions = {},
): Promise<{ files: DriveFileRow[]; nextPageToken?: string }> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void opts
  // TODO: const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(opts.q ?? '')}&pageSize=${opts.pageSize ?? 100}`, { headers: { Authorization: `Bearer ${creds.accessToken}` } })
  throw new Error(
    'Drive listFiles() is not yet implemented. Wire the live GET to /drive/v3/files.',
  )
}

/**
 * GET `/drive/v3/files/{fileId}?alt=media` — download the file's binary
 * content. Returns a Buffer.
 */
export async function downloadFile(
  conn: ConnectionRecord,
  fileId: string,
): Promise<Buffer> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void fileId
  throw new Error(
    'Drive downloadFile() is not yet implemented. Wire the live GET to /drive/v3/files/{fileId}?alt=media.',
  )
}

/**
 * POST `/drive/v3/files/{fileId}/watch` — register a webhook for changes to
 * a folder. The webhook receives push notifications when files are added or
 * modified; the orchestrator then re-syncs.
 */
export async function watchFolder(
  conn: ConnectionRecord,
  folderId: string,
): Promise<void> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void folderId
  throw new Error(
    'Drive watchFolder() is not yet implemented. Wire the live POST to /drive/v3/files/{fileId}/watch.',
  )
}

/**
 * Convenience — pulls files matching `opts.q` and returns them as
 * ParsedDriveFile rows ready for the sync orchestrator to upsert into
 * DriveFile.
 */
export async function pullFiles(
  conn: ConnectionRecord,
  opts: ListFilesOptions = {},
): Promise<ParsedDriveFile[]> {
  const { files } = await listFiles(conn, opts)
  return files.map((f) => ({
    driveFileId: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    webViewLink: f.webViewLink,
    thumbnailLink: f.thumbnailLink,
    md5Checksum: f.md5Checksum,
    parents: f.parents,
    rawPayload: f as unknown,
  }))
}
