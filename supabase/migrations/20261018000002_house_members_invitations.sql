-- =============================================================================
-- House Hub · Fase 2: la casa, sus miembros y las invitaciones
--
-- Ideas clave:
--   · Solo existe UNA casa en toda la app (índice único). La crea el primero que entra,
--     que queda como administrador. Nadie más puede crear otra.
--   · Los demás entran con una invitación: un token aleatorio de un solo uso que caduca a
--     las 72 h. En la base de datos solo se guarda su huella (hash SHA-256), nunca el token.
--   · RLS en todas las tablas: solo los miembros ven la casa; solo los administradores
--     invitan, cambian roles, quitan miembros o borran la casa.
--   · "Miembros sin cuenta" (p. ej. el abuelo sin móvil): user_id vacío. Una invitación
--     puede ir ligada a uno de ellos para que, al aceptarla, se le vincule.
-- =============================================================================

begin;

-- pgcrypto: números aleatorios seguros (gen_random_bytes) y SHA-256 (digest).
create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: no lo expone la API (PostgREST solo publica "public").
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Casa a partir de la ruta de un archivo de Storage ("{casa}/{foto}.webp"); null si no
-- tiene el formato exacto (así nunca falla la conversión a uuid).
create function public.house_from_path(p_path text)
returns uuid language sql immutable set search_path = ''
as $$
  select case
    when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
      then split_part(p_path, '/', 1)::uuid
  end;
$$;

