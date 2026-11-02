// Sintetizador de motor diesel 6 cilindros, 4 tempos (roda na thread de áudio).
// Cada explosão é um "pulso" que excita ressonadores (escapamento, bloco, carcaça).
// Sem combustível (partida/desligando) os pulsos viram só "compressões" fracas.

function makeRes(freq, bw, gain) {
  const r = Math.exp((-Math.PI * bw) / sampleRate);
  const w = (2 * Math.PI * freq) / sampleRate;
  const a1 = 2 * r * Math.cos(w), a2 = -r * r;
  // normaliza: ganho no pico de ressonância = "gain"
  const re = 1 - a1 * Math.cos(w) - a2 * Math.cos(2 * w);
  const im = a1 * Math.sin(w) + a2 * Math.sin(2 * w);
  return { a1, a2, b0: gain * Math.hypot(re, im), y1: 0, y2: 0 };
}
function runRes(s, x) {
  const y = s.b0 * x + s.a1 * s.y1 + s.a2 * s.y2;
  s.y2 = s.y1; s.y1 = y;
  return y;
}

class DieselEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 0, minValue: 0, maxValue: 4000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'fuel', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.phase = 0; this.next = 0; this.cyl = 0;
    this.env = 0; this.knock = 0; this.prevN = 0; this.rumble = 0;
    // pequenas diferenças entre cilindros deixam o som "vivo" (nenhum motor é perfeito)
    this.jit = [1.0, 0.91, 1.07, 0.96, 1.04, 0.94];
    this.res = [
      makeRes(85, 35, 0.5),    // pulso do escapamento
      makeRes(190, 70, 0.35),  // corpo do motor
      makeRes(520, 160, 0.18), // bloco / cabeçote
      makeRes(1350, 420, 0.08), // ruído mecânico
    ];
  }
  process(_in, outputs, p) {
    const out = outputs[0][0];
    const rpm = p.rpm[0], load = p.load[0], fuel = p.fuel[0];
    const revPerSample = rpm / 60 / sampleRate;
    const dEnv = Math.exp(-1 / (sampleRate * (0.0045 - 0.0015 * load)));
    const dKnock = Math.exp(-1 / (sampleRate * 0.0007));
    for (let i = 0; i < out.length; i++) {
      this.phase += revPerSample;
      if (this.phase >= this.next) {
        // 6 cilindros, 4 tempos: 3 explosões por volta do virabrequim
        this.next += 1 / 3;
        const j = this.jit[this.cyl] * (0.9 + 0.2 * Math.random());
        if (fuel > 0.5) {
          this.env = (0.45 + 0.55 * load) * j;
          this.knock = (0.25 + 0.25 * (1 - load)) * j; // "batida" típica do diesel, mais clara em marcha lenta
        } else {
          this.env = 0.2 * j * Math.min(1, rpm / 150);
          this.knock = 0;
        }
        this.cyl = (this.cyl + 1) % 6;
      }
      if (this.phase > 1e6) { this.phase -= 1e6; this.next -= 1e6; }
      const n = Math.random() * 2 - 1;
      const x = this.env * (0.6 + 0.4 * n);
      this.env *= dEnv;
      let y = 0;
      for (const r of this.res) y += runRes(r, x);
      const hp = n - this.prevN; this.prevN = n;
      const kn = this.knock * hp * 0.35; this.knock *= dKnock;
      this.rumble += (n - this.rumble) * 0.015;
      const rum = this.rumble * 0.25 * Math.min(1, rpm / 1500);
      out[i] = Math.tanh(y + kn + rum);
    }
    return true;
  }
}
registerProcessor('diesel-engine', DieselEngine);
