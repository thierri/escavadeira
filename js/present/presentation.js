// Modo apresentação: cenas roteirizadas para gravar o vídeo.
// Teclas: → / Espaço próxima · ← anterior · R reinicia a cena · A automático
//         H alterna interface · P pausa · 1–9, 0 vai para a cena · Esc sai
import { SCENES } from './scenes.js';
import { cloneDefaults } from '../config.js';
import { solve, rad } from '../sim/kinematics.js';

const ZERO = { leftX: 0, leftY: 0, rightX: 0, rightY: 0, travelL: 0, travelR: 0, start: false, boost: false };
const ASPECT = { clean: 1080 / 1920, full: 784 / 1400 };

export class Presentation {
  constructor(app) {
    this.app = app; // { st(), reset(), params, scene, controls, sound, setLayers(), togglePause(), stage }
    this.active = false;
    this.auto = false;
    this.cam = null;
    this.uiOverride = null;
    const stage = app.stage;
    this.cap = div(stage, 'pcap');
    this.cap.innerHTML = '<div class="pc-n"></div><div class="pc-t"></div><div class="pc-x"></div>';
    this.hint = div(stage, 'phint');
    this.bar = div(stage, 'pbar');
    this.barFill = div(this.bar, 'pbar-f');
    this.hintT = 0;
    window.addEventListener('keydown', (e) => this.onKey(e), { capture: true });
  }

  start(i = 0) {
    this.active = true;
    this.app.stage.classList.add('presenting');
    this.go(i, true);
  }
  stop() {
    this.active = false;
    const { scene, controls, stage } = this.app;
    stage.classList.remove('presenting', 'clean');
    controls.override = null;
    scene.setFocus(null);
    scene.setInsets(null);
    this.app.setLayers({ hoses: true, pilot: true, labels: true, values: true });
    scene.svg.setAttribute('viewBox', '0 0 1400 784');
    scene.overlay.setAttribute('viewBox', '0 0 1400 784');
    this.cap.classList.remove('show');
    this.hint.classList.remove('show');
    this.bar.classList.remove('show');
  }

  go(i, snap = false) {
    i = (i + SCENES.length) % SCENES.length;
    const prevUi = this.sc && this.ui();
    this.i = i; this.sc = SCENES[i]; this.t = 0; this.fired = new Set(); this.noteI = -1;
    this.uiOverride = null;
    const { scene, params } = this.app;
    // estado inicial determinístico: toda vez que a cena começa, ela fica igual (bom para regravar)
    Object.assign(params, cloneDefaults(), this.sc.prep?.params || {});
    this.app.reset();
    prep(this.app.st(), this.sc.prep || {});
    this.app.sound.prev = null; // não tocar "cliques" da troca de estado
    this.layout();
    scene.setFocus(this.sc.focus || []);
    scene.setInsets(this.sc.insets || []);
    this.app.setLayers({ hoses: true, pilot: true, labels: true, values: false, ...(this.sc.layers || {}) });
    if (snap || prevUi !== this.ui()) this.cam = null;
    this.caption(this.sc.text, true);
    this.showHint();
  }

  ui() { return this.uiOverride || this.sc.ui || 'full'; }
  layout() {
    const clean = this.ui() === 'clean';
    this.app.stage.classList.toggle('clean', clean);
    // posição da legenda: 'left' ou 'right' (padrão: direita na tela cheia, esquerda com painéis)
    this.cap.classList.toggle('right', clean && (this.sc.capPos || 'right') === 'right');
    this.app.scene.overlay.setAttribute('viewBox', clean ? '0 0 1400 787.5' : '0 0 1400 784');
  }

  caption(text, full) {
    const c = this.cap;
    const set = () => {
      c.querySelector('.pc-n').textContent = `${this.i + 1} / ${SCENES.length}`;
      c.querySelector('.pc-t').textContent = this.sc.title;
      c.querySelector('.pc-x').textContent = text;
      c.classList.add('show');
    };
    if (full) { c.classList.remove('show'); clearTimeout(this.capTO); this.capTO = setTimeout(set, 250); }
    else {
      const x = c.querySelector('.pc-x');
      x.classList.add('swap');
      clearTimeout(this.capTO);
      this.capTO = setTimeout(() => { x.textContent = text; x.classList.remove('swap'); }, 220);
    }
  }

  showHint() {
    this.hintT = 3.5;
    this.hint.innerHTML = `<b>Cena ${this.i + 1}/${SCENES.length}</b> · ← → navegar · R repetir · A automático: <b>${this.auto ? 'ligado' : 'desligado'}</b> · H interface · P pausa · Esc sair`;
    this.hint.classList.add('show');
    this.bar.classList.add('show');
  }

