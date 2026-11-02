# Guia: diagramas interativos de máquinas

Este documento registra **como** o simulador da escavadeira foi pensado e construído, para servir de
receita na criação de diagramas de outras máquinas curiosas (guindaste, trator, motor a combustão,
eclusa, prensa, elevador, avião etc.).

Cada diagrama tem dois usos ao mesmo tempo:

1. **Vídeo explicativo**: tudo precisa caber numa tela 16:9, legível quando gravado.
2. **Playground**: a pessoa mexe nos comandos e nos parâmetros e vê a física responder.

---

## 1. Princípios

| Princípio | Na prática |
|---|---|
| **Mostrar o mecanismo de verdade** | Nada de "caixa mágica". Se o óleo vai da bomba à válvula e depois ao cilindro, a mangueira aparece fazendo esse caminho. |
| **Uma tela só, 16:9, sem rolagem** | Palco fixo de 1920×1080 px, escalado para caber na janela. Nunca há barra de rolagem. |
| **Técnico e limpo** | Cores chapadas, contorno escuro, grade discreta ao fundo. Sem sombras realistas nem texturas pesadas. |
| **Cor carrega informação** | Cada cor significa algo e é sempre a mesma coisa (veja a seção 3). Cor decorativa só na estrutura da máquina. |
| **Causa e efeito visíveis** | Comando → sinal → válvula → fluxo → movimento → carga → pressão. Cada elo dessa corrente aparece na tela. |
| **Público leigo e curioso** | Nomes em português simples. Termos técnicos aparecem, mas sempre explicados no painel de informação. |
| **Física plausível, não exata** | Os números são próximos dos reais (ordem de grandeza certa), mas o modelo é simplificado para ser estável e entendível. |

---

## 2. Layout do palco (1920×1080)

```
┌───────────────────────── barra superior (56 px) ─────────────────────────┐
│ título · camadas (mostrar/ocultar) · velocidade · pausa · parâmetros     │
├───────────────────────────────────────────────┬──────────────────────────┤
│                                               │                          │
│   CENA PRINCIPAL  1400 × 784                  │  PAINEL DE INSTRUMENTOS  │
│   - máquina em vista lateral (corte)          │  520 × 784               │
│   - sistema sobreposto (mangueiras, fluxo)    │  - relógios analógicos   │
│   - insets: vista de cima, detalhe da válvula │  - barras                │
│   - legenda de cores                          │  - gráfico no tempo      │
│                                               │  - luzes de aviso        │
│                                               │  (a gaveta de parâmetros │
│                                               │   abre por cima dele)    │
├───────────────────────────────────────────────┴──────────────────────────┤
│ COMANDOS (240 px): ignição · acelerador · modo · trava · joysticks ·     │
│ alavancas · painel de informação do componente clicado                   │
└───────────────────────────────────────────────────────────────────────────┘
```

Regras do layout:

- **Escala única**: `#stage` tem 1920×1080 e recebe `transform: scale(k)`, com `k = min(largura/1920, altura/1080)`.
  Tudo é desenhado em pixels "de palco" e nunca quebra em outra resolução.
- **A máquina é a protagonista**: ocupa a maior região e fica um pouco à esquerda, deixando espaço para o
  braço se estender para a direita.
- **Insets nos cantos vazios**: os quadros auxiliares (vista de cima, detalhe da válvula, legenda) vão onde
  a máquina nunca chega. Antes de posicionar, calcule o alcance máximo das partes móveis.
- **Nomes dos componentes internos numa "prateleira"**: abaixo da máquina, em duas colunas, com linha que
  desce na vertical e segue na horizontal. Para as linhas não se cruzarem, ordene as linhas da coluna esquerda
  por x crescente e as da direita por x decrescente.
- **Nomes das peças móveis acompanham a peça** (a posição do texto é recalculada a cada quadro).

---

## 3. Linguagem visual

### Cores com significado

