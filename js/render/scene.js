// Desenho da cena principal: máquina em vista lateral, sistema hidráulico
// sobreposto, terreno, insets (vista de cima e bloco de válvulas).
import { el, txt, pColor, pilotColor, roundedD, pathD, fmt } from './svg.js';
import { GEO, tf, deg } from '../sim/kinematics.js';
import { RANGES, TERRAIN, sectorOf, BUCKET_CAP, terrainAt } from '../sim/simulation.js';

export const SCENE_W = 1400, SCENE_H = 784;
const S = 72;          // pixels por metro
const OX = 420, OY = 480;

// ordem das seções no bloco de válvulas (de cima para baixo)
export const VALVE_ORDER = ['bucket', 'arm', 'boom', 'swing', 'travelL', 'travelR'];
const VALVE = { x0: 0.2, x1: 0.8, y0: 1.2, y1: 2.0 };
const secY = (i) => VALVE.y1 - (i + 0.5) * ((VALVE.y1 - VALVE.y0) / 6);

const NSS = { 'vector-effect': 'non-scaling-stroke' };
const INK = '#1f2633';
const STEEL = '#c9ced6';
const MACHINE = '#f3cf6c';
const MACHINE_D = '#d9a93a';

// ---------- mangueira ----------
class Hose {
  constructor(parent, w, kind, comp) {
    this.w = w; this.kind = kind; this.off = 0;
    this.g = el('g', { class: 'comp hose', 'data-comp': comp }, parent);
    this.o = el('path', { fill: 'none', stroke: INK, 'stroke-width': w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.g);
    this.c = el('path', { fill: 'none', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.g);
    this.f = el('path', {
      fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.85, 'stroke-width': Math.max(1.5, w * 0.42),
      'stroke-linecap': 'round', 'stroke-dasharray': `${Math.max(2, w * 0.35)} ${w * 2.4 + 4}`,
    }, this.g);
  }
  update(pts, p, q, dt) {
    const d = roundedD(pts, 9);
    this.o.setAttribute('d', d); this.c.setAttribute('d', d); this.f.setAttribute('d', d);
    this.c.setAttribute('stroke', this.kind === 'pilot' ? pilotColor(p) : pColor(p));
    const speed = Math.max(-240, Math.min(240, q * (this.kind === 'pilot' ? 3 : 1.1)));
    this.off -= speed * dt;
    this.f.setAttribute('stroke-dashoffset', this.off.toFixed(1));
    this.f.setAttribute('visibility', Math.abs(q) > 0.3 ? 'visible' : 'hidden');
  }
}

// ---------- cilindro hidráulico (em corte) ----------
class Cylinder {
  constructor(parent, comp, borePx) {
    this.g = el('g', { class: 'comp cyl', 'data-comp': comp }, parent);
    const h = borePx, rh = Math.round(borePx * 0.5);
    this.h = h; this.rh = rh;
    this.rod = el('rect', { y: -rh / 2, height: rh, fill: STEEL, stroke: INK, 'stroke-width': 1.5 }, this.g);
    this.barrel = el('rect', { y: -h / 2 - 2.5, height: h + 5, rx: 3, fill: '#4a5262', stroke: INK, 'stroke-width': 1.5 }, this.g);
    this.capCh = el('rect', { y: -h / 2, height: h }, this.g);
    this.rodCh = el('rect', { y: -h / 2, height: h }, this.g);
    this.rodIn = el('rect', { y: -rh / 2, height: rh, fill: STEEL, opacity: 0.95 }, this.g);
    this.piston = el('rect', { y: -h / 2 - 1, height: h + 2, width: 6, fill: '#2b3140' }, this.g);
    this.eye0 = el('circle', { r: h * 0.45, fill: '#4a5262', stroke: INK, 'stroke-width': 1.5 }, this.g);
    this.eye1 = el('circle', { r: rh * 0.9, fill: STEEL, stroke: INK, 'stroke-width': 1.5 }, this.g);
  }
  update(b, e, Lmin, stroke, pA, pB) {
    const dx = e[0] - b[0], dy = e[1] - b[1];
    const L = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    this.g.setAttribute('transform', `translate(${b[0].toFixed(1)} ${b[1].toFixed(1)}) rotate(${ang.toFixed(2)})`);
    const a = 0.15 * S;
    const Lb = (0.25 + stroke) * S;
    const rodLen = Lmin * S - a;
    const xp = Math.max(a, Math.min(Lb - 0.1 * S, L - rodLen));
    this.rod.setAttribute('x', xp); this.rod.setAttribute('width', Math.max(0, L - xp));
    this.barrel.setAttribute('x', -4); this.barrel.setAttribute('width', Lb + 4);
    this.capCh.setAttribute('x', 4); this.capCh.setAttribute('width', Math.max(0, xp - 4));
    this.capCh.setAttribute('fill', pColor(pA));
    this.rodCh.setAttribute('x', xp + 6); this.rodCh.setAttribute('width', Math.max(0, Lb - 6 - xp - 6));
    this.rodCh.setAttribute('fill', pColor(pB));
    this.rodIn.setAttribute('x', xp + 6); this.rodIn.setAttribute('width', Math.max(0, Lb - 6 - xp - 6));
    this.piston.setAttribute('x', xp);
    this.eye1.setAttribute('cx', L);
    this.len = L; this.Lb = Lb;
  }
}

export class Scene {
  constructor(svg, overlay, onPick) {
    this.svg = svg;
    this.overlay = overlay; // camada fixa (insets), não acompanha a câmera
    this.mx = 0;
    this.layers = { hoses: true, pilot: true, labels: true, values: true };
    this.drips = [];
    this.selected = null;
    this.build();
    for (const target of [svg, overlay]) {
      target.addEventListener('click', (ev) => {
        const c = ev.target.closest('[data-comp]');
        onPick(c ? c.getAttribute('data-comp') : null);
      });
    }
  }
  X(x) { return OX + (this.mx + x) * S; }
  Y(y) { return OY - y * S; }
  P(p) { return [this.X(p[0]), this.Y(p[1])]; }

  build() {
    const s = this.svg;
    const defs = el('defs', {}, s);
    const sky = el('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#eef3f7' }, sky);
    el('stop', { offset: 1, 'stop-color': '#f7f5ef' }, sky);
    const soil = el('pattern', { id: 'soil', width: 26, height: 26, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 26, height: 26, fill: '#c9a27a' }, soil);
    el('circle', { cx: 5, cy: 7, r: 1.6, fill: '#b28a62' }, soil);
    el('circle', { cx: 18, cy: 16, r: 1.2, fill: '#a87f58' }, soil);
    el('circle', { cx: 11, cy: 22, r: 0.9, fill: '#b28a62' }, soil);
    const glow = el('filter', { id: 'glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 4, 'flood-color': '#2563eb', 'flood-opacity': 0.9 }, glow);

    el('rect', { x: -800, y: -600, width: SCENE_W + 1600, height: SCENE_H + 1200, fill: 'url(#sky)' }, s);
    // grade técnica discreta
    const grid = el('g', { opacity: 0.35 }, s);
    for (let x = OX % S - 10 * S; x <= SCENE_W + 10 * S; x += S) el('line', { x1: x, y1: -600, x2: x, y2: SCENE_H + 600, stroke: '#dfe3e8', 'stroke-width': 1 }, grid);
    for (let y = OY % S - 8 * S; y <= SCENE_H + 8 * S; y += S) el('line', { x1: -800, y1: y, x2: SCENE_W + 800, y2: y, stroke: '#dfe3e8', 'stroke-width': 1 }, grid);

    this.gTerrain = el('g', { class: 'comp', 'data-comp': 'ground' }, s);
    this.terrainFill = el('path', { fill: 'url(#soil)' }, this.gTerrain);
    this.terrainLine = el('path', { fill: 'none', stroke: '#7a5634', 'stroke-width': 3 }, this.gTerrain);
    this.terrainTop = el('path', { fill: 'none', stroke: '#8fae5c', 'stroke-width': 4, 'stroke-dasharray': '2 3', opacity: 0.8 }, this.gTerrain);

    // chassi inferior (redesenhado a cada quadro por causa do giro)
    this.gUnder = el('g', {}, s);
    this.buildUnder();

    // estrutura superior (em metros, y para cima)
    this.gUpper = el('g', {}, s);
    this.buildUpper();

    // mangueiras do corpo
    this.gHosesBody = el('g', {}, s);
    this.gPilot = el('g', {}, s);
    this.gCylBoom = el('g', {}, s);
    this.gBoom = el('g', { class: 'comp', 'data-comp': 'boom' }, s);
    this.buildBoom();
    this.gHosesBoom = el('g', {}, s);
    this.gCylArm = el('g', {}, s);
    this.gArm = el('g', { class: 'comp', 'data-comp': 'arm' }, s);
    this.buildArm();
    this.gLinks = el('g', { class: 'comp', 'data-comp': 'bucketCyl' }, s);
    this.gBucket = el('g', { class: 'comp', 'data-comp': 'bucket' }, s);
    this.buildBucket();
    this.gCylBucket = el('g', {}, s);
    this.gParticles = el('g', {}, s);
    this.gValues = el('g', { class: 'values' }, s);
    this.gValuesPump = el('g', { class: 'values' }, s);
    this.gLabels = el('g', { class: 'labels' }, s);
    this.gInsets = el('g', {}, this.overlay);

    this.buildHoses();
    this.cyl = {
      boom: new Cylinder(this.gCylBoom, 'boomCyl', 19),
      arm: new Cylinder(this.gCylArm, 'armCyl', 21),
      bucket: new Cylinder(this.gCylBucket, 'bucketCyl', 18),
    };
    this.links = {
      side: el('line', { stroke: INK, 'stroke-width': 9, 'stroke-linecap': 'round' }, this.gLinks),
      sideF: el('line', { stroke: '#8d96a5', 'stroke-width': 6, 'stroke-linecap': 'round' }, this.gLinks),
      bl: el('line', { stroke: INK, 'stroke-width': 10, 'stroke-linecap': 'round' }, this.gLinks),
      blF: el('line', { stroke: MACHINE, 'stroke-width': 7, 'stroke-linecap': 'round' }, this.gLinks),
      pins: [0, 1, 2].map(() => el('circle', { r: 4, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }, this.gLinks)),
    };
    this.buildLabels();
    this.buildInsets();
  }

  // ----- chassi inferior -----
  buildUnder() {
    const g = this.gUnder;
    this.uTrack = el('path', { class: 'comp', 'data-comp': 'tracks', fill: '#3a3f47', stroke: INK, 'stroke-width': 2 }, g);
    this.uShoes = el('path', { class: 'comp', 'data-comp': 'tracks', fill: 'none', stroke: '#717a86', 'stroke-width': 5, 'stroke-dasharray': '10 6' }, g);
    this.uFrame = el('path', { class: 'comp', 'data-comp': 'tracks', fill: '#5d6571', stroke: INK, 'stroke-width': 1.5 }, g);
    this.uRollers = el('g', { class: 'comp', 'data-comp': 'tracks' }, g);
    this.uRollerC = [];
    for (let i = 0; i < 5; i++) this.uRollerC.push(el('circle', { r: 7, fill: '#9aa3ad', stroke: INK, 'stroke-width': 1.2 }, this.uRollers));
    this.uSprocket = el('circle', { class: 'comp', 'data-comp': 'tracks', r: 0.36 * S, fill: '#7d8692', stroke: INK, 'stroke-width': 1.5 }, g);
    this.uIdler = el('circle', { class: 'comp', 'data-comp': 'tracks', r: 0.34 * S, fill: '#7d8692', stroke: INK, 'stroke-width': 1.5 }, g);
    this.uTravel = el('circle', { class: 'comp', 'data-comp': 'travelMotor', r: 0.19 * S, stroke: INK, 'stroke-width': 2 }, g);
    this.uTravelMark = el('line', { class: 'comp', 'data-comp': 'travelMotor', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    this.uBearing = el('rect', { class: 'comp', 'data-comp': 'swingMotor', height: 0.14 * S, fill: '#8a919c', stroke: INK, 'stroke-width': 1.5 }, g);
    this.uSwivel = el('rect', { class: 'comp', 'data-comp': 'swivel', width: 0.16 * S, height: 0.55 * S, rx: 3, fill: '#aab3be', stroke: INK, 'stroke-width': 1.5 }, g);
  }

  // ----- estrutura superior -----
  buildUpper() {
    const g = this.gUpper;
    const m = (tag, a, comp) => {
      const e = el(tag, { ...NSS, ...a }, comp ? this.compGroup(g, comp) : g);
      return e;
    };
    this.compGroups = {};
    // cabine (lado oposto, ao fundo)
    const cab = this.compGroup(g, 'cab');
    el('path', { ...NSS, d: 'M0.1 2.6 L0.2 3.32 L1.12 3.32 L1.42 2.6 Z', fill: '#e8eef3', stroke: INK, 'stroke-width': 1.5 }, cab);
    el('path', { ...NSS, d: 'M0.26 2.7 L0.32 3.22 L1.05 3.22 L1.28 2.7 Z', fill: '#cfe2ee', stroke: '#7d8a99', 'stroke-width': 1 }, cab);
    el('rect', { ...NSS, x: 0.62, y: 2.6, width: 0.28, height: 0.22, fill: '#59616d' }, cab); // banco
    this.joyMark = el('line', { ...NSS, x1: 0.42, y1: 2.6, x2: 0.42, y2: 2.88, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, cab);
    el('circle', { ...NSS, cx: 0.42, cy: 2.88, r: 0.04, fill: '#d62828' }, cab);
    // contrapeso
    el('path', { ...NSS, d: 'M-2.15 1.08 L-2.72 1.08 Q-2.88 1.08 -2.88 1.3 L-2.88 2.3 Q-2.88 2.52 -2.66 2.52 L-2.15 2.52 Z', fill: MACHINE_D, stroke: INK, 'stroke-width': 2 }, this.compGroup(g, 'counterweight'));
    // carcaça em corte
    const hs = this.compGroup(g, 'housing');
    el('rect', { ...NSS, x: -2.15, y: 1.08, width: 3.6, height: 1.52, fill: '#fbfaf6', stroke: INK, 'stroke-width': 2 }, hs);
    el('rect', { ...NSS, x: -2.15, y: 2.56, width: 3.6, height: 0.06, fill: MACHINE, stroke: INK, 'stroke-width': 1.5 }, hs);
    // radiadores
    const rad = this.compGroup(g, 'radiator');
    el('rect', { ...NSS, x: -2.1, y: 1.85, width: 0.13, height: 0.52, fill: '#b9c3cf', stroke: INK, 'stroke-width': 1.2 }, rad);
    this.cooler = el('rect', { ...NSS, x: -2.1, y: 1.2, width: 0.13, height: 0.6, stroke: INK, 'stroke-width': 1.2 }, rad);
    for (let y = 1.25; y < 2.35; y += 0.07) el('line', { ...NSS, x1: -2.1, y1: y, x2: -1.97, y2: y, stroke: '#7f8b99', 'stroke-width': 0.8 }, rad);
    // motor diesel
    const en = this.compGroup(g, 'engine');
    el('rect', { ...NSS, x: -1.9, y: 1.3, width: 0.7, height: 0.72, rx: 0.05, fill: '#6b7686', stroke: INK, 'stroke-width': 2 }, en);
    el('rect', { ...NSS, x: -1.86, y: 2.02, width: 0.62, height: 0.16, fill: '#59636f', stroke: INK, 'stroke-width': 1.5 }, en);
    for (let i = 0; i < 4; i++) el('rect', { ...NSS, x: -1.82 + i * 0.15, y: 1.6, width: 0.1, height: 0.36, fill: '#7f8b99', stroke: '#444c58', 'stroke-width': 1 }, en);
    el('rect', { ...NSS, x: -1.42, y: 2.18, width: 0.07, height: 0.58, fill: '#4a5262', stroke: INK, 'stroke-width': 1.2 }, en); // escape
    el('rect', { ...NSS, x: -1.97, y: 1.4, width: 0.05, height: 0.62, rx: 0.02, fill: '#9aa3ad', stroke: INK, 'stroke-width': 1 }, en); // ventilador
    this.flywheel = el('g', {}, en);
    el('circle', { ...NSS, cx: -1.17, cy: 1.65, r: 0.14, fill: '#8a939f', stroke: INK, 'stroke-width': 1.5 }, this.flywheel);
    this.flyMark = el('line', { ...NSS, x1: -1.17, y1: 1.65, x2: -1.17, y2: 1.77, stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, this.flywheel);
    // bombas
    const pu = this.compGroup(g, 'pumps');
    el('line', { ...NSS, x1: -1.2, y1: 1.65, x2: -0.58, y2: 1.65, stroke: INK, 'stroke-width': 3 }, pu);
    this.pumpBody = [
      el('rect', { ...NSS, x: -1.1, y: 1.45, width: 0.2, height: 0.4, rx: 0.03, stroke: INK, 'stroke-width': 1.8 }, pu),
      el('rect', { ...NSS, x: -0.88, y: 1.45, width: 0.2, height: 0.4, rx: 0.03, stroke: INK, 'stroke-width': 1.8 }, pu),
    ];
    this.swash = [
      el('line', { ...NSS, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, pu),
      el('line', { ...NSS, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, pu),
    ];
    const pp = this.compGroup(g, 'pilotPump');
    this.pilotPumpBody = el('rect', { ...NSS, x: -0.66, y: 1.55, width: 0.08, height: 0.2, rx: 0.02, stroke: INK, 'stroke-width': 1.5 }, pp);
    // tanque
    const tk = this.compGroup(g, 'tank');
    el('rect', { ...NSS, x: -0.48, y: 1.3, width: 0.42, height: 0.82, rx: 0.03, fill: '#f2f5f8', stroke: INK, 'stroke-width': 2 }, tk);
    this.tankOil = el('rect', { ...NSS, x: -0.46, y: 1.32, width: 0.38, height: 0.5, fill: '#7fb0de' }, tk);
    this.tankWave = el('line', { ...NSS, stroke: '#3b82c4', 'stroke-width': 2 }, tk);
    el('rect', { ...NSS, x: -0.3, y: 1.8, width: 0.09, height: 0.28, fill: '#fff', stroke: '#566170', 'stroke-width': 1, 'stroke-dasharray': '3 2' }, tk); // filtro de retorno
    el('rect', { ...NSS, x: -0.44, y: 1.32, width: 0.1, height: 0.1, fill: 'none', stroke: '#566170', 'stroke-width': 1, 'stroke-dasharray': '2 2' }, tk); // tela de sucção
    el('rect', { ...NSS, x: -0.42, y: 2.12, width: 0.08, height: 0.07, fill: '#566170', stroke: INK, 'stroke-width': 1 }, tk); // respiro
    // motor de giro
    const sw = this.compGroup(g, 'swingMotor');
    this.swingBody = el('rect', { ...NSS, x: -0.02, y: 1.16, width: 0.15, height: 0.46, rx: 0.03, stroke: INK, 'stroke-width': 1.8 }, sw);
    el('rect', { ...NSS, x: 0.015, y: 1.06, width: 0.08, height: 0.1, fill: '#7d8692', stroke: INK, 'stroke-width': 1 }, sw);
    // válvula de bloqueio do piloto
    const lk = this.compGroup(g, 'lockValve');
    this.lockBody = el('rect', { ...NSS, x: -0.02, y: 2.37, width: 0.13, height: 0.1, rx: 0.02, stroke: INK, 'stroke-width': 1.5 }, lk);
    // bloco de válvulas
    const vb = this.compGroup(g, 'valve');
    el('rect', { ...NSS, x: VALVE.x0, y: VALVE.y0, width: VALVE.x1 - VALVE.x0, height: VALVE.y1 - VALVE.y0, rx: 0.03, fill: '#aeb7c2', stroke: INK, 'stroke-width': 2 }, vb);
    this.spools = [];
    const hS = (VALVE.y1 - VALVE.y0) / 6;
    for (let i = 0; i < 6; i++) {
      const y = secY(i);
      el('line', { ...NSS, x1: VALVE.x0, y1: y - hS / 2, x2: VALVE.x1, y2: y - hS / 2, stroke: '#7d8692', 'stroke-width': 1 }, vb);
      el('rect', { ...NSS, x: 0.26, y: y - 0.025, width: 0.48, height: 0.05, fill: '#6b7380' }, vb);
      const sp = el('rect', { ...NSS, x: 0.38, y: y - 0.02, width: 0.24, height: 0.04, rx: 0.01, fill: '#eef1f4', stroke: INK, 'stroke-width': 1 }, vb);
      const pil = el('rect', { ...NSS, x: 0.21, y: y - 0.03, width: 0.04, height: 0.06, fill: PILOTC }, vb);
      this.spools.push({ sp, pil });
    }
    this.reliefLamp = [
      el('circle', { ...NSS, cx: 0.27, cy: 1.16, r: 0.035, stroke: INK, 'stroke-width': 1 }, vb),
      el('circle', { ...NSS, cx: 0.37, cy: 1.16, r: 0.035, stroke: INK, 'stroke-width': 1 }, vb),
    ];
  }
  compGroup(parent, comp) {
    if (!this.compGroups[comp]) this.compGroups[comp] = el('g', { class: 'comp', 'data-comp': comp }, parent);
    return this.compGroups[comp];
  }

  buildBoom() {
    const g = this.gBoom;
    el('path', { ...NSS, d: 'M-0.3 0.3 L2.7 0.98 L5.95 0.32 L6.0 -0.22 L2.7 0.05 L0.1 -0.36 Q-0.32 -0.3 -0.3 0.3 Z', fill: MACHINE, stroke: INK, 'stroke-width': 2 }, g);
    el('path', { ...NSS, d: 'M2.25 0.08 L2.55 -0.38 L2.85 0.06 Z', fill: MACHINE_D, stroke: INK, 'stroke-width': 1.5 }, g); // olhal cil. lança
    el('path', { ...NSS, d: 'M2.55 0.95 L2.9 1.1 L3.15 0.9 Z', fill: MACHINE_D, stroke: INK, 'stroke-width': 1.5 }, g);     // base cil. braço
    el('circle', { ...NSS, cx: 0, cy: 0, r: 0.12, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }, g);
    el('circle', { ...NSS, cx: 5.7, cy: 0, r: 0.12, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }, g);
  }
  buildArm() {
    const g = this.gArm;
    el('path', { ...NSS, d: 'M-0.82 0.05 L-0.62 0.36 L0.35 0.46 L2.6 0.16 L3.02 0.1 L3.02 -0.13 L2.6 -0.17 L0.3 -0.3 L-0.72 -0.18 Z', fill: MACHINE, stroke: INK, 'stroke-width': 2 }, g);
    el('circle', { ...NSS, cx: 0, cy: 0, r: 0.1, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }, g);
    el('circle', { ...NSS, cx: -0.69, cy: 0.12, r: 0.07, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }, g);
  }
  buildBucket() {
    const g = this.gBucket;
    el('path', { ...NSS, d: 'M-0.12 0.12 L0.15 0.56 Q0.6 0.8 1.1 0.64 Q1.42 0.5 1.5 0.12 L1.66 -0.02 L1.5 -0.06 L0.08 -0.2 Q-0.14 -0.12 -0.12 0.12 Z', fill: MACHINE, stroke: INK, 'stroke-width': 2 }, g);
    el('path', { ...NSS, d: 'M0.12 0.38 Q0.6 0.6 1.06 0.52 Q1.36 0.4 1.44 0.06 L0.1 -0.12 Z', fill: '#e7d6a8', stroke: '#a58a4c', 'stroke-width': 1 }, g);
    this.soilFill = el('path', { ...NSS, fill: '#9c6f45', stroke: '#6e4a2b', 'stroke-width': 1 }, g);
    el('path', { ...NSS, d: 'M1.5 0.04 L1.72 -0.01 L1.5 -0.07 Z', fill: '#59616d', stroke: INK, 'stroke-width': 1 }, g); // dente
    el('circle', { ...NSS, cx: 0, cy: 0, r: 0.08, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }, g);
  }

  buildHoses() {
    const b = this.gHosesBody, bb = this.gHosesBoom, pl = this.gPilot;
    this.h = {
      suction: new Hose(b, 9, 'suction', 'hoseSuction'),
      ret: new Hose(b, 8, 'return', 'hoseReturn'),
      p1: new Hose(b, 7, 'pressure', 'hosePump'),
      p2: new Hose(b, 7, 'pressure', 'hosePump'),
      pilotSup: new Hose(pl, 3.5, 'pilot', 'hosePilot'),
      pilotOut: new Hose(pl, 3.5, 'pilot', 'hosePilot'),
    };
    this.hp = VALVE_ORDER.map(() => new Hose(pl, 2.5, 'pilot', 'hosePilot'));
    // cada função tem seu próprio id (hoseWork-boom…), útil para destacar só aquelas mangueiras
    const mk = (parent, id, w = 5) => [new Hose(parent, w, 'work', 'hoseWork-' + id), new Hose(parent, w, 'work', 'hoseWork-' + id)];
    this.hw = {
      boom: mk(b, 'boom'), swing: mk(b, 'swing', 4.5),
      travelL: mk(b, 'travelL', 4), travelR: mk(b, 'travelR', 4),
      arm: mk(bb, 'arm'), bucket: mk(bb, 'bucket', 4.5),
    };
  }

  buildLabels() {
    const L = this.gLabels;
    this.labels = [];
    const add = (comp, text, anchorFn, posFn, align = 'middle') => {
      const g = el('g', { class: 'comp lbl', 'data-comp': comp }, L);
      const line = el('polyline', { fill: 'none', stroke: '#4b5563', 'stroke-width': 1.2 }, g);
      const dot = el('circle', { r: 3, fill: '#4b5563' }, g);
      const t = txt(g, 0, 0, text, { 'text-anchor': align, class: 'lbl-t' });
      this.labels.push({ g, line, dot, t, anchorFn, posFn, align });
    };
    const U = (x, y) => () => this.P([x, y]);
    // nomes dos componentes internos ficam na "prateleira" sob a máquina
    const left = (row) => () => [this.X(-3.05), OY + 40 + row * 24];
    const right = (row) => () => [this.X(1.25), OY + 40 + row * 24];
    add('radiator', 'Radiadores (água e óleo)', U(-2.04, 1.5), left(0), 'end');
    add('travelMotor', 'Motor de translação', () => this.travelPos || [0, 0], left(1), 'end');
    add('engine', 'Motor diesel', U(-1.55, 1.4), left(2), 'end');
    add('pumps', 'Bombas principais P1 · P2', U(-0.89, 1.5), left(3), 'end');
    add('valve', 'Bloco de válvulas', U(0.5, 1.25), right(0), 'start');
    add('swingMotor', 'Motor de giro', U(0.09, 1.25), right(1), 'start');
    add('swivel', 'Junta rotativa', U(-0.02, 0.7), right(2), 'start');
    add('tank', 'Tanque de óleo', U(-0.27, 1.4), right(3), 'start');
    add('cab', 'Cabine e joysticks', U(0.72, 2.95), () => [this.X(1.45), this.Y(3.55)], 'start');
    add('boomCyl', 'Cilindros da lança', () => this.midCyl('boom'), () => { const m = this.midCyl('boom'); return [m[0] + 62, m[1] + 42]; }, 'start');
    add('armCyl', 'Cilindro do braço', () => this.midCyl('arm'), () => { const m = this.midCyl('arm'); return [m[0] - 20, m[1] - 46]; });
    add('bucketCyl', 'Cilindro da caçamba', () => this.midCyl('bucket'), () => { const m = this.midCyl('bucket'); return [m[0] + 70, m[1] - 18]; }, 'start');
    add('boom', 'Lança', () => this.P(tf(this.geo.B0, this.geo.tb, [4.4, 0.1])), () => { const p = this.P(tf(this.geo.B0, this.geo.tb, [4.4, 0.1])); return [p[0] - 24, p[1] + 58]; }, 'end');
    add('arm', 'Braço', () => this.P(tf(this.geo.A0, this.geo.ta, [1.9, -0.15])), () => { const p = this.P(tf(this.geo.A0, this.geo.ta, [1.9, -0.15])); return [p[0] - 70, p[1] + 10]; }, 'end');
    add('bucket', 'Caçamba', () => this.P(tf(this.geo.K0, this.geo.tk, [0.9, 0.55])), () => { const p = this.P(tf(this.geo.K0, this.geo.tk, [0.9, 0.55])); return [p[0] + 64, p[1] + 26]; }, 'start');
  }
  midCyl(id) {
    const c = this.geo.cyl[id];
    return this.P([(c.base[0] + c.end[0]) / 2, (c.base[1] + c.end[1]) / 2]);
  }

  buildInsets() {
    const g = this.gInsets;
    // vista de cima
    const pv = el('g', { transform: 'translate(16 16)', class: 'comp', 'data-comp': 'planView' }, g);
    this.insetPlan = pv;
    el('rect', { width: 196, height: 214, rx: 10, fill: '#ffffffd9', stroke: '#cfd5dc' }, pv);
    txt(pv, 12, 22, 'VISTA DE CIMA', { class: 'inset-t' });
    this.sectorTxt = [];
    const C = [98, 122];
    const names = ['Frente · vala', 'Direita', 'Trás', 'Esquerda'];
    const pos = [[98, 42], [182, 126], [98, 204], [14, 126]];
    names.forEach((n, i) => this.sectorTxt.push(txt(pv, pos[i][0], pos[i][1], n, { 'text-anchor': i === 1 ? 'end' : i === 3 ? 'start' : 'middle', class: 'inset-s' })));
    el('circle', { cx: C[0], cy: C[1], r: 62, fill: 'none', stroke: '#e3e7ec', 'stroke-dasharray': '3 4' }, pv);
    this.pvUnder = el('g', {}, pv);
    el('rect', { x: -26, y: -40, width: 14, height: 80, rx: 4, fill: '#3a3f47' }, this.pvUnder);
    el('rect', { x: 12, y: -40, width: 14, height: 80, rx: 4, fill: '#3a3f47' }, this.pvUnder);
    el('rect', { x: -12, y: -30, width: 24, height: 60, fill: '#6b7380' }, this.pvUnder);
    el('path', { d: 'M0 -46 L-5 -38 L5 -38 Z', fill: '#3a3f47' }, this.pvUnder);
    this.pvUpper = el('g', {}, pv);
    el('rect', { x: -24, y: -22, width: 48, height: 52, rx: 8, fill: MACHINE, stroke: INK, 'stroke-width': 1.5 }, this.pvUpper);
    el('rect', { x: -22, y: -18, width: 16, height: 20, rx: 2, fill: '#cfe2ee', stroke: INK }, this.pvUpper);
    el('rect', { x: -4, y: -56, width: 10, height: 38, fill: MACHINE, stroke: INK, 'stroke-width': 1.5 }, this.pvUpper);
    el('rect', { x: -7, y: -66, width: 16, height: 12, rx: 2, fill: MACHINE_D, stroke: INK, 'stroke-width': 1.2 }, this.pvUpper);
    this.pvC = C;
    this.pvAng = txt(pv, 184, 22, '0°', { 'text-anchor': 'end', class: 'inset-v' });

    // legenda de cores
    const lg = el('g', { transform: `translate(16 ${SCENE_H - 140})` }, g);
    this.insetLegend = lg;
    el('rect', { width: 300, height: 92, rx: 10, fill: '#ffffffd9', stroke: '#cfd5dc' }, lg);
    txt(lg, 12, 20, 'PRESSÃO DO ÓLEO', { class: 'inset-t' });
    const grad = el('linearGradient', { id: 'pgrad', x1: 0, x2: 1 }, this.svg.querySelector('defs'));
    for (let p = 0; p <= 350; p += 25) el('stop', { offset: p / 350, 'stop-color': pColor(p) }, grad);
    el('rect', { x: 12, y: 30, width: 276, height: 12, rx: 6, fill: 'url(#pgrad)' }, lg);
    [0, 100, 200, 300].forEach((p) => txt(lg, 12 + (p / 350) * 276, 56, p + (p === 0 ? '' : ''), { 'text-anchor': 'middle', class: 'inset-s' }));
    txt(lg, 288, 56, 'bar', { 'text-anchor': 'end', class: 'inset-s' });
    el('line', { x1: 14, y1: 76, x2: 40, y2: 76, stroke: pilotColor(39), 'stroke-width': 4, 'stroke-linecap': 'round' }, lg);
    txt(lg, 48, 80, 'piloto (comando)', { class: 'inset-s' });
    el('line', { x1: 168, y1: 76, x2: 194, y2: 76, stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round' }, lg);
    el('line', { x1: 168, y1: 76, x2: 194, y2: 76, stroke: pColor(150), 'stroke-width': 7, opacity: 0.5 }, lg);
    txt(lg, 202, 80, 'sentido do fluxo', { class: 'inset-s' });

    // detalhe do bloco de válvulas
    const vd = el('g', { transform: 'translate(1060 16)', class: 'comp', 'data-comp': 'valve' }, g);
    this.insetValve = vd;
    el('rect', { width: 324, height: 252, rx: 10, fill: '#ffffffe6', stroke: '#cfd5dc' }, vd);
    txt(vd, 12, 22, 'BLOCO DE VÁLVULAS (DETALHE)', { class: 'inset-t' });
    const names2 = { boom: 'Lança', arm: 'Braço', bucket: 'Caçamba', swing: 'Giro', travelL: 'Esteira E', travelR: 'Esteira D' };
    this.vd = [];
    VALVE_ORDER.forEach((id, i) => {
      const y = 44 + i * 30;
      txt(vd, 12, y + 5, names2[id], { class: 'inset-s' });
      const pilL = el('rect', { x: 84, y: y - 8, width: 14, height: 16, rx: 2, fill: '#ede9fe', stroke: '#a78bfa' }, vd);
      el('rect', { x: 100, y: y - 7, width: 132, height: 14, rx: 2, fill: '#59616d' }, vd);
      const portA = el('rect', { x: 128, y: y - 13, width: 10, height: 6, fill: '#ccc' }, vd);
      const portB = el('rect', { x: 196, y: y - 13, width: 10, height: 6, fill: '#ccc' }, vd);
      const spool = el('g', {}, vd);
      el('rect', { x: 0, y: -5, width: 76, height: 10, rx: 2, fill: '#eef1f4', stroke: INK }, spool);
      el('rect', { x: 22, y: -2.5, width: 10, height: 5, fill: '#9aa3ad' }, spool);
      el('rect', { x: 44, y: -2.5, width: 10, height: 5, fill: '#9aa3ad' }, spool);
      const pilR = el('rect', { x: 234, y: y - 8, width: 14, height: 16, rx: 2, fill: '#ede9fe', stroke: '#a78bfa' }, vd);
      const val = txt(vd, 312, y + 5, '', { 'text-anchor': 'end', class: 'inset-v' });
      this.vd.push({ id, y, spool, pilL, pilR, portA, portB, val });
    });
    txt(vd, 12, 236, 'Alívio', { class: 'inset-s' });
    this.vdRelief = [0, 1].map((k) => {
      const c = el('circle', { cx: 74 + k * 80, cy: 232, r: 7, stroke: INK }, vd);
      txt(vd, 86 + k * 80, 236, 'P' + (k + 1), { class: 'inset-s' });
      return c;
    });
    this.vdReliefSet = txt(vd, 312, 236, '', { 'text-anchor': 'end', class: 'inset-v' });

    // indicação do setor visto
    this.viewTxt = txt(g, 16, SCENE_H - 16, '', { class: 'view-t' });
  }

  setLayer(name, on) {
    this.layers[name] = on;
    const map = { hoses: [this.gHosesBody, this.gHosesBoom], pilot: [this.gPilot], labels: [this.gLabels], values: [this.gValues, this.gValuesPump], pumpValues: [this.gValuesPump] };
    for (const g of map[name]) g.setAttribute('visibility', on ? 'visible' : 'hidden');
  }
  all(sel) { return [...this.svg.querySelectorAll(sel), ...this.overlay.querySelectorAll(sel)]; }
  select(comp) {
    this.all('.sel').forEach((e) => e.classList.remove('sel'));
    if (comp) this.all(`[data-comp="${comp}"]`).forEach((e) => e.classList.add('sel'));
  }
  // Destaque: os componentes da lista ficam fortes e o resto esmaece (null = sem destaque)
  setFocus(list) {
    this.all('.focus').forEach((e) => e.classList.remove('focus'));
    const on = !!(list && list.length);
    this.svg.classList.toggle('dim', on);
    this.overlay.classList.toggle('dim', on);
    if (on) for (const c of list) this.all(`[data-comp="${c}"]`).forEach((e) => e.classList.add('focus'));
  }
  // Quais quadros auxiliares aparecem: 'plan', 'valve', 'legend' (null = todos)
  setInsets(list) {
    const show = (k) => !list || list.includes(k);
    this.insetPlan.setAttribute('visibility', show('plan') ? 'visible' : 'hidden');
    this.insetValve.setAttribute('visibility', show('valve') ? 'visible' : 'hidden');
    this.insetLegend.setAttribute('visibility', show('legend') ? 'visible' : 'hidden');
    this.viewTxt.setAttribute('visibility', !list ? 'visible' : 'hidden');
  }

  // ================= atualização por quadro =================
  update(st, dt) {
    this.mx = st.mx;
    const g = st.geo; this.geo = g;
    const P = (p) => this.P(p);
    const sector = sectorOf(st);

    // ---- terreno ----
    const terr = st.soil.terrain[sector];
    const pts = [];
    for (let i = 0; i < TERRAIN.n; i++) {
      const x = TERRAIN.x0 + i * TERRAIN.dx;
      pts.push([OX + x * S, OY - terr[i] * S]);
    }
    const top = pathD(pts);
    this.terrainLine.setAttribute('d', top);
    this.terrainTop.setAttribute('d', top);
    this.terrainFill.setAttribute('d', top + `L${pts[pts.length - 1][0]} ${SCENE_H + 600} L${pts[0][0]} ${SCENE_H + 600} Z`);

    // ---- chassi inferior (encurta conforme o giro) ----
    const a = st.swing.ang;
    const hl = 2.2 * Math.abs(Math.cos(a)) + 1.3 * Math.abs(Math.sin(a));
    const x0 = this.X(-hl), x1 = this.X(hl), y0 = this.Y(0.02), y1 = this.Y(0.9), r = 0.44 * S;
    const trackD = `M${x0 + r} ${y1} L${x1 - r} ${y1} A${r} ${r} 0 0 1 ${x1 - r} ${y0} L${x0 + r} ${y0} A${r} ${r} 0 0 1 ${x0 + r} ${y1} Z`;
    this.uTrack.setAttribute('d', trackD);
    this.uShoes.setAttribute('d', trackD);
    this.uShoes.setAttribute('stroke-dashoffset', (-st.trackPos[1] * S).toFixed(1));
    this.uFrame.setAttribute('d', `M${x0 + r * 0.9} ${this.Y(0.72)} L${x1 - r * 0.9} ${this.Y(0.72)} L${x1 - r * 1.2} ${this.Y(0.3)} L${x0 + r * 1.2} ${this.Y(0.3)} Z`);
    const showWheels = Math.abs(Math.cos(a)) > 0.45;
    const rearX = this.X(-hl + 0.44), frontX = this.X(hl - 0.44), wy = this.Y(0.46);
    for (const [c, x] of [[this.uSprocket, rearX], [this.uIdler, frontX]]) {
      c.setAttribute('cx', x); c.setAttribute('cy', wy); c.setAttribute('visibility', showWheels ? 'visible' : 'hidden');
    }
    this.uRollerC.forEach((c, i) => {
      const t = (i + 1) / 6;
      c.setAttribute('cx', x0 + r + (x1 - x0 - 2 * r) * t); c.setAttribute('cy', this.Y(0.14));
    });
    this.travelPos = [rearX, wy];
    const fL = st.f.travelL, fR = st.f.travelR;
    const tp = Math.max(fL.pA, fL.pB, fR.pA, fR.pB);
    this.uTravel.setAttribute('cx', rearX); this.uTravel.setAttribute('cy', wy); this.uTravel.setAttribute('fill', pColor(tp));
    const ta = st.trackPos[0] / 0.36;
    this.uTravelMark.setAttribute('x1', rearX); this.uTravelMark.setAttribute('y1', wy);
    this.uTravelMark.setAttribute('x2', rearX + Math.cos(-ta) * 0.17 * S); this.uTravelMark.setAttribute('y2', wy + Math.sin(-ta) * 0.17 * S);
    this.uBearing.setAttribute('x', this.X(-1.1)); this.uBearing.setAttribute('y', this.Y(1.08)); this.uBearing.setAttribute('width', 2.2 * S);
    this.uSwivel.setAttribute('x', this.X(-0.08)); this.uSwivel.setAttribute('y', this.Y(1.08));

    // ---- estrutura superior ----
    this.gUpper.setAttribute('transform', `translate(${this.X(0)} ${OY}) scale(${S} ${-S})`);
    const n = st.eng.rpm;
    this.flyAng = (this.flyAng || 0) + (n / 60) * 2 * Math.PI * dt * 0.08; // ainda giratório, mas legível
    this.flyMark.setAttribute('x2', -1.17 + Math.sin(this.flyAng) * 0.12);
    this.flyMark.setAttribute('y2', 1.65 + Math.cos(this.flyAng) * 0.12);
    st.pumps.forEach((pu, k) => {
      this.pumpBody[k].setAttribute('fill', pColor(pu.p));
      const frac = pu.qGeom > 1 ? pu.q / pu.qGeom : 0;
      const cx = k === 0 ? -1.0 : -0.78, cy = 1.65, ang = (frac * 22 * Math.PI) / 180;
      this.swash[k].setAttribute('x1', cx - Math.sin(ang) * 0.15); this.swash[k].setAttribute('y1', cy - Math.cos(ang) * 0.15);
      this.swash[k].setAttribute('x2', cx + Math.sin(ang) * 0.15); this.swash[k].setAttribute('y2', cy + Math.cos(ang) * 0.15);
    });
    this.pilotPumpBody.setAttribute('fill', pilotColor(st.pilot.supply));
    this.lockBody.setAttribute('fill', st.locked ? '#d62828' : '#22a06b');
    const lvl = Math.max(0.05, Math.min(1, (st.oil.tank - 70) / 100));
    const oilH = 0.78 * lvl;
    this.tankOil.setAttribute('height', oilH);
    const wy2 = 1.32 + oilH;
    this.tankWave.setAttribute('x1', -0.46); this.tankWave.setAttribute('x2', -0.08);
    this.tankWave.setAttribute('y1', wy2); this.tankWave.setAttribute('y2', wy2);
    this.cooler.setAttribute('fill', st.oil.T > 90 ? '#f08a5d' : st.oil.T > 70 ? '#f6c177' : '#9cc3e6');
    const sw = st.f.swing;
    this.swingBody.setAttribute('fill', pColor(Math.max(sw.pA, sw.pB)));
    VALVE_ORDER.forEach((id, i) => {
      const f = st.f[id];
      const shift = f.s * (f.dir || 0) * 0.1;
      this.spools[i].sp.setAttribute('x', 0.38 + shift);
      this.spools[i].sp.setAttribute('fill', f.s > 0.02 ? '#ffe9a8' : '#eef1f4');
      this.spools[i].pil.setAttribute('fill', pilotColor(f.pp));
    });
    st.pumps.forEach((pu, k) => this.reliefLamp[k].setAttribute('fill', pu.relief > 5 ? '#d62828' : '#e5e7eb'));
    this.joyMark.setAttribute('x2', 0.42 + (st.input.rightX + st.input.leftX) * 0.04);

    // ---- lança / braço / caçamba ----
    const B0 = P(g.B0), A0 = P(g.A0), K0 = P(g.K0);
    this.gBoom.setAttribute('transform', `translate(${B0[0]} ${B0[1]}) rotate(${-deg(g.tb)}) scale(${S} ${-S})`);
    this.gArm.setAttribute('transform', `translate(${A0[0]} ${A0[1]}) rotate(${-deg(g.ta)}) scale(${S} ${-S})`);
    this.gBucket.setAttribute('transform', `translate(${K0[0]} ${K0[1]}) rotate(${-deg(g.tk)}) scale(${S} ${-S})`);
    // terra na caçamba
    const fill = st.soil.load / BUCKET_CAP;
    if (fill > 0.01) {
      const k = Math.sqrt(Math.min(1, fill));
      const c = [0.75, 0.32];
      const poly = [[0.12, 0.38], [0.6, 0.6], [1.06, 0.52], [1.36, 0.36], [1.44, 0.06], [0.1, -0.12]];
      let d = poly.map((p, i) => (i ? 'L' : 'M') + (c[0] + (p[0] - c[0]) * k).toFixed(3) + ' ' + (c[1] + (p[1] - c[1]) * k).toFixed(3)).join(' ');
      if (fill > 0.8) d += ` Q${0.75} ${-0.12 - (fill - 0.8) * 1.2} ${(c[0] + (0.12 - c[0]) * k).toFixed(3)} ${(c[1] + (0.38 - c[1]) * k).toFixed(3)}`;
      this.soilFill.setAttribute('d', d + ' Z');
      this.soilFill.setAttribute('visibility', 'visible');
    } else this.soilFill.setAttribute('visibility', 'hidden');

    // ---- cilindros ----
    for (const id of ['boom', 'arm', 'bucket']) {
      const c = g.cyl[id], f = st.f[id];
      this.cyl[id].update(P(c.base), P(c.end), RANGES[id].Lmin, RANGES[id].stroke, f.pA, f.pB);
    }
    // elos da caçamba
    const Sx = P(g.S), Rx = P(g.R), Px = P(g.P);
    for (const [l, a1, b1] of [[this.links.side, Sx, Rx], [this.links.sideF, Sx, Rx], [this.links.bl, Rx, Px], [this.links.blF, Rx, Px]]) {
      l.setAttribute('x1', a1[0]); l.setAttribute('y1', a1[1]); l.setAttribute('x2', b1[0]); l.setAttribute('y2', b1[1]);
    }
    [Sx, Rx, Px].forEach((p, i) => { this.links.pins[i].setAttribute('cx', p[0]); this.links.pins[i].setAttribute('cy', p[1]); });

    this.updateHoses(st, dt);
    this.updateParticles(st, dt);
    this.updateLabels();
    this.updateValues(st);
    this.updateInsets(st, sector);
  }

  cylPorts(id) {
    const c = this.geo.cyl[id];
    const u = [(c.end[0] - c.base[0]) / c.L, (c.end[1] - c.base[1]) / c.L];
    let nrm = [-u[1], u[0]];
    if (nrm[1] < 0) nrm = [-nrm[0], -nrm[1]];
    const Lb = 0.25 + RANGES[id].stroke;
    const at = (d, o = 0) => [c.base[0] + u[0] * d + nrm[0] * o, c.base[1] + u[1] * d + nrm[1] * o];
    return { at, Lb };
  }

  updateHoses(st, dt) {
    const g = this.geo, P = (p) => this.P(p);
    const B = (x, y) => tf(g.B0, g.tb, [x, y]);
    const Ar = (x, y) => tf(g.A0, g.ta, [x, y]);
    const map = (arr) => arr.map(P);
    const pu = st.pumps;
    // sucção, pressão, retorno
    this.h.suction.update(map([[-0.4, 1.3], [-0.4, 1.22], [-0.89, 1.22], [-0.89, 1.45]]), 1, pu[0].q + pu[1].q, dt);
    this.h.p1.update(map([[-1.0, 1.85], [-1.0, 2.33], [0.3, 2.33], [0.3, 2.0]]), pu[0].p, pu[0].q, dt);
    this.h.p2.update(map([[-0.78, 1.85], [-0.78, 2.23], [0.4, 2.23], [0.4, 2.0]]), pu[1].p, pu[1].q, dt);
    const retP = 2 + st.oil.returnQ * 0.02;
    this.h.ret.update(map([[0.7, 1.2], [0.7, 1.12], [-2.035, 1.12], [-2.035, 1.2]]).concat([]), retP, st.oil.returnQ, dt);
    if (!this.h.ret2) this.h.ret2 = new Hose(this.gHosesBody, 8, 'return', 'hoseReturn');
    this.h.ret2.update(map([[-2.035, 1.8], [-2.035, 1.84], [-1.95, 1.84], [-1.95, 2.5], [-0.22, 2.5], [-0.22, 2.08]]), retP * 0.6, st.oil.returnQ, dt);
    // piloto
    const pl = st.pilot;
    const pilotFlow = pl.supply > 1 ? 8 : 0;
    this.h.pilotSup.update(map([[-0.62, 1.75], [-0.62, 2.42], [-0.02, 2.42]]), pl.supply, pilotFlow, dt);
    this.h.pilotOut.update(map([[0.11, 2.42], [0.42, 2.42], [0.42, 2.6]]), pl.out, pl.out > 1 ? 6 : 0, dt);
    VALVE_ORDER.forEach((id, i) => {
      const f = st.f[id];
      const x = 0.5 + i * 0.05;
      this.hp[i].update(map([[x, 2.6], [x, VALVE.y1 + 0.01]]), f.pp, f.s > 0.02 ? 5 : 0, dt);
    });
    // linhas de trabalho
    const portA = (i) => [VALVE.x1, secY(i) + 0.03];
    const portB = (i) => [VALVE.x1, secY(i) - 0.03];
    const flowA = (f) => (f.dir > 0 ? f.q : f.dir < 0 ? -f.qOut : 0) + (f.leak && f.pA > f.pB ? -f.leak : 0);
    const flowB = (f) => (f.dir < 0 ? f.q : f.dir > 0 ? -f.qOut : 0) + (f.leak && f.pB >= f.pA ? -f.leak : 0);
    const iB = VALVE_ORDER.indexOf('bucket'), iA = VALVE_ORDER.indexOf('arm'), iM = VALVE_ORDER.indexOf('boom');
    // caçamba
    {
      const f = st.f.bucket, cp = this.cylPorts('bucket');
      const A = [portA(iB), [0.84, portA(iB)[1]], [0.84, 2.18], B(0.4, 0.5), B(2.0, 0.92), B(4.2, 0.72), B(5.55, 0.42), Ar(-0.05, 0.62), cp.at(0.12, 0.0)];
      const Bp = [portB(iB), [0.87, portB(iB)[1]], [0.87, 2.14], B(0.45, 0.43), B(2.0, 0.85), B(4.2, 0.65), B(5.5, 0.36), Ar(-0.05, 0.54), cp.at(0.2, 0.1), cp.at(cp.Lb - 0.1, 0.1), cp.at(cp.Lb - 0.1, 0)];
      this.hw.bucket[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.bucket[1].update(map(Bp), f.pB, flowB(f), dt);
    }
    // braço
    {
      const f = st.f.arm, cp = this.cylPorts('arm');
      const A = [portA(iA), [0.92, portA(iA)[1]], [0.92, 2.1], B(0.5, 0.36), B(1.9, 0.76), cp.at(-0.05, 0.15), cp.at(0.12, 0)];
      const Bp = [portB(iA), [0.95, portB(iA)[1]], [0.95, 2.06], B(0.55, 0.3), B(1.9, 0.7), cp.at(0.2, 0.13), cp.at(cp.Lb - 0.1, 0.13), cp.at(cp.Lb - 0.1, 0)];
      this.hw.arm[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.arm[1].update(map(Bp), f.pB, flowB(f), dt);
      this.armHoseMid = P(B(1.2, 0.6));
    }
    // lança
    {
      const f = st.f.boom, cp = this.cylPorts('boom');
      const A = [portA(iM), [0.98, portA(iM)[1]], cp.at(0.12, 0.14), cp.at(0.12, 0)];
      const Bp = [portB(iM), [0.94, portB(iM)[1]], [0.94, 1.36], cp.at(0.35, 0.16), cp.at(cp.Lb - 0.1, 0.16), cp.at(cp.Lb - 0.1, 0)];
      this.hw.boom[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.boom[1].update(map(Bp), f.pB, flowB(f), dt);
    }
    // giro
    {
      const f = st.f.swing, i = VALVE_ORDER.indexOf('swing');
      this.hw.swing[0].update(map([[VALVE.x0, secY(i) + 0.03], [0.13, secY(i) + 0.03]]), f.pA, flowA(f), dt);
      this.hw.swing[1].update(map([[VALVE.x0, secY(i) - 0.03], [0.13, secY(i) - 0.03]]), f.pB, flowB(f), dt);
    }
    // translação: passa pela junta rotativa até o motor da esteira
    const rear = this.travelPos;
    const rearL = [(rear[0] - this.X(0)) / S, 0.46];
    ['travelL', 'travelR'].forEach((id, k) => {
      const f = st.f[id], i = VALVE_ORDER.indexOf(id);
      [0, 1].forEach((side) => {
        const o = (k * 2 + side) * 0.03 - 0.045;
        const y0 = secY(i) + (side ? -0.03 : 0.03);
        const pts = [[VALVE.x0, y0], [0.17 - (k * 2 + side) * 0.0, y0], [0.17, 1.12], [o, 1.12], [o, 0.62], [rearL[0] + 0.25, 0.62 - (k * 2 + side) * 0.0], [rearL[0] + 0.2, rearL[1] + 0.06]];
        this.hw[id][side].update(map(pts), side ? f.pB : f.pA, side ? flowB(f) : flowA(f), dt);
      });
    });
  }

  updateParticles(st, dt) {
    const parts = st.soil.particles;
    const sector = sectorOf(st);
    const need = parts.length;
    if (!this.pEls) this.pEls = [];
    while (this.pEls.length < need) this.pEls.push(el('circle', { fill: '#8a5f3a' }, this.gParticles));
    for (let i = 0; i < this.pEls.length; i++) {
      const e = this.pEls[i];
      if (i < need && parts[i].sector === sector) {
        const p = parts[i];
        e.setAttribute('cx', (OX + p.x * S).toFixed(1)); e.setAttribute('cy', (OY - p.y * S).toFixed(1));
        e.setAttribute('r', (p.r * S).toFixed(1)); e.setAttribute('visibility', 'visible');
      } else e.setAttribute('visibility', 'hidden');
    }
    // gotas do vazamento
    const leak = st.pumps[1].leak + st.f.arm.leak;
    if (leak > 0.5 && this.armHoseMid && Math.random() < Math.min(1, leak * dt * 2.5)) {
      this.drips.push({ x: this.armHoseMid[0], y: this.armHoseMid[1], vy: 0, e: el('circle', { r: 3.2, fill: '#2f6db3' }, this.gParticles) });
    }
    this.drips = this.drips.filter((d) => {
      d.vy += 900 * dt; d.y += d.vy * dt;
      const gy = OY - terrainAt(st.soil.terrain[sector], (d.x - OX) / S) * S;
      if (d.y > gy) { d.e.remove(); return false; }
      d.e.setAttribute('cx', d.x); d.e.setAttribute('cy', d.y);
      return true;
    });
  }

  updateLabels() {
    if (!this.layers.labels) return;
    for (const l of this.labels) {
      const a = l.anchorFn(), p = l.posFn();
      l.dot.setAttribute('cx', a[0]); l.dot.setAttribute('cy', a[1]);
      l.t.setAttribute('x', p[0]); l.t.setAttribute('y', p[1]);
      const ly = p[1] - 5;
      const lx = l.align === 'start' ? p[0] - 4 : l.align === 'end' ? p[0] + 4 : p[0];
      // rótulos abaixo do solo: linha desce na vertical e depois vai na horizontal
      if (p[1] > OY + 20) l.line.setAttribute('points', `${a[0]},${a[1]} ${a[0]},${ly} ${lx},${ly}`);
      else l.line.setAttribute('points', `${a[0]},${a[1]} ${lx},${ly}`);
    }
  }

  updateValues(st) {
    if (!this.layers.values) return;
    if (!this.valEls) {
      this.valEls = {};
      for (const id of ['boom', 'arm', 'bucket', 'p1', 'p2']) {
        const g = el('g', {}, id.startsWith('p') ? this.gValuesPump : this.gValues);
        const r = el('rect', { rx: 5, fill: '#1f2633', opacity: 0.88 }, g);
        const t = txt(g, 0, 0, '', { class: 'val-t' });
        this.valEls[id] = { g, r, t };
      }
    }
    const put = (id, x, y, s) => {
      const v = this.valEls[id];
      v.t.textContent = s;
      v.t.setAttribute('x', x + 7); v.t.setAttribute('y', y + 15);
      const w = s.length * 7.4 + 14;
      v.r.setAttribute('x', x); v.r.setAttribute('y', y); v.r.setAttribute('width', w); v.r.setAttribute('height', 22);
    };
    for (const id of ['boom', 'arm', 'bucket']) {
      const f = st.f[id];
      const m = this.midCyl(id);
      const off = { boom: [10, 10], arm: [30, -40], bucket: [18, 24] }[id];
      put(id, m[0] + off[0], m[1] + off[1], `A ${fmt(f.pA)} · B ${fmt(f.pB)} bar`);
    }
    const p1 = this.P([-1.05, 3.45]);
    put('p1', p1[0] - 150, p1[1] - 6, `P1 ${fmt(st.pumps[0].p)} bar · ${fmt(st.pumps[0].q)} L/min`);
    put('p2', p1[0] - 150, p1[1] + 20, `P2 ${fmt(st.pumps[1].p)} bar · ${fmt(st.pumps[1].q)} L/min`);
  }

  updateInsets(st, sector) {
    const C = this.pvC;
    this.pvUnder.setAttribute('transform', `translate(${C[0]} ${C[1]}) rotate(${deg(st.heading)})`);
    this.pvUpper.setAttribute('transform', `translate(${C[0]} ${C[1]}) rotate(${deg(st.heading + st.swing.ang)})`);
    this.sectorTxt.forEach((t, i) => t.setAttribute('class', i === sector ? 'inset-s on' : 'inset-s'));
    let ang = deg(st.swing.ang) % 360;
    if (ang > 180) ang -= 360; if (ang < -180) ang += 360;
    this.pvAng.textContent = `giro ${ang.toFixed(0)}°`;
    for (const r of this.vd) {
      const f = st.f[r.id];
      const shift = f.s * (f.dir || 0) * 28;
      r.spool.setAttribute('transform', `translate(${128 + shift} ${r.y})`);
      r.pilL.setAttribute('fill', f.dir > 0 ? pilotColor(f.pp) : '#ede9fe');
      r.pilR.setAttribute('fill', f.dir < 0 ? pilotColor(f.pp) : '#ede9fe');
      r.portA.setAttribute('fill', pColor(f.pA));
      r.portB.setAttribute('fill', pColor(f.pB));
      r.val.textContent = f.s > 0.02 ? `${fmt(f.q)} L/min` : '';
    }
    st.pumps.forEach((pu, k) => this.vdRelief[k].setAttribute('fill', pu.relief > 5 ? '#d62828' : '#e5e7eb'));
    this.vdReliefSet.textContent = `ajuste ${fmt(st.pumps[0].reliefSet || st.params.reliefBar)} bar`;
    const names = ['frente (vala)', 'direita', 'trás', 'esquerda'];
    this.viewTxt.textContent = `Vista lateral · braço apontado para: ${names[sector]}`;
  }
}

const PILOTC = '#ede9fe';
