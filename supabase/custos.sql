-- =====================================================================
--  FRONT BEER — CUSTO E MARGEM
--
--  O custo fica em tabela SEPARADA de propósito. A tabela de produtos é
--  lida pelo público (é assim que o cardápio funciona sem login); se o
--  custo morasse lá, qualquer cliente na mesa veria quanto a casa paga
--  em cada cerveja. Aqui o público não tem permissão alguma.
--
--  COMO USAR: Supabase > SQL Editor > New query > cole TUDO > Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. CUSTO POR PRODUTO
--
--    O modelo cobre os três casos da casa com os mesmos dois campos:
--      fardo de cerveja  -> custo 66,00  rende 12 latas
--      pacote de espeto  -> custo 90,00  rende 15 espetos
--      saco de batata    -> custo 60,00  rende 12 porções
--
--    custo_unitario = custo_compra / rende_unidades
-- ---------------------------------------------------------------------
create table if not exists public.produto_custos (
  produto_id      uuid primary key references public.produtos(id) on delete cascade,
  custo_compra    numeric(10,2) not null check (custo_compra >= 0),
  rende_unidades  numeric(10,3) not null check (rende_unidades > 0),
  embalagem       text not null default '' check (char_length(embalagem) <= 40),
  fornecedor      text not null default '' check (char_length(fornecedor) <= 60),
  atualizado_em   timestamptz not null default now()
);

comment on table  public.produto_custos is
  'Custo de compra por produto. NUNCA deve ser exposto ao público.';
comment on column public.produto_custos.custo_compra   is 'Quanto foi pago na compra (fardo, pacote, saco)';
comment on column public.produto_custos.rende_unidades is 'Quantas unidades de venda saem dessa compra';
comment on column public.produto_custos.embalagem      is 'Como é comprado: fardo 12, pacote 15, saco 5kg';

-- Carimbo automático de atualização
create or replace function public.tocar_custo_atualizado()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_custo_atualizado on public.produto_custos;
create trigger trg_custo_atualizado
  before update on public.produto_custos
  for each row execute function public.tocar_custo_atualizado();

-- ---------------------------------------------------------------------
-- 2. CUSTO CONGELADO NA VENDA
--    Mesma lógica do preço: se o fardo encarecer amanhã, o lucro de
--    ontem não pode mudar sozinho.
-- ---------------------------------------------------------------------
alter table public.venda_itens   add column if not exists custo_unit numeric(10,2);
alter table public.comanda_itens add column if not exists custo_unit numeric(10,2);

comment on column public.venda_itens.custo_unit is
  'Custo unitário no momento da venda; nulo quando o produto não tinha custo cadastrado';

-- ---------------------------------------------------------------------
-- 3. SEGURANÇA
--    Somente quem tem login enxerga custo.
-- ---------------------------------------------------------------------
alter table public.produto_custos enable row level security;

revoke all on public.produto_custos from anon;
grant select, insert, update, delete on public.produto_custos to authenticated;

drop policy if exists "equipe gerencia custos" on public.produto_custos;
create policy "equipe gerencia custos"
  on public.produto_custos for all
  to authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 4. Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from public.produtos)        as produtos,
  (select count(*) from public.produto_custos)  as com_custo;

-- =====================================================================
--  COMPLEMENTO — COMPRA POR VOLUME OU PESO
--
--  Alguns produtos não são comprados em unidades prontas. A garrafa de
--  1 litro que sai em doses de 150 ml, o saco de 5 kg de batata que sai
--  em porções de 400 g. Guardando a medida da compra e a da porção, o
--  sistema calcula o rendimento sozinho e o dono não precisa dividir
--  nada de cabeça.
--
--  rende_unidades continua sendo o valor usado nas contas; estes campos
--  existem para reconstituir a conta quando o produto for editado.
-- =====================================================================
alter table public.produto_custos add column if not exists medida_total   numeric(12,3);
alter table public.produto_custos add column if not exists medida_porcao  numeric(12,3);
alter table public.produto_custos add column if not exists medida_unidade text not null default '';

comment on column public.produto_custos.medida_total   is 'Conteúdo total da compra na unidade base (ml ou g)';
comment on column public.produto_custos.medida_porcao  is 'Quanto sai em cada venda, na mesma unidade base';
comment on column public.produto_custos.medida_unidade is 'ml, g ou vazio quando a compra é em unidades';

notify pgrst, 'reload schema';
