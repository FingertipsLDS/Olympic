/* ============ 健身日记 - 工具函数 ============ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function pad2(n) { return String(n).padStart(2, '0'); }
export function dateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
export function todayStr() { return dateStr(new Date()); }
export function parseDate(s) {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
export const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function fmtDateCN(s, withWeek = true) {
  const d = parseDate(s);
  let out = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (withWeek) out += ` 周${WEEK_CN[d.getDay()]}`;
  return out;
}

export function fmtDuration(min) {
  min = Math.round(Number(min) || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h}小时${m}分钟`;
  if (h) return `${h}小时`;
  return `${m}分钟`;
}

export function fmtDurationShort(min) {
  min = Math.round(Number(min) || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h}h${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- 日期运算 ---------- */
export function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 周一为一周开始
  x.setDate(x.getDate() - day);
  return x;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function calcStreak(activeDates /* Set<YYYY-MM-DD> */) {
  let streak = 0;
  const d = new Date();
  let cur = dateStr(d);
  if (!activeDates.has(cur)) {
    d.setDate(d.getDate() - 1);
    cur = dateStr(d);
  }
  while (activeDates.has(cur)) {
    streak++;
    d.setDate(d.getDate() - 1);
    cur = dateStr(d);
  }
  return streak;
}

/* ---------- Toast / 弹窗 / 确认框 ---------- */
let toastTimer = null;
export function toast(msg, type = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2200);
}

export function openModal(html, opts = {}) {
  const wrap = $('#modalWrap');
  wrap.innerHTML = `<div class="backdrop"></div><div class="modal ${opts.cls || ''}">${html}</div>`;
  wrap.classList.add('show');
  document.body.style.overflow = 'hidden';
  const close = () => {
    wrap.classList.remove('show');
    wrap.innerHTML = '';
    document.body.style.overflow = '';
  };
  wrap.querySelector('.backdrop').onclick = close;
  return close;
}

export function confirmDialog({ title = '确认操作', message = '', confirmText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    const close = openModal(`
      <div class="modal-title">${escapeHtml(title)}</div>
      <div class="confirm-msg">${escapeHtml(message)}</div>
      <div class="confirm-btns">
        <button class="btn btn-ghost" id="cf-cancel">取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${escapeHtml(confirmText)}</button>
      </div>`, { cls: 'confirm-modal' });
    $('#cf-cancel').onclick = () => { close(); resolve(false); };
    $('#cf-ok').onclick = () => { close(); resolve(true); };
  });
}

/* ---------- 照片处理 ---------- */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/* 压缩照片：最长边 maxDim，输出 JPEG */
export async function compressImage(file, maxDim = 1280, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return file;
    const maxSide = Math.max(w0, h0);
    if (file.size <= 300 * 1024 && maxSide <= maxDim) return file;
    const scale = Math.min(1, maxDim / maxSide);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res, rej) => {
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('compress fail'))), 'image/jpeg', quality);
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* Blob -> objectURL 缓存（同一 Blob 复用同一 URL） */
const blobUrls = new WeakMap();
export function blobUrl(blob) {
  if (!blob) return '';
  let u = blobUrls.get(blob);
  if (!u) {
    u = URL.createObjectURL(blob);
    blobUrls.set(blob, u);
  }
  return u;
}

/* ---------- 大图浏览 ---------- */
export function openLightbox(photos, index = 0) {
  if (!photos || !photos.length) return;
  const lb = $('#lightbox');
  let i = Math.min(index, photos.length - 1);
  const render = () => {
    const multi = photos.length > 1;
    lb.innerHTML = `
      <img src="${blobUrl(photos[i])}" alt="照片">
      ${multi ? '<button class="lb-nav lb-prev" aria-label="上一张">‹</button><button class="lb-nav lb-next" aria-label="下一张">›</button>' : ''}
      <div class="lb-count">${i + 1} / ${photos.length}</div>
      <button class="lb-close" aria-label="关闭">✕</button>`;
    lb.querySelector('.lb-close').onclick = closeLb;
    const prev = lb.querySelector('.lb-prev');
    const next = lb.querySelector('.lb-next');
    if (prev) prev.onclick = (e) => { e.stopPropagation(); i = (i - 1 + photos.length) % photos.length; render(); };
    if (next) next.onclick = (e) => { e.stopPropagation(); i = (i + 1) % photos.length; render(); };
    lb.querySelector('img').onclick = closeLb;
  };
  const closeLb = () => { lb.classList.remove('show'); lb.innerHTML = ''; };
  render();
  lb.classList.add('show');
}

/* ---------- 主题 ---------- */
export function applyTheme(theme) {
  const dark = theme === 'dark' ||
    (theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0f1522' : '#10b981';
}
