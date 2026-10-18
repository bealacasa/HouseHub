-- =============================================================================
-- House Hub · Gastos periódicos (internet, comunidad, seguro…)
--
-- recurring_expenses  la «plantilla»: concepto, importe, quién paga, reparto y cada
--                     cuántos meses se repite. next_date = la próxima vez que toca.
-- recurring_shares    el reparto de la plantilla (como expense_shares).
-- expenses.recurring_id  qué gastos ha creado cada plantilla.
--
-- No hace falta ningún proceso programado: al abrir los gastos, la app llama a
-- run_recurring(), que apunta los que ya tocan (todo dentro de la base de datos).
-- La restricción única (recurring_id, date) impide apuntar el mismo mes dos veces.
-- =============================================================================

begin;

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  concept text not null check (char_length(concept) between 1 and 100),
  category text not null check (category in (
    'ibi', 'comunidad', 'luz', 'agua', 'gas', 'internet', 'seguro', 'reparacion', 'compra', 'otros'
  )),
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  paid_by uuid not null,
  split_mode text not null check (split_mode in ('equal', 'custom')),
  note text not null default '' check (char_length(note) <= 300),
  every_months integer not null check (every_months in (1, 2, 3, 6, 12)),
  -- Día del mes del primer gasto (31 → el último día en los meses cortos).
  day_of_month integer not null check (day_of_month between 1 and 31),
  next_date date not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (house_id, id),
  foreign key (house_id, paid_by) references public.house_members (house_id, id) on delete cascade
);

create table public.recurring_shares (
  recurring_id uuid not null,
  house_id uuid not null,
  member_id uuid not null,
  cents integer not null check (cents between 0 and 10000000),
  primary key (recurring_id, member_id),
  foreign key (house_id, recurring_id)
    references public.recurring_expenses (house_id, id) on delete cascade,
  foreign key (house_id, member_id) references public.house_members (house_id, id) on delete cascade
);

alter table public.expenses
  add column recurring_id uuid references public.recurring_expenses (id) on delete set null;
create unique index expenses_recurring_date on public.expenses (recurring_id, date)
  where recurring_id is not null;

-- n meses después, conservando el día (31 ene + 1 mes = 28/29 feb; + 2 meses = 31 mar).
create or replace function private.add_months_on_day(p_from date, p_months integer, p_day integer)
returns date language sql immutable set search_path = ''
as $$
  select (m + (least(p_day, extract(day from (m + interval '1 month' - interval '1 day'))::integer) - 1)
          * interval '1 day')::date
  from (select date_trunc('month', p_from::timestamp) + make_interval(months => p_months) as m) t;
$$;

