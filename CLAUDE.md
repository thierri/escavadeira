# Escavadeira hidráulica · guia para começar uma sessão

Simulador 2D interativo de uma escavadeira de ~20 t (HTML + SVG + JavaScript puro, sem build e sem
dependências). Serve para gravar vídeo explicativo (modo apresentação) e como playground (modo simulação).
Textos da interface e comentários do código em **português**.

Leia antes de mexer:
- [`README.md`](README.md): o que o simulador faz, comandos, árvore de arquivos, `window.sim` no console.
- [`docs/guia-diagramas-interativos.md`](docs/guia-diagramas-interativos.md): método e decisões de projeto
  (layout 1920×1080, linguagem de cores, física, som, apresentação).

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
- `js/present/scenes.js`: roteiro das cenas (`moves`, `notes`, `focus` por `data-comp`).
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

## Pendências conhecidas

- O README ainda fala em giro, em "10 cenas" (agora são 9), em velocidade/pausa, no modo de trabalho e na
  alavanca de segurança. Atualize quando mexer nele.
- Os enquadramentos (`cam`) das cenas em `scenes.js` foram feitos antes da carcaça crescer 25%. Vale revisar
  assistindo à apresentação.
