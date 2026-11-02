// Roteiro do modo apresentação. Cada cena define:
//   title/text      legenda (text pode mudar ao longo da cena com "notes")
//   ui              'clean' = só a máquina em tela cheia · 'full' = com instrumentos e comandos
//   cam             enquadramento {cx, cy, w} em pixels da cena (ou função que segue algo)
//   focus           componentes destacados (o resto esmaece); [] = sem destaque
//   insets          quadros auxiliares visíveis: 'plan', 'valve', 'legend'
//   layers          camadas: { labels, values }
//   prep            estado inicial (motor ligado?, pose em graus [lança, braço, caçamba], acelerador…)
//   moves           [início (s), duração (s), { boom, arm, bucket, swing, tl, tr, start, boost }]
//                   valores de -1 a 1: boom + = sobe · arm + = recolhe · bucket + = enche
//                   swing: desabilitado (vista 2D) · tl/tr = esteiras (sempre juntas) · start/boost = segurar botão
//   events          [instante (s), função(st, params)] para mudanças pontuais
//   notes           [instante (s), texto] troca o texto da legenda durante a cena
//   duration        duração total (s); no modo automático avança sozinho ao final

const FULL = { cx: 700, cy: 392, w: 1400 };
// enquadramentos em coordenadas da cena (OX = 420, OY = 480, 72 px/m)
const X = (x) => 420 + x * 72;
const Y = (y) => 480 - y * 72;