-- -----------------------------------------------------------------------------
-- Hacer que un gasto se repita (o dejar de repetirlo). p_every = 0 → no se repite.
-- La plantilla se copia del propio gasto (ya validado por save_expense), así que si
-- cambias el importe del último recibo de internet, los siguientes saldrán con el nuevo.
-- -----------------------------------------------------------------------------
create or replace function public.set_expense_repeat(p_expense uuid, p_every integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid;
  v_exp public.expenses;
  v_rec uuid;
  v_last date;
begin
  select id into v_house from public.houses limit 1;
  if v_house is null or not public.is_house_member(v_house) then
    raise exception 'No eres de esta casa.' using errcode = 'P0001';
  end if;
  if p_every is null or p_every not in (0, 1, 2, 3, 6, 12) then
    raise exception 'Elige cada cuánto se repite.' using errcode = 'P0001';
  end if;
  select * into v_exp from public.expenses where id = p_expense and house_id = v_house for update;
  if not found then raise exception 'Ese gasto no existe.' using errcode = 'P0001'; end if;
  if not (v_exp.created_by = (select auth.uid()) or public.is_house_admin(v_house)) then
    raise exception 'Solo quien lo apuntó (o quien administra) puede cambiarlo.' using errcode = 'P0001';
  end if;

  v_rec := v_exp.recurring_id;
  if p_every = 0 then
    if v_rec is not null then
      delete from public.recurring_expenses where id = v_rec and house_id = v_house;
    end if;
    return;
  end if;

  if v_rec is null then
    insert into public.recurring_expenses
      (house_id, concept, category, amount_cents, paid_by, split_mode, note,
       every_months, day_of_month, next_date, created_by)
    values
      (v_house, v_exp.concept, v_exp.category, v_exp.amount_cents, v_exp.paid_by,
       v_exp.split_mode, v_exp.note, p_every, extract(day from v_exp.date)::integer,
       private.add_months_on_day(v_exp.date, p_every, extract(day from v_exp.date)::integer),
       (select auth.uid()))
    returning id into v_rec;
    update public.expenses set recurring_id = v_rec where id = v_exp.id;
  else
    -- La próxima vez: tras el último gasto ya apuntado de esta serie.
    select max(date) into v_last from public.expenses where recurring_id = v_rec;
    update public.recurring_expenses r
    set concept = v_exp.concept, category = v_exp.category, amount_cents = v_exp.amount_cents,
        paid_by = v_exp.paid_by, split_mode = v_exp.split_mode, note = v_exp.note,
        every_months = p_every,
        next_date = private.add_months_on_day(v_last, p_every, r.day_of_month)
    where r.id = v_rec and r.house_id = v_house;
    delete from public.recurring_shares where recurring_id = v_rec;
  end if;

  insert into public.recurring_shares (recurring_id, house_id, member_id, cents)
  select v_rec, v_house, s.member_id, s.cents
  from public.expense_shares s where s.expense_id = v_exp.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Apuntar los gastos periódicos que ya tocan (hasta hoy, hora de España).
-- Se puede llamar las veces que haga falta: nunca duplica. Devuelve cuántos apuntó.
-- -----------------------------------------------------------------------------
create or replace function public.run_recurring()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_rec public.recurring_expenses;
  v_id uuid;
  v_count integer := 0;
  v_loops integer;
begin
  select id into v_house from public.houses limit 1;
  if v_house is null or not public.is_house_member(v_house) then
    raise exception 'No eres de esta casa.' using errcode = 'P0001';
  end if;

  for v_rec in
    select * from public.recurring_expenses
    where house_id = v_house and next_date <= v_today
    for update skip locked
  loop
    -- Si alguien salió de la casa, el reparto ya no suma el total: no se apunta solo.
    if (select coalesce(sum(cents), 0) from public.recurring_shares where recurring_id = v_rec.id)
       <> v_rec.amount_cents then
      continue;
    end if;
    v_loops := 0;
    while v_rec.next_date <= v_today and v_loops < 36 loop
      insert into public.expenses
        (house_id, concept, category, amount_cents, date, paid_by, split_mode, note,
         created_by, recurring_id)
      values
        (v_house, v_rec.concept, v_rec.category, v_rec.amount_cents, v_rec.next_date,
         v_rec.paid_by, v_rec.split_mode, v_rec.note, v_rec.created_by, v_rec.id)
      on conflict (recurring_id, date) where recurring_id is not null do nothing
      returning id into v_id;
      if v_id is not null then
        insert into public.expense_shares (expense_id, house_id, member_id, cents)
        select v_id, v_house, s.member_id, s.cents
        from public.recurring_shares s where s.recurring_id = v_rec.id;
        v_count := v_count + 1;
      end if;
      v_id := null;
      v_rec.next_date := private.add_months_on_day(v_rec.next_date, v_rec.every_months,
                                                   v_rec.day_of_month);
      v_loops := v_loops + 1;
    end loop;
    update public.recurring_expenses set next_date = v_rec.next_date where id = v_rec.id;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.add_months_on_day(date, integer, integer) from public, anon;
revoke all on function public.set_expense_repeat(uuid, integer) from public, anon;
grant execute on function public.set_expense_repeat(uuid, integer) to authenticated;
revoke all on function public.run_recurring() from public, anon;
grant execute on function public.run_recurring() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: verlos los miembros; crearlos y cambiarlos solo con set_expense_repeat;
-- dejar de repetir (borrar) quien lo creó o admin.
-- -----------------------------------------------------------------------------
alter table public.recurring_expenses enable row level security;
alter table public.recurring_shares enable row level security;
revoke all on table public.recurring_expenses, public.recurring_shares from anon, authenticated;

grant select, delete on table public.recurring_expenses to authenticated;
create policy "recurring: ver si eres miembro" on public.recurring_expenses
  for select to authenticated using (public.is_house_member(house_id));
create policy "recurring: borrar el tuyo o si eres admin" on public.recurring_expenses
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

grant select on table public.recurring_shares to authenticated;
create policy "recurring_shares: ver si eres miembro" on public.recurring_shares
  for select to authenticated using (public.is_house_member(house_id));

commit;
