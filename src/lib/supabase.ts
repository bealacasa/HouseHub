import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** ¿Está configurado Supabase? (En los tests no: se usa un cliente simulado.) */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Cliente único de Supabase. La clave publicable es pública por diseño: lo que protege
 * los datos es el inicio de sesión y las políticas RLS de Postgres.
 *
 * - PKCE: el enlace del email no lleva la sesión en la URL, sino un código de un solo uso.
 * - El acceso habitual es con el código de 6 dígitos (verifyOtp), que funciona igual en la
 *   app instalada y en el navegador (en el iPhone no comparten sesión).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!url || !key) throw new Error("Supabase no está configurado (.env.local).");
  client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "househub-auth",
    },
  });
  return client;
}

/** Solo para los tests: sustituye el cliente por uno simulado. */
export function setSupabaseForTests(fake: SupabaseClient | null): void {
  client = fake;
}
