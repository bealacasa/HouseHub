// Edge Function «accept-invite»: acepta una invitación a la casa.
//
// 1. Comprueba quién llama (su sesión de Supabase, en la cabecera Authorization).
// 2. Valida el token con Zod (43 caracteres base64url).
// 3. Llama a public.accept_invitation con la clave de servicio, que solo existe aquí
//    (variable de entorno de Supabase): nunca llega al navegador ni al repositorio.
//
// La función de la base de datos hace el resto en una transacción: comprueba el hash,
// la caducidad, que no esté usada ni anulada, el límite de intentos, y la gasta.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://house-hub-five.vercel.app";

const bodySchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método no permitido." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Falta configuración." });

  // ¿Quién llama? Se valida su token de sesión con Supabase Auth.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return reply(401, { error: "Inicia sesión primero." });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply(400, { error: "La invitación no es válida." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("accept_invitation", {
    p_token: parsed.data.token,
    p_user: userData.user.id,
  });
  if (error) {
    // Los errores de negocio (P0001) llevan un mensaje pensado para el usuario.
    const message = error.code === "P0001" ? error.message : "No se pudo aceptar la invitación.";
    return reply(400, { error: message });
  }
  return reply(200, { houseId: data });
});
