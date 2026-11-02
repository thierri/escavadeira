// Utilitários de SVG e linguagem de cores.
export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function txt(parent, x, y, s, attrs = {}) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = s;
  return t;
}

// Escala de pressão: azul (tanque) → verde → amarelo → laranja → vermelho (alívio)
export const P_STOPS = [
  [0, [59, 130, 196]],
  [40, [42, 161, 152]],
  [120, [124, 179, 66]],
  [220, [242, 176, 30]],
  [300, [239, 108, 0]],
  [350, [214, 40, 40]],
];
export function pColor(p) {
  p = Math.max(0, p);
  for (let i = 1; i < P_STOPS.length; i++) {
    if (p <= P_STOPS[i][0]) {
      const [a, ca] = P_STOPS[i - 1], [b, cb] = P_STOPS[i];
      const t = (p - a) / (b - a);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  const c = P_STOPS[P_STOPS.length - 1][1];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export const PILOT = '#8b5cf6';
export function pilotColor(pp) {
  const t = Math.min(1, pp / 39);
  // lilás claro (sem pressão) → roxo forte
  const a = [205, 196, 240], b = [124, 58, 237];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function pathD(pts, close = false) {
  if (!pts.length) return '';
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length; i++) d += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
  return close ? d + 'Z' : d;
}

// Polilinha com cantos arredondados (aparência de mangueira)
export function roundedD(pts, r = 10) {
  if (pts.length < 3) return pathD(pts);
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 - ((x1 - x0) / (l1 || 1)) * rr, ay = y1 - ((y1 - y0) / (l1 || 1)) * rr;
    const bx = x1 + ((x2 - x1) / (l2 || 1)) * rr, by = y1 + ((y2 - y1) / (l2 || 1)) * rr;
    d += 'L' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'Q' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1);
  }
  const l = pts[pts.length - 1];
  return d + 'L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1);
}

export const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
