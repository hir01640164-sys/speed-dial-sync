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
const pagePrevBtn = document.getElementById('page-prev-btn');
const pageNextBtn = document.getElementById('page-next-btn');
const tabContextMenu = document.getElementById('tab-context-menu');
const tabRenameBtn = document.getElementById('tab-rename-btn');
const tabDeleteBtn = document.getElementById('tab-delete-btn');

const linkModal = document.getElementById('link-modal');
const linkModalTitle = document.getElementById('link-modal-title');
const linkTitleInput = document.getElementById('link-title-input');
const linkUrlInput = document.getElementById('link-url-input');
const linkGroupSelect = document.getElementById('link-group-select');
const linkSaveBtn = document.getElementById('link-save-btn');
const linkCancelBtn = document.getElementById('link-cancel-btn');
const linkDeleteBtn = document.getElementById('link-delete-btn');
const linkIconPreview = document.getElementById('link-icon-preview');
const linkIconModeSelect = document.getElementById('link-icon-mode-select');
const linkIconUrlInput = document.getElementById('link-icon-url-input');
const linkIconFileInput = document.getElementById('link-icon-file-input');
const linkIconPresetGrid = document.getElementById('link-icon-preset-grid');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const themeColorInput = document.getElementById('theme-color-input');
const columnsInput = document.getElementById('columns-input');
const columnsValue = document.getElementById('columns-value');
const marginXInput = document.getElementById('margin-x-input');
const marginXValue = document.getElementById('margin-x-value');
const marginYInput = document.getElementById('margin-y-input');
const marginYValue = document.getElementById('margin-y-value');
const iconScaleInput = document.getElementById('icon-scale-input');
const iconScaleValue = document.getElementById('icon-scale-value');
const topbarOpacityInput = document.getElementById('topbar-opacity-input');
const topbarOpacityValue = document.getElementById('topbar-opacity-value');
const cardOpacityInput = document.getElementById('card-opacity-input');
const cardOpacityValue = document.getElementById('card-opacity-value');
const bgImageInput = document.getElementById('bg-image-input');
const bgImageFileInput = document.getElementById('bg-image-file-input');
const bgImagePreview = document.getElementById('bg-image-preview');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsResetBtn = document.getElementById('settings-reset-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');

let groups = {};
let links = {};
let activeGroupId = null;
let editingLinkId = null;
let draggedLinkId = null;
let draggedGroupId = null;
let currentPage = 0;
let contextMenuGroupId = null;

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

    tab.addEventListener('click', () => {
      activeGroupId = id;
      currentPage = 0;
      renderTabs();
      renderGrid();
    });
    tab.addEventListener('dblclick', (e) => {
      e.preventDefault();
      openTabContextMenu(id, tab);
    });

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

function openTabContextMenu(id, tabEl) {
  contextMenuGroupId = id;
  const rect = tabEl.getBoundingClientRect();
  tabContextMenu.style.left = rect.left + 'px';
  tabContextMenu.style.top = rect.bottom + 4 + 'px';
  tabContextMenu.classList.remove('hidden');
}

function closeTabContextMenu() {
  tabContextMenu.classList.add('hidden');
  contextMenuGroupId = null;
}

tabRenameBtn.addEventListener('click', () => {
  if (contextMenuGroupId) renameGroup(contextMenuGroupId);
  closeTabContextMenu();
});

tabDeleteBtn.addEventListener('click', () => {
  if (contextMenuGroupId) deleteGroup(contextMenuGroupId);
  closeTabContextMenu();
});

document.addEventListener('click', (e) => {
  if (!tabContextMenu.classList.contains('hidden') && !tabContextMenu.contains(e.target) && !e.target.closest('.tab')) {
    closeTabContextMenu();
  }
});

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

/* ---------- グリッド(カード)描画・ページ送り ---------- */

function buildCard(id) {
  const link = links[id];
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = id;

  const img = document.createElement('img');
  img.className = 'favicon';
  img.src = link.icon || faviconUrl(link.url);
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

  return card;
}

function renderCards(ids, showAddCard) {
  linkGridEl.innerHTML = '';
  ids.forEach((id) => linkGridEl.appendChild(buildCard(id)));
  if (showAddCard) {
    const addCard = document.createElement('button');
    addCard.className = 'card card-add';
    addCard.textContent = '+';
    addCard.addEventListener('click', () => openLinkModal(null));
    linkGridEl.appendChild(addCard);
  }
}

