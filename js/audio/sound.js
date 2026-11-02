// Sistema de som: tudo é sintetizado em tempo real a partir do estado da simulação.
// Sons contínuos (motor, bombas, alívio, giro, escavação…) têm o volume e o tom
// ligados a grandezas físicas; sons curtos (cliques, batidas, esteiras) são
// disparados por EVENTOS detectados comparando o estado atual com o anterior.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Sound {
  constructor() {
    this.enabled = true;
    this.volume = 0.8;
    this.ctx = null;
    this.prev = null;
    this.trackDist = [0, 0];
    this.beepT = 0;
  }

  // O navegador só libera áudio depois de um clique/tecla do usuário.
  async init() {
    if (this.ctx || this.initializing) return;
    this.initializing = true;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule('js/audio/engine-worklet.js?v=' + Date.now()); // evita cache durante o desenvolvimento
    this.ctx = ctx;
    this.build();
    if (ctx.state !== 'running') await ctx.resume();
  }

  setEnabled(on) { this.enabled = on; this.applyMaster(); }
  setVolume(v) { this.volume = v; this.applyMaster(); }
  applyMaster(paused = this.paused) {
    if (!this.ctx) return;
    const v = this.enabled && !paused ? this.volume : 0;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
  }

  // ---------- montagem do grafo de áudio ----------
  build() {
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048;
    this.master.connect(comp); comp.connect(this.analyser); this.analyser.connect(ctx.destination);
    this.applyMaster();

    // ruído branco e ruído marrom (grave) reaproveitados por vários sons
    const mkBuf = (brown) => {
      const len = ctx.sampleRate * 3;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      return b;
    };
    this.white = mkBuf(false); this.brown = mkBuf(true);

    const gain = (v = 0, dest = this.master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
    const filt = (type, f, Q, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.connect(dest); return b; };
    const noise = (buf, dest) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(0, Math.random() * 2); return s; };
    const osc = (type, f, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(); return o; };
    this.g = gain; this.f = filt;

    // Motor diesel (worklet) → filtro passa-baixa que abre com a carga
    this.engG = gain(0);
    this.engLP = filt('lowpass', 900, 0.7, this.engG);
    this.engine = new AudioWorkletNode(ctx, 'diesel-engine', { outputChannelCount: [1] });
    this.engine.connect(this.engLP);
    this.ep = { rpm: this.engine.parameters.get('rpm'), load: this.engine.parameters.get('load'), fuel: this.engine.parameters.get('fuel') };

    // Turbo: assobio agudo que sobe com rotação e carga
    this.turboG = gain(0);
    this.turbo = osc('sine', 3000, this.turboG);
    // Ventilador do radiador: sopro grave
    this.fanG = gain(0);
    noise(this.white, filt('lowpass', 650, 0.5, this.fanG));

    // Motor de partida: zumbido elétrico + engrenagens raspando
    this.stG = gain(0);
    this.stOsc = osc('sawtooth', 160, filt('bandpass', 700, 1.4, this.stG));
    this.stGrindG = gain(0);
    noise(this.white, filt('bandpass', 2600, 3, this.stGrindG));

    // Bombas de pistão: "chiado" tonal (frequência = rotação × 9 pistões)
    this.pumpG = gain(0);
    this.pumpBP = filt('bandpass', 300, 3, this.pumpG);
    this.pumpO1 = osc('sawtooth', 240, this.pumpBP);
    this.pumpG2 = gain(0);
    this.pumpO2 = osc('triangle', 480, this.pumpG2);

    // Válvula de alívio: guincho agudo + jato de óleo (ruído estreito)
    this.relG = gain(0);
    noise(this.white, filt('bandpass', 3300, 9, this.relG));
    this.relToneG = gain(0);
    this.relTone = osc('sine', 1850, this.relToneG);
    const vib = osc('sine', 7, gain(25, this.relTone.frequency));
    this.vib = vib;

    // Óleo passando estrangulado pelos carretéis
    this.hissG = gain(0);
    noise(this.white, filt('bandpass', 1500, 0.9, this.hissG));

    // Motor de giro: zumbido hidráulico + engrenagem do pinhão
    this.swG = gain(0);
    this.swOsc = osc('triangle', 80, filt('lowpass', 500, 1, this.swG));
    this.swGearG = gain(0);
    this.swGear = osc('square', 400, filt('bandpass', 900, 4, this.swGearG));

    // Motores de translação: zumbido grave contínuo (as batidas das sapatas são eventos)
    this.trG = gain(0);
    this.trOsc = osc('sawtooth', 55, filt('lowpass', 260, 1, this.trG));

    // Escavação: terra sendo cortada (grave, granulado) + dentes raspando pedra
    this.digG = gain(0);
    noise(this.brown, filt('lowpass', 520, 0.8, this.digG));
    this.scrapeG = gain(0);
    noise(this.white, filt('bandpass', 2300, 2.5, this.scrapeG));

    // Terra caindo da caçamba
    this.fallG = gain(0);
    noise(this.brown, filt('lowpass', 380, 0.7, this.fallG));
  }

  // ---------- sons curtos ----------
  // rajada de ruído filtrado (cliques, batidas metálicas, terra)
  burst(t, { f = 2000, Q = 2, type = 'bandpass', dur = 0.03, gain = 0.1, buf } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = buf || this.white;
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(b); b.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  // tom curto com queda de frequência (pancadas, "plop", bipes)
  tone(t, { f = 100, f2, type = 'sine', dur = 0.15, gain = 0.2, attack = 0.003 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  click(t, g = 1) { this.burst(t, { f: 3800, Q: 1.5, dur: 0.012, gain: 0.12 * g }); this.tone(t, { f: 1100, f2: 700, dur: 0.02, gain: 0.03 * g }); }
  clunk(t, g = 1) { this.tone(t, { f: 140, f2: 60, dur: 0.14, gain: 0.35 * g }); this.burst(t, { f: 900, Q: 1, dur: 0.06, gain: 0.18 * g }); }
  metalHit(t, g = 1) {
    this.tone(t, { f: 75, f2: 45, dur: 0.22, gain: 0.45 * g });
    this.burst(t, { f: 1700, Q: 6, dur: 0.12, gain: 0.12 * g });
    this.tone(t, { f: 2350, dur: 0.18, gain: 0.025 * g }); // "tilintar" do aço
  }
  trackClank(t, g = 1) {
    const v = 0.85 + Math.random() * 0.3;
    this.burst(t, { f: 750 * v, Q: 5, dur: 0.05, gain: 0.16 * g });
    this.tone(t, { f: 210 * v, f2: 150, dur: 0.07, gain: 0.08 * g });
  }
  beep(t, f = 2400, dur = 0.12, g = 0.05) { this.tone(t, { f, type: 'square', dur, gain: g, attack: 0.005 }); }

  // ---------- atualização por quadro ----------
  update(st, dt, paused) {
    if (!this.ctx) return;
    if (paused !== this.paused) { this.paused = paused; this.applyMaster(paused); }
    if (paused) return;
    // this.clock (opcional) dá o tempo do quadro: usado ao gravar o som do vídeo offline
    const t = this.clock ? this.clock() : this.ctx.currentTime;
    const T = (param, v, tc = 0.06) => param.setTargetAtTime(v, t, tc);
    const e = st.eng, P = st.params;
    const rpm = e.rpm, rn = clamp(rpm / P.ratedRpm, 0, 1.2);
    const load = clamp(e.outKW / P.engineKW, 0, 1);
    const cranking = st.key === 2 && !e.running;

    // motor
    T(this.ep.rpm, rpm, 0.03);
    T(this.ep.load, load, 0.08);
    this.ep.fuel.setValueAtTime(e.running ? 1 : 0, t);
    T(this.engG.gain, rpm > 5 ? 2.6 * (0.55 + 0.45 * rn) * (0.8 + 0.4 * load) : 0, 0.05);
    T(this.engLP.frequency, 450 + 2600 * load * rn + 500 * rn, 0.08);
    T(this.turbo.frequency, 1800 + 5200 * rn * (0.6 + 0.4 * load));
    T(this.turboG.gain, e.running ? 0.012 * rn * (0.3 + load) : 0, 0.3);
    T(this.fanG.gain, 0.09 * rn * rn, 0.4);

    // motor de partida
    T(this.stG.gain, cranking ? 0.3 : 0, 0.02);
    T(this.stGrindG.gain, cranking ? 0.06 : 0, 0.02);
    T(this.stOsc.frequency, 110 + rpm * 0.6, 0.05);

    // bombas: o chiado aumenta com a pressão
    const pf = (rpm / 60) * 9;
    const pmax = Math.max(st.pumps[0].p, st.pumps[1].p);
    T(this.pumpO1.frequency, Math.max(20, pf)); T(this.pumpBP.frequency, Math.max(60, pf * 2));
    T(this.pumpO2.frequency, Math.max(40, pf * 2));
    T(this.pumpG.gain, rpm > 100 ? 0.02 + 0.09 * clamp(pmax / 350, 0, 1) ** 1.5 : 0, 0.05);
    T(this.pumpG2.gain, rpm > 100 ? 0.006 * clamp(pmax / 350, 0, 1) : 0, 0.05);

    // válvula de alívio
    const rel = st.pumps[0].relief + st.pumps[1].relief;
    const rk = clamp(rel / 150, 0, 1);
    T(this.relG.gain, 0.22 * rk, 0.03);
    T(this.relToneG.gain, 0.05 * rk, 0.03);
    T(this.relTone.frequency, 1650 + 4 * Math.max(st.pumps[0].reliefSet || 0, 0) * 0.3, 0.1);

    // óleo estrangulado nos carretéis (potência perdida na válvula)
    let throttleKW = 0;
    for (const id in st.f) {
      const f = st.f[id];
      if (f.q > 0) throttleKW += (f.q * Math.max(0, (f.pIn || 0) - f.pL)) / 600;
    }
    for (const pu of st.pumps) throttleKW += (pu.oc * pu.p) / 600 * 0.3;
    T(this.hissG.gain, 0.06 * clamp(throttleKW / 25, 0, 1) + (rpm > 100 ? 0.004 : 0), 0.08);

    // giro
    const sw = Math.abs(st.swing.w) / 1.15;
    T(this.swG.gain, 0.12 * clamp(sw * 1.3, 0, 1), 0.08);
    T(this.swOsc.frequency, 55 + 110 * sw);
    T(this.swGearG.gain, 0.02 * sw, 0.08);
    T(this.swGear.frequency, 250 + 700 * sw);

    // translação
    const tv = (Math.abs(st.trackV[0]) + Math.abs(st.trackV[1])) / 2;
    T(this.trG.gain, 0.1 * clamp(tv / 1.2, 0, 1), 0.1);
    T(this.trOsc.frequency, 45 + 60 * tv);
    // batidas das sapatas: uma a cada 19 cm percorridos, em cada esteira
    for (let k = 0; k < 2; k++) {
      this.trackDist[k] += Math.abs(st.trackV[k]) * dt;
      if (this.trackDist[k] > 0.19) {
        this.trackDist[k] -= 0.19;
        this.trackClank(t + Math.random() * 0.01, clamp(Math.abs(st.trackV[k]) / 0.8, 0.3, 1));
      }
    }

    // escavação
    const tipV = Math.hypot(st.tip.vx, st.tip.vy);
    const dig = st.tip.depth > 0 ? clamp(st.tip.digF / 120e3, 0, 1) * clamp(tipV / 0.25, 0, 1) : 0;
    const grain = 0.6 + 0.8 * Math.random(); // textura granulada
    T(this.digG.gain, 0.5 * dig * grain, 0.03);
    const hard = { areia: 0.15, terra: 0.35, argila: 0.25, cascalho: 1 }[P.material];
    T(this.scrapeG.gain, 0.09 * dig * hard * grain, 0.03);
    if (dig > 0.2 && P.material === 'cascalho' && Math.random() < dt * 14) {
      this.burst(t, { f: 3000 + Math.random() * 2000, Q: 8, dur: 0.03, gain: 0.08 }); // pedra estalando
    }
    // terra caindo
    const falling = st.soil.particles.length;
    T(this.fallG.gain, 0.45 * clamp(falling / 250, 0, 1), 0.08);

    this.events(st, t, dt);
  }

  events(st, t, dt) {
    const p = this.prev;
    const now = {
      key: st.key, running: st.eng.running, locked: st.locked, throttle: st.throttle, mode: st.mode, autoIdle: st.autoIdle,
      s: {}, blocked: {}, mat: st.params.material,
    };
    for (const id in st.f) { now.s[id] = st.f[id].s; now.blocked[id] = st.f[id].blocked && st.f[id].s > 0.05; }
    this.prev = now;
    if (!p) return;

    // chave de ignição
    if (now.key !== p.key) {
      this.click(t, 1.3);
      if (p.key === 0 && now.key >= 1) {
        // autoteste do painel + bomba elétrica de combustível
        this.beep(t + 0.15, 2000, 0.09, 0.04); this.beep(t + 0.35, 2000, 0.09, 0.04);
        this.tone(t + 0.1, { f: 130, dur: 1.2, gain: 0.03, attack: 0.05, type: 'triangle' });
      }
      if (now.key === 2) this.clunk(t + 0.02, 0.9);          // solenoide engata o pinhão
      if (p.key === 2) this.clunk(t + 0.01, 0.6);            // pinhão desengata
    }
    if (p.running && !now.running && st.eng.stalled) this.beep(t, 1500, 0.6, 0.06);
    // trava de segurança
    if (now.locked !== p.locked) { this.clunk(t, 0.5); this.click(t + 0.06, 1.2); }
    // botões
    if (now.throttle !== p.throttle) this.click(t, 0.6);
    if (now.mode !== p.mode || now.autoIdle !== p.autoIdle || now.mat !== p.mat) this.click(t, 0.8);

    for (const id in now.s) {
      const a = p.s[id], b = now.s[id];
      const f = st.f[id];
      // carretel saindo do centro / voltando: clique + "baque" do óleo assumindo a carga
      if (a === 0 && b > 0) {
        this.click(t, 0.7);
        const pr = Math.max(f.pA || 0, f.pB || 0);
        this.tone(t + 0.005, { f: 120, f2: 70, dur: 0.12, gain: 0.05 + 0.15 * clamp(pr / 300, 0, 1) });
      }
      if (a > 0.05 && b === 0) {
        this.click(t, 0.5);
        // golpe de aríete: a coluna de óleo para de repente
        this.tone(t + 0.004, { f: 95, f2: 55, dur: 0.16, gain: 0.08 + 0.12 * clamp(a, 0, 1) });
      }
      // cilindro batendo no fim de curso
      if (now.blocked[id] && !p.blocked[id] && ['boom', 'arm', 'bucket'].includes(id)) this.metalHit(t, 0.8);
    }

    // cavitação: estalos de bolhas implodindo na bomba
    if (st.alerts.cav) {
      const n = Math.random() < dt * 30 ? 1 : 0;
      if (n) this.burst(t, { f: 4500, Q: 3, dur: 0.008, gain: 0.12 + Math.random() * 0.1 });
    }
    // gotas de óleo do vazamento
    const leak = st.pumps[1].leak + st.f.arm.leak;
    if (leak > 0.5 && Math.random() < dt * leak * 0.6) {
      this.tone(t, { f: 1400 + Math.random() * 600, f2: 500, dur: 0.05, gain: 0.025 });
    }
    // alarme sonoro (óleo quente, nível baixo)
    this.beepT -= dt;
    if ((st.alerts.hot || st.alerts.lowOil) && this.beepT <= 0) {
      this.beepT = 0.7;
      this.beep(t, 2600, 0.14, 0.05);
      this.beep(t + 0.2, 2600, 0.14, 0.05);
    }
  }

  // nível RMS (para teste/medidor)
  level() {
    if (!this.analyser) return 0;
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let s = 0, pk = 0;
    for (const v of a) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
    return { rms: Math.sqrt(s / a.length), peak: pk };
  }
}
