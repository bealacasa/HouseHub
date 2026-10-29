-- =============================================================================
-- House Hub · Prueba de seguridad: listas para llegar/irse y contactos (migración 0015)
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de la migración 20261030000015. Funciona
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
  item uuid;
  contact uuid;
  n int;
begin
  select id into house from public.houses limit 1;
  if house is null then
    raise exception 'Crea antes la casa (o ejecuta la prueba de la fase 2).';
  end if;

  insert into auth.users (id, email, aud, role)
  values (marta, 'marta@prueba.test', 'authenticated', 'authenticated'),
         (bruno, 'bruno@prueba.test', 'authenticated', 'authenticated');
  insert into public.house_members (house_id, user_id, display_name, role)
  values (house, marta, 'Marta', 'member');

  -- ---- Marta, miembro: escribe la lista, la termina y apunta contactos ----
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.checklist_items (house_id, kind, text, position)
  values (house, 'leave', 'Cerrar el gas', 1) returning id into item;
  update public.checklist_items set position = 5 where id = item;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo ordenar la lista' using errcode = 'TF001'; end if;
  begin
    insert into public.checklist_items (house_id, kind, text) values (house, 'otra', 'x');
    raise exception 'FALLO: se aceptó un tipo de lista raro' using errcode = 'TF001';
  exception when check_violation then null;
  end;

  insert into public.checklist_runs (house_id, kind, checked, total) values (house, 'leave', 1, 1);
  select count(*) into n from public.checklist_runs where user_id = marta;
  if n <> 1 then raise exception 'FALLO: la vez no quedó a nombre de Marta' using errcode = 'TF001'; end if;
  begin
    insert into public.checklist_runs (house_id, kind, checked, total) values (house, 'leave', 3, 1);
    raise exception 'FALLO: se aceptaron más tachadas que el total' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  begin
    update public.checklist_runs set checked = 0;
    raise exception 'FALLO: se pudo cambiar el historial' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  insert into public.house_contacts (house_id, name, role, phone)
  values (house, 'Paco', 'Fontanero', '600 123 456') returning id into contact;
  begin
    insert into public.house_contacts (house_id, name, phone) values (house, 'Raro', 'llámame');
    raise exception 'FALLO: se aceptó un teléfono sin números' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  update public.house_contacts set phone = '+34 600 123 456' where id = contact;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo cambiar un contacto' using errcode = 'TF001'; end if;

  -- ---- Bruno, ajeno: no ve ni toca nada ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.checklist_items;
  if n <> 0 then raise exception 'FALLO: Bruno ve la lista' using errcode = 'TF001'; end if;
  select count(*) into n from public.checklist_runs;
  if n <> 0 then raise exception 'FALLO: Bruno ve el historial' using errcode = 'TF001'; end if;
  select count(*) into n from public.house_contacts;
  if n <> 0 then raise exception 'FALLO: Bruno ve los contactos' using errcode = 'TF001'; end if;
  delete from public.house_contacts;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno borró contactos' using errcode = 'TF001'; end if;
  begin
    insert into public.house_contacts (house_id, name, phone) values (house, 'Intruso', '600000000');
    raise exception 'FALLO: Bruno pudo añadir un contacto' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  -- ---- Marta borra lo suyo ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.checklist_items where id = item;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo quitar de la lista' using errcode = 'TF001'; end if;
  delete from public.house_contacts where id = contact;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar un contacto' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
