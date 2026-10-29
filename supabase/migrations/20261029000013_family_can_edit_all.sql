-- =============================================================================
-- House Hub · Toda la familia puede hacer de todo con el contenido de la casa
--
-- Antes, cambiar o borrar una reserva, un evento, unas instrucciones, una excursión o
-- un gasto solo podía hacerlo quien lo añadió (o quien administra). Ahora cualquier
-- miembro de la casa puede, y también cambiar los datos y la foto de la casa.
--
-- Sigue siendo SOLO de quien administra (seguridad): invitar, quitar o cambiar el
-- papel de las personas, ver y anular invitaciones y borrar la casa.
-- Siempre hace falta ser de la casa (RLS): nadie de fuera ve ni toca nada.
--
-- Idempotente: se puede ejecutar varias veces. Si la sección de excursiones aún no
-- está creada, esa parte se salta sola.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Reservas, eventos del pueblo e instrucciones: cambiar y borrar si eres de la casa.
-- -----------------------------------------------------------------------------
drop policy if exists "stays: editar la tuya o si eres admin" on public.stays;
drop policy if exists "stays: cambiar si eres de la casa" on public.stays;
create policy "stays: cambiar si eres de la casa" on public.stays
  for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
drop policy if exists "stays: borrar la tuya o si eres admin" on public.stays;
drop policy if exists "stays: borrar si eres de la casa" on public.stays;
create policy "stays: borrar si eres de la casa" on public.stays
  for delete to authenticated using (public.is_house_member(house_id));

drop policy if exists "events: editar el tuyo o si eres admin" on public.village_events;
drop policy if exists "events: cambiar si eres de la casa" on public.village_events;
create policy "events: cambiar si eres de la casa" on public.village_events
  for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
drop policy if exists "events: borrar el tuyo o si eres admin" on public.village_events;
drop policy if exists "events: borrar si eres de la casa" on public.village_events;
create policy "events: borrar si eres de la casa" on public.village_events
  for delete to authenticated using (public.is_house_member(house_id));

drop policy if exists "guides: editar la tuya o si eres admin" on public.guides;
drop policy if exists "guides: cambiar si eres de la casa" on public.guides;
create policy "guides: cambiar si eres de la casa" on public.guides
  for update to authenticated
  using (public.is_house_member(house_id)) with check (public.is_house_member(house_id));
drop policy if exists "guides: borrar la tuya o si eres admin" on public.guides;
drop policy if exists "guides: borrar si eres de la casa" on public.guides;
create policy "guides: borrar si eres de la casa" on public.guides
  for delete to authenticated using (public.is_house_member(house_id));

-- Fotos de las instrucciones: al borrar unas instrucciones ajenas, también sus fotos.
drop policy if exists "guide-photos: borrar la tuya o si eres admin" on storage.objects;
drop policy if exists "guide-photos: borrar si eres de la casa" on storage.objects;
create policy "guide-photos: borrar si eres de la casa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guide-photos' and public.is_house_member(public.house_from_path(name)));

-- -----------------------------------------------------------------------------
-- 2) Excursiones (solo si la sección ya está creada).
-- -----------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.excursions') is not null then
    execute 'drop policy if exists "excursions: cambiar la tuya o si eres admin" on public.excursions';
    execute 'drop policy if exists "excursions: cambiar si eres de la casa" on public.excursions';
    execute 'create policy "excursions: cambiar si eres de la casa" on public.excursions
               for update to authenticated
               using (public.is_house_member(house_id)) with check (public.is_house_member(house_id))';
    execute 'drop policy if exists "excursions: borrar la tuya o si eres admin" on public.excursions';
    execute 'drop policy if exists "excursions: borrar si eres de la casa" on public.excursions';
    execute 'create policy "excursions: borrar si eres de la casa" on public.excursions
               for delete to authenticated using (public.is_house_member(house_id))';
  end if;
end;
$do$;

drop policy if exists "excursion-photos: borrar la tuya o si eres admin" on storage.objects;
drop policy if exists "excursion-photos: borrar si eres de la casa" on storage.objects;
create policy "excursion-photos: borrar si eres de la casa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'excursion-photos' and public.is_house_member(public.house_from_path(name)));

