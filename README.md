# Cardápio Online + Painel Interno

Site de cardápio digital para consulta do cliente (sem pedido online) e painel interno para cadastrar produtos, alterar preços e marcar itens esgotados.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Cardápio público — é o link/QR Code que vai para o cliente |
| `admin.html` | Painel interno da equipe (login) |
| `assets/config.js` | Nome da loja, endereço, horário, WhatsApp e chaves do Supabase |
| `assets/db.js` | Camada de dados (Supabase ou modo demonstração) |
| `assets/style.css` | Visual e responsividade |
| `supabase/schema.sql` | Banco de dados + regras de segurança |

## Testar agora (modo demonstração)

Abra `index.html` no navegador. O painel fica em `admin.html`, com login `admin@demo` / `espetinho`.

Nesse modo os dados ficam salvos apenas naquele navegador e **não há segurança real** — serve só para ver a interface funcionando.

## Colocar no ar de verdade

1. Crie uma conta gratuita em https://supabase.com e um novo projeto.
2. Em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → Users**, clique em **Add user** e crie o e-mail/senha da equipe. Desative "Enable email signups" em Authentication → Providers para que ninguém crie conta sozinho.
4. Em **Project Settings → API**, copie a `URL` e a `anon public key` para `assets/config.js`.
5. Publique a pasta em qualquer hospedagem estática gratuita (Netlify, Vercel, Cloudflare Pages ou GitHub Pages) — basta arrastar a pasta.
6. Gere um QR Code apontando para o endereço do `index.html` e cole na mesa/balcão.

## Segurança

A `anon key` é pública por natureza — quem abre o site consegue vê-la. Quem protege os dados são as políticas RLS do `schema.sql`: visitante só **lê** produtos ativos; criar, editar e excluir exige login. Nunca coloque a `service_role key` no `config.js`.

Todo texto vindo do banco é escapado antes de ir para a tela (proteção contra XSS) e URLs de imagem só são aceitas em `http`/`https`.

## Próximos passos sugeridos

Relatório de vendas (tabelas já rascunhadas no fim do `schema.sql`), custo e margem por produto, upload de fotos direto pelo painel e destaque de "mais pedidos".
