-- =====================================================================
--  FRONT BEER — Adega e Petiscaria
--  Banco de dados do cardápio digital
--
--  COMO USAR
--    1. Acesse o painel do Supabase do projeto
--    2. Menu lateral: SQL Editor > New query
--    3. Cole este arquivo inteiro e clique em RUN
--
--  O script pode ser executado mais de uma vez sem quebrar nada.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABELA DE PRODUTOS
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  nome        text          not null check (char_length(nome) between 1 and 80),
  descricao   text          not null default '' check (char_length(descricao) <= 180),
  categoria   text          not null default 'Outros' check (char_length(categoria) between 1 and 40),
  preco       numeric(10,2) not null default 0 check (preco >= 0 and preco <= 100000),
  imagem_url  text          not null default '',
  ativo       boolean       not null default true,
  esgotado    boolean       not null default false,
  alcoolico   boolean       not null default false,
  ordem       integer       not null default 0,
  criado_em   timestamptz   not null default now(),
  alterado_em timestamptz   not null default now()
);

-- Colunas adicionadas em versões posteriores (seguro rodar sempre)
alter table public.produtos add column if not exists alcoolico boolean not null default false;

comment on table  public.produtos            is 'Itens do cardápio da Front Beer';
comment on column public.produtos.ativo      is 'Falso oculta o item do cardápio sem apagar o cadastro';
comment on column public.produtos.esgotado   is 'Verdadeiro exibe o item riscado, como indisponível no dia';
comment on column public.produtos.alcoolico  is 'Verdadeiro exibe o selo 18+ (Lei 13.106/2015)';
comment on column public.produtos.ordem      is 'Define a ordem dos itens e das categorias no cardápio';

create index if not exists produtos_ordem_idx     on public.produtos (ordem, nome);
create index if not exists produtos_categoria_idx on public.produtos (categoria, ordem);
create index if not exists produtos_ativo_idx     on public.produtos (ativo) where ativo;

-- ---------------------------------------------------------------------
-- 2. CARIMBO AUTOMÁTICO DE ALTERAÇÃO
-- ---------------------------------------------------------------------
create or replace function public.tocar_alterado_em()
returns trigger
language plpgsql
as $$
begin
  new.alterado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_produtos_alterado on public.produtos;
create trigger trg_produtos_alterado
  before update on public.produtos
  for each row execute function public.tocar_alterado_em();

-- ---------------------------------------------------------------------
-- 3. SEGURANÇA (Row Level Security)
--
--    A chave "anon" usada no site é pública por natureza: qualquer
--    visitante consegue lê-la no navegador. Quem realmente protege os
--    dados são as políticas abaixo.
--
--      visitante (anon)      -> só LÊ produtos ativos
--      equipe (authenticated)-> lê tudo, cria, edita e exclui
--
--    Nunca coloque a chave service_role no site.
-- ---------------------------------------------------------------------
alter table public.produtos enable row level security;

drop policy if exists "publico le itens ativos" on public.produtos;
create policy "publico le itens ativos"
  on public.produtos for select
  to anon
  using (ativo = true);

drop policy if exists "equipe le tudo" on public.produtos;
create policy "equipe le tudo"
  on public.produtos for select
  to authenticated
  using (true);

drop policy if exists "equipe cadastra" on public.produtos;
create policy "equipe cadastra"
  on public.produtos for insert
  to authenticated
  with check (true);

drop policy if exists "equipe edita" on public.produtos;
create policy "equipe edita"
  on public.produtos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "equipe exclui" on public.produtos;
create policy "equipe exclui"
  on public.produtos for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- 4. CARDÁPIO DE EXEMPLO
