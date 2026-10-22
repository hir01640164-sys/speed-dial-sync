// ブラウザ内保存のデータ層。Firebase Realtime Database と同じ形の関数
// (ref / push / set / update / remove / onValue)を提供し、app.js 側の呼び出しを変えずに済ませる。
// 拡張機能では chrome.storage.local、それ以外(通常のページ)では localStorage に保存する。

const DATA_KEY = 'speedDialData';
const COLLECTIONS = ['groups', 'links', 'fences'];

const extStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

let data = null;
const listeners = [];

export const db = {};

function emptyData() {
  return { groups: {}, links: {}, fences: {} };
}

function normalize(raw) {
  const result = emptyData();
  if (raw && typeof raw === 'object') {
    COLLECTIONS.forEach((key) => {
      if (raw[key] && typeof raw[key] === 'object') result[key] = raw[key];
    });
  }
  return result;
}

async function readStored() {
  if (extStorage) {
    const stored = await extStorage.get(DATA_KEY);
    return stored[DATA_KEY] ?? null;
  }
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY));
  } catch {
    return null;
  }
}

function persist() {
  if (extStorage) {
    extStorage.set({ [DATA_KEY]: data }).catch((err) => alert('保存に失敗しました: ' + err.message));
    return;
  }
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch (err) {
    alert('保存に失敗しました(容量オーバーの可能性があります): ' + err.message);
  }
}

function notify(changedRoots) {
  listeners.forEach((l) => {
    if (changedRoots.has(l.root)) l.callback(makeSnapshot(l.root));
  });
}

function makeSnapshot(root) {
  const value = root ? data[root] : data;
  return { val: () => (value === undefined ? null : JSON.parse(JSON.stringify(value))) };
}

function splitPath(path) {
  return path.split('/').filter(Boolean);
}

function setAt(path, value) {
  const keys = splitPath(path);
  if (!keys.length) return;
  let node = data;
  for (let i = 0; i < keys.length - 1; i++) {
    if (node[keys[i]] === undefined || node[keys[i]] === null || typeof node[keys[i]] !== 'object') {
      if (value === null || value === undefined) return;
      node[keys[i]] = {};
    }
    node = node[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = value;
}

export async function initStore() {
  const raw = await readStored();
  data = normalize(raw);
  const hadData = raw !== null && raw !== undefined;

  const onExternalChange = (newRaw) => {
    data = normalize(newRaw);
    notify(new Set(COLLECTIONS));
  };
  if (extStorage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[DATA_KEY]) onExternalChange(changes[DATA_KEY].newValue);
    });
  } else {
    window.addEventListener('storage', (e) => {
      if (e.key !== DATA_KEY) return;
      try { onExternalChange(JSON.parse(e.newValue)); } catch { /* 破損データは無視 */ }
    });
  }
  return hadData;
}

export function ref(_db, path = '') {
  return { path: splitPath(path).join('/') };
}

export function push() {
  const key = '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return { key };
}

export function set(r, value) {
  setAt(r.path, value);
  persist();
  notify(new Set([splitPath(r.path)[0]]));
}

export function update(r, values) {
  const roots = new Set();
  Object.keys(values).forEach((key) => {
    const full = r.path ? `${r.path}/${key}` : key;
    roots.add(splitPath(full)[0]);
    setAt(full, values[key]);
  });
  persist();
  notify(roots);
}

export function remove(r) {
  setAt(r.path, null);
  if (!splitPath(r.path).length) data = emptyData();
  persist();
  notify(new Set(splitPath(r.path).length ? [splitPath(r.path)[0]] : COLLECTIONS));
}

export function onValue(r, callback) {
  const root = splitPath(r.path)[0];
  listeners.push({ root, callback });
  callback(makeSnapshot(root));
}

export function getAllData() {
  return JSON.parse(JSON.stringify(data));
}

export function replaceAllData(newData) {
  data = normalize(newData);
  persist();
  notify(new Set(COLLECTIONS));
}
