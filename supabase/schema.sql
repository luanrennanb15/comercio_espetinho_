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
  ordem       integer     not null default 0,
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);

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
-- Dados iniciais (rode uma vez; apague se não quiser exemplos)
-- ---------------------------------------------------------------------
insert into public.produtos (nome, descricao, categoria, preco, ordem) values
  ('Espetinho de Carne',            'Alcatra temperada na brasa',    'Espetinhos',       9.00, 1),
  ('Espetinho de Frango',           'Peito de frango marinado',      'Espetinhos',       8.00, 2),
  ('Espetinho de Linguiça',         'Linguiça toscana artesanal',    'Espetinhos',       8.00, 3),
  ('Espetinho de Coração',          'Coração de frango no sal grosso','Espetinhos',     10.00, 4),
  ('Espetinho de Queijo Coalho',    'Com melaço de cana',            'Espetinhos',       9.00, 5),
  ('Medalhão de Frango com Bacon',  'Enrolado no bacon',             'Espetinhos',      12.00, 6),
  ('Pão de Alho',                   'Na brasa, com manteiga de alho','Acompanhamentos',  7.00, 7),
  ('Farofa da Casa',                'Porção individual',             'Acompanhamentos',  6.00, 8),
  ('Vinagrete',                     'Porção individual',             'Acompanhamentos',  4.00, 9),
  ('Mandioca Frita',                'Porção 400g',                   'Porções',         25.00, 10),
  ('Batata Frita',                  'Porção 400g',                   'Porções',         25.00, 11),
  ('Refrigerante Lata',             '350ml — diversos sabores',      'Bebidas',          6.00, 12),
  ('Cerveja Long Neck',             '355ml gelada',                  'Bebidas',         10.00, 13),
  ('Água Mineral',                  '500ml com ou sem gás',          'Bebidas',          4.00, 14),
  ('Suco Natural',                  'Laranja, maracujá ou abacaxi',  'Bebidas',          9.00, 15)
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
