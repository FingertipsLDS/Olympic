/* ============ 健身日记 - 页面渲染（今天 / 日历 / 统计 / 我的） ============ */
import { db, loadSettings, saveSettings } from './db.js';
import {
  $, $$, todayStr, dateStr, parseDate, fmtDateCN, fmtDuration, fmtDurationShort,
  escapeHtml, calcStreak, startOfWeek, addDays, toast, confirmDialog, blobUrl,
  openLightbox, applyTheme
} from './utils.js';
import { weightChartSVG } from './charts.js';
import * as forms from './forms.js';
import * as backup from './backup.js';

const INTENSITY = forms.INTENSITY;
const INT_ICON = forms.INT_ICON;

let currentPage = 'today';
let cache = { records: [], weights: [], projects: [] };
let calYear = null, calMonth = null, calSelected = null; // 月为 0 基
let statsPeriod = 'week';   // week | month | all
let weightRange = 30;       // 30 | 90 | 0

export function render(page) {
  currentPage = page;
  refresh();
}

export function refresh() {
  if (currentPage === 'today') renderToday();
  else if (currentPage === 'calendar') renderCalendar();
  else if (currentPage === 'stats') renderStats();
  else renderSettings();
}

export function getContextDate() {
  return currentPage === 'calendar' ? calSelected : todayStr();
}

async function loadData() {
  const [records, weights, projects, settings] = await Promise.all([
    db.getAll('records'), db.getAll('weights'), db.getAll('projects'), loadSettings()
  ]);
  cache = { records, weights, projects };
  return { records, weights, projects, settings };
}

const byCreated = (a, b) => a.createdAt - b.createdAt;
const findRecord = (id) => cache.records.find((r) => r.id === id);
const findWeight = (id) => cache.weights.find((w) => w.id === id);

/* ---------- 通用组件 ---------- */
function recordCardHTML(r) {
  const photos = r.photos || [];
  const thumbs = photos.slice(0, 4).map((p) => `<img src="${blobUrl(p)}" alt="" data-photo>`).join('');
  const more = photos.length > 4 ? `<div class="ph-more" data-photo>+${photos.length - 4}</div>` : '';
  const inten = r.intensity || 2;
  return `
  <div class="rcard" data-id="${r.id}">
    <div class="rcard-icon" style="background:${r.projectColor || '#10b981'}26;color:${r.projectColor || '#10b981'}">${r.projectEmoji || '🏃'}</div>
    <div class="rcard-main">
      <div class="rcard-line1">
        <span class="rcard-name">${escapeHtml(r.projectName || '运动')}</span>
        <span class="tag i${inten}">${INT_ICON[inten]}${INTENSITY[inten]}</span>
        <span class="rcard-dur">${fmtDuration(r.duration)}</span>
      </div>
      ${r.note ? `<div class="rcard-note">${escapeHtml(r.note)}</div>` : ''}
      ${photos.length ? `<div class="rcard-photos">${thumbs}${more}</div>` : ''}
    </div>
    <button class="rcard-del" data-del title="删除">🗑</button>
  </div>`;
}

function weightRowHTML(w, showDate) {
  const photos = w.photos || [];
  return `
  <div class="wrow" data-id="${w.id}">
    <span class="wrow-icon">⚖️</span>
    <div class="wrow-main">
      <div class="wrow-weight">${Number(w.weight).toFixed(1)} kg</div>
      ${showDate ? `<div class="muted">${fmtDateCN(w.date)}</div>` : ''}
      ${w.note ? `<div class="muted">${escapeHtml(w.note)}</div>` : ''}
    </div>
    ${photos.length ? `<div class="wrow-photos">${photos.slice(0, 3).map((p) => `<img src="${blobUrl(p)}" alt="">`).join('')}</div>` : ''}
    <button class="rcard-del" data-del title="删除">🗑</button>
  </div>`;
}

