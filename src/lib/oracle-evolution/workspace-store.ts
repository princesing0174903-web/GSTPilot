// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Upgrade Phase 1 · Upgrade 8: AI Workspace Enhancements
//
// Client-side workspace store for: pinned chats, saved prompts, drafts,
// favorites, recent actions, and shared conversations. Uses localStorage for
// persistence (no backend round-trip needed) with a clean API that the
// OracleWorkspace can consume.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PinnedChat {
  id: string;
  title: string;
  preview: string;
  agentId?: string;
  pinnedAt: string;
  messageCount: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  prompt: string;
  agentId?: string;
  category: 'finance' | 'gst' | 'tax' | 'audit' | 'collections' | 'cashflow' | 'compliance' | 'reporting' | 'general';
  createdAt: string;
  useCount: number;
}

export interface DraftMessage {
  id: string;
  content: string;
  agentId?: string;
  savedAt: string;
}

export interface FavoriteConversation {
  id: string;
  title: string;
  firstMessage: string;
  agentId?: string;
  messageCount: number;
  favoritedAt: string;
}

export interface SharedConversation {
  id: string;
  title: string;
  shareToken: string;
  sharedAt: string;
  expiresAt?: string;
  recipient?: string;
}

export interface RecentAction {
  id: string;
  actionId: string;
  label: string;
  agentId?: string;
  executedAt: string;
  status: 'success' | 'failed' | 'pending';
}

export interface GeneratedReport {
  id: string;
  title: string;
  reportType: string;
  generatedAt: string;
  agentId?: string;
  summary: string;
}

