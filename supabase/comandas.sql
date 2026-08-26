-- =====================================================================
--  FRONT BEER — COMANDAS
--
--  Cartões numerados que o cliente carrega na mesa. Cada cartão tem um
--  código secreto próprio, impresso no QR Code, que permite ao cliente
--  ver o próprio consumo — e nada mais.
--
--  COMO USAR: Supabase > SQL Editor > New query > cole TUDO > Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. AS COMANDAS
--    livre  = cartão disponível (verde no quadro)
--    em_uso = cliente consumindo (vermelho no quadro)
-- ---------------------------------------------------------------------
create table if not exists public.comandas (
  id        uuid primary key default gen_random_uuid(),
  numero    integer not null unique check (numero > 0),
  token     text    not null unique,          -- segredo impresso no QR
  status    text    not null default 'livre' check (status in ('livre', 'em_uso')),
  aberta_em timestamptz,
  criado_em timestamptz not null default now()
);

comment on column public.comandas.token is
  'Código secreto do cartão. Vai no QR Code e é a única chave que o cliente usa.';

create index if not exists comandas_status_idx on public.comandas (status);

-- ---------------------------------------------------------------------
-- 2. ITENS EM ABERTO
--    Cada lançamento guarda a própria hora: é o que permite o relatório
--    de horário de pico apontar o momento do consumo, e não o do
--    pagamento, que acontece horas depois.
-- ---------------------------------------------------------------------
create table if not exists public.comanda_itens (
  id         uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references public.comandas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome       text          not null,
  categoria  text          not null default 'Outros',
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  quantidade integer       not null check (quantidade > 0 and quantidade <= 999),
  criado_em  timestamptz   not null default now()
);

create index if not exists comanda_itens_comanda_idx on public.comanda_itens (comanda_id);

-- A hora do lançamento também é preservada na venda definitiva
alter table public.venda_itens add column if not exists criado_em timestamptz not null default now();

-- A venda passa a saber de qual comanda veio
alter table public.vendas add column if not exists comanda_numero integer;
alter table public.vendas add column if not exists aberta_em      timestamptz;

comment on column public.vendas.comanda_numero is 'Número do cartão usado; nulo em venda rápida de balcão';
comment on column public.vendas.aberta_em      is 'Quando a comanda foi aberta — permite medir tempo de permanência';

-- ---------------------------------------------------------------------
-- 3. CRIAR OS 20 CARTÕES
--    Rode uma vez. Para mudar a quantidade, altere o número 20.
--    Cartões que já existem são preservados com o mesmo código.
-- ---------------------------------------------------------------------
insert into public.comandas (numero, token)
select g, encode(gen_random_bytes(12), 'hex')
from generate_series(1, 20) as g
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------
-- 4. SEGURANÇA
--    O público NÃO recebe permissão sobre estas tabelas. O cliente vê o
--    próprio consumo apenas pela função do item 5.
-- ---------------------------------------------------------------------
alter table public.comandas      enable row level security;
alter table public.comanda_itens enable row level security;

revoke all on public.comandas      from anon;
revoke all on public.comanda_itens from anon;
grant select, insert, update, delete on public.comandas      to authenticated;
grant select, insert, update, delete on public.comanda_itens to authenticated;

drop policy if exists "equipe gerencia comandas" on public.comandas;
create policy "equipe gerencia comandas"
  on public.comandas for all
  to authenticated
  using (true) with check (true);

drop policy if exists "equipe gerencia itens da comanda" on public.comanda_itens;
create policy "equipe gerencia itens da comanda"
  on public.comanda_itens for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 5. EXTRATO DO CLIENTE
--
--    Esta é a ÚNICA porta aberta ao público, e ela é estreita de
--    propósito: recebe o código do cartão e devolve somente os itens da
--    comanda que estiver ABERTA naquele momento. Comanda fechada devolve
--    "encerrada" — o link do QR para de funcionar até a próxima abertura.
--
--    Não expõe faturamento, não expõe outras comandas, não permite
--    alterar nada.
-- ---------------------------------------------------------------------
create or replace function public.extrato_comanda(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comanda public.comandas%rowtype;
  v_itens   jsonb;
  v_total   numeric(10,2);
begin
  if p_token is null or char_length(p_token) < 8 then
    return jsonb_build_object('encontrada', false);
  end if;

  select * into v_comanda from public.comandas where token = p_token;

  if not found then
    return jsonb_build_object('encontrada', false);
  end if;

  if v_comanda.status <> 'em_uso' then
    return jsonb_build_object(
      'encontrada', true,
      'aberta',     false,
      'numero',     v_comanda.numero
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nome',       i.nome,
           'quantidade', i.quantidade,
           'preco_unit', i.preco_unit,
           'subtotal',   round(i.preco_unit * i.quantidade, 2),
           'hora',       to_char(i.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI')
         ) order by i.criado_em), '[]'::jsonb),
         coalesce(sum(i.preco_unit * i.quantidade), 0)
    into v_itens, v_total
  from public.comanda_itens i
  where i.comanda_id = v_comanda.id;

  return jsonb_build_object(
    'encontrada', true,
    'aberta',     true,
    'numero',     v_comanda.numero,
    'aberta_em',  to_char(v_comanda.aberta_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
    'itens',      v_itens,
    'total',      v_total
  );
end;
$$;

revoke all on function public.extrato_comanda(text) from public;
grant execute on function public.extrato_comanda(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 6. Conferência — deve listar as 20 comandas criadas
-- ---------------------------------------------------------------------
select numero, status, left(token, 6) || '...' as codigo
from public.comandas
order by numero;