function bindCardEvents() {
  $$('.rcard').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', async (e) => {
      if (e.target.closest('[data-del]')) return;
      const rec = findRecord(id);
      if (!rec) return;
      const photoEl = e.target.closest('[data-photo]');
      if (photoEl) {
        const idx = [...card.querySelectorAll('[data-photo]')].indexOf(photoEl);
        openLightbox(rec.photos || [], Math.max(0, idx));
        return;
      }
      forms.openRecordDetail(rec, refresh);
    });
    card.querySelector('[data-del]').onclick = async (e) => {
      e.stopPropagation();
      const rec = findRecord(id);
      if (!rec) return;
      const ok = await confirmDialog({
        title: '删除记录',
        message: `确定删除「${rec.projectName} · ${fmtDuration(rec.duration)}」这条记录吗？照片也会一并删除。`,
        confirmText: '删除', danger: true
      });
      if (ok) {
        await db.del('records', id);
        toast('已删除');
        refresh();
      }
    };
  });
}

function bindWeightRows() {
  $$('.wrow').forEach((row) => {
    if (!row.dataset.id) return;
    const id = row.dataset.id;
    const delBtn = row.querySelector('[data-del]');
    if (delBtn) {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const w = findWeight(id);
        if (!w) return;
        const ok = await confirmDialog({
          title: '删除记录',
          message: `确定删除 ${Number(w.weight).toFixed(1)}kg 这条体重记录吗？`,
          confirmText: '删除', danger: true
        });
        if (ok) {
          await db.del('weights', id);
          toast('已删除');
          refresh();
        }
      };
    }
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      const w = findWeight(id);
      if (!w) return;
      const img = e.target.closest('img');
      if (img) {
        const idx = [...row.querySelectorAll('img')].indexOf(img);
        openLightbox(w.photos || [], Math.max(0, idx));
        return;
      }
      forms.openWeightDetail(w, refresh);
    });
  });
}

/* ---------- 今天 ---------- */
async function renderToday() {
  const { records, weights, projects, settings } = await loadData();
  const today = todayStr();
  const todayRecs = records.filter((r) => r.date === today).sort(byCreated);
  const todayWeights = weights.filter((w) => w.date === today).sort(byCreated);
  const allDates = new Set(records.map((r) => r.date));
  weights.forEach((w) => allDates.add(w.date));
  const streak = calcStreak(allDates);
  const mins = todayRecs.reduce((s, r) => s + (+r.duration || 0), 0);

  const wsorted = weights.slice().sort((a, b) => a.date.localeCompare(b.date) || byCreated(a, b));
  const latest = wsorted[wsorted.length - 1];

  const weekStart = dateStr(startOfWeek(new Date()));
  const weekDays = new Set(records.filter((r) => r.date >= weekStart).map((r) => r.date));
  const goal = settings.weeklyGoal || 5;

  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const d = parseDate(today);
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 · 周${'日一二三四五六'[d.getDay()]}`;

  $('#pageContent').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-date">${dateLabel}</div>
          <div class="hero-greet">${greet}，今天也要动起来 💪</div>
        </div>
        <div class="hero-streak">🔥 连续打卡 ${streak} 天</div>
      </div>
      <div class="hero-stats">
        <div class="hs-item"><div class="hs-num">${todayRecs.length}</div><div class="hs-label">今日运动</div></div>
        <div class="hs-item"><div class="hs-num">${mins}</div><div class="hs-label">运动分钟</div></div>
        <div class="hs-item"><div class="hs-num">${latest ? Number(latest.weight).toFixed(1) : '--'}</div><div class="hs-label">最新体重kg</div></div>
      </div>
    </div>

    <div class="quick-grid">
      <button class="quick-btn primary" id="btn-add-record"><span class="q-emoji">🏃</span>记录运动</button>
      <button class="quick-btn weight" id="btn-add-weight"><span class="q-emoji">⚖️</span>记录体重</button>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:2px">
        <span class="section-title" style="margin:0">🎯 本周打卡</span>
        <span class="muted">${Math.min(weekDays.size, goal)} / ${goal} 天</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${Math.min(100, Math.round(weekDays.size / goal * 100))}%"></div></div>
    </div>

    <div class="card">
      <div class="section-title">🏅 今日运动 <span class="muted" style="font-weight:400">${todayRecs.length ? todayRecs.length + ' 项 · ' + fmtDuration(mins) : ''}</span></div>
      ${todayRecs.length
        ? todayRecs.map((r) => recordCardHTML(r)).join('')
        : '<div class="empty"><span class="big">🏀</span>今天还没有运动记录<br>点击上方按钮开始打卡吧</div>'}
    </div>

    <div class="card">
      <div class="section-title">⚖️ 体重记录</div>
      ${todayWeights.length
        ? todayWeights.map((w) => weightRowHTML(w, false)).join('')
        : latest
          ? `<div class="wrow"><span class="wrow-icon">⚖️</span><div class="wrow-main"><div class="wrow-weight">最新体重 ${Number(latest.weight).toFixed(1)} kg</div><div class="muted">${fmtDateCN(latest.date)}${latest.note ? ' · ' + escapeHtml(latest.note) : ''}</div></div></div>`
          : '<div class="empty"><span class="big">⚖️</span>还没有体重记录<br>记录体重可以查看趋势变化</div>'}
    </div>`;

  $('#btn-add-record').onclick = () => forms.openRecordForm(today, projects, refresh);
  $('#btn-add-weight').onclick = () => forms.openWeightForm(today, refresh);
  bindCardEvents();
  bindWeightRows();
}

