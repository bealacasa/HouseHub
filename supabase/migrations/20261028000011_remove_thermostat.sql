-- =============================================================================
-- House Hub · Quitar el enlace a la app del termostato
--
-- La familia no lo usa, y además la regla que lo comprobaba ('^https://[^\s]{1,300}$')
-- no la admite Postgres (las repeticiones {n,m} llegan como mucho a 255): guardar un
-- enlace daba error siempre. Se borra la columna (y con ella esa regla y su permiso).
-- La app ya no la usa, así que da igual ejecutar esto antes o después de desplegar.
-- Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

alter table public.houses drop column if exists thermostat_url;

commit;
