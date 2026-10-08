// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Agent Orchestrator (Financial CEO)
// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI agent. Pipeline:
//   1. Ensure a DB session exists (create if missing) — REAL database memory
//   2. Load conversation history from DB (not just client-passed)
//   3. Recall durable semantic memory (OracleMemory) for context
//   4. Analyze intent → select tools (deterministic keyword router)
//   5. Always start with memory_snapshot to know if ANY data exists
//   6. Execute selected tools IN PARALLEL + audit each to OracleAIToolCall
//   7. Feed results to LLM with a strict CFO system prompt
//   8. Stream tokens + structured sections back to client
//   9. Persist the user message + oracle message to OracleAIMessage
//  10. Save durable memory for critical insights (OracleMemory)
//
// HARD RULES (enforced via system prompt):
//   • Answer ONLY from the provided tool data. Never invent numbers.
//   • If data is empty/unavailable, say so explicitly.
//   • Every number must be traceable to a source record.
//   • Return the structured format: Executive Summary, Analysis, Evidence,
//     Recommended Actions, Confidence, Sources.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { executeTool, TOOL_DEFINITIONS } from './tools';
import {
  createSession, persistUserMessage, persistOracleMessage,
  auditToolCall, saveMemory, recallMemory, loadSession,
} from './persistence';
import type {
  ToolCall, ToolResult, ToolName, SourceRef, RecommendedAction,
  ProactiveInsight, OracleChatRequest, OracleStreamEvent,
} from './types';

// ─── Intent → Tool selection (deterministic, fast, reliable) ───────────────────