/* ---------- 日历 ---------- */
function buildMonthCells(y, m) {
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const out = [];
  for (let i = 0; i < lead; i++) out.push(null);
  for (let d = 1; d <= days; d++) out.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (out.length % 7) out.push(null);
  return out;
}

function dayPanelHTML(date, recs, ws) {
  const sport = recs.length
    ? recs.sort(byCreated).map((r) => recordCardHTML(r)).join('')
    : '<div class="muted" style="padding:6px 2px">这天没有运动记录</div>';
  const wpart = ws.length
    ? ws.sort(byCreated).map((w) => weightRowHTML(w, false)).join('')
    : '<div class="muted" style="padding:6px 2px">没有体重记录</div>';
  return `
    <div class="row" style="margin-bottom:12px">
      <span class="section-title" style="margin:0">${fmtDateCN(date)}</span>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-ghost" id="dp-add-w">⚖️ 记体重</button>
      <button class="btn btn-sm btn-primary" id="dp-add-r">＋ 记运动</button>
    </div>
    <div class="muted" style="font-size:12.5px;margin-bottom:10px">🏅 运动记录</div>
    ${sport}
    <div class="muted" style="font-size:12.5px;margin:12px 0 10px">⚖️ 体重记录</div>
    ${wpart}`;
}

async function renderCalendar() {
  const { records, weights } = await loadData();
  if (!calYear) {
    const t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    calSelected = todayStr();
  }
  const recByDate = {};
  const wByDate = {};
  records.forEach((r) => { (recByDate[r.date] = recByDate[r.date] || []).push(r); });
  weights.forEach((w) => { (wByDate[w.date] = wByDate[w.date] || []).push(w); });

  const cells = buildMonthCells(calYear, calMonth);
  const today = todayStr();

  $('#pageContent').innerHTML = `
    <div class="cal-head">
      <div class="cal-month">${calYear}年${calMonth + 1}月</div>
      <div class="cal-nav">
        <button id="cal-prev">‹</button>
        <button id="cal-today">今天</button>
        <button id="cal-next">›</button>
      </div>
    </div>
    <div class="cal-week">${['一', '二', '三', '四', '五', '六', '日'].map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid">
      ${cells.map((c) => {
        if (!c) return '<span></span>';
        const isSel = c === calSelected;
        const isToday = c === today;
        const dots = `${recByDate[c] ? '<span class="dot s"></span>' : ''}${wByDate[c] ? '<span class="dot w"></span>' : ''}`;
        return `<button class="cal-cell${isSel ? ' sel' : ''}${isToday ? ' today' : ''}" data-date="${c}"><span>${parseInt(c.slice(8), 10)}</span><span class="cal-dots">${dots}</span></button>`;
      }).join('')}
    </div>
    <div class="card" id="day-panel">${dayPanelHTML(calSelected, recByDate[calSelected] || [], wByDate[calSelected] || [])}</div>`;

  $('#cal-prev').onclick = () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  $('#cal-next').onclick = () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };
  $('#cal-today').onclick = () => {
    const t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    calSelected = todayStr();
    renderCalendar();
  };
  $$('.cal-cell').forEach((cell) => {
    cell.onclick = () => {
      calSelected = cell.dataset.date;
      renderCalendar();
    };
  });
  $('#dp-add-r').onclick = async () => {
    const { projects } = await loadData();
    forms.openRecordForm(calSelected, projects, refresh);
  };
  $('#dp-add-w').onclick = () => forms.openWeightForm(calSelected, refresh);
  bindCardEvents();
  bindWeightRows();
}

