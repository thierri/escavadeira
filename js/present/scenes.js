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
//   link            [início (s), fim (s)] mostra o selo com SITE_LINK na tela
//   cams            [instante (s), {cx, cy, w}] muda o enquadramento ao longo da cena (zoom)
//   focuses         [instante (s), [componentes]] muda o destaque ao longo da cena
//   spots           [instante (s), alvo] holofote: 'scene' | 'panel' | 'controls' | 'topbar' |
//                   [x, y, w, h] em px do palco (1920×1080) | { sel: 'seletor CSS', i, pad } | null
//   duration        duração total (s); no modo automático avança sozinho ao final
//   segurarNaEspera no vídeo, mantém os comandos enquanto o roteiro espera a narração
//                   (padrão: os joysticks voltam ao centro durante a espera)

// Endereço onde o simulador fica disponível (aparece na tela na cena 1). Troque pelo link real.
export const SITE_LINK = 'thierri.github.io/escavadeira';

const FULL = { cx: 700, cy: 392, w: 1400 };
// enquadramentos em coordenadas da cena (OX = 420, OY = 480, 72 px/m)
const X = (x) => 420 + x * 72;
const Y = (y) => 480 - y * 72;

// Regiões fixas do palco (px de 1920×1080) usadas pelo holofote
const R = {
  body: [176, 258, 400, 224],           // carcaça da máquina com a câmera em FULL
  legend: [10, 694, 312, 104],          // quadro "Pressão do óleo"
  valveBox: [1034, 66, 356, 294],       // quadro "Bloco de válvulas (detalhe)"
  dials1: [1408, 84, 504, 196],         // rotação e pressões P1/P2
  dials2: [1408, 272, 504, 168],        // piloto e temperaturas
  bars: [1408, 422, 504, 156],          // vazões, potência, diesel, terra, tanque
  chart: [1408, 556, 504, 164],         // gráfico de pressão
  lights: [1408, 724, 504, 108],        // luzes de aviso
};
const CTL = (i) => ({ sel: '#controls .ctl', i, pad: 4 });
// zoom nas peças de dentro da carcaça
const ZOOM = {
  housing: { cx: X(-0.62), cy: Y(2.05), w: 600 },
  engine: { cx: X(-1.85), cy: Y(2.0), w: 330 },
  pumps: { cx: X(-0.7), cy: Y(1.65), w: 280 },
  tank: { cx: X(-0.27), cy: Y(1.85), w: 290 },
  valve: { cx: X(0.7), cy: Y(1.75), w: 310 },
};
const INSIDE = ['housing', 'engine', 'radiator', 'pumps', 'pilotPump', 'tank', 'valve', 'swingMotor', 'lockValve', 'hoseSuction', 'hosePump', 'hoseReturn', 'hosePilot'];
const ALL_INSETS = ['plan', 'valve', 'legend'];
const ALL_LAYERS = { hoses: true, pilot: true, labels: true, values: true };
// movimento calmo de fundo, para a máquina parecer viva durante o tour
const IDLE_MOVES = (t0, n) => Array.from({ length: n }, (_, k) => [
  [t0 + k * 8, 2.4, { boom: 0.5 }], [t0 + k * 8 + 2.8, 2, { arm: -0.5 }], [t0 + k * 8 + 5.2, 2.4, { boom: -0.5, arm: 0.45 }],
]).flat();

