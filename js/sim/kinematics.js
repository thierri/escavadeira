// Cinemática da escavadeira (vista lateral, metros, y para cima).
// O estado são ÂNGULOS das articulações; o comprimento de cada cilindro
// é calculado a partir deles. A relação dL/dθ (derivada numérica) converte
// velocidade do cilindro em velocidade angular e força em torque.

export const GEO = {
  // Estrutura superior (origem = centro de giro, no topo do chassi inferior)
  B0: [0.85, 2.0],             // pino do pé da lança
  boomLen: 5.7,
  boomCylBase: [1.05, 1.12],   // base dos cilindros da lança (estrutura superior)
  boomCylRod: [2.55, -0.38],   // olhal na lança (referencial da lança)
  armCylBase: [2.9, 1.1],    // base do cilindro do braço (referencial da lança)
  armLen: 2.9,
  armCylRod: [-0.69, 0.12],     // cauda do braço (referencial do braço)
  bucketCylBase: [0.3, 0.4], // base do cilindro da caçamba (referencial do braço)
  sideLinkPivot: [2.5, 0.0], // pino do elo lateral (referencial do braço)
  sideLinkLen: 0.7,
  bucketLinkPin: [0.15, 0.45],  // pino do elo na caçamba (referencial da caçamba)
  bucketLinkLen: 0.75,
  bucketTip: [1.5, 0.0],
};

// Limites das articulações (graus)
export const LIMITS = {
  boom: [-32, 52],     // ângulo absoluto da lança
  arm: [-158, -42],    // ângulo do braço relativo à lança
  bucket: [-140, 25],  // ângulo da caçamba relativo ao braço
};

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

export function rot([x, y], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}
export function tf(origin, a, p) {
  const r = rot(p, a);
  return [origin[0] + r[0], origin[1] + r[1]];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function circleIntersect(c0, r0, c1, r1, pickFn) {
  const d = dist(c0, c1);
  let a, h;
  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) {
    // sem solução: usa o ponto mais próximo (evita quebrar o desenho)
    const t = r0 / (r0 + r1);
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t];
  }
  a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0[0] + (a * (c1[0] - c0[0])) / d;
  const my = c0[1] + (a * (c1[1] - c0[1])) / d;
  const p1 = [mx + (h * (c1[1] - c0[1])) / d, my - (h * (c1[0] - c0[0])) / d];
  const p2 = [mx - (h * (c1[1] - c0[1])) / d, my + (h * (c1[0] - c0[0])) / d];
  return pickFn(p1, p2);
}

// Posições de tudo no referencial da estrutura superior.
// j = { boom: rad (abs), arm: rad (rel), bucket: rad (rel) }
export function solve(j) {
  const G = GEO;
  const tb = j.boom;
  const ta = tb + j.arm;
  const tk = ta + j.bucket;
  const B0 = G.B0;
  const A0 = tf(B0, tb, [G.boomLen, 0]);
  const K0 = tf(A0, ta, [G.armLen, 0]);
  const boomRod = tf(B0, tb, G.boomCylRod);
  const armBase = tf(B0, tb, G.armCylBase);
  const armRod = tf(A0, ta, G.armCylRod);
  const bucketBase = tf(A0, ta, G.bucketCylBase);
  const S = tf(A0, ta, G.sideLinkPivot);
  const P = tf(K0, tk, G.bucketLinkPin);
  // escolhe a solução do "H" mais afastada do eixo do braço (lado +y)
  const R = circleIntersect(S, G.sideLinkLen, P, G.bucketLinkLen, (p1, p2) => {
    const l1 = rot([p1[0] - A0[0], p1[1] - A0[1]], -ta)[1];
    const l2 = rot([p2[0] - A0[0], p2[1] - A0[1]], -ta)[1];
    return l1 > l2 ? p1 : p2;
  });
  const tip = tf(K0, tk, G.bucketTip);
  return {
    tb, ta, tk, B0, A0, K0, S, P, R, tip,
    cyl: {
      boom: { base: G.boomCylBase, end: boomRod, L: dist(G.boomCylBase, boomRod) },
      arm: { base: armBase, end: armRod, L: dist(armBase, armRod) },
      bucket: { base: bucketBase, end: R, L: dist(bucketBase, R) },
    },
  };
}

// dL/dθ de cada cilindro em relação à SUA articulação (m/rad)
export function dLdTheta(j) {
  const h = 1e-4;
  const out = {};
  for (const k of ['boom', 'arm', 'bucket']) {
    const jp = { ...j, [k]: j[k] + h };
    const jm = { ...j, [k]: j[k] - h };
    out[k] = (solve(jp).cyl[k].L - solve(jm).cyl[k].L) / (2 * h);
  }
  return out;
}

// Faixa de comprimento de cada cilindro (calculada varrendo os limites)
export function cylinderRanges() {
  const res = {};
  const base = { boom: rad(10), arm: rad(-90), bucket: rad(-60) };
  for (const k of ['boom', 'arm', 'bucket']) {
    let mn = Infinity, mx = -Infinity;
    const [a, b] = LIMITS[k];
    for (let d = a; d <= b; d += 0.5) {
      const L = solve({ ...base, [k]: rad(d) }).cyl[k].L;
      mn = Math.min(mn, L); mx = Math.max(mx, L);
    }
    res[k] = { Lmin: mn, Lmax: mx, stroke: mx - mn };
  }
  return res;
}
