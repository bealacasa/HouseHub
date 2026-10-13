# House Hub

App web para gestionar en familia una o varias viviendas: qué hacer al llegar y al irse,
quién va y cuándo, gastos compartidos, mantenimiento y contactos útiles. Pensada para
móviles (iPhone y Android) y para personas mayores: letra grande, botones grandes y
lenguaje claro.

## Puesta en marcha

1. `npm ci`
2. Copia `.env.example` como `.env.local` y pon la URL y la clave _publishable_ de Supabase.
3. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor de Supabase).
4. `npm run dev`

Más detalles (comandos, convenciones y reglas de seguridad) en [CLAUDE.md](CLAUDE.md).
