# House Hub — guía para trabajar en el proyecto

App web (PWA) para que una familia gestione sus viviendas: llegar e irse (checklists),
calendario de estancias, gastos compartidos, mantenimiento y contactos. **La usan personas
mayores**: sencillez y accesibilidad por encima de todo.

## Comandos

- `npm run dev` — desarrollo en http://localhost:5173 (usa `.env.local`)
- `npm run verify` — lint + typecheck + tests unitarios (obligatorio antes de cada commit)
- `npm run build` y `npm run test:e2e` — build real + Playwright (iPhone 15 y Pixel 7, axe)
- `npm run format` — Prettier

Node 24 (`.nvmrc`). Versiones exactas (`save-exact`); solo versiones con ≥ 14 días salvo
parches de seguridad.

## Stack

React 19 + Vite + TypeScript estricto + Tailwind v4 · React Router (rutas en diferido) ·
TanStack Query · Supabase (Postgres + RLS, Auth, Storage, Edge Functions) · Zod · date-fns ·
vite-plugin-pwa · Vitest + Testing Library · Playwright. Hosting: **Vercel** (`vercel.json`).

## Estructura

- `src/features/<módulo>/` — cada funcionalidad (auth, viviendas, checklists, gastos…) con
  sus pantallas, consultas (TanStack Query) y esquemas Zod. Lo que esté fuera de alcance
  (push, documentos, inventario, domótica) se añade como un módulo nuevo.
- `src/components/` — piezas de interfaz comunes (`ui.tsx`, `ConfirmDialog`).
- `src/lib/supabase.ts` — cliente único (`getSupabase()`); en tests, `installFakeSupabase()`.
- `supabase/migrations/` — SQL versionado, con comentarios didácticos. Se aplica en el SQL
  Editor de Supabase en orden. `supabase/templates/` — plantillas de email.

## Accesibilidad y uso (personas mayores)

- Texto base ≥ 17 px en `rem` (crece con la letra del sistema); títulos ≥ 1,5 rem.
- Objetivos táctiles ≥ 48 px; botones principales 56–64 px (`buttonPrimary`).
- Botones y pestañas siempre con **texto**; sin gestos (deslizar, mantener pulsado).
- Lenguaje claro, sin tecnicismos; fechas en palabras; errores con texto (no solo color).
- Acciones frecuentes en ≤ 3 toques. Confirmaciones claras; deshacer mejor que diálogos.
- Contraste objetivo AAA (7:1) en texto. Modo oscuro automático. `prefers-reduced-motion`.
- iPhone y Android: safe areas, campos ≥ 16 px (sin zoom), botón «atrás» de Android cierra
  diálogos (`useConfirm`), instalación con botón (Android) o guía (iPhone).

## Seguridad (obligatorio)

- **RLS en todas las tablas.** Acceso solo a viviendas de las que eres miembro; solo
  administradores invitan, quitan miembros o borran la vivienda. Tests de RLS por fase.
- Nunca `dangerouslySetInnerHTML` (regla de ESLint). Nunca `style={…}` inline (lo bloquea la
  CSP `style-src 'self'`): usa clases.
- Validar con Zod en cliente y en Edge Functions. Dinero en **céntimos enteros**.
- CSP y cabeceras en `vercel.json` (test en `src/lib/headers.test.ts`). Si cambia el
  proyecto de Supabase, actualizar `connect-src` e `img-src`.
- Secretos solo en variables de entorno de Supabase/Vercel. **La service role / secret key
  nunca llega al cliente** ni al repo. `.env.local` está en `.gitignore`.
- Invitaciones: token aleatorio de un solo uso, caduca a las 72 h; en BD solo su hash; se
  valida en una Edge Function.
- Fotos: bucket privado, URLs firmadas cortas, validar tipo/tamaño, quitar EXIF/GPS.
- No guardar tarjetas, IBAN, códigos de alarma ni combinaciones (aviso en campos de notas).
- Sin analítica ni rastreadores. RGPD: exportar y borrar cuenta.

## Al cerrar cada fase

`npm run verify`, build y e2e en verde · revisión de seguridad (riesgos y mitigaciones) ·
cómo probarlo en iPhone y Android · propuesta de prueba con una persona mayor.
