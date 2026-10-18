-- =============================================================================
-- House Hub · Eventos del pueblo: fecha de inicio y fecha de fin (sin hora)
--
-- Las fiestas duran varios días: en vez de "día + hora", ahora "desde … hasta …".
-- Los eventos que ya existan se conservan (su día pasa a ser inicio y fin).
-- Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

do $$
begin
  -- "date" pasa a llamarse "start_date".
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'village_events' and column_name = 'date') then
    alter table public.village_events rename column date to start_date;
  end if;
end;
$$;

alter table public.village_events add column if not exists end_date date;
update public.village_events set end_date = start_date where end_date is null;
alter table public.village_events alter column end_date set not null;

alter table public.village_events drop constraint if exists village_events_dates_check;
alter table public.village_events add constraint village_events_dates_check
  check (end_date >= start_date and end_date - start_date <= 366);

alter table public.village_events drop column if exists start_time;

drop index if exists public.village_events_house_date;
create index if not exists village_events_house_dates on public.village_events (house_id, start_date, end_date);

-- Permisos por columna con los nuevos nombres.
revoke insert, update on table public.village_events from authenticated;
grant insert (house_id, title, start_date, end_date, place, note) on table public.village_events to authenticated;
grant update (title, start_date, end_date, place, note) on table public.village_events to authenticated;

commit;
