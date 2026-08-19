# Front Beer — Adega e Petiscaria

Cardápio digital para o cliente consultar no celular (sem pedido e sem entrega — venda apenas no local) e painel interno para o proprietário cadastrar produtos, alterar preços e marcar itens esgotados.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Cardápio público — é o link/QR Code que vai para o cliente |
| `admin.html` | Painel interno (login) |
| `assets/config.js` | Nome, endereço, horário, WhatsApp e chaves do Supabase |
| `assets/db.js` | Camada de dados (Supabase ou modo demonstração) |
| `assets/style.css` | Visual e responsividade |
| `supabase/schema.sql` | Banco de dados + regras de segurança |

## Testar agora (modo demonstração)

Abra `index.html` no navegador. O painel fica em `admin.html`, com login `admin@demo` / `espetinho`.

Nesse modo os dados ficam salvos apenas naquele navegador e **não há segurança real** — serve só para ver a interface funcionando.

## Cardápio de exemplo

O sistema já vem com 33 itens ilustrativos (espetos, petiscos, cervejas, doses e destilados, sem álcool) apenas para o cardápio não nascer vazio. **Os preços não são reais.**

Quando o proprietário for cadastrar os produtos de verdade, o caminho é: entrar no painel, clicar em **Limpar cardápio** (apaga tudo de uma vez) e depois cadastrar item por item em **+ Novo produto**.

## Recursos do painel

Cadastrar, editar e excluir produtos; marcar **Esgotou** com um toque (o item continua no cardápio, mas riscado e com selo "Esgotado hoje"); **ocultar** um item sem apagar (desmarcando "Visível no cardápio"); **reajustar preços em lote** por percentual, com opção de aplicar só em uma categoria; marcar **bebida alcoólica**, que exibe o selo 18+ no cardápio; e o campo **ordem de exibição**, que define a sequência dos itens e também a ordem em que as categorias aparecem.

## Bebida alcoólica

Itens marcados como alcoólicos exibem selo 18+ e o rodapé do cardápio traz o aviso da Lei Federal nº 13.106/2015 (proibida a venda a menores de 18 anos). Isso não substitui a placa física obrigatória no estabelecimento.

## Colocar no ar de verdade

1. Crie uma conta gratuita em https://supabase.com e um novo projeto.
2. Em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → Users**, clique em **Add user** e crie o e-mail/senha do proprietário. Em Authentication → Providers, desative "Enable email signups" para que ninguém crie conta sozinho.
4. Em **Project Settings → API**, copie a `URL` e a `anon public key` para `assets/config.js`. Aproveite e preencha endereço, horário e WhatsApp.
5. Publique a pasta em qualquer hospedagem estática gratuita (Netlify, Vercel, Cloudflare Pages ou GitHub Pages) — basta arrastar a pasta.
6. Gere um QR Code apontando para o endereço do `index.html` e cole nas mesas e no balcão.

## Segurança

A `anon key` é pública por natureza — quem abre o site consegue vê-la. Quem protege os dados são as políticas RLS do `schema.sql`: visitante só **lê** produtos ativos; criar, editar e excluir exige login. Nunca coloque a `service_role key` no `config.js`.

Todo texto vindo do banco é escapado antes de ir para a tela (proteção contra XSS) e URLs de imagem só são aceitas em `http`/`https`.

## Próximos passos sugeridos

Lançamento de vendas no painel (caixa simples) para alimentar o relatório — as tabelas já estão rascunhadas no fim do `schema.sql`; custo e margem por produto; upload de fotos direto pelo painel; e destaque de "mais vendidos".