-- -----------------------------------------------------------------------------
-- 1) La casa
-- -----------------------------------------------------------------------------
create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  address text not null default '' check (char_length(address) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  -- Ruta de la foto en Storage: {id de la casa}/{id de la foto}.webp
  photo_path text check (photo_path is null or public.house_from_path(photo_path) is not null),
  -- Enlace a la app del termostato (solo https).
  thermostat_url text check (thermostat_url ~ '^https://[^\s]{1,300}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice único sobre una expresión constante: como mucho UNA fila en la tabla.
create unique index houses_only_one on public.houses ((true));

create trigger houses_touch before update on public.houses
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Miembros (con o sin cuenta)
-- -----------------------------------------------------------------------------
create table public.house_members (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  -- Vacío = familiar sin cuenta. Si alguien borra su cuenta, queda como "sin cuenta"
  -- (así no se pierden sus gastos y estancias).
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Para claves foráneas compuestas (gastos, estancias… siempre de la misma casa).
  unique (house_id, id)
);

-- Una persona solo puede estar una vez en la casa.
create unique index house_members_one_per_user on public.house_members (house_id, user_id)
  where user_id is not null;

create trigger house_members_touch before update on public.house_members
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Invitaciones
-- -----------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'member' check (role in ('admin', 'member')),
  -- Opcional: vincular a un miembro sin cuenta al aceptarla.
  member_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  foreign key (house_id, member_id) references public.house_members (house_id, id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- 4) Límite de intentos (crear y aceptar invitaciones)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- Devuelve true si aún se permite la acción (y la cuenta), false si se ha pasado.
create function private.allow(p_key text, p_limit integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  v_hits integer;
begin
  insert into private.rate_limits (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;
  delete from private.rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Funciones de ayuda para RLS
--    security definer: consultan house_members sin pasar por su propia RLS (si no,
--    la política se llamaría a sí misma). Solo responden sobre el usuario actual.
-- -----------------------------------------------------------------------------
create function public.is_house_member(p_house uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.house_members
    where house_id = p_house and user_id = (select auth.uid())
  );
$$;

create function public.is_house_admin(p_house uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.house_members
    where house_id = p_house and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ¿Comparte casa el usuario actual con p_user? (para ver el nombre de los demás)
create function public.shares_house_with(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.house_members me
    join public.house_members other on other.house_id = me.house_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user
  );
$$;

-- (house_from_path está definida al principio: la usa la tabla houses.)

-- -----------------------------------------------------------------------------
-- 6) Reglas de negocio en la base de datos
-- -----------------------------------------------------------------------------

-- Siempre debe quedar al menos un administrador con cuenta.
create function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Al borrar la casa entera (cascada), no hace falta comprobar nada.
  if not exists (select 1 from public.houses where id = old.house_id) then
    return coalesce(new, old);
  end if;
  if old.role = 'admin' and old.user_id is not null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.user_id is distinct from old.user_id)
     and not exists (
       select 1 from public.house_members
       where house_id = old.house_id and id <> old.id and role = 'admin' and user_id is not null
     )
  then
    raise exception 'Debe quedar al menos un administrador.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger house_members_keep_admin before update or delete on public.house_members
  for each row execute function public.keep_one_admin();

-- Desde la app, el administrador no puede asignar cuentas a mano: solo con invitación.
create function public.members_guard_user_id()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- current_user es 'authenticated' solo en llamadas directas desde la app; dentro de
  -- create_house / accept_invitation (security definer) es el dueño de la función.
  if current_user = 'authenticated'
     and (tg_op = 'INSERT' and new.user_id is not null
          or tg_op = 'UPDATE' and new.user_id is distinct from old.user_id
             and new.user_id is not null)
  then
    raise exception 'Las cuentas se vinculan solo con una invitación.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger house_members_guard_user before insert or update on public.house_members
  for each row execute function public.members_guard_user_id();

-- -----------------------------------------------------------------------------
-- 7) Funciones que llama la app
-- -----------------------------------------------------------------------------

-- ¿Existe ya la casa? (para saber si mostrar «Crear la casa» o «Pide una invitación»)
create function public.house_exists()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.houses); $$;

-- Crea LA casa y te hace administrador (solo si aún no existe).
create function public.create_house(p_name text, p_address text default '', p_notes text default '')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_house uuid;
  v_name text;
begin
  if v_user is null then raise exception 'Inicia sesión primero.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.houses) then
    raise exception 'La casa ya existe: pide una invitación.' using errcode = 'P0001';
  end if;
  insert into public.houses (name, address, notes, created_by)
  values (trim(p_name), trim(coalesce(p_address, '')), trim(coalesce(p_notes, '')), v_user)
  returning id into v_house;
  select coalesce(nullif(display_name, ''), 'Administrador') into v_name
  from public.profiles where id = v_user;
  insert into public.house_members (house_id, user_id, display_name, role)
  values (v_house, v_user, coalesce(v_name, 'Administrador'), 'admin');
  return v_house;
end;
$$;

-- Crea una invitación y devuelve el token UNA sola vez (en la BD queda solo su hash).
create function public.create_invitation(p_role text default 'member', p_member uuid default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_house uuid;
  v_token text;
begin
  select id into v_house from public.houses limit 1;
  if v_house is null or not public.is_house_admin(v_house) then
    raise exception 'Solo un administrador puede invitar.' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Rol no válido.' using errcode = 'P0001';
  end if;
  if p_member is not null and not exists (
    select 1 from public.house_members where id = p_member and house_id = v_house and user_id is null
  ) then
    raise exception 'Ese familiar ya tiene cuenta o no existe.' using errcode = 'P0001';
  end if;
  if not private.allow('invite:' || v_user::text, 20, interval '1 hour') then
    raise exception 'Demasiadas invitaciones. Espera un poco.' using errcode = 'P0001';
  end if;
  -- 32 bytes aleatorios (256 bits) en base64url: imposible de adivinar.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invitations (house_id, token_hash, role, member_id, created_by)
  values (
    v_house,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_role,
    p_member,
    v_user
  );
  return v_token;
end;
$$;

-- Acepta una invitación. SOLO la llama la Edge Function "accept-invite" (service_role),
-- que antes comprueba quién es el usuario. Todo en una transacción y con la fila bloqueada.
create function public.accept_invitation(p_token text, p_user uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_name text;
begin
  if not private.allow('accept:' || p_user::text, 10, interval '1 hour') then
    raise exception 'Demasiados intentos. Espera un poco.' using errcode = 'P0001';
  end if;
  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then raise exception 'La invitación no es válida.' using errcode = 'P0001'; end if;
  if v_inv.revoked_at is not null then
    raise exception 'Esta invitación se ha anulado. Pide otra.' using errcode = 'P0001';
  end if;
  if v_inv.used_at is not null then
    raise exception 'Esta invitación ya se ha usado. Pide otra.' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Esta invitación ha caducado. Pide otra.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.house_members where house_id = v_inv.house_id and user_id = p_user) then
    -- Ya era miembro: se gasta la invitación y listo.
    null;
  elsif v_inv.member_id is not null then
    update public.house_members
    set user_id = p_user, role = case when v_inv.role = 'admin' then 'admin' else role end
    where id = v_inv.member_id and user_id is null;
    if not found then
      raise exception 'Ese familiar ya está vinculado a otra cuenta.' using errcode = 'P0001';
    end if;
  else
    select coalesce(nullif(display_name, ''), 'Nuevo miembro') into v_name
    from public.profiles where id = p_user;
    insert into public.house_members (house_id, user_id, display_name, role)
    values (v_inv.house_id, p_user, coalesce(v_name, 'Nuevo miembro'), v_inv.role);
  end if;

  update public.invitations set used_at = now(), used_by = p_user where id = v_inv.id;
  return v_inv.house_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) Permisos y RLS
-- -----------------------------------------------------------------------------
revoke all on function private.allow(text, integer, interval) from public, anon, authenticated;
revoke all on function public.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid) to service_role;
revoke all on function public.keep_one_admin() from public, anon, authenticated;
revoke all on function public.members_guard_user_id() from public, anon, authenticated;

revoke all on function public.is_house_member(uuid) from public, anon;
revoke all on function public.is_house_admin(uuid) from public, anon;
revoke all on function public.shares_house_with(uuid) from public, anon;
revoke all on function public.house_exists() from public, anon;
revoke all on function public.create_house(text, text, text) from public, anon;
revoke all on function public.create_invitation(text, uuid) from public, anon;
grant execute on function public.is_house_member(uuid) to authenticated;
grant execute on function public.is_house_admin(uuid) to authenticated;
grant execute on function public.shares_house_with(uuid) to authenticated;
grant execute on function public.house_exists() to authenticated;
grant execute on function public.create_house(text, text, text) to authenticated;
grant execute on function public.create_invitation(text, uuid) to authenticated;

alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.invitations enable row level security;
revoke all on table public.houses, public.house_members, public.invitations from anon, authenticated;

-- Casa: la ven los miembros; la editan y borran los administradores. (Crear: create_house.)
grant select, delete on table public.houses to authenticated;
grant update (name, address, notes, photo_path, thermostat_url) on table public.houses to authenticated;
create policy "houses: ver si eres miembro" on public.houses
  for select to authenticated using (public.is_house_member(id));
create policy "houses: editar si eres admin" on public.houses
  for update to authenticated
  using (public.is_house_admin(id)) with check (public.is_house_admin(id));
create policy "houses: borrar si eres admin" on public.houses
  for delete to authenticated using (public.is_house_admin(id));

-- Miembros: los ven los miembros; los gestionan los administradores.
grant select, delete on table public.house_members to authenticated;
grant insert (house_id, display_name, role) on table public.house_members to authenticated;
grant update (display_name, role) on table public.house_members to authenticated;
create policy "members: ver si eres miembro" on public.house_members
  for select to authenticated using (public.is_house_member(house_id));
create policy "members: añadir si eres admin" on public.house_members
  for insert to authenticated with check (public.is_house_admin(house_id));
create policy "members: editar si eres admin" on public.house_members
  for update to authenticated
  using (public.is_house_admin(house_id)) with check (public.is_house_admin(house_id));
create policy "members: quitar si eres admin" on public.house_members
  for delete to authenticated using (public.is_house_admin(house_id));

-- Invitaciones: solo administradores (ver y anular). Crear: create_invitation.
grant select on table public.invitations to authenticated;
grant update (revoked_at) on table public.invitations to authenticated;
create policy "invitations: ver si eres admin" on public.invitations
  for select to authenticated using (public.is_house_admin(house_id));
create policy "invitations: anular si eres admin" on public.invitations
  for update to authenticated
  using (public.is_house_admin(house_id)) with check (public.is_house_admin(house_id));

-- Perfiles: además del tuyo, puedes ver el nombre de quien comparte casa contigo.
create policy "profiles: ver los de tu casa" on public.profiles
  for select to authenticated using (public.shares_house_with(id));

-- -----------------------------------------------------------------------------
-- 9) Fotos de la casa: bucket privado {casa}/{foto}.webp, máx. 5 MB, solo WebP/JPEG
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('house-photos', 'house-photos', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "house-photos: ver si eres miembro" on storage.objects
  for select to authenticated
  using (bucket_id = 'house-photos' and public.is_house_member(public.house_from_path(name)));
create policy "house-photos: subir si eres admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'house-photos' and public.is_house_admin(public.house_from_path(name)));
create policy "house-photos: borrar si eres admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'house-photos' and public.is_house_admin(public.house_from_path(name)));

commit;