| Cor | Significado |
|---|---|
| Azul → verde → amarelo → laranja → vermelho | **Pressão** do fluido (0 → ~350 bar). O vermelho é "no limite da válvula de alívio". |
| Roxo (claro → forte) | **Sinal de comando** (circuito piloto). A intensidade é a pressão do sinal. |
| Tracinhos brancos andando | **Sentido e velocidade do fluxo**. Parado = sem fluxo. |
| Amarelo-máquina | Estrutura metálica (lança, braço, caçamba, contrapeso). |
| Cinza-azulado | Componentes mecânicos internos (motor, bombas, válvulas). |
| Marrom | Solo e material. |
| Brilho azul ao redor | Componente selecionado (clicado). |

Mantenha a mesma escala de pressão em **todas** as máquinas hidráulicas e pneumáticas. Para outras
grandezas, use a mesma ideia: **frio/baixo = azul, quente/alto = vermelho**.

### Recursos visuais que funcionam bem

- **Vista em corte (cutaway)**: a carcaça vira um retângulo claro com contorno, e os componentes internos
  aparecem dentro dela.
- **Cilindros em corte**: barril escuro com as duas câmaras pintadas pela pressão, o pistão e a haste.
  Assim se vê a diferença de área entre o lado do fundo (A) e o lado da haste (B).
- **Indicadores dentro das peças**: a placa inclinada da bomba gira com a vazão, o volante do motor gira com
  a rotação, o carretel desliza no bloco de válvulas, e o nível do tanque sobe e desce.
- **Inset de detalhe**: quando uma peça é pequena demais na escala da máquina (o bloco de válvulas), desenhe
  uma versão ampliada num canto, ligada aos mesmos dados.
- **Inset de outra vista**: a vista lateral não mostra o giro, então uma vista de cima resolve.
- **Valores numéricos opcionais**: etiquetas escuras com os números (pressão, vazão) que podem ser ocultadas
  na barra de camadas, para cenas mais limpas no vídeo.

---

## 4. Arquitetura do código

Tecnologia: **HTML + SVG + JavaScript puro (módulos ES)**, sem etapa de build e sem framework.
O SVG é nítido em qualquer resolução (ótimo para gravar em 4K) e fácil de inspecionar.

```
escavadeira/
├── index.html            palco 1920×1080 e regiões
├── css/style.css         tipografia, cores, componentes de interface
├── js/
│   ├── main.js           monta tudo, laço principal, escala do palco
│   ├── config.js         parâmetros padrão, materiais, modos
│   ├── audio/
│   │   ├── sound.js      sistema de som: grafo Web Audio, sons contínuos e eventos
│   │   └── engine-worklet.js  sintetizador do motor diesel (roda na thread de áudio)
│   ├── present/
│   │   ├── presentation.js  motor do modo apresentação (câmera, legenda, roteiro, teclas)
│   │   └── scenes.js        roteiro: as cenas, em forma de dados
│   ├── sim/
│   │   ├── kinematics.js geometria: ângulos → posições, dL/dθ
│   │   └── simulation.js física: motor, bombas, válvulas, atuadores, carga, solo, calor
│   ├── render/
│   │   ├── svg.js        utilitários (criar elementos, escala de cores, caminhos)
│   │   ├── scene.js      máquina, mangueiras, cilindros, terreno, insets, rótulos
│   │   └── panel.js      relógios, barras, gráfico, luzes
│   └── ui/
│       ├── controls.js   ignição, acelerador, joysticks, alavancas, teclado, controle
│       ├── info.js       textos de cada componente + valores ao vivo
│       └── params.js     gaveta de parâmetros e falhas
└── docs/guia-diagramas-interativos.md   (este arquivo)
```

Regras que valem para qualquer máquina:

1. **Simulação separada do desenho.** `simulation.js` não sabe que existe SVG. Ele recebe um `state` e
   avança `dt`. Isso permite testar a física no Node, sem navegador:
   `node -e "import('./js/sim/simulation.js').then(...)"`.
