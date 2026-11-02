// Gaveta "Parâmetros": ajustes físicos e falhas simuladas.
import { DEFAULTS, MATERIALS } from '../config.js';

const SLIDERS = [
  ['reliefBar', 'Pressão da válvula de alívio', 'bar', 150, 420, 1],
  ['engineKW', 'Potência do motor', 'kW', 50, 180, 1],
  ['pumpCc', 'Tamanho das bombas', 'cm³/volta', 50, 170, 1],
  ['boomBore', 'Diâmetro cil. da lança', 'mm', 90, 170, 1],
  ['armBore', 'Diâmetro cil. do braço', 'mm', 100, 180, 1],
  ['bucketBore', 'Diâmetro cil. da caçamba', 'mm', 90, 160, 1],
  ['ambientC', 'Temperatura ambiente', '°C', -5, 45, 1],
  ['coolerPct', 'Eficiência do radiador', '%', 0, 100, 1],
];
const FAULTS = [
  ['hoseLeak', 'Mangueira do braço vazando', 'o braço cede sozinho e o óleo pinga'],
  ['suctionClog', 'Filtro de sucção entupido', 'a bomba "passa fome" e cavita'],
  ['reliefStuck', 'Válvula de alívio desregulada', 'abre cedo (120 bar): máquina fraca e óleo quente'],
  ['pumpWorn', 'Bomba gasta', 'vazamento interno: tudo fica mais lento'],
];

export class ParamsDrawer {
  constructor(root, getParams, onReset) {
    this.root = root; this.getParams = getParams;
    root.innerHTML = '';
    const head = document.createElement('div'); head.className = 'drawer-h';
    head.innerHTML = '<b>Parâmetros</b>';
    const close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Fechar';
    close.onclick = () => this.toggle(false);
    head.appendChild(close);
    root.appendChild(head);
    this.inputs = {};
    const grid = document.createElement('div'); grid.className = 'drawer-grid'; root.appendChild(grid);
    for (const [k, label, unit, min, max, stp] of SLIDERS) {
      const row = document.createElement('label'); row.className = 'prow';
      row.innerHTML = `<span>${label}</span><output></output>`;
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'range', min, max, step: stp });
      inp.oninput = () => {
        const P = this.getParams();
        P[k] = +inp.value;
        if (k.endsWith('Bore')) P[k.replace('Bore', 'Rod')] = Math.round(+inp.value * 0.7);
        if (k === 'reliefBar') P.boostBar = +inp.value + 30;
        this.refresh();
      };
      row.appendChild(inp);
      grid.appendChild(row);
      this.inputs[k] = { inp, out: row.querySelector('output'), unit };
    }
    const mat = document.createElement('div'); mat.className = 'prow';
    mat.innerHTML = '<span>Material do solo</span>';
    const seg = document.createElement('div'); seg.className = 'seg';
    this.matBtns = {};
    for (const k in MATERIALS) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = MATERIALS[k].nome;
      b.onclick = () => { this.getParams().material = k; this.refresh(); };
      seg.appendChild(b); this.matBtns[k] = b;
    }
    mat.appendChild(seg); root.appendChild(mat);
    const ft = document.createElement('div'); ft.className = 'faults';
    ft.innerHTML = '<span class="ft">Simular falhas</span>';
    this.faultIn = {};
    for (const [k, label, hint] of FAULTS) {
      const l = document.createElement('label'); l.className = 'fault';
      const c = document.createElement('input'); c.type = 'checkbox';
      c.onchange = () => { this.getParams().faults[k] = c.checked; };
      l.appendChild(c);
      const s = document.createElement('span'); s.innerHTML = `${label}<small>${hint}</small>`;
      l.appendChild(s);
      ft.appendChild(l); this.faultIn[k] = c;
    }
    root.appendChild(ft);
    const rs = document.createElement('button'); rs.className = 'btn wide'; rs.textContent = 'Voltar aos valores padrão';
    rs.onclick = () => {
      const P = this.getParams();
      const D = JSON.parse(JSON.stringify(DEFAULTS));
      Object.assign(P, D);
      this.refresh();
      onReset && onReset();
    };
    root.appendChild(rs);
    this.refresh();
  }
  refresh() {
    const P = this.getParams();
    for (const k in this.inputs) {
      const { inp, out, unit } = this.inputs[k];
      inp.value = P[k];
      out.textContent = `${P[k]} ${unit}`;
    }
    for (const k in this.matBtns) this.matBtns[k].classList.toggle('on', P.material === k);
    for (const k in this.faultIn) this.faultIn[k].checked = !!P.faults[k];
  }
  toggle(on) {
    this.open = on ?? !this.open;
    this.root.classList.toggle('open', this.open);
    if (this.open) this.refresh();
  }
}
