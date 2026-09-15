# Front Beer — o que falta

Situação em 11 de setembro de 2026.

O sistema está no ar em <https://espetinho-front-beer.vercel.app>. Search
Console verificado, sitemap enviado, página liberada para indexação. Estoque e
Perdas entraram e estão testados. O que resta é quase tudo fora do código.

---

## 0. Agora, antes de qualquer outra coisa

São três passos curtos e um depende do outro.

**Rodar o `supabase/perdas.sql` de novo.** Ele ganhou a coluna `preco_unit`,
que guarda o preço de venda congelado. Sem ela a coluna *Venda* na tela de
Perdas fica zerada. Pode rodar quantas vezes quiser, não duplica nada.

**Push e merge.** A versão de cache está em `20260902d`. Enquanto não subir,
o navegador continua servindo o JavaScript antigo — foi o que fez as colunas
novas aparecerem sem funcionar.

**Ctrl+Shift+R** na tela de Perdas depois que o Vercel terminar o deploy.

---

## 1. No bar, com o dono

### Confirmar o número da rua

Você me passou 875 no começo e 1500 depois. Está **1500** no site. Olhe a
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

## 2. No computador

### Cadastrar os custos — é o que destrava o resto

Virou a pendência mais cara de todas. Sem custo lançado:

- o relatório mostra faturamento, mas não mostra lucro;
- a calculadora de markup não serve para nada;
- **a tela de Perdas agora recusa o registro**, porque perda valendo R$ 0,00
  entra na tabela e some do total, que é pior que não registrar.

Você já tem um caso assim no sistema: o registro de *51 Dose* está valendo
R$ 0,00 exatamente por isso. Cadastre o custo, apague o registro e lance de novo.

### Ligar o estoque das bebidas

Em Estoque, produto por produto. Vale para o que é embalado — lata, garrafa,
long neck. **Não ligue em espeto e porção:** a quantidade sai da brasa e da
fritadeira, não de uma prateleira, e o número deixaria de bater em uma semana.
Estoque que não bate é pior que estoque nenhum, porque o dono para de confiar
na tela.

### Imprimir e testar os QR Codes

Abra `qrcode.html` para a placa das mesas e `cartoes.html` para os 20 cartões
de comanda. **Teste um cartão com o celular antes de plastificar os vinte** —
é barato conferir agora e caro descobrir depois.

### Corrigir os nomes no cadastro

No painel, há erros de digitação que aparecem para o cliente: "Hiniken"
(Heineken), "Red Bul" (Red Bull), e a categoria "Espetinho" no singular
enquanto as outras estão no plural.

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

## 4. Ideias paradas, para decidir depois

**Unidades de venda.** Vender o mesmo produto em fardo, dose e garrafa, com o
estoque descontando na unidade certa. É a funcionalidade que mais mudaria o
dia a dia de uma adega, e a que mais mexe no sistema. Fica para quando o
básico estiver rodando há algumas semanas.

**Perdas por período comparado.** Hoje a tela mostra o período escolhido. Ver
"este mês contra o mês passado" transformaria o número em tendência.

---

## 5. Quando for vender para outro cliente

**Banco separado para a prévia.** Hoje produção e prévia falam com o mesmo
Supabase: o código é isolado, os dados não. Mexer no admin pela prévia altera o
cardápio real. Para um cliente só dá para conviver com isso; para vários, não.

**Checklist de implantação.** O README já explica o caminho todo. Vale
transformar num roteiro fechado: criar projeto Supabase, rodar os SQL, criar o
usuário, preencher o `config.js`, trocar as imagens, publicar.

---

## Como rodar os testes

Clique duas vezes em **`RODAR-TESTES.bat`** na pasta do projeto. Na primeira vez
ele baixa sozinho a biblioteca que os testes usam; depois é rápido. O resultado
fica na tela e em `testes/resultado.txt`.

Pela linha de comando, se preferir:

```
npm install
node testes/rodar.mjs
```

São 560 verificações em seis suítes — unitários, segurança, funcionais, quebra,
telas e capa. Rode sempre antes de dar push.
