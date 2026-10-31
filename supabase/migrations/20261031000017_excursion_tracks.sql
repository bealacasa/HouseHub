-- =============================================================================
-- House Hub · Rutas GPX en las excursiones
--
-- Cada excursión puede llevar su ruta en un archivo GPX (de Wikiloc, Komoot, el reloj…).
-- La app lo limpia antes de subirlo: se queda SOLO con los puntos (latitud, longitud y
-- altura), sin horas, autor ni datos del aparato. Con eso dibuja la forma de la ruta y
-- su perfil, y calcula los km y el desnivel.
-- Archivos en un bucket privado: excursion-tracks/{casa}/{archivo}.gpx (URLs firmadas).
-- Como el resto: cualquiera de la casa puede subir, cambiar o quitar la ruta.
-- De paso, corrige la comprobación de la foto de portada (ver más abajo).
-- Idempotente: se puede ejecutar varias veces. Necesita la migración de excursiones.
-- =============================================================================

begin;

-- ¿De qué casa es este archivo? {uuid de la casa}/{uuid}.gpx → la casa; si no, null.
create or replace function public.house_from_track_path(p_path text)
returns uuid language sql immutable set search_path = ''
as $$
  select case
    when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$'
      then split_part(p_path, '/', 1)::uuid
  end;
$$;

-- La ruta debe estar en la carpeta de ESTA casa (no se puede enlazar la de otra).
-- «is not distinct from» y no «=»: si la ruta no tiene la forma correcta, la función da
-- null, y «null = casa» no es falso sino desconocido… y un check desconocido se acepta.
alter table public.excursions add column if not exists track_path text;
alter table public.excursions drop constraint if exists excursions_track_path_check;
alter table public.excursions add constraint excursions_track_path_check
  check (track_path is null
         or public.house_from_track_path(track_path) is not distinct from house_id);

-- Mismo arreglo para la foto de portada: la migración 0010 usaba «=» y dejaba pasar
-- rutas con forma incorrecta. Postgres llamó a esa regla «excursions_check»; se quita
-- solo si es ella (la que habla de photo_path) y se pone la buena con nombre propio.
do $$
begin
  if exists (select 1 from pg_constraint
             where conrelid = 'public.excursions'::regclass and conname = 'excursions_check'
               and pg_get_constraintdef(oid) like '%photo_path%') then
    alter table public.excursions drop constraint excursions_check;
  end if;
end;
$$;
alter table public.excursions drop constraint if exists excursions_photo_path_check;
alter table public.excursions add constraint excursions_photo_path_check
  check (photo_path is null
         or public.house_from_path(photo_path) is not distinct from house_id);

grant insert (track_path), update (track_path) on table public.excursions to authenticated;

-- Archivos GPX: máx. 5 MB y solo de tipo GPX.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('excursion-tracks', 'excursion-tracks', false, 5242880, array['application/gpx+xml'])
on conflict (id) do nothing;

drop policy if exists "excursion-tracks: ver si eres de la casa" on storage.objects;
create policy "excursion-tracks: ver si eres de la casa" on storage.objects
  for select to authenticated
  using (bucket_id = 'excursion-tracks' and public.is_house_member(public.house_from_track_path(name)));

drop policy if exists "excursion-tracks: subir si eres de la casa" on storage.objects;
create policy "excursion-tracks: subir si eres de la casa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'excursion-tracks' and public.is_house_member(public.house_from_track_path(name)));

drop policy if exists "excursion-tracks: borrar si eres de la casa" on storage.objects;
create policy "excursion-tracks: borrar si eres de la casa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'excursion-tracks' and public.is_house_member(public.house_from_track_path(name)));

commit;
