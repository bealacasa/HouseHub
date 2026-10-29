-- =============================================================================
-- House Hub · Recordatorios personales (privados)
--
-- «Llevar las llaves del garaje», «Pedir cita del ITV»… Cada recordatorio es SOLO de
-- quien lo escribe: nadie más de la familia lo ve, ni siquiera quien administra.
-- Esa regla la pone la base de datos (RLS), no la app: aunque alguien manipulara la app,
-- Postgres solo devuelve y deja tocar las filas cuyo user_id es el tuyo.
-- Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

create table if not exists public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  -- Dueño del recordatorio. Si borra su cuenta, se borran sus recordatorios.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  -- Para cuándo (opcional): sin fecha = «cuando pueda».
  due_date date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_reminders_user on public.personal_reminders (user_id, due_date);
drop trigger if exists personal_reminders_touch on public.personal_reminders;
create trigger personal_reminders_touch before update on public.personal_reminders
  for each row execute function public.touch_updated_at();

alter table public.personal_reminders enable row level security;
revoke all on table public.personal_reminders from anon, authenticated;
grant select, delete on table public.personal_reminders to authenticated;
-- user_id no se puede elegir: siempre es quien lo crea (valor por defecto auth.uid()).
grant insert (house_id, text, due_date) on table public.personal_reminders to authenticated;
grant update (text, due_date, done_at) on table public.personal_reminders to authenticated;

-- Una sola condición para todo: es tuyo (y sigues siendo de la casa).
drop policy if exists "reminders: solo los tuyos" on public.personal_reminders;
create policy "reminders: solo los tuyos" on public.personal_reminders
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_house_member(house_id))
  with check (user_id = (select auth.uid()) and public.is_house_member(house_id));

commit;
