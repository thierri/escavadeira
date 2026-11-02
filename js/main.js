// Ponto de entrada: monta a página, roda a simulação e desenha.
import { cloneDefaults } from './config.js';
import { createState, step } from './sim/simulation.js';
import { Scene } from './render/scene.js';
import { Panel } from './render/panel.js';
import { Controls } from './ui/controls.js';
import { InfoPanel } from './ui/info.js';
import { ParamsDrawer } from './ui/params.js';
import { Sound } from './audio/sound.js';
import { Presentation } from './present/presentation.js';

const stage = document.getElementById('stage');
function fit() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
}
addEventListener('resize', fit);
fit();

const params = cloneDefaults();
let st = createState(params);

const info = { panel: null };
const scene = new Scene(document.getElementById('scene'), document.getElementById('overlay'), (id) => pick(id));
const panel = new Panel(document.getElementById('panel'));
const controls = new Controls(document.getElementById('controls'), st);
info.panel = new InfoPanel(controls.info);
document.getElementById('panel').addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-comp]');
  if (c && c.getAttribute('data-comp')) pick(c.getAttribute('data-comp'));
});
function pick(id) {
  scene.select(id);
  info.panel.show(id);
}

const drawer = new ParamsDrawer(document.getElementById('drawer'), () => params);
document.getElementById('btn-params').onclick = (e) => {
  drawer.toggle();
  e.currentTarget.classList.toggle('on', drawer.open);
};

function reset() {
  st = createState(params);
  controls.st = st;
}
document.getElementById('btn-reset').onclick = reset;

// camadas
document.querySelectorAll('[data-show]').forEach((b) => {
  b.onclick = () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    scene.setLayer(b.dataset.show, on);
  };
});
// velocidade / pausa
// velocidade fixa em 1×; a pausa só existe no modo apresentação (tecla P)
const speed = 1;
let paused = false;

// som: começa ligado. O navegador só libera áudio após o primeiro gesto
// (clique ou tecla em qualquer lugar), então ele "acorda" nesse momento.
const sound = new Sound();
const sBtn = document.getElementById('btn-sound');
const vol = document.getElementById('vol');
let unlockedNow = false;
const unlock = (e) => {
  if (sound.ctx || sound.initializing) return;
  unlockedNow = e.type === 'pointerdown';
  sound.init();
};
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
const showSound = () => {
  const label = sound.enabled ? 'Som ligado (clique para silenciar)' : 'Som mudo (clique para ligar)';
  sBtn.classList.toggle('muted', !sound.enabled);
  sBtn.title = label; sBtn.setAttribute('aria-label', label);
};
sBtn.onclick = () => {
  // o primeiro clique da página só libera o áudio; não deve silenciar
  if (unlockedNow) { unlockedNow = false; return; }
  sound.setEnabled(!sound.enabled);
  showSound();
};
addEventListener('pointerup', () => { setTimeout(() => { unlockedNow = false; }, 0); }, { capture: true });
showSound();
vol.oninput = () => sound.setVolume(+vol.value);
vol.addEventListener('keydown', (e) => e.stopPropagation());

// modo apresentação
function setLayers(obj) {
  for (const k in obj) {
    scene.setLayer(k, obj[k]);
    const b = document.querySelector(`[data-show="${k}"]`);
    if (b) b.classList.toggle('on', obj[k]);
  }
}
const pres = new Presentation({
  stage, scene, controls, sound, params, setLayers,
  st: () => st,
  reset,
  togglePause: () => { paused = !paused; },
  showDrawer: (on) => { drawer.toggle(on); document.getElementById('btn-params').classList.toggle('on', on); },
  resetFx: () => resetFx(),
});
document.getElementById('btn-present').onclick = () => {
  if (drawer.open) { drawer.toggle(false); document.getElementById('btn-params').classList.remove('on'); }
  pres.start(0);
};

// laço principal: física em passo fixo (240 Hz), desenho a cada quadro.
// tick(dt, scriptDt) avança um quadro; scriptDt é o relógio do roteiro da
// apresentação (no vídeo ele pode andar mais rápido ou mais devagar que dt).
const H = 1 / 240;
let acc = 0, last = performance.now();
function tick(dt, scriptDt = dt) {
  pres.update(paused ? 0 : scriptDt * speed, dt);
  controls.update(dt);
  if (!paused) {
    acc += dt * speed;
    let n = 0;
    while (acc >= H - 1e-9 && n < 120) { step(st, H); acc -= H; n++; }
  }
  const vdt = paused ? 0 : dt * speed;
  scene.update(st, vdt);
  panel.update(st, dt);
  info.panel.update(st);
  sound.update(st, paused ? 0 : dt * speed, paused);
}
function frame(now) {
  tick(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}
// Modo vídeo (?video): sem laço próprio; quem grava chama sim.tick() quadro a quadro.
const VIDEO = new URLSearchParams(location.search).has('video') || window.__VIDEO_MODE === true;
if (!VIDEO) requestAnimationFrame(frame);

// zera tudo o que é só visual (fumaça, bolhas, gráfico, ponteiros, joysticks)
function resetFx() {
  acc = 0;
  scene.resetFx(); panel.resetFx(); controls.resetFx();
}

// acesso pelo console (útil para gravar vídeos e depurar)
window.sim = { get st() { return st; }, params, scene, panel, controls, sound, reset, pres, tick, resetFx, video: VIDEO };
