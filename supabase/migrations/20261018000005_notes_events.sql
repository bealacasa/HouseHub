-- =============================================================================
-- House Hub · Notas de la casa (lista para tachar) y eventos del pueblo
--
-- Notas: «falta aceite», «acordarse de cerrar la llave»… Cualquier miembro puede añadir,
-- tachar o borrar (es una lista compartida de la familia).
-- Eventos: fiestas, mercado, procesión… Cualquier miembro los añade; los cambia o borra
-- quien los creó o un administrador.
-- =============================================================================

begin;

create table public.house_notes (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  done_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index house_notes_house on public.house_notes (house_id, created_at);
create trigger house_notes_touch before update on public.house_notes
  for each row execute function public.touch_updated_at();

create table public.village_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  date date not null,
  -- Hora opcional (p. ej. 19:30). Tipo time: solo la hora del día.
  start_time time,
  place text not null default '' check (char_length(place) <= 100),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index village_events_house_date on public.village_events (house_id, date);
create trigger village_events_touch before update on public.village_events
  for each row execute function public.touch_updated_at();

alter table public.house_notes enable row level security;
alter table public.village_events enable row level security;
revoke all on table public.house_notes, public.village_events from anon, authenticated;

-- Notas: todo para los miembros (insertar siempre a tu nombre).
grant select, delete on table public.house_notes to authenticated;
grant insert (house_id, text) on table public.house_notes to authenticated;
grant update (text, done_at) on table public.house_notes to authenticated;
create policy "notes: ver si eres miembro" on public.house_notes
  for select to authenticated using (public.is_house_member(house_id));
create policy "notes: añadir si eres miembro" on public.house_notes
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
create policy "notes: tachar o editar si eres miembro" on public.house_notes
  for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
create policy "notes: borrar si eres miembro" on public.house_notes
  for delete to authenticated using (public.is_house_member(house_id));

-- Eventos: ver y crear los miembros; cambiar y borrar quien lo creó o un administrador.
grant select, delete on table public.village_events to authenticated;
grant insert (house_id, title, date, start_time, place, note) on table public.village_events to authenticated;
grant update (title, date, start_time, place, note) on table public.village_events to authenticated;
create policy "events: ver si eres miembro" on public.village_events
  for select to authenticated using (public.is_house_member(house_id));
create policy "events: crear si eres miembro" on public.village_events
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
create policy "events: editar el tuyo o si eres admin" on public.village_events
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id))
  with check (public.is_house_member(house_id));
create policy "events: borrar el tuyo o si eres admin" on public.village_events
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

commit;