function computeItemsPerPage() {
  const firstCard = linkGridEl.querySelector('.card:not(.card-add)');
  if (!firstCard) return Infinity;
  const cardHeight = firstCard.getBoundingClientRect().height;
  if (!cardHeight) return Infinity;
  const columns = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-columns'), 10) || 1;
  const marginBottom = parseFloat(linkGridEl.style.paddingBottom) || 0;
  const gap = 16;
  const availableHeight = window.innerHeight - linkGridEl.getBoundingClientRect().top - marginBottom;
  const rows = Math.max(1, Math.floor((availableHeight + gap) / (cardHeight + gap)));
  return rows * columns;
}

function updatePageNav(totalPages) {
  if (totalPages <= 1) {
    pagePrevBtn.classList.add('hidden');
    pageNextBtn.classList.add('hidden');
    return;
  }
  pagePrevBtn.classList.toggle('hidden', currentPage === 0);
  pageNextBtn.classList.toggle('hidden', currentPage === totalPages - 1);
}

function renderGrid() {
  const allIds = linksInActiveGroup();
  renderCards(allIds, true);

  const perPage = computeItemsPerPage();
  if (isFinite(perPage) && allIds.length > perPage) {
    const totalPages = Math.max(1, Math.ceil(allIds.length / perPage));
    if (currentPage > totalPages - 1) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    const start = currentPage * perPage;
    const pageIds = allIds.slice(start, start + perPage);
    renderCards(pageIds, currentPage === totalPages - 1);
    updatePageNav(totalPages);
  } else {
    currentPage = 0;
    updatePageNav(1);
  }
}

pagePrevBtn.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    renderGrid();
  }
});

pageNextBtn.addEventListener('click', () => {
  currentPage++;
  renderGrid();
});

window.addEventListener('resize', () => renderGrid());

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

let pendingIcon = '';

function svgFrame(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect x="4" y="4" width="56" height="56" rx="12" fill="none" stroke="#000" stroke-width="4"/>${inner}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function letterIconUrl(letter) {
  return svgFrame(`<text x="32" y="44" font-size="30" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif" fill="#000">${letter}</text>`);
}

const SYMBOL_ICON_DEFS = [
  { key: 'globe', inner: '<circle cx="32" cy="32" r="16" fill="none" stroke="#000" stroke-width="3"/><line x1="16" y1="32" x2="48" y2="32" stroke="#000" stroke-width="3"/><ellipse cx="32" cy="32" rx="7" ry="16" fill="none" stroke="#000" stroke-width="3"/>' },
  { key: 'star', inner: '<polygon points="32,16 35.8,26.7 47.2,27.1 38.2,34.0 41.4,44.9 32,38.5 22.6,44.9 25.8,34.0 16.8,27.1 28.2,26.7" fill="#000"/>' },
  { key: 'heart', inner: '<path d="M32 46 C20 36 10 28 10 18 C10 10 16 6 22 6 C27 6 30 9 32 13 C34 9 37 6 42 6 C48 6 54 10 54 18 C54 28 44 36 32 46 Z" fill="#000"/>' },
  { key: 'folder', inner: '<path d="M8 18 L24 18 L28 24 L56 24 L56 50 L8 50 Z" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' },
  { key: 'bookmark', inner: '<path d="M18 6 H46 V58 L32 46 L18 58 Z" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' },
  { key: 'briefcase', inner: '<rect x="8" y="22" width="48" height="32" rx="4" fill="none" stroke="#000" stroke-width="3"/><path d="M24 22 v-6 a4 4 0 0 1 4-4 h8 a4 4 0 0 1 4 4 v6" fill="none" stroke="#000" stroke-width="3"/>' },
  { key: 'cart', inner: '<path d="M8 10 h6 l6 30 h30 l6 -22 h-40" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="24" cy="50" r="4" fill="#000"/><circle cx="44" cy="50" r="4" fill="#000"/>' },
  { key: 'mail', inner: '<rect x="8" y="16" width="48" height="32" rx="4" fill="none" stroke="#000" stroke-width="3"/><path d="M8 18 L32 38 L56 18" fill="none" stroke="#000" stroke-width="3"/>' },
  { key: 'document', inner: '<path d="M16 6 H40 L48 14 V58 H16 Z" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M40 6 V14 H48" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' },
  { key: 'bell', inner: '<path d="M32 8 C24 8 18 14 18 24 V34 L12 44 H52 L46 34 V24 C46 14 40 8 32 8 Z" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M27 50 a5 5 0 0 0 10 0" fill="none" stroke="#000" stroke-width="3"/>' },
  { key: 'game', inner: '<rect x="8" y="22" width="48" height="24" rx="12" fill="none" stroke="#000" stroke-width="3"/><line x1="20" y1="28" x2="20" y2="38" stroke="#000" stroke-width="3"/><line x1="15" y1="33" x2="25" y2="33" stroke="#000" stroke-width="3"/><circle cx="38" cy="30" r="2.5" fill="#000"/><circle cx="45" cy="37" r="2.5" fill="#000"/>' },
  { key: 'money', inner: '<circle cx="32" cy="32" r="18" fill="none" stroke="#000" stroke-width="3"/><text x="32" y="41" font-size="22" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif" fill="#000">¥</text>' },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const PRESET_ICONS = [
  ...SYMBOL_ICON_DEFS.map((d) => ({ key: d.key, url: svgFrame(d.inner) })),
  ...ALPHABET.map((letter) => ({ key: letter, url: letterIconUrl(letter) })),
];

function isPresetIcon(icon) {
  return PRESET_ICONS.some((p) => p.url === icon);
}

function iconModeFor(icon) {
  if (!icon) return 'auto';
  if (isPresetIcon(icon)) return 'preset';
  return icon.startsWith('data:') ? 'file' : 'url';
}

function renderIconPresetGrid() {
  linkIconPresetGrid.innerHTML = '';
  PRESET_ICONS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-preset-btn' + (pendingIcon === preset.url ? ' selected' : '');
    btn.innerHTML = `<img src="${preset.url}" alt="">`;
    btn.addEventListener('click', () => {
      pendingIcon = preset.url;
      refreshIconPreview();
      renderIconPresetGrid();
    });
    linkIconPresetGrid.appendChild(btn);
  });
}

