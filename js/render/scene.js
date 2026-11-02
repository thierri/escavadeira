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
const VALVE = { x0: 0.18, x1: 0.82, y0: 1.18, y1: 2.06 };
const secY = (i) => VALVE.y1 - (i + 0.5) * ((VALVE.y1 - VALVE.y0) / 6);

// Carcaça ampliada: tudo que fica dentro dela (motor, bombas, tanque, válvulas)
// é desenhado em "coordenadas da carcaça" e ampliado por BODY.k a partir do
// ponto (ax, ay). Lança, braço, caçamba e esteiras ficam no tamanho real.
const BODY = { ax: -0.3, ay: 1.08, k: 1.25 };
const H = ([x, y]) => [BODY.ax + (x - BODY.ax) * BODY.k, BODY.ay + (y - BODY.ay) * BODY.k];
const HOUSE = { x0: H([-2.15, 0])[0], x1: H([1.45, 0])[0], top: H([0, 2.6])[1] };
const CAB_DY = HOUSE.top - 2.6;           // a cabine sobe junto com o teto
const PUMP_CX = [-0.965, -0.715];         // centro de P1 e P2 (coord. da carcaça)
const SHAFT_Y = 1.5;                      // eixo motor → bombas
const TANK = { x0: -0.46, x1: -0.08, y0: 1.32, strainer: [-0.39, 1.37], filterX: -0.255, filterY: 1.92 };
const STACK_TOP = [-1.4, 2.88];           // saída do escapamento (coord. da carcaça)

const NSS = { 'vector-effect': 'non-scaling-stroke' };
const INK = '#1f2633';
const STEEL = '#c9ced6';
const MACHINE = '#f3cf6c';
const MACHINE_D = '#d9a93a';

// mistura duas cores hex (t = 0 → a, t = 1 → b)
function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

