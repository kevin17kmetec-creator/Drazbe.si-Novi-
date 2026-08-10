import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app;
try {
    if (!getApps().length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            app = initializeApp({
                credential: cert(serviceAccount)
            });
        } else {
            app = initializeApp({
                credential: applicationDefault()
            });
        }
    } else {
        app = getApps()[0];
    }
} catch (error: any) {
    console.error("Firebase admin init failed:", error.message);
}

let db: any;
try {
    db = getFirestore();
} catch (error: any) {
    console.error("getFirestore failed:", error.message);
    db = {
        collection: () => { 
            throw new Error("Firestore not initialized. On Vercel, ensure FIREBASE_SERVICE_ACCOUNT env var is set. Error: " + error.message); 
        }
    };
}

const adminObj: any = {};
export { adminObj as admin, db };
