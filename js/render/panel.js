// Painel de instrumentos: relógios analógicos, barras, gráfico e luzes.
import { el, txt, pColor, fmt } from './svg.js';

const INK = '#1f2633';

class Dial {
  constructor(parent, cx, cy, r, o) {
    this.o = o; this.cx = cx; this.cy = cy; this.r = r; this.v = o.min;
    const g = el('g', { class: o.comp ? 'comp' : '', 'data-comp': o.comp || '' }, parent);
    el('circle', { cx, cy, r: r + 6, fill: '#1f2633' }, g);
    el('circle', { cx, cy, r: r + 2, fill: '#fbfaf6' }, g);
    const A = (v) => ((135 + (270 * (v - o.min)) / (o.max - o.min)) * Math.PI) / 180;
    this.A = A;
    const arc = (v0, v1, rr) => {
      const a0 = A(v0), a1 = A(v1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return `M${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)} A${rr} ${rr} 0 ${large} 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)}`;
    };
    for (const [z0, z1, c] of o.zones || []) el('path', { d: arc(z0, z1, r - 7), fill: 'none', stroke: c, 'stroke-width': 7 }, g);
    for (let v = o.min; v <= o.max + 1e-9; v += o.minor) {
      const a = A(v), major = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
      const r0 = major ? r - 14 : r - 9;
      el('line', { x1: cx + r0 * Math.cos(a), y1: cy + r0 * Math.sin(a), x2: cx + (r - 2) * Math.cos(a), y2: cy + (r - 2) * Math.sin(a), stroke: INK, 'stroke-width': major ? 2 : 1 }, g);
      if (major) txt(g, cx + (r - 25) * Math.cos(a), cy + (r - 25) * Math.sin(a) + 4, String(o.labelFn ? o.labelFn(v) : v), { 'text-anchor': 'middle', class: 'dial-n' });
    }
    this.needle = el('path', { d: `M${-6} 0 L0 ${-r + 12} L6 0 Z`, fill: '#d62828', stroke: '#8b1a1a', 'stroke-width': 1 }, g);
    el('circle', { cx, cy, r: 8, fill: INK }, g);
    this.val = txt(g, cx, cy + r * 0.64, '0', { 'text-anchor': 'middle', class: 'dial-v' });
    txt(g, cx, cy + r * 0.64 + 13, o.unit, { 'text-anchor': 'middle', class: 'dial-u' });
    txt(g, cx, cy + r + 24, o.label, { 'text-anchor': 'middle', class: 'dial-l' });
  }
  set(v, dt) {
    const o = this.o;
    const t = Math.max(o.min, Math.min(o.max * 1.03, v));
    this.v += (t - this.v) * Math.min(1, dt * 12);
    const a = (this.A(this.v) * 180) / Math.PI + 90;
    this.needle.setAttribute('transform', `translate(${this.cx} ${this.cy}) rotate(${a})`);
    this.val.textContent = fmt(v, o.dec || 0);
  }
}

class Bar {
  constructor(parent, x, y, w, label, unit, max, comp) {
    const g = el('g', { class: comp ? 'comp' : '', 'data-comp': comp || '' }, parent);
    this.w = w; this.max = max; this.unit = unit;
    txt(g, x, y, label, { class: 'bar-l' });
    this.val = txt(g, x + w, y, '', { 'text-anchor': 'end', class: 'bar-v' });
    el('rect', { x, y: y + 6, width: w, height: 12, rx: 6, fill: '#e5e7eb' }, g);
    this.fill = el('rect', { x, y: y + 6, width: 0, height: 12, rx: 6, fill: '#3b82c4' }, g);
    this.mark = el('rect', { x, y: y + 3, width: 3, height: 18, fill: INK, visibility: 'hidden' }, g);
    this.x = x;
  }
  set(v, color, mark, text) {
    const f = Math.max(0, Math.min(1, v / this.max));
    this.fill.setAttribute('width', (f * this.w).toFixed(1));
    if (color) this.fill.setAttribute('fill', color);
    if (mark != null) {
      this.mark.setAttribute('visibility', 'visible');
      this.mark.setAttribute('x', this.x + Math.min(1, mark / this.max) * this.w - 1.5);
    }
    this.val.textContent = text ?? `${fmt(v)} ${this.unit}`;
  }
}

export class Panel {
  constructor(svg) {
    this.svg = svg;
    const g = el('g', {}, svg);
    el('rect', { width: 520, height: 784, fill: '#ffffff' }, g);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 784, stroke: '#d8dce2', 'stroke-width': 2 }, g);
    txt(g, 18, 30, 'INSTRUMENTOS', { class: 'sec-t' });

