/* ============ 健身日记 - 表单与详情弹窗 ============ */
import { $, $$, uid, todayStr, toast, openModal, confirmDialog, compressImage, blobUrl, escapeHtml, fmtDateCN, fmtDuration, openLightbox } from './utils.js';
import { db } from './db.js';

export const INTENSITY = { 1: '低强度', 2: '中强度', 3: '高强度' };
export const INT_ICON = { 1: '😌', 2: '🔥', 3: '⚡' };

const EMOJIS = [
  '🏀', '🏓', '🚴', '🏃', '🏊', '💪', '🏸', '🥾', '🧘',
  '⚽', '🎾', '🏐', '🎱', '🏒', '🏹', '⛳', '🎳', '🥊',
  '🚣', '🧗', '🏇', '🛹', '🛼', '⛷️', '🏂', '🏋️', '🤸',
  '🤺', '🚶', '🤾', '🏌️', '🪂', '🥏', '🎣', '⛹️', '🏊'
];

const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#14b8a6', '#64748b'];

function pickImage(capture) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    if (capture) inp.capture = 'environment';
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

/* 照片选择/缩略图组件 */
function photoManager(root, state, maxCount, labelElId) {
  const containerId = '#' + labelElId.replace('-label', 's');
  const container = $(containerId, root);
  const label = $('#' + labelElId, root);
  const render = () => {
    container.innerHTML = '';
    state.photos.forEach((blob, i) => {
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      div.innerHTML = `<img src="${blobUrl(blob)}" alt=""><button type="button" class="photo-x">✕</button>`;
      div.querySelector('.photo-x').onclick = () => { state.photos.splice(i, 1); render(); };
      container.appendChild(div);
    });
    if (state.photos.length < maxCount) {
      const cam = document.createElement('button');
      cam.type = 'button';
      cam.className = 'photo-add';
      cam.innerHTML = '📷<span>拍照</span>';
      cam.onclick = () => addPhoto(true);
      container.appendChild(cam);
      const gal = document.createElement('button');
      gal.type = 'button';
      gal.className = 'photo-add';
      gal.innerHTML = '🖼<span>相册</span>';
      gal.onclick = () => addPhoto(false);
      container.appendChild(gal);
    }
    if (label) label.textContent = `照片（最多 ${maxCount} 张，${state.photos.length}/${maxCount}）`;
  };
  const addPhoto = async (capture) => {
    if (state.photos.length >= maxCount) return toast(`最多 ${maxCount} 张照片`, 'err');
    const file = await pickImage(capture);
    if (!file) return;
    try {
      const blob = await compressImage(file);
      state.photos.push(blob);
      render();
    } catch (e) {
      toast('照片处理失败，请重试', 'err');
    }
  };
  return render;
}

/* ---------- 记录运动 ---------- */
export function openRecordForm(initialDate, projects, onDone) {
  const state = { date: initialDate || todayStr(), projectId: '', duration: 30, intensity: 2, note: '', photos: [] };
  let projectList = projects.slice();

  const close = openModal(`
    <div class="sheet-handle"></div>
    <div class="modal-title">🏃 记录运动</div>
    <label class="f-label">日期</label>
    <input class="input" type="date" id="f-date" value="${state.date}">
    <label class="f-label">运动项目</label>
    <div class="chips-scroll" id="f-projects"></div>
    <label class="f-label">时长（分钟）</label>
    <input class="input" type="number" id="f-duration" value="${state.duration}" min="1" max="1440" step="5" inputmode="numeric">
    <div class="chips-scroll" style="margin-top:8px;padding-bottom:2px">
      ${[15, 30, 45, 60, 90, 120].map((m) => `<button class="chip" data-min="${m}">${m}分钟</button>`).join('')}
    </div>
    <label class="f-label">强度</label>
    <div class="seg" id="f-intensity">
      ${[1, 2, 3].map((i) => `<button data-i="${i}" class="${state.intensity === i ? 'active' : ''}">${INT_ICON[i]} ${INTENSITY[i]}</button>`).join('')}
    </div>
    <label class="f-label">备注（可选）</label>
    <textarea class="input" id="f-note" placeholder="例如：和同事打了 2 小时球，手感不错"></textarea>
    <label class="f-label" id="f-photo-label">照片（最多 6 张，0/6）</label>
    <div class="photos" id="f-photos"></div>
    <button class="btn btn-primary btn-block" id="f-save" style="margin-top:18px">保存记录</button>
  `);

  const renderPhotos = photoManager($('#modalWrap .modal'), state, 6, 'f-photo-label');

  const rebuildProjects = (list) => {
    projectList = list;
    const box = $('#f-projects');
    box.innerHTML = list.map((p) =>
      `<button class="pchip${state.projectId === p.id ? ' active' : ''}" data-pid="${p.id}"><span class="pchip-emoji">${p.emoji}</span><span>${escapeHtml(p.name)}</span></button>`
    ).join('') + `<button class="pchip pchip-manage" id="f-manage"><span class="pchip-emoji">＋</span><span>管理</span></button>`;
    $$('.pchip[data-pid]', box).forEach((b) => {
      b.onclick = () => { state.projectId = b.dataset.pid; rebuildProjects(list); };
    });
    $('#f-manage').onclick = () => openProjectForm(null, async () => {
      const ps = await db.getAll('projects');
      if (!ps.find((p) => p.id === state.projectId)) state.projectId = '';
      rebuildProjects(ps);
    });
  };
  rebuildProjects(projectList);
  renderPhotos();

  $$('[data-min]').forEach((b) => {
    b.onclick = () => { $('#f-duration').value = b.dataset.min; };
  });
  $$('#f-intensity button').forEach((b) => {
    b.onclick = () => {
      state.intensity = +b.dataset.i;
      $$('#f-intensity button').forEach((x) => x.classList.toggle('active', x === b));
    };
  });

  $('#f-save').onclick = async () => {
    const project = projectList.find((p) => p.id === state.projectId);
    if (!project) return toast('请选择一个运动项目', 'err');
    const dur = Number($('#f-duration').value);
    if (!(dur >= 1) || dur > 1440) return toast('请输入有效时长（1 - 1440 分钟）', 'err');
    const date = $('#f-date').value || todayStr();
    const note = $('#f-note').value.trim();
    await db.put('records', {
      id: uid(), date,
      projectId: project.id, projectName: project.name, projectEmoji: project.emoji, projectColor: project.color,
      duration: Math.round(dur), intensity: state.intensity, note,
      photos: state.photos, createdAt: Date.now()
    });
    close();
    toast('打卡成功 🎉');
    onDone();
  };
}

