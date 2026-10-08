// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Engine — Productivity Analyzer
//
// Inspects Gmail + Calendar + Drive signals to surface productivity blockers:
// calendar conflicts, heavy meeting load, GST notices sitting unread in the
// inbox, and document activity trends.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Analyzer, AnalyzerResult, Signal } from '../types';
import { getDataset } from '../types';
import type { CalendarData, DriveData, GmailData } from '../types';

export const productivityAnalyzer: Analyzer = {
  id: 'productivity',
  label: 'Productivity',
  analyze(dataset): AnalyzerResult {
    const signals: Signal[] = [];
    const metrics: Record<string, number> = {};

    const gmail = getDataset<GmailData>(dataset, 'gmail');
    const calendar = getDataset<CalendarData>(dataset, 'calendar');
    const drive = getDataset<DriveData>(dataset, 'drive');

    metrics.weekEventLoad = calendar?.weekLoad ?? 0;
    metrics.calendarConflicts = calendar?.conflicts ?? 0;
    metrics.inboxGstNotices = gmail?.buckets.gst_notice ?? 0;
    metrics.inboxTaxCommunications = gmail?.buckets.tax_communication ?? 0;
    metrics.recentDriveFiles = drive?.recentlyActive ?? 0;

    // ── Problem: GST notices in inbox need review ───────────────────────────
    if (gmail && gmail.buckets.gst_notice > 0) {
      const count = gmail.buckets.gst_notice;
      signals.push({
        id: 'productivity:gst-notices-in-inbox',
        kind: 'problem',
        category: 'notice',
        severity: 'high',
        title: `${count} GST notice${count === 1 ? '' : 'es'} detected in your inbox`,
        description: `Oracle classified ${count} recent email${count === 1 ? '' : 's'} as GST notices or departmental communications. These typically have statutory response deadlines.`,
        recommendation: 'Review the flagged emails and log them in the GST notice tracker with their due dates.',
        monetaryValue: 0,
        dueDate: null,
        confidence: 0.7,
        evidence: gmail.recent
          .filter((m) => /gst|notice|cbic|department/i.test(m.subject))
          .slice(0, 3)
          .map((m) => ({ source: 'gmail', reference: m.subject.slice(0, 80) })),
        analyzer: 'productivity',
        tags: { count },
      });
    }

    // ── Problem: calendar conflicts ─────────────────────────────────────────
    if (calendar && calendar.conflicts > 0) {
      signals.push({
        id: 'productivity:calendar-conflicts',
        kind: 'problem',
        category: 'productivity',
        severity: 'medium',
        title: `${calendar.conflicts} calendar conflict${calendar.conflicts === 1 ? '' : 's'} in the next 7 days`,
        description: `${calendar.conflicts} overlapping event${calendar.conflicts === 1 ? '' : 's'} were detected. Double-bookings lead to missed meetings and rescheduling churn.`,
        recommendation: 'Review the week ahead and decline or reschedule the lower-priority conflict.',
        monetaryValue: 0,
        dueDate: calendar.nextEventAt,
        confidence: 0.85,
        evidence: calendar.upcoming.slice(0, 5).map((e) => ({
          source: 'calendar',
          reference: e.summary.slice(0, 80),
        })),
        analyzer: 'productivity',
        tags: { conflicts: calendar.conflicts },
      });
    }

    // ── Problem: heavy calendar load ────────────────────────────────────────
    if (calendar && calendar.weekLoad > 20) {
      signals.push({
        id: 'productivity:heavy-calendar-load',
        kind: 'problem',
        category: 'productivity',
        severity: 'low',
        title: `${calendar.weekLoad} meetings scheduled in the next 7 days`,
        description: `A meeting load above 20/week leaves limited deep-work time. Consider batching meetings or delegating attendance.`,
        recommendation: 'Block 2 hours of focus time daily and decline meetings without a clear agenda.',
        monetaryValue: 0,
        dueDate: null,
        confidence: 0.7,
        evidence: [{ source: 'calendar', reference: 'Calendar week load' }],
        analyzer: 'productivity',
        tags: { weekLoad: calendar.weekLoad },
      });
    }

    // ── Info: next meeting ──────────────────────────────────────────────────
    if (calendar && calendar.nextEventAt) {
      const nextStart = Date.parse(calendar.nextEventAt);
      if (!Number.isNaN(nextStart)) {
        const minsToNext = Math.round((nextStart - Date.now()) / 60000);
        metrics.minsToNextMeeting = minsToNext;
        if (minsToNext >= 0 && minsToNext <= 60) {
          signals.push({
            id: 'productivity:upcoming-meeting',
            kind: 'info',
            category: 'productivity',
            severity: 'low',
            title: `Next meeting in ${minsToNext} min${minsToNext === 1 ? '' : 's'}`,
            description: `“${calendar.upcoming[0]?.summary ?? 'Untitled event'}” starts soon${calendar.upcoming[0]?.hangoutLink ? ' — join via the Meet link' : ''}.`,
            recommendation: 'Open the meeting agenda and prep materials now.',
            monetaryValue: 0,
            dueDate: calendar.nextEventAt,
            confidence: 0.95,
            evidence: [{ source: 'calendar', reference: calendar.upcoming[0]?.summary ?? 'Next event' }],
            analyzer: 'productivity',
            tags: { minsToNext: minsToNext },
          });
        }
      }
    }

    // ── Info: drive activity ────────────────────────────────────────────────
    if (drive && drive.recentlyActive > 0) {
      signals.push({
        id: 'productivity:drive-activity',
        kind: 'info',
        category: 'productivity',
        severity: 'low',
        title: `${drive.recentlyActive} file${drive.recentlyActive === 1 ? '' : 's'} modified on Drive this week`,
        description: `Recent Drive activity across ${Object.entries(drive.byType).filter(([k]) => k !== 'folder').map(([k, v]) => `${v} ${k}${v === 1 ? '' : 's'}`).join(', ')}.`,
        recommendation: 'Nothing to action — informational only.',
        monetaryValue: 0,
        dueDate: null,
        confidence: 0.6,
        evidence: drive.recentFiles.slice(0, 3).map((f) => ({
          source: 'drive',
          reference: f.name,
          link: f.webViewLink,
        })),
        analyzer: 'productivity',
        tags: { ...drive.byType },
      });
    }

    return { analyzer: 'productivity', signals, metrics };
  },
};
