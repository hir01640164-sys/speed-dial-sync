// Firebaseの設定値です。
// apiKeyなどはクライアント側に公開される前提の値なので、GitHubの公開リポジトリに置いても問題ありません。
// 実際のアクセス制御はRealtime Databaseの「ルール」(認証ユーザーのUID一致)で行っています。
export const firebaseConfig = {
  apiKey: "AIzaSyAy1TSYxYjy0MmWxAVF1Tb1iWAI5G5UxVk",
  authDomain: "speed-dial-sync.firebaseapp.com",
  databaseURL: "https://speed-dial-sync-default-rtdb.firebaseio.com",
  projectId: "speed-dial-sync",
  storageBucket: "speed-dial-sync.firebasestorage.app",
  messagingSenderId: "42952757050",
  appId: "1:42952757050:web:7c3ee3ecc77b649160ca03"
};