  onKey(e) {
    if (!this.active) return;
    if (e.target.tagName === 'INPUT') return;
    const k = e.key;
    const used = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { used(); this.go(this.i + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { used(); this.go(this.i - 1); }
    else if (k === 'Escape') { used(); this.stop(); this.app.onExit && this.app.onExit(); }
    else if (k === 'r' || k === 'R') { used(); this.go(this.i); }
    else if (k === 'a' || k === 'A') { used(); this.auto = !this.auto; this.showHint(); }
    else if (k === 'h' || k === 'H') { used(); this.uiOverride = this.ui() === 'clean' ? 'full' : 'clean'; this.layout(); this.cam = null; this.showHint(); }
    else if (k === 'p' || k === 'P') { used(); this.app.togglePause(); }
    else if (/^[0-9]$/.test(k)) { used(); const n = k === '0' ? 9 : +k - 1; if (n < SCENES.length) this.go(n); }
    else { used(); this.showHint(); }
  }

  // simDt: tempo da simulação (para o roteiro) · dt: tempo real (para a câmera)
  update(simDt, dt) {
    if (!this.active) return;
    const st = this.app.st(), sc = this.sc;
    this.t += simDt;
    const t = this.t;
    // eventos pontuais
    (sc.events || []).forEach(([te, fn], idx) => {
      if (t >= te && !this.fired.has(idx)) { this.fired.add(idx); fn(st, this.app.params); }
    });
    // comandos com rampa suave de entrada e saída
    const o = { ...ZERO };
    for (const [t0, d, v] of sc.moves || []) {
      if (t < t0 || t > t0 + d) continue;
      const r = 0.3;
      const a = Math.max(0, Math.min(1, (t - t0) / r, (t0 + d - t) / r));
      if (v.boom) o.rightY += -v.boom * a;
      if (v.arm) o.leftY += -v.arm * a;
      if (v.bucket) o.rightX += -v.bucket * a;
      if (v.swing) o.leftX += v.swing * a;
      if (v.tl) o.travelL += v.tl * a;
      if (v.tr) o.travelR += v.tr * a;
      if (v.start) o.start = true;
      if (v.boost) o.boost = true;
    }
    this.app.controls.override = o;
    // legenda que muda ao longo da cena
    const notes = sc.notes || [];
    let ni = -1;
    notes.forEach(([tn], idx) => { if (t >= tn) ni = idx; });
    if (ni !== this.noteI) { this.noteI = ni; if (ni >= 0) this.caption(notes[ni][1], false); }
    // fim da cena
    const dur = sc.duration || 12;
    this.barFill.style.width = `${Math.min(100, (t / dur) * 100)}%`;
    if (t >= dur && this.auto && !this.advancing) { this.advancing = true; setTimeout(() => { this.advancing = false; this.go(this.i + 1); }, 0); }
    // dica some sozinha (para não aparecer no vídeo)
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) { this.hint.classList.remove('show'); this.bar.classList.remove('show'); } }
    this.updateCamera(st, dt);
  }

  updateCamera(st, dt) {
    const { scene } = this.app;
    const spec = typeof this.sc.cam === 'function' ? this.sc.cam(scene, st) : this.sc.cam || { cx: 700, cy: 392, w: 1400 };
    if (!this.cam) this.cam = { ...spec };
    const k = 1 - Math.exp(-dt * 2.2); // aproximação suave (sem solavancos)
    for (const key of ['cx', 'cy', 'w']) this.cam[key] += (spec[key] - this.cam[key]) * k;
    const c = this.cam, h = c.w * ASPECT[this.ui() === 'clean' ? 'clean' : 'full'];
    scene.svg.setAttribute('viewBox', `${(c.cx - c.w / 2).toFixed(1)} ${(c.cy - h / 2).toFixed(1)} ${c.w.toFixed(1)} ${h.toFixed(1)}`);
  }
}

function prep(st, o) {
  st.autoIdle = false;
  st.mode = o.mode || 'S';
  st.throttle = o.throttle ?? 7;
  if (o.pose) {
    st.j.boom = rad(o.pose[0]); st.j.arm = rad(o.pose[1]); st.j.bucket = rad(o.pose[2]);
    st.geo = solve(st.j);
  }
  if (o.running !== false) {
    const P = st.params;
    st.key = 1;
    st.eng.running = true;
    st.eng.rpm = P.idleRpm + ((st.throttle - 1) / 9) * (P.ratedRpm * 0.96 - P.idleRpm);
    st.eng.integ = 120;
    st.eng.coolant = 82;
    st.pilot.supply = P.pilotBar;
    st.oil.T = 48;
  }
  st.locked = false;   // sem alavanca de segurança neste simulador
}

function div(parent, cls) {
  const d = document.createElement('div');
  d.className = cls;
  parent.appendChild(d);
  return d;
}
