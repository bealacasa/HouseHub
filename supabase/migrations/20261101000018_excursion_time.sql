-- =============================================================================
-- House Hub · Tiempo exacto de las excursiones (puesto a mano)
--
-- «¿Cuánto dura?» puede llevar, además de «un rato / media jornada / día entero», el
-- tiempo exacto que alguien de la familia escribe (en minutos). Si está puesto, es el
-- que se enseña en la lista y en la ficha, por delante del tiempo del GPX.
-- Entre 1 minuto y 48 horas. Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

alter table public.excursions add column if not exists time_minutes integer;
alter table public.excursions drop constraint if exists excursions_time_minutes_check;
alter table public.excursions add constraint excursions_time_minutes_check
  check (time_minutes is null or time_minutes between 1 and 2880);

grant insert (time_minutes), update (time_minutes) on table public.excursions to authenticated;

commit;