// ---------- mangueira ----------
class Hose {
  constructor(parent, w, kind, comp) {
    this.w = w; this.kind = kind; this.off = 0;
    this.g = el('g', { class: 'comp hose', 'data-comp': comp }, parent);
    // contorno fino e suave, núcleo colorido pela pressão e tracinhos de fluxo
    this.o = el('path', { fill: 'none', stroke: INK, 'stroke-opacity': 0.55, 'stroke-width': w + 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.g);
    this.c = el('path', { fill: 'none', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.g);
    this.f = el('path', {
      fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.9, 'stroke-width': Math.max(0.9, w * 0.38),
      'stroke-linecap': 'round', 'stroke-dasharray': `${Math.max(1.5, w * 0.5)} ${w * 2.2 + 5}`,
    }, this.g);
  }
  update(pts, p, q, dt) {
    const d = roundedD(pts, 7);
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
    // o pé da lança fica translúcido sobre a carcaça, para não esconder o que está dentro
    const bm = el('mask', { id: 'boomGhost', maskUnits: 'userSpaceOnUse', x: -3000, y: -3000, width: 8000, height: 8000 }, defs);
    el('rect', { x: -3000, y: -3000, width: 8000, height: 8000, fill: '#fff' }, bm);
    this.boomHole = el('rect', { fill: '#6a6a6a' }, bm);
    // óleo do tanque: degradê vertical
    const og = el('linearGradient', { id: 'oilGrad', x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#5b95cc' }, og);
    el('stop', { offset: 1, 'stop-color': '#9cc6ea' }, og);

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
    this.gSmoke = el('g', { 'pointer-events': 'none' }, s);
    this.smoke = []; this.smokeAcc = 0;

    // mangueiras do corpo
    this.gHosesBody = el('g', {}, s);
    this.gPilot = el('g', {}, s);
    this.gCylBoom = el('g', {}, s);
    const boomWrap = el('g', { mask: 'url(#boomGhost)' }, s);
    this.gBoom = el('g', { class: 'comp', 'data-comp': 'boom' }, boomWrap);
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
    this.compGroups = {};
    // cabine (sobe junto com o teto da carcaça ampliada)
    const cab = this.compGroup(g, 'cab');
    cab.setAttribute('transform', `translate(0 ${CAB_DY})`);
    el('path', { ...NSS, d: 'M0.1 2.6 L0.2 3.32 L1.12 3.32 L1.42 2.6 Z', fill: '#e8eef3', stroke: INK, 'stroke-width': 1.5 }, cab);
    el('path', { ...NSS, d: 'M0.26 2.7 L0.32 3.22 L1.05 3.22 L1.28 2.7 Z', fill: '#cfe2ee', stroke: '#7d8a99', 'stroke-width': 1 }, cab);
    el('rect', { ...NSS, x: 0.62, y: 2.6, width: 0.28, height: 0.22, fill: '#59616d' }, cab); // banco
    this.joyMark = el('line', { ...NSS, x1: 0.42, y1: 2.6, x2: 0.42, y2: 2.88, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, cab);
    el('circle', { ...NSS, cx: 0.42, cy: 2.88, r: 0.04, fill: '#d62828' }, cab);
    // contrapeso (encostado na traseira da carcaça ampliada)
    const x0 = HOUSE.x0, top = HOUSE.top - 0.1;
    el('path', { ...NSS, d: `M${x0} 1.08 L${x0 - 0.46} 1.08 Q${x0 - 0.62} 1.08 ${x0 - 0.62} 1.3 L${x0 - 0.62} ${top - 0.22} Q${x0 - 0.62} ${top} ${x0 - 0.4} ${top} L${x0} ${top} Z`, fill: MACHINE_D, stroke: INK, 'stroke-width': 2 }, this.compGroup(g, 'counterweight'));

    // ---- tudo daqui para baixo é ampliado (coordenadas da carcaça) ----
    const b = el('g', { transform: `translate(${BODY.ax} ${BODY.ay}) scale(${BODY.k}) translate(${-BODY.ax} ${-BODY.ay})` }, g);
    this.gBody = b;
    // carcaça em corte
    const hs = this.compGroup(b, 'housing');
    el('rect', { ...NSS, x: -2.15, y: 1.08, width: 3.6, height: 1.52, fill: '#fbfaf6', stroke: INK, 'stroke-width': 2 }, hs);
    el('rect', { ...NSS, x: -2.15, y: 2.56, width: 3.6, height: 0.06, fill: MACHINE, stroke: INK, 'stroke-width': 1.5 }, hs);
    // radiadores
    const rad = this.compGroup(b, 'radiator');
    el('rect', { ...NSS, x: -2.1, y: 1.85, width: 0.13, height: 0.52, fill: '#b9c3cf', stroke: INK, 'stroke-width': 1 }, rad);
    this.cooler = el('rect', { ...NSS, x: -2.1, y: 1.2, width: 0.13, height: 0.6, stroke: INK, 'stroke-width': 1 }, rad);
    for (let y = 1.25; y < 2.35; y += 0.07) el('line', { ...NSS, x1: -2.1, y1: y, x2: -1.97, y2: y, stroke: '#7f8b99', 'stroke-width': 0.7 }, rad);

    // ---- motor diesel em corte: 4 cilindros, pistões, bielas e virabrequim ----
    const en = this.compGroup(b, 'engine');
    el('rect', { ...NSS, x: -1.97, y: 1.36, width: 0.05, height: 0.62, rx: 0.02, fill: '#9aa3ad', stroke: INK, 'stroke-width': 1 }, en); // ventilador
    el('rect', { ...NSS, x: -1.9, y: 1.3, width: 0.7, height: 0.34, rx: 0.05, fill: '#5b6574', stroke: INK, 'stroke-width': 1.5 }, en); // cárter
    el('rect', { ...NSS, x: -1.9, y: 1.64, width: 0.7, height: 0.35, fill: '#7b8696', stroke: INK, 'stroke-width': 1.5 }, en);          // bloco
    el('rect', { ...NSS, x: -1.92, y: 1.99, width: 0.74, height: 0.11, rx: 0.02, fill: '#59636f', stroke: INK, 'stroke-width': 1.5 }, en); // cabeçote
    el('rect', { ...NSS, x: -1.87, y: 2.1, width: 0.64, height: 0.05, rx: 0.02, fill: '#4a5262', stroke: INK, 'stroke-width': 1 }, en);   // tampa
    // coletor e escapamento (silencioso + chaminé)
    el('path', { ...NSS, d: 'M-1.80 2.04 L-1.80 2.2 L-1.47 2.2', fill: 'none', stroke: '#3d4450', 'stroke-width': 4, 'stroke-linejoin': 'round' }, en);
    el('rect', { ...NSS, x: -1.5, y: 2.17, width: 0.22, height: 0.15, rx: 0.05, fill: '#6b7380', stroke: INK, 'stroke-width': 1.2 }, en);
    el('rect', { ...NSS, x: -1.43, y: 2.32, width: 0.06, height: 0.56, fill: '#4a5262', stroke: INK, 'stroke-width': 1.2 }, en);
    el('rect', { ...NSS, x: -1.45, y: 2.86, width: 0.1, height: 0.025, fill: '#3d4450', stroke: INK, 'stroke-width': 1 }, en);
    this.stackGlow = el('rect', { ...NSS, x: -1.42, y: 2.33, width: 0.04, height: 0.53, fill: '#ff8a3d', opacity: 0 }, en);
    this.cyls = [];
    for (let i = 0; i < 4; i++) {
      const xc = -1.79 + i * 0.16;
      el('rect', { ...NSS, x: xc - 0.055, y: 1.66, width: 0.11, height: 0.32, fill: '#e3e7ec', stroke: '#3d4450', 'stroke-width': 0.8 }, en);
      const gas = el('rect', { ...NSS, x: xc - 0.054, width: 0.108, fill: '#e3e7ec' }, en);
      const rod = el('line', { ...NSS, stroke: '#3d4450', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, en);
      const piston = el('rect', { ...NSS, x: xc - 0.05, width: 0.1, height: 0.09, rx: 0.01, fill: '#aab3be', stroke: INK, 'stroke-width': 1 }, en);
      const pin = el('circle', { ...NSS, r: 0.016, fill: '#d9dee5', stroke: INK, 'stroke-width': 0.8 }, en);
      // válvulas de admissão/escape (dois tracinhos no cabeçote)
      el('line', { ...NSS, x1: xc - 0.025, y1: 1.99, x2: xc - 0.025, y2: 2.06, stroke: '#9aa3ad', 'stroke-width': 1.2 }, en);
      el('line', { ...NSS, x1: xc + 0.025, y1: 1.99, x2: xc + 0.025, y2: 2.06, stroke: '#9aa3ad', 'stroke-width': 1.2 }, en);
      this.cyls.push({ xc, gas, rod, piston, pin });
    }
    el('line', { ...NSS, x1: -1.9, y1: SHAFT_Y, x2: -1.2, y2: SHAFT_Y, stroke: '#3d4450', 'stroke-width': 2.5 }, en); // virabrequim
    this.flywheel = el('g', {}, en);
    el('circle', { ...NSS, cx: -1.22, cy: SHAFT_Y, r: 0.12, fill: '#8a939f', stroke: INK, 'stroke-width': 1.2 }, this.flywheel);
    this.flyMark = el('line', { ...NSS, x1: -1.22, y1: SHAFT_Y, x2: -1.22, y2: SHAFT_Y + 0.1, stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }, this.flywheel);

    // ---- bombas principais (pistões axiais, em corte) ----
    const pu = this.compGroup(b, 'pumps');
    el('line', { ...NSS, x1: -1.22, y1: SHAFT_Y, x2: -0.53, y2: SHAFT_Y, stroke: '#3d4450', 'stroke-width': 2.5 }, pu); // eixo
    this.pumpG = PUMP_CX.map((cx) => {
      el('rect', { ...NSS, x: cx - 0.115, y: 1.24, width: 0.23, height: 0.52, rx: 0.035, fill: '#8c95a1', stroke: INK, 'stroke-width': 1.2 }, pu);
      const inner = el('rect', { ...NSS, x: cx - 0.1, y: 1.28, width: 0.2, height: 0.44, rx: 0.02, stroke: '#4b5563', 'stroke-width': 0.6 }, pu);
      // tambor (gira com o eixo) e três pistões
      el('rect', { ...NSS, x: cx - 0.035, y: 1.32, width: 0.1, height: 0.36, rx: 0.015, fill: '#c3c9d1', stroke: '#4b5563', 'stroke-width': 0.8 }, pu);
      const pistons = [-0.11, 0, 0.11].map((dy) => el('rect', { ...NSS, y: SHAFT_Y + dy - 0.017, height: 0.034, rx: 0.008, fill: '#eef1f4', stroke: INK, 'stroke-width': 0.7 }, pu));
      const swash = el('line', { ...NSS, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, pu);
      const port = el('rect', { ...NSS, x: cx + 0.07, y: 1.3, width: 0.03, height: 0.4, rx: 0.01, stroke: INK, 'stroke-width': 0.8 }, pu);
      const outlet = el('rect', { ...NSS, x: cx - 0.03, y: 1.76, width: 0.06, height: 0.035, stroke: INK, 'stroke-width': 0.8 }, pu);
      return { cx, inner, pistons, swash, port, outlet };
    });
    const pp = this.compGroup(b, 'pilotPump');
    this.pilotPumpBody = el('rect', { ...NSS, x: -0.585, y: 1.42, width: 0.06, height: 0.16, rx: 0.015, stroke: INK, 'stroke-width': 1.2 }, pp);

    // ---- tanque de óleo (nível, onda, jato de retorno, bolhas e sucção) ----
    const tk = this.compGroup(b, 'tank');
    el('rect', { ...NSS, x: -0.48, y: 1.3, width: 0.42, height: 0.82, rx: 0.03, fill: '#f2f5f8', stroke: INK, 'stroke-width': 1.6 }, tk);
    this.tankOil = el('path', { ...NSS, fill: 'url(#oilGrad)' }, tk);
    this.tankWave = el('path', { ...NSS, fill: 'none', stroke: '#2f6fae', 'stroke-width': 1.4 }, tk);
    this.tankStream = el('line', { x1: TANK.filterX, x2: TANK.filterX, y1: TANK.filterY, stroke: '#3b82c4', 'stroke-linecap': 'round', 'stroke-dasharray': '0.035 0.014' }, tk);
    this.gBubbles = el('g', {}, tk);
    this.bubbles = []; this.bubbleAcc = 0; this.streamOff = 0;
    this.suctionDots = [];
    for (let j = 0; j < 7; j++) this.suctionDots.push(el('circle', { r: 0.008, fill: '#1e5f99' }, tk));
    for (const y of [1.55, 1.95]) el('line', { ...NSS, x1: -0.1, y1: y, x2: -0.07, y2: y, stroke: '#566170', 'stroke-width': 1 }, tk); // marcas mín./máx.
    el('rect', { ...NSS, x: TANK.filterX - 0.045, y: TANK.filterY, width: 0.09, height: 0.18, fill: '#ffffffcc', stroke: '#566170', 'stroke-width': 0.8, 'stroke-dasharray': '3 2' }, tk); // filtro de retorno
    el('rect', { ...NSS, x: -0.44, y: 1.32, width: 0.1, height: 0.1, fill: 'none', stroke: '#566170', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }, tk); // tela de sucção
    el('rect', { ...NSS, x: -0.42, y: 2.12, width: 0.08, height: 0.07, fill: '#566170', stroke: INK, 'stroke-width': 1 }, tk); // respiro

    // motor de giro (desabilitado neste simulador, mas a peça existe)
    const sw = this.compGroup(b, 'swingMotor');
    this.swingBody = el('rect', { ...NSS, x: -0.02, y: 1.16, width: 0.15, height: 0.46, rx: 0.03, stroke: INK, 'stroke-width': 1.4 }, sw);
    el('rect', { ...NSS, x: 0.015, y: 1.06, width: 0.08, height: 0.1, fill: '#7d8692', stroke: INK, 'stroke-width': 1 }, sw);
    // válvula de bloqueio do piloto
    const lk = this.compGroup(b, 'lockValve');
    this.lockBody = el('rect', { ...NSS, x: -0.02, y: 2.37, width: 0.13, height: 0.1, rx: 0.02, stroke: INK, 'stroke-width': 1.2 }, lk);

    // ---- bloco de válvulas: uma seção por função, traço fino ----
    const vb = this.compGroup(b, 'valve');
    el('rect', { ...NSS, x: VALVE.x0, y: VALVE.y0, width: VALVE.x1 - VALVE.x0, height: VALVE.y1 - VALVE.y0, rx: 0.03, fill: '#c3cad3', stroke: INK, 'stroke-width': 1.3 }, vb);
    this.spools = [];
    const hS = (VALVE.y1 - VALVE.y0) / 6;
    for (let i = 0; i < 6; i++) {
      const y = secY(i);
      if (i) el('line', { ...NSS, x1: VALVE.x0, y1: y + hS / 2, x2: VALVE.x1, y2: y + hS / 2, stroke: '#8a939e', 'stroke-width': 0.7 }, vb);
      el('rect', { ...NSS, x: VALVE.x0 + 0.07, y: y - 0.017, width: VALVE.x1 - VALVE.x0 - 0.14, height: 0.034, rx: 0.01, fill: '#6b7380' }, vb);
      const sp = el('rect', { ...NSS, x: 0.37, y: y - 0.013, width: 0.26, height: 0.026, rx: 0.008, stroke: INK, 'stroke-width': 0.7 }, vb);
      const pilL = el('rect', { ...NSS, x: VALVE.x0 + 0.012, y: y - 0.025, width: 0.045, height: 0.05, rx: 0.008, stroke: '#7c5cd6', 'stroke-width': 0.6 }, vb);
      const pilR = el('rect', { ...NSS, x: VALVE.x1 - 0.057, y: y - 0.025, width: 0.045, height: 0.05, rx: 0.008, stroke: '#7c5cd6', 'stroke-width': 0.6 }, vb);
      const pA = el('rect', { ...NSS, x: VALVE.x1 - 0.002, y: y + 0.02, width: 0.025, height: 0.022, stroke: INK, 'stroke-width': 0.5 }, vb);
      const pB = el('rect', { ...NSS, x: VALVE.x1 - 0.002, y: y - 0.042, width: 0.025, height: 0.022, stroke: INK, 'stroke-width': 0.5 }, vb);
      this.spools.push({ sp, pilL, pilR, pA, pB });
    }
    this.reliefLamp = [
      el('circle', { ...NSS, cx: 0.27, cy: VALVE.y0 - 0.045, r: 0.03, stroke: INK, 'stroke-width': 0.8 }, vb),
      el('circle', { ...NSS, cx: 0.36, cy: VALVE.y0 - 0.045, r: 0.03, stroke: INK, 'stroke-width': 0.8 }, vb),
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
      suction: new Hose(b, 5.5, 'suction', 'hoseSuction'),
      ret: new Hose(b, 4.5, 'return', 'hoseReturn'),
      ret2: new Hose(b, 4.5, 'return', 'hoseReturn'),
      p1: new Hose(b, 4.2, 'pressure', 'hosePump'),
      p2: new Hose(b, 4.2, 'pressure', 'hosePump'),
      pilotSup: new Hose(pl, 2.2, 'pilot', 'hosePilot'),
      pilotOut: new Hose(pl, 2.2, 'pilot', 'hosePilot'),
    };
    this.hp = VALVE_ORDER.map(() => new Hose(pl, 1.6, 'pilot', 'hosePilot'));
    // cada função tem seu próprio id (hoseWork-boom…), útil para destacar só aquelas mangueiras
    const mk = (parent, id, w = 3.4) => [new Hose(parent, w, 'work', 'hoseWork-' + id), new Hose(parent, w, 'work', 'hoseWork-' + id)];
    this.hw = {
      boom: mk(b, 'boom'), swing: mk(b, 'swing', 2.8),
      travelL: mk(b, 'travelL', 2.8), travelR: mk(b, 'travelR', 2.8),
      arm: mk(bb, 'arm'), bucket: mk(bb, 'bucket', 3),
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
    const UB = (x, y) => () => this.P(H([x, y]));   // ponto dentro da carcaça ampliada
    // nomes dos componentes internos ficam na "prateleira" sob a máquina
    const left = (row) => () => [this.X(-3.05), OY + 40 + row * 24];
    const right = (row) => () => [this.X(1.25), OY + 40 + row * 24];
    add('radiator', 'Radiadores (água e óleo)', UB(-2.04, 1.5), left(0), 'end');
    add('travelMotor', 'Motor de translação', () => this.travelPos || [0, 0], left(1), 'end');
    add('engine', 'Motor diesel', UB(-1.55, 1.34), left(2), 'end');
    add('pumps', 'Bombas principais P1 · P2', UB(-0.84, 1.28), left(3), 'end');
    add('valve', 'Bloco de válvulas', UB(0.5, 1.22), right(0), 'start');
    add('swingMotor', 'Motor de giro', UB(0.09, 1.25), right(1), 'start');
    add('swivel', 'Junta rotativa', U(-0.02, 0.7), right(2), 'start');
    add('tank', 'Tanque de óleo', UB(-0.15, 1.36), right(3), 'start');
    add('cab', 'Cabine e joysticks', U(0.72, 2.95 + CAB_DY), () => [this.X(1.45), this.Y(3.55 + CAB_DY)], 'start');
    // etiquetas P1 / P2 sobre as bombas
    this.pumpTags = PUMP_CX.map((cx, k) => {
      const t = txt(L, 0, 0, 'P' + (k + 1), { 'text-anchor': 'start', class: 'pump-tag' });
      return { t, at: [cx + 0.025, 1.8] };
    });
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
    el('line', { x1: 168, y1: 76, x2: 194, y2: 76, stroke: pColor(150), 'stroke-width': 4.5 }, lg);
    el('line', { x1: 168, y1: 76, x2: 194, y2: 76, stroke: '#fff', 'stroke-width': 1.6, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round' }, lg);
    txt(lg, 202, 80, 'sentido do fluxo', { class: 'inset-s' });

    // detalhe do bloco de válvulas (traço fino; carretel, pilotos e pórticos A/B)
    const VW = 344, ROW = 33;
    const vd = el('g', { transform: `translate(${SCENE_W - 16 - VW} 16)`, class: 'comp', 'data-comp': 'valve' }, g);
    this.insetValve = vd;
    el('rect', { width: VW, height: 50 + 6 * ROW + 34, rx: 10, fill: '#ffffffe6', stroke: '#cfd5dc' }, vd);
    txt(vd, 12, 22, 'BLOCO DE VÁLVULAS (DETALHE)', { class: 'inset-t' });
    txt(vd, 140, 38, 'A', { 'text-anchor': 'middle', class: 'inset-s' });
    txt(vd, 212, 38, 'B', { 'text-anchor': 'middle', class: 'inset-s' });
    const names2 = { boom: 'Lança', arm: 'Braço', bucket: 'Caçamba', swing: 'Giro (desat.)', travelL: 'Esteira E', travelR: 'Esteira D' };
    this.vd = [];
    VALVE_ORDER.forEach((id, i) => {
      const y = 56 + i * ROW;
      txt(vd, 12, y + 4, names2[id], { class: id === 'swing' ? 'inset-s off' : 'inset-s' });
      // corpo da seção e furo do carretel
      el('rect', { x: 92, y: y - 12, width: 168, height: 24, rx: 4, fill: '#eef0f3', stroke: '#b8c0ca', 'stroke-width': 0.8 }, vd);
      el('rect', { x: 108, y: y - 4.5, width: 136, height: 9, rx: 4.5, fill: '#6b7380' }, vd);
      // pórticos A e B (cor = pressão)
      const portA = el('rect', { x: 135, y: y - 12, width: 10, height: 7.5, rx: 1.5, stroke: '#4b5563', 'stroke-width': 0.6 }, vd);
      const portB = el('rect', { x: 207, y: y - 12, width: 10, height: 7.5, rx: 1.5, stroke: '#4b5563', 'stroke-width': 0.6 }, vd);
      // pilotos nas pontas
      const pilL = el('rect', { x: 94, y: y - 8, width: 11, height: 16, rx: 2.5, stroke: '#a78bfa', 'stroke-width': 0.8 }, vd);
      const pilR = el('rect', { x: 247, y: y - 8, width: 11, height: 16, rx: 2.5, stroke: '#a78bfa', 'stroke-width': 0.8 }, vd);
      // carretel deslizante
      const spool = el('g', {}, vd);
      el('rect', { x: 0, y: -3.5, width: 76, height: 7, rx: 3, fill: '#f8fafc', stroke: INK, 'stroke-width': 0.8 }, spool);
      el('rect', { x: 22, y: -1.8, width: 10, height: 3.6, rx: 1, fill: '#9aa3ad' }, spool);
      el('rect', { x: 44, y: -1.8, width: 10, height: 3.6, rx: 1, fill: '#9aa3ad' }, spool);
      const val = txt(vd, VW - 12, y + 4, '', { 'text-anchor': 'end', class: 'inset-v' });
      this.vd.push({ id, y, spool, pilL, pilR, portA, portB, val });
    });
    const yR = 50 + 6 * ROW + 16;
    txt(vd, 12, yR + 4, 'Alívio', { class: 'inset-s' });
    this.vdRelief = [0, 1].map((k) => {
      const c = el('circle', { cx: 74 + k * 70, cy: yR, r: 6, stroke: INK, 'stroke-width': 0.8 }, vd);
      txt(vd, 85 + k * 70, yR + 4, 'P' + (k + 1), { class: 'inset-s' });
      return c;
    });
    this.vdReliefSet = txt(vd, VW - 12, yR + 4, '', { 'text-anchor': 'end', class: 'inset-v' });

    // indicação do setor visto
    this.viewTxt = txt(g, 16, SCENE_H - 16, '', { class: 'view-t' });
  }

  // Zera os efeitos que dependem do histórico (fumaça, bolhas, gotas, fases das
  // animações), para que uma cena gravada sempre comece igual.
  resetFx() {
    for (const p of this.smoke) p.e.remove();
    for (const b of this.bubbles) b.e.remove();
    for (const d of this.drips) d.e.remove();
    this.smoke = []; this.bubbles = []; this.drips = [];
    this.smokeAcc = 0; this.bubbleAcc = 0; this.streamOff = 0; this.sucPh = 0; this.flyAng = 0;
    const hoses = [...Object.values(this.h), ...this.hp, ...Object.values(this.hw).flat()];
    for (const h of hoses) h.off = 0;
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
    // área da carcaça: o pé da lança fica translúcido aqui
    this.boomHole.setAttribute('x', this.X(HOUSE.x0)); this.boomHole.setAttribute('y', this.Y(HOUSE.top));
    this.boomHole.setAttribute('width', (HOUSE.x1 - HOUSE.x0) * S); this.boomHole.setAttribute('height', (HOUSE.top - 1.08) * S);
    const e = st.eng, n = e.rpm;
    // rotação desenhada mais lenta que a real, para dar para acompanhar
    this.flyAng = (this.flyAng || 0) + (n / 60) * 2 * Math.PI * dt * 0.08;
    this.flyMark.setAttribute('x2', -1.22 + Math.sin(this.flyAng) * 0.1);
    this.flyMark.setAttribute('y2', SHAFT_Y + Math.cos(this.flyAng) * 0.1);
    this.updateEngine(st);
    this.updatePumps(st);
    this.pilotPumpBody.setAttribute('fill', pilotColor(st.pilot.supply));
    this.lockBody.setAttribute('fill', st.locked ? '#d62828' : '#22a06b');
    this.updateTank(st, dt);
    this.cooler.setAttribute('fill', st.oil.T > 90 ? '#f08a5d' : st.oil.T > 70 ? '#f6c177' : '#9cc3e6');
    const sw = st.f.swing;
    this.swingBody.setAttribute('fill', pColor(Math.max(sw.pA, sw.pB)));
    VALVE_ORDER.forEach((id, i) => {
      const f = st.f[id], s = this.spools[i];
      const shift = f.s * (f.dir || 0) * 0.1;
      s.sp.setAttribute('x', 0.37 + shift);
      s.sp.setAttribute('fill', f.s > 0.02 ? '#ffe08a' : '#eef1f4');
      s.pilL.setAttribute('fill', f.dir > 0 ? pilotColor(f.pp) : '#ede9fe');
      s.pilR.setAttribute('fill', f.dir < 0 ? pilotColor(f.pp) : '#ede9fe');
      s.pA.setAttribute('fill', pColor(f.pA));
      s.pB.setAttribute('fill', pColor(f.pB));
    });
    st.pumps.forEach((pu, k) => this.reliefLamp[k].setAttribute('fill', pu.relief > 5 ? '#d62828' : '#e5e7eb'));
    this.joyMark.setAttribute('x2', 0.42 + (st.input.rightX + st.input.leftX) * 0.04);
    this.updateSmoke(st, dt);

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

  // Motor de 4 tempos, 4 cilindros (ordem de ignição 1-3-4-2).
  // Cada pistão segue o virabrequim; a câmara acende laranja na explosão.
  updateEngine(st) {
    const e = st.eng, P = st.params;
    const load = e.running ? Math.min(1, e.outKW / P.engineKW) : 0;
    const r = 0.07, L = 0.26;                       // meio curso e comprimento da biela
    const cyc = ((this.flyAng % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
    const offs = [0, 3 * Math.PI, Math.PI, 2 * Math.PI];
    this.cyls.forEach((c, i) => {
      const a = cyc - offs[i];
      const cx = c.xc + r * Math.sin(a), cy = SHAFT_Y + r * Math.cos(a);
      const pinY = cy + Math.sqrt(L * L - (r * Math.sin(a)) ** 2);
      c.piston.setAttribute('y', pinY - 0.03);
      c.rod.setAttribute('x1', cx); c.rod.setAttribute('y1', cy);
      c.rod.setAttribute('x2', c.xc); c.rod.setAttribute('y2', pinY);
      c.pin.setAttribute('cx', cx); c.pin.setAttribute('cy', cy);
      const topY = pinY + 0.06;
      c.gas.setAttribute('y', topY); c.gas.setAttribute('height', Math.max(0, 1.975 - topY));
      const ph = ((a % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
      const burn = e.running && ph < 0.9 * Math.PI ? (1 - ph / (0.9 * Math.PI)) * (0.45 + 0.55 * load) : 0;
      c.gas.setAttribute('fill', mix('#e3e7ec', '#ff8c2e', burn));
    });
    this.stackGlow.setAttribute('opacity', e.running ? (0.15 + 0.5 * load).toFixed(2) : 0);
  }

  // Bombas de pistões axiais: o ângulo da placa inclinada define o curso dos pistões (a vazão).
  updatePumps(st) {
    st.pumps.forEach((pu, k) => {
      const g = this.pumpG[k], cx = g.cx;
      const frac = pu.qGeom > 1 ? Math.min(1, pu.q / pu.qGeom) : 0;
      const col = pColor(pu.p);
      g.inner.setAttribute('fill', col); g.inner.setAttribute('fill-opacity', 0.28);
      g.port.setAttribute('fill', col); g.outlet.setAttribute('fill', col);
      const ang = (frac * 20 * Math.PI) / 180;
      const sx = cx - 0.075;
      g.swash.setAttribute('x1', sx - Math.sin(ang) * 0.19); g.swash.setAttribute('y1', SHAFT_Y - Math.cos(ang) * 0.19);
      g.swash.setAttribute('x2', sx + Math.sin(ang) * 0.19); g.swash.setAttribute('y2', SHAFT_Y + Math.cos(ang) * 0.19);
      g.pistons.forEach((p, j) => {
        const dy = (j - 1) * 0.11;
        // o pé do pistão encosta na placa: placa mais inclinada → pistão vai e vem mais
        const wob = Math.sin(this.flyAng * 1.5 + j * 2.09 + k);
        const left = sx + Math.tan(ang) * dy + 0.012 + Math.abs(Math.tan(ang)) * 0.06 * wob;
        p.setAttribute('x', left); p.setAttribute('width', Math.max(0.02, cx + 0.05 - left));
      });
    });
  }

  // Tanque: nível real, superfície ondulando, jato do filtro de retorno, bolhas e a sucção puxando óleo.
  updateTank(st, dt) {
    const t = st.t, retQ = st.oil.returnQ;
    const sucQ = st.pumps[0].q + st.pumps[1].q;
    const lvl = Math.max(0.05, Math.min(1, (st.oil.tank - 70) / 100));
    const surf = TANK.y0 + 0.78 * lvl;
    const fr = Math.min(1, retQ / 250);
    const A = 0.004 + 0.012 * fr + 0.004 * Math.min(1, sucQ / 400);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const x = TANK.x0 + ((TANK.x1 - TANK.x0) * i) / 16;
      const bump = 0.02 * fr * Math.exp(-(((x - TANK.filterX) / 0.05) ** 2)) * Math.sin(t * 13);
      pts.push([x, surf + A * Math.sin(x * 55 - t * 4.2) + bump]);
    }
    const top = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(4) + ' ' + p[1].toFixed(4)).join(' ');
    this.tankWave.setAttribute('d', top);
    this.tankOil.setAttribute('d', `${top} L${TANK.x1} ${TANK.y0} L${TANK.x0} ${TANK.y0} Z`);
    // jato de óleo caindo do filtro de retorno
    const submerged = surf >= TANK.filterY - 0.01;
    if (retQ > 2 && !submerged) {
      this.streamOff -= (0.6 + 1.4 * fr) * dt;
      this.tankStream.setAttribute('y2', surf);
      this.tankStream.setAttribute('stroke-width', ((1.2 + 4 * fr) / (S * BODY.k)).toFixed(4));
      this.tankStream.setAttribute('stroke-dashoffset', this.streamOff.toFixed(4));
      this.tankStream.setAttribute('visibility', 'visible');
    } else this.tankStream.setAttribute('visibility', 'hidden');
    // bolhas: nascem onde o óleo chega e sobem até a superfície
    this.bubbleAcc += dt * Math.min(25, retQ / 12);
    while (this.bubbleAcc > 1 && this.bubbles.length < 18) {
      this.bubbleAcc -= 1;
      const y0 = submerged ? TANK.filterY - 0.01 : surf - 0.03 - Math.random() * 0.06;
      const b = { x: TANK.filterX + (Math.random() - 0.5) * 0.05, y: Math.max(TANK.y0 + 0.02, y0), r: 0.006 + Math.random() * 0.008, ph: Math.random() * 6 };
      b.e = el('circle', { ...NSS, r: b.r, fill: '#e3f0fc', 'fill-opacity': 0.85, stroke: '#ffffff', 'stroke-width': 0.6 }, this.gBubbles);
      this.bubbles.push(b);
    }
    if (this.bubbleAcc > 1) this.bubbleAcc = 1;
    this.bubbles = this.bubbles.filter((b) => {
      b.y += 0.14 * dt; b.x += Math.sin(t * 7 + b.ph) * 0.03 * dt;
      if (b.y > surf - b.r) { b.e.remove(); return false; }
      b.e.setAttribute('cx', b.x.toFixed(4)); b.e.setAttribute('cy', b.y.toFixed(4));
      return true;
    });
    // sucção: pontinhos escorrendo em espiral para a tela de sucção
    this.sucPh = (this.sucPh || 0) + dt * Math.min(1.4, sucQ / 300);
    const [sx, sy] = TANK.strainer;
    this.suctionDots.forEach((d, j) => {
      const p = (this.sucPh + j / this.suctionDots.length) % 1;
      const rr = 0.15 * (1 - p), th = -0.2 + j * 0.27 + p * 1.6;
      const x = sx + rr * Math.cos(th) + 0.02, y = sy + rr * Math.sin(th) * 0.9;
      const ok = sucQ > 3 && y < surf - 0.01 && x < TANK.x1;
      d.setAttribute('cx', x.toFixed(4)); d.setAttribute('cy', y.toFixed(4));
      d.setAttribute('visibility', ok ? 'visible' : 'hidden');
      d.setAttribute('opacity', (0.3 + 0.7 * p).toFixed(2));
    });
  }

  // Fumaça do escapamento: mais rotação → mais fumaça e mais rápida; mais carga → mais escura.
  updateSmoke(st, dt) {
    const e = st.eng, P = st.params;
    const rpmF = Math.max(0, Math.min(1, (e.rpm - P.idleRpm) / (P.ratedRpm - P.idleRpm)));
    const load = e.running ? Math.min(1, e.outKW / P.engineKW) : 0;
    const cranking = !e.running && e.rpm > 80;
    const rate = e.running ? 5 + 26 * rpmF + 8 * load : cranking ? 9 : 0;   // baforadas por segundo
    const [ox, oy] = this.P(H(STACK_TOP));
    this.smokeAcc += rate * dt;
    while (this.smokeAcc > 1) {
      this.smokeAcc -= 1;
      if (this.smoke.length > 140) break;
      const dark = cranking ? 0.8 : Math.min(1, 0.15 + 0.85 * load);
      const p = {
        x: ox + (Math.random() - 0.5) * 3, y: oy,
        vx: -6 - Math.random() * 10, vy: -(38 + 85 * rpmF + Math.random() * 18),
        r: 2.5 + 2 * load, grow: 9 + 14 * rpmF, age: 0, life: 1.3 + 1.1 * rpmF + Math.random() * 0.4,
        a0: 0.22 + 0.33 * Math.max(rpmF, load) + (cranking ? 0.25 : 0),
      };
      p.e = el('circle', { fill: mix('#b9bec6', '#3f444c', dark) }, this.gSmoke);
      this.smoke.push(p);
    }
    if (this.smokeAcc > 1) this.smokeAcc = 1;
    this.smoke = this.smoke.filter((p) => {
      p.age += dt;
      if (p.age > p.life) { p.e.remove(); return false; }
      p.vy *= Math.exp(-dt * 0.9); p.vx -= 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt;
      const k = p.age / p.life;
      p.e.setAttribute('cx', p.x.toFixed(1)); p.e.setAttribute('cy', p.y.toFixed(1));
      p.e.setAttribute('r', p.r.toFixed(1));
      p.e.setAttribute('opacity', (p.a0 * Math.min(1, p.age * 8) * (1 - k)).toFixed(3));
      return true;
    });
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
    const mapH = (arr) => arr.map((p) => P(H(p)));   // pontos dentro da carcaça ampliada
    const pu = st.pumps;
    // sucção, pressão, retorno
    this.h.suction.update(mapH([[-0.4, 1.3], [-0.4, 1.19], [-0.84, 1.19], [-0.84, 1.24]]), 1, pu[0].q + pu[1].q, dt);
    this.h.p1.update(mapH([[PUMP_CX[0], 1.79], [PUMP_CX[0], 2.33], [0.3, 2.33], [0.3, VALVE.y1]]), pu[0].p, pu[0].q, dt);
    this.h.p2.update(mapH([[PUMP_CX[1], 1.79], [PUMP_CX[1], 2.23], [0.4, 2.23], [0.4, VALVE.y1]]), pu[1].p, pu[1].q, dt);
    const retP = 2 + st.oil.returnQ * 0.02;
    this.h.ret.update(mapH([[0.7, VALVE.y0], [0.7, 1.12], [-2.035, 1.12], [-2.035, 1.2]]), retP, st.oil.returnQ, dt);
    this.h.ret2.update(mapH([[-2.035, 1.8], [-2.035, 1.84], [-1.95, 1.84], [-1.95, 2.5], [TANK.filterX, 2.5], [TANK.filterX, TANK.filterY + 0.18]]), retP * 0.6, st.oil.returnQ, dt);
    // piloto
    const pl = st.pilot;
    const pilotFlow = pl.supply > 1 ? 8 : 0;
    const cabFloor = HOUSE.top;
    this.h.pilotSup.update(mapH([[-0.555, 1.58], [-0.555, 2.42], [-0.02, 2.42]]), pl.supply, pilotFlow, dt);
    const lockOut = H([0.11, 2.42]);
    this.h.pilotOut.update(map([lockOut, [0.42, lockOut[1]], [0.42, cabFloor]]), pl.out, pl.out > 1 ? 6 : 0, dt);
    VALVE_ORDER.forEach((id, i) => {
      const f = st.f[id];
      const x = 0.45 + i * 0.045;
      this.hp[i].update(mapH([[x, 2.6], [x, VALVE.y1 + 0.005]]), f.pp, f.s > 0.02 ? 5 : 0, dt);
    });
    // linhas de trabalho (saem dos pórticos A/B do bloco, na carcaça, e sobem pela lança)
    const portA = (i) => H([VALVE.x1 + 0.02, secY(i) + 0.031]);
    const portB = (i) => H([VALVE.x1 + 0.02, secY(i) - 0.031]);
    const flowA = (f) => (f.dir > 0 ? f.q : f.dir < 0 ? -f.qOut : 0) + (f.leak && f.pA > f.pB ? -f.leak : 0);
    const flowB = (f) => (f.dir < 0 ? f.q : f.dir > 0 ? -f.qOut : 0) + (f.leak && f.pB >= f.pA ? -f.leak : 0);
    const iB = VALVE_ORDER.indexOf('bucket'), iA = VALVE_ORDER.indexOf('arm'), iM = VALVE_ORDER.indexOf('boom');
    const col = (x, i, a) => H([x, secY(i) + (a ? 0.031 : -0.031)]);
    // caçamba
    {
      const f = st.f.bucket, cp = this.cylPorts('bucket');
      const A = [portA(iB), col(0.88, iB, 1), H([0.88, 2.18]), B(0.4, 0.5), B(2.0, 0.92), B(4.2, 0.72), B(5.55, 0.42), Ar(-0.05, 0.62), cp.at(0.12, 0.0)];
      const Bp = [portB(iB), col(0.91, iB, 0), H([0.91, 2.14]), B(0.45, 0.43), B(2.0, 0.85), B(4.2, 0.65), B(5.5, 0.36), Ar(-0.05, 0.54), cp.at(0.2, 0.1), cp.at(cp.Lb - 0.1, 0.1), cp.at(cp.Lb - 0.1, 0)];
      this.hw.bucket[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.bucket[1].update(map(Bp), f.pB, flowB(f), dt);
    }
    // braço
    {
      const f = st.f.arm, cp = this.cylPorts('arm');
      const A = [portA(iA), col(0.95, iA, 1), H([0.95, 2.1]), B(0.5, 0.36), B(1.9, 0.76), cp.at(-0.05, 0.15), cp.at(0.12, 0)];
      const Bp = [portB(iA), col(0.98, iA, 0), H([0.98, 2.06]), B(0.55, 0.3), B(1.9, 0.7), cp.at(0.2, 0.13), cp.at(cp.Lb - 0.1, 0.13), cp.at(cp.Lb - 0.1, 0)];
      this.hw.arm[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.arm[1].update(map(Bp), f.pB, flowB(f), dt);
      this.armHoseMid = P(B(1.2, 0.6));
    }
    // lança
    {
      const f = st.f.boom, cp = this.cylPorts('boom');
      const A = [portA(iM), col(1.02, iM, 1), cp.at(0.12, 0.14), cp.at(0.12, 0)];
      const Bp = [portB(iM), col(0.97, iM, 0), H([0.97, 1.3]), cp.at(0.35, 0.16), cp.at(cp.Lb - 0.1, 0.16), cp.at(cp.Lb - 0.1, 0)];
      this.hw.boom[0].update(map(A), f.pA, flowA(f), dt);
      this.hw.boom[1].update(map(Bp), f.pB, flowB(f), dt);
    }
    // giro
    {
      const f = st.f.swing, i = VALVE_ORDER.indexOf('swing');
      this.hw.swing[0].update(mapH([[VALVE.x0, secY(i) + 0.03], [0.13, secY(i) + 0.03]]), f.pA, flowA(f), dt);
      this.hw.swing[1].update(mapH([[VALVE.x0, secY(i) - 0.03], [0.13, secY(i) - 0.03]]), f.pB, flowB(f), dt);
    }
    // translação: desce pela junta rotativa (fora da carcaça) até o motor da esteira
    const rear = this.travelPos;
    const rearL = [(rear[0] - this.X(0)) / S, 0.46];
    ['travelL', 'travelR'].forEach((id, k) => {
      const f = st.f[id], i = VALVE_ORDER.indexOf(id);
      [0, 1].forEach((side) => {
        const o = (k * 2 + side) * 0.03 - 0.045;
        const y0 = secY(i) + (side ? -0.03 : 0.03);
        const low = H([o, 1.12]);
        const pts = [H([VALVE.x0, y0]), H([0.155, y0]), H([0.155, 1.12]), low, [low[0], 0.62], [rearL[0] + 0.25, 0.62], [rearL[0] + 0.2, rearL[1] + 0.06]];
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
    for (const pt of this.pumpTags) {
      const q = this.P(H(pt.at));
      pt.t.setAttribute('x', q[0].toFixed(1)); pt.t.setAttribute('y', q[1].toFixed(1));
    }
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
    const p1 = this.P([HOUSE.x0 - 0.7, 2.75]);
    put('p1', p1[0] - 178, p1[1] - 6, `P1 ${fmt(st.pumps[0].p)} bar · ${fmt(st.pumps[0].q)} L/min`);
    put('p2', p1[0] - 178, p1[1] + 20, `P2 ${fmt(st.pumps[1].p)} bar · ${fmt(st.pumps[1].q)} L/min`);
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
      r.spool.setAttribute('transform', `translate(${138 + shift} ${r.y})`);
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
