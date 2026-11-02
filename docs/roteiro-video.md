# Roteiro do vídeo: simulador de escavadeira hidráulica

Screencast de cerca de 5 minutos, em duas partes:

1. **O simulador** (cenas 1 a 6): o que eu construí e como ler a tela.
2. **Como a escavadeira funciona** (cenas 7 a 15): a máquina explicada pelo próprio simulador.

As legendas que aparecem na tela já resumem cada cena. A narração conta a mesma coisa com mais calma e
num tom de conversa. Não precisa ler palavra por palavra: use como guia.

## Antes de gravar

- Abra o simulador em tela cheia (F11), com o navegador em 1920×1080 se possível.
- Clique uma vez em qualquer lugar da página para liberar o som e confira o volume no alto-falante da barra
  de cima.
- Clique em **▶ Apresentação**. A dica de teclas aparece só nesse momento e some em 3 segundos.
- **Modo manual (recomendado):** cada cena roda sozinha (câmera, holofote, legendas e movimentos), e você
  aperta **→** quando terminar de falar. Se a cena acabar antes, a máquina fica parada esperando, sem problema.
- **Modo automático:** a tecla **A** avança sozinha ao fim de cada cena. Bom para um ensaio ou para gravar a
  imagem e narrar depois.
- Outras teclas: **←** volta, **R** repete a cena, **P** pausa, **H** mostra ou esconde os painéis, **Esc** sai.
- Para regravar uma cena, aperte **R**: ela sempre recomeça do mesmo estado.

---

## Parte 1 · O simulador

### Cena 1 · Um simulador de escavadeira hidráulica (≈22 s)

**Na tela:** a tela completa, com a máquina mexendo a lança e o braço devagar. No alto aparece o link para
acessar o simulador (`SITE_LINK` em `js/present/scenes.js`).

**Narração:**
> Eu construí um simulador de uma escavadeira hidráulica, dessas de vinte toneladas que a gente vê em obra.
> Ele mostra a máquina por dentro, com o motor, as bombas e todo o óleo funcionando em tempo real.
> E ele roda direto no navegador: você vai conseguir acessar aí da sua casa, brincar e usar à vontade, por
> este link que está na tela e também na descrição do vídeo.
> Mas antes de você acessar, vamos ver um pouquinho como o simulador funciona e como a máquina funciona por
> dentro.

### Cena 2 · A tela, em quatro partes (≈16 s)

**Na tela:** o holofote passa pelo diagrama, pelos instrumentos, pelos comandos e pela barra de cima.

**Narração:**
> A tela tem quatro partes. No centro fica o diagrama da máquina. À direita, os instrumentos, como no
> painel de uma escavadeira de verdade. Embaixo estão os comandos da cabine. E em cima, as opções do
> simulador.

### Cena 3 · O diagrama: a máquina em corte (≈23 s)

**Na tela:** destaque na carcaça, depois na legenda de cores, de novo na carcaça e no detalhe do bloco de
válvulas. A lança, o braço e a caçamba se movem.

**Narração:**
> O diagrama é uma vista lateral em corte. Dentro da carcaça ficam o motor diesel, as bombas, o tanque de
> óleo e o bloco de válvulas. Fora dela, a lança, o braço, a caçamba e as esteiras.
> A cor de cada mangueira mostra a pressão do óleo: azul é pressão baixa, e quanto mais perto do vermelho,
> mais perto do limite. Esses tracinhos brancos andam no sentido em que o óleo está correndo. E o roxo é o
> circuito de comando, que eu vou explicar já já.
> Tudo aqui é animado pela física: os pistões do motor, a fumaça, as bombas, o nível do tanque.
> No canto fica o bloco de válvulas em detalhe, com cada carretel deslizando conforme o joystick se mexe.
> E clicando em qualquer peça aparece uma explicação do que ela faz, com os valores ao vivo.

### Cena 4 · Os instrumentos (≈27 s)

**Na tela:** o holofote passa pelos relógios, pelas barras, pelo gráfico e pelas luzes. A máquina acelera,
trabalha e no fim leva a lança até o batente.

