# Front Beer — Cardápio Digital

Cardápio online para consulta do cliente e painel interno de gestão do cardápio.
Adega e petiscaria, venda apenas no local (sem pedido online e sem entrega).

---

## Estrutura

```
index.html              Cardápio público (é o link/QR Code do cliente)
admin.html              Painel interno — cadastro de produtos
caixa.html              Caixa — lançamento das vendas do balcão
relatorios.html         Relatórios de faturamento e desempenho
qrcode.html             Gerador da placa de QR Code para as mesas
manual.html             Manual do proprietário (feito para imprimir)

assets/
  css/tokens.css        Cores, fontes e medidas da marca
  css/base.css          Componentes compartilhados (botões, formulários, modais)
  css/cardapio.css      Estilos do cardápio público
  css/app.css           Menu lateral e estrutura da área interna
  css/admin.css         Estilos do painel
  css/caixa.css         Estilos do caixa
  css/relatorios.css    Estilos dos relatórios
  js/config.js          ÚNICO arquivo a editar para personalizar
  js/ui.js              Utilidades (escape, moeda, avisos, modais)
  js/nav.js             Menu lateral compartilhado pelas telas internas
  js/db.js              Camada de dados (Supabase ou modo demonstração)
  js/cardapio.js        Lógica do cardápio
  js/admin.js           Lógica do painel
  js/caixa.js           Lógica do caixa
  js/relatorios.js      Agregações e gráficos dos relatórios
  img/                  Emblema, fachada, favicon e imagem de prévia do link

supabase/schema.sql     Banco de dados e regras de segurança
supabase/storage.sql    Armazenamento das fotos enviadas pelo painel
```

O menu lateral é definido em um único lugar (`assets/js/nav.js`): incluir uma
tela nova no sistema significa acrescentar uma linha lá, e ela aparece na
navegação de todas as páginas internas.

A separação entre `db.js` e as telas é proposital: a interface nunca conversa
direto com o banco. Trocar o Supabase por outro serviço no futuro exige mexer
apenas em `db.js`.

---

## Testar agora

Abra `index.html` no navegador. O painel fica em `admin.html`, com acesso
`admin@demo` / `frontbeer`.

Sem o Supabase configurado o sistema roda em **modo demonstração**: os dados
ficam apenas naquele navegador e não há segurança real. Serve para avaliar a
interface, não para operar.

---

## Vendas e relatórios

O cliente não faz pedido pelo site, então o faturamento só existe se alguém
lançar as vendas. Isso acontece no **Caixa** (`caixa.html`): o operador toca nos
produtos, escolhe a forma de pagamento e fecha a venda — leva poucos segundos.
Dá para digitar parte do nome e pressionar Enter para adicionar o primeiro
resultado, e F2 fecha a venda pelo teclado.

Cada item vendido guarda o **nome e o preço congelados** no momento da venda.
Reajustar o cardápio hoje não muda o faturamento de ontem.

Os **relatórios** (`relatorios.html`) mostram faturamento por período com
gráfico diário, ticket médio, ranking dos mais vendidos, horários e dias de
pico e a divisão por forma de pagamento. Tudo exportável em CSV para o Excel.

O acesso ao faturamento é restrito: as políticas de segurança não dão nenhuma
permissão ao público sobre as tabelas de venda.

---

## Publicar de verdade

### 1. Criar o projeto no Supabase

Em <https://supabase.com>, crie a conta e um projeto novo. No formulário:

| Campo | O que usar |
|---|---|
| Organization | a sua |
| Project name | `front_beer` |
| Database Password | gere uma senha forte e **guarde no gerenciador de senhas** — ela não é mostrada de novo e não é a senha do painel do site |
| Region | **South America (São Paulo)** — o servidor mais perto dos clientes |
| Plan | Free |

Se aparecer a opção **Data API**, deixe **habilitada**. É ela que permite o site
conversar com o banco. Se tiver sido desligada, ligue depois em
*Integrations → Data API*.

### 2. Criar as tabelas

No menu lateral, **SQL Editor → New query**, cole todo o conteúdo de
`supabase/schema.sql` e clique em **Run**. O script cria as tabelas, os índices,
os privilégios e as políticas de segurança. Pode ser executado mais de uma vez
sem duplicar nada.

### 3. Criar o acesso do proprietário

Em **Authentication → Users → Add user**, informe e-mail e senha. Esse é o login
que abre o painel, o caixa e os relatórios.

Em seguida, em **Authentication → Sign In / Providers**, desative apenas
**Allow new users to sign up**. Isso impede que estranhos criem conta sozinhos.

> **Atenção — dois botões parecidos.** Dentro do provedor Email existe
> **Enable email provider**, que precisa continuar **LIGADO**: é ele que permite
> login por e-mail e senha. Se você desligar esse por engano, ninguém mais entra
> no painel, nem você. O que deve ficar desligado é somente
> *Allow new users to sign up*.

### 3b. Habilitar as fotos

No **SQL Editor**, rode também `supabase/storage.sql`. Ele cria o balde onde as
fotos enviadas pelo painel ficam guardadas: leitura pública (o cardápio é
aberto), envio e exclusão apenas para quem está logado, limite de 3 MB por
arquivo e somente JPG, PNG ou WEBP.

As fotos são reduzidas para 900px no próprio navegador antes de subir, então uma
foto de celular de 5 MB chega ao servidor com cerca de 120 KB.

### 4. Ligar o site ao banco

Em **Settings → API Keys**, copie:

- **Project URL** → campo `supabaseUrl` de `assets/js/config.js`
- **Publishable key** (`sb_publishable_...`) → campo `supabaseChave`

Nunca use aqui a *Secret key* nem a *service_role*: elas ignoram as regras de
segurança e dariam acesso total ao seu banco a qualquer visitante.

