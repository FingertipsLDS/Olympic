/* ============ 健身日记 - 应用入口 ============ */
import { openDB, db, seed, loadSettings } from './db.js';
import { $, $$, applyTheme } from './utils.js';
import * as pages from './pages.js';
import * as forms from './forms.js';

function show(page) {
  $$('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.page === page));
  $('#fab').classList.toggle('show', page === 'today' || page === 'calendar');
  pages.render(page);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

async function init() {
  try {
    await openDB();
    await seed();
  } catch (e) {
    console.error('数据库初始化失败', e);
  }

  const settings = await loadSettings();
  applyTheme(settings.theme);
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) {
    const onCh = async () => applyTheme((await loadSettings()).theme);
    if (mq.addEventListener) mq.addEventListener('change', onCh);
    else mq.addListener(onCh);
  }

  $$('#tabbar .tab').forEach((t) => {
    t.onclick = () => show(t.dataset.page);
  });
  $('#fab').onclick = async () => {
    const projects = await db.getAll('projects');
    forms.openRecordForm(pages.getContextDate(), projects, () => pages.refresh());
  };

  registerSW();
  show('today');
}

init();
