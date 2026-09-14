// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Google Drive Collector
//
// Lists recently modified Drive files (app-created only, per the drive.file
// scope). Classifies by mime type so the productivity analyzer can surface
// "5 spreadsheets and 3 docs were touched this week".
//
// Graceful contract: if Google Workspace is not connected, returns an empty
// DriveData — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

// Google integration removed — stub for rebuild
const getValidAccessToken = async () => ({ accessToken: null, error: 'Google Workspace integration not available', permanent: true });
const loadTokens = async () => ({ tokens: null, stored: null });
const drive = { listFiles: async () => ({ files: [] }) };
import type {
  Collector,
  CollectorContext,
  CollectorResult,
  DriveData,
  DriveFileSummary,
} from '../types';

function emptyData(): DriveData {
  return {
    recentFiles: [],
    recentlyActive: 0,
    byType: {},
  };
}

/** Short human label for common Google mime types. */
function mimeBucket(mime: string): string {
  if (!mime) return 'other';
  if (mime === 'application/vnd.google-apps.folder') return 'folder';
  if (mime === 'application/vnd.google-apps.document') return 'doc';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'sheet';
  if (mime === 'application/vnd.google-apps.presentation') return 'slides';
  if (mime === 'application/vnd.google-apps.form') return 'form';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('spreadsheet')) return 'sheet';
  if (mime.includes('document') || mime.includes('word')) return 'doc';
  return 'other';
}

export const driveCollector: Collector<DriveData> = {
  id: 'drive',
  label: 'Google Drive',
  async collect(ctx: CollectorContext): Promise<CollectorResult<DriveData>> {
    const collectedAt = new Date().toISOString();

    if (!ctx.organizationId) {
      return { source: 'drive', connected: false, recordCount: 0, data: emptyData(), collectedAt };
    }

    const { tokens, stored } = await loadTokens(ctx.organizationId, ctx.userId);
    if (!tokens || !stored) {
      return { source: 'drive', connected: false, recordCount: 0, data: emptyData(), collectedAt };
    }

    const { accessToken, error: tokenError } = await getValidAccessToken(
      ctx.organizationId,
      ctx.userId,
    );
    if (tokenError || !accessToken) {
      return {
        source: 'drive',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: tokenError ?? 'No access token.',
        collectedAt,
      };
    }

    const res = await drive.listFiles(accessToken, { pageSize: 25 });
    const rawFiles = res.data?.files ?? [];

    const recentFiles: DriveFileSummary[] = rawFiles
      .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime ?? '',
        webViewLink: f.webViewLink,
      }));

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentlyActive = recentFiles.filter((f) => {
      const t = Date.parse(f.modifiedTime);
      return !Number.isNaN(t) && t >= weekAgo;
    }).length;

    const byType: Record<string, number> = {};
    for (const f of recentFiles) {
      const bucket = mimeBucket(f.mimeType);
      byType[bucket] = (byType[bucket] ?? 0) + 1;
    }

    const data: DriveData = {
      recentFiles,
      recentlyActive,
      byType,
    };

    return {
      source: 'drive',
      connected: true,
      recordCount: recentFiles.length,
      data,
      collectedAt,
    };
  },
};
