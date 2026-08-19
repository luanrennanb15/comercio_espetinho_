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

Em seguida, em **Authentication → Sign In / Providers → Email**, desative
**Allow new users to sign up**. Sem isso qualquer pessoa poderia criar conta e
entrar na área interna.

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

## Próxima etapa sugerida

Custo por produto para calcular margem real e lucro (hoje o relatório mostra
faturamento, não lucro); comparativo entre períodos ("esta semana contra a
semana passada"); e fechamento de caixa impresso no fim da noite.
