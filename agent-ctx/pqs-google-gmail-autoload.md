# pqs-google — Gmail tab auto-load + premium empty states

## Task ID
pqs-google

## Agent
gmail-autoload-ux-fixer (single-agent direct task)

## Task
Fix the Google Workspace integration page (`src/components/google-workspace/GoogleWorkspacePage.tsx`):
the Gmail tab showed a dead "No messages loaded yet." state with a manual "Click Load above"
prompt. Make connected integrations feel alive by auto-loading messages on tab open and replacing
the empty/loading copy with something more premium.

Hard constraints: no new features/routes, no API/auth/data-structure changes, only improve *when*
messages load and *what* the empty/loading states say. Use existing shadcn/ui components. Ref guard
to prevent infinite loops.

## Work Log
1. Read `worklog.md` tail (prior context: the file is 1211 lines; GmailTab at lines 637–779;
   the dead empty state was at line 751; `NotConnectedGate` ensures GmailTab only mounts when
   `status?.connected === true`).
2. Read `GoogleWorkspacePage.tsx` GmailTab block + `useGoogleWorkspace` hook to confirm `status`
   is exposed and `NotConnectedGate` already gates mounting.
3. Edits applied to `src/components/google-workspace/GoogleWorkspacePage.tsx` (5 changes via
   MultiEdit):
   - **Import**: added `useRef` to the React import line.
   - **GmailTab state**: destructured `status` from `useGoogleWorkspace()`; added `hasLoaded`
     state (for UI) + `hasLoadedRef` ref (non-reactive guard).
   - **Auto-load `useEffect`** (new, after `loadMessages`): fires when `status?.connected` is
     true and `hasLoadedRef.current` is false. Sets the ref true, flips `hasLoaded` state, then
     calls `void loadMessages()` + `void loadProfile()`. Deps: `[status?.connected, loadMessages,
     loadProfile]`. Ref guard ⇒ runs at most once per mount ⇒ no infinite loop / no refetch on
     every render. `eslint-disable-next-line react-hooks/set-state-in-effect` on the
     `setHasLoaded(true)` line (same pattern as the existing `refreshStatus` effect at line 118).
   - **Button label**: renamed `Load` → `Refresh` (icon was already `RefreshCw`; the button now
     only serves explicit re-fetches since auto-load handles the initial load). Handler unchanged
     — still calls both `loadProfile()` + `loadMessages()`.
   - **Profile empty state**: replaced the stale `Click "Load" to fetch your Gmail profile.`
     copy (which referenced the now-renamed button) with a 3-row `Skeleton` shimmer during
     `loading || !hasLoaded`, and `No Gmail profile available.` when truly empty after load.
   - **Messages empty state** (the headline fix): replaced the dead
     `No messages loaded yet.` / `Click Load above to fetch…` block with a 3-way conditional:
       * `messages.length === 0 && (loading || !hasLoaded)` → spinner + `Fetching your latest
         messages…` label + 4 shimmer `Skeleton` rows mirroring the message-row layout.
       * `messages.length === 0 && !(loading || !hasLoaded)` → `Inbox` icon +
         `No messages in your inbox.` (truly empty after a successful load).
       * `messages.length > 0` → unchanged message list (stale data stays visible during a manual
         refresh rather than flashing to shimmer — better UX).
4. Ran `npx eslint` on the file. My changes produced **zero** new lint errors. The
   `react-hooks/set-state-in-effect` disable I added is correctly consumed (no "unused
   directive" warning for line 678). Two **pre-existing** issues remain in untouched regions
   (line 471 unused-disable in the Activity card's effect; line 561 `Activity` icon not imported
   from lucide-react) — both outside the Gmail tab and outside this task's scope.
5. Dev server (`dev.log`) restarted clean: `✓ Ready in 4.1s`, no runtime errors.

## Stage Summary
Gmail tab now auto-loads messages + profile the moment it's opened while Google is connected —
no manual click required. The first-paint shows a shimmer (`Fetching your latest messages…` +
skeleton rows / profile skeleton) instead of a dead empty box, so the tab feels alive instantly.
If the inbox is genuinely empty after load, it shows a calm `No messages in your inbox.`. The
manual `Refresh` button still works for explicit re-fetches. No API, auth, data-structure, route,
or connection-flow changes. Ref guard guarantees the auto-load fires exactly once per mount (no
infinite loops). Files touched: `src/components/google-workspace/GoogleWorkspacePage.tsx` only.
