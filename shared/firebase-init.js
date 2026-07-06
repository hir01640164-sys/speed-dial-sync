import { initializeApp } from './vendor/firebase/firebase-app.js';
import { getAuth } from './vendor/firebase/firebase-auth.js';
import { getDatabase } from './vendor/firebase/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