--    Valores ilustrativos, apenas para o site não nascer vazio.
--    O proprietário apaga tudo pelo painel (botão "Limpar cardápio")
--    e cadastra os produtos reais. Se preferir começar do zero,
--    não execute este bloco.
-- ---------------------------------------------------------------------
insert into public.produtos (nome, descricao, categoria, preco, alcoolico, ordem) values
  ('Espeto de Carne',              'Alcatra temperada na brasa',      'Espetos',             10.00, false,  1),
  ('Espeto de Frango',             'Peito de frango marinado',        'Espetos',              9.00, false,  2),
  ('Espeto de Linguiça',           'Linguiça toscana',                'Espetos',              9.00, false,  3),
  ('Espeto de Coração',            'Coração de frango no sal grosso', 'Espetos',             11.00, false,  4),
  ('Espeto de Queijo Coalho',      'Com melaço de cana',              'Espetos',             10.00, false,  5),
  ('Espeto de Cupim',              'Fatiado, na brasa',               'Espetos',             13.00, false,  6),
  ('Medalhão de Frango com Bacon', 'Enrolado no bacon',               'Espetos',             13.00, false,  7),
  ('Pão de Alho',                  'Na brasa, com manteiga de alho',  'Espetos',              8.00, false,  8),

  ('Batata Frita',                 'Porção 400g',                     'Petiscos',            28.00, false,  9),
  ('Mandioca Frita',               'Porção 400g',                     'Petiscos',            26.00, false, 10),
  ('Calabresa Acebolada',          'Porção com pão de alho',          'Petiscos',            32.00, false, 11),
  ('Torresmo Crocante',            'Porção 300g',                     'Petiscos',            30.00, false, 12),
  ('Frango a Passarinho',          'Porção 500g com alho e limão',    'Petiscos',            38.00, false, 13),
  ('Amendoim Torrado',             'Porção individual',               'Petiscos',             8.00, false, 14),

  ('Cerveja Lata 269ml',           'Gelada',                          'Cervejas',             5.00, true,  15),
  ('Cerveja Lata 350ml',           'Gelada',                          'Cervejas',             6.50, true,  16),
  ('Cerveja Lata 473ml',           'Latão gelado',                    'Cervejas',             9.00, true,  17),
  ('Cerveja Long Neck 330ml',      'Gelada',                          'Cervejas',            11.00, true,  18),
  ('Cerveja Garrafa 600ml',        'Gelada',                          'Cervejas',            14.00, true,  19),
  ('Cerveja Puro Malte 350ml',     'Lata gelada',                     'Cervejas',             7.50, true,  20),

  ('Dose de Cachaça',              '50ml',                            'Doses e Destilados',   7.00, true,  21),
  ('Dose de Vodka',                '50ml',                            'Doses e Destilados',  12.00, true,  22),
  ('Dose de Whisky',               '50ml',                            'Doses e Destilados',  18.00, true,  23),
  ('Caipirinha',                   'Limão, morango ou maracujá',      'Doses e Destilados',  18.00, true,  24),
  ('Gin Tônica',                   'Com limão siciliano',             'Doses e Destilados',  24.00, true,  25),
  ('Garrafa de Vodka',             '1L — para levar',                 'Doses e Destilados',  45.00, true,  26),
  ('Garrafa de Whisky',            '1L — para levar',                 'Doses e Destilados', 120.00, true,  27),

  ('Refrigerante Lata 350ml',      'Diversos sabores',                'Sem Álcool',           6.00, false, 28),
  ('Refrigerante 2L',              'Diversos sabores',                'Sem Álcool',          14.00, false, 29),
  ('Energético 250ml',             'Lata gelada',                     'Sem Álcool',          12.00, false, 30),
  ('Água Mineral 500ml',           'Com ou sem gás',                  'Sem Álcool',           4.00, false, 31),
  ('Água de Coco 200ml',           'Caixinha gelada',                 'Sem Álcool',           6.00, false, 32),
  ('Suco de Caixinha',             'Diversos sabores',                'Sem Álcool',           7.00, false, 33)
on conflict do nothing;

-- =====================================================================
--  5. REGISTRO DE VENDAS
--
--  Alimentado pelo PDV (pdv.html). Cada venda guarda o nome e o preço
--  do produto no momento em que foi vendida — assim, reajustar o preço
--  hoje não altera o faturamento de ontem.
-- =====================================================================

create table if not exists public.vendas (
  id         uuid primary key default gen_random_uuid(),
  criado_em  timestamptz   not null default now(),
  total      numeric(10,2) not null default 0 check (total >= 0),
  pagamento  text          not null default 'dinheiro'
               check (pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  observacao text          not null default '' check (char_length(observacao) <= 200)
);

create table if not exists public.venda_itens (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome       text          not null,                       -- congelado na venda
  categoria  text          not null default 'Outros',      -- congelada na venda
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  quantidade integer       not null check (quantidade > 0 and quantidade <= 999)
);

comment on table  public.vendas             is 'Vendas registradas no PDV';
comment on column public.vendas.total       is 'Soma dos itens no momento do fechamento';
comment on column public.venda_itens.nome   is 'Nome do produto congelado na data da venda';
comment on column public.venda_itens.preco_unit is 'Preço unitário congelado na data da venda';

create index if not exists vendas_data_idx       on public.vendas (criado_em desc);
create index if not exists venda_itens_venda_idx on public.venda_itens (venda_id);
create index if not exists venda_itens_nome_idx  on public.venda_itens (nome);

-- ---------------------------------------------------------------------
-- 6. SEGURANÇA DAS VENDAS
--    Faturamento é informação sensível: o público NÃO tem nenhuma
--    permissão aqui. Apenas quem está autenticado lê e grava.
-- ---------------------------------------------------------------------
alter table public.vendas      enable row level security;
alter table public.venda_itens enable row level security;

drop policy if exists "equipe gerencia vendas" on public.vendas;
create policy "equipe gerencia vendas"
  on public.vendas for all
  to authenticated
  using (true) with check (true);

drop policy if exists "equipe gerencia itens da venda" on public.venda_itens;
create policy "equipe gerencia itens da venda"
  on public.venda_itens for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 7. VISÃO DE APOIO — vendas do dia
--    Consulta rápida no SQL Editor: select * from public.resumo_diario;
-- ---------------------------------------------------------------------
create or replace view public.resumo_diario as
select
  date_trunc('day', v.criado_em)::date as dia,
  count(*)                             as vendas,
  sum(v.total)                         as faturamento,
  round(avg(v.total), 2)               as ticket_medio
from public.vendas v
group by 1
order by 1 desc;
