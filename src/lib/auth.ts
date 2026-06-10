import {
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

// ── GOOGLE SIGN IN (redirect method — works on all browsers) ──
export async function signInWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
}

// ── HANDLE GOOGLE REDIRECT RESULT (call on every page load) ──
export async function handleRedirectResult(): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await saveUserToFirestore(result.user);
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google sign-in failed.";
    // Handle unauthorized-domain specifically
    if (message.includes("unauthorized-domain")) {
      return { user: null, error: "This domain is not authorized for Google Sign-In. Please contact support." };
    }
    return { user: null, error: message };
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
        createdAt: serverTimestamp(),
        plan: "free",
        gstNumbers: [],
      });
    }
  } catch (error) {
    // Firestore write failure shouldn't block login
    console.warn("Failed to save user to Firestore:", error);
  }
}

// ── AUTH STATE LISTENER ──
export { onAuthStateChanged, auth };
export type { User };