2. **Passo fixo para a física** (240 Hz), **desenho por quadro** (`requestAnimationFrame`). A velocidade
   da simulação (¼×, ½×, 2×) só multiplica o tempo acumulado.
3. **Todo o estado num objeto só** (`st`). Os comandos escrevem em `st.input`, a física lê `st.input` e
   escreve o resto, e o desenho só lê. Exposto em `window.sim` para depurar e roteirizar vídeos.
4. **Construir o SVG uma vez, atualizar atributos a cada quadro.** Nada de recriar elementos no laço.
5. **Peças rígidas desenhadas em metros**: grupos com `transform="translate(..) rotate(..) scale(S, -S)"`
   e `vector-effect: non-scaling-stroke`. Assim as formas são escritas em metros, com y para cima.
6. **Coisas que se deformam** (mangueiras, cilindros, elos, terreno) são calculadas em pixels de tela a cada
   quadro.

---

## 5. Como modelar a física (método genérico)

Toda máquina deste tipo é uma **cadeia de energia**. Escreva a cadeia antes de escrever código:

```
fonte de energia → conversor → controle → atuador → carga
(motor diesel)     (bombas)    (válvulas)  (cilindros) (peso + solo)
```

Para cada elo, defina: **o que entra, o que sai, o que se perde (vira calor)** e **o que o operador controla**.

### 5.1 Modelo quase-estático de pressão (o truque principal)

Em vez de simular a compressibilidade do óleo (instável e lenta), a cada passo encontramos **a pressão que
equilibra as vazões** de cada bomba:

```
vazão que a bomba entrega(p) = Σ vazão aceita por cada consumidor(p)
                             + vazão de centro aberto(p)
                             + vazão pela válvula de alívio(p)
```

- A bomba entrega `min(vazão comandada, potência limite × 600 / p)` (o limite de potência faz a vazão cair
  quando a pressão sobe).
- Cada consumidor aceita `K × abertura × √(p − p_carga)` (orifício).
- A válvula de alívio aceita muita vazão acima do seu ajuste, e por isso a pressão nunca passa dele.
- O lado direito sempre cresce com `p`, então uma **bissecção** de ~48 iterações acha a resposta, de forma
  estável e barata.

Unidades práticas: bar, L/min, kW (`kW = bar × L/min / 600`).

### 5.2 Cinemática por ângulos

- O **estado** da máquina são os ângulos das articulações, não os comprimentos dos cilindros.
- `solve(ângulos)` calcula a posição de tudo (pinos, pontas, comprimentos dos cilindros, elos).
- `dL/dθ` (derivada numérica) converte:
  - velocidade do cilindro → velocidade angular: `dθ/dt = v / (dL/dθ)`
  - torque na articulação → força no cilindro: `F = −τ / (dL/dθ)` (trabalho virtual)
- **Antes de desenhar, valide a geometria numericamente.** `dL/dθ` não pode trocar de sinal nem chegar
  perto de zero dentro da faixa de movimento, senão o cilindro "perde a alavanca" e o movimento trava.
  Um script que varre os pontos de fixação e escolhe os melhores resolve isso em segundos.
- Garanta `Lmín ≥ curso + ~0,35 m` (a haste precisa caber no barril quando recolhida).

### 5.3 Carga

- **Gravidade**: o torque de cada articulação é a soma de `−(x_cm − x_pino) × m × g` das peças a jusante.
- **Ferramenta no material** (solo): uma força contra a direção pretendida do movimento, proporcional à
  profundidade e à dureza do material. Cortar "de frente" resiste mais, puxar para cima resiste menos.
- **Pressão de carga** = força ÷ área da câmara que empurra. A pressão exibida nunca passa do alívio de linha.

### 5.4 Efeitos de segunda ordem que ensinam muito

