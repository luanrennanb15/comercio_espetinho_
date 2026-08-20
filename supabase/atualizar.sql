-- =====================================================================
--  FRONT BEER — ATUALIZAÇÃO DO BANCO
--
--  Use este arquivo quando o sistema reclamar de coluna ou tabela que
--  não existe. Ele completa o que estiver faltando e não apaga nada.
--
--  COMO USAR: Supabase > SQL Editor > New query > cole TUDO > Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Colunas que podem estar faltando na tabela de produtos
-- ---------------------------------------------------------------------
alter table public.produtos add column if not exists alcoolico   boolean       not null default false;
alter table public.produtos add column if not exists imagem_url  text          not null default '';
alter table public.produtos add column if not exists ativo       boolean       not null default true;
alter table public.produtos add column if not exists esgotado    boolean       not null default false;
alter table public.produtos add column if not exists ordem       integer       not null default 0;
alter table public.produtos add column if not exists descricao   text          not null default '';
alter table public.produtos add column if not exists criado_em   timestamptz   not null default now();
alter table public.produtos add column if not exists alterado_em timestamptz   not null default now();

-- ---------------------------------------------------------------------
-- 2. Tabelas de venda (usadas pelo Caixa e pelos Relatórios)
-- ---------------------------------------------------------------------
create table if not exists public.vendas (
  id         uuid primary key default gen_random_uuid(),
  criado_em  timestamptz   not null default now(),
  total      numeric(10,2) not null default 0 check (total >= 0),
  pagamento  text          not null default 'dinheiro'
               check (pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  observacao text          not null default ''
);

create table if not exists public.venda_itens (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome       text          not null,
  categoria  text          not null default 'Outros',
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  quantidade integer       not null check (quantidade > 0 and quantidade <= 999)
);

-- ---------------------------------------------------------------------
-- 3. Segurança e permissões
-- ---------------------------------------------------------------------
alter table public.produtos    enable row level security;
alter table public.vendas      enable row level security;
alter table public.venda_itens enable row level security;

grant select on public.produtos to anon;
grant select, insert, update, delete on public.produtos to authenticated;

revoke all on public.vendas      from anon;
revoke all on public.venda_itens from anon;
grant select, insert, update, delete on public.vendas      to authenticated;
grant select, insert, update, delete on public.venda_itens to authenticated;

drop policy if exists "publico le itens ativos" on public.produtos;
create policy "publico le itens ativos"
  on public.produtos for select to anon using (ativo = true);

drop policy if exists "equipe le tudo" on public.produtos;
create policy "equipe le tudo"
  on public.produtos for select to authenticated using (true);

drop policy if exists "equipe cadastra" on public.produtos;
create policy "equipe cadastra"
  on public.produtos for insert to authenticated with check (true);

drop policy if exists "equipe edita" on public.produtos;
create policy "equipe edita"
  on public.produtos for update to authenticated using (true) with check (true);

drop policy if exists "equipe exclui" on public.produtos;
create policy "equipe exclui"
  on public.produtos for delete to authenticated using (true);

drop policy if exists "equipe gerencia vendas" on public.vendas;
create policy "equipe gerencia vendas"
  on public.vendas for all to authenticated using (true) with check (true);

drop policy if exists "equipe gerencia itens da venda" on public.venda_itens;
create policy "equipe gerencia itens da venda"
  on public.venda_itens for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4. Avisar a API sobre as mudanças
--    Sem isto, a API continua respondendo que a coluna não existe.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 5. Conferência — deve listar as colunas da tabela produtos
-- ---------------------------------------------------------------------
select column_name as coluna, data_type as tipo
from information_schema.columns
where table_schema = 'public' and table_name = 'produtos'
order by ordinal_position;
