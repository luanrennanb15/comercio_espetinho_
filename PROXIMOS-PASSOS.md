# Front Beer — o que falta

Situação em 2 de setembro de 2026.

O sistema está pronto e no ar em <https://espetinho-front-beer.vercel.app>.
Search Console verificado, sitemap enviado, página liberada para indexação.
O que resta é quase tudo fora do código.

---

## 1. Amanhã, no bar, com o dono

São as coisas que só dão para fazer no local ou que dependem dele.

### Confirmar o número da rua

Você me passou 875 no começo e 1500 depois. Coloquei **1500** no site. Olhe a
fachada e confirme — esse número vai para o cardápio, para a ficha do Google e
para a placa das mesas. Errado, manda cliente para a casa errada.

### Terminar o Perfil da Empresa no Google

Já foi iniciado e falta confirmar a mensagem e seguir. Ao preencher:

**Nome:** exatamente `Front Beer`. Não escreva "Front Beer Adega Petiscaria
Sorocaba" para tentar aparecer mais — o Google trata como manipulação e suspende
a ficha. O segmento vai na categoria.

**Categoria principal:** Bar. É ela que decide se a casa aparece quando alguém
pesquisa "bar perto de mim". Como secundárias, adega e loja de bebidas.

**Endereço:** R. Antônio Silva Saladino, 1500 — Parque Vitória Régia,
Sorocaba/SP, 18078-344.

**Telefone:** (15) 98142-7143. Só o número; o Google já oferece ligar e mandar
mensagem a partir dele. Não coloque o link do WhatsApp aqui.

**Horário:** abre 16:00, fecha 02:00, todos os dias. Não tente dividir em dois
blocos — o Google entende sozinho que vira o dia.

**Site** e **link do cardápio:** os dois recebem
`https://espetinho-front-beer.vercel.app`. O campo de cardápio é o que fecha o
circuito: cliente acha no Maps, toca em cardápio, abre o sistema.

**Verificação por vídeo:** grave sem cortes, mostrando a fachada com o número
visível da rua, o interior, e algo que prove que quem filma toca o negócio —
abrir o caixa, o estoque, uma chave. Vídeo cortado no meio reprova.

### Fotos

De 10 a 15, tiradas com calma: fachada à noite, interior, a brasa, o chope
sendo tirado, os petiscos servidos. É o que mais influencia alguém a escolher
a casa na lista do Maps.

### Combinar de quem é a conta

Importante, e ninguém combina no começo: o Perfil da Empresa pertence ao
negócio. Quem controla a conta controla o endereço no Maps, as avaliações e as
fotos. Crie com a conta do **dono**, e entre você como **gestor** — você
administra no dia a dia, ele continua dono. Vale pensar o mesmo para o Supabase
e o Vercel na hora de cobrar pelo sistema.

---

## 2. Depois, no computador

### Imprimir e testar os QR Codes

Abra `qrcode.html` para a placa das mesas e `cartoes.html` para os 20 cartões
de comanda. **Teste um cartão com o celular antes de plastificar os vinte** —
é barato conferir agora e caro descobrir depois.

### Corrigir os nomes no cadastro

No painel, há erros de digitação que aparecem para o cliente: "Hiniken"
(Heineken), "Red Bul" (Red Bull), e a categoria "Espetinho" no singular
enquanto as outras estão no plural.

### Cadastrar os custos

Sem custo lançado, o relatório mostra faturamento mas não lucro, e a
calculadora de markup não serve para nada. É onde o sistema começa a pagar o
próprio preço.

### Instagram

Link do cardápio na bio do @frontbeer_adega.

### Segundo QR de avaliação

Depois que a ficha do Google estiver ativa, faça um segundo QR ao lado do QR do
cardápio, pedindo avaliação. Ficha com 40 avaliações e nota 4,7 ganha de
qualquer site perfeito com zero avaliação. É o melhor investimento de
divulgação que existe para esse tipo de negócio.

---

## 3. Pendências técnicas

Nada urgente. O sistema funciona sem isso.

**Integridade dos scripts de terceiros (SRI).** Os três scripts do cdnjs —
QR Code e gráficos — não têm o atributo `integrity`, que faz o navegador
recusar o arquivo se ele tiver sido adulterado no caminho. O valor sai pronto
no botão *Copy Script Tag* do cdnjs. Vale principalmente para
`relatorios.html`, que roda com a sessão do dono aberta.

**Versão do supabase-js.** Hoje é `@2`, que muda sozinho quando a biblioteca é
atualizada. Prender numa versão exata deixa o comportamento previsível.

**Projeto Supabase antigo.** O `bocboymkebmmsvtiigob` não é mais usado. Apagar
evita confusão futura e o risco de alguém apontar o site para o banco errado.

**Fotos antigas de produto.** As três imagens em `assets/img/fotos/` não são
referenciadas por nenhuma tela. Se nenhum produto apontar para elas no painel,
podem ser apagadas.

---

## 4. Quando for vender para outro cliente

**Banco separado para a prévia.** Hoje produção e prévia falam com o mesmo
Supabase: o código é isolado, os dados não. Mexer no admin pela prévia altera o
cardápio real. Para um cliente só dá para conviver com isso; para vários, não.

**Checklist de implantação.** O README já explica o caminho todo. Vale
transformar num roteiro fechado: criar projeto Supabase, rodar os SQL, criar o
usuário, preencher o `config.js`, trocar as imagens, publicar.

---

## Como rodar os testes

Na pasta do projeto:

```
npm install jsdom      (só na primeira vez)
node testes/rodar.mjs
```

403 verificações em seis suítes. Rode sempre antes de dar push.
