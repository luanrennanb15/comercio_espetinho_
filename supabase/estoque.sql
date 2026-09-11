-- =====================================================================
--  FRONT BEER — Estoque com alerta de reposição
--
--  COMO USAR
--    1. Painel do Supabase > SQL Editor > New query
--    2. Cole este arquivo inteiro e clique em RUN
--
--  Pode ser executado mais de uma vez sem quebrar nada.
--
--  ---------------------------------------------------------------
--  O QUE ESTE MÓDULO É, E O QUE ELE NÃO É
--
--  Ele responde uma pergunta só: "o que está perto de acabar?".
--  Não calcula valor de estoque, não tem ficha técnica de receita e
--  não controla ingrediente.
--
--  O controle é OPCIONAL POR PRODUTO (`controla_estoque`), e isso é
--  proposital. Bebida engarrafada funciona bem, porque o que se compra
--  é o que se vende. Espeto e porção não: a quantidade sai da brasa e
--  da fritadeira, não de uma prateleira. Ligar estoque neles faria o
--  número deixar de bater em uma semana — e estoque que não bate é
--  pior que estoque nenhum, porque o dono para de confiar na tela.
--  ---------------------------------------------------------------
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUNAS
-- ---------------------------------------------------------------------
alter table public.produtos add column if not exists controla_estoque boolean not null default false;
alter table public.produtos add column if not exists estoque          integer not null default 0;
alter table public.produtos add column if not exists estoque_minimo   integer not null default 0;

alter table public.produtos drop constraint if exists produtos_estoque_nao_negativo;
alter table public.produtos add  constraint produtos_estoque_nao_negativo
  check (estoque >= 0 and estoque <= 1000000);

alter table public.produtos drop constraint if exists produtos_estoque_minimo_valido;
alter table public.produtos add  constraint produtos_estoque_minimo_valido
  check (estoque_minimo >= 0 and estoque_minimo <= 1000000);

comment on column public.produtos.controla_estoque is
  'Ligado apenas para itens embalados (bebida). Espeto e porção ficam de fora.';
comment on column public.produtos.estoque is
  'Quantidade disponível. Baixa sozinha na venda e volta no estorno.';
comment on column public.produtos.estoque_minimo is
  'Abaixo ou igual a este número o produto aparece no alerta de reposição.';

create index if not exists produtos_estoque_baixo_idx
  on public.produtos (estoque)
  where controla_estoque;

-- ---------------------------------------------------------------------
-- 2. MOVIMENTAÇÃO ATÔMICA
--
--    Por que uma função no banco em vez de um update pelo navegador:
--
--    Numa sexta à noite pode haver dois celulares lançando venda ao
--    mesmo tempo. Se cada um lesse o estoque, subtraísse em JavaScript
--    e gravasse de volta, uma das baixas se perderia — os dois leem
--    "24", os dois gravam "23", e uma cerveja some do controle sem
--    ninguém ver. Aqui a subtração acontece dentro do próprio UPDATE,
--    onde o Postgres garante que uma operação espera a outra.
--
--    `delta` negativo tira do estoque (venda), positivo devolve
--    (estorno, cancelamento de comanda, entrada de mercadoria).
-- ---------------------------------------------------------------------
create or replace function public.mover_estoque(p_itens jsonb)
returns void
language plpgsql
security invoker                       -- respeita as políticas RLS de quem chamou
set search_path = public
as $$
declare
  item jsonb;
  v_delta integer;
  v_id uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    return;
  end if;

  for item in select * from jsonb_array_elements(p_itens)
  loop
    begin
      v_id := (item->>'produto_id')::uuid;
    exception when others then
      continue;                        -- id inválido: ignora em vez de derrubar a venda
    end;

    v_delta := coalesce((item->>'delta')::integer, 0);
    if v_id is null or v_delta = 0 then
      continue;
    end if;

    /* O item pode ter sido excluído do cardápio depois da venda, e o
       produto pode não controlar estoque. Nos dois casos o UPDATE
       simplesmente não encontra linha, e a venda segue normal. */
    update public.produtos
       set estoque  = greatest(0, estoque + v_delta),
           /* Ao zerar, some do cardápio sozinho: melhor o cliente não
              ver do que pedir algo que acabou. Ao repor, volta. */
           esgotado = case
                        when greatest(0, estoque + v_delta) = 0 then true
                        when esgotado then false
                        else esgotado
                      end
     where id = v_id
       and controla_estoque;
  end loop;
end;
$$;

revoke all on function public.mover_estoque(jsonb) from anon, public;
grant execute on function public.mover_estoque(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. O ESTOQUE NÃO É DADO PÚBLICO
--
--    O cardápio é aberto: qualquer visitante lê a tabela de produtos.
--    Quantas caixas de cerveja a casa tem é informação do negócio, não
--    do cliente — e num sistema que vai ser revendido, vazar isso pega
--    mal. Em vez de esconder no JavaScript (o que não esconde nada),
--    o Postgres passa a liberar ao público apenas as colunas do
--    cardápio. Pedir a coluna de estoque sem estar logado dá erro.
--
--    Consequência prática: o cardápio público NÃO pode mais usar
--    "select *". O assets/js/db.js já pede a lista exata de colunas.
-- ---------------------------------------------------------------------
revoke select on public.produtos from anon;

grant select (
  id, nome, descricao, categoria, preco, imagem_url,
  ativo, esgotado, alcoolico, ordem, criado_em, alterado_em
) on public.produtos to anon;

-- A equipe autenticada continua enxergando tudo, inclusive o estoque.
grant select, insert, update, delete on public.produtos to authenticated;

-- ---------------------------------------------------------------------
-- 4. VISÃO DE APOIO — o que precisa comprar
--    Consulta rápida no SQL Editor: select * from public.estoque_baixo;
-- ---------------------------------------------------------------------
create or replace view public.estoque_baixo as
select id, nome, categoria, estoque, estoque_minimo,
       (estoque = 0) as acabou
from public.produtos
where controla_estoque
  and estoque <= estoque_minimo
order by estoque, nome;

alter view public.estoque_baixo set (security_invoker = on);
revoke all on public.estoque_baixo from anon;
grant select on public.estoque_baixo to authenticated;

-- ---------------------------------------------------------------------
-- Avisa a API sobre o novo formato das tabelas.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
