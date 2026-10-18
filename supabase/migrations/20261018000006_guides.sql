-- =============================================================================
-- House Hub · Instrucciones de la casa
--
-- «Cómo usar la placa de inducción», «Cómo encender la caldera»… Cada instrucción tiene
-- un título, una introducción y una lista ORDENADA de pasos (texto + foto opcional).
-- Los pasos se guardan juntos en una columna jsonb: así se guardan de una vez (todo o
-- nada) y el orden es el del array. La base de datos comprueba su forma.
-- Fotos en un bucket privado: guide-photos/{casa}/{foto}.webp (URLs firmadas).
-- =============================================================================

begin;

-- ¿Tienen los pasos la forma correcta? Array de 1 a 30 objetos {text, photo}.
create or replace function public.guide_steps_valid(p_steps jsonb, p_house uuid)
returns boolean language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_steps) = 'array'
    and jsonb_array_length(p_steps) between 1 and 30
    and not exists (
      select 1 from jsonb_array_elements(p_steps) as s(step)
      where jsonb_typeof(step) <> 'object'
         or jsonb_typeof(step -> 'text') <> 'string'
         or char_length(step ->> 'text') not between 1 and 500
         or (step ? 'photo' and jsonb_typeof(step -> 'photo') not in ('string', 'null'))
         or (jsonb_typeof(step -> 'photo') = 'string'
             and public.house_from_path(step ->> 'photo') is distinct from p_house)
         or (select count(*) from jsonb_object_keys(step)) > 2
    );
$$;

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  intro text not null default '' check (char_length(intro) <= 500),
  steps jsonb not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.guide_steps_valid(steps, house_id))
);
create index guides_house on public.guides (house_id, title);
create trigger guides_touch before update on public.guides
  for each row execute function public.touch_updated_at();

alter table public.guides enable row level security;
revoke all on table public.guides from anon, authenticated;
grant select, delete on table public.guides to authenticated;
grant insert (house_id, title, intro, steps) on table public.guides to authenticated;
grant update (title, intro, steps) on table public.guides to authenticated;

create policy "guides: ver si eres miembro" on public.guides
  for select to authenticated using (public.is_house_member(house_id));
create policy "guides: crear si eres miembro" on public.guides
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
create policy "guides: editar la tuya o si eres admin" on public.guides
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id))
  with check (public.is_house_member(house_id));
create policy "guides: borrar la tuya o si eres admin" on public.guides
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

-- Fotos de los pasos: máx. 3 MB, solo WebP/JPEG (se reducen en el móvil).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-photos', 'guide-photos', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "guide-photos: ver si eres miembro" on storage.objects;
create policy "guide-photos: ver si eres miembro" on storage.objects
  for select to authenticated
  using (bucket_id = 'guide-photos' and public.is_house_member(public.house_from_path(name)));

drop policy if exists "guide-photos: subir si eres miembro" on storage.objects;
create policy "guide-photos: subir si eres miembro" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guide-photos' and public.is_house_member(public.house_from_path(name)));

drop policy if exists "guide-photos: borrar la tuya o si eres admin" on storage.objects;
create policy "guide-photos: borrar la tuya o si eres admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'guide-photos'
    and (owner_id = (select auth.uid())::text or public.is_house_admin(public.house_from_path(name)))
  );

commit;
