/* ============ 健身日记 - SVG 图表 ============ */
import { parseDate } from './utils.js';

function shortMD(s) {
  const p = s.slice(5).split('-');
  return `${+p[0]}/${+p[1]}`;
}

/**
 * 体重趋势折线图
 * weights: [{date:'YYYY-MM-DD', weight:Number}]（按日期升序）
 * goal: 目标体重（可为 null）
 * rangeDays: 30 | 90 | 0（0 = 全部）
 * 返回 SVG 字符串；数据点不足 2 个时返回 ''
 */
export function weightChartSVG(weights, goal, rangeDays) {
  let pts = weights.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (rangeDays) {
    const limit = new Date();
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() - (rangeDays - 1));
    const limS = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
    pts = pts.filter((p) => p.date >= limS);
  }
  if (pts.length < 2) return '';

  const W = 340, H = 176, padL = 38, padR = 12, padT = 18, padB = 28;
  const vals = pts.map((p) => Number(p.weight));
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  min -= span * 0.22;
  max += span * 0.22;

  const t0 = parseDate(pts[0].date).getTime();
  const t1 = parseDate(pts[pts.length - 1].date).getTime();
  const X = (d) => padL + ((parseDate(d).getTime() - t0) / Math.max(1, (t1 - t0))) * (W - padL - padR);
  const Y = (v) => padT + ((max - v) / Math.max(0.0001, (max - min))) * (H - padT - padB);

  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const v = min + (max - min) * i / 3;
    const y = Y(v);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="w-grid"/>`;
    grid += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" class="w-tick" text-anchor="end">${v.toFixed(1)}</text>`;
  }

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(Number(p.weight)).toFixed(1)}`).join('');
  const areaPts = pts.map((p) => `${X(p.date).toFixed(1)},${Y(Number(p.weight)).toFixed(1)}`).join(' ');
  const area = `<polygon points="${padL},${H - padB} ${areaPts} ${W - padR},${H - padB}" class="w-area"/>`;
  const dots = pts.map((p) => `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(Number(p.weight)).toFixed(1)}" r="2.6" class="w-dot"/>`).join('');

  const last = pts[pts.length - 1];
  const lastLabel = `<text x="${X(last.date).toFixed(1)}" y="${(Y(Number(last.weight)) - 9).toFixed(1)}" class="w-last" text-anchor="middle">${Number(last.weight).toFixed(1)}</text>`;

  const idxSet = new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1]);
  let xlab = '';
  for (const i of idxSet) {
    xlab += `<text x="${X(pts[i].date).toFixed(1)}" y="${H - 8}" class="w-xlab" text-anchor="middle">${shortMD(pts[i].date)}</text>`;
  }

  let goalEl = '';
  if (goal && goal > min && goal < max) {
    const gy = Y(goal);
    goalEl = `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" class="w-goal"/><text x="${W - padR}" y="${(gy - 4).toFixed(1)}" class="w-goal-txt" text-anchor="end">目标 ${goal}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="体重趋势图">${grid}${area}<path d="${line}" class="w-line"/>${dots}${goalEl}${lastLabel}${xlab}</svg>`;
}
