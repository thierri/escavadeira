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
document.querySelectorAll('[data-layer]').forEach((b) => {
  b.onclick = () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    scene.setLayer(b.dataset.layer, on);
  };
});
// velocidade / pausa
let speed = 1, paused = false;
document.querySelectorAll('[data-speed]').forEach((b) => {
  b.onclick = () => {
    speed = +b.dataset.speed;
    document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b));
  };
});
const pauseBtn = document.getElementById('pause');
pauseBtn.onclick = () => { paused = !paused; pauseBtn.classList.toggle('on', paused); pauseBtn.textContent = paused ? 'Continuar' : 'Pausar'; };

// som: o navegador só libera áudio após um gesto do usuário (clique ou tecla)
const sound = new Sound();
const sBtn = document.getElementById('btn-sound');
const vol = document.getElementById('vol');
sBtn.textContent = 'Clique para ativar';
sBtn.classList.add('wait');
const unlock = async () => {
  if (sound.ctx) return;
  await sound.init();
  sBtn.classList.remove('wait');
  sBtn.textContent = sound.enabled ? 'Ligado' : 'Mudo';
};
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
sBtn.onclick = () => {
  if (!sound.ctx) return;
  sound.setEnabled(!sound.enabled);
  sBtn.classList.toggle('on', sound.enabled);
  sBtn.textContent = sound.enabled ? 'Ligado' : 'Mudo';
};
vol.oninput = () => sound.setVolume(+vol.value);
vol.addEventListener('keydown', (e) => e.stopPropagation());

// modo apresentação
function setLayers(obj) {
  for (const k in obj) {
    scene.setLayer(k, obj[k]);
    const b = document.querySelector(`[data-layer="${k}"]`);
    if (b) b.classList.toggle('on', obj[k]);
  }
}
const pres = new Presentation({
  stage, scene, controls, sound, params, setLayers,
  st: () => st,
  reset,
  togglePause: () => pauseBtn.click(),
});
document.getElementById('btn-present').onclick = () => {
  if (drawer.open) { drawer.toggle(false); document.getElementById('btn-params').classList.remove('on'); }
  pres.start(0);
};

// laço principal: física em passo fixo (240 Hz), desenho a cada quadro
const H = 1 / 240;
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pres.update(paused ? 0 : dt * speed, dt);
  controls.update(dt);
  if (!paused) {
    acc += dt * speed;
    let n = 0;
    while (acc >= H && n < 120) { step(st, H); acc -= H; n++; }
  }
  const vdt = paused ? 0 : dt * speed;
  scene.update(st, vdt);
  panel.update(st, dt);
  info.panel.update(st);
  sound.update(st, paused ? 0 : dt * speed, paused);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// acesso pelo console (útil para gravar vídeos e depurar)
window.sim = { get st() { return st; }, params, scene, sound, reset, pres };
