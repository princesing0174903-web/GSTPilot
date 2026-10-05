// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Live Collaboration Network™
//
// Coordinate: executives, departments, countries, partners, vendors, customers,
// AI agents. Every conversation becomes part of Oracle Memory™.
//
// Collaboration messages are derived from REAL production signals:
//   - CEODecision (executive proposals/approvals)
//   - AutonomousStrategyMeeting (executive debates)
//   - Approval (approval/rejection)
//   - ExecutionTimeline (status updates)
// Each mapped to a collaboration message with collaborator + intent.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, safeCount, TTL, countBy } from './helpers';
import type { CollaborationMessage, CollaborationSummary, CollaboratorType, CommandModule } from './types';

/** Build the live collaboration feed from real production signals. */
export async function getCollaborationMessages(): Promise<CollaborationMessage[]> {
  return cached<CollaborationMessage[]>('cn:collab:messages', TTL.SHORT, async () => {
    const messages: CollaborationMessage[] = [];

    // ── 1. CEO Decisions → executive proposals ────────────────────────────────
    const decisions = await safeFindMany(() =>
      db.cEODecision.findMany({ orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, title: true, reason: true, type: true, status: true, createdAt: true } }),
    );
    for (const d of decisions) {
      messages.push({
        id: `collab-dec-${d.id}`,
        threadId: `decision-${d.id}`,
        collaboratorType: 'executive' as CollaboratorType,
        collaboratorId: 'ai_ceo',
        collaboratorLabel: 'AI CEO',
        message: `${d.title}: ${d.reason}`,
        intent: d.status === 'pending' ? 'proposal' : d.status === 'executed' ? 'approval' : 'review',
        moduleRef: 'ai_ceo' as CommandModule,
        oracleMemorySaved: d.status === 'executed',
        timestamp: d.createdAt.toISOString(),
      });
    }

    // ── 2. Strategy Meetings → executive debates ──────────────────────────────
    const meetings = await safeFindMany(() =>
      db.autonomousStrategyMeeting.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, topic: true, consensus: true, ceoApproval: true, createdAt: true } }),
    );
    for (const m of meetings) {
      messages.push({
        id: `collab-meeting-${m.id}`,
        threadId: `meeting-${m.id}`,
        collaboratorType: 'executive' as CollaboratorType,
        collaboratorId: 'strategy_room',
        collaboratorLabel: 'AI Strategy Room',
        message: `Strategy debate: ${m.topic}. Consensus: ${m.consensus}`,
        intent: m.ceoApproval === 'approved' ? 'approval' : 'review',
        moduleRef: 'oracle' as CommandModule,
        oracleMemorySaved: true,
        timestamp: m.createdAt.toISOString(),
      });
    }

    // ── 3. Approvals → approval/rejection messages ────────────────────────────
    const approvals = await safeFindMany(() =>
      db.approval.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, reason: true, approvedBy: true, createdAt: true } }),
    );
    for (const a of approvals) {
      messages.push({
        id: `collab-approval-${a.id}`,
        threadId: `approval-${a.id}`,
        collaboratorType: 'executive' as CollaboratorType,
        collaboratorId: a.approvedBy ?? 'approver',
        collaboratorLabel: a.approvedBy ?? 'Approver',
        message: a.status === 'approved' ? 'Approved the proposed action.' : a.status === 'rejected' ? `Rejected: ${a.reason ?? 'risk too high'}` : 'Pending approval.',
        intent: a.status === 'pending' ? 'proposal' : 'approval',
        moduleRef: 'ai_operations' as CommandModule,
        oracleMemorySaved: a.status !== 'pending',
        timestamp: a.createdAt.toISOString(),
      });
    }

    // ── 4. Execution Timeline → status updates ────────────────────────────────
    const timeline = await safeFindMany(() =>
      db.executionTimeline.findMany({ orderBy: { timestamp: 'desc' }, take: 15, select: { id: true, agent: true, stage: true, title: true, description: true, timestamp: true } }),
    );
    for (const t of timeline) {
      messages.push({
        id: `collab-timeline-${t.id}`,
        threadId: `execution-${t.id}`,
        collaboratorType: 'ai_agent' as CollaboratorType,
        collaboratorId: t.agent ?? 'agent',
        collaboratorLabel: t.agent ?? 'Agent',
        message: `${t.stage.toUpperCase()}: ${t.title}${t.description ? ' — ' + t.description : ''}`,
        intent: 'status',
        moduleRef: 'ai_operations' as CommandModule,
        oracleMemorySaved: t.stage === 'learn',
        timestamp: t.timestamp.toISOString(),
      });
    }

    // ── 5. Client communications → customer/vendor messages ───────────────────
    const clients = await safeFindMany(() =>
      db.client.findMany({ orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, tradeName: true, status: true, updatedAt: true } }),
    );
    for (const c of clients) {
      messages.push({
        id: `collab-client-${c.id}`,
        threadId: `client-${c.id}`,
        collaboratorType: 'customer' as CollaboratorType,
        collaboratorId: c.id,
        collaboratorLabel: c.tradeName,
        message: `Client status: ${c.status}. Last activity recorded.`,
        intent: 'status',
        moduleRef: 'crm' as CommandModule,
        oracleMemorySaved: false,
        timestamp: c.updatedAt.toISOString(),
      });
    }

    // Sort by timestamp descending
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return messages.slice(0, 40);
  });
}

/** Collaboration summary — aggregated from real messages. */
export async function getCollaborationSummary(): Promise<CollaborationSummary> {
  return cached<CollaborationSummary>('cn:collab:summary', TTL.SHORT, async () => {
    const messages = await getCollaborationMessages();
    const threadIds = new Set(messages.map((m) => m.threadId));
    const oracleMemoryMessages = messages.filter((m) => m.oracleMemorySaved).length;
    return {
      totalThreads: threadIds.size,
      totalMessages: messages.length,
      byCollaboratorType: countBy(messages, (m) => m.collaboratorType),
      byIntent: countBy(messages, (m) => m.intent),
      oracleMemoryMessages,
      activeThreads: threadIds.size,
      recentMessages: messages.slice(0, 12),
    };
  });
}
