# Task ID: 5-auth-onboarding-fix
Agent: Z.ai Code (main) — fullstack developer

## Task
Fix the onboarding/login flow in GSTPilot Infinity Next.js 16 app:
1. "Explore the platform" / Skip button must work instantly → Dashboard
2. Remove the onboarding questionnaire after Google/email login
3. Authentication must feel instant (no blank/loading forever/onboarding wizard/redirect loops)
4. Preserve existing users (don't delete anything)
5. Session must persist across refresh

## Previous Work Context (from worklog.md)
- AuthContext.tsx (391→538 lines): production-grade. Firebase Auth + localStorage cache restore + 3s safety timeout + demo mode fallback. `signInDemo()` sets a stable demo UID `dXKkLqbkIjbwN41dEG4pI6PgiMl2` mapped to local workspace `local-dXKkLqbkIjbwN41dEG4pI6PgiMl2`.
- OrgContext.tsx (521→679 lines): demo FAST PATH (lines 433-489) creates local workspace synchronously without loading Firebase. Real Firebase users go through `resolveOrgContext` which falls back to a local workspace if Firestore is unreachable. `needsOrganization = isAuthenticated && !loading && !organization` (line 626).
- AppRouter.tsx (468 lines): renders `<OnboardingScreen />` (lines 64-193) when `needsOnboarding=true`. The OnboardingScreen wraps `<OnboardingFlow>` (the questionnaire) and calls `createOrganization` on complete or on skip (creates `"${user.name}'s Workspace"` with `plan: 'free'`).
- LoginPage.tsx (640 lines): "Explore the platform" button (line 595) calls `signInDemo()` directly. Visual design must NOT change.
- OnboardingFlow.tsx (1165 lines): multi-step questionnaire. Exports `OnboardingData` and `OnboardingDestination` types.

## Plan (surgical, minimal)
1. **AppRouter.tsx**: Replace the entire `OnboardingScreen` component (lines 64-193) with a new `AutoProvisionWorkspace` component that:
   - On mount, runs the EXACT logic of the old `handleSkip` (create default workspace, call `completeOnboarding(orgId)`, navigate to dashboard)
   - Shows a brief loading state ("Setting up your workspace…") during provisioning
   - On failure, shows a minimal error card with Retry button (no loop, guarded by `ranRef`)
   - Does NOT render `<OnboardingFlow>` anymore
   - Uses a `ranRef` to prevent double-invocation in React StrictMode
2. **AppRouter.tsx**: Update the render branch (line 437-439) to render `<AutoProvisionWorkspace />` instead of `<OnboardingScreen />`. Also remove the unused `OnboardingFlow` dynamic import (verified: only this file referenced it).
3. **OnboardingFlow.tsx**: Add deprecation comment at the top.
4. **AuthContext.tsx & OrgContext.tsx**: Verify session persistence & demo fast path. Make NO changes unless something is actually broken (per task: "DO NOT change the core auth logic unless it's actually broken").
5. **LoginPage.tsx**: Verify "Explore the platform" calls `signInDemo()` with no blocking awaits. Make NO changes unless broken.

## Verification Checklist
- [ ] `npx eslint src/components/AppRouter.tsx src/contexts/AuthContext.tsx src/contexts/OrgContext.tsx src/components/auth/LoginPage.tsx` → 0 errors
- [ ] `npx tsc --noEmit` on changed files → 0 errors
- [ ] `<OnboardingFlow` no longer rendered in AppRouter (grep confirms)
- [ ] No schema changes / db:push / migrations
- [ ] Demo "Explore the platform" path still works (instant dashboard)
- [ ] Firebase login now auto-provisions a workspace silently
- [ ] Existing users unaffected (no deletions)

## Work Log
- (in progress)

## Verification Results
- ESLint (5 files): zero errors, zero warnings
- TypeScript (changed files via `npx tsc --noEmit | rg`): zero errors
- Turbopack compile: `✓ Compiled in 1370ms` — no compile errors
- `<OnboardingFlow` no longer rendered in AppRouter (grep confirms only comments remain)
- No schema changes / db:push / migrations
- Demo "Explore the platform" path: VERIFIED via agent-browser — opens to dashboard as Guest user; dev.log shows `local-dXKkLqbkIjbwN41dEG4pI6PgiMl2` workspace being actively queried (business/snapshot, recommendations, oracle/activation-insights, zoho integrations)
- Session persistence: VERIFIED — agent-browser opened http://localhost:3000/ and landed directly on dashboard (not landing page), confirming localStorage session restore works
- Firebase login auto-provision: Code-reviewed — `AutoProvisionWorkspace` runs `createOrganization({ name: "${user.name}'s Workspace", plan: 'free' })` → `completeOnboarding(orgId)` → navigates to dashboard, all silently
- Existing users: UNAFFECTED — `if (isAuthenticated)` branch in AppRouter unchanged; existing orgs continue to resolve normally via `resolveOrgContext`

## Stage Summary
Surgical fix completed. The onboarding questionnaire is GONE from the rendering pipeline. The flow is now:

  Landing Page → Login / Sign Up → Authentication Success → Dashboard
                                              ↓ (if no org)
                                              AutoProvisionWorkspace (silent, ~1-3s)
                                              ↓
                                              Dashboard

- 1 file substantively modified (AppRouter.tsx): replaced OnboardingScreen with AutoProvisionWorkspace
- 1 file comment-only modified (OnboardingFlow.tsx): added DEPRECATED header
- 3 files verified unchanged (AuthContext.tsx, OrgContext.tsx, LoginPage.tsx): no changes needed — session handling, demo fast path, and "Explore the platform" button all work correctly as-is
- 0 files deleted, 0 schema changes, 0 data migrations
- All existing users, organizations, Firestore data, Prisma data, Oracle conversations, settings, user profiles, and workspaces are PRESERVED