**Narração:**
> Do lado direito ficam os instrumentos. Em cima, a rotação do motor e a pressão de cada uma das duas
> bombas, a P1 e a P2. Acelerando, dá para ver o ponteiro de rotação subir.
> Depois vêm a pressão do circuito piloto e as temperaturas do óleo e do motor.
> Nas barras aparecem a vazão de cada bomba, a potência hidráulica, o consumo de diesel, quanta terra tem
> na caçamba e o nível do tanque.
> Esse gráfico guarda os últimos quinze segundos de pressão. Olha o que acontece quando eu levo a lança até
> o fim do curso: a pressão sobe até a linha vermelha.
> E aí acendem as luzes de aviso. Essa aqui é a válvula de alívio abrindo, que é o limite de segurança da
> máquina.

### Cena 5 · Os comandos da cabine (≈28 s)

**Na tela:** a máquina começa desligada. A chave gira, o motor pega, o acelerador sobe e os joysticks e as
alavancas se movem sozinhos. O holofote acompanha cada comando.

**Narração:**
> Embaixo ficam os comandos. Primeiro, a chave de ignição: gira para ligado e segura em partida até o motor
> pegar. Quando solta, ela volta sozinha, igual numa máquina de verdade.
> O acelerador define a rotação do motor e, com ela, quanto óleo as bombas conseguem mandar.
> O joystick esquerdo mexe o braço, para fora e para dentro.
> O direito sobe e desce a lança e, para os lados, enche e despeja a caçamba.
> E as alavancas de translação, juntas, levam a máquina para frente e para trás.
> Dá para usar tudo com o mouse, com o teclado ou até com um controle de videogame.

### Cena 6 · Camadas, som e parâmetros (≈23 s)

**Na tela:** as mangueiras e os nomes somem e voltam, o holofote passa pelo som e a gaveta de Parâmetros
abre com o holofote nela. No fim, o destaque vai para o botão Apresentação.

**Narração:**
> Na barra de cima dá para esconder camadas do desenho, como as mangueiras ou os nomes, e olhar uma coisa
> de cada vez.
> O som é todo sintetizado na hora a partir da física: o ronco do motor, as bombas, o chiado da válvula de
> alívio. Aqui eu silencio ou ajusto o volume.
> Em Parâmetros dá para mudar a máquina: a pressão da válvula de alívio, a potência do motor, o tamanho das
> bombas e dos cilindros, o tipo de solo.
> E dá para simular falhas, como uma mangueira vazando ou o filtro de sucção entupido, e ver o efeito nos
> instrumentos.
> E por fim tem este modo de apresentação, que é o que eu estou usando agora. Então vamos ao que interessa:
> como uma escavadeira funciona.

---

## Parte 2 · Como a escavadeira funciona

### Cena 7 · Como uma escavadeira funciona (≈12 s)

**Na tela:** só a máquina, em tela cheia, mexendo a lança e o braço.

**Narração:**
> São vinte toneladas movidas por um líquido. O motor diesel não move a lança diretamente: ele gira bombas
> que empurram óleo. E é o óleo, sob pressão, que faz toda a força.

### Cena 8 · De onde vem a força (≈18 s)

**Na tela:** aproximação no motor e nas bombas. A chave gira, o motor pega e a fumaça sai. O acelerador
sobe e a lança se levanta.

**Narração:**
> Girando a chave, o motor de partida faz o diesel pegar. Dá para ver os pistões subindo e descendo, cada
> cilindro explodindo na sua vez, e a fumaça saindo pelo escapamento.
> O motor está ligado direto em duas bombas de pistões, a P1 e a P2, e numa bomba piloto pequena.
> Acelerando, as bombas giram mais rápido e mandam mais óleo por minuto. E repare: mais rotação, mais
> fumaça.
> Quando a lança sobe, o óleo encontra resistência, e é aí que aparece a pressão. Dentro da bomba, uma placa
> inclinada controla quanto óleo sai a cada volta.

### Cena 9 · Tanque, filtro e radiador (≈15 s)

**Na tela:** aproximação no tanque e no radiador. Os cilindros abrem e fecham.