Ao salvar, o aviso de "modo demonstração" some do painel.

### 5. Publicar e divulgar

Suba a pasta em qualquer hospedagem estática gratuita — Netlify, Vercel,
Cloudflare Pages ou GitHub Pages. Depois preencha `siteUrl` no `config.js`,
abra `qrcode.html`, gere a placa e imprima para as mesas.

---

## Divulgação: colocar a casa no mapa

O site sozinho não traz cliente. Para um bar de bairro, a ordem de retorno é
esta — e ela costuma ser invertida por quem começa.

### 1. Perfil da Empresa no Google (prioridade máxima)

É o antigo Google Meu Negócio. É ele que coloca a casa no **Google Maps** e no
quadro que aparece quando alguém pesquisa "adega perto de mim" às 22h. Não é SEO
de site, é ficha de local, e é grátis.

Antes de criar, **pesquise o nome no Google**: muitas fichas já existem, criadas
automaticamente a partir de visitas, e nesse caso o certo é reivindicar em vez de
criar uma duplicada — ficha duplicada divide avaliações e atrapalha.

Depois vem a **verificação**, hoje quase sempre por vídeo: filmar a fachada, o
interior e algo que comprove que quem grava toca o negócio. Também pode ser por
carta com código, que leva de uma a duas semanas. Sem verificar, a ficha não fica
ativa nem sob controle do dono. Por envolver documento e presença física, quem
faz é o proprietário.

Dentro da ficha existe um campo de **link do cardápio**: é ali que vai o endereço
deste site. O circuito que interessa é cliente pesquisa no Google → cai na ficha
→ toca em cardápio → abre este sistema.

Vale ainda subir de 15 a 20 fotos boas: fachada à noite, interior, brasa, chope,
petiscos.

### 2. Avaliações

Rende mais que qualquer ajuste técnico. Ficha com 40 avaliações e nota 4,7 ganha
de site perfeito com zero avaliação, sempre. Um segundo QR Code na mesa, ao lado
do QR do cardápio, pedindo avaliação no Google, é o melhor investimento de
divulgação que existe para esse tipo de negócio.

### 3. Instagram

O perfil já existe (@frontbeer_adega). O link do cardápio deve ficar na bio.

### 4. Google Search Console

Vale cadastrar depois de publicar, leva cinco minutos e é grátis. Mas serve para
outra coisa: mostrar se o Google consegue ler e indexar o site, e quais buscas
levam até ele. Não espere que traga clientes sozinho — bar não vive de busca
orgânica na web, vive de Maps, Instagram e de quem passa na porta.

### Do lado do código

Falta implementar **dados estruturados de estabelecimento** (schema.org
LocalBusiness/BarOrPub) com endereço, telefone, horário e faixa de preço. É o que
permite ao Google ligar o site à ficha do Maps. Junto vão `robots.txt`, `sitemap`
e o ajuste fino das meta tags. Depende de ter o endereço completo com cidade,
bairro e CEP.

---

## Segurança

A `anon key` é pública por natureza: qualquer visitante consegue lê-la no
navegador. Quem protege os dados são as políticas RLS do `schema.sql` —
visitante apenas **lê** produtos ativos; criar, editar e excluir exige login.
A `service_role key` nunca deve aparecer no site.

Além disso: todo texto vindo do banco passa por escape antes de ir para a tela
(proteção contra XSS), URLs de imagem só são aceitas em `http`/`https`, o painel
é marcado como `noindex` e os limites de tamanho e preço são validados tanto no
navegador quanto no banco.

---

## Personalizar para outro cliente

Praticamente tudo vive em dois arquivos: `assets/js/config.js` (nome, contatos,
lema, chaves) e `assets/css/tokens.css` (cores e fontes). Trocando as imagens em
`assets/img/` e rodando o `schema.sql` em outro projeto Supabase, o mesmo código
atende outro estabelecimento.

---

## Próxima atualização

### Unidades de venda e cálculo de preço

Hoje cada produto tem **um preço único**. Numa adega isso é limitado: a mesma
cerveja é vendida na lata, no fardo e na caixa; o destilado é vendido na dose e
na garrafa. Cada forma tem preço diferente e o dono acaba cadastrando o mesmo
produto três vezes, com nomes parecidos, o que polui o cardápio e estraga o
ranking de mais vendidos no relatório.

A ideia é o produto passar a ter **unidades de venda**, cada uma com seu preço:

| Produto | Unidade | Preço |
|---|---|---|
| Cerveja Lata 350ml | unidade | R$ 6,50 |
| Cerveja Lata 350ml | fardo com 12 | R$ 66,00 |
| Whisky | dose 50ml | R$ 18,00 |
| Whisky | garrafa 1L | R$ 120,00 |

O que isso destrava:

- **Cardápio** mostra o item uma vez só, com as opções de preço embaixo.
- **Caixa** deixa o atendente escolher a unidade na hora da venda.
- **Cálculo automático de preço**: informando o valor do fardo e quantas
  unidades ele tem, o sistema sugere o preço da unidade com a margem desejada —
  fim da conta de cabeça e do preço errado no calor do movimento.
- **Relatório** passa a somar em unidades reais: "vendeu 30 latas" mesmo que
  tenham saído como 2 fardos e 6 avulsas.

Envolve mexer no banco (uma tabela de unidades ligada ao produto), no cadastro,
no caixa e nos relatórios. É a maior mudança prevista até agora.

### Depois disso

Custo por produto para o relatório mostrar **lucro**, e não só faturamento;
renomear categoria em lote; comparativo entre períodos ("esta semana contra a
semana passada"); e fechamento de caixa impresso no fim da noite.
