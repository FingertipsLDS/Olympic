/* ============ 健身日记 - 数据备份 / 导入 / 清除 ============ */
import { db, loadSettings, saveSettings, DEFAULT_PROJECTS } from './db.js';
import { toast, confirmDialog, downloadText, todayStr, uid, readAsDataURL } from './utils.js';

export async function exportData() {
  try {
    const [records, weights, projects, settings] = await Promise.all([
      db.getAll('records'), db.getAll('weights'), db.getAll('projects'), loadSettings()
    ]);
    const withPhotos = async (arr) => Promise.all(arr.map(async (x) => ({
      ...x,
      photos: await Promise.all((x.photos || []).map((p) => readAsDataURL(p)))
    })));
    const data = {
      app: 'fitdiary', version: 1,
      exportedAt: new Date().toISOString(),
      settings, projects,
      records: await withPhotos(records),
      weights: await withPhotos(weights)
    };
    downloadText(`健身日记备份-${todayStr()}.json`, JSON.stringify(data));
    toast('备份已导出 📦');
  } catch (e) {
    toast('导出失败：' + e.message, 'err');
  }
}

function dataURLToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mime = (parts[0].match(/data:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch (e) {
    return null;
  }
}

export async function importData(file, onDone) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    toast('文件格式不正确，无法导入', 'err');
    return;
  }
  if (!data || data.app !== 'fitdiary' || !Array.isArray(data.records) || !Array.isArray(data.weights)) {
    toast('不是有效的健身日记备份文件', 'err');
    return;
  }
  const ok = await confirmDialog({
    title: '导入备份',
    message: `备份包含 ${data.records.length} 条运动记录、${data.weights.length} 条体重记录。将以「追加」方式导入，不会覆盖已有数据。继续吗？`,
    confirmText: '开始导入'
  });
  if (!ok) return;

  const existing = await db.getAll('projects');
  const byName = new Map(existing.map((p) => [p.name, p.id]));
  const idMap = {};
  for (const p of (data.projects || [])) {
    if (!p || !p.name) continue;
    if (byName.has(p.name)) {
      idMap[p.id] = byName.get(p.name);
    } else {
      const nid = uid();
      idMap[p.id] = nid;
      await db.put('projects', { id: nid, name: p.name, emoji: p.emoji || '🏃', color: p.color || '#10b981', builtin: 0 });
      byName.set(p.name, nid);
    }
  }
  let n = 0;
  for (const r of data.records) {
    if (!r || !r.date) continue;
    await db.put('records', {
      ...r,
      id: uid(),
      projectId: idMap[r.projectId] || r.projectId,
      photos: (r.photos || []).map(dataURLToBlob).filter(Boolean),
      createdAt: r.createdAt || Date.now()
    });
    n++;
  }
  for (const w of data.weights) {
    if (!w || !w.date) continue;
    await db.put('weights', {
      ...w,
      id: uid(),
      photos: (w.photos || []).map(dataURLToBlob).filter(Boolean),
      createdAt: w.createdAt || Date.now()
    });
    n++;
  }
  if (data.settings) await saveSettings(data.settings);
  toast(`导入完成：${n} 条记录 🎉`);
  if (onDone) onDone();
}

export async function clearAllData(onDone) {
  const ok = await confirmDialog({
    title: '清除全部数据',
    message: '将删除所有运动记录、体重记录、照片和自定义项目，且无法恢复。建议先导出备份。确定继续吗？',
    confirmText: '全部清除', danger: true
  });
  if (!ok) return;
  await Promise.all([db.clear('records'), db.clear('weights'), db.clear('projects'), db.clear('meta')]);
  for (const p of DEFAULT_PROJECTS) await db.put('projects', { ...p });
  await db.put('meta', { key: 'seeded', value: 1 });
  await saveSettings({});
  toast('已清除全部数据');
  if (onDone) onDone();
}
