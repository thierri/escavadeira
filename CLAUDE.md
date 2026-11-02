# Escavadeira hidráulica · guia para começar uma sessão

Simulador 2D interativo de uma escavadeira de ~20 t (HTML + SVG + JavaScript puro, sem build e sem
dependências). Serve para gravar vídeo explicativo (modo apresentação) e como playground (modo simulação).
Textos da interface e comentários do código em **português**.

Leia antes de mexer:
- [`README.md`](README.md): o que o simulador faz, comandos, árvore de arquivos, `window.sim` no console.
- `documentacao/` (pasta local, fora do git, pode não existir): jornada do projeto, método para novas
  máquinas, pipeline do vídeo, referência técnica, guia original e roteiro do vídeo.

## Rodar

```bash
python -m http.server 8765
```

Abra http://localhost:8765. Precisa de HTTP (módulos ES não carregam via `file://`). Neste PC (Windows) o
comando é `python`; `python3` não existe. O `.claude/launch.json` já sobe esse servidor (nome `escavadeira`).
Depois de editar, recarregue com Ctrl+F5 (o navegador pode guardar os módulos em cache).

## Arquitetura em uma tela

- `js/main.js`: laço principal. Física em passo fixo de 240 Hz (`step(st, 1/240)`), desenho a cada quadro
  (`scene.update`, `panel.update`, `sound.update`). Expõe `window.sim = { st, params, scene, sound, reset, pres }`.
- `js/sim/simulation.js`: física pura sobre um objeto de estado `st` (não conhece o DOM). Os comandos entram
  por `st.input` (`leftX/leftY/rightX/rightY/travelL/travelR`) e viram `cmd` no início de `step()`.
- `js/sim/kinematics.js`: `GEO` (pinos e comprimentos, em metros) e `solve()` (ângulos → posições).
- `js/render/scene.js`: toda a máquina. O SVG é criado uma vez em `build*()`, e a cada quadro só os atributos mudam.
- `js/ui/controls.js`: joysticks, alavancas, teclado e controle → `st.input`. No modo apresentação o roteiro
  manda pelo `controls.override`.
- `js/present/scenes.js`: roteiro das cenas (`moves`, `notes`, `focus` por `data-comp`, `spots`). São 15
  cenas: a parte 1 (cenas 1–6) é um tour pela interface e a parte 2 (cenas 7–15) explica a máquina. O
  roteiro de narração do vídeo fica em `documentacao/anexos/roteiro-video.md` (local); mude os dois juntos.
- **Holofote** (`spots` nas cenas, `setSpot` em `presentation.js`): uma moldura que escurece o resto do palco
  e aponta uma região. A região pode ser um nome (`'scene'`, `'panel'`, `'controls'`, `'topbar'`), um
  retângulo `[x, y, w, h]` em px de 1920×1080, ou `{ sel, i, pad }`, medido do DOM. Os eventos das cenas
  recebem `(st, params, app)`, e `app.setLayers` e `app.showDrawer` servem para demonstrar a interface.
- `js/ui/info.js`: texto de cada peça clicável, indexado pelo `data-comp`.

## Coordenadas do desenho (scene.js)

- Cena: 1400×784 px, `S = 72` px/m, origem `OX = 420, OY = 480`. `X(x)`, `Y(y)` e `P([x,y])` convertem
  metros em px; y cresce para cima nos metros e para baixo nos px.
- `gUpper` é a estrutura superior em **metros** (`scale(S, -S)`). Use `vector-effect: non-scaling-stroke`
  (`NSS`) para o traço não escalar.
- **Carcaça ampliada:** tudo o que fica dentro da carcaça (motor, bombas, tanque, válvulas, motor de giro)
  é desenhado em `gBody` em "coordenadas da carcaça" e ampliado por `BODY.k = 1.25` a partir de
  `(BODY.ax, BODY.ay)`. Para converter um ponto da carcaça em metros da máquina, use `H([x, y])`. Toda
  mangueira ou rótulo que aponte para dentro da carcaça precisa passar por `H()`. Exemplos: `mapH()` em
  `updateHoses`, `UB()` em `buildLabels`. Lança, braço, caçamba, cilindros e esteiras **não** são ampliados.
- `HOUSE` guarda os limites da carcaça já ampliada. `CAB_DY` é quanto a cabine subiu. A máscara
  `#boomGhost` deixa o pé da lança translúcido sobre a carcaça.
- Constantes de layout no topo de `scene.js`: `VALVE`, `PUMP_CX`, `SHAFT_Y`, `TANK` e `STACK_TOP`.

## Decisões já tomadas (não desfazer sem o usuário pedir)

- **Sem giro.** A vista é um corte lateral 2D: `cmd.swing = 0` em `simulation.js`, `lx2 = 0` em
  `controls.js`, sem rótulos de giro no joystick e sem a cena do giro na apresentação. A seção "Giro" do bloco
  de válvulas continua desenhada, mas aparece apagada ("desat.").
- **Esteiras sempre juntas, só frente/trás.** Vale a alavanca com maior comando, e as duas se movem juntas. O
  rumo (`st.heading`) não muda mais em `step()`.
- **Interface enxuta:** não existem mais o controle de velocidade nem o botão de pausa (a velocidade é fixa
  em 1×, e a pausa só existe no modo apresentação, pela tecla P). Também saíram o "Modo de trabalho" (fica
  sempre em `'S'`, e o reforço continua no Espaço) e a alavanca de segurança (`st.locked` é sempre `false`; a
  válvula de bloqueio continua desenhada e sempre liberada). No lugar da luz "TRAVA" entrou "LENTA AUTO".
