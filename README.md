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

1. Crie uma conta gratuita em <https://supabase.com> e um projeto novo.
2. No **SQL Editor**, cole todo o `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → Users → Add user**, crie o e-mail e a senha do
   proprietário. Em **Authentication → Providers**, desative
   *Enable email signups* para que ninguém abra conta sozinho.
4. Em **Project Settings → API**, copie `URL` e `anon public key` para
   `assets/js/config.js`. Aproveite e preencha endereço, horário, WhatsApp e
   `siteUrl`.
5. Publique a pasta em qualquer hospedagem estática gratuita — Netlify, Vercel,
   Cloudflare Pages ou GitHub Pages. Basta arrastar a pasta.
6. Abra `qrcode.html`, gere a placa e imprima para as mesas.

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
