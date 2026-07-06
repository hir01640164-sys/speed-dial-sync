import { db } from './firebase-init.js';
import { setupAuth } from './auth.js';
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from './vendor/firebase/firebase-database.js';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const groupTabsEl = document.getElementById('group-tabs');
const linkGridEl = document.getElementById('link-grid');

const linkModal = document.getElementById('link-modal');
const linkModalTitle = document.getElementById('link-modal-title');
const linkTitleInput = document.getElementById('link-title-input');
const linkUrlInput = document.getElementById('link-url-input');
const linkGroupSelect = document.getElementById('link-group-select');
const linkSaveBtn = document.getElementById('link-save-btn');
const linkCancelBtn = document.getElementById('link-cancel-btn');
const linkDeleteBtn = document.getElementById('link-delete-btn');

let groups = {};
let links = {};
let activeGroupId = null;
let editingLinkId = null;
let draggedLinkId = null;
let draggedGroupId = null;

setupAuth((user) => {
  if (user) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    listenData();
  } else {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
  }
});

function listenData() {
  onValue(ref(db, 'groups'), (snapshot) => {
    groups = snapshot.val() || {};
    if (!activeGroupId || !groups[activeGroupId]) {
      const sorted = sortedGroupIds();
      activeGroupId = sorted[0] || null;
    }
    renderTabs();
    renderGrid();
  });
  onValue(ref(db, 'links'), (snapshot) => {
    links = snapshot.val() || {};
    renderGrid();
  });
}

function sortedGroupIds() {
  return Object.keys(groups).sort((a, b) => (groups[a].order ?? 0) - (groups[b].order ?? 0));
}

function linksInActiveGroup() {
  return Object.keys(links)
    .filter((id) => links[id].groupId === activeGroupId)
    .sort((a, b) => (links[a].order ?? 0) - (links[b].order ?? 0));
}

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
  } catch {
    return '';
  }
}

/* ---------- タブ(グループ)描画 ---------- */

function renderTabs() {
  groupTabsEl.innerHTML = '';
  sortedGroupIds().forEach((id) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (id === activeGroupId ? ' active' : '');
    tab.draggable = true;
    tab.dataset.id = id;

    const label = document.createElement('span');
    label.textContent = groups[id].name;
    tab.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGroup(id);
    });
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => {
      activeGroupId = id;
      renderTabs();
      renderGrid();
    });
    tab.addEventListener('dblclick', () => renameGroup(id));

    tab.addEventListener('dragstart', () => { draggedGroupId = id; });
    tab.addEventListener('dragover', (e) => { e.preventDefault(); tab.classList.add('drag-over'); });
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over'));
    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      reorderGroups(draggedGroupId, id);
    });

    groupTabsEl.appendChild(tab);
  });

  const addTab = document.createElement('div');
  addTab.className = 'tab-add';
  addTab.textContent = '+ グループ';
  addTab.addEventListener('click', addGroup);
  groupTabsEl.appendChild(addTab);
}

function addGroup() {
  const name = prompt('グループ名を入力してください');
  if (!name) return;
  const id = push(ref(db, 'groups')).key;
  set(ref(db, `groups/${id}`), { name, order: Object.keys(groups).length });
}

function renameGroup(id) {
  const name = prompt('新しいグループ名', groups[id].name);
  if (!name) return;
  update(ref(db, `groups/${id}`), { name });
}

function deleteGroup(id) {
  if (Object.keys(groups).length <= 1) {
    alert('最後のグループは削除できません');
    return;
  }
  if (!confirm(`グループ「${groups[id].name}」を削除しますか?中のリンクも削除されます`)) return;
  remove(ref(db, `groups/${id}`));
  Object.keys(links).forEach((linkId) => {
    if (links[linkId].groupId === id) remove(ref(db, `links/${linkId}`));
  });
  if (activeGroupId === id) activeGroupId = null;
}

function reorderGroups(draggedId, targetId) {
  if (!draggedId || draggedId === targetId) return;
  const ids = sortedGroupIds();
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  const updates = {};
  ids.forEach((id, index) => { updates[`groups/${id}/order`] = index; });
  update(ref(db), updates);
}

/* ---------- グリッド(カード)描画 ---------- */

function renderGrid() {
  linkGridEl.innerHTML = '';
  linksInActiveGroup().forEach((id) => {
    const link = links[id];
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.dataset.id = id;

    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = faviconUrl(link.url);
    card.appendChild(img);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = link.title;
    card.appendChild(title);

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLinkModal(id);
    });
    card.appendChild(editBtn);

    card.addEventListener('click', () => window.open(link.url, '_blank'));

    card.addEventListener('dragstart', () => { draggedLinkId = id; });
    card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      reorderLinks(draggedLinkId, id);
    });

    linkGridEl.appendChild(card);
  });

  const addCard = document.createElement('button');
  addCard.className = 'card card-add';
  addCard.textContent = '+';
  addCard.addEventListener('click', () => openLinkModal(null));
  linkGridEl.appendChild(addCard);
}

function reorderLinks(draggedId, targetId) {
  if (!draggedId || draggedId === targetId) return;
  const ids = linksInActiveGroup();
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return;
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  const updates = {};
  ids.forEach((id, index) => { updates[`links/${id}/order`] = index; });
  update(ref(db), updates);
}

/* ---------- リンク追加・編集モーダル ---------- */

function openLinkModal(linkId) {
  editingLinkId = linkId;
  linkGroupSelect.innerHTML = '';
  sortedGroupIds().forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = groups[id].name;
    linkGroupSelect.appendChild(opt);
  });

  if (linkId) {
    const link = links[linkId];
    linkModalTitle.textContent = 'リンクを編集';
    linkTitleInput.value = link.title;
    linkUrlInput.value = link.url;
    linkGroupSelect.value = link.groupId;
    linkDeleteBtn.classList.remove('hidden');
  } else {
    linkModalTitle.textContent = 'リンクを追加';
    linkTitleInput.value = '';
    linkUrlInput.value = '';
    linkGroupSelect.value = activeGroupId;
    linkDeleteBtn.classList.add('hidden');
  }
  linkModal.classList.remove('hidden');
}

function closeLinkModal() {
  linkModal.classList.add('hidden');
  editingLinkId = null;
}

linkCancelBtn.addEventListener('click', closeLinkModal);

linkSaveBtn.addEventListener('click', () => {
  const title = linkTitleInput.value.trim();
  let url = linkUrlInput.value.trim();
  if (!title || !url) {
    alert('タイトルとURLを入力してください');
    return;
  }
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  const groupId = linkGroupSelect.value;

  if (editingLinkId) {
    update(ref(db, `links/${editingLinkId}`), { title, url, groupId });
  } else {
    const id = push(ref(db, 'links')).key;
    const order = Object.values(links).filter((l) => l.groupId === groupId).length;
    set(ref(db, `links/${id}`), { title, url, groupId, order });
  }
  closeLinkModal();
});

linkDeleteBtn.addEventListener('click', () => {
  if (!editingLinkId) return;
  if (!confirm('このリンクを削除しますか?')) return;
  remove(ref(db, `links/${editingLinkId}`));
  closeLinkModal();
});
