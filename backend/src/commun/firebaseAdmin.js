import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const app = initializeApp({
  credential: cert(serviceAccount),
});

// Le SDK Admin contourne firestore.rules : lui seul accède désormais à Firestore
// en écriture (le front garde une lecture directe restreinte pour 3 collections,
// voir firestore.rules).
export const db = getFirestore(app);
export const auth = getAuth(app);
