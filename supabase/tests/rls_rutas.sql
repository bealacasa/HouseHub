-- =============================================================================
-- House Hub · Prueba de seguridad: rutas GPX de las excursiones (migración 0017)
--
-- Pégalo en el SQL Editor y pulsa Run DESPUÉS de la migración 20261031000017. Funciona
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
  exc uuid;
  mine text;
  n int;
begin
  select id into house from public.houses limit 1;
  if house is null then
    raise exception 'Crea antes la casa (o ejecuta la prueba de la fase 2).';
  end if;
  mine := house::text || '/' || gen_random_uuid()::text || '.gpx';

  insert into auth.users (id, email, aud, role)
  values (marta, 'marta@prueba.test', 'authenticated', 'authenticated'),
         (bruno, 'bruno@prueba.test', 'authenticated', 'authenticated');
  insert into public.house_members (house_id, user_id, display_name, role)
  values (house, marta, 'Marta', 'member');
  insert into public.excursions (house_id, title, created_by)
  values (house, 'Ruta de prueba', null) returning id into exc;

  -- ---- Marta, miembro: sube la ruta de su casa y la enlaza ----
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into storage.objects (bucket_id, name, owner_id)
  values ('excursion-tracks', mine, marta::text);
  update public.excursions set track_path = mine where id = exc;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo poner la ruta' using errcode = 'TF001'; end if;

  begin
    update public.excursions
       set track_path = gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.gpx'
     where id = exc;
    raise exception 'FALLO: se aceptó una ruta de otra casa' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  begin
    update public.excursions set track_path = house::text || '/programa.exe' where id = exc;
    raise exception 'FALLO: se aceptó un archivo que no es .gpx' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  begin
    update public.excursions set photo_path = house::text || '/foto.exe' where id = exc;
    raise exception 'FALLO: se aceptó una portada con forma incorrecta' using errcode = 'TF001';
  exception when check_violation then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('excursion-tracks', gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.gpx', marta::text);
    raise exception 'FALLO: Marta pudo subir a la carpeta de otra casa' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  -- ---- Bruno, ajeno: no ve, ni sube, ni borra rutas ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', bruno, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'excursion-tracks';
  if n <> 0 then raise exception 'FALLO: Bruno ve rutas' using errcode = 'TF001'; end if;
  delete from storage.objects where bucket_id = 'excursion-tracks';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Bruno borró rutas' using errcode = 'TF001'; end if;
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('excursion-tracks', house::text || '/' || gen_random_uuid()::text || '.gpx', bruno::text);
    raise exception 'FALLO: Bruno pudo subir una ruta' using errcode = 'TF001';
  exception when insufficient_privilege then null;
  end;

  -- ---- Marta borra la ruta ----
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', marta, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from storage.objects where bucket_id = 'excursion-tracks' and name = mine;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: Marta no pudo borrar la ruta' using errcode = 'TF001'; end if;

  reset role;
  raise notice '✓ Todas las pruebas OK';
end;
$$;

rollback;
