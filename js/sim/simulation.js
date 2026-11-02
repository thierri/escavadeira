// Motor de simulação: motor diesel → bombas → válvulas → atuadores → carga.
// Unidades: pressão em bar, vazão em L/min, potência em kW, geometria em metros.
// Modelo quase-estático: a cada passo a pressão de cada bomba é a que equilibra
// "vazão que a bomba entrega" = "vazão que os consumidores aceitam" (bissecção).

import { solve, dLdTheta, LIMITS, rad, tf, cylinderRanges } from './kinematics.js';
import { MATERIALS, MODES } from '../config.js';

const GRAV = 9.81;
export const RANGES = cylinderRanges();
export const TERRAIN = { x0: -8, dx: 0.1, n: 320 };
export const BUCKET_CAP = 1.0;   // m³ (coroada)
const BUCKET_W = 1.2;            // largura da caçamba (m)

export const FUNCS = [
  { id: 'boom', nome: 'Lança', pump: 0, kind: 'cyl', count: 2 },
  { id: 'arm', nome: 'Braço', pump: 1, kind: 'cyl', count: 1 },
  { id: 'bucket', nome: 'Caçamba', pump: 0, kind: 'cyl', count: 1 },
  { id: 'swing', nome: 'Giro', pump: 1, kind: 'swing' },
  { id: 'travelL', nome: 'Transl. esq.', pump: 1, kind: 'travel' },
  { id: 'travelR', nome: 'Transl. dir.', pump: 0, kind: 'travel' },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function cylAreas(P, id) {
  const bore = P[id + 'Bore'] / 1000, rod = P[id + 'Rod'] / 1000;
  const cap = (Math.PI / 4) * bore * bore;
  return { cap, ann: cap - (Math.PI / 4) * rod * rod };
}

function makeTerrain(kind) {
  const a = new Float32Array(TERRAIN.n);
  for (let i = 0; i < TERRAIN.n; i++) {
    const x = TERRAIN.x0 + i * TERRAIN.dx;
    let h = 0;
    if (kind === 'front') h = x > 9 ? Math.min(0.6, (x - 9) * 0.25) : 0;
    a[i] = h;
  }
  return a;
}
export function terrainAt(arr, x) {
  const f = (x - TERRAIN.x0) / TERRAIN.dx;
  const i = Math.floor(f);
  if (i < 0) return arr[0];
  if (i >= TERRAIN.n - 1) return arr[TERRAIN.n - 1];
  const t = f - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

export function createState(params) {
  const st = {
    t: 0,
    params,
    key: 0, throttle: 7, mode: 'S', locked: false, boost: false, autoIdle: true,
    input: { leftX: 0, leftY: 0, rightX: 0, rightY: 0, travelL: 0, travelR: 0 },
    eng: { running: false, rpm: 0, target: 0, integ: 0, torque: 0, loadKW: 0, outKW: 0,
      availKW: 0, coolant: params.ambientC, fuelLh: 0, stalled: false, idleTimer: 0, autoIdling: false },
    pilot: { supply: 0, out: 0 },
    pumps: [0, 1].map(() => ({ p: 0, q: 0, qCmd: 0, qGeom: 0, relief: 0, oc: 0, kw: 0, plim: 0, cav: false })),
    f: {},
    j: { boom: rad(16), arm: rad(-104), bucket: rad(-67) },
    swing: { ang: 0, w: 0 },
    heading: 0, mx: 0, trackPos: [0, 0], trackV: [0, 0],
    oil: { T: params.ambientC, tank: 0, leaked: 0, returnQ: 0, heatKW: 0, coolKW: 0 },
    soil: { load: 0, terrain: [makeTerrain('front'), makeTerrain('side'), makeTerrain('back'), makeTerrain('side')], particles: [] },
    tip: { x: 0, y: 0, vx: 0, vy: 0, depth: 0, digF: 0 },
    alerts: {},
    geo: null,
  };
  for (const fn of FUNCS) {
    st.f[fn.id] = { u: 0, dir: 0, s: 0, pp: 0, q: 0, pL: 0, pA: 0, pB: 0, v: 0, blocked: false, F: 0, qOut: 0, leak: 0 };
  }
  st.geo = solve(st.j);
  st.oil.tank = 165 - cylinderOil(st);
  st.oil.tank0 = 165;
  return st;
}

function cylinderOil(st) {
  // litros de óleo dentro dos cilindros (câmara do fundo + câmara da haste)
  let v = 0;
  for (const fn of FUNCS) {
    if (fn.kind !== 'cyl') continue;
    const A = cylAreas(st.params, fn.id);
    const x = st.geo.cyl[fn.id].L - RANGES[fn.id].Lmin;
    v += fn.count * (A.cap * x + A.ann * (RANGES[fn.id].stroke - x)) * 1000;
  }
  return v;
}

export function sectorOf(st) {
  let a = st.heading + st.swing.ang;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4; // 0 frente, 1 direita, 2 trás, 3 esquerda
}

function engineTorqueMax(P, n) {
  const w = (2 * Math.PI * P.ratedRpm) / 60;
  const Tr = (P.engineKW * 1000) / w;
  const Tpk = 1.2 * Tr, n0 = 0.7 * P.ratedRpm;
  const k = (Tpk - Tr) / Math.pow(P.ratedRpm - n0, 2);
  let T = Math.max(0.6 * Tr, Tpk - k * (n - n0) * (n - n0));
  if (n > 1.08 * P.ratedRpm) T *= clamp(1 - (n - 1.08 * P.ratedRpm) / (0.08 * P.ratedRpm), 0, 1);
  return T;
}

export function step(st, dt) {
  const P = st.params;
  const mode = MODES[st.mode];
  const mat = MATERIALS[P.material];
  const e = st.eng;
  st.t += dt;

  // ---------- 1. Comandos (padrão ISO) ----------
  const inp = st.input;
  const cmd = {
    // giro desabilitado (vista 2D); esteiras sempre juntas, só frente/trás
    boom: -inp.rightY, bucket: -inp.rightX, arm: -inp.leftY, swing: 0,
    travelL: inp.travelL, travelR: inp.travelL,
  };
  const anyInput = Object.values(cmd).some((v) => Math.abs(v) > 0.05);
  e.idleTimer = anyInput ? 0 : e.idleTimer + dt;

  // ---------- 2. Motor diesel ----------
  const n = e.rpm;
  const omega = Math.max((n * 2 * Math.PI) / 60, 1e-3);
  const Tmax = engineTorqueMax(P, n);
  e.availKW = (Tmax * omega) / 1000;
  let target = 0;
  if (st.key >= 1 && e.running) {
    target = P.idleRpm + ((st.throttle - 1) / 9) * (P.ratedRpm * mode.rpm - P.idleRpm);
    e.autoIdling = st.autoIdle && e.idleTimer > 4 && target > 1050;
    if (e.autoIdling) target = 1050;
  }
  if (st.key === 0) e.running = false;
  e.target = target;
  let Tcmd = 0;
  if (e.running) {
    const err = target - n;
    e.integ = clamp(e.integ + err * 4 * dt, -200, Tmax);
    Tcmd = clamp(err * 2.5 + e.integ, 0, Tmax);
  } else e.integ = 0;
  let Tstart = 0;
  if (st.key === 2 && !e.running) {
    Tstart = n < 320 ? 260 : 0;
    if (n > 280) { e.running = true; e.stalled = false; e.integ = 250; }
  }
  // carga das bombas (da iteração anterior)
  const pumpKW = st.pumps[0].kw + st.pumps[1].kw;
  const Tload = (pumpKW * 1000) / 0.88 / omega + 25 + n * 0.02; // bombas + atrito
  e.torque = Tcmd;
  e.outKW = (Tcmd * omega) / 1000;
  e.loadKW = pumpKW;
  const J = 3.2;
  e.rpm = Math.max(0, n + ((Tcmd + Tstart - Tload) / J) * (60 / (2 * Math.PI)) * dt);
  if (e.running && e.rpm < 230) { e.running = false; e.stalled = true; }
  e.fuelLh = e.running ? 1.4 + (e.outKW * 0.215) / 0.835 : 0;
  const coolTarget = e.running ? 78 + 12 * clamp(e.outKW / P.engineKW, 0, 1) : P.ambientC;
  e.coolant += (coolTarget - e.coolant) * dt / (e.running ? 40 : 120);

  // ---------- 3. Circuito piloto ----------
  const pl = st.pilot;
  if (e.rpm > 200) pl.supply = Math.min(P.pilotBar, (P.pilotBar * e.rpm) / 650);
  else pl.supply *= Math.exp(-dt / 2.5); // acumulador descarrega
  pl.out = st.locked ? 0 : pl.supply;

  // ---------- 4. Carretéis ----------
  for (const fn of FUNCS) {
    const f = st.f[fn.id];
    f.u = cmd[fn.id];
    f.pp = Math.abs(f.u) * pl.out;
    const sTarget = clamp((f.pp - 5) / 23, 0, 1);
    f.s += (sTarget - f.s) * Math.min(1, dt / 0.06);
    if (f.s < 0.002) f.s = 0;
    if (Math.abs(f.u) > 0.02) f.dir = sgn(f.u);
    else if (f.s === 0) f.dir = 0;
  }

  // ---------- 5. Estática: cargas nos cilindros ----------
  const g = st.geo;
  const dl = dLdTheta(st.j);
  const soilMass = st.soil.load * mat.dens;
  const boomC = tf(g.B0, g.tb, [2.8, 0.35]);
  const armC = tf(g.A0, g.ta, [1.1, 0.1]);
  const bkC = tf(g.K0, g.tk, [0.75, 0.35]);
  const soilC = tf(g.K0, g.tk, [0.8, 0.3]);
  const masses = [[boomC, 1800, 'boom'], [armC, 950, 'arm'], [bkC, 700, 'bucket'], [soilC, soilMass, 'bucket']];
  const joints = { boom: g.B0, arm: g.A0, bucket: g.K0 };
  const order = { boom: 0, arm: 1, bucket: 2 };
  const tau = { boom: 0, arm: 0, bucket: 0 };
  for (const jn of ['boom', 'arm', 'bucket']) {
    for (const [c, m, owner] of masses) {
      if (order[owner] < order[jn]) continue;
      tau[jn] += -(c[0] - joints[jn][0]) * m * GRAV;
    }
  }
  // Resistência do solo na ponta da caçamba
  const sector = sectorOf(st);
  const terr = st.soil.terrain[sector];
  const tipW = [st.mx + g.tip[0], g.tip[1]];
  const ground = terrainAt(terr, tipW[0]);
  const depth = ground - tipW[1];
  st.tip.depth = depth;
  let digF = 0;
  if (depth > 0) {
    // direção pretendida do movimento da ponta (pelos carretéis abertos)
    let vx = 0, vy = 0;
    for (const jn of ['boom', 'arm', 'bucket']) {
      const f = st.f[jn];
      if (f.s <= 0 || !f.dir) continue;
      const dth = f.dir * sgn(dl[jn]) * f.s;
      const r = [g.tip[0] - joints[jn][0], g.tip[1] - joints[jn][1]];
      vx += -r[1] * dth; vy += r[0] * dth;
    }
    const m = Math.hypot(vx, vy);
    if (m > 1e-3) {
      // corte "de frente" (na direção dos dentes) é o que mais resiste;
      // puxar para cima, para fora do solo, resiste pouco.
      const tdir = [g.tip[0] - g.K0[0], g.tip[1] - g.K0[1]];
      const tl = Math.hypot(tdir[0], tdir[1]);
      const along = (vx * tdir[0] + vy * tdir[1]) / (m * tl);
      const up = vy / m;
      const full = st.soil.load >= BUCKET_CAP * 0.97 ? 1.3 : 1;
      const dirF = up > 0.5 ? 0.25 : 0.35 + 0.65 * Math.max(0, along);
      digF = mat.res * clamp(depth / 0.35, 0.15, 1) * full * dirF;
      const Fx = (-vx / m) * digF, Fy = (-vy / m) * digF;
      for (const jn of ['boom', 'arm', 'bucket']) {
        const r = [g.tip[0] - joints[jn][0], g.tip[1] - joints[jn][1]];
        tau[jn] += r[0] * Fy - r[1] * Fx;
      }
    }
  }
  st.tip.digF = digF;

  const Qrated = (P.pumpCc * P.ratedRpm) / 1000;
  const reliefSet = P.faults.reliefStuck ? 120 : st.boost ? P.boostBar : P.reliefBar;

  for (const fn of FUNCS) {
    const f = st.f[fn.id];
    f.blocked = false;
    if (fn.kind === 'cyl') {
      const A = cylAreas(P, fn.id);
      const Fper = -tau[fn.id] / dl[fn.id] / fn.count;
      f.F = Fper;
      f.holdA = Math.max(0, Fper) / A.cap / 1e5;   // câmara do fundo (A)
      f.holdB = Math.max(0, -Fper) / A.ann / 1e5;  // câmara da haste (B)
      f.pL = Math.max(8, f.dir > 0 ? f.holdA : f.holdB);
      const [lo, hi] = LIMITS[fn.id].map(rad);
      const dthSign = f.dir * sgn(dl[fn.id]);
      const th = st.j[fn.id];
      if ((th >= hi - 1e-4 && dthSign > 0) || (th <= lo + 1e-4 && dthSign < 0)) f.blocked = true;
    } else if (fn.kind === 'swing') {
      const wmax = 1.15;
      const lag = clamp((f.s * wmax - Math.abs(st.swing.w) * (sgn(st.swing.w) === f.dir ? 1 : -1)) / wmax, 0, 1);
      f.pL = 35 + 240 * lag;
    } else {
      const other = st.f[fn.id === 'travelL' ? 'travelR' : 'travelL'];
      const turning = other.s < 0.1 ? 1 : other.dir !== f.dir ? 2 : 0;
      f.pL = [75, 165, 235][turning];
    }
  }

  // ---------- 6. Bombas e equilíbrio de pressão ----------
  const lug = clamp(1 - (e.target - 80 - e.rpm) / 400, 0.15, 1);
  const Ptot = mode.power * Math.min(P.engineKW, e.availKW) * lug * (st.boost ? 1.0 : 1);
  const Koc = Qrated / Math.sqrt(18);
  const Kf = Qrated / Math.sqrt(10);
  for (let j = 0; j < 2; j++) {
    const pu = st.pumps[j];
    const fns = FUNCS.filter((fn) => fn.pump === j);
    const ev = P.faults.pumpWorn ? 0.72 : 0.95;
    let qGeom = (P.pumpCc * e.rpm) / 1000 * ev;
    const suction = P.faults.suctionClog ? 85 : Infinity;
    let smax = 0, demand = 0;
    for (const fn of fns) { const f = st.f[fn.id]; smax = Math.max(smax, f.s); demand += f.s; }
    const qCmd = Math.min(qGeom, qGeom * (0.12 + demand));
    pu.cav = qCmd > suction && e.rpm > 300;
    pu.qGeom = qGeom;
    pu.qCmd = Math.min(qCmd, suction);
    const otherKW = st.pumps[1 - j].kw;
    pu.plim = Math.max(1, 0.5 * Ptot + Math.max(0, 0.5 * Ptot - otherKW));
    const leakOn = j === 1 && P.faults.hoseLeak && st.f.arm.s > 0;
    const flows = (p) => {
      let q = 0;
      for (const fn of fns) {
        const f = st.f[fn.id];
        if (f.s <= 0 || f.blocked) continue;
        q += Kf * f.s * Math.sqrt(Math.max(0, p - f.pL));
      }
      q += Koc * Math.pow(1 - smax, 2) * Math.sqrt(Math.max(0, p));
      if (p > reliefSet - 8) q += 30 * (p - (reliefSet - 8));
      if (leakOn) q += 3.2 * Math.sqrt(Math.max(0, p));
      return q;
    };
    const qPump = (p) => Math.min(pu.qCmd, (pu.plim * 600) / Math.max(p, 1));
    let p = 0;
    if (pu.qCmd > 0.5) {
      let lo = 0, hi = 700;
      for (let it = 0; it < 48; it++) {
        const mid = (lo + hi) / 2;
        if (flows(mid) > qPump(mid)) hi = mid; else lo = mid;
      }
      p = (lo + hi) / 2;
    }
    pu.p = p;
    pu.q = pu.qCmd > 0.5 ? qPump(p) : 0;
    pu.kw = (p * pu.q) / 600;
    pu.oc = Koc * Math.pow(1 - smax, 2) * Math.sqrt(p);
    pu.relief = p > reliefSet - 8 ? 30 * (p - (reliefSet - 8)) : 0;
    pu.leak = leakOn ? 3.2 * Math.sqrt(p) : 0;
    pu.reliefSet = reliefSet;
    for (const fn of fns) {
      const f = st.f[fn.id];
      f.q = f.s > 0 && !f.blocked ? Kf * f.s * Math.sqrt(Math.max(0, p - f.pL)) : 0;
      f.pIn = f.s > 0 ? Math.max(f.pL, p - (f.q > 0 ? Math.pow(f.q / (Kf * f.s), 2) : 0)) : 0;
      if (f.blocked && f.s > 0) f.pIn = p;
    }
  }

  // ---------- 7. Movimento dos atuadores ----------
  let returnQ = 0;
  for (const fn of FUNCS) {
    const f = st.f[fn.id];
    if (fn.kind === 'cyl') {
      const A = cylAreas(P, fn.id);
      const Ain = f.dir > 0 ? A.cap : A.ann;
      const Aout = f.dir > 0 ? A.ann : A.cap;
      let v = f.dir ? (f.dir * f.q) / 60000 / (Ain * fn.count) : 0;
      // vazamento na mangueira do braço: o braço "cede" com o peso
      f.leak = 0;
      if (fn.id === 'arm' && P.faults.hoseLeak && f.s === 0) {
        const ph = Math.max(f.holdA, f.holdB);
        const ql = 1.0 * Math.sqrt(ph);
        f.leak = ql;
        v = (f.holdA > f.holdB ? -1 : 1) * ql / 60000 / ((f.holdA > f.holdB ? A.cap : A.ann));
      }
      f.v = v;
      f.qOut = Math.abs(v) * Aout * fn.count * 60000;
      returnQ += f.qOut;
      // pressões nas câmaras (A = fundo, B = haste)
      if (f.dir > 0 && f.s > 0) { f.pA = f.pIn; f.pB = 4 + f.holdB; }
      else if (f.dir < 0 && f.s > 0) { f.pB = f.pIn; f.pA = 4 + f.holdA; }
      else { f.pA = f.holdA; f.pB = f.holdB; }
      f.portRelief = f.pA > 390 || f.pB > 390;
      f.pA = Math.min(f.pA, 390); f.pB = Math.min(f.pB, 390);
      const [lo, hi] = LIMITS[fn.id].map(rad);
      st.j[fn.id] = clamp(st.j[fn.id] + (v / dl[fn.id]) * dt, lo, hi);
    } else if (fn.kind === 'swing') {
      const wmax = 1.15;
      const wq = f.dir * (f.q / Qrated) * wmax;
      const sw = st.swing;
      const braking = f.s === 0;
      sw.w += ((braking ? 0 : wq) - sw.w) * Math.min(1, dt / (braking ? 0.7 : 0.9));
      if (Math.abs(sw.w) < 1e-3) sw.w = 0;
      sw.ang += sw.w * dt;
      f.v = sw.w;
      const brakeP = braking ? 20 + 230 * Math.min(1, Math.abs(sw.w) / wmax) : 0;
      f.pA = f.dir >= 0 && !braking ? f.pIn : sw.w > 0 ? brakeP : 3;
      f.pB = f.dir < 0 && !braking ? f.pIn : sw.w < 0 ? brakeP : 3;
      f.qOut = f.q;
      returnQ += f.q;
    } else {
      const idx = fn.id === 'travelL' ? 0 : 1;
      const v = f.dir * (f.q / Qrated) * 1.6;
      st.trackV[idx] += (v - st.trackV[idx]) * Math.min(1, dt / 0.4);
      st.trackPos[idx] += st.trackV[idx] * dt;
      f.v = st.trackV[idx];
      f.pA = f.dir > 0 ? f.pIn : 3; f.pB = f.dir < 0 ? f.pIn : 3;
      f.qOut = f.q; returnQ += f.q;
    }
  }
  const vAvg = (st.trackV[0] + st.trackV[1]) / 2;
  // rumo fixo: no simulador 2D a máquina não vira (só frente/trás)
  st.mx = clamp(st.mx + vAvg * Math.cos(st.swing.ang) * dt, -2.5, 2.5);
  for (const pu of st.pumps) returnQ += pu.oc + pu.relief;
  st.oil.returnQ = returnQ;

  // ---------- 8. Geometria nova, ponta da caçamba ----------
  const prevTip = [st.mx + g.tip[0], g.tip[1]];
  st.geo = solve(st.j);
  const g2 = st.geo;
  const tipNow = [st.mx + g2.tip[0], g2.tip[1]];
  st.tip.x = tipNow[0]; st.tip.y = tipNow[1];
  st.tip.vx = (tipNow[0] - prevTip[0]) / dt;
  st.tip.vy = (tipNow[1] - prevTip[1]) / dt;

  // ---------- 9. Terra: escavar, segurar, derramar ----------
  updateSoil(st, dt, terr);

  // ---------- 10. Temperatura e nível do óleo ----------
  let heat = 0;
  for (let j = 0; j < 2; j++) {
    const pu = st.pumps[j];
    heat += (pu.relief * pu.p) / 600 + (pu.oc * pu.p) / 600 + pu.kw * 0.1;
    for (const fn of FUNCS) {
      if (fn.pump !== j) continue;
      const f = st.f[fn.id];
      heat += (f.q * Math.max(0, pu.p - f.pL)) / 600;
    }
  }
  const fan = e.rpm / P.ratedRpm;
  const cool = 0.55 * (P.coolerPct / 100) * (0.25 + 0.75 * fan) * (st.oil.T - P.ambientC);
  st.oil.heatKW = heat; st.oil.coolKW = Math.max(0, cool);
  st.oil.T += ((heat - cool) / 110) * dt; // capacidade térmica ~110 kJ/K (acelerada para o vídeo)
  st.oil.T = Math.max(st.oil.T, P.ambientC - 5);
  const leakNow = st.pumps[1].leak + st.f.arm.leak;
  st.oil.leaked += (leakNow / 60) * dt;
  st.oil.tank = st.oil.tank0 - cylinderOil(st) - st.oil.leaked;

  // ---------- 11. Alertas ----------
  const A = st.alerts;
  A.relief0 = st.pumps[0].relief > 5;
  A.relief1 = st.pumps[1].relief > 5;
  A.idle = e.autoIdling;
  A.hot = st.oil.T > 95;
  A.cav = st.pumps[0].cav || st.pumps[1].cav;
  A.stall = e.stalled;
  A.lug = e.running && e.rpm < e.target - 150;
  A.lowOil = st.oil.tank < 95;
}

function updateSoil(st, dt, terr) {
  const s = st.soil;
  const g = st.geo;
  const T = TERRAIN;
  // abertura da caçamba: normal da "boca" no mundo
  const mouthN = rotN([0.123, -0.992], g.tk);
  st.soil.mouthNy = mouthN[1];
  const capEff = BUCKET_CAP * clamp((mouthN[1] + 0.35) / 0.8, 0, 1);
  // escavar
  const vt = Math.hypot(st.tip.vx, st.tip.vy);
  if (st.tip.depth > 0 && vt > 0.02) {
    const tx = st.tip.x, ty = st.tip.y;
    const i0 = Math.max(0, Math.floor((tx - 0.2 - T.x0) / T.dx));
    const i1 = Math.min(T.n - 1, Math.ceil((tx + 0.2 - T.x0) / T.dx));
    // volume cortado limitado pela velocidade da ponta (fatia de solo por segundo)
    let budget = BUCKET_W * Math.min(st.tip.depth, 0.45) * vt * dt;
    for (let i = i0; i <= i1 && budget > 0; i++) {
      if (terr[i] > ty) {
        const cut = Math.min(terr[i] - ty, budget / (T.dx * BUCKET_W));
        terr[i] -= cut;
        const vol = cut * T.dx * BUCKET_W;
        budget -= vol;
        s.load += vol * 1.15; // empolamento: terra solta ocupa mais volume
        if (s.load > BUCKET_CAP * 1.08) s.load = BUCKET_CAP * 1.08; // o excesso é empurrado para fora
      }
    }
  }
  // derramar
  if (s.load > capEff + 1e-4) {
    const out = Math.min(s.load - capEff, (s.load - capEff) * 6 * dt + 0.15 * dt);
    s.load -= out;
    const lip = tf(g.K0, g.tk, [0.9, -0.1]);
    const nPart = Math.max(1, Math.round(out * 400));
    for (let k = 0; k < nPart; k++) {
      s.particles.push({
        x: st.mx + lip[0] + (Math.random() - 0.5) * 0.9, y: lip[1] + (Math.random() - 0.5) * 0.3,
        vx: st.tip.vx * 0.5 + (Math.random() - 0.5) * 0.4, vy: st.tip.vy * 0.5 - Math.random() * 0.5,
        vol: out / nPart, sector: sectorOf(st), r: 0.04 + Math.random() * 0.05,
      });
    }
  }
  // partículas caindo
  const keep = [];
  for (const p of s.particles) {
    p.vy -= GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const arr = s.terrain[p.sector];
    const h = terrainAt(arr, p.x);
    if (p.y <= h) {
      // deposita em formato de monte
      const c = Math.round((p.x - T.x0) / T.dx);
      const w = 4;
      for (let k = -w; k <= w; k++) {
        const i = c + k;
        if (i < 0 || i >= T.n) continue;
        const wt = (w + 1 - Math.abs(k)) / ((w + 1) * (w + 1));
        arr[i] += (p.vol / (T.dx * BUCKET_W)) * wt;
      }
    } else keep.push(p);
  }
  s.particles = keep.length > 1500 ? keep.slice(-1500) : keep;
  // suaviza o terreno (ângulo de repouso)
  for (const arr of [terr]) {
    for (let i = 1; i < T.n; i++) {
      const d = arr[i] - arr[i - 1];
      const maxD = 0.07;
      if (Math.abs(d) > maxD) {
        const m = (Math.abs(d) - maxD) * 0.25 * sgn(d);
        arr[i] -= m; arr[i - 1] += m;
      }
    }
  }
}

function rotN([x, y], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}