export const SCENES = [
  // ================= PARTE 1 · O SIMULADOR =================
  {
    title: 'Um simulador de escavadeira hidráulica',
    text: 'Feito do zero, roda direto no navegador: a máquina em corte, com o motor, as bombas e todo o óleo funcionando em tempo real.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 7, pose: [16, -104, -67] },
    moves: IDLE_MOVES(1.5, 3),
    link: [7, 22],
    duration: 22,
  },
  {
    title: 'A tela, em quatro partes',
    text: 'No centro, o diagrama da máquina. À direita, os instrumentos. Embaixo, os comandos da cabine. Em cima, as opções.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 7, pose: [16, -104, -67] },
    moves: IDLE_MOVES(0.5, 2),
    spots: [[0.6, 'scene'], [4.6, 'panel'], [8.6, 'controls'], [12.6, 'topbar'], [15.5, null]],
    notes: [
      [0.6, 'O DIAGRAMA: a escavadeira em vista lateral, aberta como um desenho em corte.'],
      [4.6, 'OS INSTRUMENTOS: relógios, barras, gráfico e luzes de aviso, como no painel de uma máquina de verdade.'],
      [8.6, 'OS COMANDOS: chave de ignição, acelerador, joysticks e alavancas de translação.'],
      [12.6, 'A BARRA DE CIMA: camadas do desenho, som, parâmetros e este modo de apresentação.'],
    ],
    duration: 16,
  },
  {
    title: 'O diagrama: a máquina em corte',
    text: 'Por dentro da carcaça: motor diesel, bombas, tanque e bloco de válvulas. Por fora: lança, braço, caçamba e esteiras.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 8, pose: [16, -104, -67] },
    moves: [[5, 2.6, { boom: 1 }], [8.5, 2.6, { arm: -1 }], [14, 1.8, { bucket: -1 }], [16.5, 1.8, { bucket: 1 }], [19.5, 2.4, { boom: -0.8, arm: 0.8 }]],
    // "Dentro da carcaça ficam o motor, as bombas, o tanque e o bloco de válvulas. Fora dela, a lança..."
    cams: [[0, FULL], [0.9, ZOOM.housing], [1.3, ZOOM.engine], [1.7, ZOOM.pumps], [2.1, ZOOM.tank], [2.5, ZOOM.valve],
      [2.9, FULL], [10, ZOOM.housing], [14, FULL]],
    focuses: [[0, []], [0.9, INSIDE], [1.3, ['engine', 'radiator']], [1.7, ['pumps', 'pilotPump']], [2.1, ['tank', 'hoseReturn', 'hoseSuction']],
      [2.5, ['valve', 'hosePilot']], [2.9, ['boom', 'arm', 'bucket', 'boomCyl', 'armCyl', 'bucketCyl', 'tracks', 'travelMotor']],
      [3.2, ['boom', 'boomCyl']], [3.5, ['arm', 'armCyl']], [3.8, ['bucket', 'bucketCyl']], [4.1, ['tracks', 'travelMotor']], [4.6, []]],
    spots: [[5, R.legend], [9.9, null], [14, R.valveBox], [19, null]],
    notes: [
      [5, 'A cor de cada mangueira é a pressão do óleo: azul é baixa, vermelho é perto do limite. Os tracinhos brancos andam no sentido do fluxo. Roxo é o circuito de comando.'],
      [10, 'Tudo é animado pela física: os pistões do motor, a fumaça do escapamento, as bombas e o nível do tanque.'],
      [14, 'No canto, o bloco de válvulas em detalhe: cada carretel desliza conforme o joystick é movido.'],
      [19, 'E clicando em qualquer peça aparece o que ela faz, com os valores ao vivo.'],
    ],
    duration: 23,
  },
  {
    title: 'Os instrumentos',
    text: 'O painel da direita mostra, em números, o que o desenho mostra em cores.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 6, pose: [24, -100, -80] },
    events: [...[7, 8, 9, 10].map((v, i) => [3.5 + i * 0.4, (st) => { st.throttle = v; }])],
    moves: [[3.5, 2.6, { boom: 1 }], [6.6, 2.2, { boom: -1 }], [9, 3.6, { arm: 1, bucket: 1 }], [13.2, 3.2, { arm: -1, bucket: -1 }], [18.6, 12, { boom: 1 }]],
    spots: [[0.4, 'panel'], [3, R.dials1], [8, R.dials2], [12.6, R.bars], [18, R.chart], [25.8, R.lights], [31, null]],
    notes: [
      [3, 'Rotação do motor e a pressão de cada bomba, P1 e P2. Acelerando, o ponteiro de rotação sobe.'],
      [8, 'Pressão do circuito piloto e as temperaturas do óleo e do motor.'],
      [12.6, 'Vazão das bombas, potência hidráulica, consumo de diesel, terra na caçamba e o nível do tanque.'],
      [18, 'O gráfico guarda os últimos 15 segundos de pressão. Levantando a lança até o fim do curso, a pressão sobe até a linha vermelha do alívio.'],
      [25.8, 'E as luzes de aviso acendem quando algo passa do limite: aqui, a válvula de alívio abrindo.'],
    ],
    duration: 31,
  },
  {
    title: 'Os comandos da cabine',
    text: 'Tudo o que um operador usa, e também funciona com mouse, teclado ou controle de videogame.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: false, throttle: 4, pose: [16, -104, -67] },
    events: [
      [3, (st) => { st.key = 1; }],
      ...[5, 6, 7, 8, 9].map((v, i) => [9.2 + i * 0.4, (st) => { st.throttle = v; }]),
    ],
    moves: [
      [4.4, 1.6, { start: 1 }],
      [13, 2.2, { arm: -0.9 }], [15.4, 1.6, { arm: 0.9 }],
      [17.6, 2, { boom: 1 }], [19.8, 1.4, { bucket: -1 }], [21.4, 1.4, { bucket: 1 }],
      [23.6, 3, { tl: 0.6, tr: 0.6 }],
    ],
    spots: [[0.4, 'controls'], [2, CTL(0)], [8.4, CTL(1)], [12.4, CTL(2)], [17, CTL(4)], [23, CTL(3)], [27.4, null]],
    notes: [
      [2, 'A chave de ignição: gira para Ligado e segura em Partida até o motor pegar. Ao soltar, ela volta sozinha.'],
      [8.4, 'O acelerador define a rotação do motor e, com ela, quanto óleo as bombas conseguem mandar.'],
      [12.4, 'Joystick esquerdo: o braço vai para fora e para dentro.'],
      [17, 'Joystick direito: a lança sobe e desce; para os lados, a caçamba enche e despeja.'],
      [23, 'E as alavancas de translação: as duas juntas levam a máquina para frente ou para trás.'],
    ],
    duration: 28,
  },
  {
    title: 'Camadas, som e parâmetros',
    text: 'Na barra de cima ficam as opções do simulador.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 7, pose: [16, -104, -67] },
    moves: IDLE_MOVES(1, 3),
    events: [
      [2, (st, p, app) => app.setLayers({ hoses: false })], [3.4, (st, p, app) => app.setLayers({ hoses: true })],
      [4, (st, p, app) => app.setLayers({ labels: false })], [5.2, (st, p, app) => app.setLayers({ labels: true })],
      [10.4, (st, p, app) => app.showDrawer(true)], [19, (st, p, app) => app.showDrawer(false)],
    ],
    spots: [[0.4, { sel: '#layers' }], [6.4, { sel: '#sound' }], [9.4, { sel: '#btn-params' }], [11, { sel: '#drawer', pad: 0 }], [19.4, { sel: '#btn-present' }], [23, null]],
    notes: [
      [0.4, 'Camadas: dá para esconder as mangueiras, o circuito piloto, os nomes e os valores, e olhar uma coisa de cada vez.'],
      [6.4, 'O som é sintetizado na hora a partir da física: motor, bombas, válvula de alívio. Aqui liga, silencia e ajusta o volume.'],
      [9.4, 'Em Parâmetros dá para mudar a máquina: pressão de alívio, potência do motor, bombas, cilindros e o tipo de solo.'],
      [14.6, 'E também simular falhas, como uma mangueira vazando ou a sucção entupida, e ver o efeito nos instrumentos.'],
      [19.4, 'E este é o modo apresentação, que estou usando agora para mostrar como a máquina funciona.'],
    ],
    duration: 23,
  },

  // ================= PARTE 2 · COMO A ESCAVADEIRA FUNCIONA =================
  {
    title: 'Como uma escavadeira funciona',
    text: 'Vinte toneladas movidas por um líquido. O motor diesel não move a lança: ele gira bombas que empurram óleo, e é o óleo, sob pressão, que faz toda a força.',
    ui: 'clean', cam: { cx: 640, cy: 330, w: 1250 }, focus: [], insets: [], layers: { labels: true, values: false },
    prep: { running: true, throttle: 6, pose: [16, -104, -67] },
    moves: [[2, 3, { boom: 0.6 }], [5.5, 2, { arm: -0.5 }], [8.5, 2.5, { boom: -0.5, arm: 0.4 }]],
    duration: 12,
  },
  {
    title: 'De onde vem a força',
    text: 'Girando a chave, o motor de partida faz o diesel pegar. O motor gira duas bombas de pistões (P1 e P2) e uma bomba piloto pequena.',
    ui: 'full', cam: { cx: X(-1.5), cy: Y(2.1), w: 700 },
    focus: ['engine', 'pumps', 'pilotPump', 'hoseSuction', 'hosePump', 'tank'], insets: [], layers: { labels: true, values: true },
    prep: { running: false, throttle: 4, pose: [16, -104, -67] },
    events: [
      [1, (st) => { st.key = 1; }],
      ...[5, 6, 7, 8, 9, 10].map((v, i) => [6 + i * 0.35, (st) => { st.throttle = v; }]),
    ],
    moves: [[2.5, 1.4, { start: 1 }], [10.5, 3.5, { boom: 1 }], [14.5, 2.5, { boom: -1 }]],
    notes: [
      [2.6, 'O motor pega: os pistões começam a subir e descer, cada cilindro explode na sua vez e o escapamento solta fumaça.'],
      [5.5, 'Acelerando, as bombas giram mais rápido e podem entregar mais óleo por minuto (vazão). Repare: mais rotação, mais fumaça.'],
      [10.5, 'Quando a lança sobe, o óleo encontra resistência: aí aparece a PRESSÃO. A placa inclinada dentro da bomba ajusta quanto óleo sai a cada volta.'],
    ],
    duration: 18,
  },
  {
    title: 'Tanque, filtro e radiador',
    text: 'O óleo sai do tanque pela sucção, trabalha e volta pela linha de retorno, passando pelo radiador e pelo filtro.',
    ui: 'full', cam: { cx: X(-1.3), cy: Y(2.0), w: 760 },
    focus: ['tank', 'radiator', 'hoseReturn', 'hoseSuction'], insets: [], layers: { labels: true, values: false },
    prep: { running: true, throttle: 8, pose: [15, -50, 20] },
    moves: [[3, 2.2, { boom: 1 }], [5.2, 3, { arm: 1, bucket: 1 }], [9.5, 2.6, { arm: -1, bucket: -1 }], [12.2, 1.8, { boom: -0.7 }]],
    notes: [
      [3, 'Repare no tanque: quando os cilindros estendem, o nível CAI. O óleo sai do tanque e fica guardado dentro dos cilindros.'],
      [7, 'O óleo que volta cai no tanque pelo filtro de retorno, e as bolhas sobem até a superfície.'],
      [9.5, 'Recolhendo os cilindros, o óleo volta e o nível sobe de novo.'],
    ],
    duration: 15,
  },
  {
    title: 'O comando: joystick, piloto e válvulas',
    text: 'O joystick não move a máquina diretamente: ele manda óleo piloto (roxo), de baixa pressão, para o bloco de válvulas.',
    ui: 'full', cam: { cx: X(1.4), cy: Y(2.5), w: 960 },
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
    moves: [[2, 11.8, { boom: 1 }], [9.5, 3.5, { boost: 1 }]],
    segurarNaEspera: true,   // no vídeo, mantém a lança forçando enquanto a narração explica
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
    focus: [], insets: ['valve'], layers: { labels: false, values: false },
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

  // ================= ENCERRAMENTO =================
  {
    title: 'Agora é a sua vez',
    text: 'O simulador está no link da tela e na descrição do vídeo. Mexa nos comandos, nos parâmetros e nas falhas.',
    ui: 'full', cam: FULL, focus: [], insets: ALL_INSETS, layers: ALL_LAYERS,
    prep: { running: true, throttle: 7, pose: [16, -104, -67] },
    moves: IDLE_MOVES(1, 3),
    link: [0.6, 999],
    duration: 14,
  },
];