function updateIconModeVisibility() {
  const mode = linkIconModeSelect.value;
  linkIconUrlInput.classList.toggle('hidden', mode !== 'url');
  linkIconFileInput.classList.toggle('hidden', mode !== 'file');
  linkIconPresetGrid.classList.toggle('hidden', mode !== 'preset');
  if (mode === 'preset') renderIconPresetGrid();
}

function refreshIconPreview() {
  linkIconPreview.src = pendingIcon || faviconUrl(linkUrlInput.value.trim());
}

function resizeImageToDataUrl(imgSrc, size = 64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imgSrc;
  });
}

linkIconModeSelect.addEventListener('change', () => {
  updateIconModeVisibility();
  if (linkIconModeSelect.value === 'auto') {
    pendingIcon = '';
    refreshIconPreview();
  } else if (linkIconModeSelect.value === 'url') {
    pendingIcon = linkIconUrlInput.value.trim();
    refreshIconPreview();
  }
});

linkIconUrlInput.addEventListener('input', () => {
  pendingIcon = linkIconUrlInput.value.trim();
  refreshIconPreview();
});

linkIconFileInput.addEventListener('change', async () => {
  const file = linkIconFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    pendingIcon = await resizeImageToDataUrl(e.target.result);
    refreshIconPreview();
  };
  reader.readAsDataURL(file);
});

linkUrlInput.addEventListener('input', () => {
  if (linkIconModeSelect.value === 'auto') refreshIconPreview();
});

function openLinkModal(linkId) {
  editingLinkId = linkId;
  linkGroupSelect.innerHTML = '';
  sortedGroupIds().forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = groups[id].name;
    linkGroupSelect.appendChild(opt);
  });

  linkIconUrlInput.value = '';
  linkIconFileInput.value = '';

  if (linkId) {
    const link = links[linkId];
    linkModalTitle.textContent = 'リンクを編集';
    linkTitleInput.value = link.title;
    linkUrlInput.value = link.url;
    linkGroupSelect.value = link.groupId;
    linkDeleteBtn.classList.remove('hidden');
    pendingIcon = link.icon || '';
    linkIconModeSelect.value = iconModeFor(pendingIcon);
    if (linkIconModeSelect.value === 'url') linkIconUrlInput.value = pendingIcon;
  } else {
    linkModalTitle.textContent = 'リンクを追加';
    linkTitleInput.value = '';
    linkUrlInput.value = '';
    linkGroupSelect.value = activeGroupId;
    linkDeleteBtn.classList.add('hidden');
    pendingIcon = '';
    linkIconModeSelect.value = 'auto';
  }
  updateIconModeVisibility();
  refreshIconPreview();
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
  const icon = pendingIcon || null;

  if (editingLinkId) {
    update(ref(db, `links/${editingLinkId}`), { title, url, groupId, icon });
  } else {
    const id = push(ref(db, 'links')).key;
    const order = Object.values(links).filter((l) => l.groupId === groupId).length;
    set(ref(db, `links/${id}`), { title, url, groupId, order, icon });
  }
  closeLinkModal();
});

