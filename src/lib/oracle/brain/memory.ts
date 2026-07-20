// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Brain — Persistent Workspace Memory
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle remembers things about each workspace (org): company name, GST number,
// connected integrations, user preferences, important dates, frequently asked
// questions. This makes Oracle feel like an employee who knows the business.
//
// Storage: Prisma OracleMemory model (tenant-scoped by firmId).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

export interface MemoryFact {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  tags: string[];
  importance: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMemoryInput {
  title: string;
  summary?: string | null;
  category?: string;
  tags?: string[];
  importance?: number;
  source?: string;
}

/**
 * Save a fact to workspace memory. If a fact with the same title (case-insensitive)
 * already exists for this org, it's updated — otherwise a new one is created.
 */
export async function saveMemory(orgId: string, input: SaveMemoryInput): Promise<MemoryFact> {
  const existing = await db.oracleMemory.findFirst({
    where: { firmId: orgId, title: { equals: input.title, mode: 'insensitive' } },
  });

  const tags = Array.isArray(input.tags) ? input.tags : [];
  const payload = { source: input.source ?? 'oracle-chat' };

  if (existing) {
    const updated = await db.oracleMemory.update({
      where: { id: existing.id },
      data: {
        summary: input.summary ?? existing.summary,
        category: input.category ?? existing.category,
        tags: JSON.stringify(tags.length > 0 ? tags : JSON.parse(existing.tags || '[]')),
        importance: input.importance ?? existing.importance,
        payload: JSON.stringify(payload),
        updatedAt: new Date(),
      },
    });
    return toFact(updated);
  }

  const created = await db.oracleMemory.create({
    data: {
      firmId: orgId,
      category: input.category ?? 'note',
      title: input.title,
      summary: input.summary ?? null,
      tags: JSON.stringify(tags),
      importance: input.importance ?? 50,
      source: input.source ?? 'oracle-chat',
      payload: JSON.stringify(payload),
    },
  });
  return toFact(created);
}

/**
 * Recall memories matching a query. Simple substring + tag match (no vector
 * search — keeps it dependency-free and fast for small workspaces).
 */
export async function recallMemory(orgId: string, query: string): Promise<MemoryFact[]> {
  const q = query.trim();
  const where: any = { firmId: orgId };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { tags: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
  }
  const rows = await db.oracleMemory.findMany({
    where,
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: 20,
  });
  return rows.map(toFact);
}

/**
 * List all memories for a workspace (for the memory panel UI).
 */
export async function listMemory(orgId: string): Promise<MemoryFact[]> {
  const rows = await db.oracleMemory.findMany({
    where: { firmId: orgId },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  });
  return rows.map(toFact);
}

/**
 * Delete a memory by id (tenant-scoped).
 */
export async function deleteMemory(orgId: string, id: string): Promise<boolean> {
  const r = await db.oracleMemory.deleteMany({ where: { id, firmId: orgId } });
  return r.count > 0;
}

/**
 * Build a compact text block of all workspace memories — injected into the
 * Oracle system prompt so the LLM "knows" the workspace context.
 */
export async function getWorkspaceMemoryBlock(orgId: string): Promise<string> {
  const facts = await listMemory(orgId);
  if (facts.length === 0) {
    return '## Workspace Memory\n(No persistent memories yet. As you learn facts about this workspace, use the saveMemory tool to remember them.)';
  }
  const lines = facts.map(f => {
    const tag = f.tags.length > 0 ? ` [${f.tags.join(',')}]` : '';
    return `  • ${f.title}${tag}${f.summary ? ': ' + f.summary : ''}`;
  });
  return `## Workspace Memory (what Oracle knows about this business)\n${lines.join('\n')}`;
}

/**
 * After a conversation, scan the assistant's response for facts worth remembering
 * (company name, GSTIN, preferences). Uses a lightweight LLM call.
 *
 * This is best-effort — failures are silently ignored.
 */
export async function autoExtractFacts(
  orgId: string,
  conversation: Array<{ role: string; content: string }>,
): Promise<number> {
  // Only extract from the last few turns to keep the prompt small
  const recent = conversation.slice(-6);
  const transcript = recent
    .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
    .join('\n\n');
  if (transcript.length < 50) return 0;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You extract durable facts about a business from a support conversation. ' +
            'Only extract facts the user explicitly stated about THEIR business (company name, GST number, preferences, important dates, integration status, team members). ' +
            'Do NOT extract opinions, questions, or transient data. ' +
            'Respond as a JSON array: [{"title":"short","summary":"value","category":"company|preference|gst|banking|note"}]. ' +
            'If there are no facts to extract, respond with "[]".',
        },
        { role: 'user', content: transcript },
      ],
      thinking: { type: 'disabled' },
    });
    const text = completion.choices[0]?.message?.content ?? '[]';
    // Strip markdown fences if present
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const facts = JSON.parse(jsonStr);
    if (!Array.isArray(facts)) return 0;
    let saved = 0;
    for (const f of facts) {
      if (f && typeof f.title === 'string' && f.title.length > 0) {
        await saveMemory(orgId, {
          title: f.title,
          summary: f.summary ?? null,
          category: f.category ?? 'note',
          source: 'oracle-autoextract',
        });
        saved++;
      }
    }
    return saved;
  } catch (e) {
    console.warn('[oracle-memory autoExtract] failed:', (e as Error).message);
    return 0;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFact(row: any): MemoryFact {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch { tags = []; }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    tags,
    importance: row.importance,
    source: row.source,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}