export interface WorkspaceStore {
  pinnedChats: PinnedChat[];
  savedPrompts: SavedPrompt[];
  drafts: DraftMessage[];
  favorites: FavoriteConversation[];
  shared: SharedConversation[];
  recentActions: RecentAction[];
  generatedReports: GeneratedReport[];
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gstpilot:oracle-workspace-v1';

// ─── Default seed prompts (so the workspace isn't empty on first load) ────────

const SEED_PROMPTS: SavedPrompt[] = [
  {
    id: 'seed-1',
    title: 'Monthly GST Summary',
    prompt: 'Give me a summary of my GST liability for this month — output tax, input tax credit, and net payable. Flag any anomalies.',
    agentId: 'gst',
    category: 'gst',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
  {
    id: 'seed-2',
    title: 'Cash Flow Forecast',
    prompt: 'What is my projected cash position for the next 30 days? Will I have enough to cover GST and salary payments?',
    agentId: 'cashflow',
    category: 'cashflow',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
  {
    id: 'seed-3',
    title: 'Overdue Collections',
    prompt: 'Which customers have overdue invoices? Prioritize them by amount and days overdue. Suggest the right collection action for each.',
    agentId: 'collections',
    category: 'collections',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
  {
    id: 'seed-4',
    title: 'Executive Brief',
    prompt: 'Prepare an executive summary of my financial position this month — revenue, expenses, margin, GST status, and top 3 risks.',
    agentId: 'reporting',
    category: 'reporting',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
  {
    id: 'seed-5',
    title: 'Compliance Deadlines',
    prompt: 'What compliance deadlines are coming up in the next 30 days? Calculate the penalty exposure if any are missed.',
    agentId: 'compliance',
    category: 'compliance',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
  {
    id: 'seed-6',
    title: 'Profitability Analysis',
    prompt: 'Analyze my profit margin trend over the last 6 months. What is driving any changes — revenue mix, cost structure, or operating efficiency?',
    agentId: 'finance',
    category: 'finance',
    createdAt: new Date().toISOString(),
    useCount: 0,
  },
];

// ─── Load / save ──────────────────────────────────────────────────────────────

export function loadWorkspaceStore(): WorkspaceStore {
  if (typeof window === 'undefined') {
    return {
      pinnedChats: [],
      savedPrompts: SEED_PROMPTS,
      drafts: [],
      favorites: [],
      shared: [],
      recentActions: [],
      generatedReports: [],
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: WorkspaceStore = {
        pinnedChats: [],
        savedPrompts: SEED_PROMPTS,
        drafts: [],
        favorites: [],
        shared: [],
        recentActions: [],
        generatedReports: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceStore>;
    return {
      pinnedChats: parsed.pinnedChats ?? [],
      savedPrompts: parsed.savedPrompts?.length ? parsed.savedPrompts : SEED_PROMPTS,
      drafts: parsed.drafts ?? [],
      favorites: parsed.favorites ?? [],
      shared: parsed.shared ?? [],
      recentActions: parsed.recentActions ?? [],
      generatedReports: parsed.generatedReports ?? [],
    };
  } catch {
    return {
      pinnedChats: [],
      savedPrompts: SEED_PROMPTS,
      drafts: [],
      favorites: [],
      shared: [],
      recentActions: [],
      generatedReports: [],
    };
  }
}

function saveStore(store: WorkspaceStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage may be full or disabled — fail silently
  }
}

function genId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Pinned chats ─────────────────────────────────────────────────────────────

export function pinChat(chat: Omit<PinnedChat, 'id' | 'pinnedAt'>): PinnedChat {
  const store = loadWorkspaceStore();
  const pinned: PinnedChat = { ...chat, id: genId(), pinnedAt: new Date().toISOString() };
  store.pinnedChats = [pinned, ...store.pinnedChats.filter((c) => c.title !== chat.title)].slice(0, 20);
  saveStore(store);
  return pinned;
}

export function unpinChat(id: string): void {
  const store = loadWorkspaceStore();
  store.pinnedChats = store.pinnedChats.filter((c) => c.id !== id);
  saveStore(store);
}

// ─── Saved prompts ────────────────────────────────────────────────────────────

export function savePrompt(prompt: Omit<SavedPrompt, 'id' | 'createdAt' | 'useCount'>): SavedPrompt {
  const store = loadWorkspaceStore();
  const saved: SavedPrompt = { ...prompt, id: genId(), createdAt: new Date().toISOString(), useCount: 0 };
  store.savedPrompts = [saved, ...store.savedPrompts].slice(0, 50);
  saveStore(store);
  return saved;
}

export function deletePrompt(id: string): void {
  const store = loadWorkspaceStore();
  store.savedPrompts = store.savedPrompts.filter((p) => p.id !== id);
  saveStore(store);
}

export function incrementPromptUse(id: string): void {
  const store = loadWorkspaceStore();
  const prompt = store.savedPrompts.find((p) => p.id === id);
  if (prompt) {
    prompt.useCount += 1;
    saveStore(store);
  }
}

// ─── Drafts ───────────────────────────────────────────────────────────────────

export function saveDraft(content: string, agentId?: string): DraftMessage {
  const store = loadWorkspaceStore();
  // Replace existing draft for same agent, or add new
  const existing = store.drafts.find((d) => d.agentId === agentId);
  if (existing) {
    existing.content = content;
    existing.savedAt = new Date().toISOString();
    saveStore(store);
    return existing;
  }
  const draft: DraftMessage = { id: genId(), content, agentId, savedAt: new Date().toISOString() };
  store.drafts = [draft, ...store.drafts].slice(0, 10);
  saveStore(store);
  return draft;
}

export function clearDraft(id: string): void {
  const store = loadWorkspaceStore();
  store.drafts = store.drafts.filter((d) => d.id !== id);
  saveStore(store);
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export function favoriteConversation(conv: Omit<FavoriteConversation, 'id' | 'favoritedAt'>): FavoriteConversation {
  const store = loadWorkspaceStore();
  const fav: FavoriteConversation = { ...conv, id: genId(), favoritedAt: new Date().toISOString() };
  store.favorites = [fav, ...store.favorites.filter((f) => f.title !== conv.title)].slice(0, 30);
  saveStore(store);
  return fav;
}

export function unfavorite(id: string): void {
  const store = loadWorkspaceStore();
  store.favorites = store.favorites.filter((f) => f.id !== id);
  saveStore(store);
}

// ─── Shared conversations ─────────────────────────────────────────────────────

export function shareConversation(title: string, recipient?: string): SharedConversation {
  const store = loadWorkspaceStore();
  const shared: SharedConversation = {
    id: genId(),
    title,
    shareToken: Math.random().toString(36).slice(2, 12).toUpperCase(),
    sharedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recipient,
  };
  store.shared = [shared, ...store.shared].slice(0, 20);
  saveStore(store);
  return shared;
}

export function revokeShare(id: string): void {
  const store = loadWorkspaceStore();
  store.shared = store.shared.filter((s) => s.id !== id);
  saveStore(store);
}

// ─── Recent actions ───────────────────────────────────────────────────────────

export function recordAction(action: Omit<RecentAction, 'id' | 'executedAt'>): RecentAction {
  const store = loadWorkspaceStore();
  const recent: RecentAction = { ...action, id: genId(), executedAt: new Date().toISOString() };
  store.recentActions = [recent, ...store.recentActions].slice(0, 25);
  saveStore(store);
  return recent;
}

// ─── Generated reports ────────────────────────────────────────────────────────

export function recordGeneratedReport(report: Omit<GeneratedReport, 'id' | 'generatedAt'>): GeneratedReport {
  const store = loadWorkspaceStore();
  const gen: GeneratedReport = { ...report, id: genId(), generatedAt: new Date().toISOString() };
  store.generatedReports = [gen, ...store.generatedReports].slice(0, 25);
  saveStore(store);
  return gen;
}

// ─── Workspace stats ──────────────────────────────────────────────────────────

export interface WorkspaceStats {
  totalPinned: number;
  totalPrompts: number;
  totalDrafts: number;
  totalFavorites: number;
  totalShared: number;
  totalActions: number;
  totalReports: number;
  mostUsedPrompt?: SavedPrompt;
}

export function getWorkspaceStats(): WorkspaceStats {
  const store = loadWorkspaceStore();
  const mostUsed = [...store.savedPrompts].sort((a, b) => b.useCount - a.useCount)[0];
  return {
    totalPinned: store.pinnedChats.length,
    totalPrompts: store.savedPrompts.length,
    totalDrafts: store.drafts.length,
    totalFavorites: store.favorites.length,
    totalShared: store.shared.length,
    totalActions: store.recentActions.length,
    totalReports: store.generatedReports.length,
    mostUsedPrompt: mostUsed?.useCount > 0 ? mostUsed : undefined,
  };
}
