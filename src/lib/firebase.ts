import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config — read from environment variables (production best practice).
// Falls back to the known config values if env vars are not set (dev/preview mode).
//
// NOTE: Firebase Storage is no longer initialized here — file storage was
// migrated to Supabase Storage (see @/lib/supabase.ts). Firebase Auth,
// Firestore, and Firebase Functions remain on Firebase and are unchanged.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAcq3nU7qOhi7zn0_2gYqamnmk-BZNTP24",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "gstpilot1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "gstpilot1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "gstpilot1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "44040248808",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:44040248808:web:466c38a29dd3f7a8dd185d",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-RN53TNYCK5",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged };

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });
