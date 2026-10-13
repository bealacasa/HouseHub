-- =============================================================================
-- House Hub · Fase 1: perfiles
--
-- Cada usuario de Supabase Auth tiene un perfil con el nombre que ve la familia.
-- Se crea solo al registrarse (trigger) y RLS impide leer o tocar el de otros.
-- (En la fase 2, los miembros de una misma vivienda podrán ver el nombre de los demás.)
-- =============================================================================

begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Al registrarse alguien en Auth, se crea su perfil vacío.
-- security definer: se ejecuta con permisos del dueño (el usuario aún no puede insertar).
-- search_path = '': obliga a escribir public./auth. y evita secuestros de nombres.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automático.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Seguridad por filas: cada persona solo ve y edita su perfil.
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, update (display_name) on table public.profiles to authenticated;

create policy "profiles: ver el propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- La función del trigger no debe poder llamarse desde la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
