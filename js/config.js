// Parâmetros ajustáveis (painel "Parâmetros"). Valores típicos de uma
// escavadeira de ~20 toneladas.
export const DEFAULTS = {
  engineKW: 110,        // potência nominal do motor diesel
  ratedRpm: 2000,
  idleRpm: 800,
  pumpCc: 112,          // cilindrada máxima de cada bomba principal (cm³/rev)
  reliefBar: 343,       // válvula de alívio principal
  boostBar: 373,        // alívio com "reforço de força"
  pilotBar: 39,         // pressão do circuito piloto
  boomBore: 120, boomRod: 85,      // mm (2 cilindros)
  armBore: 135, armRod: 95,
  bucketBore: 115, bucketRod: 80,
  material: 'terra',
  ambientC: 25,
  coolerPct: 100,
  faults: { hoseLeak: false, suctionClog: false, reliefStuck: false, pumpWorn: false },
};

export const MATERIALS = {
  areia: { nome: 'Areia', dens: 1600, res: 55e3 },
  terra: { nome: 'Terra', dens: 1800, res: 85e3 },
  argila: { nome: 'Argila', dens: 2000, res: 125e3 },
  cascalho: { nome: 'Cascalho', dens: 2100, res: 175e3 },
};

export const MODES = {
  E: { nome: 'Econômico', rpm: 0.9, power: 0.72 },
  S: { nome: 'Padrão', rpm: 0.96, power: 0.85 },
  P: { nome: 'Potência', rpm: 1.0, power: 0.97 },
};

export function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}
