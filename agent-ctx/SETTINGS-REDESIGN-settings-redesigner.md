# SETTINGS-REDESIGN — Settings Page Redesigner

## Task
Redesign `src/components/settings/SettingsPage.tsx` so that:
- Only the settings content area scrolls (NOT the sidebar, NOT the page header)
- Sticky left navigation with blue left-border active state
- Beautiful enterprise cards, proper spacing
- Premium dark theme (pure black bg, #0A0A0A cards, #1F1F1F borders, blue accent)

## Root cause of "entire page scrolls" bug
The SettingsPage outer div used `h-full` to fill its parent `<main>` (in DashboardShell).
The parent `<main className="min-w-0 flex-1 overflow-y-auto custom-scrollbar">` has a
definite height via flex-stretch, BUT `overflow-y-auto` on the parent + `h-full` on the
child can collapse in edge cases (especially when intermediate wrappers don't propagate
height). When `h-full` fails to resolve, SettingsPage sizes to its content (tall), and the
parent `<main>` scrolls the entire SettingsPage (sidebar + header + content all move).

## Fix
Replace `h-full` with an explicit viewport-relative height:
`h-[calc(100vh-3.5rem)]` (viewport minus the 56px DashboardShell top header).
This is a definite length that does NOT depend on the parent percentage chain —
bulletproof regardless of intermediate wrappers.

## Layout architecture (new)
```
<div flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-black>   ← root (definite height)
  <header shrink-0 border-b px-8 py-5>                                 ← page header (fixed)
    "Settings" title + subtitle    |    [Save] sticky button
  <div flex flex-1 min-h-0>                                            ← body row
    <aside w-64 shrink-0 overflow-y-auto border-r>                     ← sticky sidebar (own scroll)
      group: WORKSPACE / ACCOUNT / SYSTEM
      nav buttons with blue left-border active state
    <main flex-1 overflow-y-auto>                                      ← content (ONLY this scrolls)
      <div max-w-4xl mx-auto px-8 py-8>
        section cards
```

## Sections (kept all 12, regrouped)
- WORKSPACE: Organization, Users (was Team), OAuth (was Integrations)
- ACCOUNT: Profile, Security, Notifications, Appearance
- SYSTEM: API Keys, Billing, Audit Logs (was Audit Log), Data & Backup, Danger Zone

## Design system alignment
- SettingsCard → uses `.gst-card` base (bg #0A0A0A, border #1F1F1F, p-6, rounded-xl)
- PrimaryButton → `.gst-btn .gst-btn-primary`
- StatusPill → `.gst-status .gst-status-success` / `.gst-status-neutral`
- AuditLog → `.gst-table` enterprise table

## Constraints honored
- NO API endpoints changed (all fetch calls preserved verbatim)
- NO functionality removed (all 12 sections still render)
- NO new API calls added (no fake "Test Connection" buttons — would violate no-dead-buttons)
- Existing deep-link map (pendingSettingsSection) preserved

## Files touched
- `src/components/settings/SettingsPage.tsx` (rewrite of shell, sidebar, primitives, + targeted section enhancements)

## Lint
`npx eslint src/components/settings/SettingsPage.tsx` — must pass clean.
