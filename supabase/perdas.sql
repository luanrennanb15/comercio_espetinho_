-- =====================================================================
--  FRONT BEER — Perdas e saídas sem venda
--
--  COMO USAR
--    1. Rode antes o supabase/estoque.sql
--    2. Painel do Supabase > SQL Editor > New query
--    3. Cole este arquivo inteiro e clique em RUN
--
--  Pode ser executado mais de uma vez sem quebrar nada.
--
--  ---------------------------------------------------------------
--  POR QUE O MOTIVO É OBRIGATÓRIO
--
--  "Sumiram 6 latas" não é diagnóstico. "3 quebraram, 2 o dono bebeu
--  e 1 foi cortesia" é. São três naturezas diferentes:
--
--    quebra           perda operacional — atacar com cuidado no manuseio
--    vencimento       erro de compra — comprou demais, girou de menos
--    consumo_interno  retirada do dono, não é perda: é pró-labore
--    brinde           marketing — precisa valer a pena
--    outro            o que não coube acima, com observação escrita
--
--  Juntar tudo num total só esconde qual é o problema, e é por isso
--  que este módulo recusa registro sem motivo.
--  ---------------------------------------------------------------
--
--  VALOR: sempre o CUSTO, nunca o preço de venda.
--
--  Uma cerveja de R$ 11,00 que custou R$ 6,49 e quebrou tirou R$ 6,49
--  do bolso. Lançar R$ 11,00 inflaria a perda em quase o dobro e
--  misturaria dinheiro que saiu com faturamento que talvez nem
--  acontecesse. É também como o contador enxerga.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELA
-- ---------------------------------------------------------------------
create table if not exists public.perdas (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz   not null default now(),
  produto_id  uuid          references public.produtos(id) on delete set null,

  /* Nome, categoria e custo ficam CONGELADOS, como nas vendas. O
     produto pode ser renomeado, ter o custo reajustado ou sumir do
     cardápio — o histórico de perdas não pode mudar por causa disso. */
  nome        text          not null check (char_length(nome) between 1 and 80),
  categoria   text          not null default 'Outros',
  quantidade  integer       not null check (quantidade > 0 and quantidade <= 9999),
  custo_unit  numeric(10,2) not null default 0 check (custo_unit >= 0 and custo_unit <= 100000),

  motivo      text          not null
                check (motivo in ('quebra', 'vencimento', 'consumo_interno', 'brinde', 'outro')),
  observacao  text          not null default '' check (char_length(observacao) <= 200)
);

comment on table  public.perdas            is 'Saídas de mercadoria sem venda: quebra, vencimento, consumo interno e brinde';
comment on column public.perdas.custo_unit is 'Custo por unidade no momento do registro, congelado';
comment on column public.perdas.motivo     is 'Separa perda operacional de retirada do dono e de marketing';

create index if not exists perdas_data_idx    on public.perdas (criado_em desc);
create index if not exists perdas_motivo_idx  on public.perdas (motivo, criado_em desc);
create index if not exists perdas_produto_idx on public.perdas (produto_id);

-- ---------------------------------------------------------------------
-- 2. SEGURANÇA
--    Perda é informação de gestão. O público não tem nada aqui —
--    nem leitura. Descobrir quanto uma casa quebra por mês não é
--    assunto de quem lê o cardápio.
-- ---------------------------------------------------------------------
alter table public.perdas enable row level security;

revoke all on public.perdas from anon;
grant select, insert, update, delete on public.perdas to authenticated;

drop policy if exists "equipe gerencia perdas" on public.perdas;
create policy "equipe gerencia perdas"
  on public.perdas for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. VISÃO DE APOIO — perdas do mês por motivo
--    Consulta rápida: select * from public.perdas_por_motivo;
-- ---------------------------------------------------------------------
create or replace view public.perdas_por_motivo as
select
  date_trunc('month', criado_em)::date as mes,
  motivo,
  sum(quantidade)                      as unidades,
  sum(quantidade * custo_unit)         as custo_total
from public.perdas
group by 1, 2
order by 1 desc, 4 desc;

alter view public.perdas_por_motivo set (security_invoker = on);
revoke all on public.perdas_por_motivo from anon;
grant select on public.perdas_por_motivo to authenticated;

-- ---------------------------------------------------------------------
-- Avisa a API sobre a tabela nova.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
