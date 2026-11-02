# Narração · simulador de escavadeira hidráulica

Texto para gravar. Grave um arquivo de áudio por cena, com o nome indicado (ex.: `cena-01.mp3`).
Deixe meio segundo de silêncio no começo e no fim de cada arquivo.

---

## Cena 1 · Um simulador de escavadeira hidráulica
Arquivo: `cena-01.mp3`

Eu construí um simulador de uma escavadeira hidráulica, dessas de vinte toneladas que a gente vê em obra. Ele mostra a máquina por dentro, com o motor, as bombas e todo o óleo funcionando em tempo real.

E ele roda direto no navegador: você vai conseguir acessar aí da sua casa, brincar e usar à vontade, por este link que está na tela e também na descrição do vídeo.

Mas antes de você acessar, vamos ver um pouquinho como o simulador funciona e como a máquina funciona por dentro.

---

## Cena 2 · A tela, em quatro partes
Arquivo: `cena-02.mp3`

A tela tem quatro partes. No centro fica o diagrama da máquina. À direita, os instrumentos, como no painel de uma escavadeira de verdade. Embaixo estão os comandos da cabine. E em cima, as opções do simulador.

---

## Cena 3 · O diagrama: a máquina em corte
Arquivo: `cena-03.mp3`

O diagrama é uma vista lateral em corte. Dentro da carcaça ficam o motor diesel, as bombas, o tanque de óleo e o bloco de válvulas. Fora dela, a lança, o braço, a caçamba e as esteiras.

A cor de cada mangueira mostra a pressão do óleo: azul é pressão baixa, e quanto mais perto do vermelho, mais perto do limite. Esses tracinhos brancos andam no sentido em que o óleo está correndo. E o roxo é o circuito de comando, que eu vou explicar já já.

Tudo aqui é animado pela física: os pistões do motor, a fumaça, as bombas, o nível do tanque.

No canto fica o bloco de válvulas em detalhe, com cada carretel deslizando conforme o joystick se mexe.

E clicando em qualquer peça aparece uma explicação do que ela faz, com os valores ao vivo.

---

## Cena 4 · Os instrumentos
Arquivo: `cena-04.mp3`

Do lado direito ficam os instrumentos. Em cima, a rotação do motor e a pressão de cada uma das duas bombas, a P1 e a P2. Acelerando, dá para ver o ponteiro de rotação subir.

Depois vêm a pressão do circuito piloto e as temperaturas do óleo e do motor.

Nas barras aparecem a vazão de cada bomba, a potência hidráulica, o consumo de diesel, quanta terra tem na caçamba e o nível do tanque.

Esse gráfico guarda os últimos quinze segundos de pressão. Olha o que acontece quando eu levo a lança até o fim do curso: a pressão sobe até a linha vermelha.

E aí acendem as luzes de aviso. Essa aqui é a válvula de alívio abrindo, que é o limite de segurança da máquina.

---

## Cena 5 · Os comandos da cabine
Arquivo: `cena-05.mp3`

Embaixo ficam os comandos. Primeiro, a chave de ignição: gira para ligado e segura em partida até o motor pegar. Quando solta, ela volta sozinha, igual numa máquina de verdade.

O acelerador define a rotação do motor e, com ela, quanto óleo as bombas conseguem mandar.

O joystick esquerdo mexe o braço, para fora e para dentro.

O direito sobe e desce a lança e, para os lados, enche e despeja a caçamba.

E as alavancas de translação, juntas, levam a máquina para frente e para trás.

Dá para usar tudo com o mouse, com o teclado ou até com um controle de videogame.

---

## Cena 6 · Camadas, som e parâmetros
Arquivo: `cena-06.mp3`

Na barra de cima dá para esconder camadas do desenho, como as mangueiras ou os nomes, e olhar uma coisa de cada vez.

O som é todo sintetizado na hora a partir da física: o ronco do motor, as bombas, o chiado da válvula de alívio. Aqui eu silencio ou ajusto o volume.

Em Parâmetros dá para mudar a máquina: a pressão da válvula de alívio, a potência do motor, o tamanho das bombas e dos cilindros, o tipo de solo.

E dá para simular falhas, como uma mangueira vazando ou o filtro de sucção entupido, e ver o efeito nos instrumentos.

E por fim tem este modo de apresentação, que é o que eu estou usando agora. Então vamos ao que interessa: como uma escavadeira funciona.

---

