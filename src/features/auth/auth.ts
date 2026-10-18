import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo válido, por ejemplo ana@gmail.com.").max(254));

/** El código del email: 6 cifras (se aceptan espacios o guiones al copiarlo). */
export const codeSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "El código tiene 6 números."));

export type AuthResult = { ok: true } | { ok: false; error: string };

const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probar.";

/** Sesión actual (y si aún se está comprobando). */
export function useSession(): { session: Session | null; loading: boolean } {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Envía el email con el código de acceso (y un enlace). La respuesta es la misma exista o
 * no la cuenta, para no revelar quién usa la app. Supabase limita los envíos por hora.
 */
export async function sendCode(rawEmail: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "" };
  const { error } = await getSupabase().auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error?.status === 429) return { ok: false, error: TOO_MANY };
  if (error) return { ok: false, error: "No se pudo enviar el correo. Inténtalo de nuevo." };
  return { ok: true };
}

/** Comprueba el código de 6 cifras y abre la sesión. */
export async function verifyCode(rawEmail: string, rawCode: string): Promise<AuthResult> {
  const email = emailSchema.safeParse(rawEmail);
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return { ok: false, error: code.error.issues[0]?.message ?? "" };
  if (!email.success) return { ok: false, error: "Vuelve atrás y escribe tu correo." };
  const { error } = await getSupabase().auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });
  if (error?.status === 429) return { ok: false, error: TOO_MANY };
  if (error) {
    return { ok: false, error: "El código no es correcto o ha caducado. Pide uno nuevo." };
  }
  return { ok: true };
}

/** Enlace del email (/acceso/confirmar?token_hash=…): funciona en cualquier navegador. */
export async function verifyLink(tokenHash: string): Promise<AuthResult> {
  if (!/^[\w-]{10,200}$/.test(tokenHash)) return { ok: false, error: "Enlace no válido." };
  const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return error
    ? { ok: false, error: "El enlace no es válido o ha caducado. Pide un código nuevo." }
    : { ok: true };
}

export const passkeysSupported = () =>
  typeof window !== "undefined" && "PublicKeyCredential" in window;

/** Detalle técnico del fallo (para poder diagnosticarlo), sin datos personales. */
function detail(error: unknown): string {
  const e = error as { name?: string; message?: string; code?: string; status?: number } | null;
  const parts = [e?.name, e?.code, e?.status, e?.message].filter(Boolean).join(" · ");
  return parts ? ` (Detalle: ${parts.slice(0, 200)})` : "";
}

async function attempt(
  action: () => Promise<{ error: unknown }>,
  message: string,
): Promise<AuthResult> {
  try {
    const { error } = await action();
    return error ? { ok: false, error: message + detail(error) } : { ok: true };
  } catch (thrown) {
    // El navegador puede lanzar errores propios (p. ej. NotAllowedError si se cancela).
    return { ok: false, error: message + detail(thrown) };
  }
}

/** Marca de «ya se ofreció (o ya se usa) la cara o huella en este móvil». */
export const PASSKEY_ASKED = "househub:passkey-asked";

export async function signInWithPasskey(): Promise<AuthResult> {
  const result = await attempt(
    () => getSupabase().auth.signInWithPasskey(),
    "No se pudo entrar con la cara o la huella. Usa el código.",
  );
  // NotAllowedError: se canceló o en este móvil no hay cara/huella guardada para la app.
  if (!result.ok && /NotAllowed/i.test(result.error)) {
    return {
      ok: false,
      error:
        "En este móvil todavía no está activada la cara o la huella (o se canceló). Entra con el código y actívala en Más → Mi cuenta.",
    };
  }
  // Si ya entra con la cara o huella, no hace falta ofrecérselo.
  if (result.ok) {
    try {
      localStorage.setItem(PASSKEY_ASKED, "1");
    } catch {
      // Sin almacenamiento: se ofrecerá, sin más.
    }
  }
  return result;
}

export async function registerPasskey(): Promise<AuthResult> {
  const result = await attempt(() => getSupabase().auth.registerPasskey(), "No se pudo activar.");
  // InvalidStateError / «previously registered»: este móvil ya la tenía activada.
  if (!result.ok && /InvalidState|previously registered|already registered/i.test(result.error)) {
    return { ok: true };
  }
  return result;
}

/** Cierra la sesión en este móvil o, con `everywhere`, en todos los dispositivos. */
export async function signOut(everywhere = false): Promise<void> {
  await getSupabase().auth.signOut({ scope: everywhere ? "global" : "local" });
}