/* ---------- 记录体重 ---------- */
export function openWeightForm(initialDate, onDone) {
  const state = { date: initialDate || todayStr(), weight: '', note: '', photos: [] };

  const close = openModal(`
    <div class="sheet-handle"></div>
    <div class="modal-title">⚖️ 记录体重</div>
    <label class="f-label">日期</label>
    <input class="input" type="date" id="wf-date" value="${state.date}">
    <label class="f-label">体重（kg）</label>
    <input class="input" type="number" id="wf-weight" placeholder="例如 70.5" min="20" max="300" step="0.1" inputmode="decimal">
    <label class="f-label">备注（可选）</label>
    <textarea class="input" id="wf-note" placeholder="例如：晨起空腹"></textarea>
    <label class="f-label" id="wf-photo-label">照片（最多 3 张，0/3）</label>
    <div class="photos" id="wf-photos"></div>
    <button class="btn btn-primary btn-block" id="wf-save" style="margin-top:18px">保存</button>
  `);

  const renderPhotos = photoManager($('#modalWrap .modal'), state, 3, 'wf-photo-label');
  renderPhotos();

  $('#wf-save').onclick = async () => {
    const w = Number($('#wf-weight').value);
    if (!(w >= 20 && w <= 300)) return toast('请输入有效体重（20 - 300 kg）', 'err');
    await db.put('weights', {
      id: uid(), date: $('#wf-date').value || todayStr(),
      weight: Math.round(w * 10) / 10,
      note: $('#wf-note').value.trim(),
      photos: state.photos, createdAt: Date.now()
    });
    close();
    toast('已记录体重 ⚖️');
    onDone();
  };
}