-- -----------------------------------------------------------------------------
-- 3) Gastos, pagos y gastos periódicos: borrar si eres de la casa.
-- -----------------------------------------------------------------------------
drop policy if exists "expenses: borrar el tuyo o si eres admin" on public.expenses;
drop policy if exists "expenses: borrar si eres de la casa" on public.expenses;
create policy "expenses: borrar si eres de la casa" on public.expenses
  for delete to authenticated using (public.is_house_member(house_id));

drop policy if exists "settlements: borrar el tuyo o si eres admin" on public.settlements;
drop policy if exists "settlements: borrar si eres de la casa" on public.settlements;
create policy "settlements: borrar si eres de la casa" on public.settlements
  for delete to authenticated using (public.is_house_member(house_id));

drop policy if exists "recurring: borrar el tuyo o si eres admin" on public.recurring_expenses;
drop policy if exists "recurring: borrar si eres de la casa" on public.recurring_expenses;
create policy "recurring: borrar si eres de la casa" on public.recurring_expenses
  for delete to authenticated using (public.is_house_member(house_id));

-- Cambiar un gasto (y si se repite) ya no exige haberlo apuntado tú: el resto de
-- comprobaciones (ser de la casa, reparto válido, que sumen el total…) siguen igual.
create or replace function public.save_expense(
  p_id uuid,
  p_concept text,
  p_category text,
  p_amount integer,
  p_date date,
  p_paid_by uuid,
  p_split text,
  p_note text,
  p_shares jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid;
  v_id uuid := p_id;
  v_sum bigint;
  v_old public.expenses;
begin
  select id into v_house from public.houses limit 1;
  if v_house is null or not public.is_house_member(v_house) then
    raise exception 'No eres de esta casa.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0
     or jsonb_array_length(p_shares) > 50 then
    raise exception 'Elige entre quiénes se reparte.' using errcode = 'P0001';
  end if;
  select coalesce(sum((s ->> 'cents')::bigint), 0) into v_sum from jsonb_array_elements(p_shares) s;
  if v_sum <> p_amount then
    raise exception 'Las partes no suman el total del gasto.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) s
    where (s ->> 'cents')::bigint < 0
       or not exists (select 1 from public.house_members m
                      where m.id = (s ->> 'member')::uuid and m.house_id = v_house)
  ) or (select count(distinct s ->> 'member') from jsonb_array_elements(p_shares) s)
       <> jsonb_array_length(p_shares) then
    raise exception 'El reparto no es válido.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.expenses
      (house_id, concept, category, amount_cents, date, paid_by, split_mode, note, created_by)
    values
      (v_house, trim(p_concept), p_category, p_amount, p_date, p_paid_by, p_split,
       trim(coalesce(p_note, '')), (select auth.uid()))
    returning id into v_id;
  else
    select * into v_old from public.expenses where id = v_id and house_id = v_house for update;
    if not found then raise exception 'Ese gasto no existe.' using errcode = 'P0001'; end if;
    update public.expenses
    set concept = trim(p_concept), category = p_category, amount_cents = p_amount,
        date = p_date, paid_by = p_paid_by, split_mode = p_split, note = trim(coalesce(p_note, ''))
    where id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_shares (expense_id, house_id, member_id, cents)
  select v_id, v_house, (s ->> 'member')::uuid, (s ->> 'cents')::integer
  from jsonb_array_elements(p_shares) s;
  return v_id;
end;
$$;

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
-- 4) Datos y foto de la casa: cualquiera de la casa (borrar la casa, solo admin).
-- -----------------------------------------------------------------------------
drop policy if exists "houses: editar si eres admin" on public.houses;
drop policy if exists "houses: editar si eres de la casa" on public.houses;
create policy "houses: editar si eres de la casa" on public.houses
  for update to authenticated
  using (public.is_house_member(id)) with check (public.is_house_member(id));

drop policy if exists "house-photos: subir si eres admin" on storage.objects;
drop policy if exists "house-photos: subir si eres de la casa" on storage.objects;
create policy "house-photos: subir si eres de la casa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'house-photos' and public.is_house_member(public.house_from_path(name)));
drop policy if exists "house-photos: borrar si eres admin" on storage.objects;
drop policy if exists "house-photos: borrar si eres de la casa" on storage.objects;
create policy "house-photos: borrar si eres de la casa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'house-photos' and public.is_house_member(public.house_from_path(name)));

commit;
