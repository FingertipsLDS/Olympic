/* ============ 健身日记 - IndexedDB 数据层 ============ */
const DB_NAME = 'fitdiary';
const DB_VERSION = 1;

let _db = null;

export const DEFAULT_PROJECTS = [
  { id: 'p_basketball', name: '篮球',   emoji: '🏀', color: '#f97316', builtin: 1 },
  { id: 'p_pingpong',  name: '乒乓球', emoji: '🏓', color: '#ef4444', builtin: 1 },
  { id: 'p_cycling',   name: '骑车',   emoji: '🚴', color: '#10b981', builtin: 1 },
  { id: 'p_running',   name: '跑步',   emoji: '🏃', color: '#22c55e', builtin: 1 },
  { id: 'p_swimming',  name: '游泳',   emoji: '🏊', color: '#0ea5e9', builtin: 1 },
  { id: 'p_gym',       name: '健身',   emoji: '💪', color: '#8b5cf6', builtin: 1 },
  { id: 'p_badminton', name: '羽毛球', emoji: '🏸', color: '#ec4899', builtin: 1 },
  { id: 'p_hiking',    name: '徒步',   emoji: '🥾', color: '#a16207', builtin: 1 },
  { id: 'p_yoga',      name: '瑜伽',   emoji: '🧘', color: '#14b8a6', builtin: 1 }
];

export const DEFAULT_SETTINGS = { theme: 'auto', goalWeight: null, weeklyGoal: 5 };

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const dbx = e.target.result;
      if (!dbx.objectStoreNames.contains('records')) {
        const s = dbx.createObjectStore('records', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!dbx.objectStoreNames.contains('weights')) {
        const s = dbx.createObjectStore('weights', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!dbx.objectStoreNames.contains('projects')) {
        dbx.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!dbx.objectStoreNames.contains('meta')) {
        dbx.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}
function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  getAll(store) { return reqP(tx(store).getAll()); },
  get(store, key) { return reqP(tx(store).get(key)); },
  put(store, value) { return reqP(tx(store, 'readwrite').put(value)); },
  del(store, key) { return reqP(tx(store, 'readwrite').delete(key)); },
  clear(store) { return reqP(tx(store, 'readwrite').clear()); }
};

/* 首次运行：写入内置运动项目 */
export async function seed() {
  const seeded = await db.get('meta', 'seeded');
  if (seeded) return;
  const existing = await db.getAll('projects');
  if (!existing.length) {
    for (const p of DEFAULT_PROJECTS) await db.put('projects', { ...p });
  }
  await db.put('meta', { key: 'seeded', value: 1 });
}

/* 设置读取 / 保存 */
export async function loadSettings() {
  const rec = await db.get('meta', 'settings');
  return Object.assign({}, DEFAULT_SETTINGS, (rec && rec.value) || {});
}

export async function saveSettings(patch) {
  const cur = await loadSettings();
  const next = Object.assign({}, cur, patch);
  await db.put('meta', { key: 'settings', value: next });
  return next;
}
