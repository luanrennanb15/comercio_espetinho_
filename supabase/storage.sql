-- =====================================================================
--  FRONT BEER — Armazenamento das fotos dos produtos
--
--  Cria o "balde" (bucket) onde as fotos enviadas pelo painel ficam
--  guardadas, e define quem pode fazer o quê.
--
--  COMO USAR: Supabase > SQL Editor > New query > cole TUDO > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O balde de fotos
--    public = true  -> qualquer pessoa consegue VER a foto pelo link.
--    Isso é necessário: o cardápio é aberto, sem login.
--    Enviar e apagar continua restrito à equipe (regras do item 2).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos',
  'produtos',
  true,
  3145728,                                             -- 3 MB por arquivo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ---------------------------------------------------------------------
-- 2. Permissões
-- ---------------------------------------------------------------------
drop policy if exists "fotos visiveis para todos"   on storage.objects;
drop policy if exists "equipe envia fotos"          on storage.objects;
drop policy if exists "equipe substitui fotos"      on storage.objects;
drop policy if exists "equipe apaga fotos"          on storage.objects;

-- Visitante do cardápio: só VÊ
create policy "fotos visiveis para todos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'produtos');

-- Equipe logada: envia, substitui e apaga
create policy "equipe envia fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos');

create policy "equipe substitui fotos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos')
  with check (bucket_id = 'produtos');

create policy "equipe apaga fotos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos');

-- ---------------------------------------------------------------------
-- 3. Conferência
-- ---------------------------------------------------------------------
select id as balde, public as publico, file_size_limit as limite_bytes
from storage.buckets
where id = 'produtos';
