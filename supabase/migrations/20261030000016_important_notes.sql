-- =============================================================================
-- House Hub · Notas importantes
--
-- Una nota se puede marcar como «importante» (⭐): esas son las que salen en el inicio.
-- Las demás siguen en Casa → Notas. Cualquiera de la casa puede marcarla o quitarla.
-- Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

alter table public.house_notes add column if not exists important boolean not null default false;

grant insert (important), update (important) on table public.house_notes to authenticated;

commit;
