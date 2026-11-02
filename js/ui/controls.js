// Comandos da cabine (barra inferior) + teclado + controle de videogame.
import { el, txt } from '../render/svg.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function section(parent, title, w, cls = '') {
  const s = document.createElement('section');
  s.className = 'ctl ' + cls;
  s.style.width = w + 'px';
  const h = document.createElement('h4');
  h.textContent = title;
  s.appendChild(h);
  parent.appendChild(s);
  return s;
}
function btn(parent, label, cls = '') {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = label;
  parent.appendChild(b);
  return b;
}

// Joystick 2 eixos com mola de retorno
class Pad {
  constructor(parent, size, labels) {
    this.x = 0; this.y = 0; this.drag = false;
    const svg = el('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'pad' }, parent);
    const c = size / 2, R = size / 2 - 26;
    this.c = c; this.R = R;
    el('rect', { x: 2, y: 2, width: size - 4, height: size - 4, rx: 16, fill: '#f3f4f6', stroke: '#d1d5db' }, svg);
    el('circle', { cx: c, cy: c, r: R + 8, fill: '#e5e7eb', stroke: '#c5cad1' }, svg);
    el('line', { x1: c - R, y1: c, x2: c + R, y2: c, stroke: '#c5cad1', 'stroke-dasharray': '3 3' }, svg);
    el('line', { x1: c, y1: c - R, x2: c, y2: c + R, stroke: '#c5cad1', 'stroke-dasharray': '3 3' }, svg);
    const L = [['top', c, 15], ['bottom', c, size - 6], ['left', 6, c + 4], ['right', size - 6, c + 4]];
    for (const [k, x, y] of L) {
      txt(svg, x, y, labels[k], { 'text-anchor': k === 'left' ? 'start' : k === 'right' ? 'end' : 'middle', class: 'pad-l' });
    }
    this.stem = el('line', { x1: c, y1: c, x2: c, y2: c, stroke: '#4b5563', 'stroke-width': 8, 'stroke-linecap': 'round' }, svg);
    this.knob = el('circle', { cx: c, cy: c, r: 17, fill: '#1f2633', stroke: '#000', 'stroke-width': 1 }, svg);
    el('circle', { cx: c, cy: c, r: 0, fill: '#fff' }, svg);
    const set = (ev) => {
      const r = svg.getBoundingClientRect();
      const k = size / r.width;
      let dx = ((ev.clientX - r.left) * k - c) / R, dy = ((ev.clientY - r.top) * k - c) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.x = dx; this.y = -dy;
    };
    svg.addEventListener('pointerdown', (e) => { this.drag = true; svg.setPointerCapture(e.pointerId); set(e); });
    svg.addEventListener('pointermove', (e) => this.drag && set(e));
    const up = () => { this.drag = false; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  draw(x, y) {
    const px = this.c + x * this.R, py = this.c - y * this.R;
    this.knob.setAttribute('cx', px); this.knob.setAttribute('cy', py);
    this.stem.setAttribute('x2', px); this.stem.setAttribute('y2', py);
  }
}

// Alavanca vertical (translação) com mola
class Lever {
  constructor(parent, h, label) {
    this.v = 0; this.drag = false;
    const w = 64;
    const svg = el('svg', { width: w, height: h + 34, viewBox: `0 0 ${w} ${h + 34}`, class: 'lever' }, parent);
    const c = h / 2 + 6;
    this.c = c; this.R = h / 2 - 14;
    el('rect', { x: w / 2 - 7, y: 6, width: 14, height: h, rx: 7, fill: '#e5e7eb', stroke: '#c5cad1' }, svg);
    el('line', { x1: w / 2 - 16, y1: c, x2: w / 2 + 16, y2: c, stroke: '#9aa1ab' }, svg);
    txt(svg, w / 2, 16, '▲', { 'text-anchor': 'middle', class: 'pad-l' });
    txt(svg, w / 2, h + 4, '▼', { 'text-anchor': 'middle', class: 'pad-l' });
    this.knob = el('rect', { x: w / 2 - 20, y: c - 11, width: 40, height: 22, rx: 6, fill: '#1f2633' }, svg);
    txt(svg, w / 2, h + 28, label, { 'text-anchor': 'middle', class: 'pad-l' });
    const set = (ev) => {
      const r = svg.getBoundingClientRect();
      const k = (h + 34) / r.height;
      this.v = clamp(-((ev.clientY - r.top) * k - c) / this.R, -1, 1);
    };
    svg.addEventListener('pointerdown', (e) => { this.drag = true; svg.setPointerCapture(e.pointerId); set(e); });
    svg.addEventListener('pointermove', (e) => this.drag && set(e));
    const up = () => { this.drag = false; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  draw(v) { this.knob.setAttribute('y', this.c - 11 - v * this.R); }
}

export class Controls {
  constructor(root, st, hooks) {
    this.st = st; this.hooks = hooks;
    this.keys = new Set();
    this.ax = { leftX: 0, leftY: 0, rightX: 0, rightY: 0, travelL: 0, travelR: 0 };
    this.boostHeld = false; this.startHeld = false;

    // --- ignição: chave giratória (Desligado ← Ligado → Partida, com mola de volta) ---
    const sk = section(root, 'Ignição', 222);
    this.buildKey(sk);

    // --- acelerador ---
    const sa = section(root, 'Acelerador', 170);
    const kn = el('svg', { width: 150, height: 150, viewBox: '0 0 150 150', class: 'knob' }, sa);
    const C = 75, R = 54;
    for (let i = 1; i <= 10; i++) {
      const a = ((135 + ((i - 1) / 9) * 270) * Math.PI) / 180;
      el('line', { x1: C + (R + 4) * Math.cos(a), y1: C + (R + 4) * Math.sin(a), x2: C + (R + 11) * Math.cos(a), y2: C + (R + 11) * Math.sin(a), stroke: '#1f2633', 'stroke-width': 2 }, kn);
      txt(kn, C + (R + 19) * Math.cos(a), C + (R + 19) * Math.sin(a) + 4, String(i), { 'text-anchor': 'middle', class: 'pad-l' });
    }
    el('circle', { cx: C, cy: C, r: R, fill: '#2b3140', stroke: '#000' }, kn);
    el('circle', { cx: C, cy: C, r: R - 10, fill: '#3a4152' }, kn);
    this.knobMark = el('line', { x1: C, y1: C, x2: C, y2: C - R + 6, stroke: '#f2b705', 'stroke-width': 5, 'stroke-linecap': 'round' }, kn);
    this.knobTxt = txt(kn, C, C + 6, '', { 'text-anchor': 'middle', class: 'knob-t' });
    let kd = null;
    kn.addEventListener('pointerdown', (e) => { kd = { y: e.clientY, v: this.st.throttle }; kn.setPointerCapture(e.pointerId); });
    kn.addEventListener('pointermove', (e) => { if (kd) this.st.throttle = clamp(Math.round(kd.v + (kd.y - e.clientY) / 14), 1, 10); });
    kn.addEventListener('pointerup', () => { kd = null; });
    kn.addEventListener('wheel', (e) => { e.preventDefault(); this.st.throttle = clamp(this.st.throttle + (e.deltaY < 0 ? 1 : -1), 1, 10); }, { passive: false });
    this.rpmTarget = document.createElement('div'); this.rpmTarget.className = 'sub'; sa.appendChild(this.rpmTarget);

    // --- joystick esquerdo ---
    const sj = section(root, 'Joystick esquerdo', 220);
    // giro desabilitado: a vista é um corte lateral 2D
    this.padL = new Pad(sj, 176, { top: 'braço p/ fora', bottom: 'braço p/ dentro', left: '', right: '' });
    this.hint(sj, 'teclas W / S');

    // --- translação ---
    const st2 = section(root, 'Translação', 170);
    const lw = document.createElement('div'); lw.className = 'levers'; st2.appendChild(lw);
    this.levL = new Lever(lw, 128, 'esq.');
    this.levR = new Lever(lw, 128, 'dir.');
    this.hint(st2, 'as duas juntas · Q/Z ou E/C');

    // --- joystick direito ---
    const sr = section(root, 'Joystick direito', 220);
    this.padR = new Pad(sr, 176, { top: 'lança desce', bottom: 'lança sobe', left: '◀ recolhe', right: 'despeja ▶' });
    this.hint(sr, 'setas · caçamba ◀ ▶');

    // --- painel de informação ---
    this.info = section(root, 'Componente', 0, 'info');
    this.info.style.flex = '1';

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || this.override) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (k === 'i') this.st.key = this.st.key ? 0 : 1;
        if (k === '+' || k === '=') this.st.throttle = clamp(this.st.throttle + 1, 1, 10);
        if (k === '-') this.st.throttle = clamp(this.st.throttle - 1, 1, 10);
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  hint(parent, s) { const d = document.createElement('div'); d.className = 'hint'; d.textContent = s; parent.appendChild(d); }

  // Chave de ignição: arraste (ou clique na posição) para girar.
  // Desligado (esquerda) · Ligado (em cima) · Partida (direita, volta sozinha ao soltar).
  buildKey(parent) {
    const W = 198, Hh = 150, C = [99, 88];
    const POS = [-60, 0, 60];
    const svg = el('svg', { width: W, height: Hh, viewBox: `0 0 ${W} ${Hh}`, class: 'ignkey' }, parent);
    const pt = (deg, r) => [C[0] + r * Math.sin((deg * Math.PI) / 180), C[1] - r * Math.cos((deg * Math.PI) / 180)];
    el('circle', { cx: C[0], cy: C[1], r: 52, fill: '#2b3140', stroke: '#000' }, svg);
    el('circle', { cx: C[0], cy: C[1], r: 44, fill: '#3a4152' }, svg);
    this.keyLbl = ['DESL.', 'LIGADO', 'PARTIDA'].map((s, i) => {
      const [x1, y1] = pt(POS[i], 45), [x2, y2] = pt(POS[i], 52);
      el('line', { x1, y1, x2, y2, stroke: '#9aa3ad', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
      const [tx, ty] = pt(POS[i], 64);
      return txt(svg, tx + [-4, 0, 4][i], ty + 4, s, { 'text-anchor': ['end', 'middle', 'start'][i], class: 'key-l' });
    });
    // tambor e chave (giram juntos)
    this.keyG = el('g', {}, svg);
    el('circle', { cx: 0, cy: 0, r: 30, fill: '#c9ced6', stroke: '#1f2633', 'stroke-width': 1.5 }, this.keyG);
    el('circle', { cx: 0, cy: 0, r: 24, fill: 'none', stroke: '#9aa3ad', 'stroke-width': 1 }, this.keyG);
    el('rect', { x: -4, y: -20, width: 8, height: 40, rx: 2, fill: '#59616d' }, this.keyG);
    el('path', { d: 'M-15 -40 Q-15 -48 -7 -48 L7 -48 Q15 -48 15 -40 L15 -8 Q15 0 7 0 L-7 0 Q-15 0 -15 -8 Z', fill: '#f2b705', stroke: '#1f2633', 'stroke-width': 1.5 }, this.keyG);
    el('circle', { cx: 0, cy: -38, r: 4, fill: '#3a4152' }, this.keyG);
    el('rect', { x: -2, y: -30, width: 4, height: 22, rx: 2, fill: '#1f2633', opacity: 0.35 }, this.keyG);
    this.keyAng = POS[0]; this.keyPOS = POS; this.keyC = C;
    this.keyTxt = document.createElement('div'); this.keyTxt.className = 'sub'; parent.appendChild(this.keyTxt);

    let drag = null;
    const posFrom = (ev) => {
      const r = svg.getBoundingClientRect(), k = W / r.width;
      const dx = (ev.clientX - r.left) * k - C[0], dy = (ev.clientY - r.top) * k - C[1];
      const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
      return { d: Math.hypot(dx, dy), pos: ang < -27 ? 0 : ang > 27 ? 2 : 1 };
    };
    const apply = (pos) => {
      this.startHeld = pos === 2;
      this.st.key = pos === 0 ? 0 : Math.max(1, this.st.key === 2 && pos === 2 ? 2 : 1);
    };
    svg.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      svg.setPointerCapture(ev.pointerId);
      const p = posFrom(ev);
      drag = { x: ev.clientX, y: ev.clientY, moved: false, center: p.d < 32 };
      if (!drag.center) apply(p.pos);
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 6) drag.moved = true;
      if (drag.moved) apply(posFrom(ev).pos);
    });
    const up = () => {
      if (!drag) return;
      // clique no meio da chave (sem arrastar) liga/desliga
      if (drag.center && !drag.moved) this.st.key = this.st.key ? 0 : 1;
      this.startHeld = false;   // a mola traz a chave de volta de "Partida" para "Ligado"
      drag = null;
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  drawKey(st, dt) {
    const target = this.keyPOS[st.key] ?? 0;
    this.keyAng += (target - this.keyAng) * Math.min(1, dt * 16);
    this.keyG.setAttribute('transform', `translate(${this.keyC[0]} ${this.keyC[1]}) rotate(${this.keyAng.toFixed(1)})`);
    this.keyLbl.forEach((t, i) => t.classList.toggle('on', i === st.key));
    this.keyTxt.textContent = st.key === 2 ? 'dando partida…' : st.key === 0 ? 'desligado' : st.eng.running ? 'motor ligado' : 'ligado · gire até Partida';
  }

  update(dt) {
    const st = this.st, k = this.keys;
    const kv = (a, b) => (k.has(a) ? 1 : 0) - (k.has(b) ? 1 : 0);
    const target = {
      leftX: kv('d', 'a'), leftY: kv('w', 's'), rightX: kv('arrowright', 'arrowleft'), rightY: kv('arrowup', 'arrowdown'),
      travelL: kv('q', 'z'), travelR: kv('e', 'c'),
    };
    // controle de videogame
    let gpBoost = false, gpStart = false;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      target.leftX += dz(gp.axes[0] || 0); target.leftY += -dz(gp.axes[1] || 0);
      target.rightX += dz(gp.axes[2] || 0); target.rightY += -dz(gp.axes[3] || 0);
      const b = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      target.travelL += b(4) - b(6); target.travelR += b(5) - b(7);
      gpBoost = b(0) > 0.5; gpStart = b(9) > 0.5;
    }
    // rampa suave para teclado/controle
    const ramp = 3.2 * dt;
    for (const a in this.ax) {
      const t = clamp(target[a], -1, 1);
      const d = t - this.ax[a];
      this.ax[a] += Math.abs(d) < ramp ? d : Math.sign(d) * ramp;
    }
    // mouse tem prioridade enquanto arrasta; mola leva ao centro ao soltar
    const spring = (pad, axX, axY) => {
      if (pad.drag) return [pad.x, pad.y];
      pad.x *= Math.exp(-dt * 14); pad.y *= Math.exp(-dt * 14);
      return [clamp(pad.x + this.ax[axX], -1, 1), clamp(pad.y + this.ax[axY], -1, 1)];
    };
    const [lx, ly] = spring(this.padL, 'leftX', 'leftY');
    const [rx, ry] = spring(this.padR, 'rightX', 'rightY');
    const lev = (l, ax) => {
      if (l.drag) return l.v;
      l.v *= Math.exp(-dt * 14);
      return clamp(l.v + this.ax[ax], -1, 1);
    };
    let tl = lev(this.levL, 'travelL'), tr = lev(this.levR, 'travelR');
    let lx2 = lx, ly2 = ly, rx2 = rx, ry2 = ry;
    let startNow = this.startHeld || gpStart || k.has('enter');
    let boostNow = this.boostHeld || gpBoost || k.has(' ');
    // modo apresentação: o roteiro comanda (os joysticks na tela se mexem sozinhos)
    const o = this.override;
    if (o) {
      ({ leftX: lx2, leftY: ly2, rightX: rx2, rightY: ry2, travelL: tl, travelR: tr } = o);
      startNow = !!o.start; boostNow = !!o.boost;
    }
    // Simulador 2D: sem giro, e as esteiras andam sempre juntas (só frente/trás).
    // Vale o comando mais forte entre as duas alavancas; as duas se movem juntas.
    lx2 = 0;
    const travel = Math.abs(tl) >= Math.abs(tr) ? tl : tr;
    tl = tr = travel;
    if (this.levL.drag) this.levR.v = this.levL.v;
    else if (this.levR.drag) this.levL.v = this.levR.v;
    Object.assign(st.input, { leftX: lx2, leftY: ly2, rightX: rx2, rightY: ry2, travelL: tl, travelR: tr });
    this.padL.draw(lx2, ly2); this.padR.draw(rx2, ry2);
    this.levL.draw(tl); this.levR.draw(tr);

    // partida e reforço
    if (startNow) st.key = 2; else if (st.key === 2) st.key = 1;
    st.boost = boostNow;

    // reflexo visual
    this.drawKey(st, dt);
    const a = ((135 + ((st.throttle - 1) / 9) * 270) * Math.PI) / 180;
    this.knobMark.setAttribute('x2', 75 + Math.cos(a) * 46); this.knobMark.setAttribute('y2', 75 + Math.sin(a) * 46);
    this.knobTxt.textContent = st.throttle;
    this.rpmTarget.textContent = st.eng.running ? `alvo ${Math.round(st.eng.target)} rpm${st.eng.autoIdling ? ' (lenta auto)' : ''}` : 'motor desligado';
  }
}
