-- =============================================================================
-- House Hub · Excursiones cerca de la casa
--
-- Sitios a los que ir desde la casa: «Cascada del Molino», «Mirador de la Peña»…
-- Cada excursión guarda lo justo para decidir si ir: qué es, cómo se llega, cuánto dura,
-- si es fácil o difícil, un enlace al mapa y una foto opcional. Y «la última vez que
-- fuimos», para acordarse.
-- Fotos en un bucket privado: excursion-photos/{casa}/{foto}.webp (URLs firmadas).
-- Idempotente en lo posible: la tabla se crea una vez; políticas y bucket se rehacen.
-- =============================================================================

begin;

create table if not exists public.excursions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  -- «20 minutos en coche», «andando desde la plaza»…
  getting_there text not null default '' check (char_length(getting_there) <= 150),
  -- Valores fijos (en vez de texto libre) para poder enseñarlos con palabras e iconos.
  duration text not null default 'medio' check (duration in ('rato', 'medio', 'dia')),
  difficulty text not null default 'facil' check (difficulty in ('facil', 'media', 'dificil')),
  -- Enlace a Google Maps, Apple Maps, Wikiloc… Solo https (nada de javascript: ni http:).
  -- (La longitud va aparte: las expresiones regulares de Postgres no admiten {1,300}.)
  map_url text check (map_url is null or (map_url ~ '^https://\S+$' and char_length(map_url) <= 300)),
  -- La foto debe estar en la carpeta de ESTA casa (no se puede enlazar la de otra).
  photo_path text check (photo_path is null or public.house_from_path(photo_path) = house_id),
  last_visited date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists excursions_house on public.excursions (house_id, title);
drop trigger if exists excursions_touch on public.excursions;
create trigger excursions_touch before update on public.excursions
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Permisos: cualquier miembro ve y añade; cambia o borra quien la añadió o quien
-- administra (como las instrucciones). «La última vez que fuimos» la puede marcar
-- cualquiera: para eso hay una función aparte que solo toca esa columna.
-- -----------------------------------------------------------------------------
alter table public.excursions enable row level security;
revoke all on table public.excursions from anon, authenticated;
grant select, delete on table public.excursions to authenticated;
grant insert (house_id, title, description, getting_there, duration, difficulty, map_url,
              photo_path, last_visited) on table public.excursions to authenticated;
grant update (title, description, getting_there, duration, difficulty, map_url, photo_path,
              last_visited) on table public.excursions to authenticated;

drop policy if exists "excursions: ver si eres miembro" on public.excursions;
create policy "excursions: ver si eres miembro" on public.excursions
  for select to authenticated using (public.is_house_member(house_id));

drop policy if exists "excursions: añadir si eres miembro" on public.excursions;
create policy "excursions: añadir si eres miembro" on public.excursions
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));

drop policy if exists "excursions: cambiar la tuya o si eres admin" on public.excursions;
create policy "excursions: cambiar la tuya o si eres admin" on public.excursions
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id))
  with check (public.is_house_member(house_id));

drop policy if exists "excursions: borrar la tuya o si eres admin" on public.excursions;
create policy "excursions: borrar la tuya o si eres admin" on public.excursions
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

-- «Hoy hemos ido»: cualquier miembro, solo la fecha, y nunca una fecha futura.
-- security definer = se ejecuta con permisos del dueño, por eso comprueba la pertenencia.
create or replace function public.mark_excursion_visited(p_excursion uuid, p_date date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_date is null or p_date > (now() at time zone 'Europe/Madrid')::date + 1 then
    raise exception 'La fecha no puede ser futura.';
  end if;
  update public.excursions
     set last_visited = p_date
   where id = p_excursion and public.is_house_member(house_id);
  if not found then
    raise exception 'Excursión no encontrada.';
  end if;
end;
$$;
revoke all on function public.mark_excursion_visited(uuid, date) from public, anon;
grant execute on function public.mark_excursion_visited(uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Fotos: máx. 3 MB, solo WebP/JPEG (se reducen en el móvil y pierden el GPS).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('excursion-photos', 'excursion-photos', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "excursion-photos: ver si eres miembro" on storage.objects;
create policy "excursion-photos: ver si eres miembro" on storage.objects
  for select to authenticated
  using (bucket_id = 'excursion-photos' and public.is_house_member(public.house_from_path(name)));

drop policy if exists "excursion-photos: subir si eres miembro" on storage.objects;
create policy "excursion-photos: subir si eres miembro" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'excursion-photos' and public.is_house_member(public.house_from_path(name)));

drop policy if exists "excursion-photos: borrar la tuya o si eres admin" on storage.objects;
create policy "excursion-photos: borrar la tuya o si eres admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'excursion-photos'
    and (owner_id = (select auth.uid())::text or public.is_house_admin(public.house_from_path(name)))
  );

commit;
