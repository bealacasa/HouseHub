-- =============================================================================
-- House Hub · Gastos compartidos
--
-- Dinero SIEMPRE en céntimos enteros (integer): nunca decimales, que dan errores de
-- redondeo (0,1 + 0,2 ≠ 0,3).
--
-- expenses        el gasto: concepto, categoría, importe, fecha y quién lo pagó.
-- expense_shares  cuánto le toca a cada miembro. Las partes SUMAN el importe exacto.
-- settlements     pagos entre miembros para «quedar en paz» (Ana paga 20 € a Luis).
--
-- El gasto y sus partes se guardan juntos con save_expense (todo o nada).
-- =============================================================================

begin;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  concept text not null check (char_length(concept) between 1 and 100),
  category text not null check (category in (
    'ibi', 'comunidad', 'luz', 'agua', 'gas', 'internet', 'seguro', 'reparacion', 'compra', 'otros'
  )),
  -- Hasta 100.000 € por gasto.
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  date date not null,
  paid_by uuid not null,
  split_mode text not null check (split_mode in ('equal', 'custom')),
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (house_id, id),
  -- Quien pagó tiene que ser de la misma casa (clave compuesta).
  foreign key (house_id, paid_by) references public.house_members (house_id, id) on delete cascade
);
create index expenses_house_date on public.expenses (house_id, date desc);
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create table public.expense_shares (
  expense_id uuid not null,
  house_id uuid not null,
  member_id uuid not null,
  cents integer not null check (cents between 0 and 10000000),
  primary key (expense_id, member_id),
  foreign key (house_id, expense_id) references public.expenses (house_id, id) on delete cascade,
  foreign key (house_id, member_id) references public.house_members (house_id, id) on delete cascade
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  from_member uuid not null,
  to_member uuid not null,
  cents integer not null check (cents between 1 and 10000000),
  date date not null default current_date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_member <> to_member),
  foreign key (house_id, from_member) references public.house_members (house_id, id) on delete cascade,
  foreign key (house_id, to_member) references public.house_members (house_id, id) on delete cascade
);
create index settlements_house on public.settlements (house_id, date desc);

-- -----------------------------------------------------------------------------
-- Guardar un gasto con sus partes, de una vez. p_shares = [{"member": uuid, "cents": n}, …]
-- Comprueba: que eres de la casa, que (si editas) es tuyo o eres admin, que todos los
-- miembros son de la casa y que las partes suman exactamente el importe.
-- -----------------------------------------------------------------------------
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
    if not (v_old.created_by = (select auth.uid()) or public.is_house_admin(v_house)) then
      raise exception 'Solo quien lo apuntó (o quien administra) puede cambiarlo.' using errcode = 'P0001';
    end if;
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

revoke all on function public.save_expense(uuid, text, text, integer, date, uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.save_expense(uuid, text, text, integer, date, uuid, text, text, jsonb)
  to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
revoke all on table public.expenses, public.expense_shares, public.settlements from anon, authenticated;

-- Gastos: verlos los miembros; crear y cambiar con save_expense; borrar quien lo apuntó o admin.
grant select, delete on table public.expenses to authenticated;
create policy "expenses: ver si eres miembro" on public.expenses
  for select to authenticated using (public.is_house_member(house_id));
create policy "expenses: borrar el tuyo o si eres admin" on public.expenses
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

grant select on table public.expense_shares to authenticated;
create policy "shares: ver si eres miembro" on public.expense_shares
  for select to authenticated using (public.is_house_member(house_id));

-- Pagos para quedar en paz: los apunta cualquier miembro; los borra quien lo apuntó o admin.
grant select, delete on table public.settlements to authenticated;
grant insert (house_id, from_member, to_member, cents, date) on table public.settlements to authenticated;
create policy "settlements: ver si eres miembro" on public.settlements
  for select to authenticated using (public.is_house_member(house_id));
create policy "settlements: apuntar si eres miembro" on public.settlements
  for insert to authenticated
  with check (public.is_house_member(house_id) and created_by = (select auth.uid()));
create policy "settlements: borrar el tuyo o si eres admin" on public.settlements
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_house_admin(house_id));

commit;