| Efeito | Por que incluir |
|---|---|
| Rotação do motor cai sob carga | Mostra que a energia vem do motor. |
| Fim de curso → alívio abre → luz acende → óleo esquenta | Liga pressão, segurança e calor. |
| Nível do tanque cai quando os cilindros estendem | Surpreende e mostra que o óleo "mora" nos cilindros. |
| Lado da haste é mais rápido e mais fraco | Mostra área × pressão = força. |
| Trava de segurança corta o piloto | Mostra a diferença entre comando e potência. |
| Falhas (vazamento, filtro entupido, alívio desregulado, bomba gasta) | Viram cenas de vídeo prontas. |

---

## 6. Som

O som **não usa arquivos gravados**: tudo é sintetizado em tempo real com a **Web Audio API** a partir
do estado da simulação. Assim o som nunca "descola" da física: se a rotação cai, o motor engrossa; se a
válvula de alívio abre, ela guincha na mesma hora e com intensidade proporcional à vazão.

### 6.1 Duas famílias de som

| Tipo | Como funciona | Exemplos na escavadeira |
|---|---|---|
| **Contínuos** | Uma fonte sempre ligada (oscilador, ruído ou worklet) cujo volume, tom e filtro seguem uma grandeza física a cada quadro (`setTargetAtTime`, que suaviza as mudanças e evita estalos). | motor diesel, turbo, ventilador, motor de partida, chiado das bombas, alívio, óleo passando nas válvulas, giro, translação, escavação, terra caindo |
| **Eventos** | Sons curtos disparados quando algo **muda** entre um quadro e outro (compara o estado atual com o anterior). | chave de ignição, solenoide da partida, autoteste do painel, cliques de carretel, golpe de aríete, cilindro batendo no fim de curso, sapatas da esteira, trava de segurança, bolhas de cavitação, gotas de óleo, alarmes |

### 6.2 Mapa "física → som" (a parte que dá realismo)

| Som | Ligado a | Regra |
|---|---|---|
| Motor diesel | rotação, carga, combustível | Frequência das explosões = rpm/60 × (cilindros/2). Mais carga = pulsos mais fortes e filtro mais aberto (som mais "rouco"). Sem combustível, só compressões fracas (partida e desligamento). |
| Motor de partida | chave em "partida" e motor não pegou | Zumbido elétrico cujo tom sobe com a rotação + engrenagens raspando. |
| Bombas de pistão | rotação e pressão | Tom = rpm/60 × nº de pistões (9). Volume cresce com a pressão. |
| Válvula de alívio | vazão pelo alívio | Guincho agudo com vibrato + jato de ruído estreito. |
| Óleo nas válvulas | potência perdida no estrangulamento (vazão × queda de pressão) | Chiado de ruído filtrado. |
| Giro | velocidade de giro | Zumbido grave + engrenagem do pinhão. |
| Esteiras | velocidade de cada esteira | Uma batida metálica a cada passo de sapata (~19 cm percorridos). |
| Escavação | força do solo × velocidade da ponta | Ruído grave granulado; no cascalho, também raspagem e estalos de pedra. |
| Fim de curso | cilindro bloqueado com carretel aberto | Pancada metálica grave + "tilintar" do aço. |
| Carretel abre/fecha | abertura passa de 0 para >0 e vice-versa | Clique + baque grave proporcional à pressão (golpe de aríete). |

### 6.3 Técnicas de síntese usadas

- **Motor por pulsos + ressonadores** (`engine-worklet.js`): cada explosão gera um pulso curto que excita
  quatro ressonadores (escapamento ~85 Hz, corpo ~190 Hz, bloco ~520 Hz, mecânica ~1,3 kHz). Uma pequena
  diferença fixa entre cilindros e um pouco de aleatoriedade em cada explosão deixam o motor "vivo".
  Um ruído agudo e curto em cada explosão imita a "batida" típica do diesel.
