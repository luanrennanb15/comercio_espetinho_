-- =====================================================================
--  FRONT BEER — CORREÇÃO
--
--  1. Garante as colunas novas usadas pelas comandas
--  2. Resolve o aviso "Security Definer View" do Supabase
--
--  Seguro rodar quantas vezes quiser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas que o sistema de comandas precisa
-- ---------------------------------------------------------------------
alter table public.venda_itens add column if not exists criado_em      timestamptz not null default now();
alter table public.vendas      add column if not exists comanda_numero integer;
alter table public.vendas      add column if not exists aberta_em      timestamptz;

-- ---------------------------------------------------------------------
-- 2. Aviso "Security Definer View"
--
--    Toda view no Postgres roda, por padrão, com os direitos de quem a
--    criou — e não de quem consulta. Numa base com RLS isso é um risco:
--    a view poderia devolver linhas que o usuário não teria permissão de
--    ver por conta própria.
--
--    A view resumo_diario é só um atalho para consultar o faturamento no
--    SQL Editor; o site não usa. Abaixo ela passa a respeitar as
--    permissões de quem consulta, o que encerra o alerta.
-- ---------------------------------------------------------------------
alter view public.resumo_diario set (security_invoker = on);

revoke all on public.resumo_diario from anon;
grant select on public.resumo_diario to authenticated;

-- ---------------------------------------------------------------------
-- 3. Avisa a API sobre as mudanças
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 4. Conferência — as três colunas devem aparecer
-- ---------------------------------------------------------------------
select table_name as tabela, column_name as coluna
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'venda_itens' and column_name = 'criado_em') or
    (table_name = 'vendas'      and column_name in ('comanda_numero', 'aberta_em'))
  )
order by table_name, column_name;
