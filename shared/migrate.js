// 旧バージョン(Firebase保存)からの一度きりのデータ引き継ぎ。
// Firebase SDKは引き継ぎが必要なときだけ動的に読み込む。

const AUTH_WAIT_MS = 5000;
const READ_TIMEOUT_MS = 15000;

let firebase = null;

async function loadFirebase() {
  if (!firebase) {
    const [init, authMod, dbMod] = await Promise.all([
      import('./firebase-init.js'),
      import('./vendor/firebase/firebase-auth.js'),
      import('./vendor/firebase/firebase-database.js'),
    ]);
    firebase = { auth: init.auth, db: init.db, ...authMod, ...dbMod };
  }
  return firebase;
}

function waitForRestoredUser(f) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsubscribe(); resolve(null); }, AUTH_WAIT_MS);
    const unsubscribe = f.onAuthStateChanged(f.auth, (user) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    });
  });
}

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebaseからの読み込みがタイムアウトしました')), READ_TIMEOUT_MS)),
  ]);
}

// 戻り値: { status: 'ok', data } | { status: 'need-login' }
// 失敗時は例外を投げる。
export async function migrateFromFirebase({ email, password } = {}) {
  const f = await loadFirebase();
  let user = f.auth.currentUser || await waitForRestoredUser(f);
  if (!user) {
    if (!email) return { status: 'need-login' };
    user = (await f.signInWithEmailAndPassword(f.auth, email, password)).user;
  }

  const read = async (path) => (await withTimeout(f.get(f.ref(f.db, path)))).val() || {};
  const [groups, links, fences] = await Promise.all([read('groups'), read('links'), read('fences')]);

  await f.signOut(f.auth).catch(() => {});
  return { status: 'ok', data: { groups, links, fences } };
}