/* ---------- 项目管理（添加/编辑/删除） ---------- */
export function openProjectForm(existing, onDone) {
  const state = {
    id: existing ? existing.id : null,
    name: existing ? existing.name : '',
    emoji: existing ? existing.emoji : '🏃',
    color: existing ? existing.color : '#10b981',
    builtin: existing ? existing.builtin : 0
  };

  const close = openModal(`
    <div class="sheet-handle"></div>
    <div class="modal-title">${existing ? '✏️ 编辑项目' : '➕ 添加项目'}</div>
    <label class="f-label">项目名称</label>
    <input class="input" id="pf-name" placeholder="例如：网球" maxlength="12" value="${escapeHtml(state.name)}">
    <label class="f-label">选择图标</label>
    <div class="emojis" id="pf-emojis">${EMOJIS.map((e) => `<button class="emoji-cell${state.emoji === e ? ' active' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <label class="f-label">选择颜色</label>
    <div class="swatches" id="pf-colors">${COLORS.map((c) => `<button class="sw${state.color === c ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
    <div class="confirm-btns" style="margin-top:18px">
      ${existing ? '<button class="btn btn-danger" id="pf-del">删除</button>' : ''}
      <button class="btn btn-primary" id="pf-save" style="flex:1">保存</button>
    </div>
  `);

  $$('#pf-emojis .emoji-cell').forEach((b) => {
    b.onclick = () => {
      state.emoji = b.dataset.emoji;
      $$('#pf-emojis .emoji-cell').forEach((x) => x.classList.toggle('active', x === b));
    };
  });
  $$('#pf-colors .sw').forEach((b) => {
    b.onclick = () => {
      state.color = b.dataset.color;
      $$('#pf-colors .sw').forEach((x) => x.classList.toggle('active', x === b));
    };
  });

  $('#pf-save').onclick = async () => {
    const name = $('#pf-name').value.trim();
    if (!name) return toast('请输入项目名称', 'err');
    await db.put('projects', {
      id: state.id || uid(), name, emoji: state.emoji, color: state.color, builtin: state.builtin
    });
    close();
    toast(existing ? '项目已更新' : '项目已添加');
    onDone();
  };

  if (existing) {
    $('#pf-del').onclick = async () => {
      const ok = await confirmDialog({
        title: '删除项目',
        message: `确定删除「${existing.name}」吗？已有的打卡记录不会丢失，只是以后不能再选择这个项目。`,
        confirmText: '删除', danger: true
      });
      if (!ok) return;
      await db.del('projects', existing.id);
      close();
      toast('项目已删除');
      onDone();
    };
  }
}

/* ---------- 运动记录详情 ---------- */
export function openRecordDetail(r, onDone) {
  const close = openModal(`
    <div class="sheet-handle"></div>
    <div class="modal-title">运动详情</div>
    <div class="detail-head">
      <div class="rcard-icon" style="background:${r.projectColor || '#10b981'}26;color:${r.projectColor || '#10b981'};width:52px;height:52px;font-size:26px">${r.projectEmoji || '🏃'}</div>
      <div>
        <div class="detail-name">${escapeHtml(r.projectName || '运动')}</div>
        <div class="muted">${fmtDateCN(r.date)} · ${INTENSITY[r.intensity] || '中强度'}</div>
      </div>
      <span class="detail-dur">${fmtDuration(r.duration)}</span>
    </div>
    ${r.note ? `<div class="detail-note">${escapeHtml(r.note)}</div>` : ''}
    ${(r.photos || []).length ? `<div class="detail-photos">${r.photos.map((p, i) => `<img src="${blobUrl(p)}" data-pi="${i}" alt="">`).join('')}</div>` : ''}
    <button class="btn btn-danger btn-block" id="d-del" style="margin-top:16px">删除这条记录</button>
  `, { cls: 'sheet' });

  $$('[data-pi]').forEach((img) => {
    img.onclick = () => openLightbox(r.photos || [], +img.dataset.pi);
  });
  $('#d-del').onclick = async () => {
    const ok = await confirmDialog({
      title: '删除记录',
      message: '确定删除这条运动记录吗？照片也会一并删除。',
      confirmText: '删除', danger: true
    });
    if (!ok) return;
    await db.del('records', r.id);
    close();
    toast('已删除');
    onDone();
  };
}

/* ---------- 体重记录详情 ---------- */
export function openWeightDetail(w, onDone) {
  const close = openModal(`
    <div class="sheet-handle"></div>
    <div class="modal-title">体重详情</div>
    <div class="detail-head">
      <div class="rcard-icon" style="background:#3b82f626;color:#3b82f6;width:52px;height:52px;font-size:26px">⚖️</div>
      <div>
        <div class="detail-name">${Number(w.weight).toFixed(1)} kg</div>
        <div class="muted">${fmtDateCN(w.date)}</div>
      </div>
    </div>
    ${w.note ? `<div class="detail-note">${escapeHtml(w.note)}</div>` : ''}
    ${(w.photos || []).length ? `<div class="detail-photos">${w.photos.map((p, i) => `<img src="${blobUrl(p)}" data-pi="${i}" alt="">`).join('')}</div>` : ''}
    <button class="btn btn-danger btn-block" id="wd-del" style="margin-top:16px">删除这条记录</button>
  `, { cls: 'sheet' });

  $$('[data-pi]').forEach((img) => {
    img.onclick = () => openLightbox(w.photos || [], +img.dataset.pi);
  });
  $('#wd-del').onclick = async () => {
    const ok = await confirmDialog({
      title: '删除记录',
      message: '确定删除这条体重记录吗？',
      confirmText: '删除', danger: true
    });
    if (!ok) return;
    await db.del('weights', w.id);
    close();
    toast('已删除');
    onDone();
  };
}
