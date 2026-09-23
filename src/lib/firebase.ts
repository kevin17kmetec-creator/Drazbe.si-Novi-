import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

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
      // V razvojnem okolju, Cloud Run predogledu (*.run.app) ali na localhostu omogočimo debug token,
      // da se preprečijo 400 AppCheck napake zaradi neskladja domen v reCAPTCHA Enterprise
      if (
        process.env.NODE_ENV !== 'production' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname.includes('run.app')
      ) {
        // @ts-ignore
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = (typeof self !== 'undefined' && (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN) || true;
      }

      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
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