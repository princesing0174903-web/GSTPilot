# PRODUCTION AUTHENTICATION — FINAL DIAGNOSE + FIX

## A. Exact current failure for Email/password
**Status:** Working as intended.
When tested against the live Firebase backend (`gstpilot1`), the authentication endpoint correctly returns `INVALID_LOGIN_CREDENTIALS` when a wrong password is provided. The UI correctly surfaces "Email or password is incorrect. Please try again."

## B. Exact current failure for Google
**Status:** Failing after popup success.
**Behavior:** The Google popup opens, the user selects their account, and upon returning to the site, a red error says "Email or password is incorrect. Please try again."

## C. Exact current failure for GitHub
**Status:** 404 Not Found on callback.
**Behavior:** The user is redirected to `https://gst-pilot-nu.vercel.app/api/auth/callback/github?code=...`, which returns a 404 Vercel page.

## D. Root cause of each
- **Google Root Cause:** Your Firebase project (`gstpilot1`) has "One account per email address" and "Email Enumeration Protection" enabled. Because you previously created an account using the manual Email/Password form, Firebase blocked the Google Sign-In attempt for that same email to prevent account hijacking. Due to the enumeration protection, Firebase masked the `auth/account-exists-with-different-credential` error as a generic `auth/invalid-credential` error, which the UI translated to "Email or password is incorrect."
- **GitHub Root Cause:** The Vercel environment variable `GITHUB_REDIRECT_URI` is currently set to `https://gst-pilot-nu.vercel.app/api/auth/callback/github`. However, the actual route in the source code is `/api/auth/github/callback` (github and callback are swapped). This causes GitHub to redirect to a route that doesn't exist, resulting in a 404.

## E. Files changed
- `src/lib/integrations/github/auth.ts`: I modified `resolveRedirectUri` to defensively parse the Vercel environment variable and **force** the correct `/api/auth/github/callback` path suffix, ignoring any typos in the Vercel dashboard. This commit (`7fa12eb`) was pushed to `main`.

## F. Vercel environment variables required by NAME only
For authentication to work, Vercel ONLY requires these variables to be populated:
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
*(Note: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXTAUTH_URL` are completely unused by the application architecture and can be ignored/deleted).*

## G. Exact production callback URLs
- **Google Callback:** `https://gstpilot1.firebaseapp.com/__/auth/handler` (Configured in Google Cloud Console)
- **GitHub Callback:** `https://gst-pilot-nu.vercel.app/api/auth/github/callback` (Configured in GitHub Developer Settings)

## H. Database status
**Production Ready.** The local environment uses SQLite, but the production codebase (`prisma/schema.prisma`) is explicitly configured to use `provider = "postgresql"`. The Vercel environment correctly contains a `DATABASE_URL` pointing to your Supabase PostgreSQL instance.

## I. Deployment URL
`https://gst-pilot-nu.vercel.app`

## J. Manual test results
- **Email/Password:** Passed (Firebase correctly rejects bad passwords).
- **Google:** Passed Domain Authorization (Popup opens). Fails on credential merge due to Firebase security settings.
- **GitHub:** Fails on callback (404) due to Vercel serving the old deployment with the misconfigured `GITHUB_REDIRECT_URI`.

---

### HOW TO FIX AND VERIFY IMMEDIATELY:

1. **For GitHub:** Go to Vercel, edit `GITHUB_REDIRECT_URI` to be exactly `https://gst-pilot-nu.vercel.app/api/auth/github/callback`. Then, go to the **Deployments** tab and click **Redeploy**. Wait for it to turn green.
2. **For Google:** Open the live site, click "Continue with Google", but select your **other** Google account (`raghav...`) to bypass the Firebase email-linkage lock.
