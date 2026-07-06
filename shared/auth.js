import { auth } from './firebase-init.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from './vendor/firebase/firebase-auth.js';

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

export function setupAuth(onStateChange) {
  onAuthStateChanged(auth, (user) => onStateChange(user));

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value).catch((err) => {
      loginError.textContent = 'ログインに失敗しました: ' + err.message;
    });
  });

  logoutBtn.addEventListener('click', () => signOut(auth));
}
