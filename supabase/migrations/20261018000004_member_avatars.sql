-- =============================================================================
-- House Hub · Foto de perfil de cada miembro
--
-- La foto va en el miembro (no en la cuenta), así también la pueden tener los familiares
-- sin cuenta. Cada uno cambia la suya; el administrador, la de cualquiera.
-- Archivos en un bucket privado: avatars/{casa}/{foto}.webp (se ven con URLs firmadas).
-- =============================================================================

begin;

alter table public.house_members
  add column if not exists avatar_path text
  check (avatar_path is null or public.house_from_path(avatar_path) is not null);

-- Cambiar la foto: en vez de dar permiso de UPDATE (que dejaría a un miembro cambiarse el
-- rol), una función que solo toca avatar_path y comprueba quién la llama.
create or replace function public.set_member_avatar(p_member uuid, p_path text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.house_members;
begin
  select * into v_member from public.house_members where id = p_member;
  if not found then raise exception 'Ese miembro no existe.' using errcode = 'P0001'; end if;
  if not (v_member.user_id = (select auth.uid()) or public.is_house_admin(v_member.house_id)) then
    raise exception 'Solo puedes cambiar tu propia foto.' using errcode = 'P0001';
  end if;
  if p_path is not null and public.house_from_path(p_path) is distinct from v_member.house_id then
    raise exception 'Foto no válida.' using errcode = 'P0001';
  end if;
  update public.house_members set avatar_path = p_path where id = p_member;
end;
$$;

revoke all on function public.set_member_avatar(uuid, text) from public, anon;
grant execute on function public.set_member_avatar(uuid, text) to authenticated;

-- Bucket privado: máx. 2 MB, solo WebP/JPEG (las fotos se reducen en el móvil).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "avatars: ver si eres miembro" on storage.objects;
create policy "avatars: ver si eres miembro" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_house_member(public.house_from_path(name)));

drop policy if exists "avatars: subir si eres miembro" on storage.objects;
create policy "avatars: subir si eres miembro" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_house_member(public.house_from_path(name)));

-- Borrar la foto antigua: quien la subió o un administrador.
drop policy if exists "avatars: borrar la tuya o si eres admin" on storage.objects;
create policy "avatars: borrar la tuya o si eres admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (owner_id = (select auth.uid())::text or public.is_house_admin(public.house_from_path(name)))
  );

commit;
