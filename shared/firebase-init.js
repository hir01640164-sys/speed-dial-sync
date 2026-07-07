import { initializeApp } from './vendor/firebase/firebase-app.js';
import { getAuth } from './vendor/firebase/firebase-auth.js';
import { getDatabase, forceWebSockets } from './vendor/firebase/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

// script要素を動的に読み込むlong-pollingにフォールバックすると、
// Manifest V3のCSP(script-src 'self')でブロックされるため、WebSocket固定にする
forceWebSockets();

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
