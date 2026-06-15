import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAcq3nU7qOhi7zn0_2gYqamnmk-BZNTP24",
  authDomain: "gstpilot1.firebaseapp.com",
  projectId: "gstpilot1",
  storageBucket: "gstpilot1.firebasestorage.app",
  messagingSenderId: "44040248808",
  appId: "1:44040248808:web:466c38a29dd3f7a8dd185d",
  measurementId: "G-RN53TNYCK5"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });
