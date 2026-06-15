import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

// ── Error code to human-readable message mapping ──
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/unauthorized-domain': 'This domain is not authorized for Google Sign-In. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
  'auth/cancelled-popup-request': 'Only one popup request is allowed at a time. Please try again.',
  'auth/redirect-operation-cancelled': 'The redirect operation was cancelled. Please try again.',
  'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
};

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code || '';
    return AUTH_ERROR_MESSAGES[code] || `Authentication error (${code}). Please try again.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected authentication error occurred. Please try again.';
}

// ── GOOGLE SIGN IN (popup primary, redirect fallback) ──
export async function signInWithGoogle(): Promise<{ user: User | null; error: string | null }> {
  try {
    // Prefer popup — better UX, easier to debug, works in most environments
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await saveUserToFirestore(result.user);
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || '';

    // If popup is blocked, fall back to redirect
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, googleProvider);
        // Page navigates away — won't reach here
        return { user: null, error: null };
      } catch (redirectError: unknown) {
        return { user: null, error: getAuthErrorMessage(redirectError) };
      }
    }

    return { user: null, error: getAuthErrorMessage(error) };
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT ──
// Called by AuthContext when the page loads after a redirect back from Google
export async function handleRedirectResult(): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      // CRITICAL: Save user to Firestore on first Google sign-in
      await saveUserToFirestore(result.user);
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: unknown) {
    return { user: null, error: getAuthErrorMessage(error) };
  }
}

// ── EMAIL SIGN IN ──
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || "";
    const messages: Record<string, string> = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Try again.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/user-disabled": "This account has been disabled.",
    };
    return { user: null, error: messages[code] || "Sign in failed. Please try again." };
  }
}

// ── EMAIL SIGN UP ──
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    // Send email verification
    await sendEmailVerification(result.user);
    await saveUserToFirestore(result.user, name);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || "";
    const messages: Record<string, string> = {
      "auth/email-already-in-use": "Account already exists. Sign in instead.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-email": "Please enter a valid email address.",
    };
    return { user: null, error: messages[code] || "Sign up failed. Please try again." };
  }
}

// ── SEND EMAIL VERIFICATION ──
export async function sendVerificationEmail(): Promise<{ error: string | null }> {
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
    return { error: null };
  } catch {
    return { error: "Could not send verification email." };
  }
}

// ── PASSWORD RESET ──
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch {
    return { error: "Could not send reset email. Check the address." };
  }
}

// ── SIGN OUT ──
export async function logOut() {
  await signOut(auth);
}

// ── SAVE USER TO FIRESTORE ──
async function saveUserToFirestore(user: User, displayName?: string) {
  try {
    const userRef = doc(db, "users", user.uid);
    const exists = await getDoc(userRef);
    if (!exists.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || "User",
        photoURL: user.photoURL || null,
        onboardingCompleted: false,
        createdAt: serverTimestamp(),
        plan: "free",
      });
    }
  } catch (error) {
    console.warn("Failed to save user to Firestore:", error);
  }
}

// ── AUTH STATE LISTENER ──
export { onAuthStateChanged, auth };
export type { User };
