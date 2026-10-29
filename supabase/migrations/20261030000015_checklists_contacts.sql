-- =============================================================================
-- House Hub · Listas para llegar e irse, y contactos de la casa
--
-- 1) Listas: «Al llegar» (abrir el agua, subir el diferencial…) y «Al irse» (cerrar el
--    gas, bajar persianas…). La familia las escribe una vez; al llegar o irse se van
--    tachando en el móvil y, al terminar, se apunta quién y cuándo («Ana cerró la casa
--    el lunes 26»).
-- 2) Contactos: fontanero, vecino con llave, centro de salud… con su teléfono para
--    llamar con un toque.
--
-- Como el resto del contenido, cualquiera de la casa puede añadir, cambiar y borrar
-- (RLS: solo si eres de la casa). Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Listas para llegar e irse
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  kind text not null check (kind in ('arrive', 'leave')),
  text text not null check (char_length(text) between 1 and 150),
  -- Orden en la lista (de menor a mayor).
  position integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checklist_items_house on public.checklist_items (house_id, kind, position);
drop trigger if exists checklist_items_touch on public.checklist_items;
create trigger checklist_items_touch before update on public.checklist_items
  for each row execute function public.touch_updated_at();

-- Cada vez que alguien termina una lista: quién, cuándo y cuántas cosas tachó.
create table if not exists public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  kind text not null check (kind in ('arrive', 'leave')),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  checked integer not null check (checked >= 0),
  total integer not null check (total >= 0 and checked <= total and total <= 100),
  finished_at timestamptz not null default now()
);
create index if not exists checklist_runs_house on public.checklist_runs (house_id, kind, finished_at desc);

alter table public.checklist_items enable row level security;
alter table public.checklist_runs enable row level security;
revoke all on table public.checklist_items, public.checklist_runs from anon, authenticated;

grant select, delete on table public.checklist_items to authenticated;
grant insert (house_id, kind, text, position) on table public.checklist_items to authenticated;
grant update (text, position) on table public.checklist_items to authenticated;
drop policy if exists "checklist: todo si eres de la casa" on public.checklist_items;
create policy "checklist: todo si eres de la casa" on public.checklist_items
  for all to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));

-- El historial no se cambia: se ve y se añade (siempre a tu nombre).
grant select on table public.checklist_runs to authenticated;
grant insert (house_id, kind, checked, total) on table public.checklist_runs to authenticated;
drop policy if exists "runs: ver si eres de la casa" on public.checklist_runs;
create policy "runs: ver si eres de la casa" on public.checklist_runs
  for select to authenticated using (public.is_house_member(house_id));
drop policy if exists "runs: apuntar si eres de la casa" on public.checklist_runs;
create policy "runs: apuntar si eres de la casa" on public.checklist_runs
  for insert to authenticated
  with check (public.is_house_member(house_id) and user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 2) Contactos de la casa
-- -----------------------------------------------------------------------------
create table if not exists public.house_contacts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- «Fontanero», «Vecina (tiene llave)», «Centro de salud»…
  role text not null default '' check (char_length(role) <= 80),
  -- Solo cifras, espacios y un «+» inicial: 3 a 20 caracteres.
  phone text not null check (phone ~ '^\+?[0-9 ]{3,20}$'),
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists house_contacts_house on public.house_contacts (house_id, name);
drop trigger if exists house_contacts_touch on public.house_contacts;
create trigger house_contacts_touch before update on public.house_contacts
  for each row execute function public.touch_updated_at();

alter table public.house_contacts enable row level security;
revoke all on table public.house_contacts from anon, authenticated;
grant select, delete on table public.house_contacts to authenticated;
grant insert (house_id, name, role, phone, note) on table public.house_contacts to authenticated;
grant update (name, role, phone, note) on table public.house_contacts to authenticated;
drop policy if exists "contacts: todo si eres de la casa" on public.house_contacts;
create policy "contacts: todo si eres de la casa" on public.house_contacts
  for all to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));

commit;
