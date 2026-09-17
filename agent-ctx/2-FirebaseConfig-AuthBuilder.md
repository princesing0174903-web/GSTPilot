# Task 2: Firebase Config & Auth Builder

## Summary
Updated Firebase configuration and rebuilt the AuthContext with full Firebase Authentication support, removing all demo user logic and adding email verification + onboarding status tracking.

## Files Modified
1. `/src/lib/firebase.ts` - New Firebase config (gstpilot1) + Storage export
2. `/src/lib/auth.ts` - Added sendVerificationEmail(), email verification on signup, onboardingCompleted in Firestore doc
3. `/src/contexts/AuthContext.tsx` - Complete rewrite with new AuthUser interface, needsOnboarding, needsEmailVerification, refreshUserProfile
4. `/src/components/auth/LoginPage.tsx` - Removed demo login UI and references
5. `/src/components/team/TeamManagementPage.tsx` - Removed 'demo' provider check
6. `/src/app/page.tsx` - Added EmailVerificationBanner, needsOnboarding/needsEmailVerification handling

## Key Decisions
- onAuthStateChanged is the PRIMARY auth source (not localStorage fallbacks)
- localStorage is used for quick paint restore but always validated against Firebase
- Demo users completely removed from the entire flow
- Email verification banner shows for email-authenticated users who haven't verified
- needsOnboarding reads from Firestore doc's onboardingCompleted field
- refreshUserProfile() allows re-fetching Firestore data to update context

## Breaking Changes
- `loginWithDemo` removed from AuthContext
- `clearError` removed from AuthContext (use `setError(null)` instead)
- `isRedirecting` removed from AuthContext
- `AuthUser.provider` no longer includes 'demo' type
- `AuthUser.role` changed from union type to string
- New fields on AuthUser: emailVerified, onboardingCompleted, firmId, firmName, phone
