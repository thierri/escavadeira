// Textos explicativos de cada componente + valores ao vivo.
import { fmt } from '../render/svg.js';

const bar = (v) => `${fmt(v)} bar`;
const lpm = (v) => `${fmt(v)} L/min`;

export const INFO = {
  _intro: {
    t: 'Como usar',
    d: '1) Gire a <b>chave de ignição</b> até <b>Partida</b> e segure até o motor pegar (ou segure Enter). 2) Mexa os joysticks com o mouse, teclado ou controle. Clique em qualquer peça da máquina para entender o que ela faz.',
  },
  engine: {
    t: 'Motor diesel',
    d: 'É a fonte de toda a energia. Ele não move a lança diretamente: só gira as bombas hidráulicas. Quanto mais as bombas exigem, mais torque o motor precisa entregar. Se a carga passar do que ele aguenta, a rotação cai (motor "forçado").',
    live: (s) => [['Rotação', `${fmt(s.eng.rpm)} rpm`], ['Alvo', `${fmt(s.eng.target)} rpm`], ['Potência entregue', `${fmt(s.eng.outKW)} kW`], ['Diesel', `${fmt(s.eng.fuelLh, 1)} L/h`]],
  },
  radiator: {
    t: 'Radiadores (água e óleo)',
    d: 'Todo óleo que volta ao tanque passa pelo radiador de óleo. A energia "perdida" nas válvulas (principalmente quando a válvula de alívio abre) vira calor no óleo. O ventilador, movido pelo motor, sopra ar e tira esse calor.',
    live: (s) => [['Óleo', `${fmt(s.oil.T, 1)} °C`], ['Calor gerado', `${fmt(s.oil.heatKW)} kW`], ['Calor removido', `${fmt(s.oil.coolKW)} kW`]],
  },
  pumps: {
    t: 'Bombas principais (P1 e P2)',
    d: 'Duas bombas de pistões, em série no mesmo eixo, transformam o giro do motor em vazão de óleo. A placa inclinada (linha preta dentro de cada bomba) muda o curso dos pistões: mais inclinada, mais óleo por volta. A bomba não "cria" pressão: a pressão aparece quando o óleo encontra resistência (a carga).',
    live: (s) => [['P1', `${bar(s.pumps[0].p)} · ${lpm(s.pumps[0].q)}`], ['P2', `${bar(s.pumps[1].p)} · ${lpm(s.pumps[1].q)}`], ['Potência', `${fmt(s.pumps[0].kw + s.pumps[1].kw)} kW`]],
  },
  pilotPump: {
    t: 'Bomba piloto',
    d: 'Uma bomba pequena, de engrenagens, que mantém um circuito de baixa pressão (cerca de 40 bar). Esse óleo não move a máquina: ele é o "sinal" que os joysticks mandam para empurrar os carretéis das válvulas.',
    live: (s) => [['Pressão piloto', bar(s.pilot.supply)], ['Após a trava', bar(s.pilot.out)]],
  },
  lockValve: {
    t: 'Válvula de bloqueio do piloto',
    d: 'Nas máquinas reais ela é ligada à alavanca de segurança e corta o óleo piloto quando o operador sobe ou desce da cabine. Neste simulador ela fica sempre liberada.',
    live: (s) => [['Estado', s.locked ? 'TRAVADO' : 'liberado']],
  },
  tank: {
    t: 'Tanque de óleo hidráulico',
    d: 'Guarda o óleo e deixa ele descansar (soltar ar e esfriar). Repare que o nível CAI quando os cilindros estendem: o óleo sai do tanque e fica guardado dentro dos cilindros. Tem tela de sucção, filtro de retorno e respiro.',
    live: (s) => [['Volume', `${fmt(s.oil.tank)} L`], ['Retorno chegando', lpm(s.oil.returnQ)]],
  },
  valve: {
    t: 'Bloco de válvulas (comando principal)',
    d: 'Uma "central de distribuição" com um carretel para cada movimento. O óleo piloto empurra o carretel para um lado ou para o outro: isso decide para qual lado do cilindro o óleo vai (A ou B) e quanto passa. Com tudo parado, o óleo das bombas passa direto de volta ao tanque.',
    live: (s) => ['boom', 'arm', 'bucket', 'swing'].map((id) => [{ boom: 'Lança', arm: 'Braço', bucket: 'Caçamba', swing: 'Giro' }[id], `${fmt(s.f[id].s * 100)}% aberto`]),
  },
  swingMotor: {
    t: 'Motor de giro',
    d: 'Um motor hidráulico com redutor que gira a parte de cima sobre a coroa (o rolamento gigante). Neste simulador 2D o giro está desabilitado: vemos a máquina sempre de lado.',
    live: (s) => [['Velocidade', `${fmt((s.swing.w * 60) / (2 * Math.PI), 1)} rpm`], ['Pressão', bar(Math.max(s.f.swing.pA, s.f.swing.pB))]],
  },
  swivel: {
    t: 'Junta rotativa central',
    d: 'Como a parte de cima gira sem parar, uma mangueira comum se enrolaria. A junta rotativa é um eixo com canais internos que deixa o óleo passar para as esteiras em qualquer ângulo de giro.',
    live: (s) => [['Esteira esq.', lpm(s.f.travelL.q)], ['Esteira dir.', lpm(s.f.travelR.q)]],
  },
  travelMotor: {
    t: 'Motores de translação',
    d: 'Cada esteira tem seu próprio motor hidráulico na roda motriz traseira. Neste simulador as duas alavancas andam juntas: para frente a máquina avança, para trás ela recua.',
    live: (s) => [['Esquerda', `${fmt(s.trackV[0] * 3.6, 1)} km/h`], ['Direita', `${fmt(s.trackV[1] * 3.6, 1)} km/h`]],
  },
  tracks: {
    t: 'Esteiras e chassi inferior',
    d: 'Distribuem o peso de ~20 toneladas no chão e dão estabilidade para cavar. Nesta vista lateral em corte a máquina só anda para frente e para trás.',
  },
  boomCyl: {
    t: 'Cilindros da lança (2)',
    d: 'Dois cilindros lado a lado levantam a lança e tudo o que está pendurado nela. O lado A (fundo) tem área maior: empurra com mais força e mais devagar. O lado B (haste) tem área menor, porque a haste ocupa espaço.',
    live: (s) => [['Lado A', bar(s.f.boom.pA)], ['Lado B', bar(s.f.boom.pB)], ['Força', `${fmt(Math.abs(s.f.boom.F) / 1000)} kN cada`]],
  },
  armCyl: {
    t: 'Cilindro do braço',
    d: 'Puxa o braço para dentro (o principal movimento de escavar) ou empurra para fora. É ele que arrasta a caçamba pelo solo, por isso costuma ser o que mais sofre na escavação.',
    live: (s) => [['Lado A', bar(s.f.arm.pA)], ['Lado B', bar(s.f.arm.pB)], ['Força', `${fmt(Math.abs(s.f.arm.F) / 1000)} kN`]],
  },
  bucketCyl: {
    t: 'Cilindro da caçamba e elos',
    d: 'Gira a caçamba por meio de dois elos (o "H"). Os elos funcionam como alavanca: deixam a caçamba girar quase 180° com um cilindro curto.',
    live: (s) => [['Lado A', bar(s.f.bucket.pA)], ['Lado B', bar(s.f.bucket.pB)], ['Força', `${fmt(Math.abs(s.f.bucket.F) / 1000)} kN`]],
  },
  boom: { t: 'Lança', d: 'A peça grande que sai da máquina. É oca, feita de chapas soldadas: forte e o mais leve possível. Pesa perto de 1,8 tonelada.', live: (s) => [['Ângulo', `${fmt((s.geo.tb * 180) / Math.PI)}°`]] },
  arm: { t: 'Braço', d: 'Liga a lança à caçamba. Seu comprimento define até onde e quão fundo a máquina alcança.', live: (s) => [['Alcance', `${fmt(s.geo.tip[0], 1)} m`], ['Profundidade', `${fmt(-s.tip.y, 1)} m`]] },
  bucket: {
    t: 'Caçamba',
    d: 'Corta o solo com os dentes e guarda a terra. Quanto mais fundo e mais duro o material, maior a força necessária e maior a pressão no sistema.',
    live: (s) => [['Carga', `${fmt(s.soil.load, 2)} m³`], ['Resistência do solo', `${fmt(s.tip.digF / 1000)} kN`]],
  },
  cab: { t: 'Cabine e joysticks', d: 'Os joysticks não empurram óleo de alta pressão: eles são pequenas válvulas que liberam óleo piloto. É por isso que um esforço leve da mão comanda forças de dezenas de toneladas.' },
  counterweight: { t: 'Contrapeso', d: 'Um bloco de ferro fundido de várias toneladas na traseira. Equilibra o peso da lança e da carga para a máquina não tombar para frente.' },
  housing: { t: 'Compartimento (em corte)', d: 'Aqui vemos por dentro da carcaça: motor, bombas, tanque e válvulas. As cores das mangueiras mostram a pressão de cada linha em tempo real.' },
  ground: { t: 'Solo', d: 'Escolha o material em Parâmetros. Areia é fácil; cascalho exige muita força e faz a válvula de alívio abrir.' },
  hoseSuction: { t: 'Linha de sucção', d: 'Mangueira grossa e de baixa pressão: leva o óleo do tanque para as bombas. Se ela ou a tela entupirem, a bomba "passa fome" e cavita (bolhas que destroem a bomba).', live: (s) => [['Vazão', lpm(s.pumps[0].q + s.pumps[1].q)]] },
  hosePump: { t: 'Linhas de pressão das bombas', d: 'Levam o óleo das bombas até o bloco de válvulas. São as linhas que mais sofrem: chegam a mais de 340 bar.', live: (s) => [['P1', bar(s.pumps[0].p)], ['P2', bar(s.pumps[1].p)]] },
  hoseReturn: { t: 'Linha de retorno', d: 'Todo óleo que sai dos cilindros e motores volta por aqui, passa pelo radiador e pelo filtro e cai no tanque.', live: (s) => [['Vazão', lpm(s.oil.returnQ)]] },
  hosePilot: { t: 'Linhas piloto (roxas)', d: 'Mangueiras finas de comando. A intensidade do roxo mostra a pressão que cada joystick está mandando para o seu carretel.', live: (s) => [['Disponível', bar(s.pilot.out)]] },
  hoseWork: { t: 'Linhas de trabalho', d: 'Cada cilindro tem duas mangueiras: uma para empurrar (lado A) e outra para puxar (lado B). Enquanto uma recebe óleo da bomba, a outra devolve óleo ao tanque. Os tracinhos brancos mostram o sentido do fluxo.' },
  planView: { t: 'Vista de cima', d: 'Mostra para onde a parte de cima está apontando. A vista lateral sempre acompanha o braço. Na frente existe a área de escavação; nos lados você pode descarregar a terra.' },
  chart: { t: 'Gráfico de pressão', d: 'Mostra a pressão das duas bombas nos últimos 15 segundos. A linha vermelha tracejada é o ajuste da válvula de alívio: a pressão nunca passa dela.' },
};

export class InfoPanel {
  constructor(root) {
    this.root = root;
    this.body = document.createElement('div'); this.body.className = 'info-body';
    root.appendChild(this.body);
    this.h = root.querySelector('h4');
    this.show(null);
  }
  show(id) {
    if (id && id.startsWith('hoseWork')) id = 'hoseWork';
    this.id = id && INFO[id] ? id : '_intro';
    const it = INFO[this.id];
    this.h.textContent = it.t;
    this.body.innerHTML = `<p>${it.d}</p><div class="live"></div>`;
    this.live = this.body.querySelector('.live');
    this.lastLive = '';
  }
  update(st) {
    const it = INFO[this.id];
    if (!it.live) return;
    const html = it.live(st).map(([k, v]) => `<span><em>${k}</em>${v}</span>`).join('');
    if (html !== this.lastLive) { this.live.innerHTML = html; this.lastLive = html; }
  }
}