    this.rpm = new Dial(g, 96, 116, 66, { min: 0, max: 2500, major: 500, minor: 100, label: 'Rotação do motor', unit: 'rpm', zones: [[2150, 2500, '#e45858']], labelFn: (v) => v / 100, comp: 'engine' });
    this.p1 = new Dial(g, 260, 116, 66, { min: 0, max: 400, major: 100, minor: 20, label: 'Pressão bomba P1', unit: 'bar', zones: [[300, 400, '#e45858'], [200, 300, '#f2b01e']], comp: 'pumps' });
    this.p2 = new Dial(g, 424, 116, 66, { min: 0, max: 400, major: 100, minor: 20, label: 'Pressão bomba P2', unit: 'bar', zones: [[300, 400, '#e45858'], [200, 300, '#f2b01e']], comp: 'pumps' });
    this.pil = new Dial(g, 96, 290, 58, { min: 0, max: 50, major: 10, minor: 5, label: 'Pressão piloto', unit: 'bar', zones: [[35, 45, '#a78bfa']], comp: 'pilotPump' });
    this.oilT = new Dial(g, 260, 290, 58, { min: 20, max: 120, major: 20, minor: 10, label: 'Temp. do óleo', unit: '°C', zones: [[95, 120, '#e45858'], [40, 80, '#7cb342']], comp: 'radiator' });
    this.cool = new Dial(g, 424, 290, 58, { min: 20, max: 120, major: 20, minor: 10, label: 'Temp. do motor', unit: '°C', zones: [[105, 120, '#e45858']], comp: 'engine' });

    // barras
    const by = 392;
    this.q1 = new Bar(g, 18, by, 190, 'Vazão P1', 'L/min', 260, 'pumps');
    this.q2 = new Bar(g, 18, by + 40, 190, 'Vazão P2', 'L/min', 260, 'pumps');
    this.pw = new Bar(g, 232, by, 190, 'Potência hidr.', 'kW', 160, 'pumps');
    this.fuel = new Bar(g, 232, by + 40, 190, 'Diesel', 'L/h', 40, 'engine');
    this.load = new Bar(g, 18, by + 80, 404, 'Terra na caçamba', '', 1.05, 'bucket');
    // tanque
    const tg = el('g', { class: 'comp', 'data-comp': 'tank' }, g);
    txt(tg, 472, by, 'Tanque', { 'text-anchor': 'middle', class: 'bar-l' });
    el('rect', { x: 452, y: by + 8, width: 40, height: 96, rx: 6, fill: '#e5e7eb', stroke: '#9aa3ad' }, tg);
    this.tankFill = el('rect', { x: 454, y: by + 10, width: 36, height: 0, rx: 4, fill: '#7fb0de' }, tg);
    for (const [f, l] of [[0.25, 'mín'], [0.85, 'máx']]) {
      const y = by + 104 - f * 96;
      el('line', { x1: 448, y1: y, x2: 496, y2: y, stroke: INK, 'stroke-width': 1, 'stroke-dasharray': '3 2' }, tg);
      txt(tg, 446, y + 4, l, { 'text-anchor': 'end', class: 'tiny' });
    }
    this.tankVal = txt(tg, 472, by + 120, '', { 'text-anchor': 'middle', class: 'bar-v' });

    // gráfico
    const cy0 = 530, ch = 120, cx0 = 18, cw = 484;
    const cg = el('g', { class: 'comp', 'data-comp': 'chart' }, g);
    txt(cg, cx0, cy0 - 8, 'Pressão das bombas · últimos 15 s', { class: 'bar-l' });
    el('rect', { x: cx0, y: cy0, width: cw, height: ch, rx: 6, fill: '#f6f7f9', stroke: '#e1e4e8' }, cg);
    for (const p of [100, 200, 300]) {
      const y = cy0 + ch - (p / 400) * ch;
      el('line', { x1: cx0, y1: y, x2: cx0 + cw, y2: y, stroke: '#e1e4e8' }, cg);
      txt(cg, cx0 + 4, y - 3, String(p), { class: 'tiny' });
    }
    this.chRelief = el('line', { x1: cx0, x2: cx0 + cw, stroke: '#d62828', 'stroke-dasharray': '6 4', 'stroke-width': 1.2 }, cg);
    this.chP1 = el('polyline', { fill: 'none', stroke: '#ef6c00', 'stroke-width': 2.2 }, cg);
    this.chP2 = el('polyline', { fill: 'none', stroke: '#2a7fd4', 'stroke-width': 2.2 }, cg);
    txt(cg, cx0 + cw - 150, cy0 + 16, '— P1', { class: 'tiny', fill: '#ef6c00' });
    txt(cg, cx0 + cw - 108, cy0 + 16, '— P2', { class: 'tiny', fill: '#2a7fd4' });
    txt(cg, cx0 + cw - 66, cy0 + 16, '- - alívio', { class: 'tiny', fill: '#d62828' });
    this.chart = { x: cx0, y: cy0, w: cw, h: ch, n: 300, p1: [], p2: [], acc: 0 };