- **Ruído filtrado** (branco ou marrom) com filtros passa-faixa/passa-baixa: jatos, chiados, terra, vento.
- **Osciladores** (dente de serra, triângulo, senoide) para zumbidos tonais: bombas, partida, giro, turbo.
- **Rajadas e tons curtos com envelope exponencial** para cliques, pancadas e bipes.
- **Compressor no final** do grafo (master → compressor → saída) para segurar picos sem distorcer.

### 6.4 Regras práticas

1. **O áudio só liga após um gesto do usuário** (regra dos navegadores). Escute o primeiro clique/tecla
   e mostre no botão "Clique para ativar".
2. **Normalize os ressonadores pelo ganho no pico**, senão a saída satura (vira um zumbido distorcido).
   Meça: um `AnalyserNode` ligado ao nó dá RMS e pico, e o pico deve ficar abaixo de ~0,8.
3. **Hierarquia de volume**: parado < marcha lenta < trabalhando < alívio aberto (o som mais alto, como na
   máquina real). Ajuste medindo o RMS do mix em cada situação.
4. **Pausa = silêncio**: com a simulação pausada, o volume geral vai a zero.
5. **Botão de mudo e volume sempre visíveis** na barra superior.
6. Em desenvolvimento, carregue o worklet com `?v=` + data para evitar cache.
7. Se um dia quiser sons gravados (amostras reais), mantenha o mesmo mapa física → som: troque só a fonte
   (um `AudioBufferSourceNode` em loop com `playbackRate` ligado à rotação).

---

## 7. Modo apresentação (para gravar o vídeo)

O mesmo simulador vira uma sequência de **cenas**, como slides. Cada cena tem câmera, destaque, legenda e
movimentos automáticos. O botão **▶ Apresentação** na barra superior começa da cena 1.

### 7.1 Teclas

| Tecla | Ação |
|---|---|
| → / Espaço / PageDown | próxima cena |
| ← / PageUp | cena anterior |
| R | repete a cena atual (para regravar) |
| A | modo automático: avança sozinho ao fim de cada cena (vídeo inteiro numa tomada) |
| H | alterna "só a máquina" ↔ "com instrumentos e comandos" |
| P | pausa |
| 1–9, 0 | vai direto para a cena |
| Esc | volta ao playground |

A barra de dicas e a barra de progresso aparecem por ~3 s e somem sozinhas, para não sair no vídeo.

### 7.2 Uma cena é só dados

As cenas ficam em `js/present/scenes.js`. Para criar, reordenar ou ajustar o texto, não é preciso mexer
no motor:

```js
{
  title: 'O cilindro: força = pressão × área',
  text: 'Texto inicial da legenda…',
  ui: 'full',                      // 'clean' = só a máquina em tela cheia · 'full' = com painéis
  cam: { cx: 520, cy: 300, w: 620 }, // enquadramento em pixels da cena (ou função que segue algo)
  focus: ['boomCyl', 'hoseWork-boom'], // destacados; o resto esmaece
  insets: ['legend'],              // 'plan', 'valve', 'legend'
  layers: { labels: false, values: true, pumpValues: false },
  capPos: 'left',                  // só no modo 'clean': legenda à esquerda ou à direita
  prep: { running: true, throttle: 8, pose: [16, -104, -67] }, // estado inicial
  moves: [[2, 3.2, { boom: 1 }], [7, 3, { boom: -1 }]],         // [início, duração, comandos]
  events: [[5.5, (st) => { st.locked = false; }]],              // mudanças pontuais
  notes: [[7, 'Texto que troca a legenda aos 7 s…']],
  duration: 15,
}
```

Os comandos usam nomes "de máquina", não de joystick: `boom` (+ sobe), `arm` (+ recolhe),
`bucket` (+ enche), `swing` (+ direita), `tl`/`tr` (esteiras), `start` e `boost` (segurar botões).
Cada comando entra e sai com uma rampa de 0,3 s, como a mão de um operador.