/* ---------- 统计 ---------- */
function periodRange(p) {
  if (p === 'all') return null;
  const now = new Date();
  if (p === 'week') {
    const s = startOfWeek(now);
    return [dateStr(s), dateStr(addDays(s, 6))];
  }
  return [dateStr(new Date(now.getFullYear(), now.getMonth(), 1)), dateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
}

function last8Weeks() {
  const arr = [];
  const end = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const s = addDays(end, -7 * i);
    arr.push({ start: s, end: addDays(s, 6), label: `${s.getMonth() + 1}/${s.getDate()}` });
  }
  return arr;
}

async function renderStats() {
  const { records, weights, settings } = await loadData();
  const totalMins = records.reduce((s, r) => s + (+r.duration || 0), 0);
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCount = records.filter((r) => r.date.startsWith(curMonth)).length;
  const allDates = new Set(records.map((r) => r.date));
  weights.forEach((w) => allDates.add(w.date));
  const streak = calcStreak(allDates);
  const wsorted = weights.slice().sort((a, b) => a.date.localeCompare(b.date));
  const goal = settings.goalWeight ? Number(settings.goalWeight) : null;

  let weightCard;
  if (wsorted.length >= 2) {
    const svg = weightChartSVG(wsorted, goal, weightRange);
    weightCard = `
      <div class="card">
        <div class="row" style="margin-bottom:6px">
          <span class="section-title" style="margin:0">📉 体重趋势</span>
          <span class="spacer"></span>
          ${[[30, '近30天'], [90, '近90天'], [0, '全部']].map(([v, lab]) => `<button class="chip ${weightRange === v ? 'active' : ''}" data-range="${v}">${lab}</button>`).join('')}
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">最新 ${Number(wsorted[wsorted.length - 1].weight).toFixed(1)} kg · 共 ${wsorted.length} 次记录${goal ? ` · 目标 ${goal} kg` : ''}</div>
        ${svg || '<div class="muted" style="padding:16px 0;text-align:center">该时间范围内记录不足 2 次</div>'}
      </div>`;
  } else {
    weightCard = `<div class="card"><div class="section-title">📉 体重趋势</div><div class="empty"><span class="big">📉</span>至少记录 2 次体重后<br>即可查看趋势曲线</div></div>`;
  }

  const period = periodRange(statsPeriod);
  const filtered = period ? records.filter((r) => r.date >= period[0] && r.date <= period[1]) : records;
  const byProject = {};
  filtered.forEach((r) => {
    const k = r.projectName || '未知项目';
    byProject[k] = (byProject[k] || 0) + (+r.duration || 0);
  });
  const items = Object.entries(byProject)
    .map(([name, mins]) => {
      const rec = filtered.find((r) => (r.projectName || '未知项目') === name);
      return { name, mins, emoji: rec ? rec.projectEmoji : '🏃', color: rec ? rec.projectColor : '#10b981' };
    })
    .sort((a, b) => b.mins - a.mins);
  const maxMins = Math.max(1, ...items.map((i) => i.mins));
  const bars = items.length
    ? items.map((i) => `
      <div class="hbar">
        <span class="hbar-emoji" style="background:${i.color}26">${i.emoji}</span>
        <div class="hbar-main">
          <div class="row"><span class="hbar-name">${escapeHtml(i.name)}</span><span class="muted" style="font-size:12px">${fmtDuration(i.mins)}</span></div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(3, (i.mins / maxMins) * 100).toFixed(1)}%"></div></div>
        </div>
      </div>`).join('')
    : `<div class="empty" style="padding:16px 0">${statsPeriod === 'all' ? '还没有任何记录' : '这个时间段没有记录'}</div>`;

  const weeks = last8Weeks();
  const weekData = weeks.map((w) => {
    const s = dateStr(w.start), e = dateStr(w.end);
    const mins = records.filter((r) => r.date >= s && r.date <= e).reduce((a, r) => a + (+r.duration || 0), 0);
    return { label: w.label, mins };
  });
  const anyWeek = weekData.some((w) => w.mins > 0);
  const maxW = Math.max(1, ...weekData.map((w) => w.mins));
  const wkchart = anyWeek
    ? `<div class="wkchart">${weekData.map((w) => `
        <div class="wkcol">
          <div class="wkval">${w.mins ? fmtDurationShort(w.mins) : ''}</div>
          <div class="wkbar" style="height:${w.mins ? Math.max(4, (w.mins / maxW) * 100) : 2}%"></div>
          <div class="wklabel">${w.label}</div>
        </div>`).join('')}</div>`
    : '<div class="empty" style="padding:14px 0">最近 8 周还没有运动记录</div>';

  $('#pageContent').innerHTML = `
    <div class="page-head"><div class="page-title">统计</div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${records.length}<span class="unit">次</span></div><div class="stat-label">累计运动记录</div></div>
      <div class="stat-card"><div class="stat-num">${(totalMins / 60).toFixed(1)}<span class="unit">小时</span></div><div class="stat-label">累计运动时长</div></div>
      <div class="stat-card"><div class="stat-num">${monthCount}<span class="unit">次</span></div><div class="stat-label">本月记录</div></div>
      <div class="stat-card"><div class="stat-num">${streak}<span class="unit">天</span></div><div class="stat-label">连续打卡</div></div>
    </div>
    ${weightCard}
    <div class="card">
      <div class="row" style="margin-bottom:10px">
        <span class="section-title" style="margin:0">⏱ 项目时长分布</span>
        <span class="spacer"></span>
        ${[['week', '本周'], ['month', '本月'], ['all', '全部']].map(([v, lab]) => `<button class="chip ${statsPeriod === v ? 'active' : ''}" data-period="${v}">${lab}</button>`).join('')}
      </div>
      ${bars}
    </div>
    <div class="card">
      <div class="section-title">📊 近 8 周运动时长</div>
      ${wkchart}
    </div>`;

  $$('#pageContent [data-range]').forEach((b) => {
    b.onclick = () => { weightRange = +b.dataset.range; renderStats(); };
  });
  $$('#pageContent [data-period]').forEach((b) => {
    b.onclick = () => { statsPeriod = b.dataset.period; renderStats(); };
  });
}