linkDeleteBtn.addEventListener('click', () => {
  if (!editingLinkId) return;
  if (!confirm('このリンクを削除しますか?')) return;
  remove(ref(db, `links/${editingLinkId}`));
  closeLinkModal();
});

/* ---------- 表示設定(端末ごとにlocalStorageへ保存) ---------- */

const SETTINGS_KEY = 'speedDialSettings';
const DEFAULT_SETTINGS = { themeColor: '#4d8cff', columns: 6, marginX: 24, marginY: 24, iconScale: 26, topbarOpacity: 85, cardOpacity: 92, bgImage: '' };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();
let draftBgImage = settings.bgImage;

function resizeBackgroundImageToDataUrl(imgSrc, maxDim = 1920) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = imgSrc;
  });
}

function updateBgPreview() {
  bgImagePreview.src = draftBgImage || '';
  bgImagePreview.style.visibility = draftBgImage ? 'visible' : 'hidden';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bytes = clean.match(/.{1,2}/g).map((h) => parseInt(h, 16));
  return bytes;
}

function mixTowardRgb(rgb, target, amount) {
  return rgb.map((c, i) => Math.round(c * (1 - amount) + target[i] * amount));
}

function applyThemeColor(hex) {
  const rgb = hexToRgb(hex);
  const textRgb = mixTowardRgb(rgb, [0, 0, 0], 0.3);
  const cardBgRgb = mixTowardRgb(rgb, [255, 255, 255], 0.9);
  const panelBgRgb = mixTowardRgb(rgb, [0, 0, 0], 0.5);
  document.documentElement.style.setProperty('--theme-color', hex);
  document.documentElement.style.setProperty('--theme-text-rgb', textRgb.join(' '));
  document.documentElement.style.setProperty('--card-bg-rgb', cardBgRgb.join(' '));
  document.documentElement.style.setProperty('--panel-bg-rgb', panelBgRgb.join(' '));
}

function applySettings(s) {
  applyThemeColor(s.themeColor);
  document.documentElement.style.setProperty('--grid-columns', s.columns);
  document.documentElement.style.setProperty('--icon-scale', s.iconScale + '%');
  document.documentElement.style.setProperty('--topbar-opacity', s.topbarOpacity / 100);
  document.documentElement.style.setProperty('--card-opacity', s.cardOpacity / 100);
  linkGridEl.style.paddingLeft = s.marginX + 'px';
  linkGridEl.style.paddingRight = s.marginX + 'px';
  linkGridEl.style.paddingTop = s.marginY + 'px';
  linkGridEl.style.paddingBottom = s.marginY + 'px';
  if (s.bgImage) {
    document.body.style.backgroundImage = `url("${s.bgImage}")`;
    document.body.classList.add('has-bg-image');
  } else {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('has-bg-image');
  }
}

applySettings(settings);

function readDraftSettings() {
  return {
    themeColor: themeColorInput.value,
    columns: Number(columnsInput.value),
    marginX: Number(marginXInput.value),
    marginY: Number(marginYInput.value),
    iconScale: Number(iconScaleInput.value),
    topbarOpacity: Number(topbarOpacityInput.value),
    cardOpacity: Number(cardOpacityInput.value),
    bgImage: draftBgImage,
  };
}