### 7.3 Técnicas

- **Câmera = `viewBox` do SVG.** O enquadramento é animado com aproximação exponencial
  (`cam += (alvo − cam) × (1 − e^(−2,2·dt))`), que é suave e funciona tanto para alvos parados quanto para
  alvos que se movem (a câmera pode seguir a caçamba).
- **Duas camadas de SVG**: a cena (que a câmera move) e uma camada fixa por cima (`#overlay`) com os quadros
  auxiliares, que não devem dar zoom junto.
- **Destaque por `data-comp`**: todo elemento clicável tem um `data-comp`. O destaque põe a classe `dim`
  na cena, e o CSS esmaece tudo que não tem `.focus`. Use ids específicos quando precisar (ex.:
  `hoseWork-boom` em vez de todas as mangueiras de trabalho).
- **Estado determinístico**: ao entrar numa cena, a simulação é recriada do zero e preparada (`prep`).
  Assim cada tomada sai igual, o que é ótimo para regravar só um trecho.
- **Roteiro conduz os comandos de verdade**: o roteiro escreve no mesmo lugar que os joysticks
  (`controls.override`). Por isso os joysticks, o acelerador e a alavanca de segurança na tela se movem
  sozinhos, e a física, os relógios e o som respondem exatamente como no playground.
- **Legenda**: no modo `clean`, um bloco grande no canto inferior. No modo `full`, ela ocupa o lugar do
  quadro de informação (canto inferior direito), sem cobrir a máquina.

### 7.4 Dicas de roteiro (aprendidas na prática)

- **Circuito em paralelo: o óleo vai para quem resiste menos.** Lança e caçamba estão na mesma bomba: se as
  duas forem comandadas juntas, a caçamba (mais leve) anda e a lança quase não sai do lugar. Para uma cena
  didática, faça os movimentos em sequência.
- **Empurrar a lança contra o chão não afunda a caçamba**: quem faz a penetração é o braço puxando. Comece
  com a lança alta e deixe o braço cavar.
- **Pose inicial no ar** quando a cena não é sobre escavar, senão a caçamba "cava sem querer".
- **Confira cada cena com números** (ângulos, pressões, carga) rodando o roteiro pelo console
  (`sim.pres.go(n)`, `sim.st`) antes de olhar o visual.
- **A legenda não pode cobrir o que está em destaque**: ajuste `cam` ou `capPos`.
- **Zoom aumenta tudo, inclusive as etiquetas de valores**: esconda as que ficariam cortadas
  (`pumpValues: false`).

### 7.5 Como gravar

1. Abra o simulador no navegador em tela cheia (F11 ou ⌃⌘F no Mac).
2. Clique uma vez na página para liberar o som.
3. Clique em **▶ Apresentação** e espere a dica sumir.
4. Comece a gravar (OBS, QuickTime etc.) e avance com → (ou ligue o automático com **A**).
5. Errou? **R** repete a cena do mesmo jeito.

---

## 8. Receita para uma máquina nova

1. **Pesquisar** o funcionamento e anotar números típicos (potência, pressões, vazões, massas, dimensões).
2. **Escrever a cadeia de energia** (seção 5) e a lista de componentes, separada em: fonte, conversão,
   controle, atuação, carga e proteção.
3. **Listar comandos, indicadores e sons** pensando no operador real (o que ele toca, o que ele lê) e no espectador
   (o que precisa ver para entender).
4. **Desenhar o layout 16:9** no papel: onde fica a máquina, até onde as partes móveis vão, onde cabem os insets.
5. **Cinemática primeiro**, validada no Node com números.
6. **Física em seguida**, validada no Node com um "roteiro" de testes (ligar, mover cada atuador, fim de curso,
   carga máxima) imprimindo pressões e vazões.