**Narração:**
> O óleo sai do tanque pela sucção, trabalha e volta pela linha de retorno, passando pelo radiador e pelo
> filtro.
> Repara no tanque: quando os cilindros abrem, o nível cai, porque o óleo sai do tanque e fica guardado
> dentro dos cilindros. Dá para ver o jato que volta pelo filtro e as bolhas subindo.
> Quando os cilindros fecham, o óleo volta e o nível sobe de novo.

### Cena 10 · O comando: joystick, piloto e válvulas (≈17 s)

**Na tela:** destaque na cabine, nas linhas roxas e no bloco de válvulas, com o detalhe no canto. A lança se
move devagar e depois rápido.

**Narração:**
> O joystick não move a máquina diretamente. Ele manda um óleo de baixa pressão, o óleo piloto, que é esse
> roxo, para o bloco de válvulas.
> Esse óleo empurra um carretel, que abre o caminho para o óleo da bomba chegar no cilindro.
> Joystick pela metade, carretel pela metade: passa menos óleo e o movimento fica mais lento. É assim que o
> operador dosa a velocidade de cada movimento.

### Cena 11 · O cilindro: força = pressão × área (≈15 s)

**Na tela:** aproximação no cilindro da lança, com os valores de pressão dos lados A e B.

**Narração:**
> Para subir a lança, o óleo entra no lado A, o fundo do cilindro, que tem a área grande. Isso dá muita
> força. O óleo do outro lado volta para o tanque.
> Para descer, o óleo entra no lado B, o da haste. Como a haste ocupa espaço, a área é menor, e o mesmo óleo
> move o pistão mais rápido.
> A força é a pressão vezes a área do pistão. Por isso cilindros mais grossos levantam mais peso.

### Cena 12 · Lança, braço e caçamba (≈18 s)

**Na tela:** só a máquina, em tela cheia, movendo uma articulação de cada vez.

**Narração:**
> São três articulações e quatro cilindros. A lança tem dois cilindros, que levantam tudo o que está
> pendurado.
> No braço, o cilindro de cima empurra a parte de trás do braço, e ele gira no pino.
> Na caçamba, o cilindro gira a caçamba por meio de dois elos, que funcionam como uma alavanca.
> Combinando os três, a ponta dos dentes chega a qualquer ponto ao alcance da máquina.

### Cena 13 · Andando sobre as esteiras (≈10 s)

**Na tela:** a máquina anda para frente e depois para trás.

**Narração:**
> Cada esteira tem seu próprio motor hidráulico, na roda de trás. As duas alavancas para frente, a máquina
> anda. Para trás, o óleo simplesmente entra pelo outro lado dos motores.

### Cena 14 · A válvula de alívio: o limite de segurança (≈14 s)

**Na tela:** a lança vai até o batente, a pressão dispara e a luz de alívio acende. Depois entra o reforço
de força.

**Narração:**
> Quando o cilindro chega no fim do curso, o óleo não tem mais para onde ir e a pressão dispara.
> É aí que entra a válvula de alívio: perto de 343 bar ela abre e devolve o óleo para o tanque. Esse chiado
> é energia virando calor no óleo.
> E o botão de reforço de força sobe esse limite para 373 bar por alguns segundos. Dá para ver no gráfico.

### Cena 15 · Tudo junto: um ciclo de escavação (≈22 s)

**Na tela:** um ciclo completo: abrir, descer, cavar, encher, levantar, descarregar e voltar.

**Narração:**
> Juntando tudo, temos um ciclo de escavação: abre a caçamba, desce, puxa o braço e enche. É aqui que a
> pressão sobe e o motor faz força.
> Levanta com a caçamba cheia, com as duas bombas trabalhando juntas. Descarrega e recomeça. Um operador
> experiente faz isso em menos de vinte segundos.

---

## Encerramento (depois da cena 15, sem cena própria)

**Sugestão:** aperte **Esc** para sair da apresentação e mexa um pouco na máquina ao vivo enquanto fala.

**Narração:**
> E é isso. Um monte de física rodando junto para mostrar uma máquina que parece simples de fora. Se você
> quiser brincar, dá para mexer em tudo: nos comandos, nos parâmetros e nas falhas. Valeu!
