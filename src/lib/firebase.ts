import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyAIBpZLRkpmgUION6mLrz5Us04Sk4LRrso",
  authDomain: "drazbesi.firebaseapp.com",
  projectId: "drazbesi",
  storageBucket: "drazbesi.firebasestorage.app",
  messagingSenderId: "922499036814",
  appId: "1:922499036814:web:bf668f4bd612570265bbdf"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

if (typeof window !== 'undefined') {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (err) {
      console.warn("AppCheck initialization error:", err);
    }
  }
}

export const auth = getAuth(app);
// Fixed default production database mapping
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export const storage = getStorage(app);