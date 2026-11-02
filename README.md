# Escavadeira hidráulica · como funciona

Diagrama 2D **interativo** de uma escavadeira hidráulica de ~20 toneladas, feito em HTML + SVG + JavaScript.
Ele tem dois usos:

1. **Vídeo explicativo**: um *modo apresentação* com cenas roteirizadas (câmera, destaque, legendas e
   movimentos automáticos) pronto para gravar a tela.
2. **Playground**: um *modo simulação* em que qualquer pessoa liga a máquina, mexe nos joysticks, muda
   parâmetros e simula falhas, vendo e ouvindo a física responder.

Tudo cabe numa única tela **16:9 (1920×1080)**, sem rolagem, em estilo técnico e limpo, com textos em
português para um público leigo e curioso.

> Este é o primeiro de uma série de diagramas de "máquinas curiosas". O método completo para criar os
> próximos está em [`docs/guia-diagramas-interativos.md`](docs/guia-diagramas-interativos.md).

---

## Como rodar

Não há instalação nem etapa de build. Basta servir a pasta por HTTP (os módulos JavaScript não carregam
abrindo o `index.html` direto do disco):

```bash
cd escavadeira
python3 -m http.server 8765
```

Abra **http://localhost:8765** no Chrome, Edge ou Safari. Qualquer outro servidor estático também serve
(`npx serve`, extensão Live Server do VS Code etc.).

- O **som** liga no primeiro clique ou tecla (regra dos navegadores).
- A fonte Inter vem do Google Fonts; sem internet, o navegador usa a fonte do sistema.
- No macOS, se o servidor não conseguir ler a pasta (por exemplo, dentro de `Desktop`), rode o comando
  pelo Terminal.

---

## Os dois modos

### Modo simulação (playground)

É o modo padrão ao abrir a página.

**O que aparece na tela**

- **Cena principal**: a máquina em vista lateral, com a carcaça em corte mostrando motor diesel, radiadores,
  bombas principais P1/P2, bomba piloto, tanque, bloco de válvulas, motor de giro, junta rotativa e motor de
  translação. Mostra também lança, braço e caçamba com os 4 cilindros em corte e os elos da caçamba.
- **Mangueiras coloridas pela pressão** (azul → verde → amarelo → laranja → vermelho), com tracinhos que
  mostram o sentido e a velocidade do fluxo. As linhas piloto (comando) são roxas.
- **Quadros auxiliares**: vista de cima (giro e rumo), detalhe do bloco de válvulas (carretéis se movendo) e
  legenda de cores.
- **Instrumentos**: rotação do motor, pressão de P1 e P2, pressão piloto, temperatura do óleo e do motor,
  vazão das bombas, potência hidráulica, consumo de diesel, terra na caçamba, nível do tanque, gráfico de
  pressão dos últimos 15 s e 8 luzes de aviso.
- **Painel de informação**: clique em qualquer peça para ver o que ela faz e seus valores ao vivo.

**Comandos**

| Comando | Mouse | Teclado | Controle de videogame |
|---|---|---|---|
| Ignição liga/desliga | botões | I | — |
| Partida (segurar) | botão "Partida" | Enter | Start |
| Alavanca de segurança | clique na alavanca | L | Y |
| Joystick esquerdo: braço / giro | arrastar | W A S D | analógico esquerdo |
| Joystick direito: lança / caçamba | arrastar | setas | analógico direito |
| Esteiras esquerda / direita | arrastar alavancas | Q Z / E C | LB LT / RB RT |
| Acelerador 1–10 | arrastar ou rolar | + / − | — |
| Reforço de força | segurar botão | Espaço | A |
| Modo Eco / Padrão / Potência, marcha lenta automática | botões | — | — |

Os comandos seguem o padrão ISO das escavadeiras reais.

**Barra superior**: mostrar/ocultar camadas (mangueiras, piloto, nomes, valores), velocidade da simulação
(¼× a 2×), pausa, som (mudo e volume), **▶ Apresentação**, **Parâmetros** e **Reiniciar**.

**Parâmetros**: pressão da válvula de alívio, potência do motor, tamanho das bombas, diâmetro dos cilindros,
material do solo (areia, terra, argila, cascalho), temperatura ambiente e eficiência do radiador.

**Falhas simuláveis**: mangueira do braço vazando (o braço cede e pinga óleo), filtro de sucção entupido
(cavitação), válvula de alívio desregulada (abre em 120 bar) e bomba gasta.

**Som**: tudo é sintetizado em tempo real e ligado à física, sem nenhum arquivo de áudio. Inclui:

- motor diesel 6 cilindros (cada explosão), turbo e ventilador
- motor de partida e autoteste do painel
- chiado das bombas, que sobe com a pressão
- guincho da válvula de alívio, óleo passando nas válvulas e cliques dos carretéis
- pancada no fim de curso, giro, batidas das sapatas das esteiras
- escavação e terra caindo
- cavitação, gotas de vazamento e alarmes

### Modo apresentação (para gravar o vídeo)

Botão **▶ Apresentação**. São 10 cenas:

