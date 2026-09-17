---
Task ID: 4
Agent: AI Agent OS Builder
Task: Build the AI Agent Operating System™ page

Work Log:
- Read worklog.md for full project context (GSTPilot codebase with 50+ components, Firebase integration, App Router)
- Created `/home/z/my-project/src/components/agent-os/AgentOSPage.tsx` — a comprehensive 800+ line component with 5 tabs
- Registered component in `src/app/page.tsx` (import + VIEW_TITLES + switch case for 'agent-os')
- Added sidebar entry in `src/components/app-sidebar.tsx` with Cpu icon and isNew badge
- Added Cpu to lucide-react imports in sidebar
- Verified with lint — no errors in AgentOSPage.tsx
- Verified dev server returns 200

Component Details:
- **Tab 1 (Gallery)**: Hero banner with gradient, 4 stat cards, 8 pre-built agent template cards (GST, Accounting, Invoice, Compliance, Collection, Sales, Audit, HR) with status badges, capabilities, runs, success rate, "Use Template" buttons
- **Tab 2 (Builder)**: 8-step builder (Name & Description → Trigger → Prompt → Memory → Knowledge Base → Actions → Permissions → Schedule) with step navigation, progress bar, live preview panel showing config summary, Test Agent simulation, Save/Deploy buttons
- **Tab 3 (My Agents)**: 5 custom agents in Running/Paused/Error states with sparkline charts, expandable details (config, recent runs, memory), quick actions (Run, Pause, Edit, Duplicate, Delete)
- **Tab 4 (Memory & Runs)**: Agent selector dropdown, memory browser with search/filter, run history with detail dialog, memory stats
- **Tab 5 (Marketplace)**: 6 community agents with author, downloads, ratings, install/uninstall toggle, "Share Your Agent" button

Design:
- Emerald + slate palette (NO indigo/blue)
- Indian number formatting (₹1,23,456)
- Framer Motion animations (fadeUp variants)
- All shadcn/ui components (Card, Badge, Tabs, ScrollArea, Dialog, Switch, Select, etc.)
- 20+ run history entries, 16+ memory entries, realistic configurations
- Responsive grid layouts

Demo Data:
- 8 pre-built agent templates with detailed configs
- 5 custom agents (3 Running, 1 Paused, 1 Error)
- 20 run history entries with full details
- 16 memory entries across agents
- 6 marketplace agents with ratings/downloads
