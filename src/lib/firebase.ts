import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCAdjRrnsplkFjucphLUbi2cZnULeq4Hyk",
  authDomain: "gstpilot-f226e.firebaseapp.com",
  projectId: "gstpilot-f226e",
  storageBucket: "gstpilot-f226e.firebasestorage.app",
  messagingSenderId: "209971226015",
  appId: "1:209971226015:web:8550c72eee8679abd989aa",
  measurementId: "G-2KRBQF220F"
};

// Initialize Firebase (prevent re-initialization in dev with HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });
