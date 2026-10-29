-- =============================================================================
-- House Hub · Prueba de seguridad: recordatorios personales (migración 0014)
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de la migración 20261030000014. Funciona
-- con tu casa ya creada: añade usuarios ficticios (Marta y Luis, miembros, y Bruno,
-- ajeno), comprueba que cada recordatorio solo lo ve y toca su dueño (ni siquiera quien
-- administra) y al final lo DESHACE TODO (rollback).
-- Si algo falla, verás un error «FALLO: …». Si todo va bien: «✓ Todas las pruebas OK».
-- =============================================================================

begin;

do $$
declare
  marta uuid := gen_random_uuid();
  luis uuid := gen_random_uuid();
  bruno uuid := gen_random_uuid();
  admin_user uuid;
  house uuid;
  r uuid;
  n int;
begin
  select id into house from public.houses limit 1;
  if house is null then
    raise exception 'Crea antes la casa (o ejecuta la prueba de la fase 2).';
  end if;
  select user_id into admin_user from public.house_members
   where house_id = house and role = 'admin' and user_id is not null limit 1;

  insert into auth.users (id, email, aud, role)
  values (marta, 'marta@prueba.test', 'authenticated', 'authenticated'),
         (luis, 'luis@prueba.test', 'authenticated', 'authenticated'),
         (bruno, 'bruno@prueba.test', 'authenticated', 'authenticated');
  insert into public.house_members (house_id, user_id, display_name, role)
  values (house, marta, 'Marta', 'member'), (house, luis, 'Luis', 'member');

  -- ---- Marta escribe un recordatorio: es suyo aunque intente poner otro dueño ----
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.personal_reminders (house_id, text, due_date)
  values (house, 'Secreto de Marta', current_date) returning id into r;
  begin
    insert into public.personal_reminders (house_id, user_id, text) values (house, luis, 'Falso');
    raise exception 'FALLO: Marta pudo crear un recordatorio a nombre de Luis' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.personal_reminders where id = r;
  if n <> 1 then raise exception 'FALLO: Marta no ve su recordatorio' using errcode = 'TF001'; end if;
  update public.personal_reminders set done_at = now() where id = r;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo tachar su recordatorio' using errcode = 'TF001'; end if;

  -- ---- Luis (de la casa) no lo ve ni lo toca ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', luis, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.personal_reminders;
  if n <> 0 then raise exception 'FALLO: Luis ve recordatorios de Marta' using errcode = 'TF001'; end if;
  update public.personal_reminders set text = 'hack';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Luis cambió un recordatorio ajeno' using errcode = 'TF001'; end if;
  delete from public.personal_reminders;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Luis borró un recordatorio ajeno' using errcode = 'TF001'; end if;

  -- ---- Quien administra tampoco ----
  if admin_user is not null then
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', admin_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.personal_reminders where id = r;
    if n <> 0 then raise exception 'FALLO: quien administra ve recordatorios ajenos' using errcode = 'TF001'; end if;
  end if;

  -- ---- Bruno (ajeno a la casa) no ve nada ni puede crear en la casa ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.personal_reminders;
  if n <> 0 then raise exception 'FALLO: Bruno ve recordatorios' using errcode = 'TF001'; end if;
  begin
    insert into public.personal_reminders (house_id, text) values (house, 'Intruso');
    raise exception 'FALLO: Bruno pudo crear un recordatorio en la casa' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  -- ---- Marta borra el suyo ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.personal_reminders where id = r;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar su recordatorio' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
