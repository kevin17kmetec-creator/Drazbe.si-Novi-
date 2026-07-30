import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
    initializeApp({
        credential: applicationDefault()
    });
}

const db = getFirestore();
const adminObj: any = {};
export { adminObj as admin, db };