7. **Desenho estático**, depois ligar aos dados.
8. **Painel e comandos.**
9. **Som**: liste os sons contínuos e os eventos, monte o mapa física → som (seção 6) e meça os níveis.
10. **Textos explicativos** de cada componente (2 ou 3 frases, linguagem simples, com um "porquê").
11. **Revisão visual e sonora**
12. **Roteiro do modo apresentação**: escreva as cenas como dados (seção 7) e confira cada uma. em 1920×1080: sobreposições, textos cortados, legibilidade, cores.

---

## 9. Checklist de qualidade

- [ ] Nada sai do palco 1920×1080; nenhuma rolagem.
- [ ] Texto mínimo de ~11 px no palco (legível no vídeo em 1080p).
- [ ] Cada cor usada tem significado e está na legenda.
- [ ] Todo componente visível pode ser clicado e tem explicação.
- [ ] Com a máquina parada, nada "treme" (sem oscilação numérica).
- [ ] Fins de curso, limites e falhas se comportam de forma plausível.
- [ ] Camadas podem ser ocultadas para cenas mais limpas.
- [ ] Funciona com mouse, teclado e controle de videogame.
- [ ] Todo movimento e todo evento importante tem som, e o som segue a física.
- [ ] O áudio não satura (pico < ~0,8) e o alívio é o som mais alto.
- [ ] Cada cena do modo apresentação foi conferida com números e visualmente; a legenda não cobre o destaque.

---

## 10. Armadilhas já encontradas

- **Geometria de ligações "no chute" não funciona**: o primeiro palpite deixou o braço e a caçamba sem
  alavanca (`dL/dθ ≈ 0`). Resolvido com busca numérica dos pontos de fixação.
- **Motor que apaga ao pegar**: o limite de "motor apagou" estava acima da rotação de ignição. O limite de
  apagar precisa ficar abaixo da rotação em que o motor pega.
- **Caçamba enchia de uma vez**: o corte do solo precisa ser limitado pela velocidade da ponta
  (`largura × profundidade × velocidade × dt`).
- **Pressões exibidas acima do alívio**: a carga estática pode passar do ajuste, então limite o valor exibido
  ao alívio de linha.
- **Mangueiras se cruzando**: escolha as rotas pensando em "colunas" e "faixas de altura" para cada
  linha. Alguns cruzamentos são inevitáveis, e o contorno escuro em cada mangueira deixa isso legível.
- **Motor sintetizado saturando**: os ressonadores sem normalização davam ganho enorme no pico e a saída
  ficou cravada em ±1 (RMS 0,98). Normalizar pelo ganho no pico resolveu.
- **Servidor local na pasta Desktop (macOS)**: processos iniciados fora do terminal podem não ter permissão
  de leitura. Rode o servidor pelo terminal.

---

## 11. Como rodar

```bash
cd escavadeira
python3 -m http.server 8765
```

Abra `http://localhost:8765`. Atalhos:

| Ação | Teclado | Controle |
|---|---|---|
| Ligar/desligar ignição | I | — |
| Partida (segurar) | Enter | Start |
| Alavanca de segurança | L | Y |
| Joystick esquerdo (braço / giro) | W A S D | analógico esquerdo |
| Joystick direito (lança / caçamba) | setas | analógico direito |
| Esteira esquerda / direita | Q Z / E C | LB LT / RB RT |
| Reforço de força | Espaço | A |
| Acelerador | + / − | — |

O som liga no primeiro clique ou tecla. O botão **Som** na barra superior deixa mudo, e o controle ao lado
ajusta o volume.

No console do navegador, `sim.st` dá acesso ao estado completo (útil para roteirizar cenas), e
`sim.sound.level()` mede o volume do mix.

---

## 12. Próximos passos previstos

- **Zoom de componentes**: corte animado da bomba de pistões, do carretel e da válvula de alívio.
- **Renderização quadro a quadro** (tempo determinístico) para exportar vídeo sem travadas.