    // luzes de aviso
    const lights = [
      ['lock', 'TRAVA'], ['relief0', 'ALÍVIO P1'], ['relief1', 'ALÍVIO P2'], ['lug', 'MOTOR FORÇADO'],
      ['hot', 'ÓLEO QUENTE'], ['cav', 'CAVITAÇÃO'], ['lowOil', 'NÍVEL BAIXO'], ['stall', 'MOTOR APAGOU'],
    ];
    this.lights = {};
    lights.forEach(([id, name], i) => {
      const x = 18 + (i % 4) * 122, y = 676 + Math.floor(i / 4) * 48;
      const lg = el('g', {}, g);
      const r = el('rect', { x, y, width: 114, height: 38, rx: 7, fill: '#eef0f3', stroke: '#d8dce2' }, lg);
      const t = txt(lg, x + 57, y + 24, name, { 'text-anchor': 'middle', class: 'lamp' });
      this.lights[id] = { r, t };
    });
  }

  update(st, dt) {
    this.rpm.set(st.eng.rpm, dt);
    this.p1.set(st.pumps[0].p, dt);
    this.p2.set(st.pumps[1].p, dt);
    this.pil.set(st.pilot.out, dt);
    this.oilT.set(st.oil.T, dt);
    this.cool.set(st.eng.coolant, dt);
    this.q1.set(st.pumps[0].q, pColor(st.pumps[0].p));
    this.q2.set(st.pumps[1].q, pColor(st.pumps[1].p));
    const hyd = st.pumps[0].kw + st.pumps[1].kw;
    this.pw.max = Math.max(160, st.params.engineKW * 1.1);
    this.pw.set(hyd, '#ef6c00', st.eng.availKW, `${fmt(hyd)} / ${fmt(st.eng.availKW)} kW`);
    this.fuel.set(st.eng.fuelLh, '#6b7280', null, `${fmt(st.eng.fuelLh, 1)} L/h`);
    const kg = st.soil.load * ({ areia: 1600, terra: 1800, argila: 2000, cascalho: 2100 }[st.params.material]);
    this.load.set(st.soil.load, '#9c6f45', null, `${fmt(st.soil.load, 2)} m³ · ${fmt(kg)} kg`);
    const f = Math.max(0, Math.min(1, (st.oil.tank - 70) / 100));
    this.tankFill.setAttribute('height', (92 * f).toFixed(1));
    this.tankFill.setAttribute('y', (392 + 10 + 92 * (1 - f)).toFixed(1));
    this.tankFill.setAttribute('fill', st.oil.tank < 95 ? '#e45858' : '#7fb0de');
    this.tankVal.textContent = `${fmt(st.oil.tank)} L`;

    const c = this.chart;
    c.acc += dt;
    while (c.acc >= 0.05) {
      c.acc -= 0.05;
      c.p1.push(st.pumps[0].p); c.p2.push(st.pumps[1].p);
      if (c.p1.length > c.n) { c.p1.shift(); c.p2.shift(); }
    }
    const pl = (arr) => arr.map((p, i) => `${(c.x + (i / (c.n - 1)) * c.w).toFixed(1)},${(c.y + c.h - (Math.min(400, p) / 400) * c.h).toFixed(1)}`).join(' ');
    this.chP1.setAttribute('points', pl(c.p1));
    this.chP2.setAttribute('points', pl(c.p2));
    const ry = c.y + c.h - ((st.pumps[0].reliefSet || st.params.reliefBar) / 400) * c.h;
    this.chRelief.setAttribute('y1', ry); this.chRelief.setAttribute('y2', ry);

    const colors = { lock: '#f59e0b', relief0: '#d62828', relief1: '#d62828', lug: '#f59e0b', hot: '#d62828', cav: '#d62828', lowOil: '#d62828', stall: '#d62828' };
    for (const id in this.lights) {
      const on = !!st.alerts[id];
      const L = this.lights[id];
      L.r.setAttribute('fill', on ? colors[id] : '#eef0f3');
      L.r.setAttribute('stroke', on ? colors[id] : '#d8dce2');
      L.t.setAttribute('fill', on ? '#fff' : '#9aa1ab');
    }
  }
}
