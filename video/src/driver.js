// Liga o simulador ao HyperFrames: o HyperFrames pede "me mostre o instante t"
// e este driver avança o simulador, quadro a quadro, até lá.
//
// - Cada cena começa de um estado fixo (presentation.go + sementes fixas para o
//   Math.random), então qualquer quadro pode ser refeito igualzinho, mesmo fora de ordem.
// - O relógio do roteiro de cada cena é "esticado" para casar com a narração:
//   timeline.scenes[k].warp = [[tempo do áudio, tempo do roteiro], ...] (linear por partes).
import TL from './timeline.js';

const FPS = TL.fps;

// ---- Math.random com semente (mulberry32) ----
let seed = 1;
Math.random = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- carrega o simulador em modo vídeo (sem laço próprio, sem som) ----
window.__VIDEO_MODE = true;
await import('./app/js/main.js');
const sim = window.sim;
sim.pres.enableVideo();
sim.sound.setEnabled(false);

const startF = TL.scenes.map((s) => Math.round(s.start * FPS));
const endF = TL.scenes.map((s) => Math.round((s.start + s.dur) * FPS));
const sceneAt = (f) => {
  for (let k = TL.scenes.length - 1; k >= 0; k--) if (f >= startF[k]) return k;
  return 0;
};
// Tempo do roteiro para um tempo local do áudio. Entre dois pontos de sincronia o
// roteiro anda em velocidade normal e depois ESPERA a narração chegar no próximo
// ponto (assim os movimentos nunca ficam em câmera lenta nem esticados). Se a fala
// for mais rápida que o roteiro, ele acelera para alcançar.
function warp(k, a) {
  const w = TL.scenes[k].warp;
  if (!w || !w.length) return a;
  if (a <= w[0][0]) return Math.max(0, w[0][1] - (w[0][0] - a));
  for (let i = 1; i < w.length; i++) {
    if (a <= w[i][0]) {
      const [a0, s0] = w[i - 1], [a1, s1] = w[i];
      const da = a1 - a0, ds = s1 - s0;
      // espera um milésimo ANTES do próximo ponto: o que está marcado nele (legenda,
      // holofote, zoom) só acontece quando a narração chega lá
      return da >= ds ? s0 + Math.min(a - a0, ds - 1e-3) : s0 + ((a - a0) / da) * ds;
    }
  }
  const [aN, sN] = w[w.length - 1];
  return sN + (a - aN);
}

const cur = { k: -1, f: -1, sT: 0 };
function begin(k) {
  seed = 1000 + k * 7919;
  const scIndex = TL.scenes[k].scene;
  if (!sim.pres.active) sim.pres.start(scIndex); else sim.pres.go(scIndex);
  cur.k = k; cur.f = startF[k] - 1; cur.sT = 0;
}
function advance() {
  const nf = cur.f + 1;
  const k = sceneAt(nf);
  if (k !== cur.k) begin(k);
  const local = (nf - startF[cur.k] + 1) / FPS;
  const sT = warp(cur.k, local);
  sim.tick(1 / FPS, Math.max(0, sT - cur.sT));
  cur.sT = sT; cur.f = nf;
}
function renderFrame(t) {
  const f = Math.min(Math.round(t * FPS), endF[endF.length - 1] - 1);
  const k = sceneAt(f);
  // voltar no tempo ou pular para outra cena: recomeça a cena e simula até o quadro
  if (k !== cur.k || f < cur.f) begin(k);
  while (cur.f < f) advance();
}

// ---- som da máquina (modo ?audio): grava offline o som do simulador, quadro a quadro ----
// Usa o mesmo caminho dos quadros da imagem; o som recebe o tempo de cada quadro e
// os sorteios do som usam uma sequência própria (a física fica idêntica à do vídeo).
async function renderAudio(log) {
  const SR = 48000;
  const nF = endF[endF.length - 1];
  const ctx = new OfflineAudioContext(1, Math.ceil((nF / FPS + 1) * SR), SR);
  await ctx.audioWorklet.addModule(new URL('./app/js/audio/engine-worklet.js', import.meta.url).href);
  let sseed = 777;
  const soundRand = () => { sseed = (sseed * 1664525 + 1013904223) >>> 0; return sseed / 4294967296; };
  const withSoundRand = (fn) => { const r = Math.random; Math.random = soundRand; try { return fn(); } finally { Math.random = r; } };
  const snd = sim.sound;
  snd.ctx = ctx;
  withSoundRand(() => snd.build());
  snd.enabled = true; snd.volume = 0.8; snd.paused = false; snd.applyMaster(false);
  snd.clock = () => (cur.f + 1) / FPS;               // tempo do quadro que está sendo simulado
  const upd = snd.update.bind(snd);
  snd.update = (...a) => withSoundRand(() => upd(...a));
  for (let f = 0; f < nF; f++) {
    renderFrame(f / FPS);
    if (f % 900 === 0) { log(`simulando ${Math.round((100 * f) / nF)}%`); await new Promise((r) => setTimeout(r, 0)); }
  }
  log('gerando o áudio…');
  const buf = await ctx.startRendering();
  // WAV 16 bits mono
  const d = buf.getChannelData(0), n = d.length;
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  log('enviando…');
  const r = await fetch('/salvar', { method: 'POST', body: out.buffer });
  log(r.ok ? `pronto: ${(n / SR).toFixed(1)} s de som` : `erro ao salvar: ${r.status}`);
}

if (new URLSearchParams(location.search).has('audio')) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:20px;top:20px;z-index:999;background:#000;color:#fff;font:700 28px sans-serif;padding:12px 18px';
  document.body.appendChild(box);
  const log = (s) => { box.textContent = s; window.__audioStatus = s; };
  renderAudio(log).catch((e) => log('erro: ' + e.message));
} else if (window.__hyperframes) {
  window.__hyperframes.registerFrameSource({
    element: document.getElementById('stage'),
    ready: Promise.resolve(),
    render: (t) => { renderFrame(t); },
  });
}
// para depurar no navegador: __video.render(12.3)
window.__video = { render: renderFrame, TL };