export const SCENES = [
  {
    title: 'Uma escavadeira por dentro',
    text: 'Vinte toneladas movidas por um líquido. O motor diesel não move a lança: ele gira bombas que empurram óleo, e é o óleo, sob pressão, que faz toda a força.',
    ui: 'clean', cam: { cx: 640, cy: 330, w: 1250 }, focus: [], insets: [], layers: { labels: true, values: false },
    prep: { running: true, throttle: 6, pose: [16, -104, -67] },
    moves: [[2, 3, { boom: 0.6 }], [5.5, 2, { arm: -0.5 }], [8.5, 2.5, { boom: -0.5, arm: 0.4 }]],
    duration: 12,
  },
  {
    title: 'De onde vem a força',
    text: 'Girando a chave, o motor de partida faz o diesel pegar. O motor gira duas bombas de pistões (P1 e P2) e uma bomba piloto pequena.',
    ui: 'full', cam: { cx: X(-0.85), cy: Y(2.05), w: 600 },
    focus: ['engine', 'pumps', 'pilotPump', 'hoseSuction', 'hosePump', 'tank'], insets: [], layers: { labels: true, values: true },
    prep: { running: false, throttle: 4, pose: [16, -104, -67] },
    events: [
      [1, (st) => { st.key = 1; }],
      ...[5, 6, 7, 8, 9, 10].map((v, i) => [6 + i * 0.35, (st) => { st.throttle = v; }]),
    ],
    moves: [[2.5, 1.4, { start: 1 }], [10.5, 3.5, { boom: 1 }], [14.5, 2.5, { boom: -1 }]],
    notes: [
      [5.5, 'Acelerando, as bombas giram mais rápido e podem entregar mais óleo por minuto (vazão).'],
      [10.5, 'Quando a lança sobe, o óleo encontra resistência: aí aparece a PRESSÃO. A placa inclinada dentro da bomba ajusta quanto óleo sai a cada volta.'],
    ],
    duration: 18,
  },
  {
    title: 'Tanque, filtro e radiador',
    text: 'O óleo sai do tanque pela sucção, trabalha e volta pela linha de retorno, passando pelo radiador e pelo filtro.',
    ui: 'full', cam: { cx: X(-0.95), cy: Y(2.0), w: 680 },
    focus: ['tank', 'radiator', 'hoseReturn', 'hoseSuction'], insets: [], layers: { labels: true, values: false },
    prep: { running: true, throttle: 8, pose: [15, -50, 20] },
    moves: [[3, 2.2, { boom: 1 }], [5.2, 3, { arm: 1, bucket: 1 }], [9.5, 2.6, { arm: -1, bucket: -1 }], [12.2, 1.8, { boom: -0.7 }]],
    notes: [
      [3, 'Repare no tanque: quando os cilindros estendem, o nível CAI. O óleo sai do tanque e fica guardado dentro dos cilindros.'],
      [9.5, 'Recolhendo os cilindros, o óleo volta e o nível sobe de novo.'],
    ],
    duration: 15,
  },
  {
    title: 'O comando: joystick, piloto e válvulas',
    text: 'O joystick não move a máquina diretamente: ele manda óleo piloto (roxo), de baixa pressão, para o bloco de válvulas.',
    ui: 'full', cam: { cx: X(1.6), cy: Y(2.3), w: 920 },
    focus: ['cab', 'lockValve', 'hosePilot', 'valve', 'pilotPump'], insets: ['valve'], layers: { labels: true, values: false },
    prep: { running: true, throttle: 7, pose: [16, -104, -67] },
    moves: [[2, 2.5, { boom: 1 }], [7, 2.5, { boom: 1 }], [10.5, 2.5, { bucket: -0.45 }], [13.5, 2.5, { boom: -1 }]],
    notes: [
      [2, 'O óleo piloto empurra o carretel no bloco de válvulas (veja o detalhe no canto), que abre caminho para o óleo da bomba.'],
      [10.5, 'Joystick pela metade, carretel pela metade: passa menos óleo e o movimento fica mais lento. É assim que o operador dosa a velocidade.'],
    ],
    duration: 17,
  },
  {
    title: 'O cilindro: força = pressão × área',
    text: 'Para subir, o óleo entra no lado A (fundo), que tem área grande: muita força. O óleo do lado B volta para o tanque.',
    ui: 'full',
    cam: (sc, st) => { const c = st.geo.cyl.boom; const a = sc.P(c.base), b = sc.P(c.end); return { cx: (a[0] + b[0]) / 2 + 40, cy: (a[1] + b[1]) / 2, w: 620 }; },
    focus: ['boomCyl', 'hoseWork-boom', 'boom'], insets: ['legend'], layers: { labels: false, values: true, pumpValues: false },
    prep: { running: true, throttle: 8, pose: [16, -104, -67] },
    moves: [[2, 3.2, { boom: 1 }], [7, 3, { boom: -1 }], [11.5, 2.2, { boom: 1 }]],
    notes: [
      [7, 'Para descer, o óleo entra no lado B (da haste). Como a haste ocupa espaço, a área é menor: o mesmo óleo move o pistão mais rápido.'],
      [11.5, 'A pressão (bar) multiplicada pela área do pistão dá a força. Por isso cilindros grossos levantam mais peso.'],
    ],
    duration: 15,
  },
  {
    title: 'Lança, braço e caçamba',
    text: 'Três articulações, quatro cilindros. Cada movimento tem seu próprio carretel e suas duas mangueiras.',
    ui: 'clean',
    cam: (sc, st) => { const a = sc.P(st.geo.B0), b = sc.P(st.geo.tip); return { cx: (a[0] + b[0]) / 2 + 30, cy: (a[1] + b[1]) / 2 - 10, w: 1100 }; },
    focus: ['boom', 'arm', 'bucket', 'boomCyl', 'armCyl', 'bucketCyl', 'hoseWork-boom', 'hoseWork-arm', 'hoseWork-bucket'], insets: [], layers: { labels: true, values: false },
    prep: { running: true, throttle: 8, pose: [16, -104, -67] },
    moves: [
      [1.5, 2.2, { boom: 1 }], [4.5, 2.5, { arm: -1 }], [7.6, 1.6, { bucket: -1 }],
      [9.8, 2.2, { bucket: 1 }], [12.6, 2.5, { arm: 1 }], [15.6, 2, { boom: -1 }],
    ],
    notes: [
      [1.5, 'LANÇA: dois cilindros levantam tudo o que está pendurado.'],
      [4.5, 'BRAÇO: o cilindro de cima empurra a "cauda" do braço e ele gira no pino.'],
      [7.6, 'CAÇAMBA: o cilindro gira a caçamba por meio de dois elos, que funcionam como alavanca.'],
      [12.6, 'Combinando os três, a ponta dos dentes chega a qualquer ponto ao alcance.'],
    ],
    duration: 18,
  },
  {
    title: 'Andando sobre as esteiras',
    text: 'Cada esteira tem seu próprio motor hidráulico na roda traseira. As duas alavancas para frente: a máquina anda.',
    ui: 'clean', cam: (sc) => ({ cx: sc.X(1.6), cy: 410, w: 1150 }),
    focus: ['travelMotor', 'tracks', 'swivel', 'planView', 'hoseWork-travelL', 'hoseWork-travelR'], insets: ['plan'], layers: { labels: true, values: false },
    prep: { running: true, throttle: 9, pose: [30, -100, -90] },
    moves: [[1.5, 2.6, { tl: 0.55, tr: 0.55 }], [5.5, 2.6, { tl: -0.55, tr: -0.55 }]],
    notes: [
      [5.5, 'Para trás: o óleo entra pelo outro lado dos motores.'],
    ],
    duration: 9.5,
  },
  {
    title: 'A válvula de alívio: o limite de segurança',
    text: 'Quando o cilindro chega ao fim do curso, o óleo não tem para onde ir e a pressão dispara.',
    ui: 'full', cam: FULL,
    focus: ['valve', 'hosePump', 'boomCyl', 'pumps'], insets: ['valve'], layers: { labels: true, values: true },
    prep: { running: true, throttle: 8, pose: [40, -100, -90] },
    moves: [[2, 5.5, { boom: 1 }], [9.5, 3.5, { boom: 1, boost: 1 }]],
    notes: [
      [3.2, 'A válvula de alívio abre perto de 343 bar e devolve o óleo ao tanque. Ouve o chiado? É energia virando calor no óleo.'],
      [9.5, 'Reforço de força: por alguns segundos o ajuste sobe para 373 bar. Veja no gráfico de pressão.'],
    ],
    duration: 14,
  },
  {
    title: 'Tudo junto: um ciclo de escavação',
    text: 'Abrir, descer, puxar, encher, levantar, descarregar, voltar. Um operador experiente faz isso em menos de 20 segundos.',
    ui: 'full', cam: { cx: 760, cy: 392, w: 1400 },
    focus: [], insets: ['plan'], layers: { labels: false, values: false },
    prep: { running: true, throttle: 9, pose: [28, -104, -67] },
    moves: [
      [1, 1.8, { arm: -1, bucket: -1 }],
      [3, 1.4, { boom: -1 }],
      [4.6, 2.6, { arm: 1, bucket: 0.6 }],
      [7.3, 1.0, { bucket: 1 }],
      [8.4, 3.8, { boom: 1 }],
      [13.4, 1.6, { bucket: -1, arm: -0.4 }],
      [15.4, 2.3, { bucket: 0.5 }],
      [18.2, 2.2, { boom: -0.7, arm: 0.3 }],
    ],
    notes: [
      [4.6, 'Puxar o braço e fechar a caçamba: é aqui que a pressão sobe e o motor faz força.'],
      [8.4, 'Levantar com a caçamba cheia: as duas bombas trabalham juntas.'],
      [13.4, 'Descarregar e recomeçar.'],
    ],
    duration: 21.5,
  },
];
