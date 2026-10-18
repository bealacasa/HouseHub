-- =============================================================================
-- House Hub · Prueba de seguridad (RLS) de la fase 2
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de la migración 0002. Crea dos usuarios
-- ficticios (Ana, administradora, y Bruno, ajeno a la casa), comprueba lo que cada uno
-- puede hacer y al final lo DESHACE TODO (rollback): no deja nada en tu base de datos.
-- Si algo falla, verás un error «FALLO: …». Si todo va bien: «✓ Todas las pruebas OK».
--
-- ⚠️ Ejecútalo antes de crear tu casa de verdad (o la prueba no podrá crear la suya).
-- =============================================================================

begin;

do $$
declare
  ana uuid := gen_random_uuid();
  bruno uuid := gen_random_uuid();
  carmen uuid := gen_random_uuid();
  house uuid;
  token text;
  n int;
  ok boolean;
begin
  if exists (select 1 from public.houses) then
    raise exception 'Ya existe una casa: esta prueba debe ejecutarse antes de crearla.';
  end if;

  insert into auth.users (id, email, aud, role)
  values (ana, 'ana@prueba.test', 'authenticated', 'authenticated'),
         (bruno, 'bruno@prueba.test', 'authenticated', 'authenticated'),
         (carmen, 'carmen@prueba.test', 'authenticated', 'authenticated');

  -- ---- Ana crea la casa (como usuaria con sesión) ----
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  set local role authenticated;
  house := public.create_house('Casa de prueba');

  begin
    perform public.create_house('Otra casa');
    raise exception 'FALLO: se pudo crear una segunda casa' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  token := public.create_invitation('member', null);
  if length(token) <> 43 then raise exception 'FALLO: token con longitud %', length(token) using errcode = 'TF001'; end if;
  if exists (select 1 from public.invitations where token_hash = token) then
    raise exception 'FALLO: el token se guarda en claro' using errcode = 'TF001';
  end if;

  -- ---- Bruno, ajeno: no ve ni toca nada ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.houses;
  if n <> 0 then raise exception 'FALLO: Bruno ve la casa' using errcode = 'TF001'; end if;
  select count(*) into n from public.house_members;
  if n <> 0 then raise exception 'FALLO: Bruno ve los miembros' using errcode = 'TF001'; end if;
  select count(*) into n from public.invitations;
  if n <> 0 then raise exception 'FALLO: Bruno ve las invitaciones' using errcode = 'TF001'; end if;

  update public.houses set name = 'Hackeada';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno edita la casa' using errcode = 'TF001'; end if;
  delete from public.houses;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno borra la casa' using errcode = 'TF001'; end if;

  begin
    insert into public.house_members (house_id, display_name, role) values (house, 'Intruso', 'admin');
    raise exception 'FALLO: Bruno se añade como miembro' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_invitation('admin', null);
    raise exception 'FALLO: Bruno crea invitaciones' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.accept_invitation(token, bruno);
    raise exception 'FALLO: un usuario llama a accept_invitation directamente' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  -- ---- La Edge Function (service_role) acepta la invitación de Carmen ----
  reset role;
  perform public.accept_invitation(token, carmen);
  select count(*) into n from public.house_members where user_id = carmen and role = 'member';
  if n <> 1 then raise exception 'FALLO: Carmen no quedó como miembro' using errcode = 'TF001'; end if;
  begin
    perform public.accept_invitation(token, bruno);
    raise exception 'FALLO: la invitación se pudo usar dos veces' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  -- Invitación caducada.
  insert into public.invitations (house_id, token_hash, expires_at)
  values (house, encode(extensions.digest('caducado', 'sha256'), 'hex'), now() - interval '1 minute');
  begin
    perform public.accept_invitation('caducado', bruno);
    raise exception 'FALLO: se aceptó una invitación caducada' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  -- ---- Carmen (miembro): ve la casa, pero no administra ----
  perform set_config('request.jwt.claims', json_build_object('sub', carmen, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.houses;
  if n <> 1 then raise exception 'FALLO: Carmen no ve la casa' using errcode = 'TF001'; end if;
  select count(*) into n from public.invitations;
  if n <> 0 then raise exception 'FALLO: un miembro ve las invitaciones' using errcode = 'TF001'; end if;
  update public.house_members set role = 'admin' where user_id = carmen;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: un miembro se hace administrador' using errcode = 'TF001'; end if;
  delete from public.house_members where user_id = ana;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: un miembro quita a otros' using errcode = 'TF001'; end if;
  begin
    perform public.create_invitation('member', null);
    raise exception 'FALLO: un miembro crea invitaciones' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  -- ---- Ana: no puede dejar la casa sin administrador ni asignar cuentas a mano ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.house_members set role = 'member' where user_id = ana;
    raise exception 'FALLO: se quedó la casa sin administrador' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.house_members (house_id, display_name, user_id) values (house, 'Truco', bruno);
    raise exception 'FALLO: el admin asignó una cuenta sin invitación' using errcode = 'TF001';
  exception when insufficient_privilege or sqlstate 'P0001' then null;
  end;
  insert into public.house_members (house_id, display_name) values (house, 'Abuelo José');
  select count(*) into n from public.house_members where display_name = 'Abuelo José' and user_id is null;
  if n <> 1 then raise exception 'FALLO: no se pudo añadir un familiar sin cuenta' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