function selectTools(message: string): ToolName[] {
  const q = message.toLowerCase();
  const selected = new Set<ToolName>();

  // Always include memory snapshot as baseline context
  selected.add('memory_snapshot');

  // Direct keyword matching
  for (const [name, def] of Object.entries(TOOL_DEFINITIONS) as [ToolName, typeof TOOL_DEFINITIONS[ToolName]][]) {
    if (name === 'memory_snapshot') continue;
    for (const kw of def.keywords) {
      if (q.includes(kw)) {
        selected.add(name);
        break;
      }
    }
  }

  // ─── Intent-based multi-tool selection for the 9 canonical questions ────────

  // "Show unpaid invoices" / "Show all late payments"
  if (q.match(/unpaid|late payment|overdue|past due/i)) {
    selected.add('receivables_summary');
    selected.add('overdue_invoices');
    selected.add('customer_followups');
  }

  // "Which customers may churn?"
  if (q.match(/churn|leaving|at.?risk|might leave|stop ordering|inactive customer/i)) {
    selected.add('customer_churn_risk');
    selected.add('search_customers');
    selected.add('revenue_trend');
  }

  // "Why did revenue fall?" / "Why did revenue drop?"
  if (q.match(/why.*(revenue|sales|income).*(fall|drop|decline|decrease|down)|(revenue|sales).*(fell|dropped|declined)/i)) {
    selected.add('revenue_trend');
    selected.add('period_comparison');
    selected.add('executive_kpis');
    selected.add('search_customers');
  }

  // "Compare June vs July"
  if (q.match(/compare.*(vs|versus|and)|month over|mom|qoq|(january|february|march|april|may|june|july|august|september|october|november|december).*(vs|versus|and|compare)/i)) {
    selected.add('period_comparison');
    selected.add('revenue_trend');
  }

  // "Predict next month's GST"
  if (q.match(/predict|forecast|project.*gst|gst.*next month|expected gst|gst will/i)) {
    selected.add('gst_forecast');
    selected.add('gst_liability');
    selected.add('search_gst_returns');
  }

  // "Which vendors increased prices?"
  if (q.match(/vendor.*(price|cost).*(increase|raise|up|higher)|who.*(raised|increased).*(price|rate)/i)) {
    selected.add('vendor_price_trends');
    selected.add('search_vendors');
    selected.add('payables_summary');
  }

  // "Explain cash flow"
  if (q.match(/cash flow|cash position|liquidity|explain.*cash/i)) {
    selected.add('cash_flow_summary');
    selected.add('executive_kpis');
    selected.add('receivables_summary');
    selected.add('payables_summary');
  }

  // "Generate board meeting summary" / "CEO report" / "investor report"
  if (q.match(/board|meeting summary|ceo report|cfo report|investor report|stakeholder|briefing/i)) {
    selected.add('board_summary');
    selected.add('executive_kpis');
    selected.add('cash_flow_summary');
    selected.add('revenue_trend');
  }

  // "How much money am I expecting?"
  if (q.match(/how much.*(expect|receivable|incoming|owed|pending)|money am i expecting|outstanding/i)) {
    selected.add('receivables_summary');
    selected.add('overdue_invoices');
    selected.add('cash_flow_summary');
    // Include customer_followups because overdue invoices imply follow-up need —
    // the LLM must be able to recommend an action, not just report a number.
    selected.add('customer_followups');
  }

  // "Which customers need follow-up?"
  if (q.match(/follow.?up|chase|remind|call customer|who.*(owe|hasn|hasn't replied)/i)) {
    selected.add('customer_followups');
    selected.add('overdue_invoices');
    selected.add('search_emails');
  }

  // "What happened this week?" / briefing
  if (q.match(/this week|today|happen|briefing|summary of|what's new|whats new/i)) {
    selected.add('executive_kpis');
    selected.add('receivables_summary');
    selected.add('overdue_invoices');
  }

  // "Should I hire more employees?"
  if (q.match(/hire|employee|staff|headcount|recruit|team size/i)) {
    selected.add('cash_flow_summary');
    selected.add('executive_kpis');
    selected.add('revenue_trend');
    selected.add('expense_breakdown');
  }

  // "How much GST will I pay?"
  if (q.match(/gst.*(pay|owe|liability|due)|how much gst/i)) {
    selected.add('gst_liability');
    selected.add('search_gst_returns');
    selected.add('search_purchases');
  }

  // "Cash runway / burn"
  if (q.match(/cash.*(flow|position|runway|survive|burn)|runway|burn rate/i)) {
    selected.add('cash_flow_summary');
    selected.add('executive_kpis');
  }

  // "Revenue / growth / trend"
  if (q.match(/revenue|growth|trend|sales trend|how.*doing/i)) {
    selected.add('revenue_trend');
    selected.add('executive_kpis');
  }

  // "Expense / spend / cost"
  if (q.match(/expense|spend|cost|where.*money|breakdown/i)) {
    selected.add('expense_breakdown');
    selected.add('cash_flow_summary');
  }

  // "Who owes me / top customer"
  if (q.match(/owe me|who owes|customer.*outstanding|top customer/i)) {
    selected.add('receivables_summary');
    selected.add('search_customers');
  }

  // "Payable / vendor outstanding / supplier"
  if (q.match(/owe to|payable|vendor.*outstanding|supplier/i)) {
    selected.add('payables_summary');
    selected.add('search_vendors');
  }

  // "Dashboard / health / overview / kpi"
  if (q.match(/dashboard|health|overview|kpi|metric|how.*business/i)) {
    selected.add('executive_kpis');
    selected.add('cash_flow_summary');
  }

  // If nothing specific matched beyond memory_snapshot, add executive_kpis for context
  if (selected.size === 1) {
    selected.add('executive_kpis');
  }

  // Cap at 6 tools to keep latency reasonable
  return Array.from(selected).slice(0, 6);
}

function reasonForTool(name: ToolName, message: string): string {
  const q = message.toLowerCase();
  const reasons: Partial<Record<ToolName, string>> = {
    memory_snapshot: 'Establishing baseline company memory and financial totals',
    receivables_summary: 'You asked about money expected or outstanding receivables',
    overdue_invoices: 'Identifying invoices past their due date',
    customer_followups: 'Finding customers who need a reminder or follow-up',
    cash_flow_summary: 'Analyzing cash position, burn rate, and runway',
    gst_liability: 'Calculating current GST liability (output tax − ITC)',
    executive_kpis: 'Pulling key performance indicators for an executive view',
    revenue_trend: 'Building the 6-month revenue and collection trend',
    expense_breakdown: 'Breaking down expenses by category',
    payables_summary: 'Reviewing outstanding payables to vendors',
    period_comparison: 'Comparing two periods side-by-side from real records',
    gst_forecast: 'Projecting next month GST from real output-tax and ITC trends',
    vendor_price_trends: 'Detecting vendors whose average bill amount increased',
    customer_churn_risk: 'Scoring customer churn risk from real invoice history',
    board_summary: 'Assembling executive board-meeting briefing material',
    search_invoices: q.match(/overdue/) ? 'Searching overdue invoices' : 'Searching invoice records',
    search_payments: 'Searching payment records',
    search_customers: 'Searching customer records',
    search_vendors: 'Searching vendor records',
    search_expenses: 'Searching expense records',
    search_purchases: 'Searching purchase bill records',
    search_gst_returns: 'Pulling GST return and filing history',
    search_tds: 'Pulling TDS deduction records',
    search_emails: 'Reviewing recent email communications',
    search_bank_transactions: 'Searching bank transaction records',
  };
  return reasons[name] || 'Gathering relevant business data';
}

// ─── Build the CFO system prompt ───────────────────────────────────────────────

function buildSystemPrompt(toolResults: ToolResult[], memoryContext: string): string {
  const hasData = toolResults.some((t) => t.recordCount > 0);
  const dataBlock = toolResults
    .map((t) => `### Tool: ${t.label} (${t.name}) — ${t.recordCount} records\n\`\`\`json\n${t.summary}\n\`\`\``)
    .join('\n\n');

  return `You are ORACLE — the AI Chief Financial Officer and de facto CEO of this company.

You are NOT a chatbot. You are the executive brain. You answer using ONLY the real business data provided below from the company's database. You NEVER fabricate numbers. You NEVER use generic AI knowledge when business data is available.

# YOUR PERSONALITY
- You speak like a sharp, confident CFO who reports to the CEO.
- You are concise but complete. Every number you cite is real and traceable.
- You think in conclusions, not data dumps. "ABC Traders usually pays 11 days late" — not "here is a list of invoices".
- You are honest about uncertainty. If data is missing, you say so plainly.
- You are proactive — you notice things before being asked.
- When the question is analytical (compare, predict, explain why), you reason step-by-step and cite the real records that drive your conclusion.
- You are ACTION-ORIENTED. Every conclusion you draw must be paired with a concrete next step. "Customer X has a 121-day overdue invoice" MUST lead to "Follow up with Customer X today" — never leave an insight without a recommended action.

# HARD RULES
1. Answer ONLY from the JSON data blocks provided below. Do NOT invent or estimate any number.
2. If the data is empty or insufficient for the question, respond: "I don't have enough business data to answer that yet." and explain what's missing.
3. Every financial figure must come from the tool results. Round to whole rupees where appropriate.
4. Use ₹ symbol for Indian Rupees. Format large numbers with Indian comma grouping (e.g., ₹12,34,567).
5. When you mention a specific record (invoice, customer, payment), it MUST exist in the tool data.
6. For FORECASTS / PREDICTIONS: clearly label them as projections. Only project when the tool provides explicit trend data (gst_forecast, revenue_trend). State the basis and the confidence honestly.
7. For COMPARISONS: present a clear before/after table and call out the direction (up/down/flat) with the percentage delta from the tool data.
8. For "WHY did X happen" questions: identify the specific customers/invoices/transactions in the data that explain the change. Name them.

# CRITICAL — CONSISTENCY & INFERENCE (DO NOT CONTRADICT YOURSELF)
- NEVER make two statements in the same response that contradict each other.
- If you mention an overdue invoice (from the overdue_invoices tool), the customer who owes it MUST also be flagged as needing follow-up. NEVER say "no customers need follow-up" while simultaneously reporting overdue invoices — a customer with an overdue invoice IS a customer who needs follow-up, by definition.
- If the customer_followups tool returns ANY customer with overdueInvoices > 0 or daysOverdue > 0, state explicitly that those customers require follow-up. The follow-up list and the overdue invoice list MUST be consistent.
- If overdue_invoices returns N > 0 invoices, then customer_followups (if it ran) MUST also return ≥ 1 customer. If you see overdue invoices in one tool but 0 customers in the follow-ups tool, point out the inconsistency and use the overdue invoice data as the source of truth.
- A customer with an overdue balance needs follow-up. A customer with no recent invoices may need re-engagement. A vendor with increased prices needs review. ALWAYS pair the observation with the action.
- Read the "note" field in customer_followups carefully — it tells you the correct interpretation.

# RESPONSE FORMAT (MANDATORY — follow exactly)
You must respond with these exact markdown sections in order. Use the exact H2 headers.

## Executive Summary
One tight paragraph (3-5 sentences) answering the question directly. Lead with the most important number or conclusion. No filler.

## Analysis
Detailed reasoning. Explain WHAT the data shows and WHY it matters. Use sub-points, mini-tables, or comparisons when they help. Reference specific records by their labels. This is where you show your CFO reasoning.

## Evidence
List the concrete records and figures that back your analysis. Use a markdown table or bullet list. Each evidence item must be traceable to the tool data above.

## Recommended Actions
A numbered list of 2-5 priority-ordered actions. Each action: **[Priority]** Title — what to do and why. Priorities: Critical / High / Medium / Low.

## Confidence
A single line: "Confidence: XX%" where XX is 0-100. Base it on:
- 90-100%: Direct, complete data from multiple sources
- 70-89%: Good data but some gaps or assumptions
- 50-69%: Partial data, conclusions are directional
- Below 50%: Significant data gaps; say what's missing

## Sources
List every data source you used, one per line:
- Tool Name — N records (e.g., "Receivables Summary — 14 records")

---

# CONVERSATION MEMORY
This conversation is persisted to the company database. Earlier in this conversation (and prior sessions) the following durable memories were recalled:
${memoryContext || '(no prior durable memories yet)'}

# BUSINESS DATA AVAILABLE
${hasData ? 'Below is the REAL data retrieved from the company database. Use ONLY this.' : 'WARNING: The database returned no business records. You must tell the user the data is unavailable.'}

${dataBlock || 'No tool data was retrieved.'}

---

# REMEMBER
- Never invent. Never estimate unless explicitly asked to forecast.
- If asked to forecast or predict, clearly label it as a projection based on the real trend data.
- Match the user's language (English / Hindi / Hinglish) but keep financial terms precise.
- Be the CFO the CEO trusts.
- NEVER contradict yourself. If you cite an overdue invoice, the customer who owes it needs follow-up — full stop.`;
}

// ─── Parse LLM output into structured sections ────────────────────────────────

interface ParsedResponse {
  content: string;
  executiveSummary: string;
  analysis: string;
  evidence: string;
  recommendedActions: RecommendedAction[];
  confidence: number;
  followUps: string[];
}

function parseSections(content: string): ParsedResponse {
  const result: ParsedResponse = {
    content,
    executiveSummary: '',
    analysis: '',
    evidence: '',
    recommendedActions: [],
    confidence: 0,
    followUps: [],
  };

  // Split by ## headers
  const sections = content.split(/^## /m);
  for (const section of sections) {
    const lower = section.toLowerCase();
    if (lower.startsWith('executive summary')) {
      result.executiveSummary = section.slice('executive summary'.length).trim();
    } else if (lower.startsWith('analysis')) {
      result.analysis = section.slice('analysis'.length).trim();
    } else if (lower.startsWith('evidence')) {
      result.evidence = section.slice('evidence'.length).trim();
    } else if (lower.startsWith('recommended actions')) {
      const body = section.slice('recommended actions'.length).trim();
      result.recommendedActions = parseActions(body);
    } else if (lower.startsWith('confidence')) {
      const m = section.match(/(\d{1,3})\s*%/);
      result.confidence = m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : 0;
    } else if (lower.startsWith('sources')) {
      // sources handled separately from tool results
    }
  }

  // Generate follow-up suggestions based on the conversation
  result.followUps = generateFollowUps(content);

  return result;
}

function parseActions(body: string): RecommendedAction[] {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const actions: RecommendedAction[] = [];
  for (const line of lines) {
    // Match: "1. **[Critical]** Title — detail" or "- **Critical** Title — detail"
    const m = line.match(/^\d+\.\s*\**\[(Critical|High|Medium|Low)\]?\**\s*(.+)$/i)
      || line.match(/^[-•]\s*\**\[(Critical|High|Medium|Low)\]?\**\s*(.+)$/i);
    if (m) {
      const priority = m[1].toLowerCase() as RecommendedAction['priority'];
      const rest = m[2].replace(/\*\*/g, '');
      const [title, ...detailParts] = rest.split('—');
      actions.push({
        priority,
        title: title.trim(),
        detail: detailParts.join('—').trim() || title.trim(),
        rationale: detailParts.join('—').trim(),
      });
    }
  }
  return actions;
}

function generateFollowUps(content: string): string[] {
  const lower = content.toLowerCase();
  const suggestions: string[] = [];
  if (lower.match(/overdue|outstanding|receivable/)) {
    suggestions.push('Which customers need follow-up today?');
  }
  if (lower.match(/cash|runway|burn/)) {
    suggestions.push('How can I improve cash flow this month?');
  }
  if (lower.match(/gst|tax/)) {
    suggestions.push('How much GST will I pay this period?');
  }
  if (lower.match(/revenue|growth|trend/)) {
    suggestions.push('Predict next month revenue');
  }
  if (lower.match(/expense|spend|cost/)) {
    suggestions.push('Where can I cut expenses?');
  }
  if (lower.match(/churn|customer/)) {
    suggestions.push('Which customers may churn?');
  }
  suggestions.push('Give me an executive briefing for today');
  suggestions.push('What should I worry about right now?');
  // Dedupe, cap at 4
  return Array.from(new Set(suggestions)).slice(0, 4);
}

// ─── Collect all sources from tool results ────────────────────────────────────

function collectSources(toolResults: ToolResult[]): SourceRef[] {
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const t of toolResults) {
    for (const s of t.sources) {
      const key = `${s.kind}:${s.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(s);
      }
    }
  }
  // Cap at 50 for the UI
  return sources.slice(0, 50);
}

// ─── Main orchestrator: streams events via callback ───────────────────────────

export interface AgentCallbacks {
  onEvent: (event: OracleStreamEvent) => void;
}

export async function runOracleAgent(
  req: OracleChatRequest,
  conversationId: string,
  callbacks: AgentCallbacks,
): Promise<void> {
  const { message, history = [] } = req;
  const agentStart = Date.now();

  // 1. Ensure DB session exists + emit conversation id
  await createSession({ id: conversationId });
  const isNew = !(await sessionHasMessages(conversationId));
  callbacks.onEvent({ type: 'conversation', conversationId, isNew });

  // 2. Persist the user message FIRST (real database memory)
  await persistUserMessage(conversationId, message);

  // 3. Recall durable semantic memory for context
  const memories = await recallMemory(8);
  const memoryContext = memories.length
    ? memories.map((m) => `- [${m.category}] ${m.title}${m.summary ? ` — ${m.summary}` : ''}`).join('\n')
    : '';

  // 4. Select tools
  const toolNames = selectTools(message);
  callbacks.onEvent({
    type: 'thinking',
    text: `Analyzing your question and selecting the right data sources…`,
  });

  // 5. Execute tools (with tool_call events)
  const toolCalls: ToolCall[] = toolNames.map((name) => ({
    name,
    label: TOOL_DEFINITIONS[name].label,
    reason: reasonForTool(name, message),
    startedAt: new Date().toISOString(),
  }));

  const toolResults: ToolResult[] = [];
  for (const call of toolCalls) {
    callbacks.onEvent({ type: 'tool_call', tool: call });
  }
  // Execute in parallel
  const results = await Promise.all(toolNames.map((n) => executeTool(n, message)));
  for (let i = 0; i < results.length; i++) {
    toolResults.push(results[i]);
    callbacks.onEvent({ type: 'tool_result', result: results[i] });
    // Audit every tool call to OracleAIToolCall (best-effort)
    void auditToolCall(conversationId, results[i]);
  }

  // 6. Check if we have ANY data at all
  const hasAnyData = toolResults.some((t) => t.recordCount > 0);
  const allSources = collectSources(toolResults);

  if (!hasAnyData) {
    // No business data — refuse to fabricate
    const noDataContent = `## Executive Summary
I don't have enough business data to answer that yet. Your company database currently has no invoices, customers, vendors, payments, expenses, GST returns, or bank transactions recorded.

## Analysis
Oracle is designed to answer exclusively from your real business data — never from generic knowledge or estimates. Right now the Memory Engine is empty, which means I cannot provide financial insights, cash flow analysis, receivables status, or any business intelligence.

## Evidence
- Memory Snapshot — 0 records
- No invoices, customers, vendors, payments, or expenses found in the database

## Recommended Actions
1. **[High]** Add your customers — Start by creating your customer/client records with their GSTIN details.
2. **[High]** Record your first invoice — Once customers exist, create invoices to begin building receivables data.
3. **[Medium]** Add vendors and expenses — Record purchase bills and operational expenses to enable payables and cash flow analysis.
4. **[Medium]** Connect bank accounts — Link your bank account to enable transaction reconciliation and live cash flow.
5. **[Low]** File GST returns — Once sales data exists, prepare and file GST returns to build tax history.

## Confidence
Confidence: 100%

## Sources
- Memory Snapshot — 0 records`;

    // Stream the no-data response as tokens
    const tokens = noDataContent.match(/.{1,12}/gs) || [noDataContent];
    for (const tok of tokens) {
      callbacks.onEvent({ type: 'token', text: tok });
    }
    callbacks.onEvent({ type: 'sources', sources: [] });
    callbacks.onEvent({ type: 'confidence', score: 100 });
    callbacks.onEvent({ type: 'actions', actions: [] });
    callbacks.onEvent({ type: 'followups', followUps: ['How do I add my first customer?', 'What can Oracle do once I have data?'] });
    const msgId = await persistOracleMessage(conversationId, {
      content: noDataContent,
      executiveSummary: 'I don\'t have enough business data to answer that yet.',
      confidence: 100,
      latencyMs: Date.now() - agentStart,
    });
    callbacks.onEvent({ type: 'done', finalContent: noDataContent, messageId: msgId });
    return;
  }

  // 7. Build conversation context (DB history takes precedence; fall back to client-passed)
  let recentHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  try {
    const { messages: dbMessages } = await loadSession(conversationId);
    // Exclude the just-persisted user message (it's sent separately) + placeholder
    recentHistory = dbMessages
      .filter((m) => m.content && m.id !== dbMessages[dbMessages.length - 1]?.id)
      .slice(-12)
      .map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }));
  } catch {
    // fall back to client-passed history
    recentHistory = history.slice(-6).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    }));
  }

  // 8. Build system prompt with tool data + memory
  const systemPrompt = buildSystemPrompt(toolResults, memoryContext);

  // 9. Stream LLM completion
  let fullContent = '';
  try {
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: message },
      ],
      thinking: { type: 'disabled' },
      stream: true,
    });

    // The SDK returns a ReadableStream<Uint8Array> of raw SSE bytes when
    // stream:true. We read it, decode, and parse `data:` lines for tokens.
    if (result && typeof (result as ReadableStream<Uint8Array>).getReader === 'function') {
      const reader = (result as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]' || !data) continue;
          try {
            const json = JSON.parse(data);
            const delta: string =
              json?.choices?.[0]?.delta?.content ??
              json?.choices?.[0]?.message?.content ??
              '';
            if (delta) {
              fullContent += delta;
              callbacks.onEvent({ type: 'token', text: delta });
            }
          } catch {
            // partial JSON across chunk boundary — resolves on next read
          }
        }
      }
      // Flush trailing buffer
      const tail = buffer.trim();
      if (tail.startsWith('data:')) {
        const data = tail.slice(5).trim();
        if (data && data !== '[DONE]') {
          try {
            const json = JSON.parse(data);
            const delta: string = json?.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullContent += delta;
              callbacks.onEvent({ type: 'token', text: delta });
            }
          } catch { /* ignore */ }
        }
      }
    } else {
      // Non-streaming fallback
      const text =
        (result as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
          ?.content ?? '';
      if (text) {
        fullContent = text;
        callbacks.onEvent({ type: 'token', text });
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'LLM stream failed';
    callbacks.onEvent({ type: 'error', message: errMsg });
    // Persist the error state
    await persistOracleMessage(conversationId, {
      content: `⚠️ ${errMsg}`,
      error: errMsg,
      latencyMs: Date.now() - agentStart,
    });
    return;
  }

  // 10. Parse structured sections
  const parsed = parseSections(fullContent);

  // Emit structured sections
  if (parsed.executiveSummary) {
    callbacks.onEvent({ type: 'section', section: 'executive_summary', text: parsed.executiveSummary });
  }
  if (parsed.analysis) {
    callbacks.onEvent({ type: 'section', section: 'analysis', text: parsed.analysis });
  }
  if (parsed.evidence) {
    callbacks.onEvent({ type: 'section', section: 'evidence', text: parsed.evidence });
  }
  if (parsed.recommendedActions.length > 0) {
    callbacks.onEvent({ type: 'actions', actions: parsed.recommendedActions });
  }
  callbacks.onEvent({ type: 'confidence', score: parsed.confidence });
  callbacks.onEvent({ type: 'sources', sources: allSources });
  callbacks.onEvent({ type: 'followups', followUps: parsed.followUps });

  // 11. Proactive insights (derived from tool data)
  const insights = deriveProactiveInsights(toolResults);
  if (insights.length > 0) {
    callbacks.onEvent({ type: 'insights', insights });
  }

  // 12. Persist VEYRO AI message to OracleAIMessage (real database memory)
  const oracleMsgId = await persistOracleMessage(conversationId, {
    content: fullContent,
    executiveSummary: parsed.executiveSummary,
    analysis: parsed.analysis,
    evidence: parsed.evidence,
    recommendedActions: parsed.recommendedActions,
    confidence: parsed.confidence,
    sources: allSources,
    toolCalls,
    toolResults,
    insights,
    followUps: parsed.followUps,
    latencyMs: Date.now() - agentStart,
  });

  // 13. Save durable memory for critical conclusions (best-effort)
  for (const ins of insights.filter((i) => i.severity === 'critical').slice(0, 2)) {
    void saveMemory({
      category: ins.category,
      title: ins.headline,
      summary: ins.detail,
      importance: 85,
      source: 'oracle-chat-proactive',
      payload: { conversationId, suggestedAction: ins.suggestedAction },
    });
  }
  // Remember the user's question + confidence as a lightweight memory
  void saveMemory({
    category: 'conversation',
    title: message.slice(0, 120),
    summary: `Confidence ${parsed.confidence}% · ${toolCalls.length} tools · ${allSources.length} sources cited`,
    importance: parsed.confidence >= 80 ? 60 : 40,
    source: 'oracle-chat',
    payload: { conversationId, confidence: parsed.confidence, tools: toolCalls.map((t) => t.name) },
  });

  callbacks.onEvent({ type: 'done', finalContent: fullContent, messageId: oracleMsgId });
}

// ─── Helper: does this session already have messages? ─────────────────────────

async function sessionHasMessages(sessionId: string): Promise<boolean> {
  try {
    const count = await (await import('@/lib/db')).db.oracleAIMessage.count({ where: { sessionId } });
    return count > 0;
  } catch {
    return false;
  }
}

// ─── Proactive insights — "I noticed…" ────────────────────────────────────────

function deriveProactiveInsights(toolResults: ToolResult[]): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];
  const find = (name: ToolName) => toolResults.find((t) => t.name === name);

  // Cash flow warnings
  const cash = find('cash_flow_summary');
  if (cash) {
    try {
      const d = JSON.parse(cash.summary);
      if (d.runwayDays !== null && d.runwayDays < 30) {
        insights.push({
          id: `ins-cash-${Date.now()}`,
          severity: 'critical',
          category: 'cash_flow',
          headline: `Cash runway is only ${d.runwayDays} days`,
          detail: `At the current burn rate of ₹${d.monthlyBurnRate}/month and bank balance of ₹${d.bankBalance}, your cash will last approximately ${d.runwayDays} days. Immediate collection or cost action is needed.`,
          sources: cash.sources,
          suggestedAction: 'Accelerate receivables collection and review discretionary expenses',
        });
      } else if (d.runwayDays !== null && d.runwayDays < 90) {
        insights.push({
          id: `ins-cash-${Date.now()}`,
          severity: 'warning',
          category: 'cash_flow',
          headline: `Cash runway is ${d.runwayDays} days — watch carefully`,
          detail: `Bank balance ₹${d.bankBalance} vs monthly burn ₹${d.monthlyBurnRate}. Runway is adequate but below the 90-day healthy threshold.`,
          sources: cash.sources,
          suggestedAction: 'Maintain collection discipline and monitor burn weekly',
        });
      }
    } catch { /* ignore parse errors */ }
  }

  // Overdue invoices
  const overdue = find('overdue_invoices');
  if (overdue && overdue.recordCount > 0) {
    insights.push({
      id: `ins-overdue-${Date.now()}`,
      severity: overdue.recordCount > 5 ? 'critical' : 'warning',
      category: 'receivables',
      headline: `${overdue.recordCount} invoice${overdue.recordCount === 1 ? '' : 's'} overdue`,
      detail: `There ${overdue.recordCount === 1 ? 'is an overdue invoice' : `are ${overdue.recordCount} overdue invoices`} past their due date. Each day of delay directly impacts your cash flow.`,
      sources: overdue.sources.slice(0, 5),
      suggestedAction: 'Send payment reminders to these customers today',
    });
  }

  // GST filing proximity
  const gst = find('search_gst_returns');
  if (gst) {
    try {
      const d = JSON.parse(gst.summary);
      const notFiled = [...(d.gstReturns || []), ...(d.gstFilings || [])].filter(
        (r: { status: string }) => r.status === 'not_started' || r.status === 'draft',
      );
      if (notFiled.length > 0) {
        insights.push({
          id: `ins-gst-${Date.now()}`,
          severity: 'warning',
          category: 'gst',
          headline: `${notFiled.length} GST return${notFiled.length === 1 ? '' : 's'} not yet filed`,
          detail: `GST returns are in draft or not-started state. Missing the filing deadline attracts late fees and interest.`,
          sources: gst.sources.slice(0, 3),
          suggestedAction: 'Prepare and file pending GST returns before the due date',
        });
      }
    } catch { /* ignore */ }
  }

  // Churn risk
  const churn = find('customer_churn_risk');
  if (churn) {
    try {
      const d = JSON.parse(churn.summary);
      if (d.highRisk > 0) {
        insights.push({
          id: `ins-churn-${Date.now()}`,
          severity: d.highRisk > 2 ? 'critical' : 'warning',
          category: 'customer',
          headline: `${d.highRisk} customer${d.highRisk === 1 ? '' : 's'} at high churn risk`,
          detail: `${d.highRisk} customer(s) show strong churn signals (no recent invoices, high overdue, or low engagement). ${d.mediumRisk} more at medium risk.`,
          sources: churn.sources.slice(0, 5),
          suggestedAction: 'Reach out to high-risk customers this week to re-engage',
        });
      }
    } catch { /* ignore */ }
  }

  // Vendor price increases
  const vpt = find('vendor_price_trends');
  if (vpt) {
    try {
      const d = JSON.parse(vpt.summary);
      if (d.increased?.length > 0) {
        insights.push({
          id: `ins-vendor-${Date.now()}`,
          severity: 'warning',
          category: 'expense',
          headline: `${d.increased.length} vendor${d.increased.length === 1 ? '' : 's'} raised prices`,
          detail: d.increased.slice(0, 3).map((v: { vendor: string; changePct: number }) => `${v.vendor} (+${v.changePct}%)`).join(', '),
          sources: vpt.sources.slice(0, 5),
          suggestedAction: 'Review contracts and negotiate or find alternatives',
        });
      }
    } catch { /* ignore */ }
  }

  // Receivables concentration
  const recv = find('receivables_summary');
  if (recv) {
    try {
      const d = JSON.parse(recv.summary);
      if (d.totals?.overdue?.amount > 0) {
        insights.push({
          id: `ins-recv-${Date.now()}`,
          severity: 'warning',
          category: 'receivables',
          headline: `₹${d.totals.overdue.amount} in overdue receivables`,
          detail: `Out of your total outstanding, ₹${d.totals.overdue.amount} across ${d.totals.overdue.count} invoice(s) is overdue. This is money sitting outside your bank.`,
          sources: recv.sources.slice(0, 5),
          suggestedAction: 'Prioritize collection on the oldest overdue invoices first',
        });
      }
    } catch { /* ignore */ }
  }

  return insights.slice(0, 4);
}