| # | Cena | O que mostra |
|---|---|---|
| 1 | Uma escavadeira por dentro | visão geral, movimentos suaves |
| 2 | De onde vem a força | chave, partida, motor pegando, acelerando, pressão aparecendo |
| 3 | Tanque, filtro e radiador | nível do tanque cai quando os cilindros estendem |
| 4 | O comando | alavanca travada: joystick sem efeito; liberada: o carretel abre; meio curso = mais lento |
| 5 | O cilindro: força = pressão × área | lados A e B, velocidade e força |
| 6 | Lança, braço e caçamba | cada articulação separadamente |
| 7 | O giro e a junta rotativa | ~100° de giro com vista de cima |
| 8 | Andando sobre as esteiras | frente, ré e giro no próprio eixo |
| 9 | A válvula de alívio | fim de curso a 340 bar; reforço de força a 369 bar |
| 10 | Tudo junto | ciclo completo: cavar, encher, levantar, girar, descarregar, voltar |

| Tecla | Ação |
|---|---|
| → / Espaço | próxima cena |
| ← | cena anterior |
| R | repete a cena (sempre começa igual: ótimo para regravar) |
| A | automático: avança sozinho (vídeo inteiro numa tomada) |
| H | alterna "só a máquina" ↔ "com instrumentos e comandos" |
| P | pausa |
| 1–9, 0 | vai direto para a cena |
| Esc | volta ao modo simulação |

As cenas são **dados** em [`js/present/scenes.js`](js/present/scenes.js). Para mudar textos, tempos,
enquadramentos e movimentos, não é preciso mexer no restante do código.

---

## Em que ponto o projeto está

**Pronto e testado**

- [x] Cinemática da lança, braço e caçamba (geometria validada numericamente)
- [x] Simulação: motor diesel, bombas com limite de potência, circuito piloto, carretéis, válvula de alívio,
      cilindros, giro, translação, resistência do solo, escavação e descarga de terra, temperatura do óleo e
      nível do tanque
- [x] Desenho completo da máquina e do sistema hidráulico em SVG
- [x] Painel de instrumentos, comandos (mouse, teclado e controle) e painel de informação por componente
- [x] Parâmetros ajustáveis e 4 falhas simuláveis
- [x] Sistema de som sintetizado
- [x] Modo apresentação com 10 cenas roteirizadas
- [x] Guia de método para outras máquinas ([`docs/guia-diagramas-interativos.md`](docs/guia-diagramas-interativos.md))

**Ainda não validado por uma pessoa**

- [ ] Ouvir o som com atenção (os níveis foram medidos por software, mas o realismo precisa de ouvido)
- [ ] Assistir às 10 cenas em tela cheia e ajustar textos, tempos e enquadramentos ao gosto do vídeo
- [ ] Testar com um controle de videogame de verdade

**Próximos passos possíveis**

- Zoom de componentes: corte animado da bomba de pistões, do carretel e da válvula de alívio
- Exportação quadro a quadro (tempo determinístico) para gerar o vídeo sem depender de gravação de tela
- Confluência de bombas (lança e braço recebendo óleo das duas bombas, como nas máquinas reais)
- Novas máquinas usando o mesmo método

---

## Estrutura do código

```
escavadeira/
├── index.html                palco 1920×1080 e regiões da tela
├── css/style.css             estilos (cores em variáveis no :root)
├── js/
│   ├── main.js               monta tudo e roda o laço principal
│   ├── config.js             parâmetros padrão, materiais e modos de trabalho
│   ├── sim/
│   │   ├── kinematics.js     geometria: ângulos das articulações → posições e comprimento dos cilindros
│   │   └── simulation.js     física: motor, bombas, válvulas, atuadores, solo, calor
│   ├── render/
│   │   ├── svg.js            utilitários de SVG e escala de cores de pressão
│   │   ├── scene.js          máquina, mangueiras, cilindros, terreno, quadros auxiliares, rótulos
│   │   └── panel.js          relógios, barras, gráfico e luzes
│   ├── ui/
│   │   ├── controls.js       ignição, acelerador, joysticks, alavancas, teclado, controle
│   │   ├── info.js           textos de cada componente + valores ao vivo
│   │   └── params.js         gaveta de parâmetros e falhas
│   ├── audio/
│   │   ├── sound.js          sistema de som (Web Audio)
│   │   └── engine-worklet.js sintetizador do motor diesel
│   └── present/
│       ├── presentation.js   motor do modo apresentação
│       └── scenes.js         roteiro das cenas
└── docs/
    └── guia-diagramas-interativos.md   método completo (layout, cores, física, som, apresentação)
```

Princípios que mantêm o código organizado:

- **A física não conhece o desenho.** `simulation.js` só lê e escreve um objeto de estado. Dá para
  testar no Node, sem navegador.
- **Física em passo fixo (240 Hz), desenho a cada quadro.**
- **SVG construído uma vez; a cada quadro só os atributos mudam.**
- **Tudo clicável tem `data-comp`**, que serve para o painel de informação e para o destaque das cenas.

---

## Depuração pelo console do navegador

```js
sim.st                 // estado completo da simulação (motor, bombas, cilindros, solo…)
sim.params             // parâmetros atuais (pode alterar ao vivo)
sim.pres.start(0)      // abre o modo apresentação na cena 1
sim.pres.go(4)         // vai para a cena 5
sim.sound.level()      // volume atual do som (RMS e pico)
sim.reset()            // reinicia a simulação
```

---

## Continuando em outro computador

1. Clone o repositório.
2. Rode `python3 -m http.server 8765` dentro da pasta e abra `http://localhost:8765`.
3. Leia este README e o guia em `docs/` para retomar o contexto. As decisões de projeto, o porquê de cada
   técnica e as armadilhas já encontradas estão documentadas lá.

Requisitos: um navegador moderno (Chrome, Edge ou Safari recentes) e Python 3 (ou qualquer servidor
estático). Não há dependências para instalar.