function fillSettingsInputs(s) {
  themeColorInput.value = s.themeColor;
  columnsInput.value = s.columns;
  columnsValue.textContent = s.columns + '列';
  marginXInput.value = s.marginX;
  marginXValue.textContent = s.marginX + 'px';
  marginYInput.value = s.marginY;
  marginYValue.textContent = s.marginY + 'px';
  iconScaleInput.value = s.iconScale;
  iconScaleValue.textContent = s.iconScale + '%';
  topbarOpacityInput.value = s.topbarOpacity;
  topbarOpacityValue.textContent = s.topbarOpacity + '%';
  cardOpacityInput.value = s.cardOpacity;
  cardOpacityValue.textContent = s.cardOpacity + '%';
  draftBgImage = s.bgImage;
  bgImageInput.value = s.bgImage && !s.bgImage.startsWith('data:') ? s.bgImage : '';
  bgImageFileInput.value = '';
  updateBgPreview();
}

settingsBtn.addEventListener('click', () => {
  fillSettingsInputs(settings);
  settingsModal.classList.remove('hidden');
});

[themeColorInput, columnsInput, marginXInput, marginYInput, iconScaleInput, topbarOpacityInput, cardOpacityInput].forEach((el) => {
  el.addEventListener('input', () => {
    columnsValue.textContent = columnsInput.value + '列';
    marginXValue.textContent = marginXInput.value + 'px';
    marginYValue.textContent = marginYInput.value + 'px';
    iconScaleValue.textContent = iconScaleInput.value + '%';
    topbarOpacityValue.textContent = topbarOpacityInput.value + '%';
    cardOpacityValue.textContent = cardOpacityInput.value + '%';
    applySettings(readDraftSettings());
    renderGrid();
  });
});

bgImageInput.addEventListener('input', () => {
  draftBgImage = bgImageInput.value.trim();
  updateBgPreview();
  applySettings(readDraftSettings());
});

bgImageFileInput.addEventListener('change', async () => {
  const file = bgImageFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    draftBgImage = await resizeBackgroundImageToDataUrl(e.target.result);
    bgImageInput.value = '';
    updateBgPreview();
    applySettings(readDraftSettings());
  };
  reader.readAsDataURL(file);
});

settingsCancelBtn.addEventListener('click', () => {
  draftBgImage = settings.bgImage;
  applySettings(settings);
  settingsModal.classList.add('hidden');
  renderGrid();
});

settingsSaveBtn.addEventListener('click', () => {
  settings = readDraftSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
  settingsModal.classList.add('hidden');
  renderGrid();
});

settingsResetBtn.addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  fillSettingsInputs(settings);
  applySettings(settings);
  renderGrid();
});

/* ---------- Speed Dial 2 バックアップのインポート ---------- */

importBtn.addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files[0];
  importFileInput.value = '';
  if (!file) return;

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('JSONファイルの読み込みに失敗しました');
    return;
  }
  if (!Array.isArray(data.groups) || !Array.isArray(data.dials)) {
    alert('Speed Dial 2のバックアップ形式として認識できませんでした');
    return;
  }

  const ok = confirm(
    `既存のグループ・リンクをすべて削除し、Speed Dial 2から ${data.groups.length}グループ・${data.dials.length}件のリンクをインポートします。よろしいですか?`
  );
  if (!ok) return;

  const groupIdMap = {};
  const updates = {};

  const sortedGroups = [...data.groups].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  sortedGroups.forEach((g, index) => {
    const newId = push(ref(db, 'groups')).key;
    groupIdMap[g.id] = newId;
    updates[`groups/${newId}`] = { name: (g.title || '無題').trim(), order: index };
  });

  const dialsByGroup = {};
  data.dials.forEach((d) => {
    if (!dialsByGroup[d.idgroup]) dialsByGroup[d.idgroup] = [];
    dialsByGroup[d.idgroup].push(d);
  });

  Object.keys(dialsByGroup).forEach((oldGroupId) => {
    const newGroupId = groupIdMap[oldGroupId];
    if (!newGroupId) return;
    const dials = dialsByGroup[oldGroupId];
    dials.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.id - b.id);
    dials.forEach((d, index) => {
      const newId = push(ref(db, 'links')).key;
      updates[`links/${newId}`] = {
        groupId: newGroupId,
        title: (d.title || '').trim(),
        url: d.url,
        order: index,
        icon: d.thumbnail || null,
      };
    });
  });

  await remove(ref(db, 'groups'));
  await remove(ref(db, 'links'));
  await update(ref(db), updates);

  activeGroupId = null;
  currentPage = 0;
  settingsModal.classList.add('hidden');
  alert('インポートが完了しました');
});
