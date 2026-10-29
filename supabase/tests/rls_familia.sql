-- =============================================================================
-- House Hub · Prueba de seguridad: toda la familia puede hacer de todo (migración 0013)
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de la migración 20261029000013. Funciona
-- con tu casa ya creada: añade dos usuarios ficticios (Marta, miembro, y Bruno, ajeno),
-- comprueba lo que cada uno puede hacer y al final lo DESHACE TODO (rollback).
-- Si algo falla, verás un error «FALLO: …». Si todo va bien: «✓ Todas las pruebas OK».
-- =============================================================================

begin;

do $$
declare
  marta uuid := gen_random_uuid();
  bruno uuid := gen_random_uuid();
  house uuid;
  admin_member uuid;
  exp uuid;
  n int;
begin
  select id into house from public.houses limit 1;
  if house is null then
    raise exception 'Crea antes la casa (o ejecuta la prueba de la fase 2).';
  end if;
  select id into admin_member from public.house_members
   where house_id = house and role = 'admin' limit 1;

  insert into auth.users (id, email, aud, role)
  values (marta, 'marta@prueba.test', 'authenticated', 'authenticated'),
         (bruno, 'bruno@prueba.test', 'authenticated', 'authenticated');
  insert into public.house_members (house_id, user_id, display_name, role)
  values (house, marta, 'Marta', 'member');

  -- Contenido de OTRA persona (sin autor, como si lo hubiera añadido la administradora).
  insert into public.village_events (house_id, title, start_date, end_date, created_by)
  values (house, 'Prueba evento', current_date, current_date, null);
  insert into public.guides (house_id, title, steps, created_by)
  values (house, 'Prueba guía', '[{"text": "Paso", "photo": null}]', null);
  insert into public.stays (house_id, member_id, start_date, end_date, people, created_by)
  values (house, admin_member, current_date, current_date, 1, null);
  insert into public.expenses
    (house_id, concept, category, amount_cents, date, paid_by, split_mode, note, created_by)
  values (house, 'Prueba gasto', 'otros', 1000, current_date, admin_member, 'equal', '', null)
  returning id into exp;
  insert into public.expense_shares (expense_id, house_id, member_id, cents)
  values (exp, house, admin_member, 1000);

  -- ---- Marta, miembro: cambia y borra lo de otras personas ----
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.village_events set title = 'Cambiado' where title = 'Prueba evento';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo cambiar un evento ajeno' using errcode = 'TF001'; end if;
  update public.guides set title = 'Cambiada' where title = 'Prueba guía';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo cambiar unas instrucciones ajenas' using errcode = 'TF001'; end if;
  update public.stays set people = 2 where house_id = house and created_by is null;
  get diagnostics n = row_count;
  if n < 1 then raise exception 'FALLO: Marta no pudo cambiar una reserva ajena' using errcode = 'TF001'; end if;
  perform public.save_expense(exp, 'Cambiado', 'otros', 1200, current_date, admin_member, 'equal', '',
    jsonb_build_array(jsonb_build_object('member', admin_member, 'cents', 1200)));

  delete from public.village_events where title = 'Cambiado';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar un evento ajeno' using errcode = 'TF001'; end if;
  delete from public.guides where title = 'Cambiada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar unas instrucciones ajenas' using errcode = 'TF001'; end if;
  delete from public.expenses where id = exp;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar un gasto ajeno' using errcode = 'TF001'; end if;

  -- ---- …pero NO invita, ni quita personas, ni borra la casa ----
  begin
    perform public.create_invitation('member', null);
    raise exception 'FALLO: Marta pudo invitar' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;
  delete from public.house_members where id = admin_member;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Marta quitó a alguien de la casa' using errcode = 'TF001'; end if;
  delete from public.houses where id = house;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Marta borró la casa' using errcode = 'TF001'; end if;

  -- ---- Bruno, ajeno: no cambia ni borra nada ----
  reset role;
  insert into public.village_events (house_id, title, start_date, end_date, created_by)
  values (house, 'Prueba Bruno', current_date, current_date, null);
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.village_events set title = 'hack';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno cambió un evento' using errcode = 'TF001'; end if;
  delete from public.village_events;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno borró un evento' using errcode = 'TF001'; end if;
  update public.houses set name = 'hack';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno cambió la casa' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
