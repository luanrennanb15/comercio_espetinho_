-- =====================================================================
--  BANCO DE DADOS — CARDÁPIO ONLINE
--  Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tabela de produtos
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  nome        text        not null check (char_length(nome) between 1 and 80),
  descricao   text        not null default '' check (char_length(descricao) <= 180),
  categoria   text        not null default 'Outros' check (char_length(categoria) between 1 and 40),
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  imagem_url  text        not null default '',
  ativo       boolean     not null default true,   -- aparece no cardápio?
  esgotado    boolean     not null default false,  -- acabou hoje?
  alcoolico   boolean     not null default false,  -- exibe selo 18+ no cardápio
  ordem       integer     not null default 0,
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);

-- Se a tabela já existia sem a coluna alcoolico, esta linha a adiciona:
alter table public.produtos add column if not exists alcoolico boolean not null default false;

create index if not exists produtos_ordem_idx     on public.produtos (ordem, nome);
create index if not exists produtos_categoria_idx on public.produtos (categoria, ordem);
create index if not exists produtos_ativo_idx     on public.produtos (ativo);

-- Atualiza alterado_em automaticamente
create or replace function public.tocar_alterado_em()
returns trigger language plpgsql as $$
begin
  new.alterado_em = now();
  return new;
end $$;

drop trigger if exists trg_produtos_alterado on public.produtos;
create trigger trg_produtos_alterado
  before update on public.produtos
  for each row execute function public.tocar_alterado_em();

-- ---------------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
--   - Qualquer visitante LÊ apenas produtos ativos.
--   - Somente usuários autenticados podem criar/editar/excluir.
--   A chave "anon" usada no site é pública por design; é a RLS abaixo
--   que impede alguém de alterar seus preços.
-- ---------------------------------------------------------------------
alter table public.produtos enable row level security;

drop policy if exists "leitura publica de itens ativos" on public.produtos;
create policy "leitura publica de itens ativos"
  on public.produtos for select
  to anon
  using (ativo = true);

drop policy if exists "equipe le tudo" on public.produtos;
create policy "equipe le tudo"
  on public.produtos for select
  to authenticated
  using (true);

drop policy if exists "equipe cria" on public.produtos;
create policy "equipe cria"
  on public.produtos for insert
  to authenticated
  with check (true);

drop policy if exists "equipe edita" on public.produtos;
create policy "equipe edita"
  on public.produtos for update
  to authenticated
  using (true) with check (true);

drop policy if exists "equipe exclui" on public.produtos;
create policy "equipe exclui"
  on public.produtos for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Dados de EXEMPLO — Front Beer (adega e petiscaria)