/* ---------- 我的 ---------- */
async function renderSettings() {
  const { projects, settings } = await loadData();
  const theme = settings.theme || 'auto';

  $('#pageContent').innerHTML = `
    <div class="page-head"><div class="page-title">我的</div></div>

    <div class="card">
      <div class="section-title">🎯 目标设置</div>
      <label class="f-label">目标体重（kg，留空表示不设置）</label>
      <input class="input" type="number" id="set-goal-weight" placeholder="例如 65" value="${settings.goalWeight == null ? '' : settings.goalWeight}" min="20" max="300" step="0.1" inputmode="decimal">
      <label class="f-label">每周打卡天数目标（1 - 7 天）</label>
      <input class="input" type="number" id="set-weekly-goal" value="${settings.weeklyGoal == null ? 5 : settings.weeklyGoal}" min="1" max="7" step="1" inputmode="numeric">
      <button class="btn btn-primary btn-block" id="set-save" style="margin-top:12px">保存目标</button>
    </div>

    <div class="card">
      <div class="section-title">🎨 外观</div>
      <div class="radio-row">
        <button class="radio-card ${theme === 'light' ? 'active' : ''}" data-theme="light">☀️ 浅色</button>
        <button class="radio-card ${theme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 深色</button>
        <button class="radio-card ${theme === 'auto' ? 'active' : ''}" data-theme="auto">✨ 跟随系统</button>
      </div>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:8px">
        <span class="section-title" style="margin:0">🏷 运动项目管理</span>
        <span class="spacer"></span>
        <button class="btn btn-sm btn-primary" id="proj-add">＋ 添加项目</button>
      </div>
      <div class="set-list">
        ${projects.map((p) => `
          <div class="set-item">
            <span class="set-icon" style="background:${p.color}26">${p.emoji}</span>
            <div class="set-item-main"><div class="set-item-name">${escapeHtml(p.name)}${p.builtin ? ' <span class="tag" style="background:var(--line);color:var(--text-2)">内置</span>' : ''}</div></div>
            <span class="spacer"></span>
            <button class="btn btn-sm btn-ghost" data-edit="${p.id}">编辑</button>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-title">💾 数据管理</div>
      <div class="btn-col">
        <button class="btn btn-ghost btn-block" id="data-export">📤 导出备份（含照片）</button>
        <button class="btn btn-ghost btn-block" id="data-import">📥 导入备份</button>
        <button class="btn btn-danger btn-block" id="data-clear">🗑 清除全部数据</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px;line-height:1.6">数据保存在本机浏览器中，清除浏览器数据会丢失，建议定期导出备份。</div>
    </div>

    <div class="card">
      <div class="section-title">ℹ️ 关于</div>
      <div class="muted" style="font-size:13px;line-height:1.8">健身日记 v1.0<br>记录运动、体重与照片的离线打卡应用。<br>数据保存在手机本地，不经过任何服务器。</div>
    </div>`;

  $('#set-save').onclick = async () => {
    const gw = $('#set-goal-weight').value;
    const wk = $('#set-weekly-goal').value;
    const patch = {};
    if (gw !== '') {
      const g = Number(gw);
      if (!(g >= 20 && g <= 300)) return toast('请输入有效的目标体重（20 - 300）', 'err');
      patch.goalWeight = g;
    } else {
      patch.goalWeight = null;
    }
    const w = Number(wk);
    if (!(w >= 1 && w <= 7)) return toast('每周目标为 1 - 7 天', 'err');
    patch.weeklyGoal = Math.round(w);
    await saveSettings(patch);
    toast('已保存 🎯');
  };
  $$('[data-theme]').forEach((b) => {
    b.onclick = async () => {
      await saveSettings({ theme: b.dataset.theme });
      applyTheme(b.dataset.theme);
      renderSettings();
    };
  });
  $('#proj-add').onclick = () => forms.openProjectForm(null, renderSettings);
  $$('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const p = projects.find((x) => x.id === b.dataset.edit);
      if (p) forms.openProjectForm(p, renderSettings);
    };
  });
  $('#data-export').onclick = backup.exportData;
  $('#data-import').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (f) backup.importData(f, refresh);
    };
    inp.click();
  };
  $('#data-clear').onclick = () => backup.clearAllData(refresh);
}
