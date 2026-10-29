-- =============================================================================
-- House Hub · Prueba de seguridad (RLS) de las excursiones
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de las migraciones 20261025000010 y
-- 20261029000013 (toda la familia puede cambiar y borrar). Funciona
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
  other_exc uuid;
  mine uuid;
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

  -- Una excursión de otra persona (creada sin RLS, como si fuera de la administradora).
  insert into public.excursions (house_id, title, created_by)
  values (house, 'Excursión de otra persona', null)
  returning id into other_exc;

  -- ---- Bruno, ajeno: no ve ni añade nada ----
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.excursions;
  if n <> 0 then raise exception 'FALLO: Bruno ve excursiones' using errcode = 'TF001'; end if;
  begin
    insert into public.excursions (house_id, title) values (house, 'Intrusa');
    raise exception 'FALLO: Bruno pudo añadir una excursión' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.mark_excursion_visited(other_exc, current_date);
    raise exception 'FALLO: Bruno pudo marcar una visita' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  -- ---- Marta, miembro: ve, añade, cambia y borra también las ajenas, marca la visita ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.excursions where id = other_exc;
  if n <> 1 then raise exception 'FALLO: Marta no ve las excursiones de la casa' using errcode = 'TF001'; end if;

  insert into public.excursions (house_id, title, duration, difficulty, map_url)
  values (house, 'Mirador', 'dia', 'media', 'https://maps.app.goo.gl/abc')
  returning id into mine;

  update public.excursions set title = 'Cambiada' where id = other_exc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo cambiar una excursión ajena' using errcode = 'TF001'; end if;

  perform public.mark_excursion_visited(other_exc, current_date);
  select count(*) into n from public.excursions where id = other_exc and last_visited = current_date;
  if n <> 1 then raise exception 'FALLO: Marta no pudo marcar la visita' using errcode = 'TF001'; end if;
  begin
    perform public.mark_excursion_visited(other_exc, current_date + 30);
    raise exception 'FALLO: se aceptó una visita en el futuro' using errcode = 'TF001';
  exception when sqlstate 'P0001' then null;
  end;

  begin
    update public.excursions set map_url = 'javascript:alert(1)' where id = mine;
    raise exception 'FALLO: se aceptó un enlace que no es https' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  begin
    update public.excursions
       set photo_path = gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.webp'
     where id = mine;
    raise exception 'FALLO: se aceptó una foto de otra casa' using errcode = 'TF001';
  exception when check_violation then null;
  end;

  delete from public.excursions where id = other_exc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar una excursión ajena' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
