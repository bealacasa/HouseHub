-- =============================================================================
-- House Hub · Calendario de reservas (estancias)
--
-- Cada fila es una reserva: quién va (un miembro, con o sin cuenta), desde qué día hasta
-- qué día (ambos incluidos), cuántas personas y una nota.
-- Los solapes NO se impiden: la app avisa («esos días ya va Ana») y se puede reservar igual.
-- =============================================================================

begin;

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  member_id uuid not null,
  -- Tipo date: solo el día, sin hora ni zona horaria.
  start_date date not null,
  end_date date not null,
  people smallint not null default 1 check (people between 1 and 50),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- Como mucho un año por reserva (evita errores al teclear el año).
  check (end_date - start_date <= 366),
  -- Clave compuesta: el miembro tiene que ser de esta misma casa.
  foreign key (house_id, member_id) references public.house_members (house_id, id)
    on delete cascade
);

-- Para pedir "las reservas de este mes" rápido.
create index stays_house_dates on public.stays (house_id, start_date, end_date);

create trigger stays_touch before update on public.stays
  for each row execute function public.touch_updated_at();

alter table public.stays enable row level security;
revoke all on table public.stays from anon, authenticated;
grant select, delete on table public.stays to authenticated;
grant insert (house_id, member_id, start_date, end_date, people, note) on table public.stays to authenticated;
grant update (member_id, start_date, end_date, people, note) on table public.stays to authenticated;

-- Ver y crear: cualquier miembro de la casa.
create policy "stays: ver si eres miembro" on public.stays
  for select to authenticated using (public.is_house_member(house_id));
create policy "stays: crear si eres miembro" on public.stays
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));

-- Cambiar y borrar: quien la creó o un administrador.
create policy "stays: editar la tuya o si eres admin" on public.stays
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id))
  with check (public.is_house_member(house_id));
create policy "stays: borrar la tuya o si eres admin" on public.stays
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

commit;