## Cena 7 · Como uma escavadeira funciona
Arquivo: `cena-07.mp3`

São vinte toneladas movidas por um líquido. O motor diesel não move a lança diretamente: ele gira bombas que empurram óleo. E é o óleo, sob pressão, que faz toda a força.

---

## Cena 8 · De onde vem a força
Arquivo: `cena-08.mp3`

Girando a chave, o motor de partida faz o diesel pegar. Dá para ver os pistões subindo e descendo, cada cilindro explodindo na sua vez, e a fumaça saindo pelo escapamento.

O motor está ligado direto em duas bombas de pistões, a P1 e a P2, e numa bomba piloto pequena.

Acelerando, as bombas giram mais rápido e mandam mais óleo por minuto. E repare: mais rotação, mais fumaça.

Quando a lança sobe, o óleo encontra resistência, e é aí que aparece a pressão. Dentro da bomba, uma placa inclinada controla quanto óleo sai a cada volta.

---

## Cena 9 · Tanque, filtro e radiador
Arquivo: `cena-09.mp3`

O óleo sai do tanque pela sucção, trabalha e volta pela linha de retorno, passando pelo radiador e pelo filtro.

Repara no tanque: quando os cilindros abrem, o nível cai, porque o óleo sai do tanque e fica guardado dentro dos cilindros. Dá para ver o jato que volta pelo filtro e as bolhas subindo.

Quando os cilindros fecham, o óleo volta e o nível sobe de novo.

---

## Cena 10 · O comando: joystick, piloto e válvulas
Arquivo: `cena-10.mp3`

O joystick não move a máquina diretamente. Ele manda um óleo de baixa pressão, o óleo piloto, que é esse roxo, para o bloco de válvulas.

Esse óleo empurra um carretel, que abre o caminho para o óleo da bomba chegar no cilindro.

Joystick pela metade, carretel pela metade: passa menos óleo e o movimento fica mais lento. É assim que o operador dosa a velocidade de cada movimento.

---

## Cena 11 · O cilindro: força = pressão × área
Arquivo: `cena-11.mp3`

Para subir a lança, o óleo entra no lado A, o fundo do cilindro, que tem a área grande. Isso dá muita força. O óleo do outro lado volta para o tanque.

Para descer, o óleo entra no lado B, o da haste. Como a haste ocupa espaço, a área é menor, e o mesmo óleo move o pistão mais rápido.

A força é a pressão vezes a área do pistão. Por isso cilindros mais grossos levantam mais peso.

---

## Cena 12 · Lança, braço e caçamba
Arquivo: `cena-12.mp3`

São três articulações e quatro cilindros. A lança tem dois cilindros, que levantam tudo o que está pendurado.

No braço, o cilindro de cima empurra a parte de trás do braço, e ele gira no pino.

Na caçamba, o cilindro gira a caçamba por meio de dois elos, que funcionam como uma alavanca.

Combinando os três, a ponta dos dentes chega a qualquer ponto ao alcance da máquina.

---

## Cena 13 · Andando sobre as esteiras
Arquivo: `cena-13.mp3`

Cada esteira tem seu próprio motor hidráulico, na roda de trás. As duas alavancas para frente, a máquina anda. Para trás, o óleo simplesmente entra pelo outro lado dos motores.

---

## Cena 14 · A válvula de alívio: o limite de segurança
Arquivo: `cena-14.mp3`

Quando o cilindro chega no fim do curso, o óleo não tem mais para onde ir e a pressão dispara.

É aí que entra a válvula de alívio: perto de 343 bar ela abre e devolve o óleo para o tanque. Esse chiado é energia virando calor no óleo.

E o botão de reforço de força sobe esse limite para 373 bar por alguns segundos. Dá para ver no gráfico.

---

## Cena 15 · Tudo junto: um ciclo de escavação
Arquivo: `cena-15.mp3`

Juntando tudo, temos um ciclo de escavação: abre a caçamba, desce, puxa o braço e enche. É aqui que a pressão sobe e o motor faz força.

Levanta com a caçamba cheia, com as duas bombas trabalhando juntas. Descarrega e recomeça. Um operador experiente faz isso em menos de vinte segundos.

---

## Encerramento
Arquivo: `encerramento.mp3`

E é isso. Um monte de física rodando junto para mostrar uma máquina que parece simples de fora. Se você quiser brincar, dá para mexer em tudo: nos comandos, nos parâmetros e nas falhas. Valeu!