- **Som começa ligado:** o botão da barra superior é só um ícone de alto-falante (liga/mudo) mais o volume.
  O navegador só libera áudio no primeiro clique ou tecla em qualquer lugar da página, e esse primeiro
  clique não conta como "mudo" (`unlockedNow` em `main.js`).
- **Ignição é uma chave giratória** (`buildKey`/`drawKey` em `controls.js`): Desligado (−60°), Ligado (0°)
  e Partida (+60°, volta sozinha para Ligado ao soltar). Funciona arrastando, clicando na posição ou
  clicando no meio da chave (liga/desliga). As teclas I e Enter continuam valendo.
- **Visual da carcaça:** motor 4 cilindros com pistões, bielas e explosão (ordem 1-3-4-2), fumaça do
  escapamento proporcional à rotação (mais escura com carga), bombas P1/P2 em corte com placa inclinada,
  tanque com onda, jato de retorno, bolhas e sucção, e mangueiras finas (classe `Hose`).

## Como testar

- O navegador do app pausa o `requestAnimationFrame` quando o painel não está visível, e aí a simulação
  "congela". Para testar sem depender disso, rode a física e o desenho na mão pelo console da página:

```js
const m = await import('/js/sim/simulation.js'); const st = sim.st, sc = sim.scene;
const run = (s, inp) => { Object.assign(st.input, {leftX:0,leftY:0,rightX:0,rightY:0,travelL:0,travelR:0}, inp);
  for (let i = 0; i < s * 60; i++) { for (let k = 0; k < 4; k++) m.step(st, 1/240); sc.update(st, 1/60); } };
st.key = 2; run(2.5, {}); st.key = 1; st.locked = false; st.throttle = 10; run(1, { rightY: -1 });
```

- Para inspecionar detalhes, aproxime a câmera: `sim.scene.svg.setAttribute('viewBox', '170 175 420 236')`.
  Os quadros fixos ficam no `#overlay`. Volte com `'0 0 1400 784'`.
- Não há testes automatizados nem Node instalado neste PC. Depois de editar, confira que o console não
  mostra erros.

## Vídeo narrado (pasta `video/`)

O vídeo é a apresentação gravada quadro a quadro pelo **HyperFrames** (HeyGen), com a narração do usuário.

- `narracao.m4a` (raiz): gravação original. `video/edicao.json` é a lista de edição: início/fim, `cortes`
  (repetições e erros, cada um com o motivo), encurtamento automático de pausas e, por cena, `inicio` e
  `sync` (`[tempo no áudio original, tempo do roteiro]`). Os tempos vêm da transcrição do Whisper.
- `python -I -X utf8 video/tools/build.py`: corta o áudio (ffmpeg) e gera `video/project/` (projeto
  HyperFrames, gerado; não editar à mão). `video/tools/transcribe.py` transcreve com faster-whisper.
  `video/tools/mapear.py --orig t` converte o tempo do original para o tempo do vídeo; sem `--orig`, mostra
  as palavras do áudio limpo com o tempo no original.
- `video/src/driver.js` liga o simulador ao HyperFrames (`registerFrameSource`). O simulador roda em modo
  vídeo (`?video` ou `window.__VIDEO_MODE`): sem laço próprio, `sim.tick(dt, scriptDt)` por quadro,
  `Math.random` com semente e `resetFx()` no começo de cada cena. Por isso qualquer quadro sai sempre igual.
  Na sincronia, entre dois pontos o roteiro anda 1:1 e depois **espera** a fala. Durante a espera os
  joysticks voltam ao centro, a menos que a cena tenha `segurarNaEspera: true`.
- **Som da máquina**: o som do simulador é sintetizado ao vivo, então para o vídeo ele é gravado offline.
  Rode `python video/tools/som.py` e abra `http://localhost:8770/index.html?audio`. A página simula o vídeo
  inteiro num OfflineAudioContext (`sound.clock` dá o tempo de cada quadro; os sorteios do som usam uma
  sequência própria, para a física ficar igual à da imagem) e envia `video/build/som-maquina.wav`. Depois
  rode o `build.py`: ele abaixa a máquina sob a voz (sidechain) e cria a trilha `maquina`. O volume fica em
  `volume_maquina_db` no `edicao.json`. **Grave o som de novo sempre que a edição ou as cenas mudarem.**
- Studio para revisar: `.claude/launch.json` → `video` (ou `video\tools\preview.cmd`), em http://localhost:3002.
  No Studio há dois iframes da composição; o mais recente é o de `_t` maior.
- Render final: `npx hyperframes@0.9.3 render -o ../build/escavadeira.mp4`, dentro de `video/project`.
  Ferramentas instaladas neste PC: Node em `C:\Program Files\nodejs`, ffmpeg via winget (Gyan.FFmpeg) e
  faster-whisper (pip --user). No shell Bash, o PATH não tem node nem ffmpeg: exporte-os antes.

## Pendências conhecidas

- O README ainda fala em giro, em "10 cenas" (agora são 9), em velocidade/pausa, no modo de trabalho e na
  alavanca de segurança. Atualize quando mexer nele.
- Os enquadramentos (`cam`) das cenas em `scenes.js` foram feitos antes da carcaça crescer 25%. Vale revisar
  assistindo à apresentação.
