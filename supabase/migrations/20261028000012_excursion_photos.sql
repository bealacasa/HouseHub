-- =============================================================================
-- House Hub · Excursiones con varias fotos para encontrar el sitio
--
-- Como en las instrucciones: una lista ORDENADA de fotos, cada una con una frase
-- («Aparcar junto a la ermita», «En la fuente, el camino de la izquierda»…).
-- Se guardan juntas en una columna jsonb [{path, caption}, …]: de una vez (todo o nada)
-- y en el orden del array. La primera es la portada.
-- photo_path se queda (la app la rellena con la primera foto) para que las versiones
-- anteriores de la app sigan viendo la portada.
-- Idempotente: se puede ejecutar varias veces.
-- =============================================================================

begin;

-- ¿Tiene la lista la forma correcta? De 0 a 12 objetos {path, caption}, fotos de ESTA casa.
create or replace function public.excursion_photos_valid(p_photos jsonb, p_house uuid)
returns boolean language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_photos) = 'array'
    and jsonb_array_length(p_photos) <= 12
    and not exists (
      select 1 from jsonb_array_elements(p_photos) as p(photo)
      where jsonb_typeof(photo) <> 'object'
         or jsonb_typeof(photo -> 'path') <> 'string'
         or public.house_from_path(photo ->> 'path') is distinct from p_house
         or jsonb_typeof(photo -> 'caption') <> 'string'
         or char_length(photo ->> 'caption') > 200
         or (select count(*) from jsonb_object_keys(photo)) > 2
    );
$$;

alter table public.excursions add column if not exists photos jsonb not null default '[]';

-- La foto que ya hubiera pasa a ser la primera de la lista.
update public.excursions
   set photos = jsonb_build_array(jsonb_build_object('path', photo_path, 'caption', ''))
 where photo_path is not null and photos = '[]'::jsonb;

alter table public.excursions drop constraint if exists excursions_photos_valid;
alter table public.excursions add constraint excursions_photos_valid
  check (public.excursion_photos_valid(photos, house_id));

grant insert (photos), update (photos) on table public.excursions to authenticated;

commit;