-- Itens e preços ilustrativos, só para o cardápio não nascer vazio.
-- O proprietário troca tudo pelo painel (há o botão "Limpar cardápio").
-- Se preferir começar do zero, não rode este bloco.
-- ---------------------------------------------------------------------
insert into public.produtos (nome, descricao, categoria, preco, alcoolico, ordem) values
  -- Espetos
  ('Espeto de Carne',              'Alcatra temperada na brasa',      'Espetos',             10.00, false,  1),
  ('Espeto de Frango',             'Peito de frango marinado',        'Espetos',              9.00, false,  2),
  ('Espeto de Linguiça',           'Linguiça toscana',                'Espetos',              9.00, false,  3),
  ('Espeto de Coração',            'Coração de frango no sal grosso', 'Espetos',             11.00, false,  4),
  ('Espeto de Queijo Coalho',      'Com melaço de cana',              'Espetos',             10.00, false,  5),
  ('Espeto de Cupim',              'Fatiado, na brasa',               'Espetos',             13.00, false,  6),
  ('Medalhão de Frango com Bacon', 'Enrolado no bacon',               'Espetos',             13.00, false,  7),
  ('Pão de Alho',                  'Na brasa, com manteiga de alho',  'Espetos',              8.00, false,  8),
  -- Petiscos
  ('Batata Frita',                 'Porção 400g',                     'Petiscos',            28.00, false,  9),
  ('Mandioca Frita',               'Porção 400g',                     'Petiscos',            26.00, false, 10),
  ('Calabresa Acebolada',          'Porção com pão de alho',          'Petiscos',            32.00, false, 11),
  ('Torresmo Crocante',            'Porção 300g',                     'Petiscos',            30.00, false, 12),
  ('Frango a Passarinho',          'Porção 500g com alho e limão',    'Petiscos',            38.00, false, 13),
  ('Amendoim Torrado',             'Porção individual',               'Petiscos',             8.00, false, 14),
  -- Cervejas
  ('Cerveja Lata 269ml',           'Latinha gelada',                  'Cervejas',             5.00, true,  15),
  ('Cerveja Lata 350ml',           'Gelada',                          'Cervejas',             6.50, true,  16),
  ('Cerveja Lata 473ml',           'Latão gelado',                    'Cervejas',             9.00, true,  17),
  ('Cerveja Long Neck 330ml',      'Gelada',                          'Cervejas',            11.00, true,  18),
  ('Cerveja Garrafa 600ml',        'Gelada',                          'Cervejas',            14.00, true,  19),
  ('Cerveja Puro Malte 350ml',     'Lata gelada',                     'Cervejas',             7.50, true,  20),
  -- Doses e destilados
  ('Dose de Cachaça',              '50ml',                            'Doses e Destilados',   7.00, true,  21),
  ('Dose de Vodka',                '50ml',                            'Doses e Destilados',  12.00, true,  22),
  ('Dose de Whisky',               '50ml',                            'Doses e Destilados',  18.00, true,  23),
  ('Caipirinha',                   'Limão, morango ou maracujá',      'Doses e Destilados',  18.00, true,  24),
  ('Gin Tônica',                   'Com limão siciliano',             'Doses e Destilados',  24.00, true,  25),
  ('Garrafa de Vodka',             '1L — para levar',                 'Doses e Destilados',  45.00, true,  26),
  ('Garrafa de Whisky',            '1L — para levar',                 'Doses e Destilados', 120.00, true,  27),
  -- Sem álcool
  ('Refrigerante Lata 350ml',      'Diversos sabores',                'Sem Álcool',           6.00, false, 28),
  ('Refrigerante 2L',              'Diversos sabores',                'Sem Álcool',          14.00, false, 29),
  ('Energético 250ml',             'Lata gelada',                     'Sem Álcool',          12.00, false, 30),
  ('Água Mineral 500ml',           'Com ou sem gás',                  'Sem Álcool',           4.00, false, 31),
  ('Água de Coco 200ml',           'Caixinha gelada',                 'Sem Álcool',           6.00, false, 32),
  ('Suco de Caixinha',             'Diversos sabores',                'Sem Álcool',           7.00, false, 33)
on conflict do nothing;

-- =====================================================================
-- PRÓXIMA FASE (relatório de vendas) — deixe comentado por enquanto.
-- Descomente quando quiser registrar as vendas do balcão.
-- =====================================================================
-- create table if not exists public.vendas (
--   id         uuid primary key default gen_random_uuid(),
--   criado_em  timestamptz not null default now(),
--   total      numeric(10,2) not null default 0 check (total >= 0),
--   pagamento  text not null default 'dinheiro',
--   observacao text not null default ''
-- );
--
-- create table if not exists public.venda_itens (
--   id          uuid primary key default gen_random_uuid(),
--   venda_id    uuid not null references public.vendas(id) on delete cascade,
--   produto_id  uuid references public.produtos(id) on delete set null,
--   nome        text not null,          -- congela o nome na hora da venda
--   preco_unit  numeric(10,2) not null, -- congela o preço na hora da venda
--   quantidade  integer not null check (quantidade > 0)
-- );
--
-- alter table public.vendas      enable row level security;
-- alter table public.venda_itens enable row level security;
-- create policy "equipe gerencia vendas" on public.vendas
--   for all to authenticated using (true) with check (true);
-- create policy "equipe gerencia itens"  on public.venda_itens
--   for all to authenticated using (true) with check (true);
